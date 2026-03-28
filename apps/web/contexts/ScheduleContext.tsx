"use client";
import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { queryKeys } from "@fittrack/query";
import { api } from "@/lib/axios";
import type { Booking } from "@fittrack/types";
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

type AllBookingsResponse = {
  total: number;
  pending: number;
  confirmed: number;
  cancelled: number;
  completed: number;
  bookings: VenueBookingRecord[];
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
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data.message.join(" ");
    if (typeof data?.message === "string") return data.message;
  }
  return fallback;
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

  const { data: response, isLoading } = useQuery<AllBookingsResponse>({
    queryKey: bookingsQueryKey,
    queryFn: async () => {
      const { data } = await api.get<AllBookingsResponse>(isStaff ? "/staff/bookings" : "/admin/bookings");
      return data;
    },
    staleTime: 30_000
  });

  const rawBookings = response?.bookings ?? [];
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
      await api.patch(`${isStaff ? "/staff" : "/admin"}/bookings/${bookingId}/confirm`);
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
      await api.patch(`${isStaff ? "/staff" : "/admin"}/bookings/${bookingId}/reject`, reason ? { reason } : {});
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
