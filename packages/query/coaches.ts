import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient, UpdateCoachProfilePayload, UpsertCoachAvailabilityPayload } from "@fittrack/api-client";
import { queryKeys } from "./query-keys";

function buildCoachInvalidations(queryClient: QueryClient, userId?: string, coachId?: string) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: queryKeys.coaches() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.staffCoaches() })
  ];
  if (userId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: queryKeys.coachSelfProfile(userId) }));
    tasks.push(queryClient.invalidateQueries({ queryKey: queryKeys.coachSchedule(userId) }));
  }
  if (coachId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: queryKeys.coachAvailability(coachId) }));
  }
  return tasks;
}

export function activeCoachesQueryOptions<T>(client: Pick<ApiClient, "coaches">) {
  return queryOptions({
    queryKey: queryKeys.coaches(),
    queryFn: () => client.coaches.listActive<T>()
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

export function coachSelfProfileQueryOptions<T extends { user?: { id?: string } | null }>(
  client: Pick<ApiClient, "coaches">,
  userId?: string
) {
  return queryOptions({
    queryKey: queryKeys.coachSelfProfile(userId),
    queryFn: async () => {
      if (!userId) return null;
      const coaches = await client.coaches.listAll<T>();
      return coaches.find((coach) => coach.user?.id === userId) ?? null;
    }
  });
}

export function updateCoachProfileMutationOptions(client: Pick<ApiClient, "coaches">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: UpdateCoachProfilePayload; userId?: string; coachId?: string }) =>
      client.coaches.updateProfile(payload),
    onSuccess: async (_data, variables) => {
      await Promise.all(buildCoachInvalidations(queryClient, variables.userId, variables.coachId));
    }
  });
}

export function createCoachAvailabilityMutationOptions(client: Pick<ApiClient, "coaches">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: UpsertCoachAvailabilityPayload; userId?: string; coachId?: string }) =>
      client.coaches.createAvailability(payload),
    onSuccess: async (_data, variables) => {
      await Promise.all(buildCoachInvalidations(queryClient, variables.userId, variables.coachId));
    }
  });
}

export function updateCoachAvailabilityMutationOptions(client: Pick<ApiClient, "coaches">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id, payload }: { id: string; payload: UpsertCoachAvailabilityPayload; userId?: string; coachId?: string }) =>
      client.coaches.updateAvailability(id, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all(buildCoachInvalidations(queryClient, variables.userId, variables.coachId));
    }
  });
}

export function deleteCoachAvailabilityMutationOptions(client: Pick<ApiClient, "coaches">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id }: { id: string; userId?: string; coachId?: string }) =>
      client.coaches.deleteAvailability(id),
    onSuccess: async (_data, variables) => {
      await Promise.all(buildCoachInvalidations(queryClient, variables.userId, variables.coachId));
    }
  });
}
