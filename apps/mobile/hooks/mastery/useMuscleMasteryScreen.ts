import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fitnessIntegritySummaryQueryOptions,
  fitnessMemberMuscleDefinitionsQueryOptions,
  fitnessLeaderboardQueryOptions,
  fitnessMuscleLeaderboardQueryOptions,
  fitnessMasteryQueryOptions,
  fitnessMilestonesQueryOptions,
  fitnessProgressionProfileQueryOptions,
  fitnessRankingProfileQueryOptions,
  fitnessSeasonStandingQueryOptions,
  fitnessSeasonHistoryQueryOptions,
  claimFitnessMilestoneMutationOptions,
  updateFitnessRankingProfileMutationOptions,
} from "@fittrack/query";
import type {
  FitnessExpProgressionRecord,
  FitnessLeaderboardEntryRecord,
  FitnessIntegritySummaryRecord,
  FitnessMasteryRank,
  FitnessMuscleLeaderboardEntryRecord,
  FitnessMilestoneProgressRecord,
  FitnessProgressionProfileRecord,
  FitnessRankingProfileRecord,
  FitnessRankingVisibility,
  FitnessSeasonStandingRecord,
  PaginationMeta,
  MuscleMasteryRecord,
} from "@fittrack/types";
import { getFitnessExpProgressionState } from "@fittrack/types";

import { useAuth } from "@/contexts/AuthContext";
import { mobileApiClient } from "@/lib/api-client";
import { useTimedMessage } from "@fittrack/hooks";
import { createMilestoneClaimGuard } from "./milestoneClaimGuard";
import {
  resolveSeasonHistoryId,
  resolveSeasonHistoryMuscleOptions,
  resolveSeasonHistoryMuscleRows,
  retainMuscleSelection,
} from "./seasonHistorySelection";

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
type LeaderboardMode = "overall" | "muscle";
type MilestoneFilter = "all" | "achieved" | "unachieved";
type SeasonHistoryScope = "overall" | "muscle";

type ClaimedMilestonePresentation = {
  id: string;
  title: string;
};

type MasteryRecordWithOptionalProgression = MuscleMasteryRecord & {
  currentSeasonXp?: number | null;
  iconAssetKey?: string | null;
  iconKey?: string | null;
  iconKind?: "library" | "custom";
  lifetimeXpPoints?: number | null;
  seasonExp?: number | null;
  seasonXpPoints?: number | null;
};

type CursorState = {
  hasMore: boolean;
  limit: number;
  nextCursor: string | null;
  page: number;
  snapshot: string | null;
  total: number;
  totalPages: number;
};

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
const LEADERBOARD_PAGE_SIZE = 8;
const MILESTONE_LAZY_BATCH_SIZE = 6;

const EMPTY_CURSOR_STATE: CursorState = {
  hasMore: false,
  limit: LEADERBOARD_PAGE_SIZE,
  nextCursor: null,
  page: 1,
  snapshot: null,
  total: 0,
  totalPages: 0,
};

