import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bull';

import {
  FITNESS_SESSION_ABANDONED_WINDOW_HOURS,
  FITNESS_SESSION_CLEANUP_JOB,
  FITNESS_SESSION_LIFECYCLE_QUEUE,
  FITNESS_SESSION_LIFECYCLE_TIMEZONE,
} from './session.constants';
import { WorkoutSessionRepository } from './session.repository';

@Injectable()
export class WorkoutSessionLifecycleService implements OnModuleInit {
  private readonly logger = new Logger(WorkoutSessionLifecycleService.name);

  constructor(
    private readonly repo: WorkoutSessionRepository,
    @InjectQueue(FITNESS_SESSION_LIFECYCLE_QUEUE)
    private readonly lifecycleQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLifecycleJobs();
  }

  async runCleanupCron(): Promise<void> {
    const cancelledAt = new Date();
    const cutoff = new Date(
      cancelledAt.getTime() -
        FITNESS_SESSION_ABANDONED_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const cancelledCount = await this.repo.cancelAbandonedInProgressSessions(
      cutoff,
      cancelledAt,
    );

    if (cancelledCount > 0) {
      this.logger.log(
        `Cancelled ${cancelledCount} abandoned workout session(s).`,
      );
    }
  }

  private async ensureLifecycleJobs(): Promise<void> {
    await this.lifecycleQueue.add(
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
  }
}
