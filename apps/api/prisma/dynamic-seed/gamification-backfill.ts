import {
  MasteryRank,
  MilestoneDefinitionStatus,
  MilestoneProgressStatus,
  Prisma,
  ProgressionGrantStatus,
  ProgressionGrantType,
  RankingGovernanceStatus,
  RankingVisibility,
  SeasonStatus,
  type PrismaClient,
} from '@prisma/client';
import { evaluateExpRank } from '../../src/fitness/gamification/gamification.constants';

export type GamificationBackfillGrant = {
  amount: number;
  created_at: Date;
  grant_status: ProgressionGrantStatus;
  grant_type: ProgressionGrantType;
  muscle_group: string | null;
  season_id: string | null;
  user_id: string;
};

export type GamificationBackfillProfile = {
  active_season_id: string | null;
  current_season_points: number;
  current_streak: number;
  last_progressed_at: Date | null;
  longest_streak: number;
  total_xp: number;
  user_id: string;
};

export type GamificationBackfillMuscle = {
  id: string;
  last_ranked_at: Date | null;
  muscle_group: string;
  rank: MasteryRank;
  total_volume_kg: Prisma.Decimal;
  user_id: string;
  xp_points: number;
};

export type GamificationBackfillSeason = {
  created_at: Date;
  id: string;
  starts_at: Date;
  status: SeasonStatus;
};

export type GamificationBackfillStanding = {
  id: string;
  is_disqualified: boolean;
  is_hidden: boolean;
  last_earned_at: Date | null;
  rank_position: number | null;
  season_id: string;
  season_points: number;
  user_id: string;
};

export type GamificationBackfillRankingProfile = {
  governance_status: RankingGovernanceStatus;
  user_id: string;
  visibility: RankingVisibility;
};

export type GamificationBackfillMilestoneDefinition = {
  condition_payload: Prisma.JsonValue | null;
  id: string;
  is_active: boolean;
  status: MilestoneDefinitionStatus;
};

export type GamificationBackfillProgress = {
  claimed_at: Date | null;
  id: string;
  milestone_definition_id: string;
  progress_payload: Prisma.JsonValue | null;
  progress_value: number;
  reward_granted_at: Date | null;
  status: MilestoneProgressStatus;
  unlocked_at: Date | null;
  user_id: string;
};

export type GamificationBackfillInput = {
  grants: readonly GamificationBackfillGrant[];
  milestoneDefinitions: readonly GamificationBackfillMilestoneDefinition[];
  milestoneProgress: readonly GamificationBackfillProgress[];
  muscleMastery: readonly GamificationBackfillMuscle[];
  now: Date;
  profiles: readonly GamificationBackfillProfile[];
  rankingProfiles: readonly GamificationBackfillRankingProfile[];
  seasons: readonly GamificationBackfillSeason[];
  seasonalStandings: readonly GamificationBackfillStanding[];
};

export type GamificationBackfillReport = {
  milestoneProgress: number;
  muscleMastery: number;
  profiles: number;
  rankingProfiles: number;
  seasonalStandings: number;
  usersConsidered: number;
};

export type GamificationBackfillPlan = {
  milestoneProgress: Array<{
    claimed_at: Date | null;
    existing: GamificationBackfillProgress | null;
    milestone_definition_id: string;
    progress_payload: Prisma.JsonObject;
    progress_value: number;
    reward_granted_at: Date | null;
    status: MilestoneProgressStatus;
    unlocked_at: Date | null;
    user_id: string;
  }>;
  muscleMastery: Array<{
    existing: GamificationBackfillMuscle | null;
    last_ranked_at: Date | null;
    muscle_group: string;
    rank: MasteryRank;
    total_volume_kg: Prisma.Decimal;
    user_id: string;
    xp_points: number;
  }>;
  profiles: Array<{
    active_season_id: string | null;
    current_season_points: number;
    current_streak: number;
    existing: GamificationBackfillProfile | null;
    last_progressed_at: Date | null;
    longest_streak: number;
    total_xp: number;
    user_id: string;
  }>;
  rankingProfiles: Array<{ user_id: string }>;
  report: GamificationBackfillReport;
  seasonalStandings: Array<{
    existing: GamificationBackfillStanding | null;
    is_disqualified: boolean;
    is_hidden: boolean;
    last_earned_at: Date | null;
    rank_position: number;
    season_id: string;
    season_points: number;
    user_id: string;
  }>;
};

