import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Modal,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Activity,
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Dumbbell,
  LineChart,
  Swords,
  Users,
  WalletCards,
  SlidersHorizontal,
  CheckCircle2,
  CircleOff,
  Star,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import {
  FITTRACK_PAYMENT_ACCEPTANCE_LABEL,
  FITTRACK_PAYMENT_POLICY_SUMMARY,
} from "@fittrack/app-config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import type {
  AppointmentRecord,
  AppointmentPaymentStage,
  CoachAppointmentScheduleRecord,
  CreateCoachManagedAppointmentPayload,
  RecurringCoachingPlanInput,
  SubmitCoachAppointmentFeedbackPayload,
  VenueBookingRecord,
  RecurringCoachingBillingCycleRecord,
  RecurringCoachingPlanRecord,
} from "@fittrack/api-client";
import type { CoachProfileRecord } from "@fittrack/types";

import {
  appointmentsQueryOptions,
  bookingsQueryOptions,
  cancelAppointmentMutationOptions,
  cancelBookingMutationOptions,
  coachScheduleQueryOptions,
  completeCoachAppointmentMutationOptions,
  confirmCoachAppointmentMutationOptions,
  declineCoachAppointmentMutationOptions,
  coachSelfProfileQueryOptions,
  fitnessClientPlansQueryOptions,
  invalidateCoachScheduleQueries,
  payAppointmentDownpaymentMutationOptions,
  submitCoachReviewMutationOptions,
  venuesQueryOptions,
  recurringCoachingPlansQueryOptions,
} from "@fittrack/query";
import {
  normalizeBookingStatus,
  repeatMonthlyScheduleDraft,
  toDateTimeRange,
} from "@fittrack/app-core";
import {
  formatBookingDate,
  formatGroupLabel,
  groupItemsByDate,
  nextDate,
} from "@fittrack/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useDebounce, useLoadingText } from "@fittrack/hooks";
import {
  makeScreenStyles,
  makeBookingsScreenStyles,
} from "@/styles/shared/ScreenStyles";
import {
  STATUS_COLORS,
  FILTER_OPTIONS,
  type StatusFilter,
  getTodayString,
} from "@/data/bookings";
import { mobileApiClient } from "@/lib/api-client";
import { toMobileBookings } from "@/utils/venueBookings";
import { CoachClientWorkoutPlan } from "@/components/bookings/CoachClientWorkoutPlan";

import {
  FitButton,
  FitCard,
  FitFilter,
  FitPager,
  FitSearch,
  FitText,
} from "@/components/fit";
import {
  AppointmentModal,
  BookingDetailModal,
  CalendarModal,
  ConfirmModal,
  NoticeModal,
  type DetailBooking,
} from "@/components/modals";

const AMENITY_ICONS: Record<string, LucideIcon> = {
  "Basketball Court": Activity,
  "Boxing Ring": Swords,
  "Volleyball Court": Activity,
  "Gym Area (Front)": Dumbbell,
  "Gym Area (Back)": Dumbbell,
  Reception: Bell,
};

const DEFAULT_AMENITY_ICON: LucideIcon = Dumbbell;
const MEMBER_SECTION_OPTIONS = [
  { label: "Reservations", value: "bookings" },
  { label: "Appointments", value: "appointments" },
];
const COACH_SECTION_OPTIONS = [
  { label: "Clients", value: "clients" },
  { label: "Sessions", value: "appointments" },
  { label: "Earnings", value: "earnings" },
];
const COACH_CLIENT_DETAIL_TABS = [
  { label: "Overview", value: "overview" },
  { label: "Schedule", value: "schedule" },
  { label: "Workout", value: "workout" },
  { label: "Feedback", value: "feedback" },
] as const;
const COACH_CLIENT_DURATION_OPTIONS = [
  { label: "30 minutes", value: 30 },
  { label: "45 minutes", value: 45 },
  { label: "60 minutes", value: 60 },
  { label: "90 minutes", value: 90 },
] as const;
const BOOKINGS_PAGE_SIZE = 10;
const MAX_MONTHLY_PLAN_SESSIONS = 60;
const MAX_MONTHLY_SESSIONS_PER_WEEK = 5;
const DEFAULT_MONTHLY_SESSION_TIME = "17:00";

type BookingSection = "bookings" | "appointments" | "clients" | "earnings";
type CoachSection = Extract<
  BookingSection,
  "clients" | "appointments" | "earnings"
>;
type CoachClientDetailTab = (typeof COACH_CLIENT_DETAIL_TABS)[number]["value"];
type CoachClientFormMessage = { tone: "error" | "success"; text: string };
type MonthlyPlanDraftRow = {
  date: string;
  durationMinutes: string;
  time: string;
};
type ExtendedStatusFilter = StatusFilter | "pending" | "completed" | "declined";
type AppointmentPaymentProvider = "paymongo";
type CoachClientSummary = {
  completedCount: number;
  email: string;
  id: string;
  lastSession?: DetailBooking;
  name: string;
  nextSession?: DetailBooking;
  pendingCount: number;
  readinessColor: string;
  readinessLabel: string;
  sessions: DetailBooking[];
  sessionCount: number;
};
type PendingAppointmentPayment = {
  booking: DetailBooking;
  provider: AppointmentPaymentProvider;
  stage: AppointmentPaymentStage;
};
type PaymentConfirmationState = {
  message: string;
  title: string;
};
type PendingCancellation = {
  booking: DetailBooking;
  type: "appointment" | "reservation";
};
type PendingCoachAction = {
  action: "complete" | "confirm" | "decline";
  booking: DetailBooking;
};

function formatStatusLabel(status: string) {
  const explicitLabels: Record<string, string> = {
    pending_downpayment: "Pending Downpayment",
    pending_payment: "Pending Payment",
    pending_full_payment: "Pending Full Payment",
    balance_pending: "Pending Full Payment",
  };

  if (explicitLabels[status]) {
    return explicitLabels[status];
  }

  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAppointmentMemberName(
  appointment: Pick<CoachAppointmentScheduleRecord, "user" | "userId">,
) {
  const firstName = appointment.user?.profile?.firstName?.trim() ?? "";
  const lastName = appointment.user?.profile?.lastName?.trim() ?? "";
  const profileName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return (
    profileName ||
    appointment.user?.email?.trim() ||
    appointment.userId ||
    "Member"
  );
}

function getAppointmentMemberEmail(
  appointment: Pick<CoachAppointmentScheduleRecord, "user">,
) {
  return appointment.user?.email?.trim() ?? "";
}

function getSearchParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getCoachSection(value?: string): CoachSection | null {
  if (value === "clients" || value === "appointments" || value === "earnings") {
    return value;
  }
  return null;
}

function getNormalizedCoachAppointmentStatus(
  appointment: Pick<
    CoachAppointmentScheduleRecord,
    "activePaymentStage" | "balancePaidAt" | "remainingBalance" | "status"
  >,
) {
  if (
    appointment.status === "pending_payment" &&
    appointment.activePaymentStage === "full"
  ) {
    return "pending_full_payment";
  }
  if (
    appointment.status === "pending_payment" &&
    appointment.activePaymentStage === "downpayment"
  ) {
    return "pending_downpayment";
  }
  if (
    appointment.status === "confirmed" &&
    Number(appointment.remainingBalance ?? 0) > 0 &&
    !appointment.balancePaidAt
  ) {
    return "pending_full_payment";
  }
  return normalizeBookingStatus(appointment.status);
}

function isPendingStatus(status: string) {
  return (
    status === "pending" ||
    status === "pending_coach" ||
    status === "pending_downpayment" ||
    status === "pending_payment" ||
    status === "pending_full_payment"
  );
}

function canStartMemberAppointmentPayment(booking: DetailBooking) {
  return (
    (booking.status === "pending_full_payment" ||
      booking.status === "pending_payment") &&
    booking.activePaymentStage === "full" &&
    Number(booking.totalAmount ?? booking.amountDueNow ?? 0) > 0
  );
}

function getMemberAppointmentPaymentStage(): AppointmentPaymentStage {
  return "full";
}

function formatPeso(value: number) {
  return `PHP ${value.toLocaleString("en-PH")}`;
}

function getClientInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return (parts[0]?.[0] ?? "M") + (parts[1]?.[0] ?? "C");
}

function isFinalSessionStatus(status: string) {
  return (
    status === "cancelled" ||
    status === "completed" ||
    status === "declined" ||
    status === "no_show"
  );
}

function getSessionTimeLabel(session: DetailBooking) {
  return session.startTime && session.endTime
    ? `${session.startTime} - ${session.endTime}`
    : session.time;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getDefaultCoachScheduleInputs() {
  const nextSlot = new Date();
  nextSlot.setSeconds(0, 0);
  nextSlot.setMinutes(0);
  nextSlot.setHours(nextSlot.getHours() + 2);
  return {
    date: toDateInputValue(nextSlot),
    time: toTimeInputValue(nextSlot),
  };
}

function buildLocalScheduleDate(dateValue: string, timeValue: string) {
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeValue.trim());
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!timeMatch || !year || !month || !day) return null;

  return new Date(
    year,
    month - 1,
    day,
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  );
}

function getCoachFormErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function RecurringPlanMobilePanel({
  error,
  isLoading,
  onPay,
  payingCycleId,
  plans,
}: {
  error: string | null;
  isLoading: boolean;
  onPay: (
    plan: RecurringCoachingPlanRecord,
    cycle: RecurringCoachingBillingCycleRecord,
  ) => void;
  payingCycleId: string | null;
  plans: RecurringCoachingPlanRecord[];
}) {
  const { colors } = useTheme();
  const plan = plans.find((item) =>
    ["awaiting_payment", "active"].includes(item.status),
  );
  const cycle = plan?.billingCycles?.find((item) =>
    ["due", "processing"].includes(item.status),
  );
  if (!isLoading && !error && (!plan || !cycle)) return null;

  const pendingCount =
    plan?.scheduleItems?.filter((item) => item.status === "pending_payment")
      .length ?? 0;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 18,
        borderWidth: 1,
        gap: 10,
        marginBottom: 14,
        padding: 14,
      }}
    >
      <FitText
        style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "900" }}
      >
        Coach-created monthly plan
      </FitText>
      <FitText
        style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}
      >
        Your coach owns the dates. Full PayMongo payment activates the actual
        sessions; skipping a session does not create a refund or credit.
      </FitText>
      {isLoading ? (
        <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
          Loading payment requests…
        </FitText>
      ) : null}
      {error ? (
        <FitText style={{ color: colors.warning, fontSize: 12 }}>
          {error}
        </FitText>
      ) : null}
      {plan && cycle ? (
        <>
          <FitCard
            icon={CalendarCheck}
            iconSize={18}
            label={
              plan.frequency === "monthly"
                ? "Monthly coaching"
                : "Recurring coaching"
            }
            subtitle={`${pendingCount} session date${pendingCount === 1 ? "" : "s"} waiting for full payment.`}
            trailingLabel={formatPeso(Number(cycle.amount))}
            trailingLabelColor={colors.brand}
            noChevron
          />
          <FitButton
            label={
              payingCycleId === cycle.id
                ? "OPENING PAYMONGO…"
                : "PAY IN FULL WITH PAYMONGO"
            }
            onPress={() => onPay(plan, cycle)}
            disabled={payingCycleId !== null}
            loading={payingCycleId === cycle.id}
            style={{ minHeight: 42 }}
          />
        </>
      ) : null}
    </View>
  );
}

function getLatestMonthlyPlanTimestamp(
  plan: RecurringCoachingPlanRecord | null,
) {
  return Math.max(
    ...(plan?.scheduleItems ?? []).map((item) =>
      new Date(item.scheduledAt).getTime(),
    ),
    0,
  );
}

function getFreshMonthlyPeriodStart(plan: RecurringCoachingPlanRecord | null) {
  const latestTimestamp = getLatestMonthlyPlanTimestamp(plan);
  const sourceDate =
    latestTimestamp > 0 ? new Date(latestTimestamp) : new Date();
  return new Date(
    sourceDate.getFullYear(),
    sourceDate.getMonth() + 1,
    1,
    17,
    0,
    0,
    0,
  );
}

function getMonthlyOfferDefaults(coachProfile: CoachProfileRecord | null) {
  const rate = Number(coachProfile?.monthlyRate);
  const sessionCount = Number(coachProfile?.monthlySessionCount);
  const durationMinutes = Number(coachProfile?.monthlySessionDurationMinutes);
  const hasValidRate = Number.isFinite(rate) && rate > 0;
  const hasValidSessionCount =
    Number.isInteger(sessionCount) && sessionCount > 0;
  const hasValidDuration = COACH_CLIENT_DURATION_OPTIONS.some(
    (option) => option.value === durationMinutes,
  );

  return {
    durationMinutes: hasValidDuration ? durationMinutes : 60,
    isConfigured:
      coachProfile?.monthlyOfferActive === true &&
      hasValidRate &&
      hasValidSessionCount &&
      hasValidDuration,
    quote: hasValidRate ? String(rate) : "",
    sessionCount: hasValidSessionCount
      ? Math.min(sessionCount, MAX_MONTHLY_PLAN_SESSIONS)
      : 1,
  };
}

function createFreshMonthlyPlanRows(
  sessionCount: number,
  durationMinutes: number,
  previousPlan: RecurringCoachingPlanRecord | null,
) {
  const periodStart = getFreshMonthlyPeriodStart(previousPlan);
  const daysInMonth = new Date(
    periodStart.getFullYear(),
    periodStart.getMonth() + 1,
    0,
  ).getDate();
  const rowCount = Math.min(
    Math.max(1, sessionCount),
    MAX_MONTHLY_PLAN_SESSIONS,
    daysInMonth,
  );

  const rows: MonthlyPlanDraftRow[] = [];
  const sessionsPerWeek = new Map<string, number>();
  for (let day = 1; day <= daysInMonth && rows.length < rowCount; day += 1) {
    const date = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth(),
      day,
      17,
      0,
      0,
      0,
    );
    const dateValue = toDateInputValue(date);
    const weekKey = getWeekKey(dateValue);
    const weekCount = sessionsPerWeek.get(weekKey) ?? 0;
    if (weekCount >= MAX_MONTHLY_SESSIONS_PER_WEEK) continue;
    sessionsPerWeek.set(weekKey, weekCount + 1);
    rows.push({
      date: toDateInputValue(date),
      time: DEFAULT_MONTHLY_SESSION_TIME,
      durationMinutes: String(durationMinutes),
    });
  }
  return rows;
}

function getMonthKey(dateValue: string) {
  return dateValue.slice(0, 7);
}

function getWeekKey(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return toDateInputValue(date);
}

