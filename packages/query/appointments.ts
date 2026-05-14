import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  AppointmentPaymentProvider,
  AppointmentPaymentStage,
  CreateAppointmentPayload,
} from "@fittrack/api-client";
import {
  invalidateAnalyticsQueries,
  invalidateAppointmentQueries,
  invalidateCoachScheduleQueries
} from "./cache";
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
      await invalidateAppointmentQueries(queryClient, variables.userId);
    }
  });
}

export function payAppointmentDownpaymentMutationOptions(
  client: Pick<ApiClient, "appointments">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      appointmentId,
      provider = "paymongo",
      paymentStage = "downpayment",
      userId,
    }: {
      appointmentId: string;
      provider?: AppointmentPaymentProvider;
      paymentStage?: AppointmentPaymentStage;
      userId?: string;
    }) =>
      client.appointments.initiateDownpayment(
        appointmentId,
        provider,
        paymentStage,
      ),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateAppointmentQueries(queryClient, variables.userId),
        invalidateCoachScheduleQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    },
  });
}

export function processAppointmentBalanceMutationOptions(
  client: Pick<ApiClient, "appointments">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({
      appointmentId,
      provider = "cash",
      referenceNo,
      screenshotUrl,
      userId,
    }: {
      appointmentId: string;
      provider?: AppointmentPaymentProvider;
      referenceNo?: string;
      screenshotUrl?: string;
      userId?: string;
    }) =>
      client.appointments.processBalance(appointmentId, {
        provider,
        referenceNo,
        screenshotUrl,
      }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateAppointmentQueries(queryClient, variables.userId),
        invalidateCoachScheduleQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    },
  });
}

export function cancelAppointmentMutationOptions(client: Pick<ApiClient, "appointments">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ appointmentId, cancelReason }: { appointmentId: string; cancelReason: string; userId?: string }) =>
      client.appointments.cancel(appointmentId, cancelReason),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateAppointmentQueries(queryClient, variables.userId),
        invalidateCoachScheduleQueries(queryClient)
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
        invalidateCoachScheduleQueries(queryClient, variables.userId),
        invalidateAppointmentQueries(queryClient)
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
        invalidateCoachScheduleQueries(queryClient, variables.userId),
        invalidateAppointmentQueries(queryClient)
      ]);
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
        invalidateAppointmentQueries(queryClient)
      ]);
    }
  });
}
