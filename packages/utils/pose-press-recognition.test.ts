import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveEffectiveMovementProfile } from "./exercise-movement-contract.ts";
import { createBrowserPoseAnalyzer } from "../../apps/mobile/lib/workout/browserPoseAnalyzer.ts";
import { createExerciseCameraPoseAnalyzer } from "../../apps/web/components/exercise-lab/exerciseCameraPoseAnalyzer.ts";
import {
  createGeneratedExerciseRigFromMovementContract,
  normalizeExerciseMovementProfile,
  applyGeneratedRigDominantAngle,
} from "./exercise-editor.ts";
import {
  buildFallbackPoseMovementContract,
  getPoseMovementFrameAssessment,
} from "./pose.ts";
import {
  getPoseFrameContractAngle,
  getRigUpperArmPhaseMatch,
} from "./pose-rig.ts";
import {
  createPoseRepEngineState,
  stepPoseRepEngine,
} from "./pose-rep-engine.ts";
import {
  advancePoseSubjectTracker,
  createPoseSubjectTrackerState,
} from "./pose-subject-tracker.ts";
import type {
  PoseKeypointRecord,
  ExerciseMovementProfileRecord,
} from "@fittrack/types";

function profile(): ExerciseMovementProfileRecord {
  if (process.env.FITTRACK_BENCH_DEFINITION) {
    const value = JSON.parse(
      readFileSync(process.env.FITTRACK_BENCH_DEFINITION, "utf8"),
    );
    return value.patch?.movement_profile_override ?? value.movement_profile;
  }
  const original = buildFallbackPoseMovementContract("bench_press")!;
  const contract = {
    ...original,
    bodyOrientation: "any" as const,
    requiredSides: "either" as const,
    partialRepPolicy: "count_half_reps" as const,
    phaseOrder: ["setup", "press", "lower"],
    repThresholds: {
      up: { angle: 90, tolerance: 10 },
      down: { angle: 125, tolerance: 5 },
    },
    spatialRequirements: { bodyYTravelMin: 0 },
    trackingRequirements: {
      ...original.trackingRequirements!,
      requiredSides: "either" as const,
      requiredLandmarks: ["shoulders", "elbows", "wrists"],
    },
  };
  return normalizeExerciseMovementProfile({
    movementContract: contract,
    rig: createGeneratedExerciseRigFromMovementContract({
      movementContract: contract,
    }),
  })!;
}

