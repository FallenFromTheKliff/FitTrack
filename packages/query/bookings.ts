import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  CreateBookingPayload,
  VenueBookingListParams,
} from "@fittrack/api-client";
import {
  invalidateBookingQueries,
  invalidateVenueQueries,
} from "./cache";
import { queryKeys } from "./query-keys";

export function bookingsQueryOptions<T>(client: Pick<ApiClient, "bookings">, userId?: string) {
  return queryOptions({
    queryKey: queryKeys.bookings(userId),
    queryFn: () => client.bookings.listMine<T>()
  });
}

export function allBookingsQueryOptions<T>(
  client: Pick<ApiClient, "bookings">,
  userId?: string,
) {
  return queryOptions({
    queryKey: [...queryKeys.bookings(userId), "all"] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      client.bookings.listMineAll<T>(signal),
  });
}

export function coachVenueWorkQueryOptions(
  client: Pick<ApiClient, "bookings">,
  userId?: string,
  params?: VenueBookingListParams,
) {
  return queryOptions({
    queryKey: queryKeys.coachVenueWork(userId, params),
    queryFn: () => client.bookings.listCoachWork(params),
    enabled: Boolean(userId),
  });
}

export function completeCoachVenueWorkMutationOptions(
  client: Pick<ApiClient, "bookings">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ bookingId }: { bookingId: string; userId?: string }) =>
      client.bookings.completeCoachWork(bookingId),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.coachVenueWork(variables.userId),
      });
    },
  });
}

export function cancelCoachVenueWorkMutationOptions(
  client: Pick<ApiClient, "bookings">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason?: string;
      userId?: string;
    }) => client.bookings.cancelCoachWork(bookingId, reason),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.coachVenueWork(variables.userId),
      });
    },
  });
}

export function noShowCoachVenueWorkMutationOptions(
  client: Pick<ApiClient, "bookings">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ bookingId }: { bookingId: string; userId?: string }) =>
      client.bookings.noShowCoachWork(bookingId),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.coachVenueWork(variables.userId),
      });
    },
  });
}

export function createBookingMutationOptions(client: Pick<ApiClient, "bookings">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: CreateBookingPayload; userId?: string; venueId?: string | number; date?: string }) =>
      client.bookings.create(payload),
    onSuccess: async (_data, variables) => {
      const tasks = [
        invalidateBookingQueries(queryClient, variables.userId),
        invalidateVenueQueries(queryClient, variables.userId),
        queryClient.invalidateQueries({
          queryKey: queryKeys.facilityMapSnapshot(),
        }),
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
      await Promise.all([
        invalidateBookingQueries(queryClient, variables.userId),
        queryClient.invalidateQueries({
          queryKey: queryKeys.facilityMapSnapshot(),
        }),
      ]);
    }
  });
}
