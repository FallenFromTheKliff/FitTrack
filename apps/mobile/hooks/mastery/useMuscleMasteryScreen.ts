import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fitnessIntegritySummaryQueryOptions,
  fitnessLeaderboardQueryOptions,
  fitnessMasteryQueryOptions,
  fitnessMilestonesQueryOptions,
  fitnessProgressionProfileQueryOptions,
  fitnessRankingProfileQueryOptions,
  fitnessSeasonStandingQueryOptions,
  claimFitnessMilestoneMutationOptions,
  updateFitnessRankingProfileMutationOptions,
} from "@fittrack/query";
import type {
  FitnessIntegritySummaryRecord,
  FitnessMasteryRank,
  FitnessMilestoneProgressRecord,
  FitnessProgressionProfileRecord,
  FitnessRankingProfileRecord,
  FitnessRankingVisibility,
  FitnessSeasonStandingRecord,
  MuscleMasteryRecord,
} from "@fittrack/types";

import { useAuth } from "@/contexts/AuthContext";
import { mobileApiClient } from "@/lib/api-client";
import { useTimedMessage } from "@fittrack/hooks";

type UseMuscleMasteryScreenOptions = {
  isFocused?: boolean;
};

type AchievementCard = {
  category: string;
  description: string;
  id: string;
  isUnlocked: boolean;
  label: string;
  progressLabel: string;
  progressPercent: number;
  statusLabel: string;
};

type MasteryTab = "summary" | "milestones" | "muscles" | "leaderboard";
type MuscleRankFilter = FitnessMasteryRank | "all";

type RankingVisibilityOption = {
  description: string;
  isSelected: boolean;
  label: string;
  value: FitnessRankingVisibility;
};

const RANK_PRIORITY: Record<FitnessMasteryRank, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  adamantite: 5,
};

const EMPTY_MILESTONES: FitnessMilestoneProgressRecord[] = [];
const MILESTONE_PAGE_SIZE = 4;
const MUSCLE_PAGE_SIZE = 8;
const LEADERBOARD_PAGE_SIZE = 8;

const RANKING_VISIBILITY_OPTIONS: Array<
  Omit<RankingVisibilityOption, "isSelected">
> = [
  {
    value: "public",
    label: "Public",
    description: "Show your profile name on ranked member surfaces.",
  },
  {
    value: "anonymous",
    label: "Anonymous",
    description: "Stay ranked while masking your member identity.",
  },
  {
    value: "private",
    label: "Private",
    description: "Hide your visible ranking while keeping progression history.",
  },
];

function formatCompactNumber(value: number) {
  return value.toLocaleString("en-US");
}

