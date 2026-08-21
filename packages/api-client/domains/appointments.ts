import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";
import {
  mapCommerceCheckoutAttempt,
  type CommerceCheckoutApiRecord,
  type CommerceCheckoutAttempt,
  type CommerceCheckoutReturnInput,
} from "./commerce-checkout";

export type AppointmentCoachSummary = {
  contactEmail?: string | null;
  displayName?: string | null;
  hourlyRate?: number | null;
  user?: {
    email?: string | null;
    profile?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
};

export type AppointmentReviewSummary = {
  comment?: string | null;
  createdAt: string;
  id: string;
  rating: number;
  updatedAt: string;
};

export type AppointmentRecord = {
  activePaymentId?: string | null;
  activePaymentProvider?: "cash" | "paymongo" | null;
  activePaymentStatus?: "awaiting_verification" | "completed" | "failed" | "pending" | "processing" | null;
  assessmentReport?: string | null;
  coach?: AppointmentCoachSummary | null;
  coachId?: string;
  coachEarnings?: number | null;
  coachFeedback?: string | null;
  coachPayoutPaidAt?: string | null;
  duration: number;
  gymRevenue?: number | null;
  id: string;
  notes?: string | null;
  review?: AppointmentReviewSummary | null;
  recurringPlanId?: string | null;
  scheduledAt: string;
  sessionNotes?: string | null;
  sessionType?: string | null;
  status?: string;
  totalAmount?: number | null;
};

export type CompleteAppointmentPayload = {
  assessmentReport?: string;
  coachFeedback?: string;
  sessionNotes?: string;
};

export type CoachScheduleRecord = {
  coachId?: string;
  duration: number;
  endTime?: string;
  id: string;
  notes?: string | null;
  scheduledAt: string;
  status?: string;
  user?: {
    email?: string | null;
    profile?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
};

export type CreateAppointmentPayload = CommerceCheckoutReturnInput & {
  bookingMode?: "pack" | "recurring" | "single";
  coachId: string;
  duration: number;
  idempotencyKey?: string;
  notes?: string;
  scheduledAt: string;
  sessionCount?: number;
};

export type RescheduleAppointmentPayload = {
  duration: number;
  idempotencyKey?: string;
  scheduledAt: string;
};

export type AppointmentAvailabilitySlot = {
  available: boolean;
  conflictReasons: string[];
  durationMinutes: number;
  endAt: string;
  startAt: string;
};

export type AppointmentApiRecord = {
  active_payment_id?: string | null;
  active_payment_provider?: "cash" | "paymongo" | null;
  active_payment_status?: "awaiting_verification" | "completed" | "failed" | "pending" | "processing" | null;
  coach?: AppointmentCoachSummary | null;
  coach_earnings?: number | string | null;
  coach_feedback?: string | null;
  coach_payout_paid_at?: string | null;
  assessment_report?: string | null;
  coach_id?: string;
  duration_minutes?: number;
  gym_revenue?: number | string | null;
  id: string;
  member_notes?: string | null;
  notes?: string | null;
  review?: {
    comment?: string | null;
    created_at?: string;
    id: string;
    rating: number;
    updated_at?: string;
  } | null;
  recurring_plan_id?: string | null;
  scheduled_at?: string;
  scheduledAt?: string;
  session_notes?: string | null;
  sessionType?: string | null;
  status?: string;
  total_amount?: number | string | null;
};

function createIdempotencyKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    },
  );
}

function toAmountNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCoachDisplayName(value?: string | null) {
  const displayName = value?.trim();
  if (displayName && !displayName.includes("@")) {
    return displayName;
  }

  return null;
}

function isLegacySeedIdentityEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return Boolean(
    normalized &&
    (normalized.startsWith("seed.member") ||
      normalized.startsWith("seed.staff") ||
      normalized.startsWith("seed.admin")),
  );
}

function mapAppointmentCoach(
  coach?: AppointmentCoachSummary | null,
): AppointmentCoachSummary | null {
  if (!coach) return null;
  const rawCoach = coach as AppointmentCoachSummary & {
    contact_email?: string | null;
    display_name?: string | null;
  };

  return {
    ...coach,
    contactEmail: isLegacySeedIdentityEmail(
      rawCoach.contactEmail ?? rawCoach.contact_email,
    )
      ? null
      : (rawCoach.contactEmail ?? rawCoach.contact_email ?? null),
    displayName: normalizeCoachDisplayName(
      rawCoach.displayName ?? rawCoach.display_name,
    ),
    user: null,
  };
}

function mapAppointmentReview(
  review?: AppointmentApiRecord["review"],
): AppointmentReviewSummary | null {
  if (!review) return null;

  return {
    comment: review.comment ?? null,
    createdAt: review.created_at ?? "",
    id: review.id,
    rating: review.rating,
    updatedAt: review.updated_at ?? "",
  };
}

