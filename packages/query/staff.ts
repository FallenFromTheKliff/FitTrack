import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@fittrack/api-client";
import { invalidateStaffBookingQueries } from "./cache";
import { queryKeys } from "./query-keys";

export function staffDashboardStatsQueryOptions<T>(client: Pick<ApiClient, "staff">) {
  return queryOptions({
    queryKey: queryKeys.staffDashboardStats(),
    queryFn: () => client.staff.getDashboardStats<T>()
  });
}

export function staffUsersQueryOptions(client: Pick<ApiClient, "staff">) {
  return queryOptions({
    queryKey: queryKeys.staffUsers(),
    queryFn: () => client.staff.listUsers()
  });
}

export function staffCoachesQueryOptions(client: Pick<ApiClient, "staff">) {
  return queryOptions({
    queryKey: queryKeys.staffCoaches(),
    queryFn: () => client.staff.listCoaches()
  });
}

export function staffBookingsQueryOptions<T>(client: Pick<ApiClient, "staff">, scope?: "all" | "pending") {
  return queryOptions({
    queryKey: queryKeys.staffBookings(scope),
    queryFn: () => client.staff.listBookings<T>()
  });
}

export function confirmStaffBookingMutationOptions(client: Pick<ApiClient, "staff">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (bookingId: string) => client.staff.confirmBooking(bookingId),
    onSuccess: async () => {
      await invalidateStaffBookingQueries(queryClient);
    }
  });
}

export function rejectStaffBookingMutationOptions(client: Pick<ApiClient, "staff">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      client.staff.rejectBooking(bookingId, reason),
    onSuccess: async () => {
      await invalidateStaffBookingQueries(queryClient);
    }
  });
}
