import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  CalendarDays,
  Clock,
  Users,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WEEKDAY_NAMES } from "@fittrack/app-config";

import { ApiClientError } from "@fittrack/api-client";
import type {
  CoachAvailabilityResponse,
  CommerceCheckoutAttempt,
} from "@fittrack/api-client";
import type { CoachProfileRecord } from "@fittrack/types";
import {
  activeCoachesQueryOptions,
  coachAvailabilityQueryOptions,
  createAppointmentMutationOptions,
} from "@fittrack/query";
import {
  formatBookingDate,
  to12HourLabel,
} from "@fittrack/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText } from "@fittrack/hooks";
import { makeAppointmentModalStyles } from "@/styles/modals/AppointmentStyles";
import { usePremiumFitnessAccess } from "@/hooks/membership/usePremiumFitnessAccess";
import {
  createCommerceAttemptIdempotencyKey,
  useCommerceCheckoutReturn,
} from "@/hooks/commerce/useCommerceCheckoutReturn";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import NoticeModal from "@/components/modals/shared/NoticeModal";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
import TimeSlotModal, {
  type TimeSlot,
} from "@/components/modals/shared/TimeSlotModal";
import SearchableBookingPickerModal, {
  type BookingPickerFilter,
  type BookingPickerOption,
} from "@/components/modals/booking/SearchableBookingPickerModal";
import {
  DEFAULT_COACH_PICKER_FILTER,
  filterCoachProfiles,
  type CoachPickerFilter,
} from "@/components/modals/booking/bookingPickerFilters";

export type AppointmentModalCheckoutResult = {
  attempt?: CommerceCheckoutAttempt;
  checkoutUrl?: string | null;
  errorMessage?: string | null;
};

export type AppointmentModalSingleSubmission = {
  appointment: CommerceCheckoutAttempt;
  checkoutUrl: string;
  coachId: string;
  durationMinutes: number;
  scheduledAt: string;
};

export type AppointmentModalMonthlySubmission = {
  coach: CoachProfileRecord;
  coachId: string;
  durationMinutes: number;
  mode: "monthly";
  monthlyOfferDescription: string;
  monthlyRate: number;
  sessionCount: number;
  startDate: string;
  idempotencyKey: string;
};

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSingleBookingSubmitted?: (
    submission: AppointmentModalSingleSubmission,
  ) => void | Promise<void>;
  onMonthlySubmit?: (
    submission: AppointmentModalMonthlySubmission,
  ) =>
    | AppointmentModalCheckoutResult
    | void
    | Promise<AppointmentModalCheckoutResult | void>;
};

type CoachRecord = CoachProfileRecord;

type AppointmentStep = "coach" | "date" | "time";
type AppointmentPlanMode = "single" | "monthly";
type AppointmentConfirmationState = {
  message: string;
  title: string;
  yesLabel: string;
};
type PlanOptionCard = {
  body: string;
  key: AppointmentPlanMode;
  sessionCount?: number;
  title: string;
};

type SlotOption = {
  durationMin: number;
  label: string;
  startTime: string;
};

const COACH_RATING_FILTERS = [
  { label: "Any rating", value: 0 },
  { label: "4+ stars", value: 4 },
] as const;
const ONE_TIME_DURATION_OPTIONS = [30, 45, 60, 90] as const;
const PLAN_OPTION_CARDS: PlanOptionCard[] = [
  {
    body: "Choose a coach, time, and pay in full now.",
    key: "single",
    sessionCount: 1,
    title: "Single Session",
  },
  {
    body: "Choose an active monthly offer and confirm payment.",
    key: "monthly",
    title: "Monthly",
  },
];

const DEFAULT_CHECKOUT_FAILURE_MESSAGE =
  "PayMongo payment is currently unavailable. Your booking was not confirmed. Please try again.";
const SINGLE_CHECKOUT_FAILURE_MESSAGE =
  "PayMongo payment is currently unavailable. Your booking was not confirmed. Please try again from Bookings.";
const MONTHLY_CHECKOUT_FAILURE_MESSAGE =
  "Unable to start the full monthly checkout. Your monthly coaching was not activated. Please try again.";

function getCoachName(coach: CoachRecord) {
  const standaloneName = coach.displayName?.trim();
  if (standaloneName && !standaloneName.includes("@")) return standaloneName;
  return "Coach Profile";
}

function getCoachPrimarySpecialty(coach: CoachRecord) {
  return coach.specialties?.[0] ?? "General Coaching";
}

function getCoachPriceLabel(coach: CoachRecord) {
  const rate = Number(coach.hourlyRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return "Rate unavailable";
  }

  return formatCurrency(rate) + " / session";
}

function getCoachRatingLabel(coach: CoachRecord) {
  if (!coach.averageRating || coach.ratingCount === 0) {
    return "New coach";
  }

  return `${coach.averageRating.toFixed(1)} stars (${coach.ratingCount ?? 0})`;
}

function getMonthlyOffer(coach: CoachRecord | null) {
  const monthlyRate = Number(coach?.monthlyRate);
  const monthlySessionCount = Number(coach?.monthlySessionCount);
  const monthlySessionDurationMinutes = Number(
    coach?.monthlySessionDurationMinutes,
  );
  const hasConfiguredValues =
    Number.isFinite(monthlyRate) &&
    monthlyRate > 0 &&
    Number.isInteger(monthlySessionCount) &&
    monthlySessionCount > 0 &&
    Number.isInteger(monthlySessionDurationMinutes) &&
    monthlySessionDurationMinutes > 0;

  return {
    description:
      coach?.monthlyOfferDescription?.trim() ||
      "Paid monthly coaching package.",
    durationMinutes: hasConfiguredValues ? monthlySessionDurationMinutes : null,
    isAvailable: coach?.monthlyOfferActive === true && hasConfiguredValues,
    rate: hasConfiguredValues ? monthlyRate : null,
    sessionCount: hasConfiguredValues ? monthlySessionCount : null,
  };
}

