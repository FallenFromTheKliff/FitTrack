import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { FitnessGoal, PlanSource, Prisma, UserRole } from '@prisma/client';

import { PaginatedResult } from '../../common/base-repository/base-repository';
import { RelationshipService } from '../../coaching/relationship/relationship.service';
import { PaginationDTO } from '../../user/dto/user-dto';
import {
  CreateTrainingPlanDTO,
  TrainingPlanDetailResponseDTO,
  TrainingPlanExerciseResponseDTO,
  TrainingPlanScheduleDayResponseDTO,
  TrainingPlanSummaryResponseDTO,
} from './dto/training-plan.dto';
import {
  TrainingPlanDetailRecord,
  TrainingPlanRepository,
  TrainingPlanScheduleDayWriteInput,
  TrainingPlanSummaryRecord,
} from './training-plan.repository';

const DEFAULT_REST_SECONDS = 60;

export type CreateAiGeneratedTrainingPlanInput = {
  goal: FitnessGoal;
  title: string;
  durationWeeks: number;
  daysPerWeek: number;
  aiGenerationPrompt: Prisma.InputJsonValue;
  schedule: TrainingPlanScheduleDayWriteInput[];
};

@Injectable()
export class TrainingPlanService {
  constructor(
    private readonly repo: TrainingPlanRepository,
    private readonly relationshipService: RelationshipService,
  ) {}

