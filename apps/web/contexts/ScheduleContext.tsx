"use client";
import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@fittrack/query";
import type { Booking } from "@fittrack/types";
import { webApiClient } from "@/lib/api-client";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export type VenueBookingRecord = {
  id: string;
  venueId: number;
  userId: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  purpose?: string | null;
  participants?: number | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  cancelReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  venue?: {
    id: number;
    name: string;
    capacity?: number | null;
    hourlyRate?: number | null;
  };
  user?: {
    id: string;
    email: string;
    phone_no?: string | null;
    profile?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  };
};

export type ScheduleBooking = {
  id: string;
  title: string;
  resourceId: string;
  resourceName: string;
  startHour: number;
  startMinute: number;
  durationMin: number;
  status: VenueBookingRecord["status"];
  color: string;
  raw: VenueBookingRecord;
};

export interface IScheduleContext {
  bookings: ScheduleBooking[];
  rawBookings: VenueBookingRecord[];
  isLoading: boolean;
  addBooking: (booking: Booking) => void;
  removeBooking: (bookingId: string) => void;
  updateBooking: (bookingId: string, updates: Partial<Booking>) => void;
  clearBookings: () => void;
  confirmBooking: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  rejectBooking: (bookingId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
}

function toScheduleBooking(
  record: VenueBookingRecord,
  statusColors: Record<VenueBookingRecord["status"], string>
): ScheduleBooking {
  const start = new Date(record.startTime);
  const end = new Date(record.endTime);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const resourceName = record.venue?.name ?? `Venue ${record.venueId}`;
  const userLabel = record.user?.profile?.firstName
    ? `${record.user.profile.firstName} ${record.user.profile.lastName ?? ""}`.trim()
    : record.user?.email ?? "Member";
  return {
    id: record.id,
    title: record.purpose ? `${userLabel} — ${record.purpose}` : userLabel,
    resourceId: `venue-${record.venueId}`,
    resourceName,
    startHour: start.getHours(),
    startMinute: start.getMinutes(),
    durationMin,
    status: record.status,
    color: statusColors[record.status],
    raw: record
  };
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

const ScheduleContext = createContext<IScheduleContext | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isStaff = user?.role === "STAFF";
  const bookingsQueryKey = isStaff ? queryKeys.staffBookings("all") : queryKeys.adminBookings();
  const statusColors: Record<VenueBookingRecord["status"], string> = {
    pending: colors.warning,
    confirmed: colors.success,
    cancelled: colors.danger,
    completed: colors.textMuted
  };

  const { data: rawBookings = [], isLoading } = useQuery<VenueBookingRecord[]>({
    queryKey: bookingsQueryKey,
    queryFn: () => isStaff
      ? webApiClient.staff.listBookings<VenueBookingRecord>()
      : webApiClient.admin.listBookings<VenueBookingRecord>(),
    staleTime: 30_000
  });

  const bookings = rawBookings.map((record) => toScheduleBooking(record, statusColors));

  const addBooking = useCallback((_booking: Booking) => {
    queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
  }, [bookingsQueryKey, queryClient]);

  const removeBooking = useCallback((_bookingId: string) => {
    queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
  }, [bookingsQueryKey, queryClient]);

  const updateBooking = useCallback((_bookingId: string, _updates: Partial<Booking>) => {
    queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
  }, [bookingsQueryKey, queryClient]);

  const clearBookings = useCallback(() => {
    queryClient.setQueryData(bookingsQueryKey, null);
  }, [bookingsQueryKey, queryClient]);

  const confirmMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      if (isStaff) {
        await webApiClient.staff.confirmBooking(bookingId);
        return;
      }
      await webApiClient.admin.confirmBooking(bookingId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookingsQueryKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffBookings("pending") })
      ]);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      if (isStaff) {
        await webApiClient.staff.rejectBooking(bookingId, reason);
        return;
      }
      await webApiClient.admin.rejectBooking(bookingId, reason);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookingsQueryKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffBookings("pending") })
      ]);
    }
  });

  const confirmBooking = useCallback(async (bookingId: string) => {
    try {
      await confirmMutation.mutateAsync(bookingId);
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: toMessage(err, "Failed to confirm booking.") };
    }
  }, [confirmMutation]);

  const rejectBooking = useCallback(async (bookingId: string, reason?: string) => {
    try {
      await rejectMutation.mutateAsync({ bookingId, reason });
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: toMessage(err, "Failed to reject booking.") };
    }
  }, [rejectMutation]);

  return (
    <ScheduleContext.Provider value={{
      bookings,
      rawBookings,
      isLoading,
      addBooking,
      removeBooking,
      updateBooking,
      clearBookings,
      confirmBooking,
      rejectBooking
    }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule(): IScheduleContext {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error("useSchedule must be within a ScheduleProvider");
  return context;
}
