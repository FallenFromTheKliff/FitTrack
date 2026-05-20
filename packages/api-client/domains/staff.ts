import type {
  CoachProfileRecord,
  MemberRecord,
  PaginatedResult,
} from "@fittrack/types";
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
  activePaymentId?: string | null;
  activePaymentProvider?: "cash" | "paymongo" | null;
  activePaymentStage?: "balance" | "downpayment" | "full" | null;
  activePaymentStatus?: "awaiting_verification" | "completed" | "failed" | "pending" | "processing" | null;
  amountDueNow?: number | null;
  assessmentReport?: string | null;
  balancePaidAt?: string | null;
  coach: {
    contactEmail?: string | null;
    displayName?: string | null;
    hourlyRate?: number | null;
    id: string;
    profile?: {
      avatarUrl?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  };
  coachId: string;
  coachEarnings?: number | null;
  coachFeedback?: string | null;
  coachPayoutPaidAt?: string | null;
  noShowAt?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  duration: number;
  gymRevenue?: number | null;
  id: string;
  notes?: string | null;
  originalScheduledAt?: string | null;
  recurringPlanId?: string | null;
  recurringState?: string | null;
  remainingBalance?: number | null;
  review?: {
    comment?: string | null;
    createdAt: string;
    id: string;
    rating: number;
    updatedAt: string;
  } | null;
  scheduledAt: string;
  sessionNotes?: string | null;
  status?: string;
  totalAmount?: number | null;
  downpaymentPaidAt?: string | null;
  completedAt?: string | null;
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

export type CreateStaffVenueBookingPayload = {
  amenityId: string;
  coachId?: string;
  endsAt: string;
  memberId: string;
  notes?: string;
  paymentStage?: "downpayment" | "full";
  startsAt: string;
};

export type CreateStaffCoachBookingPayload = {
  coachId: string;
  durationMinutes: number;
  memberId: string;
  memberNotes?: string;
  paymentStage?: "downpayment" | "full";
  scheduledAt: string;
};

export type CreateStaffCoachPayload = {
  bio?: string;
  certifications?: string[];
  contactEmail?: string;
  contactPhone?: string;
  displayName: string;
  gymCommissionPct?: number;
  hourlyRate?: number;
  isAvailableForBooking?: boolean;
  scheduleType?: "full_time" | "part_time";
  specialties?: string[];
};

export type CompleteStaffAppointmentPayload = {
  assessmentReport?: string;
  coachFeedback?: string;
  sessionNotes?: string;
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
  contact_email?: string | null;
  display_name?: string | null;
  hourly_rate?: number | string | null;
  id: string;
  profile?: StaffAppointmentProfileApiRecord | null;
};

type StaffAppointmentApiRecord = {
  active_payment_id?: string | null;
  active_payment_provider?: "cash" | "paymongo" | null;
  active_payment_stage?: "balance" | "downpayment" | "full" | null;
  active_payment_status?: "awaiting_verification" | "completed" | "failed" | "pending" | "processing" | null;
  balance_amount?: number | string | null;
  balance_paid_at?: string | null;
  coach: StaffAppointmentCoachApiRecord;
  coach_id: string;
  created_at: string;
  downpayment_amount?: number | string | null;
  downpayment_paid_at?: string | null;
  duration_minutes: number;
  assessment_report?: string | null;
  coach_earnings?: number | string | null;
  coach_feedback?: string | null;
  coach_payout_paid_at?: string | null;
  no_show_at?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  completed_at?: string | null;
  gym_revenue?: number | string | null;
  id: string;
  member_notes?: string | null;
  original_scheduled_at?: string | null;
  recurring_plan_id?: string | null;
  recurring_state?: string | null;
  review?: {
    comment?: string | null;
    created_at?: string;
    id: string;
    rating: number;
    updated_at?: string;
  } | null;
  scheduled_at: string;
  session_notes?: string | null;
  status?: string;
  total_amount?: number | string | null;
  updated_at: string;
  user: StaffAppointmentUserApiRecord;
  user_id: string;
};

type StaffCoachApiRecord = {
  availability?: CoachProfileRecord["availability"];
  availability_slots?: Array<{
    day_of_week: number;
    end_time: string;
    id: string;
    start_time: string;
  }>;
  bio?: string | null;
  certification?: string | null;
  certifications?: string[] | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  hourly_rate?: number | string | null;
  hourlyRate?: number | string | null;
  id: string;
  is_active?: boolean | null;
  is_available_for_booking?: boolean | null;
  isActive?: boolean | null;
  schedule_type?: "full_time" | "part_time";
  scheduleType?: "full_time" | "part_time";
  specialization?: string | null;
  specialties?: string[] | null;
  user?: CoachProfileRecord["user"] | null;
  yearsExperience?: number | null;
};

const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toNullableNumber(value?: number | string | null) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitMultiValue(value?: string | string[] | null) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter((item) => item.length > 0);
  }

  if (!value) return [];

  return value
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function mapProfile(profile?: StaffAppointmentProfileApiRecord | null) {
  if (!profile) return null;

  return {
    avatarUrl: profile.avatar_url ?? null,
    firstName: profile.first_name ?? null,
    lastName: profile.last_name ?? null,
  };
}