test("cleared contract safeguards stay cleared when an exercise overrides a shared family", () => {
  const edited = profile();
  const original = normalizeExerciseMovementProfile({
    movementContract: buildFallbackPoseMovementContract("bench_press"),
  })!;
  const unchanged = structuredClone(original);
  const input = {exerciseId: "bench", familyKey: "bench_press" as const,
    familyRevision: 3, familyBaseProfile: original, override: edited,
    trackingMode: "override" as const};
  const effective = resolveEffectiveMovementProfile(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(effective.profile?.movementContract, edited.movementContract);
  assert.equal(normalizeExerciseMovementProfile(effective.profile)?.movementContract?.trackingRequirements?.minReliableFrameLandmarks, 4);
  assert.deepEqual(original, unchanged);
  assert.deepEqual(resolveEffectiveMovementProfile({...input, trackingMode: "inherit"}).profile, original);
  assert.equal(resolveEffectiveMovementProfile({...input, trackingMode: "manual"}).profile, null);
  assert.deepEqual(resolveEffectiveMovementProfile({...input, override: {warnings: []}}).profile?.movementContract, original.movementContract);
});

// Independent 3D limb kinematics: a press changes both upper-arm position and
// elbow extension; a curl holds the upper arm fixed. No rig-generator points
// or camera capture are used as detector input. Hidden joints remain hidden.
function cameraPose(
  angle: number,
  kind: "press" | "curl" | "flared_curl",
  hide: number[] = [],
) {
  const points: PoseKeypointRecord[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0.05,
  }));
  const radians = (angle * Math.PI) / 180,
    half = radians / 2,
    length = Math.sqrt(0.08);
  const elevation = (Math.max(0, Math.min(1, (angle - 90) / 65)) * Math.PI) / 2;
  for (const [side, direction] of [
    [0, -1],
    [1, 1],
  ] as const) {
    const shoulder = { x: direction * 0.18, y: 0, z: 0 };
    const u =
      kind === "curl"
        ? { x: 0, y: 0, z: 1 }
        : kind === "flared_curl"
          ? { x: direction / Math.sqrt(2), y: 0, z: 1 / Math.sqrt(2) }
          : {
              x: direction * Math.cos(half),
              y: -Math.sin(half) * Math.sin(elevation),
              z: Math.sin(half) * Math.cos(elevation),
            };
    // Project the upward direction perpendicular to the upper arm.
    const dot = -u.y;
    const raw = { x: -dot * u.x, y: -1 - dot * u.y, z: -dot * u.z };
    const norm = Math.hypot(raw.x, raw.y, raw.z);
    const v = {
      x: -Math.cos(radians) * u.x + (Math.sin(radians) * raw.x) / norm,
      y: -Math.cos(radians) * u.y + (Math.sin(radians) * raw.y) / norm,
      z: -Math.cos(radians) * u.z + (Math.sin(radians) * raw.z) / norm,
    };
    const elbow = {
      x: shoulder.x + length * u.x,
      y: shoulder.y + length * u.y,
      z: shoulder.z + length * u.z,
    };
    const wrist = {
      x: elbow.x + length * v.x,
      y: elbow.y + length * v.y,
      z: elbow.z + length * v.z,
    };
    for (const [index, point] of [
      [11 + side, shoulder],
      [13 + side, elbow],
      [15 + side, wrist],
    ] as const)
      points[index] = {
        ...point,
        visibility: side === 0 || index === 12 ? 0.95 : 0.05,
      };
  }
  for (const index of hide) points[index]!.visibility = 0.05;
  return points;
}

