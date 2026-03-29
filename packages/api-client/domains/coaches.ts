import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";

export type UpdateCoachProfilePayload = {
  bio?: string;
  certifications?: string[];
  hourlyRate?: number;
  specialties?: string[];
  yearsExperience?: number;
};

export type UpsertCoachAvailabilityPayload = {
  dayOfWeek?: number;
  endTime: string;
  isAvailable?: boolean;
  startTime: string;
};

export function createCoachesApi(transport: ApiTransport) {
  return {
    listActive<T>() {
      return unwrapResponse<T[]>(
        transport.get("/coaches?active=true"),
        "Unable to load coaches."
      );
    },
    listAll<T>() {
      return unwrapResponse<T[]>(
        transport.get("/coaches"),
        "Unable to load coaches."
      );
    },
    getAvailability<T>(coachId: string) {
      return unwrapResponse<T>(
        transport.get(`/coaches/${coachId}/availability`),
        "Unable to load coach availability."
      );
    },
    listAppointmentSchedule<T>() {
      return unwrapResponse<T[]>(
        transport.get("/coaches/appointments/schedule"),
        "Unable to load coach schedule."
      );
    },
    updateProfile(payload: UpdateCoachProfilePayload) {
      return unwrapVoidResponse(
        transport.patch("/coaches/profile", payload),
        "Unable to update coach profile."
      );
    },
    createAvailability(payload: UpsertCoachAvailabilityPayload) {
      return unwrapVoidResponse(
        transport.post("/coaches/availability", payload),
        "Unable to create coach availability."
      );
    },
    updateAvailability(id: string, payload: UpsertCoachAvailabilityPayload) {
      return unwrapVoidResponse(
        transport.patch(`/coaches/availability/${id}`, payload),
        "Unable to update coach availability."
      );
    },
    deleteAvailability(id: string) {
      return unwrapVoidResponse(
        transport.delete(`/coaches/availability/${id}`),
        "Unable to delete coach availability."
      );
    }
  };
}