import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse } from "../request";

export type RecurringCoachingFrequency = "weekly" | "biweekly";
export type RecurringCoachingPlanStatus =
  | "active"
  | "paused"
  | "cancelled"
  | "completed";
export type RecurringCoachingBillingCycleStatus =
  | "due"
  | "processing"
  | "awaiting_verification"
  | "paid"
  | "overdue"
  | "cancelled";
export type RecurringCoachingSessionState =
  | "generated"
  | "skipped"
  | "individually_rescheduled"
  | "cancelled"
  | "completed";

export type RecurringCoachingPlanInput = {
  coachId: string;
  durationMinutes?: number;
  durationMonths?: number;
  endDate?: string;
  frequency: RecurringCoachingFrequency;
  memberId: string;
  memberNotes?: string;
  preferredDays: number[];
  preferredTime: string;
  sessionOverrides?: RecurringCoachingSessionOverrideInput[];
  startDate: string;
};

export type RecurringCoachingSessionOverrideInput = {
  action: "schedule" | "skip" | "reschedule" | "swap_coach";
  coachId?: string;
  newScheduledAt?: string;
  reason?: string;
  scheduledAt: string;
};

export type UpdateRecurringCoachingSessionInput = {
  action: "reschedule" | "skip";
  coachId?: string;
  newScheduledAt?: string;
  reason?: string;
};

export type BulkUpdateRecurringCoachingSessionsInput = {
  coachId?: string;
  frequency?: RecurringCoachingFrequency;
  fromSessionId: string;
  preferredDays?: number[];
  preferredTime?: string;
};

export type RecurringCoachingBillingCyclePaymentInput = {
  provider: "paymongo" | "cash";
  referenceNo?: string;
  screenshotUrl?: string;
};

export type RecurringCoachingBillingCycleRecord = {
  amount: string;
  cycleEndDate: string;
  cycleStartDate: string;
  dueDate: string;
  gracePeriodEndsAt: string;
  id: string;
  paidAt: string | null;
  paymentId: string | null;
  recurringPlanId: string;
  status: RecurringCoachingBillingCycleStatus;
};

export type RecurringCoachingPreviewSession = {
  coachId: string;
  conflict: boolean;
  conflictReasons: string[];
  durationMinutes: number;
  endsAt: string;
  originalScheduledAt: string | null;
  recurringState: RecurringCoachingSessionState;
  scheduledAt: string;
  status: string;
};

export type RecurringCoachingPlanRecord = {
  billingCycles?: RecurringCoachingBillingCycleRecord[];
  coachId: string;
  completedSessions: number;
  endDate: string;
  frequency: RecurringCoachingFrequency;
  id: string;
  memberId: string;
  preferredDays: number[];
  preferredTime: string;
  startDate: string;
  status: RecurringCoachingPlanStatus;
  totalSessions: number;
};

export type RecurringCoachingPlanSessionRecord = {
  coachId: string;
  conflict: boolean;
  durationMinutes: number;
  exceptionOverride: boolean;
  id: string;
  recurringPlanId: string;
  recurringState: RecurringCoachingSessionState | null;
  scheduledAt: string;
  status: string;
};

export type RecurringCoachingPlanPreviewResult = {
  canConfirm: boolean;
  conflictCount: number;
  sessions: RecurringCoachingPreviewSession[];
  totalSessions: number;
  venueConflictsChecked: boolean;
  venueConflictsNote: string;
};

export type RecurringCoachingPlanMutationResult = {
  plan: RecurringCoachingPlanRecord;
  sessions: RecurringCoachingPlanSessionRecord[];
};

export type RecurringCoachingBillingCyclePaymentResult = {
  billingCycle: RecurringCoachingBillingCycleRecord;
  checkoutUrl: string | null;
  paymentId: string;
};

type PreviewSessionApiRecord = {
  coach_id: string;
  conflict: boolean;
  conflict_reasons: string[];
  duration_minutes: number;
  ends_at: string;
  original_scheduled_at: string | null;
  recurring_state: RecurringCoachingSessionState;
  scheduled_at: string;
  status: string;
};

type PreviewApiRecord = {
  can_confirm: boolean;
  conflict_count: number;
  sessions: PreviewSessionApiRecord[];
  total_sessions: number;
  venue_conflicts_checked: boolean;
  venue_conflicts_note: string;
};

type PlanApiRecord = {
  billing_cycles?: BillingCycleApiRecord[];
  coach_id: string;
  completed_sessions: number;
  end_date: string;
  frequency: RecurringCoachingFrequency;
  id: string;
  member_id: string;
  preferred_days: number[];
  preferred_time: string;
  start_date: string;
  status: RecurringCoachingPlanStatus;
  total_sessions: number;
};

