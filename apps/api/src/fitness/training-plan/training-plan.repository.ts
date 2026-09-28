import { HttpException, Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  ExerciseCatalog,
  FitnessGoal,
  PaymentStage,
  PaymentStatus,
  PayableType,
  PlanSource,
  Prisma,
  TrainingPlan,
} from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDTO } from '../../user/dto/user-dto';

const trainingPlanDetailInclude = {
  schedule_days: {
    orderBy: [{ week_number: 'asc' }, { day_of_week: 'asc' }],
    include: {
      exercises: {
        orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }],
        include: {
          exercise: true,
        },
      },
    },
  },
} satisfies Prisma.TrainingPlanInclude;

export type TrainingPlanSummaryRecord = TrainingPlan;

export type TrainingPlanDetailRecord = Prisma.TrainingPlanGetPayload<{
  include: typeof trainingPlanDetailInclude;
}>;

type ActiveExerciseLookup = Pick<ExerciseCatalog, 'id'>;

export type TrainingPlanExerciseWriteInput = {
  exerciseId: string;
  sets: number;
  reps?: number | null;
  durationSeconds?: number | null;
  restSeconds: number;
  restSecondsBySet?: number[] | null;
  weightKgTarget?: number | null;
  orderIndex: number;
  notes?: string | null;
};

export type TrainingPlanScheduleDayWriteInput = {
  weekNumber: number;
  dayOfWeek: number;
  focusLabel?: string | null;
  notes?: string | null;
  isRestDay?: boolean | null;
  exercises: TrainingPlanExerciseWriteInput[];
};

export type TrainingPlanWriteInput = {
  userId: string;
  coachUserId?: string | null;
  source: PlanSource;
  title: string;
  goal: FitnessGoal;
  durationWeeks: number;
  daysPerWeek: number;
  isTemplate?: boolean;
  isActive?: boolean;
  aiGenerationPrompt?: Prisma.InputJsonValue;
  schedule: TrainingPlanScheduleDayWriteInput[];
};

