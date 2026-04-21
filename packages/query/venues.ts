import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient, VenueMutationPayload } from "@fittrack/api-client";
import { invalidateVenueQueries } from "./cache";
import { queryKeys } from "./query-keys";

export function venuesQueryOptions(client: Pick<ApiClient, "venues">, userId?: string) {
  return queryOptions({
    queryKey: queryKeys.venues(userId),
    queryFn: () => client.venues.listActive()
  });
}

export function venueAvailabilityQueryOptions<T>(
  client: Pick<ApiClient, "venues">,
  venueId?: string | number,
  date?: string
) {
  return queryOptions({
    queryKey: queryKeys.venueAvailability(venueId, date),
    queryFn: () => {
      if (venueId == null || !date) {
        throw new Error("Venue id and date are required.");
      }
      return client.venues.getAvailability<T>(venueId, date);
    }
  });
}

export function createVenueMutationOptions(client: Pick<ApiClient, "venues">, queryClient: QueryClient, userId?: string) {
  return mutationOptions({
    mutationFn: (payload: VenueMutationPayload) => client.venues.create(payload),
    onSuccess: async () => {
      await invalidateVenueQueries(queryClient, userId);
    }
  });
}

export function updateVenueMutationOptions(client: Pick<ApiClient, "venues">, queryClient: QueryClient, userId?: string) {
  return mutationOptions({
    mutationFn: ({ id, payload }: { id: string | number; payload: VenueMutationPayload }) => client.venues.update(id, payload),
    onSuccess: async () => {
      await invalidateVenueQueries(queryClient, userId);
    }
  });
}

export function deleteVenueMutationOptions(client: Pick<ApiClient, "venues">, queryClient: QueryClient, userId?: string) {
  return mutationOptions({
    mutationFn: (id: string | number) => client.venues.delete(id),
    onSuccess: async () => {
      await invalidateVenueQueries(queryClient, userId);
    }
  });
}
