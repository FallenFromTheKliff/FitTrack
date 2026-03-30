import { Injectable } from '@nestjs/common';
import {
  ExerciseCatalog,
  FitnessGoal,
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
  weightKgTarget?: number | null;
  orderIndex: number;
  notes?: string | null;
};

export type TrainingPlanScheduleDayWriteInput = {
  weekNumber: number;
  dayOfWeek: number;
  focusLabel?: string | null;
  notes?: string | null;
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
        create: input.schedule.map((day) => ({
          week_number: day.weekNumber,
          day_of_week: day.dayOfWeek,
          focus_label: day.focusLabel ?? null,
          notes: day.notes ?? null,
          exercises: {
            create: day.exercises.map((exercise) => ({
              exercise: { connect: { id: exercise.exerciseId } },
              sets: exercise.sets,
              reps: exercise.reps ?? null,
              duration_seconds: exercise.durationSeconds ?? null,
              rest_seconds: exercise.restSeconds,
              weight_kg_target: exercise.weightKgTarget ?? null,
              notes: exercise.notes ?? null,
              order_index: exercise.orderIndex,
            })),
          },
        })),
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
}
