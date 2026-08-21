import { MasteryRank, Prisma, ProgressionIconKind } from '@prisma/client';

export const DEFAULT_MILESTONE_ICON_KEY = 'trophy';
export const DEFAULT_MUSCLE_ICON_KEY = 'dumbbell';

const PROGRESSION_LIBRARY_ICON_KEYS = new Set([
  'badge',
  'dumbbell',
  'flame',
  'medal',
  'star',
  'target',
  'trophy',
]);

export function isAllowedProgressionLibraryIconKey(value: string): boolean {
  return PROGRESSION_LIBRARY_ICON_KEYS.has(value);
}

export function resolveProgressionIcon(input: {
  assetKey?: string | null;
  defaultIconKey: string;
  iconKey?: string | null;
  kind?: ProgressionIconKind | null;
}): {
  iconAssetKey: string | null;
  iconKey: string | null;
  iconKind: ProgressionIconKind;
} {
  if (input.kind === ProgressionIconKind.custom) {
    return {
      iconAssetKey: input.assetKey ?? null,
      iconKey: null,
      iconKind: ProgressionIconKind.custom,
    };
  }

  return {
    iconAssetKey: null,
    iconKey: input.iconKey ?? input.defaultIconKey,
    iconKind: ProgressionIconKind.library,
  };
}

export const PROGRESSION_RULES_VERSION = 'exp-v1';

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

export interface ExpProgressionState {
  current_exp: number;
  is_uncapped: boolean;
  level: MasteryRank;
  next_level_exp: number | null;
  progress_percent: number;
  remaining_exp: number | null;
}

export interface WorkoutProgressionDelta {
  xp: number;
  volumeKg: Prisma.Decimal;
}

/**
 * Keep workout-derived EXP and volume calculation in one production-owned
 * helper so seed fixtures cannot drift from runtime progression.
 */
export function calculateWorkoutProgressionDelta(input: {
  repsCompleted?: number | null;
  repsAiCounted?: number | null;
  weightKg?: Prisma.Decimal | number | string | null;
}): WorkoutProgressionDelta {
  const repsCompleted = input.repsCompleted ?? input.repsAiCounted ?? 0;
  if (!Number.isFinite(repsCompleted) || repsCompleted <= 0) {
    return { xp: 0, volumeKg: new Prisma.Decimal(0) };
  }

  const parsedWeightKg = input.weightKg
    ? new Prisma.Decimal(input.weightKg)
    : null;
  const weightForXp = parsedWeightKg ?? new Prisma.Decimal(1);
  const volumeKg = (parsedWeightKg ?? new Prisma.Decimal(0)).times(
    repsCompleted,
  );
  const xp = weightForXp.times(repsCompleted).dividedBy(10).floor().toNumber();

  return { xp: Math.max(1, xp), volumeKg };
}

function normalizeExp(exp: number): number {
  if (!Number.isFinite(exp)) {
    return 0;
  }

  return Math.max(0, Math.floor(exp));
}

/** EXP is canonical; volume is retained only for backwards-compatible callers. */
export function evaluateExpRank(exp: number): MasteryRank {
  const normalizedExp = normalizeExp(exp);
  let level: MasteryRank = MasteryRank.bronze;

  for (const rank of MASTERY_RANK_ORDER) {
    if (normalizedExp >= XP_THRESHOLDS[rank].xp) {
      level = rank;
    }
  }

  return level;
}

export function getExpProgressionState(exp: number): ExpProgressionState {
  const currentExp = normalizeExp(exp);
  const level = evaluateExpRank(currentExp);
  const levelIndex = MASTERY_RANK_ORDER.indexOf(level);
  const nextLevel = MASTERY_RANK_ORDER[levelIndex + 1];

  if (!nextLevel) {
    return {
      current_exp: currentExp,
      is_uncapped: true,
      level,
      next_level_exp: null,
      progress_percent: 100,
      remaining_exp: null,
    };
  }

  const currentLevelExp = XP_THRESHOLDS[level].xp;
  const nextLevelExp = XP_THRESHOLDS[nextLevel].xp;
  const range = nextLevelExp - currentLevelExp;
  const progressPercent = Math.round(
    ((currentExp - currentLevelExp) / range) * 100,
  );

  return {
    current_exp: currentExp,
    is_uncapped: false,
    level,
    next_level_exp: nextLevelExp,
    progress_percent: Math.min(100, Math.max(0, progressPercent)),
    remaining_exp: Math.max(0, nextLevelExp - currentExp),
  };
}

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
  _totalVolumeKg: Prisma.Decimal | number,
): MasteryRank {
  return evaluateExpRank(xpPoints);
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

export function getCompetitionRankPositions<T>(
  orderedRows: readonly T[],
  getScore: (row: T) => number,
): number[] {
  let previousScore: number | undefined;
  let rankPosition = 0;

  return orderedRows.map((row, index) => {
    const score = getScore(row);
    if (previousScore !== score) {
      rankPosition = index + 1;
      previousScore = score;
    }
    return rankPosition;
  });
}
