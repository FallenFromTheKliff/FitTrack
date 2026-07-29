"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppointmentRecord, VenueBookingRecord } from "@fittrack/api-client";
import {
  appointmentsQueryOptions,
  bookingsQueryOptions,
  cancelAppointmentMutationOptions,
  cancelBookingMutationOptions,
  activateFitnessPlanMutationOptions,
  createFitnessPlanMutationOptions,
  createCustomFitnessExerciseMutationOptions,
  deleteFitnessPlanMutationOptions,
  fitnessExercisesQueryOptions,
  fitnessPlanDetailQueryOptions,
  fitnessSessionDetailQueryOptions,
  logWorkoutSetMutationOptions,
  createAppointmentMutationOptions,
  createBookingMutationOptions,
  claimFitnessMilestoneMutationOptions,
  completeWorkoutSessionMutationOptions,
  fitnessLeaderboardQueryOptions,
  fitnessMasteryQueryOptions,
  fitnessMilestonesQueryOptions,
  fitnessPlansQueryOptions,
  fitnessProgressionProfileQueryOptions,
  fitnessRankingProfileQueryOptions,
  fitnessSeasonStandingQueryOptions,
  fitnessSessionsQueryOptions,
  gymLayoutFloorPlanMediaQueryOptions,
  membershipCurrentSubscriptionQueryOptions,
  nutritionActiveTdeeQueryOptions,
  nutritionDailySummaryQueryOptions,
  nutritionHistoryQueryOptions,
  nutritionLogsQueryOptions,
  payAppointmentDownpaymentMutationOptions,
  startWorkoutSessionMutationOptions,
  submitCoachReviewMutationOptions,
  venuesQueryOptions,
} from "@fittrack/query";
import type {
  ActiveNutritionProfileRecord,
  DailyNutritionSummaryRecord,
  NutritionLogRecord,
  NutritionTdeeRecord,
} from "@fittrack/types";

import { useAuth } from "@/contexts/AuthContext";
import { webApiClient } from "@/lib/api-client";
import { getMemberLockMessage, getMembershipStatusLabel } from "@/components/member-only/memberOnlyUtils";

export function useMemberOnlyAccess(featureName = "This feature") {
  const { user } = useAuth();
  const membershipCardStatus = user?.membershipCard?.status ?? "none";
  const hasMemberCardAccess = user?.membershipAccess === "member";

  return {
    hasMemberCardAccess,
    isFrozen: user?.status === "frozen",
    isLocked: !!user && !hasMemberCardAccess,
    lockMessage: getMemberLockMessage(membershipCardStatus, featureName),
    membershipCardStatus,
    statusLabel: getMembershipStatusLabel(membershipCardStatus, hasMemberCardAccess),
    user,
  };
}

export function useMemberOnlyHomeData({
  hasMemberCardAccess,
  userId,
}: {
  hasMemberCardAccess: boolean;
  todayString: string;
  userId?: string;
}) {
  const venuesQuery = useQuery({ ...venuesQueryOptions(webApiClient, userId), enabled: !!userId });
  const bookingsQuery = useQuery({
    ...bookingsQueryOptions<VenueBookingRecord>(webApiClient, userId),
    enabled: !!userId,
  });
  const leaderboardQuery = useQuery({
    ...fitnessLeaderboardQueryOptions(webApiClient, userId, { limit: 5, page: 1 }),
    enabled: !!userId && hasMemberCardAccess,
  });
  const sessionsQuery = useQuery({
    ...fitnessSessionsQueryOptions(webApiClient, userId, { limit: 50, page: 1 }),
    enabled: !!userId && hasMemberCardAccess,
  });

  return {
    bookingsQuery,
    leaderboardQuery,
    sessionsQuery,
    venuesQuery,
  };
}

