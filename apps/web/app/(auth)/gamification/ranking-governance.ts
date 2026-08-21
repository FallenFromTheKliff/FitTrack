import type { AdminGamificationSeasonStandingRecord } from "@fittrack/types";

export function getCanonicalSeasonStandingRank(
  standing: Pick<AdminGamificationSeasonStandingRecord, "rankPosition">,
) {
  return standing.rankPosition;
}
