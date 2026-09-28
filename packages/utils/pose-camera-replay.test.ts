import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type {
  ExerciseRigRecord,
  PoseKeypointRecord,
  PoseMovementContractRecord,
} from "@fittrack/types";
import {
  applyGeneratedRigDominantAngle,
  createExerciseMovementProfile,
  createGeneratedExerciseRigFromMovementContract,
  getSpatialRequirementsForPreset,
  normalizeExerciseMovementProfile,
} from "./exercise-editor.ts";
import {
  resolveEffectiveMovementProfile,
  resolveExerciseTracking,
} from "./exercise-movement-contract.ts";
import {
  computePoseSignals,
  getPoseMovementFrameAssessment,
  getPoseMovementContractSideAngles,
  getPoseMovementPostureReason,
  getPoseTorsoSlopeAngles,
  normalizePoseMovementContract,
} from "./pose.ts";
import {
  getPoseFrameContractAngle,
  getRigMovementContract,
} from "./pose-rig.ts";
import {
  createPoseRepEngineState,
  stepPoseRepEngine,
  stepPoseStaticHold,
} from "./pose-rep-engine.ts";
import {
  advancePoseSubjectTracker,
  createPoseSubjectTrackerState,
} from "./pose-subject-tracker.ts";

// These fixtures contain independent camera coordinates, not frames emitted by
// the production rig generator. Test failures show rejection reasons internally;
// nothing is added to the application UI or captured from a real camera.
type Tuples = [number, number, number, number][];
const fixture = JSON.parse(
  readFileSync(new URL("./pose-camera-fixtures.json", import.meta.url), "utf8"),
) as {
  families: Record<
    string,
    { contract: PoseMovementContractRecord; start: Tuples; peak: Tuples }
  >;
  benchRanges: Record<"start" | "short" | "half" | "full", Tuples>;
};
const points = (tuples: Tuples): PoseKeypointRecord[] =>
  tuples.map(([x, y, z, visibility]) => ({ x, y, z, visibility }));
const dimensions = { width: 1, height: 1 };
function definition(key: string) {
  const contract = normalizePoseMovementContract(
    structuredClone(fixture.families[key]!.contract),
  )!;
  return {
    contract,
    rig: createGeneratedExerciseRigFromMovementContract({
      movementContract: contract,
    }),
  };
}
function interpolate(
  a: PoseKeypointRecord[],
  b: PoseKeypointRecord[],
  t: number,
) {
  return a.map((point, i) => ({
    ...point,
    x: point.x + (b[i]!.x - point.x) * t,
    y: point.y + (b[i]!.y - point.y) * t,
    z: point.z + (b[i]!.z - point.z) * t,
  }));
}
function cycle(start: PoseKeypointRecord[], peak: PoseKeypointRecord[]) {
  return [0, 0, 0.2, 0.4, 0.6, 0.8, 1, 1, 0.8, 0.6, 0.4, 0.2, 0, 0].map((t) =>
    interpolate(start, peak, t),
  );
}
function familyCycle(key: string) {
  const f = fixture.families[key]!;
  return cycle(points(f.start), points(f.peak));
}
function replay(
  contract: PoseMovementContractRecord,
  rig: ExerciseRigRecord | null,
  frames: PoseKeypointRecord[][],
  options: {
    spatial?: PoseKeypointRecord[][];
    timestamps?: number[];
    initial?: ReturnType<typeof createPoseRepEngineState>;
  } = {},
) {
  let state = options.initial ?? createPoseRepEngineState();
  const history: { capturedAtMs: number; keypoints: PoseKeypointRecord[] }[] =
    [];
  const trace: { count: number; reason: string | null; phase: string }[] = [];
  for (const [i, keypoints] of frames.entries()) {
    const capturedAtMs = options.timestamps?.[i] ?? 100 + i * 150;
    const frame = {
      capturedAtMs,
      keypoints,
      spatialKeypoints: options.spatial?.[i],
    };
    history.push(frame);
    const result = stepPoseRepEngine(
      state,
      contract,
      getPoseFrameContractAngle(contract, frame, dimensions),
      capturedAtMs,
      {
        keypoints,
        spatialKeypoints: frame.spatialKeypoints,
        rig,
        coordinateDimensions: dimensions,
        exerciseDeclared: true,
        signals: computePoseSignals(history, dimensions),
        keypointFrames: history.map((frame) => frame.keypoints),
      },
    );
    state = result.nextState;
    trace.push({
      count: state.repCount,
      reason: result.noCountReason,
      phase: state.phase,
    });
  }
  return { state, trace };
}
const expectCount = (result: ReturnType<typeof replay>, count: number) =>
  assert.equal(result.state.repCount, count, JSON.stringify(result.trace));

