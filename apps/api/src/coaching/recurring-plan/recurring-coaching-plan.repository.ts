import { Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  CoachWorkoutAssignmentSource,
  CoachWorkoutAssignmentState,
  Payment,
  Prisma,
  RecurringCoachingBillingCycleStatus,
  RecurringCoachingPlanStatus,
  RecurringCoachingScheduleItemStatus,
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
      orderBy: { scheduled_at: 'asc' },
      include: { workout_assignment: true };
    };
    billing_cycles: {
      orderBy: { cycle_start_date: 'asc' };
    };
    schedule_items: {
      orderBy: { sequence_index: 'asc' };
      include: { appointment: true };
    };
    coach: {
      select: { user_id: true };
    };
  };
}>;

export type RecurringPlanSessionRecord = Prisma.CoachAppointmentGetPayload<{
  include: {
    recurring_plan: true;
    workout_assignment: true;
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
    appointments?: Omit<
      Prisma.CoachAppointmentCreateManyInput,
      'recurring_plan_id'
    >[];
    billingCycles: Omit<
      Prisma.RecurringCoachingBillingCycleCreateManyInput,
      'recurring_plan_id'
    >[];
    scheduleItems?: Omit<
      Prisma.RecurringCoachingScheduleItemCreateManyInput,
      'recurring_plan_id'
    >[];
    plan: Prisma.RecurringCoachingPlanCreateInput;
  }): Promise<RecurringPlanWithSessions> {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.recurringCoachingPlan.create({
        data: input.plan,
      });

      if (input.appointments && input.appointments.length > 0) {
        await tx.coachAppointment.createMany({
          data: input.appointments.map((appointment) => ({
            ...appointment,
            recurring_plan_id: plan.id,
          })),
        });
      }

      if (input.scheduleItems && input.scheduleItems.length > 0) {
        await tx.recurringCoachingScheduleItem.createMany({
          data: input.scheduleItems.map((item) => ({
            ...item,
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
          coach: { select: { user_id: true } },
          appointments: {
            orderBy: { scheduled_at: 'asc' },
            include: { workout_assignment: true },
          },
          billing_cycles: {
            orderBy: { cycle_start_date: 'asc' },
          },
          schedule_items: {
            orderBy: { sequence_index: 'asc' },
            include: { appointment: true },
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
        coach: { select: { user_id: true } },
        appointments: {
          orderBy: { scheduled_at: 'asc' },
          include: { workout_assignment: true },
        },
        billing_cycles: {
          orderBy: { cycle_start_date: 'asc' },
        },
        schedule_items: {
          orderBy: { sequence_index: 'asc' },
          include: { appointment: true },
        },
      },
    });
  }

  listPlansForMember(memberId: string): Promise<RecurringPlanWithSessions[]> {
    return this.prisma.recurringCoachingPlan.findMany({
      where: { member_id: memberId },
      orderBy: [{ start_date: 'desc' }, { created_at: 'desc' }],
      include: {
        coach: { select: { user_id: true } },
        appointments: {
          orderBy: { scheduled_at: 'asc' },
          include: { workout_assignment: true },
        },
        billing_cycles: { orderBy: { cycle_start_date: 'asc' } },
        schedule_items: {
          orderBy: { sequence_index: 'asc' },
          include: { appointment: true },
        },
      },
    });
  }

  listPlansForCoachUser(userId: string): Promise<RecurringPlanWithSessions[]> {
    return this.prisma.recurringCoachingPlan.findMany({
      where: { coach: { user_id: userId } },
      orderBy: [{ start_date: 'desc' }, { created_at: 'desc' }],
      include: {
        coach: { select: { user_id: true } },
        appointments: {
          orderBy: { scheduled_at: 'asc' },
          include: { workout_assignment: true },
        },
        billing_cycles: { orderBy: { cycle_start_date: 'asc' } },
        schedule_items: {
          orderBy: { sequence_index: 'asc' },
          include: { appointment: true },
        },
      },
    });
  }

  listPlansForOperations(): Promise<RecurringPlanWithSessions[]> {
    return this.prisma.recurringCoachingPlan.findMany({
      orderBy: [{ start_date: 'desc' }, { created_at: 'desc' }],
      include: {
        coach: { select: { user_id: true } },
        appointments: {
          orderBy: { scheduled_at: 'asc' },
          include: { workout_assignment: true },
        },
        billing_cycles: { orderBy: { cycle_start_date: 'asc' } },
        schedule_items: {
          orderBy: { sequence_index: 'asc' },
          include: { appointment: true },
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

      const plan = await tx.recurringCoachingPlan.findUniqueOrThrow({
        where: { id: cycle.recurring_plan_id },
        include: {
          coach: true,
          schedule_items: {
            where: {
              status: RecurringCoachingScheduleItemStatus.pending_payment,
              scheduled_at: {
                gte: cycle.cycle_start_date,
                lt: new Date(
                  cycle.cycle_end_date.getTime() + 24 * 60 * 60 * 1000,
                ),
              },
            },
            orderBy: { sequence_index: 'asc' },
          },
          training_plan: {
            include: {
              schedule_days: {
                orderBy: [{ week_number: 'asc' }, { day_of_week: 'asc' }],
              },
            },
          },
        },
      });

      if (plan.schedule_items.length > 0) {
        const scheduleDays = plan.training_plan?.schedule_days ?? [];
        for (const [index, item] of plan.schedule_items.entries()) {
          const totalAmount = new Prisma.Decimal(item.amount);
          const gymRevenue = totalAmount
            .mul(new Prisma.Decimal(plan.coach.gym_commission_pct))
            .div(100)
            .toDecimalPlaces(2);
          const appointment = await tx.coachAppointment.create({
            data: {
              user_id: plan.member_id,
              coach_id: plan.coach_id,
              recurring_plan_id: plan.id,
              recurring_schedule_item_id: item.id,
              status: AppointmentStatus.confirmed,
              recurring_state: RecurringCoachingSessionState.generated,
              is_free_session: false,
              scheduled_at: item.scheduled_at,
              duration_minutes: item.duration_minutes,
              total_amount: totalAmount,
              downpayment_amount: new Prisma.Decimal(0),
              balance_amount: new Prisma.Decimal(0),
              gym_revenue: gymRevenue,
              coach_earnings: totalAmount.minus(gymRevenue).toDecimalPlaces(2),
              downpayment_paid_at: input.paidAt,
              balance_paid_at: input.paidAt,
            },
          });

          const scheduleDay = scheduleDays.length
            ? scheduleDays[index % scheduleDays.length]
            : null;
          if (scheduleDay) {
            await tx.coachWorkoutAssignment.create({
              data: {
                appointment_id: appointment.id,
                training_plan_id: scheduleDay.plan_id,
                training_schedule_day_id: scheduleDay.id,
                sequence_index: item.sequence_index,
                source: CoachWorkoutAssignmentSource.automatic,
                state: CoachWorkoutAssignmentState.assigned,
              },
            });
          }

          await tx.recurringCoachingScheduleItem.update({
            where: { id: item.id },
            data: { status: RecurringCoachingScheduleItemStatus.activated },
          });
        }
      } else {
        // Keep already-seeded legacy plans readable and payment-compatible.
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
            balance_paid_at: input.paidAt,
          },
        });
      }

      await tx.recurringCoachingPlan.updateMany({
        where: {
          id: cycle.recurring_plan_id,
          status: {
            in: [
              RecurringCoachingPlanStatus.draft,
              RecurringCoachingPlanStatus.awaiting_payment,
            ],
          },
        },
        data: { status: RecurringCoachingPlanStatus.active },
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
                  RecurringCoachingPlanStatus.awaiting_payment,
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
        workout_assignment: true,
      },
    });
  }

  updateSession(sessionId: string, data: Prisma.CoachAppointmentUpdateInput) {
    return this.prisma.coachAppointment.update({
      where: { id: sessionId },
      data,
    });
  }

  async skipWorkoutAssignmentAndShift(input: {
    appointmentId: string;
    planId: string;
    skippedAt: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const assignments = await tx.coachWorkoutAssignment.findMany({
        where: {
          appointment: {
            recurring_plan_id: input.planId,
          },
        },
        include: { appointment: true },
        orderBy: [{ appointment: { scheduled_at: 'asc' } }, { sequence_index: 'asc' }],
      });

      const skipped = assignments.find(
        (assignment) => assignment.appointment_id === input.appointmentId,
      );

      if (!skipped) return;

      await tx.coachWorkoutAssignment.update({
        where: { id: skipped.id },
        data: {
          state: CoachWorkoutAssignmentState.skipped,
          held_at: input.skippedAt,
          completed_at: null,
        },
      });

      let previousScheduleDayId = skipped.training_schedule_day_id;
      const futureAssignments = assignments.filter(
        (assignment) =>
          assignment.appointment.scheduled_at.getTime() >
            skipped.appointment.scheduled_at.getTime() &&
          assignment.state !== CoachWorkoutAssignmentState.completed &&
          assignment.state !== CoachWorkoutAssignmentState.skipped &&
          assignment.appointment.status !== AppointmentStatus.completed &&
          assignment.appointment.status !== AppointmentStatus.cancelled,
      );

      for (const assignment of futureAssignments) {
        // A coach override is an explicit scheduling decision. Do not silently
        // rewrite it or any sessions after that decision during auto-progression.
        if (assignment.source === CoachWorkoutAssignmentSource.coach_override) {
          break;
        }

        const nextScheduleDayId = assignment.training_schedule_day_id;

        await tx.coachWorkoutAssignment.update({
          where: { id: assignment.id },
          data: {
            training_schedule_day_id: previousScheduleDayId,
            source: CoachWorkoutAssignmentSource.automatic,
            state: CoachWorkoutAssignmentState.assigned,
            held_at: null,
            completed_at: null,
            override_reason: null,
          },
        });

        previousScheduleDayId = nextScheduleDayId;
      }
    });
  }

  async markWorkoutAssignmentCompleted(input: {
    appointmentId: string;
    completedAt: Date;
  }): Promise<void> {
    await this.prisma.coachWorkoutAssignment.updateMany({
      where: { appointment_id: input.appointmentId },
      data: {
        state: CoachWorkoutAssignmentState.completed,
        completed_at: input.completedAt,
        held_at: null,
      },
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
          coach: { select: { user_id: true } },
          appointments: {
            orderBy: { scheduled_at: 'asc' },
            include: { workout_assignment: true },
          },
          billing_cycles: {
            orderBy: { cycle_start_date: 'asc' },
          },
          schedule_items: {
            orderBy: { sequence_index: 'asc' },
            include: { appointment: true },
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
          coach: { select: { user_id: true } },
          appointments: {
            orderBy: { scheduled_at: 'asc' },
            include: { workout_assignment: true },
          },
          billing_cycles: {
            orderBy: { cycle_start_date: 'asc' },
          },
          schedule_items: {
            orderBy: { sequence_index: 'asc' },
            include: { appointment: true },
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

      if (
        !plan ||
        plan.status === RecurringCoachingPlanStatus.cancelled ||
        plan.status === RecurringCoachingPlanStatus.draft ||
        plan.status === RecurringCoachingPlanStatus.awaiting_payment
      ) {
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
          total_sessions: activeSessions,
          status:
            activeSessions > 0 && completedSessions >= activeSessions
              ? RecurringCoachingPlanStatus.completed
              : RecurringCoachingPlanStatus.active,
        },
      });
    });
  }
}
