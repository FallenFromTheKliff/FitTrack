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
  cancelCoachVenueWorkMutationOptions,
  cancelStaffBookingMutationOptions,
  clearScheduleBookingsQuery,
  completeAdminBookingMutationOptions,
  completeCoachVenueWorkMutationOptions,
  completeStaffBookingMutationOptions,
  invalidateScheduleBookingsQuery,
  noShowAdminBookingMutationOptions,
  noShowCoachVenueWorkMutationOptions,
  noShowStaffBookingMutationOptions,
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
    | "confirmed"
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
  noShowBooking: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
}

const ScheduleContext = createContext<IScheduleContext | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const controller = useMemo(() => createScheduleController(), []);
  const isAdmin = user?.role === "ADMIN";
  const isCoach = user?.role === "COACH";
  const isStaff = user?.role === "STAFF";
  const [bookingDateRange, setBookingDateRange] = useState<BookingDateRange>(
    {},
  );
  const statusColors: Record<VenueBookingRecord["status"], string> = {
    pending: colors.warning,
    confirmed: colors.success,
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
  const completeAdminMutation = useMutation(completeAdminBookingMutationOptions(webApiClient, queryClient));
  const completeStaffMutation = useMutation(completeStaffBookingMutationOptions(webApiClient, queryClient));
  const cancelAdminMutation = useMutation(cancelAdminBookingMutationOptions(webApiClient, queryClient));
  const cancelStaffMutation = useMutation(cancelStaffBookingMutationOptions(webApiClient, queryClient));
  const noShowAdminMutation = useMutation(noShowAdminBookingMutationOptions(webApiClient, queryClient));
  const noShowStaffMutation = useMutation(noShowStaffBookingMutationOptions(webApiClient, queryClient));
  const completeCoachWorkMutation = useMutation(completeCoachVenueWorkMutationOptions(webApiClient, queryClient));
  const cancelCoachWorkMutation = useMutation(cancelCoachVenueWorkMutationOptions(webApiClient, queryClient));
  const noShowCoachWorkMutation = useMutation(noShowCoachVenueWorkMutationOptions(webApiClient, queryClient));
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

  const completeBooking = useCallback(async (bookingId: string) => {
    if (!scheduleMode && !isCoach) {
      return { success: false as const, error: "Schedule actions aren't available for this role." };
    }
    return controller.runAction(async () => {
      if (isCoach) {
        await completeCoachWorkMutation.mutateAsync({ bookingId, userId: user?.id });
        return;
      }
      if (isStaff) {
        await completeStaffMutation.mutateAsync(bookingId);
        return;
      }
      await completeAdminMutation.mutateAsync(bookingId);
    }, "Failed to mark booking complete.");
  }, [completeAdminMutation, completeCoachWorkMutation, completeStaffMutation, controller, isCoach, isStaff, scheduleMode, user?.id]);

  const cancelBooking = useCallback(async (bookingId: string, reason?: string) => {
    if (!scheduleMode && !isCoach) {
      return { success: false as const, error: "Schedule actions aren't available for this role." };
    }
    return controller.runAction(async () => {
      if (isCoach) {
        await cancelCoachWorkMutation.mutateAsync({ bookingId, reason, userId: user?.id });
        return;
      }
      if (isStaff) {
        await cancelStaffMutation.mutateAsync({ bookingId, reason });
        return;
      }
      await cancelAdminMutation.mutateAsync({ bookingId, reason });
    }, "Failed to cancel booking.");
  }, [cancelAdminMutation, cancelCoachWorkMutation, cancelStaffMutation, controller, isCoach, isStaff, scheduleMode, user?.id]);

  const noShowBooking = useCallback(async (bookingId: string) => {
    if (!scheduleMode && !isCoach) {
      return { success: false as const, error: "Schedule actions aren't available for this role." };
    }
    return controller.runAction(async () => {
      if (isCoach) {
        await noShowCoachWorkMutation.mutateAsync({ bookingId, userId: user?.id });
        return;
      }
      if (isStaff) {
        await noShowStaffMutation.mutateAsync(bookingId);
        return;
      }
      await noShowAdminMutation.mutateAsync(bookingId);
    }, "Failed to mark booking no-show.");
  }, [controller, isCoach, isStaff, noShowAdminMutation, noShowCoachWorkMutation, noShowStaffMutation, scheduleMode, user?.id]);

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
      noShowBooking,
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
