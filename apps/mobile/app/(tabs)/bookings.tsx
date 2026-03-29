import { useState, useMemo, useCallback, useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Activity, Bell, CalendarCheck, CalendarDays, CalendarPlus, Dumbbell, Swords, Users, SlidersHorizontal, CheckCircle2, CircleOff } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  appointmentsQueryOptions,
  bookingsQueryOptions,
  cancelAppointmentMutationOptions,
  cancelBookingMutationOptions,
  coachScheduleQueryOptions,
  completeCoachAppointmentMutationOptions,
  confirmCoachAppointmentMutationOptions,
  declineCoachAppointmentMutationOptions,
  venuesQueryOptions
} from "@fittrack/query";
import { formatBookingDate, formatGroupLabel, groupItemsByDate, nextDate } from "@fittrack/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useDebounce, useLoadingText } from "@fittrack/hooks";
import { makeScreenStyles, makeBookingsScreenStyles } from "@/styles/shared/ScreenStyles";
import { STATUS_COLORS, FILTER_OPTIONS, type StatusFilter, getTodayString } from "@/data/bookings";
import { mobileApiClient } from "@/lib/api";
import { toMobileBookings, type VenueBookingRecord } from "@/utils/venueBookings";

import { FitCard, FitFilter, FitSearch, FitText } from "@/components/fit";
import { AppointmentModal, BookingDetailModal, CalendarModal, type DetailBooking } from "@/components/modals";

const AMENITY_ICONS: Record<string, LucideIcon> = {
  "Basketball Court": Activity,
  "Boxing Ring": Swords,
  "Volleyball Court": Activity,
  "Gym Area (Front)": Dumbbell,
  "Gym Area (Back)": Dumbbell,
  "Reception": Bell
};

const DEFAULT_AMENITY_ICON: LucideIcon = Dumbbell;
const MEMBER_SECTION_OPTIONS = [
  { label: "Reservations", value: "bookings" },
  { label: "Appointments", value: "appointments" }
];
const COACH_SECTION_OPTIONS = [
  { label: "Coach Schedule", value: "coach" }
];
const COACH_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Declined", value: "declined" },
  { label: "Cancelled", value: "cancelled" }
];

type BookingSection = "bookings" | "appointments" | "coach";
type ExtendedStatusFilter = StatusFilter | "pending" | "completed" | "declined";

type AppointmentRecord = {
  id: string;
  coachId?: string;
  scheduledAt: string;
  duration: number;
  status?: string;
  sessionType?: string | null;
  notes?: string | null;
  coach?: {
    hourlyRate?: number | null;
    user?: {
      profile?: {
        firstName?: string | null;
        lastName?: string | null;
      } | null;
    } | null;
  } | null;
};

