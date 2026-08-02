import { Fragment, useEffect, useMemo, useState } from "react";
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
  CheckCircle,
  Clock,
  SlidersHorizontal,
  Users,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WEEKDAY_NAMES } from "@fittrack/app-config";

import type {
  AppointmentRecord,
  CoachAvailabilityResponse,
} from "@fittrack/api-client";
import type { CoachProfileRecord } from "@fittrack/types";
import {
  activeCoachesQueryOptions,
  coachAvailabilityQueryOptions,
  createAppointmentMutationOptions,
} from "@fittrack/query";
import {
  expandCoachAvailabilitySlots,
  formatBookingDate,
  to12HourLabel,
} from "@fittrack/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText } from "@fittrack/hooks";
import { getTodayString } from "@/data/bookings";
import { makeAppointmentModalStyles } from "@/styles/modals/AppointmentStyles";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitSearch from "@/components/fit/FitSearch";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
import TimeSlotModal, {
  type TimeSlot,
} from "@/components/modals/shared/TimeSlotModal";

export type AppointmentModalCheckoutResult = {
  checkoutUrl?: string | null;
  errorMessage?: string | null;
};

export type AppointmentModalSingleSubmission = {
  appointment: AppointmentRecord;
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

type AppointmentStep = "coach" | "time";
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

const COACH_SPECIALIZATION_FILTERS = [
  "Strength",
  "Mobility",
  "Boxing",
  "Conditioning",
] as const;
const COACH_RATING_FILTERS = [
  { label: "Any rating", value: 0 },
  { label: "4+ stars", value: 4 },
] as const;
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

function getCoachName(coach: CoachRecord) {
  const standaloneName = coach.displayName?.trim();
  if (standaloneName && !standaloneName.includes("@")) return standaloneName;
  return "Coach Profile";
}

function getCoachInitials(coach: CoachRecord) {
  return (
    getCoachName(coach)
      .split(" ")
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "C"
  );
}

function getCoachPrimarySpecialty(coach: CoachRecord) {
  return coach.specialties?.[0] ?? "General Coaching";
}

function getCoachPriceLabel(coach: CoachRecord) {
  const rate = Number(coach.hourlyRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return "Rate pending";
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
      "Coach-created monthly package.",
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

function toGymWallClockIso(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const gymOffsetMinutes = 8 * 60;
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) - gymOffsetMinutes * 60 * 1000,
  ).toISOString();
}

function timeValueToMinutes(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
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
  const cursor = new Date(`${getTodayString()}T00:00:00`);
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
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const year = maxDate.getFullYear();
  const month = String(maxDate.getMonth() + 1).padStart(2, "0");
  const day = String(maxDate.getDate()).padStart(2, "0");
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

function getCallbackCheckoutFailureMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.name === "AppointmentCheckoutFailure" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }
  return DEFAULT_CHECKOUT_FAILURE_MESSAGE;
}