type BillingCycleApiRecord = {
  amount: string;
  cycle_end_date: string;
  cycle_start_date: string;
  due_date: string;
  grace_period_ends_at: string;
  id: string;
  paid_at: string | null;
  payment_id: string | null;
  recurring_plan_id: string;
  status: RecurringCoachingBillingCycleStatus;
};

type PlanSessionApiRecord = {
  coach_id: string;
  conflict: boolean;
  duration_minutes: number;
  exception_override: boolean;
  id: string;
  recurring_plan_id: string;
  recurring_state: RecurringCoachingSessionState | null;
  scheduled_at: string;
  status: string;
};

type PlanMutationApiRecord = {
  plan: PlanApiRecord;
  sessions: PlanSessionApiRecord[];
};

type BillingCyclePaymentApiRecord = {
  billing_cycle: BillingCycleApiRecord;
  checkout_url: string | null;
  payment_id: string;
};

function toPlanPayload(input: RecurringCoachingPlanInput) {
  return {
    coach_id: input.coachId,
    ...(input.durationMinutes !== undefined
      ? { duration_minutes: input.durationMinutes }
      : {}),
    ...(input.durationMonths !== undefined
      ? { duration_months: input.durationMonths }
      : {}),
    ...(input.endDate ? { end_date: input.endDate } : {}),
    frequency: input.frequency,
    member_id: input.memberId,
    ...(input.memberNotes ? { member_notes: input.memberNotes } : {}),
    preferred_days: input.preferredDays,
    preferred_time: input.preferredTime,
    ...(input.sessionOverrides?.length
      ? {
          session_overrides: input.sessionOverrides.map((override) => ({
            action: override.action,
            ...(override.coachId ? { coach_id: override.coachId } : {}),
            ...(override.newScheduledAt
              ? { new_scheduled_at: override.newScheduledAt }
              : {}),
            ...(override.reason ? { reason: override.reason } : {}),
            scheduled_at: override.scheduledAt,
          })),
        }
      : {}),
    start_date: input.startDate,
  };
}

function toBulkPayload(input: BulkUpdateRecurringCoachingSessionsInput) {
  return {
    ...(input.coachId ? { coach_id: input.coachId } : {}),
    ...(input.frequency ? { frequency: input.frequency } : {}),
    from_session_id: input.fromSessionId,
    ...(input.preferredDays ? { preferred_days: input.preferredDays } : {}),
    ...(input.preferredTime ? { preferred_time: input.preferredTime } : {}),
  };
}

function mapPreviewSession(
  record: PreviewSessionApiRecord,
): RecurringCoachingPreviewSession {
  return {
    coachId: record.coach_id,
    conflict: record.conflict,
    conflictReasons: record.conflict_reasons,
    durationMinutes: record.duration_minutes,
    endsAt: record.ends_at,
    originalScheduledAt: record.original_scheduled_at,
    recurringState: record.recurring_state,
    scheduledAt: record.scheduled_at,
    status: record.status,
  };
}

function mapPreview(
  record: PreviewApiRecord,
): RecurringCoachingPlanPreviewResult {
  return {
    canConfirm: record.can_confirm,
    conflictCount: record.conflict_count,
    sessions: record.sessions.map(mapPreviewSession),
    totalSessions: record.total_sessions,
    venueConflictsChecked: record.venue_conflicts_checked,
    venueConflictsNote: record.venue_conflicts_note,
  };
}

function mapPlan(record: PlanApiRecord): RecurringCoachingPlanRecord {
  return {
    billingCycles: record.billing_cycles?.map(mapBillingCycle),
    coachId: record.coach_id,
    completedSessions: record.completed_sessions,
    endDate: record.end_date,
    frequency: record.frequency,
    id: record.id,
    memberId: record.member_id,
    preferredDays: record.preferred_days,
    preferredTime: record.preferred_time,
    startDate: record.start_date,
    status: record.status,
    totalSessions: record.total_sessions,
  };
}

function mapBillingCycle(
  record: BillingCycleApiRecord,
): RecurringCoachingBillingCycleRecord {
  return {
    amount: record.amount,
    cycleEndDate: record.cycle_end_date,
    cycleStartDate: record.cycle_start_date,
    dueDate: record.due_date,
    gracePeriodEndsAt: record.grace_period_ends_at,
    id: record.id,
    paidAt: record.paid_at,
    paymentId: record.payment_id,
    recurringPlanId: record.recurring_plan_id,
    status: record.status,
  };
}

