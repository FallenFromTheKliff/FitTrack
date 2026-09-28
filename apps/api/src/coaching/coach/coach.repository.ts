import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  BookingStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CoachFilterDTO,
  CoachSpecialtyFilterDTO,
} from './dto/coach.dto';

const coachListInclude = {
  user: {
    include: {
      profile: true,
    },
  },
  reviews: {
    take: 2,
    orderBy: [{ created_at: 'desc' }],
    include: {
      reviewer: {
        include: {
          profile: true,
        },
      },
    },
  },
  availability_slots: {
    where: { is_active: true },
    orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
  },
  specialties: {
    include: {
      specialty: {
        select: {
          id: true,
          display_label: true,
        },
      },
    },
  },
} satisfies Prisma.CoachProfileInclude;

const coachDetailInclude = {
  user: {
    include: {
      profile: true,
    },
  },
  reviews: {
    take: 3,
    orderBy: [{ created_at: 'desc' }],
    include: {
      reviewer: {
        include: {
          profile: true,
        },
      },
    },
  },
  availability_slots: {
    where: { is_active: true },
    orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
  },
  specialties: {
    include: {
      specialty: {
        select: {
          id: true,
          display_label: true,
        },
      },
    },
  },
} satisfies Prisma.CoachProfileInclude;

export type CoachListRecord = Prisma.CoachProfileGetPayload<{
  include: typeof coachListInclude;
}>;

export type CoachDetailRecord = Prisma.CoachProfileGetPayload<{
  include: typeof coachDetailInclude;
}>;

export type CoachSpecialtyRecord = Prisma.CoachSpecialtyGetPayload<{
  select: {
    id: true;
    display_label: true;
  };
}>;

export type CoachSpecialtySelection = {
  specialty_ids: string[];
  specialty_labels: string[];
};

const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatus.pending_coach,
  AppointmentStatus.pending_payment,
  AppointmentStatus.confirmed,
] as const;

const ACTIVE_COACH_LINKED_BOOKING_STATUSES = [
  BookingStatus.pending,
  BookingStatus.confirmed,
  BookingStatus.balance_pending,
] as const;

const GYM_TIMEZONE_OFFSET_MINUTES = 8 * 60;

