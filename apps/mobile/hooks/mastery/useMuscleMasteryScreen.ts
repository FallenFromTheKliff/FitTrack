import { useMemo } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  fitnessLeaderboardQueryOptions,
  fitnessMasteryQueryOptions
} from "@fittrack/query";
import type {
  FitnessLeaderboardEntryRecord,
  FitnessMasteryRank,
  MuscleMasteryRecord
} from "@fittrack/types";

import { useAuth } from "@/contexts/AuthContext";
import { mobileApiClient } from "@/lib/api-client";

type UseMuscleMasteryScreenOptions = {
  isFocused?: boolean;
};

type AchievementCard = {
  description: string;
  id: string;
  isUnlocked: boolean;
  label: string;
};

const RANK_PRIORITY: Record<FitnessMasteryRank, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  adamantite: 5
};

function formatCompactNumber(value: number) {
  return value.toLocaleString("en-US");
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

function buildAchievements(
  mastery: MuscleMasteryRecord[],
  leaderboard: FitnessLeaderboardEntryRecord[],
  userId?: string
): AchievementCard[] {
  const currentPlacement =
    leaderboard.find((entry) => entry.userId === userId)?.rankPosition ?? null;
  const promotedMuscle = mastery.find((entry) => entry.rank !== "bronze") ?? null;

  return [
    {
      id: "tracked-muscle",
      label: "First Sparks",
      isUnlocked: mastery.length > 0,
      description:
        mastery.length > 0
          ? `You already have ${mastery.length} tracked muscle group${mastery.length === 1 ? "" : "s"} in the mastery board.`
          : "Log your first workout session to light up the mastery board."
    },
    {
      id: "rank-climb",
      label: "Rank Climber",
      isUnlocked: promotedMuscle !== null,
      description:
        promotedMuscle !== null
          ? `${promotedMuscle.muscleGroup} reached ${promotedMuscle.rankDisplay}.`
          : "Push one muscle group past Bronze to unlock this achievement."
    },
    {
      id: "balanced-builder",
      label: "Balanced Builder",
      isUnlocked: mastery.length >= 3,
      description:
        mastery.length >= 3
          ? `You are progressing across ${mastery.length} muscle groups already.`
          : "Track at least 3 muscle groups to unlock this achievement."
    },
    {
      id: "podium-pace",
      label: "Podium Pace",
      isUnlocked: currentPlacement !== null && currentPlacement <= 3,
      description:
        currentPlacement !== null && currentPlacement <= 3
          ? `You are currently #${currentPlacement} on the gym leaderboard.`
          : "Break into the top 3 leaderboard spots to unlock this achievement."
    }
  ];
}

function resolveLockStatusLabel(
  membershipCardStatus: string,
  hasMemberCardAccess: boolean
) {
  if (membershipCardStatus === "pending_verification") return "Pending verification";
  if (membershipCardStatus === "revoked") return "Revoked";
  return hasMemberCardAccess ? "Member" : "Non-member";
}

function resolveLockMessage(
  membershipCardStatus: string,
  hasMemberCardAccess: boolean
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
  isFocused = true
}: UseMuscleMasteryScreenOptions = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const membershipCardStatus = user?.membershipCard?.status ?? "none";
  const hasMemberCardAccess = user?.membershipAccess === "member";
  const isMemberLocked = !!user && !hasMemberCardAccess;

  const masteryQuery = useQuery({
    ...fitnessMasteryQueryOptions(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id && hasMemberCardAccess
  });
  const leaderboardQuery = useQuery({
    ...fitnessLeaderboardQueryOptions(mobileApiClient, user?.id, { limit: 5, page: 1 }),
    enabled: isFocused && !!user?.id && hasMemberCardAccess
  });

  const mastery = useMemo(
    () => [...(masteryQuery.data ?? [])].sort((left, right) => right.xpPoints - left.xpPoints),
    [masteryQuery.data]
  );
  const leaderboard = leaderboardQuery.data?.data ?? [];
  const topMuscle = mastery[0] ?? null;
  const highestRankEntry = resolveHighestRank(mastery);
  const totalXp = mastery.reduce((sum, entry) => sum + entry.xpPoints, 0);
  const totalVolumeKg = mastery.reduce((sum, entry) => sum + entry.totalVolumeKg, 0);
  const leaderboardEntry = leaderboard.find((entry) => entry.userId === user?.id) ?? null;
  const achievements = useMemo(
    () => buildAchievements(mastery, leaderboard, user?.id),
    [leaderboard, mastery, user?.id]
  );

  const summaryCards = [
    { id: "xp", label: "Total EXP", value: formatCompactNumber(totalXp) },
    { id: "muscles", label: "Muscles", value: String(mastery.length) },
    {
      id: "rank",
      label: "Best Rank",
      value: highestRankEntry?.rankDisplay ?? "Unranked"
    },
    {
      id: "standing",
      label: "Gym Rank",
      value: leaderboardEntry ? `#${leaderboardEntry.rankPosition}` : "--"
    }
  ];

  const isLoading =
    hasMemberCardAccess &&
    (masteryQuery.status === "pending" || leaderboardQuery.status === "pending");
  const isError = masteryQuery.isError || leaderboardQuery.isError;
  const errorMessage =
    (masteryQuery.error as Error | null)?.message ??
    (leaderboardQuery.error as Error | null)?.message ??
    "Unable to load Muscle Mastery right now.";

  return {
    achievements,
    errorMessage,
    hasMemberCardAccess,
    isEmpty: !isLoading && !isError && mastery.length === 0,
    isError,
    isLoading,
    isMemberLocked,
    isRefreshing:
      hasMemberCardAccess && (masteryQuery.isFetching || leaderboardQuery.isFetching),
    leaderboard,
    leaderboardEntry,
    memberLockMessage: resolveLockMessage(membershipCardStatus, hasMemberCardAccess),
    memberLockStatusLabel: resolveLockStatusLabel(
      membershipCardStatus,
      hasMemberCardAccess
    ),
    mastery,
    onOpenChatbot: () =>
      router.push({
        pathname: "/(tabs)/chatbot",
        params: { from: "mastery", sessionId: "new" }
      }),
    onOpenNutrition: () => router.push("/(tabs)/nutrition"),
    onOpenProfile: () => router.push("/(tabs)/profile"),
    onOpenWorkout: () => router.push("/(tabs)/workout"),
    onRefresh: async () => {
      await Promise.all([masteryQuery.refetch(), leaderboardQuery.refetch()]);
    },
    summaryCards,
    topMuscle,
    totalVolumeKg
  };
}
