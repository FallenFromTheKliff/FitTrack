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
  scheduledAt: string;
};

export function createAppointmentsApi(transport: ApiTransport) {
  return {
    listMine<T>() {
      return unwrapResponse<T[]>(
        transport.get("/appointments"),
        "Unable to load appointments."
      );
    },
    create(payload: CreateAppointmentPayload) {
      return unwrapVoidResponse(
        transport.post("/appointments", payload),
        "Unable to create appointment."
      );
    },
    cancel(appointmentId: string, cancelReason: string) {
      return unwrapVoidResponse(
        transport.patch(`/appointments/${appointmentId}/cancel`, { cancelReason }),
        "Unable to cancel appointment."
      );
    },
    confirmAsCoach(appointmentId: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaches/appointments/${appointmentId}/confirm`, {}),
        "Unable to confirm appointment."
      );
    },
    declineAsCoach(appointmentId: string, reason: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaches/appointments/${appointmentId}/decline`, { reason }),
        "Unable to decline appointment."
      );
    },
    completeAsCoach(appointmentId: string) {
      return unwrapVoidResponse(
        transport.patch(`/coaches/appointments/${appointmentId}/complete`, {}),
        "Unable to complete appointment."
      );
    }
  };
}