@Injectable()
export class CoachRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async listAvailableCoaches(
    dto: CoachFilterDTO,
  ): Promise<PaginatedResult<CoachListRecord>> {
    const where: Prisma.CoachProfileWhereInput = {
      is_available_for_booking: true,
      user: {
        role: UserRole.coach,
        status: UserStatus.active,
      },
    };

    if (dto.specialization) {
      where.specialization = {
        contains: dto.specialization.trim(),
        mode: 'insensitive',
      };
    }

    if (dto.min_rating !== undefined) {
      where.average_rating = { gte: dto.min_rating };
    }

    if (dto.max_rate !== undefined) {
      where.hourly_rate = { lte: dto.max_rate };
    }

    return this.paginate<CoachListRecord>(
      this.prisma.coachProfile,
      {
        where,
        include: coachListInclude,
        orderBy: [
          { average_rating: 'desc' },
          { rating_count: 'desc' },
          { hourly_rate: 'asc' },
          { created_at: 'desc' },
        ],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  listSpecialties(
    dto: CoachSpecialtyFilterDTO,
  ): Promise<PaginatedResult<CoachSpecialtyRecord>> {
    const where: Prisma.CoachSpecialtyWhereInput = {};
    const search = dto.search?.trim();

    if (search) {
      where.OR = [
        { display_label: { contains: search, mode: 'insensitive' } },
        {
          normalized_label: {
            contains: search.toLocaleLowerCase('en-US'),
            mode: 'insensitive',
          },
        },
      ];
    }

    return this.paginate<CoachSpecialtyRecord>(
      this.prisma.coachSpecialty,
      {
        where,
        select: { id: true, display_label: true },
        orderBy: [{ normalized_label: 'asc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findCoachByIdOrThrow(id: string): Promise<CoachDetailRecord> {
    return this.findOneOrThrow<CoachDetailRecord>(
      this.prisma.coachProfile,
      {
        id,
        user: {
          role: UserRole.coach,
          status: UserStatus.active,
        },
      },
      'CoachProfile',
      coachDetailInclude,
    );
  }

  findCoachByUserIdOrThrow(userId: string): Promise<CoachDetailRecord> {
    return this.findOneOrThrow<CoachDetailRecord>(
      this.prisma.coachProfile,
      {
        user_id: userId,
        user: {
          role: UserRole.coach,
          status: UserStatus.active,
        },
      },
      'CoachProfile',
      coachDetailInclude,
    );
  }

  updateCoachById(
    id: string,
    data: Prisma.CoachProfileUpdateInput,
  ): Promise<CoachDetailRecord> {
    return this.updateById<CoachDetailRecord>(
      this.prisma.coachProfile,
      id,
      data,
      coachDetailInclude,
    );
  }

  async updateCoachByIdWithSpecialties(
    id: string,
    data: Prisma.CoachProfileUpdateInput,
    selection: CoachSpecialtySelection,
  ): Promise<CoachDetailRecord> {
    return this.transaction(async (tx) => {
      const specialties = await this.resolveCoachSpecialties(tx, selection);

      return (await tx.coachProfile.update({
        where: { id },
        data: {
          ...data,
          specialization: this.toLegacySpecialization(specialties),
          specialties: {
            deleteMany: {},
            create: specialties.map((specialty) => ({
              specialty: { connect: { id: specialty.id } },
            })),
          },
        },
        include: coachDetailInclude,
      })) as CoachDetailRecord;
    });
  }

  createStandaloneCoach(
    data: Prisma.CoachProfileCreateInput,
  ): Promise<CoachDetailRecord> {
    return this.create<CoachDetailRecord>(
      this.prisma.coachProfile,
      data,
      coachDetailInclude,
    );
  }

  updateCoachByUserId(
    userId: string,
    data: Prisma.CoachProfileUpdateInput,
  ): Promise<CoachDetailRecord> {
    return this.updateOneOrThrow<CoachDetailRecord>(
      this.prisma.coachProfile,
      { user_id: userId },
      data,
      'CoachProfile',
      coachDetailInclude,
    );
  }

  async updateCoachByUserIdWithSpecialties(
    userId: string,
    data: Prisma.CoachProfileUpdateInput,
    selection: CoachSpecialtySelection,
  ): Promise<CoachDetailRecord> {
    return this.transaction(async (tx) => {
      const specialties = await this.resolveCoachSpecialties(tx, selection);

      return (await tx.coachProfile.update({
        where: { user_id: userId },
        data: {
          ...data,
          specialization: this.toLegacySpecialization(specialties),
          specialties: {
            deleteMany: {},
            create: specialties.map((specialty) => ({
              specialty: { connect: { id: specialty.id } },
            })),
          },
        },
        include: coachDetailInclude,
      })) as CoachDetailRecord;
    });
  }

  async hasActiveAppointmentConflict(
    coachId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean> {
    const gymDayRange = getGymDayUtcRange(startsAt);
    const candidates = await this.prisma.coachAppointment.findMany({
      where: {
        coach_id: coachId,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        scheduled_at: gymDayRange,
      },
      select: {
        scheduled_at: true,
        duration_minutes: true,
      },
    });

    return candidates.some((appointment) => {
      const existingStartsAt = appointment.scheduled_at;
      const existingEndsAt = new Date(
        existingStartsAt.getTime() + appointment.duration_minutes * 60 * 1000,
      );

      return (
        existingStartsAt.getTime() < endsAt.getTime() &&
        existingEndsAt.getTime() > startsAt.getTime()
      );
    });
  }

  async hasActiveLinkedBookingConflict(
    coachId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean> {
    const gymDayRange = getGymDayUtcRange(startsAt);
    const count = await this.prisma.amenityBooking.count({
      where: {
        coach_id: coachId,
        status: { in: [...ACTIVE_COACH_LINKED_BOOKING_STATUSES] },
        starts_at: gymDayRange,
      },
    });

    return count > 0;
  }

  async listActiveBookingDateKeys(
    coachId: string,
    from: Date,
    days: number,
  ): Promise<string[]> {
    const fromStart = getGymDayUtcRange(from).gte;
    const to = new Date(fromStart.getTime() + days * 24 * 60 * 60 * 1000);
    const [appointments, linkedBookings] = await Promise.all([
      this.prisma.coachAppointment.findMany({
        where: {
          coach_id: coachId,
          status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
          scheduled_at: { gte: fromStart, lt: to },
        },
        select: { scheduled_at: true },
      }),
      this.prisma.amenityBooking.findMany({
        where: {
          coach_id: coachId,
          status: { in: [...ACTIVE_COACH_LINKED_BOOKING_STATUSES] },
          starts_at: { gte: fromStart, lt: to },
        },
        select: { starts_at: true },
      }),
    ]);

    return Array.from(
      new Set([
        ...appointments.map((appointment) =>
          toGymDateKey(appointment.scheduled_at),
        ),
        ...linkedBookings.map((booking) => toGymDateKey(booking.starts_at)),
      ]),
    ).sort();
  }

  private async resolveCoachSpecialties(
    tx: Prisma.TransactionClient,
    selection: CoachSpecialtySelection,
  ): Promise<CoachSpecialtyRecord[]> {
    const specialtyIds = Array.from(new Set(selection.specialty_ids));
    const existingById = specialtyIds.length
      ? await tx.coachSpecialty.findMany({
          where: { id: { in: specialtyIds } },
          select: { id: true, display_label: true },
        })
      : [];

    if (existingById.length !== specialtyIds.length) {
      throw new BadRequestException({
        type: 'INVALID_SPECIALTY_SELECTION',
        title: 'Invalid Specialty Selection',
        status: 400,
        detail: 'One or more specialty_ids do not exist.',
      });
    }

    const labelsByNormalized = new Map<
      string,
      { normalized_label: string; display_label: string }
    >();
    for (const label of selection.specialty_labels) {
      const displayLabel = label.normalize('NFKC').trim().replace(/\s+/gu, ' ');
      const normalizedLabel = displayLabel.toLocaleLowerCase('en-US');

      if (!displayLabel || normalizedLabel === 'n/a' || normalizedLabel === 'na') {
        throw new BadRequestException({
          type: 'INVALID_SPECIALTY_SELECTION',
          title: 'Invalid Specialty Selection',
          status: 400,
          detail: 'specialty_labels must contain a real specialty label.',
        });
      }

      if (!labelsByNormalized.has(normalizedLabel)) {
        labelsByNormalized.set(normalizedLabel, {
          normalized_label: normalizedLabel,
          display_label: displayLabel,
        });
      }
    }
    const labels = Array.from(labelsByNormalized.values());

    if (labels.length) {
      await tx.coachSpecialty.createMany({
        data: labels,
        skipDuplicates: true,
      });
    }

    const resolvedByLabel = labels.length
      ? await tx.coachSpecialty.findMany({
          where: { normalized_label: { in: labels.map((label) => label.normalized_label) } },
          select: { id: true, display_label: true },
        })
      : [];
    const byId = new Map(existingById.map((specialty) => [specialty.id, specialty]));
    const byLabel = new Map(
      resolvedByLabel.map((specialty) => [
        specialty.display_label.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US'),
        specialty,
      ]),
    );
    const seenIds = new Set<string>();
    const selected: CoachSpecialtyRecord[] = [];

    for (const id of specialtyIds) {
      const specialty = byId.get(id);
      if (specialty && !seenIds.has(specialty.id)) {
        selected.push(specialty);
        seenIds.add(specialty.id);
      }
    }
    for (const label of labels) {
      const specialty = byLabel.get(label.normalized_label);
      if (specialty && !seenIds.has(specialty.id)) {
        selected.push(specialty);
        seenIds.add(specialty.id);
      }
    }

    return selected;
  }

  private toLegacySpecialization(
    specialties: CoachSpecialtyRecord[],
  ): string | null {
    const specialization = specialties
      .map((specialty) => specialty.display_label)
      .join(', ');
    if (specialization.length > 255) {
      throw new BadRequestException({
        type: 'INVALID_SPECIALTY_SELECTION',
        title: 'Invalid Specialty Selection',
        status: 400,
        detail:
          'The selected specialty labels exceed the legacy specialization limit.',
      });
    }

    return specialization || null;
  }
}

function toGymWallClockDate(value: Date): Date {
  return new Date(value.getTime() + GYM_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
}

function toGymDateKey(value: Date): string {
  return toGymWallClockDate(value).toISOString().slice(0, 10);
}

function getGymDayUtcRange(value: Date): { gte: Date; lt: Date } {
  const gymDate = toGymWallClockDate(value);
  const year = gymDate.getUTCFullYear();
  const month = gymDate.getUTCMonth();
  const day = gymDate.getUTCDate();
  const dayStartUtc = new Date(
    Date.UTC(year, month, day) - GYM_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
  );

  return {
    gte: dayStartUtc,
    lt: new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000),
  };
}
