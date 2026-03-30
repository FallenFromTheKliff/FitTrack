import { MasteryRank, Prisma } from '@prisma/client';

export const XP_THRESHOLDS: Record<
  MasteryRank,
  { xp: number; volume_kg: number }
> = {
  [MasteryRank.bronze]: { xp: 0, volume_kg: 0 },
  [MasteryRank.silver]: { xp: 500, volume_kg: 5_000 },
  [MasteryRank.gold]: { xp: 2_000, volume_kg: 20_000 },
  [MasteryRank.platinum]: { xp: 5_000, volume_kg: 50_000 },
  [MasteryRank.adamantite]: { xp: 10_000, volume_kg: 100_000 },
};

export const MASTERY_RANK_ORDER: readonly MasteryRank[] = [
  MasteryRank.bronze,
  MasteryRank.silver,
  MasteryRank.gold,
  MasteryRank.platinum,
  MasteryRank.adamantite,
];

const RANK_LABELS: Record<MasteryRank, string> = {
  [MasteryRank.bronze]: 'Bronze',
  [MasteryRank.silver]: 'Silver',
  [MasteryRank.gold]: 'Gold',
  [MasteryRank.platinum]: 'Platinum',
  [MasteryRank.adamantite]: 'Adamantite',
};

export function getMasteryRankLabel(rank: MasteryRank): string {
  return RANK_LABELS[rank];
}

export function formatMasteryRankDisplay(
  rank: MasteryRank,
  xpPoints: number,
): string {
  if (
    rank === MasteryRank.adamantite &&
    xpPoints > XP_THRESHOLDS[MasteryRank.adamantite].xp
  ) {
    return `Adamantite+ (${xpPoints - XP_THRESHOLDS[MasteryRank.adamantite].xp} EXP)`;
  }

  return getMasteryRankLabel(rank);
}

export function evaluateMasteryRank(
  xpPoints: number,
  totalVolumeKg: Prisma.Decimal | number,
): MasteryRank {
  const volumeKg =
    totalVolumeKg instanceof Prisma.Decimal
      ? totalVolumeKg.toNumber()
      : totalVolumeKg;

  let evaluatedRank: MasteryRank = MasteryRank.bronze;

  for (const rank of MASTERY_RANK_ORDER) {
    const threshold = XP_THRESHOLDS[rank];

    if (xpPoints >= threshold.xp || volumeKg >= threshold.volume_kg) {
      evaluatedRank = rank;
    }
  }

  return evaluatedRank;
}

export function isHigherMasteryRank(
  nextRank: MasteryRank,
  currentRank: MasteryRank,
): boolean {
  return (
    MASTERY_RANK_ORDER.indexOf(nextRank) >
    MASTERY_RANK_ORDER.indexOf(currentRank)
  );
}
