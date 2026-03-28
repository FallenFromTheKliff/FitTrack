import type { VenueRecord } from "@fittrack/types";
import type { ApiTransport } from "../transport/createAxiosTransport";
import { getListFromEnvelope, unwrapResponse, unwrapVoidResponse } from "../request";

export type VenueMutationPayload = {
  capacity: number;
  description?: string;
  displayOrder: number;
  gridColumn: number;
  gridHeight: number;
  gridRow: number;
  gridWidth: number;
  hourlyRate?: number;
  iconKey: string;
  isReservable: boolean;
  minimumHours: number;
  name: string;
};

export function createVenuesApi(transport: ApiTransport) {
  return {
    listActive() {
      return unwrapResponse<VenueRecord[]>(
        transport.get("/venues?active=true"),
        "Unable to load venues."
      );
    },
    async getAvailability<T>(venueId: string | number, date: string) {
      const data = await unwrapResponse<{ bookings?: T[] } | T[]>(
        transport.get(`/venues/${venueId}/availability?date=${date}`),
        "Unable to load venue availability."
      );
      return getListFromEnvelope<T>(data, "bookings");
    },
    create(payload: VenueMutationPayload) {
      return unwrapVoidResponse(
        transport.post("/admin/venues", payload),
        "Unable to create venue."
      );
    },
    update(id: number, payload: VenueMutationPayload) {
      return unwrapVoidResponse(
        transport.patch(`/admin/venues/${id}`, payload),
        "Unable to update venue."
      );
    },
    delete(id: number) {
      return unwrapVoidResponse(
        transport.delete(`/admin/venues/${id}`),
        "Unable to delete venue."
      );
    }
  };
}