type CoachScheduleRecord = {
  id: string;
  coachId?: string;
  scheduledAt: string;
  endTime?: string;
  duration: number;
  status?: string;
  notes?: string | null;
  user?: {
    email?: string;
    profile?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
};

function normalizeStatus(status?: string) {
  return (status ?? "pending").toLowerCase();
}

function toTimeRange(startIso: string, durationMinutes: number, explicitEnd?: string) {
  const start = new Date(startIso);
  const end = explicitEnd ? new Date(explicitEnd) : new Date(start.getTime() + durationMinutes * 60_000);
  const startLabel = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const endLabel = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return { startLabel, endLabel, date: start.toISOString().slice(0, 10) };
}

export default function BookingsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isCoach = user?.role === "COACH";
  const isUserRole = user?.role === "USER";
  const { isFabOpen, setFabOpen, registerFAB, unregisterFAB, setReservationOpen, bookingRefreshTick } = useFABState();
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
  const [activeSection, setActiveSection] = useState<BookingSection>(isCoach ? "coach" : "bookings");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isStartCalOpen, setIsStartCalOpen] = useState(false);
  const [isEndCalOpen, setIsEndCalOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<DetailBooking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);

  useEffect(() => {
    if (isCoach) {
      setActiveSection("coach");
    }
  }, [isCoach]);

  const { data: venues = [], isLoading: venuesLoading, error: venuesError } = useQuery({
    ...venuesQueryOptions(mobileApiClient, user?.id),
    enabled: !!user?.id && isUserRole,
    staleTime: 60_000,
    gcTime: 300_000
  });

  const { data: apiBookings = [], isLoading: bookingsLoading, error: bookingsError, refetch } = useQuery({
    ...bookingsQueryOptions<VenueBookingRecord>(mobileApiClient, user?.id),
    enabled: !!user?.id && isUserRole,
    staleTime: 60_000,
    gcTime: 300_000
  });

  const { data: appointmentsRaw = [], isLoading: appointmentsLoading, error: appointmentsError } = useQuery({
    ...appointmentsQueryOptions<AppointmentRecord>(mobileApiClient, user?.id),
    enabled: !!user?.id && isUserRole,
    staleTime: 60_000,
    gcTime: 300_000
  });

  const { data: coachScheduleRaw = [], isLoading: coachScheduleLoading, error: coachScheduleError } = useQuery({
    ...coachScheduleQueryOptions<CoachScheduleRecord>(mobileApiClient, user?.id),
    enabled: !!user?.id && isCoach,
    staleTime: 60_000,
    gcTime: 300_000
  });

  const reservations = useMemo<DetailBooking[]>(
    () => toMobileBookings(apiBookings, venues).map((booking) => ({
      ...booking,
      detailTitle: "Reservation Details",
      detailSubtitle: booking.resourceName
    })),
    [apiBookings, venues]
  );

  const appointments = useMemo<DetailBooking[]>(
    () => appointmentsRaw.map((appointment) => {
      const { startLabel, endLabel, date } = toTimeRange(appointment.scheduledAt, appointment.duration);
      const firstName = appointment.coach?.user?.profile?.firstName?.trim() ?? "";
      const lastName = appointment.coach?.user?.profile?.lastName?.trim() ?? "";
      const coachName = `${firstName} ${lastName}`.trim() || "Coach Session";
      return {
        id: appointment.id,
        resourceId: appointment.coachId ?? "coach",
        resourceName: coachName,
        time: `${startLabel} - ${endLabel}`,
        startTime: startLabel,
        endTime: endLabel,
        date,
        status: normalizeStatus(appointment.status),
        price: appointment.coach?.hourlyRate ?? 0,
        trainerName: coachName,
        participantName: coachName,
        participantLabel: "Coach",
        description: appointment.notes ?? undefined,
        detailTitle: "Appointment Details",
        detailSubtitle: coachName
      };
    }),
    [appointmentsRaw]
  );

  const coachSchedule = useMemo<DetailBooking[]>(
    () => coachScheduleRaw.map((appointment) => {
      const { startLabel, endLabel, date } = toTimeRange(appointment.scheduledAt, appointment.duration, appointment.endTime);
      const firstName = appointment.user?.profile?.firstName?.trim() ?? "";
      const lastName = appointment.user?.profile?.lastName?.trim() ?? "";
      const memberName = `${firstName} ${lastName}`.trim() || appointment.user?.email || "Member";
      return {
        id: appointment.id,
        resourceId: appointment.coachId ?? "coach",
        resourceName: memberName,
        time: `${startLabel} - ${endLabel}`,
        startTime: startLabel,
        endTime: endLabel,
        date,
        status: normalizeStatus(appointment.status),
        price: 0,
        participantName: memberName,
        participantLabel: "Member",
        description: appointment.notes ?? undefined,
        detailTitle: "Appointment Details",
        detailSubtitle: memberName
      };
    }),
    [coachScheduleRaw]
  );

  const isLoading = isCoach
    ? coachScheduleLoading
    : activeSection === "bookings"
      ? venuesLoading || bookingsLoading
      : appointmentsLoading;
  const errorText = useMemo(() => {
    if (isCoach && coachScheduleError) return "Unable to load coach schedule.";
    if (activeSection === "bookings" && (venuesError || bookingsError)) return "Unable to load reservations.";
    if (activeSection === "appointments" && appointmentsError) return "Unable to load appointments.";
    return "";
  }, [activeSection, appointmentsError, bookingsError, coachScheduleError, isCoach, venuesError]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; }
  });

  const menuItems: FABMenuItem[] = useMemo(() => {
    if (isFrozen || !isUserRole) return [];
    return [
      {
        label: "Make Reservation",
        icon: CalendarCheck,
        iconColor: colors.brand,
        iconBg: colors.surfaceRaised,
        onPress: () => setReservationOpen(true)
      },
      {
        label: "Book a Trainer",
        icon: Users,
        iconColor: colors.brand,
        iconBg: colors.surfaceRaised,
        onPress: () => setIsAppointmentOpen(true)
      }
    ];
  }, [colors.brand, colors.surfaceRaised, isFrozen, isUserRole, setReservationOpen]);

  useEffect(() => {
    if (!user?.id || !isUserRole) return;
    void refetch();
  }, [bookingRefreshTick, isUserRole, refetch, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (params.openReservation === "true" && !isFrozen && isUserRole) setReservationOpen(true);
      registerFAB({ screenIcon: CalendarPlus, menuItems, scrollY, visible: !isFrozen && isUserRole });
      return () => {
        setIsFilterOpen(false);
        unregisterFAB();
      };
    }, [isFrozen, isUserRole, menuItems, params.openReservation, registerFAB, setReservationOpen, unregisterFAB, scrollY])
  );

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const dividerStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.border }));

  const cancelBookingMutation = useMutation(cancelBookingMutationOptions(mobileApiClient, queryClient));
  const cancelAppointmentMutation = useMutation(cancelAppointmentMutationOptions(mobileApiClient, queryClient));
  const confirmCoachMutation = useMutation(confirmCoachAppointmentMutationOptions(mobileApiClient, queryClient));
  const declineCoachMutation = useMutation(declineCoachAppointmentMutationOptions(mobileApiClient, queryClient));
  const completeCoachMutation = useMutation(completeCoachAppointmentMutationOptions(mobileApiClient, queryClient));

  const cancellingReservationLabel = useLoadingText("CANCELLING", cancelBookingMutation.isPending);
  const cancellingAppointmentLabel = useLoadingText("CANCELLING", cancelAppointmentMutation.isPending);
  const confirmingAppointmentLabel = useLoadingText("CONFIRMING", confirmCoachMutation.isPending);
  const decliningAppointmentLabel = useLoadingText("DECLINING", declineCoachMutation.isPending);
  const completingAppointmentLabel = useLoadingText("COMPLETING", completeCoachMutation.isPending);

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

  const handleCancelReservation = useCallback(async (booking: DetailBooking) => {
    if (booking.status === "cancelled") return;
    setIsCancelling(true);
    try {
      await cancelBookingMutation.mutateAsync({
        bookingId: booking.id,
        cancelReason: "Cancelled by user",
        userId: user?.id
      });
      setDetailBooking(null);
    } finally {
      setIsCancelling(false);
    }
  }, [cancelBookingMutation, user?.id]);

  const handleCancelAppointment = useCallback(async (booking: DetailBooking) => {
    if (booking.status === "cancelled" || booking.status === "completed" || booking.status === "declined") return;
    setIsCancelling(true);
    try {
      await cancelAppointmentMutation.mutateAsync({
        appointmentId: booking.id,
        cancelReason: "Cancelled by user",
        userId: user?.id
      });
      setDetailBooking(null);
    } finally {
      setIsCancelling(false);
    }
  }, [cancelAppointmentMutation, user?.id]);

  const activeItems = useMemo(() => {
    if (isCoach) return coachSchedule;
    return activeSection === "bookings" ? reservations : appointments;
  }, [activeSection, appointments, coachSchedule, isCoach, reservations]);

  const filtered = useMemo(() => {
    let result = activeItems;
    if (statusFilter !== "all") result = result.filter((booking) => booking.status === statusFilter);
    if (startDate) result = result.filter((booking) => booking.date >= startDate);
    if (endDate) result = result.filter((booking) => booking.date <= endDate);
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter((booking) =>
        booking.resourceName.toLowerCase().includes(query) ||
        (booking.participantName ?? "").toLowerCase().includes(query)
      );
    }
    return result;
  }, [activeItems, debouncedSearchQuery, endDate, startDate, statusFilter]);

  const grouped = groupItemsByDate(filtered, isCoach ? "desc" : "asc");
  const isEmpty = !isLoading && filtered.length === 0;
  const startLabel = startDate ? formatGroupLabel(startDate) : "All Dates";
  const endLabel = endDate ? formatGroupLabel(endDate) : "Due Date";
  const detailVenue = useMemo(
    () => venues.find((venue) => String(venue.id) === detailBooking?.resourceId) ?? null,
    [detailBooking?.resourceId, venues]
  );

  const detailActions = useMemo(() => {
    if (!detailBooking) return [];
    if (isCoach) {
      if (detailBooking.status === "pending") {
        return [
          {
            key: "confirm",
            label: confirmCoachMutation.isPending ? confirmingAppointmentLabel : "Confirm",
            variant: "primary" as const,
            icon: CheckCircle2,
            onPress: async (booking: DetailBooking) => {
              await confirmCoachMutation.mutateAsync({
                appointmentId: booking.id,
                userId: user?.id
              });
              setDetailBooking(null);
            },
            disabled: confirmCoachMutation.isPending || declineCoachMutation.isPending || completeCoachMutation.isPending,
            loading: confirmCoachMutation.isPending,
            loadingLabel: confirmingAppointmentLabel
          },
          {
            key: "decline",
            label: declineCoachMutation.isPending ? decliningAppointmentLabel : "Decline",
            variant: "danger" as const,
            icon: CircleOff,
            onPress: async (booking: DetailBooking) => {
              await declineCoachMutation.mutateAsync({
                appointmentId: booking.id,
                reason: "Declined by coach.",
                userId: user?.id
              });
              setDetailBooking(null);
            },
            disabled: confirmCoachMutation.isPending || declineCoachMutation.isPending || completeCoachMutation.isPending,
            loading: declineCoachMutation.isPending,
            loadingLabel: decliningAppointmentLabel
          }
        ];
      }
      if (detailBooking.status === "confirmed") {
        return [
          {
            key: "complete",
            label: completeCoachMutation.isPending ? completingAppointmentLabel : "Mark Complete",
            variant: "primary" as const,
            icon: CheckCircle2,
            onPress: async (booking: DetailBooking) => {
              await completeCoachMutation.mutateAsync({
                appointmentId: booking.id,
                userId: user?.id
              });
              setDetailBooking(null);
            },
            disabled: completeCoachMutation.isPending,
            loading: completeCoachMutation.isPending,
            loadingLabel: completingAppointmentLabel
          }
        ];
      }
      return [];
    }
    if (activeSection === "bookings") {
      return [
        {
          key: "cancel-reservation",
          label: isCancelling ? cancellingReservationLabel : "Cancel Reservation",
          variant: "danger" as const,
          icon: CircleOff,
          onPress: handleCancelReservation,
          disabled: isCancelling || detailBooking.status === "cancelled" || detailBooking.status === "completed",
          loading: isCancelling,
          loadingLabel: cancellingReservationLabel
        }
      ];
    }
    return [
      {
        key: "cancel-appointment",
        label: isCancelling ? cancellingAppointmentLabel : "Cancel Appointment",
        variant: "danger" as const,
        icon: CircleOff,
        onPress: handleCancelAppointment,
        disabled: isCancelling || detailBooking.status === "cancelled" || detailBooking.status === "completed" || detailBooking.status === "declined",
        loading: isCancelling,
        loadingLabel: cancellingAppointmentLabel
      }
    ];
  }, [
    activeSection,
    cancellingAppointmentLabel,
    cancellingReservationLabel,
    completeCoachMutation,
    completingAppointmentLabel,
    confirmCoachMutation,
    confirmingAppointmentLabel,
    declineCoachMutation,
    decliningAppointmentLabel,
    detailBooking,
    handleCancelAppointment,
    handleCancelReservation,
    isCancelling,
    isCoach,
    user?.id
  ]);

  const sectionOptions = isCoach ? COACH_SECTION_OPTIONS : MEMBER_SECTION_OPTIONS;
  const chipOptions = isCoach ? COACH_FILTER_OPTIONS : FILTER_OPTIONS;

  return (
    <View style={base.screen}>
      <Animated.View style={[s.searchAnimWrap, contentStyle]}>
        <View style={s.searchWrap}>
          <View style={s.searchRow}>
            <View style={s.searchFieldWrap}>
              <FitSearch
                placeholder={isCoach ? "Search schedule..." : "Search bookings..."}
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
          onChipChange={(value) => setStatusFilter(value as ExtendedStatusFilter)}
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
        onTouchStart={() => { setFabOpen(false); }}
        scrollEventThrottle={16}
      >
        <Animated.View style={contentStyle}>
          {isLoading ? (
            <View style={s.emptyState}>
              <CalendarDays size={40} color={colors.textMuted} strokeWidth={1.5} />
              <FitText style={s.emptyTitle}>{isCoach ? "Loading coach schedule" : activeSection === "bookings" ? "Loading reservations" : "Loading appointments"}</FitText>
              <FitText style={s.emptyHint}>Please wait a moment</FitText>
            </View>
          ) : errorText ? (
            <View style={s.emptyState}>
              <CalendarDays size={40} color={colors.textMuted} strokeWidth={1.5} />
              <FitText style={s.emptyTitle}>{isCoach ? "Coach schedule unavailable" : activeSection === "bookings" ? "Reservations unavailable" : "Appointments unavailable"}</FitText>
              <FitText style={s.emptyHint}>{errorText}</FitText>
            </View>
          ) : isEmpty ? (
            <View style={s.emptyState}>
              <CalendarDays size={40} color={colors.textMuted} strokeWidth={1.5} />
              <FitText style={s.emptyTitle}>{isCoach ? "No coach appointments found" : activeSection === "bookings" ? "No reservations" : "No appointments found"}</FitText>
              <FitText style={s.emptyHint}>{isCoach ? "Appointments assigned to you will appear here" : activeSection === "bookings" ? "Your reservations will appear here" : "Your trainer appointments will appear here"}</FitText>
            </View>
          ) : (
            grouped.map(([dateKey, dateBookings]) => (
              <View key={dateKey} style={s.group}>
                <Animated.View style={[s.groupDivider, dividerStyle]} />
                <FitText style={s.groupLabel}>{formatGroupLabel(dateKey)}</FitText>
                <View style={s.groupCards}>
                  {dateBookings.map((booking) => {
                    const amenityIcon = AMENITY_ICONS[booking.resourceName] ?? DEFAULT_AMENITY_ICON;
                    const detailSubtitle = booking.startTime && booking.endTime ? `${booking.startTime} - ${booking.endTime}` : booking.time;
                    return (
                      <View key={booking.id} style={s.cardRow}>
                        <View style={s.cardWrap}>
                          <FitCard
                            icon={isCoach || activeSection === "appointments" ? Users : amenityIcon}
                            iconSize={18}
                            label={booking.resourceName}
                            subtitle={`${formatBookingDate(booking.date)} | ${detailSubtitle}`}
                            trailingLabel={booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            trailingLabelColor={STATUS_COLORS[booking.status] ?? colors.textMuted}
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
