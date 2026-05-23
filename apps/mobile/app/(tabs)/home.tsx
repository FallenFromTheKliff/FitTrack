import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue
} from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import {
  CalendarDays,
  Dumbbell,
  Flame,
  LineChart,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  User,
  Users,
  Zap,
  type LucideIcon
} from "lucide-react-native";
import type {
  CoachAppointmentScheduleRecord,
  VenueBookingRecord,
} from "@fittrack/api-client";
import {
  bookingsQueryOptions,
  coachScheduleQueryOptions,
  fitnessLeaderboardQueryOptions,
  fitnessMasteryQueryOptions,
  fitnessSessionsQueryOptions,
  nutritionActiveTdeeQueryOptions,
  nutritionDailySummaryQueryOptions,
  venuesQueryOptions
} from "@fittrack/query";
import type {
  ActiveNutritionProfileRecord,
  Booking,
  DailyNutritionSummaryRecord,
  FitnessMasteryRank,
  MuscleMasteryRecord,
  WorkoutSessionSummaryRecord
} from "@fittrack/types";
import { formatBookingDate, formatTodayLong } from "@fittrack/utils";
import { toDateTimeRange } from "@fittrack/app-core";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFABState } from "@/contexts/FABStateContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useHomeFABItems } from "@/hooks/home/useHomeFABItems";
import { mobileApiClient } from "@/lib/api-client";
import { makeHomeStyles, makeScreenStyles } from "@/styles/shared/ScreenStyles";
import { STATUS_COLORS, getTodayString } from "@/data/bookings";
import { toMobileBookings } from "@/utils/venueBookings";

import FitCard from "@/components/fit/FitCard";
import FitSection from "@/components/fit/FitSection";
import { AnimatedFitText, FitText } from "@/components/fit/FitText";
import BookingDetailModal from "@/components/modals/booking/BookingDetailModal";

type HomeStatCard = {
  icon: LucideIcon;
  label: string;
  value: string;
};

type HomeSnapshotRow = {
  icon: LucideIcon;
  label: string;
  progress?: number;
  subtitle: string;
  trailingLabel: string;
  trailingLabelColor: string;
};

type HomeQuickAction = {
  icon: LucideIcon;
  key: string;
  label: string;
  onPress: () => void;
  subtitle: string;
};

const RANK_PRIORITY: Record<FitnessMasteryRank, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  adamantite: 5
};

function clampProgress(value: number) {
  return Math.max(0, Math.min(value, 1));
}

