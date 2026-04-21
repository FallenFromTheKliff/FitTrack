import { BullModule } from '@nestjs/bull';
import { forwardRef, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { ActiveMemberCardGuard } from '../common/guards/active-member-card.guard';
import { ActiveMemberPlanGuard } from '../common/guards/active-member-plan.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';
import { MembershipCardController } from './card/card.controller';
import { MembershipCardRepository } from './card/card.repository';
import { MembershipCardService } from './card/card.service';
import { PaymentController } from './payment/payment.controller';
import { PaymongoCheckoutService } from './payment/paymongo-checkout.service';
import { PaymongoWebhookService } from './payment/paymongo-webhook.service';
import { PaymentWebhookController } from './payment/payment-webhook.controller';
import { PaymentRepository } from './payment/payment.repository';
import { PaymentService } from './payment/payment.service';
import { SUBSCRIPTION_LIFECYCLE_QUEUE } from './subscription/subscription.constants';
import { SubscriptionController } from './subscription/subscription.controller';
import { SubscriptionLifecycleProcessor } from './subscription/subscription-lifecycle.processor';
import { SubscriptionLifecycleService } from './subscription/subscription-lifecycle.service';
import { SubscriptionRepository } from './subscription/subscription.repository';
import { SubscriptionService } from './subscription/subscription.service';

@Module({
  imports: [
    EventEmitterModule,
    forwardRef(() => NotificationsModule),
    QueueModule,
    BullModule.registerQueue({ name: SUBSCRIPTION_LIFECYCLE_QUEUE }),
  ],
  controllers: [
    SubscriptionController,
    MembershipCardController,
    PaymentController,
    PaymentWebhookController,
  ],
  providers: [
    SubscriptionService,
    MembershipCardService,
    SubscriptionLifecycleService,
    SubscriptionLifecycleProcessor,
    SubscriptionRepository,
    MembershipCardRepository,
    ActiveMemberCardGuard,
    ActiveMemberPlanGuard,
    PaymentService,
    PaymentRepository,
    PaymongoCheckoutService,
    PaymongoWebhookService,
  ],
  exports: [
    ActiveMemberCardGuard,
    ActiveMemberPlanGuard,
    MembershipCardService,
    SubscriptionService,
    PaymentService,
    PaymentRepository,
    PaymongoCheckoutService,
  ],
})
export class MembershipModule {}
