import type { CreateStaffInput, MemberRecord } from "@fittrack/types";
import type { ApiTransport } from "../transport/createAxiosTransport";
import { getListFromEnvelope, unwrapResponse, unwrapVoidResponse } from "../request";

export type ReviewDeletionPayload = {
  reviewNotes?: string;
};

export type UpgradeToCoachPayload = {
  bio?: string;
  certifications?: string[];
  hourlyRate: number;
  specialties: string[];
  userId: string;
  yearsExperience: number;
};

export function createAdminApi(transport: ApiTransport) {
  return {
    listMembers() {
      return unwrapResponse<MemberRecord[]>(
        transport.get("/admin/users"),
        "Unable to load members."
      );
    },
    createStaff(payload: CreateStaffInput) {
      return unwrapVoidResponse(
        transport.post("/admin/create-staff", payload),
        "Unable to create staff account."
      );
    },
    deleteUser(id: string) {
      return unwrapVoidResponse(
        transport.delete(`/admin/users/${id}`),
        "Unable to delete user."
      );
    },
    async listDeletionRequests<T>() {
      const data = await unwrapResponse<{ requests?: T[] } | T[]>(
        transport.get("/admin/deletion-requests"),
        "Unable to load deletion requests."
      );
      return getListFromEnvelope<T>(data, "requests");
    },
    approveDeletionRequest(id: string, payload?: ReviewDeletionPayload) {
      return unwrapVoidResponse(
        transport.patch(`/admin/deletion-requests/${id}/approve`, payload ?? {}),
        "Unable to approve deletion request."
      );
    },
    rejectDeletionRequest(id: string, payload?: ReviewDeletionPayload) {
      return unwrapVoidResponse(
        transport.patch(`/admin/deletion-requests/${id}/reject`, payload ?? {}),
        "Unable to reject deletion request."
      );
    },
    upgradeToCoach(payload: UpgradeToCoachPayload) {
      return unwrapVoidResponse(
        transport.post("/admin/upgrade-to-coach", payload),
        "Unable to upgrade user to coach."
      );
    },
    async listBookings<T>() {
      const data = await unwrapResponse<{ bookings?: T[] } | T[]>(
        transport.get("/admin/bookings"),
        "Unable to load bookings."
      );
      return getListFromEnvelope<T>(data, "bookings");
    },
    confirmBooking(bookingId: string) {
      return unwrapVoidResponse(
        transport.patch(`/admin/bookings/${bookingId}/confirm`, {}),
        "Unable to confirm booking."
      );
    },
    rejectBooking(bookingId: string, reason?: string) {
      return unwrapVoidResponse(
        transport.patch(`/admin/bookings/${bookingId}/reject`, reason ? { reason } : {}),
        "Unable to reject booking."
      );
    }
  };
}