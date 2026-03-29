import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient, CreateBookingPayload } from "@fittrack/api-client";
import { invalidateBookingQueries, invalidateVenueQueries } from "./cache";
import { queryKeys } from "./query-keys";

export function bookingsQueryOptions<T>(client: Pick<ApiClient, "bookings">, userId?: string) {
  return queryOptions({
    queryKey: queryKeys.bookings(userId),
    queryFn: () => client.bookings.listMine<T>()
  });
}

export function createBookingMutationOptions(client: Pick<ApiClient, "bookings">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: CreateBookingPayload; userId?: string; venueId?: string | number; date?: string }) =>
      client.bookings.create(payload),
    onSuccess: async (_data, variables) => {
      const tasks = [
        invalidateBookingQueries(queryClient, variables.userId),
        invalidateVenueQueries(queryClient, variables.userId)
      ];
      if (variables.venueId != null && variables.date) {
        tasks.push(queryClient.invalidateQueries({ queryKey: queryKeys.venueAvailability(variables.venueId, variables.date) }));
      }
      await Promise.all(tasks);
    }
  });
}

export function cancelBookingMutationOptions(client: Pick<ApiClient, "bookings">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ bookingId, cancelReason }: { bookingId: string; cancelReason: string; userId?: string }) =>
      client.bookings.cancel(bookingId, cancelReason),
    onSuccess: async (_data, variables) => {
      await invalidateBookingQueries(queryClient, variables.userId);
    }
  });
}
