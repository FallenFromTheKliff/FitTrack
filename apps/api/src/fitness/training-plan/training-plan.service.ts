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
  TrainingProgressionSuggestionResponseDTO,
  TrainingPlanScheduleDayResponseDTO,
  TrainingPlanSummaryResponseDTO,
} from './dto/training-plan.dto';
import {
  TrainingPlanDetailRecord,
  TrainingPlanRepository,
  TrainingPlanScheduleDayWriteInput,
  TrainingPlanSummaryRecord,
} from './training-plan.repository';

const DEFAULT_REST_SECONDS = 75;
const PROGRESSION_REP_BAND_SIZE = 2;

function safeLoadIncrementKg(currentWeightKg: number) {
  return currentWeightKg >= 50 ? 2 : 1;
}

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

  async listClientPlans(
    coachUserId: string,
    memberId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<TrainingPlanSummaryResponseDTO>> {
    await this.relationshipService.assertCoachClientAccess(
      coachUserId,
      memberId,
    );
    const result = await this.repo.listOwnedPlans(memberId, dto);
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

    const isOwner = plan.user_id === userId;
    const isManagingCoach = plan.coach_id === userId;
    if (!isOwner && !isManagingCoach) {
      this.assertPlanOwner(plan, userId);
    }

    if (!isOwner && isManagingCoach) {
      await this.relationshipService.assertCoachClientAccess(
        userId,
        plan.user_id,
      );
    }

    return this.toDetailResponse(plan);
  }

  async createPlan(
    userId: string,
    _userRole: UserRole,
    dto: CreateTrainingPlanDTO,
  ): Promise<TrainingPlanDetailResponseDTO> {
    this.assertScheduleConsistency(dto);
    await this.assertExercisesExist(dto);

    const created = await this.repo.createPlan({
      userId,
      coachUserId: null,
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

  async updatePlan(
    userId: string,
    userRole: UserRole,
    planId: string,
    dto: CreateTrainingPlanDTO,
  ): Promise<TrainingPlanDetailResponseDTO> {
    const plan = await this.repo.findPlanByIdOrThrow(planId);
    const isOwner = plan.user_id === userId;
    const isManagingCoach =
      !isOwner &&
      userRole === UserRole.coach &&
      plan.source === PlanSource.coach_assigned &&
      plan.coach_id === userId;

    if (isManagingCoach) {
      await this.relationshipService.assertCoachClientAccess(
        userId,
        plan.user_id,
      );
    } else {
      this.assertPlanOwner(plan, userId);
      this.assertPlanIsOwnerMutable(plan);
    }

    this.assertScheduleConsistency(dto);
    await this.assertExercisesExist(dto);
    const updated = await this.repo.updatePlan(planId, {
      userId: plan.user_id,
      coachUserId: plan.coach_id,
      source: plan.source,
      title: dto.title,
      goal: dto.goal,
      durationWeeks: dto.duration_weeks,
      daysPerWeek: dto.days_per_week,
      isTemplate: plan.is_template,
      isActive: plan.is_active,
      schedule: this.toScheduleWriteInput(dto.schedule),
    });
    return this.toDetailResponse(updated);
  }

  async getProgressionSuggestions(
    userId: string,
    planId: string,
  ): Promise<TrainingProgressionSuggestionResponseDTO[]> {
    const plan = await this.repo.findPlanByIdOrThrow(planId);
    this.assertPlanOwner(plan, userId);
    const exercises = plan.schedule_days.flatMap((day) => day.exercises);
    const logs = await this.repo.listRecentCompletedLogs(userId, [
      ...new Set(exercises.map((exercise) => exercise.exercise_id)),
    ]);

    return exercises.map((exercise) => {
      const recent = logs.filter(
        (log) =>
          log.exercise_id === exercise.exercise_id &&
          log.plan_exercise_id === exercise.id,
      );
      const prescribedReps = exercise.reps ?? null;
      const prescribedSets = Math.max(1, exercise.sets);
      const sessionGroups = recent.reduce<Map<string, typeof recent>>(
        (groups, log) => {
          const sessionLogs = groups.get(log.session_id) ?? [];
          sessionLogs.push(log);
          groups.set(log.session_id, sessionLogs);
          return groups;
        },
        new Map(),
      );
      const occurrences = [...sessionGroups.values()]
        .map((sessionLogs) => {
          const completedSets = sessionLogs
            .filter((log) => log.reps_completed != null)
            .slice(0, prescribedSets);
          if (completedSets.length < prescribedSets) {
            return null;
          }

          return {
            minimumReps: Math.min(
              ...completedSets.map((log) => log.reps_completed as number),
            ),
            weightKg:
              completedSets
                .find((log) => log.weight_kg != null)
                ?.weight_kg?.toNumber() ?? null,
          };
        })
        .filter(
          (
            occurrence,
          ): occurrence is { minimumReps: number; weightKg: number | null } =>
            occurrence != null,
        )
        .slice(0, 6);
      const latestOccurrence = occurrences[0];
      const latestWeight =
        latestOccurrence?.weightKg ??
        exercise.weight_kg_target?.toNumber() ??
        null;
      const topOfRepBand =
        prescribedReps == null
          ? null
          : prescribedReps + PROGRESSION_REP_BAND_SIZE;
      const latestReachedBase =
        prescribedReps != null &&
        latestOccurrence != null &&
        latestOccurrence.minimumReps >= prescribedReps;
      const latestReachedTop =
        topOfRepBand != null &&
        latestOccurrence != null &&
        latestOccurrence.minimumReps >= topOfRepBand;
      const previousReachedTop =
        topOfRepBand != null &&
        occurrences[1] != null &&
        occurrences[1].minimumReps >= topOfRepBand;

      if (
        latestReachedTop &&
        previousReachedTop &&
        latestWeight != null &&
        latestWeight > 0
      ) {
        const incrementKg = safeLoadIncrementKg(latestWeight);
        return {
          plan_exercise_id: exercise.id,
          exercise_id: exercise.exercise_id,
          exercise_name: exercise.exercise.name,
          action: 'increase_load' as const,
          suggested_reps: prescribedReps,
          suggested_weight_kg: Math.round((latestWeight + incrementKg) * 2) / 2,
          confidence: 'high' as const,
          rationale: `The last two completed workouts reached the top of the rep range for every prescribed set. Add ${incrementKg} kg and return to the base rep target.`,
          source_revision: 'history-rule-v2' as const,
        };
      }

      if (latestReachedTop && previousReachedTop && prescribedReps != null) {
        return {
          plan_exercise_id: exercise.id,
          exercise_id: exercise.exercise_id,
          exercise_name: exercise.exercise.name,
          action: 'increase_reps' as const,
          suggested_reps: (topOfRepBand ?? prescribedReps) + 1,
          suggested_weight_kg: latestWeight,
          confidence: 'high' as const,
          rationale:
            'The last two completed workouts reached the top of the rep range. Add one rep because this exercise has no recorded load.',
          source_revision: 'history-rule-v2' as const,
        };
      }

      if (
        latestReachedBase &&
        prescribedReps != null &&
        topOfRepBand != null &&
        latestOccurrence.minimumReps < topOfRepBand
      ) {
        return {
          plan_exercise_id: exercise.id,
          exercise_id: exercise.exercise_id,
          exercise_name: exercise.exercise.name,
          action: 'increase_reps' as const,
          suggested_reps: Math.min(
            topOfRepBand,
            latestOccurrence.minimumReps + 1,
          ),
          suggested_weight_kg: latestWeight,
          confidence:
            occurrences.length >= 2 ? ('high' as const) : ('medium' as const),
          rationale:
            'Every prescribed set reached the current target in the latest completed workout. Add one rep per set and keep the load unchanged.',
          source_revision: 'history-rule-v2' as const,
        };
      }

      return {
        plan_exercise_id: exercise.id,
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.exercise.name,
        action: 'maintain' as const,
        suggested_reps:
          latestReachedTop && topOfRepBand != null
            ? topOfRepBand
            : prescribedReps,
        suggested_weight_kg: latestWeight,
        confidence:
          occurrences.length > 0 ? ('medium' as const) : ('low' as const),
        rationale: latestReachedTop
          ? 'The latest workout reached the top of the rep range. Repeat it once more before increasing load.'
          : occurrences.length > 0
            ? 'Keep the current target because the latest complete workout did not finish every prescribed set at the target reps.'
            : 'No complete workout history is available yet. Start with the prescribed target and reassess after the first completed session.',
        source_revision: 'history-rule-v2' as const,
      };
    });
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

    const activeCoachUserId =
      await this.relationshipService.getActiveCoachUserId(userId);
    const created = await this.repo.createPlan({
      userId,
      coachUserId: activeCoachUserId,
      source: PlanSource.ai_generated,
      title: input.title,
      goal: input.goal,
      durationWeeks: input.durationWeeks,
      daysPerWeek: input.daysPerWeek,
      isActive: false,
      isTemplate: false,
      aiGenerationPrompt: input.aiGenerationPrompt,
      schedule: input.schedule,
    });

    return this.toDetailResponse(created);
  }

  async deletePlan(userId: string, planId: string): Promise<void> {
    const plan = await this.repo.findPlanByIdOrThrow(planId);
    this.assertPlanOwner(plan, userId);
    this.assertPlanIsOwnerMutable(plan);
    await this.repo.deletePlanById(planId);
  }

  async activatePlan(
    userId: string,
    planId: string,
  ): Promise<TrainingPlanDetailResponseDTO> {
    const plan = await this.repo.findPlanByIdOrThrow(planId);
    const isOwner = plan.user_id === userId;
    const isManagingCoach = plan.coach_id === userId;
    if (!isOwner && !isManagingCoach) {
      this.assertPlanOwner(plan, userId);
    }

    if (isOwner && plan.source === PlanSource.ai_generated && plan.coach_id) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Coach Approval Required',
        status: 403,
        detail:
          'This AI suggestion is a draft for your coach to review before it can become active.',
      });
    }

    if (plan.is_template) {
      throw this.buildValidationException(
        'Template Plan Cannot Be Activated',
        'Only member-owned workout split presets can be selected for tracking.',
      );
    }

    const activated = await this.repo.activateOwnedPlan(plan.user_id, planId);
    return this.toDetailResponse(activated);
  }

  async assignPlan(
    coachUserId: string,
    planId: string,
    memberId: string,
  ): Promise<TrainingPlanDetailResponseDTO> {
    const sourcePlan = await this.repo.findPlanByIdOrThrow(planId);
    this.assertCoachOwnsSourcePlan(sourcePlan, coachUserId);

    await this.relationshipService.assertCoachClientAccess(
      coachUserId,
      memberId,
    );

    const assignedPlan = await this.repo.replaceActivePlan({
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
        ...(day.is_rest_day === undefined
          ? {}
          : { isRestDay: day.is_rest_day }),
        exercises: day.exercises.map((exercise) => ({
          exerciseId: exercise.exercise_id,
          sets: exercise.sets,
          reps: exercise.reps,
          durationSeconds: exercise.duration_seconds,
          restSeconds: exercise.rest_seconds,
          restSecondsBySet: this.toRestSecondsBySet(
            exercise.rest_seconds_by_set,
          ),
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

  private assertPlanIsOwnerMutable(
    plan: Pick<TrainingPlanDetailRecord, 'source' | 'coach_id'>,
  ): void {
    if (plan.source === PlanSource.coach_assigned && plan.coach_id) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Coach Assigned Plan Locked',
        status: 403,
        detail:
          'Coach-assigned workout splits can be selected, but only the assigning coach can change or remove them.',
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

      if (day.isRestDay === true && day.exercises.length > 0) {
        throw this.buildValidationException(
          'Rest Day Contains Exercises',
          'rest days cannot contain exercises.',
        );
      }

      if (day.isRestDay !== true && day.exercises.length === 0) {
        throw this.buildValidationException(
          'Empty Workout Day',
          'workout days must contain at least one exercise.',
        );
      }

      for (const exercise of day.exercises) {
        if (
          exercise.restSecondsBySet &&
          exercise.restSecondsBySet.length !== exercise.sets
        ) {
          throw this.buildValidationException(
            'Invalid Per-Set Rest Timers',
            'rest_seconds_by_set must contain exactly one timer for each set.',
          );
        }
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
      ...(day.is_rest_day === undefined
        ? {}
        : { isRestDay: day.is_rest_day }),
      exercises: day.exercises.map((exercise, index) => ({
        exerciseId: exercise.exercise_id,
        sets: exercise.sets,
        reps: exercise.reps ?? null,
        durationSeconds: exercise.duration_seconds ?? null,
        restSeconds: exercise.rest_seconds ?? DEFAULT_REST_SECONDS,
        restSecondsBySet: exercise.rest_seconds_by_set ?? null,
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
      is_rest_day: day.is_rest_day ?? null,
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
      rest_seconds_by_set: this.toRestSecondsBySet(
        exercise.rest_seconds_by_set,
      ),
      weight_kg_target: exercise.weight_kg_target?.toString() ?? null,
      notes: exercise.notes ?? null,
      order_index: exercise.order_index,
    };
  }

  private toRestSecondsBySet(value: Prisma.JsonValue | null): number[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const timers = value.filter(
      (item): item is number =>
        typeof item === 'number' &&
        Number.isInteger(item) &&
        item >= 0 &&
        item <= 600,
    );

    return timers.length === value.length ? timers : null;
  }
}
