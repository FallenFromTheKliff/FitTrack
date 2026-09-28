import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseMovementProfileRecord, PoseKeypointRecord, PoseMovementContractRecord } from "@fittrack/types";
import {
  applyGeneratedRigDominantAngle, createGeneratedExerciseRigFromMovementContract,
  getSpatialRequirementsForPreset, normalizeExerciseMovementProfile,
  setExerciseMovementJoint, setExerciseBodyCheckScope, refreshExerciseTrackingRequirements, validateExerciseTrackingConfiguration,
} from "./exercise-editor.ts";
import { resolveExerciseTracking } from "./exercise-movement-contract.ts";
import { buildFallbackPoseMovementContract, computePoseSignals, getPoseMovementContractSideAngles, getPoseRequiredLandmarkCount, validatePoseMovementContract } from "./pose.ts";
import { getPoseRepContractFingerprint } from "./pose-rep-policy.ts";
import { getPoseFrameContractAngle } from "./pose-rig.ts";
import { createPoseRepEngineState, stepPoseRepEngine } from "./pose-rep-engine.ts";

// Independent camera input: stationary seated torso, arms moving from overhead
// toward the sides. No production rig-generation helper supplies these points.
function cameraPose(armAngle: number, elbowAngle = 90 + (armAngle - 90) * 75 / 65) {
  const points: PoseKeypointRecord[] = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: .05 }));
  for (const offset of [0, 1]) {
    const sign = offset === 0 ? -1 : 1;
    const shoulder = { x: .5 + sign * .14, y: .42, z: 0, visibility: .98 };
    const hip = { ...shoulder, y: .71, visibility: .05 };
    const radians = armAngle * Math.PI / 180;
    const elbow = { ...shoulder, x: shoulder.x + sign * .16 * Math.sin(radians), y: shoulder.y + .16 * Math.cos(radians) };
    const forearm = Math.atan2(shoulder.y - elbow.y, shoulder.x - elbow.x) + sign * elbowAngle * Math.PI / 180;
    const wrist = { ...elbow, x: elbow.x + .18 * Math.cos(forearm), y: elbow.y + .18 * Math.sin(forearm), visibility: .05 };
    points[11 + offset] = shoulder;
    points[13 + offset] = elbow;
    points[15 + offset] = wrist;
    points[23 + offset] = hip;
  }
  return points;
}

function profile(countAt: "peak" | "return" = "return") {
  const movementContract = { ...buildFallbackPoseMovementContract("Lat Pulldown", { forAuthoring: true })!, countAt };
  return normalizeExerciseMovementProfile({
    movementContract, rig: createGeneratedExerciseRigFromMovementContract({ movementContract }),
  })!;
}

function sequence(goal = 90) {
  return [155, 155, 145, 135, 125, 115, goal, goal, 115, 130, 145, 155, 155].map(angle => cameraPose(angle));
}

function replay(value: ExerciseMovementProfileRecord, samples: PoseKeypointRecord[][], world = false) {
  let state = createPoseRepEngineState();
  const history: { capturedAtMs: number; keypoints: PoseKeypointRecord[] }[] = [];
  const trace: { reason: string | null; reps: number }[] = [];
  const contract = value.movementContract!;
  for (const [index, keypoints] of samples.entries()) {
    const frame = {
      keypoints, capturedAtMs: 100 + index * 150,
      // Rotate the depth coordinates: the shared web/native adapter must use
      // world geometry when present, while retaining image visibility checks.
      spatialKeypoints: world ? keypoints.map(p => ({ ...p,
        x: (p.x - .5) * Math.cos(.5), z: (p.x - .5) * Math.sin(.5),
      })) : undefined,
    };
    history.push(frame);
    const result = stepPoseRepEngine(state, contract, getPoseFrameContractAngle(contract, frame, { width: 1, height: 1 }), frame.capturedAtMs, {
      ...frame, rig: value.rig, exerciseDeclared: true,
      coordinateDimensions: { width: 1, height: 1 },
      keypointFrames: history.map(f => f.keypoints), signals: computePoseSignals(history, { width: 1, height: 1 }),
    });
    state = result.nextState;
    trace.push({ reason: result.noCountReason, reps: state.repCount });
  }
  return { state, trace };
}

