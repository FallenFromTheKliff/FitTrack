import { Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  Payment,
  Prisma,
  RecurringCoachingBillingCycleStatus,
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
    billing_cycles: {
      orderBy: { cycle_start_date: 'asc' };
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
    billingCycles: Omit<
      Prisma.RecurringCoachingBillingCycleCreateManyInput,
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

      if (input.billingCycles.length > 0) {
        await tx.recurringCoachingBillingCycle.createMany({
          data: input.billingCycles.map((cycle) => ({
            ...cycle,
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
          billing_cycles: {
            orderBy: { cycle_start_date: 'asc' },
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
        billing_cycles: {
          orderBy: { cycle_start_date: 'asc' },
        },
      },
    });
  }

  findBillingCycleForPlan(input: { cycleId: string; planId: string }) {
    return this.prisma.recurringCoachingBillingCycle.findFirst({
      where: {
        id: input.cycleId,
        recurring_plan_id: input.planId,
      },
      include: {
        recurring_plan: true,
      },
    });
  }

  findBillingCycleByPaymentId(paymentId: string) {
    return this.prisma.recurringCoachingBillingCycle.findUnique({
      where: { payment_id: paymentId },
      include: {
        recurring_plan: true,
      },
    });
  }

  async createBillingCyclePayment(input: {
    cycleId: string;
    data: Prisma.PaymentCreateInput;
    processingStatus: RecurringCoachingBillingCycleStatus;
  }): Promise<{ cycle: Prisma.RecurringCoachingBillingCycleGetPayload<{}>; payment: Payment }> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({ data: input.data });
      const cycle = await tx.recurringCoachingBillingCycle.update({
        where: { id: input.cycleId },
        data: {
          payment_id: payment.id,
          status: input.processingStatus,
        },
      });

      return { cycle, payment };
    });
  }

  updateBillingCycle(
    cycleId: string,
    data: Prisma.RecurringCoachingBillingCycleUpdateInput,
  ) {
    return this.prisma.recurringCoachingBillingCycle.update({
      where: { id: cycleId },
      data,
    });
  }

  async completeBillingCycle(input: {
    cycleId: string;
    paidAt: Date;
    paymentId: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const cycle = await tx.recurringCoachingBillingCycle.update({
        where: { id: input.cycleId },
        data: {
          status: RecurringCoachingBillingCycleStatus.paid,
          paid_at: input.paidAt,
          payment_id: input.paymentId,
        },
      });

      await tx.coachAppointment.updateMany({
        where: {
          recurring_plan_id: cycle.recurring_plan_id,
          status: AppointmentStatus.pending_payment,
          scheduled_at: {
            gte: cycle.cycle_start_date,
            lt: new Date(
              cycle.cycle_end_date.getTime() + 24 * 60 * 60 * 1000,
            ),
          },
        },
        data: {
          status: AppointmentStatus.confirmed,
          downpayment_paid_at: input.paidAt,
        },
      });
    });
  }

  async cancelOverdueBillingCycles(now: Date): Promise<number> {
    const overdueCycles =
      await this.prisma.recurringCoachingBillingCycle.findMany({
        where: {
          status: {
            in: [
              RecurringCoachingBillingCycleStatus.due,
              RecurringCoachingBillingCycleStatus.processing,
              RecurringCoachingBillingCycleStatus.awaiting_verification,
            ],
          },
          grace_period_ends_at: { lt: now },
          recurring_plan: {
            status: {
              in: [
                RecurringCoachingPlanStatus.active,
                RecurringCoachingPlanStatus.paused,
              ],
            },
          },
        },
        select: {
          id: true,
          recurring_plan_id: true,
        },
      });

    for (const cycle of overdueCycles) {
      await this.cancelPlan({
        cancelledAt: now,
        planId: cycle.recurring_plan_id,
        reason: 'Recurring coach plan cancelled after unpaid monthly billing cycle exceeded the 7-day grace period.',
      });
      await this.updateBillingCycle(cycle.id, {
        status: RecurringCoachingBillingCycleStatus.overdue,
      });
    }

    return overdueCycles.length;
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
          billing_cycles: {
            orderBy: { cycle_start_date: 'asc' },
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
          billing_cycles: {
            orderBy: { cycle_start_date: 'asc' },
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