for (const runtime of ["mobile", "exercise-lab"] as const) {
test(`${runtime} camera path distinguishes a cropped press from curls with identical elbow angles`, async (context) => {
  assert.equal(process.env.FITTRACK_POSE_ADAPTER_REPLAY, "1");
  const host = globalThis as typeof globalThis & {
    document?: unknown;
    __fittrackPoseAdapterReplay?: {
      options?: unknown;
      calls: number;
      result: unknown;
    };
  };
  const oldDocument = host.document;
  const video = {
    readyState: 3,
    videoWidth: 960,
    videoHeight: 540,
    currentTime: 0,
  };
  host.document = { querySelectorAll: () => [video] };
  const detector = (host.__fittrackPoseAdapterReplay = {
    calls: 0,
    result: { landmarks: [] },
  });
  let now = 1000;
  context.mock.method(Date, "now", () => now);
  const analyzer = runtime === "mobile"
    ? await createBrowserPoseAnalyzer({ subjectTrackingMode: "off" })
    : await createExerciseCameraPoseAnalyzer(video as unknown as HTMLVideoElement);
  assert.equal((detector as any).options.numPoses, 1);
  const saved = profile(),
    contract = saved.movementContract!;
  assert.equal(contract.trackingRequirements!.minReliableFrameLandmarks, 4);
  const press = [90, 90, 105, 115, 125, 125];
  async function run(
    kind: "press" | "curl" | "flared_curl",
    angles = press,
    options: { hide?: number[]; noRig?: boolean } = {},
  ) {
    let engine = createPoseRepEngineState();
    let subject = createPoseSubjectTrackerState("off", 1, 1);
    const trace = [];
    for (const angle of angles) {
      now += 150;
      video.currentTime += 0.15;
      const world = cameraPose(angle, kind, options.hide);
      const image = world.map((p) => ({
        ...p,
        x: 0.5 + ((p.x / (3 + p.z)) * video.videoHeight) / video.videoWidth,
        y: 0.5 + p.y / (3 + p.z),
      }));
      detector.result = JSON.parse(
        JSON.stringify({ landmarks: [image], worldLandmarks: [world] }),
      );
      const frame = await analyzer.readFrame();
      assert.ok(frame);
      const selection = advancePoseSubjectTracker(subject, {
        mode: "off",
        generation: 1,
        streamId: 1,
        candidates: frame.candidates,
        capturedAtMs: frame.capturedAtMs,
        nowMs: now,
      });
      subject = selection.nextState;
      assert.equal(
        selection.canCount,
        true,
        "Association off must not impose a hip signature",
      );
      const dimensions = { width: frame.frameWidth, height: frame.frameHeight };
      const measured = getPoseFrameContractAngle(contract, frame, dimensions);
      if (!options.hide?.length)
        assert.ok(
          Math.abs(measured! - angle) < 0.001,
          "The press and curl have the same elbow angles",
        );
      const evidence = {
        rig: options.noRig ? undefined : saved.rig,
        keypoints: frame.keypoints,
        spatialKeypoints: frame.spatialKeypoints,
        coordinateDimensions: dimensions,
      };
      const step = stepPoseRepEngine(
        engine,
        contract,
        measured,
        frame.capturedAtMs,
        evidence,
      );
      engine = step.nextState;
      trace.push({
        count: engine.repCount,
        reason: step.noCountReason,
        reference: getRigUpperArmPhaseMatch(
          contract,
          evidence.rig,
          frame.spatialKeypoints,
          { width: 1, height: 1, depthScale: 1 },
        ),
      });
      const calls = detector.calls;
      const duplicate = await analyzer.readFrame();
      assert.ok(!duplicate || duplicate.isDuplicate, "A repeated decoded frame is not new evidence");
      assert.equal(detector.calls, calls);
    }
    return { count: engine.repCount, trace };
  }
  try {
    const legacy = await run("flared_curl", press, { noRig: true });
    assert.equal(
      legacy.count,
      1,
      "Elbow-only counting reproduces the reported false positive",
    );
    for (const kind of ["curl", "flared_curl"] as const) {
      const rejected = await run(kind, [
        ...press,
        145,
        155,
        155,
        125,
        105,
        90,
        90,
      ]);
      assert.equal(rejected.count, 0, JSON.stringify({ kind, ...rejected }));
    }
    const valid = await run("press");
    assert.deepEqual(
      valid.trace.map((f) => f.count),
      [0, 0, 0, 0, 0, 1],
      JSON.stringify(valid),
    );
    const overshoot = await run("press", [
      ...press,
      145,
      155,
      155,
      125,
      105,
      90,
      90,
      105,
      115,
      145,
      155,
    ]);
    assert.equal(overshoot.count, 2, JSON.stringify(overshoot));
    const partial = await run("press", [90, 90, 100, 110, 110, 100, 90, 90]);
    assert.equal(partial.count, 0, JSON.stringify(partial));
    for (const hide of [[15], [12]]) {
      const rejected = await run("press", press, { hide });
      assert.equal(rejected.count, 0, JSON.stringify({ hide, ...rejected }));
    }
    const partialBody = cameraPose(90, "press");
    assert.equal(
      getPoseMovementFrameAssessment(contract, partialBody).isReliable,
      true,
    );
    assert.equal(
      getPoseMovementFrameAssessment(
        { ...contract, bodyOrientation: "horizontal" },
        partialBody,
      ).isReliable,
      false,
      "Explicit posture enforcement still requires a hip; it is never silently bypassed",
    );
  } finally {
    analyzer.dispose();
    host.document = oldDocument;
    delete host.__fittrackPoseAdapterReplay;
  }
});
}

test("bench reference presses upward and preserves its bend direction while editing", () => {
  const saved = profile(),
    rig = saved.rig!,
    start = rig.keyframes.find((f) => f.kind === "start")!,
    target = rig.keyframes.find((f) => f.kind === "peak")!;
  for (const offset of [0, 1]) {
    assert.ok(
      target.keypoints[15 + offset]!.y < start.keypoints[15 + offset]!.y,
    );
    assert.ok(
      target.keypoints[13 + offset]!.y < start.keypoints[13 + offset]!.y,
    );
    const edited = applyGeneratedRigDominantAngle(
      start.keypoints,
      "elbow",
      155,
    );
    assert.ok(
      edited[15 + offset]!.y < edited[13 + offset]!.y,
      "Editing must not flip the forearm down",
    );
  }
});
