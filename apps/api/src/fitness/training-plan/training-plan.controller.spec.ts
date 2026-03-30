import { GUARDS_METADATA } from '@nestjs/common/constants';
import { FitnessGoal, UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TrainingPlanController } from './training-plan.controller';

function getGuardMetadata(
  methodName:
    | 'listPlans'
    | 'getPlanById'
    | 'createPlan'
    | 'deletePlan'
    | 'assignPlan',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    TrainingPlanController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(methodName: 'assignPlan'): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    TrainingPlanController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('TrainingPlanController', () => {
  const trainingPlanService = {
    listPlans: jest.fn(),
    getPlanById: jest.fn(),
    createPlan: jest.fn(),
    deletePlan: jest.fn(),
    assignPlan: jest.fn(),
  };

  let controller: TrainingPlanController;

  beforeEach(() => {
    controller = new TrainingPlanController(trainingPlanService as never);
    jest.clearAllMocks();
  });

  it.each(['listPlans', 'getPlanById', 'createPlan', 'deletePlan'] as const)(
    'protects %s with JWT auth',
    (methodName) => {
      expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard]);
    },
  );

  it('locks plan assignment to coach users', () => {
    expect(getGuardMetadata('assignPlan')).toEqual([JwtAuthGuard, RolesGuard]);
    expect(getRolesMetadata('assignPlan')).toEqual([UserRole.coach]);
  });

  it('lists plans through the service', async () => {
    trainingPlanService.listPlans.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.listPlans({ sub: 'user-1' } as never, {
      page: 1,
      limit: 20,
    });

    expect(trainingPlanService.listPlans).toHaveBeenCalledWith('user-1', {
      page: 1,
      limit: 20,
    });
  });

  it('creates plans through the service', async () => {
    trainingPlanService.createPlan.mockResolvedValue({ id: 'plan-1' });

    await controller.createPlan(
      { sub: 'coach-user-1', role: UserRole.coach } as never,
      {
        title: 'Upper / Lower Strength Builder',
        goal: FitnessGoal.bulking,
        duration_weeks: 8,
        days_per_week: 4,
        schedule: [],
      },
    );

    expect(trainingPlanService.createPlan).toHaveBeenCalledWith(
      'coach-user-1',
      UserRole.coach,
      expect.objectContaining({
        title: 'Upper / Lower Strength Builder',
      }),
    );
  });

  it('deletes plans through the service and returns a message', async () => {
    trainingPlanService.deletePlan.mockResolvedValue(undefined);

    await expect(
      controller.deletePlan('plan-1', { sub: 'user-1' } as never),
    ).resolves.toEqual({ message: 'Training plan deleted.' });
    expect(trainingPlanService.deletePlan).toHaveBeenCalledWith(
      'user-1',
      'plan-1',
    );
  });

  it('assigns plans through the service', async () => {
    trainingPlanService.assignPlan.mockResolvedValue({ id: 'plan-2' });

    await controller.assignPlan('plan-1', { sub: 'coach-user-1' } as never, {
      member_id: 'member-1',
    });

    expect(trainingPlanService.assignPlan).toHaveBeenCalledWith(
      'coach-user-1',
      'plan-1',
      'member-1',
    );
  });
});
