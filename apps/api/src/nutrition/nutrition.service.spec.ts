import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  NutritionUnit,
  Prisma,
} from '@prisma/client';

import { AiPythonClientService } from '../ai/ai-python-client.service';
import { FilesService } from '../files/files.service';
import { UserService } from '../user/user.service';
import { NutritionRepository } from './nutrition.repository';
import { NutritionService } from './nutrition.service';
import { TDEE_RECALCULATED_EVENT } from './events/tdee-recalculated.event';

describe('NutritionService', () => {
  let service: NutritionService;

  const repo = {
    findActiveTdeeAggregate: jest.fn(),
    findActiveMacroTarget: jest.fn(),
    listTdeeHistory: jest.fn(),
    createNutritionLog: jest.fn(),
    listNutritionLogs: jest.fn(),
    updateNutritionLog: jest.fn(),
    deleteNutritionLog: jest.fn(),
    getDailyNutritionSummary: jest.fn(),
    rotateActiveTdeeSnapshot: jest.fn(),
  };
  const userService = {
    getMyProfile: jest.fn(),
  };
  const aiClient = {
    calculateTdee: jest.fn(),
  };
  const eventEmitter = {
    emit: jest.fn(),
  };
  const filesService = {
    assertUserOwnedRasterImage: jest.fn(),
    isUserOwnedUploadKey: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NutritionService,
        { provide: NutritionRepository, useValue: repo },
        { provide: UserService, useValue: userService },
        { provide: AiPythonClientService, useValue: aiClient },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    service = module.get<NutritionService>(NutritionService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps the active tdee aggregate into the response contract', async () => {
    repo.findActiveTdeeAggregate.mockResolvedValue({
      id: 'tdee-1',
      user_id: 'user-1',
      weight_kg: new Prisma.Decimal('75.5'),
      height_cm: new Prisma.Decimal('175'),
      age: 28,
      gender: Gender.male,
      activity_level: ActivityLevel.moderate,
      fitness_goal: FitnessGoal.cutting,
      bmr_calories: new Prisma.Decimal('1700.25'),
      tdee_calories: new Prisma.Decimal('2450.5'),
      is_active: true,
      calculated_at: new Date('2026-03-27T05:00:00.000Z'),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
      macro_targets: [
        {
          id: 'macro-1',
          user_id: 'user-1',
          tdee_profile_id: 'tdee-1',
          target_calories: new Prisma.Decimal('2200'),
          protein_g: new Prisma.Decimal('180'),
          carbs_g: new Prisma.Decimal('210'),
          fat_g: new Prisma.Decimal('65'),
          is_active: true,
          created_at: new Date('2026-03-27T05:00:00.000Z'),
          updated_at: new Date('2026-03-27T05:00:00.000Z'),
        },
      ],
    });

    const result = await service.getActiveTdee('user-1');

    expect(result.tdee).toMatchObject({
      id: 'tdee-1',
      weight_kg: '75.50',
      height_cm: '175.00',
      bmr_calories: '1700.25',
      tdee_calories: '2450.50',
    });
    expect(result.macros).toMatchObject({
      id: 'macro-1',
      target_calories: '2200.00',
      protein_g: '180.00',
      carbs_g: '210.00',
      fat_g: '65.00',
    });
  });

  it('returns null when no active nutrition target exists yet', async () => {
    repo.findActiveTdeeAggregate.mockResolvedValue(null);

    await expect(service.getActiveTdee('user-1')).resolves.toBeNull();
  });

  it('maps paginated tdee history into response rows', async () => {
    repo.listTdeeHistory.mockResolvedValue({
      data: [
        {
          id: 'tdee-1',
          user_id: 'user-1',
          weight_kg: new Prisma.Decimal('75'),
          height_cm: new Prisma.Decimal('175'),
          age: 28,
          gender: Gender.female,
          activity_level: ActivityLevel.active,
          fitness_goal: FitnessGoal.bulking,
          bmr_calories: new Prisma.Decimal('1650'),
          tdee_calories: new Prisma.Decimal('2550'),
          is_active: false,
          calculated_at: new Date('2026-03-25T05:00:00.000Z'),
          created_at: new Date('2026-03-25T05:00:00.000Z'),
          updated_at: new Date('2026-03-25T05:00:00.000Z'),
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const result = await service.getTdeeHistory('user-1', {});

    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      total_pages: 1,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'tdee-1',
      is_active: false,
      weight_kg: '75.00',
      tdee_calories: '2550.00',
    });
  });

  it('merges profile values and dto overrides, rotates active snapshots, and emits a bounded event', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-27T12:00:00.000Z'));

    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-10T00:00:00.000Z'),
        gender: Gender.male,
        weight_kg: new Prisma.Decimal('75'),
        height_cm: new Prisma.Decimal('175'),
        activity_level: ActivityLevel.light,
        fitness_goal: FitnessGoal.maintenance,
      },
    });
    aiClient.calculateTdee.mockResolvedValue({
      bmr: 1700.25,
      tdee: 2450.5,
      target_calories: 2200,
      protein_g: 180,
      carbs_g: 210,
      fat_g: 65,
    });
    repo.rotateActiveTdeeSnapshot.mockResolvedValue({
      id: 'tdee-2',
      user_id: 'user-1',
      weight_kg: new Prisma.Decimal('76.5'),
      height_cm: new Prisma.Decimal('175'),
      age: 28,
      gender: Gender.male,
      activity_level: ActivityLevel.active,
      fitness_goal: FitnessGoal.cutting,
      bmr_calories: new Prisma.Decimal('1700.25'),
      tdee_calories: new Prisma.Decimal('2450.5'),
      is_active: true,
      calculated_at: new Date('2026-03-27T05:00:00.000Z'),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
      macro_targets: [
        {
          id: 'macro-2',
          user_id: 'user-1',
          tdee_profile_id: 'tdee-2',
          target_calories: new Prisma.Decimal('2200'),
          protein_g: new Prisma.Decimal('180'),
          carbs_g: new Prisma.Decimal('210'),
          fat_g: new Prisma.Decimal('65'),
          is_active: true,
          created_at: new Date('2026-03-27T05:00:00.000Z'),
          updated_at: new Date('2026-03-27T05:00:00.000Z'),
        },
      ],
    });

    const result = await service.recalculateTdee('user-1', {
      weight_kg: 76.5,
      activity_level: ActivityLevel.active,
      fitness_goal: FitnessGoal.cutting,
    });

    expect(aiClient.calculateTdee).toHaveBeenCalledWith({
      age: 28,
      gender: Gender.male,
      weight_kg: 76.5,
      height_cm: 175,
      activity_level: ActivityLevel.active,
      fitness_goal: FitnessGoal.cutting,
    });
    expect(repo.rotateActiveTdeeSnapshot).toHaveBeenCalledWith({
      userId: 'user-1',
      calculatedAt: new Date('2026-03-27T12:00:00.000Z'),
      snapshot: {
        age: 28,
        gender: Gender.male,
        weightKg: 76.5,
        heightCm: 175,
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
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(TDEE_RECALCULATED_EVENT, {
      userId: 'user-1',
      tdeeProfileId: 'tdee-2',
      macroTargetId: 'macro-2',
      recalculatedAt: '2026-03-27T12:00:00.000Z',
    });
    expect(result).toMatchObject({
      tdee: {
        id: 'tdee-2',
        weight_kg: '76.50',
      },
      macros: {
        id: 'macro-2',
        target_calories: '2200.00',
      },
    });
  });

  it('rejects recalculation when the final profile snapshot is incomplete', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: null,
        gender: null,
        weight_kg: null,
        height_cm: new Prisma.Decimal('175'),
        activity_level: ActivityLevel.moderate,
        fitness_goal: FitnessGoal.cutting,
      },
    });

    await expect(service.recalculateTdee('user-1', {})).rejects.toMatchObject({
      response: {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Incomplete Profile For TDEE Recalculation',
        status: 422,
      },
    });
    expect(aiClient.calculateTdee).not.toHaveBeenCalled();
    expect(repo.rotateActiveTdeeSnapshot).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects recalculation when the final date of birth is under the member age minimum', async () => {
    const underageDate = new Date();
    underageDate.setUTCFullYear(underageDate.getUTCFullYear() - 1);
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: underageDate,
        gender: Gender.male,
        weight_kg: new Prisma.Decimal('75'),
        height_cm: new Prisma.Decimal('175'),
        activity_level: ActivityLevel.moderate,
        fitness_goal: FitnessGoal.cutting,
      },
    });

    await expect(service.recalculateTdee('user-1', {})).rejects.toMatchObject({
      response: {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Invalid Date Of Birth',
        status: 422,
      },
    });
    expect(aiClient.calculateTdee).not.toHaveBeenCalled();
    expect(repo.rotateActiveTdeeSnapshot).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('links new nutrition logs to the active macro target when one exists', async () => {
    repo.findActiveMacroTarget.mockResolvedValue({
      id: 'macro-1',
    });
    repo.createNutritionLog.mockResolvedValue({
      id: 'log-1',
      user_id: 'user-1',
      macro_target_id: 'macro-1',
      log_date: new Date('2026-03-27T00:00:00.000Z'),
      meal_name: 'Breakfast',
      food_item: 'Greek yogurt',
      calories: new Prisma.Decimal('320'),
      protein_g: new Prisma.Decimal('28'),
      carbs_g: new Prisma.Decimal('22'),
      fat_g: new Prisma.Decimal('11'),
      quantity: new Prisma.Decimal('1'),
      unit: NutritionUnit.serving,
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });

    const result = await service.logNutrition('user-1', {
      log_date: '2026-03-27',
      meal_name: 'Breakfast',
      food_item: 'Greek yogurt',
      calories: 320,
      protein_g: 28,
      carbs_g: 22,
      fat_g: 11,
      quantity: 1,
      unit: NutritionUnit.serving,
    });

    expect(repo.createNutritionLog).toHaveBeenCalledWith({
      user: {
        connect: { id: 'user-1' },
      },
      macro_target: {
        connect: { id: 'macro-1' },
      },
      log_date: new Date('2026-03-27T00:00:00.000Z'),
      meal_name: 'Breakfast',
      food_item: 'Greek yogurt',
      calories: 320,
      protein_g: 28,
      carbs_g: 22,
      fat_g: 11,
      quantity: 1,
      unit: NutritionUnit.serving,
    });
    expect(result).toMatchObject({
      id: 'log-1',
      macro_target_id: 'macro-1',
      calories: '320.00',
      icon: {
        kind: 'library',
        key: 'coffee',
        asset_key: null,
      },
    });
  });

  it('persists an allowlisted library icon and reads it back', async () => {
    repo.findActiveMacroTarget.mockResolvedValue(null);
    repo.createNutritionLog.mockResolvedValue({
      id: 'log-icon',
      user_id: 'user-1',
      macro_target_id: null,
      log_date: new Date('2026-03-27T00:00:00.000Z'),
      meal_name: 'Lunch',
      food_item: 'Salad',
      icon_kind: 'library',
      icon_key: 'salad',
      icon_asset_key: null,
      calories: new Prisma.Decimal('300'),
      protein_g: new Prisma.Decimal('12'),
      carbs_g: new Prisma.Decimal('40'),
      fat_g: new Prisma.Decimal('8'),
      quantity: new Prisma.Decimal('1'),
      unit: NutritionUnit.serving,
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });

    const result = await service.logNutrition('user-1', {
      log_date: '2026-03-27',
      meal_name: 'Lunch',
      food_item: 'Salad',
      calories: 300,
      protein_g: 12,
      carbs_g: 40,
      fat_g: 8,
      quantity: 1,
      unit: NutritionUnit.serving,
      icon: { kind: 'library', key: 'salad' },
    });

    expect(repo.createNutritionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        icon_kind: 'library',
        icon_key: 'salad',
        icon_asset_key: null,
      }),
    );
    expect(result.icon).toEqual({
      kind: 'library',
      key: 'salad',
      asset_key: null,
    });
  });

  it('updates a custom icon only after managed ownership and raster checks pass', async () => {
    repo.updateNutritionLog.mockResolvedValue({
      id: 'log-1',
      user_id: 'user-1',
      macro_target_id: null,
      log_date: new Date('2026-03-27T00:00:00.000Z'),
      meal_name: 'Dinner',
      food_item: 'Steak',
      icon_kind: 'custom',
      icon_key: null,
      icon_asset_key: 'uploads/user-1/2026/08/icon.png',
      calories: new Prisma.Decimal('520'),
      protein_g: new Prisma.Decimal('48'),
      carbs_g: new Prisma.Decimal('12'),
      fat_g: new Prisma.Decimal('24'),
      quantity: new Prisma.Decimal('1'),
      unit: NutritionUnit.serving,
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T06:00:00.000Z'),
    });

    const result = await service.updateNutritionLog('user-1', 'log-1', {
      icon: {
        kind: 'custom',
        asset_key: 'uploads/user-1/2026/08/icon.png',
      },
    });

    expect(filesService.assertUserOwnedRasterImage).toHaveBeenCalledWith(
      'uploads/user-1/2026/08/icon.png',
      'user-1',
    );
    expect(repo.updateNutritionLog).toHaveBeenCalledWith(
      'user-1',
      'log-1',
      expect.objectContaining({
        icon_kind: 'custom',
        icon_key: null,
        icon_asset_key: 'uploads/user-1/2026/08/icon.png',
      }),
    );
    expect(result.icon).toEqual({
      kind: 'custom',
      key: null,
      asset_key: 'uploads/user-1/2026/08/icon.png',
    });
  });

  it('rejects invalid library keys before persistence', async () => {
    await expect(
      service.logNutrition('user-1', {
        log_date: '2026-03-27',
        meal_name: 'Snack',
        food_item: 'Bar',
        calories: 100,
        protein_g: 5,
        carbs_g: 10,
        fat_g: 2,
        quantity: 1,
        unit: NutritionUnit.serving,
        icon: { kind: 'library', key: 'arbitrary-component' as never },
      }),
    ).rejects.toMatchObject({
      response: { status: 400, title: 'Invalid Meal Icon' },
    });
    expect(repo.createNutritionLog).not.toHaveBeenCalled();
  });

  it('rejects cross-user custom assets before persistence', async () => {
    filesService.assertUserOwnedRasterImage.mockRejectedValueOnce(
      new Error('cross-user asset'),
    );

    await expect(
      service.updateNutritionLog('user-1', 'log-1', {
        icon: {
          kind: 'custom',
          asset_key: 'uploads/user-2/2026/08/icon.png',
        },
      }),
    ).rejects.toThrow('cross-user asset');
    expect(repo.updateNutritionLog).not.toHaveBeenCalled();
  });

  it('creates nutrition logs without a macro link when no active target exists', async () => {
    repo.findActiveMacroTarget.mockResolvedValue(null);
    repo.createNutritionLog.mockResolvedValue({
      id: 'log-2',
      user_id: 'user-1',
      macro_target_id: null,
      log_date: new Date('2026-03-27T00:00:00.000Z'),
      meal_name: 'Snack',
      food_item: 'Apple',
      calories: new Prisma.Decimal('95'),
      protein_g: new Prisma.Decimal('0'),
      carbs_g: new Prisma.Decimal('25'),
      fat_g: new Prisma.Decimal('0'),
      quantity: new Prisma.Decimal('1'),
      unit: NutritionUnit.piece,
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });

    const result = await service.logNutrition('user-1', {
      log_date: '2026-03-27',
      meal_name: 'Snack',
      food_item: 'Apple',
      calories: 95,
      protein_g: 0,
      carbs_g: 25,
      fat_g: 0,
      quantity: 1,
      unit: NutritionUnit.piece,
    });

    expect(repo.createNutritionLog).toHaveBeenCalledWith({
      user: {
        connect: { id: 'user-1' },
      },
      log_date: new Date('2026-03-27T00:00:00.000Z'),
      meal_name: 'Snack',
      food_item: 'Apple',
      calories: 95,
      protein_g: 0,
      carbs_g: 25,
      fat_g: 0,
      quantity: 1,
      unit: NutritionUnit.piece,
    });
    expect(result).toMatchObject({
      id: 'log-2',
      macro_target_id: null,
      unit: NutritionUnit.piece,
    });
  });

  it('maps paginated nutrition logs into response rows', async () => {
    repo.listNutritionLogs.mockResolvedValue({
      data: [
        {
          id: 'log-1',
          user_id: 'user-1',
          macro_target_id: 'macro-1',
          log_date: new Date('2026-03-27T00:00:00.000Z'),
          meal_name: 'Lunch',
          food_item: 'Chicken breast',
          calories: new Prisma.Decimal('450'),
          protein_g: new Prisma.Decimal('45'),
          carbs_g: new Prisma.Decimal('15'),
          fat_g: new Prisma.Decimal('18'),
          quantity: new Prisma.Decimal('1'),
          unit: NutritionUnit.serving,
          created_at: new Date('2026-03-27T05:00:00.000Z'),
          updated_at: new Date('2026-03-27T05:00:00.000Z'),
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const result = await service.getNutritionLogs('user-1', {
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      search: 'chicken',
      meal_type: 'Lunch',
      sort: 'oldest',
    });

    expect(repo.listNutritionLogs).toHaveBeenCalledWith('user-1', {
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      search: 'chicken',
      meal_type: 'Lunch',
      sort: 'oldest',
    });
    expect(result.meta.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      id: 'log-1',
      macro_target_id: 'macro-1',
      calories: '450.00',
      unit: NutritionUnit.serving,
    });
  });

  it('updates nutrition logs through the repository contract', async () => {
    repo.updateNutritionLog.mockResolvedValue({
      id: 'log-1',
      user_id: 'user-1',
      macro_target_id: 'macro-1',
      log_date: new Date('2026-03-27T00:00:00.000Z'),
      meal_name: 'Dinner',
      food_item: 'Salmon',
      calories: new Prisma.Decimal('520'),
      protein_g: new Prisma.Decimal('48'),
      carbs_g: new Prisma.Decimal('12'),
      fat_g: new Prisma.Decimal('24'),
      quantity: new Prisma.Decimal('1'),
      unit: NutritionUnit.serving,
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T06:00:00.000Z'),
    });

    const result = await service.updateNutritionLog('user-1', 'log-1', {
      meal_name: 'Dinner',
      calories: 520,
      log_date: '2026-03-28',
    });

    expect(repo.updateNutritionLog).toHaveBeenCalledWith('user-1', 'log-1', {
      meal_name: 'Dinner',
      calories: 520,
      log_date: new Date('2026-03-28T00:00:00.000Z'),
    });
    expect(result).toMatchObject({
      id: 'log-1',
      meal_name: 'Dinner',
      calories: '520.00',
    });
  });

  it('deletes nutrition logs through the repository contract', async () => {
    repo.deleteNutritionLog.mockResolvedValue(undefined);

    await service.deleteNutritionLog('user-1', 'log-1');

    expect(repo.deleteNutritionLog).toHaveBeenCalledWith('user-1', 'log-1');
  });

  it('builds the daily summary with target comparison when an active macro target exists', async () => {
    repo.getDailyNutritionSummary.mockResolvedValue({
      date: '2026-03-27',
      totals: {
        calories: new Prisma.Decimal('900'),
        protein_g: new Prisma.Decimal('70'),
        carbs_g: new Prisma.Decimal('80'),
        fat_g: new Prisma.Decimal('25'),
      },
      macroTarget: {
        id: 'macro-1',
        user_id: 'user-1',
        tdee_profile_id: 'tdee-1',
        target_calories: new Prisma.Decimal('2200'),
        protein_g: new Prisma.Decimal('180'),
        carbs_g: new Prisma.Decimal('210'),
        fat_g: new Prisma.Decimal('65'),
        is_active: true,
        created_at: new Date('2026-03-27T05:00:00.000Z'),
        updated_at: new Date('2026-03-27T05:00:00.000Z'),
      },
    });

    const result = await service.getDailySummary('user-1', {
      date: '2026-03-27',
    });

    expect(result).toEqual({
      date: '2026-03-27',
      macro_target_id: 'macro-1',
      logged: {
        calories: '900.00',
        protein_g: '70.00',
        carbs_g: '80.00',
        fat_g: '25.00',
      },
      target: {
        calories: '2200.00',
        protein_g: '180.00',
        carbs_g: '210.00',
        fat_g: '65.00',
      },
      remaining: {
        calories: '1300.00',
        protein_g: '110.00',
        carbs_g: '130.00',
        fat_g: '40.00',
      },
      coaching: [
        {
          id: 'protein-energy-gap',
          priority: 'opportunity',
          title: 'Protein plus energy are both open',
          message:
            'A balanced protein-and-carb meal is the cleanest next move because both calories and protein still have meaningful room.',
          reason_codes: ['calories_remaining', 'protein_remaining'],
          source: 'nutrition_summary',
        },
        {
          id: 'carb-training-support',
          priority: 'opportunity',
          title: 'Carbs can support the next session',
          message:
            'Carbs are still meaningfully under target, so a rice, oats, fruit, or bread-based add-on can support training without touching exercise logic.',
          reason_codes: ['carbs_remaining', 'under_calorie_target'],
          source: 'nutrition_summary',
        },
      ],
    });
  });

  it('returns nullable target comparison when no active macro target exists', async () => {
    repo.getDailyNutritionSummary.mockResolvedValue({
      date: '2026-03-27',
      totals: {
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      },
      macroTarget: null,
    });

    const result = await service.getDailySummary('user-1', {
      date: '2026-03-27',
    });

    expect(result).toEqual({
      date: '2026-03-27',
      macro_target_id: null,
      logged: {
        calories: '0.00',
        protein_g: '0.00',
        carbs_g: '0.00',
        fat_g: '0.00',
      },
      target: null,
      remaining: null,
      coaching: [
        {
          id: 'nutrition-target-missing',
          priority: 'info',
          title: 'Set a macro target before coaching gets specific',
          message:
            'Daily totals are live, but coaching cards stay general until an active TDEE and macro target exists.',
          reason_codes: ['missing_macro_target'],
          source: 'nutrition_summary',
        },
      ],
    });
  });
});