function formatCompactNumber(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}`.replace(".0", "") + "K";
  }
  return value.toLocaleString("en-US");
}

function getLocalDayKey(dateLike: string) {
  const date = new Date(dateLike);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getCoachMemberName(appointment: CoachAppointmentScheduleRecord) {
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

function resolveHighestRank(mastery: MuscleMasteryRecord[]) {
  return mastery.reduce<MuscleMasteryRecord | null>((highest, entry) => {
    if (!highest) return entry;
    if (RANK_PRIORITY[entry.rank] > RANK_PRIORITY[highest.rank]) return entry;
    if (
      RANK_PRIORITY[entry.rank] === RANK_PRIORITY[highest.rank] &&
      entry.xpPoints > highest.xpPoints
    ) {
      return entry;
    }
    return highest;
  }, null);
}

function countRecentActiveDays(sessions: WorkoutSessionSummaryRecord[]) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime();
  const activeDays = new Set(
    sessions
      .filter((session) => session.status === "completed")
      .filter((session) => {
        const sourceDate = session.completedAt ?? session.startedAt;
        return new Date(sourceDate).getTime() >= start;
      })
      .map((session) => getLocalDayKey(session.completedAt ?? session.startedAt))
  );
  return activeDays.size;
}

function countRecentCompletedSessions(sessions: WorkoutSessionSummaryRecord[]) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime();
  return sessions.filter((session) => {
    if (session.status !== "completed") return false;
    const sourceDate = session.completedAt ?? session.startedAt;
    return new Date(sourceDate).getTime() >= start;
  }).length;
}

function countCurrentStreakDays(sessions: WorkoutSessionSummaryRecord[]) {
  const completedDayKeys = new Set(
    sessions
      .filter((session) => session.status === "completed")
      .map((session) => getLocalDayKey(session.completedAt ?? session.startedAt))
  );

  let streak = 0;
  const cursor = new Date();
  while (
    completedDayKeys.has(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(
        cursor.getDate()
      ).padStart(2, "0")}`
    )
  ) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeHomeStyles(colors), [colors]);
  const isCoach = user?.role === "COACH";
  const isMember = user?.role === "USER";

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const { registerFAB, unregisterFAB } = useFABState();
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    }
  });

  const menuItems = useHomeFABItems();

  useFocusEffect(
    useCallback(() => {
      registerFAB({ screenIcon: Zap, menuItems, scrollY, visible: isMember });
      return () => unregisterFAB();
    }, [isMember, menuItems, registerFAB, scrollY, unregisterFAB])
  );

  const firstName = user?.name?.split(" ")[0] ?? "Member";
  const todayString = getTodayString();
  const membershipCardStatus = user?.membershipCard?.status ?? "none";
  const hasMemberCardAccess = user?.membershipAccess === "member";
  const memberAccessLabel = membershipCardStatus === "pending_verification"
    ? "Pending"
    : membershipCardStatus === "revoked"
      ? "Revoked"
      : hasMemberCardAccess
        ? "Member"
        : "Locked";
  const memberAccessColor = membershipCardStatus === "pending_verification"
    ? colors.warning
    : membershipCardStatus === "revoked"
      ? colors.danger
      : hasMemberCardAccess
        ? colors.success
        : colors.textMuted;

  const venuesQuery = useQuery({
    ...venuesQueryOptions(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id && isMember
  });
  const bookingsQuery = useQuery({
    ...bookingsQueryOptions<VenueBookingRecord>(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id && isMember
  });
  const coachScheduleQuery = useQuery({
    ...coachScheduleQueryOptions<CoachAppointmentScheduleRecord>(
      mobileApiClient,
      user?.id
    ),
    enabled: isFocused && !!user?.id && isCoach,
    staleTime: 30_000
  });
  const nutritionTargetQuery = useQuery({
    ...nutritionActiveTdeeQueryOptions<ActiveNutritionProfileRecord | null>(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id && isMember && hasMemberCardAccess
  });
  const nutritionSummaryQuery = useQuery({
    ...nutritionDailySummaryQueryOptions<DailyNutritionSummaryRecord>(mobileApiClient, user?.id, todayString),
    enabled: isFocused && !!user?.id && isMember && hasMemberCardAccess
  });
  const masteryQuery = useQuery({
    ...fitnessMasteryQueryOptions(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id && isMember && hasMemberCardAccess
  });
  const leaderboardQuery = useQuery({
    ...fitnessLeaderboardQueryOptions(mobileApiClient, user?.id, { limit: 5, page: 1 }),
    enabled: isFocused && !!user?.id && isMember && hasMemberCardAccess
  });
  const sessionsQuery = useQuery({
    ...fitnessSessionsQueryOptions(mobileApiClient, user?.id, { limit: 50, page: 1 }),
    enabled: isFocused && !!user?.id && isMember && hasMemberCardAccess
  });

  const venues = useMemo(() => venuesQuery.data ?? [], [venuesQuery.data]);
  const bookingRecords = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);
  const bookings = useMemo(() => toMobileBookings(bookingRecords, venues), [bookingRecords, venues]);
  const todayBookings = useMemo(
    () => bookings.filter((booking) => booking.date === todayString && booking.status !== "cancelled"),
    [bookings, todayString]
  );
  const visibleTodayBookings = useMemo(() => todayBookings.slice(0, 4), [todayBookings]);
  const hiddenTodayBookingsCount = Math.max(todayBookings.length - visibleTodayBookings.length, 0);
  const selectedVenue = useMemo(
    () => venues.find((venue) => String(venue.id) === selectedBooking?.resourceId) ?? null,
    [selectedBooking?.resourceId, venues]
  );

  const mastery = masteryQuery.data ?? [];
  const leaderboard = leaderboardQuery.data?.data ?? [];
  const sessions = sessionsQuery.data?.data ?? [];
  const activeNutrition = nutritionTargetQuery.data ?? null;
  const nutritionSummary = nutritionSummaryQuery.data ?? null;

  const loggedCalories = nutritionSummary?.logged.calories ?? user?.currentCalories ?? 0;
  const targetCalories = activeNutrition?.macros.targetCalories ?? nutritionSummary?.target?.calories ?? null;
  const remainingCalories = nutritionSummary?.remaining?.calories ?? (
    targetCalories !== null ? Math.max(targetCalories - loggedCalories, 0) : null
  );
  const totalXp = mastery.reduce((sum, entry) => sum + entry.xpPoints, 0);
  const highestRankEntry = resolveHighestRank(mastery);
  const leaderboardEntry = leaderboard.find((entry) => entry.userId === user?.id) ?? null;
  const completedSessionsLast7Days = countRecentCompletedSessions(sessions);
  const activeDaysLast7Days = countRecentActiveDays(sessions);
  const currentStreakDays = countCurrentStreakDays(sessions);
  const currentTimeLabel = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
  const bookingsLoading = venuesQuery.isPending || bookingsQuery.isPending;
  const bookingsErrorMessage =
    (venuesQuery.error as Error | null)?.message ??
    (bookingsQuery.error as Error | null)?.message ??
    null;
  const memberSnapshotLoading =
    hasMemberCardAccess &&
    (nutritionTargetQuery.isPending ||
      nutritionSummaryQuery.isPending ||
      masteryQuery.isPending ||
      leaderboardQuery.isPending ||
      sessionsQuery.isPending);
  const memberSnapshotError =
    (nutritionTargetQuery.error as Error | null)?.message ??
    (nutritionSummaryQuery.error as Error | null)?.message ??
    (masteryQuery.error as Error | null)?.message ??
    (leaderboardQuery.error as Error | null)?.message ??
    (sessionsQuery.error as Error | null)?.message ??
    null;
  const coachAppointments = useMemo(
    () => coachScheduleQuery.data ?? [],
    [coachScheduleQuery.data]
  );
  const coachTodayAppointments = useMemo(
    () =>
      coachAppointments.filter(
        (appointment) =>
          getLocalDayKey(appointment.scheduledAt) === todayString &&
          appointment.status !== "cancelled"
      ),
    [coachAppointments, todayString]
  );
  const visibleCoachTodayAppointments = useMemo(
    () => coachTodayAppointments.slice(0, 4),
    [coachTodayAppointments]
  );
  const hiddenCoachTodayCount = Math.max(
    coachTodayAppointments.length - visibleCoachTodayAppointments.length,
    0
  );
  const coachClientCount = useMemo(
    () =>
      new Set(
        coachAppointments
          .map((appointment) => appointment.userId)
          .filter(Boolean)
      ).size,
    [coachAppointments]
  );
  const coachEarnings = coachAppointments
    .filter((appointment) => appointment.status === "completed")
    .reduce((sum, appointment) => sum + Number(appointment.coachEarnings ?? 0), 0);
  const coachStats = useMemo<HomeStatCard[]>(
    () => [
      { icon: Users, label: "Clients", value: String(coachClientCount) },
      { icon: CalendarDays, label: "Sessions", value: String(coachAppointments.length) },
      {
        icon: LineChart,
        label: "Earnings",
        value: `PHP ${coachEarnings.toLocaleString("en-PH")}`,
      },
    ],
    [
      coachAppointments.length,
      coachClientCount,
      coachEarnings,
    ]
  );

  const statCards = useMemo<HomeStatCard[]>(() => {
    if (hasMemberCardAccess) {
      return [
        { icon: CalendarDays, label: "Today Bookings", value: String(todayBookings.length) },
        { icon: Dumbbell, label: "7 Day Activity", value: String(activeDaysLast7Days) },
        { icon: Trophy, label: "Gym Rank", value: leaderboardEntry ? `#${leaderboardEntry.rankPosition}` : "--" },
        { icon: Sparkles, label: "Total EXP", value: formatCompactNumber(totalXp) }
      ];
    }

    return [
      { icon: CalendarDays, label: "Today Bookings", value: String(todayBookings.length) },
      { icon: User, label: "Portal Role", value: "Member" },
      { icon: ShieldCheck, label: "Member Access", value: memberAccessLabel },
      { icon: Sparkles, label: "AI Access", value: hasMemberCardAccess ? "Open" : "Locked" }
    ];
  }, [
    activeDaysLast7Days,
    hasMemberCardAccess,
    leaderboardEntry,
    memberAccessLabel,
    todayBookings.length,
    totalXp
  ]);

  const snapshotRows = useMemo<HomeSnapshotRow[]>(() => {
    if (hasMemberCardAccess) {
      return [
        {
          icon: Target,
          label: "Nutrition Target",
          subtitle: targetCalories !== null
            ? `Logged ${loggedCalories.toLocaleString()} of ${targetCalories.toLocaleString()} kcal today.`
            : "No active nutrition target is loaded yet. Open Nutrition to save one.",
          trailingLabel: targetCalories !== null && remainingCalories !== null
            ? `${Math.max(Math.round(remainingCalories), 0)} kcal left`
            : "Set target",
          trailingLabelColor: targetCalories !== null ? colors.brand : colors.textMuted,
          progress: targetCalories !== null ? clampProgress(loggedCalories / targetCalories) : undefined
        },
        {
          icon: Dumbbell,
          label: "Workout Momentum",
          subtitle: `${completedSessionsLast7Days} completed session${completedSessionsLast7Days === 1 ? "" : "s"} across ${activeDaysLast7Days} active day${activeDaysLast7Days === 1 ? "" : "s"} in the last 7 days, with a current ${currentStreakDays}-day streak.`,
          trailingLabel: highestRankEntry?.rankDisplay ?? "Unranked",
          trailingLabelColor: highestRankEntry ? colors.success : colors.textMuted,
          progress: clampProgress(completedSessionsLast7Days / 4)
        },
        {
          icon: Trophy,
          label: "Muscle Mastery",
          subtitle: mastery.length > 0
            ? `${mastery.length} tracked muscle group${mastery.length === 1 ? "" : "s"}. ${highestRankEntry?.muscleGroup ?? "Your top group"} leads the board right now.`
            : "No mastery entries yet. Log a workout to light up the board.",
          trailingLabel: leaderboardEntry ? `#${leaderboardEntry.rankPosition}` : "--",
          trailingLabelColor: leaderboardEntry ? colors.warning : colors.textMuted,
          progress: mastery.length > 0 ? clampProgress(mastery.length / 5) : undefined
        }
      ];
    }

    const accessSubtitle = membershipCardStatus === "pending_verification"
      ? "Your membership card request is already pending verification. Member-only app features unlock after staff approval."
      : membershipCardStatus === "revoked"
        ? "Your membership card access is revoked right now. Ask the front desk to repair it if this looks incorrect."
        : "Buy a membership card to unlock BrodigyAI, Muscle Mastery, workouts, and richer member snapshots.";

    return [
      {
        icon: ShieldCheck,
        label: "Member Access",
        subtitle: accessSubtitle,
        trailingLabel: memberAccessLabel,
        trailingLabelColor: memberAccessColor
      },
      {
        icon: Sparkles,
        label: "Assistant Access",
        subtitle: "BrodigyAI chat and history stay aligned with the same member-card gate used across the mobile member stack.",
        trailingLabel: hasMemberCardAccess ? "Open" : "Locked",
        trailingLabelColor: hasMemberCardAccess ? colors.success : colors.textMuted
      },
      {
        icon: User,
        label: "Next Step",
        subtitle: membershipCardStatus === "pending_verification"
          ? "Stay on standby while staff reviews the payment and activates the card."
          : "Open Profile to buy, verify, or repair a membership card and unlock the full member experience.",
        trailingLabel: membershipCardStatus === "pending_verification" ? "Waiting" : "Open /profile",
        trailingLabelColor: membershipCardStatus === "pending_verification" ? colors.warning : colors.brand
      }
    ];
  }, [
    activeDaysLast7Days,
    colors.brand,
    colors.success,
    colors.textMuted,
    colors.warning,
    completedSessionsLast7Days,
    currentStreakDays,
    hasMemberCardAccess,
    highestRankEntry,
    leaderboardEntry,
    loggedCalories,
    mastery.length,
    memberAccessColor,
    memberAccessLabel,
    membershipCardStatus,
    remainingCalories,
    targetCalories
  ]);

  const quickActions = useMemo<HomeQuickAction[]>(() => {
    if (!hasMemberCardAccess) {
      return [
        {
          key: "book-now",
          icon: CalendarDays,
          label: "Book Now",
          subtitle: "Reserve a venue slot and keep the member flow moving.",
          onPress: () => router.push("/(tabs)/bookings?openReservation=true")
        },
        {
          key: "unlock-access",
          icon: ShieldCheck,
          label: "Unlock Member Access",
          subtitle: "Open Profile to buy, verify, or repair your membership card.",
          onPress: () => router.push("/(tabs)/profile")
        }
      ];
    }

    if (targetCalories === null) {
      return [
        {
          key: "set-target",
          icon: Target,
          label: "Set Nutrition Goal",
          subtitle: "Save a target calorie plan so the home snapshot can coach you better.",
          onPress: () => router.push("/(tabs)/nutrition")
        },
        {
          key: "book-session",
          icon: CalendarDays,
          label: todayBookings.length > 0 ? "View Bookings" : "Book Now",
          subtitle: todayBookings.length > 0
            ? "Review today's schedule and upcoming reservations."
            : "Reserve a slot if you want a session lined up for today.",
          onPress: () =>
            router.push(
              todayBookings.length > 0
                ? "/(tabs)/bookings"
                : "/(tabs)/bookings?openReservation=true"
            )
        }
      ];
    }

    return [
      {
        key: "start-workout",
        icon: Dumbbell,
        label: completedSessionsLast7Days === 0 ? "Start Workout" : "Continue Workout",
        subtitle: completedSessionsLast7Days === 0
          ? "No completed workout is logged this week yet. Start one now."
          : "Keep your current streak alive with another logged session.",
        onPress: () => router.push("/(tabs)/workout")
      },
      {
        key: "book-session",
        icon: CalendarDays,
        label: todayBookings.length > 0 ? "View Schedule" : "Book Now",
        subtitle: todayBookings.length > 0
          ? "Open bookings to review or manage the rest of today's plan."
          : "No booking is lined up for today yet. Reserve one in a few taps.",
        onPress: () =>
          router.push(
            todayBookings.length > 0
              ? "/(tabs)/bookings"
              : "/(tabs)/bookings?openReservation=true"
          )
      }
    ];
  }, [completedSessionsLast7Days, hasMemberCardAccess, router, targetCalories, todayBookings.length]);

  const pinnedGoalCard = useMemo(() => {
    if (!hasMemberCardAccess) {
      return {
        body: membershipCardStatus === "pending_verification"
          ? "Bookings and profile stay usable while AI, workouts, mastery, and deeper home insights unlock after staff verifies the card."
          : membershipCardStatus === "revoked"
            ? "Your member-facing surfaces are partially locked until the membership card is repaired."
            : "This account can still book and manage profile basics, but the richer member stack opens only after a membership card becomes active.",
        icon: ShieldCheck as LucideIcon,
        title: membershipCardStatus === "pending_verification"
          ? "Membership card verification in progress"
          : membershipCardStatus === "revoked"
            ? "Member access needs repair"
            : "Pinned Goal: unlock the full member stack"
      };
    }

    if (memberSnapshotLoading) {
      return {
        body: "Refreshing nutrition, workouts, bookings, and mastery from the live stack.",
        icon: Sparkles as LucideIcon,
        title: "Pinned Goal is loading"
      };
    }

    if (targetCalories === null) {
      return {
        body: "Save a nutrition target so daily calories, recovery planning, and AI coaching can stay anchored to a real goal.",
        icon: Target as LucideIcon,
        title: "Pinned Goal: set your nutrition target"
      };
    }

    if (currentStreakDays < 3) {
      return {
        body: `You are on a ${currentStreakDays}-day streak. Log ${Math.max(3 - currentStreakDays, 1)} more active day${currentStreakDays === 2 ? "" : "s"} to hit the next consistency checkpoint.`,
        icon: Flame as LucideIcon,
        title: "Pinned Goal: build a 3-day streak"
      };
    }

    if (todayBookings.length > 0) {
      return {
        body: `You have ${todayBookings.length} booking${todayBookings.length === 1 ? "" : "s"} today and ${completedSessionsLast7Days} completed workout session${completedSessionsLast7Days === 1 ? "" : "s"} in the last 7 days.`,
        icon: CalendarDays as LucideIcon,
        title: "Pinned Goal: stay on today's plan"
      };
    }

    if (highestRankEntry) {
      return {
        body: `${highestRankEntry.muscleGroup} is currently your strongest tracked group. One more strong session keeps ${highestRankEntry.rankDisplay} momentum moving.`,
        icon: Trophy as LucideIcon,
        title: `Pinned Goal: defend ${highestRankEntry.rankDisplay}`
      };
    }

    return {
      body: "BrodigyAI, bookings, nutrition, and future workouts are already aligned around the current member contract. Your best next move is another workout session.",
      icon: Sparkles as LucideIcon,
      title: "Pinned Goal: keep the member stack moving"
    };
  }, [
    completedSessionsLast7Days,
    currentStreakDays,
    hasMemberCardAccess,
    highestRankEntry,
    memberSnapshotLoading,
    membershipCardStatus,
    targetCalories,
    todayBookings.length
  ]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: ic.value.base
  }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }]
  }));
  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const greetingNameStyle = useAnimatedStyle(() => ({ color: ic.value.textPrimary }));
  const greetingDateStyle = useAnimatedStyle(() => ({ color: ic.value.textMuted }));

  if (isCoach) {
    return (
      <View style={[base.screen, !isFocused && { display: "none" }]}>
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
                {formatTodayLong()} - {currentTimeLabel}
              </AnimatedFitText>
            </View>
            {coachScheduleQuery.error ? (
              <FitText style={{ fontSize: 12, color: colors.warning, marginBottom: 12 }}>
                {(coachScheduleQuery.error as Error).message}
              </FitText>
            ) : null}
            <View style={s.statsOuter}>
              <View style={s.statsGrid}>
                {coachStats.map((card) => (
                  <Animated.View key={card.label} style={[s.statCard, surfaceStyle]}>
                    <FitCard icon={card.icon} label={card.label} statValue={card.value} iconSize={18} />
                  </Animated.View>
                ))}
              </View>
            </View>
            <View style={s.sectionWrap}>
              <FitSection heading="COACH ACTIONS" bare>
                <View style={s.quickGrid}>
                  {[
                    {
                      key: "clients",
                      icon: Users,
                      label: "Clients",
                      subtitle: "Review member profiles and client readiness.",
                      onPress: () => router.push("/(tabs)/bookings?coachView=clients"),
                    },
                    {
                      key: "sessions",
                      icon: CalendarDays,
                      label: "Sessions",
                      subtitle: "Track coaching appointments and session status.",
                      onPress: () => router.push("/(tabs)/bookings?coachView=appointments"),
                    },
                    {
                      key: "earnings",
                      icon: LineChart,
                      label: "Earnings",
                      subtitle: "Review completed coaching work and expected earnings.",
                      onPress: () => router.push("/(tabs)/bookings?coachView=earnings"),
                    },
                  ].map((action) => (
                    <Pressable
                      key={action.key}
                      onPress={action.onPress}
                      style={s.quickCard}
                    >
                      <View style={[s.quickIconBox, { backgroundColor: colors.brand + "18" }]}>
                        <action.icon size={20} color={colors.brand} strokeWidth={1.8} />
                      </View>
                      <View>
                        <FitText style={s.quickLabel}>{action.label}</FitText>
                        <FitText style={s.quickSub}>{action.subtitle}</FitText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </FitSection>
            </View>
            <View style={s.sectionWrap}>
              <FitSection
                heading="TODAY'S COACHING SCHEDULE"
                subtitle="Tap Bookings to open the full coach session queue."
              >
                {coachScheduleQuery.isPending ? (
                  <View style={{ alignItems: "center", paddingVertical: 20, gap: 6 }}>
                    <CalendarDays size={28} color={colors.textMuted} strokeWidth={1.5} />
                    <FitText style={{ fontSize: 14, color: colors.textMuted }}>
                      Loading coach sessions...
                    </FitText>
                  </View>
                ) : coachTodayAppointments.length === 0 ? (
                  <View style={{ alignItems: "center", paddingVertical: 20, gap: 6 }}>
                    <CalendarDays size={28} color={colors.textMuted} strokeWidth={1.5} />
                    <FitText style={{ fontSize: 14, color: colors.textMuted }}>
                      No coach sessions scheduled for today
                    </FitText>
                  </View>
                ) : (
                  <View>
                    {visibleCoachTodayAppointments.map((appointment, index) => {
                      const { startLabel, endLabel, date } = toDateTimeRange(
                        appointment.scheduledAt,
                        appointment.duration
                      );
                      const status = appointment.status ?? "pending";
                      const statusLabel = status
                        .split("_")
                        .filter(Boolean)
                        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                        .join(" ");
                      return (
                        <FitCard
                          key={appointment.id}
                          icon={User}
                          iconSize={18}
                          label={getCoachMemberName(appointment)}
                          subtitle={`${formatBookingDate(date)} - ${startLabel} - ${endLabel}`}
                          trailingLabel={statusLabel}
                          trailingLabelColor={STATUS_COLORS[status] ?? colors.textMuted}
                          hasBorder={index < visibleCoachTodayAppointments.length - 1 || hiddenCoachTodayCount > 0}
                          onPress={() => router.push("/(tabs)/bookings?coachView=appointments")}
                        />
                      );
                    })}
                    {hiddenCoachTodayCount > 0 ? (
                      <View style={s.scheduleOverflowNote}>
                        <FitText style={s.scheduleOverflowText}>
                          {hiddenCoachTodayCount} more session{hiddenCoachTodayCount === 1 ? "" : "s"} today. Check Bookings to see the rest.
                        </FitText>
                      </View>
                    ) : null}
                  </View>
                )}
              </FitSection>
            </View>
          </Animated.View>
        </Animated.ScrollView>
      </View>
    );
  }

  return (
    <View style={[base.screen, !isFocused && { display: "none" }]}>
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
              {formatTodayLong()} • {currentTimeLabel}
            </AnimatedFitText>
          </View>
          {bookingsErrorMessage || memberSnapshotError ? (
            <FitText style={{ fontSize: 12, color: colors.warning, marginBottom: 12 }}>
              {bookingsErrorMessage ?? memberSnapshotError}
            </FitText>
          ) : null}
          <View style={s.statsOuter}>
            <View style={s.statsGrid}>
              {statCards.map((card) => (
                <Animated.View key={card.label} style={[s.statCard, surfaceStyle]}>
                  <FitCard icon={card.icon} label={card.label} statValue={card.value} iconSize={18} />
                </Animated.View>
              ))}
            </View>
          </View>
          <View style={s.sectionWrap}>
            <Animated.View style={[s.badgeBanner, surfaceStyle]}>
              <View style={s.badgeIconBox}>
                <pinnedGoalCard.icon size={22} color={colors.brand} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <FitText style={s.badgeBannerTitle}>{pinnedGoalCard.title}</FitText>
                <FitText style={s.badgeBannerBody}>{pinnedGoalCard.body}</FitText>
              </View>
            </Animated.View>
          </View>
          <View style={s.sectionWrap}>
            <FitSection
              heading="SCHEDULE FOR TODAY"
              subtitle="Use the home FAB when you want to book a venue or coach slot."
            >
              {bookingsLoading ? (
                <View style={{ alignItems: "center", paddingVertical: 20, gap: 6 }}>
                  <CalendarDays size={28} color={colors.textMuted} strokeWidth={1.5} />
                  <FitText style={{ fontSize: 14, color: colors.textMuted }}>Loading today's schedule...</FitText>
                </View>
              ) : bookingsErrorMessage ? (
                <View style={{ alignItems: "center", paddingVertical: 20, gap: 6 }}>
                  <CalendarDays size={28} color={colors.warning} strokeWidth={1.5} />
                  <FitText style={{ fontSize: 14, color: colors.textMuted, textAlign: "center" }}>
                    Schedule data is temporarily unavailable. Reopen the screen to try again.
                  </FitText>
                </View>
              ) : todayBookings.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 20, gap: 6 }}>
                  <CalendarDays size={28} color={colors.textMuted} strokeWidth={1.5} />
                  <FitText style={{ fontSize: 14, color: colors.textMuted }}>No bookings scheduled for today</FitText>
                </View>
              ) : (
                <View>
                  {visibleTodayBookings.map((booking, index) => (
                    <FitCard
                      key={booking.id}
                      icon={booking.resourceType === "trainer" ? User : CalendarDays}
                      iconSize={18}
                      label={booking.resourceName}
                      subtitle={`${formatBookingDate(booking.date)} - ${booking.startTime && booking.endTime ? `${booking.startTime} - ${booking.endTime}` : booking.time}`}
                      hasBorder={index < visibleTodayBookings.length - 1 || hiddenTodayBookingsCount > 0}
                      onPress={() => setSelectedBooking(booking)}
                    />
                  ))}
                  {hiddenTodayBookingsCount > 0 ? (
                    <View style={s.scheduleOverflowNote}>
                      <FitText style={s.scheduleOverflowText}>
                        {hiddenTodayBookingsCount} more booking{hiddenTodayBookingsCount === 1 ? "" : "s"} today. Check Bookings to see the rest.
                      </FitText>
                    </View>
                  ) : null}
                </View>
              )}
            </FitSection>
          </View>
          <View style={s.sectionWrap}>
            <FitSection heading="LIVE SNAPSHOT">
              {snapshotRows.map((row, index) => (
                <FitCard
                  key={row.label}
                  icon={row.icon}
                  iconSize={18}
                  label={row.label}
                  subtitle={row.subtitle}
                  trailingLabel={row.trailingLabel}
                  trailingLabelColor={row.trailingLabelColor}
                  progress={row.progress}
                  noChevron
                  hasBorder={index < snapshotRows.length - 1}
                />
              ))}
            </FitSection>
          </View>
          <View style={s.sectionWrap}>
            <FitSection heading="WORKOUT SUGGESTIONS" bare>
              <View style={s.quickGrid}>
                {quickActions.map((action) => (
                  <Pressable
                    key={action.key}
                    onPress={action.onPress}
                    style={s.quickCard}
                  >
                    <View style={[s.quickIconBox, { backgroundColor: colors.brand + "18" }]}>
                      <action.icon size={20} color={colors.brand} strokeWidth={1.8} />
                    </View>
                    <View>
                      <FitText style={s.quickLabel}>{action.label}</FitText>
                      <FitText style={s.quickSub}>{action.subtitle}</FitText>
                    </View>
                  </Pressable>
                ))}
              </View>
            </FitSection>
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
