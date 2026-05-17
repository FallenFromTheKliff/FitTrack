import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  AdminGamificationCreatorStateInput,
  AdminGamificationIntegrityResolutionInput,
  AdminManualExpGrantInput,
  AdminGamificationRankingOverrideInput,
  AdminGamificationSeasonStandingListParams,
  AdminGamificationSeasonStatusInput,
  ApiClient,
  ManualAttendanceCheckInInput,
  ReviewDeletionPayload,
  ScanAttendanceQrInput,
  RestoreUserResult,
  UpdateMemberPayload,
  UpdateMembershipCardPayload,
  UpgradeToCoachPayload,
} from "@fittrack/api-client";
import type { MemberDirectoryFilters } from "@fittrack/types";
import {
  invalidateAdminBookingsQuery,
  invalidateAdminDeletionRequestsQuery,
  invalidateAdminGamificationOverviewQuery,
  invalidateAdminMembersQuery,
  invalidateAnalyticsQueries,
  invalidateNotificationQueries,
  invalidateStaffBookingQueries,
} from "./cache";
import { queryKeys } from "./query-keys";

type CreateUserPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "admin" | "staff" | "member" | "coach";
  phone_no?: string;
};

export function adminMembersQueryOptions(
  client: Pick<ApiClient, "admin">,
  filters?: MemberDirectoryFilters,
) {
  return queryOptions({
    queryKey: queryKeys.adminMembers(filters),
    queryFn: () => client.admin.listMembers(filters),
  });
}

export function adminDeletionRequestsQueryOptions<T>(
  client: Pick<ApiClient, "admin">,
) {
  return queryOptions({
    queryKey: queryKeys.adminDeletionRequests(),
    queryFn: () => client.admin.listDeletionRequests<T>(),
  });
}

export function adminBookingsQueryOptions<T>(client: Pick<ApiClient, "admin">) {
  return queryOptions({
    queryKey: queryKeys.adminBookings(),
    queryFn: () => client.admin.listBookings<T>(),
  });
}

export function adminGamificationOverviewQueryOptions(
  client: Pick<ApiClient, "admin">,
) {
  return queryOptions({
    queryKey: queryKeys.adminGamificationOverview(),
    queryFn: () => client.admin.getGamificationOverview(),
  });
}

export function adminGamificationSeasonsQueryOptions(
  client: Pick<ApiClient, "admin">,
) {
  return queryOptions({
    queryKey: queryKeys.adminGamificationSeasons(),
    queryFn: () => client.admin.listGamificationSeasons(),
  });
}

export function adminGamificationSeasonStandingsQueryOptions(
  client: Pick<ApiClient, "admin">,
  params?: AdminGamificationSeasonStandingListParams,
) {
  return queryOptions({
    queryKey: queryKeys.adminGamificationSeasonStandings(params),
    queryFn: () => client.admin.listGamificationSeasonStandings(params),
  });
}

export function updateAdminGamificationSeasonStatusMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      seasonId,
      payload,
    }: {
      payload: AdminGamificationSeasonStatusInput;
      seasonId: string;
    }) => client.admin.updateGamificationSeasonStatus(seasonId, payload),
    onSuccess: async () => {
      await invalidateAdminGamificationOverviewQuery(queryClient);
    },
  });
}

export function updateAdminGamificationCreatorStateMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      payload,
      userId,
    }: {
      payload: AdminGamificationCreatorStateInput;
      userId: string;
    }) => client.admin.updateGamificationCreatorState(userId, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminGamificationOverviewQuery(queryClient),
        queryClient.invalidateQueries({
          queryKey: queryKeys.fitnessExerciseReviewSubmissions(),
        }),
      ]);
    },
  });
}

export function updateAdminGamificationRankingOverrideMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      payload,
      userId,
    }: {
      payload: AdminGamificationRankingOverrideInput;
      userId: string;
    }) => client.admin.updateGamificationRankingOverride(userId, payload),
    onSuccess: async () => {
      await invalidateAdminGamificationOverviewQuery(queryClient);
    },
  });
}

export function resolveAdminGamificationIntegrityCaseMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      caseId,
      payload,
    }: {
      caseId: string;
      payload: AdminGamificationIntegrityResolutionInput;
    }) => client.admin.resolveGamificationIntegrityCase(caseId, payload),
    onSuccess: async () => {
      await invalidateAdminGamificationOverviewQuery(queryClient);
    },
  });
}

export function createAdminManualExpGrantMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: AdminManualExpGrantInput }) =>
      client.admin.createManualExpGrant(payload),
    onSuccess: async () => {
      await invalidateAdminGamificationOverviewQuery(queryClient);
    },
  });
}

export function confirmAdminBookingMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (bookingId: string) => client.admin.confirmBooking(bookingId),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminBookingsQuery(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateStaffBookingQueries(queryClient),
      ]);
    },
  });
}

export function rejectAdminBookingMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason?: string;
    }) => client.admin.rejectBooking(bookingId, reason),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminBookingsQuery(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateStaffBookingQueries(queryClient),
      ]);
    },
  });
}

export function completeAdminBookingMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (bookingId: string) => client.admin.completeBooking(bookingId),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminBookingsQuery(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateStaffBookingQueries(queryClient),
      ]);
    },
  });
}

export function cancelAdminBookingMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason?: string;
    }) => client.admin.cancelBooking(bookingId, reason),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminBookingsQuery(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateStaffBookingQueries(queryClient),
      ]);
    },
  });
}

export function noShowAdminBookingMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (bookingId: string) => client.admin.noShowBooking(bookingId),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminBookingsQuery(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateStaffBookingQueries(queryClient),
      ]);
    },
  });
}

export function createUserMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (payload: CreateUserPayload) =>
      client.admin.createUser(payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateNotificationQueries(queryClient),
      ]);
    },
  });
}

export function updateAdminMemberMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateMemberPayload;
    }) => client.admin.updateMember(id, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateNotificationQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffUsers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffCoaches() }),
      ]);
    },
  });
}

export function updateAdminMembershipCardMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateMembershipCardPayload;
    }) => client.admin.updateMembershipCard(id, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateNotificationQueries(queryClient),
      ]);
    },
  });
}

export function verifyNonMemberMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (id: string) => client.admin.verifyNonMember(id),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateNotificationQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffUsers() }),
      ]);
    },
  });
}

export function scanAttendanceQrMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (payload: ScanAttendanceQrInput) =>
      client.admin.scanAttendanceQr(payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateNotificationQueries(queryClient),
      ]);
    },
  });
}

export function manualAttendanceCheckInMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (payload: ManualAttendanceCheckInInput) =>
      client.admin.manualAttendanceCheckIn(payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateNotificationQueries(queryClient),
      ]);
    },
  });
}

export function deleteUserMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (id: string) => client.admin.deleteUser(id),
    onSuccess: async (_data, id) => {
      queryClient.setQueryData(
        queryKeys.adminMembers(),
        (prev: { id: string }[] | undefined) =>
          prev ? prev.filter((member) => member.id !== id) : [],
      );
      await invalidateNotificationQueries(queryClient);
    },
  });
}

export function restoreUserMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (id: string) => client.admin.restoreUser(id),
    onSuccess: async (_data: RestoreUserResult) => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateAdminDeletionRequestsQuery(queryClient),
        invalidateNotificationQueries(queryClient),
      ]);
    },
  });
}

export function approveDeletionRequestMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
  payload?: ReviewDeletionPayload,
) {
  return mutationOptions({
    mutationFn: (requestId: string) =>
      client.admin.approveDeletionRequest(requestId, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateAdminDeletionRequestsQuery(queryClient),
        invalidateNotificationQueries(queryClient),
      ]);
    },
  });
}

export function rejectDeletionRequestMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
  payload?: ReviewDeletionPayload,
) {
  return mutationOptions({
    mutationFn: (requestId: string) =>
      client.admin.rejectDeletionRequest(requestId, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateAdminDeletionRequestsQuery(queryClient),
        invalidateNotificationQueries(queryClient),
      ]);
    },
  });
}

export function upgradeToCoachMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (payload: UpgradeToCoachPayload) =>
      client.admin.upgradeToCoach(payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateNotificationQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffUsers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffCoaches() }),
      ]);
    },
  });
}
