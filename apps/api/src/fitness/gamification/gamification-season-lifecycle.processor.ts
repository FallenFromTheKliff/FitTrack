import { Process, Processor } from '@nestjs/bull';

import {
  GAMIFICATION_SEASON_LIFECYCLE_QUEUE,
  GAMIFICATION_SEASON_SWEEP_JOB,
} from './gamification-season.constants';
import { GamificationSeasonLifecycleService } from './gamification-season-lifecycle.service';

@Processor(GAMIFICATION_SEASON_LIFECYCLE_QUEUE)
export class GamificationSeasonLifecycleProcessor {
  constructor(
    private readonly lifecycleService: GamificationSeasonLifecycleService,
  ) {}

  @Process(GAMIFICATION_SEASON_SWEEP_JOB)
  handleLifecycleSweep(): Promise<void> {
    return this.lifecycleService.runLifecycleSweep();
  }
}