test("pulldown draws hands above elbows and measures lowering the upper arms", () => {
  assert.equal(buildFallbackPoseMovementContract("Lat Pulldown"), null, "Template availability must not turn on default/manual tracking");
  const value = profile();
  assert.equal(value.movementContract!.dominantJoint, "shoulder");
  assert.equal(value.movementContract!.shoulderReference, "shoulder_line");
  assert.equal(getPoseRequiredLandmarkCount(value.movementContract!), 4);
  assert.equal(validateExerciseTrackingConfiguration({ movementProfile: value }).valid, true);
  const [start, goal] = value.rig!.keyframes;
  for (const offset of [0, 1]) {
    assert.ok(start!.keypoints[13 + offset]!.y < start!.keypoints[11 + offset]!.y);
    assert.ok(goal!.keypoints[13 + offset]!.y > start!.keypoints[13 + offset]!.y);
    assert.ok(goal!.keypoints[15 + offset]!.y < goal!.keypoints[13 + offset]!.y);
  }
  for (const frame of value.rig!.keyframes) {
    const measured = getPoseMovementContractSideAngles(value.movementContract!, frame.keypoints);
    const expected = frame.kind === "peak" ? 90 : 155;
    assert.ok(Math.abs(measured.left! - expected) < .001);
    assert.ok(Math.abs(measured.right! - expected) < .001);
  }
});

for (const world of [false, true]) {
  for (const countAt of ["peak", "return"] as const) {
    test(`pulldown ${world ? "3D" : "2D"} counts with hips and wrists hidden at ${countAt}, accepts deeper pulls and requires a return`, () => {
      const value = profile(countAt);
      const full = replay(value, sequence(), world);
      assert.equal(full.state.repCount, 1, JSON.stringify(full.trace));
      assert.equal(full.trace[7]!.reps, countAt === "peak" ? 1 : 0);
      const deeper = replay(value, sequence(60), world);
      assert.equal(deeper.state.repCount, 1, JSON.stringify(deeper.trace));
      assert.equal(replay(value, [...sequence().slice(0, 8), ...Array.from({ length: 15 }, () => cameraPose(90))], world).state.repCount,
        countAt === "peak" ? 1 : 0);
      assert.equal(replay(value, [...sequence(), ...sequence()], world).state.repCount, 2);
      assert.equal(replay(value, sequence(120), world).state.repCount, 0, "Short pulls must not meet the 90-degree goal");
      const strict = structuredClone(value);
      strict.movementContract!.repThresholds.down.angle = 60;
      strict.rig!.keyframes[1]!.angle = 60;
      strict.rig!.keyframes[1]!.keypoints = applyGeneratedRigDominantAngle(strict.rig!.keyframes[1]!.keypoints, "shoulder", 60, "shoulder_line");
      assert.equal(replay(strict, sequence(90), world).state.repCount, 0, "Editing a deeper goal must reject the old shorter pull");
    });
  }
}

test("pulldown rejects elbow-only curls, missing required shoulders, one-arm motion and frozen input", () => {
  const value = profile("peak");
  const curls = [165, 165, 145, 125, 100, 80, 70, 70, 100, 130, 165, 165].map(elbow => cameraPose(155, elbow));
  assert.equal(replay(value, curls).state.repCount, 0);
  const missing = sequence().map(points => points.map((p, i) => ({ ...p, visibility: i === 11 ? .1 : p.visibility })));
  const blocked = replay(value, missing);
  assert.equal(blocked.state.repCount, 0);
  assert.ok(blocked.trace.some(frame => frame.reason === "unavailable_primary_angle"), JSON.stringify(blocked.trace));
  const oneArm = sequence().map(points => points.map((p, i) => i % 2 === 0 ? cameraPose(155)[i]! : p));
  assert.equal(replay(value, oneArm).state.repCount, 0);
  assert.equal(replay(value, Array.from({ length: 30 }, () => cameraPose(90))).state.repCount, 0);
});

