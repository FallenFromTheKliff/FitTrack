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
  recurringCoachingPlansQueryOptions,
} from "@fittrack/query";
import type { CoachProfileRecord } from "@fittrack/types";

import { useAccountsPage } from "@/components/accounts/AccountsPageContext";
import { useAuth } from "@/contexts/AuthContext";
import { webApiClient } from "@/lib/api-client";

import { isPaidSession } from "../PaidSessionSchedule";

export type CoachClientWorkspace = {
  activeMonthlyPlan: RecurringCoachingPlanRecord | null;
  clientAppointments: CoachAppointmentScheduleRecord[];
  completedAppointments: CoachAppointmentScheduleRecord[];
  coachProfile: CoachProfileRecord | null;
  coachUserId: string;
  hasActivePaidMonthlySession: boolean;
  hasActivePaidRelationship: boolean;
  hasActivePaidOneSession: boolean;
  hasError: boolean;
  isLoading: boolean;
  isCoachClient: boolean;
  memberId: string;
  nextSession: CoachAppointmentScheduleRecord | null;
  requesterUserId: string;
  upcomingSessions: CoachAppointmentScheduleRecord[];
};

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

  const clientAppointments = useMemo(
    () =>
      (scheduleQuery.data ?? [])
        .filter(
          (appointment) =>
            appointment.userId === memberId &&
            (appointment.status === "confirmed" ||
              appointment.status === "completed"),
        )
        .sort(
          (left, right) =>
            new Date(right.scheduledAt).getTime() -
            new Date(left.scheduledAt).getTime(),
        ),
    [memberId, scheduleQuery.data],
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
          const hasUpcomingPlanSession = clientAppointments.some(
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
    [clientAppointments, memberId, recurringPlansQuery.data],
  );
  const hasActivePaidOneSession = useMemo(
    () =>
      clientAppointments.some(
        (appointment) => {
          const startsAt = new Date(appointment.scheduledAt).getTime();
          const endsAt = startsAt + appointment.duration * 60 * 1000;
          return (
            appointment.status === "confirmed" &&
            !appointment.recurringPlanId &&
            isPaidSession(appointment) &&
            Number.isFinite(startsAt) &&
            endsAt > Date.now()
          );
        },
      ),
    [clientAppointments],
  );
  const hasActivePaidMonthlySession = useMemo(
    () =>
      clientAppointments.some(
        (appointment) =>
          appointment.status === "confirmed" &&
          Boolean(appointment.recurringPlanId) &&
          new Date(appointment.scheduledAt).getTime() >= Date.now(),
      ),
    [clientAppointments],
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
    coachProfile: coachProfileQuery.data ?? null,
    coachUserId: user?.id ?? "",
    hasActivePaidMonthlySession,
    hasActivePaidRelationship,
    hasActivePaidOneSession,
    hasError: Boolean(
      coachProfileQuery.error ||
        recurringPlansQuery.error ||
        scheduleQuery.error,
    ),
    isLoading:
      coachProfileQuery.isLoading ||
      recurringPlansQuery.isLoading ||
      scheduleQuery.isLoading,
    isCoachClient,
    memberId: memberId ?? "",
    nextSession: upcomingSessions[0] ?? null,
    requesterUserId: user?.id ?? "",
    upcomingSessions,
  };
}
