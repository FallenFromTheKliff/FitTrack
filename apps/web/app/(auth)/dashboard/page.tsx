"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  Dumbbell,
  Flame,
  Lock,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { formatBookingDate, formatTodayLong } from "@fittrack/utils";

import { useAuth } from "@/contexts/AuthContext";
import {
  EmptyState,
  MemberCard,
  MemberGrid,
  MemberOnlyScreen,
  MemberPanelHeader,
  MemberProgressRow,
  MemberSection,
  MemberSurface,
  MemberText,
  MemberToneSurface,
  PremiumGate,
  StatTile,
} from "@/components/member-only/MemberOnlyPrimitives";
import {
  clampProgress,
  countCurrentStreakDays,
  countRecentActiveDays,
  countRecentCompletedSessions,
  formatCalorieDelta,
  formatCompactNumber,
  formatGoalLabel,
  formatStatusLabel,
  getTodayString,
  resolveHighestRank,
  toMemberBookings,
} from "@/components/member-only/memberOnlyUtils";
import { getStatusTone } from "@/components/member-only/MemberOnlyPageShared";
import { useMemberOnlyAccess, useMemberOnlyHomeData } from "@/hooks/member-only/useMemberOnlyData";

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading, user } = useAuth();
  const access = useMemberOnlyAccess("Home insights");
  const { hasMemberCardAccess, membershipCardStatus } = access;
  const todayString = getTodayString();
  const firstName = user?.name?.split(" ")[0] ?? "Member";
  const memberUserId = user?.role === "USER" ? user.id : undefined;
  const data = useMemberOnlyHomeData({ hasMemberCardAccess: user?.role === "USER" && hasMemberCardAccess, todayString, userId: memberUserId });

  const venues = useMemo(() => data.venuesQuery.data ?? [], [data.venuesQuery.data]);
  const bookings = useMemo(() => toMemberBookings(data.bookingsQuery.data ?? [], venues), [data.bookingsQuery.data, venues]);
  const todayBookings = bookings.filter((booking) => booking.date === todayString && booking.status !== "cancelled");
  const mastery = data.masteryQuery.data ?? [];
  const leaderboard = data.leaderboardQuery.data?.data ?? [];
  const sessions = data.sessionsQuery.data?.data ?? [];
  const activeNutrition = data.nutritionTargetQuery.data ?? null;
  const nutritionSummary = data.nutritionSummaryQuery.data ?? null;
  const loggedCalories = nutritionSummary?.logged.calories ?? user?.currentCalories ?? 0;
  const targetCalories = activeNutrition?.macros.targetCalories ?? nutritionSummary?.target?.calories ?? null;
  const totalXp = mastery.reduce((sum, entry) => sum + entry.xpPoints, 0);
  const highestRankEntry = resolveHighestRank(mastery);
  const leaderboardEntry = leaderboard.find((entry) => entry.userId === user?.id) ?? null;
  const activeDaysLast7Days = countRecentActiveDays(sessions);
  const currentStreakDays = countCurrentStreakDays(sessions);
  const completedSessionsLast7Days = countRecentCompletedSessions(sessions);
  const statusTone = membershipCardStatus === "revoked" ? "danger" : membershipCardStatus === "pending_verification" ? "warning" : hasMemberCardAccess ? "success" : "muted";

  useEffect(() => {
    if (isLoading) return;
    if (user?.role === "USER") return;

    if (user?.role === "ADMIN") {
      router.replace("/analytics");
      return;
    }

    router.replace("/accounts");
  }, [isLoading, router, user?.role]);

  if (user?.role === "USER") {
    return (
      <MemberOnlyScreen>
        <MemberText as="h1" variant="title">
          Hi {firstName}, {formatTodayLong()}
        </MemberText>
        <MemberText as="p" variant="subtitle">
          Your web view reads the same member bookings, nutrition, workout, ranking, and AI records used by mobile.
        </MemberText>

        <MemberGrid columns={4} compactPair>
          <StatTile icon={CalendarDays} label="Today Bookings" value={String(todayBookings.length)} />
          <StatTile icon={Dumbbell} label="7 Day Activity" value={String(activeDaysLast7Days)} />
          <StatTile icon={Trophy} label="Gym Rank" value={leaderboardEntry ? `#${leaderboardEntry.rankPosition}` : "--"} />
          <StatTile icon={Sparkles} label="Total EXP" value={formatCompactNumber(totalXp)} />
        </MemberGrid>

        {!hasMemberCardAccess ? (
          <PremiumGate
            actionHref="/profile"
            actionLabel="Open Membership Details"
            icon={Lock}
            message={access.lockMessage}
            statusLabel={access.statusLabel}
            title="Member-only tools stay synced after verification"
          />
        ) : null}

        <MemberSection heading="Snapshot">
          <MemberGrid columns={2}>
            <MemberToneSurface tone={statusTone}>
              <MemberPanelHeader eyebrow="Access" title={access.statusLabel} />
              <MemberText variant="muted">
                {hasMemberCardAccess
                  ? "Member-only web pages are unlocked for this account."
                  : "Profile verification controls the same unlock state as mobile."}
              </MemberText>
            </MemberToneSurface>
            <MemberSurface padded>
              <MemberPanelHeader eyebrow="Nutrition" title={targetCalories ? `${loggedCalories} / ${targetCalories} kcal` : `${loggedCalories} kcal logged`} />
              <MemberProgressRow
                label={activeNutrition ? formatGoalLabel(activeNutrition.tdee.fitnessGoal) : "Daily target"}
                progress={targetCalories ? clampProgress(loggedCalories / targetCalories) : 0}
                value={targetCalories ? formatCalorieDelta(loggedCalories, targetCalories) : "Set a target on mobile or web"}
                tone={targetCalories && loggedCalories > targetCalories ? "warning" : "success"}
              />
            </MemberSurface>
          </MemberGrid>
        </MemberSection>

        <MemberSection heading="Today">
          <MemberSurface>
            {todayBookings.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No bookings today" hint="Reservations and coaching sessions will appear here as soon as they exist." />
            ) : (
              todayBookings.slice(0, 4).map((booking, index) => (
                <MemberCard
                  key={booking.id}
                  hasBorder={index < Math.min(todayBookings.length, 4) - 1}
                  icon={CalendarCheck}
                  label={booking.resourceName}
                  subtitle={`${formatBookingDate(booking.date)} | ${booking.time}`}
                  trailingLabel={formatStatusLabel(booking.status)}
                  trailingTone={getStatusTone(booking.status)}
                  onClick={() => router.push("/bookings")}
                />
              ))
            )}
          </MemberSurface>
        </MemberSection>

        <MemberSection heading="Training">
          <MemberGrid columns={3}>
            <StatTile icon={Flame} label="Current Streak" value={`${currentStreakDays}d`} tone="warning" />
            <StatTile icon={Zap} label="Completed This Week" value={String(completedSessionsLast7Days)} tone="success" />
            <StatTile icon={Trophy} label="Top Muscle" value={highestRankEntry?.muscleGroup ?? "Start"} tone="brand" />
          </MemberGrid>
        </MemberSection>
      </MemberOnlyScreen>
    );
  }

  return null;
}
