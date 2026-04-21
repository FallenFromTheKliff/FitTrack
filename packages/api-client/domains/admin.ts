import type {
  AttendanceCheckInRecord,
  CreateUserInput,
  MemberRecord,
  RestoreUserResult as RestoreUserResultType,
  UpdateMembershipCardInput
} from "@fittrack/types";
import { normalizePhilippineMobileNumber } from "@fittrack/validators";
import type { ApiTransport } from "../transport/createAxiosTransport";
import { getListFromEnvelope, unwrapResponse, unwrapVoidResponse } from "../request";
import { mapAmenityBookingToVenueBookingRecord } from "./bookings";

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

export type UpdateMemberPayload = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  activityLevel?: string;
  fitnessGoal?: string;
  currentWeightKg?: number;
  heightCm?: number;
};

export type UpdateMembershipCardPayload = Omit<UpdateMembershipCardInput, "id">;
export type ManualAttendanceCheckInInput = import("@fittrack/types").ManualAttendanceCheckInInput;
export type ScanAttendanceQrInput = import("@fittrack/types").ScanAttendanceQrInput;
export type RestoreUserResult = RestoreUserResultType;

export function createAdminApi(transport: ApiTransport) {
  return {
    listMembers() {
      return unwrapResponse<MemberRecord[]>(
        transport.get("/admin/users"),
        "Unable to load members."
      );
    },
    createUser(payload: CreateUserInput) {
      return unwrapResponse<{ user_id: string; email: string; role: string }>(
        transport.post("/admin/users", {
          email: payload.email,
          password: payload.password,
          first_name: payload.firstName,
          last_name: payload.lastName,
          role: payload.role,
          ...(payload.phone_no
            ? { phone: normalizePhilippineMobileNumber(payload.phone_no) }
            : {}),
        }),
        "Unable to create user account."
      );
    },
    updateMember(id: string, payload: UpdateMemberPayload) {
      return unwrapVoidResponse(
        transport.patch(`/users/${id}`, {
          ...(payload.firstName !== undefined ? { first_name: payload.firstName } : {}),
          ...(payload.lastName !== undefined ? { last_name: payload.lastName } : {}),
          ...(payload.dateOfBirth !== undefined ? { date_of_birth: payload.dateOfBirth } : {}),
          ...(payload.gender !== undefined ? { gender: payload.gender } : {}),
          ...(payload.activityLevel !== undefined ? { activity_level: payload.activityLevel } : {}),
          ...(payload.fitnessGoal !== undefined ? { fitness_goal: payload.fitnessGoal } : {}),
          ...(payload.currentWeightKg !== undefined ? { weight_kg: payload.currentWeightKg } : {}),
          ...(payload.heightCm !== undefined ? { height_cm: payload.heightCm } : {})
        }),
        "Unable to update member."
      );
    },
    updateMembershipCard(id: string, payload: UpdateMembershipCardPayload) {
      return unwrapResponse<{ membershipCard: MemberRecord["membershipCard"]; message: string }>(
        transport.patch(`/admin/users/${id}/membership-card`, {
          action: payload.action,
          ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
          ...(payload.source !== undefined ? { source: payload.source } : {})
        }),
        "Unable to update membership card access."
      );
    },
    deleteUser(id: string) {
      return unwrapVoidResponse(
        transport.delete(`/admin/users/${id}`),
        "Unable to delete user."
      );
    },
    restoreUser(id: string) {
      return unwrapResponse<RestoreUserResult>(
        transport.patch(`/admin/users/${id}/restore`, {}),
        "Unable to restore user."
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
        transport.post("/admin/users/upgrade-to-coach", payload),
        "Unable to upgrade user to coach."
      );
    },
    async listBookings<T>() {
      const data = await unwrapResponse<T[]>(
        transport.get("/bookings/amenity?limit=100"),
        "Unable to load bookings."
      );
      return data.map((record) => mapAmenityBookingToVenueBookingRecord(record as never)) as T[];
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
    },
    scanAttendanceQr(payload: ScanAttendanceQrInput) {
      return unwrapResponse<AttendanceCheckInRecord>(
        transport.post("/attendance/scan", {
          qrValue: payload.qrValue
        }),
        "Unable to scan attendance QR."
      );
    },
    manualAttendanceCheckIn(payload: ManualAttendanceCheckInInput) {
      return unwrapResponse<AttendanceCheckInRecord>(
        transport.post("/attendance/manual", {
          user_id: payload.userId
        }),
        "Unable to manually check in this member."
      );
    }
  };
}