function mapSession(
  record: PlanSessionApiRecord,
): RecurringCoachingPlanSessionRecord {
  return {
    coachId: record.coach_id,
    conflict: record.conflict,
    durationMinutes: record.duration_minutes,
    exceptionOverride: record.exception_override,
    id: record.id,
    recurringPlanId: record.recurring_plan_id,
    recurringState: record.recurring_state,
    scheduledAt: record.scheduled_at,
    status: record.status,
  };
}

function mapMutationResult(
  record: PlanMutationApiRecord,
): RecurringCoachingPlanMutationResult {
  return {
    plan: mapPlan(record.plan),
    sessions: record.sessions.map(mapSession),
  };
}

function mapBillingCyclePaymentResult(
  record: BillingCyclePaymentApiRecord,
): RecurringCoachingBillingCyclePaymentResult {
  return {
    billingCycle: mapBillingCycle(record.billing_cycle),
    checkoutUrl: record.checkout_url,
    paymentId: record.payment_id,
  };
}

export function createRecurringCoachingPlansApi(transport: ApiTransport) {
  return {
    async preview(input: RecurringCoachingPlanInput) {
      const result = await unwrapResponse<PreviewApiRecord>(
        transport.post("/bookings/recurring-coaching-plans/preview", toPlanPayload(input)),
        "Unable to preview recurring coaching plan.",
      );
      return mapPreview(result);
    },
    async create(input: RecurringCoachingPlanInput) {
      const result = await unwrapResponse<PlanMutationApiRecord>(
        transport.post("/bookings/recurring-coaching-plans", toPlanPayload(input)),
        "Unable to create recurring coaching plan.",
      );
      return mapMutationResult(result);
    },
    async listSessions(planId: string) {
      const result = await unwrapResponse<PlanMutationApiRecord>(
        transport.get(`/bookings/recurring-coaching-plans/${planId}/sessions`),
        "Unable to load recurring coaching plan sessions.",
      );
      return mapMutationResult(result);
    },
    async payBillingCycle(
      planId: string,
      cycleId: string,
      input: RecurringCoachingBillingCyclePaymentInput,
    ) {
      const result = await unwrapResponse<BillingCyclePaymentApiRecord>(
        transport.post(
          `/bookings/recurring-coaching-plans/${planId}/billing-cycles/${cycleId}/pay`,
          {
            provider: input.provider,
            ...(input.referenceNo ? { reference_no: input.referenceNo } : {}),
            ...(input.screenshotUrl ? { screenshot_url: input.screenshotUrl } : {}),
          },
        ),
        "Unable to start recurring coaching billing payment.",
      );
      return mapBillingCyclePaymentResult(result);
    },
    async updateSession(
      planId: string,
      sessionId: string,
      input: UpdateRecurringCoachingSessionInput,
    ) {
      const result = await unwrapResponse<PlanSessionApiRecord>(
        transport.patch(
          `/bookings/recurring-coaching-plans/${planId}/sessions/${sessionId}`,
          {
            action: input.action,
            ...(input.coachId ? { coach_id: input.coachId } : {}),
            ...(input.newScheduledAt
              ? { new_scheduled_at: input.newScheduledAt }
              : {}),
            ...(input.reason ? { reason: input.reason } : {}),
          },
        ),
        "Unable to update recurring coaching session.",
      );
      return mapSession(result);
    },
    async bulkUpdate(planId: string, input: BulkUpdateRecurringCoachingSessionsInput) {
      const result = await unwrapResponse<
        PlanMutationApiRecord | {
          can_confirm: false;
          conflict_count: number;
          sessions: PreviewSessionApiRecord[];
        }
      >(
        transport.patch(
          `/bookings/recurring-coaching-plans/${planId}/sessions/bulk`,
          toBulkPayload(input),
        ),
        "Unable to update recurring coaching sessions.",
      );

      if ("plan" in result) {
        return mapMutationResult(result);
      }

      return {
        canConfirm: result.can_confirm,
        conflictCount: result.conflict_count,
        sessions: result.sessions.map(mapPreviewSession),
      };
    },
    async cancel(planId: string, reason?: string) {
      const result = await unwrapResponse<PlanMutationApiRecord>(
        transport.patch(`/bookings/recurring-coaching-plans/${planId}/cancel`, {
          ...(reason ? { reason } : {}),
        }),
        "Unable to cancel recurring coaching plan.",
      );
      return mapMutationResult(result);
    },
  };
}
