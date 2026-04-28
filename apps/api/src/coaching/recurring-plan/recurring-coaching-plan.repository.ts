import { Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  Prisma,
  RecurringCoachingPlanStatus,
  RecurringCoachingSessionState,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export const ACTIVE_RECURRING_APPOINTMENT_STATUSES = [
  AppointmentStatus.pending_coach,
  AppointmentStatus.pending_payment,
  AppointmentStatus.confirmed,
] as const;

const MAX_DURATION_LOOKBACK_MINUTES = 180;

export type RecurringPlanCoachContext = Prisma.CoachProfileGetPayload<{
  include: {
    availability_slots: true;
    user: {
      include: {
        profile: true;
      };
    };
  };
}>;

export type RecurringPlanWithSessions = Prisma.RecurringCoachingPlanGetPayload<{
  include: {
    appointments: {
      orderBy: { scheduled_at: 'asc' };
    };
  };
}>;

export type RecurringPlanSessionRecord = Prisma.CoachAppointmentGetPayload<{
  include: {
    recurring_plan: true;
  };
}>;

@Injectable()
export class RecurringCoachingPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveMember(userId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        role: UserRole.member,
        status: UserStatus.active,
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  findCoachContext(coachId: string): Promise<RecurringPlanCoachContext | null> {
    return this.prisma.coachProfile.findFirst({
      where: {
        id: coachId,
        user: { status: UserStatus.active, deletedAt: null },
      },
      include: {
        availability_slots: {
          where: { is_active: true },
          orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
        },
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  async findConflictingAppointments(input: {
    coachId: string;
    endsAt: Date;
    excludeAppointmentIds?: string[];
    startsAt: Date;
  }) {
    const candidates = await this.prisma.coachAppointment.findMany({
      where: {
        coach_id: input.coachId,
        status: { in: [...ACTIVE_RECURRING_APPOINTMENT_STATUSES] },
        ...(input.excludeAppointmentIds?.length
          ? { id: { notIn: input.excludeAppointmentIds } }
          : {}),
        scheduled_at: {
          gte: new Date(
            input.startsAt.getTime() -
              MAX_DURATION_LOOKBACK_MINUTES * 60 * 1000,
          ),
          lt: input.endsAt,
        },
      },
      select: {
        id: true,
        scheduled_at: true,
        duration_minutes: true,
      },
    });

    return candidates.filter((appointment) => {
      const existingStartsAt = appointment.scheduled_at;
      const existingEndsAt = new Date(
        existingStartsAt.getTime() + appointment.duration_minutes * 60 * 1000,
      );

      return (
        existingStartsAt.getTime() < input.endsAt.getTime() &&
        existingEndsAt.getTime() > input.startsAt.getTime()
      );
    });
  }

  createPlanWithSessions(input: {
    appointments: Omit<
      Prisma.CoachAppointmentCreateManyInput,
      'recurring_plan_id'
    >[];
    plan: Prisma.RecurringCoachingPlanCreateInput;
  }): Promise<RecurringPlanWithSessions> {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.recurringCoachingPlan.create({
        data: input.plan,
      });

      if (input.appointments.length > 0) {
        await tx.coachAppointment.createMany({
          data: input.appointments.map((appointment) => ({
            ...appointment,
            recurring_plan_id: plan.id,
          })),
        });
      }

      return tx.recurringCoachingPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: {
          appointments: {
            orderBy: { scheduled_at: 'asc' },
          },
        },
      });
    });
  }

  findPlanWithSessions(
    planId: string,
  ): Promise<RecurringPlanWithSessions | null> {
    return this.prisma.recurringCoachingPlan.findUnique({
      where: { id: planId },
      include: {
        appointments: {
          orderBy: { scheduled_at: 'asc' },
        },
      },
    });
  }

  findSessionForPlan(input: {
    planId: string;
    sessionId: string;
  }): Promise<RecurringPlanSessionRecord | null> {
    return this.prisma.coachAppointment.findFirst({
      where: {
        id: input.sessionId,
        recurring_plan_id: input.planId,
      },
      include: {
        recurring_plan: true,
      },
    });
  }

  updateSession(sessionId: string, data: Prisma.CoachAppointmentUpdateInput) {
    return this.prisma.coachAppointment.update({
      where: { id: sessionId },
      data,
    });
  }

  bulkRescheduleSessions(input: {
    planId: string;
    planUpdate: Prisma.RecurringCoachingPlanUpdateInput;
    sessions: Array<{
      coachId: string;
      originalScheduledAt: Date;
      scheduledAt: Date;
      sessionId: string;
    }>;
  }): Promise<RecurringPlanWithSessions> {
    return this.prisma.$transaction(async (tx) => {
      await tx.recurringCoachingPlan.update({
        where: { id: input.planId },
        data: input.planUpdate,
      });

      for (const session of input.sessions) {
        await tx.coachAppointment.update({
          where: { id: session.sessionId },
          data: {
            coach_id: session.coachId,
            scheduled_at: session.scheduledAt,
            original_scheduled_at: session.originalScheduledAt,
            recurring_state:
              RecurringCoachingSessionState.individually_rescheduled,
            status: AppointmentStatus.confirmed,
            cancelled_at: null,
            cancellation_reason: null,
          },
        });
      }

      return tx.recurringCoachingPlan.findUniqueOrThrow({
        where: { id: input.planId },
        include: {
          appointments: {
            orderBy: { scheduled_at: 'asc' },
          },
        },
      });
    });
  }

  cancelPlan(input: {
    cancelledAt: Date;
    planId: string;
    reason?: string;
  }): Promise<RecurringPlanWithSessions> {
    return this.prisma.$transaction(async (tx) => {
      await tx.recurringCoachingPlan.update({
        where: { id: input.planId },
        data: {
          status: RecurringCoachingPlanStatus.cancelled,
          cancellation_reason: input.reason ?? null,
          cancelled_at: input.cancelledAt,
        },
      });

      await tx.coachAppointment.updateMany({
        where: {
          recurring_plan_id: input.planId,
          status: {
            notIn: [AppointmentStatus.completed, AppointmentStatus.cancelled],
          },
          scheduled_at: { gte: input.cancelledAt },
        },
        data: {
          status: AppointmentStatus.cancelled,
          recurring_state: RecurringCoachingSessionState.cancelled,
          cancellation_reason: input.reason ?? 'Recurring plan cancelled.',
          cancelled_at: input.cancelledAt,
        },
      });

      return tx.recurringCoachingPlan.findUniqueOrThrow({
        where: { id: input.planId },
        include: {
          appointments: {
            orderBy: { scheduled_at: 'asc' },
          },
        },
      });
    });
  }

  async refreshPlanProgress(planId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const plan = await tx.recurringCoachingPlan.findUnique({
        where: { id: planId },
        select: { status: true },
      });

      if (!plan || plan.status === RecurringCoachingPlanStatus.cancelled) {
        return;
      }

      const [completedSessions, activeSessions] = await Promise.all([
        tx.coachAppointment.count({
          where: {
            recurring_plan_id: planId,
            status: AppointmentStatus.completed,
          },
        }),
        tx.coachAppointment.count({
          where: {
            recurring_plan_id: planId,
            recurring_state: {
              notIn: [
                RecurringCoachingSessionState.skipped,
                RecurringCoachingSessionState.cancelled,
              ],
            },
          },
        }),
      ]);

      await tx.recurringCoachingPlan.update({
        where: { id: planId },
        data: {
          completed_sessions: completedSessions,
          status:
            activeSessions > 0 && completedSessions >= activeSessions
              ? RecurringCoachingPlanStatus.completed
              : RecurringCoachingPlanStatus.active,
        },
      });
    });
  }
}