// Optional local read-only audit uses the API's actual effective definitions,
// not just fallback contracts. The tuned cropped bench has its independent 3D
// adapter replay in pose-press-recognition.test.ts.
if (process.env.FITTRACK_CATALOG_DEFINITIONS) {
  const catalog = JSON.parse(readFileSync(process.env.FITTRACK_CATALOG_DEFINITIONS, "utf8"));
  for (const row of catalog.filter((row: any) => row.profile && row.id !== "f7113812-a752-52a9-b770-ed2bddef8767")) {
    test(`saved catalog camera contract: ${row.name}`, () => {
      const saved = normalizeExerciseMovementProfile(row.profile)!;
      const contract = saved.movementContract!;
      assert.ok(fixture.families[row.family], `Missing independent fixture for ${row.family}`);
      if (contract.repModel !== "static_hold") {
        expectCount(replay(contract, saved.rig, familyCycle(row.family)), 1);
        return;
      }
      const keypoints = points(fixture.families[row.family]!.peak);
      let state = createPoseRepEngineState();
      let completed = false;
      for (let timestamp = 100; timestamp <= (contract.holdDurationSeconds ?? 30) * 1000 + 500; timestamp += 100) {
        const step = stepPoseStaticHold(state, contract, getPoseFrameContractAngle(contract, {keypoints}, dimensions), timestamp, {
          keypoints, rig: saved.rig, coordinateDimensions: dimensions, exerciseDeclared: true,
        });
        assert.equal(step.noCountReason, null);
        completed ||= step.holdCompleted;
        state = step.nextState;
      }
      assert.equal(completed, true);
      assert.equal(state.repCount, 0);
    });
  }
}

test("short presses count at extension and a validated return rearms the next press", () => {
  for (const requiredSides of ["both", "either", "left", "right"] as const) {
    const {contract}=definition("bench_press");
    contract.requiredSides=requiredSides;
    contract.partialRepPolicy="count_half_reps";
    contract.phaseOrder=["setup","press","lower"];
    contract.repThresholds={up:{angle:90,tolerance:10},down:{angle:125,tolerance:5}};
    contract.spatialRequirements={...contract.spatialRequirements,bodyLineScope:"torso",bodyYTravelMin:0};
    const profile=normalizeExerciseMovementProfile({movementContract:contract,
      rig:createGeneratedExerciseRigFromMovementContract({movementContract:contract})})!;
    const start=points(fixture.benchRanges.full);
    const extension=points(fixture.benchRanges.start);
    const progress=[0,0,.2,.4,.6,.6,1,1,.6,.4,.2,0,0,.2,.4,.6,.6];
    const frames=progress.map(t=>interpolate(start,extension,t).map((p,i)=>({
      ...p,visibility:requiredSides!=="both" && (requiredSides === "right" ? [13,15] : [14,16]).includes(i) ? .1 : p.visibility,
    })));
    const result=replay(profile.movementContract!,profile.rig!,frames);
    assert.deepEqual(result.trace.map(frame=>frame.count),
      [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,2],
      `${requiredSides}: ${JSON.stringify(result.trace)}`);
    assert.ok(result.trace.every(frame=>frame.reason===null),JSON.stringify(result.trace));
  }
});

for (const key of Object.keys(fixture.families).filter(
  (key) => key !== "plank",
)) {
  test(`independent camera payload counts with saved ${key} definition`, () => {
    const { contract, rig } = definition(key);
    expectCount(replay(contract, rig, familyCycle(key)), 1);
  });
}

