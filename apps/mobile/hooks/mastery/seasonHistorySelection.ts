import type {
  FitnessMuscleLeaderboardEntryRecord,
  FitnessSeasonHistoryRecord,
  MuscleDefinitionRecord,
} from "@fittrack/types";

type SeasonHistoryMuscleDefinition = Pick<MuscleDefinitionRecord, "key"> &
  Partial<
    Pick<
      MuscleDefinitionRecord,
      "aliases" | "bodyRegion" | "isActive" | "name" | "sortOrder"
    >
  >;

export function resolveSeasonHistoryId(
  seasons: readonly FitnessSeasonHistoryRecord[],
  selection: string | null | undefined,
): string | null {
  const candidate = selection?.trim();
  if (!candidate) return null;

  return (
    seasons.find((season) => season.seasonId === candidate)?.seasonId ??
    seasons.find((season) => season.title === candidate)?.seasonId ??
    null
  );
}

export function resolveSeasonHistoryMuscleOptions(
  definitions?: readonly SeasonHistoryMuscleDefinition[] | null,
): string[] {
  return [
    ...new Set(
      (definitions ?? [])
        .filter((definition) => definition.isActive !== false)
        .map((definition) => definition.key.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function retainMuscleSelection(
  options: readonly string[],
  selection: string | null | undefined,
): string {
  const candidate = selection?.trim().toLowerCase();
  return candidate && options.includes(candidate) ? candidate : (options[0] ?? '');
}

export function resolveSeasonHistoryMuscleRows(
  rows: FitnessMuscleLeaderboardEntryRecord[] | undefined,
  isFetching: boolean,
): FitnessMuscleLeaderboardEntryRecord[] {
  return isFetching ? [] : (rows ?? []);
}
