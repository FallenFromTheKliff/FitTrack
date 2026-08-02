import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";

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
  activePaymentStage?: "balance" | "downpayment" | "full" | null;
  activePaymentStatus?: "awaiting_verification" | "completed" | "failed" | "pending" | "processing" | null;
  amountDueNow?: number | null;
  assessmentReport?: string | null;
  balancePaidAt?: string | null;
  coach?: AppointmentCoachSummary | null;
  coachId?: string;
  coachEarnings?: number | null;
  coachFeedback?: string | null;
  coachPayoutPaidAt?: string | null;
  downpaymentPaidAt?: string | null;
  duration: number;
  gymRevenue?: number | null;
  id: string;
  nextPaymentDate?: string | null;
  notes?: string | null;
  paymentPlan?: "downpayment" | "free" | "full";
  remainingBalance?: number | null;
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

export type CreateAppointmentPayload = {
  bookingMode?: "pack" | "recurring" | "single";
  coachId: string;
  duration: number;
  notes?: string;
  scheduledAt: string;
  sessionCount?: number;
};

export type AppointmentCheckoutResponse = {
  appointmentId: string;
  checkoutUrl: string | null;
  paymentId?: string | null;
  status: string;
};

export type AppointmentPaymentProvider = "cash" | "paymongo";
export type AppointmentPaymentStage = "downpayment" | "full";

