import { SubscriptionStatus } from '@prisma/client';

export const SUBSCRIPTION_EXPIRED_EVENT = 'subscription.expired';

export interface SubscriptionExpiredEvent {
  subscriptionId: string;
  userId: string;
  planId: string;
  previousStatus: SubscriptionStatus;
  expiredAt: string;
}
