import type {
  EffectiveMovementContractSource,
  ExerciseAliasRecord,
  ExerciseMovementContractIdentityRecord,
  ExerciseMovementFamilyKey,
  ExerciseMovementProfileRecord,
  ExerciseTrackingMode,
} from "@fittrack/types";

export const REVIEWED_AUTO_REP_FAMILIES = [
  "squat",
  "bench_press",
  "bicep_curl",
  "dip",
  "plank",
  "pull_up",
  "push_up",
  "seated_cable_row",
  "shoulder_press",
] as const satisfies readonly ExerciseMovementFamilyKey[];

export function normalizeExerciseAlias(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ExerciseAliasResolutionCandidate = {
  aliases: Array<Pick<ExerciseAliasRecord, "normalizedLabel"> | string>;
  id: string;
  name: string;
};

/** Exact, normalized lookup. Ambiguous data fails closed instead of depending on list order. */
export function resolveExerciseAlias<T extends ExerciseAliasResolutionCandidate>(
  candidates: readonly T[],
  label: string | null | undefined,
): T | null {
  const normalized = normalizeExerciseAlias(label);
  if (!normalized) return null;
  const matches = candidates.filter((candidate) => {
    if (normalizeExerciseAlias(candidate.name) === normalized) return true;
    return candidate.aliases.some((alias) =>
      typeof alias === "string"
        ? normalizeExerciseAlias(alias) === normalized
        : alias.normalizedLabel === normalized,
    );
  });
  if (matches.length > 1) {
    throw new Error(`Ambiguous exercise alias: ${normalized}`);
  }
  return matches[0] ?? null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepMergeMovementProfile<T>(base: T, override: Partial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(override)) return override as T;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    result[key] =
      isPlainObject(value) && isPlainObject(result[key])
        ? deepMergeMovementProfile(result[key], value)
        : value;
  }
  return result as T;
}

export function resolveEffectiveMovementProfile(input: {
  exerciseId: string;
  familyBaseProfile: ExerciseMovementProfileRecord | null;
  familyKey: ExerciseMovementFamilyKey | null;
  familyRevision: number | null;
  legacyProfile?: ExerciseMovementProfileRecord | null;
  override: Partial<ExerciseMovementProfileRecord> | null;
  trackingMode: ExerciseTrackingMode;
}): {
  identity: ExerciseMovementContractIdentityRecord;
  profile: ExerciseMovementProfileRecord | null;
} {
  let profile: ExerciseMovementProfileRecord | null = null;
  let source: EffectiveMovementContractSource = "manual";
  if (input.trackingMode === "inherit" && input.familyBaseProfile) {
    profile = input.familyBaseProfile;
    source = "family";
  } else if (input.trackingMode === "override" && input.familyBaseProfile) {
    profile = input.override
      ? deepMergeMovementProfile(input.familyBaseProfile, input.override)
      : input.familyBaseProfile;
    source = "exercise_override";
  } else if (
    input.trackingMode !== "manual" &&
    !input.familyBaseProfile &&
    input.legacyProfile
  ) {
    profile = input.legacyProfile;
    source = "legacy_migration";
  }
  return {
    identity: {
      exerciseId: input.exerciseId,
      familyKey: input.familyKey,
      revision: input.familyRevision,
      source,
      trackingMode: input.trackingMode,
    },
    profile,
  };
}
