import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";

export type CreateBookingPayload = {
  durationHours: number;
  purpose?: string;
  startTime: string;
  venueId: number;
};

export function createBookingsApi(transport: ApiTransport) {
  return {
    listMine<T>() {
      return unwrapResponse<T[]>(
        transport.get("/bookings"),
        "Unable to load bookings."
      );
    },
    create(payload: CreateBookingPayload) {
      return unwrapVoidResponse(
        transport.post("/bookings", payload),
        "Unable to create booking."
      );
    },
    cancel(bookingId: string, cancelReason: string) {
      return unwrapVoidResponse(
        transport.patch(`/bookings/${bookingId}/cancel`, { cancelReason }),
        "Unable to cancel booking."
      );
    }
  };
}