import { ActivityLevel, FitnessGoal, Gender, Prisma } from '@prisma/client';

import {
  NutritionRepository,
  type RotateActiveTdeeSnapshotInput,
} from './nutrition.repository';

describe('NutritionRepository', () => {
  const tdeeProfile = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  };
  const macroTarget = {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  };
  const nutritionLog = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  };
  const userProgressionProfile = {
    findUnique: jest.fn(),
  };

  const prisma = {
    tdeeProfile,
    macroTarget,
    nutritionLog,
    userProgressionProfile,
    $transaction: jest.fn(),
  };

  let repo: NutritionRepository;

  beforeEach(() => {
    repo = new NutritionRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('returns the active tdee aggregate when both tdee and macro target exist', async () => {
    tdeeProfile.findFirst.mockResolvedValue({
      id: 'tdee-1',
      macro_targets: [{ id: 'macro-1' }],
    });

    await expect(repo.findActiveTdeeAggregate('user-1')).resolves.toEqual({
      id: 'tdee-1',
      macro_targets: [{ id: 'macro-1' }],
    });
  });

  it('returns null when the active tdee aggregate is missing', async () => {
    tdeeProfile.findFirst.mockResolvedValue(null);

    await expect(repo.findActiveTdeeAggregate('user-1')).resolves.toBeNull();
  });

  it('returns null when the active tdee profile has no active macro target', async () => {
    tdeeProfile.findFirst.mockResolvedValue({
      id: 'tdee-1',
      macro_targets: [],
    });

    await expect(repo.findActiveTdeeAggregate('user-1')).resolves.toBeNull();
  });

  it('loads the active tdee aggregate with the active macro target', async () => {
    tdeeProfile.findFirst.mockResolvedValue({
      id: 'tdee-1',
      macro_targets: [{ id: 'macro-1' }],
    });

    await repo.findActiveTdeeAggregateOrThrow('user-1');

    expect(tdeeProfile.findFirst).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        is_active: true,
      },
      include: {
        macro_targets: {
          where: {
            user_id: 'user-1',
            is_active: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 1,
        },
      },
      orderBy: undefined,
    });
  });

  it('raises an explicit not found error when the active macro target is missing', async () => {
    tdeeProfile.findFirst.mockResolvedValue({
      id: 'tdee-1',
      macro_targets: [],
    });

    await expect(
      repo.findActiveTdeeAggregateOrThrow('user-1'),
    ).rejects.toMatchObject({
      response: {
        type: 'NOT_FOUND',
        title: 'MacroTarget Not Found',
        status: 404,
        detail: 'MacroTarget not found.',
      },
    });
  });

  it('finds the newest active macro target when one exists', async () => {
    macroTarget.findFirst.mockResolvedValue({ id: 'macro-1' });

    await expect(repo.findActiveMacroTarget('user-1')).resolves.toEqual({
      id: 'macro-1',
    });

    expect(macroTarget.findFirst).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        is_active: true,
      },
      include: undefined,
      orderBy: {
        created_at: 'desc',
      },
      select: undefined,
    });
  });

  it('lists tdee history in descending calculated order', async () => {
    tdeeProfile.count.mockResolvedValue(1);
    tdeeProfile.findMany.mockResolvedValue([{ id: 'tdee-1' }]);

    await expect(repo.listTdeeHistory('user-1', {})).resolves.toEqual({
      data: [{ id: 'tdee-1' }],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    expect(tdeeProfile.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
      },
      orderBy: [{ calculated_at: 'desc' }, { created_at: 'desc' }],
      include: undefined,
      select: undefined,
      skip: 0,
      take: 20,
    });
  });

  it('filters nutrition logs with deterministic oldest-first paging', async () => {
    nutritionLog.count.mockResolvedValue(1);
    nutritionLog.findMany.mockResolvedValue([{ id: 'log-1' }]);

    await expect(
      repo.listNutritionLogs('user-1', {
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        page: 2,
        limit: 10,
        search: 'chicken',
        meal_type: 'Lunch',
        sort: 'oldest',
      }),
    ).resolves.toEqual({
      data: [{ id: 'log-1' }],
      meta: {
        page: 2,
        limit: 10,
        total: 1,
        total_pages: 1,
      },
    });

    expect(nutritionLog.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        meal_name: 'Lunch',
        OR: [
          {
            meal_name: {
              contains: 'chicken',
              mode: 'insensitive',
            },
          },
          {
            food_item: {
              contains: 'chicken',
              mode: 'insensitive',
            },
          },
        ],
        log_date: {
          gte: new Date('2026-03-01'),
          lte: new Date('2026-03-31'),
        },
      },
      orderBy: [
        { log_date: 'asc' },
        { created_at: 'asc' },
        { id: 'asc' },
      ],
      include: undefined,
      select: undefined,
      skip: 10,
      take: 10,
    });
  });

  it('keeps newest-first log ordering by default with an id tie-break', async () => {
    nutritionLog.count.mockResolvedValue(0);
    nutritionLog.findMany.mockResolvedValue([]);

    await repo.listNutritionLogs('user-1', {});

    expect(nutritionLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'user-1' },
        orderBy: [
          { log_date: 'desc' },
          { created_at: 'desc' },
          { id: 'desc' },
        ],
      }),
    );
  });

  it('updates only logs owned by the caller', async () => {
    nutritionLog.findUnique.mockResolvedValue({
      id: 'log-1',
      user_id: 'user-1',
    });
    nutritionLog.update.mockResolvedValue({
      id: 'log-1',
      calories: new Prisma.Decimal('480'),
    });

    await repo.updateNutritionLog('user-1', 'log-1', { calories: 480 });

    expect(nutritionLog.findUnique).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      include: undefined,
    });
    expect(nutritionLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: { calories: 480 },
      include: undefined,
    });
  });

  it('rejects updates to nutrition logs owned by another user', async () => {
    nutritionLog.findUnique.mockResolvedValue({
      id: 'log-1',
      user_id: 'user-2',
    });

    await expect(
      repo.updateNutritionLog('user-1', 'log-1', { calories: 480 }),
    ).rejects.toMatchObject({
      response: {
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
      },
    });
    expect(nutritionLog.update).not.toHaveBeenCalled();
  });

  it('deletes only logs owned by the caller', async () => {
    nutritionLog.findUnique.mockResolvedValue({
      id: 'log-1',
      user_id: 'user-1',
    });
    nutritionLog.delete.mockResolvedValue({ id: 'log-1' });

    await repo.deleteNutritionLog('user-1', 'log-1');

    expect(nutritionLog.findUnique).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      include: undefined,
    });
    expect(nutritionLog.delete).toHaveBeenCalledWith({
      where: { id: 'log-1' },
    });
  });

  it('builds the daily summary aggregate from logs plus the current active macro target', async () => {
    nutritionLog.aggregate.mockResolvedValue({
      _sum: {
        calories: new Prisma.Decimal('900'),
        protein_g: new Prisma.Decimal('70'),
        carbs_g: new Prisma.Decimal('80'),
        fat_g: new Prisma.Decimal('25'),
      },
    });
    macroTarget.findFirst.mockResolvedValue({ id: 'macro-1' });
    userProgressionProfile.findUnique.mockResolvedValue({
      current_season_points: 120,
      current_streak: 4,
      last_progressed_at: new Date('2026-03-27T05:00:00.000Z'),
      total_xp: 500,
    });

    const result = await repo.getDailyNutritionSummary('user-1', '2026-03-27');

    expect(nutritionLog.aggregate).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        log_date: {
          gte: new Date('2026-03-27T00:00:00.000Z'),
          lt: new Date('2026-03-28T00:00:00.000Z'),
        },
      },
      _sum: {
        calories: true,
        protein_g: true,
        carbs_g: true,
        fat_g: true,
      },
    });
    expect(result).toMatchObject({
      date: '2026-03-27',
      macroTarget: { id: 'macro-1' },
      progressionSnapshot: {
        current_season_points: 120,
        current_streak: 4,
        last_progressed_at: new Date('2026-03-27T05:00:00.000Z'),
        total_xp: 500,
      },
    });
  });

  it('rotates active tdee and macro snapshots in one transaction', async () => {
    const tx = {
      tdeeProfile: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({
          id: 'tdee-2',
          user_id: 'user-1',
          weight_kg: { toFixed: jest.fn() },
          height_cm: { toFixed: jest.fn() },
          age: 28,
          gender: 'male',
          activity_level: 'active',
          fitness_goal: 'cutting',
          bmr_calories: { toFixed: jest.fn() },
          tdee_calories: { toFixed: jest.fn() },
          is_active: true,
          calculated_at: new Date('2026-03-27T05:00:00.000Z'),
          created_at: new Date('2026-03-27T05:00:00.000Z'),
          updated_at: new Date('2026-03-27T05:00:00.000Z'),
        }),
      },
      macroTarget: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({
          id: 'macro-2',
          user_id: 'user-1',
          tdee_profile_id: 'tdee-2',
          target_calories: { toFixed: jest.fn() },
          protein_g: { toFixed: jest.fn() },
          carbs_g: { toFixed: jest.fn() },
          fat_g: { toFixed: jest.fn() },
          is_active: true,
          created_at: new Date('2026-03-27T05:00:00.000Z'),
          updated_at: new Date('2026-03-27T05:00:00.000Z'),
        }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const input: RotateActiveTdeeSnapshotInput = {
      userId: 'user-1',
      calculatedAt: new Date('2026-03-27T05:00:00.000Z'),
      snapshot: {
        weightKg: 76.5,
        heightCm: 175,
        age: 28,
        gender: Gender.male,
        activityLevel: ActivityLevel.active,
        fitnessGoal: FitnessGoal.cutting,
      },
      aiResult: {
        bmr: 1700.25,
        tdee: 2450.5,
        targetCalories: 2200,
        proteinG: 180,
        carbsG: 210,
        fatG: 65,
      },
    };

    const result = await repo.rotateActiveTdeeSnapshot(input);

    expect(tx.tdeeProfile.create).toHaveBeenCalledWith({
      data: {
        user_id: 'user-1',
        weight_kg: new Prisma.Decimal(76.5),
        height_cm: new Prisma.Decimal(175),
        age: 28,
        gender: Gender.male,
        activity_level: ActivityLevel.active,
        fitness_goal: FitnessGoal.cutting,
        bmr_calories: new Prisma.Decimal(1700.25),
        tdee_calories: new Prisma.Decimal(2450.5),
        is_active: true,
        calculated_at: new Date('2026-03-27T05:00:00.000Z'),
      },
    });
    expect(tx.macroTarget.create).toHaveBeenCalledWith({
      data: {
        user_id: 'user-1',
        tdee_profile_id: 'tdee-2',
        target_calories: new Prisma.Decimal(2200),
        protein_g: new Prisma.Decimal(180),
        carbs_g: new Prisma.Decimal(210),
        fat_g: new Prisma.Decimal(65),
        is_active: true,
      },
    });
    expect(result).toMatchObject({
      id: 'tdee-2',
      macro_targets: [{ id: 'macro-2' }],
    });
  });
});
