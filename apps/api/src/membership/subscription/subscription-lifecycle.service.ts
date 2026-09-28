import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import type { Queue } from 'bull';

import { NotificationsService } from '../../notifications/notifications.service';
import {
  PAYMENT_COMPLETED_EVENT,
  type PaymentCompletedEvent,
} from '../payment/events/payment-completed.event';
import {
  SUBSCRIPTION_EXPIRED_EVENT,
  type SubscriptionExpiredEvent,
} from './events/subscription-expired.event';
import { SubscriptionRepository } from './subscription.repository';
import {
  SUBSCRIPTION_EXPIRY_JOB,
  SUBSCRIPTION_LIFECYCLE_QUEUE,
  SUBSCRIPTION_WARNING_JOB,
  SUBSCRIPTION_WARNING_TIMEZONE,
} from './subscription.constants';

type SubscriptionDeliveryTarget = Awaited<
  ReturnType<
    SubscriptionRepository['findSubscriptionNotificationContextByIdOrThrow']
  >
>;

type SubscriptionWarningCandidate = Awaited<
  ReturnType<SubscriptionRepository['findSevenDayWarningCandidates']>
>[number];

@Injectable()
export class SubscriptionLifecycleService implements OnModuleInit {
  constructor(
    private readonly repo: SubscriptionRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsService: NotificationsService,
    @InjectQueue(SUBSCRIPTION_LIFECYCLE_QUEUE)
    private readonly lifecycleQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLifecycleJobs();
  }

  async runWarningCron(): Promise<void> {
    const now = new Date();

    await this.processWarningWindow(
      await this.repo.findSevenDayWarningCandidates(now, this.addDays(now, 7)),
      'warned_7d_at',
      7,
      true,
      now,
    );
    await this.processWarningWindow(
      await this.repo.findThreeDayWarningCandidates(now, this.addDays(now, 3)),
      'warned_3d_at',
      3,
      false,
      now,
    );
    await this.processWarningWindow(
      await this.repo.findOneDayWarningCandidates(now, this.addDays(now, 1)),
      'warned_1d_at',
      1,
      false,
      now,
    );
  }

  async runExpiryCron(): Promise<void> {
    const now = new Date();
    const candidates = await this.repo.findExpiringSubscriptions(now);

    for (const subscription of candidates) {
      await this.repo.expireSubscription(subscription.id);
      await this.queueExpiryNotifications(subscription);
      this.emitSubscriptionExpired(subscription);
    }
  }

  @OnEvent(PAYMENT_COMPLETED_EVENT, { async: true })
  async handlePaymentConfirmedNotification(
    event: PaymentCompletedEvent,
  ): Promise<void> {
    if (event.payableType !== 'subscription') {
      return;
    }

    const subscription =
      await this.repo.findSubscriptionNotificationContextByIdOrThrow(
        event.payableId,
      );

    await this.notificationsService.dispatch(
      subscription.user.id,
      NotificationType.payment_confirmed,
      {
        title: 'Payment confirmed',
        body: this.buildPaymentConfirmedBody(subscription, event.amount),
        data: {
          subscription_id: subscription.id,
          plan_id: subscription.plan.id,
          payment_id: event.paymentId,
          amount: event.amount,
        },
        email: {
          subject: `Payment confirmed for ${this.getPlanName(subscription)}`,
          html: this.buildPaymentConfirmedHtml(subscription, event.amount),
        },
      },
    );
  }

  private async ensureLifecycleJobs(): Promise<void> {
    await this.lifecycleQueue.add(
      SUBSCRIPTION_WARNING_JOB,
      {},
      {
        jobId: SUBSCRIPTION_WARNING_JOB,
        removeOnComplete: true,
        repeat: {
          cron: '0 8 * * *',
          tz: SUBSCRIPTION_WARNING_TIMEZONE,
        },
      },
    );

    await this.lifecycleQueue.add(
      SUBSCRIPTION_EXPIRY_JOB,
      {},
      {
        jobId: SUBSCRIPTION_EXPIRY_JOB,
        removeOnComplete: true,
        repeat: {
          cron: '0 0 * * *',
          tz: SUBSCRIPTION_WARNING_TIMEZONE,
        },
      },
    );
  }

  private async processWarningWindow(
    candidates: SubscriptionWarningCandidate[],
    warnedField: 'warned_7d_at' | 'warned_3d_at' | 'warned_1d_at',
    daysRemaining: 7 | 3 | 1,
    markPastDue: boolean,
    warnedAt: Date,
  ): Promise<void> {
    for (const subscription of candidates) {
      await this.repo.markWarningSent(
        subscription.id,
        warnedField,
        warnedAt,
        markPastDue,
      );
      await this.queueWarningNotifications(subscription, daysRemaining);
    }
  }

