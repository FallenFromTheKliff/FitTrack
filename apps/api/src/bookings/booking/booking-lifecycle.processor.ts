import { Process, Processor } from '@nestjs/bull';

import {
  BOOKING_COMPLETION_JOB,
  BOOKING_LIFECYCLE_QUEUE,
  BOOKING_NO_SHOW_JOB,
  BOOKING_PENDING_CLEANUP_JOB,
} from './booking.constants';
import { BookingLifecycleService } from './booking-lifecycle.service';

@Processor(BOOKING_LIFECYCLE_QUEUE)
export class BookingLifecycleProcessor {
  constructor(
    private readonly bookingLifecycleService: BookingLifecycleService,
  ) {}

  @Process(BOOKING_NO_SHOW_JOB)
  handleNoShowJob(job: { data: { bookingId: string } }): Promise<void> {
    return this.bookingLifecycleService.runNoShowCheck(job.data.bookingId);
  }

  @Process(BOOKING_PENDING_CLEANUP_JOB)
  handlePendingCleanupJob(): Promise<void> {
    return this.bookingLifecycleService.runPendingCleanupCron();
  }

  @Process(BOOKING_COMPLETION_JOB)
  handleCompletionJob(): Promise<void> {
    return this.bookingLifecycleService.runCompletionCron();
  }
}
