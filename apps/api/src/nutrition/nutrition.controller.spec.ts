import { GUARDS_METADATA } from '@nestjs/common/constants';

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { ActiveMemberAccountGuard } from '../common/guards/active-member-account.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NutritionController } from './nutrition.controller';

function getGuardMetadata(
  methodName:
    | 'getActiveTdee'
    | 'listTdeeHistory'
    | 'recalculateTdee'
    | 'createNutritionLog'
    | 'listNutritionLogs'
    | 'updateNutritionLog'
    | 'deleteNutritionLog'
    | 'getDailySummary',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    NutritionController.prototype[methodName],
  ) as unknown[] | undefined;
}

describe('NutritionController', () => {
  const nutritionService = {
    getActiveTdee: jest.fn(),
    getTdeeHistory: jest.fn(),
    recalculateTdee: jest.fn(),
    logNutrition: jest.fn(),
    getNutritionLogs: jest.fn(),
    updateNutritionLog: jest.fn(),
    deleteNutritionLog: jest.fn(),
    getDailySummary: jest.fn(),
  };

  let controller: NutritionController;

  beforeEach(() => {
    controller = new NutritionController(nutritionService as never);
    jest.clearAllMocks();
  });

  it.each([
    'getActiveTdee',
    'listTdeeHistory',
    'recalculateTdee',
    'getDailySummary',
  ] as const)('protects %s with JWT auth', (methodName) => {
    expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard]);
  });

  it.each([
    'createNutritionLog',
    'listNutritionLogs',
    'updateNutritionLog',
    'deleteNutritionLog',
  ] as const)('protects %s with active-member enforcement', (methodName) => {
    expect(getGuardMetadata(methodName)).toEqual([
      JwtAuthGuard,
      ActiveMemberAccountGuard,
    ]);
  });

  it('loads the active tdee aggregate through the service', async () => {
    const user = { sub: 'user-1' } as JwtPayload;
    nutritionService.getActiveTdee.mockResolvedValue({
      tdee: { id: 'tdee-1' },
      macros: { id: 'macro-1' },
    });

    await controller.getActiveTdee(user);

    expect(nutritionService.getActiveTdee).toHaveBeenCalledWith('user-1');
  });

  it('loads tdee history through the service', async () => {
    nutritionService.getTdeeHistory.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.listTdeeHistory({ sub: 'user-1' } as JwtPayload, {
      page: 2,
      limit: 10,
    });

    expect(nutritionService.getTdeeHistory).toHaveBeenCalledWith('user-1', {
      page: 2,
      limit: 10,
    });
  });

  it('recalculates tdee through the service', async () => {
    const dto = {
      weight_kg: 76.5,
    };
    nutritionService.recalculateTdee.mockResolvedValue({
      tdee: { id: 'tdee-2' },
      macros: { id: 'macro-2' },
    });

    await controller.recalculateTdee({ sub: 'user-1' } as JwtPayload, dto);

    expect(nutritionService.recalculateTdee).toHaveBeenCalledWith(
      'user-1',
      dto,
    );
  });

  it('creates nutrition logs through the service', async () => {
    const dto = {
      log_date: '2026-03-27',
      meal_name: 'Breakfast',
    };

    await controller.createNutritionLog(
      { sub: 'user-1' } as JwtPayload,
      dto as never,
    );

    expect(nutritionService.logNutrition).toHaveBeenCalledWith('user-1', dto);
  });

  it('lists nutrition logs through the service', async () => {
    await controller.listNutritionLogs({ sub: 'user-1' } as JwtPayload, {
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      page: 1,
      limit: 20,
    });

    expect(nutritionService.getNutritionLogs).toHaveBeenCalledWith('user-1', {
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      page: 1,
      limit: 20,
    });
  });

  it('updates nutrition logs through the service', async () => {
    const dto = {
      calories: 480,
    };

    await controller.updateNutritionLog(
      '11111111-1111-4111-8111-111111111111',
      { sub: 'user-1' } as JwtPayload,
      dto,
    );

    expect(nutritionService.updateNutritionLog).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
      dto,
    );
  });

  it('deletes nutrition logs through the service and returns a confirmation message', async () => {
    nutritionService.deleteNutritionLog.mockResolvedValue(undefined);

    await expect(
      controller.deleteNutritionLog('11111111-1111-4111-8111-111111111111', {
        sub: 'user-1',
      } as JwtPayload),
    ).resolves.toEqual({
      message: 'Nutrition log deleted.',
    });

    expect(nutritionService.deleteNutritionLog).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('loads daily summary through the service', async () => {
    const dto = { date: '2026-03-27' };

    await controller.getDailySummary({ sub: 'user-1' } as JwtPayload, dto);

    expect(nutritionService.getDailySummary).toHaveBeenCalledWith(
      'user-1',
      dto,
    );
  });
});