  private async queueWarningNotifications(
    subscription: SubscriptionWarningCandidate,
    daysRemaining: 7 | 3 | 1,
  ): Promise<void> {
    await this.notificationsService.dispatch(
      subscription.user.id,
      NotificationType.subscription_expiring,
      {
        title: `${this.getPlanName(subscription)} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
        body: this.buildWarningBody(subscription, daysRemaining),
        data: {
          subscription_id: subscription.id,
          plan_id: subscription.plan.id,
          days_remaining: daysRemaining,
          expires_at: subscription.expires_at?.toISOString() ?? null,
        },
        email: {
          subject: `${this.getPlanName(subscription)} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
          html: this.buildWarningHtml(subscription, daysRemaining),
        },
        sms: {
          body: this.buildWarningSms(subscription, daysRemaining),
        },
      },
    );
  }

  private async queueExpiryNotifications(
    subscription: SubscriptionWarningCandidate,
  ): Promise<void> {
    await this.notificationsService.dispatch(
      subscription.user.id,
      NotificationType.subscription_expired,
      {
        title: `${this.getPlanName(subscription)} has expired`,
        body: this.buildExpiryBody(subscription),
        data: {
          subscription_id: subscription.id,
          plan_id: subscription.plan.id,
          expired_at: subscription.expires_at?.toISOString() ?? null,
        },
        email: {
          subject: `${this.getPlanName(subscription)} has expired`,
          html: this.buildExpiryHtml(subscription),
        },
      },
    );
  }

  private buildWarningHtml(
    subscription: SubscriptionWarningCandidate,
    daysRemaining: 7 | 3 | 1,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Your ${this.getPlanName(subscription)} is nearing expiry</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(subscription)}, your subscription expires in
          <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>.
        </p>
        <p style="color:#555">Renew before ${this.formatDate(subscription.expires_at)} to keep uninterrupted access.</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildExpiryHtml(subscription: SubscriptionWarningCandidate): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">${this.getPlanName(subscription)} has expired</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(subscription)}, your membership access ended on
          <strong>${this.formatDate(subscription.expires_at)}</strong>.
        </p>
        <p style="color:#555">Renew to restore gym access and keep your membership active.</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildPaymentConfirmedHtml(
    subscription: SubscriptionDeliveryTarget,
    amount: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Payment confirmed</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(subscription)}, we confirmed your payment for
          <strong>${this.getPlanName(subscription)}</strong>.
        </p>
        <p style="color:#555">Amount received: <strong>PHP ${amount}</strong>.</p>
        <p style="color:#555">Your access is active until ${this.formatDate(subscription.expires_at)}.</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildWarningBody(
    subscription: SubscriptionWarningCandidate,
    daysRemaining: 7 | 3 | 1,
  ): string {
    return `Your ${this.getPlanName(subscription)} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} on ${this.formatDate(subscription.expires_at)}.`;
  }

  private buildExpiryBody(subscription: SubscriptionWarningCandidate): string {
    return `Your ${this.getPlanName(subscription)} expired on ${this.formatDate(subscription.expires_at)}. Renew to restore gym access.`;
  }

  private buildPaymentConfirmedBody(
    subscription: SubscriptionDeliveryTarget,
    amount: string,
  ): string {
    return `We confirmed your payment for ${this.getPlanName(subscription)}. Amount received: PHP ${amount}. Your access is active until ${this.formatDate(subscription.expires_at)}.`;
  }

  private buildWarningSms(
    subscription: SubscriptionWarningCandidate,
    daysRemaining: 7 | 3 | 1,
  ): string {
    return `FitTrack: your ${this.getPlanName(subscription)} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} on ${this.formatDate(subscription.expires_at)}. Renew to avoid interruption.`;
  }

  private getDisplayName(subscription: SubscriptionDeliveryTarget): string {
    const firstName = subscription.user.profile?.first_name ?? 'member';
    const lastName = subscription.user.profile?.last_name ?? '';
    return `${firstName} ${lastName}`.trim();
  }

  private getPlanName(
    subscription: Pick<
      SubscriptionDeliveryTarget,
      'plan' | 'plan_name_snapshot'
    >,
  ): string {
    return subscription.plan_name_snapshot ?? subscription.plan.name;
  }

  private formatDate(value: Date | null): string {
    if (!value) {
      return 'your current expiry date';
    }

    return new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'long',
      timeZone: SUBSCRIPTION_WARNING_TIMEZONE,
    }).format(value);
  }

  private addDays(date: Date, days: number): Date {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  private emitSubscriptionExpired(
    subscription: SubscriptionWarningCandidate,
  ): void {
    const event: SubscriptionExpiredEvent = {
      subscriptionId: subscription.id,
      userId: subscription.user.id,
      planId: subscription.plan.id,
      previousStatus: subscription.status,
      expiredAt: new Date().toISOString(),
    };

    this.eventEmitter.emit(SUBSCRIPTION_EXPIRED_EVENT, event);
  }
}
