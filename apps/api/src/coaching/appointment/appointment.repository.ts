import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import {
  AppointmentStatus,
  CoachAppointment,
  CoachProfile,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { BaseRepository } from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { DateRangeDTO } from '../../user/dto/user-dto';
import { StaffAppointmentFilterDTO } from './dto/appointment.dto';

const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatus.pending_coach,
  AppointmentStatus.pending_payment,
  AppointmentStatus.confirmed,
] as const;

const GYM_TIMEZONE_OFFSET_MINUTES = 8 * 60;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type CoachIdLookup = { id: string };

type FreeAppointmentCleanupCandidate = Pick<
  CoachAppointment,
  'id' | 'user_id' | 'coach_id' | 'scheduled_at' | 'duration_minutes'
>;

type NoShowCleanupCandidate = Pick<
  CoachAppointment,
  'id' | 'scheduled_at' | 'duration_minutes'
>;

type AppointmentNotificationContext = Prisma.CoachAppointmentGetPayload<{
  include: {
    user: {
      include: {
        auth_identities: {
          where: { provider: { in: ['email', 'google'] } };
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }];
          select: {
            identifier: true;
            provider: true;
            is_primary: true;
            verified_at: true;
          };
        };
        notification_prefs: true;
        profile: true;
      };
    };
    coach: {
      include: {
        user: {
          include: {
            auth_identities: {
              where: { provider: { in: ['email', 'google'] } };
              orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }];
              select: {
                identifier: true;
                provider: true;
                is_primary: true;
                verified_at: true;
              };
            };
            notification_prefs: true;
            profile: true;
          };
        };
      };
    };
  };
}>;

export type AppointmentLifecycleRecord = Prisma.CoachAppointmentGetPayload<{
  include: {
    coach: {
      select: {
        id: true;
        user_id: true;
      };
    };
  };
}>;

const memberAppointmentInclude = {
  coach: {
    select: {
      id: true,
      hourly_rate: true,
      display_name: true,
      contact_email: true,
    },
  },
  review: {
    select: {
      id: true,
      rating: true,
      comment: true,
      created_at: true,
      updated_at: true,
    },
  },
} satisfies Prisma.CoachAppointmentInclude;

export type MemberAppointmentRecord = Prisma.CoachAppointmentGetPayload<{
  include: typeof memberAppointmentInclude;
}>;

const coachScheduleInclude = {
  review: {
    select: {
      id: true,
      rating: true,
      comment: true,
      created_at: true,
      updated_at: true,
    },
  },
  user: {
    include: {
      auth_identities: {
        where: { provider: { in: ['email', 'google'] } },
        orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
        select: {
          identifier: true,
          provider: true,
          is_primary: true,
          verified_at: true,
        },
      },
      profile: true,
    },
  },
} satisfies Prisma.CoachAppointmentInclude;

export type CoachScheduleRecord = Prisma.CoachAppointmentGetPayload<{
  include: typeof coachScheduleInclude;
}>;

const staffAppointmentInclude = {
  review: {
    select: {
      id: true,
      rating: true,
      comment: true,
      created_at: true,
      updated_at: true,
    },
  },
  user: {
    include: {
      auth_identities: {
        where: { provider: { in: ['email', 'google'] } },
        orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
        select: {
          identifier: true,
          provider: true,
          is_primary: true,
          verified_at: true,
        },
      },
      profile: true,
    },
  },
  coach: {
    include: {
      user: {
        include: {
          auth_identities: {
            where: { provider: { in: ['email', 'google'] } },
            orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
            select: {
              identifier: true,
              provider: true,
              is_primary: true,
              verified_at: true,
            },
          },
          profile: true,
        },
      },
    },
  },
} satisfies Prisma.CoachAppointmentInclude;

export type StaffAppointmentRecord = Prisma.CoachAppointmentGetPayload<{
  include: typeof staffAppointmentInclude;
}>;

