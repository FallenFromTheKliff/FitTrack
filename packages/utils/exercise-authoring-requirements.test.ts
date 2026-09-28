import assert from "node:assert/strict";
import test from "node:test";
import {
  getSpatialRequirementsForPreset,
  normalizeExerciseMovementProfile,
  refreshExerciseTrackingRequirements,
  setExerciseBodyOrientation,
} from "./exercise-editor.ts";
import { buildFallbackPoseMovementContract, getPoseMovementRequiredLandmarks, getPoseTorsoSlopeRange } from "./pose.ts";

test("clearing editor posture and safeguards removes obsolete joints but preserves rig anchors and angles", () => {
  const original = normalizeExerciseMovementProfile({movementContract: buildFallbackPoseMovementContract("bench_press")})!;
  const before = structuredClone(original);
  const noPosture = setExerciseBodyOrientation(original.movementContract!, "any");
  const edited = normalizeExerciseMovementProfile({ ...original, movementContract: refreshExerciseTrackingRequirements({
    ...noPosture, spatialRequirements: getSpatialRequirementsForPreset("none", noPosture),
  }) })!;
  const required = getPoseMovementRequiredLandmarks(edited.movementContract!);
  assert.ok(!required.includes("hips") && !required.includes("ankles"), JSON.stringify(required));
  assert.ok(required.includes("shoulders") && required.includes("elbows") && required.includes("wrists"));
  assert.deepEqual(edited.rig, original.rig);
  assert.deepEqual(edited.movementContract!.repThresholds, original.movementContract!.repThresholds);
  assert.deepEqual(original, before);
  const lying = setExerciseBodyOrientation(edited.movementContract!, "horizontal");
  assert.ok(getPoseMovementRequiredLandmarks(lying).includes("hips"));
  assert.equal(getPoseTorsoSlopeRange(lying).max, 35);
  assert.equal(getPoseTorsoSlopeRange(lying).source, "orientation");
});

test("posture selection replaces an old explicit slope range without clearing enabled travel rules", () => {
  const contract = buildFallbackPoseMovementContract("bicep_curl")!;
  const edited = setExerciseBodyOrientation({...contract, spatialRequirements:{torsoSlopeMinDeg:0,torsoSlopeMaxDeg:20,hipYTravelMin:.02}}, "upright");
  assert.equal(edited.spatialRequirements!.torsoSlopeMinDeg, undefined);
  assert.equal(edited.spatialRequirements!.torsoSlopeMaxDeg, undefined);
  assert.equal(edited.spatialRequirements!.hipYTravelMin, .02);
  assert.ok(getPoseTorsoSlopeRange(edited).min > 20);
  const any = setExerciseBodyOrientation(edited, "any");
  assert.ok(getPoseMovementRequiredLandmarks(any).includes("hips"), "Enabled hip travel still requires hips");
});

test("authoring derivation retains lower-body requirements for squat and static hold", () => {
  for (const family of ["squat", "plank"] as const) {
    const original = buildFallbackPoseMovementContract(family)!;
    const updated = refreshExerciseTrackingRequirements(original);
    assert.ok(getPoseMovementRequiredLandmarks(updated).includes("hips"));
    assert.deepEqual(updated.repThresholds, original.repThresholds);
    assert.equal(updated.repModel, original.repModel);
    assert.equal(updated.requiredSides, original.requiredSides);
  }
});
