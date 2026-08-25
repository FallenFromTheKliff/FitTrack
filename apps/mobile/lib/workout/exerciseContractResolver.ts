import type {
  ExerciseMovementContractIdentityRecord,
  FitnessExerciseRecord,
} from "@fittrack/types";
import { resolveExerciseAlias } from "@fittrack/utils";

export type ResolvedWorkoutExerciseContract = {
  exercise: FitnessExerciseRecord;
  identity: ExerciseMovementContractIdentityRecord;
};

export function resolveWorkoutExerciseContract(input: {
  exerciseId?: string | null;
  exercises: readonly FitnessExerciseRecord[];
  label?: string | null;
}): ResolvedWorkoutExerciseContract | null {
  const byId = input.exerciseId
    ? input.exercises.find((exercise) => exercise.id === input.exerciseId) ?? null
    : null;
  const exercise =
    byId ??
    resolveExerciseAlias(
      input.exercises.map((candidate) => ({
        ...candidate,
        aliases: candidate.aliases,
      })),
      input.label,
    );
  if (!exercise || exercise.trackingMode === "manual" || !exercise.movementProfile) {
    return null;
  }
  return { exercise, identity: exercise.movementContractIdentity };
}

export function movementContractIdentityKey(
  identity: ExerciseMovementContractIdentityRecord | null | undefined,
) {
  if (!identity || !identity.familyKey || identity.revision === null) return null;
  return `${identity.exerciseId}:${identity.familyKey}:${identity.revision}`;
}