export function useMemberOnlyFacilitiesData(userId?: string) {
  return {
    floorPlanMediaQuery: useQuery({
      ...gymLayoutFloorPlanMediaQueryOptions(webApiClient),
      enabled: !!userId,
      staleTime: 120_000,
    }),
    venuesQuery: useQuery({ ...venuesQueryOptions(webApiClient, userId), enabled: !!userId }),
  };
}

export function useMemberOnlyBookingsData(userId?: string) {
  const queryClient = useQueryClient();

  return {
    appointmentsQuery: useQuery({
      ...appointmentsQueryOptions<AppointmentRecord>(webApiClient, userId),
      enabled: !!userId,
      staleTime: 60_000,
    }),
    bookingsQuery: useQuery({
      ...bookingsQueryOptions<VenueBookingRecord>(webApiClient, userId),
      enabled: !!userId,
      staleTime: 60_000,
    }),
    cancelAppointmentMutation: useMutation(cancelAppointmentMutationOptions(webApiClient, queryClient)),
    cancelBookingMutation: useMutation(cancelBookingMutationOptions(webApiClient, queryClient)),
    createAppointmentMutation: useMutation(createAppointmentMutationOptions(webApiClient, queryClient)),
    createBookingMutation: useMutation(createBookingMutationOptions(webApiClient, queryClient)),
    payAppointmentMutation: useMutation(payAppointmentDownpaymentMutationOptions(webApiClient, queryClient)),
    submitCoachReviewMutation: useMutation(submitCoachReviewMutationOptions(webApiClient, queryClient)),
    venuesQuery: useQuery({ ...venuesQueryOptions(webApiClient, userId), enabled: !!userId }),
  };
}

export function useMemberOnlyNutritionData({
  hasMemberCardAccess,
  role,
  todayString,
  userId,
}: {
  hasMemberCardAccess: boolean;
  role?: string;
  todayString: string;
  userId?: string;
}) {
  return {
    activeNutritionQuery: useQuery({
      ...nutritionActiveTdeeQueryOptions<ActiveNutritionProfileRecord | null>(webApiClient, userId),
      enabled: !!userId,
    }),
    dailySummaryQuery: useQuery({
      ...nutritionDailySummaryQueryOptions<DailyNutritionSummaryRecord>(webApiClient, userId, todayString),
      enabled: !!userId,
    }),
    nutritionHistoryQuery: useQuery({
      ...nutritionHistoryQueryOptions<NutritionTdeeRecord>(webApiClient, userId, { page: 1, limit: 4 }),
      enabled: !!userId,
    }),
    nutritionLogsQuery: useQuery({
      ...nutritionLogsQueryOptions<NutritionLogRecord>(webApiClient, userId, {
        startDate: todayString,
        endDate: todayString,
        page: 1,
        limit: 20,
      }),
      enabled: !!userId && hasMemberCardAccess,
    }),
    recentNutritionLogsQuery: useQuery({
      ...nutritionLogsQueryOptions<NutritionLogRecord>(webApiClient, userId, {
        page: 1,
        limit: 24,
      }),
      enabled: !!userId && hasMemberCardAccess,
    }),
    subscriptionQuery: useQuery({
      ...membershipCurrentSubscriptionQueryOptions(webApiClient, userId),
      enabled: !!userId && role === "USER",
      staleTime: 60_000,
    }),
  };
}

