import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  CoachSpecialtyListParams,
  CoachListFilters,
  SubmitCoachReviewPayload,
  UpdateCoachProfilePayload,
  UpsertCoachAvailabilityPayload,
} from "@fittrack/api-client";
import { invalidateAppointmentQueries, invalidateCoachQueries } from "./cache";
import { queryKeys } from "./query-keys";

export function activeCoachesQueryOptions<T>(
  client: Pick<ApiClient, "coaches">,
  filters?: CoachListFilters,
) {
  return queryOptions({
    queryKey: queryKeys.coaches(filters),
    queryFn: () => client.coaches.listActive<T>(filters)
  });
}

export function coachSpecialtiesQueryOptions(
  client: Pick<ApiClient, "coachSpecialties">,
  params?: CoachSpecialtyListParams,
) {
  return queryOptions({
    queryKey: queryKeys.coachSpecialties(params),
    queryFn: () => client.coachSpecialties.list(params),
  });
}

export function coachAvailabilityQueryOptions<T>(client: Pick<ApiClient, "coaches">, coachId?: string) {
  return queryOptions({
    queryKey: queryKeys.coachAvailability(coachId),
    queryFn: () => {
      if (!coachId) {
        throw new Error("Coach id is required.");
      }
      return client.coaches.getAvailability<T>(coachId);
    }
  });
}

export function coachScheduleQueryOptions<T>(client: Pick<ApiClient, "coaches">, userId?: string) {
  return queryOptions({
    queryKey: queryKeys.coachSchedule(userId),
    queryFn: () => client.coaches.listAppointmentSchedule<T>()
  });
}

export function coachSelfProfileQueryOptions<T>(
  client: Pick<ApiClient, "coaches">,
  userId?: string
) {
  return queryOptions({
    queryKey: queryKeys.coachSelfProfile(userId),
    queryFn: async () => {
      if (!userId) return null;
      return client.coaches.getMine<T>();
    }
  });
}

export function updateCoachProfileMutationOptions(client: Pick<ApiClient, "coaches">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: UpdateCoachProfilePayload; userId?: string; coachId?: string }) =>
      client.coaches.updateProfile(payload),
    onSuccess: async (_data, variables) => {
      await invalidateCoachQueries(queryClient, variables.userId, variables.coachId);
    }
  });
}

export function createCoachAvailabilityMutationOptions(client: Pick<ApiClient, "coaches">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: UpsertCoachAvailabilityPayload; userId?: string; coachId?: string }) =>
      client.coaches.createAvailability(payload),
    onSuccess: async (_data, variables) => {
      await invalidateCoachQueries(queryClient, variables.userId, variables.coachId);
    }
  });
}

export function updateCoachAvailabilityMutationOptions(client: Pick<ApiClient, "coaches">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id, payload }: { id: string; payload: UpsertCoachAvailabilityPayload; userId?: string; coachId?: string }) =>
      client.coaches.updateAvailability(id, payload),
    onSuccess: async (_data, variables) => {
      await invalidateCoachQueries(queryClient, variables.userId, variables.coachId);
    }
  });
}

export function deleteCoachAvailabilityMutationOptions(client: Pick<ApiClient, "coaches">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id }: { id: string; userId?: string; coachId?: string }) =>
      client.coaches.deleteAvailability(id),
    onSuccess: async (_data, variables) => {
      await invalidateCoachQueries(queryClient, variables.userId, variables.coachId);
    }
  });
}

export function submitCoachReviewMutationOptions(
  client: Pick<ApiClient, "coaches">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      coachId,
      payload,
    }: {
      coachId: string;
      payload: SubmitCoachReviewPayload;
      userId?: string;
    }) => client.coaches.submitReview(coachId, payload),
    onSuccess: async (_data, variables) => {
      await invalidateAppointmentQueries(queryClient, variables.userId);
    },
  });
}
