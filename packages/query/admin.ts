import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  ManualAttendanceCheckInInput,
  ReviewDeletionPayload,
  ScanAttendanceQrInput,
  RestoreUserResult,
  UpdateMemberPayload,
  UpdateMembershipCardPayload,
  UpgradeToCoachPayload
} from "@fittrack/api-client";
import {
  invalidateAdminBookingsQuery,
  invalidateAdminDeletionRequestsQuery,
  invalidateAdminMembersQuery,
  invalidateStaffBookingQueries
} from "./cache";
import { queryKeys } from "./query-keys";

type CreateUserPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "admin" | "staff" | "member";
  phone_no?: string;
};

export function adminMembersQueryOptions(client: Pick<ApiClient, "admin">) {
  return queryOptions({
    queryKey: queryKeys.adminMembers(),
    queryFn: () => client.admin.listMembers()
  });
}

export function adminDeletionRequestsQueryOptions<T>(client: Pick<ApiClient, "admin">) {
  return queryOptions({
    queryKey: queryKeys.adminDeletionRequests(),
    queryFn: () => client.admin.listDeletionRequests<T>()
  });
}

export function adminBookingsQueryOptions<T>(client: Pick<ApiClient, "admin">) {
  return queryOptions({
    queryKey: queryKeys.adminBookings(),
    queryFn: () => client.admin.listBookings<T>()
  });
}

export function confirmAdminBookingMutationOptions(client: Pick<ApiClient, "admin">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (bookingId: string) => client.admin.confirmBooking(bookingId),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminBookingsQuery(queryClient),
        invalidateStaffBookingQueries(queryClient)
      ]);
    }
  });
}

export function rejectAdminBookingMutationOptions(client: Pick<ApiClient, "admin">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      client.admin.rejectBooking(bookingId, reason),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminBookingsQuery(queryClient),
        invalidateStaffBookingQueries(queryClient)
      ]);
    }
  });
}

export function createUserMutationOptions(client: Pick<ApiClient, "admin">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (payload: CreateUserPayload) => client.admin.createUser(payload),
    onSuccess: async () => {
      await invalidateAdminMembersQuery(queryClient);
    }
  });
}

export function updateAdminMemberMutationOptions(client: Pick<ApiClient, "admin">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMemberPayload }) => client.admin.updateMember(id, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffUsers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffCoaches() })
      ]);
    }
  });
}

export function updateAdminMembershipCardMutationOptions(client: Pick<ApiClient, "admin">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMembershipCardPayload }) =>
      client.admin.updateMembershipCard(id, payload),
    onSuccess: async () => {
      await invalidateAdminMembersQuery(queryClient);
    }
  });
}

export function scanAttendanceQrMutationOptions(client: Pick<ApiClient, "admin">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (payload: ScanAttendanceQrInput) => client.admin.scanAttendanceQr(payload),
    onSuccess: async () => {
      await invalidateAdminMembersQuery(queryClient);
    }
  });
}

export function manualAttendanceCheckInMutationOptions(client: Pick<ApiClient, "admin">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (payload: ManualAttendanceCheckInInput) => client.admin.manualAttendanceCheckIn(payload),
    onSuccess: async () => {
      await invalidateAdminMembersQuery(queryClient);
    }
  });
}

export function deleteUserMutationOptions(client: Pick<ApiClient, "admin">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (id: string) => client.admin.deleteUser(id),
    onSuccess: async (_data, id) => {
      queryClient.setQueryData(queryKeys.adminMembers(), (prev: { id: string }[] | undefined) =>
        prev ? prev.filter((member) => member.id !== id) : []
      );
    }
  });
}

export function restoreUserMutationOptions(client: Pick<ApiClient, "admin">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (id: string) => client.admin.restoreUser(id),
    onSuccess: async (_data: RestoreUserResult) => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateAdminDeletionRequestsQuery(queryClient),
      ]);
    }
  });
}

export function approveDeletionRequestMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
  payload?: ReviewDeletionPayload
) {
  return mutationOptions({
    mutationFn: (requestId: string) => client.admin.approveDeletionRequest(requestId, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateAdminDeletionRequestsQuery(queryClient),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffUsers() })
      ]);
    }
  });
}

export function rejectDeletionRequestMutationOptions(
  client: Pick<ApiClient, "admin">,
  queryClient: QueryClient,
  payload?: ReviewDeletionPayload
) {
  return mutationOptions({
    mutationFn: (requestId: string) => client.admin.rejectDeletionRequest(requestId, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        invalidateAdminDeletionRequestsQuery(queryClient),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffUsers() })
      ]);
    }
  });
}

export function upgradeToCoachMutationOptions(client: Pick<ApiClient, "admin">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (payload: UpgradeToCoachPayload) => client.admin.upgradeToCoach(payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminMembersQuery(queryClient),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffUsers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffCoaches() })
      ]);
    }
  });
}
