import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Linking, Modal, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  CalendarDays,
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
  PAYMONGO_AVAILABILITY,
  WEEKDAY_NAMES,
  isPaymongoCheckoutEnabled,
} from "@fittrack/app-config";
import {
  isVenueBookable,
  resolveAmenityId,
  toApiClientError,
  type BookingCheckoutResponse,
  VenueBookingRecord,
  VenueAvailabilityRecord,
} from "@fittrack/api-client";
import type { CoachProfileRecord } from "@fittrack/types";

import {
  activeCoachesQueryOptions,
  bookingsQueryOptions,
  createBookingMutationOptions,
  venueAvailabilityQueryOptions,
  venuesQueryOptions,
} from "@fittrack/query";
import { formatBookingDate } from "@fittrack/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBookingCheckoutRecoveryNotice,
  useBookingCheckoutRecoveryScope,
} from "@/contexts/BookingCheckoutRecoveryContext";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText } from "@fittrack/hooks";
import {
  createCommerceAttemptIdempotencyKey,
  resolveCheckoutReturnInput,
  useCommerceCheckoutReturn,
} from "@/hooks/commerce/useCommerceCheckoutReturn";
import { makeReservationModalStyles } from "@/styles/modals/ReservationStyles";
import { getVenuePresentation, type VenueRecord } from "@/utils/venueBookings";

import { FitButton, FitText, FitTextInput } from "@/components/fit";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import NoticeModal from "@/components/modals/shared/NoticeModal";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
import CheckoutRecoveryModal from "@/components/modals/booking/CheckoutRecoveryModal";
import TimeSlotModal, {
  type TimeSlot,
} from "@/components/modals/shared/TimeSlotModal";
import SearchableBookingPickerModal, {
  type BookingPickerOption,
} from "@/components/modals/booking/SearchableBookingPickerModal";
import { resolveReservationPreselection } from "./reservationPreselection";

type Props = {
  isVisible: boolean;
  preselectedVenueId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
};

type ReservationConfirmationState = {
  message: string;
  title: string;
  yesLabel: string;
};

const MEMBER_OVERLAP_STATUSES = new Set([
  "confirmed",
]);

function formatAvailabilityError(error: unknown) {
  const apiError = toApiClientError(error, "Unable to load venue availability.");
  if (apiError.status === 400 || apiError.status === 404 || apiError.status === 422) {
    return apiError.message;
  }
  return "Couldn't load available times. Please retry.";
}

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
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  const parsed = new Date(timestamp + 8 * 60 * 60 * 1000);
  const hours = parsed.getUTCHours();
  const minutes = parsed.getUTCMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const normalizedHour = hours % 12 || 12;
  return `${String(normalizedHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

function isoTimeToMinutes(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 0;
  const parsed = new Date(timestamp + 8 * 60 * 60 * 1000);
  return parsed.getUTCHours() * 60 + parsed.getUTCMinutes();
}

function getGymTodayString() {
  const gymNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${gymNow.getUTCFullYear()}-${String(gymNow.getUTCMonth() + 1).padStart(2, "0")}-${String(gymNow.getUTCDate()).padStart(2, "0")}`;
}

