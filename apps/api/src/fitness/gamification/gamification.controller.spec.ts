import { GUARDS_METADATA } from '@nestjs/common/constants';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { ActiveMemberCardGuard } from '../../common/guards/active-member-card.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GamificationController } from './gamification.controller';

function getGuardMetadata(
  methodName:
    | 'listProgressionSources'
    | 'getProgressionProfile'
    | 'getActiveSeasonStanding'
    | 'getIntegritySummary'
    | 'getRankingProfile'
    | 'updateRankingProfile'
    | 'listMilestones'
    | 'listMastery'
    | 'listLeaderboard',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    GamificationController.prototype[methodName],
  ) as unknown[] | undefined;
}

describe('GamificationController', () => {
  const gamificationService = {
    getActiveSeasonStanding: jest.fn(),
    getIntegritySummary: jest.fn(),
    getMilestoneProgress: jest.fn(),
    getProgressionProfile: jest.fn(),
    listProgressionSources: jest.fn(),
    getRankingProfile: jest.fn(),
    getMuscleMastery: jest.fn(),
    getLeaderboard: jest.fn(),
    updateRankingProfile: jest.fn(),
  };

  let controller: GamificationController;

  beforeEach(() => {
    controller = new GamificationController(gamificationService as never);
    jest.clearAllMocks();
  });

  it('protects mastery and leaderboard routes with JWT auth', () => {
    expect(getGuardMetadata('listProgressionSources')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
    expect(getGuardMetadata('getProgressionProfile')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
    expect(getGuardMetadata('getActiveSeasonStanding')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
    expect(getGuardMetadata('getIntegritySummary')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
    expect(getGuardMetadata('getRankingProfile')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
    expect(getGuardMetadata('updateRankingProfile')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
    expect(getGuardMetadata('listMilestones')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
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

  it('loads the progression profile through the service for the current user', async () => {
    const user = { sub: 'user-1' } as JwtPayload;
    gamificationService.getProgressionProfile.mockResolvedValue({
      user_id: 'user-1',
      total_xp: 0,
    });

    await controller.getProgressionProfile(user);

    expect(gamificationService.getProgressionProfile).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('loads progression sources through the service for the current user', async () => {
    const user = { sub: 'user-1' } as JwtPayload;
    gamificationService.listProgressionSources.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, total_pages: 0 },
    });

    await controller.listProgressionSources(user, {
      page: 1,
      limit: 10,
      source_type: 'workout_session_completed',
    });

    expect(gamificationService.listProgressionSources).toHaveBeenCalledWith(
      'user-1',
      {
        page: 1,
        limit: 10,
        source_type: 'workout_session_completed',
      },
    );
  });

  it('updates the ranking profile through the service for the current user', async () => {
    const user = { sub: 'user-1' } as JwtPayload;
    gamificationService.updateRankingProfile.mockResolvedValue({
      user_id: 'user-1',
      visibility: 'anonymous',
    });

    await controller.updateRankingProfile(user, {
      visibility: 'anonymous',
      display_alias: 'Anonymous Phoenix',
    });

    expect(gamificationService.updateRankingProfile).toHaveBeenCalledWith(
      'user-1',
      {
        visibility: 'anonymous',
        display_alias: 'Anonymous Phoenix',
      },
    );
  });

  it('loads the ranking profile through the service for the current user', async () => {
    const user = { sub: 'user-1' } as JwtPayload;
    gamificationService.getRankingProfile.mockResolvedValue({
      user_id: 'user-1',
      visibility: 'public',
    });

    await controller.getRankingProfile(user);

    expect(gamificationService.getRankingProfile).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('loads the active season standing through the service for the current user', async () => {
    const user = { sub: 'user-1' } as JwtPayload;
    gamificationService.getActiveSeasonStanding.mockResolvedValue({
      user_id: 'user-1',
      season_points: 0,
    });

    await controller.getActiveSeasonStanding(user);

    expect(gamificationService.getActiveSeasonStanding).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('loads milestone progress through the service for the current user', async () => {
    const user = { sub: 'user-1' } as JwtPayload;
    gamificationService.getMilestoneProgress.mockResolvedValue([]);

    await controller.listMilestones(user);

    expect(gamificationService.getMilestoneProgress).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('loads integrity summary through the service for the current user', async () => {
    const user = { sub: 'user-1' } as JwtPayload;
    gamificationService.getIntegritySummary.mockResolvedValue({
      user_id: 'user-1',
      open_case_count: 0,
    });

    await controller.getIntegritySummary(user);

    expect(gamificationService.getIntegritySummary).toHaveBeenCalledWith(
      'user-1',
    );
  });
});