function normalizeCoachDisplayName(
  value: string | null | undefined,
  index: number,
) {
  const displayName = value?.trim();
  if (displayName && !EMAIL_LIKE_PATTERN.test(displayName)) {
    return displayName;
  }

  return `Coach Profile ${index + 1}`;
}

function normalizeNullableCoachDisplayName(value: string | null | undefined) {
  const displayName = value?.trim();
  if (displayName && !EMAIL_LIKE_PATTERN.test(displayName)) {
    return displayName;
  }

  return null;
}

function isLegacySeedIdentityEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return Boolean(
    normalized &&
    (normalized.startsWith("seed.member") ||
      normalized.startsWith("seed.staff") ||
      normalized.startsWith("seed.admin")),
  );
}

function mapStaffCoach(
  record: StaffCoachApiRecord,
  index: number,
): CoachProfileRecord {
  return {
    availability:
      record.availability ??
      (record.availability_slots ?? []).map((slot) => ({
        dayOfWeek: slot.day_of_week,
        endTime: slot.end_time,
        id: slot.id,
        isAvailable: true,
        startTime: slot.start_time,
      })),
    bio: record.bio ?? null,
    certifications: splitMultiValue(
      record.certifications ?? record.certification ?? null,
    ),
    contactEmail: isLegacySeedIdentityEmail(
      record.contactEmail ?? record.contact_email,
    )
      ? null
      : (record.contactEmail ?? record.contact_email ?? null),
    contactPhone: record.contactPhone ?? record.contact_phone ?? null,
    displayName: normalizeCoachDisplayName(
      record.displayName ?? record.display_name,
      index,
    ),
    hourlyRate: toNullableNumber(record.hourlyRate ?? record.hourly_rate),
    id: record.id,
    isActive:
      record.isActive ??
      record.is_active ??
      record.is_available_for_booking ??
      true,
    scheduleType: record.scheduleType ?? record.schedule_type ?? "part_time",
    specialties: splitMultiValue(
      record.specialties ?? record.specialization ?? null,
    ),
    user: record.user ?? null,
    yearsExperience: record.yearsExperience ?? null,
  };
}

