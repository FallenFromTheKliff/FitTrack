"use client";

import type {
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  FitnessExerciseCategory,
} from "@fittrack/api-client";
import {
  buildFallbackPoseMovementContract,
  createDefaultExerciseMuscleTargets,
  createGeneratedExerciseRigFromMovementContract,
  DEFAULT_EXERCISE_HAND_SHAPE_PROFILE,
  normalizeExerciseHandShapeProfile,
  normalizeExerciseMovementProfile,
  normalizeExerciseMuscleTargets,
} from "@fittrack/utils";

export const EXERCISE_CATEGORY_OPTIONS = [
  { label: "Strength", value: "strength" },
  { label: "Cardio", value: "cardio" },
  { label: "Flexibility", value: "flexibility" },
  { label: "Balance", value: "balance" },
] as const;

export function createExerciseDraft(
  values?: {
    category?: FitnessExerciseCategory;
    description?: string | null;
    handShapeProfile?: ExerciseHandShapeProfileRecord | null;
    instructions?: string | null;
    movementProfile?: ExerciseMovementProfileRecord | null;
    muscleGroup?: string;
    muscleTargets?: ExerciseMuscleTargetRecord[];
    name?: string;
  },
) {
  const muscleGroup = values?.muscleGroup ?? "";
  const name = values?.name ?? "";
  const movementContract =
    values?.movementProfile?.movementContract ?? buildFallbackPoseMovementContract(name);
  const rig =
    values?.movementProfile?.rig ??
    (movementContract
      ? createGeneratedExerciseRigFromMovementContract({
          exerciseLabel: name,
          movementContract,
        })
      : null);
  const muscleTargets = normalizeExerciseMuscleTargets(
    values?.muscleTargets ?? createDefaultExerciseMuscleTargets(muscleGroup),
    muscleGroup,
  );
  return {
    name,
    category: values?.category ?? "strength",
    muscleGroup,
    muscleTargets,
    movementProfile: normalizeExerciseMovementProfile(
      values?.movementProfile,
      {
        movementContract,
        rig,
      },
    ) ?? null,
    handShapeProfile: normalizeExerciseHandShapeProfile(
      values?.handShapeProfile ?? DEFAULT_EXERCISE_HAND_SHAPE_PROFILE,
    ),
    description: values?.description ?? "",
    instructions: values?.instructions ?? "",
    imageUrl: "",
    videoUrl: "",
  };
}