test("a stationary pulldown passes its own form checks and fails the pull-up body-rise check", () => {
  const value = profile("peak");
  const wrong = structuredClone(value);
  wrong.movementContract!.spatialRequirements = getSpatialRequirementsForPreset("vertical_pull", wrong.movementContract);
  const visibleTorso = sequence().map(points => points.map((p, i) => ({ ...p, visibility: i === 23 || i === 24 ? .98 : p.visibility })));
  const blocked = replay(wrong, visibleTorso);
  assert.equal(blocked.state.repCount, 0);
  assert.ok(blocked.trace.some(frame => frame.reason === "shoulder_y_travel_below_min"), JSON.stringify(blocked.trace));
  const corrected = structuredClone(wrong);
  corrected.movementContract!.spatialRequirements = getSpatialRequirementsForPreset("lat_pulldown", corrected.movementContract);
  assert.equal(replay(corrected, sequence()).state.repCount, 1);
});

test("shoulder angle edits preserve the connected elbow bend and limb lengths", () => {
  const original = cameraPose(155, 130);
  const elbowContract = { ...profile().movementContract!, dominantJoint: "elbow" as const,
    shoulderReference: undefined,
    primaryJoints: ["left_elbow", "right_elbow"] };
  // The wrist is irrelevant to pulldown counting but needed to measure this edit.
  original[15]!.visibility = original[16]!.visibility = 1;
  const before = getPoseMovementContractSideAngles(elbowContract, original);
  const afterPoints = applyGeneratedRigDominantAngle(original, "shoulder", 65, "shoulder_line");
  const after = getPoseMovementContractSideAngles(elbowContract, afterPoints);
  for (const side of ["left", "right"] as const) assert.ok(Math.abs(before[side]! - after[side]!) < .001);
  for (const offset of [0, 1]) {
    const length = (points: PoseKeypointRecord[]) => Math.hypot(points[15 + offset]!.x - points[13 + offset]!.x, points[15 + offset]!.y - points[13 + offset]!.y);
    assert.ok(Math.abs(length(original) - length(afterPoints)) < .001);
  }
});

test("custom joint selection preserves the drawing, round-trips its rules, and enables only explicit overrides", () => {
  const value = profile();
  const asElbow = setExerciseMovementJoint(value, "elbow");
  const edited = setExerciseMovementJoint(asElbow, "shoulder", "shoulder_line");
  assert.deepEqual(edited.rig!.keyframes.map(frame => frame.keypoints), value.rig!.keyframes.map(frame => frame.keypoints));
  const saved = normalizeExerciseMovementProfile(JSON.parse(JSON.stringify(edited)))!;
  assert.equal(saved.movementContract!.repThresholds.up.angle, 155);
  assert.equal(saved.movementContract!.repThresholds.down.angle, 90);
  assert.equal(saved.movementContract!.shoulderReference, "shoulder_line");
  assert.equal(replay(saved, sequence()).state.repCount, 1);
  const exercise = { isActive: true, trackingMode: "manual" as const, movementProfile: saved, movementContractIdentity: null };
  assert.equal(resolveExerciseTracking(exercise).status, "manual");
  assert.equal(resolveExerciseTracking({ ...exercise, trackingMode: "override" }).status, "ready");
  // Deliberately choosing a different measure must not silently keep shoulder rules.
  assert.equal(asElbow.movementContract!.dominantJoint, "elbow");
  assert.equal(asElbow.movementContract!.shoulderReference, undefined);
  assert.deepEqual(asElbow.movementContract!.primaryJoints, ["left_elbow", "right_elbow"]);
});

