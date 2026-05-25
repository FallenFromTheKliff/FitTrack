"use client";

import type {
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  ExerciseReviewEvidenceRecord,
  FitnessExerciseCategory,
} from "@fittrack/api-client";
import {
  buildFallbackPoseMovementContract,
  createDefaultExerciseMuscleTargets,
  createExerciseMovementProfile,
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
  candidate?: {
    category?: FitnessExerciseCategory;
    description?: string | null;
    evidenceBars?: ExerciseReviewEvidenceRecord | null;
    handShapeProfile?: ExerciseHandShapeProfileRecord | null;
    instructions?: string | null;
    movementProfile?: ExerciseMovementProfileRecord | null;
    muscleGroup?: string;
    muscleTargets?: ExerciseMuscleTargetRecord[];
    origin?: string;
    originLabel?: string;
    proposedName?: string;
    trigger?: string;
    triggerLabel?: string;
  },
) {
  const evidence =
    candidate?.evidenceBars &&
    !Array.isArray(candidate.evidenceBars) &&
    candidate.evidenceBars.schemaVersion === "exercise_ai_draft_v1"
      ? candidate.evidenceBars
      : null;
  const muscleGroup = candidate?.muscleGroup ?? "";
  const proposedName = candidate?.proposedName ?? "";
  const movementContract =
    candidate?.movementProfile?.movementContract ??
    evidence?.movementContract ??
    buildFallbackPoseMovementContract(proposedName);
  const rig =
    candidate?.movementProfile?.rig ??
    evidence?.rig ??
    (movementContract
      ? createGeneratedExerciseRigFromMovementContract({
          exerciseLabel: proposedName,
          movementContract,
        })
      : null);
  const muscleTargets = normalizeExerciseMuscleTargets(
    candidate?.muscleTargets ?? createDefaultExerciseMuscleTargets(muscleGroup),
    muscleGroup,
  );
  return {
    name: proposedName,
    category: candidate?.category ?? "strength",
    muscleGroup,
    muscleTargets,
    movementProfile: normalizeExerciseMovementProfile(
      candidate?.movementProfile,
      {
        movementContract,
        rig,
      },
    ) ?? createExerciseMovementProfile({}),
    handShapeProfile: normalizeExerciseHandShapeProfile(
      candidate?.handShapeProfile ?? DEFAULT_EXERCISE_HAND_SHAPE_PROFILE,
    ),
    description: candidate?.description ?? "",
    instructions: candidate?.instructions ?? "",
    imageUrl: "",
    videoUrl: "",
    publishNote: candidate
      ? `Source: ${candidate.originLabel ?? candidate.origin ?? "client custom"}. Trigger: ${candidate.triggerLabel ?? candidate.trigger ?? "unknown after 3 reps"}. Preserve provenance when publishing.`
      : "",
  };
}