export type GamificationBackfillOptions = {
  dryRun?: boolean;
};

function normalizeMuscleGroup(value: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function addToMap(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + Math.max(0, amount));
}

function maxDate(left: Date | null, right: Date | null) {
  if (!left) return right;
  if (!right) return left;
  return left.getTime() >= right.getTime() ? left : right;
}

function sameDate(left: Date | null, right: Date | null) {
  return left?.getTime() === right?.getTime();
}

function mapByUser<T extends { user_id: string }>(rows: readonly T[]) {
  return new Map(rows.map((row) => [row.user_id, row]));
}

function mapByKey<T>(rows: readonly T[], getKey: (row: T) => string) {
  return new Map(rows.map((row) => [getKey(row), row]));
}

function readCondition(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const condition = value as Prisma.JsonObject;
  const metric = condition.metric;
  const target = condition.target;
  if (
    typeof metric !== 'string' ||
    typeof target !== 'number' ||
    !Number.isFinite(target)
  ) {
    return null;
  }

  return { metric, target: Math.max(0, target) };
}

function isJsonObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getObservedMetric(
  metric: string,
  values: {
    current_season_points: number;
    total_xp: number;
    tracked_muscle_groups: number;
  },
) {
  if (metric === 'total_xp') return values.total_xp;
  if (metric === 'current_season_points') return values.current_season_points;
  if (metric === 'tracked_muscle_groups') return values.tracked_muscle_groups;
  return null;
}

function buildProfileValues(
  input: GamificationBackfillInput,
  xpByUser: Map<string, number>,
  seasonPointsByUser: Map<string, number>,
  latestGrantByUser: Map<string, Date>,
  activeSeasonId: string | null,
) {
  const profilesByUser = mapByUser(input.profiles);
  const userIds = new Set<string>([
    ...input.profiles.map((profile) => profile.user_id),
    ...xpByUser.keys(),
    ...seasonPointsByUser.keys(),
  ]);
  const profiles: GamificationBackfillPlan['profiles'] = [];

  for (const userId of userIds) {
    const existing = profilesByUser.get(userId) ?? null;
    const derivedXp = xpByUser.get(userId) ?? 0;
    const derivedSeasonPoints = seasonPointsByUser.get(userId) ?? 0;
    const totalXp = Math.max(existing?.total_xp ?? 0, derivedXp);
    const currentSeasonPoints = Math.max(
      existing?.current_season_points ?? 0,
      derivedSeasonPoints,
    );
    const activeSeason = existing?.active_season_id ?? activeSeasonId;
    const lastProgressedAt = maxDate(
      existing?.last_progressed_at ?? null,
      latestGrantByUser.get(userId) ?? null,
    );
    const hasDerivedState =
      derivedXp > 0 ||
      derivedSeasonPoints > 0 ||
      Boolean(existing && existing.total_xp > 0 && !existing.active_season_id);

    if (!hasDerivedState) {
      continue;
    }

    const changed =
      !existing ||
      existing.active_season_id !== activeSeason ||
      existing.current_season_points !== currentSeasonPoints ||
      existing.total_xp !== totalXp ||
      !sameDate(existing.last_progressed_at, lastProgressedAt);

    if (changed) {
      profiles.push({
        active_season_id: activeSeason,
        current_season_points: currentSeasonPoints,
        current_streak: existing?.current_streak ?? 0,
        existing,
        last_progressed_at: lastProgressedAt,
        longest_streak: existing?.longest_streak ?? 0,
        total_xp: totalXp,
        user_id: userId,
      });
    }
  }

  return { profiles, userIds };
}