type AppointmentApiRecord = {
  active_payment_id?: string | null;
  active_payment_provider?: "cash" | "paymongo" | null;
  active_payment_stage?: "balance" | "downpayment" | "full" | null;
  active_payment_status?: "awaiting_verification" | "completed" | "failed" | "pending" | "processing" | null;
  balance_amount?: number | string | null;
  balance_paid_at?: string | null;
  coach?: AppointmentCoachSummary | null;
  coach_earnings?: number | string | null;
  coach_feedback?: string | null;
  coach_payout_paid_at?: string | null;
  assessment_report?: string | null;
  coach_id?: string;
  downpayment_amount?: number | string | null;
  downpayment_paid_at?: string | null;
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

type AppointmentCheckoutApiRecord = {
  appointment_id: string;
  checkout_url?: string | null;
  payment_id?: string | null;
  status: string;
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

function mapAppointmentRecord(record: AppointmentApiRecord): AppointmentRecord {
  const totalAmount = toAmountNumber(record.total_amount);
  const downpaymentAmount = toAmountNumber(record.downpayment_amount);
  const remainingBalance = toAmountNumber(record.balance_amount);
  const status = record.status;
  const scheduledAt = record.scheduled_at ?? record.scheduledAt ?? "";
  const activePaymentStage = record.active_payment_stage ?? null;
  const isPaidInFull = Boolean(record.downpayment_paid_at && record.balance_paid_at);
  const isFullPaymentFlow =
    activePaymentStage === "full" || isPaidInFull;
  const hasSplitPayment = totalAmount > 0 && remainingBalance > 0 && !isPaidInFull;
  const hasPaymentSummary = totalAmount > 0 && downpaymentAmount > 0;

  return {
    activePaymentId: record.active_payment_id ?? null,
    activePaymentProvider: record.active_payment_provider ?? null,
    activePaymentStage,
    activePaymentStatus: record.active_payment_status ?? null,
    amountDueNow: hasPaymentSummary
      ? isFullPaymentFlow
        ? totalAmount
        : status === "pending_payment"
        ? downpaymentAmount
        : remainingBalance > 0 && !record.balance_paid_at
          ? remainingBalance
          : downpaymentAmount
      : undefined,
    balancePaidAt: record.balance_paid_at ?? null,
    coach: mapAppointmentCoach(record.coach),
    coachEarnings: toAmountNumber(record.coach_earnings),
    coachFeedback: record.coach_feedback ?? null,
    coachPayoutPaidAt: record.coach_payout_paid_at ?? null,
    coachId: record.coach_id,
    downpaymentPaidAt: record.downpayment_paid_at ?? null,
    duration: record.duration_minutes ?? 0,
    gymRevenue: toAmountNumber(record.gym_revenue),
    id: record.id,
    assessmentReport: record.assessment_report ?? null,
    nextPaymentDate:
      hasSplitPayment && !record.balance_paid_at ? scheduledAt : undefined,
    notes: record.member_notes ?? record.notes ?? null,
    paymentPlan:
      totalAmount <= 0
        ? "free"
        : isFullPaymentFlow || remainingBalance <= 0
          ? "full"
          : hasSplitPayment
          ? "downpayment"
          : undefined,
    remainingBalance: hasPaymentSummary
      ? isFullPaymentFlow
        ? 0
        : remainingBalance
      : undefined,
    review: mapAppointmentReview(record.review),
    recurringPlanId: record.recurring_plan_id ?? null,
    scheduledAt,
    sessionNotes: record.session_notes ?? null,
    sessionType: record.sessionType ?? null,
    status,
    totalAmount: totalAmount > 0 ? totalAmount : undefined,
  };
}

function mapAppointmentCheckoutResponse(
  record: AppointmentCheckoutApiRecord,
): AppointmentCheckoutResponse {
  return {
    appointmentId: record.appointment_id,
    checkoutUrl: record.checkout_url ?? null,
    paymentId: record.payment_id ?? null,
    status: record.status,
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
    create<T = AppointmentRecord>(payload: CreateAppointmentPayload) {
      return unwrapResponse<AppointmentApiRecord>(
        transport.post("/coaching/appointments", {
          coach_id: payload.coachId,
          duration_minutes: payload.duration,
          ...(payload.bookingMode
            ? { booking_mode: payload.bookingMode }
            : {}),
          ...(payload.notes ? { member_notes: payload.notes } : {}),
          ...(payload.sessionCount !== undefined
            ? { session_count: payload.sessionCount }
            : {}),
          scheduled_at: payload.scheduledAt,
        }),
        "Unable to create appointment.",
      ).then((record) => mapAppointmentRecord(record) as T);
    },
    cancel(appointmentId: string, cancelReason: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaching/appointments/${appointmentId}/cancel`, {
          reason: cancelReason,
        }),
        "Unable to cancel appointment.",
      );
    },
    initiateDownpayment(
      appointmentId: string,
      provider: AppointmentPaymentProvider = "paymongo",
      paymentStage: AppointmentPaymentStage = "full",
    ) {
      return unwrapResponse<AppointmentCheckoutApiRecord>(
        transport.post(
          `/coaching/appointments/${appointmentId}/pay`,
          { provider, payment_stage: paymentStage },
          {
            headers: {
              "Idempotency-Key": createIdempotencyKey(),
            },
          },
        ),
        "Unable to start appointment payment.",
      ).then((record) => mapAppointmentCheckoutResponse(record));
    },
    processBalance(
      appointmentId: string,
      payload: {
        provider: AppointmentPaymentProvider;
        referenceNo?: string;
        screenshotUrl?: string;
      },
    ) {
      return unwrapResponse<AppointmentCheckoutApiRecord>(
        transport.post(`/coaching/appointments/${appointmentId}/balance`, {
          provider: payload.provider,
          ...(payload.referenceNo ? { reference_no: payload.referenceNo } : {}),
          ...(payload.screenshotUrl
            ? { screenshot_url: payload.screenshotUrl }
            : {}),
        }),
        "Unable to collect appointment balance.",
      ).then((record) => mapAppointmentCheckoutResponse(record));
    },
    confirmAsCoach(appointmentId: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaching/appointments/${appointmentId}/respond`, {
          accepted: true,
        }),
        "Unable to confirm appointment.",
      );
    },
    declineAsCoach(appointmentId: string, reason: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaching/appointments/${appointmentId}/respond`, {
          accepted: false,
          rejection_reason: reason,
        }),
        "Unable to decline appointment.",
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
