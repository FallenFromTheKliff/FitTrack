import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bull';

import {
  GAMIFICATION_SEASON_LIFECYCLE_QUEUE,
  GAMIFICATION_SEASON_LIFECYCLE_TIMEZONE,
  GAMIFICATION_SEASON_SWEEP_JOB,
} from './gamification-season.constants';
import { GamificationService } from './gamification.service';

@Injectable()
export class GamificationSeasonLifecycleService implements OnModuleInit {
  private readonly logger = new Logger(GamificationSeasonLifecycleService.name);
  private lifecycleJobEnsured = false;

  constructor(
    private readonly gamificationService: GamificationService,
    @InjectQueue(GAMIFICATION_SEASON_LIFECYCLE_QUEUE)
    private readonly lifecycleQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLifecycleJob();
  }

  async runLifecycleSweep(): Promise<void> {
    const result = await this.gamificationService.runSeasonLifecycleSweep();
    if (result.closedSeasonIds.length || result.startedSeasonId) {
      this.logger.log(
        `Season lifecycle sweep closed ${result.closedSeasonIds.length} season(s)` +
          (result.startedSeasonId
            ? ` and started ${result.startedSeasonId}.`
            : '.'),
      );
    }
  }

  private async ensureLifecycleJob(): Promise<void> {
    if (this.lifecycleJobEnsured) {
      return;
    }

    const repeat = {
      cron: '*/15 * * * *',
      tz: GAMIFICATION_SEASON_LIFECYCLE_TIMEZONE,
    };
    const queueWithRepeatableJobs = this.lifecycleQueue as Queue & {
      getRepeatableJobs?: () => Promise<
        Array<{ cron?: string; key?: string; name?: string; tz?: string }>
      >;
      removeRepeatableByKey?: (key: string) => Promise<unknown>;
    };

    if (queueWithRepeatableJobs.getRepeatableJobs) {
      const repeatableJobs = await queueWithRepeatableJobs.getRepeatableJobs();
      const matchingJobs = repeatableJobs.filter(
        (job) =>
          job.name === GAMIFICATION_SEASON_SWEEP_JOB &&
          job.cron === repeat.cron &&
          job.tz === repeat.tz,
      );
      if (matchingJobs.length > 0) {
        if (queueWithRepeatableJobs.removeRepeatableByKey) {
          for (const duplicate of matchingJobs.slice(1)) {
            if (duplicate.key) {
              await queueWithRepeatableJobs.removeRepeatableByKey(
                duplicate.key,
              );
            }
          }
        }
        this.lifecycleJobEnsured = true;
        return;
      }
    }

    await this.lifecycleQueue.add(
      GAMIFICATION_SEASON_SWEEP_JOB,
      {},
      {
        jobId: GAMIFICATION_SEASON_SWEEP_JOB,
        removeOnComplete: true,
        repeat,
      },
    );
    this.lifecycleJobEnsured = true;
  }
}