export function buildGamificationBackfillPlan(
  input: GamificationBackfillInput,
): GamificationBackfillPlan {
  const xpByUser = new Map<string, number>();
  const xpByMuscle = new Map<string, number>();
  const seasonalStandingKeys = new Set<string>();
  const seasonPointsByUserAndSeason = new Map<string, number>();
  const latestGrantByUser = new Map<string, Date>();
  const latestGrantByMuscle = new Map<string, Date>();
  const latestGrantBySeasonAndUser = new Map<string, Date>();

  for (const grant of input.grants) {
    if (grant.grant_status !== ProgressionGrantStatus.applied) continue;

    const amount = Math.max(0, grant.amount);
    if (grant.grant_type === ProgressionGrantType.xp) {
      addToMap(xpByUser, grant.user_id, amount);
      const muscleGroup = normalizeMuscleGroup(grant.muscle_group);
      if (muscleGroup) {
        const muscleKey = `${grant.user_id}:${muscleGroup}`;
        addToMap(xpByMuscle, muscleKey, amount);
        latestGrantByMuscle.set(
          muscleKey,
          maxDate(latestGrantByMuscle.get(muscleKey) ?? null, grant.created_at) ??
            grant.created_at,
        );
      }
    }

    if (
      grant.season_id &&
      (grant.grant_type === ProgressionGrantType.xp ||
        grant.grant_type === ProgressionGrantType.season_points)
    ) {
      const seasonKey = `${grant.season_id}:${grant.user_id}`;
      seasonalStandingKeys.add(seasonKey);
      if (grant.grant_type === ProgressionGrantType.season_points) {
        addToMap(seasonPointsByUserAndSeason, seasonKey, amount);
        latestGrantBySeasonAndUser.set(
          seasonKey,
          maxDate(
            latestGrantBySeasonAndUser.get(seasonKey) ?? null,
            grant.created_at,
          ) ?? grant.created_at,
        );
      }
    }

    latestGrantByUser.set(
      grant.user_id,
      maxDate(latestGrantByUser.get(grant.user_id) ?? null, grant.created_at) ??
        grant.created_at,
    );
  }

  const activeSeason = input.seasons
    .filter((season) => season.status === SeasonStatus.active)
    .sort((left, right) => right.starts_at.getTime() - left.starts_at.getTime())[0];
  const activeSeasonId = activeSeason?.id ?? null;
  const seasonPointsByUser = new Map<string, number>();
  for (const [seasonKey, amount] of seasonPointsByUserAndSeason) {
    const [seasonId, userId] = seasonKey.split(':');
    if (seasonId === activeSeasonId) {
      seasonPointsByUser.set(userId, amount);
    }
  }

  const { profiles, userIds } = buildProfileValues(
    input,
    xpByUser,
    seasonPointsByUser,
    latestGrantByUser,
    activeSeasonId,
  );
  const profilesByUser = new Map<string, GamificationBackfillProfile>(
    input.profiles.map((profile) => [profile.user_id, profile]),
  );
  const targetProfileByUser = new Map<string, GamificationBackfillPlan['profiles'][number]>(
    profiles.map((profile) => [profile.user_id, profile]),
  );

  const muscleByKey = mapByKey(
    input.muscleMastery,
    (muscle) => `${muscle.user_id}:${normalizeMuscleGroup(muscle.muscle_group)}`,
  );
  const muscleMastery: GamificationBackfillPlan['muscleMastery'] = [];
  for (const [muscleKey, derivedXp] of xpByMuscle) {
    const existing = muscleByKey.get(muscleKey) ?? null;
    const [userId, muscleGroup] = muscleKey.split(':');
    const xpPoints = Math.max(existing?.xp_points ?? 0, derivedXp);
    const lastRankedAt = maxDate(
      existing?.last_ranked_at ?? null,
      latestGrantByMuscle.get(muscleKey) ?? null,
    );
    const rank = evaluateExpRank(xpPoints);
    if (
      !existing ||
      existing.xp_points !== xpPoints ||
      existing.rank !== rank ||
      !sameDate(existing.last_ranked_at, lastRankedAt)
    ) {
      muscleMastery.push({
        existing,
        last_ranked_at: lastRankedAt,
        muscle_group: muscleGroup,
        rank,
        total_volume_kg: existing?.total_volume_kg ?? new Prisma.Decimal(0),
        user_id: userId,
        xp_points: xpPoints,
      });
    }
    userIds.add(userId);
  }

  const standingByKey = mapByKey(
    input.seasonalStandings,
    (standing) => `${standing.season_id}:${standing.user_id}`,
  );
  const standingScores = new Map<string, number>();
  for (const standing of input.seasonalStandings) {
    standingScores.set(
      `${standing.season_id}:${standing.user_id}`,
      standing.season_points,
    );
  }
  for (const [seasonKey, amount] of seasonPointsByUserAndSeason) {
    standingScores.set(
      seasonKey,
      Math.max(standingScores.get(seasonKey) ?? 0, amount),
    );
  }
  for (const seasonKey of seasonalStandingKeys) {
    if (!standingScores.has(seasonKey)) {
      standingScores.set(seasonKey, 0);
    }
  }

  const rankByStandingKey = new Map<string, number>();
  const standingsBySeason = new Map<string, Array<[string, number]>>();
  for (const [key, score] of standingScores) {
    const [seasonId] = key.split(':');
    const seasonRows = standingsBySeason.get(seasonId) ?? [];
    seasonRows.push([key, score]);
    standingsBySeason.set(seasonId, seasonRows);
  }
  for (const rows of standingsBySeason.values()) {
    rows.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    let previousScore: number | null = null;
    let rank = 0;
    rows.forEach(([key, score], index) => {
      if (score !== previousScore) rank = index + 1;
      rankByStandingKey.set(key, rank);
      previousScore = score;
    });
  }

  const seasonalStandings: GamificationBackfillPlan['seasonalStandings'] = [];
  for (const seasonKey of [...seasonalStandingKeys].sort()) {
    const derivedPoints = seasonPointsByUserAndSeason.get(seasonKey) ?? 0;
    const existing = standingByKey.get(seasonKey) ?? null;
    const [seasonId, userId] = seasonKey.split(':');
    const seasonPoints = Math.max(existing?.season_points ?? 0, derivedPoints);
    const lastEarnedAt = maxDate(
      existing?.last_earned_at ?? null,
      latestGrantBySeasonAndUser.get(seasonKey) ?? null,
    );
    const rankPosition = rankByStandingKey.get(seasonKey) ?? 1;
    if (
      !existing ||
      existing.season_points !== seasonPoints ||
      existing.rank_position !== rankPosition ||
      !sameDate(existing.last_earned_at, lastEarnedAt)
    ) {
      seasonalStandings.push({
        existing,
        is_disqualified: existing?.is_disqualified ?? false,
        is_hidden: existing?.is_hidden ?? false,
        last_earned_at: lastEarnedAt,
        rank_position: rankPosition,
        season_id: seasonId,
        season_points: seasonPoints,
        user_id: userId,
      });
    }
    userIds.add(userId);
  }

  const rankingProfilesByUser = mapByUser(input.rankingProfiles);
  const rankingProfiles = [...userIds]
    .filter((userId) => !rankingProfilesByUser.has(userId))
    .filter(
      (userId) =>
        (xpByUser.get(userId) ?? 0) > 0 ||
        (seasonPointsByUser.get(userId) ?? 0) > 0 ||
        [...xpByMuscle.keys()].some((key) => key.startsWith(`${userId}:`)),
    )
    .map((user_id) => ({ user_id }));

  const existingProgressByKey = mapByKey(
    input.milestoneProgress,
    (progress) => `${progress.user_id}:${progress.milestone_definition_id}`,
  );
  const trackedMuscleGroupsByUser = new Map<string, Set<string>>();
  for (const muscle of input.muscleMastery) {
    if (muscle.xp_points <= 0) continue;
    const groups =
      trackedMuscleGroupsByUser.get(muscle.user_id) ?? new Set<string>();
    groups.add(normalizeMuscleGroup(muscle.muscle_group));
    trackedMuscleGroupsByUser.set(muscle.user_id, groups);
  }
  for (const muscleKey of xpByMuscle.keys()) {
    const [userId, muscleGroup] = muscleKey.split(':');
    const groups = trackedMuscleGroupsByUser.get(userId) ?? new Set<string>();
    groups.add(muscleGroup);
    trackedMuscleGroupsByUser.set(userId, groups);
  }

  const milestoneProgress: GamificationBackfillPlan['milestoneProgress'] = [];
  const progressUserIds = new Set([...userIds, ...profilesByUser.keys()]);
  for (const userId of progressUserIds) {
    const existingProfile = profilesByUser.get(userId);
    const targetProfile = targetProfileByUser.get(userId);
    const values = {
      current_season_points:
        targetProfile?.current_season_points ??
        existingProfile?.current_season_points ??
        seasonPointsByUser.get(userId) ??
        0,
      total_xp:
        targetProfile?.total_xp ?? existingProfile?.total_xp ?? xpByUser.get(userId) ?? 0,
      tracked_muscle_groups: trackedMuscleGroupsByUser.get(userId)?.size ?? 0,
    };

    for (const definition of input.milestoneDefinitions) {
      if (
        !definition.is_active ||
        definition.status !== MilestoneDefinitionStatus.active
      ) {
        continue;
      }
      const condition = readCondition(definition.condition_payload);
      if (!condition) continue;
      const observedValue = getObservedMetric(condition.metric, values);
      if (observedValue === null || observedValue <= 0) continue;
      const progressKey = `${userId}:${definition.id}`;
      const existing = existingProgressByKey.get(progressKey) ?? null;
      const progressValue = Math.max(existing?.progress_value ?? 0, observedValue);
      const isUnlocked = observedValue >= condition.target;
      const isClaimed = existing?.status === MilestoneProgressStatus.claimed;
      const status = isClaimed
        ? MilestoneProgressStatus.claimed
        : isUnlocked
          ? MilestoneProgressStatus.unlocked
          : (existing?.status ?? MilestoneProgressStatus.in_progress);
      const unlockedAt =
        existing?.unlocked_at ?? (isUnlocked ? input.now : null);
    const existingProgressPayload = existing?.progress_payload ?? null;
    const existingProgressPayloadObject = isJsonObject(existingProgressPayload)
      ? existingProgressPayload
      : {};
    const progressPayload: Prisma.JsonObject = {
      ...existingProgressPayloadObject,
      backfill: {
          metric: condition.metric,
          observed_value: observedValue,
          source: 'exp-backfill-v1',
          target: condition.target,
        },
      };

      if (
        !existing ||
        existing.progress_value !== progressValue ||
        existing.status !== status ||
        !sameDate(existing.unlocked_at, unlockedAt)
      ) {
        milestoneProgress.push({
          claimed_at: existing?.claimed_at ?? null,
          existing,
          milestone_definition_id: definition.id,
          progress_payload: progressPayload,
          progress_value: progressValue,
          reward_granted_at: existing?.reward_granted_at ?? null,
          status,
          unlocked_at: unlockedAt,
          user_id: userId,
        });
      }
    }
  }

  return {
    milestoneProgress,
    muscleMastery,
    profiles,
    rankingProfiles,
    report: {
      milestoneProgress: milestoneProgress.length,
      muscleMastery: muscleMastery.length,
      profiles: profiles.length,
      rankingProfiles: rankingProfiles.length,
      seasonalStandings: seasonalStandings.length,
      usersConsidered: userIds.size,
    },
    seasonalStandings,
  };
}

