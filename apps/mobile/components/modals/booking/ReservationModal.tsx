import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  CalendarDays,
  CheckCircle,
  ChevronDown,
  Clock,
  Plus,
  Users,
  XCircle,
} from "lucide-react-native";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  FITTRACK_PAYMENT_ACCEPTANCE_LABEL,
  FITTRACK_PAYMENT_POLICY_SUMMARY,
  PAYMONGO_AVAILABILITY,
  WEEKDAY_NAMES,
  isPaymongoCheckoutEnabled,
} from "@fittrack/app-config";
import type {
  CoachAvailabilityResponse,
  VenueBookingRecord,
  VenueAvailabilityRecord,
} from "@fittrack/api-client";
import type { CoachProfileRecord } from "@fittrack/types";

import {
  activeCoachesQueryOptions,
  bookingsQueryOptions,
  coachAvailabilityQueryOptions,
  createBookingMutationOptions,
  venueAvailabilityQueryOptions,
  venuesQueryOptions,
} from "@fittrack/query";
import { getTodayString } from "@/data/bookings";
import { formatBookingDate } from "@fittrack/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText } from "@fittrack/hooks";
import { makeReservationModalStyles } from "@/styles/modals/ReservationStyles";
import { getVenuePresentation, type VenueRecord } from "@/utils/venueBookings";

import { FitButton, FitText, FitTextInput } from "@/components/fit";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import NoticeModal from "@/components/modals/shared/NoticeModal";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
import TimeSlotModal, {
  type TimeSlot,
} from "@/components/modals/shared/TimeSlotModal";

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type BookingPaymentOption = "paymongo_full";
type ReservationConfirmationState = {
  message: string;
  title: string;
  yesLabel: string;
};

const MEMBER_OVERLAP_STATUSES = new Set([
  "balance_pending",
  "confirmed",
  "pending",
]);

function timeToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;
  return hour * 60 + minute;
}

function timeValueToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

function formatIsoTimeLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const hours = parsed.getHours();
  const minutes = parsed.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const normalizedHour = hours % 12 || 12;
  return `${String(normalizedHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

function isoTimeToMinutes(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getHours() * 60 + parsed.getMinutes();
}

function formatDurationLabel(startLabel: string, endLabel: string) {
  let minutes = timeToMinutes(endLabel) - timeToMinutes(startLabel);
  if (minutes <= 0) minutes += 24 * 60;
  if (minutes <= 0) return "1 hr";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) {
    return `${hours} hr${hours === 1 ? "" : "s"} ${remainingMinutes} min`;
  }
  if (hours > 0) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} min`;
}

function toVenueStartSlot(slot: VenueAvailabilityRecord): TimeSlot {
  const startLabel = formatIsoTimeLabel(slot.startTime);
  return {
    time: startLabel,
    duration: formatDurationLabel(startLabel, formatIsoTimeLabel(slot.endTime)),
    status: slot.status === "available" ? "available" : "full",
  };
}

function matchesDay(selectedDate: string, dayValue: number | string) {
  const currentDate = new Date(`${selectedDate}T00:00:00`);
  const dayIndex = currentDate.getDay();
  if (typeof dayValue === "number") {
    return dayValue === dayIndex;
  }
  const normalized = String(dayValue).trim().toLowerCase();
  const numericDay = Number(normalized);
  if (Number.isInteger(numericDay)) {
    return numericDay === dayIndex;
  }
  return WEEKDAY_NAMES[dayIndex] === normalized;
}

function getUpcomingAvailableDates(coaches: CoachProfileRecord[]) {
  const availableDays = new Set<number>();
  coaches.forEach((coach) => {
    coach.availability?.forEach((slot) => {
      if (!slot.isAvailable) return;
      if (typeof slot.dayOfWeek === "number") {
        availableDays.add(slot.dayOfWeek);
        return;
      }
      const normalizedDay = String(slot.dayOfWeek).trim().toLowerCase();
      const numericDay = Number(normalizedDay);
      if (Number.isInteger(numericDay)) {
        availableDays.add(numericDay);
        return;
      }
      const weekdayIndex = WEEKDAY_NAMES.findIndex(
        (day) => day === normalizedDay,
      );
      if (weekdayIndex >= 0) availableDays.add(weekdayIndex);
    });
  });

  if (availableDays.size === 0) return [];

  const dates: string[] = [];
  const cursor = new Date(`${getTodayString()}T00:00:00`);
  for (let offset = 0; offset < 90; offset += 1) {
    const nextDate = new Date(cursor);
    nextDate.setDate(cursor.getDate() + offset);
    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, "0");
    const day = String(nextDate.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;
    const hasOpenCoach = coaches.some(
      (coach) =>
        !(coach.bookedDates ?? []).includes(dateKey) &&
        coach.availability?.some(
          (slot) => slot.isAvailable && matchesDay(dateKey, slot.dayOfWeek),
        ),
    );
    if (availableDays.has(nextDate.getDay()) && hasOpenCoach) {
      dates.push(dateKey);
    }
  }

  return dates;
}

function getDateParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  return { day, month, year };
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMaxBookableDateKey() {
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  return formatDateKey(
    maxDate.getFullYear(),
    maxDate.getMonth() + 1,
    maxDate.getDate(),
  );
}

function getMonthDateKeys(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) =>
    formatDateKey(year, month, index + 1),
  );
}

function hasFutureAvailableVenueSlot(
  dateKey: string,
  slots: VenueAvailabilityRecord[],
) {
  const now = new Date();
  const todayKey = getTodayString();

  return slots.some((slot) => {
    if (slot.status !== "available") return false;
    if (dateKey !== todayKey) return true;
    return new Date(slot.startTime) > now;
  });
}

