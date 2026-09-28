"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  CoachAppointmentScheduleRecord,
  RecurringCoachingPlanRecord,
} from "@fittrack/api-client";
import {
  coachScheduleQueryOptions,
  coachSelfProfileQueryOptions,
  coachVenueWorkQueryOptions,
  recurringCoachingPlansQueryOptions,
} from "@fittrack/query";
import type { CoachProfileRecord } from "@fittrack/types";
import { normalizeBookingStatus } from "@fittrack/app-core";

import { useAccountsPage } from "@/components/accounts/AccountsPageContext";
import { useAuth } from "@/contexts/AuthContext";
import { webApiClient } from "@/lib/api-client";

import { deriveMonthlyCoachingSchedule } from "./monthlyCoachingFlow";

export type CoachClientWorkspace = {
  activeMonthlyPlan: RecurringCoachingPlanRecord | null;
  clientAppointments: CoachClientWorkspaceSession[];
  completedAppointments: CoachClientWorkspaceSession[];
  eligibleOneTimeAppointments: CoachClientWorkspaceSession[];
  coachProfile: CoachProfileRecord | null;
  coachUserId: string;
  hasActivePaidMonthlySession: boolean;
  hasActivePaidRelationship: boolean;
  hasActivePaidOneSession: boolean;
  hasError: boolean;
  isLoading: boolean;
  isCoachClient: boolean;
  memberId: string;
  monthlyPurchasedCount: number;
  monthlyScheduledCount: number;
  monthlySessions: CoachClientWorkspaceSession[];
  monthlySetupRequired: boolean;
  nextSession: CoachClientWorkspaceSession | null;
  requesterUserId: string;
  upcomingSessions: CoachClientWorkspaceSession[];
};

type WorkspaceSessionSource = "appointment" | "venue_coaching";

export type CoachClientWorkspaceSession = CoachAppointmentScheduleRecord & {
  source: WorkspaceSessionSource;
  sourceLabel: string;
};

