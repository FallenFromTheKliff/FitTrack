import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient, CreateAppointmentPayload } from "@fittrack/api-client";
import { queryKeys } from "./query-keys";

export function appointmentsQueryOptions<T>(client: Pick<ApiClient, "appointments">, userId?: string) {
  return queryOptions({
    queryKey: queryKeys.appointments(userId),
    queryFn: () => client.appointments.listMine<T>()
  });
}

export function createAppointmentMutationOptions(client: Pick<ApiClient, "appointments">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ payload, userId }: { payload: CreateAppointmentPayload; userId?: string }) =>
      client.appointments.create(payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.appointments(variables.userId) });
    }
  });
}

export function cancelAppointmentMutationOptions(client: Pick<ApiClient, "appointments">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ appointmentId, cancelReason }: { appointmentId: string; cancelReason: string; userId?: string }) =>
      client.appointments.cancel(appointmentId, cancelReason),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments(variables.userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.coachSchedule() })
      ]);
    }
  });
}

export function confirmCoachAppointmentMutationOptions(client: Pick<ApiClient, "appointments">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ appointmentId }: { appointmentId: string; userId?: string }) =>
      client.appointments.confirmAsCoach(appointmentId),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.coachSchedule(variables.userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments() })
      ]);
    }
  });
}

export function declineCoachAppointmentMutationOptions(client: Pick<ApiClient, "appointments">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ appointmentId, reason }: { appointmentId: string; reason: string; userId?: string }) =>
      client.appointments.declineAsCoach(appointmentId, reason),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.coachSchedule(variables.userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments() })
      ]);
    }
  });
}

export function completeCoachAppointmentMutationOptions(client: Pick<ApiClient, "appointments">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ appointmentId }: { appointmentId: string; userId?: string }) =>
      client.appointments.completeAsCoach(appointmentId),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.coachSchedule(variables.userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments() })
      ]);
    }
  });
}
