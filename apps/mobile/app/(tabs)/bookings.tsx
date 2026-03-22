import { useState, useMemo, useCallback, useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Activity, Bell, CalendarDays, CalendarCheck, CalendarPlus, Dumbbell, Swords, Users, SlidersHorizontal } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Booking } from "@fittrack/types";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useDebounce } from "@fittrack/hooks";
import { makeScreenStyles, makeBookingsScreenStyles } from "@/styles/shared/ScreenStyles";
import { formatBookingDate } from "@fittrack/utils";
import { STATUS_COLORS, FILTER_OPTIONS, type StatusFilter, getTodayString } from "@/data/bookings";
import { formatGroupLabel, nextDate } from "@/utils/date";
import { groupByDate } from "@/utils/grouping";
import { mobileApi } from "@/lib/api";
import { toMobileBookings, type VenueBookingRecord, type VenueRecord } from "@/utils/venueBookings";

import { FitText } from "@/components/fit/FitText";
import FitCard from "@/components/fit/FitCard";
import FitSearch from "@/components/fit/FitSearch";
import FitFilter from "@/components/fit/FitFilter";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import BookingDetailModal from "@/components/modals/booking/BookingDetailModal";
import AppointmentModal from "@/components/modals/booking/AppointmentModal";

const AMENITY_ICONS: Record<string, LucideIcon> = {
  "Basketball Court": Activity,
  "Boxing Ring": Swords,
  "Volleyball Court": Activity,
  "Gym Area (Front)": Dumbbell,
  "Gym Area (Back)": Dumbbell,
  "Reception": Bell
};

const DEFAULT_AMENITY_ICON: LucideIcon = Dumbbell;

const SECTION_OPTIONS = [
  { label: "Reservations", value: "bookings" },
  { label: "Appointments", value: "appointments" }
];

type AppointmentRecord = {
  id: string;
  coachId?: string;
  scheduledAt: string;
  duration: number;
  status?: "scheduled" | "cancelled" | "completed" | string;
  sessionType?: string | null;
  notes?: string | null;
  coach?: {
    user?: {
      profile?: {
        firstName?: string | null;
        lastName?: string | null;
      } | null;
    } | null;
  } | null;
};