test("every reset keeps the limb rig upright and independent of camera posture fields", () => {
  for (const key of Object.keys(fixture.families)) {
    const {contract,rig} = definition(key);
    for (const frame of rig.keyframes) {
      const dx = frame.keypoints[23]!.x + frame.keypoints[24]!.x - frame.keypoints[11]!.x - frame.keypoints[12]!.x;
      const dy = frame.keypoints[23]!.y + frame.keypoints[24]!.y - frame.keypoints[11]!.y - frame.keypoints[12]!.y;
      assert.ok(Math.abs(dx) < 1e-6 && dy > 0, key);
    }
    const changed = createGeneratedExerciseRigFromMovementContract({movementContract:{
      ...contract,bodyOrientation:"horizontal",
      spatialRequirements:{...contract.spatialRequirements,torsoSlopeMinDeg:0,torsoSlopeMaxDeg:20},
    }});
    assert.deepEqual(changed.keyframes,rig.keyframes,`${key}: posture fields must not re-pose limbs`);
  }
});

test("legacy sideways rigs reopen upright without losing edited angles or changing input data", () => {
  const {contract,rig}=definition("bench_press");
  const legacy=structuredClone(rig);
  legacy.referenceVersion=1;
  legacy.keyframes.forEach(frame=>{
    frame.keypoints=frame.keypoints.map(p=>({...p,x:p.y,y:1-p.x}));
  });
  const before=JSON.stringify(legacy);
  const reopened=normalizeExerciseMovementProfile({movementContract:contract,rig:legacy})!;
  assert.equal(JSON.stringify(legacy),before);
  assert.equal(reopened.rig!.referenceVersion,2);
  for (let i=0;i<legacy.keyframes.length;i++) {
    const oldAngles=getPoseMovementContractSideAngles(contract,legacy.keyframes[i]!.keypoints);
    const newAngles=getPoseMovementContractSideAngles(contract,reopened.rig!.keyframes[i]!.keypoints);
    assert.ok(Math.abs(oldAngles.left!-newAngles.left!)<1e-6);
    assert.ok(Math.abs(oldAngles.right!-newAngles.right!)<1e-6);
  }
  assert.deepEqual(normalizeExerciseMovementProfile(reopened),reopened);
  expectCount(replay(contract,reopened.rig,cycle(points(fixture.benchRanges.start),points(fixture.benchRanges.full))),1);
});

test("explicit torso bounds control camera posture without a second hidden reference band", () => {
  const {contract,rig}=definition("bench_press");
  const upright=cycle(points(fixture.benchRanges.start),points(fixture.benchRanges.full))
    .map(frame=>frame.map(p=>({...p,x:1-p.y,y:p.x})));
  const allowed={...contract,spatialRequirements:{...contract.spatialRequirements,torsoSlopeMinDeg:65,torsoSlopeMaxDeg:92}};
  expectCount(replay(allowed,rig,upright),1);
  const disallowed={...allowed,spatialRequirements:{...allowed.spatialRequirements,torsoSlopeMinDeg:0,torsoSlopeMaxDeg:20}};
  const rejected=replay(disallowed,rig,upright);
  expectCount(rejected,0);
  assert.ok(rejected.trace.some(frame=>frame.reason==="torso_slope_above_max"));
});

test("orientation-only safeguards reject the wrong posture even with full-body alignment or no line tolerance", () => {
  for (const key of ["bench_press","push_up","plank"]) {
    const {contract}=definition(key);
    delete contract.spatialRequirements!.torsoSlopeMinDeg;
    delete contract.spatialRequirements!.torsoSlopeMaxDeg;
    const horizontal=points(fixture.families[key]!.start);
    const upright=horizontal.map(p=>({...p,x:1-p.y,y:p.x}));
    assert.equal(getPoseMovementPostureReason(contract,horizontal),null,key);
    assert.ok(getPoseMovementPostureReason(contract,upright),key);
    delete contract.spatialRequirements!.bodyLineTolerance;
    assert.equal(getPoseMovementPostureReason(contract,upright),"body_orientation_mismatch",key);
    const edited={...contract,spatialRequirements:{...contract.spatialRequirements,torsoSlopeMinDeg:65,torsoSlopeMaxDeg:90}};
    assert.equal(getPoseMovementPostureReason(edited,upright),null,`${key}: explicit range overrides category`);
  }
});

