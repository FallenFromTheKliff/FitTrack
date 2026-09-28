"use client";

import type {
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  ExerciseAliasInput,
  ExerciseMovementFamilySummaryRecord,
  ExerciseTrackingMode,
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
    aliases?: ExerciseAliasInput[];
    description?: string | null;
    handShapeProfile?: ExerciseHandShapeProfileRecord | null;
    instructions?: string | null;
    movementProfile?: ExerciseMovementProfileRecord | null;
    movementProfileOverride?: Partial<ExerciseMovementProfileRecord> | null;
    movementFamily?: ExerciseMovementFamilySummaryRecord | null;
    trackingMode?: ExerciseTrackingMode;
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
    aliases: values?.aliases ?? [],
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
    movementProfileOverride: values?.movementProfileOverride ?? null,
    movementFamily: values?.movementFamily ?? null,
    trackingMode: values?.trackingMode ?? "manual",
    handShapeProfile: normalizeExerciseHandShapeProfile(
      values?.handShapeProfile ?? DEFAULT_EXERCISE_HAND_SHAPE_PROFILE,
    ),
    description: values?.description ?? "",
    instructions: values?.instructions ?? "",
    imageUrl: "",
    videoUrl: "",
  };
}