export default function BookingsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { isFabOpen, setFabOpen, registerFAB, unregisterFAB, setReservationOpen, bookingRefreshTick } = useFABState();
  const { ic } = useThemeTransitionAnim();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeBookingsScreenStyles(colors), [colors]);

  const params = useLocalSearchParams<{ openReservation?: string }>();
  const isFrozen = user?.status === "frozen";

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeSection, setActiveSection] = useState<"bookings" | "appointments">("bookings");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isStartCalOpen, setIsStartCalOpen] = useState(false);
  const [isEndCalOpen, setIsEndCalOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: venues = [], isLoading: venuesLoading, error: venuesError } = useQuery<VenueRecord[]>({
    queryKey: ["venues", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      const { data } = await mobileApi.get<VenueRecord[]>("/venues?active=true");
      return data;
    }
  });

  const { data: apiBookings = [], isLoading: bookingsLoading, error: bookingsError, refetch } = useQuery<VenueBookingRecord[]>({
    queryKey: ["bookings", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      const { data } = await mobileApi.get<VenueBookingRecord[]>("/bookings");
      return data;
    }
  });

  const { data: appointmentsRaw = [], isLoading: appointmentsLoading, error: appointmentsError } = useQuery<AppointmentRecord[]>({
    queryKey: ["appointments", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      const { data } = await mobileApi.get<AppointmentRecord[]>("/appointments");
      return data;
    }
  });

  const bookings = useMemo<Booking[]>(() => toMobileBookings(apiBookings, venues), [apiBookings, venues]);
  const appointments = useMemo<Booking[]>(() => appointmentsRaw.map((appointment) => {
    const scheduleDate = new Date(appointment.scheduledAt);
    const end = new Date(scheduleDate.getTime() + appointment.duration * 60_000);
    const firstName = appointment.coach?.user?.profile?.firstName?.trim() ?? "";
    const lastName = appointment.coach?.user?.profile?.lastName?.trim() ?? "";
    const coachName = `${firstName} ${lastName}`.trim() || "Coach Session";
    const startLabel = scheduleDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const endLabel = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return {
      id: appointment.id,
      resourceId: appointment.coachId ?? "coach",
      resourceName: coachName,
      resourceType: "trainer",
      date: scheduleDate.toISOString().slice(0, 10),
      time: `${startLabel} - ${endLabel}`,
      startTime: startLabel,
      endTime: endLabel,
      status: appointment.status === "cancelled" ? "cancelled" : "confirmed",
      trainerName: coachName,
      description: appointment.notes ?? undefined,
      price: 0
    };
  }), [appointmentsRaw]);

  const isLoading = activeSection === "bookings" ? venuesLoading || bookingsLoading : appointmentsLoading;
  const errorText = useMemo(() => {
    if (activeSection === "bookings" && (venuesError || bookingsError)) return "Unable to load bookings.";
    if (activeSection === "appointments" && appointmentsError) return "Unable to load appointments.";
    return "";
  }, [activeSection, appointmentsError, bookingsError, venuesError]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; }
  });

  const menuItems: FABMenuItem[] = useMemo(() => {
    if (isFrozen) return [];
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
  }, [colors.brand, colors.surfaceRaised, setReservationOpen]);

  useEffect(() => {
    if (!user?.id) return;
    void refetch();
  }, [bookingRefreshTick, refetch, user?.id]);

  useFocusEffect(
      useCallback(() => {
        if (params.openReservation === "true" && !isFrozen) setReservationOpen(true);
        registerFAB({ screenIcon: CalendarPlus, menuItems, scrollY, visible: !isFrozen });
        return () => {
          setIsFilterOpen(false);
          unregisterFAB();
        };
      }, [menuItems, params.openReservation, registerFAB, setReservationOpen, unregisterFAB, scrollY])
  );

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const dividerStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.border }));

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      await mobileApi.patch(`/bookings/${bookingId}/cancel`, { cancelReason: "Cancelled by user" });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bookings"] }); }
  });

  const handleStartDateSelect = (date: string) => {
    setStartDate(date);
    if (endDate && endDate <= date) setEndDate("");
    setIsStartCalOpen(false);
  };

  const handleEndDateSelect = (date: string) => {
    if (!startDate) { setEndDate(date); setIsEndCalOpen(false); return; }
    const dueMin = nextDate(startDate);
    setEndDate(date <= startDate ? dueMin : date);
    setIsEndCalOpen(false);
  };

  const handleCancelReservation = async (booking: Booking) => {
    if (booking.status === "cancelled") return;
    setIsCancelling(true);
    try { await cancelBookingMutation.mutateAsync(booking.id); setDetailBooking(null); } catch {}
    setIsCancelling(false);
  };

  const filtered = useMemo(() => {
    let result = activeSection === "bookings" ? bookings : appointments;
    if (statusFilter !== "all") result = result.filter((b) => b.status === statusFilter);
    if (startDate) result = result.filter((b) => b.date >= startDate);
    if (endDate) result = result.filter((b) => b.date <= endDate);
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter((b) =>
          b.resourceName.toLowerCase().includes(q) || (b.trainerName ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeSection, appointments, bookings, statusFilter, startDate, endDate, debouncedSearchQuery]);

  const grouped = groupByDate(filtered, "asc");
  const isEmpty = !isLoading && filtered.length === 0;
  const startLabel = startDate ? formatGroupLabel(startDate) : "All Dates";
  const endLabel = endDate ? formatGroupLabel(endDate) : "Due Date";
  const detailVenue = useMemo(
      () => venues.find((venue) => String(venue.id) === detailBooking?.resourceId) ?? null,
      [detailBooking?.resourceId, venues]
  );

  return (
      <View style={base.screen}>
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
                  onPress={() => { setIsFilterOpen((o) => !o); setFabOpen(false); }}
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
              topChipOptions={SECTION_OPTIONS}
              activeTopChip={activeSection}
              onTopChipChange={(v) => setActiveSection(v as "bookings" | "appointments")}
              topChipLabel="View"
              chipOptions={FILTER_OPTIONS}
              activeChip={statusFilter}
              onChipChange={(v) => setStatusFilter(v as StatusFilter)}
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
                  <FitText style={s.emptyTitle}>
                    {activeSection === "bookings" ? "Loading reservations" : "Loading appointments"}
                  </FitText>
                  <FitText style={s.emptyHint}>Please wait a moment</FitText>
                </View>
            ) : errorText ? (
                <View style={s.emptyState}>
                  <CalendarDays size={40} color={colors.textMuted} strokeWidth={1.5} />
                  <FitText style={s.emptyTitle}>
                    {activeSection === "bookings" ? "Reservations unavailable" : "Appointments unavailable"}
                  </FitText>
                  <FitText style={s.emptyHint}>{errorText}</FitText>
                </View>
            ) : isEmpty ? (
                <View style={s.emptyState}>
                  <CalendarDays size={40} color={colors.textMuted} strokeWidth={1.5} />
                  <FitText style={s.emptyTitle}>
                    {activeSection === "bookings" ? "No reservations" : "No appointments found"}
                  </FitText>
                  <FitText style={s.emptyHint}>
                    {activeSection === "bookings" ? "Your reservations will appear here" : "Your trainer appointments will appear here"}
                  </FitText>
                </View>
            ) : (
                grouped.map(([dateKey, dateBkgs]) => (
                    <View key={dateKey} style={s.group}>
                      <Animated.View style={[s.groupDivider, dividerStyle]} />
                      <FitText style={s.groupLabel}>{formatGroupLabel(dateKey)}</FitText>
                      <View style={s.groupCards}>
                        {dateBkgs.map((booking: Booking) => {
                          const amenityIcon = AMENITY_ICONS[booking.resourceName] ?? DEFAULT_AMENITY_ICON;
                          return (
                              <View key={booking.id} style={s.cardRow}>
                                <View style={s.cardWrap}>
                                  <FitCard
                                      icon={booking.trainerName ? Users : amenityIcon}
                                      iconSize={18}
                                      label={booking.resourceName}
                                      subtitle={`${formatBookingDate(booking.date)} · ${booking.startTime && booking.endTime ? `${booking.startTime} - ${booking.endTime}` : booking.time}`}
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
            onCancelReservation={handleCancelReservation}
            isCancelling={isCancelling}
        />
        <AppointmentModal
            isVisible={isAppointmentOpen}
            onClose={() => setIsAppointmentOpen(false)}
            onSuccess={() => {
              setIsAppointmentOpen(false);
              void queryClient.invalidateQueries({ queryKey: ["appointments"] });
              setActiveSection("appointments");
            }}
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