test("edited minimum ROM accepts overshoot, rejects an incomplete ROM, and still requires return", () => {
  const { contract, rig } = definition("bench_press");
  const start = points(fixture.benchRanges.start);
  expectCount(
    replay(contract, rig, cycle(start, points(fixture.benchRanges.short))),
    1,
  );
  expectCount(
    replay(contract, rig, cycle(start, points(fixture.benchRanges.full))),
    1,
  );
  expectCount(
    replay(contract, rig, cycle(start, points(fixture.benchRanges.half))),
    0,
  );
  expectCount(
    replay(
      contract,
      rig,
      cycle(start, points(fixture.benchRanges.full)).slice(0, 8),
    ),
    0,
  );
  // A full-ROM definition rejects the exact shorter motion accepted above.
  const full = {
    ...contract,
    repThresholds: {
      ...contract.repThresholds,
      down: { angle: 90, tolerance: 10 },
    },
  };
  const fullRig = createGeneratedExerciseRigFromMovementContract({
    movementContract: full,
  });
  expectCount(
    replay(full, fullRig, cycle(start, points(fixture.benchRanges.short))),
    0,
  );
  expectCount(
    replay(full, fullRig, cycle(start, points(fixture.benchRanges.full))),
    1,
  );
});

test("saved elbow and moving upper-arm references both control the comparison", () => {
  const { contract, rig } = definition("bench_press");
  const edited = structuredClone(rig);
  edited.keyframes.find((frame) => frame.kind === "peak")!.keypoints = points(
    fixture.benchRanges.full,
  );
  assert.equal(
    getRigMovementContract(contract, edited).repThresholds.down.angle,
    90,
  );
  expectCount(
    replay(
      contract,
      edited,
      cycle(
        points(fixture.benchRanges.start),
        points(fixture.benchRanges.short),
      ),
    ),
    0,
  );
  const row = definition("seated_cable_row");
  // The moving-shoulder reference distinguishes equal elbow-angle cycles.
  // Replacing it with a stationary-arm curl reference changes what is counted.
  const original = replay(row.contract, row.rig, familyCycle("bicep_curl"));
  expectCount(original, 0);
  const curl = fixture.families.bicep_curl!;
  const editedRow = structuredClone(row.rig);
  editedRow.keyframes.forEach(
    (frame) =>
      (frame.keypoints = points(
        frame.kind === "peak" ? curl.peak : curl.start,
      )),
  );
  expectCount(replay(row.contract, editedRow, familyCycle("bicep_curl")), 1);
});

test("configured posture and body-travel safeguards reject a mismatched exercise", () => {
  for (const key of ["bench_press", "pull_up", "dip"]) {
    const { contract, rig } = definition(key);
    if (key === "pull_up") contract.spatialRequirements = getSpatialRequirementsForPreset("vertical_pull", contract);
    expectCount(replay(contract, rig, familyCycle("bicep_curl")), 0);
  }
});

test("saved posture and explicit torso limits remain active with a reference", () => {
  const { contract, rig } = definition("bench_press");
  const frames = cycle(
    points(fixture.benchRanges.start),
    points(fixture.benchRanges.full),
  );
  const upright = frames.map((frame) =>
    frame.map((p) => ({ ...p, x: p.y, y: p.x })),
  );
  expectCount(replay(contract, rig, upright), 0);
  const stricter = {
    ...contract,
    bodyOrientation: "any" as const,
    spatialRequirements: {
      ...contract.spatialRequirements,
      torsoSlopeMaxDeg: 20,
    },
  };
  expectCount(replay(stricter, rig, upright), 0);
  assert.ok(
    replay(stricter, rig, upright).trace.some(
      (frame) => frame.reason === "torso_slope_above_max",
    ),
  );
});