function mapStaffAppointment(
  record: StaffAppointmentApiRecord,
): StaffAppointmentRecord {
  const totalAmount = toNullableNumber(record.total_amount);
  const downpaymentAmount = toNullableNumber(record.downpayment_amount);
  const remainingBalance = toNullableNumber(record.balance_amount);
  const activePaymentStage = record.active_payment_stage ?? null;
  const isPaidInFull = Boolean(
    record.downpayment_paid_at && record.balance_paid_at,
  );
  const isFullPaymentFlow =
    activePaymentStage === "full" || isPaidInFull;
  const hasPaymentSummary =
    (totalAmount ?? 0) > 0 && (downpaymentAmount ?? 0) > 0;

  return {
    activePaymentId: record.active_payment_id ?? null,
    activePaymentProvider: record.active_payment_provider ?? null,
    activePaymentStage,
    activePaymentStatus: record.active_payment_status ?? null,
    id: record.id,
    userId: record.user_id,
    coachId: record.coach_id,
    coachEarnings: toNullableNumber(record.coach_earnings),
    coachFeedback: record.coach_feedback ?? null,
    coachPayoutPaidAt: record.coach_payout_paid_at ?? null,
    noShowAt: record.no_show_at ?? null,
    cancellationReason: record.cancellation_reason ?? null,
    cancelledAt: record.cancelled_at ?? null,
    status: record.status,
    scheduledAt: record.scheduled_at,
    duration: record.duration_minutes,
    assessmentReport: record.assessment_report ?? null,
    gymRevenue: toNullableNumber(record.gym_revenue),
    totalAmount,
    amountDueNow: hasPaymentSummary
      ? isFullPaymentFlow
        ? totalAmount
        : record.status === "pending_payment"
          ? downpaymentAmount
          : (remainingBalance ?? 0) > 0 && !record.balance_paid_at
            ? remainingBalance
            : downpaymentAmount
      : null,
    remainingBalance: hasPaymentSummary
      ? isFullPaymentFlow
        ? 0
        : remainingBalance
      : null,
    downpaymentPaidAt: record.downpayment_paid_at ?? null,
    balancePaidAt: record.balance_paid_at ?? null,
    notes: record.member_notes ?? null,
    sessionNotes: record.session_notes ?? null,
    originalScheduledAt: record.original_scheduled_at ?? null,
    recurringPlanId: record.recurring_plan_id ?? null,
    recurringState: record.recurring_state ?? null,
    review: record.review
      ? {
          comment: record.review.comment ?? null,
          createdAt: record.review.created_at ?? "",
          id: record.review.id,
          rating: record.review.rating,
          updatedAt: record.review.updated_at ?? "",
        }
      : null,
    createdAt: record.created_at,
    completedAt: record.completed_at ?? null,
    updatedAt: record.updated_at,
    user: {
      id: record.user.id,
      email: record.user.email ?? null,
      profile: mapProfile(record.user.profile ?? null),
    },
    coach: {
      contactEmail: isLegacySeedIdentityEmail(record.coach.contact_email)
        ? null
        : (record.coach.contact_email ?? null),
      displayName: normalizeNullableCoachDisplayName(record.coach.display_name),
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
      return unwrapResponse<StaffCoachApiRecord[]>(
        transport.get("/staff/coaches"),
        "Unable to load staff coaches.",
      ).then((records) =>
        records.map((record, index) => mapStaffCoach(record, index)),
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
          ...(payload.contactEmail !== undefined
            ? { contact_email: payload.contactEmail }
            : {}),
          ...(payload.contactPhone !== undefined
            ? { contact_phone: payload.contactPhone }
            : {}),
          ...(payload.displayName !== undefined
            ? { display_name: payload.displayName }
            : {}),
          ...(payload.hourlyRate !== undefined
            ? { hourly_rate: payload.hourlyRate }
            : {}),
          ...(payload.isAvailableForBooking !== undefined
            ? { is_available_for_booking: payload.isAvailableForBooking }
            : {}),
          ...(payload.scheduleType !== undefined
            ? { schedule_type: payload.scheduleType }
            : {}),
          ...(payload.specialties !== undefined
            ? { specialization: payload.specialties.join(", ") }
            : {}),
        }),
        "Unable to update coach profile.",
      );
    },
    createCoach(payload: CreateStaffCoachPayload) {
      return unwrapVoidResponse(
        transport.post("/staff/coaches", {
          display_name: payload.displayName,
          ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
          ...(payload.certifications !== undefined
            ? { certification: payload.certifications.join(", ") }
            : {}),
          ...(payload.contactEmail !== undefined
            ? { contact_email: payload.contactEmail }
            : {}),
          ...(payload.contactPhone !== undefined
            ? { contact_phone: payload.contactPhone }
            : {}),
          ...(payload.gymCommissionPct !== undefined
            ? { gym_commission_pct: payload.gymCommissionPct }
            : {}),
          ...(payload.hourlyRate !== undefined
            ? { hourly_rate: payload.hourlyRate }
            : {}),
          ...(payload.isAvailableForBooking !== undefined
            ? { is_available_for_booking: payload.isAvailableForBooking }
            : {}),
          ...(payload.scheduleType !== undefined
            ? { schedule_type: payload.scheduleType }
            : {}),
          ...(payload.specialties !== undefined
            ? { specialization: payload.specialties.join(", ") }
            : {}),
        }),
        "Unable to create coach.",
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
    completeBooking(bookingId: string) {
      return unwrapVoidResponse(
        transport.patch(`/staff/bookings/${bookingId}/complete`, {}),
        "Unable to mark booking complete.",
      );
    },
    cancelBooking(bookingId: string, reason?: string) {
      return unwrapVoidResponse(
        transport.patch(
          `/staff/bookings/${bookingId}/cancel`,
          reason ? { reason } : {},
        ),
        "Unable to cancel booking.",
      );
    },
    noShowBooking(bookingId: string) {
      return unwrapVoidResponse(
        transport.patch(`/staff/bookings/${bookingId}/no-show`, {}),
        "Unable to mark booking no-show.",
      );
    },
    createBooking(payload: CreateStaffVenueBookingPayload) {
      return unwrapVoidResponse(
        transport.post("/staff/bookings", {
          amenity_id: payload.amenityId,
          ...(payload.coachId ? { coach_id: payload.coachId } : {}),
          ends_at: payload.endsAt,
          member_id: payload.memberId,
          ...(payload.notes ? { notes: payload.notes } : {}),
          payment_stage: payload.paymentStage ?? "full",
          starts_at: payload.startsAt,
        }),
        "Unable to create venue booking.",
      );
    },
    respondToAppointment(
      appointmentId: string,
      accepted: boolean,
      reason?: string,
    ) {
      return unwrapVoidResponse(
        transport.patch(`/staff/appointments/${appointmentId}/respond`, {
          accepted,
          ...(accepted
            ? {}
            : { rejection_reason: reason ?? "Rejected by staff." }),
        }),
        accepted
          ? "Unable to confirm coach appointment."
          : "Unable to reject coach appointment.",
      );
    },
    completeAppointment(
      appointmentId: string,
      payload?: CompleteStaffAppointmentPayload,
    ) {
      return unwrapVoidResponse(
        transport.patch(`/staff/appointments/${appointmentId}/complete`, {
          ...(payload?.assessmentReport
            ? { assessment_report: payload.assessmentReport }
            : {}),
          ...(payload?.coachFeedback
            ? { coach_feedback: payload.coachFeedback }
            : {}),
          ...(payload?.sessionNotes
            ? { session_notes: payload.sessionNotes }
            : {}),
        }),
        "Unable to complete coach appointment.",
      );
    },
    markCoachPayoutPaid(appointmentId: string) {
      return unwrapVoidResponse(
        transport.patch(`/staff/appointments/${appointmentId}/coach-payout`, {}),
        "Unable to mark coach payout paid.",
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
    createAppointment(payload: CreateStaffCoachBookingPayload) {
      return unwrapVoidResponse(
        transport.post("/staff/appointments", {
          coach_id: payload.coachId,
          duration_minutes: payload.durationMinutes,
          member_id: payload.memberId,
          ...(payload.memberNotes ? { member_notes: payload.memberNotes } : {}),
          payment_stage: payload.paymentStage ?? "full",
          scheduled_at: payload.scheduledAt,
        }),
        "Unable to create coach booking.",
      );
    },
  };
}