async function loadGamificationBackfillInput(
  prisma: PrismaClient,
  now: Date,
): Promise<GamificationBackfillInput> {
  const [grants, profiles, muscleMastery, seasons, seasonalStandings, rankingProfiles, milestoneDefinitions, milestoneProgress] =
    await Promise.all([
      prisma.progressionGrantLedger.findMany({
        where: {
          grant_status: ProgressionGrantStatus.applied,
          grant_type: {
            in: [ProgressionGrantType.xp, ProgressionGrantType.season_points],
          },
        },
        select: {
          amount: true,
          created_at: true,
          grant_status: true,
          grant_type: true,
          muscle_group: true,
          season_id: true,
          user_id: true,
        },
      }),
      prisma.userProgressionProfile.findMany({
        select: {
          active_season_id: true,
          current_season_points: true,
          current_streak: true,
          last_progressed_at: true,
          longest_streak: true,
          total_xp: true,
          user_id: true,
        },
      }),
      prisma.muscleMasteryProgress.findMany({
        select: {
          id: true,
          last_ranked_at: true,
          muscle_group: true,
          rank: true,
          total_volume_kg: true,
          user_id: true,
          xp_points: true,
        },
      }),
      prisma.seasonDefinition.findMany({
        select: { created_at: true, ends_at: true, id: true, starts_at: true, status: true },
      }),
      prisma.seasonalStanding.findMany({
        select: {
          id: true,
          is_disqualified: true,
          is_hidden: true,
          last_earned_at: true,
          rank_position: true,
          season_id: true,
          season_points: true,
          user_id: true,
        },
      }),
      prisma.rankingProfile.findMany({
        select: { governance_status: true, user_id: true, visibility: true },
      }),
      prisma.milestoneDefinition.findMany({
        where: { is_active: true, status: MilestoneDefinitionStatus.active },
        select: { condition_payload: true, id: true, is_active: true, status: true },
      }),
      prisma.userMilestoneProgress.findMany({
        select: {
          claimed_at: true,
          id: true,
          milestone_definition_id: true,
          progress_payload: true,
          progress_value: true,
          reward_granted_at: true,
          status: true,
          unlocked_at: true,
          user_id: true,
        },
      }),
    ]);

  return {
    grants,
    milestoneDefinitions,
    milestoneProgress,
    muscleMastery,
    now,
    profiles,
    rankingProfiles,
    seasons: seasons.map(({ created_at, id, starts_at, status }) => ({
      created_at,
      id,
      starts_at,
      status,
    })),
    seasonalStandings,
  };
}