function getGymCurrentMinutes() {
  const gymNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return gymNow.getUTCHours() * 60 + gymNow.getUTCMinutes();
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
  const cursor = new Date(`${getGymTodayString()}T00:00:00`);
  for (let offset = 0; offset < 90; offset += 1) {
    const nextDate = new Date(cursor);
    nextDate.setDate(cursor.getDate() + offset);
    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, "0");
    const day = String(nextDate.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;
    const hasOpenCoach = coaches.some(
      (coach) =>
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
  const [gymYear, gymMonth, gymDay] = getGymTodayString().split("-").map(Number);
  const maxDate = new Date(Date.UTC(gymYear + 1, gymMonth - 1, gymDay));
  return formatDateKey(
    maxDate.getUTCFullYear(),
    maxDate.getUTCMonth() + 1,
    maxDate.getUTCDate(),
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
  const todayKey = getGymTodayString();

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
  if (!selectedDate || !selectedStartTime || !selectedEndTime) return false;

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

function getCoachPriceLabel(coach: CoachProfileRecord) {
  if (coach.hourlyRate == null || !Number.isFinite(coach.hourlyRate)) {
    return "Rate unavailable";
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
  preselectedVenueId,
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
  const attemptIdempotencyKeyRef = useRef<string | null>(null);
  const getAttemptIdempotencyKey = () => {
    if (!attemptIdempotencyKeyRef.current) {
      attemptIdempotencyKeyRef.current =
        createCommerceAttemptIdempotencyKey();
    }
    return attemptIdempotencyKeyRef.current;
  };
  const canUsePaymongo = isPaymongoCheckoutEnabled();
  const [date, setDate] = useState(getGymTodayString());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [isCoachPickerOpen, setIsCoachPickerOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<VenueRecord | null>(null);
  const [isVenuePickerOpen, setIsVenuePickerOpen] = useState(false);
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const initialDate = getDateParts(getGymTodayString());
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
  const [isCheckoutRecoveryModalOpen, setIsCheckoutRecoveryModalOpen] =
    useState(false);
  const [timeTarget, setTimeTarget] = useState<"start" | "end">("start");
  const isSubmitting = createBookingMutation.isPending;
  const [apiError, setApiError] = useState("");
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [venueFieldError, setVenueFieldError] = useState("");
  const resetFormRef = useRef<() => void>(() => undefined);
  const bookingRecoveryScope = useBookingCheckoutRecoveryScope();
  const bookingTerminalNotice = useBookingCheckoutRecoveryNotice();
  const isBookingTerminalNoticeActive = bookingTerminalNotice != null;
  const publishTerminalNotice = (notice: {
    message: string;
    title: string;
  }) => {
    if (bookingRecoveryScope) {
      bookingRecoveryScope.publishNotice(notice);
      return;
    }
    setSuccessNotice(notice);
  };
  const checkoutReturn = useCommerceCheckoutReturn({
    isActive: isVisible,
    onSucceeded: async () => {
      attemptIdempotencyKeyRef.current = null;
      resetFormRef.current();
      publishTerminalNotice({
        title: "Reservation confirmed",
        message:
          "Your full PayMongo payment was confirmed. The reservation is now available in Bookings.",
      });
      onSuccess?.();
    },
    onTerminal: async (_, state) => {
      attemptIdempotencyKeyRef.current = null;
      resetFormRef.current();
      publishTerminalNotice({
        title: "Checkout not completed",
        message:
          state === "expired"
            ? "The PayMongo checkout expired. No reservation was confirmed."
            : "The PayMongo checkout was not completed. No reservation was confirmed.",
      });
    },
    onCancelled: async (attempt) => {
      attemptIdempotencyKeyRef.current = null;
      resetFormRef.current();
      publishTerminalNotice({
        title: "Checkout cancelled",
        message:
          attempt.failureReason?.trim()
            ? `Your checkout was cancelled. ${attempt.failureReason.trim()} No reservation was confirmed, and you can start another reservation.`
            : "Your checkout was cancelled. No reservation was confirmed, and you can start another reservation.",
      });
    },
    sharedScope: "booking",
  });
  const isCheckoutActive = checkoutReturn.attempt != null;
  const isBusy = isSubmitting;
  const reservingText = useLoadingText("Reserving", isBusy);
  const checkoutHoldId = checkoutReturn.attempt?.holdId ?? null;

  useEffect(() => {
    if (!checkoutHoldId) {
      setIsCheckoutRecoveryModalOpen(false);
      return;
    }
    if (isVisible && successNotice == null) {
      setIsCheckoutRecoveryModalOpen(true);
    }
  }, [checkoutHoldId, isVisible, successNotice]);

  const {
    data: venues = [],
    error: venuesError,
    isLoading: venuesLoading,
    refetch: refetchVenues,
  } = useQuery({
    ...venuesQueryOptions(mobileApiClient, user?.id),
    enabled: isVisible,
  });
  const {
    data: coaches = [],
    isLoading: coachesLoading,
    error: coachesError,
    refetch: refetchCoaches,
  } = useQuery({
    ...activeCoachesQueryOptions<CoachProfileRecord>(mobileApiClient),
    enabled: isVisible,
  });

  const bookableVenues = useMemo(
    () => {
      return venues
        .flatMap((venue) => {
          const amenityId = resolveAmenityId(venue.id);
          return amenityId && isVenueBookable(venue)
            ? [{ ...venue, id: amenityId }]
            : [];
        })
        .sort(
          (left, right) =>
            (left.displayOrder ?? Number.MAX_SAFE_INTEGER) -
              (right.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
            left.name.localeCompare(right.name),
        )
        .map((venue) => ({
          venue,
          presentation: getVenuePresentation(venue),
        }));
    },
    [venues],
  );
  const selectedBookableVenue = useMemo(
    () =>
      selectedVenue
        ? (bookableVenues.find(
            ({ venue }) => String(venue.id) === String(selectedVenue.id),
          )?.venue ?? null)
        : null,
    [bookableVenues, selectedVenue],
  );
  useEffect(() => {
    if (!isVisible || !preselectedVenueId) return;
    const match = resolveReservationPreselection(
      bookableVenues.map(({ venue }) => venue),
      preselectedVenueId,
    );
    if (match) {
      setSelectedVenue(match);
      setVenueFieldError("");
    }
  }, [bookableVenues, isVisible, preselectedVenueId]);
  const selectedVenuePresentation = useMemo(
    () =>
      selectedBookableVenue
        ? getVenuePresentation(selectedBookableVenue)
        : null,
    [selectedBookableVenue],
  );
  const selectedVenueId = selectedBookableVenue?.id;
  const selectedCoach = useMemo(
    () => coaches.find((coach) => String(coach.id) === selectedCoachId) ?? null,
    [coaches, selectedCoachId],
  );
  const isCoachWindowSelected = Boolean(date && startTime && endTime);
  const coachWindowAvailability = useMemo(
    () =>
      coaches.map((coach) => ({
        coach,
        isAvailableForWindow: !isCoachWindowSelected
          ? true
          : coachCoversReservationWindow(coach, date, startTime, endTime),
      })),
    [coaches, date, endTime, isCoachWindowSelected, startTime],
  );
  const availableCoachAddOns = useMemo(
    () =>
      coachWindowAvailability
        .filter((entry) => entry.isAvailableForWindow)
        .map((entry) => entry.coach),
    [coachWindowAvailability],
  );
  const selectedCoachCoversWindow = useMemo(() => {
    if (!selectedCoach) return true;
    if (!isCoachWindowSelected) return true;
    return coachCoversReservationWindow(selectedCoach, date, startTime, endTime);
  }, [date, endTime, isCoachWindowSelected, selectedCoach, startTime]);
  const venuePickerOptions = useMemo<BookingPickerOption[]>(
    () =>
      bookableVenues.map(({ venue, presentation }) => ({
        id: String(venue.id),
        keywords: [venue.name],
        subtitle: `PHP ${presentation.price}/${presentation.unit}`,
        title: presentation.name,
      })),
    [bookableVenues],
  );
  const coachAddOnPickerOptions = useMemo<BookingPickerOption[]>(
    () => [
      {
        detail: "Reserve the venue without coaching.",
        id: "none",
        title: "No coach add-on",
      },
      ...coachWindowAvailability.map(({ coach, isAvailableForWindow }) => ({
        detail: coach.bio?.trim() || "No coach bio has been added yet.",
        disabled: isCoachWindowSelected && !isAvailableForWindow,
        id: String(coach.id),
        keywords: [coach.contactEmail, ...(coach.specialties ?? [])].filter(
          Boolean,
        ) as string[],
        subtitle:
          `${coach.specialties?.[0] ?? "General Coaching"} · ${getCoachPriceLabel(coach)} · ${getCoachRatingLabel(coach)}` +
          (isCoachWindowSelected && !isAvailableForWindow
            ? " · Unavailable for selected time"
            : ""),
        title: getCoachName(coach),
      })),
    ],
    [coachWindowAvailability, isCoachWindowSelected],
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
    selectedBookableVenue != null
      ? highlightedVenueDates
      : fallbackCoachAvailabilityDates;
  const calendarBlockedDates =
    selectedBookableVenue != null ? blockedVenueDates : [];
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
    isFetching: availabilityFetching,
    isPending: availabilityPending,
    isSuccess: availabilitySuccess,
    fetchStatus: availabilityFetchStatus,
    refetch: refetchAvailability,
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
      !selectedVenue ||
      selectedBookableVenue ||
      venuesLoading ||
      venuesError
    ) {
      return;
    }

    setSelectedVenue(null);
    setStartTime("");
    setEndTime("");
    setSelectedCoachId(null);
    setApiError("Selected venue is no longer available. Choose another venue.");
  }, [selectedBookableVenue, selectedVenue, venuesError, venuesLoading]);

  useEffect(() => {
    if (!isCoachWindowSelected || !selectedCoachId) return;
    if (!selectedCoachCoversWindow) {
      setSelectedCoachId(null);
    }
  }, [isCoachWindowSelected, selectedCoachCoversWindow, selectedCoachId]);

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
  const paymentProvider = "paymongo" as const;
  const paymentStage = "full" as const;
  const hasValidPricing = totalAmount > 0;
  const currentMinutes = getGymCurrentMinutes();
  const minimumReservationHours = Math.max(
    1,
    Number(selectedBookableVenue?.minimumHours ?? 1),
  );
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
  const confirmButtonLabel = canUsePaymongo
    ? "Pay in full"
    : "PayMongo unavailable";
  const paymentOptionSummary = useMemo(() => {
    return {
      body: canUsePaymongo
        ? `Pay the full ${formatCurrency(totalAmount)} through PayMongo. Your reservation is confirmed after successful checkout.`
        : "PayMongo checkout is unavailable right now. Try again later.",
      eyebrow: canUsePaymongo ? "PayMongo" : "PayMongo unavailable",
      title: "Full payment required",
    };
  }, [canUsePaymongo, totalAmount]);

  const startSlots = useMemo(
    () =>
      liveVenueSlots
        .filter((slot, startIndex) => {
          if (slot.status !== "available") return false;
          if (
            date === getGymTodayString() &&
            isoTimeToMinutes(slot.startTime) <= currentMinutes
          ) {
            return false;
          }

          const startMs = Date.parse(slot.startTime);
          let expectedStart = startMs;
          for (let index = startIndex; index < liveVenueSlots.length; index += 1) {
            const candidate = liveVenueSlots[index];
            if (candidate.status !== "available") return false;
            if (Date.parse(candidate.startTime) !== expectedStart) return false;
            const candidateEnd = Date.parse(candidate.endTime);
            if (
              candidateEnd - startMs >=
              minimumReservationHours * 60 * 60 * 1000
            ) {
              return true;
            }
            expectedStart = candidateEnd;
          }
          return false;
        })
        .map(toVenueStartSlot),
    [currentMinutes, date, liveVenueSlots, minimumReservationHours],
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
      const durationHours =
        (Date.parse(slot.endTime) -
          Date.parse(liveVenueSlots[startIdx].startTime)) /
        (60 * 60 * 1000);
      if (durationHours >= minimumReservationHours) {
        result.push({
          time: endLabel,
          duration: formatDurationLabel(startTime, endLabel),
          status: "available",
        });
      }
      expectedStart = new Date(slot.endTime).getTime();
    }
    return result;
  }, [liveVenueSlots, minimumReservationHours, startTime]);
  const availabilityErrorMessage = useMemo(
    () => (availabilityError ? formatAvailabilityError(availabilityError) : null),
    [availabilityError],
  );
  const hasVerifiedAvailability = Boolean(
    selectedBookableVenue &&
      availabilitySuccess &&
      !availabilityFetching &&
      availabilityFetchStatus !== "paused",
  );
  const hasValidSelectedStart =
    startTime !== "" && startSlots.some((slot) => slot.time === startTime);
  const hasValidSelectedEnd =
    endTime !== "" && endSlots.some((slot) => slot.time === endTime);
  const hasValidSelectedTime =
    hasVerifiedAvailability && hasValidSelectedStart && hasValidSelectedEnd;
  const availabilityGuardMessage = useMemo(() => {
    if (availabilityFetchStatus === "paused") {
      return "Waiting for a connection to check available times.";
    }
    if (availabilityFetching || availabilityPending) {
      return "Checking available times...";
    }
    if (availabilityErrorMessage) return availabilityErrorMessage;
    return "Checking available times...";
  }, [
    availabilityErrorMessage,
    availabilityFetchStatus,
    availabilityFetching,
    availabilityPending,
  ]);
  const isSelectedStartInPast =
    date === getGymTodayString() &&
    startTime !== "" &&
    timeToMinutes(startTime) <= currentMinutes;
  const hasOpenStartSlot = startSlots.some(
    (slot) => slot.status === "available",
  );
  const canOpenStartTime =
    hasVerifiedAvailability && startSlots.length > 0;
  const canOpenEndTime =
    hasVerifiedAvailability && hasValidSelectedStart && endSlots.length > 0;
  const timeAvailabilityMessage = useMemo(() => {
    if (!selectedBookableVenue) {
      return "Select a venue to load live time availability.";
    }
    if (availabilityFetchStatus === "paused") return availabilityGuardMessage;
    if (availabilityFetching || availabilityPending) return availabilityGuardMessage;
    if (availabilityErrorMessage) return availabilityErrorMessage;
    if (
      hasVerifiedAvailability &&
      ((startTime !== "" && !hasValidSelectedStart) ||
        (endTime !== "" && !hasValidSelectedEnd))
    ) {
      return "Choose an available start and end time.";
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
    availabilityErrorMessage,
    availabilityFetchStatus,
    availabilityFetching,
    availabilityGuardMessage,
    availabilityPending,
    endSlots.length,
    endTime,
    hasOpenStartSlot,
    hasValidSelectedEnd,
    hasValidSelectedStart,
    hasVerifiedAvailability,
    selectedBookableVenue,
    startSlots.length,
    startTime,
  ]);
  const showAvailabilityRetry = Boolean(
    selectedBookableVenue &&
      availabilityError &&
      !availabilityFetching &&
      !availabilityPending &&
      availabilityFetchStatus !== "paused",
  );

  const handleRetryAvailability = () => {
    void refetchAvailability({ cancelRefetch: false });
  };

  useEffect(() => {
    if (!isSelectedStartInPast) return;
    setStartTime("");
    setEndTime("");
  }, [isSelectedStartInPast]);

  const hasConflict = useMemo(() => {
    if (!selectedBookableVenue || !date || !startTime || !endTime)
      return false;
    const selStart = timeToMinutes(startTime);
    const selEnd = timeToMinutes(endTime);
    return availability.some((booking) => {
      if (booking.status !== "confirmed")
        return false;
      const bookingStartMinutes = isoTimeToMinutes(booking.startTime);
      const bookingEndMinutes = isoTimeToMinutes(booking.endTime);
      return selStart < bookingEndMinutes && selEnd > bookingStartMinutes;
    });
  }, [availability, date, endTime, selectedBookableVenue, startTime]);

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
    return selectedCoachCoversWindow;
  }, [selectedCoachCoversWindow]);

  const coachStatusMessage = useMemo(() => {
    if (!selectedCoach) {
      return "Keep this venue booking on its own, or attach a coach after reviewing their profile.";
    }
    if (!startTime || !endTime) {
      return "Pick the reservation time first to validate this coach against the selected window.";
    }
    if (!coachMatchesWindow) {
      return "This coach does not currently cover the selected reservation window.";
    }
    return `${getCoachName(selectedCoach)} is available for the selected reservation window.`;
  }, [
    coachMatchesWindow,
    endTime,
    selectedCoach,
    startTime,
  ]);

  const handleReset = () => {
    setDate(getGymTodayString());
    setStartTime("");
    setEndTime("");
    setNotes([]);
    setSelectedCoachId(null);
    setIsCoachPickerOpen(false);
    setSelectedVenue(null);
    setIsVenuePickerOpen(false);
    setTimeTarget("start");
    setIsCalOpen(false);
    setIsTimeOpen(false);
    setApiError("");
    setReviewAttempted(false);
    setVenueFieldError("");
    setSuccessNotice(null);
    setReservationConfirmation(null);
  };
  resetFormRef.current = handleReset;

  const openCheckoutRecovery = () => {
    setReservationConfirmation(null);
    setApiError("");
    setIsCheckoutRecoveryModalOpen(true);
  };

  const handleClose = () => {
    if (isBusy) return;
    setIsCheckoutRecoveryModalOpen(false);
    handleReset();
    if (!isCheckoutActive) {
      attemptIdempotencyKeyRef.current = null;
    }
    onClose();
  };

  const handleTimePick = (slot: TimeSlot) => {
    setApiError("");
    if (timeTarget === "start") {
      setStartTime(slot.time);
      setEndTime("");
      setIsTimeOpen(false);
      return;
    }
    setEndTime(slot.time);
    setIsTimeOpen(false);
  };

  const rejectSubmit = (message: string) => {
    setReservationConfirmation(null);
    setApiError(message);
  };

  const submitReservation = async () => {
    if (isBusy) return;
    if (isCheckoutActive) {
      openCheckoutRecovery();
      return;
    }
    if (!selectedBookableVenue) {
      setReservationConfirmation(null);
      setVenueFieldError("A venue is required before confirming this reservation.");
      return;
    }
    if (!date || !startTime || !endTime) {
      setReviewAttempted(true);
      rejectSubmit("Please choose a reservation date, start time, and end time.");
      return;
    }
    if (reservationHours <= 0 || !hasValidPricing) {
      rejectSubmit("This venue does not have a valid checkout price yet.");
      return;
    }
    if (isSelectedStartInPast) {
      rejectSubmit("Same-day reservations must use a future start time.");
      return;
    }
    if (!hasVerifiedAvailability) {
      setReservationConfirmation(null);
      return;
    }
    if (!hasValidSelectedTime) {
      setReservationConfirmation(null);
      return;
    }
    if (!canUsePaymongo) {
      rejectSubmit("PayMongo checkout is currently unavailable.");
      return;
    }
    if (hasConflict) {
      rejectSubmit("The selected time overlaps an active booking.");
      return;
    }
    if (hasMemberTimeOverlap) {
      rejectSubmit("You already have a booking in this time window.");
      return;
    }
    setApiError("");
    const startMinutes = timeToMinutes(startTime);
    const isoStart = toGymWallClockIso(date, startMinutes);
    const purpose =
      notes.filter((note) => note.trim() !== "").join("\n") || undefined;
    if (selectedCoach && !coachMatchesWindow) {
      rejectSubmit(
        "Selected coach does not currently cover this reservation window.",
      );
      return;
    }
    try {
      const result: BookingCheckoutResponse =
        await createBookingMutation.mutateAsync({
        payload: {
          ...resolveCheckoutReturnInput("bookings"),
          coachId: selectedCoach ? String(selectedCoach.id) : undefined,
          paymentStage,
          provider: paymentProvider,
          idempotencyKey: getAttemptIdempotencyKey(),
          venueId: selectedBookableVenue.id,
          startTime: isoStart,
          durationHours: reservationHours,
          purpose,
        },
        venueId: selectedBookableVenue.id,
        date,
      });
      if (!("holdId" in result) || !result.holdId) {
        throw new Error(
          "PayMongo did not return a checkout status handle. No reservation was confirmed.",
        );
      }

      const checkoutUrl = result.checkoutUrl?.trim();
      if (!checkoutUrl) {
        throw new Error(
          "PayMongo did not return a checkout link. No reservation was confirmed.",
        );
      }

      await Linking.openURL(checkoutUrl);
      checkoutReturn.start(result);
      handleReset();
      setSuccessNotice({
        title: "PayMongo checkout opened",
        message:
          "Complete the full checkout, then return to FitTrack. The reservation will appear after successful confirmation.",
      });
    } catch (err: unknown) {
      attemptIdempotencyKeyRef.current = null;
      setReservationConfirmation(null);
      const message =
        err instanceof Error
          ? err.message
          : "Reservation failed. Please try again.";
      if (/amenity|venue|maintenance|reservable/i.test(message)) {
        setVenueFieldError(message);
        setApiError("");
      } else {
        setApiError(message);
      }
    }
  };

  const handleConfirm = () => {
    if (isBusy) return;
    if (isCheckoutActive) {
      openCheckoutRecovery();
      return;
    }
    setReviewAttempted(true);
    if (!date || !startTime || !endTime) {
      setApiError("Please choose a reservation date, start time, and end time.");
      return;
    }

    if (!selectedBookableVenue) {
      setVenueFieldError("A venue is required before confirming this reservation.");
      return;
    }

    if (reservationHours <= 0 || !hasValidPricing) {
      setApiError("This venue does not have a valid checkout price yet.");
      return;
    }

    if (isSelectedStartInPast) {
      setApiError("Same-day reservations must use a future start time.");
      return;
    }

    if (!hasVerifiedAvailability) {
      return;
    }

    if (!hasValidSelectedTime) {
      return;
    }

    if (existingBookingsLoading) {
      setApiError("Checking existing bookings. Please wait...");
      return;
    }

    if (hasConflict) {
      setApiError("The selected time overlaps an active booking.");
      return;
    }

    if (hasMemberTimeOverlap) {
      setApiError("You already have a booking in this time window.");
      return;
    }

    if (selectedCoach && !coachMatchesWindow) {
      setApiError("Selected coach is not available for the selected reservation window.");
      return;
    }

    const venueName = selectedVenuePresentation?.name ?? "your venue";
    const scheduleLabel = `${formatBookingDate(date)} at ${startTime} - ${endTime}`;

    if (!canUsePaymongo) {
      setIsPaymongoNoticeOpen(true);
      return;
    }

    setReservationConfirmation({
      title: "Review and pay in full?",
      message: `Pay ${formatCurrency(totalAmount)} through PayMongo for ${venueName} on ${scheduleLabel}. The reservation is confirmed only after successful checkout.`,
      yesLabel: "Pay in full",
    });
  };

  return (
    <Fragment>
      <Modal
        visible={
          isVisible &&
          reservationConfirmation == null &&
          successNotice == null &&
          !isCheckoutRecoveryModalOpen &&
          !isBookingTerminalNoticeActive &&
          !isPaymongoNoticeOpen &&
          !isCalOpen &&
          !isTimeOpen &&
          !isVenuePickerOpen &&
          !isCoachPickerOpen
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
              showScrollCue
              showsVerticalScrollIndicator={false}
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
              {reviewAttempted && (startTime === "" || endTime === "") ? (
                <FitText accessibilityRole="alert" style={s.unavailableText}>
                  Start and end time are required
                </FitText>
              ) : null}
              {timeAvailabilityMessage !== "" ? (
                <FitText
                  accessibilityLiveRegion="polite"
                  style={
                    selectedBookableVenue && hasVerifiedAvailability
                      ? s.unavailableText
                      : s.validationHint
                  }
                >
                  {timeAvailabilityMessage}
                </FitText>
              ) : null}
              {showAvailabilityRetry ? (
                <FitButton
                  label="Retry availability"
                  variant="ghost"
                  accessibilityLabel="Retry availability"
                  onPress={handleRetryAvailability}
                />
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedVenuePresentation ? `Selected venue ${selectedVenuePresentation.name}` : "Choose a venue"}
                style={[
                  s.fieldBtn,
                  { borderColor: selectedBookableVenue ? colors.brand : colors.fieldBorder },
                ]}
                onPress={() => setIsVenuePickerOpen(true)}
              >
                <CalendarDays size={16} color={selectedBookableVenue ? colors.brand : colors.textMuted} strokeWidth={2} />
                <FitText style={[s.fieldBtnText, selectedBookableVenue && { color: colors.textPrimary }]}>
                  {selectedVenuePresentation
                    ? `${selectedVenuePresentation.name} · PHP ${selectedVenuePresentation.price}/${selectedVenuePresentation.unit}`
                    : "Search and select a venue"}
                </FitText>
              </Pressable>
              {venueFieldError ? (
                <FitText accessibilityRole="alert" style={s.unavailableText}>
                  {venueFieldError}
                </FitText>
              ) : null}
              {venuesLoading ? (
                <FitText style={s.validationHint}>Loading available venues...</FitText>
              ) : venuesError ? (
                <FitText style={s.unavailableText}>Unable to load available venues. Open the picker to retry.</FitText>
              ) : bookableVenues.length === 0 ? (
                <FitText style={s.validationHint}>No reservable venues are available.</FitText>
              ) : reviewAttempted && !selectedBookableVenue ? (
                <FitText accessibilityRole="alert" style={s.unavailableText}>A venue is required before choosing a live time.</FitText>
              ) : null}
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedCoach ? `Coach add-on ${getCoachName(selectedCoach)}` : "No coach add-on"}
                style={[
                  s.fieldBtn,
                  { borderColor: selectedCoach ? colors.brand : colors.fieldBorder },
                ]}
                onPress={() => setIsCoachPickerOpen(true)}
              >
                <Users size={16} color={selectedCoach ? colors.brand : colors.textMuted} strokeWidth={2} />
                <FitText style={[s.fieldBtnText, selectedCoach && { color: colors.textPrimary }]}>
                  {selectedCoach
                    ? `${getCoachName(selectedCoach)} · ${getCoachPriceLabel(selectedCoach)}`
                    : "No coach add-on"}
                </FitText>
              </Pressable>
              {coachesLoading ? (
                <FitText style={s.validationHint}>Loading coach profiles...</FitText>
              ) : coachesError ? (
                <FitText style={s.unavailableText}>Unable to load coach profiles. Open the picker to retry.</FitText>
              ) : !startTime || !endTime ? (
                <FitText style={s.validationHint}>Choose the reservation time first to validate coach availability.</FitText>
              ) : availableCoachAddOns.length === 0 ? (
                <FitText style={s.validationHint}>No coach add-ons cover this exact date and time.</FitText>
              ) : null}
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
                    CHECKOUT
                  </FitText>
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
                    <FitText style={s.paymentSummaryDeadline}>
                      Pay the full total through PayMongo to confirm this reservation.
                    </FitText>
                  </View>
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
                disabled={isBusy}
                flex={1}
              />
              <FitButton
                label={isBusy ? reservingText : confirmButtonLabel}
                variant="primary"
                onPress={handleConfirm}
                disabled={isBusy || !hasValidSelectedTime}
                loading={isSubmitting}
                flex={2}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Modal>
      {checkoutReturn.attempt ? (
        <CheckoutRecoveryModal
          attempt={checkoutReturn.attempt}
          errorMessage={checkoutReturn.errorMessage}
          isBusy={checkoutReturn.isBusy}
          isVisible={
            isVisible &&
            isCheckoutRecoveryModalOpen &&
            !isBookingTerminalNoticeActive &&
            checkoutReturn.attempt != null
          }
          onCancel={() => {
            void checkoutReturn.cancel();
          }}
          onCheckStatus={() => {
            void checkoutReturn.reconcile();
          }}
          onClose={() => setIsCheckoutRecoveryModalOpen(false)}
          onResume={() => {
            void checkoutReturn.resume();
          }}
          operation={checkoutReturn.operation}
          remainingSeconds={checkoutReturn.remainingSeconds}
        />
      ) : null}
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
          const closeModal = successNotice?.title !== "PayMongo checkout opened";
          setSuccessNotice(null);
          if (closeModal) onClose();
        }}
      />
      <ConfirmModal
        isVisible={reservationConfirmation != null}
        title={reservationConfirmation?.title ?? "Confirm action"}
        message={reservationConfirmation?.message ?? ""}
        yesLabel={reservationConfirmation?.yesLabel ?? "Confirm"}
        noLabel="Cancel"
        isLoading={isBusy}
        loadingLabel={confirmButtonLabel.toUpperCase()}
        loadingTitle="Submitting reservation"
        onNo={() => {
          if (isBusy) return;
          setReservationConfirmation(null);
        }}
        onYes={() => {
          void submitReservation();
        }}
      />
      <SearchableBookingPickerModal
        isVisible={isVenuePickerOpen}
        title="Select a Venue"
        subtitle="Choose a reservable venue from live inventory."
        searchPlaceholder="Search venues"
        options={venuePickerOptions}
        selectedId={selectedBookableVenue ? String(selectedBookableVenue.id) : null}
        isLoading={venuesLoading}
        errorMessage={venuesError ? "Unable to load reservable venues." : null}
        emptyMessage="No reservable venues match this search."
        onRetry={() => {
          void refetchVenues();
        }}
        onSelect={(venueId) => {
          const nextVenue = bookableVenues.find(
            ({ venue }) => String(venue.id) === venueId,
          )?.venue;
          if (!nextVenue) return;
          setSelectedVenue(nextVenue);
          setStartTime("");
          setEndTime("");
          setSelectedCoachId(null);
          setApiError("");
          setVenueFieldError("");
          setIsVenuePickerOpen(false);
        }}
        onClose={() => setIsVenuePickerOpen(false)}
      />
      <SearchableBookingPickerModal
        isVisible={isCoachPickerOpen}
        title="Coach Add-on"
        subtitle="All active coaches are shown. Coaches that do not cover the selected window are disabled."
        searchPlaceholder="Search coaches or specialties"
        options={coachAddOnPickerOptions}
        selectedId={selectedCoachId ?? "none"}
        isLoading={coachesLoading}
        errorMessage={
          coachesError
            ? coachesError instanceof Error
              ? coachesError.message
              : "Unable to load coach profiles."
            : null
        }
        emptyMessage="No coach add-ons cover this exact date and time."
        onRetry={() => {
          void refetchCoaches();
        }}
        onSelect={(coachId) => {
          setSelectedCoachId(coachId === "none" ? null : coachId);
          setApiError("");
          setIsCoachPickerOpen(false);
        }}
        onClose={() => setIsCoachPickerOpen(false)}
      />
      <CalendarModal
        isVisible={isCalOpen}
        selectedDate={date}
        minDate={getGymTodayString()}
        maxDate={maxBookableDateKey}
        defaultYear={Number(getGymTodayString().slice(0, 4))}
        defaultMonth={Number(getGymTodayString().slice(5, 7))}
        blockedDates={calendarBlockedDates}
        highlightedDates={calendarHighlightedDates}
        onVisibleMonthChange={handleCalendarMonthChange}
        onSelect={(selectedDate) => {
          if (selectedDate < getGymTodayString()) {
            setApiError("Choose today or a future reservation date in gym time (UTC+8).");
            setIsCalOpen(false);
            return;
          }
          setApiError("");
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
        title={timeTarget === "start" ? "Venue start time" : "Venue end time"}
        showAvailabilityLegend={false}
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
