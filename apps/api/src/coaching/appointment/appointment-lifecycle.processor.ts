import { Process, Processor } from '@nestjs/bull';

import {
  COACHING_COMPLETION_JOB,
  COACHING_LIFECYCLE_QUEUE,
  COACHING_NO_SHOW_JOB,
  COACHING_RECURRING_BILLING_OVERDUE_JOB,
} from './appointment.constants';
import { AppointmentLifecycleService } from './appointment-lifecycle.service';

@Processor(COACHING_LIFECYCLE_QUEUE)
export class AppointmentLifecycleProcessor {
  constructor(
    private readonly appointmentLifecycleService: AppointmentLifecycleService,
  ) {}

  @Process(COACHING_NO_SHOW_JOB)
  handleNoShowJob(job: { data: { appointmentId: string } }): Promise<void> {
    return this.appointmentLifecycleService.runNoShowCheck(
      job.data.appointmentId,
    );
  }

  @Process(COACHING_COMPLETION_JOB)
  handleCompletionJob(): Promise<void> {
    return this.appointmentLifecycleService.runCompletionCron();
  }

  @Process(COACHING_RECURRING_BILLING_OVERDUE_JOB)
  async handleRecurringBillingOverdueJob(): Promise<void> {
    await this.appointmentLifecycleService.runRecurringBillingOverdueCron();
  }
}