const RANKING_VISIBILITY_OPTIONS: Array<Omit<RankingVisibilityOption, "isSelected">> = [
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

function toSafeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildCursorState(meta: PaginationMeta | undefined, fallbackPage: number, fallbackLimit: number): CursorState {
  const page = toSafeNumber(meta?.page, fallbackPage);
  const totalPages = toSafeNumber(meta?.total_pages, 0);
  const nextCursor = meta?.next_cursor ?? null;

  return {
    hasMore: Boolean(nextCursor) || page < totalPages,
    limit: toSafeNumber(meta?.limit, fallbackLimit),
    nextCursor,
    page,
    snapshot: meta?.snapshot ?? null,
    total: toSafeNumber(meta?.total, 0),
    totalPages,
  };
}

function appendLeaderboardRows<T extends { rankPosition: number; userId: string }>(current: T[], next: T[]) {
  const seen = new Set(current.map((entry) => `${entry.userId}:${entry.rankPosition}`));
  return [
    ...current,
    ...next.filter((entry) => {
      const key = `${entry.userId}:${entry.rankPosition}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

function deriveMasteryProgression(entry: MuscleMasteryRecord) {
  const optionalEntry = entry as MasteryRecordWithOptionalProgression;
  const lifetimeXp = toSafeNumber(optionalEntry.lifetimeXpPoints, entry.xpPoints);
  const seasonXp = toSafeNumber(
    optionalEntry.seasonXpPoints ?? optionalEntry.currentSeasonXp ?? optionalEntry.seasonExp,
    entry.xpPoints,
  );

  return {
    ...entry,
    iconAssetKey: optionalEntry.iconAssetKey ?? null,
    iconKey: optionalEntry.iconKey ?? "dumbbell",
    iconKind: optionalEntry.iconKind ?? "library",
    lifetimeProgression: getFitnessExpProgressionState(lifetimeXp),
    seasonProgression: getFitnessExpProgressionState(seasonXp),
  };
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

function formatDateRange(season: FitnessProgressionProfileRecord["activeSeason"] | null) {
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
    if (RANK_PRIORITY[entry.rank] === RANK_PRIORITY[highest.rank] && entry.xpPoints > highest.xpPoints) {
      return entry;
    }
    return highest;
  }, null);
}

function sortMilestones(left: FitnessMilestoneProgressRecord, right: FitnessMilestoneProgressRecord) {
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

function buildAchievementCards(milestones: FitnessMilestoneProgressRecord[]): AchievementCard[] {
  return [...milestones]
    .filter((milestone) => !milestone.isHidden || milestone.status !== "in_progress")
    .sort(sortMilestones)
    .slice(0, 4)
    .map((milestone) => {
      const isUnlocked = milestone.status === "unlocked" || milestone.status === "claimed";
      return {
        category: formatTitle(milestone.category),
        description: milestone.description ?? `${formatTitle(milestone.triggerType)} milestone progress.`,
        id: milestone.milestoneDefinitionId,
        isUnlocked,
        label: milestone.title,
        progressLabel: `${formatCompactNumber(
          milestone.progressValue,
        )} / ${formatCompactNumber(milestone.targetValue)}`,
        progressPercent: Math.min(Math.max(milestone.progressPercent / 100, 0), 1),
        statusLabel: formatMilestoneProgress(milestone),
      };
    });
}

function resolveRankingVisibility(
  rankingProfile: FitnessRankingProfileRecord | null,
  progressionProfile: FitnessProgressionProfileRecord | null,
): FitnessRankingVisibility {
  return rankingProfile?.visibility ?? progressionProfile?.rankingVisibility ?? "public";
}

function resolveSeasonRankLabel(standing: FitnessSeasonStandingRecord | null, visibility: FitnessRankingVisibility) {
  if (!standing?.season) return "No active season";
  if (standing.isDisqualified) return "Under review";
  if (standing.isHidden || visibility === "private") return "Hidden";
  return standing.rankPosition ? `#${standing.rankPosition}` : "Unranked";
}

function resolveIntegrityNotice(
  summary: FitnessIntegritySummaryRecord | null,
  progressionProfile: FitnessProgressionProfileRecord | null,
) {
  const riskLevel = summary?.riskLevel ?? progressionProfile?.integrityRiskLevel;
  if (!riskLevel || riskLevel === "low") return null;

  return {
    title: riskLevel === "high" ? "Progress under review" : "Progress check active",
    body:
      summary && summary.openCaseCount > 0
        ? `${summary.openCaseCount} progression review ${summary.openCaseCount === 1 ? "case is" : "cases are"} open. Some gains may stay pending until review closes.`
        : "Some progression may stay pending while the system finishes its integrity checks.",
  };
}

function resolveLockStatusLabel(membershipCardStatus: string, hasMemberCardAccess: boolean) {
  if (membershipCardStatus === "pending_verification") {
    return "Pending verification";
  }
  if (membershipCardStatus === "revoked") return "Revoked";
  return hasMemberCardAccess ? "Member" : "Non-member";
}

function resolveLockMessage(membershipCardStatus: string, hasMemberCardAccess: boolean) {
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

export function useMuscleMasteryScreen({ isFocused = true }: UseMuscleMasteryScreenOptions = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { message: statusMessage, showMessage } = useTimedMessage(2600);
  const milestoneClaimGuardRef = useRef(createMilestoneClaimGuard());
  const unlockedMilestoneIdsRef = useRef<Set<string> | null>(null);
  const isFocusedRef = useRef(isFocused);
  const activeUserIdRef = useRef(user?.id ?? null);
  const membershipCardStatus = user?.membershipCard?.status ?? "none";
  const hasMemberCardAccess = user?.membershipAccess === "member";
  const isMemberLocked = !!user && !hasMemberCardAccess;
  const canLoadProgression = isFocused && !!user?.id && hasMemberCardAccess;
  const [activeTab, setActiveTab] = useState<MasteryTab>("summary");
  const [milestoneSearch, setMilestoneSearch] = useState("");
  const [milestoneFilter, setMilestoneFilter] = useState<MilestoneFilter>("all");
  const [milestoneVisibleCount, setMilestoneVisibleCount] = useState(MILESTONE_LAZY_BATCH_SIZE);
  const [muscleSearch, setMuscleSearch] = useState("");
  const [muscleRankFilter, setMuscleRankFilter] = useState<MuscleRankFilter>("all");
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>("overall");
  const [muscleLeaderboardScope, setMuscleLeaderboardScope] = useState<"lifetime" | "season">("season");
  const [selectedLeaderboardMuscle, setSelectedLeaderboardMuscle] = useState("");
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [celebratedMilestoneId, setCelebratedMilestoneId] = useState<string | null>(null);
  const [claimedMilestone, setClaimedMilestone] = useState<ClaimedMilestonePresentation | null>(null);
  const [isSeasonHistoryOpen, setSeasonHistoryOpen] = useState(false);
  const [seasonHistoryScope, setSeasonHistoryScope] = useState<SeasonHistoryScope>("overall");
  const [seasonHistoryMuscleKey, setSeasonHistoryMuscleKey] = useState("");
  const [selectedSeasonHistoryId, setSelectedSeasonHistoryId] = useState<string | null>(null);
  const [leaderboardRows, setLeaderboardRows] = useState<FitnessLeaderboardEntryRecord[]>([]);
  const [muscleLeaderboardRows, setMuscleLeaderboardRows] = useState<FitnessMuscleLeaderboardEntryRecord[]>([]);
  const [leaderboardCursorState, setLeaderboardCursorState] = useState<CursorState>(EMPTY_CURSOR_STATE);
  const [muscleLeaderboardCursorState, setMuscleLeaderboardCursorState] = useState<CursorState>(EMPTY_CURSOR_STATE);
  const [isLoadingMoreLeaderboard, setIsLoadingMoreLeaderboard] = useState(false);

  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (!isFocused) setClaimedMilestone(null);
  }, [isFocused]);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (activeUserIdRef.current !== nextUserId) setClaimedMilestone(null);
    activeUserIdRef.current = nextUserId;
  }, [user?.id]);

  const masteryQuery = useQuery({
    ...fitnessMasteryQueryOptions(mobileApiClient, user?.id),
    enabled: canLoadProgression,
  });
  const muscleDefinitionsQuery = useQuery({
    ...fitnessMemberMuscleDefinitionsQueryOptions(mobileApiClient),
    enabled: canLoadProgression,
  });
  const muscleDefinitionOptions = useMemo(
    () => resolveSeasonHistoryMuscleOptions(muscleDefinitionsQuery.data),
    [muscleDefinitionsQuery.data],
  );
  const muscleDefinitionsReady =
    !muscleDefinitionsQuery.isPending && !muscleDefinitionsQuery.error && muscleDefinitionOptions.length > 0;
  const leaderboardQuery = useQuery({
    ...fitnessLeaderboardQueryOptions(mobileApiClient, user?.id, {
      limit: LEADERBOARD_PAGE_SIZE,
      page: 1,
    }),
    enabled: canLoadProgression,
  });
  const muscleLeaderboardQuery = useQuery({
    ...fitnessMuscleLeaderboardQueryOptions(mobileApiClient, user?.id, {
      limit: LEADERBOARD_PAGE_SIZE,
      muscleKey: selectedLeaderboardMuscle,
      page: 1,
      scope: muscleLeaderboardScope,
    }),
    enabled:
      canLoadProgression &&
      activeTab === "leaderboard" &&
      leaderboardMode === "muscle" &&
      muscleDefinitionsReady &&
      muscleDefinitionOptions.includes(selectedLeaderboardMuscle),
  });
  const seasonHistoryQuery = useQuery({
    ...fitnessSeasonHistoryQueryOptions(mobileApiClient, user?.id, {
      limit: 10,
    }),
    enabled: canLoadProgression && (activeTab === "leaderboard" || isSeasonHistoryOpen),
  });
  const seasonHistory = useMemo(() => seasonHistoryQuery.data ?? [], [seasonHistoryQuery.data]);
  const seasonHistoryMuscleOptions = muscleDefinitionOptions;
  const selectedSeasonHistoryUuid = useMemo(
    () => resolveSeasonHistoryId(seasonHistory, selectedSeasonHistoryId),
    [seasonHistory, selectedSeasonHistoryId],
  );
  const seasonHistoryMuscleQuery = useQuery({
    ...fitnessMuscleLeaderboardQueryOptions(mobileApiClient, user?.id, {
      limit: 10,
      muscleKey: seasonHistoryMuscleKey,
      scope: "season",
      seasonId: selectedSeasonHistoryUuid ?? undefined,
    }),
    enabled:
      canLoadProgression &&
      isSeasonHistoryOpen &&
      seasonHistoryScope === "muscle" &&
      muscleDefinitionsReady &&
      seasonHistoryMuscleOptions.includes(seasonHistoryMuscleKey) &&
      !!selectedSeasonHistoryUuid,
  });

  useEffect(() => {
    if (muscleDefinitionOptions.length === 0) {
      setSelectedLeaderboardMuscle("");
      setSeasonHistoryMuscleKey("");
      return;
    }
    setSelectedLeaderboardMuscle((current) => retainMuscleSelection(muscleDefinitionOptions, current));
    setSeasonHistoryMuscleKey((current) => retainMuscleSelection(muscleDefinitionOptions, current));
  }, [muscleDefinitionOptions]);
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
    staleTime: 0,
  });
  const { refetch: refetchProgressionProfile } = progressionProfileQuery;
  const { refetch: refetchMilestones } = milestonesQuery;
  const integritySummaryQuery = useQuery({
    ...fitnessIntegritySummaryQueryOptions(mobileApiClient, user?.id),
    enabled: canLoadProgression,
  });
  useEffect(() => {
    if (!canLoadProgression || !user?.id) return;

    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const resumed = previousState !== 'active' && nextState === 'active';
      previousState = nextState;
      if (!resumed) return;
      void Promise.all([
        refetchMilestones(),
        refetchProgressionProfile(),
      ]);
    });

    return () => subscription.remove();
  }, [
    canLoadProgression,
    refetchMilestones,
    refetchProgressionProfile,
    user?.id,
  ]);
  const updateRankingProfileMutation = useMutation(
    updateFitnessRankingProfileMutationOptions(mobileApiClient, queryClient),
  );
  const claimMilestoneMutation = useMutation(claimFitnessMilestoneMutationOptions(mobileApiClient, queryClient));

  const mastery = useMemo(
    () =>
      [...(masteryQuery.data ?? [])]
        .sort((left, right) => right.xpPoints - left.xpPoints)
        .map(deriveMasteryProgression),
    [masteryQuery.data],
  );
  const progressionProfile = progressionProfileQuery.data ?? null;
  const rankingProfile = rankingProfileQuery.data ?? null;
  const seasonStanding = seasonStandingQuery.data ?? null;
  const milestones = milestonesQuery.data ?? EMPTY_MILESTONES;
  const integritySummary = integritySummaryQuery.data ?? null;
  const rankingVisibility = resolveRankingVisibility(rankingProfile, progressionProfile);
  const leaderboard = leaderboardRows;
  const muscleLeaderboard = muscleLeaderboardRows;
  const leaderboardMuscleOptions = muscleDefinitionOptions;
  const topMuscle = mastery[0] ?? null;
  const highestRankEntry = resolveHighestRank(mastery);
  const totalXp = progressionProfile?.totalXp ?? mastery.reduce((sum, entry) => sum + entry.xpPoints, 0);
  const totalVolumeKg = mastery.reduce((sum, entry) => sum + entry.totalVolumeKg, 0);
  const leaderboardEntry =
    rankingVisibility === "private" ? null : (leaderboard.find((entry) => entry.userId === user?.id) ?? null);
  const lifetimeProgression: FitnessExpProgressionRecord =
    progressionProfile?.lifetimeProgression ?? getFitnessExpProgressionState(totalXp);
  const seasonProgression: FitnessExpProgressionRecord =
    progressionProfile?.seasonProgression ?? getFitnessExpProgressionState(seasonStanding?.seasonPoints ?? 0);
  const achievementCards = useMemo(() => buildAchievementCards(milestones), [milestones]);
  const sortedMilestones = useMemo(
    () => [...milestones].filter((milestone) => !milestone.isHidden || milestone.status !== "in_progress").sort(sortMilestones),
    [milestones],
  );
  const filteredMilestones = useMemo(() => {
    const search = milestoneSearch.trim().toLowerCase();
    return sortedMilestones.filter((milestone) => {
      const matchesSearch =
        !search ||
        [milestone.title, milestone.description, milestone.category]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(search));
      const achieved = milestone.status === "claimed" || milestone.status === "unlocked";
      const matchesFilter = milestoneFilter === "all" || (milestoneFilter === "achieved" ? achieved : !achieved);
      return matchesSearch && matchesFilter;
    });
  }, [milestoneFilter, milestoneSearch, sortedMilestones]);
  const milestonePageItems = filteredMilestones.slice(0, milestoneVisibleCount);
  const milestoneHasMore = milestonePageItems.length < filteredMilestones.length;
  const activeMilestones = useMemo(
    () =>
      [...milestones]
        .filter((milestone) => !milestone.isHidden && milestone.status === "in_progress")
        .sort((left, right) => right.progressPercent - left.progressPercent)
        .slice(0, 3),
    [milestones],
  );
  const recentUnlocks = useMemo(
    () =>
      [...milestones]
        .filter((milestone) => !milestone.isHidden && milestone.status !== "in_progress")
        .sort((left, right) => {
          const leftTime = left.unlockedAt ? new Date(left.unlockedAt).getTime() : 0;
          const rightTime = right.unlockedAt ? new Date(right.unlockedAt).getTime() : 0;
          return rightTime - leftTime;
        })
        .slice(0, 3),
    [milestones],
  );
  const filteredMuscles = useMemo(() => {
    const search = muscleSearch.trim().toLowerCase();
    return mastery.filter((entry) => {
      const matchesSearch = !search || entry.muscleGroup.toLowerCase().includes(search);
      const matchesRank = muscleRankFilter === "all" || entry.rank === muscleRankFilter;
      return matchesSearch && matchesRank;
    });
  }, [mastery, muscleRankFilter, muscleSearch]);
  const normalizedLeaderboardSearch = leaderboardSearch.trim().toLowerCase();
  const visibleLeaderboard = useMemo(
    () =>
      rankingVisibility === "private"
        ? []
        : leaderboard.filter((entry) =>
            !normalizedLeaderboardSearch ? true : entry.displayName.toLowerCase().includes(normalizedLeaderboardSearch),
          ),
    [leaderboard, normalizedLeaderboardSearch, rankingVisibility],
  );
  const visibleMuscleLeaderboard = useMemo(
    () =>
      rankingVisibility === "private"
        ? []
        : muscleLeaderboard.filter((entry) =>
            !normalizedLeaderboardSearch ? true : entry.displayName.toLowerCase().includes(normalizedLeaderboardSearch),
          ),
    [muscleLeaderboard, normalizedLeaderboardSearch, rankingVisibility],
  );
  const rankingVisibilityOptions = RANKING_VISIBILITY_OPTIONS.map((option) => ({
    ...option,
    isSelected: option.value === rankingVisibility,
  }));
  const seasonRankLabel = resolveSeasonRankLabel(seasonStanding, rankingVisibility);
  const integrityNotice = resolveIntegrityNotice(integritySummary, progressionProfile);

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
  const totalXpGoal = lifetimeProgression.nextLevelExp ?? totalXp;
  const totalXpProgress = lifetimeProgression.progressPercent / 100;

  const baseQueries = [
    masteryQuery,
    muscleDefinitionsQuery,
    leaderboardQuery,
    progressionProfileQuery,
    rankingProfileQuery,
    seasonStandingQuery,
    milestonesQuery,
    integritySummaryQuery,
  ];
  const activeQueries = [
    ...baseQueries,
    ...(activeTab === "leaderboard" && leaderboardMode === "muscle" ? [muscleLeaderboardQuery] : []),
  ];
  const isLoading = hasMemberCardAccess && activeQueries.some((query) => query.status === "pending");
  const isError = activeQueries.some((query) => query.isError);
  const errorMessage =
    (muscleDefinitionsQuery.error as Error | null)?.message ??
    (masteryQuery.error as Error | null)?.message ??
    (leaderboardQuery.error as Error | null)?.message ??
    (progressionProfileQuery.error as Error | null)?.message ??
    (rankingProfileQuery.error as Error | null)?.message ??
    (seasonStandingQuery.error as Error | null)?.message ??
    (milestonesQuery.error as Error | null)?.message ??
    (integritySummaryQuery.error as Error | null)?.message ??
    (muscleLeaderboardQuery.error as Error | null)?.message ??
    "Unable to load Muscle Mastery right now.";

  useEffect(() => {
    setMilestoneVisibleCount(MILESTONE_LAZY_BATCH_SIZE);
  }, [milestoneFilter, milestoneSearch]);

  useEffect(() => {
    const firstPage = leaderboardQuery.data;
    if (!firstPage) return;
    setLeaderboardRows(firstPage.data);
    setLeaderboardCursorState(buildCursorState(firstPage.meta, 1, LEADERBOARD_PAGE_SIZE));
  }, [leaderboardQuery.data]);

  useEffect(() => {
    const firstPage = muscleLeaderboardQuery.data;
    if (!firstPage) return;
    setMuscleLeaderboardRows(firstPage.data);
    setMuscleLeaderboardCursorState(buildCursorState(firstPage.meta, 1, LEADERBOARD_PAGE_SIZE));
  }, [muscleLeaderboardQuery.data]);

  useEffect(() => {
    if (!selectedSeasonHistoryId && seasonHistory[0]) {
      setSelectedSeasonHistoryId(seasonHistory[0].seasonId);
      return;
    }
    if (selectedSeasonHistoryId && seasonHistory.length > 0 && !selectedSeasonHistoryUuid) {
      setSelectedSeasonHistoryId(seasonHistory[0]?.seasonId ?? null);
    }
  }, [seasonHistory, selectedSeasonHistoryId, selectedSeasonHistoryUuid]);

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

    const milestone = sortedMilestones.find((entry) => entry.milestoneDefinitionId === nextUnlock);
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
      const claimingUserId = user.id;
      await milestoneClaimGuardRef.current.run(
        milestone.milestoneDefinitionId,
        async () => {
          try {
            await claimMilestoneMutation.mutateAsync({
              milestoneDefinitionId: milestone.milestoneDefinitionId,
              userId: claimingUserId,
            });
            if (
              isFocusedRef.current &&
              activeUserIdRef.current === claimingUserId
            ) {
              setCelebratedMilestoneId(milestone.milestoneDefinitionId);
              setCelebrationKey((current) => current + 1);
              setClaimedMilestone({
                id: milestone.milestoneDefinitionId,
                title: milestone.title,
              });
            }
          } catch (error) {
            showMessage(
              error instanceof Error
                ? error.message
                : "Unable to claim milestone right now.",
            );
          }
        },
      );
    },
    [claimMilestoneMutation, showMessage, user?.id],
  );

  const handleCloseClaimedMilestone = useCallback(() => {
    setClaimedMilestone(null);
  }, []);

  const handleLoadMoreLeaderboard = useCallback(async () => {
    if (!user?.id || isLoadingMoreLeaderboard) return;

    const isMuscleMode = leaderboardMode === "muscle";
    const cursorState = isMuscleMode ? muscleLeaderboardCursorState : leaderboardCursorState;
    if (!cursorState.hasMore) return;

    setIsLoadingMoreLeaderboard(true);
    try {
      const cursorParams = {
        ...(cursorState.nextCursor ? { cursor: cursorState.nextCursor } : { page: cursorState.page + 1 }),
        ...(cursorState.snapshot ? { snapshot: cursorState.snapshot } : {}),
      };

      if (isMuscleMode) {
        const response = await queryClient.fetchQuery(
          fitnessMuscleLeaderboardQueryOptions(mobileApiClient, user.id, {
            ...cursorParams,
            limit: LEADERBOARD_PAGE_SIZE,
            muscleKey: selectedLeaderboardMuscle,
            scope: muscleLeaderboardScope,
          }),
        );
        setMuscleLeaderboardRows((current) => appendLeaderboardRows(current, response.data));
        setMuscleLeaderboardCursorState(buildCursorState(response.meta, cursorState.page + 1, LEADERBOARD_PAGE_SIZE));
      } else {
        const response = await queryClient.fetchQuery(
          fitnessLeaderboardQueryOptions(mobileApiClient, user.id, {
            ...cursorParams,
            limit: LEADERBOARD_PAGE_SIZE,
          }),
        );
        setLeaderboardRows((current) => appendLeaderboardRows(current, response.data));
        setLeaderboardCursorState(buildCursorState(response.meta, cursorState.page + 1, LEADERBOARD_PAGE_SIZE));
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to load more leaderboard entries.");
    } finally {
      setIsLoadingMoreLeaderboard(false);
    }
  }, [
    isLoadingMoreLeaderboard,
    leaderboardCursorState,
    leaderboardMode,
    muscleLeaderboardCursorState,
    muscleLeaderboardScope,
    queryClient,
    selectedLeaderboardMuscle,
    showMessage,
    user?.id,
  ]);

  const handleOpenSeasonHistory = useCallback(() => {
    setSeasonHistoryOpen(true);
  }, []);

  const handleCloseSeasonHistory = useCallback(() => {
    setSeasonHistoryOpen(false);
  }, []);

  return {
    achievementCards,
    activeMilestones,
    activeTab,
    claimedMilestone,
    celebrationKey,
    celebratedMilestoneId,
    errorMessage,
    filteredMuscleCount: filteredMuscles.length,
    filteredMilestoneCount: filteredMilestones.length,
    hasMemberCardAccess,
    highestRankEntry,
    integrityNotice,
    isEmpty: !isLoading && !isError && mastery.length === 0 && milestones.length === 0,
    isError,
    isLoading,
    isMemberLocked,
    isClaimingMilestone: claimMilestoneMutation.isPending,
    isLoadingMoreLeaderboard,
    isRefreshing: hasMemberCardAccess && activeQueries.some((query) => query.isFetching),
    isUpdatingRankingVisibility: updateRankingProfileMutation.isPending,
    leaderboard: visibleLeaderboard,
    leaderboardHasMore: leaderboardCursorState.hasMore,
    leaderboardMode,
    leaderboardSearch,
    leaderboardMuscleOptions,
    leaderboardEntry,
    leaderboardMeta: {
      limit: leaderboardCursorState.limit,
      next_cursor: leaderboardCursorState.nextCursor,
      page: leaderboardCursorState.page,
      snapshot: leaderboardCursorState.snapshot,
      total: leaderboardCursorState.total,
      total_pages: leaderboardCursorState.totalPages,
    },
    muscleLeaderboard: visibleMuscleLeaderboard,
    muscleLeaderboardHasMore: muscleLeaderboardCursorState.hasMore,
    muscleLeaderboardMeta: {
      limit: muscleLeaderboardCursorState.limit,
      next_cursor: muscleLeaderboardCursorState.nextCursor,
      page: muscleLeaderboardCursorState.page,
      snapshot: muscleLeaderboardCursorState.snapshot,
      total: muscleLeaderboardCursorState.total,
      total_pages: muscleLeaderboardCursorState.totalPages,
    },
    memberLockMessage: resolveLockMessage(membershipCardStatus, hasMemberCardAccess),
    memberLockStatusLabel: resolveLockStatusLabel(membershipCardStatus, hasMemberCardAccess),
    milestonePageItems,
    milestoneHasMore,
    milestoneFilter,
    milestoneSearch,
    milestones,
    mastery,
    muscleRankFilter,
    muscleSearch,
    onOpenChatbot: handleOpenChatbot,
    onOpenNutrition: handleOpenNutrition,
    onOpenProfile: handleOpenProfile,
    onOpenWorkout: handleOpenWorkout,
    onClaimMilestone: handleClaimMilestone,
    onCloseClaimedMilestone: handleCloseClaimedMilestone,
    onCloseSeasonHistory: handleCloseSeasonHistory,
    onLoadMoreLeaderboard: handleLoadMoreLeaderboard,
    onLoadMoreMilestones: () =>
      setMilestoneVisibleCount((current) => Math.min(filteredMilestones.length, current + MILESTONE_LAZY_BATCH_SIZE)),
    onOpenSeasonHistory: handleOpenSeasonHistory,
    onRefresh: async () => {
      await Promise.all(activeQueries.map((query) => query.refetch()));
    },
    onRefreshSeasonHistory: async () => {
      await Promise.all([seasonHistoryQuery.refetch(), seasonHistoryMuscleQuery.refetch()]);
    },
    onSelectRankingVisibility: async (visibility: FitnessRankingVisibility) => {
      if (visibility === rankingVisibility || !user?.id) return;
      await updateRankingProfileMutation.mutateAsync({
        input: { visibility },
        userId: user.id,
      });
    },
    privacyError: (updateRankingProfileMutation.error as Error | null)?.message ?? null,
    progressionProfile,
    rankingProfile,
    rankingVisibility,
    rankingVisibilityOptions,
    recentUnlocks,
    seasonCaption: formatDateRange(seasonStanding?.season ?? progressionProfile?.activeSeason ?? null),
    seasonRankLabel,
    seasonHistory,
    seasonHistoryMuscleKey,
    seasonHistoryMuscleLeaderboard: resolveSeasonHistoryMuscleRows(
      seasonHistoryMuscleQuery.data?.data,
      seasonHistoryMuscleQuery.isFetching,
    ),
    seasonHistoryMuscleError: (seasonHistoryMuscleQuery.error as Error | null)?.message ?? null,
    seasonHistoryMuscleLoading: seasonHistoryMuscleQuery.isPending || seasonHistoryMuscleQuery.isFetching,
    seasonHistoryError: (seasonHistoryQuery.error as Error | null)?.message ?? null,
    seasonHistoryLoading: seasonHistoryQuery.isPending,
    muscleDefinitionsError: (muscleDefinitionsQuery.error as Error | null)?.message ?? null,
    muscleDefinitionsLoading: muscleDefinitionsQuery.isPending,
    seasonHistoryMuscleOptions,
    seasonHistoryOpen: isSeasonHistoryOpen,
    seasonHistoryScope,
    seasonStanding,
    summaryCards,
    setActiveTab,
    setMilestoneFilter,
    setMilestoneSearch,
    setLeaderboardSearch,
    setLeaderboardMode,
    setMuscleLeaderboardScope,
    setSelectedLeaderboardMuscle,
    setSeasonHistoryMuscleKey,
    setSeasonHistoryOpen,
    setSeasonHistoryScope,
    setSelectedSeasonHistoryId,
    setMuscleRankFilter,
    setMuscleSearch,
    selectedSeasonHistoryId: selectedSeasonHistoryUuid,
    sortedMilestones,
    statusMessage,
    selectedLeaderboardMuscle,
    muscleLeaderboardScope,
    topMuscle,
    totalXp,
    totalXpGoal,
    totalXpProgress,
    totalVolumeKg,
    lifetimeProgression,
    seasonProgression,
  };
}