export function useMemberOnlyMasteryData({
  hasMemberCardAccess,
  leaderboardPage,
  userId,
}: {
  hasMemberCardAccess: boolean;
  leaderboardPage: number;
  userId?: string;
}) {
  const queryClient = useQueryClient();

  return {
    claimMilestoneMutation: useMutation(claimFitnessMilestoneMutationOptions(webApiClient, queryClient)),
    leaderboardQuery: useQuery({
      ...fitnessLeaderboardQueryOptions(webApiClient, userId, { limit: 8, page: leaderboardPage }),
      enabled: !!userId && hasMemberCardAccess,
    }),
    masteryQuery: useQuery({
      ...fitnessMasteryQueryOptions(webApiClient, userId),
      enabled: !!userId && hasMemberCardAccess,
    }),
    milestonesQuery: useQuery({
      ...fitnessMilestonesQueryOptions(webApiClient, userId, { includeLocked: true }),
      enabled: !!userId && hasMemberCardAccess,
    }),
    progressionProfileQuery: useQuery({
      ...fitnessProgressionProfileQueryOptions(webApiClient, userId),
      enabled: !!userId && hasMemberCardAccess,
    }),
    seasonStandingQuery: useQuery({
      ...fitnessSeasonStandingQueryOptions(webApiClient, userId),
      enabled: !!userId && hasMemberCardAccess,
    }),
  };
}

export function useMemberOnlyWorkoutData({
  hasMemberCardAccess,
  planId,
  sessionId,
  userId,
}: {
  hasMemberCardAccess: boolean;
  planId?: string;
  sessionId?: string;
  userId?: string;
}) {
  const queryClient = useQueryClient();

  return {
    completeMutation: useMutation(completeWorkoutSessionMutationOptions(webApiClient, queryClient)),
    activatePlanMutation: useMutation(activateFitnessPlanMutationOptions(webApiClient, queryClient)),
    createPlanMutation: useMutation(createFitnessPlanMutationOptions(webApiClient, queryClient)),
    createCustomExerciseMutation: useMutation(createCustomFitnessExerciseMutationOptions(webApiClient, queryClient)),
    deletePlanMutation: useMutation(deleteFitnessPlanMutationOptions(webApiClient, queryClient)),
    exercisesQuery: useQuery({
      ...fitnessExercisesQueryOptions(webApiClient, { limit: 100, page: 1 }),
      enabled: !!userId && hasMemberCardAccess,
    }),
    planDetailQuery: useQuery({
      ...fitnessPlanDetailQueryOptions(webApiClient, planId),
      enabled: !!planId && !!userId && hasMemberCardAccess,
    }),
    sessionDetailQuery: useQuery({
      ...fitnessSessionDetailQueryOptions(webApiClient, sessionId),
      enabled: !!sessionId && !!userId && hasMemberCardAccess,
    }),
    logSetMutation: useMutation(logWorkoutSetMutationOptions(webApiClient, queryClient)),
    plansQuery: useQuery({
      ...fitnessPlansQueryOptions(webApiClient, userId, { limit: 20, page: 1 }),
      enabled: !!userId && hasMemberCardAccess,
    }),
    sessionsQuery: useQuery({
      ...fitnessSessionsQueryOptions(webApiClient, userId, { limit: 20, page: 1 }),
      enabled: !!userId && hasMemberCardAccess,
    }),
    startMutation: useMutation(startWorkoutSessionMutationOptions(webApiClient, queryClient)),
  };
}

export function useMemberOnlyProfileData({
  hasMemberCardAccess,
  userId,
}: {
  hasMemberCardAccess: boolean;
  userId?: string;
}) {
  return {
    leaderboardQuery: useQuery({
      ...fitnessLeaderboardQueryOptions(webApiClient, userId, { limit: 5, page: 1 }),
      enabled: !!userId && hasMemberCardAccess,
      staleTime: 60_000,
    }),
    masteryQuery: useQuery({
      ...fitnessMasteryQueryOptions(webApiClient, userId),
      enabled: !!userId && hasMemberCardAccess,
      staleTime: 60_000,
    }),
    rankingProfileQuery: useQuery({
      ...fitnessRankingProfileQueryOptions(webApiClient, userId),
      enabled: !!userId && hasMemberCardAccess,
      staleTime: 60_000,
    }),
    subscriptionQuery: useQuery({
      ...membershipCurrentSubscriptionQueryOptions(webApiClient, userId),
      enabled: !!userId,
      staleTime: 60_000,
    }),
  };
}
