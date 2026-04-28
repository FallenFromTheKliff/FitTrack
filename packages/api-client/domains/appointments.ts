import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";

export type AppointmentCoachSummary = {
  hourlyRate?: number | null;
  user?: {
    email?: string | null;
    profile?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
};

export type AppointmentRecord = {
  amountDueNow?: number | null;
  coach?: AppointmentCoachSummary | null;
  coachId?: string;
  duration: number;
  id: string;
  nextPaymentDate?: string | null;
  notes?: string | null;
  paymentPlan?: "downpayment" | "free" | "full";
  remainingBalance?: number | null;
  scheduledAt: string;
  sessionType?: string | null;
  status?: string;
  totalAmount?: number | null;
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
  coachId: string;
  duration: number;
  notes?: string;
  scheduledAt: string;
};

export type AppointmentCheckoutResponse = {
  appointmentId: string;
  checkoutUrl: string | null;
  status: string;
};

export type AppointmentPaymentProvider = "cash" | "paymongo";

type AppointmentApiRecord = {
  balance_amount?: number | string | null;
  coach?: AppointmentCoachSummary | null;
  coach_id?: string;
  downpayment_amount?: number | string | null;
  downpayment_paid_at?: string | null;
  duration_minutes?: number;
  id: string;
  member_notes?: string | null;
  notes?: string | null;
  scheduled_at?: string;
  scheduledAt?: string;
  sessionType?: string | null;
  status?: string;
  total_amount?: number | string | null;
};

type AppointmentCheckoutApiRecord = {
  appointment_id: string;
  checkout_url?: string | null;
  status: string;
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function toAmountNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapAppointmentRecord(record: AppointmentApiRecord): AppointmentRecord {
  const totalAmount = toAmountNumber(record.total_amount);
  const downpaymentAmount = toAmountNumber(record.downpayment_amount);
  const remainingBalance = toAmountNumber(record.balance_amount);
  const status = record.status;
  const scheduledAt = record.scheduled_at ?? record.scheduledAt ?? "";
  const requiresPaymentSummary =
    status === "pending_payment" && totalAmount > 0 && downpaymentAmount > 0;

  return {
    amountDueNow: requiresPaymentSummary ? downpaymentAmount : undefined,
    coach: record.coach ?? null,
    coachId: record.coach_id,
    duration: record.duration_minutes ?? 0,
    id: record.id,
    nextPaymentDate: requiresPaymentSummary && remainingBalance > 0 ? scheduledAt : undefined,
    notes: record.member_notes ?? record.notes ?? null,
    paymentPlan: totalAmount <= 0 ? "free" : requiresPaymentSummary ? "downpayment" : undefined,
    remainingBalance: requiresPaymentSummary ? remainingBalance : undefined,
    scheduledAt,
    sessionType: record.sessionType ?? null,
    status,
    totalAmount: totalAmount > 0 ? totalAmount : undefined
  };
}

function mapAppointmentCheckoutResponse(
  record: AppointmentCheckoutApiRecord,
): AppointmentCheckoutResponse {
  return {
    appointmentId: record.appointment_id,
    checkoutUrl: record.checkout_url ?? null,
    status: record.status,
  };
}

export function createAppointmentsApi(transport: ApiTransport) {
  return {
    listMine<T>() {
      return unwrapResponse<AppointmentApiRecord[]>(
        transport.get("/coaching/appointments/my"),
        "Unable to load appointments."
      ).then((records) => records.map((record) => mapAppointmentRecord(record)) as T[]);
    },
    create<T = AppointmentRecord>(payload: CreateAppointmentPayload) {
      return unwrapResponse<AppointmentApiRecord>(
        transport.post("/coaching/appointments", {
          coach_id: payload.coachId,
          duration_minutes: payload.duration,
          ...(payload.notes ? { member_notes: payload.notes } : {}),
          scheduled_at: payload.scheduledAt
        }),
        "Unable to create appointment."
      ).then((record) => mapAppointmentRecord(record) as T);
    },
    cancel(appointmentId: string, cancelReason: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaching/appointments/${appointmentId}/cancel`, { reason: cancelReason }),
        "Unable to cancel appointment."
      );
    },
    initiateDownpayment(
      appointmentId: string,
      provider: AppointmentPaymentProvider = "paymongo",
    ) {
      return unwrapResponse<AppointmentCheckoutApiRecord>(
        transport.post(
          `/coaching/appointments/${appointmentId}/pay`,
          { provider },
          {
            headers: {
              "Idempotency-Key": createIdempotencyKey(),
            },
          },
        ),
        "Unable to start appointment payment."
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
          ...(payload.screenshotUrl ? { screenshot_url: payload.screenshotUrl } : {}),
        }),
        "Unable to collect appointment balance."
      ).then((record) => mapAppointmentCheckoutResponse(record));
    },
    confirmAsCoach(appointmentId: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaching/appointments/${appointmentId}/respond`, { accepted: true }),
        "Unable to confirm appointment."
      );
    },
    declineAsCoach(appointmentId: string, reason: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaching/appointments/${appointmentId}/respond`, {
          accepted: false,
          rejection_reason: reason
        }),
        "Unable to decline appointment."
      );
    },
    completeAsCoach(appointmentId: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaching/appointments/${appointmentId}/complete`, {}),
        "Unable to complete appointment."
      );
    }
  };
}
