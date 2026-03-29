import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";

export type BookingVenueSummary = {
  capacity?: number | null;
  hourlyRate?: number | null;
  id: number;
  name: string;
};

export type BookingUserSummary = {
  email?: string | null;
  id: string;
  phone_no?: string | null;
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

export type VenueBookingRecord = {
  cancelReason?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  durationHours: number;
  endTime: string;
  id: string;
  purpose?: string | null;
  startTime: string;
  status?: string;
  user?: BookingUserSummary | null;
  userId?: string;
  venue?: BookingVenueSummary | null;
  venueId: number;
};

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