async function applyGamificationBackfill(
  prisma: PrismaClient,
  plan: GamificationBackfillPlan,
) {
  await prisma.$transaction(async (tx) => {
    for (const profile of plan.profiles) {
      if (profile.existing) {
        await tx.userProgressionProfile.update({
          where: { user_id: profile.user_id },
          data: {
            active_season_id: profile.active_season_id,
            current_season_points: profile.current_season_points,
            last_progressed_at: profile.last_progressed_at,
            total_xp: profile.total_xp,
          },
        });
      } else {
        await tx.userProgressionProfile.create({
          data: {
            active_season_id: profile.active_season_id,
            current_season_points: profile.current_season_points,
            current_streak: profile.current_streak,
            last_progressed_at: profile.last_progressed_at,
            longest_streak: profile.longest_streak,
            total_xp: profile.total_xp,
            user_id: profile.user_id,
          },
        });
      }
    }

    for (const muscle of plan.muscleMastery) {
      if (muscle.existing) {
        await tx.muscleMasteryProgress.update({
          where: { id: muscle.existing.id },
          data: {
            last_ranked_at: muscle.last_ranked_at,
            rank: muscle.rank,
            xp_points: muscle.xp_points,
          },
        });
      } else {
        await tx.muscleMasteryProgress.create({
          data: {
            last_ranked_at: muscle.last_ranked_at,
            muscle_group: muscle.muscle_group,
            rank: muscle.rank,
            total_volume_kg: muscle.total_volume_kg,
            user_id: muscle.user_id,
            xp_points: muscle.xp_points,
          },
        });
      }
    }

    for (const standing of plan.seasonalStandings) {
      if (standing.existing) {
        await tx.seasonalStanding.update({
          where: { id: standing.existing.id },
          data: {
            last_earned_at: standing.last_earned_at,
            rank_position: standing.rank_position,
            season_points: standing.season_points,
          },
        });
      } else {
        await tx.seasonalStanding.create({
          data: {
            is_disqualified: standing.is_disqualified,
            is_hidden: standing.is_hidden,
            last_earned_at: standing.last_earned_at,
            rank_position: standing.rank_position,
            season_id: standing.season_id,
            season_points: standing.season_points,
            user_id: standing.user_id,
          },
        });
      }
    }

    for (const rankingProfile of plan.rankingProfiles) {
      await tx.rankingProfile.upsert({
        where: { user_id: rankingProfile.user_id },
        update: {},
        create: {
          governance_status: RankingGovernanceStatus.normal,
          user_id: rankingProfile.user_id,
          visibility: RankingVisibility.public,
        },
      });
    }

    for (const progress of plan.milestoneProgress) {
      if (progress.existing) {
        await tx.userMilestoneProgress.update({
          where: { id: progress.existing.id },
          data: {
            claimed_at: progress.claimed_at,
            progress_payload: progress.progress_payload,
            progress_value: progress.progress_value,
            reward_granted_at: progress.reward_granted_at,
            status: progress.status,
            unlocked_at: progress.unlocked_at,
          },
        });
      } else {
        await tx.userMilestoneProgress.create({
          data: {
            claimed_at: progress.claimed_at,
            milestone_definition_id: progress.milestone_definition_id,
            progress_payload: progress.progress_payload,
            progress_value: progress.progress_value,
            reward_granted_at: progress.reward_granted_at,
            status: progress.status,
            unlocked_at: progress.unlocked_at,
            user_id: progress.user_id,
          },
        });
      }
    }
  });
}

export async function runGamificationBackfill(
  prisma: PrismaClient,
  options: GamificationBackfillOptions = {},
) {
  const input = await loadGamificationBackfillInput(prisma, new Date());
  const plan = buildGamificationBackfillPlan(input);
  const dryRun = options.dryRun ?? true;

  if (!dryRun) {
    await applyGamificationBackfill(prisma, plan);
  }

  return { ...plan.report, applied: !dryRun, dryRun };
}
