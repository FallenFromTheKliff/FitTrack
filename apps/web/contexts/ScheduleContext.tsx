"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { VenueBookingRecord as ApiVenueBookingRecord } from "@fittrack/api-client";
import {
  adminBookingsQueryOptions,
  cancelAdminBookingMutationOptions,
  cancelStaffBookingMutationOptions,
  clearScheduleBookingsQuery,
  completeAdminBookingMutationOptions,
  completeStaffBookingMutationOptions,
  confirmAdminBookingMutationOptions,
  confirmStaffBookingMutationOptions,
  invalidateScheduleBookingsQuery,
  noShowAdminBookingMutationOptions,
  noShowStaffBookingMutationOptions,
  rejectAdminBookingMutationOptions,
  rejectStaffBookingMutationOptions,
  staffBookingsQueryOptions
} from "@fittrack/query";
import { createScheduleController } from "@fittrack/app-core";
import type { Booking } from "@fittrack/types";
import { webApiClient } from "@/lib/api-client";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export type VenueBookingRecord = ApiVenueBookingRecord & {
  status:
    | "pending"
    | "pending_downpayment"
    | "pending_payment"
    | "pending_full_payment"
    | "confirmed"
    | "balance_pending"
    | "cancelled"
    | "completed"
    | "no_show";
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

export type BookingDateRange = {
  endDate?: string;
  startDate?: string;
};

export interface IScheduleContext {
  bookings: ScheduleBooking[];
  rawBookings: VenueBookingRecord[];
  bookingDateRange: BookingDateRange;
  isLoading: boolean;
  setBookingDateRange: Dispatch<SetStateAction<BookingDateRange>>;
  addBooking: (booking: Booking) => void;
  removeBooking: (bookingId: string) => void;
  updateBooking: (bookingId: string, updates: Partial<Booking>) => void;
  clearBookings: () => void;
  cancelBooking: (bookingId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  completeBooking: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  confirmBooking: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  noShowBooking: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  rejectBooking: (bookingId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
}

const ScheduleContext = createContext<IScheduleContext | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const controller = useMemo(() => createScheduleController(), []);
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
  const [bookingDateRange, setBookingDateRange] = useState<BookingDateRange>(
    {},
  );
  const statusColors: Record<VenueBookingRecord["status"], string> = {
    pending: colors.warning,
    pending_downpayment: colors.warning,
    pending_payment: colors.warning,
    pending_full_payment: colors.warning,
    confirmed: colors.success,
    balance_pending: colors.warning,
    cancelled: colors.danger,
    completed: colors.textMuted,
    no_show: colors.danger
  };
  const bookingListFilters = useMemo(
    () => ({
      limit: 100,
      ...(bookingDateRange.startDate
        ? { startDate: bookingDateRange.startDate }
        : {}),
      ...(bookingDateRange.endDate
        ? { endDate: bookingDateRange.endDate }
        : {}),
    }),
    [bookingDateRange.endDate, bookingDateRange.startDate],
  );

  const staffBookingsQuery = useQuery({
    ...staffBookingsQueryOptions<VenueBookingRecord>(
      webApiClient,
      "all",
      bookingListFilters,
    ),
    enabled: isStaff,
    staleTime: 30_000
  });
  const adminBookingsQuery = useQuery({
    ...adminBookingsQueryOptions<VenueBookingRecord>(
      webApiClient,
      bookingListFilters,
    ),
    enabled: isAdmin,
    staleTime: 30_000
  });
  const rawBookings = isStaff
    ? staffBookingsQuery.data ?? []
    : isAdmin
      ? adminBookingsQuery.data ?? []
      : [];
  const isLoading = isStaff
    ? staffBookingsQuery.isLoading
    : isAdmin
      ? adminBookingsQuery.isLoading
      : false;
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
  const completeAdminMutation = useMutation(completeAdminBookingMutationOptions(webApiClient, queryClient));
  const completeStaffMutation = useMutation(completeStaffBookingMutationOptions(webApiClient, queryClient));
  const cancelAdminMutation = useMutation(cancelAdminBookingMutationOptions(webApiClient, queryClient));
  const cancelStaffMutation = useMutation(cancelStaffBookingMutationOptions(webApiClient, queryClient));
  const noShowAdminMutation = useMutation(noShowAdminBookingMutationOptions(webApiClient, queryClient));
  const noShowStaffMutation = useMutation(noShowStaffBookingMutationOptions(webApiClient, queryClient));
  const rejectAdminMutation = useMutation(rejectAdminBookingMutationOptions(webApiClient, queryClient));
  const rejectStaffMutation = useMutation(rejectStaffBookingMutationOptions(webApiClient, queryClient));
  const scheduleMode = isStaff ? "staff" : isAdmin ? "admin" : null;

  const addBooking = useCallback((_booking: Booking) => {
    if (!scheduleMode) return;
    void invalidateScheduleBookingsQuery(queryClient, scheduleMode);
  }, [queryClient, scheduleMode]);

  const removeBooking = useCallback((_bookingId: string) => {
    if (!scheduleMode) return;
    void invalidateScheduleBookingsQuery(queryClient, scheduleMode);
  }, [queryClient, scheduleMode]);

  const updateBooking = useCallback((_bookingId: string, _updates: Partial<Booking>) => {
    if (!scheduleMode) return;
    void invalidateScheduleBookingsQuery(queryClient, scheduleMode);
  }, [queryClient, scheduleMode]);

  const clearBookings = useCallback(() => {
    if (!scheduleMode) return;
    clearScheduleBookingsQuery(queryClient, scheduleMode);
  }, [queryClient, scheduleMode]);

  const confirmBooking = useCallback(async (bookingId: string) => {
    if (!scheduleMode) {
      return { success: false as const, error: "Schedule actions aren't available for this role." };
    }
    return controller.runAction(async () => {
      if (isStaff) {
        await confirmStaffMutation.mutateAsync(bookingId);
        return;
      }
      await confirmAdminMutation.mutateAsync(bookingId);
    }, "Failed to confirm booking.");
  }, [confirmAdminMutation, confirmStaffMutation, controller, isStaff, scheduleMode]);

  const rejectBooking = useCallback(async (bookingId: string, reason?: string) => {
    if (!scheduleMode) {
      return { success: false as const, error: "Schedule actions aren't available for this role." };
    }
    return controller.runAction(async () => {
      if (isStaff) {
        await rejectStaffMutation.mutateAsync({ bookingId, reason });
        return;
      }
      await rejectAdminMutation.mutateAsync({ bookingId, reason });
    }, "Failed to reject booking.");
  }, [controller, isStaff, rejectAdminMutation, rejectStaffMutation, scheduleMode]);

  const completeBooking = useCallback(async (bookingId: string) => {
    if (!scheduleMode) {
      return { success: false as const, error: "Schedule actions aren't available for this role." };
    }
    return controller.runAction(async () => {
      if (isStaff) {
        await completeStaffMutation.mutateAsync(bookingId);
        return;
      }
      await completeAdminMutation.mutateAsync(bookingId);
    }, "Failed to mark booking complete.");
  }, [completeAdminMutation, completeStaffMutation, controller, isStaff, scheduleMode]);

  const cancelBooking = useCallback(async (bookingId: string, reason?: string) => {
    if (!scheduleMode) {
      return { success: false as const, error: "Schedule actions aren't available for this role." };
    }
    return controller.runAction(async () => {
      if (isStaff) {
        await cancelStaffMutation.mutateAsync({ bookingId, reason });
        return;
      }
      await cancelAdminMutation.mutateAsync({ bookingId, reason });
    }, "Failed to cancel booking.");
  }, [cancelAdminMutation, cancelStaffMutation, controller, isStaff, scheduleMode]);

  const noShowBooking = useCallback(async (bookingId: string) => {
    if (!scheduleMode) {
      return { success: false as const, error: "Schedule actions aren't available for this role." };
    }
    return controller.runAction(async () => {
      if (isStaff) {
        await noShowStaffMutation.mutateAsync(bookingId);
        return;
      }
      await noShowAdminMutation.mutateAsync(bookingId);
    }, "Failed to mark booking no-show.");
  }, [controller, isStaff, noShowAdminMutation, noShowStaffMutation, scheduleMode]);

  return (
    <ScheduleContext.Provider value={{
    bookings,
    bookingDateRange,
    rawBookings,
    isLoading,
    setBookingDateRange,
    addBooking,
      removeBooking,
      updateBooking,
      clearBookings,
      cancelBooking,
      completeBooking,
      confirmBooking,
      noShowBooking,
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
