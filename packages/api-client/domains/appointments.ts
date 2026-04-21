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
  coach?: AppointmentCoachSummary | null;
  coachId?: string;
  duration: number;
  id: string;
  notes?: string | null;
  scheduledAt: string;
  sessionType?: string | null;
  status?: string;
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

type AppointmentApiRecord = {
  coach?: AppointmentCoachSummary | null;
  coach_id?: string;
  duration_minutes?: number;
  id: string;
  member_notes?: string | null;
  notes?: string | null;
  scheduled_at?: string;
  scheduledAt?: string;
  sessionType?: string | null;
  status?: string;
};

function mapAppointmentRecord(record: AppointmentApiRecord): AppointmentRecord {
  return {
    coach: record.coach ?? null,
    coachId: record.coach_id,
    duration: record.duration_minutes ?? 0,
    id: record.id,
    notes: record.member_notes ?? record.notes ?? null,
    scheduledAt: record.scheduled_at ?? record.scheduledAt ?? "",
    sessionType: record.sessionType ?? null,
    status: record.status
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
    create(payload: CreateAppointmentPayload) {
      return unwrapVoidResponse(
        transport.post("/coaching/appointments", {
          coach_id: payload.coachId,
          duration_minutes: payload.duration,
          ...(payload.notes ? { member_notes: payload.notes } : {}),
          scheduled_at: payload.scheduledAt
        }),
        "Unable to create appointment."
      );
    },
    cancel(appointmentId: string, cancelReason: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaching/appointments/${appointmentId}/cancel`, { reason: cancelReason }),
        "Unable to cancel appointment."
      );
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