export function mapAppointmentRecord(record: AppointmentApiRecord): AppointmentRecord {
  const totalAmount = toAmountNumber(record.total_amount);
  const status = record.status;
  const scheduledAt = record.scheduled_at ?? record.scheduledAt ?? "";

  return {
    activePaymentId: record.active_payment_id ?? null,
    activePaymentProvider: record.active_payment_provider ?? null,
    activePaymentStatus: record.active_payment_status ?? null,
    coach: mapAppointmentCoach(record.coach),
    coachEarnings: toAmountNumber(record.coach_earnings),
    coachFeedback: record.coach_feedback ?? null,
    coachPayoutPaidAt: record.coach_payout_paid_at ?? null,
    coachId: record.coach_id,
    duration: record.duration_minutes ?? 0,
    gymRevenue: toAmountNumber(record.gym_revenue),
    id: record.id,
    assessmentReport: record.assessment_report ?? null,
    notes: record.member_notes ?? record.notes ?? null,
    review: mapAppointmentReview(record.review),
    recurringPlanId: record.recurring_plan_id ?? null,
    scheduledAt,
    sessionNotes: record.session_notes ?? null,
    sessionType: record.sessionType ?? null,
    status,
    totalAmount: totalAmount > 0 ? totalAmount : undefined,
  };
}

export function createAppointmentsApi(transport: ApiTransport) {
  return {
    listMine<T>() {
      return unwrapResponse<AppointmentApiRecord[]>(
        transport.get("/coaching/appointments/my"),
        "Unable to load appointments.",
      ).then(
        (records) =>
          records.map((record) => mapAppointmentRecord(record)) as T[],
      );
    },
    create(payload: CreateAppointmentPayload): Promise<CommerceCheckoutAttempt> {
      return unwrapResponse<CommerceCheckoutApiRecord>(
        transport.post(
          "/coaching/appointments",
      {
          coach_id: payload.coachId,
          duration_minutes: payload.duration,
          ...(payload.bookingMode
            ? { booking_mode: payload.bookingMode }
            : {}),
          ...(payload.returnTarget
            ? { return_target: payload.returnTarget }
            : {}),
          ...(payload.returnUrl ? { return_url: payload.returnUrl } : {}),
          ...(payload.notes ? { member_notes: payload.notes } : {}),
          ...(payload.sessionCount !== undefined
            ? { session_count: payload.sessionCount }
            : {}),
          scheduled_at: payload.scheduledAt,
          },
          {
            headers: {
              "Idempotency-Key": payload.idempotencyKey ?? createIdempotencyKey(),
            },
          },
        ),
        "Unable to create appointment.",
      ).then(mapCommerceCheckoutAttempt);
    },
    reschedule(
      appointmentId: string,
      payload: RescheduleAppointmentPayload,
    ): Promise<AppointmentRecord> {
      return unwrapResponse<AppointmentApiRecord>(
        transport.patch(
          `/coaching/appointments/${appointmentId}/reschedule`,
          {
            duration_minutes: payload.duration,
            scheduled_at: payload.scheduledAt,
          },
          {
            headers: {
              "Idempotency-Key": payload.idempotencyKey ?? createIdempotencyKey(),
            },
          },
        ),
        "Unable to reschedule appointment.",
      ).then(mapAppointmentRecord);
    },
    getAvailability(
      coachId: string,
      input: { date: string; durationMinutes: number },
    ): Promise<AppointmentAvailabilitySlot[]> {
      return unwrapResponse<
        Array<{
          available: boolean;
          conflict_reasons: string[];
          duration_minutes: number;
          end_at: string;
          start_at: string;
        }>
      >(
        transport.get(`/coaching/coaches/${coachId}/availability`, {
          params: {
            date: input.date,
            duration_minutes: input.durationMinutes,
          },
        }),
        "Unable to load coach availability.",
      ).then((records) =>
        records.map((record) => ({
          available: record.available,
          conflictReasons: record.conflict_reasons,
          durationMinutes: record.duration_minutes,
          endAt: record.end_at,
          startAt: record.start_at,
        })),
      );
    },
    cancel(appointmentId: string, cancelReason: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaching/appointments/${appointmentId}/cancel`, {
          reason: cancelReason,
        }),
        "Unable to cancel appointment.",
      );
    },
    completeAsCoach(
      appointmentId: string,
      payload?: CompleteAppointmentPayload,
    ) {
      return unwrapVoidResponse(
        transport.patch(`/coaching/appointments/${appointmentId}/complete`, {
          ...(payload?.assessmentReport
            ? { assessment_report: payload.assessmentReport }
            : {}),
          ...(payload?.coachFeedback
            ? { coach_feedback: payload.coachFeedback }
            : {}),
          ...(payload?.sessionNotes
            ? { session_notes: payload.sessionNotes }
            : {}),
        }),
        "Unable to complete appointment.",
      );
    },
  };
}