export default function AppointmentModal({
  isVisible,
  onClose,
  onSuccess,
  onSingleBookingSubmitted,
  onMonthlySubmit,
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeAppointmentModalStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [step, setStep] = useState<AppointmentStep>("coach");
  const [planMode, setPlanMode] =
    useState<AppointmentPlanMode | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedSlotLabel, setSelectedSlotLabel] = useState("");
  const [appointmentConfirmation, setAppointmentConfirmation] =
    useState<AppointmentConfirmationState | null>(null);
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [coachSearch, setCoachSearch] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(
    [],
  );
  const [minimumRating, setMinimumRating] =
    useState<(typeof COACH_RATING_FILTERS)[number]["value"]>(0);

  const {
    data: coaches = [],
    isLoading: coachesLoading,
    error: coachesError,
  } = useQuery({
    ...activeCoachesQueryOptions<CoachRecord>(mobileApiClient, {
      ...(minimumRating > 0 ? { minRating: minimumRating } : {}),
    }),
    enabled: isVisible && planMode !== null,
  });

  const filteredCoaches = useMemo(() => {
    const query = coachSearch.trim().toLowerCase();
    const selectedSpecialtySet = new Set(
      selectedSpecialties.map((specialty) => specialty.toLowerCase()),
    );
    const matches = coaches.filter((coach) => {
      const coachSpecialties = (coach.specialties ?? []).map((specialty) =>
        specialty.toLowerCase(),
      );
      const matchesSpecialty =
        selectedSpecialtySet.size === 0 ||
        coachSpecialties.some((specialty) =>
          selectedSpecialtySet.has(specialty),
        );
      const rating = Number(coach.averageRating ?? 0);
      const matchesRating =
        minimumRating === 0 ||
        (Number.isFinite(rating) && rating >= minimumRating);
      const haystack = [
        getCoachName(coach),
        coach.bio ?? "",
        ...(coach.specialties ?? []),
        ...(coach.certifications ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return (
        matchesSpecialty &&
        matchesRating &&
        (!query || haystack.includes(query))
      );
    });

    if (planMode !== "monthly") return matches;
    return matches.sort(
      (left, right) =>
        Number(getMonthlyOffer(right).isAvailable) -
        Number(getMonthlyOffer(left).isAvailable),
    );
  }, [
    coachSearch,
    coaches,
    minimumRating,
    planMode,
    selectedSpecialties,
  ]);

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

  const bookedCoachDates = useMemo(
    () => availability?.bookedDates ?? [],
    [availability?.bookedDates],
  );
  const bookedCoachDateSet = useMemo(
    () => new Set(bookedCoachDates),
    [bookedCoachDates],
  );
  const isSelectedCoachDateBooked =
    planMode === "single" &&
    selectedCoach != null &&
    bookedCoachDateSet.has(selectedDate);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const slotOptions = useMemo<SlotOption[]>(() => {
    if (planMode !== "single" || !availability?.availability) {
      return [];
    }
    if (bookedCoachDateSet.has(selectedDate)) {
      return [];
    }
    return expandCoachAvailabilitySlots(availability.availability, "full_time")
      .filter(
        (slot) =>
          slot.isAvailable &&
          matchesDay(selectedDate, slot.dayOfWeek) &&
          (selectedDate !== getTodayString() ||
            timeValueToMinutes(slot.startTime) > currentMinutes),
      )
      .map((slot) => ({
        label: to12HourLabel(slot.startTime),
        startTime: slot.startTime,
        durationMin: slot.durationMinutes,
      }));
  }, [
    availability,
    bookedCoachDateSet,
    currentMinutes,
    planMode,
    selectedDate,
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
        duration: `${Math.max(1, Math.round(slot.durationMin / 60))} hr`,
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
  const isBusy =
    createAppointmentMutation.isPending || isSubmitting;

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
    if (!selectedSlot || selectedCoachRate == null) return 0;
    const slotHours = selectedSlot.durationMin / 60;
    return roundCurrency(selectedCoachRate * slotHours);
  }, [selectedCoachRate, selectedSlot]);
  const selectedPlan = useMemo(
    () =>
      PLAN_OPTION_CARDS.find((option) => option.key === planMode) ??
      null,
    [planMode],
  );
  const canShowPaymentBreakdown = hasSelectedSlot && hasValidCoachRate;
  const totalAmountLabel = canShowPaymentBreakdown
    ? formatCurrency(estimatedTotalAmount)
    : "Pending";
  const fullPaymentLabel = canShowPaymentBreakdown
    ? formatCurrency(estimatedTotalAmount)
    : "Pending";
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
        eyebrow: "Rate pending",
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
    if (isSelectedCoachDateBooked) {
      return `${getCoachName(selectedCoach)} already has a booking on ${formatBookingDate(selectedDate)}. Pick another highlighted day.`;
    }
    if (slotOptions.length === 0) {
      return `No active slots are available on ${formatBookingDate(selectedDate)}. Try another date or another coach.`;
    }
    return `${slotOptions.length} available slot${slotOptions.length === 1 ? "" : "s"} on ${formatBookingDate(selectedDate)}.`;
  }, [
    availabilityError,
    availabilityLoading,
    isSelectedCoachDateBooked,
    selectedCoach,
    selectedDate,
    slotOptions.length,
  ]);

  const resetFormState = () => {
    setStep("coach");
    setSelectedCoachId(null);
    setPlanMode(null);
    setSelectedDate(getTodayString());
    setSelectedSlotLabel("");
    setAppointmentConfirmation(null);
    setIsCalOpen(false);
    setIsTimeOpen(false);
    setIsFilterOpen(false);
    setIsSubmitting(false);
    setErrorText("");
    setCoachSearch("");
    setSelectedSpecialties([]);
    setMinimumRating(0);
  };

  const resetAndClose = () => {
    if (isBusy) {
      return;
    }
    resetFormState();
    onClose();
  };

  const handleModeSelect = (mode: AppointmentPlanMode) => {
    if (isBusy) return;
    setPlanMode(mode);
    setStep("coach");
    setSelectedCoachId(null);
    setSelectedSlotLabel("");
    setIsFilterOpen(false);
    setErrorText("");
  };

  const goToTimeStep = () => {
    if (planMode !== "single") return;
    if (!selectedCoach) {
      setErrorText("Select a coach to continue.");
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
      !hasValidCoachRate ||
      isSelectedCoachDateBooked
    ) {
      return;
    }

    setErrorText("");
    setIsSubmitting(true);
    let createdAppointment: AppointmentRecord | null = null;
    let didOpenCheckout = false;
    try {
      createdAppointment = await createAppointmentMutation.mutateAsync({
        payload: {
          coachId: String(selectedCoach.id),
          scheduledAt: toGymWallClockIso(selectedDate, selectedSlot.startTime),
          duration: selectedSlot.durationMin,
          bookingMode: "single",
          sessionCount: 1,
        },
      });

      const checkout = await mobileApiClient.appointments.initiateDownpayment(
        createdAppointment.id,
        "paymongo",
        "full",
      );
      const checkoutUrl = checkout.checkoutUrl?.trim();
      if (!checkoutUrl) {
        throw new Error("PayMongo did not return a checkout link.");
      }

      await Linking.openURL(checkoutUrl);
      didOpenCheckout = true;

      try {
        await onSingleBookingSubmitted?.({
          appointment: createdAppointment,
          checkoutUrl,
          coachId: String(selectedCoach.id),
          durationMinutes: selectedSlot.durationMin,
          scheduledAt: toGymWallClockIso(
            selectedDate,
            selectedSlot.startTime,
          ),
        });
      } catch {
        // A host notification callback must not turn an already-open checkout
        // into a false payment failure.
      }

      setAppointmentConfirmation(null);
      resetFormState();
    } catch (error: unknown) {
      setAppointmentConfirmation(null);
      setErrorText(
        createdAppointment
          ? SINGLE_CHECKOUT_FAILURE_MESSAGE
          : error instanceof Error && error.message.trim()
            ? error.message
            : "Unable to create your booking. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }

    if (didOpenCheckout) {
      onSuccess?.();
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
    if (isSelectedCoachDateBooked) {
      setErrorText("This coach already has a booking on the selected date.");
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

    setAppointmentConfirmation({
      title: "Confirm monthly booking?",
      message:
        "Pay " +
        formatCurrency(monthlyOffer.rate ?? 0) +
        " for " +
        monthlyOffer.sessionCount +
        " sessions with " +
        getCoachName(selectedCoach) +
        ". Dates are agreed with the coach later.",
      yesLabel: "Confirm & Pay",
    });
  };

  const handleMonthlyBooking = async () => {
    if (
      planMode !== "monthly" ||
      !selectedCoach ||
      !monthlyOffer.isAvailable
    ) {
      return;
    }
    if (!onMonthlySubmit) {
      setAppointmentConfirmation(null);
      setErrorText(DEFAULT_CHECKOUT_FAILURE_MESSAGE);
      return;
    }

    setErrorText("");
    setIsSubmitting(true);
    let didComplete = false;
    try {
      const result = await onMonthlySubmit({
        coach: selectedCoach,
        coachId: String(selectedCoach.id),
        durationMinutes: monthlyOffer.durationMinutes ?? 0,
        mode: "monthly",
        monthlyOfferDescription: monthlyOffer.description,
        monthlyRate: monthlyOffer.rate ?? 0,
        sessionCount: monthlyOffer.sessionCount ?? 0,
      });

      if (result?.checkoutUrl !== undefined || result?.errorMessage) {
        const checkoutUrl = result.checkoutUrl?.trim();
        if (!checkoutUrl) {
          throw makeCheckoutFailure(result.errorMessage ?? undefined);
        }
        await Linking.openURL(checkoutUrl);
      }

      didComplete = true;
      setAppointmentConfirmation(null);
      resetFormState();
    } catch (error: unknown) {
      setAppointmentConfirmation(null);
      setErrorText(getCallbackCheckoutFailureMessage(error));
    } finally {
      setIsSubmitting(false);
    }

    if (didComplete) {
      onSuccess?.();
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
          !isCalOpen &&
          !isTimeOpen
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
                          ? "Choose a coach"
                          : "Choose how you want to train"
                      : "Step 2 of 2 - Book & Pay in Full"}
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
                    <View>
                      <FitText style={s.sectionLabel}>
                        AVAILABLE COACHES
                      </FitText>
                      <View style={s.filterPanel}>
                        <View style={s.filterHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <FitSearch
                              value={coachSearch}
                              onChangeText={setCoachSearch}
                              placeholder="Search coaches"
                            />
                          </View>
                          <Pressable
                            style={[
                              s.filterToggle,
                              isFilterOpen && {
                                borderColor: colors.brand,
                                backgroundColor: colors.brand + "12",
                              },
                            ]}
                            onPress={() => setIsFilterOpen((current) => !current)}
                            accessibilityRole="button"
                            accessibilityLabel={isFilterOpen ? "Hide coach filters" : "Show coach filters"}
                            accessibilityState={{ expanded: isFilterOpen }}
                          >
                            <SlidersHorizontal size={17} color={isFilterOpen ? colors.brand : colors.textSecondary} />
                          </Pressable>
                        </View>
                        {isFilterOpen ? (
                          <View style={{ gap: 8 }}>
                            <View style={s.filterChipRow}>
                              {COACH_SPECIALIZATION_FILTERS.map((filter) => {
                                const isActive = selectedSpecialties.includes(filter);
                                return (
                                  <Pressable
                                    key={filter}
                                    style={[
                                      s.filterChip,
                                      isActive && {
                                        borderColor: colors.brand,
                                        backgroundColor: colors.brand + "12",
                                      },
                                    ]}
                                    onPress={() => {
                                      setSelectedSpecialties((current) =>
                                        isActive
                                          ? current.filter((value) => value !== filter)
                                          : [...current, filter],
                                      );
                                      setSelectedSlotLabel("");
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Filter coaches by specialty: ${filter}`}
                                    accessibilityState={{ selected: isActive }}
                                  >
                                    <FitText
                                      style={[
                                        s.filterChipText,
                                        isActive && { color: colors.brand },
                                      ]}
                                    >
                                      {filter}
                                    </FitText>
                                  </Pressable>
                                );
                              })}
                            </View>
                            <View style={s.filterChipRow}>
                              {COACH_RATING_FILTERS.map((filter) => {
                                const isActive = minimumRating === filter.value;
                                return (
                                  <Pressable
                                    key={filter.label}
                                    style={[
                                      s.filterChip,
                                      isActive && {
                                        borderColor: colors.warning,
                                        backgroundColor: colors.warning + "14",
                                      },
                                    ]}
                                    onPress={() => setMinimumRating(filter.value)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Filter coaches by rating: ${filter.label}`}
                                    accessibilityState={{ selected: isActive }}
                                  >
                                    <FitText
                                      style={[
                                        s.filterChipText,
                                        isActive && { color: colors.warning },
                                      ]}
                                    >
                                      {filter.label}
                                    </FitText>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        ) : null}
                      </View>
                      {coachesLoading ? (
                        <FitText style={s.helperText}>
                          Loading coach profiles...
                        </FitText>
                      ) : filteredCoaches.length === 0 ? (
                        <FitText style={s.helperText}>
                          No bookable coaches match those filters.
                        </FitText>
                      ) : (
                        <View style={s.coachList}>
                          {filteredCoaches.map((coach) => {
                            const isActive = selectedCoach?.id === coach.id;
                            const coachMonthlyOffer = getMonthlyOffer(coach);
                            const isDisabled =
                              planMode === "monthly" &&
                              !coachMonthlyOffer.isAvailable;
                            return (
                              <Pressable
                                key={coach.id}
                                style={[
                                  s.coachRow,
                                  isDisabled && { opacity: 0.55 },
                                  isActive && {
                                    borderColor: colors.brand,
                                    backgroundColor: colors.brand + "10",
                                  },
                                ]}
                                onPress={() => {
                                  if (isDisabled) return;
                                  setSelectedCoachId(
                                    isActive ? null : String(coach.id),
                                  );
                                  setErrorText("");
                                  setSelectedSlotLabel("");
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={`Select coach ${getCoachName(coach)}. ${getCoachPrimarySpecialty(coach)}. ${getCoachPriceLabel(coach)}. ${getCoachRatingLabel(coach)}.`}
                                accessibilityState={{ selected: isActive }}
                              >
                                <View
                                  style={[
                                    s.coachAvatar,
                                    isActive && {
                                      backgroundColor: colors.brand,
                                    },
                                  ]}
                                >
                                  <FitText
                                    style={[
                                      s.coachAvatarText,
                                      isActive && { color: colors.surface },
                                    ]}
                                  >
                                    {getCoachInitials(coach)}
                                  </FitText>
                                </View>
                                <View style={s.coachInfo}>
                                  <FitText style={s.coachName}>
                                    {getCoachName(coach)}
                                  </FitText>
                                  <FitText style={s.coachSpecialty}>
                                    {planMode === "monthly"
                                      ? coachMonthlyOffer.isAvailable
                                        ? `${formatCurrency(coachMonthlyOffer.rate ?? 0)} | ${coachMonthlyOffer.sessionCount} sessions | ${formatDurationLabel(coachMonthlyOffer.durationMinutes)} each`
                                        : "Monthly offer unavailable"
                                      : `${getCoachPrimarySpecialty(coach)} - ${getCoachPriceLabel(coach)}`}
                                  </FitText>
                                  <FitText style={s.coachRating}>
                                    {getCoachRatingLabel(coach)}
                                  </FitText>
                                  <FitText style={s.coachBio}>
                                    {coach.bio?.trim() ||
                                      "Staff has not added a coach bio yet."}
                                  </FitText>
                                  <View style={s.coachMetaRow}>
                                    {(coach.specialties ?? [])
                                      .slice(0, 2)
                                      .map((specialty) => (
                                        <View
                                          key={`${coach.id}-${specialty}`}
                                          style={s.coachMetaChip}
                                        >
                                          <FitText style={s.coachMetaChipText}>
                                            {specialty}
                                          </FitText>
                                        </View>
                                      ))}
                                    {(coach.certifications ?? [])
                                      .slice(0, 1)
                                      .map((certification) => (
                                        <View
                                          key={`${coach.id}-${certification}`}
                                          style={s.coachMetaChip}
                                        >
                                          <FitText style={s.coachMetaChipText}>
                                            {certification}
                                          </FitText>
                                        </View>
                                      ))}
                                  </View>
                                  {coach.recentReviews?.[0]?.comment ? (
                                    <FitText style={s.coachReviewQuote}>
                                      {coach.recentReviews[0].comment}
                                    </FitText>
                                  ) : null}
                                </View>
                                {isActive ? (
                                  <CheckCircle
                                    size={16}
                                    color={colors.brand}
                                    strokeWidth={2}
                                  />
                                ) : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                      {coachesError ? (
                        <FitText style={s.errorText}>
                          {coachLoadMessage}
                        </FitText>
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
                            Pay first. Agree on dates with your coach afterward.
                          </FitText>
                        </View>
                      ) : null}
                    </View>
                    </>
                  ) : null}
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
                        style={[
                          s.fieldBtn,
                          {
                            borderColor: isSelectedCoachDateBooked
                              ? colors.danger
                              : colors.fieldBorder,
                          },
                        ]}
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
                        Pay the full amount through PayMongo. No payment means
                        no confirmed booking.
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
                    step === "coach" ? resetAndClose : () => setStep("coach")
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
                          ? "Continue"
                          : "Select a mode"
                      : isBusy
                        ? sendingRequestLabel
                        : "Book & Pay in Full"
                  }
                  variant="primary"
                  onPress={
                    step === "coach"
                      ? planMode === "monthly"
                        ? handleMonthlyConfirm
                        : goToTimeStep
                      : handleConfirm
                  }
                  disabled={
                    step === "time"
                      ? !selectedSlot ||
                        !hasValidCoachRate ||
                        isSelectedCoachDateBooked ||
                        isBusy
                      : planMode == null ||
                        !selectedCoach ||
                        coachesLoading ||
                        isBusy ||
                        (planMode === "monthly" && !monthlyOffer.isAvailable)
                  }
                  loading={isBusy}
                  flex={2}
                />
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      <CalendarModal
        isVisible={isCalOpen}
        selectedDate={selectedDate}
        blockPast
        maxDate={getMaxBookableDateKey()}
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        blockedDates={bookedCoachDates}
        highlightedDates={highlightedCoachDates}
        onSelect={(date) => {
          setSelectedDate(date);
          setSelectedSlotLabel("");
          setIsCalOpen(false);
        }}
        onClose={() => setIsCalOpen(false)}
      />
      <TimeSlotModal
        isVisible={isTimeOpen}
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
