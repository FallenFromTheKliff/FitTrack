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
    assertCoachClientAccess: jest.fn(),
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
            rest_seconds_by_set: null,
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

  const makeUpdateDto = (overrides: Record<string, unknown> = {}) => ({
    title: 'Updated training plan',
    goal: FitnessGoal.maintenance,
    duration_weeks: 1,
    days_per_week: 1,
    schedule: [
      {
        week_number: 1,
        day_of_week: 1,
        is_rest_day: false,
        exercises: [{ exercise_id: 'exercise-1', sets: 3 }],
      },
    ],
    ...overrides,
  });

  const makeCompletedSessionLogs = (input: {
    sessionId: string;
    reps: number;
    weightKg: number | null;
    createdAt: string;
    sets?: number;
  }) =>
    Array.from({ length: input.sets ?? 4 }, (_, setIndex) => ({
      created_at: new Date(
        new Date(input.createdAt).getTime() + setIndex * 1_000,
      ),
      exercise_id: 'exercise-1',
      plan_exercise_id: 'plan-exercise-1',
      reps_completed: input.reps,
      session_id: input.sessionId,
      weight_kg:
        input.weightKg == null
          ? null
          : { toNumber: () => input.weightKg as number },
    }));

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
              restSeconds: 75,
              restSecondsBySet: null,
              weightKgTarget: null,
              orderIndex: 0,
            },
          ],
        },
      ],
    });
  });

  it('persists one rest timer per set when configured', async () => {
    repo.findActiveExercisesByIds.mockResolvedValue([{ id: 'exercise-1' }]);
    repo.createPlan.mockResolvedValue(makePlan());

    await service.createPlan('user-1', UserRole.member, {
      title: 'Timed split',
      goal: FitnessGoal.maintenance,
      duration_weeks: 8,
      days_per_week: 1,
      schedule: [
        {
          week_number: 1,
          day_of_week: 1,
          exercises: [
            {
              exercise_id: 'exercise-1',
              sets: 4,
              reps: 10,
              rest_seconds: 75,
              rest_seconds_by_set: [45, 60, 75, 90],
            },
          ],
        },
      ],
    });

    expect(repo.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: [
          expect.objectContaining({
            exercises: [
              expect.objectContaining({
                restSeconds: 75,
                restSecondsBySet: [45, 60, 75, 90],
              }),
            ],
          }),
        ],
      }),
    );
  });

  it('rejects per-set timers that do not match the exercise set count', async () => {
    await expect(
      service.createPlan('user-1', UserRole.member, {
        title: 'Broken timers',
        goal: FitnessGoal.maintenance,
        duration_weeks: 8,
        days_per_week: 1,
        schedule: [
          {
            week_number: 1,
            day_of_week: 1,
            exercises: [
              {
                exercise_id: 'exercise-1',
                sets: 3,
                rest_seconds_by_set: [60, 75],
              },
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(repo.createPlan).not.toHaveBeenCalled();
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

  it('accepts explicit rest days and persists their day kind', async () => {
    repo.findActiveExercisesByIds.mockResolvedValue([{ id: 'exercise-1' }]);
    repo.createPlan.mockResolvedValue(makePlan());

    await service.createPlan('user-1', UserRole.member, {
      title: 'PPL with recovery',
      goal: FitnessGoal.maintenance,
      duration_weeks: 1,
      days_per_week: 2,
      schedule: [
        {
          week_number: 1,
          day_of_week: 1,
          is_rest_day: false,
          exercises: [{ exercise_id: 'exercise-1', sets: 3 }],
        },
        {
          week_number: 1,
          day_of_week: 3,
          focus_label: 'Rest',
          is_rest_day: true,
          exercises: [],
        },
      ],
    });

    expect(repo.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: [
          expect.objectContaining({ isRestDay: false }),
          expect.objectContaining({ isRestDay: true, exercises: [] }),
        ],
      }),
    );
  });

  it('rejects empty workout days and rest days that carry exercises', async () => {
    await expect(
      service.createPlan('user-1', UserRole.member, {
        title: 'Empty workout',
        goal: FitnessGoal.maintenance,
        duration_weeks: 1,
        days_per_week: 1,
        schedule: [
          { week_number: 1, day_of_week: 1, is_rest_day: false, exercises: [] },
        ],
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ title: 'Empty Workout Day' }) });

    await expect(
      service.createPlan('user-1', UserRole.member, {
        title: 'Invalid recovery',
        goal: FitnessGoal.maintenance,
        duration_weeks: 1,
        days_per_week: 1,
        schedule: [
          {
            week_number: 1,
            day_of_week: 3,
            is_rest_day: true,
            exercises: [{ exercise_id: 'exercise-1', sets: 3 }],
          },
        ],
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ title: 'Rest Day Contains Exercises' }) });
    expect(repo.createPlan).not.toHaveBeenCalled();
  });

  it('updates an existing plan with a legacy rest row and retains explicit rest state', async () => {
    const existingPlan = makePlan({
      schedule_days: [
        makePlan().schedule_days[0],
        {
          id: 'day-rest',
          plan_id: 'plan-1',
          week_number: 1,
          day_of_week: 3,
          focus_label: 'Rest',
          is_rest_day: null,
          notes: 'Legacy recovery day',
          created_at: new Date('2026-03-26T02:00:00.000Z'),
          updated_at: new Date('2026-03-26T03:00:00.000Z'),
          exercises: [],
        },
      ],
    });
    repo.findPlanByIdOrThrow.mockResolvedValue(existingPlan);
    repo.findActiveExercisesByIds.mockResolvedValue([{ id: 'exercise-1' }]);
    repo.updatePlan.mockResolvedValue(existingPlan);

    await service.updatePlan('user-1', UserRole.member, 'plan-1', {
      title: 'PPL with recovery',
      goal: FitnessGoal.maintenance,
      duration_weeks: 1,
      days_per_week: 2,
      schedule: [
        {
          week_number: 1,
          day_of_week: 1,
          is_rest_day: false,
          exercises: [{ exercise_id: 'exercise-1', sets: 3 }],
        },
        {
          week_number: 1,
          day_of_week: 3,
          focus_label: 'Rest',
          is_rest_day: true,
          exercises: [],
        },
      ],
    });

    expect(repo.updatePlan).toHaveBeenCalledWith(
      'plan-1',
      expect.objectContaining({
        schedule: expect.arrayContaining([
          expect.objectContaining({ isRestDay: true, exercises: [] }),
        ]),
      }),
    );
  });

  it('allows the plan owner to update a mutable training plan', async () => {
    const updatedPlan = makePlan({ title: 'Updated training plan' });
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());
    repo.findActiveExercisesByIds.mockResolvedValue([{ id: 'exercise-1' }]);
    repo.updatePlan.mockResolvedValue(updatedPlan);

    await expect(
      service.updatePlan(
        'user-1',
        UserRole.member,
        'plan-1',
        makeUpdateDto(),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        title: 'Updated training plan',
        user_id: 'user-1',
      }),
    );
    expect(
      relationshipService.assertCoachClientAccess,
    ).not.toHaveBeenCalled();
    expect(repo.updatePlan).toHaveBeenCalledWith(
      'plan-1',
      expect.objectContaining({
        userId: 'user-1',
        coachUserId: null,
        source: PlanSource.self_created,
      }),
    );
  });

  it.each(['active monthly', 'valid paid one-session'])(
    'allows an authorized coach to update an assigned plan through an %s relationship',
    async () => {
      const assignedPlan = makePlan({
        user_id: 'member-1',
        coach_id: 'coach-user-1',
        source: PlanSource.coach_assigned,
      });
      repo.findPlanByIdOrThrow.mockResolvedValue(assignedPlan);
      relationshipService.assertCoachClientAccess.mockResolvedValue(undefined);
      repo.findActiveExercisesByIds.mockResolvedValue([{ id: 'exercise-1' }]);
      repo.updatePlan.mockResolvedValue(
        makePlan({
          ...assignedPlan,
          title: 'Updated training plan',
        }),
      );

      await expect(
        service.updatePlan(
          'coach-user-1',
          UserRole.coach,
          'plan-1',
          makeUpdateDto(),
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          coach_id: 'coach-user-1',
          title: 'Updated training plan',
          user_id: 'member-1',
        }),
      );
      expect(
        relationshipService.assertCoachClientAccess,
      ).toHaveBeenCalledWith('coach-user-1', 'member-1');
      expect(repo.updatePlan).toHaveBeenCalledWith(
        'plan-1',
        expect.objectContaining({
          userId: 'member-1',
          coachUserId: 'coach-user-1',
          source: PlanSource.coach_assigned,
        }),
      );
    },
  );

  it('rejects update access for an unrelated coach', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(
      makePlan({
        user_id: 'member-1',
        coach_id: 'coach-user-1',
        source: PlanSource.coach_assigned,
      }),
    );

    await expect(
      service.updatePlan(
        'unrelated-coach-1',
        UserRole.coach,
        'plan-1',
        makeUpdateDto(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      relationshipService.assertCoachClientAccess,
    ).not.toHaveBeenCalled();
    expect(repo.updatePlan).not.toHaveBeenCalled();
  });

  it.each([
    'inactive monthly relationship',
    'expired one-session appointment',
    'cancelled one-session appointment',
    'unpaid one-session appointment',
  ])('rejects coach update access for an %s', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(
      makePlan({
        user_id: 'member-1',
        coach_id: 'coach-user-1',
        source: PlanSource.coach_assigned,
      }),
    );
    relationshipService.assertCoachClientAccess.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.updatePlan(
        'coach-user-1',
        UserRole.coach,
        'plan-1',
        makeUpdateDto(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      relationshipService.assertCoachClientAccess,
    ).toHaveBeenCalledWith('coach-user-1', 'member-1');
    expect(repo.updatePlan).not.toHaveBeenCalled();
  });

  it('keeps the assigned owner and coach identity immutable during coach updates', async () => {
    const assignedPlan = makePlan({
      user_id: 'member-1',
      coach_id: 'coach-user-1',
      source: PlanSource.coach_assigned,
      is_template: false,
    });
    repo.findPlanByIdOrThrow.mockResolvedValue(assignedPlan);
    relationshipService.assertCoachClientAccess.mockResolvedValue(undefined);
    repo.findActiveExercisesByIds.mockResolvedValue([{ id: 'exercise-1' }]);
    repo.updatePlan.mockResolvedValue(assignedPlan);
    const payloadWithIdentityFields = makeUpdateDto({
      user_id: 'different-member-1',
      member_id: 'different-member-1',
      coach_id: 'different-coach-1',
      source: PlanSource.self_created,
      is_template: true,
    });

    await service.updatePlan(
      'coach-user-1',
      UserRole.coach,
      'plan-1',
      payloadWithIdentityFields,
    );

    expect(repo.updatePlan).toHaveBeenCalledWith(
      'plan-1',
      expect.objectContaining({
        userId: 'member-1',
        coachUserId: 'coach-user-1',
        source: PlanSource.coach_assigned,
        isTemplate: false,
      }),
    );
    expect(repo.updatePlan).not.toHaveBeenCalledWith(
      'plan-1',
      expect.objectContaining({
        userId: 'different-member-1',
        coachUserId: 'different-coach-1',
      }),
    );
  });

  it('allows the plan owner to read a training plan', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());

    await expect(service.getPlanById('user-1', 'plan-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'plan-1',
        user_id: 'user-1',
      }),
    );
    expect(
      relationshipService.assertCoachClientAccess,
    ).not.toHaveBeenCalled();
  });

  it('lists plans for a one-time client through the shared coach access guard', async () => {
    relationshipService.assertCoachClientAccess.mockResolvedValue(undefined);
    repo.listOwnedPlans.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await expect(
      service.listClientPlans('coach-user-1', 'member-1', {
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });
    expect(relationshipService.assertCoachClientAccess).toHaveBeenCalledWith(
      'coach-user-1',
      'member-1',
    );
  });

  it('allows the managing coach to read an assigned client plan', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(
      makePlan({
        user_id: 'member-1',
        coach_id: 'coach-user-1',
        source: PlanSource.coach_assigned,
      }),
    );
    relationshipService.assertCoachClientAccess.mockResolvedValue(
      undefined,
    );

    await expect(
      service.getPlanById('coach-user-1', 'plan-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        coach_id: 'coach-user-1',
        id: 'plan-1',
        user_id: 'member-1',
      }),
    );
    expect(
      relationshipService.assertCoachClientAccess,
    ).toHaveBeenCalledWith('coach-user-1', 'member-1');
  });

  it('rejects plan access for an unrelated coach', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(
      makePlan({
        user_id: 'member-1',
        coach_id: 'coach-user-1',
        source: PlanSource.coach_assigned,
      }),
    );

    await expect(
      service.getPlanById('unrelated-coach-1', 'plan-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      relationshipService.assertCoachClientAccess,
    ).not.toHaveBeenCalled();
  });

  it('rejects the managing coach when the client relationship is inactive', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(
      makePlan({
        user_id: 'member-1',
        coach_id: 'coach-user-1',
        source: PlanSource.coach_assigned,
      }),
    );
    relationshipService.assertCoachClientAccess.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.getPlanById('coach-user-1', 'plan-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      relationshipService.assertCoachClientAccess,
    ).toHaveBeenCalledWith('coach-user-1', 'member-1');
  });

  it('assigns a coach-owned source plan to an active client copy', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(
      makePlan({
        user_id: 'coach-user-1',
        coach_id: 'coach-user-1',
      }),
    );
    relationshipService.assertCoachClientAccess.mockResolvedValue(
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
      relationshipService.assertCoachClientAccess,
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

  it('returns a low-confidence baseline when no complete history exists', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());
    repo.listRecentCompletedLogs.mockResolvedValue([]);

    await expect(
      service.getProgressionSuggestions('user-1', 'plan-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        action: 'maintain',
        confidence: 'low',
        exercise_id: 'exercise-1',
        source_revision: 'history-rule-v2',
        suggested_reps: 10,
        suggested_weight_kg: 80,
      }),
    ]);
  });

  it('adds one rep after one complete successful workout', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());
    repo.listRecentCompletedLogs.mockResolvedValue(
      makeCompletedSessionLogs({
        sessionId: 'session-1',
        reps: 10,
        weightKg: 80,
        createdAt: '2026-07-27T10:00:00.000Z',
      }),
    );

    await expect(
      service.getProgressionSuggestions('user-1', 'plan-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        action: 'increase_reps',
        confidence: 'medium',
        suggested_reps: 11,
        suggested_weight_kg: 80,
      }),
    ]);
  });

  it('does not treat several sets from one workout as repeated workout evidence', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());
    repo.listRecentCompletedLogs.mockResolvedValue(
      makeCompletedSessionLogs({
        sessionId: 'session-1',
        reps: 12,
        weightKg: 80,
        createdAt: '2026-07-27T10:00:00.000Z',
      }),
    );

    await expect(
      service.getProgressionSuggestions('user-1', 'plan-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        action: 'maintain',
        suggested_reps: 12,
        suggested_weight_kg: 80,
      }),
    ]);
  });

  it('adds a safe two kilograms after two top-range successes at a heavier load', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());
    repo.listRecentCompletedLogs.mockResolvedValue([
      ...makeCompletedSessionLogs({
        sessionId: 'session-2',
        reps: 12,
        weightKg: 80,
        createdAt: '2026-07-27T10:00:00.000Z',
      }),
      ...makeCompletedSessionLogs({
        sessionId: 'session-1',
        reps: 12,
        weightKg: 80,
        createdAt: '2026-07-20T10:00:00.000Z',
      }),
    ]);

    await expect(
      service.getProgressionSuggestions('user-1', 'plan-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        action: 'increase_load',
        confidence: 'high',
        source_revision: 'history-rule-v2',
        suggested_reps: 10,
        suggested_weight_kg: 82,
      }),
    ]);
  });

  it('adds only one kilogram for a lighter working load', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());
    repo.listRecentCompletedLogs.mockResolvedValue([
      ...makeCompletedSessionLogs({
        sessionId: 'session-2',
        reps: 12,
        weightKg: 26,
        createdAt: '2026-07-27T10:00:00.000Z',
      }),
      ...makeCompletedSessionLogs({
        sessionId: 'session-1',
        reps: 12,
        weightKg: 26,
        createdAt: '2026-07-20T10:00:00.000Z',
      }),
    ]);

    await expect(
      service.getProgressionSuggestions('user-1', 'plan-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        action: 'increase_load',
        suggested_weight_kg: 27,
      }),
    ]);
  });

  it('ignores workout occurrences that do not contain every prescribed set', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());
    repo.listRecentCompletedLogs.mockResolvedValue(
      makeCompletedSessionLogs({
        sessionId: 'session-incomplete',
        reps: 12,
        weightKg: 80,
        createdAt: '2026-07-27T10:00:00.000Z',
        sets: 3,
      }),
    );

    await expect(
      service.getProgressionSuggestions('user-1', 'plan-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        action: 'maintain',
        confidence: 'low',
        suggested_weight_kg: 80,
      }),
    ]);
  });

  it('ignores the same exercise when it belongs to another plan prescription', async () => {
    repo.findPlanByIdOrThrow.mockResolvedValue(makePlan());
    repo.listRecentCompletedLogs.mockResolvedValue(
      makeCompletedSessionLogs({
        sessionId: 'session-other-plan-slot',
        reps: 12,
        weightKg: 40,
        createdAt: '2026-07-27T10:00:00.000Z',
      }).map((log) => ({
        ...log,
        plan_exercise_id: 'another-plan-exercise',
      })),
    );

    await expect(
      service.getProgressionSuggestions('user-1', 'plan-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        action: 'maintain',
        confidence: 'low',
        suggested_weight_kg: 80,
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
