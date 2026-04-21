import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CoachController } from './coach.controller';

function getGuardMetadata(
  methodName:
    | 'listCoaches'
    | 'getMyProfile'
    | 'getCoachById'
    | 'updateMyProfile'
    | 'updateCoachById',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    CoachController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName: 'getMyProfile' | 'updateMyProfile' | 'updateCoachById',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    CoachController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('CoachController', () => {
  const coachService = {
    listCoaches: jest.fn(),
    getMyProfile: jest.fn(),
    getCoachById: jest.fn(),
    updateMyProfile: jest.fn(),
    adminUpdateCoach: jest.fn(),
  };

  let controller: CoachController;

  beforeEach(() => {
    controller = new CoachController(coachService as never);
    jest.clearAllMocks();
  });

  it('lists coaches through the service', async () => {
    coachService.listCoaches.mockResolvedValue({ data: [], meta: {} });

    await controller.listCoaches({ page: 1, limit: 20 });

    expect(coachService.listCoaches).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it.each(['listCoaches', 'getCoachById'] as const)(
    'protects %s with JWT auth',
    (methodName) => {
      expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard]);
    },
  );

  it('loads the authenticated coach profile through the service', async () => {
    coachService.getMyProfile.mockResolvedValue({ id: 'coach-1' });

    await controller.getMyProfile({ sub: 'coach-user-1' } as never);

    expect(coachService.getMyProfile).toHaveBeenCalledWith('coach-user-1');
    expect(getGuardMetadata('getMyProfile')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('getMyProfile')).toEqual([UserRole.coach]);
  });

  it('loads a single coach profile through the service', async () => {
    coachService.getCoachById.mockResolvedValue({ id: 'coach-1' });

    await controller.getCoachById('coach-1');

    expect(coachService.getCoachById).toHaveBeenCalledWith('coach-1');
  });

  it('updates the authenticated coach profile through the service', async () => {
    coachService.updateMyProfile.mockResolvedValue({ id: 'coach-1' });

    await controller.updateMyProfile({ sub: 'user-1' } as never, {
      bio: 'Updated',
    });

    expect(coachService.updateMyProfile).toHaveBeenCalledWith('user-1', {
      bio: 'Updated',
    });
    expect(getGuardMetadata('updateMyProfile')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('updateMyProfile')).toEqual([UserRole.coach]);
  });

  it('locks admin coach updates to admin users', async () => {
    coachService.adminUpdateCoach.mockResolvedValue({ id: 'coach-1' });

    await controller.updateCoachById({ sub: 'admin-1' } as never, 'coach-1', {
      gym_commission_pct: 25,
    });

    expect(coachService.adminUpdateCoach).toHaveBeenCalledWith(
      'admin-1',
      'coach-1',
      {
        gym_commission_pct: 25,
      },
    );
    expect(getGuardMetadata('updateCoachById')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('updateCoachById')).toEqual([UserRole.admin]);
  });
});
