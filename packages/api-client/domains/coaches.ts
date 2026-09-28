import type { CoachProfileRecord, PaginatedResult } from "@fittrack/types";
import type { ApiTransport } from "../transport/createAxiosTransport";
import {
  unwrapPaginatedResponse,
  unwrapResponse,
  unwrapVoidResponse,
} from "../request";

export type UpdateCoachProfilePayload = {
  bio?: string;
  certifications?: string[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  displayName?: string;
  hourlyRate?: number;
  isAvailableForBooking?: boolean;
  monthlyOfferActive?: boolean;
  monthlyOfferDescription?: string | null;
  monthlyRate?: number;
  monthlySessionCount?: number;
  monthlySessionDurationMinutes?: number;
  scheduleType?: "full_time" | "part_time";
  specialties?: string[];
  yearsExperience?: number;
};

export type UpsertCoachAvailabilityPayload = {
  dayOfWeek?: number;
  endTime: string;
  isAvailable?: boolean;
  startTime: string;
};

export type ReplaceCoachAvailabilityPayload = {
  slots: Array<{
    dayOfWeek: number;
    endTime: string;
    startTime: string;
  }>;
};

export type SubmitCoachReviewPayload = {
  appointmentId: string;
  comment?: string;
  rating: number;
};

export type CreateCoachManagedAppointmentPayload = {
  durationMinutes: number;
  memberId: string;
  memberNotes?: string;
  scheduledAt: string;
};

export type SubmitCoachAppointmentFeedbackPayload = {
  assessmentReport?: string;
  coachFeedback: string;
};

export type CoachReceivedReviewRecord = {
  appointment_id: string;
  comment?: string | null;
  created_at: string;
  id: string;
  rating: number;
  reviewer: {
    id: string;
    name: string;
  };
  scheduled_at: string;
  updated_at: string;
};

export type CoachAvailabilitySlot = {
  dayOfWeek: number | string;
  endTime: string;
  isAvailable: boolean;
  startTime: string;
};

export type CoachAvailabilityResponse = {
  availability: CoachAvailabilitySlot[];
  bookedDates: string[];
  coachId: string;
  scheduleType: "full_time" | "part_time";
};

export type CoachAppointmentScheduleRecord = {
  freeRebookAvailable?: boolean;
  activePaymentId?: string | null;
  activePaymentProvider?: "cash" | "paymongo" | null;
  activePaymentStatus?:
    | "awaiting_verification"
    | "completed"
    | "failed"
    | "pending"
    | "processing"
    | null;
  assessmentReport?: string | null;
  coach?: {
    contactEmail?: string | null;
    displayName?: string | null;
    hourlyRate?: number | null;
    id: string;
    profile?: null;
  };
  coachEarnings?: number | null;
  coachFeedback?: string | null;
  coachPayoutPaidAt?: string | null;
  coachId?: string;
  noShowAt?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  duration: number;
  gymRevenue?: number | null;
  id: string;
  notes?: string | null;
  recurringPlanId?: string | null;
  recurringState?: string | null;
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
  updatedAt: string;
  user?: {
    email?: string | null;
    id: string;
    profile?: {
      avatarUrl?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
  userId: string;
  workoutAssignment?: {
    id: string;
    trainingPlanId: string;
    trainingScheduleDayId: string;
    workoutSessionId: string | null;
    state: string;
  } | null;
};

type CoachUserProfileApiRecord = {
  avatar_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type CoachAvailabilitySlotApiRecord = {
  day_of_week: number;
  end_time: string;
  id: string;
  start_time: string;
};

type CoachUserApiRecord = {
  email?: string | null;
  id?: string;
  phone_no?: string | null;
  profile?: CoachUserProfileApiRecord | null;
};

type CoachSpecialtyApiRecord = {
  id: string;
  label: string;
};

type CoachApiRecord = {
  average_rating?: number | string | null;
  availability_slots?: CoachAvailabilitySlotApiRecord[];
  booked_dates?: string[];
  bio?: string | null;
  certification?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  display_name?: string | null;
  hourly_rate?: number | string | null;
  id: string;
  is_available_for_booking?: boolean;
  monthly_offer_active?: boolean;
  monthly_offer_description?: string | null;
  monthly_rate?: number | string | null;
  monthly_session_count?: number | null;
  monthly_session_duration_minutes?: number | null;
  profile?: CoachUserProfileApiRecord | null;
  rating_count?: number | null;
  recent_reviews?: CoachPublicReviewApiRecord[];
  schedule_type?: "full_time" | "part_time";
  specialization?: string | null;
  specialties?: Array<CoachSpecialtyApiRecord> | string[] | null;
  user?: CoachUserApiRecord | null;
};

type CoachPublicReviewApiRecord = {
  id: string;
  rating: number;
  comment?: string | null;
  reviewer_name?: string | null;
  created_at: string;
};

export type CoachListFilters = {
  maxRate?: number;
  minRating?: number;
  specialization?: string;
};

export type CoachClientListParams = {
  limit?: number;
  page?: number;
};

export type CoachClientRelationshipRecord = {
  coach_id: string;
  created_at: string;
  ended_at?: string | null;
  id: string;
  member?: {
    email?: string | null;
    email_verified?: boolean | null;
    id: string;
    last_check_in_at?: string | null;
    membership_card?: { status: string } | null;
    phone_no?: string | null;
    phone_verified?: boolean | null;
    profile?: {
      activity_level?: string | null;
      avatar_url?: string | null;
      date_of_birth?: string | null;
      first_name?: string | null;
      fitness_goal?: string | null;
      gender?: string | null;
      height_cm?: number | null;
      last_name?: string | null;
      membership_type?: string | null;
      weight_kg?: number | null;
    } | null;
    status?: string | null;
    upcoming_sessions?: Array<{
      duration_minutes: number;
      id: string;
      scheduled_at: string;
      status: string;
    }>;
  } | null;
  member_id: string;
  notes?: string | null;
  started_at?: string | null;
  status?: string;
  updated_at: string;
};

type CoachScheduleApiRecord = {
  free_rebook_available?: boolean;
  active_payment_id?: string | null;
  active_payment_provider?: "cash" | "paymongo" | null;
  active_payment_status?:
    | "awaiting_verification"
    | "completed"
    | "failed"
    | "pending"
    | "processing"
    | null;
  coach_earnings?: number | string | null;
  coach_id?: string;
  completed_at?: string | null;
  created_at?: string;
  duration_minutes?: number;
  gym_revenue?: number | string | null;
  id: string;
  assessment_report?: string | null;
  coach_feedback?: string | null;
  coach_payout_paid_at?: string | null;
  no_show_at?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  member_notes?: string | null;
  recurring_plan_id?: string | null;
  recurring_state?: string | null;
  review?: {
    comment?: string | null;
    created_at?: string;
    id: string;
    rating: number;
    updated_at?: string;
  } | null;
  scheduled_at?: string;
  session_notes?: string | null;
  status?: string;
  total_amount?: number | string | null;
  updated_at?: string;
  user?: CoachUserApiRecord | null;
  user_id?: string;
  workout_assignment?: {
    id: string;
    training_plan_id: string;
    training_schedule_day_id: string;
    workout_session_id?: string | null;
    state: string;
  } | null;
};

type CoachAvailabilityDraft = {
  dayOfWeek: number;
  endTime: string;
  id: string;
  startTime: string;
};

const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitMultiValue(value?: string | null) {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCoachSpecialtyLabels(labels: string[]) {
  const seen = new Set<string>();
  const normalizedLabels: string[] = [];

  labels.forEach((label) => {
    const trimmed = label.trim();
    if (!trimmed) return;

    const identity = trimmed.toLowerCase();
    if (seen.has(identity)) return;

    seen.add(identity);
    normalizedLabels.push(trimmed);
  });

  return normalizedLabels;
}

function mapCoachSpecialties(
  specialties?: Array<CoachSpecialtyApiRecord> | string[] | null,
  specialization?: string | null,
) {
  const labels = Array.isArray(specialties)
    ? specialties
      .map((specialty) =>
        typeof specialty === "string" ? specialty : specialty.label,
      )
    : splitMultiValue(specialization);

  return normalizeCoachSpecialtyLabels(labels);
}

function toNullableNumber(value?: number | string | null) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCoachDisplayName(value?: string | null) {
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

function mapAvailabilityDraft(
  slot: CoachAvailabilitySlotApiRecord,
): CoachAvailabilityDraft {
  return {
    dayOfWeek: slot.day_of_week,
    endTime: slot.end_time,
    id: slot.id,
    startTime: slot.start_time,
  };
}

function mapAvailabilitySlot(
  slot: CoachAvailabilitySlotApiRecord,
): CoachAvailabilitySlot {
  return {
    dayOfWeek: slot.day_of_week,
    endTime: slot.end_time,
    isAvailable: true,
    startTime: slot.start_time,
  };
}

function mapUserProfile(profile?: CoachUserProfileApiRecord | null) {
  if (!profile) return null;
  return {
    avatarUri: profile.avatar_url ?? null,
    firstName: profile.first_name ?? null,
    lastName: profile.last_name ?? null,
  };
}

function getProfileDisplayName(profile: ReturnType<typeof mapUserProfile>) {
  return [profile?.firstName, profile?.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
}

function mapCoachRecord(record: CoachApiRecord): CoachProfileRecord {
  const profile = mapUserProfile(
    record.user?.profile ?? record.profile ?? null,
  );
  const profileDisplayName = getProfileDisplayName(profile);

  return {
    averageRating: toNullableNumber(record.average_rating),
    availability: (record.availability_slots ?? []).map((slot) => ({
      dayOfWeek: slot.day_of_week,
      endTime: slot.end_time,
      id: slot.id,
      isAvailable: true,
      startTime: slot.start_time,
    })),
    bio: record.bio ?? null,
    bookedDates: record.booked_dates ?? [],
    certifications: splitMultiValue(record.certification),
    contactEmail: isLegacySeedIdentityEmail(record.contact_email)
      ? null
      : (record.contact_email ?? null),
    contactPhone: record.contact_phone ?? null,
    displayName:
      normalizeCoachDisplayName(record.display_name) ??
      normalizeCoachDisplayName(profileDisplayName),
    hourlyRate: toNullableNumber(record.hourly_rate),
    id: record.id,
    isActive: record.is_available_for_booking ?? true,
    monthlyOfferActive: record.monthly_offer_active ?? false,
    monthlyOfferDescription: record.monthly_offer_description ?? null,
    monthlyRate: toNullableNumber(record.monthly_rate),
    monthlySessionCount: record.monthly_session_count ?? 0,
    monthlySessionDurationMinutes:
      record.monthly_session_duration_minutes ?? 60,
    ratingCount: record.rating_count ?? 0,
    recentReviews: (record.recent_reviews ?? []).map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment ?? null,
      reviewerName: review.reviewer_name ?? "FitTrack member",
      createdAt: review.created_at,
    })),
    scheduleType: record.schedule_type ?? "part_time",
    specialties: mapCoachSpecialties(record.specialties, record.specialization),
    user: null,
    yearsExperience: null,
  };
}

function toCoachListQuery(filters?: CoachListFilters) {
  const params = new URLSearchParams({ limit: "100" });
  const specialization = filters?.specialization?.trim();

  if (specialization) {
    params.set("specialization", specialization);
  }
  if (filters?.minRating !== undefined) {
    params.set("min_rating", String(filters.minRating));
  }
  if (filters?.maxRate !== undefined) {
    params.set("max_rate", String(filters.maxRate));
  }

  return params.toString();
}

function mapCoachAvailability(
  record: CoachApiRecord,
): CoachAvailabilityResponse {
  return {
    availability: (record.availability_slots ?? []).map(mapAvailabilitySlot),
    bookedDates: record.booked_dates ?? [],
    coachId: record.id,
    scheduleType: record.schedule_type ?? "part_time",
  };
}

function mapCoachScheduleRecord(record: CoachScheduleApiRecord) {
  const totalAmount = toNullableNumber(record.total_amount);

  return {
    freeRebookAvailable: Boolean(record.free_rebook_available),
    activePaymentId: record.active_payment_id ?? null,
    activePaymentProvider: record.active_payment_provider ?? null,
    activePaymentStatus: record.active_payment_status ?? null,
    assessmentReport: record.assessment_report ?? null,
    coach: {
      contactEmail: null,
      displayName: null,
      hourlyRate: null,
      id: record.coach_id ?? "",
      profile: null,
    },
    coachId: record.coach_id,
    coachEarnings: toNullableNumber(record.coach_earnings),
    coachFeedback: record.coach_feedback ?? null,
    coachPayoutPaidAt: record.coach_payout_paid_at ?? null,
    noShowAt: record.no_show_at ?? null,
    cancellationReason: record.cancellation_reason ?? null,
    cancelledAt: record.cancelled_at ?? null,
    createdAt: record.created_at ?? "",
    duration: record.duration_minutes ?? 0,
    gymRevenue: toNullableNumber(record.gym_revenue),
    id: record.id,
    notes: record.member_notes ?? null,
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
    scheduledAt: record.scheduled_at ?? "",
    sessionNotes: record.session_notes ?? null,
    status: record.status,
    totalAmount,
    completedAt: record.completed_at ?? null,
    updatedAt: record.updated_at ?? "",
    user: record.user
      ? {
          email: record.user.email ?? null,
          id: record.user.id ?? record.user_id ?? "",
          profile: mapUserProfile(record.user.profile ?? null),
        }
      : null,
    userId: record.user_id ?? record.user?.id ?? "",
    workoutAssignment: record.workout_assignment
      ? {
          id: record.workout_assignment.id,
          trainingPlanId: record.workout_assignment.training_plan_id,
          trainingScheduleDayId: record.workout_assignment.training_schedule_day_id,
          workoutSessionId: record.workout_assignment.workout_session_id ?? null,
          state: record.workout_assignment.state,
        }
      : null,
  };
}

export function createCoachesApi(transport: ApiTransport) {
  async function getCurrentCoach() {
    return unwrapResponse<CoachApiRecord>(
      transport.get("/coaching/coaches/me"),
      "Unable to load coach profile.",
    );
  }

  async function replaceCurrentAvailability(
    slots: Array<
      Pick<CoachAvailabilityDraft, "dayOfWeek" | "endTime" | "startTime">
    >,
    fallback: string,
  ) {
    return unwrapVoidResponse(
      transport.post("/coaching/coaches/availability", {
        slots: slots.map((slot) => ({
          day_of_week: slot.dayOfWeek,
          end_time: slot.endTime,
          start_time: slot.startTime,
        })),
      }),
      fallback,
    );
  }

  async function mutateAvailability(
    fallback: string,
    mutator: (
      slots: CoachAvailabilityDraft[],
    ) => Array<
      Pick<CoachAvailabilityDraft, "dayOfWeek" | "endTime" | "startTime">
    >,
  ) {
    const coach = await getCurrentCoach();
    const currentSlots = (coach.availability_slots ?? []).map(
      mapAvailabilityDraft,
    );
    const nextSlots = mutator(currentSlots);
    return replaceCurrentAvailability(nextSlots, fallback);
  }

  return {
    listActive<T>(filters?: CoachListFilters) {
      return unwrapResponse<CoachApiRecord[]>(
        transport.get(`/coaching/coaches?${toCoachListQuery(filters)}`),
        "Unable to load coaches.",
      ).then(
        (records) => records.map((record) => mapCoachRecord(record)) as T[],
      );
    },
    listAll<T>() {
      return unwrapResponse<CoachApiRecord[]>(
        transport.get("/coaching/coaches?limit=100"),
        "Unable to load coaches.",
      ).then(
        (records) => records.map((record) => mapCoachRecord(record)) as T[],
      );
    },
    listClients(
      params?: CoachClientListParams,
    ): Promise<PaginatedResult<CoachClientRelationshipRecord>> {
      return unwrapPaginatedResponse<CoachClientRelationshipRecord>(
        transport.get("/coaching/clients", { params }),
        "Unable to load coach clients.",
      );
    },
    getMine<T>() {
      return getCurrentCoach().then((record) => mapCoachRecord(record) as T);
    },
    getAvailability<T>(coachId: string) {
      return unwrapResponse<CoachApiRecord>(
        transport.get(`/coaching/coaches/${coachId}`),
        "Unable to load coach availability.",
      ).then((record) => mapCoachAvailability(record) as T);
    },
    listAppointmentSchedule<T>() {
      return unwrapResponse<CoachScheduleApiRecord[]>(
        transport.get("/coaching/appointments/coach?limit=100"),
        "Unable to load coach schedule.",
      ).then(
        (records) =>
          records.map((record) => mapCoachScheduleRecord(record)) as T[],
      );
    },
    updateProfile(payload: UpdateCoachProfilePayload) {
      return unwrapVoidResponse(
        transport.patch("/coaching/coaches/me", {
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
          ...(payload.monthlyOfferActive !== undefined
            ? { monthly_offer_active: payload.monthlyOfferActive }
            : {}),
          ...(payload.monthlyOfferDescription !== undefined
            ? { monthly_offer_description: payload.monthlyOfferDescription }
            : {}),
          ...(payload.monthlyRate !== undefined
            ? { monthly_rate: payload.monthlyRate }
            : {}),
          ...(payload.monthlySessionCount !== undefined
            ? { monthly_session_count: payload.monthlySessionCount }
            : {}),
          ...(payload.monthlySessionDurationMinutes !== undefined
            ? {
                monthly_session_duration_minutes:
                  payload.monthlySessionDurationMinutes,
              }
            : {}),
          ...(payload.scheduleType !== undefined
            ? { schedule_type: payload.scheduleType }
            : {}),
          ...(payload.specialties !== undefined
            ? { specialty_labels: payload.specialties }
            : {}),
        }),
        "Unable to update coach profile.",
      );
    },
    createManagedAppointment(payload: CreateCoachManagedAppointmentPayload) {
      return unwrapVoidResponse(
        transport.post("/coaching/appointments/coach-managed", {
          duration_minutes: payload.durationMinutes,
          member_id: payload.memberId,
          ...(payload.memberNotes ? { member_notes: payload.memberNotes } : {}),
          scheduled_at: payload.scheduledAt,
        }),
        "Unable to create client appointment.",
      );
    },
    submitAppointmentFeedback(
      appointmentId: string,
      payload: SubmitCoachAppointmentFeedbackPayload,
    ) {
      return unwrapVoidResponse(
        transport.patch(`/coaching/appointments/${appointmentId}/feedback`, {
          ...(payload.assessmentReport
            ? { assessment_report: payload.assessmentReport }
            : {}),
          coach_feedback: payload.coachFeedback,
        }),
        "Unable to save client feedback.",
      );
    },
    replaceAvailability(payload: ReplaceCoachAvailabilityPayload) {
      return replaceCurrentAvailability(
        payload.slots,
        "Unable to update coach availability.",
      );
    },
    createAvailability(payload: UpsertCoachAvailabilityPayload) {
      return mutateAvailability(
        "Unable to create coach availability.",
        (slots) => {
          if (payload.dayOfWeek === undefined) {
            throw new Error("Coach availability day is required.");
          }

          return [
            ...slots.map(({ dayOfWeek, endTime, startTime }) => ({
              dayOfWeek,
              endTime,
              startTime,
            })),
            {
              dayOfWeek: payload.dayOfWeek,
              endTime: payload.endTime,
              startTime: payload.startTime,
            },
          ];
        },
      );
    },
    updateAvailability(id: string, payload: UpsertCoachAvailabilityPayload) {
      return mutateAvailability(
        "Unable to update coach availability.",
        (slots) => {
          let found = false;
          const nextSlots = slots.flatMap((slot) => {
            if (slot.id !== id) {
              return [
                {
                  dayOfWeek: slot.dayOfWeek,
                  endTime: slot.endTime,
                  startTime: slot.startTime,
                },
              ];
            }

            found = true;
            if (payload.isAvailable === false) {
              return [];
            }

            return [
              {
                dayOfWeek: payload.dayOfWeek ?? slot.dayOfWeek,
                endTime: payload.endTime,
                startTime: payload.startTime,
              },
            ];
          });

          if (!found) {
            throw new Error("Coach availability slot not found.");
          }

          return nextSlots;
        },
      );
    },
    deleteAvailability(id: string) {
      return mutateAvailability(
        "Unable to delete coach availability.",
        (slots) => {
          const nextSlots = slots
            .filter((slot) => slot.id !== id)
            .map(({ dayOfWeek, endTime, startTime }) => ({
              dayOfWeek,
              endTime,
              startTime,
            }));

          if (nextSlots.length === slots.length) {
            throw new Error("Coach availability slot not found.");
          }

          return nextSlots;
        },
      );
    },
    submitReview(coachId: string, payload: SubmitCoachReviewPayload) {
      return unwrapVoidResponse(
        transport.post(`/coaching/coaches/${coachId}/reviews`, {
          appointment_id: payload.appointmentId,
          rating: payload.rating,
          ...(payload.comment ? { comment: payload.comment } : {}),
        }),
        "Unable to submit coach feedback.",
      );
    },
    listReceivedReviews() {
      return unwrapResponse<CoachReceivedReviewRecord[]>(
        transport.get("/coaching/coaches/me/reviews"),
        "Unable to load coach feedback.",
      );
    },
  };
}
