"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  CalendarDays,
  Dumbbell,
  Flame,
  LineChart,
  Lock,
  Map,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { formatBookingDate } from "@fittrack/utils";
import type { StaffAppointmentRecord } from "@fittrack/api-client";
import { coachScheduleQueryOptions } from "@fittrack/query";

import { useAuth } from "@/contexts/AuthContext";
import {
  EmptyState,
  MemberCard,
  MemberGrid,
  MemberOnlyScreen,
  MemberSection,
  MemberSurface,
  PremiumGate,
  StatTile,
} from "@/components/member-only/MemberOnlyPrimitives";
import {
  countCurrentStreakDays,
  countRecentActiveDays,
  countRecentCompletedSessions,
  formatStatusLabel,
  getTodayString,
  toMemberBookings,
} from "@/components/member-only/memberOnlyUtils";
import { getStatusTone } from "@/components/member-only/MemberOnlyPageShared";
import { useMemberOnlyAccess, useMemberOnlyHomeData } from "@/hooks/member-only/useMemberOnlyData";
import { webApiClient } from "@/lib/api-client";

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading, user } = useAuth();
  const access = useMemberOnlyAccess("Home insights");
  const { hasMemberCardAccess } = access;
  const todayString = getTodayString();
  const memberUserId = user?.role === "USER" ? user.id : undefined;
  const data = useMemberOnlyHomeData({ hasMemberCardAccess: user?.role === "USER" && hasMemberCardAccess, todayString, userId: memberUserId });
  const coachAppointmentsQuery = useQuery({
    ...coachScheduleQueryOptions<StaffAppointmentRecord>(webApiClient, user?.id),
    enabled: user?.role === "COACH" && Boolean(user?.id),
    staleTime: 30_000,
  });

  const venues = useMemo(() => data.venuesQuery.data ?? [], [data.venuesQuery.data]);
  const bookings = useMemo(() => toMemberBookings(data.bookingsQuery.data ?? [], venues), [data.bookingsQuery.data, venues]);
  const todayBookings = bookings.filter((booking) => booking.date === todayString && booking.status !== "cancelled");
  const leaderboard = data.leaderboardQuery.data?.data ?? [];
  const sessions = data.sessionsQuery.data?.data ?? [];
  const leaderboardEntry = leaderboard.find((entry) => entry.userId === user?.id) ?? null;
  const activeDaysLast7Days = countRecentActiveDays(sessions);
  const currentStreakDays = countCurrentStreakDays(sessions);
  const completedSessionsLast7Days = countRecentCompletedSessions(sessions);

  useEffect(() => {
    if (isLoading) return;
    if (user?.role === "USER") return;
    if (user?.role === "COACH") return;

    if (user?.role === "ADMIN") {
      router.replace("/analytics");
      return;
    }

    router.replace("/accounts");
  }, [isLoading, router, user?.role]);

  if (user?.role === "COACH") {
    const coachAppointments = coachAppointmentsQuery.data ?? [];
    const coachClientCount = new Set(
      coachAppointments.map((appointment) => appointment.userId).filter(Boolean),
    ).size;
    const totalSessions = coachAppointments.length;
    const totalEarnings = coachAppointments
      .filter((appointment) => appointment.status === "completed")
      .reduce((sum, appointment) => sum + Number(appointment.coachEarnings ?? 0), 0);

    return (
      <MemberOnlyScreen>
        <div className="coach-dashboard-page">
          <MemberGrid columns={3} compactPair>
            <StatTile
              icon={Users}
              label="Clients"
              value={coachAppointmentsQuery.isLoading ? "--" : String(coachClientCount)}
              variant="inline"
            />
            <StatTile
              icon={CalendarDays}
              label="Sessions"
              value={coachAppointmentsQuery.isLoading ? "--" : String(totalSessions)}
              tone="success"
              variant="inline"
            />
            <StatTile
              icon={LineChart}
              label="Earnings"
              value={coachAppointmentsQuery.isLoading ? "--" : `PHP ${totalEarnings.toLocaleString("en-PH")}`}
              tone="warning"
              variant="inline"
            />
          </MemberGrid>

          <MemberSection heading="Coach actions">
            <MemberSurface>
              {[
                {
                  icon: Users,
                  label: "Clients",
                  path: "/accounts",
                  subtitle: "Review member profiles and client readiness.",
                },
                {
                  icon: CalendarCheck,
                  label: "Sessions",
                  path: "/schedule",
                  subtitle: "Track coaching appointments and session status.",
                },
                {
                  icon: LineChart,
                  label: "Earnings",
                  path: "/analytics",
                  subtitle: "Review completed coaching work and expected earnings.",
                },
              ].map((item, index, items) => (
                <MemberCard
                  key={item.path}
                  density="compact"
                  hasBorder={index < items.length - 1}
                  icon={item.icon}
                  label={item.label}
                  subtitle={item.subtitle}
                  onClick={() => router.push(item.path)}
                />
              ))}
            </MemberSurface>
          </MemberSection>
        </div>
      </MemberOnlyScreen>
    );
  }

  if (user?.role === "USER") {
    return (
      <MemberOnlyScreen>
        <MemberGrid columns={3} compactPair>
          <StatTile icon={CalendarDays} label="Today Bookings" value={String(todayBookings.length)} />
          <StatTile icon={Dumbbell} label="7 Day Activity" value={String(activeDaysLast7Days)} />
          <StatTile icon={Trophy} label="Gym Rank" value={leaderboardEntry ? `#${leaderboardEntry.rankPosition}` : "--"} />
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

        <MemberSection heading="Quick Links">
          <MemberSurface>
            {[
              {
                icon: CalendarDays,
                label: "Bookings",
                path: "/bookings",
                subtitle: "Open reservations and coaching appointments.",
              },
              {
                icon: Map,
                label: "Gym Map",
                path: "/facilities",
                subtitle: "Review the live facilities layout and available zones.",
              },
              {
                icon: Users,
                label: "Account Details",
                path: "/profile",
                subtitle: "Manage membership access, profile details, and QR tools.",
              },
            ].map((item, index, items) => (
              <MemberCard
                key={item.path}
                hasBorder={index < items.length - 1}
                icon={item.icon}
                label={item.label}
                subtitle={item.subtitle}
                onClick={() => router.push(item.path)}
              />
            ))}
          </MemberSurface>
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
          <MemberGrid columns={2}>
            <StatTile icon={Flame} label="Current Streak" value={`${currentStreakDays}d`} tone="warning" />
            <StatTile icon={Zap} label="Completed This Week" value={String(completedSessionsLast7Days)} tone="success" />
          </MemberGrid>
        </MemberSection>
      </MemberOnlyScreen>
    );
  }

  return null;
}
