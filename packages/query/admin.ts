import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient, ReviewDeletionPayload, UpgradeToCoachPayload } from "@fittrack/api-client";
import {
  invalidateAdminBookingsQuery,
  invalidateAdminDeletionRequestsQuery,
  invalidateAdminMembersQuery,
  invalidateStaffBookingQueries
} from "./cache";
import { queryKeys } from "./query-keys";

type CreateStaffPayload = {
  email: string;
  password: string;
  phone_no?: string;
  firstName?: string;
  lastName?: string;
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

export function createStaffMutationOptions(client: Pick<ApiClient, "admin">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (payload: CreateStaffPayload) => client.admin.createStaff(payload),
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
        invalidateAdminDeletionRequestsQuery(queryClient)
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
        invalidateAdminDeletionRequestsQuery(queryClient)
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
