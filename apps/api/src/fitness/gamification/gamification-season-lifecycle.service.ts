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
    await this.lifecycleQueue.add(
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
  }
}