@Injectable()
export class AppointmentRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private readonly appointmentLifecycleInclude = {
    coach: {
      select: {
        id: true,
        user_id: true,
      },
    },
  } as const;

  private readonly appointmentNotificationInclude = {
    user: {
      include: {
        auth_identities: {
          where: { provider: { in: ['email', 'google'] } },
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
          select: {
            identifier: true,
            provider: true,
            is_primary: true,
            verified_at: true,
          },
        },
        notification_prefs: true,
        profile: true,
      },
    },
    coach: {
      include: {
        user: {
          include: {
            auth_identities: {
              where: { provider: { in: ['email', 'google'] } },
              orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
              select: {
                identifier: true,
                provider: true,
                is_primary: true,
                verified_at: true,
              },
            },
            notification_prefs: true,
            profile: true,
          },
        },
      },
    },
  } as const;

  findCoachByUserIdOrThrow(userId: string): Promise<CoachIdLookup> {
    return this.findOneOrThrow<CoachIdLookup>(
      this.prisma.coachProfile,
      {
        user_id: userId,
        user: {
          role: UserRole.coach,
          status: UserStatus.active,
        },
      },
      'CoachProfile',
    );
  }

  findCoachScheduleContextOrThrow(coachId: string): Promise<CoachProfile> {
    return this.findOneOrThrow<CoachProfile>(
      this.prisma.coachProfile,
      { id: coachId },
      'CoachProfile',
    );
  }

  async replaceAvailabilitySlots(input: {
    coachId: string;
    slots: Array<{
      dayOfWeek: number;
      startTime: Date;
      endTime: Date;
    }>;
  }): Promise<void> {
    await this.transaction(async (tx) => {
      await tx.coachAvailabilitySlot.updateMany({
        where: {
          coach_id: input.coachId,
          is_active: true,
        },
        data: {
          is_active: false,
        },
      });

      if (input.slots.length === 0) {
        return;
      }

      await tx.coachAvailabilitySlot.createMany({
        data: input.slots.map((slot) => ({
          coach_id: input.coachId,
          day_of_week: slot.dayOfWeek,
          start_time: slot.startTime,
          end_time: slot.endTime,
          is_active: true,
        })),
      });
    });
  }

  async createPendingAppointment(input: {
    userId: string;
    coachId: string;
    scheduledAt: Date;
    appointmentEndsAt: Date;
    dayOfWeek: number;
    slotStart: Date;
    slotEnd: Date;
    durationMinutes: number;
    memberNotes?: string;
    isFreeSession: boolean;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    gymRevenue: Prisma.Decimal;
    coachEarnings: Prisma.Decimal;
  }): Promise<CoachAppointment> {
    return this.transaction(async (tx) => {
      const availableSlot = await tx.coachAvailabilitySlot.findFirst({
        where: {
          coach_id: input.coachId,
          is_active: true,
          day_of_week: input.dayOfWeek,
          start_time: { lte: input.slotStart },
          end_time: { gte: input.slotEnd },
        },
        select: { id: true },
      });

      if (!availableSlot) {
        throw this.buildNoAvailableSlotError();
      }

      const gymDayRange = getGymDayUtcRange(input.scheduledAt);
      const candidates = await tx.coachAppointment.findMany({
        where: {
          coach_id: input.coachId,
          status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
          scheduled_at: gymDayRange,
        },
        select: {
          id: true,
          scheduled_at: true,
          duration_minutes: true,
        },
      });

      const hasConflict = candidates.some((appointment) => {
        const existingStartsAt = appointment.scheduled_at;
        const existingEndsAt = new Date(
          existingStartsAt.getTime() + appointment.duration_minutes * 60 * 1000,
        );

        return (
          existingStartsAt.getTime() < input.appointmentEndsAt.getTime() &&
          existingEndsAt.getTime() > input.scheduledAt.getTime()
        );
      });

      if (hasConflict) {
        throw this.buildScheduleConflict();
      }

      return tx.coachAppointment.create({
        data: {
          user: { connect: { id: input.userId } },
          coach: { connect: { id: input.coachId } },
          status: AppointmentStatus.pending_coach,
          is_free_session: input.isFreeSession,
          scheduled_at: input.scheduledAt,
          duration_minutes: input.durationMinutes,
          total_amount: input.totalAmount,
          downpayment_amount: input.downpaymentAmount,
          balance_amount: input.balanceAmount,
          gym_revenue: input.gymRevenue,
          coach_earnings: input.coachEarnings,
          member_notes: input.memberNotes ?? null,
        },
      });
    });
  }

  async createConfirmedManualAppointment(input: {
    userId: string;
    coachId: string;
    scheduledAt: Date;
    appointmentEndsAt: Date;
    dayOfWeek: number;
    slotStart: Date;
    slotEnd: Date;
    durationMinutes: number;
    memberNotes?: string;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    gymRevenue: Prisma.Decimal;
    coachEarnings: Prisma.Decimal;
    idempotencyKey: string;
    paymentAmount?: Prisma.Decimal;
    paymentStage?: Extract<
      PaymentStage,
      typeof PaymentStage.downpayment | typeof PaymentStage.full
    >;
    verifiedBy: string;
  }): Promise<CoachAppointment> {
    return this.transaction(async (tx) => {
      const availableSlot = await tx.coachAvailabilitySlot.findFirst({
        where: {
          coach_id: input.coachId,
          is_active: true,
          day_of_week: input.dayOfWeek,
          start_time: { lte: input.slotStart },
          end_time: { gte: input.slotEnd },
        },
        select: { id: true },
      });

      if (!availableSlot) {
        throw this.buildNoAvailableSlotError();
      }

      const gymDayRange = getGymDayUtcRange(input.scheduledAt);
      const candidates = await tx.coachAppointment.findMany({
        where: {
          coach_id: input.coachId,
          status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
          scheduled_at: gymDayRange,
        },
        select: {
          id: true,
          scheduled_at: true,
          duration_minutes: true,
        },
      });

      const hasConflict = candidates.some((appointment) => {
        const existingStartsAt = appointment.scheduled_at;
        const existingEndsAt = new Date(
          existingStartsAt.getTime() + appointment.duration_minutes * 60 * 1000,
        );

        return (
          existingStartsAt.getTime() < input.appointmentEndsAt.getTime() &&
          existingEndsAt.getTime() > input.scheduledAt.getTime()
        );
      });

      if (hasConflict) {
        throw this.buildScheduleConflict();
      }

      const paidAt = new Date();
      const paymentStage = input.paymentStage ?? PaymentStage.full;
      const isFreeSession = input.totalAmount.equals(0);

      const appointment = await tx.coachAppointment.create({
        data: {
          user: { connect: { id: input.userId } },
          coach: { connect: { id: input.coachId } },
          status: isFreeSession
            ? AppointmentStatus.confirmed
            : AppointmentStatus.pending_payment,
          is_free_session: isFreeSession,
          scheduled_at: input.scheduledAt,
          duration_minutes: input.durationMinutes,
          total_amount: input.totalAmount,
          downpayment_amount: input.downpaymentAmount,
          balance_amount: input.balanceAmount,
          gym_revenue: input.gymRevenue,
          coach_earnings: input.coachEarnings,
          downpayment_paid_at: isFreeSession ? paidAt : null,
          balance_paid_at: isFreeSession ? paidAt : null,
          member_notes: input.memberNotes ?? null,
        },
      });

      await tx.payment.create({
        data: {
          user: { connect: { id: input.userId } },
          verifier: { connect: { id: input.verifiedBy } },
          payable_type: 'coaching',
          payable_id: appointment.id,
          payment_stage: paymentStage,
          amount: input.paymentAmount ?? input.totalAmount,
          provider: PaymentProvider.cash,
          idempotency_key: input.idempotencyKey,
          status: isFreeSession
            ? PaymentStatus.completed
            : PaymentStatus.awaiting_verification,
          verified_at: isFreeSession ? paidAt : null,
        },
      });

      return appointment;
    });
  }

  getMyAppointments(userId: string, dto: DateRangeDTO) {
    return this.paginateByUserIdWithDateRange<MemberAppointmentRecord>(
      this.prisma.coachAppointment,
      userId,
      getGymDateRangeFilter(dto, 'scheduled_at'),
      {
        include: memberAppointmentInclude,
        orderBy: { scheduled_at: 'desc' },
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  getCoachAppointments(coachUserId: string, dto: DateRangeDTO) {
    return this.paginateWithDateRange<CoachScheduleRecord>(
      this.prisma.coachAppointment,
      {
        coach: {
          user_id: coachUserId,
        },
      },
      getGymDateRangeFilter(dto, 'scheduled_at'),
      {
        include: coachScheduleInclude,
        orderBy: { scheduled_at: 'desc' },
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  getStaffAppointments(dto: StaffAppointmentFilterDTO) {
    return this.paginateWithDateRange<StaffAppointmentRecord>(
      this.prisma.coachAppointment,
      {
        ...(dto.coach_id ? { coach_id: dto.coach_id } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      getGymDateRangeFilter(dto, 'scheduled_at'),
      {
        include: staffAppointmentInclude,
        orderBy: { scheduled_at: 'desc' },
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findAppointmentLifecycleContextByIdOrThrow(
    appointmentId: string,
  ): Promise<AppointmentLifecycleRecord> {
    return this.findByIdOrThrow<AppointmentLifecycleRecord>(
      this.prisma.coachAppointment,
      appointmentId,
      'CoachAppointment',
      this.appointmentLifecycleInclude,
    );
  }

  updateAppointment(
    appointmentId: string,
    data: Prisma.CoachAppointmentUpdateInput,
  ): Promise<CoachAppointment> {
    return this.updateById<CoachAppointment>(
      this.prisma.coachAppointment,
      appointmentId,
      data,
    );
  }

  findAppointmentNotificationContextByIdOrThrow(
    appointmentId: string,
  ): Promise<AppointmentNotificationContext> {
    return this.findByIdOrThrow<AppointmentNotificationContext>(
      this.prisma.coachAppointment,
      appointmentId,
      'CoachAppointment',
      this.appointmentNotificationInclude,
    );
  }

  async markAppointmentNoShowIfEligible(
    appointmentId: string,
    eligibleScheduledAt: Date,
    noShowAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.coachAppointment.updateMany({
      where: {
        id: appointmentId,
        status: AppointmentStatus.confirmed,
        scheduled_at: { lte: eligibleScheduledAt },
      },
      data: {
        status: AppointmentStatus.no_show,
        no_show_at: noShowAt,
      },
    });

    return result.count > 0;
  }

  findConfirmedAppointmentsPotentiallyNoShow(
    scheduledBefore: Date,
  ): Promise<NoShowCleanupCandidate[]> {
    return this.findAll<NoShowCleanupCandidate>(
      this.prisma.coachAppointment,
      {
        status: AppointmentStatus.confirmed,
        scheduled_at: { lte: scheduledBefore },
      },
      undefined,
      { scheduled_at: 'asc' },
      {
        id: true,
        scheduled_at: true,
        duration_minutes: true,
      },
    );
  }

  findFreeAppointmentsAwaitingCompletion(
    scheduledBefore: Date,
  ): Promise<FreeAppointmentCleanupCandidate[]> {
    return this.findAll<FreeAppointmentCleanupCandidate>(
      this.prisma.coachAppointment,
      {
        status: AppointmentStatus.confirmed,
        is_free_session: true,
        balance_amount: new Prisma.Decimal('0'),
        scheduled_at: { lte: scheduledBefore },
      },
      undefined,
      { scheduled_at: 'asc' },
      {
        id: true,
        user_id: true,
        coach_id: true,
        scheduled_at: true,
        duration_minutes: true,
      },
    );
  }

  async completeFreeAppointmentIfEligible(
    appointmentId: string,
    completedAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.coachAppointment.updateMany({
      where: {
        id: appointmentId,
        status: AppointmentStatus.confirmed,
        is_free_session: true,
        balance_amount: new Prisma.Decimal('0'),
      },
      data: {
        status: AppointmentStatus.completed,
        completed_at: completedAt,
      },
    });

    return result.count > 0;
  }

  private buildNoAvailableSlotError(): HttpException {
    return new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'No Available Slot',
        status: 422,
        detail:
          'The coach does not have an active availability slot that covers the requested appointment time.',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private buildScheduleConflict(): ConflictException {
    return new ConflictException({
      type: 'CONFLICT',
      title: 'Schedule Conflict',
      status: 409,
      detail:
        'The requested coach already has an active appointment that overlaps this time window.',
    });
  }
}

function toGymWallClockDate(value: Date): Date {
  return new Date(value.getTime() + GYM_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
}

function toGymDateKey(value: Date): string {
  return toGymWallClockDate(value).toISOString().slice(0, 10);
}

function getGymDateRangeFilter(
  dto: DateRangeDTO,
  dateField: string,
): { start_date?: string; end_date?: string; dateField: string } {
  return {
    start_date: dto.start_date
      ? normalizeGymDateBoundary(dto.start_date, 'start').toISOString()
      : undefined,
    end_date: dto.end_date
      ? normalizeGymDateBoundary(dto.end_date, 'end').toISOString()
      : undefined,
    dateField,
  };
}

function normalizeGymDateBoundary(
  value: string,
  boundary: 'start' | 'end',
): Date {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return new Date(value);
  }

  const [year, month, day] = value.split('-').map(Number);
  const gymDayStartUtc = new Date(
    Date.UTC(year, month - 1, day) -
      GYM_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
  );

  if (boundary === 'start') {
    return gymDayStartUtc;
  }

  return new Date(gymDayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
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
