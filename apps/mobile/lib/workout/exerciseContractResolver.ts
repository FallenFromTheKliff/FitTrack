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

export function mergeLatestWorkoutExercise(
  exercises: readonly FitnessExerciseRecord[],
  latestExercise: FitnessExerciseRecord | null | undefined,
) {
  if (!latestExercise) return [...exercises];
  return [
    latestExercise,
    ...exercises.filter((exercise) => exercise.id !== latestExercise.id),
  ];
}

export async function refreshLatestWorkoutExercises(input: {
  exerciseId?: string | null;
  fallbackExercises: readonly FitnessExerciseRecord[];
  refetchCatalog: () => Promise<readonly FitnessExerciseRecord[] | undefined>;
  refetchExercise: () => Promise<FitnessExerciseRecord | null | undefined>;
}) {
  const refreshedCatalog =
    (await input.refetchCatalog()) ?? input.fallbackExercises;
  if (!input.exerciseId) return [...refreshedCatalog];
  return mergeLatestWorkoutExercise(
    refreshedCatalog,
    await input.refetchExercise(),
  );
}

export function movementContractIdentityKey(
  identity: ExerciseMovementContractIdentityRecord | null | undefined,
) {
  if (!identity || !identity.familyKey || identity.revision === null) return null;
  return `${identity.exerciseId}:${identity.familyKey}:${identity.revision}`;
}

export function hasMovementContractIdentityChanged(
  currentIdentityKey: string | null,
  nextIdentity: ExerciseMovementContractIdentityRecord | null | undefined,
) {
  return currentIdentityKey !== movementContractIdentityKey(nextIdentity);
}