const VISIBLE_SESSION_STATUSES = new Set([
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

function dateAtEndOfDay(value: string) {
  const normalized = value.includes("T") ? value : `${value}T23:59:59.999`;
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isCurrentPaidCycle(plan: RecurringCoachingPlanRecord, now: number) {
  return Boolean(
    plan.billingCycles?.some(
      (cycle) =>
        cycle.status === "paid" &&
        (dateAtEndOfDay(cycle.cycleEndDate) ?? 0) >= now,
    ),
  );
}

export function useCoachClientWorkspace(memberId?: string): CoachClientWorkspace {
  const { isCoach } = useAccountsPage();
  const { user } = useAuth();
  const isCoachClient = Boolean(isCoach && user?.id && memberId);

  const coachProfileQuery = useQuery({
    ...coachSelfProfileQueryOptions<CoachProfileRecord>(webApiClient, user?.id),
    enabled: isCoachClient,
    staleTime: 30_000,
  });
  const recurringPlansQuery = useQuery({
    ...recurringCoachingPlansQueryOptions(webApiClient),
    enabled: isCoachClient,
    staleTime: 30_000,
  });
  const scheduleQuery = useQuery({
    ...coachScheduleQueryOptions<CoachAppointmentScheduleRecord>(
      webApiClient,
      user?.id,
    ),
    enabled: isCoachClient,
    staleTime: 30_000,
  });
  const coachVenueWorkQuery = useQuery({
    ...coachVenueWorkQueryOptions(webApiClient, user?.id, { limit: 100, page: 1 }),
    enabled: isCoachClient,
    staleTime: 30_000,
  });

  const paidRecurringPlanIds = useMemo(() => {
    const now = Date.now();
    const ids = new Set<string>();
    for (const plan of recurringPlansQuery.data ?? []) {
      if (isCurrentPaidCycle(plan, now)) ids.add(plan.id);
    }
    return ids;
  }, [recurringPlansQuery.data]);

  const paidAppointmentSessions = useMemo(
    () =>
      (scheduleQuery.data ?? [])
        .filter((appointment) => appointment.userId === memberId)
        .filter((appointment) => {
          const status = (appointment.status ?? "").toLowerCase();
          if (!VISIBLE_SESSION_STATUSES.has(status)) return false;
          if (appointment.recurringPlanId) {
            return (
              paidRecurringPlanIds.has(appointment.recurringPlanId) ||
              appointment.activePaymentStatus === "completed"
            );
          }
          return appointment.activePaymentStatus === "completed";
        })
        .map((appointment) => ({
          ...appointment,
          activePaymentStatus:
            appointment.recurringPlanId &&
            paidRecurringPlanIds.has(appointment.recurringPlanId)
              ? "completed"
              : appointment.activePaymentStatus,
          status: (appointment.status ?? "").toLowerCase(),
          source: "appointment" as const,
          sourceLabel: appointment.recurringPlanId
            ? "Monthly coaching"
            : "One-session coaching",
        })),
    [memberId, paidRecurringPlanIds, scheduleQuery.data],
  );

  const venueCoachWorkSessions = useMemo(
    () =>
      (coachVenueWorkQuery.data?.data ?? [])
        .filter((booking) =>
          (booking.userId ?? booking.user?.id ?? "") === memberId,
        )
        .filter((booking) =>
          VISIBLE_SESSION_STATUSES.has(normalizeBookingStatus(booking.status)),
        )
        .map((booking) => ({
          activePaymentStatus: null,
          createdAt:
            booking.createdAt ?? booking.startTime,
          duration: Math.max(0, Math.round(booking.durationHours * 60)),
          id: booking.id,
          recurringPlanId: null,
          scheduledAt: booking.startTime,
          source: "venue_coaching" as const,
          sourceLabel: `Venue coaching (${booking.venue?.name?.trim() || "Venue coaching"})`,
          status: normalizeBookingStatus(booking.status),
          updatedAt:
            booking.createdAt ?? booking.startTime,
          userId:
            booking.userId ?? booking.user?.id ?? memberId ?? "",
        })),
    [coachVenueWorkQuery.data?.data, memberId],
  );

  const clientAppointments = useMemo(
    () =>
      [...paidAppointmentSessions, ...venueCoachWorkSessions]
        .sort(
          (left, right) =>
            new Date(right.scheduledAt).getTime() -
            new Date(left.scheduledAt).getTime(),
        ),
    [paidAppointmentSessions, venueCoachWorkSessions],
  );
  const completedAppointments = useMemo(
    () =>
      clientAppointments.filter(
        (appointment) => appointment.status === "completed",
      ),
    [clientAppointments],
  );
  const upcomingSessions = useMemo(
    () =>
      clientAppointments
        .filter(
          (appointment) =>
            appointment.status === "confirmed" &&
            new Date(appointment.scheduledAt).getTime() >= Date.now(),
        )
        .sort(
          (left, right) =>
            new Date(left.scheduledAt).getTime() -
            new Date(right.scheduledAt).getTime(),
        ),
    [clientAppointments],
  );
  const activeMonthlyPlan = useMemo(
    () =>
      (recurringPlansQuery.data ?? []).find(
        (plan) => {
          const now = Date.now();
          const hasUpcomingPlanSession = paidAppointmentSessions.some(
            (appointment) =>
              appointment.recurringPlanId === plan.id &&
              appointment.status === "confirmed" &&
              new Date(appointment.scheduledAt).getTime() >= now,
          );

          return (
            plan.memberId === memberId &&
            plan.frequency === "monthly" &&
            plan.status === "active" &&
            (dateAtEndOfDay(plan.endDate) ?? 0) >= now &&
            (isCurrentPaidCycle(plan, now) || hasUpcomingPlanSession)
          );
        },
      ) ?? null,
    [memberId, paidAppointmentSessions, recurringPlansQuery.data],
  );
  const {
    monthlyPurchasedCount,
    monthlyScheduledCount,
    monthlySessions,
    monthlySetupRequired,
  } = useMemo(
    () => deriveMonthlyCoachingSchedule(activeMonthlyPlan, clientAppointments),
    [activeMonthlyPlan, clientAppointments],
  );
  const eligibleOneTimeAppointments = useMemo(
    () =>
      paidAppointmentSessions.filter((appointment) => {
        const startsAt = new Date(appointment.scheduledAt).getTime();
        const endsAt = startsAt + appointment.duration * 60 * 1000;
        return (
          appointment.status === "confirmed" &&
          !appointment.recurringPlanId &&
          Number.isFinite(startsAt) &&
          endsAt > Date.now()
        );
      }),
    [paidAppointmentSessions],
  );

  const hasActivePaidOneSession = useMemo(
    () =>
      paidAppointmentSessions.some(
        (appointment) => {
          const startsAt = new Date(appointment.scheduledAt).getTime();
          const endsAt = startsAt + appointment.duration * 60 * 1000;
          return (
            appointment.status === "confirmed" &&
            !appointment.recurringPlanId &&
            Number.isFinite(startsAt) &&
            endsAt > Date.now()
          );
        },
      ),
    [paidAppointmentSessions],
  );
  const hasActivePaidMonthlySession = useMemo(
    () =>
      paidAppointmentSessions.some(
        (appointment) =>
          appointment.status === "confirmed" &&
          appointment.recurringPlanId &&
          new Date(appointment.scheduledAt).getTime() >= Date.now(),
      ),
    [paidAppointmentSessions],
  );
  const hasActivePaidRelationship = Boolean(
    activeMonthlyPlan ||
      hasActivePaidOneSession ||
      hasActivePaidMonthlySession,
  );

  return {
    activeMonthlyPlan,
    clientAppointments,
    completedAppointments,
    eligibleOneTimeAppointments,
    coachProfile: coachProfileQuery.data ?? null,
    coachUserId: user?.id ?? "",
    hasActivePaidMonthlySession,
    hasActivePaidRelationship,
    hasActivePaidOneSession,
    hasError: Boolean(
      coachProfileQuery.error ||
        recurringPlansQuery.error ||
        scheduleQuery.error ||
        coachVenueWorkQuery.error,
    ),
    isLoading:
      coachProfileQuery.isLoading ||
      recurringPlansQuery.isLoading ||
      scheduleQuery.isLoading ||
      coachVenueWorkQuery.isLoading,
    isCoachClient,
    memberId: memberId ?? "",
    monthlyPurchasedCount,
    monthlyScheduledCount,
    monthlySessions,
    monthlySetupRequired,
    nextSession: upcomingSessions[0] ?? null,
    requesterUserId: user?.id ?? "",
    upcomingSessions,
  };
}
