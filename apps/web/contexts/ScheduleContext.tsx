"use client";
import { createContext, useContext, useMemo, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminBookingsQueryOptions,
  confirmAdminBookingMutationOptions,
  confirmStaffBookingMutationOptions,
  queryKeys,
  rejectAdminBookingMutationOptions,
  rejectStaffBookingMutationOptions,
  staffBookingsQueryOptions
} from "@fittrack/query";
import { createScheduleController } from "@fittrack/app-core";
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

const ScheduleContext = createContext<IScheduleContext | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const controller = useMemo(() => createScheduleController(), []);
  const isStaff = user?.role === "STAFF";
  const bookingsQueryKey = isStaff ? queryKeys.staffBookings("all") : queryKeys.adminBookings();
  const statusColors: Record<VenueBookingRecord["status"], string> = {
    pending: colors.warning,
    confirmed: colors.success,
    cancelled: colors.danger,
    completed: colors.textMuted
  };

  const staffBookingsQuery = useQuery({
    ...staffBookingsQueryOptions<VenueBookingRecord>(webApiClient, "all"),
    enabled: isStaff,
    staleTime: 30_000
  });
  const adminBookingsQuery = useQuery({
    ...adminBookingsQueryOptions<VenueBookingRecord>(webApiClient),
    enabled: !isStaff,
    staleTime: 30_000
  });
  const rawBookings = isStaff ? staffBookingsQuery.data ?? [] : adminBookingsQuery.data ?? [];
  const isLoading = isStaff ? staffBookingsQuery.isLoading : adminBookingsQuery.isLoading;
  const bookings: ScheduleBooking[] = rawBookings.map((record) => {
    const booking = controller.toScheduleBooking(record, statusColors);
    return {
      id: booking.id,
      title: booking.title,
      resourceId: booking.resourceId ?? `venue-${record.venueId}`,
      resourceName: booking.resourceName,
      startHour: booking.startHour,
      startMinute: booking.startMinute,
      durationMin: booking.durationMin,
      status: record.status,
      color: booking.color,
      raw: record
    };
  });
  const confirmAdminMutation = useMutation(confirmAdminBookingMutationOptions(webApiClient, queryClient));
  const confirmStaffMutation = useMutation(confirmStaffBookingMutationOptions(webApiClient, queryClient));
  const rejectAdminMutation = useMutation(rejectAdminBookingMutationOptions(webApiClient, queryClient));
  const rejectStaffMutation = useMutation(rejectStaffBookingMutationOptions(webApiClient, queryClient));

  const addBooking = useCallback((_booking: Booking) => {
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
  }, [bookingsQueryKey, queryClient]);

  const removeBooking = useCallback((_bookingId: string) => {
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
  }, [bookingsQueryKey, queryClient]);

  const updateBooking = useCallback((_bookingId: string, _updates: Partial<Booking>) => {
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
  }, [bookingsQueryKey, queryClient]);

  const clearBookings = useCallback(() => {
    queryClient.setQueryData<VenueBookingRecord[] | null>(bookingsQueryKey, null);
  }, [bookingsQueryKey, queryClient]);

  const confirmBooking = useCallback(async (bookingId: string) => {
    return controller.runAction(async () => {
      if (isStaff) {
        await confirmStaffMutation.mutateAsync(bookingId);
        return;
      }
      await confirmAdminMutation.mutateAsync(bookingId);
    }, "Failed to confirm booking.");
  }, [confirmAdminMutation, confirmStaffMutation, controller, isStaff]);

  const rejectBooking = useCallback(async (bookingId: string, reason?: string) => {
    return controller.runAction(async () => {
      if (isStaff) {
        await rejectStaffMutation.mutateAsync({ bookingId, reason });
        return;
      }
      await rejectAdminMutation.mutateAsync({ bookingId, reason });
    }, "Failed to reject booking.");
  }, [controller, isStaff, rejectAdminMutation, rejectStaffMutation]);

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