export default function BookingsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const router = useRouter();
  const isUserRole = user?.role === "USER";
  const isCoachRole = user?.role === "COACH";
  const {
    isFabOpen,
    setFabOpen,
    registerFAB,
    unregisterFAB,
    setReservationOpen,
    bookingRefreshTick,
  } = useFABState();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeBookingsScreenStyles(colors), [colors]);

  const params = useLocalSearchParams<{
    coachView?: string | string[];
    openReservation?: string;
  }>();
  const isFrozen = user?.status === "frozen";
  const queryClient = useQueryClient();

  const recurringPlansQuery = useQuery({
    ...recurringCoachingPlansQueryOptions(mobileApiClient),
    enabled: isFocused && !!user?.id && (isUserRole || isCoachRole),
    staleTime: 20_000,
    gcTime: 300_000,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [statusFilter, setStatusFilter] = useState<ExtendedStatusFilter>("all");
  const [activeSection, setActiveSection] =
    useState<BookingSection>("bookings");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bookingPage, setBookingPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isStartCalOpen, setIsStartCalOpen] = useState(false);
  const [isEndCalOpen, setIsEndCalOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<DetailBooking | null>(
    null,
  );
  const [clientDetail, setClientDetail] = useState<CoachClientSummary | null>(
    null,
  );
  const [clientDetailTab, setClientDetailTab] =
    useState<CoachClientDetailTab>("overview");
  const lastMonthlyPlanForClient =
    useMemo<RecurringCoachingPlanRecord | null>(() => {
      if (!clientDetail?.id) return null;

      const candidates = (recurringPlansQuery.data ?? []).filter(
        (plan) =>
          plan.frequency === "monthly" &&
          plan.status !== "cancelled" &&
          plan.memberId === clientDetail.id &&
          (plan.scheduleItems?.length ?? 0) > 0,
      );

      return (
        [...candidates].sort((left, right) => {
          const leftDate = Math.max(
            ...(left.scheduleItems ?? []).map((item) =>
              new Date(item.scheduledAt).getTime(),
            ),
          );
          const rightDate = Math.max(
            ...(right.scheduleItems ?? []).map((item) =>
              new Date(item.scheduledAt).getTime(),
            ),
          );
          return rightDate - leftDate;
        })[0] ?? null
      );
    }, [clientDetail?.id, recurringPlansQuery.data]);
  const [pendingAppointmentPayment, setPendingAppointmentPayment] =
    useState<PendingAppointmentPayment | null>(null);
  const [paymentConfirmation, setPaymentConfirmation] =
    useState<PaymentConfirmationState | null>(null);
  const [payingRecurringCycleId, setPayingRecurringCycleId] = useState<
    string | null
  >(null);
  const [recurringPlanPaymentError, setRecurringPlanPaymentError] = useState<
    string | null
  >(null);
  const [isMonthlyPlanOpen, setIsMonthlyPlanOpen] = useState(false);
  const [monthlyPlanQuote, setMonthlyPlanQuote] = useState("");
  const [monthlyPlanRows, setMonthlyPlanRows] = useState<MonthlyPlanDraftRow[]>(
    [],
  );
  const [monthlyPlanTrainingPlanId, setMonthlyPlanTrainingPlanId] =
    useState("");
  const [monthlyPlanMessage, setMonthlyPlanMessage] =
    useState<CoachClientFormMessage | null>(null);
  const [monthlyPlanCalendarRowIndex, setMonthlyPlanCalendarRowIndex] =
    useState<number | null>(null);
  const [isCreatingMonthlyPlan, setIsCreatingMonthlyPlan] = useState(false);
  const [pendingCancellation, setPendingCancellation] =
    useState<PendingCancellation | null>(null);
  const [pendingCoachAction, setPendingCoachAction] =
    useState<PendingCoachAction | null>(null);
  const [reviewTarget, setReviewTarget] = useState<DetailBooking | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const defaultCoachScheduleInputs = useMemo(
    () => getDefaultCoachScheduleInputs(),
    [],
  );
  const [clientScheduleDate, setClientScheduleDate] = useState(
    defaultCoachScheduleInputs.date,
  );
  const [clientScheduleTime, setClientScheduleTime] = useState(
    defaultCoachScheduleInputs.time,
  );
  const [clientScheduleDuration, setClientScheduleDuration] = useState("60");
  const [clientScheduleNotes, setClientScheduleNotes] = useState("");
  const [clientScheduleMessage, setClientScheduleMessage] =
    useState<CoachClientFormMessage | null>(null);
  const [isClientScheduleCalendarOpen, setIsClientScheduleCalendarOpen] =
    useState(false);
  const [
    selectedClientFeedbackAppointmentId,
    setSelectedClientFeedbackAppointmentId,
  ] = useState("");
  const [clientCoachFeedback, setClientCoachFeedback] = useState("");
  const [clientAssessmentReport, setClientAssessmentReport] = useState("");
  const [clientFeedbackMessage, setClientFeedbackMessage] =
    useState<CoachClientFormMessage | null>(null);
  const coachProfileQuery = useQuery({
    ...coachSelfProfileQueryOptions<CoachProfileRecord>(
      mobileApiClient,
      user?.id,
    ),
    enabled: isFocused && isCoachRole && !!user?.id,
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const clientWorkoutPlansQuery = useQuery({
    ...fitnessClientPlansQueryOptions(
      mobileApiClient,
      user?.id,
      clientDetail?.id,
      { limit: 50, page: 1 },
    ),
    enabled:
      isFocused &&
      isCoachRole &&
      isMonthlyPlanOpen &&
      !!user?.id &&
      !!clientDetail?.id,
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const clientCoachWorkoutPlans = useMemo(
    () =>
      (clientWorkoutPlansQuery.data?.data ?? []).filter(
        (plan) => plan.coachId === user?.id && plan.source === "coach_assigned",
      ),
    [clientWorkoutPlansQuery.data?.data, user?.id],
  );
  const selectedClientWorkoutPlan = useMemo(
    () =>
      clientCoachWorkoutPlans.find(
        (plan) => plan.id === monthlyPlanTrainingPlanId,
      ) ?? null,
    [clientCoachWorkoutPlans, monthlyPlanTrainingPlanId],
  );
  const monthlyOfferDefaults = useMemo(
    () => getMonthlyOfferDefaults(coachProfileQuery.data ?? null),
    [coachProfileQuery.data],
  );

  useEffect(() => {
    if (!isMonthlyPlanOpen || monthlyPlanTrainingPlanId) return;
    const defaultPlan =
      clientCoachWorkoutPlans.find((plan) => plan.isActive) ??
      clientCoachWorkoutPlans[0];
    if (defaultPlan) setMonthlyPlanTrainingPlanId(defaultPlan.id);
  }, [clientCoachWorkoutPlans, isMonthlyPlanOpen, monthlyPlanTrainingPlanId]);

  const {
    data: venues = [],
    isLoading: venuesLoading,
    error: venuesError,
  } = useQuery({
    ...venuesQueryOptions(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id && isUserRole,
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const {
    data: apiBookings = [],
    isLoading: bookingsLoading,
    error: bookingsError,
    refetch,
  } = useQuery({
    ...bookingsQueryOptions<VenueBookingRecord>(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id && isUserRole,
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const {
    data: appointmentsRaw = [],
    isLoading: appointmentsLoading,
    error: appointmentsError,
    refetch: refetchAppointments,
  } = useQuery({
    ...appointmentsQueryOptions<AppointmentRecord>(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id && isUserRole,
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const {
    data: coachScheduleRaw = [],
    isLoading: coachScheduleLoading,
    error: coachScheduleError,
    refetch: refetchCoachSchedule,
  } = useQuery({
    ...coachScheduleQueryOptions<CoachAppointmentScheduleRecord>(
      mobileApiClient,
      user?.id,
    ),
    enabled: isFocused && !!user?.id && isCoachRole,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const reservations = useMemo<DetailBooking[]>(
    () =>
      toMobileBookings(apiBookings, venues).map((booking) => ({
        ...booking,
        participantLabel: booking.trainerName ? "Coach" : undefined,
        participantName: booking.trainerName,
        detailTitle: "Reservation Details",
        detailSubtitle: booking.trainerName
          ? `${booking.resourceName} / ${booking.trainerName}`
          : booking.resourceName,
      })),
    [apiBookings, venues],
  );

  const appointments = useMemo<DetailBooking[]>(
    () =>
      appointmentsRaw.map((appointment) => {
        const { startLabel, endLabel, date } = toDateTimeRange(
          appointment.scheduledAt,
          appointment.duration,
        );
        const standaloneName = appointment.coach?.displayName?.trim();
        const coachName =
          standaloneName && !standaloneName.includes("@")
            ? standaloneName
            : "Coach Session";
        const normalizedStatus =
          appointment.status === "pending_payment" &&
          appointment.activePaymentStage === "full"
            ? "pending_full_payment"
            : appointment.status === "pending_payment" &&
                appointment.activePaymentStage === "downpayment"
              ? "pending_downpayment"
              : appointment.status === "confirmed" &&
                  Number(appointment.remainingBalance ?? 0) > 0 &&
                  !appointment.balancePaidAt
                ? "pending_full_payment"
                : normalizeBookingStatus(appointment.status);
        return {
          activePaymentStage: appointment.activePaymentStage ?? null,
          amountDueNow: appointment.amountDueNow ?? undefined,
          assessmentReport: appointment.assessmentReport,
          bookingType: appointment.recurringPlanId ? "recurring" : "single",
          coachFeedback: appointment.coachFeedback,
          coachId: appointment.coachId,
          coachReviewComment: appointment.review?.comment ?? null,
          coachReviewRating: appointment.review?.rating ?? null,
          id: appointment.id,
          nextPaymentDate: appointment.nextPaymentDate ?? undefined,
          paymentPlan: appointment.paymentPlan ?? undefined,
          recurringPlanId: appointment.recurringPlanId ?? null,
          remainingBalance: appointment.remainingBalance ?? undefined,
          sessionNotes: appointment.sessionNotes,
          resourceId: appointment.coachId ?? "coach",
          resourceName: coachName,
          time: `${startLabel} - ${endLabel}`,
          startTime: startLabel,
          endTime: endLabel,
          date,
          status: normalizedStatus,
          price: appointment.coach?.hourlyRate ?? 0,
          trainerName: coachName,
          participantName: coachName,
          participantLabel: "Coach",
          description: appointment.notes ?? undefined,
          detailTitle: "Appointment Details",
          detailSubtitle: appointment.recurringPlanId
            ? `${coachName} / Recurring`
            : coachName,
          totalAmount: appointment.totalAmount ?? undefined,
        };
      }),
    [appointmentsRaw],
  );
  const coachAppointments = useMemo<DetailBooking[]>(
    () =>
      coachScheduleRaw.map((appointment) => {
        const { startLabel, endLabel, date } = toDateTimeRange(
          appointment.scheduledAt,
          appointment.duration,
        );
        const memberName = getAppointmentMemberName(appointment);
        const normalizedStatus =
          getNormalizedCoachAppointmentStatus(appointment);

        return {
          amountDueNow: appointment.amountDueNow ?? undefined,
          assessmentReport: appointment.assessmentReport,
          bookingType: appointment.recurringPlanId ? "recurring" : "single",
          coachFeedback: appointment.coachFeedback,
          coachId: appointment.coachId,
          coachReviewComment: appointment.review?.comment ?? null,
          coachReviewRating: appointment.review?.rating ?? null,
          description: appointment.notes ?? undefined,
          id: appointment.id,
          paymentPlan: appointment.totalAmount ? "full" : "free",
          recurringPlanId: appointment.recurringPlanId ?? null,
          remainingBalance: appointment.remainingBalance ?? undefined,
          resourceId: appointment.userId,
          resourceName: memberName,
          sessionNotes: appointment.sessionNotes,
          time: `${startLabel} - ${endLabel}`,
          startTime: startLabel,
          endTime: endLabel,
          date,
          status: normalizedStatus,
          price: Number(
            appointment.totalAmount ?? appointment.coachEarnings ?? 0,
          ),
          participantLabel: "Member",
          participantName: memberName,
          detailTitle: "Coach Session Details",
          detailSubtitle: appointment.recurringPlanId
            ? `${memberName} / Recurring`
            : memberName,
          totalAmount: appointment.totalAmount ?? undefined,
        };
      }),
    [coachScheduleRaw],
  );
  const displayAppointments = isCoachRole ? coachAppointments : appointments;

  const appointmentTimelines = useMemo(() => {
    const byPlan = new Map<string, DetailBooking[]>();
    displayAppointments.forEach((appointment) => {
      if (!appointment.recurringPlanId) return;
      const existing = byPlan.get(appointment.recurringPlanId) ?? [];
      existing.push(appointment);
      byPlan.set(appointment.recurringPlanId, existing);
    });

    for (const sessions of byPlan.values()) {
      sessions.sort((left, right) =>
        `${left.date} ${left.startTime ?? left.time}`.localeCompare(
          `${right.date} ${right.startTime ?? right.time}`,
        ),
      );
    }

    return new Map(
      Array.from(byPlan.entries()).map(([planId, sessions]) => [
        planId,
        sessions.map((session, index) => ({
          id: session.id,
          label: `Session ${index + 1}`,
          meta: `${formatBookingDate(session.date)} | ${
            session.startTime && session.endTime
              ? `${session.startTime} - ${session.endTime}`
              : session.time
          } | ${formatStatusLabel(session.status)}`,
          status: session.status,
          tone: STATUS_COLORS[session.status] ?? colors.textMuted,
        })),
      ]),
    );
  }, [colors.textMuted, displayAppointments]);

  const appointmentsWithTimeline = useMemo(
    () =>
      displayAppointments.map((appointment) => ({
        ...appointment,
        timelineItems: appointment.recurringPlanId
          ? appointmentTimelines.get(appointment.recurringPlanId)
          : [
              {
                id: `${appointment.id}:requested`,
                label: "Booking requested",
                meta: `${formatBookingDate(appointment.date)} | ${appointment.time}`,
                status: "pending",
                tone: colors.textMuted,
              },
              {
                id: `${appointment.id}:status`,
                label: formatStatusLabel(appointment.status),
                meta:
                  appointment.status === "completed"
                    ? "Coach session completed."
                    : "Current appointment state.",
                status: appointment.status,
                tone: STATUS_COLORS[appointment.status] ?? colors.textMuted,
              },
              ...(appointment.coachReviewRating
                ? [
                    {
                      id: `${appointment.id}:review`,
                      label: "Member feedback submitted",
                      meta: `${appointment.coachReviewRating}/5 stars`,
                      status: "completed",
                      tone: colors.warning,
                    },
                  ]
                : []),
            ],
      })),
    [
      appointmentTimelines,
      colors.textMuted,
      colors.warning,
      displayAppointments,
    ],
  );

  const todayString = getTodayString();
  const coachEarningsByAppointmentId = useMemo(() => {
    const earningsById = new Map<string, number>();
    coachScheduleRaw.forEach((appointment) => {
      earningsById.set(appointment.id, Number(appointment.coachEarnings ?? 0));
    });
    return earningsById;
  }, [coachScheduleRaw]);

  const coachMemberEmailById = useMemo(() => {
    const emailById = new Map<string, string>();
    coachScheduleRaw.forEach((appointment) => {
      if (!appointment.userId) return;
      emailById.set(appointment.userId, getAppointmentMemberEmail(appointment));
    });
    return emailById;
  }, [coachScheduleRaw]);

  const coachEarningsItems = useMemo(
    () =>
      appointmentsWithTimeline.filter(
        (appointment) =>
          appointment.status === "completed" ||
          appointment.status === "no_show",
      ),
    [appointmentsWithTimeline],
  );

  const isLoading =
    activeSection === "bookings"
      ? venuesLoading || bookingsLoading
      : isCoachRole
        ? coachScheduleLoading
        : appointmentsLoading;
  const errorText = useMemo(() => {
    if (activeSection === "bookings" && (venuesError || bookingsError))
      return "Unable to load reservations.";
    if (
      isCoachRole &&
      (activeSection === "appointments" ||
        activeSection === "clients" ||
        activeSection === "earnings") &&
      coachScheduleError
    )
      return "Unable to load coach sessions.";
    if (activeSection === "appointments" && appointmentsError)
      return "Unable to load appointments.";
    return "";
  }, [
    activeSection,
    appointmentsError,
    bookingsError,
    coachScheduleError,
    isCoachRole,
    venuesError,
  ]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const menuItems: FABMenuItem[] = useMemo(() => {
    if (isFrozen || !isUserRole) return [];
    return [
      {
        label: "Make Reservation",
        icon: CalendarCheck,
        iconColor: colors.brand,
        iconBg: colors.surfaceRaised,
        onPress: () => {
          setFabOpen(false);
          setReservationOpen(true);
        },
      },
      {
        label: "Book a Trainer",
        icon: Users,
        iconColor: colors.brand,
        iconBg: colors.surfaceRaised,
        onPress: () => {
          setFabOpen(false);
          setIsAppointmentOpen(true);
        },
      },
    ];
  }, [
    colors.brand,
    colors.surfaceRaised,
    isFrozen,
    isUserRole,
    setFabOpen,
    setReservationOpen,
  ]);

  useEffect(() => {
    if (!isCoachRole) return;

    const requestedSection = getCoachSection(
      getSearchParamValue(params.coachView),
    );
    const nextSection =
      requestedSection ??
      (activeSection === "bookings" ? "appointments" : activeSection);

    if (activeSection !== nextSection) {
      setActiveSection(nextSection);
    }
  }, [activeSection, isCoachRole, params.coachView]);

  const handleSectionChange = useCallback(
    (value: string) => {
      const nextSection = value as BookingSection;
      setActiveSection(nextSection);
      if (isCoachRole) {
        const coachSection = getCoachSection(nextSection);
        if (coachSection) router.setParams({ coachView: coachSection });
      }
    },
    [isCoachRole, router],
  );

  useEffect(() => {
    if (!isFocused || !user?.id || !isUserRole) return;
    void refetch();
    void refetchAppointments();
  }, [
    bookingRefreshTick,
    isFocused,
    isUserRole,
    refetch,
    refetchAppointments,
    user?.id,
  ]);

  useEffect(() => {
    if (!isFocused || !user?.id || !isCoachRole) return;
    void refetchCoachSchedule();
  }, [
    bookingRefreshTick,
    isCoachRole,
    isFocused,
    refetchCoachSchedule,
    user?.id,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (params.openReservation === "true" && !isFrozen && isUserRole)
        setReservationOpen(true);
      registerFAB({
        screenIcon: CalendarPlus,
        menuItems,
        scrollY,
        visible: !isFrozen && isUserRole,
      });
      return () => {
        setIsFilterOpen(false);
        unregisterFAB();
      };
    }, [
      isFrozen,
      isUserRole,
      menuItems,
      params.openReservation,
      registerFAB,
      setReservationOpen,
      unregisterFAB,
      scrollY,
    ]),
  );

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const cancelBookingMutation = useMutation(
    cancelBookingMutationOptions(mobileApiClient, queryClient),
  );
  const cancelAppointmentMutation = useMutation(
    cancelAppointmentMutationOptions(mobileApiClient, queryClient),
  );
  const payAppointmentMutation = useMutation(
    payAppointmentDownpaymentMutationOptions(mobileApiClient, queryClient),
  );
  const submitCoachReviewMutation = useMutation(
    submitCoachReviewMutationOptions(mobileApiClient, queryClient),
  );
  const confirmCoachAppointmentMutation = useMutation(
    confirmCoachAppointmentMutationOptions(mobileApiClient, queryClient),
  );
  const declineCoachAppointmentMutation = useMutation(
    declineCoachAppointmentMutationOptions(mobileApiClient, queryClient),
  );
  const completeCoachAppointmentMutation = useMutation(
    completeCoachAppointmentMutationOptions(mobileApiClient, queryClient),
  );
  const createClientAppointmentMutation = useMutation({
    mutationFn: (payload: CreateCoachManagedAppointmentPayload) =>
      mobileApiClient.coaches.createManagedAppointment(payload),
    onSuccess: async () => {
      await invalidateCoachScheduleQueries(queryClient, user?.id);
    },
  });
  const createRecurringPlanMutation = useMutation({
    mutationFn: (payload: RecurringCoachingPlanInput) =>
      mobileApiClient.recurringCoachingPlans.create(payload),
    onSuccess: async () => {
      await recurringPlansQuery.refetch();
      await invalidateCoachScheduleQueries(queryClient, user?.id);
    },
  });
  const submitClientFeedbackMutation = useMutation({
    mutationFn: ({
      appointmentId,
      payload,
    }: {
      appointmentId: string;
      payload: SubmitCoachAppointmentFeedbackPayload;
    }) =>
      mobileApiClient.coaches.submitAppointmentFeedback(appointmentId, payload),
    onSuccess: async () => {
      await invalidateCoachScheduleQueries(queryClient, user?.id);
    },
  });
  const coachActionLoading =
    confirmCoachAppointmentMutation.isPending ||
    declineCoachAppointmentMutation.isPending ||
    completeCoachAppointmentMutation.isPending;

  const cancellingReservationLabel = useLoadingText(
    "CANCELLING",
    cancelBookingMutation.isPending,
  );
  const cancellingAppointmentLabel = useLoadingText(
    "CANCELLING",
    cancelAppointmentMutation.isPending,
  );
  const confirmingPaymentLabel = useLoadingText(
    "CONFIRMING PAYMENT",
    payAppointmentMutation.isPending,
  );
  const coachActionLoadingLabel = useLoadingText(
    "UPDATING",
    coachActionLoading,
  );

  const handleSubmitAppointmentPayment = useCallback(
    async ({ booking, provider, stage }: PendingAppointmentPayment) => {
      try {
        const result = await payAppointmentMutation.mutateAsync({
          appointmentId: booking.id,
          paymentStage: stage,
          provider,
          userId: user?.id,
        });

        if (!result.checkoutUrl) {
          throw new Error("PayMongo did not return a checkout link.");
        }

        await Linking.openURL(result.checkoutUrl);
        setPendingAppointmentPayment(null);
        setDetailBooking(null);
        setPaymentConfirmation({
          title: "PayMongo checkout opened",
          message:
            "Complete the full payment in PayMongo. Your booking stays unconfirmed until FitTrack receives the successful payment confirmation.",
        });
      } catch {
        setPendingAppointmentPayment(null);
        setPaymentConfirmation({
          title: "Payment unavailable",
          message:
            "PayMongo payment is currently unavailable. Your booking was not confirmed. Please try again from Bookings.",
        });
      }
    },
    [payAppointmentMutation, user?.id],
  );

  const handleStartDateSelect = (date: string) => {
    setStartDate(date);
    if (endDate && endDate <= date) setEndDate("");
    setIsStartCalOpen(false);
  };

  const handleEndDateSelect = (date: string) => {
    if (!startDate) {
      setEndDate(date);
      setIsEndCalOpen(false);
      return;
    }
    const dueMin = nextDate(startDate);
    setEndDate(date <= startDate ? dueMin : date);
    setIsEndCalOpen(false);
  };

  const executeCancelReservation = useCallback(
    async (booking: DetailBooking) => {
      if (booking.status === "cancelled") return;
      setIsCancelling(true);
      try {
        await cancelBookingMutation.mutateAsync({
          bookingId: booking.id,
          cancelReason: "Cancelled by user",
          userId: user?.id,
        });
        setPendingCancellation(null);
        setDetailBooking(null);
      } finally {
        setIsCancelling(false);
      }
    },
    [cancelBookingMutation, user?.id],
  );

  const executeCancelAppointment = useCallback(
    async (booking: DetailBooking) => {
      if (
        booking.status === "cancelled" ||
        booking.status === "completed" ||
        booking.status === "declined"
      )
        return;
      setIsCancelling(true);
      try {
        await cancelAppointmentMutation.mutateAsync({
          appointmentId: booking.id,
          cancelReason: isCoachRole
            ? "Cancelled by coach"
            : "Cancelled by user",
          userId: user?.id,
        });
        setPendingCancellation(null);
        setDetailBooking(null);
      } finally {
        setIsCancelling(false);
      }
    },
    [cancelAppointmentMutation, isCoachRole, user?.id],
  );

  const handleCancelReservation = useCallback((booking: DetailBooking) => {
    if (booking.status === "cancelled" || booking.status === "completed") {
      return;
    }
    setPendingCancellation({ booking, type: "reservation" });
  }, []);

  const handleCancelAppointment = useCallback((booking: DetailBooking) => {
    if (
      booking.status === "cancelled" ||
      booking.status === "completed" ||
      booking.status === "declined"
    ) {
      return;
    }
    setPendingCancellation({ booking, type: "appointment" });
  }, []);

  const handleCoachAction = useCallback(
    (booking: DetailBooking, action: PendingCoachAction["action"]) => {
      if (coachActionLoading) return;
      setPendingCoachAction({ booking, action });
    },
    [coachActionLoading],
  );

  const executeCoachAction = useCallback(async () => {
    if (!pendingCoachAction) return;
    const { action, booking } = pendingCoachAction;

    if (action === "confirm") {
      await confirmCoachAppointmentMutation.mutateAsync({
        appointmentId: booking.id,
        userId: user?.id,
      });
    } else if (action === "decline") {
      await declineCoachAppointmentMutation.mutateAsync({
        appointmentId: booking.id,
        reason: "Declined by coach.",
        userId: user?.id,
      });
    } else {
      await completeCoachAppointmentMutation.mutateAsync({
        appointmentId: booking.id,
        sessionNotes: "Completed from mobile coach sessions.",
        userId: user?.id,
      });
    }

    setPendingCoachAction(null);
    setDetailBooking(null);
  }, [
    completeCoachAppointmentMutation,
    confirmCoachAppointmentMutation,
    declineCoachAppointmentMutation,
    pendingCoachAction,
    user?.id,
  ]);

  const handleOpenCoachReview = useCallback((booking: DetailBooking) => {
    if (!booking.coachId || booking.coachReviewRating) return;
    setReviewTarget(booking);
    setReviewRating(5);
    setReviewComment("");
  }, []);

  const handleCloseCoachReview = useCallback(() => {
    if (submitCoachReviewMutation.isPending) return;
    setReviewTarget(null);
    setReviewRating(5);
    setReviewComment("");
  }, [submitCoachReviewMutation.isPending]);

  const handleSubmitCoachReview = useCallback(async () => {
    if (!reviewTarget?.coachId) return;
    const comment = reviewComment.trim();

    await submitCoachReviewMutation.mutateAsync({
      coachId: reviewTarget.coachId,
      payload: {
        appointmentId: reviewTarget.id,
        rating: reviewRating,
        ...(comment ? { comment } : {}),
      },
      userId: user?.id,
    });

    setDetailBooking((current) =>
      current?.id === reviewTarget.id
        ? {
            ...current,
            coachReviewComment: comment || null,
            coachReviewRating: reviewRating,
          }
        : current,
    );
    setReviewTarget(null);
    setReviewRating(5);
    setReviewComment("");
  }, [
    reviewComment,
    reviewRating,
    reviewTarget,
    submitCoachReviewMutation,
    user?.id,
  ]);

  const handleCreateClientAppointment = useCallback(async () => {
    if (!clientDetail?.id) return;
    const durationMinutes = Number(clientScheduleDuration);
    const scheduledAt = buildLocalScheduleDate(
      clientScheduleDate,
      clientScheduleTime,
    );

    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      setClientScheduleMessage({
        tone: "error",
        text: "Enter a valid date and 24-hour time.",
      });
      return;
    }

    if (scheduledAt.getTime() <= Date.now()) {
      setClientScheduleMessage({
        tone: "error",
        text: "Choose a future schedule time.",
      });
      return;
    }

    if (
      !COACH_CLIENT_DURATION_OPTIONS.some(
        (option) => option.value === durationMinutes,
      )
    ) {
      setClientScheduleMessage({
        tone: "error",
        text: "Choose a valid duration.",
      });
      return;
    }

    setClientScheduleMessage(null);

    try {
      await createClientAppointmentMutation.mutateAsync({
        durationMinutes,
        memberId: clientDetail.id,
        memberNotes: clientScheduleNotes.trim() || undefined,
        scheduledAt: scheduledAt.toISOString(),
      });
      await refetchCoachSchedule();
      setClientScheduleNotes("");
      setClientScheduleMessage({
        tone: "success",
        text: "Appointment scheduled.",
      });
    } catch (error) {
      setClientScheduleMessage({
        tone: "error",
        text: getCoachFormErrorMessage(
          error,
          "Unable to schedule appointment.",
        ),
      });
    }
  }, [
    clientDetail?.id,
    clientScheduleDate,
    clientScheduleDuration,
    clientScheduleNotes,
    clientScheduleTime,
    createClientAppointmentMutation,
    refetchCoachSchedule,
  ]);

  const handleRepeatLastMonthlySchedule = useCallback(() => {
    if (isCreatingMonthlyPlan || createRecurringPlanMutation.isPending) return;
    const previousPlan = lastMonthlyPlanForClient;
    if (!previousPlan?.scheduleItems?.length) return;

    const repeatedRows = repeatMonthlyScheduleDraft(
      previousPlan.scheduleItems,
    ).map((row) => ({
      date: row.date,
      time: row.time,
      durationMinutes: String(row.durationMinutes),
    }));

    if (repeatedRows.length === 0) return;

    setMonthlyPlanRows(repeatedRows);
    setMonthlyPlanQuote(
      monthlyOfferDefaults.quote || previousPlan.quotedAmount,
    );
    setMonthlyPlanMessage({
      tone: "success",
      text: "Last monthly schedule copied into the next fresh month. Review dates and conflicts before creating the plan.",
    });
  }, [
    createRecurringPlanMutation.isPending,
    isCreatingMonthlyPlan,
    lastMonthlyPlanForClient,
    monthlyOfferDefaults.quote,
  ]);

  const handleOpenMonthlyPlan = useCallback(() => {
    if (isCreatingMonthlyPlan || createRecurringPlanMutation.isPending) return;
    setMonthlyPlanRows(
      createFreshMonthlyPlanRows(
        monthlyOfferDefaults.sessionCount,
        monthlyOfferDefaults.durationMinutes,
        lastMonthlyPlanForClient,
      ),
    );
    setMonthlyPlanQuote(monthlyOfferDefaults.quote);
    const defaultPlan =
      clientCoachWorkoutPlans.find((plan) => plan.isActive) ??
      clientCoachWorkoutPlans[0];
    setMonthlyPlanTrainingPlanId(defaultPlan?.id ?? "");
    setMonthlyPlanMessage(null);
    setIsMonthlyPlanOpen(true);
  }, [
    createRecurringPlanMutation.isPending,
    clientCoachWorkoutPlans,
    isCreatingMonthlyPlan,
    lastMonthlyPlanForClient,
    monthlyOfferDefaults.durationMinutes,
    monthlyOfferDefaults.quote,
    monthlyOfferDefaults.sessionCount,
  ]);

  const updateMonthlyPlanRow = useCallback(
    (index: number, patch: Partial<MonthlyPlanDraftRow>) => {
      setMonthlyPlanRows((current) =>
        current.map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...patch } : row,
        ),
      );
      setMonthlyPlanMessage(null);
    },
    [],
  );

  const handleAddMonthlyPlanRow = useCallback(() => {
    if (isCreatingMonthlyPlan || createRecurringPlanMutation.isPending) return;
    if (monthlyPlanRows.length >= MAX_MONTHLY_PLAN_SESSIONS) {
      setMonthlyPlanMessage({
        tone: "error",
        text: `A monthly plan can contain at most ${MAX_MONTHLY_PLAN_SESSIONS} sessions.`,
      });
      return;
    }
    const firstRow = monthlyPlanRows[0];
    const lastRow = monthlyPlanRows[monthlyPlanRows.length - 1];
    const nextDate = new Date(`${lastRow?.date ?? firstRow?.date}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    if (
      !firstRow ||
      Number.isNaN(nextDate.getTime()) ||
      getMonthKey(toDateInputValue(nextDate)) !== getMonthKey(firstRow.date)
    ) {
      setMonthlyPlanMessage({
        tone: "error",
        text: "Monthly sessions must stay inside the same fresh calendar month.",
      });
      return;
    }
    setMonthlyPlanRows([
      ...monthlyPlanRows,
      {
        date: toDateInputValue(nextDate),
        time: firstRow.time || DEFAULT_MONTHLY_SESSION_TIME,
        durationMinutes:
          firstRow.durationMinutes ||
          String(monthlyOfferDefaults.durationMinutes),
      },
    ]);
    setMonthlyPlanMessage(null);
  }, [
    createRecurringPlanMutation.isPending,
    isCreatingMonthlyPlan,
    monthlyOfferDefaults.durationMinutes,
    monthlyPlanRows,
  ]);

  const handleRemoveMonthlyPlanRow = useCallback((index: number) => {
    setMonthlyPlanRows((current) =>
      current.length <= 1
        ? current
        : current.filter((_, rowIndex) => rowIndex !== index),
    );
    setMonthlyPlanMessage(null);
  }, []);

  const handleCreateMonthlyPlan = useCallback(async () => {
    if (isCreatingMonthlyPlan || createRecurringPlanMutation.isPending) return;
    if (!clientDetail?.id) return;

    const coachId =
      coachProfileQuery.data?.id ??
      coachScheduleRaw.find(
        (appointment) => appointment.userId === clientDetail.id,
      )?.coachId ??
      coachScheduleRaw[0]?.coachId;
    const quotedAmount = Number(monthlyPlanQuote.trim());

    if (!coachId) {
      setMonthlyPlanMessage({
        tone: "error",
        text: "This client has no coach relationship available yet.",
      });
      return;
    }

    if (coachProfileQuery.isPending) {
      setMonthlyPlanMessage({
        tone: "error",
        text: "Wait for the coach monthly offer to finish loading.",
      });
      return;
    }

    if (coachProfileQuery.error || !monthlyOfferDefaults.isConfigured) {
      setMonthlyPlanMessage({
        tone: "error",
        text: "Configure an active monthly offer with price, session count, and duration before creating a plan.",
      });
      return;
    }

    if (clientWorkoutPlansQuery.isPending) {
      setMonthlyPlanMessage({
        tone: "error",
        text: "Wait while FitTrack checks the client's active workout plan.",
      });
      return;
    }

    if (clientWorkoutPlansQuery.error || clientCoachWorkoutPlans.length === 0) {
      setMonthlyPlanMessage({
        tone: "error",
        text: "Assign a coach workout plan in the Workout tab before creating this month.",
      });
      return;
    }

    if (!selectedClientWorkoutPlan) {
      setMonthlyPlanMessage({
        tone: "error",
        text: "Choose the coach workout plan this monthly schedule should follow.",
      });
      return;
    }

    if (!Number.isFinite(quotedAmount) || quotedAmount <= 0) {
      setMonthlyPlanMessage({
        tone: "error",
        text: "Enter the full monthly quote. Credits and down payments are not used.",
      });
      return;
    }

    if (monthlyPlanRows.length === 0) {
      setMonthlyPlanMessage({
        tone: "error",
        text: "Add at least one actual appointment date.",
      });
      return;
    }

    const periodKey = getMonthKey(monthlyPlanRows[0]?.date ?? "");
    const currentMonthKey = getMonthKey(toDateInputValue(new Date()));
    if (!periodKey || periodKey <= currentMonthKey) {
      setMonthlyPlanMessage({
        tone: "error",
        text: "Choose dates in a future fresh calendar month.",
      });
      return;
    }
    const latestExistingTimestamp = getLatestMonthlyPlanTimestamp(
      lastMonthlyPlanForClient,
    );
    if (
      latestExistingTimestamp > 0 &&
      periodKey <=
        getMonthKey(toDateInputValue(new Date(latestExistingTimestamp)))
    ) {
      setMonthlyPlanMessage({
        tone: "error",
        text: "This client already has a plan in that month. Use Repeat Last Schedule for the next fresh period.",
      });
      return;
    }

    const scheduleItems: RecurringCoachingPlanInput["scheduleItems"] = [];
    let previousTimestamp = 0;
    const sessionsPerWeek = new Map<string, number>();

    for (const [index, row] of monthlyPlanRows.entries()) {
      const durationMinutes = Number(row.durationMinutes);
      const scheduledAt = buildLocalScheduleDate(row.date, row.time);

      if (
        !scheduledAt ||
        Number.isNaN(scheduledAt.getTime()) ||
        scheduledAt.getTime() <= Date.now()
      ) {
        setMonthlyPlanMessage({
          tone: "error",
          text: `Enter a valid future date and 24-hour time for session ${index + 1}.`,
        });
        return;
      }

      if (getMonthKey(row.date) !== periodKey) {
        setMonthlyPlanMessage({
          tone: "error",
          text: "All monthly session dates must stay inside one fresh calendar month.",
        });
        return;
      }

      if (scheduledAt.getTime() <= previousTimestamp) {
        setMonthlyPlanMessage({
          tone: "error",
          text: "Monthly sessions must be listed in chronological order without duplicates.",
        });
        return;
      }

      if (
        !COACH_CLIENT_DURATION_OPTIONS.some(
          (option) => option.value === durationMinutes,
        )
      ) {
        setMonthlyPlanMessage({
          tone: "error",
          text: `Choose a valid duration for session ${index + 1}.`,
        });
        return;
      }

      const weekKey = getWeekKey(row.date);
      const nextWeekCount = (sessionsPerWeek.get(weekKey) ?? 0) + 1;
      if (nextWeekCount > MAX_MONTHLY_SESSIONS_PER_WEEK) {
        setMonthlyPlanMessage({
          tone: "error",
          text: `Keep each week to at most ${MAX_MONTHLY_SESSIONS_PER_WEEK} sessions.`,
        });
        return;
      }
      sessionsPerWeek.set(weekKey, nextWeekCount);

      previousTimestamp = scheduledAt.getTime();
      scheduleItems.push({
        durationMinutes,
        scheduledAt: scheduledAt.toISOString(),
        sequenceIndex: index + 1,
      });
    }

    setIsCreatingMonthlyPlan(true);
    setMonthlyPlanMessage(null);
    try {
      await createRecurringPlanMutation.mutateAsync({
        coachId,
        durationMinutes: scheduleItems[0]?.durationMinutes ?? 60,
        durationMonths: 1,
        endDate:
          monthlyPlanRows[monthlyPlanRows.length - 1]?.date ??
          monthlyPlanRows[0]?.date ??
          "",
        frequency: "monthly",
        memberId: clientDetail.id,
        preferredDays: Array.from(
          new Set(
            scheduleItems.map((item) => new Date(item.scheduledAt).getDay()),
          ),
        ),
        preferredTime: monthlyPlanRows[0]?.time ?? "17:00",
        quotedAmount,
        scheduleItems,
        startDate: monthlyPlanRows[0]?.date ?? "",
        trainingPlanId: selectedClientWorkoutPlan.id,
      });
      setIsMonthlyPlanOpen(false);
      setClientDetailTab("overview");
      setClientScheduleMessage({
        tone: "success",
        text: "Monthly plan created. The client can review and pay the full quote in Bookings.",
      });
    } catch (error) {
      setMonthlyPlanMessage({
        tone: "error",
        text: getCoachFormErrorMessage(error, "Unable to create monthly plan."),
      });
    } finally {
      setIsCreatingMonthlyPlan(false);
    }
  }, [
    clientCoachWorkoutPlans.length,
    clientDetail?.id,
    clientWorkoutPlansQuery.error,
    clientWorkoutPlansQuery.isPending,
    coachScheduleRaw,
    coachProfileQuery.data?.id,
    coachProfileQuery.error,
    coachProfileQuery.isPending,
    createRecurringPlanMutation,
    isCreatingMonthlyPlan,
    lastMonthlyPlanForClient,
    monthlyOfferDefaults,
    monthlyPlanQuote,
    monthlyPlanRows,
    selectedClientWorkoutPlan,
  ]);

  const handleSubmitClientFeedback = useCallback(async () => {
    if (!selectedClientFeedbackAppointmentId) {
      setClientFeedbackMessage({
        tone: "error",
        text: "Choose a completed session first.",
      });
      return;
    }

    const feedback = clientCoachFeedback.trim();
    const assessment = clientAssessmentReport.trim();

    if (!feedback) {
      setClientFeedbackMessage({
        tone: "error",
        text: "Coach feedback is required.",
      });
      return;
    }

    setClientFeedbackMessage(null);

    try {
      await submitClientFeedbackMutation.mutateAsync({
        appointmentId: selectedClientFeedbackAppointmentId,
        payload: {
          coachFeedback: feedback,
          assessmentReport: assessment || undefined,
        },
      });
      await refetchCoachSchedule();
      setClientDetail((current) =>
        current
          ? {
              ...current,
              sessions: current.sessions.map((session) =>
                session.id === selectedClientFeedbackAppointmentId
                  ? {
                      ...session,
                      assessmentReport: assessment || undefined,
                      coachFeedback: feedback,
                    }
                  : session,
              ),
            }
          : current,
      );
      setClientFeedbackMessage({
        tone: "success",
        text: "Client feedback saved.",
      });
    } catch (error) {
      setClientFeedbackMessage({
        tone: "error",
        text: getCoachFormErrorMessage(error, "Unable to save feedback."),
      });
    }
  }, [
    clientAssessmentReport,
    clientCoachFeedback,
    refetchCoachSchedule,
    selectedClientFeedbackAppointmentId,
    submitClientFeedbackMutation,
  ]);

  const activeItems = useMemo(() => {
    if (activeSection === "bookings") return reservations;
    if (activeSection === "earnings") return coachEarningsItems;
    return appointmentsWithTimeline;
  }, [
    activeSection,
    appointmentsWithTimeline,
    coachEarningsItems,
    reservations,
  ]);

  const filtered = useMemo(() => {
    let result = activeItems;
    if (statusFilter !== "all")
      result = result.filter((booking) =>
        statusFilter === "pending"
          ? isPendingStatus(booking.status)
          : booking.status === statusFilter,
      );
    if (startDate)
      result = result.filter((booking) => booking.date >= startDate);
    if (endDate) result = result.filter((booking) => booking.date <= endDate);
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter(
        (booking) =>
          booking.resourceName.toLowerCase().includes(query) ||
          (booking.participantName ?? "").toLowerCase().includes(query),
      );
    }
    return result;
  }, [activeItems, debouncedSearchQuery, endDate, startDate, statusFilter]);

  const coachSessionsForClientSummary = useMemo(() => {
    let result = appointmentsWithTimeline;
    if (statusFilter !== "all") {
      result = result.filter((booking) =>
        statusFilter === "pending"
          ? isPendingStatus(booking.status)
          : booking.status === statusFilter,
      );
    }
    if (startDate)
      result = result.filter((booking) => booking.date >= startDate);
    if (endDate) result = result.filter((booking) => booking.date <= endDate);
    return result;
  }, [appointmentsWithTimeline, endDate, startDate, statusFilter]);

  const coachClientSummaries = useMemo<CoachClientSummary[]>(() => {
    const byClient = new Map<string, DetailBooking[]>();
    coachSessionsForClientSummary.forEach((appointment) => {
      const clientId =
        appointment.resourceId || appointment.participantName || appointment.id;
      const existing = byClient.get(clientId) ?? [];
      existing.push(appointment);
      byClient.set(clientId, existing);
    });

    return Array.from(byClient.entries())
      .map(([clientId, sessions]) => {
        const sortedSessions = [...sessions].sort((left, right) =>
          `${left.date} ${left.startTime ?? left.time}`.localeCompare(
            `${right.date} ${right.startTime ?? right.time}`,
          ),
        );
        const nextSession = sortedSessions.find(
          (session) =>
            session.date >= todayString &&
            session.status !== "cancelled" &&
            session.status !== "completed" &&
            session.status !== "declined" &&
            session.status !== "no_show",
        );
        const lastSession = [...sortedSessions]
          .reverse()
          .find((session) => session.date <= todayString);
        const completedCount = sessions.filter(
          (session) => session.status === "completed",
        ).length;
        const pendingCount = sessions.filter((session) =>
          isPendingStatus(session.status),
        ).length;
        const needsCoachReply = sessions.some(
          (session) => session.status === "pending_coach",
        );
        const readinessLabel = needsCoachReply
          ? "Needs Reply"
          : pendingCount > 0
            ? "Pending"
            : nextSession
              ? "Active"
              : completedCount > 0
                ? "Ready"
                : "New";
        const readinessColor = needsCoachReply
          ? colors.warning
          : pendingCount > 0
            ? colors.warning
            : nextSession
              ? colors.success
              : completedCount > 0
                ? colors.brand
                : colors.textMuted;

        return {
          completedCount,
          email: coachMemberEmailById.get(clientId) ?? "",
          id: clientId,
          lastSession,
          name: sortedSessions[0]?.resourceName ?? "Member",
          nextSession,
          pendingCount,
          readinessColor,
          readinessLabel,
          sessions: sortedSessions,
          sessionCount: sessions.length,
        };
      })
      .sort((left, right) => {
        const leftNext = left.nextSession
          ? `${left.nextSession.date} ${left.nextSession.startTime ?? left.nextSession.time}`
          : "9999";
        const rightNext = right.nextSession
          ? `${right.nextSession.date} ${right.nextSession.startTime ?? right.nextSession.time}`
          : "9999";
        if (leftNext !== rightNext) return leftNext.localeCompare(rightNext);
        return left.name.localeCompare(right.name);
      });
  }, [
    coachMemberEmailById,
    coachSessionsForClientSummary,
    colors.brand,
    colors.success,
    colors.textMuted,
    colors.warning,
    todayString,
  ]);

  const filteredCoachClients = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    if (!query) return coachClientSummaries;
    return coachClientSummaries.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query),
    );
  }, [coachClientSummaries, debouncedSearchQuery]);

  const coachEarningsSummary = useMemo(() => {
    const earningsSource =
      activeSection === "earnings" ? filtered : coachEarningsItems;
    const currentMonthKey = todayString.slice(0, 7);
    const completedItems = earningsSource.filter(
      (appointment) => appointment.status === "completed",
    );
    const totalEarned = completedItems.reduce(
      (sum, appointment) =>
        sum + (coachEarningsByAppointmentId.get(appointment.id) ?? 0),
      0,
    );
    const monthlyEarned = completedItems
      .filter((appointment) => appointment.date.startsWith(currentMonthKey))
      .reduce(
        (sum, appointment) =>
          sum + (coachEarningsByAppointmentId.get(appointment.id) ?? 0),
        0,
      );

    return {
      monthlyEarned,
      resolvedCount: earningsSource.length,
      totalEarned,
    };
  }, [
    activeSection,
    coachEarningsByAppointmentId,
    coachEarningsItems,
    filtered,
    todayString,
  ]);

  const bookingTotalPages = Math.max(
    1,
    Math.ceil(filtered.length / BOOKINGS_PAGE_SIZE),
  );
  const safeBookingPage = Math.min(bookingPage, bookingTotalPages);
  const pagedBookings = useMemo(() => {
    const start = (safeBookingPage - 1) * BOOKINGS_PAGE_SIZE;
    return filtered.slice(start, start + BOOKINGS_PAGE_SIZE);
  }, [filtered, safeBookingPage]);
  const grouped = groupItemsByDate(pagedBookings, "asc");
  const bookingCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((booking) => {
      counts.set(booking.date, (counts.get(booking.date) ?? 0) + 1);
    });
    return counts;
  }, [filtered]);
  const isEmpty =
    !isLoading &&
    (activeSection === "clients" && isCoachRole
      ? filteredCoachClients.length === 0
      : filtered.length === 0);
  const startLabel = startDate ? formatGroupLabel(startDate) : "All Dates";
  const endLabel = endDate ? formatGroupLabel(endDate) : "Due Date";

  useEffect(() => {
    setBookingPage(1);
  }, [activeSection, debouncedSearchQuery, endDate, startDate, statusFilter]);

  useEffect(() => {
    setBookingPage((current) => Math.min(current, bookingTotalPages));
  }, [bookingTotalPages]);
  const detailVenue = useMemo(
    () =>
      venues.find((venue) => String(venue.id) === detailBooking?.resourceId) ??
      null,
    [detailBooking?.resourceId, venues],
  );
  const clientDetailSessions = clientDetail?.sessions ?? [];
  const clientLatestSession =
    clientDetailSessions.length > 0
      ? clientDetailSessions[clientDetailSessions.length - 1]
      : undefined;
  const clientSessionRecord =
    clientLatestSession ??
    clientDetail?.nextSession ??
    clientDetail?.lastSession;
  const clientNextCount = clientDetailSessions.filter(
    (session) =>
      session.date >= todayString && !isFinalSessionStatus(session.status),
  ).length;
  const completedClientSessions = useMemo(
    () =>
      clientDetailSessions.filter((session) => session.status === "completed"),
    [clientDetailSessions],
  );

  useEffect(() => {
    if (!clientDetail) return;
    const refreshedClient = coachClientSummaries.find(
      (client) => client.id === clientDetail.id,
    );
    if (refreshedClient && refreshedClient !== clientDetail) {
      setClientDetail(refreshedClient);
    }
  }, [clientDetail, clientDetail?.id, coachClientSummaries]);

  useEffect(() => {
    if (!clientDetail) {
      setSelectedClientFeedbackAppointmentId("");
      setClientScheduleMessage(null);
      setClientFeedbackMessage(null);
      setIsMonthlyPlanOpen(false);
      setMonthlyPlanCalendarRowIndex(null);
      return;
    }

    const nextInputs = getDefaultCoachScheduleInputs();
    setClientScheduleDate(nextInputs.date);
    setClientScheduleTime(nextInputs.time);
    setClientScheduleDuration("60");
    setClientScheduleNotes("");
    setClientScheduleMessage(null);
    setClientFeedbackMessage(null);

    const firstCompletedSession =
      clientDetail.sessions.find((session) => session.status === "completed") ??
      null;
    setSelectedClientFeedbackAppointmentId(firstCompletedSession?.id ?? "");
    setClientCoachFeedback(firstCompletedSession?.coachFeedback ?? "");
    setClientAssessmentReport(firstCompletedSession?.assessmentReport ?? "");
  }, [clientDetail?.id]);

  useEffect(() => {
    if (!selectedClientFeedbackAppointmentId) return;
    const selectedSession = completedClientSessions.find(
      (session) => session.id === selectedClientFeedbackAppointmentId,
    );
    if (!selectedSession) return;
    setClientCoachFeedback(selectedSession.coachFeedback ?? "");
    setClientAssessmentReport(selectedSession.assessmentReport ?? "");
    setClientFeedbackMessage(null);
  }, [completedClientSessions, selectedClientFeedbackAppointmentId]);

  const detailActions = useMemo(() => {
    if (!detailBooking) return [];
    if (activeSection === "bookings") {
      return [
        {
          key: "cancel-reservation",
          label: isCancelling
            ? cancellingReservationLabel
            : "Cancel Reservation",
          variant: "danger" as const,
          icon: CircleOff,
          onPress: handleCancelReservation,
          disabled:
            isCancelling ||
            detailBooking.status === "cancelled" ||
            detailBooking.status === "completed",
          loading: isCancelling,
          loadingLabel: cancellingReservationLabel,
        },
      ];
    }
    if (isCoachRole) {
      const isFinal =
        detailBooking.status === "cancelled" ||
        detailBooking.status === "completed" ||
        detailBooking.status === "declined" ||
        detailBooking.status === "no_show";
      const actions = [];

      if (detailBooking.status === "pending_coach") {
        actions.push(
          {
            key: "confirm-session",
            label: "Confirm Session",
            variant: "primary" as const,
            icon: CheckCircle2,
            onPress: (booking: DetailBooking) =>
              handleCoachAction(booking, "confirm"),
            disabled: coachActionLoading || isCancelling,
            loading: confirmCoachAppointmentMutation.isPending,
            loadingLabel: coachActionLoadingLabel,
          },
          {
            key: "decline-session",
            label: "Decline Session",
            variant: "danger" as const,
            icon: CircleOff,
            onPress: (booking: DetailBooking) =>
              handleCoachAction(booking, "decline"),
            disabled: coachActionLoading || isCancelling,
            loading: declineCoachAppointmentMutation.isPending,
            loadingLabel: coachActionLoadingLabel,
          },
        );
      }

      if (detailBooking.status === "confirmed") {
        actions.push({
          key: "complete-session",
          label: "Complete Session",
          variant: "primary" as const,
          icon: CheckCircle2,
          onPress: (booking: DetailBooking) =>
            handleCoachAction(booking, "complete"),
          disabled: coachActionLoading || isCancelling,
          loading: completeCoachAppointmentMutation.isPending,
          loadingLabel: coachActionLoadingLabel,
        });
      }

      if (!isFinal) {
        actions.push({
          key: "cancel-session",
          label: isCancelling ? cancellingAppointmentLabel : "Cancel Session",
          variant: "danger" as const,
          icon: CircleOff,
          onPress: handleCancelAppointment,
          disabled: coachActionLoading || isCancelling,
          loading: isCancelling,
          loadingLabel: cancellingAppointmentLabel,
        });
      }

      return actions;
    }
    if (canStartMemberAppointmentPayment(detailBooking)) {
      const paymentStage = getMemberAppointmentPaymentStage();
      return [
        {
          key: "paymongo-appointment-full",
          label: payAppointmentMutation.isPending
            ? confirmingPaymentLabel
            : "PayMongo Full Payment",
          variant: "primary" as const,
          icon: CheckCircle2,
          onPress: async (booking: DetailBooking) => {
            setPendingAppointmentPayment({
              booking,
              provider: "paymongo",
              stage: paymentStage,
            });
          },
          disabled: payAppointmentMutation.isPending || isCancelling,
          loading: payAppointmentMutation.isPending,
          loadingLabel: confirmingPaymentLabel,
        },
        {
          key: "cancel-appointment",
          label: isCancelling
            ? cancellingAppointmentLabel
            : "Cancel Appointment",
          variant: "danger" as const,
          icon: CircleOff,
          onPress: handleCancelAppointment,
          disabled: payAppointmentMutation.isPending || isCancelling,
          loading: isCancelling,
          loadingLabel: cancellingAppointmentLabel,
        },
      ];
    }
    const actions = [];
    if (
      detailBooking.status === "completed" &&
      detailBooking.coachId &&
      !detailBooking.coachReviewRating
    ) {
      actions.push({
        key: "leave-coach-review",
        label: "Leave Feedback",
        variant: "primary" as const,
        icon: Star,
        onPress: handleOpenCoachReview,
        disabled: submitCoachReviewMutation.isPending,
        loading: submitCoachReviewMutation.isPending,
        loadingLabel: "SUBMITTING",
      });
    }
    actions.push({
      key: "cancel-appointment",
      label: isCancelling ? cancellingAppointmentLabel : "Cancel Appointment",
      variant: "danger" as const,
      icon: CircleOff,
      onPress: handleCancelAppointment,
      disabled:
        isCancelling ||
        detailBooking.status === "cancelled" ||
        detailBooking.status === "completed" ||
        detailBooking.status === "declined" ||
        detailBooking.status === "no_show",
      loading: isCancelling,
      loadingLabel: cancellingAppointmentLabel,
    });
    return actions;
  }, [
    activeSection,
    cancellingAppointmentLabel,
    cancellingReservationLabel,
    coachActionLoading,
    coachActionLoadingLabel,
    completeCoachAppointmentMutation.isPending,
    confirmCoachAppointmentMutation.isPending,
    declineCoachAppointmentMutation.isPending,
    detailBooking,
    handleCoachAction,
    handleCancelAppointment,
    handleCancelReservation,
    handleOpenCoachReview,
    isCancelling,
    isCoachRole,
    confirmingPaymentLabel,
    payAppointmentMutation,
    submitCoachReviewMutation.isPending,
    user?.id,
  ]);

  const handlePayRecurringCycle = useCallback(
    async (
      _plan: RecurringCoachingPlanRecord,
      cycle: RecurringCoachingBillingCycleRecord,
    ) => {
      try {
        setRecurringPlanPaymentError(null);
        setPayingRecurringCycleId(cycle.id);
        const result =
          await mobileApiClient.recurringCoachingPlans.payBillingCycle(
            cycle.recurringPlanId,
            cycle.id,
            { provider: "paymongo" },
          );
        if (!result.checkoutUrl) {
          throw new Error(
            "PayMongo did not return a checkout link. No appointment was activated.",
          );
        }
        await Linking.openURL(result.checkoutUrl);
      } catch {
        setRecurringPlanPaymentError(
          "PayMongo payment is currently unavailable. Your monthly plan was not activated. Please try again.",
        );
      } finally {
        setPayingRecurringCycleId(null);
      }
    },
    [],
  );

  const sectionOptions = isCoachRole
    ? COACH_SECTION_OPTIONS
    : MEMBER_SECTION_OPTIONS;
  const chipOptions = FILTER_OPTIONS;
  const searchPlaceholder =
    activeSection === "clients"
      ? "Search clients..."
      : activeSection === "earnings"
        ? "Search earnings..."
        : isCoachRole
          ? "Search sessions..."
          : activeSection === "appointments"
            ? "Search appointments..."
            : "Search bookings...";
  const EmptyStateIcon =
    activeSection === "clients"
      ? Users
      : activeSection === "earnings"
        ? LineChart
        : CalendarDays;
  const loadingTitle =
    activeSection === "bookings"
      ? "Loading reservations"
      : activeSection === "clients"
        ? "Loading clients"
        : activeSection === "earnings"
          ? "Loading earnings"
          : isCoachRole
            ? "Loading sessions"
            : "Loading appointments";
  const unavailableTitle =
    activeSection === "bookings"
      ? "Reservations unavailable"
      : activeSection === "clients"
        ? "Clients unavailable"
        : activeSection === "earnings"
          ? "Earnings unavailable"
          : isCoachRole
            ? "Sessions unavailable"
            : "Appointments unavailable";
  const hasActiveListFilters = Boolean(
    debouncedSearchQuery.trim() ||
    statusFilter !== "all" ||
    startDate ||
    endDate,
  );
  const emptyTitle = hasActiveListFilters
    ? activeSection === "bookings"
      ? "No matching reservations"
      : activeSection === "clients"
        ? "No matching clients"
        : activeSection === "earnings"
          ? "No matching earnings"
          : isCoachRole
            ? "No matching sessions"
            : "No matching appointments"
    : activeSection === "bookings"
      ? "No reservations"
      : activeSection === "clients"
        ? "No clients found"
        : activeSection === "earnings"
          ? "No earnings found"
          : isCoachRole
            ? "No sessions found"
            : "No appointments found";
  const emptyHint = hasActiveListFilters
    ? "Clear the search or filters to bring the rest of the list back into view."
    : activeSection === "bookings"
      ? "Your reservations will appear here"
      : activeSection === "clients"
        ? "Client profiles appear after assigned coach sessions."
        : activeSection === "earnings"
          ? "Completed coach sessions will appear here."
          : isCoachRole
            ? "Coach sessions will appear here"
            : "Your trainer appointments will appear here";

  return (
    <View style={[base.screen, !isFocused && { display: "none" }]}>
      <Animated.View style={[s.searchAnimWrap, contentStyle]}>
        <View style={s.searchWrap}>
          <View style={s.searchRow}>
            <View style={s.searchFieldWrap}>
              <FitSearch
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                isFabOpen={isFabOpen}
              />
            </View>
            <Pressable
              onPress={() => {
                setIsFilterOpen((value) => !value);
                setFabOpen(false);
              }}
              style={s.filterBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                isFilterOpen ? "Close booking filters" : "Open booking filters"
              }
              accessibilityState={{ expanded: isFilterOpen }}
            >
              <SlidersHorizontal
                size={20}
                color={isFilterOpen ? colors.brand : colors.textMuted}
                strokeWidth={2}
              />
            </Pressable>
          </View>
        </View>
        <FitFilter
          isOpen={isFilterOpen}
          topChipOptions={sectionOptions}
          activeTopChip={activeSection}
          onTopChipChange={handleSectionChange}
          topChipLabel="View"
          chipOptions={chipOptions}
          activeChip={statusFilter}
          onChipChange={(value) =>
            setStatusFilter(value as ExtendedStatusFilter)
          }
          showDateRange
          startDate={startDate}
          endDate={endDate}
          startDateLabel={startLabel}
          endDateLabel={endLabel}
          onStartDatePress={() => setIsStartCalOpen(true)}
          onEndDatePress={() => setIsEndCalOpen(true)}
          onStartDateReset={() => setStartDate("")}
          onEndDateReset={() => setEndDate("")}
        />
      </Animated.View>
      <Animated.ScrollView
        style={[base.content, screenStyle]}
        contentContainerStyle={[base.scrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        onTouchStart={() => {
          setFabOpen(false);
        }}
        scrollEventThrottle={16}
      >
        <Animated.View style={contentStyle}>
          {isUserRole ? (
            <RecurringPlanMobilePanel
              error={recurringPlanPaymentError}
              isLoading={recurringPlansQuery.isPending}
              onPay={(plan, cycle) => void handlePayRecurringCycle(plan, cycle)}
              payingCycleId={payingRecurringCycleId}
              plans={recurringPlansQuery.data ?? []}
            />
          ) : null}
          {isLoading ? (
            <View style={s.emptyState}>
              <EmptyStateIcon
                size={40}
                color={colors.textMuted}
                strokeWidth={1.5}
              />
              <FitText style={s.emptyTitle}>{loadingTitle}</FitText>
              <FitText style={s.emptyHint}>Please wait a moment</FitText>
            </View>
          ) : errorText ? (
            <View style={s.emptyState}>
              <EmptyStateIcon
                size={40}
                color={colors.textMuted}
                strokeWidth={1.5}
              />
              <FitText style={s.emptyTitle}>{unavailableTitle}</FitText>
              <FitText style={s.emptyHint}>{errorText}</FitText>
            </View>
          ) : isEmpty ? (
            <View style={s.emptyState}>
              <EmptyStateIcon
                size={40}
                color={colors.textMuted}
                strokeWidth={1.5}
              />
              <FitText style={s.emptyTitle}>{emptyTitle}</FitText>
              <FitText style={s.emptyHint}>{emptyHint}</FitText>
            </View>
          ) : activeSection === "clients" && isCoachRole ? (
            <View style={s.group}>
              <FitText style={s.groupLabel}>CLIENTS</FitText>
              <View style={s.groupCards}>
                {filteredCoachClients.map((client, index) => {
                  const sessionSummary = `${client.sessionCount} session${
                    client.sessionCount === 1 ? "" : "s"
                  }`;
                  const timingSummary = client.nextSession
                    ? `Next ${formatBookingDate(client.nextSession.date)}`
                    : client.lastSession
                      ? `Last ${formatBookingDate(client.lastSession.date)}`
                      : "No dated sessions";
                  const subtitle = client.email
                    ? `${client.email} | ${sessionSummary} | ${timingSummary}`
                    : `${sessionSummary} | ${timingSummary}`;

                  return (
                    <View key={client.id} style={s.cardRow}>
                      <View style={s.cardWrap}>
                        <FitCard
                          icon={Users}
                          iconSize={18}
                          label={client.name}
                          subtitle={subtitle}
                          trailingLabel={client.readinessLabel}
                          trailingLabelColor={client.readinessColor}
                          hasBorder={index < filteredCoachClients.length - 1}
                          onPress={() => {
                            setClientDetail(client);
                            setClientDetailTab("overview");
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <>
              {activeSection === "earnings" && isCoachRole ? (
                <View style={s.group}>
                  <FitText style={s.groupLabel}>EARNINGS SUMMARY</FitText>
                  <View style={s.groupCards}>
                    <FitCard
                      icon={WalletCards}
                      iconSize={18}
                      label="Total Earnings This Month"
                      subtitle="Completed coach sessions in the current month."
                      trailingLabel={formatPeso(
                        coachEarningsSummary.monthlyEarned,
                      )}
                      trailingLabelColor={colors.brand}
                      hasBorder
                      noChevron
                    />
                    <FitCard
                      icon={LineChart}
                      iconSize={18}
                      label="Total Earnings All Time"
                      subtitle="Completed coach sessions in the selected view."
                      trailingLabel={formatPeso(
                        coachEarningsSummary.totalEarned,
                      )}
                      trailingLabelColor={colors.brand}
                      hasBorder
                      noChevron
                    />
                    <FitCard
                      icon={CalendarCheck}
                      iconSize={18}
                      label="Resolved Sessions"
                      subtitle="Completed and no-show sessions shown below."
                      trailingLabel={String(coachEarningsSummary.resolvedCount)}
                      trailingLabelColor={colors.success}
                      noChevron
                    />
                  </View>
                </View>
              ) : null}
              {grouped.map(([dateKey, dateBookings]) => (
                <View key={dateKey} style={s.group}>
                  <FitText style={s.groupLabel}>
                    {formatGroupLabel(dateKey)} -{" "}
                    {bookingCountByDate.get(dateKey) ?? dateBookings.length}{" "}
                    {(bookingCountByDate.get(dateKey) ??
                      dateBookings.length) === 1
                      ? "booking"
                      : "bookings"}
                  </FitText>
                  <View style={s.groupCards}>
                    {dateBookings.map((booking) => {
                      const amenityIcon =
                        AMENITY_ICONS[booking.resourceName] ??
                        DEFAULT_AMENITY_ICON;
                      const detailSubtitle =
                        booking.startTime && booking.endTime
                          ? `${booking.startTime} - ${booking.endTime}`
                          : booking.time;
                      const isEarningsView =
                        activeSection === "earnings" && isCoachRole;
                      return (
                        <View key={booking.id} style={s.cardRow}>
                          <View style={s.cardWrap}>
                            <FitCard
                              icon={
                                isEarningsView
                                  ? WalletCards
                                  : activeSection === "appointments"
                                    ? Users
                                    : amenityIcon
                              }
                              iconSize={18}
                              label={booking.resourceName}
                              subtitle={`${formatBookingDate(booking.date)} | ${detailSubtitle}${
                                isEarningsView
                                  ? ` | ${formatStatusLabel(booking.status)}`
                                  : ""
                              }`}
                              trailingLabel={
                                isEarningsView
                                  ? formatPeso(
                                      coachEarningsByAppointmentId.get(
                                        booking.id,
                                      ) ?? 0,
                                    )
                                  : formatStatusLabel(booking.status)
                              }
                              trailingLabelColor={
                                isEarningsView
                                  ? booking.status === "completed"
                                    ? colors.brand
                                    : colors.textMuted
                                  : (STATUS_COLORS[booking.status] ??
                                    colors.textMuted)
                              }
                              onPress={() => setDetailBooking(booking)}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
              {bookingTotalPages > 1 ? (
                <FitPager
                  currentPage={safeBookingPage}
                  onPageChange={setBookingPage}
                  totalPages={bookingTotalPages}
                />
              ) : null}
            </>
          )}
        </Animated.View>
      </Animated.ScrollView>
      <BookingDetailModal
        isVisible={
          !!detailBooking &&
          clientDetail == null &&
          reviewTarget == null &&
          pendingAppointmentPayment == null &&
          pendingCancellation == null &&
          pendingCoachAction == null
        }
        booking={detailBooking}
        venue={detailVenue}
        onClose={() => setDetailBooking(null)}
        actions={detailActions}
      />
      <Modal
        visible={clientDetail != null}
        transparent
        animationType="fade"
        onRequestClose={() => setClientDetail(null)}
      >
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.52)",
              justifyContent: "center",
              padding: 18,
            },
          ]}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: 22,
              borderWidth: 1,
              maxHeight: "88%",
              maxWidth: 430,
              overflow: "hidden",
              width: "100%",
            }}
          >
            {clientDetail ? (
              <ScrollView
                contentContainerStyle={{ gap: 16, padding: 16 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: colors.surfaceRaised,
                      borderColor: colors.border,
                      borderRadius: 14,
                      borderWidth: 1,
                      height: 72,
                      justifyContent: "center",
                      width: 72,
                    }}
                  >
                    <FitText
                      style={{
                        color: colors.textPrimary,
                        fontSize: 28,
                        fontWeight: "900",
                      }}
                    >
                      {getClientInitials(clientDetail.name)}
                    </FitText>
                  </View>
                  <View style={{ alignItems: "center", gap: 3 }}>
                    <FitText
                      style={{
                        color: colors.textPrimary,
                        fontSize: 20,
                        fontWeight: "900",
                        textAlign: "center",
                      }}
                    >
                      {clientDetail.name}
                    </FitText>
                    {clientDetail.email ? (
                      <FitText
                        style={{
                          color: colors.textMuted,
                          fontSize: 12,
                          textAlign: "center",
                        }}
                      >
                        {clientDetail.email}
                      </FitText>
                    ) : null}
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  {COACH_CLIENT_DETAIL_TABS.map((tab) => {
                    const isActive = clientDetailTab === tab.value;
                    return (
                      <Pressable
                        key={tab.value}
                        onPress={() => setClientDetailTab(tab.value)}
                        style={{
                          alignItems: "center",
                          backgroundColor: isActive
                            ? colors.brand + "22"
                            : colors.surfaceRaised,
                          borderColor: isActive ? colors.brand : colors.border,
                          borderRadius: 9,
                          borderWidth: 1,
                          flex: 1,
                          minHeight: 42,
                          justifyContent: "center",
                          paddingHorizontal: 8,
                        }}
                      >
                        <FitText
                          style={{
                            color: isActive ? colors.brand : colors.textPrimary,
                            fontSize: 12,
                            fontWeight: "800",
                          }}
                        >
                          {tab.label}
                        </FitText>
                      </Pressable>
                    );
                  })}
                </View>

                {clientDetailTab === "overview" ? (
                  <View style={{ gap: 12 }}>
                    <FitText
                      style={{
                        color: colors.brand,
                        fontSize: 13,
                        fontWeight: "900",
                      }}
                    >
                      COACHING OVERVIEW
                    </FitText>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {[
                        { label: "SESSIONS", value: clientDetail.sessionCount },
                        { label: "DONE", value: clientDetail.completedCount },
                        { label: "NEXT", value: clientNextCount },
                      ].map((item) => (
                        <View
                          key={item.label}
                          style={{
                            backgroundColor: colors.surfaceRaised,
                            borderColor: colors.border,
                            borderRadius: 10,
                            borderWidth: 1,
                            flex: 1,
                            gap: 8,
                            padding: 12,
                          }}
                        >
                          <FitText
                            style={{
                              color: colors.textMuted,
                              fontSize: 10,
                              fontWeight: "800",
                            }}
                          >
                            {item.label}
                          </FitText>
                          <FitText
                            style={{
                              color: colors.textPrimary,
                              fontSize: 18,
                              fontWeight: "900",
                            }}
                          >
                            {item.value}
                          </FitText>
                        </View>
                      ))}
                    </View>
                    <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                      Latest session:{" "}
                      <FitText
                        style={{
                          color: colors.textPrimary,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {clientLatestSession
                          ? `${formatBookingDate(clientLatestSession.date)}, ${getSessionTimeLabel(clientLatestSession).split(" - ")[0]}`
                          : "Not scheduled"}
                      </FitText>
                    </FitText>
                    <View style={{ gap: 8 }}>
                      <FitText
                        style={{
                          color: colors.textMuted,
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        Session record
                      </FitText>
                      {clientSessionRecord ? (
                        <FitCard
                          icon={CalendarDays}
                          iconSize={18}
                          label={`${formatBookingDate(clientSessionRecord.date)}, ${getSessionTimeLabel(clientSessionRecord).split(" - ")[0]}`}
                          subtitle={`Notes: ${
                            clientSessionRecord.sessionNotes ||
                            clientSessionRecord.description ||
                            "Not added"
                          } | Feedback: ${
                            clientSessionRecord.coachFeedback || "Not added"
                          } | Assessment: ${
                            clientSessionRecord.assessmentReport || "Not added"
                          }`}
                          trailingLabel={formatStatusLabel(
                            clientSessionRecord.status,
                          )}
                          trailingLabelColor={
                            STATUS_COLORS[clientSessionRecord.status] ??
                            colors.textMuted
                          }
                          noChevron
                        />
                      ) : (
                        <FitText
                          style={{ color: colors.textMuted, fontSize: 13 }}
                        >
                          No session record found.
                        </FitText>
                      )}
                    </View>
                    <Pressable
                      onPress={handleOpenMonthlyPlan}
                      style={{
                        alignItems: "center",
                        backgroundColor: colors.brand,
                        borderRadius: 12,
                        flexDirection: "row",
                        gap: 8,
                        justifyContent: "center",
                        minHeight: 46,
                        paddingHorizontal: 14,
                      }}
                    >
                      <CalendarPlus
                        color={colors.onBrand ?? "#FFFFFF"}
                        size={17}
                        strokeWidth={2.5}
                      />
                      <FitText
                        style={{
                          color: colors.onBrand ?? "#FFFFFF",
                          fontSize: 12,
                          fontWeight: "900",
                        }}
                      >
                        CREATE MONTHLY PLAN
                      </FitText>
                    </Pressable>
                  </View>
                ) : null}

                {clientDetailTab === "schedule" ? (
                  <View style={{ gap: 14 }}>
                    <FitText
                      style={{
                        color: colors.brand,
                        fontSize: 13,
                        fontWeight: "900",
                      }}
                    >
                      SCHEDULE NEW APPOINTMENT
                    </FitText>
                    <FitText style={{ color: colors.textMuted, fontSize: 13 }}>
                      Creates a confirmed appointment for this client using your
                      current coach availability.
                    </FitText>
                    <View style={{ gap: 10 }}>
                      <View style={{ gap: 6 }}>
                        <FitText
                          style={{
                            color: colors.textMuted,
                            fontSize: 11,
                            fontWeight: "900",
                          }}
                        >
                          DATE
                        </FitText>
                        <Pressable
                          onPress={() => setIsClientScheduleCalendarOpen(true)}
                          style={{
                            borderColor: colors.border,
                            borderRadius: 10,
                            borderWidth: 1,
                            justifyContent: "center",
                            minHeight: 44,
                            paddingHorizontal: 12,
                          }}
                        >
                          <FitText
                            style={{
                              color: colors.textPrimary,
                              fontSize: 13,
                              fontWeight: "700",
                            }}
                          >
                            {formatBookingDate(clientScheduleDate)}
                          </FitText>
                        </Pressable>
                      </View>
                      <View style={{ gap: 6 }}>
                        <FitText
                          style={{
                            color: colors.textMuted,
                            fontSize: 11,
                            fontWeight: "900",
                          }}
                        >
                          TIME
                        </FitText>
                        <TextInput
                          value={clientScheduleTime}
                          onChangeText={(value) => {
                            setClientScheduleTime(value);
                            setClientScheduleMessage(null);
                          }}
                          placeholder="17:00"
                          placeholderTextColor={colors.textMuted}
                          style={{
                            borderColor: colors.border,
                            borderRadius: 10,
                            borderWidth: 1,
                            color: colors.textPrimary,
                            fontSize: 13,
                            fontWeight: "700",
                            minHeight: 44,
                            paddingHorizontal: 12,
                          }}
                        />
                      </View>
                      <View style={{ gap: 6 }}>
                        <FitText
                          style={{
                            color: colors.textMuted,
                            fontSize: 11,
                            fontWeight: "900",
                          }}
                        >
                          DURATION
                        </FitText>
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          {COACH_CLIENT_DURATION_OPTIONS.map((option) => {
                            const isActive =
                              clientScheduleDuration === String(option.value);
                            return (
                              <Pressable
                                key={option.value}
                                onPress={() => {
                                  setClientScheduleDuration(
                                    String(option.value),
                                  );
                                  setClientScheduleMessage(null);
                                }}
                                style={{
                                  backgroundColor: isActive
                                    ? colors.brand + "22"
                                    : colors.surfaceRaised,
                                  borderColor: isActive
                                    ? colors.brand
                                    : colors.border,
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  minHeight: 42,
                                  justifyContent: "center",
                                  paddingHorizontal: 12,
                                }}
                              >
                                <FitText
                                  style={{
                                    color: isActive
                                      ? colors.brand
                                      : colors.textPrimary,
                                    fontSize: 12,
                                    fontWeight: "800",
                                  }}
                                >
                                  {option.label}
                                </FitText>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                      <View style={{ gap: 6 }}>
                        <FitText
                          style={{
                            color: colors.textMuted,
                            fontSize: 11,
                            fontWeight: "900",
                          }}
                        >
                          SESSION NOTES
                        </FitText>
                        <TextInput
                          value={clientScheduleNotes}
                          onChangeText={(value) => {
                            setClientScheduleNotes(value);
                            setClientScheduleMessage(null);
                          }}
                          multiline
                          placeholder="Add session focus, reminders, or prep notes."
                          placeholderTextColor={colors.textMuted}
                          style={{
                            borderColor: colors.border,
                            borderRadius: 10,
                            borderWidth: 1,
                            color: colors.textPrimary,
                            fontSize: 13,
                            minHeight: 76,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            textAlignVertical: "top",
                          }}
                        />
                      </View>
                      {clientScheduleMessage ? (
                        <FitText
                          style={{
                            color:
                              clientScheduleMessage.tone === "success"
                                ? colors.success
                                : colors.danger,
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          {clientScheduleMessage.text}
                        </FitText>
                      ) : null}
                      <Pressable
                        disabled={createClientAppointmentMutation.isPending}
                        onPress={() => {
                          void handleCreateClientAppointment();
                        }}
                        style={{
                          alignItems: "center",
                          backgroundColor: colors.brand,
                          borderRadius: 12,
                          justifyContent: "center",
                          minHeight: 46,
                          opacity: createClientAppointmentMutation.isPending
                            ? 0.65
                            : 1,
                        }}
                      >
                        <FitText
                          style={{
                            color: colors.onBrand ?? "#FFFFFF",
                            fontSize: 12,
                            fontWeight: "900",
                          }}
                        >
                          {createClientAppointmentMutation.isPending
                            ? "SCHEDULING"
                            : "SCHEDULE APPOINTMENT"}
                        </FitText>
                      </Pressable>
                    </View>
                    <View
                      style={{
                        backgroundColor: colors.border,
                        height: StyleSheet.hairlineWidth,
                      }}
                    />
                    <FitText
                      style={{
                        color: colors.textMuted,
                        fontSize: 12,
                        fontWeight: "900",
                      }}
                    >
                      SESSION HISTORY
                    </FitText>
                    <View style={s.groupCards}>
                      {clientDetailSessions.length > 0 ? (
                        clientDetailSessions.map((session, index) => (
                          <FitCard
                            key={session.id}
                            icon={CalendarDays}
                            iconSize={18}
                            label={formatBookingDate(session.date)}
                            subtitle={`${getSessionTimeLabel(session)} | ${
                              session.sessionNotes ||
                              session.description ||
                              "No notes"
                            }`}
                            trailingLabel={formatStatusLabel(session.status)}
                            trailingLabelColor={
                              STATUS_COLORS[session.status] ?? colors.textMuted
                            }
                            hasBorder={index < clientDetailSessions.length - 1}
                            noChevron
                          />
                        ))
                      ) : (
                        <FitText
                          style={{
                            color: colors.textMuted,
                            fontSize: 13,
                            padding: 14,
                          }}
                        >
                          No sessions found for this client.
                        </FitText>
                      )}
                    </View>
                  </View>
                ) : null}

                {clientDetailTab === "workout" && user?.id ? (
                  <CoachClientWorkoutPlan
                    coachUserId={user.id}
                    memberId={clientDetail.id}
                  />
                ) : null}

                {clientDetailTab === "feedback" ? (
                  <View style={{ gap: 14 }}>
                    <FitText
                      style={{
                        color: colors.brand,
                        fontSize: 13,
                        fontWeight: "900",
                      }}
                    >
                      CLIENT FEEDBACK
                    </FitText>
                    <FitText style={{ color: colors.textMuted, fontSize: 13 }}>
                      Save coach feedback and assessment notes for completed
                      sessions.
                    </FitText>
                    {completedClientSessions.length > 0 ? (
                      <>
                        <View style={{ gap: 8 }}>
                          <FitText
                            style={{
                              color: colors.textMuted,
                              fontSize: 11,
                              fontWeight: "900",
                            }}
                          >
                            COMPLETED SESSION
                          </FitText>
                          <View style={s.groupCards}>
                            {completedClientSessions.map((session, index) => (
                              <FitCard
                                key={session.id}
                                icon={CheckCircle2}
                                iconSize={18}
                                label={`${formatBookingDate(session.date)}, ${getSessionTimeLabel(session).split(" - ")[0]}`}
                                subtitle={
                                  session.sessionNotes ||
                                  session.description ||
                                  "No notes"
                                }
                                selected={
                                  selectedClientFeedbackAppointmentId ===
                                  session.id
                                }
                                hasBorder={
                                  index < completedClientSessions.length - 1
                                }
                                onPress={() =>
                                  setSelectedClientFeedbackAppointmentId(
                                    session.id,
                                  )
                                }
                              />
                            ))}
                          </View>
                        </View>
                        <View style={{ gap: 6 }}>
                          <FitText
                            style={{
                              color: colors.textMuted,
                              fontSize: 11,
                              fontWeight: "900",
                            }}
                          >
                            COACH FEEDBACK
                          </FitText>
                          <TextInput
                            value={clientCoachFeedback}
                            onChangeText={(value) => {
                              setClientCoachFeedback(value);
                              setClientFeedbackMessage(null);
                            }}
                            multiline
                            placeholder="Add client-facing coaching notes."
                            placeholderTextColor={colors.textMuted}
                            style={{
                              borderColor: colors.border,
                              borderRadius: 10,
                              borderWidth: 1,
                              color: colors.textPrimary,
                              fontSize: 13,
                              minHeight: 86,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              textAlignVertical: "top",
                            }}
                          />
                        </View>
                        <View style={{ gap: 6 }}>
                          <FitText
                            style={{
                              color: colors.textMuted,
                              fontSize: 11,
                              fontWeight: "900",
                            }}
                          >
                            ASSESSMENT REPORT
                          </FitText>
                          <TextInput
                            value={clientAssessmentReport}
                            onChangeText={(value) => {
                              setClientAssessmentReport(value);
                              setClientFeedbackMessage(null);
                            }}
                            multiline
                            placeholder="Add movement assessment or progress notes."
                            placeholderTextColor={colors.textMuted}
                            style={{
                              borderColor: colors.border,
                              borderRadius: 10,
                              borderWidth: 1,
                              color: colors.textPrimary,
                              fontSize: 13,
                              minHeight: 86,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              textAlignVertical: "top",
                            }}
                          />
                        </View>
                        {clientFeedbackMessage ? (
                          <FitText
                            style={{
                              color:
                                clientFeedbackMessage.tone === "success"
                                  ? colors.success
                                  : colors.danger,
                              fontSize: 12,
                              fontWeight: "700",
                            }}
                          >
                            {clientFeedbackMessage.text}
                          </FitText>
                        ) : null}
                        <Pressable
                          disabled={submitClientFeedbackMutation.isPending}
                          onPress={() => {
                            void handleSubmitClientFeedback();
                          }}
                          style={{
                            alignItems: "center",
                            backgroundColor: colors.brand,
                            borderRadius: 12,
                            justifyContent: "center",
                            minHeight: 46,
                            opacity: submitClientFeedbackMutation.isPending
                              ? 0.65
                              : 1,
                          }}
                        >
                          <FitText
                            style={{
                              color: colors.onBrand ?? "#FFFFFF",
                              fontSize: 12,
                              fontWeight: "900",
                            }}
                          >
                            {submitClientFeedbackMutation.isPending
                              ? "SAVING"
                              : "SAVE CLIENT FEEDBACK"}
                          </FitText>
                        </Pressable>
                      </>
                    ) : (
                      <FitText
                        style={{ color: colors.textMuted, fontSize: 13 }}
                      >
                        Feedback unlocks once this client has a completed
                        session.
                      </FitText>
                    )}
                    <View
                      style={{
                        backgroundColor: colors.border,
                        height: StyleSheet.hairlineWidth,
                      }}
                    />
                    <FitText
                      style={{
                        color: colors.textMuted,
                        fontSize: 12,
                        fontWeight: "900",
                      }}
                    >
                      FEEDBACK HISTORY
                    </FitText>
                    <View style={s.groupCards}>
                      {clientDetailSessions.length > 0 ? (
                        clientDetailSessions.map((session, index) => (
                          <FitCard
                            key={session.id}
                            icon={CheckCircle2}
                            iconSize={18}
                            label={formatBookingDate(session.date)}
                            subtitle={`Feedback: ${
                              session.coachFeedback || "Not added"
                            } | Assessment: ${
                              session.assessmentReport || "Not added"
                            }`}
                            trailingLabel={formatStatusLabel(session.status)}
                            trailingLabelColor={
                              STATUS_COLORS[session.status] ?? colors.textMuted
                            }
                            hasBorder={index < clientDetailSessions.length - 1}
                            noChevron
                          />
                        ))
                      ) : (
                        <FitText
                          style={{
                            color: colors.textMuted,
                            fontSize: 13,
                            padding: 14,
                          }}
                        >
                          No feedback history found.
                        </FitText>
                      )}
                    </View>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => setClientDetail(null)}
                  style={{
                    alignItems: "center",
                    borderColor: colors.brand,
                    borderRadius: 12,
                    borderWidth: 1,
                    minHeight: 44,
                    justifyContent: "center",
                  }}
                >
                  <FitText
                    style={{
                      color: colors.brand,
                      fontSize: 13,
                      fontWeight: "900",
                    }}
                  >
                    CLOSE
                  </FitText>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        visible={isMonthlyPlanOpen && clientDetail != null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isCreatingMonthlyPlan) setIsMonthlyPlanOpen(false);
        }}
      >
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.58)",
              justifyContent: "flex-end",
              padding: 12,
            },
          ]}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: 22,
              borderWidth: 1,
              maxHeight: "94%",
              width: "100%",
            }}
          >
            <ScrollView
              contentContainerStyle={{ gap: 14, padding: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              <View
                style={{
                  alignItems: "flex-start",
                  flexDirection: "row",
                  gap: 12,
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <FitText
                    style={{
                      color: colors.textPrimary,
                      fontSize: 20,
                      fontWeight: "900",
                    }}
                  >
                    Create monthly plan
                  </FitText>
                  <FitText style={{ color: colors.textMuted, fontSize: 13 }}>
                    {clientDetail?.name ?? "Client"} · actual appointment dates
                  </FitText>
                </View>
                <Pressable
                  disabled={isCreatingMonthlyPlan}
                  onPress={() => setIsMonthlyPlanOpen(false)}
                  style={{
                    alignItems: "center",
                    borderColor: colors.border,
                    borderRadius: 10,
                    borderWidth: 1,
                    height: 40,
                    justifyContent: "center",
                    width: 40,
                  }}
                >
                  <FitText
                    style={{
                      color: colors.textMuted,
                      fontSize: 18,
                      fontWeight: "800",
                    }}
                  >
                    ×
                  </FitText>
                </Pressable>
              </View>

              <FitText style={{ color: colors.textMuted, fontSize: 13 }}>
                You allocate the schedule after discussing goals and
                availability offline. The client sees this plan and pays the
                full quote through PayMongo before any session is confirmed.
              </FitText>

              <View style={{ gap: 8 }}>
                <FitText
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    fontWeight: "900",
                  }}
                >
                  COACH WORKOUT PLAN
                </FitText>
                {clientWorkoutPlansQuery.isPending ? (
                  <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                    Loading the client&apos;s coach plans...
                  </FitText>
                ) : clientCoachWorkoutPlans.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {clientCoachWorkoutPlans.map((plan) => {
                      const isSelected = plan.id === monthlyPlanTrainingPlanId;
                      return (
                        <Pressable
                          key={plan.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => {
                            setMonthlyPlanTrainingPlanId(plan.id);
                            setMonthlyPlanMessage(null);
                          }}
                          style={{
                            backgroundColor: isSelected
                              ? colors.warning + "18"
                              : colors.surfaceRaised,
                            borderColor: isSelected
                              ? colors.warning
                              : colors.border,
                            borderRadius: 10,
                            borderWidth: 1,
                            minHeight: 42,
                            justifyContent: "center",
                            paddingHorizontal: 12,
                          }}
                        >
                          <FitText
                            style={{
                              color: isSelected
                                ? colors.warning
                                : colors.textPrimary,
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            {plan.title}
                            {plan.isActive ? " · ACTIVE" : ""}
                          </FitText>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <FitText style={{ color: colors.danger, fontSize: 12 }}>
                    No coach-assigned workout plan is available for this client
                    yet.
                  </FitText>
                )}
              </View>

              <View style={{ gap: 6 }}>
                <FitText
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    fontWeight: "900",
                  }}
                >
                  FULL MONTHLY QUOTE (PHP)
                </FitText>
                <TextInput
                  value={monthlyPlanQuote}
                  editable={false}
                  keyboardType="decimal-pad"
                  placeholder="12000"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.border,
                    borderRadius: 10,
                    borderWidth: 1,
                    color: colors.textPrimary,
                    fontSize: 14,
                    fontWeight: "800",
                    minHeight: 46,
                    paddingHorizontal: 12,
                  }}
                />
                <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                  This comes from the active coach offer and is paid in full.
                </FitText>
              </View>

              <View style={{ gap: 10 }}>
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <FitText
                    style={{
                      color: colors.textMuted,
                      fontSize: 11,
                      fontWeight: "900",
                    }}
                  >
                    ACTUAL SESSION DATES ({monthlyPlanRows.length})
                  </FitText>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                      Max 5 per week
                    </FitText>
                    {lastMonthlyPlanForClient ? (
                      <Pressable
                        disabled={isCreatingMonthlyPlan}
                        onPress={handleRepeatLastMonthlySchedule}
                        hitSlop={8}
                      >
                        <FitText
                          style={{
                            color: colors.brand,
                            fontSize: 10,
                            fontWeight: "900",
                          }}
                        >
                          REPEAT LAST SCHEDULE
                        </FitText>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                {monthlyPlanRows.map((row, index) => (
                  <View
                    key={`monthly-plan-row-${index}`}
                    style={{
                      backgroundColor: colors.surfaceRaised,
                      borderColor: colors.border,
                      borderRadius: 14,
                      borderWidth: 1,
                      gap: 10,
                      padding: 12,
                    }}
                  >
                    <View
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <FitText
                        style={{
                          color: colors.brand,
                          fontSize: 12,
                          fontWeight: "900",
                        }}
                      >
                        SESSION {index + 1}
                      </FitText>
                      {monthlyPlanRows.length > 1 ? (
                        <Pressable
                          onPress={() => handleRemoveMonthlyPlanRow(index)}
                          hitSlop={8}
                        >
                          <FitText
                            style={{
                              color: colors.danger,
                              fontSize: 11,
                              fontWeight: "900",
                            }}
                          >
                            REMOVE
                          </FitText>
                        </Pressable>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => setMonthlyPlanCalendarRowIndex(index)}
                      style={{
                        borderColor: colors.border,
                        borderRadius: 10,
                        borderWidth: 1,
                        justifyContent: "center",
                        minHeight: 44,
                        paddingHorizontal: 12,
                      }}
                    >
                      <FitText
                        style={{
                          color: colors.textPrimary,
                          fontSize: 13,
                          fontWeight: "700",
                        }}
                      >
                        {formatBookingDate(row.date)}
                      </FitText>
                    </Pressable>
                    <TextInput
                      value={row.time}
                      onChangeText={(value) =>
                        updateMonthlyPlanRow(index, { time: value })
                      }
                      placeholder="17:00"
                      placeholderTextColor={colors.textMuted}
                      style={{
                        borderColor: colors.border,
                        borderRadius: 10,
                        borderWidth: 1,
                        color: colors.textPrimary,
                        fontSize: 13,
                        fontWeight: "700",
                        minHeight: 44,
                        paddingHorizontal: 12,
                      }}
                    />
                    <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                      {monthlyOfferDefaults.durationMinutes} minutes · fixed by
                      the coach offer
                    </FitText>
                  </View>
                ))}
                {monthlyPlanRows.length < 60 ? (
                  <Pressable
                    onPress={handleAddMonthlyPlanRow}
                    style={{
                      alignItems: "center",
                      borderColor: colors.brand,
                      borderRadius: 10,
                      borderWidth: 1,
                      minHeight: 44,
                      justifyContent: "center",
                    }}
                  >
                    <FitText
                      style={{
                        color: colors.brand,
                        fontSize: 12,
                        fontWeight: "900",
                      }}
                    >
                      + ADD SESSION DATE
                    </FitText>
                  </Pressable>
                ) : null}
              </View>

              {monthlyPlanMessage ? (
                <FitText
                  style={{
                    color:
                      monthlyPlanMessage.tone === "success"
                        ? colors.success
                        : colors.danger,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {monthlyPlanMessage.text}
                </FitText>
              ) : null}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <FitButton
                  disabled={isCreatingMonthlyPlan}
                  flex={1}
                  label="Cancel"
                  onPress={() => setIsMonthlyPlanOpen(false)}
                  variant="ghost"
                />
                <FitButton
                  disabled={
                    isCreatingMonthlyPlan ||
                    !monthlyOfferDefaults.isConfigured ||
                    !selectedClientWorkoutPlan
                  }
                  flex={1}
                  label="Create plan"
                  loading={isCreatingMonthlyPlan}
                  loadingLabel="CREATING"
                  onPress={() => void handleCreateMonthlyPlan()}
                  variant="primary"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={reviewTarget != null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseCoachReview}
      >
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "center",
              padding: 20,
            },
          ]}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: 24,
              borderWidth: 1,
              gap: 14,
              padding: 20,
              width: "100%",
            }}
          >
            <View style={{ gap: 4 }}>
              <FitText
                style={{
                  color: colors.textPrimary,
                  fontSize: 18,
                  fontWeight: "800",
                }}
              >
                Leave feedback for your coach
              </FitText>
              <FitText style={{ color: colors.textMuted, fontSize: 13 }}>
                {reviewTarget
                  ? `${reviewTarget.resourceName} | ${formatBookingDate(reviewTarget.date)}`
                  : "Completed coaching session"}
              </FitText>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <Pressable
                  key={rating}
                  onPress={() => setReviewRating(rating)}
                  hitSlop={8}
                  style={{
                    alignItems: "center",
                    backgroundColor: colors.surfaceRaised,
                    borderColor:
                      rating <= reviewRating ? colors.warning : colors.border,
                    borderRadius: 14,
                    borderWidth: 1,
                    height: 44,
                    justifyContent: "center",
                    width: 44,
                  }}
                >
                  <Star
                    size={20}
                    color={
                      rating <= reviewRating ? colors.warning : colors.textMuted
                    }
                    fill={rating <= reviewRating ? colors.warning : "none"}
                    strokeWidth={2}
                  />
                </Pressable>
              ))}
            </View>

            <TextInput
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Optional written review"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={{
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                borderRadius: 16,
                borderWidth: 1,
                color: colors.textPrimary,
                minHeight: 112,
                padding: 14,
              }}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <FitButton
                label="Cancel"
                variant="ghost"
                flex={1}
                onPress={handleCloseCoachReview}
                disabled={submitCoachReviewMutation.isPending}
              />
              <FitButton
                label="Submit"
                variant="primary"
                flex={1}
                onPress={() => void handleSubmitCoachReview()}
                loading={submitCoachReviewMutation.isPending}
                loadingLabel="SUBMITTING"
              />
            </View>
          </View>
        </View>
      </Modal>
      <ConfirmModal
        isVisible={pendingAppointmentPayment != null}
        title="Continue to PayMongo?"
        message={
          pendingAppointmentPayment
            ? `Pay PHP ${Number(
                pendingAppointmentPayment.booking.totalAmount ??
                  pendingAppointmentPayment.booking.amountDueNow ??
                  0,
              ).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} in full through PayMongo. The booking is confirmed only after FitTrack receives the successful payment.\n\nCancellation and refund policy: ${FITTRACK_PAYMENT_POLICY_SUMMARY}`
            : ""
        }
        yesLabel={FITTRACK_PAYMENT_ACCEPTANCE_LABEL}
        noLabel="Cancel"
        isLoading={payAppointmentMutation.isPending}
        loadingLabel="CONFIRMING PAYMENT"
        loadingTitle="Confirming payment"
        onNo={() => {
          if (payAppointmentMutation.isPending) return;
          setPendingAppointmentPayment(null);
        }}
        onYes={() => {
          if (!pendingAppointmentPayment) return;
          void handleSubmitAppointmentPayment(pendingAppointmentPayment);
        }}
      />
      <NoticeModal
        isVisible={paymentConfirmation != null}
        title={paymentConfirmation?.title ?? "Payment updated"}
        message={paymentConfirmation?.message ?? ""}
        buttonLabel="Stay in Bookings"
        onClose={() => setPaymentConfirmation(null)}
      />
      <ConfirmModal
        isVisible={pendingCancellation != null}
        title={
          pendingCancellation?.type === "appointment"
            ? "Cancel appointment?"
            : "Cancel reservation?"
        }
        message={
          pendingCancellation
            ? `Are you sure you want to cancel ${pendingCancellation.booking.resourceName} on ${formatBookingDate(
                pendingCancellation.booking.date,
              )}? This action will submit a cancellation request immediately.`
            : ""
        }
        yesLabel="Confirm Cancel"
        noLabel="Go Back"
        isDestructive
        isLoading={isCancelling}
        loadingLabel="CANCELLING"
        loadingTitle="Cancelling"
        onNo={() => {
          if (isCancelling) return;
          setPendingCancellation(null);
        }}
        onYes={() => {
          if (!pendingCancellation) return;
          if (pendingCancellation.type === "appointment") {
            void executeCancelAppointment(pendingCancellation.booking);
            return;
          }
          void executeCancelReservation(pendingCancellation.booking);
        }}
      />
      <ConfirmModal
        isVisible={pendingCoachAction != null}
        title={
          pendingCoachAction?.action === "confirm"
            ? "Confirm session?"
            : pendingCoachAction?.action === "complete"
              ? "Complete session?"
              : "Decline session?"
        }
        message={
          pendingCoachAction
            ? `${formatStatusLabel(pendingCoachAction.action)} ${
                pendingCoachAction.booking.resourceName
              } on ${formatBookingDate(
                pendingCoachAction.booking.date,
              )}? This updates the coach session immediately.`
            : ""
        }
        yesLabel={
          pendingCoachAction?.action === "confirm"
            ? "Confirm"
            : pendingCoachAction?.action === "complete"
              ? "Complete"
              : "Decline"
        }
        noLabel="Go Back"
        isDestructive={pendingCoachAction?.action === "decline"}
        isLoading={coachActionLoading}
        loadingLabel={coachActionLoadingLabel}
        loadingTitle="Updating session"
        onNo={() => {
          if (coachActionLoading) return;
          setPendingCoachAction(null);
        }}
        onYes={() => {
          void executeCoachAction();
        }}
      />
      {isUserRole ? (
        <AppointmentModal
          isVisible={isAppointmentOpen}
          onClose={() => setIsAppointmentOpen(false)}
          onMonthlySubmit={async ({ coachId }) => {
            const enrollment =
              await mobileApiClient.recurringCoachingPlans.enroll({ coachId });
            await recurringPlansQuery.refetch();
            const billingCycle = enrollment.plan.billingCycles?.[0];

            if (!billingCycle) {
              return {
                errorMessage:
                  "PayMongo payment is currently unavailable. Your monthly plan was not activated. Please try again.",
              };
            }

            try {
              const payment =
                await mobileApiClient.recurringCoachingPlans.payBillingCycle(
                  enrollment.plan.id,
                  billingCycle.id,
                  { provider: "paymongo" },
                );
              await recurringPlansQuery.refetch();
              return { checkoutUrl: payment.checkoutUrl };
            } catch {
              return {
                errorMessage:
                  "PayMongo payment is currently unavailable. Your monthly plan was saved but not activated. Retry payment from Bookings.",
              };
            }
          }}
          onSuccess={() => {
            setIsAppointmentOpen(false);
            setActiveSection("appointments");
          }}
        />
      ) : null}
      <CalendarModal
        isVisible={monthlyPlanCalendarRowIndex != null}
        selectedDate={
          monthlyPlanCalendarRowIndex != null
            ? (monthlyPlanRows[monthlyPlanCalendarRowIndex]?.date ?? "")
            : ""
        }
        minDate={getTodayString()}
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        onSelect={(date) => {
          if (monthlyPlanCalendarRowIndex == null) return;
          updateMonthlyPlanRow(monthlyPlanCalendarRowIndex, { date });
          setMonthlyPlanCalendarRowIndex(null);
        }}
        onClose={() => setMonthlyPlanCalendarRowIndex(null)}
      />
      <CalendarModal
        isVisible={isClientScheduleCalendarOpen}
        selectedDate={clientScheduleDate}
        minDate={getTodayString()}
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        onSelect={(date) => {
          setClientScheduleDate(date);
          setClientScheduleMessage(null);
          setIsClientScheduleCalendarOpen(false);
        }}
        onClose={() => setIsClientScheduleCalendarOpen(false)}
      />
      <CalendarModal
        isVisible={isStartCalOpen}
        selectedDate={startDate}
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        onSelect={handleStartDateSelect}
        onClose={() => setIsStartCalOpen(false)}
      />
      <CalendarModal
        isVisible={isEndCalOpen}
        selectedDate=""
        allowEmpty
        minDate={startDate ? nextDate(startDate) : nextDate(getTodayString())}
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        onSelect={handleEndDateSelect}
        onClose={() => setIsEndCalOpen(false)}
      />
    </View>
  );
}