test("a complete custom definition counts without a catalog-name match; incomplete settings and wrong family identities fail", () => {
  const custom = profile("peak");
  custom.movementContract!.exercise = "my_custom_upper_arm_pull";
  assert.equal(validatePoseMovementContract(custom.movementContract).valid, true);
  assert.equal(replay(custom, sequence()).state.repCount, 1);
  assert.equal(validatePoseMovementContract({ exercise: "my_custom_upper_arm_pull" }).valid, false);
  assert.ok(validatePoseMovementContract(custom.movementContract, "push_up").errors.includes("exercise_identity_mismatch"));
  assert.equal(validatePoseMovementContract({ ...custom.movementContract, dominantJoint: "unknown" }).valid, false);
});

test("hips are optional for the upper-arm reference and required only when body checks are added", () => {
  const value = profile("peak");
  for (const scope of ["torso", "full_body"] as const) {
    const checked = { ...value, movementContract: setExerciseBodyCheckScope(value.movementContract!, scope) };
    assert.equal(getPoseRequiredLandmarkCount(checked.movementContract), scope === "torso" ? 6 : 8);
    assert.equal(replay(checked, sequence()).state.repCount, 0);
    checked.movementContract = setExerciseBodyCheckScope(checked.movementContract, "movement_joints");
    assert.equal(getPoseRequiredLandmarkCount(checked.movementContract), 4);
    assert.equal(replay(checked, sequence()).state.repCount, 1);
  }
  const legacy = setExerciseMovementJoint(value, "shoulder", "torso");
  assert.equal(getPoseRequiredLandmarkCount(legacy.movementContract!), 6);
  assert.equal(replay(legacy, sequence()).state.repCount, 0);
  const corrected = setExerciseMovementJoint(legacy, "shoulder", "shoulder_line");
  assert.equal(getPoseRequiredLandmarkCount(corrected.movementContract!), 4);
  assert.equal(replay(corrected, sequence()).state.repCount, 1);
  assert.notEqual(getPoseRepContractFingerprint(legacy.movementContract!), getPoseRepContractFingerprint(corrected.movementContract!));
});

test("upper-arm angles keep the same meaning across the horizontal, camera roll, mirroring and aspect ratios", () => {
  const contract = profile().movementContract!;
  for (const angle of [0, 30, 88, 90, 120, 155, 180]) {
    for (const mirror of [1, -1]) {
      const roll = .35, cos = Math.cos(roll), sin = Math.sin(roll);
      const points = cameraPose(angle).map(p => ({ ...p,
        x: .5 + ((p.x - .5) * cos - (p.y - .5) * sin) * mirror / 2,
        y: .5 + (p.x - .5) * sin + (p.y - .5) * cos,
      }));
      const angles = getPoseMovementContractSideAngles(contract, points, { width: 2, height: 1 });
      assert.ok(Math.abs(angles.left! - angle) < .002, `${angle}: ${JSON.stringify(angles)}`);
      assert.ok(Math.abs(angles.right! - angle) < .002);
    }
  }
  const missing = cameraPose(90);
  missing[12] = { ...missing[11]! };
  assert.deepEqual(getPoseMovementContractSideAngles(contract, missing), { left: null, right: null });
  const unilateral = refreshExerciseTrackingRequirements({ ...contract, requiredSides: "left", repModel: "unilateral_left" });
  assert.equal(getPoseRequiredLandmarkCount(unilateral), 3, "Both shoulders and the working elbow are required");
  const onlyLeft = cameraPose(90);
  onlyLeft[14]!.visibility = .01;
  assert.equal(getPoseMovementContractSideAngles(unilateral, onlyLeft).left, 90);
  onlyLeft[12]!.visibility = .01;
  assert.equal(getPoseMovementContractSideAngles(unilateral, onlyLeft).left, null, "The opposite shoulder is a real dependency");
});
