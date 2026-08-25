import type {
  AdminGamificationSeasonStandingRecord,
  AdminGamificationSeasonSummaryRecord,
} from "@fittrack/types";

export function getCanonicalSeasonStandingRank(
  standing: Pick<AdminGamificationSeasonStandingRecord, "rankPosition">,
) {
  return standing.rankPosition;
}

export function getSeasonFilterOptions(
  seasons: Pick<AdminGamificationSeasonSummaryRecord, "id" | "status" | "title">[],
  includeArchived = false,
) {
  return [
    { label: "Current Season", value: "" },
    ...seasons
      .filter(
        (season) =>
          season.status === "closed" ||
          (includeArchived && season.status === "archived"),
      )
      .map((season) => ({
        label: `${season.title} (${season.status === "closed" ? "Closed" : "Archived"})`,
        value: season.id,
      })),
  ];
}

export function resolveSeasonSelection(
  selectedSeasonId: string,
  seasons: Pick<AdminGamificationSeasonSummaryRecord, "id" | "status">[],
) {
  const explicitSeasonId = selectedSeasonId.trim();
  if (explicitSeasonId) return explicitSeasonId;
  return (
    seasons.find((season) => season.status === "active")?.id ??
    seasons.find((season) => season.status === "closed")?.id ??
    ""
  );
}