  async listPlans(
    userId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<TrainingPlanSummaryResponseDTO>> {
    const result = await this.repo.listOwnedPlans(userId, dto);

    return {
      data: result.data.map((plan) => this.toSummaryResponse(plan)),
      meta: result.meta,
    };
  }

  async getPlanById(
    userId: string,
    planId: string,
  ): Promise<TrainingPlanDetailResponseDTO> {
    const plan = await this.repo.findPlanByIdOrThrow(planId);
    this.assertPlanOwner(plan, userId);
    return this.toDetailResponse(plan);
  }

  async createPlan(
    userId: string,
    userRole: UserRole,
    dto: CreateTrainingPlanDTO,
  ): Promise<TrainingPlanDetailResponseDTO> {
    this.assertScheduleConsistency(dto);
    await this.assertExercisesExist(dto);

    const created = await this.repo.createPlan({
      userId,
      coachUserId: userRole === UserRole.coach ? userId : null,
      source: PlanSource.self_created,
      title: dto.title,
      goal: dto.goal,
      durationWeeks: dto.duration_weeks,
      daysPerWeek: dto.days_per_week,
      isTemplate: false,
      schedule: this.toScheduleWriteInput(dto.schedule),
    });

    return this.toDetailResponse(created);
  }

  async createAiGeneratedPlan(
    userId: string,
    input: CreateAiGeneratedTrainingPlanInput,
  ): Promise<TrainingPlanDetailResponseDTO> {
    this.assertScheduleWriteConsistency(
      input.durationWeeks,
      input.daysPerWeek,
      input.schedule,
    );
    await this.assertExerciseIdsExist(
      this.extractUniqueExerciseIds(input.schedule),
    );

    const created = await this.repo.replaceActivePlan({
      userId,
      coachUserId: null,
      source: PlanSource.ai_generated,
      title: input.title,
      goal: input.goal,
      durationWeeks: input.durationWeeks,
      daysPerWeek: input.daysPerWeek,
      isActive: true,
      isTemplate: false,
      aiGenerationPrompt: input.aiGenerationPrompt,
      schedule: input.schedule,
    });

    return this.toDetailResponse(created);
  }

  async deletePlan(userId: string, planId: string): Promise<void> {
    const plan = await this.repo.findPlanByIdOrThrow(planId);
    this.assertPlanOwner(plan, userId);
    await this.repo.deletePlanById(planId);
  }

  async assignPlan(
    coachUserId: string,
    planId: string,
    memberId: string,
  ): Promise<TrainingPlanDetailResponseDTO> {
    const sourcePlan = await this.repo.findPlanByIdOrThrow(planId);
    this.assertCoachOwnsSourcePlan(sourcePlan, coachUserId);

    await this.relationshipService.assertActiveClientRelationship(
      coachUserId,
      memberId,
    );

    const assignedPlan = await this.repo.createPlan({
      userId: memberId,
      coachUserId,
      source: PlanSource.coach_assigned,
      title: sourcePlan.title,
      goal: sourcePlan.goal,
      durationWeeks: sourcePlan.duration_weeks,
      daysPerWeek: sourcePlan.days_per_week,
      isTemplate: false,
      schedule: sourcePlan.schedule_days.map((day) => ({
        weekNumber: day.week_number,
        dayOfWeek: day.day_of_week,
        focusLabel: day.focus_label,
        notes: day.notes,
        exercises: day.exercises.map((exercise) => ({
          exerciseId: exercise.exercise_id,
          sets: exercise.sets,
          reps: exercise.reps,
          durationSeconds: exercise.duration_seconds,
          restSeconds: exercise.rest_seconds,
          weightKgTarget: exercise.weight_kg_target?.toNumber() ?? null,
          orderIndex: exercise.order_index,
          notes: exercise.notes,
        })),
      })),
    });

    return this.toDetailResponse(assignedPlan);
  }

  private assertPlanOwner(
    plan: Pick<TrainingPlanDetailRecord, 'user_id'>,
    userId: string,
  ): void {
    if (plan.user_id !== userId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Training Plan Forbidden',
        status: 403,
        detail: 'You can only access your own training plans.',
      });
    }
  }

  private assertCoachOwnsSourcePlan(
    plan: Pick<TrainingPlanDetailRecord, 'user_id'>,
    coachUserId: string,
  ): void {
    if (plan.user_id !== coachUserId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Training Plan Assignment Forbidden',
        status: 403,
        detail: 'Coaches can only assign training plans that they own.',
      });
    }
  }

  private async assertExercisesExist(
    dto: CreateTrainingPlanDTO,
  ): Promise<void> {
    await this.assertExerciseIdsExist(
      this.extractUniqueExerciseIds(this.toScheduleWriteInput(dto.schedule)),
    );
  }

  private assertScheduleConsistency(dto: CreateTrainingPlanDTO): void {
    this.assertScheduleWriteConsistency(
      dto.duration_weeks,
      dto.days_per_week,
      this.toScheduleWriteInput(dto.schedule),
    );
  }

  private assertScheduleWriteConsistency(
    durationWeeks: number,
    daysPerWeekTarget: number,
    schedule: TrainingPlanScheduleDayWriteInput[],
  ): void {
    const seenDays = new Set<string>();
    const daysPerWeek = new Map<number, number>();

    for (const day of schedule) {
      if (day.weekNumber > durationWeeks) {
        throw this.buildValidationException(
          'Schedule Week Out Of Range',
          'schedule week_number must not exceed duration_weeks.',
        );
      }

      const dayKey = `${day.weekNumber}:${day.dayOfWeek}`;
      if (seenDays.has(dayKey)) {
        throw this.buildValidationException(
          'Duplicate Schedule Day',
          'schedule cannot contain duplicate week_number and day_of_week pairs.',
        );
      }

      seenDays.add(dayKey);

      const currentWeekDayCount = (daysPerWeek.get(day.weekNumber) ?? 0) + 1;
      daysPerWeek.set(day.weekNumber, currentWeekDayCount);

      if (currentWeekDayCount > daysPerWeekTarget) {
        throw this.buildValidationException(
          'Too Many Schedule Days',
          'schedule cannot contain more than days_per_week entries within the same week.',
        );
      }
    }
  }

  private async assertExerciseIdsExist(exerciseIds: string[]): Promise<void> {
    const activeExercises =
      await this.repo.findActiveExercisesByIds(exerciseIds);

    if (activeExercises.length !== exerciseIds.length) {
      throw this.buildValidationException(
        'Invalid Training Plan Exercises',
        'One or more selected exercises are missing or inactive.',
      );
    }
  }

  private extractUniqueExerciseIds(
    schedule: TrainingPlanScheduleDayWriteInput[],
  ): string[] {
    return [
      ...new Set(
        schedule.flatMap((day) =>
          day.exercises.map((exercise) => exercise.exerciseId),
        ),
      ),
    ];
  }

  private buildValidationException(
    title: string,
    detail: string,
  ): HttpException {
    return new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title,
        status: 422,
        detail,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private toScheduleWriteInput(
    schedule: CreateTrainingPlanDTO['schedule'],
  ): TrainingPlanScheduleDayWriteInput[] {
    return schedule.map((day) => ({
      weekNumber: day.week_number,
      dayOfWeek: day.day_of_week,
      focusLabel: day.focus_label ?? null,
      exercises: day.exercises.map((exercise, index) => ({
        exerciseId: exercise.exercise_id,
        sets: exercise.sets,
        reps: exercise.reps ?? null,
        durationSeconds: exercise.duration_seconds ?? null,
        restSeconds: exercise.rest_seconds ?? DEFAULT_REST_SECONDS,
        weightKgTarget: exercise.weight_kg_target ?? null,
        orderIndex: exercise.order_index ?? index,
      })),
    }));
  }

  private toSummaryResponse(
    plan: TrainingPlanSummaryRecord,
  ): TrainingPlanSummaryResponseDTO {
    return {
      id: plan.id,
      user_id: plan.user_id,
      coach_id: plan.coach_id ?? null,
      source: plan.source,
      title: plan.title,
      goal: plan.goal,
      duration_weeks: plan.duration_weeks,
      days_per_week: plan.days_per_week,
      is_active: plan.is_active,
      is_template: plan.is_template,
      created_at: plan.created_at.toISOString(),
      updated_at: plan.updated_at.toISOString(),
    };
  }

  private toDetailResponse(
    plan: TrainingPlanDetailRecord,
  ): TrainingPlanDetailResponseDTO {
    return {
      ...this.toSummaryResponse(plan),
      schedule_days: plan.schedule_days.map((day) =>
        this.toScheduleDayResponse(day),
      ),
    };
  }

  private toScheduleDayResponse(
    day: TrainingPlanDetailRecord['schedule_days'][number],
  ): TrainingPlanScheduleDayResponseDTO {
    return {
      id: day.id,
      week_number: day.week_number,
      day_of_week: day.day_of_week,
      focus_label: day.focus_label ?? null,
      notes: day.notes ?? null,
      exercises: day.exercises.map((exercise) =>
        this.toExerciseResponse(exercise),
      ),
    };
  }

  private toExerciseResponse(
    exercise: TrainingPlanDetailRecord['schedule_days'][number]['exercises'][number],
  ): TrainingPlanExerciseResponseDTO {
    return {
      id: exercise.id,
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.exercise.name,
      muscle_group: exercise.exercise.muscle_group,
      category: exercise.exercise.category,
      sets: exercise.sets,
      reps: exercise.reps ?? null,
      duration_seconds: exercise.duration_seconds ?? null,
      rest_seconds: exercise.rest_seconds,
      weight_kg_target: exercise.weight_kg_target?.toString() ?? null,
      notes: exercise.notes ?? null,
      order_index: exercise.order_index,
    };
  }
}
