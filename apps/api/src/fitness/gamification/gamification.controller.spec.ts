import { GUARDS_METADATA } from '@nestjs/common/constants';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { ActiveMemberCardGuard } from '../../common/guards/active-member-card.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GamificationController } from './gamification.controller';

function getGuardMetadata(
  methodName: 'listMastery' | 'listLeaderboard',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    GamificationController.prototype[methodName],
  ) as unknown[] | undefined;
}

describe('GamificationController', () => {
  const gamificationService = {
    getMuscleMastery: jest.fn(),
    getLeaderboard: jest.fn(),
  };

  let controller: GamificationController;

  beforeEach(() => {
    controller = new GamificationController(gamificationService as never);
    jest.clearAllMocks();
  });

  it('protects mastery and leaderboard routes with JWT auth', () => {
    expect(getGuardMetadata('listMastery')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
    expect(getGuardMetadata('listLeaderboard')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
  });

  it('loads mastery through the service for the current user', async () => {
    const user = { sub: 'user-1' } as JwtPayload;
    gamificationService.getMuscleMastery.mockResolvedValue([]);

    await controller.listMastery(user, { muscle_group: 'legs' });

    expect(gamificationService.getMuscleMastery).toHaveBeenCalledWith(
      'user-1',
      { muscle_group: 'legs' },
    );
  });

  it('loads the leaderboard through the service', async () => {
    gamificationService.getLeaderboard.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.listLeaderboard({ page: 2, limit: 10 });

    expect(gamificationService.getLeaderboard).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
    });
  });
});
