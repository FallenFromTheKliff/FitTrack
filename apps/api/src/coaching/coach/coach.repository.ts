import { Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  BookingStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { CoachFilterDTO } from './dto/coach.dto';

const coachListInclude = {
  user: {
    include: {
      profile: true,
    },
  },
} satisfies Prisma.CoachProfileInclude;

const coachDetailInclude = {
  user: {
    include: {
      profile: true,
    },
  },
  availability_slots: {
    where: { is_active: true },
    orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
  },
} satisfies Prisma.CoachProfileInclude;

export type CoachListRecord = Prisma.CoachProfileGetPayload<{
  include: typeof coachListInclude;
}>;

export type CoachDetailRecord = Prisma.CoachProfileGetPayload<{
  include: typeof coachDetailInclude;
}>;

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

const MAX_APPOINTMENT_LOOKBACK_MINUTES = 180;

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
      user: { status: UserStatus.active },
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

  findCoachByIdOrThrow(id: string): Promise<CoachDetailRecord> {
    return this.findOneOrThrow<CoachDetailRecord>(
      this.prisma.coachProfile,
      {
        id,
        user: { status: UserStatus.active },
      },
      'CoachProfile',
      coachDetailInclude,
    );
  }

  findCoachByUserIdOrThrow(userId: string): Promise<CoachDetailRecord> {
    return this.findUniqueWhereOrThrow<CoachDetailRecord>(
      this.prisma.coachProfile,
      { user_id: userId },
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

  async hasActiveAppointmentConflict(
    coachId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean> {
    const candidates = await this.prisma.coachAppointment.findMany({
      where: {
        coach_id: coachId,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        scheduled_at: {
          gte: new Date(
            startsAt.getTime() - MAX_APPOINTMENT_LOOKBACK_MINUTES * 60 * 1000,
          ),
          lt: endsAt,
        },
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
    const count = await this.prisma.amenityBooking.count({
      where: {
        coach_id: coachId,
        status: { in: [...ACTIVE_COACH_LINKED_BOOKING_STATUSES] },
        starts_at: { lt: endsAt },
        ends_at: { gt: startsAt },
      },
    });

    return count > 0;
  }
}
