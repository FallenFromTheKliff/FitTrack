import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  AppointmentStatus,
  BookingStatus,
  CommerceCheckoutHoldStatus,
  PayableType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

const GYM_TIMEZONE_OFFSET_MINUTES = 8 * 60;
const SLOT_INTERVAL_MINUTES = 30;
const MAX_DURATION_LOOKBACK_MINUTES = 180;
const DEFAULT_GYM_OPEN_MINUTES = 6 * 60;
const DEFAULT_GYM_CLOSE_MINUTES = 22 * 60;

export type CoachAvailabilityClient = PrismaService | Prisma.TransactionClient;

export type CoachAvailabilityCheckInput = {
  coachId: string;
  durationMinutes: number;
  excludeAppointmentIds?: string[];
  excludeAmenityBookingIds?: string[];
  excludeHoldIds?: string[];
  startsAt: Date;
  now?: Date;
};

export type CoachAvailabilityCheckResult = {
  available: boolean;
  conflictReasons: string[];
};

export type CoachAvailabilitySlotResult = {
  available: boolean;
  conflict_reasons: string[];
  duration_minutes: number;
  end_at: string;
  start_at: string;
};

type CoachAvailabilityRow = {
  is_available_for_booking: boolean;
  availability_slots: Array<{
    day_of_week: number;
    end_time: Date;
    start_time: Date;
  }>;
};

type AppointmentConflictRow = {
  duration_minutes: number;
  id: string;
  scheduled_at: Date;
};

type HoldConflictRow = {
  duration_minutes: number | null;
  ends_at: Date | null;
  id: string;
  scheduled_at: Date | null;
};

type VenueBookingConflictRow = {
  id: string;
};

type OperatingHoursReader = {
  gymOperatingHour?: {
    findFirst: (args: Prisma.GymOperatingHourFindFirstArgs) => Promise<{
      closes_at: Date;
      is_closed: boolean;
      opens_at: Date;
    } | null>;
  };
  gymSpecialSchedule?: {
    findFirst: (args: Prisma.GymSpecialScheduleFindFirstArgs) => Promise<{
      closes_at: Date | null;
      is_closed: boolean;
      opens_at: Date | null;
      reason: string;
    } | null>;
  };
};

export type EffectiveGymHours = {
  closesAtMinutes: number | null;
  date: string;
  dayOfWeek: number;
  isClosed: boolean;
  opensAtMinutes: number | null;
  source: 'default' | 'regular' | 'special';
  specialReason?: string | null;
};

export type GymHoursCheckResult =
  | { reason: 'gym_closed' | 'outside_gym_hours'; valid: false }
  | { valid: true };

