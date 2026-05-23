import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Activity,
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Dumbbell,
  Swords,
  Users,
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
  AppointmentPaymentStage,
  CoachAppointmentScheduleRecord,
  VenueBookingRecord,
} from "@fittrack/api-client";

import {
  appointmentsQueryOptions,
  bookingsQueryOptions,
  cancelAppointmentMutationOptions,
  cancelBookingMutationOptions,
  coachScheduleQueryOptions,
  completeCoachAppointmentMutationOptions,
  confirmCoachAppointmentMutationOptions,
  declineCoachAppointmentMutationOptions,
  payAppointmentDownpaymentMutationOptions,
  submitCoachReviewMutationOptions,
  venuesQueryOptions,
} from "@fittrack/query";
import { normalizeBookingStatus, toDateTimeRange } from "@fittrack/app-core";
import {
  formatBookingDate,
  formatGroupLabel,
  groupItemsByDate,
  nextDate,
} from "@fittrack/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
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

import { FitButton, FitCard, FitFilter, FitSearch, FitText } from "@/components/fit";
import {
  AppointmentModal,
  BookingDetailModal,
  CalendarModal,
  ConfirmModal,
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
const COACH_SECTION_OPTIONS = [{ label: "Sessions", value: "appointments" }];

type BookingSection = "bookings" | "appointments";
type ExtendedStatusFilter = StatusFilter | "pending" | "completed" | "declined";
type AppointmentPaymentProvider = "cash" | "paymongo";
type PendingAppointmentPayment = {
  booking: DetailBooking;
  provider: AppointmentPaymentProvider;
  stage: AppointmentPaymentStage;
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

export default function BookingsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isFocused = useIsFocused();
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
  const { ic } = useThemeTransitionAnim();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeBookingsScreenStyles(colors), [colors]);

  const params = useLocalSearchParams<{ openReservation?: string }>();
  const isFrozen = user?.status === "frozen";
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [statusFilter, setStatusFilter] = useState<ExtendedStatusFilter>("all");
  const [activeSection, setActiveSection] =
    useState<BookingSection>("bookings");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isStartCalOpen, setIsStartCalOpen] = useState(false);
  const [isEndCalOpen, setIsEndCalOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<DetailBooking | null>(
    null,
  );
  const [pendingAppointmentPayment, setPendingAppointmentPayment] =
    useState<PendingAppointmentPayment | null>(null);
  const [pendingCancellation, setPendingCancellation] =
    useState<PendingCancellation | null>(null);
  const [pendingCoachAction, setPendingCoachAction] =
    useState<PendingCoachAction | null>(null);
  const [reviewTarget, setReviewTarget] = useState<DetailBooking | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);

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
          price: Number(appointment.totalAmount ?? appointment.coachEarnings ?? 0),
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
    [appointmentTimelines, colors.textMuted, colors.warning, displayAppointments],
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
    if (activeSection === "appointments" && isCoachRole && coachScheduleError)
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
        onPress: () => setReservationOpen(true),
      },
      {
        label: "Book a Trainer",
        icon: Users,
        iconColor: colors.brand,
        iconBg: colors.surfaceRaised,
        onPress: () => setIsAppointmentOpen(true),
      },
    ];
  }, [
    colors.brand,
    colors.surfaceRaised,
    isFrozen,
    isUserRole,
    setReservationOpen,
  ]);

  useEffect(() => {
    if (isCoachRole && activeSection !== "appointments") {
      setActiveSection("appointments");
    }
  }, [activeSection, isCoachRole]);

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
  const dividerStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.border,
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
  const openingPaymongoLabel = useLoadingText(
    "OPENING PAYMONGO",
    payAppointmentMutation.isPending,
  );
  const coachActionLoadingLabel = useLoadingText(
    "UPDATING",
    coachActionLoading,
  );

  const handleSubmitAppointmentPayment = useCallback(
    async ({ booking, provider, stage }: PendingAppointmentPayment) => {
      const result = await payAppointmentMutation.mutateAsync({
        appointmentId: booking.id,
        paymentStage: stage,
        provider,
        userId: user?.id,
      });

      setPendingAppointmentPayment(null);
      if (provider === "cash") {
        setDetailBooking(null);
        return;
      }

      if (result.checkoutUrl) {
        setDetailBooking(null);
        void Linking.openURL(result.checkoutUrl);
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
          cancelReason: isCoachRole ? "Cancelled by coach" : "Cancelled by user",
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

  const activeItems = useMemo(() => {
    return activeSection === "bookings" ? reservations : appointmentsWithTimeline;
  }, [activeSection, appointmentsWithTimeline, reservations]);

  const filtered = useMemo(() => {
    let result = activeItems;
    if (statusFilter !== "all")
      result = result.filter((booking) =>
        statusFilter === "pending"
          ? booking.status === "pending" ||
            booking.status === "pending_coach" ||
            booking.status === "pending_downpayment" ||
            booking.status === "pending_payment" ||
            booking.status === "pending_full_payment"
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

  const grouped = groupItemsByDate(filtered, "asc");
  const isEmpty = !isLoading && filtered.length === 0;
  const startLabel = startDate ? formatGroupLabel(startDate) : "All Dates";
  const endLabel = endDate ? formatGroupLabel(endDate) : "Due Date";
  const detailVenue = useMemo(
    () =>
      venues.find((venue) => String(venue.id) === detailBooking?.resourceId) ??
      null,
    [detailBooking?.resourceId, venues],
  );

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
    if (
      detailBooking.status === "pending_payment" ||
      detailBooking.status === "pending_downpayment" ||
      detailBooking.status === "pending_full_payment"
    ) {
      const initialStage =
        detailBooking.status === "pending_full_payment" &&
        Number(detailBooking.remainingBalance ?? 0) <= 0
          ? "full"
          : "downpayment";
      return [
        {
          key: "paymongo-appointment-downpayment",
          label: payAppointmentMutation.isPending
            ? openingPaymongoLabel
            : initialStage === "full"
              ? "PayMongo Full Payment"
              : "PayMongo Downpayment",
          variant: "primary" as const,
          icon: CheckCircle2,
          onPress: async (booking: DetailBooking) => {
            setPendingAppointmentPayment({
              booking,
              provider: "paymongo",
              stage: initialStage,
            });
          },
          disabled: payAppointmentMutation.isPending || isCancelling,
          loading: payAppointmentMutation.isPending,
          loadingLabel: openingPaymongoLabel,
        },
        {
          key: "cash-appointment-downpayment",
          label: payAppointmentMutation.isPending
            ? "SENDING"
            : "Cash Downpayment",
          variant: "ghost" as const,
          icon: CheckCircle2,
          onPress: async (booking: DetailBooking) => {
            setPendingAppointmentPayment({
              booking,
              provider: "cash",
              stage: initialStage,
            });
          },
          disabled: payAppointmentMutation.isPending || isCancelling,
          loading: payAppointmentMutation.isPending,
          loadingLabel: "SENDING",
        },
        {
          key: "cash-appointment-full",
          label: payAppointmentMutation.isPending
            ? "SENDING"
            : "Cash Full Payment",
          variant: "ghost" as const,
          icon: CheckCircle2,
          onPress: async (booking: DetailBooking) => {
            setPendingAppointmentPayment({
              booking,
              provider: "cash",
              stage: "full",
            });
          },
          disabled: payAppointmentMutation.isPending || isCancelling,
          loading: payAppointmentMutation.isPending,
          loadingLabel: "SENDING",
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
    openingPaymongoLabel,
    payAppointmentMutation,
    submitCoachReviewMutation.isPending,
    user?.id,
  ]);

  const sectionOptions = isCoachRole ? COACH_SECTION_OPTIONS : MEMBER_SECTION_OPTIONS;
  const chipOptions = FILTER_OPTIONS;

  return (
    <View style={[base.screen, !isFocused && { display: "none" }]}>
      <Animated.View style={[s.searchAnimWrap, contentStyle]}>
        <View style={s.searchWrap}>
          <View style={s.searchRow}>
            <View style={s.searchFieldWrap}>
              <FitSearch
                placeholder="Search bookings..."
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
          onTopChipChange={(value) => setActiveSection(value as BookingSection)}
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
          {isLoading ? (
            <View style={s.emptyState}>
              <CalendarDays
                size={40}
                color={colors.textMuted}
                strokeWidth={1.5}
              />
              <FitText style={s.emptyTitle}>
                {activeSection === "bookings"
                  ? "Loading reservations"
                  : "Loading appointments"}
              </FitText>
              <FitText style={s.emptyHint}>Please wait a moment</FitText>
            </View>
          ) : errorText ? (
            <View style={s.emptyState}>
              <CalendarDays
                size={40}
                color={colors.textMuted}
                strokeWidth={1.5}
              />
              <FitText style={s.emptyTitle}>
                {activeSection === "bookings"
                  ? "Reservations unavailable"
                  : "Appointments unavailable"}
              </FitText>
              <FitText style={s.emptyHint}>{errorText}</FitText>
            </View>
          ) : isEmpty ? (
            <View style={s.emptyState}>
              <CalendarDays
                size={40}
                color={colors.textMuted}
                strokeWidth={1.5}
              />
              <FitText style={s.emptyTitle}>
                {activeSection === "bookings"
                  ? "No reservations"
                  : "No appointments found"}
              </FitText>
              <FitText style={s.emptyHint}>
                {activeSection === "bookings"
                  ? "Your reservations will appear here"
                  : "Your trainer appointments will appear here"}
              </FitText>
            </View>
          ) : (
            grouped.map(([dateKey, dateBookings]) => (
              <View key={dateKey} style={s.group}>
                <Animated.View style={[s.groupDivider, dividerStyle]} />
                <FitText style={s.groupLabel}>
                  {formatGroupLabel(dateKey)}
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
                    return (
                      <View key={booking.id} style={s.cardRow}>
                        <View style={s.cardWrap}>
                          <FitCard
                            icon={
                              activeSection === "appointments"
                                ? Users
                                : amenityIcon
                            }
                            iconSize={18}
                            label={booking.resourceName}
                            subtitle={`${formatBookingDate(booking.date)} | ${detailSubtitle}`}
                            trailingLabel={formatStatusLabel(booking.status)}
                            trailingLabelColor={
                              STATUS_COLORS[booking.status] ?? colors.textMuted
                            }
                            onPress={() => setDetailBooking(booking)}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </Animated.View>
      </Animated.ScrollView>
      <BookingDetailModal
        isVisible={
          !!detailBooking &&
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
        title={
          pendingAppointmentPayment?.provider === "paymongo"
            ? "Continue to PayMongo?"
            : "Submit cash payment?"
        }
        message={
          pendingAppointmentPayment
            ? `${pendingAppointmentPayment.provider === "paymongo" ? "Start PayMongo checkout" : "Submit a cash payment request"} for the appointment ${
                pendingAppointmentPayment.stage === "full"
                  ? "full payment"
                  : "downpayment"
              } of PHP ${Number(
                pendingAppointmentPayment.stage === "full"
                  ? (pendingAppointmentPayment.booking.totalAmount ?? 0)
                  : (pendingAppointmentPayment.booking.amountDueNow ?? 0),
              ).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}?${
                pendingAppointmentPayment.stage === "full"
                  ? " No remaining balance will be due after staff verifies it."
                  : " The remaining balance will stay due after this payment is verified."
              }`
            : ""
        }
        yesLabel={
          pendingAppointmentPayment?.provider === "paymongo"
            ? "Open PayMongo"
            : "Submit"
        }
        noLabel="Cancel"
        isLoading={payAppointmentMutation.isPending}
        loadingLabel={
          pendingAppointmentPayment?.provider === "paymongo"
            ? "OPENING PAYMONGO"
            : "SUBMITTING"
        }
        loadingTitle={
          pendingAppointmentPayment?.provider === "paymongo"
            ? "Opening checkout"
            : "Submitting payment"
        }
        onNo={() => {
          if (payAppointmentMutation.isPending) return;
          setPendingAppointmentPayment(null);
        }}
        onYes={() => {
          if (!pendingAppointmentPayment) return;
          void handleSubmitAppointmentPayment(pendingAppointmentPayment);
        }}
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
          onSuccess={() => {
            setIsAppointmentOpen(false);
            setActiveSection("appointments");
          }}
        />
      ) : null}
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
