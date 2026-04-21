import type { CoachProfileRecord, MemberRecord, PaginatedResult } from "@fittrack/types";
import type { ApiTransport } from "../transport/createAxiosTransport";
import {
  unwrapPaginatedResponse,
  unwrapResponse,
  unwrapVoidResponse,
} from "../request";
import { mapAmenityBookingToVenueBookingRecord } from "./bookings";
import type { UpdateCoachProfilePayload } from "./coaches";

export type StaffAppointmentListParams = {
  coachId?: string;
  endDate?: string;
  limit?: number;
  page?: number;
  startDate?: string;
  status?: string;
};

export type StaffAppointmentRecord = {
  coach: {
    hourlyRate?: number | null;
    id: string;
    profile?: {
      avatarUrl?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  };
  coachId: string;
  createdAt: string;
  duration: number;
  id: string;
  notes?: string | null;
  scheduledAt: string;
  status?: string;
  updatedAt: string;
  user: {
    email?: string | null;
    id: string;
    profile?: {
      avatarUrl?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  };
  userId: string;
};

export type StaffCoachAvailabilityPayload = {
  slots: Array<{
    dayOfWeek: number;
    endTime: string;
    startTime: string;
  }>;
};

type StaffAppointmentProfileApiRecord = {
  avatar_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type StaffAppointmentUserApiRecord = {
  email?: string | null;
  id: string;
  profile?: StaffAppointmentProfileApiRecord | null;
};

type StaffAppointmentCoachApiRecord = {
  hourly_rate?: number | string | null;
  id: string;
  profile?: StaffAppointmentProfileApiRecord | null;
};

type StaffAppointmentApiRecord = {
  coach: StaffAppointmentCoachApiRecord;
  coach_id: string;
  created_at: string;
  duration_minutes: number;
  id: string;
  member_notes?: string | null;
  scheduled_at: string;
  status?: string;
  updated_at: string;
  user: StaffAppointmentUserApiRecord;
  user_id: string;
};

function toNullableNumber(value?: number | string | null) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapProfile(
  profile?: StaffAppointmentProfileApiRecord | null,
) {
  if (!profile) return null;

  return {
    avatarUrl: profile.avatar_url ?? null,
    firstName: profile.first_name ?? null,
    lastName: profile.last_name ?? null,
  };
}

function mapStaffAppointment(
  record: StaffAppointmentApiRecord,
): StaffAppointmentRecord {
  return {
    id: record.id,
    userId: record.user_id,
    coachId: record.coach_id,
    status: record.status,
    scheduledAt: record.scheduled_at,
    duration: record.duration_minutes,
    notes: record.member_notes ?? null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    user: {
      id: record.user.id,
      email: record.user.email ?? null,
      profile: mapProfile(record.user.profile ?? null),
    },
    coach: {
      id: record.coach.id,
      hourlyRate: toNullableNumber(record.coach.hourly_rate),
      profile: mapProfile(record.coach.profile ?? null),
    },
  };
}

function toStaffAppointmentParams(params?: StaffAppointmentListParams) {
  if (!params) return undefined;

  return {
    ...(params.page !== undefined ? { page: params.page } : {}),
    ...(params.limit !== undefined ? { limit: params.limit } : {}),
    ...(params.coachId ? { coach_id: params.coachId } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.startDate ? { start_date: params.startDate } : {}),
    ...(params.endDate ? { end_date: params.endDate } : {}),
  };
}

export function createStaffApi(transport: ApiTransport) {
  return {
    getDashboardStats<T>() {
      return unwrapResponse<T>(
        transport.get("/staff/dashboard/stats"),
        "Unable to load dashboard stats.",
      );
    },
    listUsers() {
      return unwrapResponse<MemberRecord[]>(
        transport.get("/staff/users"),
        "Unable to load staff users.",
      );
    },
    listCoaches() {
      return unwrapResponse<CoachProfileRecord[]>(
        transport.get("/staff/coaches"),
        "Unable to load staff coaches.",
      );
    },
    async listAppointments<T>(
      params?: StaffAppointmentListParams,
    ): Promise<PaginatedResult<T>> {
      const result = await unwrapPaginatedResponse<StaffAppointmentApiRecord>(
        transport.get("/staff/appointments", {
          params: toStaffAppointmentParams(params),
        }),
        "Unable to load staff appointments.",
      );

      return {
        ...result,
        data: result.data.map((record) => mapStaffAppointment(record) as T),
      };
    },
    replaceCoachAvailability(
      coachId: string,
      payload: StaffCoachAvailabilityPayload,
    ) {
      return unwrapVoidResponse(
        transport.patch(`/staff/coaches/${coachId}/availability`, {
          slots: payload.slots.map((slot) => ({
            day_of_week: slot.dayOfWeek,
            start_time: slot.startTime,
            end_time: slot.endTime,
          })),
        }),
        "Unable to update coach availability.",
      );
    },
    updateCoachProfile(coachId: string, payload: UpdateCoachProfilePayload) {
      return unwrapVoidResponse(
        transport.patch(`/staff/coaches/${coachId}`, {
          ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
          ...(payload.certifications !== undefined
            ? { certification: payload.certifications.join(", ") }
            : {}),
          ...(payload.hourlyRate !== undefined
            ? { hourly_rate: payload.hourlyRate }
            : {}),
          ...(payload.isAvailableForBooking !== undefined
            ? { is_available_for_booking: payload.isAvailableForBooking }
            : {}),
          ...(payload.specialties !== undefined
            ? { specialization: payload.specialties.join(", ") }
            : {}),
        }),
        "Unable to update coach profile.",
      );
    },
    async listBookings<T>() {
      const data = await unwrapResponse<T[]>(
        transport.get("/bookings/amenity?limit=100"),
        "Unable to load staff bookings.",
      );
      return data.map((record) =>
        mapAmenityBookingToVenueBookingRecord(record as never),
      ) as T[];
    },
    confirmBooking(bookingId: string) {
      return unwrapVoidResponse(
        transport.patch(`/staff/bookings/${bookingId}/confirm`, {}),
        "Unable to confirm booking.",
      );
    },
    rejectBooking(bookingId: string, reason?: string) {
      return unwrapVoidResponse(
        transport.patch(
          `/staff/bookings/${bookingId}/reject`,
          reason ? { reason } : {},
        ),
        "Unable to reject booking.",
      );
    },
    respondToAppointment(appointmentId: string, accepted: boolean, reason?: string) {
      return unwrapVoidResponse(
        transport.patch(`/staff/appointments/${appointmentId}/respond`, {
          accepted,
          ...(accepted ? {} : { rejection_reason: reason ?? "Rejected by staff." }),
        }),
        accepted
          ? "Unable to confirm coach appointment."
          : "Unable to reject coach appointment.",
      );
    },
    completeAppointment(appointmentId: string, sessionNotes?: string) {
      return unwrapVoidResponse(
        transport.patch(`/staff/appointments/${appointmentId}/complete`, {
          ...(sessionNotes ? { session_notes: sessionNotes } : {}),
        }),
        "Unable to complete coach appointment.",
      );
    },
    cancelAppointment(appointmentId: string, reason: string) {
      return unwrapVoidResponse(
        transport.patch(`/staff/appointments/${appointmentId}/cancel`, {
          reason,
        }),
        "Unable to cancel coach appointment.",
      );
    },
  };
}