test("spatial coordinates preserve joint angles when 2D projection hides the bend", () => {
  const { contract, rig } = definition("bench_press");
  const spatial = cycle(
    points(fixture.benchRanges.start),
    points(fixture.benchRanges.short),
  ).map((frame) =>
    frame.map((p) => ({
      ...p,
      x: p.x * Math.cos(Math.PI * 0.48),
      z: p.x * Math.sin(Math.PI * 0.48),
    })),
  );
  const projected = spatial.map((frame) => frame.map((p) => ({ ...p, z: 0 })));
  expectCount(replay(contract, rig, projected, { spatial }), 1);
  expectCount(replay(contract, rig, projected), 0);
});

// A level camera looking along a lying body's length. Perspective makes the
// torso look vertical in the image; its measured 3D elevation is still zero.
function depthView(frames: PoseKeypointRecord[][]) {
  const yaw = 88 * Math.PI / 180;
  const spatial = frames.map(frame => frame.map(p => ({
    ...p,
    x: (p.x - .57) * Math.cos(yaw) - p.z * Math.sin(yaw),
    y: p.y - .5,
    z: (p.x - .57) * Math.sin(yaw) + p.z * Math.cos(yaw),
  })));
  const image = spatial.map(frame => frame.map(p => ({
    ...p,
    x: .5 + (p.x + .015) / (2 + p.z),
    y: .5 + (p.y + .55) / (2 + p.z),
    z: 0,
  })));
  return { spatial, image };
}

test("depth-facing bench counts full cycles even when perspective makes the torso look upright", () => {
  const { contract, rig } = definition("bench_press");
  const { image, spatial } = depthView(cycle(
    points(fixture.benchRanges.start), points(fixture.benchRanges.full),
  ));
  const imageSlopes = getPoseTorsoSlopeAngles(contract, image[0], dimensions);
  assert.ok(imageSlopes.left! > 70 && imageSlopes.right! > 70);
  assert.equal(getPoseMovementPostureReason(contract, image[0], dimensions), "body_line_over_tolerance");
  expectCount(replay(contract, rig, image, { spatial }), 1);
});

test("depth-aware posture keeps saved range, visibility, full-body alignment, and ROM requirements", () => {
  for (const key of ["bench_press", "push_up"]) {
    const { contract, rig } = definition(key);
    // This assertion is for a saved horizontal requirement. The legacy push-up
    // fixture explicitly permits 0–92 degrees, so it does not reject upright.
    contract.spatialRequirements = { ...contract.spatialRequirements, torsoSlopeMinDeg: 0, torsoSlopeMaxDeg: 40 };
    const frames = familyCycle(key);
    const { image, spatial } = depthView(frames);
    expectCount(replay(contract, rig, image, { spatial }), 1);
    const upright = depthView(frames.map(frame => frame.map(p => ({ ...p, x: 1-p.y, y: p.x }))));
    const rejected = replay(contract, rig, upright.image, { spatial: upright.spatial });
    expectCount(rejected, 0);
    assert.ok(rejected.trace.some(frame => frame.reason === "torso_slope_above_max"));
    const missingHip = image.map(frame => frame.map((p, i) => i === 23 ? { ...p, visibility: .1 } : { ...p }));
    const occluded = replay(contract, rig, missingHip, { spatial });
    expectCount(occluded, 0);
    assert.ok(occluded.trace.some(frame => frame.reason === "required_landmarks_unreliable"));
  }
  const { contract, rig } = definition("bench_press");
  const full = depthView(cycle(points(fixture.benchRanges.start), points(fixture.benchRanges.full)));
  const minimum = { ...contract, spatialRequirements: { ...contract.spatialRequirements, torsoSlopeMinDeg: 10, torsoSlopeMaxDeg: 20 } };
  const wrongSlope = replay(minimum, rig, full.image, { spatial: full.spatial });
  expectCount(wrongSlope, 0);
  assert.ok(wrongSlope.trace.some(frame => frame.reason === "torso_slope_below_min"));
  const partial = depthView(cycle(points(fixture.benchRanges.start), points(fixture.benchRanges.half)));
  expectCount(replay(contract, rig, partial.image, { spatial: partial.spatial }), 0);
  expectCount(replay(contract, rig, full.image.slice(0, 8), { spatial: full.spatial.slice(0, 8) }), 0);

  const pushup = definition("push_up");
  const folded = depthView(familyCycle("push_up").map(frame => frame.map((p, i) => {
    if (i !== 27 && i !== 28) return { ...p };
    const hip = frame[i-4]!, shoulder = frame[i-16]!;
    return { ...p, x: hip.x-(hip.x-shoulder.x), y: hip.y-(hip.y-shoulder.y), z: hip.z-(hip.z-shoulder.z) };
  })));
  const bentBody = replay(pushup.contract, pushup.rig, folded.image, { spatial: folded.spatial });
  expectCount(bentBody, 0);
  assert.ok(bentBody.trace.some(frame => frame.reason === "body_line_over_tolerance"));
});

