import type {
  ExerciseMovementContractIdentityRecord,
  ExerciseMovementProfileRecord,
  FitnessExerciseRecord,
  PlannedPoseTrackingSnapshot,
} from "@fittrack/types";
import { resolveExerciseAlias, resolveExerciseTracking } from "@fittrack/utils";

export function matchesPlannedTrackingSnapshot(
  snapshot: PlannedPoseTrackingSnapshot | null | undefined,
  target: { exerciseId: string; sessionId: string; planExerciseId: string; setNumber: number } | null | undefined,
) {
  return !!snapshot && !!target && snapshot.exerciseId === target.exerciseId &&
    snapshot.workoutSessionId === target.sessionId && snapshot.planExerciseId === target.planExerciseId &&
    snapshot.setNumber === target.setNumber;
}

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
    input.exerciseId ? byId :
    resolveExerciseAlias(
      input.exercises.map((candidate) => ({
        ...candidate,
        aliases: candidate.aliases,
      })),
      input.label,
    );
  if (!exercise || resolveExerciseTracking(exercise).status !== "ready") {
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
  if (!input.exerciseId) return [...((await input.refetchCatalog()) ?? input.fallbackExercises)];
  const latest = await input.refetchExercise();
  if (!latest || latest.id !== input.exerciseId) throw new Error("Could not refresh this exercise. Retry before starting the set.");
  return mergeLatestWorkoutExercise(
    input.fallbackExercises,
    latest,
  );
}

export function movementContractIdentityKey(
  identity: ExerciseMovementContractIdentityRecord | null | undefined,
  effectiveProfile?: ExerciseMovementProfileRecord | null,
) {
  const baseKey =
    identity && identity.familyKey && identity.revision !== null
      ? `${identity.exerciseId}:${identity.familyKey}:${identity.revision}`
      : null;
  if (effectiveProfile === undefined) return baseKey;
  if (!baseKey && !effectiveProfile) return null;
  return `${baseKey ?? "profile"}:${stableSerialize(effectiveProfile)}`;
}

export function hasMovementContractIdentityChanged(
  currentIdentityKey: string | null,
  nextIdentity: ExerciseMovementContractIdentityRecord | null | undefined,
  effectiveProfile?: ExerciseMovementProfileRecord | null,
) {
  return (
    currentIdentityKey !==
    movementContractIdentityKey(nextIdentity, effectiveProfile)
  );
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}
