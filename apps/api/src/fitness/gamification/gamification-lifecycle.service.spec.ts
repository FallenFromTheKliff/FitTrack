import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { MasteryRank, NotificationType } from '@prisma/client';

import type { NotificationDispatchPayload } from '../../notifications/notification-dispatch.types';
import { NotificationsService } from '../../notifications/notifications.service';
import { type GamificationRankUpEvent } from './events/rank-up.event';
import { GamificationLifecycleService } from './gamification-lifecycle.service';

describe('GamificationLifecycleService', () => {
  let service: GamificationLifecycleService;

  const notificationsService = {
    dispatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationLifecycleService,
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<GamificationLifecycleService>(
      GamificationLifecycleService,
    );
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches rank-up notifications through the centralized notifications service', async () => {
    await service.handleRankUp(createRankUpEvent());

    const dispatchCalls = notificationsService.dispatch.mock.calls as Array<
      [string, NotificationType, NotificationDispatchPayload]
    >;

    expect(dispatchCalls[0]?.[0]).toBe('user-1');
    expect(dispatchCalls[0]?.[1]).toBe(NotificationType.rank_up);
    expect(dispatchCalls[0]?.[2].title).toBe('Mastery rank up');
    expect(dispatchCalls[0]?.[2].email?.subject).toBe(
      'FitTrack mastery rank up: Gold',
    );
  });

  it('never throws when dispatch fails', async () => {
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    notificationsService.dispatch.mockRejectedValue(
      new Error('dispatch failed'),
    );

    await expect(service.handleRankUp(createRankUpEvent())).resolves.toBe(
      undefined,
    );

    expect(loggerError).toHaveBeenCalledWith(
      'Failed to process gamification rank-up notification for user user-1',
      expect.stringContaining('dispatch failed'),
    );
  });
});

function createRankUpEvent(
  overrides: Partial<GamificationRankUpEvent> = {},
): GamificationRankUpEvent {
  return {
    userId: 'user-1',
    muscleGroup: 'legs',
    oldRank: MasteryRank.silver,
    newRank: MasteryRank.gold,
    rankedAt: '2026-03-27T05:00:00.000Z',
    ...overrides,
  };
}
