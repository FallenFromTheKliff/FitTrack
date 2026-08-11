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
    getRepeatableJobs: jest.fn(),
    removeRepeatableByKey: jest.fn(),
  };

  let service: GamificationSeasonLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    lifecycleQueue.getRepeatableJobs.mockResolvedValue([]);
    service = new GamificationSeasonLifecycleService(
      gamificationService as never,
      lifecycleQueue as never,
    );
  });

  it('reuses the existing repeatable job and removes duplicate registrations', async () => {
    lifecycleQueue.getRepeatableJobs.mockResolvedValue([
      {
        cron: '*/15 * * * *',
        key: 'primary',
        name: GAMIFICATION_SEASON_SWEEP_JOB,
        tz: GAMIFICATION_SEASON_LIFECYCLE_TIMEZONE,
      },
      {
        cron: '*/15 * * * *',
        key: 'duplicate',
        name: GAMIFICATION_SEASON_SWEEP_JOB,
        tz: GAMIFICATION_SEASON_LIFECYCLE_TIMEZONE,
      },
    ]);

    await service.onModuleInit();

    expect(lifecycleQueue.add).not.toHaveBeenCalled();
    expect(lifecycleQueue.removeRepeatableByKey).toHaveBeenCalledWith(
      'duplicate',
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
