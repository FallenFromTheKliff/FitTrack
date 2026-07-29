import {
  GAMIFICATION_SEASON_LIFECYCLE_QUEUE,
  GAMIFICATION_SEASON_LIFECYCLE_TIMEZONE,
  GAMIFICATION_SEASON_SWEEP_JOB,
} from './gamification-season.constants';
import { GamificationSeasonLifecycleService } from './gamification-season-lifecycle.service';

describe('GamificationSeasonLifecycleService', () => {
  const gamificationService = {
    runSeasonLifecycleSweep: jest.fn(),
  };
  const lifecycleQueue = {
    add: jest.fn(),
  };

  let service: GamificationSeasonLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GamificationSeasonLifecycleService(
      gamificationService as never,
      lifecycleQueue as never,
    );
  });

  it('registers one repeatable lifecycle sweep when the module starts', async () => {
    lifecycleQueue.add.mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(GAMIFICATION_SEASON_LIFECYCLE_QUEUE).toBe(
      'gamification-season-lifecycle',
    );
    expect(lifecycleQueue.add).toHaveBeenCalledWith(
      GAMIFICATION_SEASON_SWEEP_JOB,
      {},
      {
        jobId: GAMIFICATION_SEASON_SWEEP_JOB,
        removeOnComplete: true,
        repeat: {
          cron: '*/15 * * * *',
          tz: GAMIFICATION_SEASON_LIFECYCLE_TIMEZONE,
        },
      },
    );
  });

  it('delegates deterministic season closing and startup to the domain service', async () => {
    gamificationService.runSeasonLifecycleSweep.mockResolvedValue({
      closedSeasonIds: ['closed-season'],
      startedSeasonId: 'next-season',
    });

    await service.runLifecycleSweep();

    expect(gamificationService.runSeasonLifecycleSweep).toHaveBeenCalledTimes(
      1,
    );
  });
});
