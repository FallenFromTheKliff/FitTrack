import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  AppointmentAvailabilitySlot,
  AppointmentManualStatus,
  CreateAppointmentPayload,
  RescheduleAppointmentPayload,
} from "@fittrack/api-client";
import {
  invalidateAnalyticsQueries,
  invalidateAppointmentQueries,
  invalidateCoachScheduleQueries,
  invalidateStaffCoachManagementQueries,
} from "./cache";
import { queryKeys } from "./query-keys";

function markCancelledAppointment(value: unknown, appointmentId: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => markCancelledAppointment(entry, appointmentId));
  }

  if (!value || typeof value !== "object") return value;
  const record = value as { id?: unknown };
  if (String(record.id ?? "") !== appointmentId) return value;

  return { ...record, status: "cancelled" };
}

export function appointmentsQueryOptions<T>(client: Pick<ApiClient, "appointments">, userId?: string) {
  return queryOptions({
    queryKey: queryKeys.appointments(userId),
    queryFn: () => client.appointments.listMine<T>()
  });
}

export function allAppointmentsQueryOptions<T>(
  client: Pick<ApiClient, "appointments">,
  userId?: string,
) {
  return queryOptions({
    queryKey: [...queryKeys.appointments(userId), "all"] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      client.appointments.listMineAll<T>(signal),
  });
}

export function createAppointmentMutationOptions(client: Pick<ApiClient, "appointments">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ payload, userId }: { payload: CreateAppointmentPayload; userId?: string }) =>
      client.appointments.create(payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateAppointmentQueries(queryClient, variables.userId),
        invalidateStaffCoachManagementQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}

export function appointmentAvailabilityQueryOptions(
  client: Pick<ApiClient, "appointments">,
  coachId?: string,
  date?: string,
  durationMinutes?: number,
) {
  return queryOptions<AppointmentAvailabilitySlot[]>({
    queryKey: queryKeys.appointmentAvailability(
      coachId,
      date,
      durationMinutes,
    ),
    queryFn: () =>
      client.appointments.getAvailability(coachId!, {
        date: date!,
        durationMinutes: durationMinutes!,
      }),
    enabled: Boolean(
      coachId && date && durationMinutes && durationMinutes > 0,
    ),
    staleTime: 15_000,
  });
}

export function rescheduleAppointmentMutationOptions(
  client: Pick<ApiClient, "appointments">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      appointmentId,
      payload,
      userId,
    }: {
      appointmentId: string;
      payload: RescheduleAppointmentPayload;
      userId?: string;
    }) => client.appointments.reschedule(appointmentId, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateAppointmentQueries(queryClient, variables.userId),
        queryClient.invalidateQueries({
          queryKey: queryKeys.appointmentDetail(variables.appointmentId),
        }),
        invalidateCoachScheduleQueries(queryClient),
        invalidateStaffCoachManagementQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    },
  });
}

export function cancelAppointmentMutationOptions(client: Pick<ApiClient, "appointments">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ appointmentId, cancelReason }: { appointmentId: string; cancelReason: string; userId?: string }) =>
      client.appointments.cancel(appointmentId, cancelReason),
    onSuccess: (_data, variables) => {
      queryClient.setQueriesData(
        { queryKey: queryKeys.appointments() },
        (current) => markCancelledAppointment(current, variables.appointmentId),
      );
      queryClient.setQueryData(
        queryKeys.appointmentDetail(variables.appointmentId),
        (current) => markCancelledAppointment(current, variables.appointmentId),
      );

      void Promise.all([
        invalidateAppointmentQueries(queryClient, variables.userId),
        invalidateCoachScheduleQueries(queryClient),
        invalidateStaffCoachManagementQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]).catch(() => undefined);
    }
  });
}

export function completeCoachAppointmentMutationOptions(client: Pick<ApiClient, "appointments">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({
      appointmentId,
      assessmentReport,
      coachFeedback,
      sessionNotes,
    }: {
      appointmentId: string;
      assessmentReport?: string;
      coachFeedback?: string;
      sessionNotes?: string;
      userId?: string;
    }) =>
      client.appointments.completeAsCoach(appointmentId, {
        assessmentReport,
        coachFeedback,
        sessionNotes,
      }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateCoachScheduleQueries(queryClient, variables.userId),
        invalidateAppointmentQueries(queryClient),
        invalidateStaffCoachManagementQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}

export function changeAppointmentStatusMutationOptions(
  client: Pick<ApiClient, "appointments">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      appointmentId,
      reason,
      status,
    }: {
      appointmentId: string;
      reason?: string;
      status: AppointmentManualStatus;
      userId?: string;
    }) => client.appointments.changeStatus(appointmentId, { reason, status }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateAppointmentQueries(queryClient, variables.userId),
        invalidateCoachScheduleQueries(queryClient),
        invalidateStaffCoachManagementQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    },
  });
}
