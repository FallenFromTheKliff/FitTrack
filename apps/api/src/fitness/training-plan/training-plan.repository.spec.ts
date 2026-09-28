import { FitnessGoal, PlanSource } from '@prisma/client';

import { TrainingPlanRepository } from './training-plan.repository';

describe('TrainingPlanRepository', () => {
  const trainingPlan = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  };

  const exerciseCatalog = {
    findMany: jest.fn(),
  };

  const exerciseLog = {
    findMany: jest.fn(),
  };

  const prisma = {
    trainingPlan,
    exerciseCatalog,
    exerciseLog,
    $transaction: jest.fn(),
  };

  let repo: TrainingPlanRepository;

  beforeEach(() => {
    repo = new TrainingPlanRepository(prisma as never);
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({ trainingPlan }),
    );
    jest.clearAllMocks();
  });

  it('lists owned plans with pagination', async () => {
    trainingPlan.findMany.mockResolvedValue([{ id: 'plan-1' }]);
    trainingPlan.count.mockResolvedValue(1);

    await repo.listOwnedPlans('user-1', {
      page: 2,
      limit: 10,
    });

    expect(trainingPlan.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(trainingPlan.count).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
    });
  });

  it('loads a plan detail with ordered schedule days and exercises', async () => {
    trainingPlan.findUnique.mockResolvedValue({ id: 'plan-1' });

    await repo.findPlanByIdOrThrow('plan-1');

    expect(trainingPlan.findUnique).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      include: {
        schedule_days: {
          orderBy: [{ week_number: 'asc' }, { day_of_week: 'asc' }],
          include: {
            exercises: {
              orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }],
              include: { exercise: true },
            },
          },
        },
      },
      select: undefined,
    });
  });

  it('looks up active exercises by id', async () => {
    exerciseCatalog.findMany.mockResolvedValue([{ id: 'exercise-1' }]);

    await repo.findActiveExercisesByIds(['exercise-1', 'exercise-2']);

    expect(exerciseCatalog.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['exercise-1', 'exercise-2'] },
        is_active: true,
      },
      select: { id: true },
    });
  });

  it('lists completed exercise logs with deterministic row ordering', async () => {
    exerciseLog.findMany.mockResolvedValue([]);

    await repo.listRecentCompletedLogs('user-1', ['exercise-1']);

    expect(exerciseLog.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        exercise_id: { in: ['exercise-1'] },
        session: { status: 'completed' },
      },
      orderBy: [
        { created_at: 'desc' },
        { set_number: 'desc' },
        { id: 'asc' },
      ],
      take: 40,
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
  });

  it('creates plans transactionally with nested schedule persistence', async () => {
    trainingPlan.create.mockResolvedValue({ id: 'plan-1' });

    await repo.createPlan({
      userId: 'user-1',
      coachUserId: 'coach-user-1',
      source: PlanSource.coach_assigned,
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
              restSeconds: 60,
              restSecondsBySet: [45, 60, 75, 90],
              weightKgTarget: 80,
              orderIndex: 0,
            },
          ],
        },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(trainingPlan.create).toHaveBeenCalledWith({
      data: {
        user: { connect: { id: 'user-1' } },
        coach: { connect: { id: 'coach-user-1' } },
        source: PlanSource.coach_assigned,
        title: 'Upper / Lower Strength Builder',
        goal: FitnessGoal.bulking,
        duration_weeks: 8,
        days_per_week: 4,
        is_template: false,
        schedule_days: {
          create: [
            {
              week_number: 1,
              day_of_week: 1,
              focus_label: 'Push Day',
              notes: null,
              exercises: {
                create: [
                  {
                    exercise: { connect: { id: 'exercise-1' } },
                    sets: 4,
                    reps: 10,
                    duration_seconds: null,
                    rest_seconds: 60,
                    rest_seconds_by_set: [45, 60, 75, 90],
                    weight_kg_target: 80,
                    notes: null,
                    order_index: 0,
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        schedule_days: {
          orderBy: [{ week_number: 'asc' }, { day_of_week: 'asc' }],
          include: {
            exercises: {
              orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }],
              include: { exercise: true },
            },
          },
        },
      },
    });
  });

  it('replaces the active non-template plan inside a single transaction', async () => {
    trainingPlan.create.mockResolvedValue({ id: 'plan-2' });
    trainingPlan.updateMany.mockResolvedValue({ count: 1 });

    await repo.replaceActivePlan({
      userId: 'user-1',
      coachUserId: null,
      source: PlanSource.ai_generated,
      title: 'AI Bulking Plan',
      goal: FitnessGoal.bulking,
      durationWeeks: 8,
      daysPerWeek: 4,
      isActive: true,
      isTemplate: false,
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
              restSeconds: 60,
              orderIndex: 0,
            },
          ],
        },
      ],
    });

    expect(trainingPlan.updateMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        is_active: true,
        is_template: false,
      },
      data: { is_active: false },
    });
    const createCalls = trainingPlan.create.mock.calls as [
      [
        {
          data: {
            source: PlanSource;
            is_active: boolean;
            ai_generation_prompt?: {
              plan_input: { duration_weeks: number; days_per_week: number };
            };
          };
          include: unknown;
        },
      ],
    ];
    const [createArgs] = createCalls[0];

    expect(createArgs.data.source).toBe(PlanSource.ai_generated);
    expect(createArgs.data.is_active).toBe(true);
    expect(createArgs.data.ai_generation_prompt).toEqual({
      plan_input: { duration_weeks: 8, days_per_week: 4 },
    });
    expect(createArgs.include).toEqual({
      schedule_days: {
        orderBy: [{ week_number: 'asc' }, { day_of_week: 'asc' }],
        include: {
          exercises: {
            orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }],
            include: { exercise: true },
          },
        },
      },
    });
  });

  it('persists explicit rest-day state without creating exercises', async () => {
    trainingPlan.create.mockResolvedValue({ id: 'plan-rest' });

    await repo.createPlan({
      userId: 'user-1',
      coachUserId: 'coach-user-1',
      source: PlanSource.coach_assigned,
      title: 'PPL with recovery',
      goal: FitnessGoal.maintenance,
      durationWeeks: 1,
      daysPerWeek: 1,
      schedule: [
        {
          weekNumber: 1,
          dayOfWeek: 3,
          focusLabel: 'Rest',
          isRestDay: true,
          exercises: [],
        },
      ],
    });

    expect(trainingPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schedule_days: {
            create: [
              expect.objectContaining({
                is_rest_day: true,
                exercises: { create: [] },
              }),
            ],
          },
        }),
      }),
    );
  });
});
