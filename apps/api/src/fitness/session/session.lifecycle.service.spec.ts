import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';

import {
  FITNESS_SESSION_CLEANUP_JOB,
  FITNESS_SESSION_LIFECYCLE_QUEUE,
  FITNESS_SESSION_LIFECYCLE_TIMEZONE,
} from './session.constants';
import { WorkoutSessionLifecycleService } from './session-lifecycle.service';
import { WorkoutSessionRepository } from './session.repository';

describe('WorkoutSessionLifecycleService', () => {
  let service: WorkoutSessionLifecycleService;

  const repo = {
    cancelAbandonedInProgressSessions: jest.fn(),
  };

  const lifecycleQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutSessionLifecycleService,
        { provide: WorkoutSessionRepository, useValue: repo },
        {
          provide: getQueueToken(FITNESS_SESSION_LIFECYCLE_QUEUE),
          useValue: lifecycleQueue,
        },
      ],
    }).compile();

    service = module.get<WorkoutSessionLifecycleService>(
      WorkoutSessionLifecycleService,
    );
    jest.clearAllMocks();
  });

  it('registers the hourly cleanup job on module init', async () => {
    await service.onModuleInit();

    expect(lifecycleQueue.add).toHaveBeenCalledWith(
      FITNESS_SESSION_CLEANUP_JOB,
      {},
      {
        jobId: FITNESS_SESSION_CLEANUP_JOB,
        removeOnComplete: true,
        repeat: {
          cron: '0 * * * *',
          tz: FITNESS_SESSION_LIFECYCLE_TIMEZONE,
        },
      },
    );
  });

  it('cancels abandoned sessions during the cleanup cron', async () => {
    repo.cancelAbandonedInProgressSessions.mockResolvedValue(2);

    await service.runCleanupCron();

    expect(repo.cancelAbandonedInProgressSessions).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
    );
  });
});