test("saved either-side choice counts the visible arm while both-sides choice rejects the missing arm", () => {
  const { contract, rig } = definition("bench_press");
  const { image, spatial } = depthView(cycle(points(fixture.benchRanges.start), points(fixture.benchRanges.full)));
  for (const frames of [image, spatial]) for (const frame of frames) {
    frame[14]!.visibility = .1;
    frame[16]!.visibility = .1;
  }
  expectCount(replay(contract, rig, image, { spatial }), 0);
  // This is the builder's existing Required sides change, including its normal
  // profile creation and JSON round trip. No camera or saved record is changed.
  const saved = normalizeExerciseMovementProfile(JSON.parse(JSON.stringify(createExerciseMovementProfile({
    movementContract: { ...contract, requiredSides: "either" }, rig,
  }))))!;
  assert.equal(saved.movementContract!.trackingRequirements!.requiredSides, "either");
  expectCount(replay(saved.movementContract!, saved.rig, image, { spatial }), 1);
});

test("bilateral setup can settle one arm first without treating setup as a desynchronized rep", () => {
  const { contract, rig } = definition("bench_press");
  const start = points(fixture.benchRanges.start), peak = points(fixture.benchRanges.full);
  const settling = interpolate(start, peak, .3);
  const setup = start.map((p, i) => i === 14 || i === 16 ? settling[i]! : p);
  const frames = [...Array.from({length:5}, () => setup), ...cycle(start, peak)];
  const result = replay(contract, rig, frames);
  assert.equal(result.trace[6]!.phase, "down", JSON.stringify(result.trace));
  assert.equal(result.trace[6]!.count, 0, "Getting into position is not a rep");
  expectCount(result, 1);
});

test("depth-facing static holds use the same posture geometry", () => {
  const { contract, rig } = definition("plank");
  contract.holdDurationSeconds = 2;
  const { image, spatial } = depthView([points(fixture.families.plank!.peak)]);
  let state = createPoseRepEngineState();
  let completed = false;
  for (let timestamp = 100; timestamp <= 2500; timestamp += 100) {
    const frame = { keypoints: image[0]!, spatialKeypoints: spatial[0]! };
    const result = stepPoseStaticHold(state, contract, getPoseFrameContractAngle(contract, frame, dimensions), timestamp,
      { ...frame, rig, coordinateDimensions: dimensions });
    state = result.nextState;
    completed ||= result.holdCompleted;
    assert.equal(result.noCountReason, null);
  }
  assert.equal(completed, true);
  assert.equal(state.repCount, 0);
});

test("deeper secondary-joint motion also satisfies a shorter reference", () => {
  const { contract } = definition("seated_cable_row");
  contract.repThresholds.down = { angle: 123, tolerance: 5 };
  contract.spatialRequirements = {
    ...contract.spatialRequirements,
    bodyLineTolerance: 20,
  };
  const rig = createGeneratedExerciseRigFromMovementContract({
    movementContract: contract,
  });
  const peak = rig.keyframes.find((frame) => frame.kind === "peak")!;
  peak.keypoints = applyGeneratedRigDominantAngle(
    peak.keypoints,
    "shoulder",
    75,
  );
  peak.keypoints = applyGeneratedRigDominantAngle(peak.keypoints, "elbow", 123);
  expectCount(replay(contract, rig, familyCycle("seated_cable_row")), 1);
});

