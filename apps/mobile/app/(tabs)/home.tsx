import { useState, useCallback, useMemo } from "react";
import { ScrollView, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, User, Zap } from "lucide-react-native";
import type { Booking } from "@fittrack/types";
import { bookingsQueryOptions, venuesQueryOptions } from "@fittrack/query";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFABState } from "@/contexts/FABStateContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useHomeFABItems } from "@/hooks/home/useHomeFABItems";

import { makeScreenStyles, makeHomeStyles } from "@/styles/shared/ScreenStyles";
import { getTodayString } from "@/data/bookings";
import { GOAL_ROWS, HOME_STAT_CARDS, HOME_BADGE_BANNER } from "@/data/home";
import { formatBookingDate, formatTodayLong } from "@fittrack/utils";
import { mobileApiClient } from "@/lib/api";
import { toMobileBookings, type VenueBookingRecord } from "@/utils/venueBookings";
import type { NutritionGoal } from "@/components/modals/nutrition/GoalsModal";

import { FitText, AnimatedFitText } from "@/components/fit/FitText";
import FitSection from "@/components/fit/FitSection";
import FitCard from "@/components/fit/FitCard";
import BookingDetailModal from "@/components/modals/booking/BookingDetailModal";

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeHomeStyles(colors), [colors]);

  const [activeGoal, setActiveGoal] = useState<NutritionGoal | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const { registerFAB, unregisterFAB } = useFABState();
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; }
  });

  const menuItems = useHomeFABItems();

  useFocusEffect(useCallback(() => {
    registerFAB({ screenIcon: Zap, menuItems, scrollY, visible: true });
    (async () => {
      try {
        const key = `fittrack_active_nutrition_goal_${user?.id ?? "guest"}`;
        const raw = await AsyncStorage.getItem(key);
        if (raw) setActiveGoal(JSON.parse(raw));
      } catch {
        return;
      }
    })();
    return () => unregisterFAB();
  }, [menuItems, registerFAB, scrollY, unregisterFAB, user?.id]));

  const firstName = user?.name?.split(" ")[0] ?? "Member";
  const todayCalories = user?.currentCalories ?? 0;
  const goalTarget = activeGoal?.targetCalories ?? 2000;
  const todayString = getTodayString();

  const { data: venues = [] } = useQuery(venuesQueryOptions(mobileApiClient, user?.id));
  const { data: bookingRecords = [] } = useQuery(bookingsQueryOptions<VenueBookingRecord>(mobileApiClient, user?.id));

  const bookings = useMemo(() => toMobileBookings(bookingRecords, venues), [bookingRecords, venues]);
  const todayBookings = useMemo(
    () => bookings.filter((b) => b.date === todayString && b.status !== "cancelled"),
    [bookings, todayString]
  );
  const selectedVenue = useMemo(
    () => venues.find((venue) => String(venue.id) === selectedBooking?.resourceId) ?? null,
    [selectedBooking?.resourceId, venues]
  );

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value, backgroundColor: ic.value.base }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const surfaceStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.surface, borderColor: ic.value.border }));
  const greetingNameStyle = useAnimatedStyle(() => ({ color: ic.value.textPrimary }));
  const greetingDateStyle = useAnimatedStyle(() => ({ color: ic.value.textMuted }));

  return (
    <View style={base.screen}>
      <Animated.ScrollView
        style={[base.content, screenStyle]}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Animated.View style={contentStyle}>
          <View style={s.greeting}>
            <AnimatedFitText style={[s.greetingName, greetingNameStyle]}>
              Welcome Back, {firstName}!
            </AnimatedFitText>
            <AnimatedFitText style={[s.greetingDate, greetingDateStyle]}>
              {formatTodayLong()}
            </AnimatedFitText>
          </View>
          <View style={s.statsOuter}>
            <View style={s.statsGrid}>
              <View style={s.statsCol}>
                <View style={s.caloriesCard}>
                  <FitText style={s.caloriesLabel}>Calories</FitText>
                  <FitText style={s.caloriesValue}>{todayCalories.toLocaleString()}</FitText>
                  <FitText style={s.caloriesGoal}>
                    of {goalTarget.toLocaleString()} goal{activeGoal ? ` · ${activeGoal.name}` : ""}
                  </FitText>
                </View>
                {HOME_STAT_CARDS.slice(0, 1).map((stat) => (
                  <Animated.View key={stat.label} style={[s.statCard, surfaceStyle]}>
                    <stat.icon size={18} color={colors.brand} strokeWidth={2} />
                    <FitText style={s.statCardLabel}>{stat.label}</FitText>
                    <FitText style={s.statCardValue}>{stat.value}</FitText>
                    <FitText style={s.statCardSub}>{stat.sub}</FitText>
                  </Animated.View>
                ))}
              </View>
              <View style={s.statsCol}>
                {HOME_STAT_CARDS.slice(1).map((stat) => (
                  <Animated.View key={stat.label} style={[s.statCard, surfaceStyle]}>
                    <stat.icon size={17} color={colors.brand} strokeWidth={2} />
                    <FitText style={s.statCardLabel}>{stat.label}</FitText>
                    <FitText style={s.statCardValue}>{stat.value}</FitText>
                    <FitText style={s.statCardSub}>{stat.sub}</FitText>
                  </Animated.View>
                ))}
              </View>
            </View>
          </View>
          <View style={s.sectionWrap}>
            <FitSection heading="SCHEDULE FOR TODAY">
              {todayBookings.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 20, gap: 6 }}>
                  <CalendarDays size={28} color={colors.textMuted} strokeWidth={1.5} />
                  <FitText style={{ fontSize: 14, color: colors.textMuted }}>No bookings scheduled for today</FitText>
                </View>
              ) : (
                <ScrollView
                  scrollEnabled={todayBookings.length > 2}
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 232 }}
                  nestedScrollEnabled
                >
                  {todayBookings.map((booking, i) => (
                    <FitCard
                      key={booking.id}
                      icon={booking.resourceType === "trainer" ? User : CalendarDays}
                      iconSize={18}
                      label={booking.resourceName}
                      subtitle={`${formatBookingDate(booking.date)} · ${booking.startTime && booking.endTime ? `${booking.startTime} - ${booking.endTime}` : booking.time}`}
                      hasBorder={i < todayBookings.length - 1}
                      onPress={() => setSelectedBooking(booking)}
                    />
                  ))}
                </ScrollView>
              )}
            </FitSection>
          </View>
          <View style={s.sectionWrap}>
            <FitSection heading="WEEKLY ACTIVITIES">
              {GOAL_ROWS.map((row, i) => (
                <FitCard
                  key={row.label}
                  label={row.label}
                  trailingLabel={row.value}
                  trailingLabelColor={row.color}
                  progress={row.progress}
                  noChevron
                  hasBorder={i < GOAL_ROWS.length - 1}
                />
              ))}
            </FitSection>
          </View>
          <View style={s.sectionWrap}>
            <Animated.View style={[s.badgeBanner, surfaceStyle]}>
              <View style={s.badgeIconBox}>
                <FitText style={{ fontSize: 24 }}>🏆</FitText>
              </View>
              <View style={{ flex: 1 }}>
                <FitText style={s.badgeBannerTitle}>{HOME_BADGE_BANNER.title}</FitText>
                <FitText style={s.badgeBannerBody}>{HOME_BADGE_BANNER.body}</FitText>
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.ScrollView>
      <BookingDetailModal
        isVisible={!!selectedBooking}
        booking={selectedBooking}
        venue={selectedVenue}
        onClose={() => setSelectedBooking(null)}
      />
    </View>
  );
}
