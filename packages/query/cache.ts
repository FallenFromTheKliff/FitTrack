import type { QueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@fittrack/types";
import { queryKeys } from "./query-keys";

export function setAuthUserQueryData(queryClient: QueryClient, user: AuthUser | null) {
  queryClient.setQueryData<AuthUser | null>(queryKeys.authUser(), user);
}

export function patchAuthUserQueryData(queryClient: QueryClient, patch: Partial<AuthUser>) {
  queryClient.setQueryData<AuthUser | null>(queryKeys.authUser(), (previous) => {
    if (!previous) return previous;
    return { ...previous, ...patch };
  });
}

export function setProfileDeletionStatusQueryData(
  queryClient: QueryClient,
  userId: string | undefined,
  status: "approved" | "none" | "pending"
) {
  queryClient.setQueryData(queryKeys.profileDeletionStatus(userId), status);
}

export function invalidateVenueQueries(queryClient: QueryClient, userId?: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.venues(userId) });
}

export function invalidateBookingQueries(queryClient: QueryClient, userId?: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.bookings(userId) });
}

export function invalidateAppointmentQueries(queryClient: QueryClient, userId?: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.appointments(userId) });
}

export function invalidateCoachScheduleQueries(queryClient: QueryClient, userId?: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.coachSchedule(userId) });
}

export function invalidateProfileDeletionStatusQuery(queryClient: QueryClient, userId?: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.profileDeletionStatus(userId) });
}

export function invalidateAdminMembersQuery(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.adminMembers() });
}

export function invalidateAdminDeletionRequestsQuery(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.adminDeletionRequests() });
}

export function invalidateAdminBookingsQuery(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.adminBookings() });
}

export async function invalidateStaffBookingQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.staffBookings("all") }),
    queryClient.invalidateQueries({ queryKey: queryKeys.staffBookings("pending") })
  ]);
}

export async function invalidateCoachQueries(queryClient: QueryClient, userId?: string, coachId?: string) {
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
  await Promise.all(tasks);
}

export async function invalidateScheduleBookingsQuery(queryClient: QueryClient, mode: "admin" | "staff") {
  if (mode === "staff") {
    await invalidateStaffBookingQueries(queryClient);
    return;
  }
  await invalidateAdminBookingsQuery(queryClient);
}

export function clearScheduleBookingsQuery(queryClient: QueryClient, mode: "admin" | "staff") {
  if (mode === "staff") {
    queryClient.setQueryData(queryKeys.staffBookings("all"), null);
    return;
  }
  queryClient.setQueryData(queryKeys.adminBookings(), null);
}