test("alternating references count each side's complete turn", () => {
  const {contract}=definition("seated_cable_row");
  contract.repModel="alternating";
  contract.requiredSides="alternating";
  const normalized=normalizePoseMovementContract(contract)!;
  const rig=createGeneratedExerciseRigFromMovementContract({movementContract:normalized});
  const start=points(fixture.families.seated_cable_row!.start);
  const peak=points(fixture.families.seated_cable_row!.peak);
  const leftOnly=peak.map((p,i)=>i>=12 && i%2===0 ? start[i]! : p);
  const rightOnly=peak.map((p,i)=>i>=11 && i%2===1 ? start[i]! : p);
  expectCount(replay(normalized,rig,[...cycle(start,leftOnly),...cycle(start,rightOnly)]),2);
});

test("camera distance does not change the configured travel requirement", () => {
  const { contract, rig } = definition("dip");
  for (const scale of [0.3, 0.65, 1.2]) {
    const frames = familyCycle("dip").map((frame) =>
      frame.map((p) => ({
        ...p,
        x: 0.5 + (p.x - 0.5) * scale,
        y: 0.5 + (p.y - 0.5) * scale,
      })),
    );
    expectCount(replay(contract, rig, frames), 1);
  }
});

test("one visible working arm plus both shoulders works for a moving upper-arm reference", () => {
  const { contract } = definition("bench_press");
  contract.requiredSides = "left";
  // Reproduce the old conflicting nested sides saved by the editor.
  contract.trackingRequirements = {
    ...contract.trackingRequirements,
    requiredSides: "both",
  };
  const normalized = normalizePoseMovementContract(contract)!;
  assert.equal(normalized.trackingRequirements!.requiredSides, "left");
  const frames = cycle(
    points(fixture.benchRanges.start),
    points(fixture.benchRanges.full),
  ).map((frame) =>
    frame.map((p, i) =>
      [14, 16, 18, 20, 22, 24, 26, 28, 30, 32].includes(i)
        ? { ...p, visibility: 0 }
        : p,
    ),
  );
  const assessment = getPoseMovementFrameAssessment(normalized, frames[0]!);
  assert.equal(assessment.isReliable, true, JSON.stringify(assessment));
  const subject = advancePoseSubjectTracker(
    createPoseSubjectTrackerState("off", 1, 1),
    {
      mode: "off",
      generation: 1,
      streamId: 1,
      candidates: [{ keypoints: frames[0]! }],
      capturedAtMs: 100,
      nowMs: 100,
    },
  );
  assert.equal(subject.canCount, true);
  expectCount(
    replay(
      normalized,
      createGeneratedExerciseRigFromMovementContract({
        movementContract: normalized,
      }),
      frames,
    ),
    1,
  );
});

test("normalization upgrades legacy artwork once, preserves subsequent edits and explicit manual mode", () => {
  const { contract, rig } = definition("bench_press");
  const legacy = structuredClone(rig);
  delete legacy.referenceVersion;
  const input = {
    movementContract: contract,
    rig: legacy,
    schemaVersion: "exercise_movement_profile_v1" as const,
    warnings: [],
  };
  const resolved = resolveEffectiveMovementProfile({
    exerciseId: "renamed-id",
    familyKey: "bench_press",
    familyRevision: 3,
    trackingMode: "inherit",
    familyBaseProfile: input,
    override: null,
  });
    const normalized = normalizeExerciseMovementProfile(resolved.profile)!;
    assert.equal(normalized.rig!.referenceVersion, 2);
    const edited = structuredClone(normalized);
  edited.rig!.keyframes[0]!.keypoints[15]!.x += 0.02;
  assert.deepEqual(
    normalizeExerciseMovementProfile(JSON.parse(JSON.stringify(edited)))!.rig,
    edited.rig,
  );
  assert.equal(
    legacy.referenceVersion,
    undefined,
    "read compatibility must not modify persisted input",
  );
  assert.equal(
    resolveExerciseTracking({
      isActive: true,
      trackingMode: "manual",
      movementProfile: edited,
      movementContractIdentity: null,
    }).status,
    "manual",
  );
  assert.equal(
    resolveExerciseTracking({
      isActive: true,
      trackingMode: "inherit",
      movementProfile: edited,
      movementContractIdentity: resolved.identity,
    }).status,
    "ready",
  );
});