function toGymWallClockDate(value: Date): Date {
  return new Date(value.getTime() + GYM_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
}

function toGymDayOfWeek(value: Date): number {
  return toGymWallClockDate(value).getUTCDay();
}

function toGymMinutes(value: Date): number {
  const wallClock = toGymWallClockDate(value);
  return wallClock.getUTCHours() * 60 + wallClock.getUTCMinutes();
}

function toTimeMinutes(value: Date): number {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

function overlaps(
  startsAt: Date,
  endsAt: Date,
  existingStartsAt: Date,
  existingDurationMinutes: number,
): boolean {
  const existingEndsAt = new Date(
    existingStartsAt.getTime() + existingDurationMinutes * 60 * 1000,
  );

  return (
    existingStartsAt.getTime() < endsAt.getTime() &&
    existingEndsAt.getTime() > startsAt.getTime()
  );
}

function createGymDateAtMinutes(date: string, minutes: number): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(
    Date.UTC(year, month - 1, day) +
      (minutes - GYM_TIMEZONE_OFFSET_MINUTES) * 60 * 1000,
  );
}

function toDateKey(value: Date): string {
  return toGymWallClockDate(value).toISOString().slice(0, 10);
}

function toDateString(value: Date): string {
  const wallClock = toGymWallClockDate(value);
  return `${wallClock.getUTCHours().toString().padStart(2, '0')}:${wallClock
    .getUTCMinutes()
    .toString()
    .padStart(2, '0')}`;
}

function toDateOnly(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function toTimeMinutesOrNull(value: Date | null | undefined): number | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCHours() * 60 + parsed.getUTCMinutes();
}

export async function resolveEffectiveGymHours(
  client: CoachAvailabilityClient,
  date: Date | string,
): Promise<EffectiveGymHours> {
  const dateKey = typeof date === 'string' ? date : toDateKey(date);
  const dayOfWeek =
    typeof date === 'string'
      ? toDateOnly(dateKey).getUTCDay()
      : toGymDayOfWeek(date);
  const reader = client as OperatingHoursReader;
  const special = reader.gymSpecialSchedule?.findFirst
    ? await reader.gymSpecialSchedule.findFirst({
        where: {
          is_active: true,
          starts_on: { lte: toDateOnly(dateKey) },
          ends_on: { gte: toDateOnly(dateKey) },
        },
        orderBy: [{ starts_on: 'desc' }, { created_at: 'desc' }],
        select: {
          closes_at: true,
          is_closed: true,
          opens_at: true,
          reason: true,
        },
      })
    : null;

  if (special) {
    const opensAtMinutes = toTimeMinutesOrNull(special.opens_at);
    const closesAtMinutes = toTimeMinutesOrNull(special.closes_at);
    const isClosed =
      special.is_closed || opensAtMinutes === null || closesAtMinutes === null;
    return {
      closesAtMinutes: isClosed ? null : closesAtMinutes,
      date: dateKey,
      dayOfWeek,
      isClosed,
      opensAtMinutes: isClosed ? null : opensAtMinutes,
      source: 'special',
      specialReason: special.reason,
    };
  }

  const regular = reader.gymOperatingHour?.findFirst
    ? await reader.gymOperatingHour.findFirst({
        where: { day_of_week: dayOfWeek, is_active: true },
        select: { closes_at: true, is_closed: true, opens_at: true },
      })
    : null;

  if (regular) {
    const opensAtMinutes = toTimeMinutesOrNull(regular.opens_at);
    const closesAtMinutes = toTimeMinutesOrNull(regular.closes_at);
    const isClosed =
      regular.is_closed || opensAtMinutes === null || closesAtMinutes === null;
    return {
      closesAtMinutes: isClosed ? null : closesAtMinutes,
      date: dateKey,
      dayOfWeek,
      isClosed,
      opensAtMinutes: isClosed ? null : opensAtMinutes,
      source: 'regular',
    };
  }

  // Keep the booking fallback aligned with the gym knowledge profile's
  // configured 06:00-22:00 defaults when no weekly snapshot exists.
  return {
    closesAtMinutes: DEFAULT_GYM_CLOSE_MINUTES,
    date: dateKey,
    dayOfWeek,
    isClosed: false,
    opensAtMinutes: DEFAULT_GYM_OPEN_MINUTES,
    source: 'default',
  };
}

export function checkWithinEffectiveGymHours(
  hours: EffectiveGymHours,
  startsAt: Date,
  endsAt: Date,
): GymHoursCheckResult {
  if (hours.isClosed) {
    return { reason: 'gym_closed', valid: false };
  }

  if (
    toDateKey(startsAt) !== hours.date ||
    toDateKey(endsAt) !== hours.date ||
    hours.opensAtMinutes === null ||
    hours.closesAtMinutes === null
  ) {
    return { reason: 'outside_gym_hours', valid: false };
  }

  const startsMinutes = toGymMinutes(startsAt);
  const endsMinutes = toGymMinutes(endsAt);
  return startsMinutes >= hours.opensAtMinutes &&
    endsMinutes <= hours.closesAtMinutes
    ? { valid: true }
    : { reason: 'outside_gym_hours', valid: false };
}

export async function assertWithinEffectiveGymHours(
  client: CoachAvailabilityClient,
  startsAt: Date,
  endsAt: Date,
  resource = 'booking',
): Promise<EffectiveGymHours> {
  const hours = await resolveEffectiveGymHours(client, startsAt);
  const result = checkWithinEffectiveGymHours(hours, startsAt, endsAt);
  if (result.valid) {
    return hours;
  }

  if (result.reason === 'gym_closed') {
    throw new BadRequestException({
      type: 'GYM_CLOSED',
      title: 'Gym Closed',
      status: 400,
      detail: `The gym is closed on ${hours.date}; the selected ${resource} time is unavailable.`,
    });
  }

  throw new BadRequestException({
    type: 'OUTSIDE_GYM_HOURS',
    title: 'Outside Gym Operating Hours',
    status: 400,
    detail: `The selected ${resource} time must be within the gym's operating hours.`,
  });
}

@Injectable()
export class CoachAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The shared read/validation path used by checkout, cash booking, monthly
   * schedule generation, and reschedule/make-up mutations.
   */
  async check(
    input: CoachAvailabilityCheckInput,
  ): Promise<CoachAvailabilityCheckResult> {
    return CoachAvailabilityService.checkWithClient(this.prisma, input);
  }

  async assertAvailable(input: CoachAvailabilityCheckInput): Promise<void> {
    return CoachAvailabilityService.assertAvailableWithClient(
      this.prisma,
      input,
    );
  }

  static async assertAvailableWithClient(
    client: CoachAvailabilityClient,
    input: CoachAvailabilityCheckInput,
  ): Promise<void> {
    const result = await CoachAvailabilityService.checkWithClient(
      client,
      input,
    );
    if (result.available) {
      return;
    }

    throw new ConflictException({
      type: 'CONFLICT',
      title: 'Coach Slot Unavailable',
      status: 409,
      detail: `The selected coaching time is unavailable: ${result.conflictReasons.join(', ')}.`,
      conflict_reasons: result.conflictReasons,
    });
  }

  static async checkWithClient(
    client: CoachAvailabilityClient,
    input: CoachAvailabilityCheckInput,
  ): Promise<CoachAvailabilityCheckResult> {
    const now = input.now ?? new Date();
    await CoachAvailabilityService.expireHoldsWithClient(client, now);
    const endsAt = new Date(
      input.startsAt.getTime() + input.durationMinutes * 60 * 1000,
    );

    const coach = await client.coachProfile.findUnique({
      where: { id: input.coachId },
      select: {
        is_available_for_booking: true,
        availability_slots: {
          where: { is_active: true },
          select: {
            day_of_week: true,
            end_time: true,
            start_time: true,
          },
        },
      },
    });

    if (!coach) {
      return { available: false, conflictReasons: ['coach_not_found'] };
    }

    const conflictReasons: string[] = [];
    const gymHours = await resolveEffectiveGymHours(client, input.startsAt);
    const gymHoursResult = checkWithinEffectiveGymHours(
      gymHours,
      input.startsAt,
      endsAt,
    );
    if (!gymHoursResult.valid) {
      conflictReasons.push(gymHoursResult.reason);
    }
    const dayOfWeek = toGymDayOfWeek(input.startsAt);
    const startsMinutes = toGymMinutes(input.startsAt);
    const endsMinutes = toGymMinutes(endsAt);

    if (!coach.is_available_for_booking) {
      conflictReasons.push('coach_hidden_from_booking');
    }

    if (toDateKey(input.startsAt) !== toDateKey(endsAt)) {
      conflictReasons.push('appointment_crosses_gym_day');
    }

    const hasWorkingSlot = coach.availability_slots.some(
      (slot) =>
        slot.day_of_week === dayOfWeek &&
        toTimeMinutes(slot.start_time) <= startsMinutes &&
        toTimeMinutes(slot.end_time) >= endsMinutes,
    );
    if (!hasWorkingSlot) {
      conflictReasons.push('coach_unavailable');
    }

    const lookbackStart = new Date(
      input.startsAt.getTime() - MAX_DURATION_LOOKBACK_MINUTES * 60 * 1000,
    );
    const [appointments, venueBookings, holds] = await Promise.all([
      client.coachAppointment.findMany({
        where: {
          coach_id: input.coachId,
          status: AppointmentStatus.confirmed,
          ...(input.excludeAppointmentIds?.length
            ? { id: { notIn: input.excludeAppointmentIds } }
            : {}),
          scheduled_at: { gte: lookbackStart, lt: endsAt },
        },
        select: {
          duration_minutes: true,
          id: true,
          scheduled_at: true,
        },
      }),
      client.amenityBooking.findMany({
        where: {
          coach_id: input.coachId,
          ...(input.excludeAmenityBookingIds?.length
            ? { id: { notIn: input.excludeAmenityBookingIds } }
            : {}),
          ends_at: { gt: input.startsAt },
          starts_at: { lt: endsAt },
          status: BookingStatus.confirmed,
        },
        select: { id: true },
      }),
      client.commerceCheckoutHold.findMany({
        where: {
          coach_id: input.coachId,
          status: CommerceCheckoutHoldStatus.held,
          expires_at: { gt: now },
          ...(input.excludeHoldIds?.length
            ? { id: { notIn: input.excludeHoldIds } }
            : {}),
          // Active holds are short-lived, so read all starts before this
          // window's end. Venue add-ons can be longer than coach sessions and
          // must not escape collision checks through a fixed lookback.
          scheduled_at: { lt: endsAt },
        },
        select: {
          duration_minutes: true,
          ends_at: true,
          id: true,
          scheduled_at: true,
        },
      }),
    ]);

    if (
      (appointments as AppointmentConflictRow[]).some((appointment) =>
        overlaps(
          input.startsAt,
          endsAt,
          appointment.scheduled_at,
          appointment.duration_minutes,
        ),
      )
    ) {
      conflictReasons.push('coach_appointment_conflict');
    }

    if ((venueBookings as VenueBookingConflictRow[]).length > 0) {
      conflictReasons.push('coach_venue_booking_conflict');
    }

    if (
      (holds as HoldConflictRow[]).some((hold) => {
        if (hold.scheduled_at === null) return false;
        const holdEndsAt =
          hold.ends_at ??
          new Date(
            hold.scheduled_at.getTime() +
              (hold.duration_minutes ?? input.durationMinutes) * 60 * 1000,
          );
        return (
          hold.scheduled_at.getTime() < endsAt.getTime() &&
          holdEndsAt.getTime() > input.startsAt.getTime()
        );
      })
    ) {
      conflictReasons.push('checkout_hold_conflict');
    }

    return {
      available: conflictReasons.length === 0,
      conflictReasons,
    };
  }

  async getSlots(input: {
    coachId: string;
    date: string;
    durationMinutes: number;
  }): Promise<CoachAvailabilitySlotResult[]> {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(input.date)) {
      return [];
    }

    const dayStart = createGymDateAtMinutes(input.date, 0);
    const coach = (await this.prisma.coachProfile.findUnique({
      where: { id: input.coachId },
      select: {
        is_available_for_booking: true,
        availability_slots: {
          where: {
            is_active: true,
            day_of_week: CoachAvailabilityService.getGymDayOfWeek(dayStart),
          },
          orderBy: { start_time: 'asc' },
          select: { end_time: true, start_time: true },
        },
      },
    })) as CoachAvailabilityRow | null;

    if (!coach) {
      return [];
    }

    const gymHours = await resolveEffectiveGymHours(this.prisma, input.date);
    if (
      gymHours.isClosed ||
      gymHours.opensAtMinutes === null ||
      gymHours.closesAtMinutes === null
    ) {
      return [];
    }

    const slots: CoachAvailabilitySlotResult[] = [];
    for (const workingSlot of coach.availability_slots) {
      const slotStart = Math.max(
        toTimeMinutes(workingSlot.start_time),
        gymHours.opensAtMinutes,
      );
      const slotEnd = Math.min(
        toTimeMinutes(workingSlot.end_time),
        gymHours.closesAtMinutes,
      );
      for (
        let startMinutes = slotStart;
        startMinutes + input.durationMinutes <= slotEnd;
        startMinutes += SLOT_INTERVAL_MINUTES
      ) {
        const startsAt = createGymDateAtMinutes(input.date, startMinutes);
        const endsAt = new Date(
          startsAt.getTime() + input.durationMinutes * 60 * 1000,
        );
        const result = await this.check({
          coachId: input.coachId,
          durationMinutes: input.durationMinutes,
          startsAt,
        });
        slots.push({
          available: coach.is_available_for_booking && result.available,
          conflict_reasons: coach.is_available_for_booking
            ? result.conflictReasons
            : ['coach_hidden_from_booking'],
          duration_minutes: input.durationMinutes,
          end_at: endsAt.toISOString(),
          start_at: startsAt.toISOString(),
        });
      }
    }

    return slots;
  }

  static async expireHoldsWithClient(
    client: CoachAvailabilityClient,
    now = new Date(),
  ): Promise<number> {
    const expired = await client.commerceCheckoutHold.findMany({
      where: {
        status: CommerceCheckoutHoldStatus.held,
        expires_at: { lte: now },
      },
      select: { id: true },
    });

    if (expired.length === 0) {
      return 0;
    }

    const ids = expired.map((hold) => hold.id);
    await client.commerceCheckoutHold.updateMany({
      where: { id: { in: ids }, status: CommerceCheckoutHoldStatus.held },
      data: {
        released_at: now,
        status: CommerceCheckoutHoldStatus.expired,
      },
    });
    await client.payment.updateMany({
      where: {
        payable_type: PayableType.commerce_checkout_hold,
        payable_id: { in: ids },
        status: { in: [PaymentStatus.pending, PaymentStatus.processing] },
      },
      data: {
        rejection_reason: 'Checkout hold expired before payment completed.',
        status: PaymentStatus.failed,
      },
    });

    return ids.length;
  }

  static getGymDayOfWeek(value: Date): number {
    return toGymDayOfWeek(value);
  }

  static getGymMinutes(value: Date): number {
    return toGymMinutes(value);
  }

  static toGymDateKey(value: Date): string {
    return toDateKey(value);
  }

  static toGymTime(value: Date): string {
    return toDateString(value);
  }
}
