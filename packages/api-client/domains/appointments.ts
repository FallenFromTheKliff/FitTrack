import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";

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
