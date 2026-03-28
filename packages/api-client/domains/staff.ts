import type { CoachProfileRecord, MemberRecord } from "@fittrack/types";
import type { ApiTransport } from "../transport/createAxiosTransport";
import { getListFromEnvelope, unwrapResponse, unwrapVoidResponse } from "../request";

export function createStaffApi(transport: ApiTransport) {
  return {
    getDashboardStats<T>() {
      return unwrapResponse<T>(
        transport.get("/staff/dashboard/stats"),
        "Unable to load dashboard stats."
      );
    },
    listUsers() {
      return unwrapResponse<MemberRecord[]>(
        transport.get("/staff/users"),
        "Unable to load staff users."
      );
    },
    listCoaches() {
      return unwrapResponse<CoachProfileRecord[]>(
        transport.get("/staff/coaches"),
        "Unable to load staff coaches."
      );
    },
    async listBookings<T>() {
      const data = await unwrapResponse<{ bookings?: T[] } | T[]>(
        transport.get("/staff/bookings"),
        "Unable to load staff bookings."
      );
      return getListFromEnvelope<T>(data, "bookings");
    },
    confirmBooking(bookingId: string) {
      return unwrapVoidResponse(
        transport.patch(`/staff/bookings/${bookingId}/confirm`, {}),
        "Unable to confirm booking."
      );
    },
    rejectBooking(bookingId: string, reason?: string) {
      return unwrapVoidResponse(
        transport.patch(`/staff/bookings/${bookingId}/reject`, reason ? { reason } : {}),
        "Unable to reject booking."
      );
    }
  };
}
