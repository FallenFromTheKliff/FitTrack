import { ForbiddenException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExerciseCategory,
  FitnessGoal,
  PlanSource,
  UserRole,
} from '@prisma/client';

import { RelationshipService } from '../../coaching/relationship/relationship.service';
import { TrainingPlanRepository } from './training-plan.repository';
import { TrainingPlanService } from './training-plan.service';

describe('TrainingPlanService', () => {
  let service: TrainingPlanService;

  const repo = {
    listOwnedPlans: jest.fn(),
    findPlanByIdOrThrow: jest.fn(),
    findActiveExercisesByIds: jest.fn(),
    createPlan: jest.fn(),
    updatePlan: jest.fn(),
    listRecentCompletedLogs: jest.fn(),
    replaceActivePlan: jest.fn(),
    activateOwnedPlan: jest.fn(),
    deletePlanById: jest.fn(),
  };

  const relationshipService = {
    assertActiveClientRelationship: jest.fn(),
    hasActiveCoach: jest.fn().mockResolvedValue(false),
    getActiveCoachUserId: jest.fn().mockResolvedValue(null),
  };

  const makePlan = (overrides: Record<string, unknown> = {}) => ({
    id: 'plan-1',
    user_id: 'user-1',
    coach_id: null,
    source: PlanSource.self_created,
    title: 'Upper / Lower Strength Builder',
    goal: FitnessGoal.bulking,
    duration_weeks: 8,
    days_per_week: 4,
    is_active: false,
    is_template: false,
    created_at: new Date('2026-03-26T02:00:00.000Z'),
    updated_at: new Date('2026-03-26T03:00:00.000Z'),
    schedule_days: [
      {
        id: 'day-1',
        plan_id: 'plan-1',
        week_number: 1,
        day_of_week: 1,
        focus_label: 'Push Day',
        notes: null,
        created_at: new Date('2026-03-26T02:00:00.000Z'),
        updated_at: new Date('2026-03-26T03:00:00.000Z'),
        exercises: [
          {
            id: 'plan-exercise-1',
            schedule_day_id: 'day-1',
            exercise_id: 'exercise-1',
            sets: 4,
            reps: 10,
            duration_seconds: null,
            rest_seconds: 60,
            weight_kg_target: { toString: () => '80', toNumber: () => 80 },
            notes: null,
            order_index: 0,
            created_at: new Date('2026-03-26T02:00:00.000Z'),
            updated_at: new Date('2026-03-26T03:00:00.000Z'),
            exercise: {
              id: 'exercise-1',
              name: 'Barbell Back Squat',
              muscle_group: 'legs',
              category: ExerciseCategory.strength,
            },
          },
        ],
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingPlanService,
        { provide: TrainingPlanRepository, useValue: repo },
        { provide: RelationshipService, useValue: relationshipService },
      ],
    }).compile();

    service = module.get<TrainingPlanService>(TrainingPlanService);
    jest.clearAllMocks();
  });

  it('maps paginated plans to summary DTOs', async () => {
    repo.listOwnedPlans.mockResolvedValue({
      data: [makePlan()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(service.listPlans('user-1', {})).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'plan-1',
          title: 'Upper / Lower Strength Builder',
          created_at: '2026-03-26T02:00:00.000Z',
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });

  it('creates self-authored plans even when the member has an active coach', async () => {
    relationshipService.hasActiveCoach.mockResolvedValue(true);
    repo.findActiveExercisesByIds.mockResolvedValue([{ id: 'exercise-1' }]);
    repo.createPlan.mockResolvedValue(
      makePlan({
        user_id: 'member-1',
        coach_id: null,
      }),
    );

    await service.createPlan('member-1', UserRole.member, {
      title: 'Upper / Lower Strength Builder',
      goal: FitnessGoal.bulking,
      duration_weeks: 8,
      days_per_week: 4,
      schedule: [
        {
          week_number: 1,
          day_of_week: 1,
          focus_label: 'Push Day',
          exercises: [
            {
              exercise_id: 'exercise-1',
              sets: 4,
              reps: 10,
            },
          ],
        },
      ],
    });

    expect(repo.createPlan).toHaveBeenCalledWith({
      userId: 'member-1',
      coachUserId: null,
      source: PlanSource.self_created,
      title: 'Upper / Lower Strength Builder',
      goal: FitnessGoal.bulking,
      durationWeeks: 8,
      daysPerWeek: 4,
      isTemplate: false,
      schedule: [
        {
          weekNumber: 1,
          dayOfWeek: 1,
          focusLabel: 'Push Day',
          exercises: [
            {
              exerciseId: 'exercise-1',
              sets: 4,
              reps: 10,
              durationSeconds: null,
              restSeconds: 60,
              weightKgTarget: null,
              orderIndex: 0,
            },
          ],
        },
      ],
    });
  });

  it('rejects plan creation when an exercise is missing or inactive', async () => {
    repo.findActiveExercisesByIds.mockResolvedValue([]);

    await expect(
      service.createPlan('user-1', UserRole.member, {
        title: 'Upper / Lower Strength Builder',
        goal: FitnessGoal.bulking,
        duration_weeks: 8,
        days_per_week: 4,
        schedule: [
          {
            week_number: 1,
            day_of_week: 1,
            exercises: [{ exercise_id: 'exercise-1', sets: 4 }],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(repo.createPlan).not.toHaveBeenCalled();
  });

  it('rejects plan access for non-owners', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(
      makePlan({ user_id: 'other-user-1' }),
    );

    await expect(
      service.getPlanById('user-1', 'plan-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assigns a coach-owned source plan to an active client copy', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(
      makePlan({
        user_id: 'coach-user-1',
        coach_id: 'coach-user-1',
      }),
    );
    relationshipService.assertActiveClientRelationship.mockResolvedValue(
      undefined,
    );
    repo.replaceActivePlan.mockResolvedValue(
      makePlan({
        id: 'plan-2',
        user_id: 'member-1',
        coach_id: 'coach-user-1',
        source: PlanSource.coach_assigned,
      }),
    );

    const result = await service.assignPlan(
      'coach-user-1',
      'plan-1',
      'member-1',
    );

    expect(
      relationshipService.assertActiveClientRelationship,
    ).toHaveBeenCalledWith('coach-user-1', 'member-1');
    expect(repo.replaceActivePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'member-1',
        coachUserId: 'coach-user-1',
        source: PlanSource.coach_assigned,
      }),
    );
    expect(result.user_id).toBe('member-1');
    expect(result.coach_id).toBe('coach-user-1');
  });

  it('creates AI-authored plans as inactive drafts', async () => {
    repo.findActiveExercisesByIds.mockResolvedValue([{ id: 'exercise-1' }]);
    repo.createPlan.mockResolvedValue(
      makePlan({
        source: PlanSource.ai_generated,
        is_active: false,
      }),
    );

    const result = await service.createAiGeneratedPlan('user-1', {
      goal: FitnessGoal.bulking,
      title: 'AI Bulking Plan',
      durationWeeks: 8,
      daysPerWeek: 4,
      aiGenerationPrompt: {
        plan_input: { duration_weeks: 8, days_per_week: 4 },
      },
      schedule: [
        {
          weekNumber: 1,
          dayOfWeek: 1,
          exercises: [
            {
              exerciseId: 'exercise-1',
              sets: 4,
              reps: 10,
              durationSeconds: null,
              restSeconds: 60,
              weightKgTarget: null,
              orderIndex: 0,
            },
          ],
        },
      ],
    });

    expect(repo.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        source: PlanSource.ai_generated,
        isActive: false,
        aiGenerationPrompt: {
          plan_input: { duration_weeks: 8, days_per_week: 4 },
        },
      }),
    );
    expect(result.source).toBe(PlanSource.ai_generated);
    expect(result.is_active).toBe(false);
  });

  it('deletes plans that belong to the caller', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());
    repo.deletePlanById.mockResolvedValue(undefined);

    await service.deletePlan('user-1', 'plan-1');

    expect(repo.deletePlanById).toHaveBeenCalledWith('plan-1');
  });

  it('selects an owned preset as the active training plan', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());
    repo.activateOwnedPlan.mockResolvedValue(makePlan({ is_active: true }));

    const result = await service.activatePlan('user-1', 'plan-1');

    expect(repo.activateOwnedPlan).toHaveBeenCalledWith('user-1', 'plan-1');
    expect(result.is_active).toBe(true);
  });

  it('blocks member deletion of coach-assigned training plans', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(
      makePlan({
        coach_id: 'coach-user-1',
        source: PlanSource.coach_assigned,
      }),
    );

    await expect(service.deletePlan('user-1', 'plan-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.deletePlanById).not.toHaveBeenCalled();
  });

  it('keeps progression advice deterministic and history-backed', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());
    repo.listRecentCompletedLogs.mockResolvedValue([
      {
        created_at: new Date('2026-07-27T10:00:00.000Z'),
        exercise_id: 'exercise-1',
        reps_completed: 12,
        session_id: 'session-3',
        weight_kg: { toNumber: () => 80 },
      },
      {
        created_at: new Date('2026-07-25T10:00:00.000Z'),
        exercise_id: 'exercise-1',
        reps_completed: 11,
        session_id: 'session-2',
        weight_kg: { toNumber: () => 80 },
      },
      {
        created_at: new Date('2026-07-23T10:00:00.000Z'),
        exercise_id: 'exercise-1',
        reps_completed: 10,
        session_id: 'session-1',
        weight_kg: { toNumber: () => 80 },
      },
    ]);

    await expect(
      service.getProgressionSuggestions('user-1', 'plan-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        action: 'increase_load',
        exercise_id: 'exercise-1',
        source_revision: 'history-rule-v1',
        suggested_reps: 10,
        suggested_weight_kg: 82,
      }),
    ]);
  });

  it('blocks editing a coach-assigned plan copy', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(
      makePlan({
        coach_id: 'coach-user-1',
        source: PlanSource.coach_assigned,
      }),
    );

    await expect(
      service.updatePlan('user-1', UserRole.member, 'plan-1', {
        title: 'Changed title',
        goal: FitnessGoal.bulking,
        duration_weeks: 8,
        days_per_week: 4,
        schedule: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.updatePlan).not.toHaveBeenCalled();
  });
});
