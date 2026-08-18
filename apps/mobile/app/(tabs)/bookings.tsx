import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import type {
  AppointmentRecord,
  AppointmentAvailabilitySlot,
  CoachAppointmentScheduleRecord,
  SubmitCoachAppointmentFeedbackPayload,
  VenueBookingRecord,
  RecurringCoachingPlanRecord,
} from "@fittrack/api-client";
import type { CoachProfileRecord } from "@fittrack/types";

import {
  appointmentsQueryOptions,
  appointmentAvailabilityQueryOptions,
  bookingsQueryOptions,
  cancelAppointmentMutationOptions,
  cancelBookingMutationOptions,
  cancelCoachVenueWorkMutationOptions,
  coachClientsQueryOptions,
  coachSelfProfileQueryOptions,
  coachScheduleQueryOptions,
  coachVenueWorkQueryOptions,
  completeCoachAppointmentMutationOptions,
  completeCoachVenueWorkMutationOptions,
  invalidateCoachScheduleQueries,
  noShowCoachVenueWorkMutationOptions,
  rescheduleAppointmentMutationOptions,
  submitCoachReviewMutationOptions,
  venuesQueryOptions,
  recurringCoachingPlansQueryOptions,
} from "@fittrack/query";
import { normalizeBookingStatus } from "@fittrack/app-core";
import {
  formatBookingDate,
  formatGroupLabel,
  groupItemsByDate,
  isUpcomingCoachSession,
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
import { resolveCheckoutReturnInput } from "@/hooks/commerce/useCommerceCheckoutReturn";
import { toMobileBookings } from "@/utils/venueBookings";
import { CoachClientPaidSchedule } from "@/components/bookings/CoachClientPaidSchedule";
import { CoachClientWorkoutPrograms } from "@/components/bookings/CoachClientWorkoutPrograms";
import { areCoachClientDetailsEquivalent } from "@/components/bookings/coachClientDetailSync";
import type { CoachWorkoutPlanTransition } from "@/components/bookings/coachClientWorkoutPublish";
import { hasPaidOneSessionProgramEntitlement } from "@/components/bookings/coachClientWorkoutPublish";

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
  TimeSlotModal,
  type DetailBooking,
  type TimeSlot,
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
const BOOKINGS_PAGE_SIZE = 10;

type BookingSection = "bookings" | "appointments" | "clients" | "earnings";
type CoachSection = Extract<
  BookingSection,
  "clients" | "appointments" | "earnings"
>;
type CoachClientDetailTab = (typeof COACH_CLIENT_DETAIL_TABS)[number]["value"];
type CoachClientFormMessage = { tone: "error" | "success"; text: string };
type CoachClientSummary = {
  completedCount: number;
  email: string;
  id: string;
  lastSession?: DetailBooking;
  name: string;
  nextSession?: DetailBooking;
  readinessColor: string;
  readinessLabel: string;
  sessions: DetailBooking[];
  sessionCount: number;
};
type PaymentConfirmationState = {
  message: string;
  title: string;
};
type PendingCancellation = {
  booking: DetailBooking;
  type: "appointment" | "reservation" | "venue_work";
};
type PendingCoachAction = {
  action: "complete" | "no_show";
  booking: DetailBooking;
  workType: "appointment" | "venue_work";
};
type MobileBookingReturnFlow =
  | "coach-single"
  | "coach-monthly"
  | "venue-booking";
type CheckoutReturnFlow =
  | MobileBookingReturnFlow
  | "membership-card"
  | "membership-subscription";

const BOOKING_RETURN_FLOWS: ReadonlySet<MobileBookingReturnFlow> = new Set([
  "coach-single",
  "coach-monthly",
  "venue-booking",
]);

function parseCheckoutReturnFlow(
  value?: string | string[],
): CheckoutReturnFlow | null {
  const valueString = Array.isArray(value) ? value[0] : value;
  if (
    valueString === "coach-single" ||
    valueString === "coach-monthly" ||
    valueString === "venue-booking" ||
    valueString === "membership-card" ||
    valueString === "membership-subscription"
  ) {
    return valueString;
  }
  return null;
}

function toHourMinuteIndex(value?: string) {
  const normalized = (value ?? "").trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;
  return hour * 60 + minute;
}

function parseStartMinute(booking: DetailBooking) {
  return toHourMinuteIndex(
    booking.startTime || booking.time?.split(" - ")[0]?.trim(),
  );
}

function formatStatusLabel(status: string) {
  const explicitLabels: Record<string, string> = {
    cancelled: "Cancelled",
    completed: "Completed",
    confirmed: "Confirmed",
    no_show: "No show",
  };

  if (explicitLabels[status]) {
    return explicitLabels[status];
  }

  return "Unavailable";
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

function getVenueBookingMemberName(
  booking: Pick<VenueBookingRecord, "user" | "userId">,
) {
  const firstName = booking.user?.profile?.firstName?.trim() ?? "";
  const lastName = booking.user?.profile?.lastName?.trim() ?? "";
  const profileName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return (
    profileName ||
    booking.user?.email?.trim() ||
    booking.userId ||
    "Member"
  );
}

function formatGymTime(isoValue: string) {
  const gymDate = new Date(new Date(isoValue).getTime() + 8 * 60 * 60 * 1000);
  const hour24 = gymDate.getUTCHours();
  const minute = String(gymDate.getUTCMinutes()).padStart(2, "0");
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute} ${period}`;
}

function toGymDateTimeRange(
  startIso: string,
  durationMinutes: number,
  explicitEnd?: string,
) {
  const start = new Date(startIso);
  const endIso =
    explicitEnd ??
    new Date(start.getTime() + durationMinutes * 60_000).toISOString();
  const gymDate = new Date(start.getTime() + 8 * 60 * 60 * 1000);
  return {
    date: `${gymDate.getUTCFullYear()}-${String(gymDate.getUTCMonth() + 1).padStart(2, "0")}-${String(gymDate.getUTCDate()).padStart(2, "0")}`,
    endLabel: formatGymTime(endIso),
    startLabel: formatGymTime(startIso),
  };
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
  appointment: Pick<CoachAppointmentScheduleRecord, "status">,
) {
  const validStatuses = new Set([
    "cancelled",
    "completed",
    "confirmed",
    "no_show",
  ]);
  return validStatuses.has(appointment.status ?? "")
    ? normalizeBookingStatus(appointment.status ?? "")
    : "unavailable";
}

function isMemberVisibleBooking(status: string) {
  return new Set([
    "cancelled",
    "completed",
    "confirmed",
    "no_show",
  ]).has(status);
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
    status === "completed" || status === "no_show"
  );
}

function getSessionTimeLabel(session: DetailBooking) {
  return session.startTime && session.endTime
    ? `${session.startTime} - ${session.endTime}`
    : session.time;
}

function getCoachFormErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function RecurringPlanMobilePanel({
  error,
  isLoading,
  plans,
}: {
  error: string | null;
  isLoading: boolean;
  plans: RecurringCoachingPlanRecord[];
}) {
  const { colors } = useTheme();
  const plan = plans.find(
    (item) =>
      item.status === "active" &&
      item.billingCycles?.some((cycle) => cycle.status === "paid"),
  );
  if (!isLoading && !error && !plan) return null;
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
        Paid monthly coaching
      </FitText>
      <FitText
        style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}
      >
        Your paid plan is active. Your coach can allocate sessions and your
        workout program from the coach workspace.
      </FitText>
      {isLoading ? (
        <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
          Loading monthly coaching…
        </FitText>
      ) : null}
      {error ? (
        <FitText style={{ color: colors.warning, fontSize: 12 }}>
          {error}
        </FitText>
      ) : null}
      {plan ? (
        <>
          <FitCard
            icon={CalendarCheck}
            iconSize={18}
            label={
              plan.frequency === "monthly"
                ? "Monthly coaching"
                : "Recurring coaching"
            }
            subtitle="Paid and active · Sessions are allocated by your coach."
            trailingLabel="Active"
            trailingLabelColor={colors.brand}
            noChevron
          />
        </>
      ) : null}
    </View>
  );
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
    checkout_result?: string | string[];
    hold_id?: string | string[];
    checkout_flow?: string | string[];
  }>();
  const isFrozen = user?.status === "frozen";
  const queryClient = useQueryClient();
  const checkoutHoldHandledRef = useRef<string | null>(null);
  const checkoutResult = getSearchParamValue(params.checkout_result);
  const checkoutHoldId = getSearchParamValue(params.hold_id);
  const checkoutFlow = parseCheckoutReturnFlow(params.checkout_flow);
  const isBookingCheckoutFlow =
    checkoutFlow !== null && BOOKING_RETURN_FLOWS.has(checkoutFlow);

  const recurringPlansQuery = useQuery({
    ...recurringCoachingPlansQueryOptions(mobileApiClient),
    enabled: isFocused && !!user?.id && (isUserRole || isCoachRole),
    staleTime: 20_000,
    gcTime: 300_000,
  });
  const coachSelfProfileQuery = useQuery({
    ...coachSelfProfileQueryOptions<CoachProfileRecord>(
      mobileApiClient,
      user?.id,
    ),
    enabled: isFocused && !!user?.id && isCoachRole,
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const currentCoachProfileId = coachSelfProfileQuery.data?.id ?? "";

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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
  const [checkoutResultNotice, setCheckoutResultNotice] =
    useState<PaymentConfirmationState | null>(null);
  const lastMonthlyPlanForClient =
    useMemo<RecurringCoachingPlanRecord | null>(() => {
      if (!clientDetail?.id) return null;

      const candidates = (recurringPlansQuery.data ?? []).filter(
        (plan) =>
          plan.frequency === "monthly" &&
          plan.status === "active" &&
          plan.billingCycles?.some((cycle) => cycle.status === "paid") &&
          plan.memberId === clientDetail.id &&
          plan.coachId === currentCoachProfileId,
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
    }, [clientDetail?.id, currentCoachProfileId, recurringPlansQuery.data]);
  const [pendingCancellation, setPendingCancellation] =
    useState<PendingCancellation | null>(null);
  const [cancellationFailure, setCancellationFailure] =
    useState<PaymentConfirmationState | null>(null);
  const [pendingCoachAction, setPendingCoachAction] =
    useState<PendingCoachAction | null>(null);
  const [coachActionFailure, setCoachActionFailure] =
    useState<PaymentConfirmationState | null>(null);
  const [rescheduleBooking, setRescheduleBooking] =
    useState<DetailBooking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [isRescheduleCalendarOpen, setIsRescheduleCalendarOpen] =
    useState(false);
  const [isRescheduleTimeOpen, setIsRescheduleTimeOpen] = useState(false);
  const [rescheduleFailure, setRescheduleFailure] =
    useState<PaymentConfirmationState | null>(null);
  const [reviewTarget, setReviewTarget] = useState<DetailBooking | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [
    selectedClientFeedbackAppointmentId,
    setSelectedClientFeedbackAppointmentId,
  ] = useState("");
  const [clientCoachFeedback, setClientCoachFeedback] = useState("");
  const [clientAssessmentReport, setClientAssessmentReport] = useState("");
  const [clientFeedbackMessage, setClientFeedbackMessage] =
    useState<CoachClientFormMessage | null>(null);
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
  const {
    data: coachVenueWorkResponse,
    isLoading: coachVenueWorkLoading,
    error: coachVenueWorkError,
    refetch: refetchCoachVenueWork,
  } = useQuery({
    ...coachVenueWorkQueryOptions(mobileApiClient, user?.id, {
      limit: 100,
      page: 1,
    }),
    enabled: isFocused && !!user?.id && isCoachRole,
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const coachVenueWorkRaw = useMemo(
    () => coachVenueWorkResponse?.data ?? [],
    [coachVenueWorkResponse?.data],
  );
  const appointmentAvailabilityQuery = useQuery({
    ...appointmentAvailabilityQueryOptions(
      mobileApiClient,
      rescheduleBooking?.coachId,
      rescheduleDate,
      rescheduleBooking?.durationMinutes,
    ),
    enabled: Boolean(
      isFocused &&
        isCoachRole &&
        rescheduleBooking?.bookingType === "single" &&
        rescheduleBooking.coachId &&
        rescheduleDate &&
        rescheduleBooking.durationMinutes,
    ),
  });
  const hasActivePaidOneSession = useMemo(
    () =>
      Boolean(
        clientDetail?.id &&
          currentCoachProfileId &&
          (hasPaidOneSessionProgramEntitlement(
            coachScheduleRaw,
            clientDetail.id,
            currentCoachProfileId,
          ) ||
            coachVenueWorkRaw.some(
              (booking) =>
                (booking.userId ?? booking.user?.id) === clientDetail.id &&
                booking.coachId === currentCoachProfileId &&
                ["confirmed", "completed"].includes(
                  normalizeBookingStatus(booking.status),
                ),
            )),
      ),
    [clientDetail?.id, coachScheduleRaw, coachVenueWorkRaw, currentCoachProfileId],
  );
  const {
    data: coachClientsResponse,
    isLoading: coachClientsLoading,
    error: coachClientsError,
    refetch: refetchCoachClients,
  } = useQuery({
    ...coachClientsQueryOptions(mobileApiClient, { limit: 100, page: 1 }),
    enabled: isFocused && !!user?.id && isCoachRole,
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const coachClientsRaw = useMemo(
    () => coachClientsResponse?.data ?? [],
    [coachClientsResponse?.data],
  );

  const reservations = useMemo<DetailBooking[]>(
    () =>
      toMobileBookings(apiBookings, venues)
        .filter((booking) => isMemberVisibleBooking(booking.status))
        .map((booking) => ({
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
      appointmentsRaw
        .filter((appointment) =>
          isMemberVisibleBooking(appointment.status ?? ""),
        )
        .map((appointment) => {
        const { startLabel, endLabel, date } = toGymDateTimeRange(
          appointment.scheduledAt,
          appointment.duration,
        );
        const standaloneName = appointment.coach?.displayName?.trim();
        const coachName =
          standaloneName && !standaloneName.includes("@")
            ? standaloneName
            : "Coach Session";
          const normalizedStatus = normalizeBookingStatus(appointment.status);
        return {
          assessmentReport: appointment.assessmentReport,
          bookingType: appointment.recurringPlanId ? "recurring" : "single",
          coachFeedback: appointment.coachFeedback,
          coachId: appointment.coachId,
          coachReviewComment: appointment.review?.comment ?? null,
          coachReviewRating: appointment.review?.rating ?? null,
          id: appointment.id,
          durationMinutes: appointment.duration,
          paymentProvider: appointment.activePaymentProvider,
          recurringPlanId: appointment.recurringPlanId ?? null,
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
  const paidRecurringPlanIds = useMemo(
    () =>
      new Set(
        (recurringPlansQuery.data ?? [])
          .filter((plan) =>
            plan.billingCycles?.some((cycle) => cycle.status === "paid"),
          )
          .map((plan) => plan.id),
      ),
    [recurringPlansQuery.data],
  );
  const coachAppointments = useMemo<DetailBooking[]>(
    () =>
      coachScheduleRaw
        .filter((appointment) => {
          const normalizedStatus = getNormalizedCoachAppointmentStatus(appointment);
          const isPaid =
            appointment.activePaymentStatus === "completed" ||
            Boolean(
              appointment.recurringPlanId &&
                paidRecurringPlanIds.has(appointment.recurringPlanId),
            );
          return normalizedStatus !== "unavailable" && isPaid;
        })
        .map((appointment) => {
          const { startLabel, endLabel, date } = toGymDateTimeRange(
            appointment.scheduledAt,
            appointment.duration,
          );
          const memberName = getAppointmentMemberName(appointment);
          const normalizedStatus =
            getNormalizedCoachAppointmentStatus(appointment);

          return {
            assessmentReport: appointment.assessmentReport,
            bookingType: appointment.recurringPlanId ? "recurring" : "single",
            coachEarnings: Number(appointment.coachEarnings ?? 0),
            coachFeedback: appointment.coachFeedback,
            coachId: appointment.coachId ?? user?.id,
            coachReviewComment: appointment.review?.comment ?? null,
            coachReviewRating: appointment.review?.rating ?? null,
            description: appointment.notes ?? undefined,
            durationMinutes: appointment.duration,
            id: appointment.id,
            memberId: appointment.userId,
            paymentProvider: appointment.activePaymentProvider,
            recurringPlanId: appointment.recurringPlanId ?? null,
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
              ? `${memberName} / Monthly coaching`
              : memberName,
            totalAmount: appointment.totalAmount ?? undefined,
          };
        }),
    [coachScheduleRaw, paidRecurringPlanIds, user?.id],
  );
  const coachVenueWork = useMemo<DetailBooking[]>(
    () =>
      coachVenueWorkRaw
        .filter((booking) =>
          new Set(["confirmed", "completed", "no_show", "cancelled"]).has(
            normalizeBookingStatus(booking.status),
          ),
        )
        .map((booking) => {
          const { startLabel, endLabel, date } = toGymDateTimeRange(
            booking.startTime,
            booking.durationHours * 60,
            booking.endTime,
          );
          const memberName = getVenueBookingMemberName(booking);
          const memberId = booking.userId ?? booking.user?.id;
          const venueName = booking.venue?.name?.trim() || "Venue coaching";
          const normalizedStatus = normalizeBookingStatus(booking.status);
          return {
            bookingType: "venue_coach",
            coachEarnings: Number(booking.coachAmount ?? 0),
            coachId: booking.coachId ?? user?.id,
            description: booking.purpose ?? undefined,
            detailSubtitle: `${venueName} / ${memberName}`,
            detailTitle: "Venue Coaching Work",
            durationMinutes: booking.durationHours * 60,
            endTime: endLabel,
            id: booking.id,
            memberId,
            participantLabel: "Member",
            participantName: memberName,
            price: Number(booking.totalAmount ?? booking.coachAmount ?? 0),
            resourceId: memberId,
            resourceName: memberName,
            startTime: startLabel,
            status: normalizedStatus,
            time: `${startLabel} - ${endLabel}`,
            date,
            totalAmount: booking.totalAmount ?? undefined,
            venueId: String(booking.venueId),
          };
        }),
    [coachVenueWorkRaw, user?.id],
  );
  const displayAppointments = useMemo(
    () =>
      isCoachRole ? [...coachAppointments, ...coachVenueWork] : appointments,
    [appointments, coachAppointments, coachVenueWork, isCoachRole],
  );

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
                id: `${appointment.id}:checkout`,
                label:
                  appointment.paymentProvider === "cash"
                    ? "Cash payment registered"
                    : appointment.paymentProvider === "paymongo"
                      ? "PayMongo payment confirmed"
                      : "Full payment confirmed",
                meta: "This booking became active only after full payment.",
                status: "confirmed",
                tone: STATUS_COLORS.confirmed,
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
    coachVenueWorkRaw.forEach((booking) => {
      earningsById.set(booking.id, Number(booking.coachAmount ?? 0));
    });
    return earningsById;
  }, [coachScheduleRaw, coachVenueWorkRaw]);

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
        ? coachScheduleLoading ||
          coachVenueWorkLoading ||
          coachClientsLoading ||
          recurringPlansQuery.isPending
        : appointmentsLoading;
  const errorText = useMemo(() => {
    if (activeSection === "bookings" && (venuesError || bookingsError))
      return "Unable to load reservations.";
    if (
      isCoachRole &&
      (activeSection === "appointments" ||
        activeSection === "clients" ||
        activeSection === "earnings") &&
      (coachScheduleError || coachVenueWorkError || coachClientsError)
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
    coachClientsError,
    coachVenueWorkError,
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
    void refetchCoachVenueWork();
    void refetchCoachClients();
  }, [
    bookingRefreshTick,
    isCoachRole,
    isFocused,
    refetchCoachSchedule,
    refetchCoachVenueWork,
    refetchCoachClients,
    user?.id,
  ]);

  const clearCheckoutReturnParams = useCallback(() => {
    const nextParams: Record<string, string> = {};
    const coachView = getSearchParamValue(params.coachView);
    if (coachView) nextParams.coachView = coachView;
    if (params.openReservation === "true") nextParams.openReservation = "true";

    router.replace({
      pathname: "/(tabs)/bookings",
      params: nextParams,
    });
  }, [params.coachView, params.openReservation, router]);

  useEffect(() => {
    if (!isFocused || !isUserRole || checkoutResult !== "success") return;
    if (!checkoutHoldId || !checkoutFlow || !isBookingCheckoutFlow) {
      return;
    }
    if (checkoutHoldHandledRef.current === checkoutHoldId) return;
    checkoutHoldHandledRef.current = checkoutHoldId;

    const handleCheckoutReturn = async () => {
      if (checkoutResult !== "success") return;
      if (checkoutFlow === "coach-monthly") {
        try {
          const attempt =
            await mobileApiClient.commerceCheckout.reconcileHold(checkoutHoldId);
          await Promise.all([
            recurringPlansQuery.refetch(),
            refetchAppointments(),
          ]);
          if (attempt.state === "succeeded") {
            setCheckoutResultNotice({
              title: "Checkout completed",
              message: "PayMongo confirmed your booking. Your monthly coaching is now active.",
            });
          } else {
            setCheckoutResultNotice({
              title: "Checkout still processing",
              message: "Payment is still being processed. Your bookings will update when backend confirms.",
            });
          }
        } catch {
          setCheckoutResultNotice({
            title: "Checkout verification failed",
            message:
              "We could not verify this payment yet. Your booking list will stay in source-of-truth mode.",
          });
        } finally {
          clearCheckoutReturnParams();
        }
        return;
      }

      if (checkoutFlow === "coach-single") {
        try {
          const attempt =
            await mobileApiClient.commerceCheckout.reconcileHold(checkoutHoldId);
          await refetchAppointments();
          if (attempt.state === "succeeded") {
            setCheckoutResultNotice({
              title: "Checkout completed",
              message: "PayMongo confirmed your booking. Your session is now booked.",
            });
          } else {
            setCheckoutResultNotice({
              title: "Checkout still processing",
              message: "Payment is still being processed. Your bookings will update when backend confirms.",
            });
          }
        } catch {
          setCheckoutResultNotice({
            title: "Checkout verification failed",
            message:
              "We could not verify this payment yet. Your booking list will stay in source-of-truth mode.",
          });
        } finally {
          clearCheckoutReturnParams();
        }
        return;
      }

      if (checkoutFlow === "venue-booking") {
        try {
          const attempt =
            await mobileApiClient.commerceCheckout.reconcileHold(checkoutHoldId);
          await refetch();
          if (attempt.state === "succeeded") {
            setCheckoutResultNotice({
              title: "Checkout completed",
              message:
                "PayMongo confirmed your reservation. It will appear when the booking updates.",
            });
          } else {
            setCheckoutResultNotice({
              title: "Checkout still processing",
              message: "Payment is still being processed. Your reservations will update when backend confirms.",
            });
          }
        } catch {
          setCheckoutResultNotice({
            title: "Checkout verification failed",
            message:
              "We could not verify this payment yet. Your reservation list will stay in source-of-truth mode.",
          });
        } finally {
          clearCheckoutReturnParams();
        }
      }
    };

    void handleCheckoutReturn();
  }, [
    clearCheckoutReturnParams,
    checkoutFlow,
    checkoutHoldId,
    checkoutResult,
    recurringPlansQuery.refetch,
    isFocused,
    isUserRole,
    refetch,
    refetchAppointments,
  ]);

  useEffect(() => {
    if (!isFocused || !isUserRole || checkoutResult !== "cancel") return;
    if (!checkoutHoldId || !checkoutFlow || !isBookingCheckoutFlow) {
      return;
    }
    if (checkoutHoldHandledRef.current === `${checkoutHoldId}:cancel`) return;
    checkoutHoldHandledRef.current = `${checkoutHoldId}:cancel`;

    clearCheckoutReturnParams();
    setCheckoutResultNotice({
      title: "Checkout cancelled",
      message: "The payment was not completed. Your booking remains unchanged.",
    });
  }, [
    checkoutFlow,
    checkoutHoldId,
    checkoutResult,
    clearCheckoutReturnParams,
    isFocused,
    isUserRole,
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
  const submitCoachReviewMutation = useMutation(
    submitCoachReviewMutationOptions(mobileApiClient, queryClient),
  );
  const completeCoachAppointmentMutation = useMutation(
    completeCoachAppointmentMutationOptions(mobileApiClient, queryClient),
  );
  const completeCoachVenueWorkMutation = useMutation(
    completeCoachVenueWorkMutationOptions(mobileApiClient, queryClient),
  );
  const cancelCoachVenueWorkMutation = useMutation(
    cancelCoachVenueWorkMutationOptions(mobileApiClient, queryClient),
  );
  const noShowCoachVenueWorkMutation = useMutation(
    noShowCoachVenueWorkMutationOptions(mobileApiClient, queryClient),
  );
  const rescheduleAppointmentMutation = useMutation(
    rescheduleAppointmentMutationOptions(mobileApiClient, queryClient),
  );
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
    completeCoachAppointmentMutation.isPending ||
    completeCoachVenueWorkMutation.isPending ||
    noShowCoachVenueWorkMutation.isPending;

  const cancellingReservationLabel = useLoadingText(
    "CANCELLING",
    cancelBookingMutation.isPending,
  );
  const cancellingAppointmentLabel = useLoadingText(
    "CANCELLING",
    cancelAppointmentMutation.isPending,
  );
  const coachActionLoadingLabel = useLoadingText(
    "UPDATING",
    coachActionLoading,
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
      } catch {
        setPendingCancellation(null);
        setCancellationFailure({
          title: "Cancellation unavailable",
          message:
            "We couldn't cancel this reservation. Your booking and payment status have not changed. Please try again.",
        });
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
        booking.status === "no_show"
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
      } catch {
        setPendingCancellation(null);
        setCancellationFailure({
          title: "Cancellation unavailable",
          message:
            "We couldn't cancel this session. Its paid booking status has not changed. Please try again.",
        });
      } finally {
        setIsCancelling(false);
      }
    },
    [cancelAppointmentMutation, isCoachRole, user?.id],
  );

  const executeCancelCoachVenueWork = useCallback(
    async (booking: DetailBooking) => {
      if (isFinalSessionStatus(booking.status)) return;
      setIsCancelling(true);
      try {
        await cancelCoachVenueWorkMutation.mutateAsync({
          bookingId: booking.id,
          reason: "Cancelled by coach",
          userId: user?.id,
        });
        setPendingCancellation(null);
        setDetailBooking(null);
      } catch {
        setPendingCancellation(null);
        setCancellationFailure({
          title: "Cancellation unavailable",
          message:
            "We couldn't cancel this venue coaching assignment. Its paid booking status has not changed. Please try again.",
        });
      } finally {
        setIsCancelling(false);
      }
    },
    [cancelCoachVenueWorkMutation, user?.id],
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
      booking.status === "no_show"
    ) {
      return;
    }
    setPendingCancellation({ booking, type: "appointment" });
  }, []);

  const handleCancelCoachVenueWork = useCallback((booking: DetailBooking) => {
    if (isFinalSessionStatus(booking.status)) return;
    setPendingCancellation({ booking, type: "venue_work" });
  }, []);

  const handleCoachAction = useCallback(
    (booking: DetailBooking, action: PendingCoachAction["action"]) => {
      if (coachActionLoading) return;
      setPendingCoachAction({
        booking,
        action,
        workType:
          booking.bookingType === "venue_coach" ? "venue_work" : "appointment",
      });
    },
    [coachActionLoading],
  );

  const executeCoachAction = useCallback(async () => {
    if (!pendingCoachAction) return;
    const { action, booking, workType } = pendingCoachAction;

    try {
      if (workType === "venue_work") {
        if (action === "no_show") {
          await noShowCoachVenueWorkMutation.mutateAsync({
            bookingId: booking.id,
            userId: user?.id,
          });
        } else {
          await completeCoachVenueWorkMutation.mutateAsync({
            bookingId: booking.id,
            userId: user?.id,
          });
        }
      } else {
        await completeCoachAppointmentMutation.mutateAsync({
          appointmentId: booking.id,
          sessionNotes: "Completed from mobile coach sessions.",
          userId: user?.id,
        });
      }
      setDetailBooking(null);
    } catch (error) {
      setCoachActionFailure({
        title: "Session update unavailable",
        message: getCoachFormErrorMessage(
          error,
          "We couldn't update this paid coaching session. Please try again.",
        ),
      });
    } finally {
      setPendingCoachAction(null);
    }
  }, [
    completeCoachAppointmentMutation,
    completeCoachVenueWorkMutation,
    noShowCoachVenueWorkMutation,
    pendingCoachAction,
    user?.id,
  ]);

  const rescheduleSlots = useMemo<TimeSlot[]>(
    () =>
      (appointmentAvailabilityQuery.data ?? [])
        .filter((slot: AppointmentAvailabilitySlot) => slot.available)
        .map((slot: AppointmentAvailabilitySlot) => ({
          duration: `${slot.durationMinutes} min · ends ${formatGymTime(slot.endAt)}`,
          status: "available",
          time: formatGymTime(slot.startAt),
        })),
    [appointmentAvailabilityQuery.data],
  );

  const handleOpenReschedule = useCallback((booking: DetailBooking) => {
    if (
      booking.bookingType !== "single" ||
      booking.status !== "confirmed" ||
      !booking.coachId ||
      !booking.durationMinutes
    ) {
      return;
    }
    setRescheduleBooking(booking);
    setRescheduleDate(booking.date >= getTodayString() ? booking.date : getTodayString());
    setIsRescheduleCalendarOpen(true);
  }, []);

  const handleRescheduleDateSelect = useCallback((date: string) => {
    if (date < getTodayString()) return;
    setRescheduleDate(date);
    setIsRescheduleCalendarOpen(false);
    setIsRescheduleTimeOpen(true);
  }, []);

  const handleRescheduleTimeSelect = useCallback(
    async (slot: TimeSlot) => {
      if (
        !rescheduleBooking?.durationMinutes ||
        rescheduleAppointmentMutation.isPending
      )
        return;
      const canonicalSlot = (appointmentAvailabilityQuery.data ?? []).find(
        (candidate) =>
          candidate.available && formatGymTime(candidate.startAt) === slot.time,
      );
      if (!canonicalSlot) {
        setIsRescheduleTimeOpen(false);
        setRescheduleFailure({
          title: "Time no longer available",
          message:
            "That exact coach slot is no longer available. Choose another date or time.",
        });
        return;
      }

      try {
        await rescheduleAppointmentMutation.mutateAsync({
          appointmentId: rescheduleBooking.id,
          payload: {
            duration: rescheduleBooking.durationMinutes,
            scheduledAt: canonicalSlot.startAt,
          },
          userId: user?.id,
        });
        setIsRescheduleTimeOpen(false);
        setRescheduleBooking(null);
        setRescheduleDate("");
        setDetailBooking(null);
      } catch (error) {
        setIsRescheduleTimeOpen(false);
        setRescheduleFailure({
          title: "Reschedule unavailable",
          message: getCoachFormErrorMessage(
            error,
            "We couldn't reserve that exact coach slot. Choose another time and try again.",
          ),
        });
      }
    },
    [
      appointmentAvailabilityQuery.data,
      rescheduleAppointmentMutation,
      rescheduleBooking,
      user?.id,
    ],
  );

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

  const handlePublishedWorkoutPlan = useCallback(
    (transition: CoachWorkoutPlanTransition) => {
      if (!clientDetail?.id || clientDetail.id !== transition.memberId) {
        return false;
      }

      setClientDetailTab("workout");
      return true;
    },
    [clientDetail?.id],
  );

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
      result = result.filter((booking) => booking.status === statusFilter);
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

  const filteredNewestFirst = useMemo(() => {
    const sorted = [...filtered];
    sorted.sort((left, right) => {
      const byDate = right.date.localeCompare(left.date);
      if (byDate !== 0) return byDate;
      return parseStartMinute(right) - parseStartMinute(left);
    });
    return sorted;
  }, [filtered]);

  const coachSessionsForClientSummary = useMemo(() => {
    let result = appointmentsWithTimeline;
    if (statusFilter !== "all") {
      result = result.filter((booking) => booking.status === statusFilter);
    }
    if (startDate)
      result = result.filter((booking) => booking.date >= startDate);
    if (endDate) result = result.filter((booking) => booking.date <= endDate);
    return result;
  }, [appointmentsWithTimeline, endDate, startDate, statusFilter]);

  const coachClientSummaries = useMemo<CoachClientSummary[]>(() => {
    const byClient = new Map<
      string,
      { email: string; name: string; sessions: DetailBooking[] }
    >();
    coachClientsRaw.forEach((relationship) => {
      const clientId =
        relationship.member_id?.trim() || relationship.member?.id?.trim();
      if (!clientId) return;
      const profile = relationship.member?.profile;
      const name = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      byClient.set(clientId, {
        email: relationship.member?.email ?? '',
        name: name || 'Member',
        sessions: [],
      });
    });
    coachVenueWorkRaw.forEach((booking) => {
      const clientId = booking.userId?.trim() || booking.user?.id?.trim();
      if (!clientId || byClient.has(clientId)) return;
      const profile = booking.user?.profile;
      const name = [profile?.firstName, profile?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      byClient.set(clientId, {
        email: booking.user?.email ?? "",
        name: name || "Member",
        sessions: [],
      });
    });
    coachSessionsForClientSummary.forEach((appointment) => {
      const clientId = appointment.memberId?.trim() || appointment.resourceId?.trim();
      if (!clientId) return;
      const existing = byClient.get(clientId);
      if (existing) existing.sessions.push(appointment);
    });

    return Array.from(byClient.entries())
      .map(([clientId, client]) => {
        const { sessions } = client;
        const sortedSessions = [...sessions].sort((left, right) =>
          `${left.date} ${left.startTime ?? left.time}`.localeCompare(
            `${right.date} ${right.startTime ?? right.time}`,
          ),
        );
        const nextSession = sortedSessions.find((session) =>
          isUpcomingCoachSession(session),
        );
        const lastSession = [...sortedSessions]
          .reverse()
          .find((session) => session.date <= todayString);
        const completedCount = sessions.filter(
          (session) => session.status === "completed",
        ).length;
        const hasActiveBooking = sessions.some(
          (session) => session.status === "confirmed",
        );
        const readinessLabel =
          nextSession || hasActiveBooking
            ? "Active"
            : completedCount > 0
              ? "Completed"
              : "Ready";
        const readinessColor =
          nextSession || hasActiveBooking
            ? colors.success
            : completedCount > 0
              ? colors.brand
              : colors.textMuted;

        return {
          completedCount,
          email: client.email,
          id: clientId,
          lastSession,
          name: client.name,
          nextSession,
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
    coachClientsRaw,
    coachSessionsForClientSummary,
    coachVenueWorkRaw,
    colors.brand,
    colors.success,
    colors.textMuted,
    todayString,
  ]);

  const filteredCoachClients = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    const hasSessionFilters =
      statusFilter !== "all" || Boolean(startDate) || Boolean(endDate);
    return coachClientSummaries.filter((client) => {
      if (hasSessionFilters && client.sessions.length === 0) return false;
      if (!query) return true;
      return (
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query)
      );
    });
  }, [
    coachClientSummaries,
    debouncedSearchQuery,
    endDate,
    startDate,
    statusFilter,
  ]);

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
    Math.ceil(filteredNewestFirst.length / BOOKINGS_PAGE_SIZE),
  );
  const safeBookingPage = Math.min(bookingPage, bookingTotalPages);
  const pagedBookings = useMemo(() => {
    const start = (safeBookingPage - 1) * BOOKINGS_PAGE_SIZE;
    return filteredNewestFirst.slice(start, start + BOOKINGS_PAGE_SIZE);
  }, [filteredNewestFirst, safeBookingPage]);
  const grouped = groupItemsByDate(pagedBookings, "desc");
  const bookingCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    filteredNewestFirst.forEach((booking) => {
      counts.set(booking.date, (counts.get(booking.date) ?? 0) + 1);
    });
    return counts;
  }, [filteredNewestFirst]);
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
      venues.find(
        (venue) =>
          String(venue.id) ===
          (detailBooking?.venueId ?? detailBooking?.resourceId),
      ) ?? null,
    [detailBooking?.resourceId, detailBooking?.venueId, venues],
  );
  const clientDetailSessions = useMemo(
    () => clientDetail?.sessions ?? [],
    [clientDetail?.sessions],
  );
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

  const selectedClientDetailId = clientDetail?.id ?? null;
  useEffect(() => {
    if (!selectedClientDetailId) return;
    const refreshedClient = coachClientSummaries.find(
      (client) => client.id === selectedClientDetailId,
    );
    if (!refreshedClient) return;
    setClientDetail((current) => {
      if (!current || current.id !== selectedClientDetailId) return current;
      return areCoachClientDetailsEquivalent(current, refreshedClient)
        ? current
        : refreshedClient;
    });
  }, [coachClientSummaries, selectedClientDetailId]);

  useEffect(() => {
    if (!clientDetail) {
      setSelectedClientFeedbackAppointmentId("");
      setClientFeedbackMessage(null);
      return;
    }

    setClientFeedbackMessage(null);

    const firstCompletedSession =
      clientDetail.sessions.find((session) => session.status === "completed") ??
      null;
    setSelectedClientFeedbackAppointmentId(firstCompletedSession?.id ?? "");
    setClientCoachFeedback(firstCompletedSession?.coachFeedback ?? "");
    setClientAssessmentReport(firstCompletedSession?.assessmentReport ?? "");
  }, [clientDetail]);

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
      const isFinal = isFinalSessionStatus(detailBooking.status);
      const isVenueWork = detailBooking.bookingType === "venue_coach";
      const actions = [];

      if (detailBooking.status === "confirmed") {
        actions.push({
          key: "complete-session",
          label: "Complete Session",
          variant: "primary" as const,
          icon: CheckCircle2,
          onPress: (booking: DetailBooking) =>
            handleCoachAction(booking, "complete"),
          disabled: coachActionLoading || isCancelling,
          loading: isVenueWork
            ? completeCoachVenueWorkMutation.isPending
            : completeCoachAppointmentMutation.isPending,
          loadingLabel: coachActionLoadingLabel,
        });
        if (isVenueWork) {
          actions.push({
            key: "no-show-session",
            label: "Mark No Show",
            variant: "danger" as const,
            icon: CircleOff,
            onPress: (booking: DetailBooking) =>
              handleCoachAction(booking, "no_show"),
            disabled: coachActionLoading || isCancelling,
            loading: noShowCoachVenueWorkMutation.isPending,
            loadingLabel: coachActionLoadingLabel,
          });
        } else if (detailBooking.bookingType === "single") {
          actions.push({
            key: "reschedule-session",
            label: "Reschedule",
            variant: "ghost" as const,
            icon: CalendarDays,
            onPress: handleOpenReschedule,
            disabled:
              coachActionLoading ||
              isCancelling ||
              rescheduleAppointmentMutation.isPending,
            loading: rescheduleAppointmentMutation.isPending,
            loadingLabel: "RESCHEDULING",
          });
        }
      }

      if (!isFinal) {
        actions.push({
          key: "cancel-session",
          label: isCancelling ? cancellingAppointmentLabel : "Cancel Session",
          variant: "danger" as const,
          icon: CircleOff,
          onPress: isVenueWork
            ? handleCancelCoachVenueWork
            : handleCancelAppointment,
          disabled: coachActionLoading || isCancelling,
          loading: isCancelling,
          loadingLabel: cancellingAppointmentLabel,
        });
      }

      return actions;
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
    completeCoachVenueWorkMutation.isPending,
    detailBooking,
    handleCoachAction,
    handleCancelAppointment,
    handleCancelCoachVenueWork,
    handleCancelReservation,
    handleOpenCoachReview,
    handleOpenReschedule,
    isCancelling,
    isCoachRole,
    noShowCoachVenueWorkMutation.isPending,
    rescheduleAppointmentMutation.isPending,
    submitCoachReviewMutation.isPending,
  ]);

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
          onChipChange={(value) => setStatusFilter(value as StatusFilter)}
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
              error={
                recurringPlansQuery.error
                  ? "Unable to load paid monthly coaching."
                  : null
              }
              isLoading={recurringPlansQuery.isPending}
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
          pendingCancellation == null &&
          pendingCoachAction == null &&
          rescheduleBooking == null
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
            accessibilityLabel={`${clientDetail?.name ?? "Client"} coaching details`}
            accessibilityViewIsModal
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
                      onPress={() => setClientDetailTab("workout")}
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
                        OPEN WORKOUT PROGRAMS
                      </FitText>
                    </Pressable>
                  </View>
                ) : null}

                {clientDetailTab === "schedule" && user?.id ? (
                  <CoachClientPaidSchedule
                    sessions={clientDetailSessions}
                    relationshipLabel={
                      lastMonthlyPlanForClient
                        ? "Active monthly plan"
                        : hasActivePaidOneSession
                          ? "Paid one-session relationship"
                          : "No active paid relationship"
                    }
                    onOpenSessionReport={(sessionId) => {
                      setSelectedClientFeedbackAppointmentId(sessionId);
                      setClientDetailTab("feedback");
                    }}
                  />
                ) : null}

                {clientDetailTab === "workout" && user?.id ? (
                  <CoachClientWorkoutPrograms
                    canManage={Boolean(lastMonthlyPlanForClient) || hasActivePaidOneSession}
                    coachUserId={user.id}
                    memberId={clientDetail.id}
                    onPublished={handlePublishedWorkoutPlan}
                    paidPeriodEndDate={lastMonthlyPlanForClient?.endDate}
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
        isVisible={pendingCancellation != null}
        title={
          pendingCancellation?.type === "appointment"
            ? "Cancel appointment?"
            : pendingCancellation?.type === "venue_work"
              ? "Cancel venue coaching work?"
            : "Cancel reservation?"
        }
        message={
          pendingCancellation
              ? `Are you sure you want to cancel ${pendingCancellation.booking.resourceName} on ${formatBookingDate(
                pendingCancellation.booking.date,
              )}? This cancels the paid booking immediately under the cancellation policy.`
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
          if (pendingCancellation.type === "venue_work") {
            void executeCancelCoachVenueWork(pendingCancellation.booking);
            return;
          }
          void executeCancelReservation(pendingCancellation.booking);
        }}
      />
      <NoticeModal
        isVisible={cancellationFailure != null}
        title={cancellationFailure?.title ?? "Cancellation unavailable"}
        message={cancellationFailure?.message ?? ""}
        buttonLabel="Stay in Bookings"
        onClose={() => setCancellationFailure(null)}
      />
      <NoticeModal
        isVisible={checkoutResultNotice != null}
        title={checkoutResultNotice?.title ?? "Checkout result"}
        message={checkoutResultNotice?.message ?? ""}
        buttonLabel="Continue"
        onClose={() => setCheckoutResultNotice(null)}
      />
      <NoticeModal
        isVisible={coachActionFailure != null}
        title={coachActionFailure?.title ?? "Session update unavailable"}
        message={coachActionFailure?.message ?? ""}
        buttonLabel="Stay in Sessions"
        onClose={() => setCoachActionFailure(null)}
      />
      <ConfirmModal
        isVisible={pendingCoachAction != null}
        title={
          pendingCoachAction?.action === "no_show"
            ? "Mark member no show?"
            : "Complete session?"
        }
        message={
          pendingCoachAction
            ? `${
                pendingCoachAction.action === "no_show"
                  ? "Mark no show for"
                  : "Complete"
              } ${
                pendingCoachAction.booking.resourceName
              } on ${formatBookingDate(
                pendingCoachAction.booking.date,
              )}? This updates the coach session immediately.`
            : ""
        }
        yesLabel={
          pendingCoachAction?.action === "no_show" ? "Mark No Show" : "Complete"
        }
        noLabel="Go Back"
        isDestructive={pendingCoachAction?.action === "no_show"}
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
      <CalendarModal
        isVisible={isRescheduleCalendarOpen}
        selectedDate={rescheduleDate}
        minDate={getTodayString()}
        defaultYear={Number((rescheduleDate || getTodayString()).slice(0, 4))}
        defaultMonth={Number((rescheduleDate || getTodayString()).slice(5, 7))}
        onSelect={handleRescheduleDateSelect}
        onClose={() => {
          setIsRescheduleCalendarOpen(false);
          setRescheduleBooking(null);
          setRescheduleDate("");
        }}
      />
      <TimeSlotModal
        isVisible={isRescheduleTimeOpen}
        title="Exact Coach Time"
        emptyMessage={
          appointmentAvailabilityQuery.isPending
            ? "Loading exact coach slots..."
            : appointmentAvailabilityQuery.error
              ? "Exact coach slots could not be loaded. Close and try again."
              : "No exact coach slots are available for this date."
        }
        slots={rescheduleSlots}
        selectedTime=""
        showAvailabilityLegend={false}
        onSelect={(slot) => void handleRescheduleTimeSelect(slot)}
        onClose={() => {
          if (rescheduleAppointmentMutation.isPending) return;
          setIsRescheduleTimeOpen(false);
          setRescheduleBooking(null);
          setRescheduleDate("");
        }}
      />
      <NoticeModal
        isVisible={rescheduleFailure != null}
        title={rescheduleFailure?.title ?? "Reschedule unavailable"}
        message={rescheduleFailure?.message ?? ""}
        buttonLabel="Choose Another Time"
        onClose={() => {
          setRescheduleFailure(null);
          if (rescheduleBooking) {
            void appointmentAvailabilityQuery.refetch();
            setIsRescheduleTimeOpen(true);
          }
        }}
      />
      {isUserRole ? (
        <AppointmentModal
          isVisible={isAppointmentOpen}
          onClose={() => setIsAppointmentOpen(false)}
          onMonthlySubmit={async ({ coachId, idempotencyKey, startDate }) => {
            const checkout =
              await mobileApiClient.recurringCoachingPlans.enroll({
                ...resolveCheckoutReturnInput("bookings"),
                coachId,
                idempotencyKey,
                startDate,
              });
            return {
              attempt: checkout,
              checkoutUrl: checkout.checkoutUrl,
            };
          }}
          onSuccess={() => {
            setIsAppointmentOpen(false);
            setActiveSection("appointments");
          }}
        />
      ) : null}
      <CalendarModal
        isVisible={isStartCalOpen}
        selectedDate={startDate}
        defaultYear={Number(getTodayString().slice(0, 4))}
        defaultMonth={Number(getTodayString().slice(5, 7))}
        onSelect={handleStartDateSelect}
        onClose={() => setIsStartCalOpen(false)}
      />
      <CalendarModal
        isVisible={isEndCalOpen}
        selectedDate=""
        allowEmpty
        minDate={startDate ? nextDate(startDate) : nextDate(getTodayString())}
        defaultYear={Number(getTodayString().slice(0, 4))}
        defaultMonth={Number(getTodayString().slice(5, 7))}
        onSelect={handleEndDateSelect}
        onClose={() => setIsEndCalOpen(false)}
      />
    </View>
  );
}