function coachCoversReservationWindow(
  coach: CoachProfileRecord,
  selectedDate: string,
  selectedStartTime: string,
  selectedEndTime: string,
) {
  const slots = coach.availability ?? [];
  if (!slots.length) return false;
  if (coach.bookedDates?.includes(selectedDate)) return false;

  if (!selectedStartTime || !selectedEndTime) {
    return slots.some(
      (slot) => slot.isAvailable && matchesDay(selectedDate, slot.dayOfWeek),
    );
  }

  const startMinutes = timeToMinutes(selectedStartTime);
  const endMinutes = timeToMinutes(selectedEndTime);
  return slots.some(
    (slot) =>
      slot.isAvailable &&
      matchesDay(selectedDate, slot.dayOfWeek) &&
      timeValueToMinutes(slot.startTime) <= startMinutes &&
      timeValueToMinutes(slot.endTime) >= endMinutes,
  );
}

function getCoachName(coach: CoachProfileRecord) {
  const standaloneName = coach.displayName?.trim();
  if (standaloneName && !standaloneName.includes("@")) return standaloneName;
  return "Coach Profile";
}

function getCoachInitials(coach: CoachProfileRecord) {
  return (
    getCoachName(coach)
      .split(" ")
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "C"
  );
}

function getCoachPriceLabel(coach: CoachProfileRecord) {
  if (coach.hourlyRate == null || !Number.isFinite(coach.hourlyRate)) {
    return "Rate pending";
  }

  return `PHP ${coach.hourlyRate.toLocaleString("en-PH")} / hr`;
}

function getCoachRatingLabel(coach: CoachProfileRecord) {
  if (!coach.averageRating || coach.ratingCount === 0) {
    return "New coach";
  }

  return `${coach.averageRating.toFixed(1)} stars (${coach.ratingCount ?? 0})`;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toGymWallClockIso(date: string, minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const [year, month, day] = date.split("-").map(Number);
  const gymOffsetMinutes = 8 * 60;
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) - gymOffsetMinutes * 60 * 1000,
  ).toISOString();
}

function getReservationWindowMs(
  date: string,
  startTime: string,
  endTime: string,
) {
  const startMinutes = timeToMinutes(startTime);
  let endMinutes = timeToMinutes(endTime);
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return {
    end: Date.parse(toGymWallClockIso(date, endMinutes)),
    start: Date.parse(toGymWallClockIso(date, startMinutes)),
  };
}

