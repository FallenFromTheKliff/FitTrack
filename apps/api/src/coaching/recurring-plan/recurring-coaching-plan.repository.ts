import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AppointmentStatus,
  CoachWorkoutAssignmentSource,
  CoachWorkoutAssignmentState,
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  PlanSource,
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
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

export const RECURRING_COACHING_ACTIVE_ENTITLEMENT_CONFLICT_TYPE =
  'RECURRING_COACHING_ACTIVE_ENTITLEMENT';

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

export type RecurringClientProgram = Prisma.TrainingPlanGetPayload<{
  include: {
    schedule_days: {
      orderBy: [{ week_number: 'asc' }, { day_of_week: 'asc' }];
      include: {
        exercises: {
          orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }];
          include: { exercise: { select: { name: true } } };
        };
      };
    };
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

  async findMemberCoachEnrollment(input: {
    coachId: string;
    memberId: string;
  }): Promise<RecurringPlanWithSessions | null> {
    const include = {
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
    } as const;

    const activeOrPaused = await this.prisma.recurringCoachingPlan.findFirst({
      where: {
        coach_id: input.coachId,
        member_id: input.memberId,
        status: {
          in: [
            RecurringCoachingPlanStatus.active,
            RecurringCoachingPlanStatus.paused,
          ],
        },
      },
      orderBy: { created_at: 'desc' },
      include,
    });
    if (activeOrPaused) {
      return activeOrPaused;
    }

    // awaiting_payment is only meaningful while a live full-payment checkout
    // is held. It is not itself a product entitlement and must not block a
    // new enrollment after a stale or terminal attempt.
    const awaitingPayment =
      await this.prisma.recurringCoachingPlan.findFirst({
        where: {
          coach_id: input.coachId,
          member_id: input.memberId,
          status: RecurringCoachingPlanStatus.awaiting_payment,
        },
        orderBy: { created_at: 'desc' },
        include,
      });
    if (!awaitingPayment) {
      return null;
    }

    const now = new Date();
    const liveHold = await this.prisma.commerceCheckoutHold.findFirst({
      where: {
        coach_id: input.coachId,
        user_id: input.memberId,
        kind: CommerceCheckoutHoldKind.monthly,
        status: CommerceCheckoutHoldStatus.held,
        expires_at: { gt: now },
        appointment_id: null,
        booking_id: null,
        membership_card_id: null,
        recurring_plan_id: null,
        subscription_id: null,
        payment: {
          is: {
            payable_type: PayableType.commerce_checkout_hold,
            payment_stage: PaymentStage.full,
            provider: PaymentProvider.paymongo,
            status: { in: [PaymentStatus.pending, PaymentStatus.processing] },
          },
        },
      },
      select: {
        id: true,
        appointment_id: true,
        booking_id: true,
        expires_at: true,
        membership_card_id: true,
        recurring_plan_id: true,
        status: true,
        subscription_id: true,
        payment: {
          select: {
            payable_id: true,
            payable_type: true,
            payment_stage: true,
            provider: true,
            status: true,
          },
        },
      },
    });

    if (
      !liveHold ||
      liveHold.status !== CommerceCheckoutHoldStatus.held ||
      liveHold.expires_at <= now ||
      liveHold.appointment_id !== null ||
      liveHold.booking_id !== null ||
      liveHold.membership_card_id !== null ||
      liveHold.recurring_plan_id !== null ||
      liveHold.subscription_id !== null ||
      !liveHold.payment ||
      liveHold.payment.payable_id !== liveHold.id ||
      liveHold.payment.payable_type !== PayableType.commerce_checkout_hold ||
      liveHold.payment.payment_stage !== PaymentStage.full ||
      liveHold.payment.provider !== PaymentProvider.paymongo ||
      (liveHold.payment.status !== PaymentStatus.pending &&
        liveHold.payment.status !== PaymentStatus.processing)
    ) {
      return null;
    }

    return awaitingPayment;
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

  async createPlanWithSessions(input: {
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
    try {
      return await this.prisma.$transaction(async (tx) => {
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target;
        const targetText = Array.isArray(target)
          ? target.map(String).join(',')
          : String(target ?? '');
        if (
          targetText.includes(
            'recurring_coaching_plans_active_coach_member_unique',
          ) ||
          (targetText.includes('coach_id') && targetText.includes('member_id'))
        ) {
          throw new ConflictException({
            type: RECURRING_COACHING_ACTIVE_ENTITLEMENT_CONFLICT_TYPE,
            title: 'Recurring Coaching Enrollment Already Exists',
            status: 409,
            detail:
              'Another recurring coaching enrollment for this coach and member was created concurrently. Refresh and continue with the existing enrollment.',
            conflict_kind: 'active_entitlement',
          });
        }
      }
      throw error;
    }
  }

  async createStaffCashEnrollment(input: {
    actorId: string;
    amount: Prisma.Decimal;
    coachId: string;
    durationMinutes: number;
    endDate: Date;
    idempotencyKey: string;
    memberId: string;
    preferredDays: number[];
    preferredTime: Date;
    referenceNo?: string;
    sessionCount: number;
    startDate: Date;
  }): Promise<RecurringPlanWithSessions> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.coachId + ':' + input.memberId}, 1))`;
        await tx.recurringCoachingPlan.updateMany({
          where: {
            coach_id: input.coachId,
            member_id: input.memberId,
            status: RecurringCoachingPlanStatus.awaiting_payment,
          },
          data: { status: RecurringCoachingPlanStatus.cancelled },
        });
        const existing = await tx.recurringCoachingPlan.findFirst({
          where: {
            coach_id: input.coachId,
            member_id: input.memberId,
            status: {
              in: [
                RecurringCoachingPlanStatus.active,
                RecurringCoachingPlanStatus.paused,
              ],
            },
          },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException({
            type: RECURRING_COACHING_ACTIVE_ENTITLEMENT_CONFLICT_TYPE,
            title: 'Recurring Coaching Enrollment Already Exists',
            status: 409,
            detail: 'This member already has an active or paused recurring coaching entitlement with this coach.',
            conflict_kind: 'active_entitlement',
          });
        }

        const paidAt = new Date();
        const plan = await tx.recurringCoachingPlan.create({
          data: {
            coach: { connect: { id: input.coachId } },
            created_by: input.actorId,
            duration_minutes: input.durationMinutes,
            end_date: input.endDate,
            frequency: 'monthly',
            member: { connect: { id: input.memberId } },
            preferred_days: input.preferredDays,
            preferred_time: input.preferredTime,
            quoted_amount: input.amount,
            start_date: input.startDate,
            status: RecurringCoachingPlanStatus.active,
            total_sessions: input.sessionCount,
          },
        });
        const cycle = await tx.recurringCoachingBillingCycle.create({
          data: {
            amount: input.amount,
            cycle_end_date: input.endDate,
            cycle_start_date: input.startDate,
            due_date: input.startDate,
            grace_period_ends_at: new Date(
              input.startDate.getTime() + 7 * 24 * 60 * 60 * 1000,
            ),
            paid_at: paidAt,
            recurring_plan: { connect: { id: plan.id } },
            status: RecurringCoachingBillingCycleStatus.paid,
          },
        });
        const payment = await tx.payment.create({
          data: {
            amount: input.amount,
            idempotency_key: input.idempotencyKey,
            payment_stage: PaymentStage.full,
            payable_id: cycle.id,
            payable_type: 'recurring_coaching',
            provider: PaymentProvider.cash,
            provider_ref: input.referenceNo ?? null,
            status: PaymentStatus.completed,
            user: { connect: { id: input.memberId } },
            verifier: { connect: { id: input.actorId } },
            verified_at: paidAt,
          },
        });
        await tx.recurringCoachingBillingCycle.update({
          where: { id: cycle.id },
          data: { payment_id: payment.id },
        });

        const relationship = await tx.coachClientRelationship.findFirst({
          where: {
            coach_id: input.coachId,
            member_id: input.memberId,
            status: {
              in: [
                'pending',
                'active',
                'paused',
              ],
            },
          },
        });
        if (relationship?.status === 'active' || relationship?.status === 'paused') {
          throw new ConflictException({
            type: 'CONFLICT',
            title: 'Coach-Client Relationship Already Active',
            status: 409,
            detail: 'This member already has an active relationship with this coach.',
          });
        }
        if (relationship) {
          await tx.coachClientRelationship.update({
            where: { id: relationship.id },
            data: { ended_at: null, started_at: paidAt, status: 'active' },
          });
        } else {
          await tx.coachClientRelationship.create({
            data: {
              coach: { connect: { id: input.coachId } },
              member: { connect: { id: input.memberId } },
              started_at: paidAt,
              status: 'active',
            },
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
            billing_cycles: { orderBy: { cycle_start_date: 'asc' } },
            schedule_items: {
              orderBy: { sequence_index: 'asc' },
              include: { appointment: true },
            },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Cash Enrollment Already Registered',
          status: 409,
          detail: 'The cash enrollment idempotency key has already been used.',
        });
      }
      throw error;
    }
  }

  async fillPaidPlanWithSessions(input: {
    appointments: Array<
      Omit<
        Prisma.CoachAppointmentCreateManyInput,
        'recurring_plan_id' | 'recurring_schedule_item_id'
      >
    >;
    paidAt: Date;
    paidCycleId: string;
    planId: string;
    planUpdate: Prisma.RecurringCoachingPlanUpdateInput;
    scheduleItems: Array<
      Omit<
        Prisma.RecurringCoachingScheduleItemCreateManyInput,
        'recurring_plan_id'
      >
    >;
    trainingPlanId: string;
  }): Promise<RecurringPlanWithSessions> {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.recurringCoachingPlan.findUnique({
        where: { id: input.planId },
        select: { status: true },
      });
      if (!plan || plan.status !== RecurringCoachingPlanStatus.active) {
        throw new ForbiddenException({
          type: 'FORBIDDEN',
          title: 'Full Payment Required',
          status: 403,
          detail:
            'The recurring coaching enrollment must be active before sessions can be authored.',
        });
      }

      const paidCycle = await tx.recurringCoachingBillingCycle.findFirst({
        where: {
          id: input.paidCycleId,
          recurring_plan_id: input.planId,
          status: RecurringCoachingBillingCycleStatus.paid,
        },
        select: { paid_at: true },
      });
      if (!paidCycle?.paid_at) {
        throw new ForbiddenException({
          type: 'FORBIDDEN',
          title: 'Full Payment Required',
          status: 403,
          detail:
            'The member must complete the full monthly payment before sessions can be authored.',
        });
      }

      const [existingScheduleItem, existingAppointment] = await Promise.all([
        tx.recurringCoachingScheduleItem.findFirst({
          where: { recurring_plan_id: input.planId },
          select: { id: true },
        }),
        tx.coachAppointment.findFirst({
          where: { recurring_plan_id: input.planId },
          select: { id: true },
        }),
      ]);
      if (existingScheduleItem || existingAppointment) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Recurring Coaching Schedule Already Exists',
          status: 409,
          detail:
            'This recurring coaching enrollment already has an authored schedule.',
        });
      }

      if (input.scheduleItems.length !== input.appointments.length) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Schedule Session Mismatch',
          status: 409,
          detail:
            'Every recurring coaching schedule item must have one matching appointment.',
        });
      }

      const trainingPlan = await tx.trainingPlan.findUnique({
        where: { id: input.trainingPlanId },
        select: {
          schedule_days: {
            orderBy: [{ week_number: 'asc' }, { day_of_week: 'asc' }],
          },
        },
      });
      if (!trainingPlan) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Workout Plan Not Found',
          status: 409,
          detail:
            'The linked coach workout plan no longer exists and the schedule was not authored.',
        });
      }

      await tx.recurringCoachingPlan.update({
        where: { id: input.planId },
        data: input.planUpdate,
      });

      for (const [index, scheduleItem] of input.scheduleItems.entries()) {
        const item = await tx.recurringCoachingScheduleItem.create({
          data: {
            ...scheduleItem,
            recurring_plan_id: input.planId,
          },
        });
        const appointment = await tx.coachAppointment.create({
          data: {
            ...input.appointments[index],
            recurring_plan_id: input.planId,
            recurring_schedule_item_id: item.id,
            downpayment_paid_at: paidCycle.paid_at,
            balance_paid_at: paidCycle.paid_at,
          },
        });

        const requestedScheduleDayId =
          input.scheduleItems[index]?.training_schedule_day_id;
        const scheduleDay = requestedScheduleDayId
          ? (trainingPlan.schedule_days.find(
              (candidate) => candidate.id === requestedScheduleDayId,
            ) ?? null)
          : trainingPlan.schedule_days.length
            ? trainingPlan.schedule_days[
                index % trainingPlan.schedule_days.length
              ]
            : null;
        if (scheduleDay) {
          await tx.coachWorkoutAssignment.create({
            data: {
              appointment_id: appointment.id,
              training_plan_id: scheduleDay.plan_id,
              training_schedule_day_id: scheduleDay.id,
              sequence_index: scheduleItem.sequence_index,
              source: CoachWorkoutAssignmentSource.automatic,
              state: CoachWorkoutAssignmentState.assigned,
            },
          });
        }
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

  findCoachAuthoredTrainingPlan(input: {
    trainingPlanId: string;
    memberId: string;
    coachUserId: string;
  }) {
    return this.prisma.trainingPlan.findFirst({
      where: {
        id: input.trainingPlanId,
        user_id: input.memberId,
        coach_id: input.coachUserId,
        source: PlanSource.coach_assigned,
        is_template: false,
      },
      select: { id: true },
    });
  }

  findClientProgram(input: {
    coachUserId: string;
    memberId: string;
    trainingPlanId: string;
  }): Promise<RecurringClientProgram | null> {
    return this.prisma.trainingPlan.findFirst({
      where: {
        id: input.trainingPlanId,
        user_id: input.memberId,
        coach_id: input.coachUserId,
        source: PlanSource.coach_assigned,
        is_active: true,
        is_template: false,
      },
      include: {
        schedule_days: {
          orderBy: [{ week_number: 'asc' }, { day_of_week: 'asc' }],
          include: {
            exercises: {
              orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }],
              include: { exercise: { select: { name: true } } },
            },
          },
        },
      },
    });
  }

  async fillPendingPlanWithSessions(input: {
    planId: string;
    planUpdate: Prisma.RecurringCoachingPlanUpdateInput;
    scheduleItems: Array<
      Omit<
        Prisma.RecurringCoachingScheduleItemCreateManyInput,
        'recurring_plan_id'
      >
    >;
  }): Promise<RecurringPlanWithSessions> {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.recurringCoachingPlan.findUnique({
        where: { id: input.planId },
        select: { status: true },
      });
      if (
        !plan ||
        (plan.status !== RecurringCoachingPlanStatus.draft &&
          plan.status !== RecurringCoachingPlanStatus.awaiting_payment)
      ) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Recurring Coaching Plan Not Pending',
          status: 409,
          detail:
            'Only an unscheduled recurring coaching plan can receive generated monthly sessions.',
        });
      }

      const [existingScheduleItem, existingAppointment] = await Promise.all([
        tx.recurringCoachingScheduleItem.findFirst({
          where: { recurring_plan_id: input.planId },
          select: { id: true },
        }),
        tx.coachAppointment.findFirst({
          where: { recurring_plan_id: input.planId },
          select: { id: true },
        }),
      ]);
      if (existingScheduleItem || existingAppointment) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Recurring Coaching Schedule Already Exists',
          status: 409,
          detail:
            'This recurring coaching plan already has an authored schedule.',
        });
      }

      await tx.recurringCoachingPlan.update({
        where: { id: input.planId },
        data: input.planUpdate,
      });
      if (input.scheduleItems.length > 0) {
        await tx.recurringCoachingScheduleItem.createMany({
          data: input.scheduleItems.map((item) => ({
            ...item,
            recurring_plan_id: input.planId,
          })),
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
          billing_cycles: { orderBy: { cycle_start_date: 'asc' } },
          schedule_items: {
            orderBy: { sequence_index: 'asc' },
            include: { appointment: true },
          },
        },
      });
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
  }) {
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
        for (const item of plan.schedule_items) {
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

          const scheduleDay = item.training_schedule_day_id
            ? (scheduleDays.find(
                (candidate) => candidate.id === item.training_schedule_day_id,
              ) ?? null)
            : scheduleDays.length
              ? scheduleDays[(item.sequence_index - 1) % scheduleDays.length]
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
        reason:
          'Recurring coach plan cancelled after unpaid monthly billing cycle exceeded the 7-day grace period.',
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
        orderBy: [
          { appointment: { scheduled_at: 'asc' } },
          { sequence_index: 'asc' },
        ],
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
