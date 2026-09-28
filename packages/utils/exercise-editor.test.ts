import assert from "node:assert/strict";
import test from "node:test";

import type { PoseMovementContractRecord } from "@fittrack/types";
import {
  DEFAULT_MUSCLE_DEFINITIONS,
  createDefaultExerciseMuscleTargets,
  createExerciseMovementProfile,
  createGeneratedExerciseRigFromMovementContract,
  validateExerciseEditorContract,
} from "./exercise-editor.ts";
import { buildFallbackPoseMovementContract } from "./pose.ts";

function editorInput(contract: PoseMovementContractRecord) {
  return {
    movementProfile: createExerciseMovementProfile({
      movementContract: contract,
      rig: createGeneratedExerciseRigFromMovementContract({
        exerciseLabel: "Squat",
        movementContract: contract,
      }),
    }),
    muscleDefinitions: DEFAULT_MUSCLE_DEFINITIONS,
    muscleGroup: "quadriceps",
    muscleTargets: createDefaultExerciseMuscleTargets("quadriceps", "Squat"),
  };
}

test("editor validation accepts the shared fallback contract", () => {
  const contract = buildFallbackPoseMovementContract("squat");
  assert.ok(contract);
  const result = validateExerciseEditorContract(editorInput(contract));
  assert.equal(result.errors.length, 0, result.errors.join("\n"));
});

test("editor validation surfaces shared threshold-band failures", () => {
  const base = buildFallbackPoseMovementContract("squat");
  assert.ok(base);
  const invalid: PoseMovementContractRecord = {
    ...base,
    repThresholds: {
      down: { angle: 130, tolerance: 12 },
      up: { angle: 140, tolerance: 12 },
    },
  };
  const result = validateExerciseEditorContract(editorInput(invalid));
  assert.ok(
    result.errors.some(
      (error) =>
        error.includes("starting and goal ranges") ||
        error.includes("15 degrees") ||
        error.includes("phase_acceptance_bands"),
    ),
    result.errors.join("\n"),
  );
});
