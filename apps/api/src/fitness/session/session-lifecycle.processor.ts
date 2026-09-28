import { Process, Processor } from '@nestjs/bull';

import {
  FITNESS_SESSION_CLEANUP_JOB,
  FITNESS_SESSION_LIFECYCLE_QUEUE,
} from './session.constants';
import { WorkoutSessionLifecycleService } from './session-lifecycle.service';

@Processor(FITNESS_SESSION_LIFECYCLE_QUEUE)
export class WorkoutSessionLifecycleProcessor {
  constructor(
    private readonly workoutSessionLifecycleService: WorkoutSessionLifecycleService,
  ) {}

  @Process(FITNESS_SESSION_CLEANUP_JOB)
  handleCleanupJob(): Promise<void> {
    return this.workoutSessionLifecycleService.runCleanupCron();
  }
}