function formatDurationLabel(minutes: number | null) {
  if (!minutes) return "Not configured";
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minutes`;
}

function toGymWallClockIso(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const gymOffsetMinutes = 8 * 60;
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) - gymOffsetMinutes * 60 * 1000,
  ).toISOString();
}

function getGymTodayString() {
  const gymNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${gymNow.getUTCFullYear()}-${String(gymNow.getUTCMonth() + 1).padStart(2, "0")}-${String(gymNow.getUTCDate()).padStart(2, "0")}`;
}

function getGymCurrentMinutes() {
  const gymNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return gymNow.getUTCHours() * 60 + gymNow.getUTCMinutes();
}

function timeValueToMinutes(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function isoToTimeValue(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const gymTime = new Date(timestamp + 8 * 60 * 60 * 1000);
  return `${String(gymTime.getUTCHours()).padStart(2, "0")}:${String(
    gymTime.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

function getUpcomingAvailableDates(dayValues: Array<number | string>) {
  const availableDays = new Set<number>();
  dayValues.forEach((dayValue) => {
    if (typeof dayValue === "number") {
      availableDays.add(dayValue);
      return;
    }

    const normalized = String(dayValue).trim().toLowerCase();
    const numericDay = Number(normalized);
    if (Number.isInteger(numericDay)) {
      availableDays.add(numericDay);
      return;
    }
    const weekdayIndex = WEEKDAY_NAMES.findIndex((day) => day === normalized);
    if (weekdayIndex >= 0) {
      availableDays.add(weekdayIndex);
    }
  });

  if (availableDays.size === 0) return [];

  const dates: string[] = [];
  const cursor = new Date(`${getGymTodayString()}T00:00:00`);
  for (let offset = 0; offset < 90; offset += 1) {
    const nextDate = new Date(cursor);
    nextDate.setDate(cursor.getDate() + offset);
    if (availableDays.has(nextDate.getDay())) {
      const year = nextDate.getFullYear();
      const month = String(nextDate.getMonth() + 1).padStart(2, "0");
      const day = String(nextDate.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
  }

  return dates;
}

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function getMaxBookableDateKey() {
  const [gymYear, gymMonth, gymDay] = getGymTodayString().split("-").map(Number);
  const maxDate = new Date(Date.UTC(gymYear + 1, gymMonth - 1, gymDay));
  const year = maxDate.getUTCFullYear();
  const month = String(maxDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(maxDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function makeCheckoutFailure(message?: string) {
  const error = new Error(
    message?.trim() || DEFAULT_CHECKOUT_FAILURE_MESSAGE,
  );
  error.name = "AppointmentCheckoutFailure";
  return error;
}

function hasProviderUnavailableMessage(message: string) {
  const normalizedMessage = message.toLowerCase();
  const mentionsProvider =
    normalizedMessage.includes("paymongo") ||
    normalizedMessage.includes("payment provider") ||
    normalizedMessage.includes("checkout provider") ||
    normalizedMessage.includes("payment gateway");
  const indicatesUnavailable =
    normalizedMessage.includes("unavailable") ||
    normalizedMessage.includes("unreachable") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("failed") ||
    normalizedMessage.includes("failure");

  return mentionsProvider && indicatesUnavailable;
}

function isProviderUnavailableCheckoutError(error: unknown) {
  if (error instanceof Error && error.name === "AppointmentCheckoutFailure") {
    return true;
  }

  if (!(error instanceof ApiClientError)) {
    return error instanceof Error && hasProviderUnavailableMessage(error.message);
  }

  if (error.kind === "network" || error.kind === "timeout") {
    return true;
  }

  if (error.status === 502 || error.status === 503 || error.status === 504) {
    return true;
  }

  const details =
    error.details && typeof error.details === "object"
      ? Object.values(error.details)
          .filter((value): value is string => typeof value === "string")
          .join(" ")
      : "";
  return hasProviderUnavailableMessage(`${error.message} ${details}`);
}

function getCallbackCheckoutFailureMessage(error: unknown) {
  if (isProviderUnavailableCheckoutError(error)) {
    return DEFAULT_CHECKOUT_FAILURE_MESSAGE;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return MONTHLY_CHECKOUT_FAILURE_MESSAGE;
}

export default function AppointmentModal({
  isVisible,
  onClose,
  onSuccess,
  onSingleBookingSubmitted,
  onMonthlySubmit,
}: Props) {
  const { colors } = useTheme();
  const {
    hasActivePlan,
    isPlanAccessLoading,
    membershipAccessSummary,
  } = usePremiumFitnessAccess();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeAppointmentModalStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const attemptIdempotencyKeyRef = useRef<string | null>(null);
  const getAttemptIdempotencyKey = () => {
    if (!attemptIdempotencyKeyRef.current) {
      attemptIdempotencyKeyRef.current =
        createCommerceAttemptIdempotencyKey();
    }
    return attemptIdempotencyKeyRef.current;
  };
  const [step, setStep] = useState<AppointmentStep>("coach");
  const [planMode, setPlanMode] =
    useState<AppointmentPlanMode | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [selectedDate, setSelectedDate] = useState(getGymTodayString());
  const [monthlyStartDate, setMonthlyStartDate] = useState(getGymTodayString());
  const [selectedSlotLabel, setSelectedSlotLabel] = useState("");
  const [appointmentConfirmation, setAppointmentConfirmation] =
    useState<AppointmentConfirmationState | null>(null);
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [isCoachPickerOpen, setIsCoachPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState<{
    message: string;
    title: string;
  } | null>(null);
  const pendingSingleSubmissionRef =
    useRef<AppointmentModalSingleSubmission | null>(null);
  const checkoutModeRef = useRef<AppointmentPlanMode | null>(null);
  const resetFormStateRef = useRef<() => void>(() => undefined);
  const checkoutReturn = useCommerceCheckoutReturn({
    onSucceeded: async (attempt) => {
      const mode = checkoutModeRef.current;
      const singleSubmission = pendingSingleSubmissionRef.current;
      attemptIdempotencyKeyRef.current = null;
      checkoutModeRef.current = null;
      pendingSingleSubmissionRef.current = null;

      if (mode === "single" && singleSubmission) {
        try {
          await onSingleBookingSubmitted?.({
            ...singleSubmission,
            appointment: attempt,
          });
        } catch {
          // A host notification callback must not turn a confirmed checkout
          // into a false payment failure.
        }
      }

      resetFormStateRef.current();
      setCheckoutNotice({
        title: mode === "monthly" ? "Monthly coaching active" : "Session confirmed",
        message:
          mode === "monthly"
            ? "Your full PayMongo payment was confirmed. Your coach will prepare your program and session schedule next."
            : "Your full PayMongo payment was confirmed and the coaching session is now booked.",
      });
      onSuccess?.();
    },
    onTerminal: async (_, state) => {
      attemptIdempotencyKeyRef.current = null;
      checkoutModeRef.current = null;
      pendingSingleSubmissionRef.current = null;
      resetFormStateRef.current();
      setCheckoutNotice({
        title: "Checkout not completed",
        message:
          state === "expired"
            ? "The PayMongo checkout expired. No coaching booking was confirmed."
            : "The PayMongo checkout was not completed. No coaching booking was confirmed.",
      });
    },
  });
  const [coachPickerFilter, setCoachPickerFilter] =
    useState<CoachPickerFilter>(DEFAULT_COACH_PICKER_FILTER);

  const {
    data: coaches = [],
    isLoading: coachesLoading,
    error: coachesError,
    refetch: refetchCoaches,
  } = useQuery({
    ...activeCoachesQueryOptions<CoachRecord>(mobileApiClient),
    enabled: isVisible && planMode !== null,
  });

  const coachSpecialtyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          coaches.flatMap((coach) =>
            (coach.specialties ?? []).map((specialty) => specialty.trim()),
          ),
        ),
      )
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [coaches],
  );

  const filteredCoaches = useMemo(() => {
    const matches = filterCoachProfiles(coaches, coachPickerFilter);

    if (planMode !== "monthly") return matches;
    return matches.sort(
      (left, right) =>
        Number(getMonthlyOffer(right).isAvailable) -
        Number(getMonthlyOffer(left).isAvailable),
    );
  }, [
    coaches,
    coachPickerFilter,
    planMode,
  ]);

  const coachPickerOptions = useMemo<BookingPickerOption[]>(
    () =>
      filteredCoaches.map((coach) => {
        const coachMonthlyOffer = getMonthlyOffer(coach);
        const monthlyUnavailable =
          planMode === "monthly" && !coachMonthlyOffer.isAvailable;
        return {
          detail: coach.bio?.trim() || "No coach bio has been added yet.",
          disabled: monthlyUnavailable,
          id: String(coach.id),
          keywords: [...(coach.specialties ?? []), ...(coach.certifications ?? [])],
          subtitle:
            planMode === "monthly"
              ? coachMonthlyOffer.isAvailable
                ? `${formatCurrency(coachMonthlyOffer.rate ?? 0)} · ${coachMonthlyOffer.sessionCount} sessions · ${formatDurationLabel(coachMonthlyOffer.durationMinutes)} each`
                : "Monthly offer unavailable"
              : `${getCoachPrimarySpecialty(coach)} · ${getCoachPriceLabel(coach)} · ${getCoachRatingLabel(coach)}`,
          title: getCoachName(coach),
        };
      }),
    [filteredCoaches, planMode],
  );
  const coachPickerFilters = useMemo<BookingPickerFilter[]>(
    () => [
      ...coachSpecialtyOptions.map((specialty) => ({
        id: `specialty:${specialty}`,
        label: specialty,
        selected: coachPickerFilter.specialty === specialty,
      })),
      ...COACH_RATING_FILTERS.map((rating) => ({
        id: `rating:${rating.value}`,
        label: rating.label,
        selected: coachPickerFilter.minimumRating === rating.value,
      })),
    ],
    [coachPickerFilter, coachSpecialtyOptions],
  );

  useEffect(() => {
    if (!selectedCoachId) return;
    if (filteredCoaches.some((coach) => String(coach.id) === selectedCoachId)) {
      return;
    }
    setSelectedCoachId(null);
    setSelectedSlotLabel("");
  }, [filteredCoaches, selectedCoachId]);

  const selectedCoach = useMemo(
    () => coaches.find((coach) => String(coach.id) === selectedCoachId) ?? null,
    [coaches, selectedCoachId],
  );
  const monthlyOffer = useMemo(
    () => getMonthlyOffer(selectedCoach),
    [selectedCoach],
  );

  const {
    data: availability,
    isLoading: availabilityLoading,
    error: availabilityError,
  } = useQuery({
    ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(
      mobileApiClient,
      selectedCoach ? String(selectedCoach.id) : undefined,
    ),
      enabled:
        isVisible && planMode === "single" && !!selectedCoach,
  });
  const {
    data: canonicalDateSlots = [],
    isLoading: canonicalDateSlotsLoading,
    error: canonicalDateSlotsError,
  } = useQuery({
    queryKey: [
      "mobile",
      "appointment-availability",
      selectedCoach ? String(selectedCoach.id) : "none",
      selectedDate,
      selectedDuration,
    ],
    queryFn: () =>
      mobileApiClient.appointments.getAvailability(String(selectedCoach!.id), {
        date: selectedDate,
        durationMinutes: selectedDuration,
      }),
    enabled:
      isVisible &&
      planMode === "single" &&
      !!selectedCoach &&
      !!selectedDate &&
      selectedDuration > 0,
    staleTime: 15_000,
  });

  const currentMinutes = getGymCurrentMinutes();

  const slotOptions = useMemo<SlotOption[]>(() => {
    if (planMode !== "single") {
      return [];
    }
    return canonicalDateSlots
      .filter((slot) => {
        const startTime = isoToTimeValue(slot.startAt);
        return (
          slot.available &&
          !!startTime &&
          (selectedDate !== getGymTodayString() ||
            timeValueToMinutes(startTime) > currentMinutes)
        );
      })
      .map((slot) => {
        const startTime = isoToTimeValue(slot.startAt);
        return {
          label: to12HourLabel(startTime),
          startTime,
          durationMin: selectedDuration,
        };
      });
  }, [
    canonicalDateSlots,
    currentMinutes,
    planMode,
    selectedDate,
    selectedDuration,
  ]);
  const highlightedCoachDates = useMemo(
    () =>
      getUpcomingAvailableDates(
        planMode === "single"
          ? (availability?.availability
              ?.filter((slot) => slot.isAvailable)
              .map((slot) => slot.dayOfWeek) ?? [])
          : [],
      ),
    [availability?.availability, planMode],
  );

  const timeSlots = useMemo<TimeSlot[]>(
    () =>
      slotOptions.map((slot) => ({
        time: slot.label,
        duration: formatDurationLabel(slot.durationMin),
        status: "available",
        spots: 1,
      })),
    [slotOptions],
  );

  const selectedSlot = useMemo(
    () => slotOptions.find((slot) => slot.label === selectedSlotLabel) ?? null,
    [selectedSlotLabel, slotOptions],
  );

  const createAppointmentMutation = useMutation(
    createAppointmentMutationOptions(mobileApiClient, queryClient),
  );
  const isCheckoutActive = checkoutReturn.attempt != null;
  const isBusy =
    createAppointmentMutation.isPending || isSubmitting || isCheckoutActive;

  const sendingRequestLabel = useLoadingText(
    "PROCESSING",
    isBusy,
  );

  const selectedCoachRate = useMemo(() => {
    if (!selectedCoach || selectedCoach.hourlyRate == null) return null;
    const rate = Number(selectedCoach.hourlyRate);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }, [selectedCoach]);
  const hasSelectedSlot = selectedSlot != null;
  const hasValidCoachRate = selectedCoachRate != null;
  const estimatedTotalAmount = useMemo(() => {
    if (!selectedCoachRate || selectedCoachRate == null || selectedDuration <= 0) return 0;
    const slotHours = selectedDuration / 60;
    return roundCurrency(selectedCoachRate * slotHours);
  }, [selectedCoachRate, selectedDuration]);
  const selectedPlan = useMemo(
    () =>
      PLAN_OPTION_CARDS.find((option) => option.key === planMode) ??
      null,
    [planMode],
  );
  const canShowPaymentBreakdown = hasSelectedSlot && hasValidCoachRate;
  const totalAmountLabel = canShowPaymentBreakdown
    ? formatCurrency(estimatedTotalAmount)
    : "Select a slot";
  const fullPaymentLabel = canShowPaymentBreakdown
    ? formatCurrency(estimatedTotalAmount)
    : "Select a slot";
  const paymentEstimateSummary = useMemo(() => {
    if (!hasSelectedSlot) {
      return {
        body: "Choose a live slot to see the full amount.",
        eyebrow: "Slot required",
        title: "Choose a time",
      };
    }

    if (!hasValidCoachRate) {
      return {
        body: "This coach does not have a valid session rate yet.",
        eyebrow: "Rate unavailable",
        title: "Payment unavailable",
      };
    }

    return {
      body:
        "Total " +
        formatCurrency(estimatedTotalAmount) +
        ". PayMongo opens after confirmation. The booking is confirmed only after payment succeeds.",
      eyebrow: "Pay in full",
      title: "Secure checkout ready",
    };
  }, [estimatedTotalAmount, hasSelectedSlot, hasValidCoachRate]);

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

  const coachLoadMessage =
    coachesError instanceof Error
      ? coachesError.message
      : "Unable to load coach profiles right now.";

  const availabilityStatusMessage = useMemo(() => {
    if (!selectedCoach) {
      return "Select a coach to inspect their profile and live availability.";
    }
    if (availabilityLoading) {
      return "Loading live availability for this coach.";
    }
    if (availabilityError) {
      return availabilityError instanceof Error
        ? availabilityError.message
        : "Unable to load live availability for this coach.";
    }
    if (canonicalDateSlotsLoading) {
      return `Checking ${selectedDuration}-minute availability for ${formatBookingDate(selectedDate)}.`;
    }
    if (canonicalDateSlotsError) {
      return canonicalDateSlotsError instanceof Error
        ? canonicalDateSlotsError.message
        : "Unable to load canonical appointment availability.";
    }
    if (slotOptions.length === 0) {
      return `No ${selectedDuration}-minute slots are available on ${formatBookingDate(selectedDate)}. Try another date or another coach.`;
    }
    return `${slotOptions.length} canonical available slot${slotOptions.length === 1 ? "" : "s"} on ${formatBookingDate(selectedDate)}.`;
  }, [
    availabilityError,
    availabilityLoading,
    canonicalDateSlotsError,
    canonicalDateSlotsLoading,
    selectedCoach,
    selectedDate,
    selectedDuration,
    slotOptions.length,
  ]);

  const resetFormState = () => {
    setStep("coach");
    setSelectedCoachId(null);
    setPlanMode(null);
    setSelectedDate(getGymTodayString());
    setMonthlyStartDate(getGymTodayString());
    setSelectedDuration(60);
    setSelectedSlotLabel("");
    setAppointmentConfirmation(null);
    setIsCalOpen(false);
    setIsTimeOpen(false);
    setIsCoachPickerOpen(false);
    setIsSubmitting(false);
    setErrorText("");
    setCoachPickerFilter(DEFAULT_COACH_PICKER_FILTER);
  };
  resetFormStateRef.current = resetFormState;

  const resetAndClose = () => {
    if (isBusy) {
      return;
    }
    resetFormState();
    if (!checkoutReturn.attempt) {
      attemptIdempotencyKeyRef.current = null;
    }
    onClose();
  };

  const handleModeSelect = (mode: AppointmentPlanMode) => {
    if (isBusy) return;
    attemptIdempotencyKeyRef.current = null;
    setPlanMode(mode);
    setStep("coach");
    setSelectedCoachId(null);
    setSelectedDuration(60);
    setSelectedSlotLabel("");
    setIsCoachPickerOpen(false);
    setCoachPickerFilter(DEFAULT_COACH_PICKER_FILTER);
    setErrorText("");
  };

  const goToDateStep = () => {
    if (planMode !== "single") return;
    if (!selectedCoach) {
      setErrorText("Select a coach to continue.");
      return;
    }
    setErrorText("");
    setStep("date");
  };

  const goToTimeStep = () => {
    if (planMode !== "single") return;
    if (!selectedDate) {
      setErrorText("Select a date to continue.");
      return;
    }
    setErrorText("");
    setStep("time");
  };

  const handleBookAppointment = async () => {
    if (
      planMode !== "single" ||
      !selectedCoach ||
      !selectedSlot ||
      !hasValidCoachRate
    ) {
      return;
    }

    setErrorText("");
    setIsSubmitting(true);
    let checkoutAttempt: CommerceCheckoutAttempt | null = null;
    try {
      checkoutAttempt = await createAppointmentMutation.mutateAsync({
        payload: {
          coachId: String(selectedCoach.id),
          scheduledAt: toGymWallClockIso(selectedDate, selectedSlot.startTime),
          duration: selectedDuration,
          bookingMode: "single",
          sessionCount: 1,
          idempotencyKey: getAttemptIdempotencyKey(),
        },
      });

      const checkoutUrl = checkoutAttempt.checkoutUrl?.trim();
      if (!checkoutUrl) {
        throw new Error("PayMongo did not return a checkout link.");
      }

      await Linking.openURL(checkoutUrl);
      checkoutModeRef.current = "single";
      pendingSingleSubmissionRef.current = {
        appointment: checkoutAttempt,
        checkoutUrl,
        coachId: String(selectedCoach.id),
        durationMinutes: selectedDuration,
        scheduledAt: toGymWallClockIso(
          selectedDate,
          selectedSlot.startTime,
        ),
      };
      checkoutReturn.start(checkoutAttempt);
      setAppointmentConfirmation(null);
      resetFormState();
      setCheckoutNotice({
        title: "PayMongo checkout opened",
        message:
          "Complete the full checkout, then return to FitTrack. The session is confirmed only after successful payment confirmation.",
      });
    } catch (error: unknown) {
      attemptIdempotencyKeyRef.current = null;
      checkoutModeRef.current = null;
      pendingSingleSubmissionRef.current = null;
      setAppointmentConfirmation(null);
      setErrorText(
        checkoutAttempt
          ? SINGLE_CHECKOUT_FAILURE_MESSAGE
          : error instanceof Error && error.message.trim()
            ? error.message
            : "Unable to create your booking. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = () => {
    if (planMode !== "single") {
      return;
    }
    if (!selectedCoach || !selectedSlot) {
      setErrorText("Select both date and time.");
      return;
    }
    if (!hasValidCoachRate) {
      setErrorText("This coach does not have a valid session rate yet.");
      return;
    }
    const scheduleLabel = `${formatBookingDate(selectedDate)} at ${selectedSlot.label}`;

    setAppointmentConfirmation({
      title: "Book and pay in full?",
      message:
        "Book " +
        getCoachName(selectedCoach) +
        " for " +
        scheduleLabel +
        ". PayMongo checkout opens next. The booking is confirmed only after payment succeeds.",
      yesLabel: "Book & Pay in Full",
    });
  };

  const handleMonthlyConfirm = () => {
    if (planMode !== "monthly") return;
    if (!selectedCoach) {
      setErrorText("Select a coach to continue.");
      return;
    }
    if (!monthlyOffer.isAvailable) {
      setErrorText("This coach does not have an active monthly offer.");
      return;
    }
    if (isPlanAccessLoading) {
      setErrorText("Checking your active membership. Please wait a moment.");
      return;
    }
    if (!hasActivePlan) {
      setErrorText("An active membership is required for monthly coaching.");
      return;
    }
    if (!monthlyStartDate || monthlyStartDate < getGymTodayString()) {
      setErrorText("Choose a monthly coaching start date in gym time.");
      return;
    }

    setAppointmentConfirmation({
      title: "Confirm monthly booking?",
        message:
          "Pay " +
        formatCurrency(monthlyOffer.rate ?? 0) +
        " for " +
        monthlyOffer.sessionCount +
            " sessions with " +
            getCoachName(selectedCoach) +
            ` starting ${formatBookingDate(monthlyStartDate)}. After payment, your coach prepares your program and session schedule.`,
      yesLabel: "Confirm & Pay",
    });
  };

  const handleMonthlyBooking = async () => {
    if (
      planMode !== "monthly" ||
      !selectedCoach ||
      !monthlyOffer.isAvailable ||
      !hasActivePlan ||
      !monthlyStartDate
    ) {
      return;
    }
    if (!onMonthlySubmit) {
      setAppointmentConfirmation(null);
      setErrorText(MONTHLY_CHECKOUT_FAILURE_MESSAGE);
      return;
    }

    setErrorText("");
    setIsSubmitting(true);
    try {
      const result = await onMonthlySubmit({
        coach: selectedCoach,
        coachId: String(selectedCoach.id),
        durationMinutes: monthlyOffer.durationMinutes ?? 0,
        mode: "monthly",
        monthlyOfferDescription: monthlyOffer.description,
        monthlyRate: monthlyOffer.rate ?? 0,
        sessionCount: monthlyOffer.sessionCount ?? 0,
        startDate: monthlyStartDate,
        idempotencyKey: getAttemptIdempotencyKey(),
      });

      const checkoutAttempt = result?.attempt;
      const checkoutUrl = result?.checkoutUrl?.trim();
      if (!checkoutAttempt?.holdId || !checkoutUrl) {
        const callbackErrorMessage = result?.errorMessage?.trim();
        throw callbackErrorMessage
          ? new Error(callbackErrorMessage)
          : makeCheckoutFailure("PayMongo did not return a checkout status handle.");
      }

      await Linking.openURL(checkoutUrl);
      checkoutModeRef.current = "monthly";
      checkoutReturn.start(checkoutAttempt);
      setAppointmentConfirmation(null);
      resetFormState();
      setCheckoutNotice({
        title: "PayMongo checkout opened",
        message:
          "Complete the full checkout, then return to FitTrack. Your monthly coaching relationship activates after successful confirmation.",
      });
    } catch (error: unknown) {
      attemptIdempotencyKeyRef.current = null;
      checkoutModeRef.current = null;
      setAppointmentConfirmation(null);
      setErrorText(getCallbackCheckoutFailureMessage(error));
    } finally {
      setIsSubmitting(false);
    }

  };

  const handleSubmitBooking = async () => {
    if (planMode === "single") {
      await handleBookAppointment();
      return;
    }
    if (planMode === "monthly") {
      await handleMonthlyBooking();
    }
  };

  return (
    <Fragment>
      <Modal
        visible={
          isVisible &&
          appointmentConfirmation == null &&
          checkoutNotice == null &&
          !isCalOpen &&
          !isTimeOpen &&
          !isCoachPickerOpen
        }
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={resetAndClose}
      >
        <KeyboardAvoidingView
          style={s.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View style={[s.backdrop, backdropStyle]}>
            <Animated.View style={[s.card, cardStyle]}>
              <Animated.View style={[s.header, headerBorderStyle]}>
                <View style={s.headerIcon}>
                  <Users size={18} color={colors.brand} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <FitText style={s.headerTitle}>Book a Trainer</FitText>
                  <FitText style={s.headerSubtitle}>
                    {step === "coach"
                      ? planMode === "monthly"
                        ? "Choose a monthly offer"
                        : planMode === "single"
                          ? "Duration and coach"
                          : "Choose how you want to train"
                      : step === "date"
                        ? "Step 2 of 4 - Choose a date"
                        : "Step 3 of 4 - Choose an available time"}
                  </FitText>
                </View>
              </Animated.View>
              <FitModalScrollView
                style={s.middle}
                contentContainerStyle={s.body}
                resetKey={`${isVisible}-${step}`}
                showScrollCue={false}
              >
                {step === "coach" ? (
                  <View style={{ gap: 12 }}>
                    <View style={s.planOptionList}>
                      {PLAN_OPTION_CARDS.map((option) => {
                        const isSelected = planMode === option.key;
                        return (
                          <Pressable
                            key={option.key}
                            style={[
                              s.planOptionCard,
                              isSelected && {
                                backgroundColor: colors.brand + "12",
                                borderColor: colors.brand,
                              },
                            ]}
                            onPress={() => handleModeSelect(option.key)}
                            accessibilityRole="button"
                            accessibilityLabel={
                              "Select booking mode: " + option.title
                            }
                            accessibilityState={{ selected: isSelected }}
                          >
                            <FitText
                              style={[
                                s.planOptionTitle,
                                isSelected && { color: colors.brand },
                              ]}
                            >
                              {option.title}
                            </FitText>
                          </Pressable>
                        );
                      })}
                    </View>
                    {planMode !== null ? (
                      <>
                    {planMode === "single" ? (
                      <View style={s.previewCard}>
                        <FitText style={s.previewSectionTitle}>
                          SESSION DURATION
                        </FitText>
                        <FitText style={s.helperText}>
                          Choose a duration first. FitTrack will show only canonical available times for this length.
                        </FitText>
                        <View style={s.filterChipRow}>
                          {ONE_TIME_DURATION_OPTIONS.map((duration) => {
                            const isActive = selectedDuration === duration;
                            return (
                              <Pressable
                                key={duration}
                                style={[
                                  s.filterChip,
                                  isActive && {
                                    borderColor: colors.brand,
                                    backgroundColor: colors.brand + "12",
                                  },
                                ]}
                                onPress={() => {
                                  setSelectedDuration(duration);
                                  setSelectedSlotLabel("");
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={`Select ${duration}-minute session duration`}
                                accessibilityState={{ selected: isActive }}
                              >
                                <FitText
                                  style={[
                                    s.filterChipText,
                                    isActive && { color: colors.brand },
                                  ]}
                                >
                                  {formatDurationLabel(duration)}
                                </FitText>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                    <View>
                      <FitText style={s.sectionLabel}>COACH</FitText>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={selectedCoach ? `Selected coach ${getCoachName(selectedCoach)}` : "Choose a coach"}
                        style={[
                          s.fieldBtn,
                          { borderColor: selectedCoach ? colors.brand : colors.fieldBorder },
                        ]}
                        onPress={() => setIsCoachPickerOpen(true)}
                      >
                        <Users size={16} color={selectedCoach ? colors.brand : colors.textMuted} strokeWidth={2} />
                        <FitText style={[s.fieldBtnText, selectedCoach && { color: colors.textPrimary }]}>
                          {selectedCoach ? getCoachName(selectedCoach) : "Search and select a coach"}
                        </FitText>
                      </Pressable>
                      {!selectedCoach && errorText ? (
                        <FitText style={s.errorText}>{errorText}</FitText>
                      ) : null}
                    </View>
                    <View style={s.previewCard}>
                      <FitText style={s.previewTitle}>
                        {selectedCoach
                          ? `Coach review: ${getCoachName(selectedCoach)}`
                          : "Coach review required"}
                      </FitText>
                      <FitText style={s.previewSubtitle}>
                        {selectedCoach
                          ? selectedCoach.bio?.trim() ||
                            "This coach profile still needs a fuller bio from staff."
                          : "Review the coach profile and the live slot summary before continuing to time selection."}
                      </FitText>
                      <View style={s.previewSection}>
                        <FitText style={s.previewSectionTitle}>
                          SPECIALTIES
                        </FitText>
                        <FitText style={s.previewPlainText}>
                          {selectedCoach?.specialties?.length
                            ? selectedCoach.specialties.join(", ")
                            : "No specialties listed yet."}
                        </FitText>
                      </View>
                      <View style={s.previewSection}>
                        <FitText style={s.previewSectionTitle}>
                          CERTIFICATIONS
                        </FitText>
                        <FitText style={s.previewPlainText}>
                          {selectedCoach?.certifications?.length
                            ? selectedCoach.certifications.join(", ")
                            : "No certifications listed yet."}
                        </FitText>
                      </View>
                      {planMode === "single" ? (
                        <View style={s.previewSection}>
                          <FitText style={s.previewSectionTitle}>
                            LIVE SLOT CHECK
                          </FitText>
                          <FitText style={s.previewPlainText}>
                            {availabilityStatusMessage}
                          </FitText>
                        </View>
                      ) : monthlyOffer.isAvailable ? (
                        <View style={s.previewSection}>
                          <FitText style={s.previewSectionTitle}>
                            MONTHLY OFFER
                          </FitText>
                          <FitText style={s.previewPlainText}>
                            {formatCurrency(monthlyOffer.rate ?? 0)} |{" "}
                            {monthlyOffer.sessionCount} sessions |{" "}
                            {formatDurationLabel(monthlyOffer.durationMinutes)} each
                          </FitText>
                          <FitText style={s.helperText}>
                            Full PayMongo payment activates this monthly coaching allocation.
                          </FitText>
                          <FitText style={[s.previewSectionTitle, { marginTop: 10 }]}>START DATE</FitText>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Monthly coaching start date ${formatBookingDate(monthlyStartDate)}`}
                            style={[s.fieldBtn, { borderColor: monthlyStartDate ? colors.brand : colors.fieldBorder }]}
                            onPress={() => setIsCalOpen(true)}
                          >
                            <CalendarDays size={16} color={colors.brand} strokeWidth={2} />
                            <FitText style={[s.fieldBtnText, { color: colors.textPrimary }]}>
                              {formatBookingDate(monthlyStartDate)}
                            </FitText>
                          </Pressable>
                          <FitText style={hasActivePlan || isPlanAccessLoading ? s.helperText : s.errorText}>
                            {isPlanAccessLoading ? "Checking active membership..." : membershipAccessSummary}
                          </FitText>
                        </View>
                      ) : null}
                    </View>
                    </>
                  ) : null}
                  </View>
                ) : step === "date" ? (
                  <View style={{ gap: 12 }}>
                    <View style={s.previewCard}>
                      <FitText style={s.previewSectionTitle}>
                        DATE
                      </FitText>
                      <FitText style={s.previewTitle}>
                        {selectedDuration}-minute session with {selectedCoach ? getCoachName(selectedCoach) : "your coach"}
                      </FitText>
                      <FitText style={s.helperText}>
                        Pick a date first. The next step will load canonical available times for that date and duration.
                      </FitText>
                    </View>
                    <Pressable
                      style={[s.fieldBtn, { borderColor: colors.brand }]}
                      onPress={() => setIsCalOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select appointment date. Current date ${formatBookingDate(selectedDate)}`}
                    >
                      <CalendarDays size={16} color={colors.brand} strokeWidth={2} />
                      <FitText style={[s.fieldBtnText, { color: colors.textPrimary }]}>
                        {formatBookingDate(selectedDate)}
                      </FitText>
                    </Pressable>
                    <FitText style={s.helperText}>
                      {availabilityStatusMessage}
                    </FitText>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {selectedCoach ? (
                      <View style={s.previewCard}>
                        <FitText style={s.previewTitle}>
                          {getCoachName(selectedCoach)}
                        </FitText>
                        <FitText style={s.previewSubtitle}>
                          {getCoachPrimarySpecialty(selectedCoach)} {" - "}{" "}
                          {getCoachPriceLabel(selectedCoach)}
                        </FitText>
                        <View style={s.previewSection}>
                          <FitText style={s.previewSectionTitle}>
                            DAY CHECK
                          </FitText>
                          <FitText style={s.previewPlainText}>
                            {availabilityStatusMessage}
                          </FitText>
                        </View>
                      </View>
                    ) : null}
                    <View style={s.previewCard}>
                      <FitText style={s.previewSectionTitle}>
                        ONE-TIME SESSION
                      </FitText>
                      <FitText style={s.previewPlainText}>
                        {selectedPlan?.body}
                      </FitText>
                    </View>
                    <View>
                      <FitText style={s.sectionLabel}>SELECT DATE</FitText>
                      <Pressable
                        style={[s.fieldBtn, { borderColor: colors.fieldBorder }]}
                        onPress={() => setIsCalOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select appointment date. Current date ${formatBookingDate(selectedDate)}`}
                      >
                        <CalendarDays
                          size={16}
                          color={colors.textMuted}
                          strokeWidth={2}
                        />
                        <FitText style={s.fieldBtnText}>
                          {formatBookingDate(selectedDate)}
                        </FitText>
                      </Pressable>
                    </View>
                    <View>
                      <FitText style={s.sectionLabel}>SELECT TIME SLOT</FitText>
                      <Pressable
                        style={[
                          s.fieldBtn,
                          {
                            borderColor: selectedSlotLabel
                              ? colors.brand
                              : colors.fieldBorder,
                          },
                        ]}
                        onPress={() => setIsTimeOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select appointment time slot. Current selection ${selectedSlotLabel || "none"}`}
                      >
                        <Clock
                          size={16}
                          color={
                            selectedSlotLabel ? colors.brand : colors.textMuted
                          }
                          strokeWidth={2}
                        />
                        <FitText
                          style={[
                            s.fieldBtnText,
                            selectedSlotLabel && { color: colors.textPrimary },
                          ]}
                        >
                          {selectedSlotLabel || "Choose available slot"}
                        </FitText>
                      </Pressable>
                      <FitText style={s.helperText}>
                        {availabilityStatusMessage}
                      </FitText>
                    </View>
                    <View style={s.paymentSummaryCard}>
                      <FitText style={s.previewSectionTitle}>
                        PAYMENT ESTIMATE
                      </FitText>
                      <FitText style={s.helperText}>
                         Pay the full amount through PayMongo to confirm the
                         booking.
                      </FitText>
                      <FitText style={s.previewTitle}>
                        {paymentEstimateSummary.title}
                      </FitText>
                      <FitText style={s.previewPlainText}>
                        {paymentEstimateSummary.body}
                      </FitText>
                      <View style={s.paymentBreakdownRow}>
                        <View style={s.paymentBreakdownColumn}>
                          <FitText style={s.previewSectionTitle}>TOTAL</FitText>
                          <FitText style={s.paymentBreakdownValue}>
                            {totalAmountLabel}
                          </FitText>
                        </View>
                        <View style={s.paymentBreakdownColumn}>
                          <FitText style={s.previewSectionTitle}>
                            PAYMONGO FULL
                          </FitText>
                          <FitText style={s.paymentBreakdownValue}>
                            {fullPaymentLabel}
                          </FitText>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
                {errorText ? (
                  <FitText style={s.errorText}>{errorText}</FitText>
                ) : null}
              </FitModalScrollView>
              <Animated.View style={[s.footer, footerBorderStyle]}>
                <FitButton
                  label={step === "coach" ? "Cancel" : "Back"}
                  variant="ghost"
                  onPress={
                    step === "coach"
                      ? resetAndClose
                      : () => setStep(step === "time" ? "date" : "coach")
                  }
                  disabled={isBusy}
                  flex={1}
                />
                <FitButton
                  label={
                    step === "coach"
                      ? planMode === "monthly"
                        ? "Confirm & Pay"
                        : planMode === "single"
                          ? "Choose date"
                          : "Select a mode"
                      : step === "date"
                        ? "Choose available time"
                        : isBusy
                        ? sendingRequestLabel
                        : "Review & pay"
                  }
                  variant="primary"
                  onPress={
                    step === "coach"
                      ? planMode === "monthly"
                        ? handleMonthlyConfirm
                        : goToDateStep
                      : step === "date"
                        ? goToTimeStep
                        : handleConfirm
                  }
                  disabled={
                    step === "time"
                      ? !selectedSlot ||
                        !hasValidCoachRate ||
                        isBusy
                      : step === "date"
                        ? !selectedDate || isBusy
                        : planMode == null ||
                          !selectedCoach ||
                          coachesLoading ||
                          isBusy ||
                          (planMode === "monthly" &&
                            (!monthlyOffer.isAvailable ||
                              !monthlyStartDate ||
                              !hasActivePlan ||
                              isPlanAccessLoading))
                  }
                  loading={isBusy}
                  flex={2}
                />
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      <NoticeModal
        isVisible={checkoutNotice != null}
        title={checkoutNotice?.title ?? "Checkout"}
        message={checkoutNotice?.message ?? ""}
        onClose={() => setCheckoutNotice(null)}
      />
      <SearchableBookingPickerModal
        isVisible={isCoachPickerOpen}
        title="Select a Coach"
        subtitle={planMode === "monthly" ? "Choose a live monthly offer." : "Choose a coach from live profiles."}
        searchPlaceholder="Search coaches or specialties"
        options={coachPickerOptions}
        filters={coachPickerFilters}
        selectedId={selectedCoachId}
        isLoading={coachesLoading}
        errorMessage={coachesError ? coachLoadMessage : null}
        emptyMessage="No bookable coaches match the current search and filters."
        onRetry={() => {
          void refetchCoaches();
        }}
        onFilterPress={(id) => {
          if (id.startsWith("specialty:")) {
            const specialty = id.slice("specialty:".length);
            setCoachPickerFilter((current) => ({
              ...current,
              specialty: current.specialty === specialty ? null : specialty,
            }));
            return;
          }
          if (id.startsWith("rating:")) {
            const minimumRating = Number(id.slice("rating:".length));
            if (minimumRating === 0 || minimumRating === 4) {
              setCoachPickerFilter((current) => ({
                ...current,
                minimumRating,
              }));
            }
          }
        }}
        onSelect={(coachId) => {
          setSelectedCoachId(coachId);
          setSelectedSlotLabel("");
          setErrorText("");
          setIsCoachPickerOpen(false);
          setCoachPickerFilter(DEFAULT_COACH_PICKER_FILTER);
        }}
        onClose={() => {
          setIsCoachPickerOpen(false);
          setCoachPickerFilter(DEFAULT_COACH_PICKER_FILTER);
        }}
      />
      <CalendarModal
        isVisible={isCalOpen}
        selectedDate={planMode === "monthly" ? monthlyStartDate : selectedDate}
        minDate={getGymTodayString()}
        maxDate={getMaxBookableDateKey()}
        defaultYear={Number(getGymTodayString().slice(0, 4))}
        defaultMonth={Number(getGymTodayString().slice(5, 7))}
        blockedDates={[]}
        highlightedDates={planMode === "single" ? highlightedCoachDates : []}
        onSelect={(date) => {
          if (date < getGymTodayString()) {
            setErrorText("Choose today or a future date in gym time (UTC+8).");
            setIsCalOpen(false);
            return;
          }
          if (planMode === "monthly") {
            setMonthlyStartDate(date);
          } else {
            setSelectedDate(date);
            setSelectedSlotLabel("");
          }
          setErrorText("");
          setIsCalOpen(false);
        }}
        onClose={() => setIsCalOpen(false)}
      />
      <TimeSlotModal
        isVisible={isTimeOpen}
        title={`Exact ${selectedDuration}-minute coach time`}
        showAvailabilityLegend={false}
        slots={timeSlots}
        selectedTime={selectedSlotLabel}
        onSelect={(slot) => {
          setSelectedSlotLabel(slot.time);
          setIsTimeOpen(false);
        }}
        onClose={() => setIsTimeOpen(false)}
      />
      <ConfirmModal
        isVisible={appointmentConfirmation != null}
        title={appointmentConfirmation?.title ?? "Confirm action"}
        message={appointmentConfirmation?.message ?? ""}
        yesLabel={appointmentConfirmation?.yesLabel ?? "Confirm"}
        noLabel="Cancel"
        isLoading={isBusy}
        loadingLabel={sendingRequestLabel}
        loadingTitle="Opening PayMongo"
        onNo={() => {
          if (isBusy) {
            return;
          }
          setAppointmentConfirmation(null);
        }}
        onYes={() => {
          void handleSubmitBooking();
        }}
      />
    </Fragment>
  );
}
