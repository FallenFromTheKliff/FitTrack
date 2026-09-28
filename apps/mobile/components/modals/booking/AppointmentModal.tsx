import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
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
  getGymDateKey as getSharedGymDateKey,
  isGymSlotInPast,
  to12HourLabel,
} from "@fittrack/utils";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useBookingCheckoutRecoveryNotice,
  useBookingCheckoutRecoveryScope,
} from "@/contexts/BookingCheckoutRecoveryContext";
import type {
  BookingCheckoutIosDismissalBarrier,
  BookingCheckoutIosNoticeOutcome,
  BookingCheckoutIosNoticePresentation,
} from "@/contexts/bookingCheckoutRecoveryScope";
import { mobileApiClient } from "@/lib/api-client";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText } from "@fittrack/hooks";
import { makeAppointmentModalStyles } from "@/styles/modals/AppointmentStyles";
import {
  createCommerceAttemptIdempotencyKey,
  resolveCheckoutReturnInput,
  type CheckoutRecoveryOperation,
  useCommerceCheckoutReturn,
} from "@/hooks/commerce/useCommerceCheckoutReturn";

import { FitSearch, FitText } from "@/components/fit";
import FitButton from "@/components/fit/FitButton";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import NoticeModal from "@/components/modals/shared/NoticeModal";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
import CheckoutRecoveryModal from "@/components/modals/booking/CheckoutRecoveryModal";
import TimeSlotModal, {
  type TimeSlot,
} from "@/components/modals/shared/TimeSlotModal";
import {
  DEFAULT_COACH_PICKER_FILTER,
  filterBookingPickerOptions,
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
  checkoutRecovery?: {
    attempt: CommerceCheckoutAttempt;
    mode: AppointmentPlanMode;
  } | null;
  freeRebookDate?: string | null;
  freeRebookAppointmentId?: string | null;
  isVisible: boolean;
  onClose: () => void;
  onCheckoutRecoveryConsumed?: (holdId: string) => void;
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
type CheckoutNoticeState = {
  message: string;
  title: string;
};
type IosCheckoutModalKey =
  | "appointment"
  | "checkoutNotice"
  | "confirmation"
  | "recovery";
type IosCheckoutModalTracker = {
  barrierHoldId: string | null;
  barrierOwnerGeneration: number | null;
  barrierPresentationGeneration: number | null;
  barrierPresentationKey: string | null;
  barrierToken: object;
  keepVisibleUntilShow: boolean;
  requested: boolean;
  shown: boolean;
};
type IosCheckoutModalBarrierIdentity = {
  holdId: string | null;
  ownerGeneration: number | null;
  presentationGeneration: number | null;
  presentationKey: string | null;
};
type RetainedCheckoutRecoveryState = {
  attempt: CommerceCheckoutAttempt;
  errorMessage: string | null;
  isBusy: boolean;
  operation: CheckoutRecoveryOperation;
  remainingSeconds: number | null;
};

function createIosCheckoutModalTrackers(): Record<
  IosCheckoutModalKey,
  IosCheckoutModalTracker
> {
  const createTracker = (): IosCheckoutModalTracker => ({
    barrierHoldId: null,
    barrierOwnerGeneration: null,
    barrierPresentationGeneration: null,
    barrierPresentationKey: null,
    barrierToken: {},
    keepVisibleUntilShow: false,
    requested: false,
    shown: false,
  });
  return {
    appointment: createTracker(),
    checkoutNotice: createTracker(),
    confirmation: createTracker(),
    recovery: createTracker(),
  };
}
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
const ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_TYPE =
  "RECURRING_COACHING_ACTIVE_ENTITLEMENT";
const ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_KIND = "active_entitlement";
const ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_NOTICE = {
  message:
    "You already have a monthly coaching booking for this period. You can only have one monthly coach at a time. You can still book single sessions.",
  title: "Monthly coaching already booked",
};
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

  return formatCurrency(rate) + " / hour";
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

function toCoachPickerOption(
  coach: CoachRecord,
  planMode: AppointmentPlanMode,
) {
  const monthlyOffer = getMonthlyOffer(coach);
  const monthlyUnavailable =
    planMode === "monthly" && !monthlyOffer.isAvailable;

  return {
    detail: coach.bio?.trim() || "No coach bio has been added yet.",
    disabled: monthlyUnavailable,
    id: String(coach.id),
    keywords: [...(coach.specialties ?? []), ...(coach.certifications ?? [])],
    monthlyOffer,
    subtitle:
      planMode === "monthly"
        ? monthlyOffer.isAvailable
          ? `${formatCurrency(monthlyOffer.rate ?? 0)} · ${monthlyOffer.sessionCount} sessions · ${formatDurationLabel(monthlyOffer.durationMinutes)} each`
          : "Monthly offer unavailable"
        : `${getCoachPrimarySpecialty(coach)} · ${getCoachPriceLabel(coach)} · ${getCoachRatingLabel(coach)}`,
    title: getCoachName(coach),
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
  return getSharedGymDateKey();
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
  const [year, month, day] = getGymTodayString().split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  for (let offset = 0; offset < 90; offset += 1) {
    const nextDate = new Date(cursor);
    nextDate.setUTCDate(cursor.getUTCDate() + offset);
    if (availableDays.has(nextDate.getUTCDay())) {
      const nextYear = nextDate.getUTCFullYear();
      const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
      const nextDay = String(nextDate.getUTCDate()).padStart(2, "0");
      dates.push(`${nextYear}-${nextMonth}-${nextDay}`);
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

function isActiveMonthlyEntitlementConflict(error: unknown) {
  if (!(error instanceof ApiClientError) || error.status !== 409) {
    return false;
  }

  if (!error.details || typeof error.details !== "object") {
    return false;
  }

  const details = error.details as Record<string, unknown>;
  return (
    details.type === ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_TYPE &&
    details.conflict_kind === ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_KIND
  );
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
  checkoutRecovery = null,
  freeRebookDate = null,
  freeRebookAppointmentId = null,
  isVisible,
  onClose,
  onCheckoutRecoveryConsumed,
  onSuccess,
  onSingleBookingSubmitted,
  onMonthlySubmit,
}: Props) {
  const { colors } = useTheme();
  const isFreeRebook = Boolean(freeRebookAppointmentId);
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeAppointmentModalStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const attemptIdempotencyKeyRef = useRef<string | null>(null);
  const iosPresentationOwnerTokenRef = useRef<object | null>(null);
  if (!iosPresentationOwnerTokenRef.current) {
    iosPresentationOwnerTokenRef.current = {};
  }
  const iosPresentationOwnerGenerationRef = useRef(0);
  const iosCheckoutTransitionGenerationRef = useRef(0);
  const getAttemptIdempotencyKey = () => {
    if (!attemptIdempotencyKeyRef.current) {
      attemptIdempotencyKeyRef.current =
        createCommerceAttemptIdempotencyKey();
    }
    return attemptIdempotencyKeyRef.current;
  };
  const [step, setStep] = useState<AppointmentStep>("coach");
  const [planMode, setPlanMode] = useState<AppointmentPlanMode>("single");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [selectedDate, setSelectedDate] = useState(getGymTodayString());
  const [monthlyStartDate, setMonthlyStartDate] = useState(getGymTodayString());
  const [selectedSlotLabel, setSelectedSlotLabel] = useState("");
  const [appointmentConfirmation, setAppointmentConfirmation] =
    useState<AppointmentConfirmationState | null>(null);
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [coachSearchQuery, setCoachSearchQuery] = useState("");
  const [isCoachFiltersExpanded, setIsCoachFiltersExpanded] = useState(false);
  const [expandedCoachId, setExpandedCoachId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [checkoutNotice, setCheckoutNotice] =
    useState<CheckoutNoticeState | null>(null);
  const [isCheckoutRecoveryModalOpen, setIsCheckoutRecoveryModalOpen] =
    useState(false);
  const [iosResultHandoffHoldId, setIosResultHandoffHoldId] =
    useState<string | null>(null);
  const [retainedIosCheckoutNotice, setRetainedIosCheckoutNotice] =
    useState<CheckoutNoticeState | null>(null);
  const [retainedIosConfirmation, setRetainedIosConfirmation] =
    useState<AppointmentConfirmationState | null>(null);
  const [retainedIosRecovery, setRetainedIosRecovery] =
    useState<RetainedCheckoutRecoveryState | null>(null);
  const [, setIosModalLifecycleVersion] = useState(0);
  const iosModalTrackersRef = useRef<
    Record<IosCheckoutModalKey, IosCheckoutModalTracker>
  >(createIosCheckoutModalTrackers());
  const checkoutRecoverySnapshotRef =
    useRef<RetainedCheckoutRecoveryState | null>(null);
  const prepareIosResultHandoffRef =
    useRef<
      (
        presentation: BookingCheckoutIosNoticePresentation,
        ownerGeneration: number,
      ) => void
    >(() => undefined);
  const pendingSingleSubmissionRef =
    useRef<AppointmentModalSingleSubmission | null>(null);
  const checkoutModeRef = useRef<AppointmentPlanMode | null>(null);
  const resetFormStateRef = useRef<() => void>(() => undefined);
  const bookingRecoveryScope = useBookingCheckoutRecoveryScope();
  const bookingTerminalNotice = useBookingCheckoutRecoveryNotice();
  const isBookingTerminalNoticeActive = bookingTerminalNotice != null;
  const publishTerminalNotice = (
    attempt: CommerceCheckoutAttempt,
    outcome: BookingCheckoutIosNoticeOutcome,
    notice: CheckoutNoticeState,
  ) => {
    if (Platform.OS === "ios" && bookingRecoveryScope) {
      bookingRecoveryScope.requestIosNotice({
        ...notice,
        holdId: attempt.holdId,
        outcome,
        ownerGeneration: iosPresentationOwnerGenerationRef.current,
        ownerToken: iosPresentationOwnerTokenRef.current ?? undefined,
        terminal: true,
      });
      return;
    }
    if (bookingRecoveryScope) {
      bookingRecoveryScope.publishNotice(notice);
      return;
    }
    setCheckoutNotice(notice);
  };
  const finishCheckoutWithTerminalNotice = (
    attempt: CommerceCheckoutAttempt,
    outcome: BookingCheckoutIosNoticeOutcome,
    notice: CheckoutNoticeState,
  ) => {
    if (Platform.OS === "ios" && bookingRecoveryScope) {
      publishTerminalNotice(attempt, outcome, notice);
      resetFormStateRef.current();
      return;
    }
    resetFormStateRef.current();
    publishTerminalNotice(attempt, outcome, notice);
  };
  const queueIosCheckoutOpenedNotice = (
    attempt: CommerceCheckoutAttempt,
    notice: CheckoutNoticeState,
  ) => {
    if (Platform.OS !== "ios" || !bookingRecoveryScope) return false;
    iosCheckoutTransitionGenerationRef.current += 1;
    bookingRecoveryScope.requestIosNotice({
      ...notice,
      holdId: attempt.holdId,
      outcome: "checkout_opened",
      ownerGeneration: iosPresentationOwnerGenerationRef.current,
      ownerToken: iosPresentationOwnerTokenRef.current ?? undefined,
      terminal: false,
      transitionGeneration: iosCheckoutTransitionGenerationRef.current,
    });
    return true;
  };
  const checkoutReturn = useCommerceCheckoutReturn({
    isActive: isVisible,
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

      finishCheckoutWithTerminalNotice(attempt, "succeeded", {
        title: mode === "monthly" ? "Monthly coaching active" : "Session confirmed",
        message:
          mode === "monthly"
            ? "Your full PayMongo payment was confirmed. Your coach will prepare your program and session schedule next."
            : "Your full PayMongo payment was confirmed and the coaching session is now booked.",
      });
      onSuccess?.();
    },
    onTerminal: async (attempt, state) => {
      attemptIdempotencyKeyRef.current = null;
      checkoutModeRef.current = null;
      pendingSingleSubmissionRef.current = null;
      finishCheckoutWithTerminalNotice(attempt, state, {
        title: "Checkout not completed",
        message:
          state === "expired"
            ? "The PayMongo checkout expired. No coaching booking was confirmed."
            : "The PayMongo checkout was not completed. No coaching booking was confirmed.",
      });
    },
    onCancelled: async (attempt) => {
      attemptIdempotencyKeyRef.current = null;
      checkoutModeRef.current = null;
      pendingSingleSubmissionRef.current = null;
      finishCheckoutWithTerminalNotice(attempt, attempt.state, {
        title: "Checkout cancelled",
        message:
          attempt.failureReason?.trim()
            ? `Your checkout was cancelled. ${attempt.failureReason.trim()} No coaching booking was confirmed, and you can start another booking.`
            : "Your checkout was cancelled. No coaching booking was confirmed, and you can start another booking.",
      });
    },
    sharedScope: "booking",
  });
  const checkoutReturnAttemptHoldId = checkoutReturn.attempt?.holdId;
  const startCheckoutReturn = checkoutReturn.start;
  useEffect(() => {
    if (Platform.OS !== "web" || !isVisible || !checkoutRecovery) return;
    const { attempt, mode } = checkoutRecovery;
    checkoutModeRef.current = mode;
    if (checkoutReturnAttemptHoldId !== attempt.holdId) {
      startCheckoutReturn(attempt);
    }
    setAppointmentConfirmation(null);
    setCheckoutNotice(null);
    setErrorText("");
    setIsCheckoutRecoveryModalOpen(true);
    onCheckoutRecoveryConsumed?.(attempt.holdId);
  }, [
    checkoutRecovery,
    checkoutReturnAttemptHoldId,
    isVisible,
    onCheckoutRecoveryConsumed,
    startCheckoutReturn,
  ]);
  checkoutRecoverySnapshotRef.current = checkoutReturn.attempt
    ? {
        attempt: checkoutReturn.attempt,
        errorMessage: checkoutReturn.errorMessage,
        isBusy: checkoutReturn.isBusy,
        operation: checkoutReturn.operation,
        remainingSeconds: checkoutReturn.remainingSeconds,
      }
    : null;
  prepareIosResultHandoffRef.current = (presentation, ownerGeneration) => {
    if (Platform.OS !== "ios" || !bookingRecoveryScope) return;
    const request = presentation.request;
    const recoverySnapshot = checkoutRecoverySnapshotRef.current;
    const activeHoldId =
      recoverySnapshot?.attempt.holdId ??
      bookingRecoveryScope.attempt?.holdId ??
      null;
    if (activeHoldId !== request.holdId) return;

    const trackers = iosModalTrackersRef.current;
    const activeKeys = (
      Object.keys(trackers) as IosCheckoutModalKey[]
    ).filter((key) => trackers[key].requested || trackers[key].shown);
    if (activeKeys.length === 0) return;

    setIosResultHandoffHoldId(request.holdId);
    if (activeKeys.includes("checkoutNotice") && checkoutNotice) {
      setRetainedIosCheckoutNotice(checkoutNotice);
    }
    if (activeKeys.includes("confirmation") && appointmentConfirmation) {
      setRetainedIosConfirmation(appointmentConfirmation);
    }
    if (activeKeys.includes("recovery")) {
      setRetainedIosRecovery(recoverySnapshot);
    }

    for (const key of activeKeys) {
      const tracker = trackers[key];
      if (
        tracker.barrierPresentationKey === presentation.key &&
        tracker.barrierPresentationGeneration === presentation.generation &&
        tracker.barrierOwnerGeneration === ownerGeneration
      ) {
        continue;
      }
      tracker.barrierHoldId = request.holdId;
      tracker.barrierOwnerGeneration = ownerGeneration;
      tracker.barrierPresentationGeneration = presentation.generation;
      tracker.barrierPresentationKey = presentation.key;
      tracker.keepVisibleUntilShow = tracker.requested && !tracker.shown;
      bookingRecoveryScope.addIosDismissalBarrier(
        tracker.barrierToken,
        {
          holdId: request.holdId,
          ownerGeneration,
          ownerToken: iosPresentationOwnerTokenRef.current!,
          presentationGeneration: presentation.generation,
          presentationKey: presentation.key,
        },
      );
    }
    setIosModalLifecycleVersion((version) => version + 1);
  };

  useEffect(() => {
    if (Platform.OS !== "ios" || !bookingRecoveryScope) return;
    const ownerToken = iosPresentationOwnerTokenRef.current!;
    const ownerGeneration =
      iosPresentationOwnerGenerationRef.current + 1;
    iosPresentationOwnerGenerationRef.current = ownerGeneration;
    const modalTrackers = iosModalTrackersRef.current;
    const unregister = bookingRecoveryScope.addIosHandoffListener(
      ownerToken,
      ownerGeneration,
      (presentation) =>
        prepareIosResultHandoffRef.current(
          presentation,
          ownerGeneration,
        ),
    );
    return () => {
      unregister();
      bookingRecoveryScope.cancelIosPresentationOwner(
        ownerToken,
        ownerGeneration,
      );
      for (const tracker of Object.values(modalTrackers)) {
        if (tracker.barrierOwnerGeneration !== ownerGeneration) continue;
        tracker.barrierHoldId = null;
        tracker.barrierOwnerGeneration = null;
        tracker.barrierPresentationGeneration = null;
        tracker.barrierPresentationKey = null;
        tracker.keepVisibleUntilShow = false;
      }
    };
  }, [bookingRecoveryScope]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !iosResultHandoffHoldId) return;
    if (
      bookingRecoveryScope?.hasIosNoticeForHold(iosResultHandoffHoldId)
    ) {
      return;
    }

    const trackers = iosModalTrackersRef.current;
    for (const key of Object.keys(trackers) as IosCheckoutModalKey[]) {
      const tracker = trackers[key];
      if (tracker.barrierHoldId === iosResultHandoffHoldId) {
        tracker.barrierHoldId = null;
        tracker.barrierOwnerGeneration = null;
        tracker.barrierPresentationGeneration = null;
        tracker.barrierPresentationKey = null;
        tracker.keepVisibleUntilShow = false;
      }
    }
    setIosResultHandoffHoldId(null);
    setRetainedIosCheckoutNotice(null);
    setRetainedIosConfirmation(null);
    setRetainedIosRecovery(null);
  }, [
    bookingRecoveryScope,
    bookingTerminalNotice,
    iosResultHandoffHoldId,
  ]);

  const handleIosModalShow = useCallback(
    (key: IosCheckoutModalKey, identity: IosCheckoutModalBarrierIdentity) => {
      if (Platform.OS !== "ios") return;
      const tracker = iosModalTrackersRef.current[key];
      const barrier: BookingCheckoutIosDismissalBarrier | null =
        identity.holdId &&
        identity.ownerGeneration != null &&
        identity.presentationGeneration != null &&
        identity.presentationKey
          ? {
              holdId: identity.holdId,
              ownerGeneration: identity.ownerGeneration,
              ownerToken: iosPresentationOwnerTokenRef.current!,
              presentationGeneration: identity.presentationGeneration,
              presentationKey: identity.presentationKey,
            }
          : null;
      if (barrier) {
        if (
          !bookingRecoveryScope?.matchesIosDismissalBarrier(
            tracker.barrierToken,
            barrier,
          )
        ) {
          return;
        }
      } else if (
        tracker.barrierHoldId != null ||
        tracker.barrierOwnerGeneration != null ||
        tracker.barrierPresentationGeneration != null ||
        tracker.barrierPresentationKey != null
      ) {
        return;
      }
      tracker.shown = true;
      if (!tracker.keepVisibleUntilShow) return;
      tracker.keepVisibleUntilShow = false;
      setIosModalLifecycleVersion((version) => version + 1);
    },
    [bookingRecoveryScope],
  );

  const handleIosModalDismiss = useCallback(
    (key: IosCheckoutModalKey, identity: IosCheckoutModalBarrierIdentity) => {
      if (Platform.OS !== "ios") return;
      const tracker = iosModalTrackersRef.current[key];
      const barrier: BookingCheckoutIosDismissalBarrier | null =
        identity.holdId &&
        identity.ownerGeneration != null &&
        identity.presentationGeneration != null &&
        identity.presentationKey
          ? {
              holdId: identity.holdId,
              ownerGeneration: identity.ownerGeneration,
              ownerToken: iosPresentationOwnerTokenRef.current!,
              presentationGeneration: identity.presentationGeneration,
              presentationKey: identity.presentationKey,
            }
          : null;
      if (barrier) {
        if (
          !bookingRecoveryScope?.matchesIosDismissalBarrier(
            tracker.barrierToken,
            barrier,
          )
        ) {
          return;
        }
      } else if (
        tracker.barrierHoldId != null ||
        tracker.barrierOwnerGeneration != null ||
        tracker.barrierPresentationGeneration != null ||
        tracker.barrierPresentationKey != null
      ) {
        return;
      }
      tracker.barrierHoldId = null;
      tracker.barrierOwnerGeneration = null;
      tracker.barrierPresentationGeneration = null;
      tracker.barrierPresentationKey = null;
      tracker.keepVisibleUntilShow = false;
      tracker.requested = false;
      tracker.shown = false;

      if (key === "checkoutNotice") setRetainedIosCheckoutNotice(null);
      if (key === "confirmation") setRetainedIosConfirmation(null);
      if (key === "recovery") setRetainedIosRecovery(null);
      if (barrier) {
        bookingRecoveryScope?.resolveIosDismissalBarrier(
          tracker.barrierToken,
          barrier,
        );
      }
    },
    [bookingRecoveryScope],
  );
  const [coachPickerFilter, setCoachPickerFilter] =
    useState<CoachPickerFilter>(DEFAULT_COACH_PICKER_FILTER);

  useEffect(() => {
    if (!isVisible || !isFreeRebook) return;
    setPlanMode("single");
    setStep("coach");
    setSelectedDate(freeRebookDate ?? getGymTodayString());
    setSelectedSlotLabel("");
  }, [freeRebookDate, isFreeRebook, isVisible]);

  const {
    data: coaches = [],
    isLoading: coachesLoading,
    error: coachesError,
    refetch: refetchCoaches,
  } = useQuery({
    ...activeCoachesQueryOptions<CoachRecord>(mobileApiClient),
    enabled: isVisible,
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

  const coachPickerOptions = useMemo(
    () => filteredCoaches.map((coach) => toCoachPickerOption(coach, planMode)),
    [filteredCoaches, planMode],
  );
  const coachPickerFilters = useMemo(
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

  const activeCoachFilterCount =
    (coachPickerFilter.specialty ? 1 : 0) +
    (coachPickerFilter.minimumRating > 0 ? 1 : 0);

  useEffect(() => {
    if (!selectedCoachId || coachesLoading || coaches.length === 0) return;
    if (coaches.some((coach) => String(coach.id) === selectedCoachId)) {
      return;
    }
    setSelectedCoachId(null);
    setSelectedSlotLabel("");
    setExpandedCoachId(null);
  }, [coaches, coachesLoading, selectedCoachId]);

  const selectedCoach = useMemo(
    () => coaches.find((coach) => String(coach.id) === selectedCoachId) ?? null,
    [coaches, selectedCoachId],
  );
  const selectedCoachOption = useMemo(
    () =>
      selectedCoach ? toCoachPickerOption(selectedCoach, planMode) : null,
    [planMode, selectedCoach],
  );
  const searchedCoachPickerOptions = useMemo(
    () => filterBookingPickerOptions(coachPickerOptions, coachSearchQuery),
    [coachPickerOptions, coachSearchQuery],
  );
  const visibleCoachPickerOptions = useMemo(() => {
    if (!selectedCoachOption) return searchedCoachPickerOptions;
    if (
      searchedCoachPickerOptions.some(
        (option) => option.id === selectedCoachOption.id,
      )
    ) {
      return searchedCoachPickerOptions;
    }
    return [selectedCoachOption, ...searchedCoachPickerOptions];
  }, [searchedCoachPickerOptions, selectedCoachOption]);
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

  const slotOptions = useMemo<SlotOption[]>(() => {
    if (planMode !== "single") {
      return [];
    }
    return canonicalDateSlots
      .filter((slot) => {
        const startTime = isoToTimeValue(slot.startAt);
        return (
          slot.available &&
          !!startTime
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
    planMode,
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
        disabled: isGymSlotInPast(selectedDate, slot.startTime),
        time: slot.label,
        duration: formatDurationLabel(slot.durationMin),
        status: "available",
        spots: 1,
      })),
    [selectedDate, slotOptions],
  );
  const bookableSlotCount = timeSlots.filter((slot) => !slot.disabled).length;

  const selectedSlot = useMemo(
    () => slotOptions.find((slot) => slot.label === selectedSlotLabel) ?? null,
    [selectedSlotLabel, slotOptions],
  );

  const createAppointmentMutation = useMutation(
    createAppointmentMutationOptions(mobileApiClient, queryClient),
  );
  const isCheckoutActive = checkoutReturn.attempt != null;
  const isBusy = createAppointmentMutation.isPending || isSubmitting;
  const checkoutHoldId = checkoutReturn.attempt?.holdId ?? null;

  useEffect(() => {
    if (!checkoutHoldId) {
      setIsCheckoutRecoveryModalOpen(false);
      return;
    }
    const iosNoticeHandoffPending =
      Platform.OS === "ios" &&
      (isBookingTerminalNoticeActive ||
        (checkoutHoldId != null &&
          iosResultHandoffHoldId === checkoutHoldId &&
          (bookingRecoveryScope?.hasIosNoticeForHold(checkoutHoldId) ??
            false)));
    if (
      isVisible &&
      checkoutNotice == null &&
      !iosNoticeHandoffPending
    ) {
      setIsCheckoutRecoveryModalOpen(true);
    }
  }, [
    bookingRecoveryScope,
    checkoutHoldId,
    checkoutNotice,
    iosResultHandoffHoldId,
    isBookingTerminalNoticeActive,
    isVisible,
  ]);

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
  const totalAmountLabel = isFreeRebook
    ? "Free"
    : canShowPaymentBreakdown
    ? formatCurrency(estimatedTotalAmount)
    : "Select a slot";
  const fullPaymentLabel = isFreeRebook
    ? "Free"
    : canShowPaymentBreakdown
    ? formatCurrency(estimatedTotalAmount)
    : "Select a slot";
  const paymentEstimateSummary = useMemo(() => {
    if (isCheckoutActive) {
      return {
        body: "A previous payment is still being confirmed. Keep browsing here, then try another booking after it is settled.",
        eyebrow: "Recovery available",
        title: "Continue this payment",
      };
    }

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
      title: "Ready to pay",
    };
  }, [estimatedTotalAmount, hasSelectedSlot, hasValidCoachRate, isCheckoutActive]);

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
      return "Select a coach to view their profile and available times.";
    }
    if (availabilityLoading) {
      return "Loading available times for this coach.";
    }
    if (availabilityError) {
      return availabilityError instanceof Error
        ? availabilityError.message
        : "Unable to load available times for this coach.";
    }
    if (canonicalDateSlotsLoading) {
      return "Checking available times…";
    }
    if (canonicalDateSlotsError) {
      return canonicalDateSlotsError instanceof Error
        ? canonicalDateSlotsError.message
        : "Unable to load available times.";
    }
    if (slotOptions.length === 0) {
      return `No ${selectedDuration}-minute slots are available on ${formatBookingDate(selectedDate)}. Try another date or another coach.`;
    }
    if (bookableSlotCount === 0) {
      return `No future ${selectedDuration}-minute slots are available on ${formatBookingDate(selectedDate)}. Try another date or another coach.`;
    }
    return `${bookableSlotCount} ${bookableSlotCount === 1 ? "time" : "times"} available on ${formatBookingDate(selectedDate)}.`;
  }, [
    availabilityError,
    availabilityLoading,
    canonicalDateSlotsError,
    canonicalDateSlotsLoading,
    selectedCoach,
    selectedDate,
    selectedDuration,
    bookableSlotCount,
    slotOptions.length,
  ]);

  const resetFormState = () => {
    setStep("coach");
    setSelectedCoachId(null);
    setPlanMode("single");
    setSelectedDate(getGymTodayString());
    setMonthlyStartDate(getGymTodayString());
    setSelectedDuration(60);
    setSelectedSlotLabel("");
    setAppointmentConfirmation(null);
    setIsCalOpen(false);
    setIsTimeOpen(false);
    setCoachSearchQuery("");
    setIsCoachFiltersExpanded(false);
    setExpandedCoachId(null);
    setIsSubmitting(false);
    setErrorText("");
    setCoachPickerFilter(DEFAULT_COACH_PICKER_FILTER);
    setCheckoutNotice(null);
  };
  resetFormStateRef.current = resetFormState;

  const openCheckoutRecovery = () => {
    setAppointmentConfirmation(null);
    setErrorText("");
    setIsCheckoutRecoveryModalOpen(true);
  };

  useEffect(() => {
    if (isVisible) return;
    // The host can dismiss this modal directly (for example after a
    // successful checkout), so reset child/form state even when the footer
    // handler was not the source of the close. The checkout hold and its
    // submitted snapshot stay alive in their refs until terminal polling.
    resetFormStateRef.current();
  }, [isVisible]);

  const resetAndClose = () => {
    if (isBusy) {
      return;
    }
    setIsCheckoutRecoveryModalOpen(false);
    resetFormState();
    if (!checkoutReturn.attempt) {
      attemptIdempotencyKeyRef.current = null;
    }
    onClose();
  };

  const handleModeSelect = (mode: AppointmentPlanMode) => {
    if (isBusy || (isFreeRebook && mode !== "single")) return;
    if (!isCheckoutActive) {
      attemptIdempotencyKeyRef.current = null;
    }
    setPlanMode(mode);
    setStep("coach");
    setSelectedCoachId(null);
    setSelectedDuration(60);
    setSelectedSlotLabel("");
    setCoachSearchQuery("");
    setIsCoachFiltersExpanded(false);
    setExpandedCoachId(null);
    setCoachPickerFilter(DEFAULT_COACH_PICKER_FILTER);
    setErrorText("");
  };

  const handleCoachFilterPress = (id: string) => {
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
  };

  const handleCoachSelect = (coachId: string) => {
    if (isBusy) return;
    const coach = coaches.find((candidate) => String(candidate.id) === coachId);
    if (!coach) return;
    setSelectedCoachId(coachId);
    setSelectedSlotLabel("");
    setErrorText("");
    setExpandedCoachId(coachId);
  };

  const handleCoachHeaderPress = (coachId: string, disabled = false) => {
    if (disabled || isBusy) return;
    if (selectedCoachId !== coachId) {
      handleCoachSelect(coachId);
      return;
    }
    setExpandedCoachId((current) => (current === coachId ? null : coachId));
  };

  const goToScheduleStep = () => {
    if (planMode !== "single") return;
    if (isBusy) return;
    if (isCheckoutActive) {
      openCheckoutRecovery();
      return;
    }
    if (!selectedCoach) {
      setErrorText("Select a coach to continue.");
      return;
    }
    setErrorText("");
    setStep("time");
  };

  const handleBookAppointment = async () => {
    if (isCheckoutActive) {
      openCheckoutRecovery();
      return;
    }
    if (isBusy) return;
    if (
      planMode !== "single" ||
      !selectedCoach ||
      !selectedSlot ||
      (!isFreeRebook && !hasValidCoachRate)
    ) {
      return;
    }

    if (isGymSlotInPast(selectedDate, selectedSlot.startTime)) {
      setErrorText("That time has already passed. Choose another time.");
      return;
    }

    setErrorText("");
    setIsSubmitting(true);
    let checkoutAttempt: CommerceCheckoutAttempt | null = null;
    try {
      const scheduledAt = toGymWallClockIso(
        selectedDate,
        selectedSlot.startTime,
      );
      const bookingResult = await createAppointmentMutation.mutateAsync({
        payload: {
          ...(isFreeRebook ? {} : resolveCheckoutReturnInput("bookings")),
          coachId: String(selectedCoach.id),
          scheduledAt,
          duration: selectedDuration,
          bookingMode: "single",
          sessionCount: 1,
          freeRebookAppointmentId: freeRebookAppointmentId ?? undefined,
          idempotencyKey: getAttemptIdempotencyKey(),
        },
      });

      if (isFreeRebook) {
        if ("holdId" in bookingResult) {
          throw new Error("The free replacement session could not be confirmed.");
        }
        attemptIdempotencyKeyRef.current = null;
        resetFormState();
        setCheckoutNotice({
          title: "Free rebook confirmed",
          message: "Your free replacement session is booked.",
        });
        onSuccess?.();
        return;
      }

      if (!("holdId" in bookingResult)) {
        throw new Error("PayMongo did not return a checkout handle.");
      }
      checkoutAttempt = bookingResult;

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
        scheduledAt,
      };
      checkoutReturn.start(checkoutAttempt);
      const usesIosCheckoutNotice = queueIosCheckoutOpenedNotice(
        checkoutAttempt,
        {
          title: "PayMongo checkout opened",
          message:
            "Complete the full checkout, then return to FitTrack. The session is confirmed only after successful payment confirmation.",
        },
      );
      setAppointmentConfirmation(null);
      resetFormState();
      if (!usesIosCheckoutNotice) {
        setCheckoutNotice({
          title: "PayMongo checkout opened",
          message:
            "Complete the full checkout, then return to FitTrack. The session is confirmed only after successful payment confirmation.",
        });
      }
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
    if (isCheckoutActive) {
      openCheckoutRecovery();
      return;
    }
    if (isBusy) return;
    if (!selectedCoach || !selectedSlot) {
      setErrorText("Select both date and time.");
      return;
    }
    if (!isFreeRebook && !hasValidCoachRate) {
      setErrorText("This coach does not have a valid session rate yet.");
      return;
    }
    const scheduleLabel = `${formatBookingDate(selectedDate)} at ${selectedSlot.label}`;

    setAppointmentConfirmation({
      title: isFreeRebook ? "Review free rebook?" : "Book and pay in full?",
      message: isFreeRebook
        ? `Book a free replacement session with ${getCoachName(selectedCoach)} for ${scheduleLabel}?`
        : "Book " +
          getCoachName(selectedCoach) +
          " for " +
          scheduleLabel +
          ". PayMongo checkout opens next. The booking is confirmed only after payment succeeds.",
      yesLabel: isFreeRebook ? "Review Rebook (Free)" : "Book & Pay in Full",
    });
  };

  const handleMonthlyConfirm = () => {
    if (planMode !== "monthly") return;
    if (isCheckoutActive) {
      openCheckoutRecovery();
      return;
    }
    if (isBusy) return;
    if (!selectedCoach) {
      setErrorText("Select a coach to continue.");
      return;
    }
    if (!monthlyOffer.isAvailable) {
      setErrorText("This coach does not have an active monthly offer.");
      return;
    }
    if (!monthlyStartDate || monthlyStartDate < getGymTodayString()) {
      setErrorText("Choose a monthly coaching start date today or later.");
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
    if (isCheckoutActive) {
      openCheckoutRecovery();
      return;
    }
    if (isBusy) return;
    if (
      planMode !== "monthly" ||
      !selectedCoach ||
      !monthlyOffer.isAvailable ||
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
        ...resolveCheckoutReturnInput("bookings"),
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
      const usesIosCheckoutNotice = queueIosCheckoutOpenedNotice(
        checkoutAttempt,
        {
          title: "PayMongo checkout opened",
          message:
            "Complete the full checkout, then return to FitTrack. Your monthly coaching relationship activates after successful confirmation.",
        },
      );
      setAppointmentConfirmation(null);
      resetFormState();
      if (!usesIosCheckoutNotice) {
        setCheckoutNotice({
          title: "PayMongo checkout opened",
          message:
            "Complete the full checkout, then return to FitTrack. Your monthly coaching relationship activates after successful confirmation.",
        });
      }
    } catch (error: unknown) {
      attemptIdempotencyKeyRef.current = null;
      checkoutModeRef.current = null;
      setAppointmentConfirmation(null);
      if (isActiveMonthlyEntitlementConflict(error)) {
        setErrorText("");
        setCheckoutNotice(ACTIVE_MONTHLY_ENTITLEMENT_CONFLICT_NOTICE);
      } else {
        setErrorText(getCallbackCheckoutFailureMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }

  };

  const handleSubmitBooking = async () => {
    if (isCheckoutActive || isBusy) {
      if (isCheckoutActive) {
        openCheckoutRecovery();
      }
      return;
    }
    if (planMode === "single") {
      await handleBookAppointment();
      return;
    }
    if (planMode === "monthly") {
      await handleMonthlyBooking();
    }
  };

  const isIosResultHandoffPending =
    Platform.OS === "ios" &&
    iosResultHandoffHoldId != null &&
    (bookingRecoveryScope?.hasIosNoticeForHold(iosResultHandoffHoldId) ??
      false);
  const resolveTrackedModalVisibility = (
    key: IosCheckoutModalKey,
    requested: boolean,
  ) => {
    const tracker = iosModalTrackersRef.current[key];
    if (Platform.OS !== "ios" || !isIosResultHandoffPending) {
      tracker.requested = requested;
      return requested;
    }
    if (tracker.keepVisibleUntilShow) {
      tracker.requested = true;
      return true;
    }
    tracker.requested = false;
    return false;
  };
  const checkoutNoticeForPresentation =
    checkoutNotice ?? retainedIosCheckoutNotice;
  const confirmationForPresentation =
    appointmentConfirmation ?? retainedIosConfirmation;
  const recoveryForPresentation =
    checkoutReturn.attempt != null
      ? checkoutRecoverySnapshotRef.current
      : retainedIosRecovery;
  const appointmentModalVisible = resolveTrackedModalVisibility(
    "appointment",
    isVisible &&
      appointmentConfirmation == null &&
      checkoutNotice == null &&
      !isCheckoutRecoveryModalOpen &&
      !isBookingTerminalNoticeActive &&
      !isCalOpen &&
      !isTimeOpen,
  );
  const checkoutRecoveryModalVisible = resolveTrackedModalVisibility(
    "recovery",
    isVisible &&
      isCheckoutRecoveryModalOpen &&
      !isBookingTerminalNoticeActive &&
      checkoutReturn.attempt != null,
  );
  const checkoutNoticeModalVisible = resolveTrackedModalVisibility(
    "checkoutNotice",
    checkoutNotice != null,
  );
  const confirmationModalVisible = resolveTrackedModalVisibility(
    "confirmation",
    isVisible && appointmentConfirmation != null,
  );
  const getIosModalBarrierIdentity = (
    key: IosCheckoutModalKey,
  ): IosCheckoutModalBarrierIdentity => {
    const tracker = iosModalTrackersRef.current[key];
    return {
      holdId: tracker.barrierHoldId,
      ownerGeneration: tracker.barrierOwnerGeneration,
      presentationGeneration: tracker.barrierPresentationGeneration,
      presentationKey: tracker.barrierPresentationKey,
    };
  };
  const appointmentBarrierIdentity =
    getIosModalBarrierIdentity("appointment");
  const checkoutNoticeBarrierIdentity =
    getIosModalBarrierIdentity("checkoutNotice");
  const confirmationBarrierIdentity =
    getIosModalBarrierIdentity("confirmation");
  const recoveryBarrierIdentity = getIosModalBarrierIdentity("recovery");

  return (
    <Fragment>
      <Modal
        visible={appointmentModalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onDismiss={
          Platform.OS === "ios"
            ? () =>
                handleIosModalDismiss(
                  "appointment",
                  appointmentBarrierIdentity,
                )
            : undefined
        }
        onRequestClose={resetAndClose}
        onShow={
          Platform.OS === "ios"
            ? () =>
                handleIosModalShow(
                  "appointment",
                  appointmentBarrierIdentity,
                )
            : undefined
        }
      >
        <KeyboardAvoidingView
          style={s.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View style={[s.backdrop, backdropStyle]}>
            <Animated.View
              style={[s.card, cardStyle]}
              testID="appointment-modal-card"
            >
              <Animated.View style={[s.header, headerBorderStyle]}>
                <View style={s.headerIcon}>
                  <Users size={18} color={colors.brand} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <FitText style={s.headerTitle}>Book a Trainer</FitText>
                  <FitText style={s.headerSubtitle}>
                    {isFreeRebook
                      ? "Choose a coach and time for your free replacement session today."
                      : step === "coach"
                      ? planMode === "monthly"
                        ? "Choose a monthly offer"
                        : "Duration and coach"
                      : "Choose a date and available time"}
                  </FitText>
                </View>
              </Animated.View>
              <FitModalScrollView
                testID="appointment-modal-body"
                style={s.middle}
                contentContainerStyle={s.body}
                resetKey={`${isVisible}-${step}`}
                showScrollCue={false}
              >
                {step === "coach" ? (
                  <View style={{ gap: 12 }}>
                    <View style={s.planOptionList}>
                      {PLAN_OPTION_CARDS.filter(
                        (option) => !isFreeRebook || option.key === "single",
                      ).map((option) => {
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
                            aria-selected={isSelected}
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
                    {planMode === "single" ? (
                      <View style={s.previewCard}>
                        <FitText style={s.previewSectionTitle}>
                          SESSION DURATION
                        </FitText>
                        <FitText style={s.helperText}>
                          Choose a session length to see available times.
                        </FitText>
                        <View style={[s.filterChipRow, s.durationChipRow]}>
                          {ONE_TIME_DURATION_OPTIONS.map((duration) => {
                            const isActive = selectedDuration === duration;
                            return (
                              <Pressable
                                key={duration}
                                style={[
                                  s.filterChip,
                                  s.durationChip,
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
                                aria-selected={isActive}
                                aria-pressed={isActive}
                                hitSlop={{ top: 5, bottom: 5 }}
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
                    <View style={s.coachPicker}>
                      <FitText style={s.sectionLabel}>COACH</FitText>
                      <View style={s.coachSearchRow}>
                        <View style={s.coachSearch}>
                          <FitSearch
                            value={coachSearchQuery}
                            onChangeText={setCoachSearchQuery}
                            placeholder="Search coaches or specialties"
                          />
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            isCoachFiltersExpanded
                              ? "Hide coach filters"
                              : "Show coach filters"
                          }
                          accessibilityState={{
                            expanded: isCoachFiltersExpanded,
                          }}
                          aria-expanded={isCoachFiltersExpanded}
                          onPress={() =>
                            setIsCoachFiltersExpanded((current) => !current)
                          }
                          style={s.filterToggle}
                        >
                          <SlidersHorizontal
                            color={colors.textMuted}
                            size={17}
                            strokeWidth={2}
                          />
                          {activeCoachFilterCount > 0 ? (
                            <View style={s.filterBadge}>
                              <FitText style={s.filterBadgeText}>
                                {activeCoachFilterCount}
                              </FitText>
                            </View>
                          ) : null}
                        </Pressable>
                      </View>
                      {isCoachFiltersExpanded ? (
                        <View style={s.filterPanel}>
                          <View style={s.filterChipRow}>
                            {coachPickerFilters.map((filter) => (
                              <Pressable
                                key={filter.id}
                                accessibilityRole="button"
                                accessibilityLabel={filter.label}
                                accessibilityState={{ selected: filter.selected }}
                                aria-selected={filter.selected}
                                aria-pressed={filter.selected}
                                onPress={() => handleCoachFilterPress(filter.id)}
                                style={[
                                  s.filterChip,
                                  filter.selected && {
                                    backgroundColor: colors.brand + "12",
                                    borderColor: colors.brand,
                                  },
                                ]}
                              >
                                <FitText
                                  style={[
                                    s.filterChipText,
                                    filter.selected && { color: colors.brand },
                                  ]}
                                >
                                  {filter.label}
                                </FitText>
                              </Pressable>
                            ))}
                          </View>
                          {activeCoachFilterCount > 0 ? (
                            <FitButton
                              label="Clear filters"
                              onPress={() =>
                                setCoachPickerFilter(DEFAULT_COACH_PICKER_FILTER)
                              }
                              variant="ghost"
                            />
                          ) : null}
                        </View>
                      ) : null}
                      {coachesLoading ? (
                        <View style={s.coachState}>
                          <FitText style={s.helperText}>
                            Loading available coaches...
                          </FitText>
                        </View>
                      ) : coachesError ? (
                        <View style={s.coachState}>
                          <FitText style={s.errorText}>{coachLoadMessage}</FitText>
                          <FitButton
                            label="Retry"
                            onPress={() => void refetchCoaches()}
                            variant="ghost"
                          />
                        </View>
                      ) : visibleCoachPickerOptions.length === 0 ? (
                        <View style={s.coachState}>
                          <FitText style={s.helperText}>
                            {coaches.length === 0
                              ? "No coaches are available to book right now."
                              : "No coaches match your search or filters."}
                          </FitText>
                        </View>
                      ) : (
                        <View style={s.coachList}>
                          {selectedCoachOption &&
                          searchedCoachPickerOptions.length === 0 ? (
                            <FitText style={s.helperText}>
                              No other coaches match your search or filters. Showing your selected coach.
                            </FitText>
                          ) : null}
                          {visibleCoachPickerOptions.map((option) => {
                            const coach = coaches.find(
                              (candidate) => String(candidate.id) === option.id,
                            );
                            if (!coach) return null;
                            const isSelected = selectedCoachId === option.id;
                            const isExpanded =
                              isSelected && expandedCoachId === option.id;
                            const isPinnedSelected =
                              isSelected &&
                              !searchedCoachPickerOptions.some(
                                (candidate) => candidate.id === option.id,
                              );
                            const coachMonthlyOffer = getMonthlyOffer(coach);
                            return (
                              <View key={option.id} style={s.coachCard}>
                                {isPinnedSelected ? (
                                  <FitText style={s.selectedCoachCaption}>
                                    Selected coach
                                  </FitText>
                                ) : null}
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={option.title}
                                  accessibilityState={{
                                    disabled: option.disabled,
                                    expanded: isExpanded,
                                    selected: isSelected,
                                  }}
                                  aria-disabled={option.disabled}
                                  aria-expanded={isExpanded}
                                  aria-selected={isSelected}
                                  disabled={option.disabled}
                                  onPress={() =>
                                    handleCoachHeaderPress(option.id, option.disabled)
                                  }
                                  style={s.coachRow}
                                >
                                  <View style={s.coachInfo}>
                                    <View style={s.coachNameRow}>
                                      <FitText
                                        style={[
                                          s.coachName,
                                          { fontWeight: "700" },
                                          isSelected && { color: colors.brand },
                                        ]}
                                      >
                                        {getCoachName(coach)}
                                      </FitText>
                                      {isSelected ? (
                                        <CheckCircle
                                          color={colors.brand}
                                          size={18}
                                          strokeWidth={2}
                                        />
                                      ) : null}
                                    </View>
                                    <FitText style={s.coachSpecialty}>
                                      {planMode === "monthly"
                                        ? coachMonthlyOffer.isAvailable
                                          ? `${formatCurrency(coachMonthlyOffer.rate ?? 0)} · ${coachMonthlyOffer.sessionCount} sessions · ${formatDurationLabel(coachMonthlyOffer.durationMinutes)} each`
                                          : "Monthly offer unavailable"
                                        : getCoachPrimarySpecialty(coach)}
                                    </FitText>
                                    <View style={s.coachMetaRow}>
                                      <FitText
                                        style={[
                                          s.coachRating,
                                          isSelected && { color: colors.brand },
                                        ]}
                                      >
                                        {planMode === "monthly"
                                          ? coachMonthlyOffer.isAvailable
                                            ? "Monthly offer ready"
                                            : "Unavailable for monthly"
                                          : getCoachPriceLabel(coach)}
                                      </FitText>
                                      <FitText style={s.coachMetaChipText}>
                                        {getCoachRatingLabel(coach)}
                                      </FitText>
                                    </View>
                                  </View>
                                  <View style={s.coachChevron}>
                                    {isExpanded ? (
                                      <ChevronUp
                                        color={colors.textMuted}
                                        size={18}
                                        strokeWidth={2}
                                      />
                                    ) : (
                                      <ChevronDown
                                        color={colors.textMuted}
                                        size={18}
                                        strokeWidth={2}
                                      />
                                    )}
                                  </View>
                                </Pressable>
                                <View
                                  accessibilityElementsHidden={!isExpanded}
                                  aria-hidden={!isExpanded}
                                  importantForAccessibility={
                                    isExpanded ? "auto" : "no-hide-descendants"
                                  }
                                  pointerEvents={isExpanded ? "auto" : "none"}
                                  style={[s.coachDetails, !isExpanded && { display: "none" }]}
                                  testID={`coach-details-${option.id}`}
                                >
                                  {isExpanded ? (
                                    <>
                                      <FitText style={s.coachBio}>
                                        {option.detail}
                                      </FitText>
                                      <View style={s.coachDetailsSection}>
                                        <FitText style={s.coachDetailsSectionTitle}>
                                          SPECIALTIES
                                        </FitText>
                                        <FitText style={s.coachDetailsText}>
                                          {coach.specialties?.length
                                            ? coach.specialties.join(", ")
                                            : "No specialties listed yet."}
                                        </FitText>
                                      </View>
                                      <View style={s.coachDetailsSection}>
                                        <FitText style={s.coachDetailsSectionTitle}>
                                          CERTIFICATIONS
                                        </FitText>
                                        <FitText style={s.coachDetailsText}>
                                          {coach.certifications?.length
                                            ? coach.certifications.join(", ")
                                            : "No certifications listed yet."}
                                        </FitText>
                                      </View>
                                      {planMode === "single" ? (
                                        <View style={s.coachDetailsSection}>
                                          <FitText style={s.coachDetailsSectionTitle}>
                                            AVAILABILITY
                                          </FitText>
                                          <FitText style={s.coachDetailsText}>
                                            {availabilityStatusMessage}
                                          </FitText>
                                        </View>
                                      ) : (
                                        <View style={s.coachDetailsSection}>
                                          <FitText style={s.coachDetailsSectionTitle}>
                                            MONTHLY OFFER
                                          </FitText>
                                          {coachMonthlyOffer.isAvailable ? (
                                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                                              <FitText
                                                style={[
                                                  s.coachDetailsText,
                                                  { color: colors.brand, fontWeight: "700" },
                                                ]}
                                              >
                                                {formatCurrency(coachMonthlyOffer.rate ?? 0)}
                                              </FitText>
                                              <FitText style={s.coachDetailsText}>
                                                · {coachMonthlyOffer.sessionCount} sessions · {formatDurationLabel(coachMonthlyOffer.durationMinutes)} each
                                              </FitText>
                                            </View>
                                          ) : (
                                            <FitText style={s.coachDetailsText}>Monthly offer unavailable</FitText>
                                          )}
                                          <FitText style={s.helperText}>
                                            Your monthly coaching plan starts after payment.
                                          </FitText>
                                          <FitText style={[s.coachDetailsSectionTitle, { marginTop: 10 }]}>
                                            START DATE
                                          </FitText>
                                          <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={`Monthly coaching start date ${formatBookingDate(monthlyStartDate)}`}
                                            style={[
                                              s.fieldBtn,
                                              {
                                                borderColor: monthlyStartDate
                                                  ? colors.brand
                                                  : colors.fieldBorder,
                                              },
                                            ]}
                                            onPress={() => setIsCalOpen(true)}
                                          >
                                            <CalendarDays
                                              color={colors.brand}
                                              size={16}
                                              strokeWidth={2}
                                            />
                                            <FitText
                                              style={[
                                                s.fieldBtnText,
                                                { color: colors.textPrimary },
                                              ]}
                                            >
                                              {formatBookingDate(monthlyStartDate)}
                                            </FitText>
                                          </Pressable>
                                        </View>
                                      )}
                                    </>
                                  ) : null}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                    {!selectedCoach && errorText ? (
                      <FitText style={s.errorText}>{errorText}</FitText>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {selectedCoach ? (
                      <View style={s.previewCard}>
                        <FitText style={[s.previewTitle, { color: colors.brand }]}>
                          {getCoachName(selectedCoach)}
                        </FitText>
                        <FitText
                          style={[
                            s.previewSubtitle,
                            { color: colors.brand, fontWeight: "700" },
                          ]}
                        >
                          {getCoachPrimarySpecialty(selectedCoach)} {" · "}
                          {getCoachPriceLabel(selectedCoach)} {" · "}
                          {formatDurationLabel(selectedDuration)}
                        </FitText>
                      </View>
                    ) : null}
                    <View style={s.previewCard}>
                      <FitText style={s.previewSectionTitle}>
                        {isFreeRebook ? "FREE REBOOK SESSION" : "ONE-TIME SESSION"}
                      </FitText>
                      <FitText style={s.previewPlainText}>
                        {isFreeRebook
                          ? "Choose a coach and time for your free replacement session today."
                          : selectedPlan?.body}
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
                        <FitText
                          style={[
                            s.fieldBtnText,
                            { color: colors.brand, fontWeight: "700" },
                          ]}
                        >
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
                            selectedSlotLabel && {
                              color: colors.brand,
                              fontWeight: "700",
                            },
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
                        {isFreeRebook ? "REBOOK SUMMARY" : "PAYMENT ESTIMATE"}
                      </FitText>
                      {isFreeRebook ? (
                        <FitText style={s.helperText}>
                          Included with your affected session.
                        </FitText>
                      ) : (
                        <FitText style={s.helperText}>
                          Pay the full amount through PayMongo to confirm the
                          booking.
                        </FitText>
                      )}
                      <FitText style={s.previewTitle}>
                        {isFreeRebook ? "Free" : paymentEstimateSummary.title}
                      </FitText>
                      <FitText style={s.previewPlainText}>
                        {isFreeRebook
                          ? "Your free replacement session is valid for the same gym day."
                          : paymentEstimateSummary.body}
                      </FitText>
                      <View style={s.paymentBreakdownRow}>
                        <View style={s.paymentBreakdownColumn}>
                          <FitText style={s.previewSectionTitle}>TOTAL</FitText>
                          <FitText
                            style={[
                              s.paymentBreakdownValue,
                              { color: colors.brand },
                            ]}
                          >
                            {totalAmountLabel}
                          </FitText>
                        </View>
                        <View style={s.paymentBreakdownColumn}>
                          <FitText style={s.previewSectionTitle}>
                            {isFreeRebook ? "COST" : "PAY NOW"}
                          </FitText>
                          <FitText
                            style={[
                              s.paymentBreakdownValue,
                              { color: colors.brand },
                            ]}
                          >
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
                      : () => setStep("coach")
                  }
                  disabled={isBusy}
                  flex={1}
                />
                <FitButton
                  label={
                    step === "coach"
                      ? planMode === "monthly"
                        ? "Confirm & Pay"
                        : "Choose date & time"
                      : isBusy
                        ? sendingRequestLabel
                        : isFreeRebook
                          ? "Review Rebook (Free)"
                          : "Review & pay"
                  }
                  variant="primary"
                  onPress={
                    step === "coach"
                      ? planMode === "monthly"
                        ? handleMonthlyConfirm
                        : goToScheduleStep
                      : handleConfirm
                  }
                  disabled={
                    step === "time"
                      ? !selectedSlot ||
                        (!isFreeRebook && !hasValidCoachRate) ||
                        isBusy
                      : step === "coach"
                        ? !selectedCoach ||
                          coachesLoading ||
                          isBusy ||
                          (planMode === "monthly" &&
                            (!monthlyOffer.isAvailable ||
                              !monthlyStartDate))
                        : isBusy
                  }
                  loading={isBusy}
                  flex={2}
                />
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      {recoveryForPresentation ? (
        <CheckoutRecoveryModal
          attempt={recoveryForPresentation.attempt}
          errorMessage={recoveryForPresentation.errorMessage}
          isBusy={recoveryForPresentation.isBusy}
          isVisible={checkoutRecoveryModalVisible}
          onCancel={() => {
            void checkoutReturn.cancel();
          }}
          onCheckStatus={() => {
            void checkoutReturn.reconcile();
          }}
          onClose={() => setIsCheckoutRecoveryModalOpen(false)}
          onDismiss={
            Platform.OS === "ios"
              ? () =>
                  handleIosModalDismiss(
                    "recovery",
                    recoveryBarrierIdentity,
                  )
              : undefined
          }
          onResume={() => {
            void checkoutReturn.resume();
          }}
          onShow={
            Platform.OS === "ios"
              ? () =>
                  handleIosModalShow(
                    "recovery",
                    recoveryBarrierIdentity,
                  )
              : undefined
          }
          operation={recoveryForPresentation.operation}
          remainingSeconds={recoveryForPresentation.remainingSeconds}
        />
      ) : null}
      <NoticeModal
        isVisible={checkoutNoticeModalVisible}
        title={checkoutNoticeForPresentation?.title ?? "Checkout"}
        message={checkoutNoticeForPresentation?.message ?? ""}
        onClose={() => setCheckoutNotice(null)}
        onDismiss={
          Platform.OS === "ios"
            ? () =>
                handleIosModalDismiss(
                  "checkoutNotice",
                  checkoutNoticeBarrierIdentity,
                )
            : undefined
        }
        onShow={
          Platform.OS === "ios"
            ? () =>
                handleIosModalShow(
                  "checkoutNotice",
                  checkoutNoticeBarrierIdentity,
                )
            : undefined
        }
      />
      <CalendarModal
        isVisible={isVisible && isCalOpen}
        selectedDate={planMode === "monthly" ? monthlyStartDate : selectedDate}
        minDate={isFreeRebook && freeRebookDate ? freeRebookDate : getGymTodayString()}
        maxDate={isFreeRebook && freeRebookDate ? freeRebookDate : getMaxBookableDateKey()}
        defaultYear={Number(getGymTodayString().slice(0, 4))}
        defaultMonth={Number(getGymTodayString().slice(5, 7))}
        blockedDates={[]}
        highlightedDates={planMode === "single" ? highlightedCoachDates : []}
        onSelect={(date) => {
          if (isFreeRebook && freeRebookDate && date !== freeRebookDate) {
            setErrorText("Choose a time on the same gym day as the affected session.");
            setIsCalOpen(false);
            return;
          }
          if (date < getGymTodayString()) {
            setErrorText("Choose today or a future date.");
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
        isVisible={isVisible && isTimeOpen}
        title="Available times"
        emptyMessage={availabilityStatusMessage}
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
        isVisible={confirmationModalVisible}
        title={confirmationForPresentation?.title ?? "Confirm action"}
        message={confirmationForPresentation?.message ?? ""}
        yesLabel={confirmationForPresentation?.yesLabel ?? "Confirm"}
        noLabel="Cancel"
        isLoading={isBusy}
        loadingLabel={sendingRequestLabel}
        loadingTitle={isFreeRebook ? "Booking free rebook" : "Opening PayMongo"}
        onDismiss={
          Platform.OS === "ios"
            ? () =>
                handleIosModalDismiss(
                  "confirmation",
                  confirmationBarrierIdentity,
                )
            : undefined
        }
        onNo={() => {
          if (isBusy) {
            return;
          }
          setAppointmentConfirmation(null);
        }}
        onShow={
          Platform.OS === "ios"
            ? () =>
                handleIosModalShow(
                  "confirmation",
                  confirmationBarrierIdentity,
                )
            : undefined
        }
        onYes={() => {
          void handleSubmitBooking();
        }}
      />
    </Fragment>
  );
}
