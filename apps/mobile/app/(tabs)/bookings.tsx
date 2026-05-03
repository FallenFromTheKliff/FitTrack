import { useState, useMemo, useCallback, useEffect } from "react";
import { Linking, Pressable, View } from "react-native";
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
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import type {
  AppointmentRecord,
  AppointmentPaymentStage,
  VenueBookingRecord,
} from "@fittrack/api-client";

import {
  appointmentsQueryOptions,
  bookingsQueryOptions,
  cancelAppointmentMutationOptions,
  cancelBookingMutationOptions,
  payAppointmentDownpaymentMutationOptions,
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

import { FitCard, FitFilter, FitSearch, FitText } from "@/components/fit";
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

export default function BookingsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const isUserRole = user?.role === "USER";
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
          bookingType: appointment.recurringPlanId ? "recurring" : "single",
          id: appointment.id,
          nextPaymentDate: appointment.nextPaymentDate ?? undefined,
          paymentPlan: appointment.paymentPlan ?? undefined,
          remainingBalance: appointment.remainingBalance ?? undefined,
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

  const isLoading =
    activeSection === "bookings"
      ? venuesLoading || bookingsLoading
      : appointmentsLoading;
  const errorText = useMemo(() => {
    if (activeSection === "bookings" && (venuesError || bookingsError))
      return "Unable to load reservations.";
    if (activeSection === "appointments" && appointmentsError)
      return "Unable to load appointments.";
    return "";
  }, [activeSection, appointmentsError, bookingsError, venuesError]);

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
          cancelReason: "Cancelled by user",
          userId: user?.id,
        });
        setPendingCancellation(null);
        setDetailBooking(null);
      } finally {
        setIsCancelling(false);
      }
    },
    [cancelAppointmentMutation, user?.id],
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

  const activeItems = useMemo(() => {
    return activeSection === "bookings" ? reservations : appointments;
  }, [activeSection, appointments, reservations]);

  const filtered = useMemo(() => {
    let result = activeItems;
    if (statusFilter !== "all")
      result = result.filter((booking) =>
        statusFilter === "pending"
          ? booking.status === "pending" ||
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
    return [
      {
        key: "cancel-appointment",
        label: isCancelling ? cancellingAppointmentLabel : "Cancel Appointment",
        variant: "danger" as const,
        icon: CircleOff,
        onPress: handleCancelAppointment,
        disabled:
          isCancelling ||
          detailBooking.status === "cancelled" ||
          detailBooking.status === "completed" ||
          detailBooking.status === "declined",
        loading: isCancelling,
        loadingLabel: cancellingAppointmentLabel,
      },
    ];
  }, [
    activeSection,
    cancellingAppointmentLabel,
    cancellingReservationLabel,
    detailBooking,
    handleCancelAppointment,
    handleCancelReservation,
    isCancelling,
    openingPaymongoLabel,
    payAppointmentMutation,
    user?.id,
  ]);

  const sectionOptions = MEMBER_SECTION_OPTIONS;
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
        isVisible={!!detailBooking}
        booking={detailBooking}
        venue={detailVenue}
        onClose={() => setDetailBooking(null)}
        actions={detailActions}
      />
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
