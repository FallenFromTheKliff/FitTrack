import type { CoachProfileRecord } from "@fittrack/types";
import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";

export type UpdateCoachProfilePayload = {
  bio?: string;
  certifications?: string[];
  hourlyRate?: number;
  isAvailableForBooking?: boolean;
  specialties?: string[];
  yearsExperience?: number;
};

export type UpsertCoachAvailabilityPayload = {
  dayOfWeek?: number;
  endTime: string;
  isAvailable?: boolean;
  startTime: string;
};

export type CoachAvailabilitySlot = {
  dayOfWeek: number | string;
  endTime: string;
  isAvailable: boolean;
  startTime: string;
};

export type CoachAvailabilityResponse = {
  availability: CoachAvailabilitySlot[];
  coachId: string;
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

type CoachApiRecord = {
  availability_slots?: CoachAvailabilitySlotApiRecord[];
  bio?: string | null;
  certification?: string | null;
  hourly_rate?: number | string | null;
  id: string;
  is_available_for_booking?: boolean;
  profile?: CoachUserProfileApiRecord | null;
  specialization?: string | null;
  user?: CoachUserApiRecord | null;
};

type CoachScheduleApiRecord = {
  coach_id?: string;
  duration_minutes?: number;
  id: string;
  member_notes?: string | null;
  scheduled_at?: string;
  status?: string;
  user?: CoachUserApiRecord | null;
};

type CoachAvailabilityDraft = {
  dayOfWeek: number;
  endTime: string;
  id: string;
  startTime: string;
};

function splitMultiValue(value?: string | null) {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNullableNumber(value?: number | string | null) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapAvailabilityDraft(slot: CoachAvailabilitySlotApiRecord): CoachAvailabilityDraft {
  return {
    dayOfWeek: slot.day_of_week,
    endTime: slot.end_time,
    id: slot.id,
    startTime: slot.start_time
  };
}

function mapAvailabilitySlot(slot: CoachAvailabilitySlotApiRecord): CoachAvailabilitySlot {
  return {
    dayOfWeek: slot.day_of_week,
    endTime: slot.end_time,
    isAvailable: true,
    startTime: slot.start_time
  };
}

function mapUserProfile(profile?: CoachUserProfileApiRecord | null) {
  if (!profile) return null;
  return {
    avatarUri: profile.avatar_url ?? null,
    firstName: profile.first_name ?? null,
    lastName: profile.last_name ?? null
  };
}

function mapCoachRecord(record: CoachApiRecord): CoachProfileRecord {
  const profile = mapUserProfile(record.user?.profile ?? record.profile ?? null);

  return {
    availability: (record.availability_slots ?? []).map((slot) => ({
      dayOfWeek: slot.day_of_week,
      endTime: slot.end_time,
      id: slot.id,
      isAvailable: true,
      startTime: slot.start_time
    })),
    bio: record.bio ?? null,
    certifications: splitMultiValue(record.certification),
    hourlyRate: toNullableNumber(record.hourly_rate),
    id: record.id,
    isActive: record.is_available_for_booking ?? true,
    specialties: splitMultiValue(record.specialization),
    user: {
      email: record.user?.email ?? undefined,
      id: record.user?.id ?? record.id,
      phone_no: record.user?.phone_no ?? null,
      profile
    },
    yearsExperience: null
  };
}

function mapCoachAvailability(record: CoachApiRecord): CoachAvailabilityResponse {
  return {
    availability: (record.availability_slots ?? []).map(mapAvailabilitySlot),
    coachId: record.id
  };
}

function mapCoachScheduleRecord(record: CoachScheduleApiRecord) {
  return {
    coachId: record.coach_id,
    duration: record.duration_minutes ?? 0,
    id: record.id,
    notes: record.member_notes ?? null,
    scheduledAt: record.scheduled_at ?? "",
    status: record.status,
    user: record.user
      ? {
          email: record.user.email ?? null,
          profile: mapUserProfile(record.user.profile ?? null)
        }
      : null
  };
}

export function createCoachesApi(transport: ApiTransport) {
  async function getCurrentCoach() {
    return unwrapResponse<CoachApiRecord>(
      transport.get("/coaching/coaches/me"),
      "Unable to load coach profile."
    );
  }

  async function replaceAvailability(
    slots: Array<Pick<CoachAvailabilityDraft, "dayOfWeek" | "endTime" | "startTime">>,
    fallback: string
  ) {
    return unwrapVoidResponse(
      transport.post("/coaching/coaches/availability", {
        slots: slots.map((slot) => ({
          day_of_week: slot.dayOfWeek,
          end_time: slot.endTime,
          start_time: slot.startTime
        }))
      }),
      fallback
    );
  }

  async function mutateAvailability(
    fallback: string,
    mutator: (slots: CoachAvailabilityDraft[]) => Array<Pick<CoachAvailabilityDraft, "dayOfWeek" | "endTime" | "startTime">>
  ) {
    const coach = await getCurrentCoach();
    const currentSlots = (coach.availability_slots ?? []).map(mapAvailabilityDraft);
    const nextSlots = mutator(currentSlots);
    return replaceAvailability(nextSlots, fallback);
  }

  return {
    listActive<T>() {
      return unwrapResponse<CoachApiRecord[]>(
        transport.get("/coaching/coaches?limit=100"),
        "Unable to load coaches."
      ).then((records) => records.map((record) => mapCoachRecord(record)) as T[]);
    },
    listAll<T>() {
      return unwrapResponse<CoachApiRecord[]>(
        transport.get("/coaching/coaches?limit=100"),
        "Unable to load coaches."
      ).then((records) => records.map((record) => mapCoachRecord(record)) as T[]);
    },
    getMine<T>() {
      return getCurrentCoach().then((record) => mapCoachRecord(record) as T);
    },
    getAvailability<T>(coachId: string) {
      return unwrapResponse<CoachApiRecord>(
        transport.get(`/coaching/coaches/${coachId}`),
        "Unable to load coach availability."
      ).then((record) => mapCoachAvailability(record) as T);
    },
    listAppointmentSchedule<T>() {
      return unwrapResponse<CoachScheduleApiRecord[]>(
        transport.get("/coaching/appointments/coach?limit=100"),
        "Unable to load coach schedule."
      ).then((records) => records.map((record) => mapCoachScheduleRecord(record)) as T[]);
    },
    updateProfile(payload: UpdateCoachProfilePayload) {
      return unwrapVoidResponse(
        transport.patch("/coaching/coaches/me", {
          ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
          ...(payload.certifications !== undefined
            ? { certification: payload.certifications.join(", ") }
            : {}),
          ...(payload.hourlyRate !== undefined ? { hourly_rate: payload.hourlyRate } : {}),
          ...(payload.isAvailableForBooking !== undefined
            ? { is_available_for_booking: payload.isAvailableForBooking }
            : {}),
          ...(payload.specialties !== undefined
            ? { specialization: payload.specialties.join(", ") }
            : {})
        }),
        "Unable to update coach profile."
      );
    },
    createAvailability(payload: UpsertCoachAvailabilityPayload) {
      return mutateAvailability("Unable to create coach availability.", (slots) => {
        if (payload.dayOfWeek === undefined) {
          throw new Error("Coach availability day is required.");
        }

        return [
          ...slots.map(({ dayOfWeek, endTime, startTime }) => ({
            dayOfWeek,
            endTime,
            startTime
          })),
          {
            dayOfWeek: payload.dayOfWeek,
            endTime: payload.endTime,
            startTime: payload.startTime
          }
        ];
      });
    },
    updateAvailability(id: string, payload: UpsertCoachAvailabilityPayload) {
      return mutateAvailability("Unable to update coach availability.", (slots) => {
        let found = false;
        const nextSlots = slots.flatMap((slot) => {
          if (slot.id !== id) {
            return [{
              dayOfWeek: slot.dayOfWeek,
              endTime: slot.endTime,
              startTime: slot.startTime
            }];
          }

          found = true;
          if (payload.isAvailable === false) {
            return [];
          }

          return [{
            dayOfWeek: payload.dayOfWeek ?? slot.dayOfWeek,
            endTime: payload.endTime,
            startTime: payload.startTime
          }];
        });

        if (!found) {
          throw new Error("Coach availability slot not found.");
        }

        return nextSlots;
      });
    },
    deleteAvailability(id: string) {
      return mutateAvailability("Unable to delete coach availability.", (slots) => {
        const nextSlots = slots
          .filter((slot) => slot.id !== id)
          .map(({ dayOfWeek, endTime, startTime }) => ({
            dayOfWeek,
            endTime,
            startTime
          }));

        if (nextSlots.length === slots.length) {
          throw new Error("Coach availability slot not found.");
        }

        return nextSlots;
      });
    }
  };
}