test("hold uses the same reference and accrues time without fabricating repetitions", () => {
  const { contract, rig } = definition("plank");
  contract.holdDurationSeconds = 2;
  const keypoints = points(fixture.families.plank!.peak);
  let state = createPoseRepEngineState();
  let completed = false;
  for (let timestamp = 100; timestamp <= 2500; timestamp += 100) {
    const frame = { keypoints };
    const step = stepPoseStaticHold(
      state,
      contract,
      getPoseFrameContractAngle(contract, frame, dimensions),
      timestamp,
      {
        keypoints,
        rig,
        coordinateDimensions: dimensions,
        exerciseDeclared: true,
      },
    );
    state = step.nextState;
    completed ||= step.holdCompleted;
    assert.equal(step.noCountReason, null);
  }
  assert.equal(completed, true);
  assert.equal(state.repCount, 0);
});

// Integrity checks last: no partial carry-over across bad/missing/stale input.
test("jitter, a frozen pose, and insufficient depth do not form a repetition", () => {
  const { contract, rig } = definition("bench_press");
  const start = points(fixture.benchRanges.start);
  const noise = Array.from({ length: 30 }, (_, i) =>
    start.map((p, index) => ({
      ...p,
      x: p.x + Math.sin(i + index) * 0.001,
      y: p.y + Math.cos(i - index) * 0.001,
    })),
  );
  expectCount(replay(contract, rig, noise), 0);
  expectCount(
    replay(
      contract,
      rig,
      Array.from({ length: 20 }, () => start),
    ),
    0,
  );
});

test("missing required joints and mismatched arms cannot complete a rep", () => {
  const { contract, rig } = definition("bench_press");
  const frames = cycle(
    points(fixture.benchRanges.start),
    points(fixture.benchRanges.full),
  );
  expectCount(
    replay(
      contract,
      rig,
      frames.map((frame) =>
        frame.map((p, i) => (i === 15 ? { ...p, visibility: 0.1 } : p)),
      ),
    ),
    0,
  );
  const start = frames[0]!;
  expectCount(
    replay(
      contract,
      rig,
      frames.map((frame) =>
        frame.map((p, i) =>
          [12, 14, 16, 18, 20, 22].includes(i) ? start[i]! : p,
        ),
      ),
    ),
    0,
  );
});

test("stale timestamps, subject loss, and changed references invalidate unfinished cycles", () => {
  const { contract, rig } = definition("bench_press");
  const frames = cycle(
    points(fixture.benchRanges.start),
    points(fixture.benchRanges.full),
  );
  expectCount(
    replay(contract, rig, frames, { timestamps: frames.map(() => 100) }),
    0,
  );
  const hidden = frames.map((frame, i) =>
    i === 8 ? frame.map((p) => ({ ...p, visibility: 0 })) : frame,
  );
  expectCount(replay(contract, rig, hidden), 0);
  const begun = replay(contract, rig, frames.slice(0, 8));
  const changed = structuredClone(rig);
  changed.keyframes[0]!.keypoints[11]!.x += 0.001;
  expectCount(
    replay(contract, changed, frames.slice(8), {
      initial: begun.state,
      timestamps: frames.slice(8).map((_, i) => 1300 + i * 150),
    }),
    0,
  );
  const completed = replay(contract, rig, frames);
  expectCount(
    replay(contract, rig, hidden, {
      initial: completed.state,
      timestamps: hidden.map((_, i) => 3000 + i * 150),
    }),
    1,
  );
  const spatialBegun = replay(contract, rig, frames.slice(0, 8), {
    spatial: frames.slice(0, 8),
  });
  expectCount(
    replay(contract, rig, frames.slice(8), {
      initial: spatialBegun.state,
      timestamps: frames.slice(8).map((_, i) => 1300 + i * 150),
    }),
    0,
  );
  const malformed = frames.map((frame) =>
    frame.map((p, i) => (i === 15 ? { ...p, z: NaN } : p)),
  );
  expectCount(replay(contract, rig, frames, { spatial: malformed }), 0);
});
