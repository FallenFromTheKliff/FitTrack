import { Process, Processor } from '@nestjs/bull';

import {
  SUBSCRIPTION_EXPIRY_JOB,
  SUBSCRIPTION_LIFECYCLE_QUEUE,
  SUBSCRIPTION_WARNING_JOB,
} from './subscription.constants';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

@Processor(SUBSCRIPTION_LIFECYCLE_QUEUE)
export class SubscriptionLifecycleProcessor {
  constructor(
    private readonly subscriptionLifecycleService: SubscriptionLifecycleService,
  ) {}

  @Process(SUBSCRIPTION_WARNING_JOB)
  handleWarningJob(): Promise<void> {
    return this.subscriptionLifecycleService.runWarningCron();
  }

  @Process(SUBSCRIPTION_EXPIRY_JOB)
  handleExpiryJob(): Promise<void> {
    return this.subscriptionLifecycleService.runExpiryCron();
  }
}