function bookingOverlapsWindow(
  booking: VenueBookingRecord,
  window: { end: number; start: number },
) {
  if (!MEMBER_OVERLAP_STATUSES.has(String(booking.status).toLowerCase())) {
    return false;
  }
  const bookingStart = Date.parse(booking.startTime);
  const bookingEnd = Date.parse(booking.endTime);
  if (!Number.isFinite(bookingStart) || !Number.isFinite(bookingEnd)) {
    return false;
  }
  return window.start < bookingEnd && window.end > bookingStart;
}

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ReservationModal({
  isVisible,
  onClose,
  onSuccess,
}: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeReservationModalStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const createBookingMutation = useMutation(
    createBookingMutationOptions(mobileApiClient, queryClient),
  );
  const canUsePaymongo = isPaymongoCheckoutEnabled();
  const defaultPaymentOption: BookingPaymentOption = "paymongo_full";

  const [date, setDate] = useState(getTodayString());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [paymentOption, setPaymentOption] =
    useState<BookingPaymentOption>(defaultPaymentOption);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [isCoachPickerOpen, setIsCoachPickerOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<VenueRecord | null>(null);
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const initialDate = getDateParts(getTodayString());
    return { month: initialDate.month, year: initialDate.year };
  });
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [isPaymongoNoticeOpen, setIsPaymongoNoticeOpen] = useState(false);
  const [reservationConfirmation, setReservationConfirmation] =
    useState<ReservationConfirmationState | null>(null);
  const [successNotice, setSuccessNotice] = useState<{
    message: string;
    title: string;
  } | null>(null);
  const [timeTarget, setTimeTarget] = useState<"start" | "end">("start");
  const isSubmitting = createBookingMutation.isPending;
  const [apiError, setApiError] = useState("");
  const reservingText = useLoadingText("Reserving", isSubmitting);

  const { data: venues = [] } = useQuery({
    ...venuesQueryOptions(mobileApiClient),
    enabled: isVisible,
  });
  const {
    data: coaches = [],
    isLoading: coachesLoading,
    error: coachesError,
  } = useQuery({
    ...activeCoachesQueryOptions<CoachProfileRecord>(mobileApiClient),
    enabled: isVisible,
  });

  const bookableVenues = useMemo(
    () =>
      venues
        .filter((venue) => venue.isReservable !== false)
        .map((venue) => ({ venue, presentation: getVenuePresentation(venue) })),
    [venues],
  );
  const selectedVenuePresentation = useMemo(
    () => (selectedVenue ? getVenuePresentation(selectedVenue) : null),
    [selectedVenue],
  );
  const selectedVenueId = selectedVenue?.id;
  const selectedCoach = useMemo(
    () => coaches.find((coach) => String(coach.id) === selectedCoachId) ?? null,
    [coaches, selectedCoachId],
  );
  const availableCoachAddOns = useMemo(
    () =>
      coaches.filter((coach) =>
        coachCoversReservationWindow(coach, date, startTime, endTime),
      ),
    [coaches, date, endTime, startTime],
  );
  const fallbackCoachAvailabilityDates = useMemo(
    () => getUpcomingAvailableDates(coaches),
    [coaches],
  );
  const calendarDateKeys = useMemo(
    () => getMonthDateKeys(calendarCursor.year, calendarCursor.month),
    [calendarCursor.month, calendarCursor.year],
  );
  const maxBookableDateKey = useMemo(() => getMaxBookableDateKey(), []);
  const venueCalendarQueryDates = useMemo(
    () =>
      isVisible && isCalOpen && selectedVenueId != null
        ? calendarDateKeys.filter((dateKey) => dateKey <= maxBookableDateKey)
        : [],
    [
      calendarDateKeys,
      isCalOpen,
      isVisible,
      maxBookableDateKey,
      selectedVenueId,
    ],
  );
  const venueCalendarQueries = useQueries({
    queries: venueCalendarQueryDates.map((dateKey) => ({
      ...venueAvailabilityQueryOptions<VenueAvailabilityRecord>(
        mobileApiClient,
        selectedVenueId,
        dateKey,
      ),
      staleTime: 30_000,
    })),
  });
  const { blockedVenueDates, highlightedVenueDates } = useMemo(() => {
    const highlightedDates: string[] = [];
    const blockedDates: string[] = [];

    venueCalendarQueries.forEach((query, index) => {
      const dateKey = venueCalendarQueryDates[index];
      const slots = query.data as VenueAvailabilityRecord[] | undefined;
      if (!dateKey || !slots) return;

      if (hasFutureAvailableVenueSlot(dateKey, slots)) {
        highlightedDates.push(dateKey);
        return;
      }

      blockedDates.push(dateKey);
    });

    return {
      blockedVenueDates: blockedDates,
      highlightedVenueDates: highlightedDates,
    };
  }, [venueCalendarQueries, venueCalendarQueryDates]);
  const calendarHighlightedDates =
    selectedVenue != null
      ? highlightedVenueDates
      : fallbackCoachAvailabilityDates;
  const calendarBlockedDates = selectedVenue != null ? blockedVenueDates : [];
  const handleCalendarMonthChange = useCallback(
    (view: { month: number; year: number }) => {
      setCalendarCursor((current) =>
        current.month === view.month && current.year === view.year
          ? current
          : view,
      );
    },
    [],
  );

  const {
    data: availability = [],
    error: availabilityError,
    isLoading: availabilityLoading,
  } = useQuery({
    ...venueAvailabilityQueryOptions<VenueAvailabilityRecord>(
      mobileApiClient,
      selectedVenueId,
      date,
    ),
    enabled: isVisible && selectedVenueId != null && !!date,
  });
  const { data: existingBookings = [], isLoading: existingBookingsLoading } =
    useQuery({
      ...bookingsQueryOptions<VenueBookingRecord>(mobileApiClient, user?.id),
      enabled: isVisible && !!user?.id,
      staleTime: 30_000,
    });
  const {
    data: coachAvailability,
    isLoading: coachAvailabilityLoading,
    error: coachAvailabilityError,
  } = useQuery({
    ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(
      mobileApiClient,
      selectedCoach ? String(selectedCoach.id) : undefined,
    ),
    enabled: isVisible && !!selectedCoach,
  });

  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.overlay,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border,
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({
    borderBottomColor: ic.value.border,
  }));
  const footerBorderStyle = useAnimatedStyle(() => ({
    borderTopColor: ic.value.border,
  }));

  useEffect(() => {
    if (
      selectedCoachId &&
      !availableCoachAddOns.some(
        (coach) => String(coach.id) === selectedCoachId,
      )
    ) {
      setSelectedCoachId(null);
    }
  }, [availableCoachAddOns, selectedCoachId]);

  const basePrice = useMemo(
    () => selectedVenuePresentation?.price ?? 0,
    [selectedVenuePresentation],
  );
  const coachHourlyRate = useMemo(() => {
    if (!selectedCoach || selectedCoach.hourlyRate == null) return 0;
    return Number.isFinite(selectedCoach.hourlyRate)
      ? selectedCoach.hourlyRate
      : 0;
  }, [selectedCoach]);
  const reservationHours = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const totalHours = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
    return totalHours > 0 ? totalHours : 0;
  }, [endTime, startTime]);
  const venueTotalAmount = useMemo(
    () => roundCurrency(basePrice * reservationHours),
    [basePrice, reservationHours],
  );
  const coachAddOnAmount = useMemo(
    () => roundCurrency(coachHourlyRate * reservationHours),
    [coachHourlyRate, reservationHours],
  );
  const totalAmount = useMemo(
    () => roundCurrency(venueTotalAmount + coachAddOnAmount),
    [coachAddOnAmount, venueTotalAmount],
  );
  const isFreeReservation = totalAmount <= 0;
  const amountDueNow = totalAmount;
  const paymentProvider = isFreeReservation ? undefined : ("paymongo" as const);
  const paymentStage = isFreeReservation ? undefined : ("full" as const);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const liveVenueSlots = useMemo(
    () =>
      availability
        .filter((slot) => {
          const start = new Date(slot.startTime);
          const end = new Date(slot.endTime);
          return (
            start.getUTCMinutes() === 0 &&
            end.getTime() - start.getTime() === 60 * 60 * 1000
          );
        })
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        ),
    [availability],
  );
  const confirmButtonLabel = isFreeReservation
    ? "Confirm Reservation"
    : canUsePaymongo
      ? "Pay Full Amount"
      : "PayMongo Unavailable";
  const paymentOptionSummary = useMemo(() => {
    if (isFreeReservation) {
      return {
        body: "This reservation currently prices at PHP 0, so no upfront payment is required.",
        eyebrow: "Free access",
        title: "No checkout required",
      };
    }

    return {
      body: canUsePaymongo
        ? `Pay the full ${formatCurrency(totalAmount)} through PayMongo before the reservation is confirmed. No payment means no booking. You will return to FitTrack after checkout.`
        : "PayMongo checkout is unavailable right now. Try again later.",
      eyebrow: canUsePaymongo ? "PayMongo" : "PayMongo unavailable",
      title: "Full payment required",
    };
  }, [canUsePaymongo, isFreeReservation, totalAmount]);

  const startSlots = useMemo(
    () =>
      liveVenueSlots
        .filter((slot) => {
          if (date !== getTodayString()) return true;
          return isoTimeToMinutes(slot.startTime) > currentMinutes;
        })
        .map(toVenueStartSlot),
    [currentMinutes, date, liveVenueSlots],
  );
  const endSlots = useMemo((): TimeSlot[] => {
    if (!startTime) return [];
    const startIdx = liveVenueSlots.findIndex(
      (slot) => formatIsoTimeLabel(slot.startTime) === startTime,
    );
    if (startIdx === -1) return [];
    if (liveVenueSlots[startIdx]?.status !== "available") return [];

    const result: TimeSlot[] = [];
    let expectedStart = new Date(liveVenueSlots[startIdx].startTime).getTime();
    for (let i = startIdx; i < liveVenueSlots.length; i += 1) {
      const slot = liveVenueSlots[i];
      if (new Date(slot.startTime).getTime() !== expectedStart) break;
      if (slot.status !== "available") break;

      const endLabel = formatIsoTimeLabel(slot.endTime);
      if (timeToMinutes(endLabel) > timeToMinutes(startTime)) {
        result.push({
          time: endLabel,
          duration: formatDurationLabel(startTime, endLabel),
          status: "available",
        });
      }
      expectedStart = new Date(slot.endTime).getTime();
    }
    return result;
  }, [liveVenueSlots, startTime]);
  const isSelectedStartInPast =
    date === getTodayString() &&
    startTime !== "" &&
    timeToMinutes(startTime) <= currentMinutes;
  const hasOpenStartSlot = startSlots.some(
    (slot) => slot.status === "available",
  );
  const canOpenStartTime =
    Boolean(selectedVenue) &&
    !availabilityLoading &&
    !availabilityError &&
    startSlots.length > 0;
  const canOpenEndTime = Boolean(startTime) && endSlots.length > 0;
  const timeAvailabilityMessage = useMemo(() => {
    if (!selectedVenue) {
      return "Select a venue to load live time availability.";
    }
    if (availabilityLoading) {
      return "Loading live venue availability...";
    }
    if (availabilityError) {
      return availabilityError instanceof Error
        ? availabilityError.message
        : "Unable to load venue availability right now.";
    }
    if (startSlots.length === 0) {
      return "No future venue slots are available for the selected date.";
    }
    if (!hasOpenStartSlot) {
      return "All venue slots are currently booked for the selected date.";
    }
    if (startTime && endSlots.length === 0) {
      return "No continuous venue time is available after the selected start.";
    }
    return "";
  }, [
    availabilityError,
    availabilityLoading,
    endSlots.length,
    hasOpenStartSlot,
    selectedVenue,
    startSlots.length,
    startTime,
  ]);

  useEffect(() => {
    if (!isSelectedStartInPast) return;
    setStartTime("");
    setEndTime("");
  }, [isSelectedStartInPast]);

  const hasConflict = useMemo(() => {
    if (!selectedVenue || !date || !startTime || !endTime) return false;
    const selStart = timeToMinutes(startTime);
    const selEnd = timeToMinutes(endTime);
    return availability.some((booking) => {
      if (booking.status !== "confirmed" && booking.status !== "pending")
        return false;
      const bookingStart = new Date(booking.startTime);
      const bookingEnd = new Date(booking.endTime);
      const bookingStartMinutes =
        bookingStart.getHours() * 60 + bookingStart.getMinutes();
      const bookingEndMinutes =
        bookingEnd.getHours() * 60 + bookingEnd.getMinutes();
      return selStart < bookingEndMinutes && selEnd > bookingStartMinutes;
    });
  }, [availability, date, endTime, selectedVenue, startTime]);

  const hasMemberTimeOverlap = useMemo(() => {
    if (!date || !startTime || !endTime) return false;
    const selectedWindow = getReservationWindowMs(date, startTime, endTime);
    if (
      !Number.isFinite(selectedWindow.start) ||
      !Number.isFinite(selectedWindow.end)
    ) {
      return false;
    }
    return existingBookings.some((booking) =>
      bookingOverlapsWindow(booking, selectedWindow),
    );
  }, [date, endTime, existingBookings, startTime]);

  const coachMatchesWindow = useMemo(() => {
    if (!selectedCoach) return true;
    if (!date || !startTime || !endTime) return true;
    if (!coachAvailability?.availability) return false;
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    return coachAvailability.availability.some(
      (slot) =>
        slot.isAvailable &&
        matchesDay(date, slot.dayOfWeek) &&
        timeValueToMinutes(slot.startTime) <= startMinutes &&
        timeValueToMinutes(slot.endTime) >= endMinutes,
    );
  }, [
    coachAvailability?.availability,
    date,
    endTime,
    selectedCoach,
    startTime,
  ]);

  const coachStatusMessage = useMemo(() => {
    if (!selectedCoach) {
      return "Keep this venue booking on its own, or attach a coach after reviewing their profile.";
    }
    if (!startTime || !endTime) {
      return "Pick the reservation time first to validate this coach against the selected window.";
    }
    if (coachAvailabilityLoading) {
      return "Checking this coach against the selected reservation window.";
    }
    if (coachAvailabilityError) {
      return coachAvailabilityError instanceof Error
        ? coachAvailabilityError.message
        : "Unable to load coach availability right now.";
    }
    if (!coachMatchesWindow) {
      return "This coach does not currently cover the selected reservation window.";
    }
    return `${getCoachName(selectedCoach)} is available for the selected reservation window.`;
  }, [
    coachAvailabilityError,
    coachAvailabilityLoading,
    coachMatchesWindow,
    endTime,
    selectedCoach,
    startTime,
  ]);

  const canConfirm =
    !!date &&
    !!selectedVenue &&
    !!startTime &&
    !!endTime &&
    reservationHours > 0 &&
    !isSelectedStartInPast &&
    !availabilityLoading &&
    !availabilityError &&
    !existingBookingsLoading &&
    !hasConflict &&
    !hasMemberTimeOverlap &&
    coachMatchesWindow;

  const handleReset = () => {
    setDate(getTodayString());
    setStartTime("");
    setEndTime("");
    setNotes([]);
    setPaymentOption(defaultPaymentOption);
    setSelectedCoachId(null);
    setIsCoachPickerOpen(false);
    setSelectedVenue(null);
    setTimeTarget("start");
    setIsCalOpen(false);
    setIsTimeOpen(false);
    setApiError("");
    setSuccessNotice(null);
    setReservationConfirmation(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    handleReset();
    onClose();
  };

  const handleTimePick = (slot: TimeSlot) => {
    if (timeTarget === "start") {
      setStartTime(slot.time);
      setEndTime("");
      setIsTimeOpen(false);
      return;
    }
    setEndTime(slot.time);
    setIsTimeOpen(false);
  };

  const submitReservation = async () => {
    if (!canConfirm || !selectedVenue) return;
    setApiError("");
    if (
      !isFreeReservation &&
      paymentProvider === "paymongo" &&
      !canUsePaymongo
    ) {
      setIsPaymongoNoticeOpen(true);
      return;
    }
    const startMinutes = timeToMinutes(startTime);
    const isoStart = toGymWallClockIso(date, startMinutes);
    const purpose =
      notes.filter((note) => note.trim() !== "").join("\n") || undefined;
    if (selectedCoach && !coachMatchesWindow) {
      setApiError(
        "Selected coach does not currently cover this reservation window.",
      );
      return;
    }
    try {
      const result = await createBookingMutation.mutateAsync({
        payload: {
          coachId: selectedCoach ? String(selectedCoach.id) : undefined,
          paymentStage,
          provider: paymentProvider,
          venueId: selectedVenue.id,
          startTime: isoStart,
          durationHours: reservationHours,
          purpose,
        },
        venueId: selectedVenue.id,
        date,
      });
      const successTitle = result?.checkout_url
        ? "Checkout ready"
        : isFreeReservation
          ? "Reservation confirmed"
          : "Reservation confirmed";
      const successMessage = result?.checkout_url
        ? `Complete the PayMongo checkout for ${selectedVenuePresentation?.name ?? "your venue"} on ${formatBookingDate(date)} at ${startTime} - ${endTime}. The booking is not confirmed until full payment succeeds.`
        : isFreeReservation
          ? `${selectedVenuePresentation?.name ?? "Your venue"} is now reserved for ${formatBookingDate(date)} at ${startTime} - ${endTime}.`
          : `Your reservation for ${selectedVenuePresentation?.name ?? "your venue"} is confirmed after full payment.`;

      handleReset();
      onSuccess?.();
      setSuccessNotice({
        title: successTitle,
        message: successMessage,
      });
    } catch (err: unknown) {
      setApiError(
        err instanceof Error
          ? err.message
          : "Reservation failed. Please try again.",
      );
    }
  };

  const handleConfirm = () => {
    if (!canConfirm || !selectedVenue) return;

    const venueName = selectedVenuePresentation?.name ?? "your venue";
    const scheduleLabel = `${formatBookingDate(date)} at ${startTime} - ${endTime}`;

    if (isFreeReservation) {
      setReservationConfirmation({
        title: "Confirm reservation?",
        message: `Reserve ${venueName} for ${scheduleLabel}. No upfront payment will be collected for this booking.`,
        yesLabel: "Confirm Reservation",
      });
      return;
    }

    if (!canUsePaymongo) {
      setIsPaymongoNoticeOpen(true);
      return;
    }

    if (paymentOption === "paymongo_full") {
      setReservationConfirmation({
        title: "Review policy and pay?",
        message: `Pay the full ${formatCurrency(amountDueNow)} through PayMongo for ${venueName} on ${scheduleLabel}. The booking is not confirmed if payment fails or is abandoned.\n\nCancellation and refund policy: ${FITTRACK_PAYMENT_POLICY_SUMMARY}`,
        yesLabel: FITTRACK_PAYMENT_ACCEPTANCE_LABEL,
      });
      return;
    }
  };

  return (
    <Fragment>
      <Modal
        visible={
          isVisible &&
          reservationConfirmation == null &&
          successNotice == null &&
          !isPaymongoNoticeOpen &&
          !isCalOpen &&
          !isTimeOpen
        }
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <Animated.View style={[s.card, cardStyle]}>
            <Animated.View style={[s.header, headerBorderStyle]}>
              <View style={s.headerIcon}>
                <CalendarDays size={18} color={colors.brand} strokeWidth={2} />
              </View>
              <View style={s.headerText}>
                <FitText style={s.headerTitle}>Make a Reservation</FitText>
                <FitText style={s.headerSubtitle}>
                  {selectedVenuePresentation
                    ? `${selectedVenuePresentation.emoji} ${selectedVenuePresentation.name} / PHP ${selectedVenuePresentation.price}/${selectedVenuePresentation.unit}`
                    : "Book a reservable venue"}
                </FitText>
              </View>
            </Animated.View>
            <FitModalScrollView
              style={s.middle}
              contentContainerStyle={s.body}
              resetKey={isVisible}
            >
              <FitText style={s.sectionLabel}>DATE</FitText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reservation date: ${date ? formatBookingDate(date) : "Select a date"}`}
                style={[
                  s.fieldBtn,
                  { borderColor: date ? colors.brand : colors.fieldBorder },
                ]}
                onPress={() => setIsCalOpen(true)}
              >
                <CalendarDays
                  size={16}
                  color={date ? colors.brand : colors.textMuted}
                  strokeWidth={2}
                />
                <FitText
                  style={[
                    s.fieldBtnText,
                    date && { color: colors.textPrimary },
                  ]}
                >
                  {date ? formatBookingDate(date) : "Select a date"}
                </FitText>
              </Pressable>
              <FitText style={[s.sectionLabel, { marginTop: 16 }]}>
                TIME RANGE
              </FitText>
              <View style={s.twoFieldRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Start time: ${startTime || "Select start time"}`}
                  accessibilityState={{ disabled: !canOpenStartTime }}
                  style={[
                    s.fieldBtn,
                    s.fieldBtnFlex,
                    {
                      borderColor: startTime
                        ? colors.brand
                        : colors.fieldBorder,
                      opacity: canOpenStartTime ? 1 : 0.45,
                    },
                  ]}
                  onPress={() => {
                    if (!canOpenStartTime) return;
                    setTimeTarget("start");
                    setIsTimeOpen(true);
                  }}
                  disabled={!canOpenStartTime}
                >
                  <Clock
                    size={16}
                    color={startTime ? colors.brand : colors.textMuted}
                    strokeWidth={2}
                  />
                  <FitText
                    style={[
                      s.fieldBtnText,
                      startTime && { color: colors.textPrimary },
                    ]}
                  >
                    {startTime || "Start Time"}
                  </FitText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`End time: ${endTime || "Select end time"}`}
                  accessibilityState={{ disabled: !canOpenEndTime }}
                  style={[
                    s.fieldBtn,
                    s.fieldBtnFlex,
                    {
                      borderColor: endTime ? colors.brand : colors.fieldBorder,
                      opacity: canOpenEndTime ? 1 : 0.45,
                    },
                  ]}
                  onPress={() => {
                    if (!canOpenEndTime) return;
                    setTimeTarget("end");
                    setIsTimeOpen(true);
                  }}
                  disabled={!canOpenEndTime}
                >
                  <Clock
                    size={16}
                    color={endTime ? colors.brand : colors.textMuted}
                    strokeWidth={2}
                  />
                  <FitText
                    style={[
                      s.fieldBtnText,
                      endTime && { color: colors.textPrimary },
                    ]}
                  >
                    {endTime || "End Time"}
                  </FitText>
                </Pressable>
              </View>
              {startTime === "" || endTime === "" ? (
                <FitText style={s.validationHint}>
                  Start and end time are required
                </FitText>
              ) : null}
              {timeAvailabilityMessage !== "" ? (
                <FitText
                  style={
                    selectedVenue && !availabilityLoading && !availabilityError
                      ? s.unavailableText
                      : s.validationHint
                  }
                >
                  {timeAvailabilityMessage}
                </FitText>
              ) : null}
              {isSelectedStartInPast ? (
                <FitText style={s.unavailableText}>
                  Same-day reservations must use a future start time.
                </FitText>
              ) : null}
              {hasConflict ? (
                <FitText style={s.unavailableText}>
                  The selected time overlaps an active booking.
                </FitText>
              ) : null}
              {hasMemberTimeOverlap ? (
                <FitText style={s.unavailableText}>
                  You already have a booking in this time window.
                </FitText>
              ) : null}
              {apiError !== "" ? (
                <FitText style={s.unavailableText}>{apiError}</FitText>
              ) : null}
              <FitText style={[s.sectionLabel, { marginTop: 16 }]}>
                VENUE
              </FitText>
              <View style={s.amenityGrid}>
                {bookableVenues.map(({ venue, presentation }) => {
                  const isActive = selectedVenue?.id === venue.id;
                  return (
                    <Pressable
                      key={venue.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${presentation.name}, PHP ${presentation.price}/${presentation.unit}${isActive ? ", selected" : ""}`}
                      accessibilityState={{ selected: isActive }}
                      style={[
                        s.amenityCard,
                        isActive && {
                          borderColor: colors.brand,
                          backgroundColor: colors.brand + "12",
                        },
                      ]}
                      onPress={() => {
                        setSelectedVenue(isActive ? null : venue);
                        setStartTime("");
                        setEndTime("");
                        setSelectedCoachId(null);
                        setIsCoachPickerOpen(false);
                      }}
                    >
                      <FitText style={s.amenityEmoji}>
                        {presentation.name.slice(0, 1)}
                      </FitText>
                      <FitText
                        style={[
                          s.amenityName,
                          isActive && {
                            color: colors.brand,
                            fontWeight: "600",
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {presentation.name}
                      </FitText>
                      <FitText
                        style={[
                          s.amenityPrice,
                          isActive && { color: colors.brand },
                        ]}
                      >
                        PHP {presentation.price}/{presentation.unit}
                      </FitText>
                      {isActive ? (
                        <View style={s.amenityCheck}>
                          <CheckCircle
                            size={14}
                            color={colors.brand}
                            strokeWidth={2}
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              <View style={s.notesSectionHeader}>
                <FitText
                  style={[s.sectionLabel, { marginTop: 16, marginBottom: 0 }]}
                >
                  COACH ADD-ON
                </FitText>
                <FitText style={s.optionalLabel}>Optional</FitText>
              </View>
              <FitText style={s.validationHint}>
                Review a coach profile here if you want to attach one to this
                venue reservation.
              </FitText>
              {coachesLoading ? (
                <FitText style={s.validationHint}>
                  Loading coach profiles...
                </FitText>
              ) : coachesError ? (
                <FitText style={s.unavailableText}>
                  {coachesError instanceof Error
                    ? coachesError.message
                    : "Unable to load coach profiles."}
                </FitText>
              ) : coaches.length === 0 || availableCoachAddOns.length === 0 ? (
                <FitText style={s.validationHint}>
                  No coach add-ons are available for the selected date and time.
                </FitText>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      selectedCoach
                        ? `Coach add-on: ${getCoachName(selectedCoach)}`
                        : "Coach add-on: none"
                    }
                    accessibilityState={{ expanded: isCoachPickerOpen }}
                    style={[
                      s.fieldBtn,
                      {
                        borderColor: selectedCoach
                          ? colors.brand
                          : colors.fieldBorder,
                      },
                    ]}
                    onPress={() => setIsCoachPickerOpen((current) => !current)}
                  >
                    <Users
                      size={16}
                      color={selectedCoach ? colors.brand : colors.textMuted}
                      strokeWidth={2}
                    />
                    <FitText
                      style={[
                        s.fieldBtnText,
                        selectedCoach && { color: colors.textPrimary },
                      ]}
                    >
                      {selectedCoach
                        ? `${getCoachName(selectedCoach)} / ${getCoachPriceLabel(selectedCoach)}`
                        : "No coach add-on"}
                    </FitText>
                    <ChevronDown
                      size={16}
                      color={colors.textMuted}
                      strokeWidth={2}
                      style={{
                        transform: [
                          { rotate: isCoachPickerOpen ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                  </Pressable>
                  {isCoachPickerOpen ? (
                    <View style={s.trainerList}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove coach add-on"
                        style={[
                          s.trainerRow,
                          !selectedCoach && {
                            borderColor: colors.brand,
                            backgroundColor: colors.brand + "12",
                          },
                        ]}
                        onPress={() => {
                          setSelectedCoachId(null);
                          setIsCoachPickerOpen(false);
                        }}
                      >
                        <FitText style={s.trainerName}>No coach add-on</FitText>
                      </Pressable>
                      {availableCoachAddOns.map((coach) => {
                        const isActive = selectedCoach?.id === coach.id;
                        return (
                          <Pressable
                            key={coach.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${getCoachName(coach)}, ${coach.specialties?.[0] ?? "General Coaching"}, ${getCoachPriceLabel(coach)}, ${getCoachRatingLabel(coach)}${isActive ? ", selected" : ""}`}
                            accessibilityState={{ selected: isActive }}
                            style={[
                              s.trainerRow,
                              isActive && {
                                borderColor: colors.brand,
                                backgroundColor: colors.brand + "12",
                              },
                            ]}
                            onPress={() => {
                              setApiError("");
                              setSelectedCoachId(
                                isActive ? null : String(coach.id),
                              );
                              setIsCoachPickerOpen(false);
                            }}
                          >
                            <View
                              style={[
                                s.trainerAvatar,
                                isActive && { backgroundColor: colors.brand },
                              ]}
                            >
                              <FitText
                                style={[
                                  s.trainerAvatarText,
                                  isActive && { color: colors.surface },
                                ]}
                              >
                                {getCoachInitials(coach)}
                              </FitText>
                            </View>
                            <View style={s.trainerInfo}>
                              <FitText style={s.trainerName}>
                                {getCoachName(coach)}
                              </FitText>
                              <FitText style={s.trainerSpecialty}>
                                {coach.specialties?.[0] ?? "General Coaching"}{" "}
                                {" - "} {getCoachPriceLabel(coach)}
                              </FitText>
                              <FitText style={s.trainerRating}>
                                {getCoachRatingLabel(coach)}
                              </FitText>
                              <FitText style={s.validationHint}>
                                {coach.bio?.trim() ||
                                  "Staff has not added a coach bio yet."}
                              </FitText>
                            </View>
                            {isActive ? (
                              <Users
                                size={18}
                                color={colors.brand}
                                strokeWidth={2}
                              />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </>
              )}
              <FitText
                style={
                  coachMatchesWindow ? s.validationHint : s.unavailableText
                }
              >
                {coachStatusMessage}
              </FitText>
              <FitText style={[s.sectionLabel, { marginTop: 16 }]}>
                VENUE RATE
              </FitText>
              <View style={[s.inputFieldWrap, { opacity: 0.6 }]}>
                <FitText style={s.inputPrefix}>PHP</FitText>
                <FitText style={s.inputField}>
                  {basePrice > 0 ? String(basePrice) : "—"}
                </FitText>
              </View>
              {startTime && endTime ? (
                <>
                  <FitText style={[s.sectionLabel, { marginTop: 16 }]}>
                    PAYMENT OPTIONS
                  </FitText>
                  {isFreeReservation ? (
                    <View style={s.paymentSummaryCard}>
                      <FitText style={s.paymentSummaryEyebrow}>
                        Free access
                      </FitText>
                      <FitText style={s.paymentSummaryTitle}>
                        No upfront payment required
                      </FitText>
                      <FitText style={s.paymentSummaryBody}>
                        This reservation currently prices at{" "}
                        {formatCurrency(totalAmount)} for {reservationHours}{" "}
                        hour
                        {reservationHours === 1 ? "" : "s"}.
                      </FitText>
                    </View>
                  ) : (
                    <>
                      <View style={s.paymentSummaryCard}>
                        <FitText style={s.paymentSummaryEyebrow}>
                          {paymentOptionSummary.eyebrow}
                        </FitText>
                        <FitText style={s.paymentSummaryTitle}>
                          {paymentOptionSummary.title}
                        </FitText>
                        <FitText style={s.paymentSummaryBody}>
                          {paymentOptionSummary.body}
                        </FitText>
                        <View style={s.paymentSummaryRow}>
                          <FitText style={s.paymentSummaryLabel}>
                            Venue subtotal
                          </FitText>
                          <FitText style={s.paymentSummaryValue}>
                            {formatCurrency(venueTotalAmount)}
                          </FitText>
                        </View>
                        {selectedCoach ? (
                          <View style={s.paymentSummaryRow}>
                            <FitText style={s.paymentSummaryLabel}>
                              Coach add-on
                            </FitText>
                            <FitText style={s.paymentSummaryValue}>
                              {formatCurrency(coachAddOnAmount)}
                            </FitText>
                          </View>
                        ) : null}
                        <View style={s.paymentSummaryRow}>
                          <FitText style={s.paymentSummaryLabel}>
                            Reservation total
                          </FitText>
                          <FitText style={s.paymentSummaryValue}>
                            {formatCurrency(totalAmount)}
                          </FitText>
                        </View>
                        <View style={s.paymentSummaryRow}>
                          <FitText style={s.paymentSummaryLabel}>
                            Due now
                          </FitText>
                          <FitText style={s.paymentSummaryValue}>
                            {formatCurrency(amountDueNow)}
                          </FitText>
                        </View>
                        <FitText style={s.paymentSummaryDeadline}>
                          Full payment is due through PayMongo before this
                          reservation is confirmed.
                        </FitText>
                      </View>
                    </>
                  )}
                </>
              ) : null}
              <View style={s.notesSectionHeader}>
                <FitText
                  style={[s.sectionLabel, { marginTop: 16, marginBottom: 0 }]}
                >
                  NOTES
                </FitText>
                <FitButton
                  variant="link"
                  icon={Plus}
                  iconOnly
                  label="Add reservation note"
                  iconSize={18}
                  onPress={() => setNotes((prev) => [...prev, ""])}
                  disabled={notes.length >= 10}
                />
              </View>
              {notes.map((note, idx) => {
                const atLimit = note.length >= 50;
                const counterColor =
                  note.length === 50
                    ? colors.danger
                    : note.length >= 40
                      ? colors.warning
                      : colors.textMuted;
                return (
                  <View key={idx} style={s.noteRow}>
                    <View style={s.noteContent}>
                      <View style={[s.inputFieldWrap, s.noteFieldWrap]}>
                        <FitText style={s.noteBullet}>-</FitText>
                        <FitTextInput
                          nativeID={`reservation-note-${idx + 1}`}
                          accessibilityLabel={`Reservation note ${idx + 1}`}
                          value={note}
                          onChangeText={(text) => {
                            if (text.length > 50) return;
                            setNotes((prev) =>
                              prev.map((currentNote, noteIndex) =>
                                noteIndex === idx ? text : currentNote,
                              ),
                            );
                          }}
                          placeholder="Add a note..."
                          multiline
                          style={[
                            s.noteInput,
                            atLimit && { color: colors.warning },
                          ]}
                        />
                      </View>
                      <FitText style={[s.noteCounter, { color: counterColor }]}>
                        {note.length}/50
                      </FitText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove reservation note ${idx + 1}`}
                      onPress={() =>
                        setNotes((prev) =>
                          prev.filter((_, noteIndex) => noteIndex !== idx),
                        )
                      }
                      hitSlop={8}
                      style={s.noteRemoveBtn}
                    >
                      <XCircle
                        size={16}
                        color={colors.textMuted}
                        strokeWidth={2}
                      />
                    </Pressable>
                  </View>
                );
              })}
              {notes.length === 0 ? (
                <FitText style={s.notesEmptyHint}>Tap + to add a note</FitText>
              ) : null}
            </FitModalScrollView>
            <Animated.View style={[s.footer, footerBorderStyle]}>
              <FitButton
                label="Cancel"
                variant="ghost"
                onPress={handleClose}
                disabled={isSubmitting}
                flex={1}
              />
              <FitButton
                label={isSubmitting ? reservingText : confirmButtonLabel}
                variant="primary"
                onPress={handleConfirm}
                disabled={!canConfirm || isSubmitting}
                loading={isSubmitting}
                flex={2}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Modal>
      <NoticeModal
        isVisible={isPaymongoNoticeOpen}
        title={PAYMONGO_AVAILABILITY.modalTitle}
        message={PAYMONGO_AVAILABILITY.modalBody}
        onClose={() => setIsPaymongoNoticeOpen(false)}
      />
      <NoticeModal
        isVisible={successNotice != null}
        title={successNotice?.title ?? "Reservation updated"}
        message={successNotice?.message ?? ""}
        onClose={() => {
          setSuccessNotice(null);
          onClose();
        }}
      />
      <ConfirmModal
        isVisible={reservationConfirmation != null}
        title={reservationConfirmation?.title ?? "Confirm action"}
        message={reservationConfirmation?.message ?? ""}
        yesLabel={reservationConfirmation?.yesLabel ?? "Confirm"}
        noLabel="Cancel"
        isLoading={isSubmitting}
        loadingLabel={confirmButtonLabel.toUpperCase()}
        loadingTitle="Submitting reservation"
        onNo={() => {
          if (isSubmitting) return;
          setReservationConfirmation(null);
        }}
        onYes={() => {
          void submitReservation();
        }}
      />
      <CalendarModal
        isVisible={isCalOpen}
        selectedDate={date}
        blockPast
        maxDate={maxBookableDateKey}
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        blockedDates={calendarBlockedDates}
        highlightedDates={calendarHighlightedDates}
        onVisibleMonthChange={handleCalendarMonthChange}
        onSelect={(selectedDate) => {
          setDate(selectedDate);
          setStartTime("");
          setEndTime("");
          setSelectedCoachId(null);
          setIsCalOpen(false);
        }}
        onClose={() => setIsCalOpen(false)}
      />
      <TimeSlotModal
        isVisible={isTimeOpen}
        slots={timeTarget === "start" ? startSlots : endSlots}
        selectedTime={timeTarget === "start" ? startTime : endTime}
        emptyMessage={
          timeTarget === "start"
            ? "No venue time slots are available for the selected date."
            : "No continuous end time is available after the selected start."
        }
        onSelect={handleTimePick}
        onClose={() => setIsTimeOpen(false)}
      />
    </Fragment>
  );
}
