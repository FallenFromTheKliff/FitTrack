import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  CreateStaffCoachBookingPayload,
  CreateStaffCoachPayload,
  CreateStaffVenueBookingPayload,
  StaffAppointmentListParams,
  StaffCoachAvailabilityPayload,
  UpdateCoachProfilePayload,
} from "@fittrack/api-client";
import {
  invalidateAnalyticsQueries,
  invalidateStaffBookingQueries,
  invalidateStaffCoachManagementQueries,
} from "./cache";
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

export function staffAppointmentsQueryOptions<T>(
  client: Pick<ApiClient, "staff">,
  params?: StaffAppointmentListParams
) {
  return queryOptions({
    queryKey: queryKeys.staffAppointments(params),
    queryFn: () => client.staff.listAppointments<T>(params)
  });
}

export function confirmStaffBookingMutationOptions(client: Pick<ApiClient, "staff">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (bookingId: string) => client.staff.confirmBooking(bookingId),
    onSuccess: async () => {
      await Promise.all([
        invalidateStaffBookingQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}

export function rejectStaffBookingMutationOptions(client: Pick<ApiClient, "staff">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      client.staff.rejectBooking(bookingId, reason),
    onSuccess: async () => {
      await Promise.all([
        invalidateStaffBookingQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}

export function completeStaffBookingMutationOptions(client: Pick<ApiClient, "staff">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (bookingId: string) => client.staff.completeBooking(bookingId),
    onSuccess: async () => {
      await Promise.all([
        invalidateStaffBookingQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}

export function cancelStaffBookingMutationOptions(client: Pick<ApiClient, "staff">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      client.staff.cancelBooking(bookingId, reason),
    onSuccess: async () => {
      await Promise.all([
        invalidateStaffBookingQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}

export function noShowStaffBookingMutationOptions(client: Pick<ApiClient, "staff">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (bookingId: string) => client.staff.noShowBooking(bookingId),
    onSuccess: async () => {
      await Promise.all([
        invalidateStaffBookingQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}

export function createStaffBookingMutationOptions(
  client: Pick<ApiClient, "staff">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: (payload: CreateStaffVenueBookingPayload) =>
      client.staff.createBooking(payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateStaffBookingQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}

export function replaceStaffCoachAvailabilityMutationOptions(
  client: Pick<ApiClient, "staff">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({
      coachId,
      payload
    }: {
      coachId: string;
      payload: StaffCoachAvailabilityPayload;
    }) => client.staff.replaceCoachAvailability(coachId, payload),
    onSuccess: async (_data, variables) => {
      await invalidateStaffCoachManagementQueries(queryClient, variables.coachId);
    }
  });
}

export function updateStaffCoachProfileMutationOptions(
  client: Pick<ApiClient, "staff">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({
      coachId,
      payload
    }: {
      coachId: string;
      payload: UpdateCoachProfilePayload;
    }) => client.staff.updateCoachProfile(coachId, payload),
    onSuccess: async (_data, variables) => {
      await invalidateStaffCoachManagementQueries(queryClient, variables.coachId);
    }
  });
}

export function createStaffCoachMutationOptions(
  client: Pick<ApiClient, "staff">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: (payload: CreateStaffCoachPayload) =>
      client.staff.createCoach(payload),
    onSuccess: async () => {
      await invalidateStaffCoachManagementQueries(queryClient);
    }
  });
}

export function respondToStaffAppointmentMutationOptions(
  client: Pick<ApiClient, "staff">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({
      accepted,
      appointmentId,
      reason
    }: {
      accepted: boolean;
      appointmentId: string;
      coachId?: string;
      reason?: string;
    }) => client.staff.respondToAppointment(appointmentId, accepted, reason),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateStaffCoachManagementQueries(queryClient, variables.coachId),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}

export function completeStaffAppointmentMutationOptions(
  client: Pick<ApiClient, "staff">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({
      appointmentId,
      sessionNotes
    }: {
      appointmentId: string;
      coachId?: string;
      sessionNotes?: string;
    }) => client.staff.completeAppointment(appointmentId, sessionNotes),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateStaffCoachManagementQueries(queryClient, variables.coachId),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}

export function cancelStaffAppointmentMutationOptions(
  client: Pick<ApiClient, "staff">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({
      appointmentId,
      reason
    }: {
      appointmentId: string;
      coachId?: string;
      reason: string;
    }) => client.staff.cancelAppointment(appointmentId, reason),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateStaffCoachManagementQueries(queryClient, variables.coachId),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}

export function createStaffAppointmentMutationOptions(
  client: Pick<ApiClient, "staff">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: (payload: CreateStaffCoachBookingPayload) =>
      client.staff.createAppointment(payload),
    onSuccess: async (_data, payload) => {
      await Promise.all([
        invalidateStaffCoachManagementQueries(queryClient, payload.coachId),
        invalidateAnalyticsQueries(queryClient),
      ]);
    }
  });
}