@Injectable()
export class TrainingPlanRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listOwnedPlans(
    userId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<TrainingPlanSummaryRecord>> {
    return this.paginate<TrainingPlanSummaryRecord>(
      this.prisma.trainingPlan,
      {
        where: { user_id: userId },
        orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findPlanByIdOrThrow(planId: string): Promise<TrainingPlanDetailRecord> {
    return this.findByIdOrThrow<TrainingPlanDetailRecord>(
      this.prisma.trainingPlan,
      planId,
      'TrainingPlan',
      trainingPlanDetailInclude,
    );
  }

  findActiveExercisesByIds(ids: string[]): Promise<ActiveExerciseLookup[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.exerciseCatalog.findMany({
      where: {
        id: { in: ids },
        is_active: true,
      },
      select: { id: true },
    });
  }

  createPlan(input: TrainingPlanWriteInput): Promise<TrainingPlanDetailRecord> {
    return this.transaction(async (tx) =>
      tx.trainingPlan.create({
        data: this.buildCreatePlanData(input),
        include: trainingPlanDetailInclude,
      }),
    );
  }

  updatePlan(
    planId: string,
    input: TrainingPlanWriteInput,
  ): Promise<TrainingPlanDetailRecord> {
    return this.transaction(async (tx) => {
      await tx.trainingScheduleDay.deleteMany({
        where: { plan_id: planId },
      });

      return tx.trainingPlan.update({
        where: { id: planId },
        data: {
          title: input.title,
          goal: input.goal,
          duration_weeks: input.durationWeeks,
          days_per_week: input.daysPerWeek,
          schedule_days: {
            create: this.buildScheduleDaysCreate(input.schedule),
          },
        },
        include: trainingPlanDetailInclude,
      });
    });
  }

  listRecentCompletedLogs(
    userId: string,
    exerciseIds: string[],
  ): Promise<
    Array<{
      id: string;
      created_at: Date;
      exercise_id: string;
      plan_exercise_id: string | null;
      reps_completed: number | null;
      session_id: string;
      set_number: number;
      weight_kg: Prisma.Decimal | null;
    }>
  > {
    if (exerciseIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.exerciseLog.findMany({
      where: {
        user_id: userId,
        exercise_id: { in: exerciseIds },
        session: { status: 'completed' },
      },
      // The ascending primary-key tie-break is mirrored by the service so
      // equal-timestamp duplicate rows never depend on result-array order.
      orderBy: [
        { created_at: 'desc' },
        { set_number: 'desc' },
        { id: 'asc' },
      ],
      take: Math.min(160, Math.max(40, exerciseIds.length * 12)),
      select: {
        id: true,
        created_at: true,
        exercise_id: true,
        plan_exercise_id: true,
        reps_completed: true,
        session_id: true,
        set_number: true,
        weight_kg: true,
      },
    });
  }

  replaceActivePlan(
    input: TrainingPlanWriteInput,
  ): Promise<TrainingPlanDetailRecord> {
    return this.transaction(async (tx) => {
      await tx.trainingPlan.updateMany({
        where: {
          user_id: input.userId,
          is_active: true,
          is_template: false,
        },
        data: { is_active: false },
      });

      return tx.trainingPlan.create({
        data: this.buildCreatePlanData({
          ...input,
          isActive: true,
        }),
        include: trainingPlanDetailInclude,
      });
    });
  }

  async assignOneTimeAppointmentPlan(input: {
    appointmentId: string;
    coachUserId: string;
    memberId: string;
    goal: FitnessGoal;
    schedule: TrainingPlanScheduleDayWriteInput[];
    title: string;
  }): Promise<TrainingPlanDetailRecord> {
    return this.transaction(async (tx) => {
      const appointment = await tx.coachAppointment.findUnique({
        where: { id: input.appointmentId },
        select: {
          coach_id: true,
          recurring_plan_id: true,
          scheduled_at: true,
          status: true,
          user_id: true,
        },
      });
      const coach = await tx.coachProfile.findUnique({
        where: { user_id: input.coachUserId },
        select: { id: true },
      });
      if (
        !appointment ||
        !coach ||
        appointment.user_id !== input.memberId ||
        appointment.coach_id !== coach.id ||
        appointment.status !== AppointmentStatus.confirmed ||
        appointment.recurring_plan_id ||
        appointment.scheduled_at.getTime() <= Date.now()
      ) {
        throw this.buildOneTimeAssignmentError();
      }
      const [directPayment, checkoutHold] = await Promise.all([
        tx.payment.findFirst({
          where: {
            payable_id: input.appointmentId,
            payable_type: PayableType.coaching,
            payment_stage: PaymentStage.full,
            status: PaymentStatus.completed,
          },
          select: { id: true },
        }),
        tx.commerceCheckoutHold.findFirst({
          where: {
            appointment_id: input.appointmentId,
            kind: CommerceCheckoutHoldKind.one_time,
            status: CommerceCheckoutHoldStatus.consumed,
            payment: {
              is: {
                payable_type: PayableType.commerce_checkout_hold,
                payment_stage: PaymentStage.full,
                status: PaymentStatus.completed,
              },
            },
          },
          select: { id: true },
        }),
      ]);
      if (!directPayment && !checkoutHold) {
        throw this.buildOneTimeAssignmentError();
      }
      const existing = await tx.coachWorkoutAssignment.findUnique({
        where: { appointment_id: input.appointmentId },
        select: {
          id: true,
          state: true,
          training_plan_id: true,
          workout_session_id: true,
        },
      });
      if (existing?.workout_session_id || existing?.state === 'completed') {
        throw this.buildOneTimeAssignmentError();
      }
      let planId = existing?.training_plan_id;
      if (planId) {
        await tx.trainingScheduleDay.deleteMany({ where: { plan_id: planId } });
        const updated = await tx.trainingPlan.update({
          where: { id: planId },
          data: {
            title: input.title,
            goal: input.goal,
            duration_weeks: 1,
            days_per_week: 1,
            is_active: false,
            is_template: false,
            schedule_days: {
              create: this.buildScheduleDaysCreate(input.schedule),
            },
          },
          select: { id: true },
        });
        planId = updated.id;
      } else {
        const created = await tx.trainingPlan.create({
          data: this.buildCreatePlanData({
            userId: input.memberId,
            coachUserId: input.coachUserId,
            source: PlanSource.coach_assigned,
            title: input.title,
            goal: input.goal,
            durationWeeks: 1,
            daysPerWeek: 1,
            isActive: false,
            isTemplate: false,
            schedule: input.schedule,
          }),
          select: { id: true },
        });
        planId = created.id;
      }
      const scheduleDay = await tx.trainingScheduleDay.findFirstOrThrow({
        where: { plan_id: planId, is_rest_day: { not: true } },
        orderBy: { created_at: 'asc' },
        select: { id: true },
      });
      if (existing) {
        await tx.coachWorkoutAssignment.update({
          where: { id: existing.id },
          data: {
            training_plan_id: planId,
            training_schedule_day_id: scheduleDay.id,
            sequence_index: 0,
            source: 'coach_override',
            state: 'assigned',
            held_at: null,
            completed_at: null,
          },
        });
      } else {
        await tx.coachWorkoutAssignment.create({
          data: {
            appointment_id: input.appointmentId,
            training_plan_id: planId,
            training_schedule_day_id: scheduleDay.id,
            sequence_index: 0,
            source: 'coach_override',
            state: 'assigned',
          },
        });
      }
      return tx.trainingPlan.findUniqueOrThrow({
        where: { id: planId },
        include: trainingPlanDetailInclude,
      });
    });
  }

  activateOwnedPlan(
    userId: string,
    planId: string,
  ): Promise<TrainingPlanDetailRecord> {
    return this.transaction(async (tx) => {
      await tx.trainingPlan.updateMany({
        where: {
          user_id: userId,
          is_active: true,
          is_template: false,
        },
        data: { is_active: false },
      });

      return tx.trainingPlan.update({
        where: { id: planId },
        data: { is_active: true },
        include: trainingPlanDetailInclude,
      });
    });
  }

  deletePlanById(planId: string): Promise<void> {
    return this.deleteById(this.prisma.trainingPlan, planId);
  }

  private buildCreatePlanData(
    input: TrainingPlanWriteInput,
  ): Prisma.TrainingPlanCreateInput {
    const data: Prisma.TrainingPlanCreateInput = {
      user: { connect: { id: input.userId } },
      coach: input.coachUserId
        ? { connect: { id: input.coachUserId } }
        : undefined,
      source: input.source,
      title: input.title,
      goal: input.goal,
      duration_weeks: input.durationWeeks,
      days_per_week: input.daysPerWeek,
      is_template: input.isTemplate ?? false,
      schedule_days: {
        create: this.buildScheduleDaysCreate(input.schedule),
      },
    };

    if (input.isActive !== undefined) {
      data.is_active = input.isActive;
    }

    if (input.aiGenerationPrompt !== undefined) {
      data.ai_generation_prompt = input.aiGenerationPrompt;
    }

    return data;
  }

  private buildScheduleDaysCreate(
    schedule: TrainingPlanScheduleDayWriteInput[],
  ): Prisma.TrainingScheduleDayCreateWithoutPlanInput[] {
    return schedule.map((day) => ({
      week_number: day.weekNumber,
      day_of_week: day.dayOfWeek,
      focus_label: day.focusLabel ?? null,
      notes: day.notes ?? null,
      ...(day.isRestDay === undefined
        ? {}
        : { is_rest_day: day.isRestDay }),
      exercises: {
        create: day.exercises.map((exercise) => ({
          exercise: { connect: { id: exercise.exerciseId } },
          sets: exercise.sets,
          reps: exercise.reps ?? null,
          duration_seconds: exercise.durationSeconds ?? null,
          rest_seconds: exercise.restSeconds,
          rest_seconds_by_set: exercise.restSecondsBySet ?? undefined,
          weight_kg_target: exercise.weightKgTarget ?? null,
          notes: exercise.notes ?? null,
          order_index: exercise.orderIndex,
        })),
      },
    }));
  }
  private buildOneTimeAssignmentError(): HttpException {
    return new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'One-Time Workout Assignment Unavailable',
        status: 422,
        detail:
          'A one-time workout requires a confirmed, fully paid, future appointment for this member and coach.',
      },
      422,
    );
  }

}