function formatTitle(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMilestoneProgress(milestone: FitnessMilestoneProgressRecord) {
  if (milestone.status === "claimed") return "Claimed";
  if (milestone.status === "unlocked") return "Unlocked";
  return `${Math.round(milestone.progressPercent)}%`;
}

function formatDateRange(
  season: FitnessProgressionProfileRecord["activeSeason"] | null,
) {
  if (!season) return "No active season";

  const startsAt = new Date(season.startsAt);
  const endsAt = new Date(season.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return season.title;
  }

  return `${season.title} | ${startsAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${endsAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function resolveHighestRank(mastery: MuscleMasteryRecord[]) {
  return mastery.reduce<MuscleMasteryRecord | null>((highest, entry) => {
    if (!highest) return entry;
    if (RANK_PRIORITY[entry.rank] > RANK_PRIORITY[highest.rank]) {
      return entry;
    }
    if (
      RANK_PRIORITY[entry.rank] === RANK_PRIORITY[highest.rank] &&
      entry.xpPoints > highest.xpPoints
    ) {
      return entry;
    }
    return highest;
  }, null);
}

function sortMilestones(
  left: FitnessMilestoneProgressRecord,
  right: FitnessMilestoneProgressRecord,
) {
  const statusWeight = {
    claimed: 3,
    unlocked: 2,
    pending_review: 2,
    rejected: 1,
    in_progress: 1,
  };
  const statusDelta = statusWeight[right.status] - statusWeight[left.status];
  if (statusDelta !== 0) return statusDelta;
  return right.progressPercent - left.progressPercent;
}

function buildAchievementCards(
  milestones: FitnessMilestoneProgressRecord[],
): AchievementCard[] {
  return [...milestones]
    .filter((milestone) => !milestone.isHidden)
    .sort(sortMilestones)
    .slice(0, 4)
    .map((milestone) => {
      const isUnlocked =
        milestone.status === "unlocked" || milestone.status === "claimed";
      return {
        category: formatTitle(milestone.category),
        description:
          milestone.description ??
          `${formatTitle(milestone.triggerType)} milestone progress.`,
        id: milestone.milestoneDefinitionId,
        isUnlocked,
        label: milestone.title,
        progressLabel: `${formatCompactNumber(
          milestone.progressValue,
        )} / ${formatCompactNumber(milestone.targetValue)}`,
        progressPercent: Math.min(
          Math.max(milestone.progressPercent / 100, 0),
          1,
        ),
        statusLabel: formatMilestoneProgress(milestone),
      };
    });
}

function resolveRankingVisibility(
  rankingProfile: FitnessRankingProfileRecord | null,
  progressionProfile: FitnessProgressionProfileRecord | null,
): FitnessRankingVisibility {
  return (
    rankingProfile?.visibility ??
    progressionProfile?.rankingVisibility ??
    "public"
  );
}

function resolveSeasonRankLabel(
  standing: FitnessSeasonStandingRecord | null,
  visibility: FitnessRankingVisibility,
) {
  if (!standing?.season) return "No active season";
  if (standing.isDisqualified) return "Under review";
  if (standing.isHidden || visibility === "private") return "Hidden";
  return standing.rankPosition ? `#${standing.rankPosition}` : "Unranked";
}

function resolveIntegrityNotice(
  summary: FitnessIntegritySummaryRecord | null,
  progressionProfile: FitnessProgressionProfileRecord | null,
) {
  const riskLevel =
    summary?.riskLevel ?? progressionProfile?.integrityRiskLevel;
  if (!riskLevel || riskLevel === "low") return null;

  return {
    title:
      riskLevel === "high" ? "Progress under review" : "Progress check active",
    body:
      summary && summary.openCaseCount > 0
        ? `${summary.openCaseCount} progression review ${summary.openCaseCount === 1 ? "case is" : "cases are"} open. Some gains may stay pending until review closes.`
        : "Some progression may stay pending while the system finishes its integrity checks.",
  };
}

function resolveLockStatusLabel(
  membershipCardStatus: string,
  hasMemberCardAccess: boolean,
) {
  if (membershipCardStatus === "pending_verification") {
    return "Pending verification";
  }
  if (membershipCardStatus === "revoked") return "Revoked";
  return hasMemberCardAccess ? "Member" : "Non-member";
}

function resolveLockMessage(
  membershipCardStatus: string,
  hasMemberCardAccess: boolean,
) {
  if (membershipCardStatus === "pending_verification") {
    return "Your membership card payment is waiting for verification. Muscle Mastery unlocks as soon as staff confirms it.";
  }
  if (membershipCardStatus === "revoked") {
    return "Your membership card access is revoked right now. Ask the front desk to repair the account if this is unexpected.";
  }
  if (hasMemberCardAccess) {
    return "Your member profile is active, but this page is still preparing the latest progress snapshot.";
  }
  return "Muscle Mastery unlocks after this account has an active membership card.";
}

export function useMuscleMasteryScreen({
  isFocused = true,
}: UseMuscleMasteryScreenOptions = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { message: statusMessage, showMessage } = useTimedMessage(2600);
  const unlockedMilestoneIdsRef = useRef<Set<string> | null>(null);
  const membershipCardStatus = user?.membershipCard?.status ?? "none";
  const hasMemberCardAccess = user?.membershipAccess === "member";
  const isMemberLocked = !!user && !hasMemberCardAccess;
  const canLoadProgression = isFocused && !!user?.id && hasMemberCardAccess;
  const [activeTab, setActiveTab] = useState<MasteryTab>("summary");
  const [muscleSearch, setMuscleSearch] = useState("");
  const [muscleRankFilter, setMuscleRankFilter] =
    useState<MuscleRankFilter>("all");
  const [milestonePage, setMilestonePage] = useState(1);
  const [musclePage, setMusclePage] = useState(1);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [celebrationKey, setCelebrationKey] = useState(0);

  const masteryQuery = useQuery({
    ...fitnessMasteryQueryOptions(mobileApiClient, user?.id),
    enabled: canLoadProgression,
  });
  const leaderboardQuery = useQuery({
    ...fitnessLeaderboardQueryOptions(mobileApiClient, user?.id, {
      limit: LEADERBOARD_PAGE_SIZE,
      page: leaderboardPage,
    }),
    enabled: canLoadProgression,
  });
  const progressionProfileQuery = useQuery({
    ...fitnessProgressionProfileQueryOptions(mobileApiClient, user?.id),
    enabled: canLoadProgression,
  });
  const rankingProfileQuery = useQuery({
    ...fitnessRankingProfileQueryOptions(mobileApiClient, user?.id),
    enabled: canLoadProgression,
  });
  const seasonStandingQuery = useQuery({
    ...fitnessSeasonStandingQueryOptions(mobileApiClient, user?.id),
    enabled: canLoadProgression,
  });
  const milestonesQuery = useQuery({
    ...fitnessMilestonesQueryOptions(mobileApiClient, user?.id, {
      includeLocked: true,
    }),
    enabled: canLoadProgression,
  });
  const integritySummaryQuery = useQuery({
    ...fitnessIntegritySummaryQueryOptions(mobileApiClient, user?.id),
    enabled: canLoadProgression,
  });
  const updateRankingProfileMutation = useMutation(
    updateFitnessRankingProfileMutationOptions(mobileApiClient, queryClient),
  );
  const claimMilestoneMutation = useMutation(
    claimFitnessMilestoneMutationOptions(mobileApiClient, queryClient),
  );

  const mastery = useMemo(
    () =>
      [...(masteryQuery.data ?? [])].sort(
        (left, right) => right.xpPoints - left.xpPoints,
      ),
    [masteryQuery.data],
  );
  const progressionProfile = progressionProfileQuery.data ?? null;
  const rankingProfile = rankingProfileQuery.data ?? null;
  const seasonStanding = seasonStandingQuery.data ?? null;
  const milestones = milestonesQuery.data ?? EMPTY_MILESTONES;
  const integritySummary = integritySummaryQuery.data ?? null;
  const rankingVisibility = resolveRankingVisibility(
    rankingProfile,
    progressionProfile,
  );
  const leaderboard = leaderboardQuery.data?.data ?? [];
  const leaderboardMeta = leaderboardQuery.data?.meta ?? {
    page: leaderboardPage,
    limit: LEADERBOARD_PAGE_SIZE,
    total: leaderboard.length,
    total_pages: Math.max(1, leaderboard.length ? 1 : 0),
  };
  const visibleLeaderboard = rankingVisibility === "private" ? [] : leaderboard;
  const topMuscle = mastery[0] ?? null;
  const highestRankEntry = resolveHighestRank(mastery);
  const totalXp =
    progressionProfile?.totalXp ??
    mastery.reduce((sum, entry) => sum + entry.xpPoints, 0);
  const totalVolumeKg = mastery.reduce(
    (sum, entry) => sum + entry.totalVolumeKg,
    0,
  );
  const leaderboardEntry =
    rankingVisibility === "private"
      ? null
      : (leaderboard.find((entry) => entry.userId === user?.id) ?? null);
  const achievementCards = useMemo(
    () => buildAchievementCards(milestones),
    [milestones],
  );
  const sortedMilestones = useMemo(
    () =>
      [...milestones]
        .filter((milestone) => !milestone.isHidden)
        .sort(sortMilestones),
    [milestones],
  );
  const milestoneTotalPages = Math.max(
    1,
    Math.ceil(sortedMilestones.length / MILESTONE_PAGE_SIZE),
  );
  const milestonePageItems = sortedMilestones.slice(
    (milestonePage - 1) * MILESTONE_PAGE_SIZE,
    milestonePage * MILESTONE_PAGE_SIZE,
  );
  const activeMilestones = useMemo(
    () =>
      [...milestones]
        .filter(
          (milestone) =>
            !milestone.isHidden && milestone.status === "in_progress",
        )
        .sort((left, right) => right.progressPercent - left.progressPercent)
        .slice(0, 3),
    [milestones],
  );
  const recentUnlocks = useMemo(
    () =>
      [...milestones]
        .filter(
          (milestone) =>
            !milestone.isHidden && milestone.status !== "in_progress",
        )
        .sort((left, right) => {
          const leftTime = left.unlockedAt
            ? new Date(left.unlockedAt).getTime()
            : 0;
          const rightTime = right.unlockedAt
            ? new Date(right.unlockedAt).getTime()
            : 0;
          return rightTime - leftTime;
        })
        .slice(0, 3),
    [milestones],
  );
  const filteredMuscles = useMemo(() => {
    const search = muscleSearch.trim().toLowerCase();
    return mastery.filter((entry) => {
      const matchesSearch =
        !search || entry.muscleGroup.toLowerCase().includes(search);
      const matchesRank =
        muscleRankFilter === "all" || entry.rank === muscleRankFilter;
      return matchesSearch && matchesRank;
    });
  }, [mastery, muscleRankFilter, muscleSearch]);
  const muscleTotalPages = Math.max(
    1,
    Math.ceil(filteredMuscles.length / MUSCLE_PAGE_SIZE),
  );
  const musclePageItems = filteredMuscles.slice(
    (musclePage - 1) * MUSCLE_PAGE_SIZE,
    musclePage * MUSCLE_PAGE_SIZE,
  );
  const rankingVisibilityOptions = RANKING_VISIBILITY_OPTIONS.map((option) => ({
    ...option,
    isSelected: option.value === rankingVisibility,
  }));
  const seasonRankLabel = resolveSeasonRankLabel(
    seasonStanding,
    rankingVisibility,
  );
  const integrityNotice = resolveIntegrityNotice(
    integritySummary,
    progressionProfile,
  );

  const summaryCards = [
    { id: "xp", label: "Total EXP", value: formatCompactNumber(totalXp) },
    {
      id: "streak",
      label: "Current Streak",
      value: String(progressionProfile?.currentStreak ?? 0),
    },
    {
      id: "season",
      label: "Season Points",
      value: formatCompactNumber(seasonStanding?.seasonPoints ?? 0),
    },
    {
      id: "standing",
      label: "Season Rank",
      value: seasonRankLabel,
    },
  ];
  const totalXpGoal = Math.max(1000, Math.ceil((totalXp + 1) / 1000) * 1000);
  const totalXpProgress = totalXpGoal > 0 ? totalXp / totalXpGoal : 0;

  const loadingQueries = [
    masteryQuery,
    leaderboardQuery,
    progressionProfileQuery,
    rankingProfileQuery,
    seasonStandingQuery,
    milestonesQuery,
    integritySummaryQuery,
  ];
  const isLoading =
    hasMemberCardAccess &&
    loadingQueries.some((query) => query.status === "pending");
  const isError = loadingQueries.some((query) => query.isError);
  const errorMessage =
    (masteryQuery.error as Error | null)?.message ??
    (leaderboardQuery.error as Error | null)?.message ??
    (progressionProfileQuery.error as Error | null)?.message ??
    (rankingProfileQuery.error as Error | null)?.message ??
    (seasonStandingQuery.error as Error | null)?.message ??
    (milestonesQuery.error as Error | null)?.message ??
    (integritySummaryQuery.error as Error | null)?.message ??
    "Unable to load Muscle Mastery right now.";

  useEffect(() => {
    setMusclePage(1);
  }, [muscleRankFilter, muscleSearch]);

  useEffect(() => {
    if (milestonePage > milestoneTotalPages) {
      setMilestonePage(milestoneTotalPages);
    }
  }, [milestonePage, milestoneTotalPages]);

  useEffect(() => {
    if (musclePage > muscleTotalPages) {
      setMusclePage(muscleTotalPages);
    }
  }, [musclePage, muscleTotalPages]);

  useEffect(() => {
    const unlockedIds = new Set(
      sortedMilestones
        .filter((milestone) => milestone.status === "unlocked")
        .map((milestone) => milestone.milestoneDefinitionId),
    );
    const previous = unlockedMilestoneIdsRef.current;
    unlockedMilestoneIdsRef.current = unlockedIds;

    if (!previous) return;

    const nextUnlock = [...unlockedIds].find((id) => !previous.has(id));
    if (!nextUnlock) return;

    const milestone = sortedMilestones.find(
      (entry) => entry.milestoneDefinitionId === nextUnlock,
    );
    if (milestone) {
      showMessage(`${milestone.title} unlocked. Claim it in Milestones.`);
    }
  }, [showMessage, sortedMilestones]);

  const handleOpenChatbot = useCallback(
    () =>
      router.push({
        pathname: "/(tabs)/chatbot",
        params: { from: "mastery", sessionId: "new" },
      }),
    [router],
  );

  const handleOpenNutrition = useCallback(() => {
    router.push("/(tabs)/nutrition");
  }, [router]);

  const handleOpenProfile = useCallback(() => {
    router.push("/(tabs)/profile");
  }, [router]);

  const handleOpenWorkout = useCallback(() => {
    router.push("/(tabs)/workout");
  }, [router]);

  const handleClaimMilestone = useCallback(
    async (milestone: FitnessMilestoneProgressRecord) => {
      if (!user?.id || milestone.status !== "unlocked") return;
      try {
        await claimMilestoneMutation.mutateAsync({
          milestoneDefinitionId: milestone.milestoneDefinitionId,
          userId: user.id,
        });
        setCelebrationKey((current) => current + 1);
        showMessage(`${milestone.title} claimed.`);
      } catch (error) {
        showMessage(
          error instanceof Error
            ? error.message
            : "Unable to claim milestone right now.",
        );
      }
    },
    [claimMilestoneMutation, showMessage, user?.id],
  );

  return {
    achievementCards,
    activeMilestones,
    activeTab,
    celebrationKey,
    errorMessage,
    filteredMuscleCount: filteredMuscles.length,
    hasMemberCardAccess,
    highestRankEntry,
    integrityNotice,
    isEmpty:
      !isLoading && !isError && mastery.length === 0 && milestones.length === 0,
    isError,
    isLoading,
    isMemberLocked,
    isClaimingMilestone: claimMilestoneMutation.isPending,
    isRefreshing:
      hasMemberCardAccess && loadingQueries.some((query) => query.isFetching),
    isUpdatingRankingVisibility: updateRankingProfileMutation.isPending,
    leaderboard: visibleLeaderboard,
    leaderboardEntry,
    leaderboardMeta,
    memberLockMessage: resolveLockMessage(
      membershipCardStatus,
      hasMemberCardAccess,
    ),
    memberLockStatusLabel: resolveLockStatusLabel(
      membershipCardStatus,
      hasMemberCardAccess,
    ),
    milestonePage,
    milestonePageItems,
    milestoneTotalPages,
    milestones,
    mastery,
    musclePage,
    musclePageItems,
    muscleRankFilter,
    muscleSearch,
    muscleTotalPages,
    onOpenChatbot: handleOpenChatbot,
    onOpenNutrition: handleOpenNutrition,
    onOpenProfile: handleOpenProfile,
    onOpenWorkout: handleOpenWorkout,
    onClaimMilestone: handleClaimMilestone,
    onRefresh: async () => {
      await Promise.all(loadingQueries.map((query) => query.refetch()));
    },
    onSelectRankingVisibility: async (visibility: FitnessRankingVisibility) => {
      if (visibility === rankingVisibility || !user?.id) return;
      await updateRankingProfileMutation.mutateAsync({
        input: { visibility },
        userId: user.id,
      });
    },
    privacyError:
      (updateRankingProfileMutation.error as Error | null)?.message ?? null,
    progressionProfile,
    rankingProfile,
    rankingVisibility,
    rankingVisibilityOptions,
    recentUnlocks,
    seasonCaption: formatDateRange(
      seasonStanding?.season ?? progressionProfile?.activeSeason ?? null,
    ),
    seasonRankLabel,
    seasonStanding,
    summaryCards,
    setActiveTab,
    setLeaderboardPage,
    setMilestonePage,
    setMusclePage,
    setMuscleRankFilter,
    setMuscleSearch,
    sortedMilestones,
    statusMessage,
    topMuscle,
    totalXp,
    totalXpGoal,
    totalXpProgress,
    totalVolumeKg,
  };
}
