import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { NotificationsService } from '../../notifications/notifications.service';
import { SubscriptionRepository } from './subscription.repository';
import {
  SUBSCRIPTION_EXPIRY_JOB,
  SUBSCRIPTION_LIFECYCLE_QUEUE,
  SUBSCRIPTION_WARNING_JOB,
  SUBSCRIPTION_WARNING_TIMEZONE,
} from './subscription.constants';
import { SUBSCRIPTION_EXPIRED_EVENT } from './events/subscription-expired.event';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

describe('SubscriptionLifecycleService', () => {
  let service: SubscriptionLifecycleService;

  const repo = {
    findSevenDayWarningCandidates: jest.fn(),
    findThreeDayWarningCandidates: jest.fn(),
    findOneDayWarningCandidates: jest.fn(),
    markWarningSent: jest.fn(),
    findExpiringSubscriptions: jest.fn(),
    expireSubscription: jest.fn(),
    findSubscriptionNotificationContextByIdOrThrow: jest.fn(),
  };

  const notificationsService = {
    dispatch: jest.fn(),
  };

  const lifecycleQueue = {
    add: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: SubscriptionRepository, useValue: repo },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: getQueueToken(SUBSCRIPTION_LIFECYCLE_QUEUE),
          useValue: lifecycleQueue,
        },
      ],
    }).compile();

    service = module.get<SubscriptionLifecycleService>(
      SubscriptionLifecycleService,
    );
    jest.clearAllMocks();
  });

  it('registers repeatable warning and expiry jobs on module init', async () => {
    await service.onModuleInit();

    expect(lifecycleQueue.add).toHaveBeenNthCalledWith(
      1,
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

    expect(lifecycleQueue.add).toHaveBeenNthCalledWith(
      2,
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
  });

  it('marks seven-day warnings, transitions to past_due, and dispatches subscription_expiring notifications', async () => {
    repo.findSevenDayWarningCandidates.mockResolvedValue([
      {
        id: 'sub-1',
        expires_at: new Date('2026-03-31T00:00:00.000Z'),
        plan: { id: 'plan-1', name: 'Monthly Membership' },
        user: {
          id: 'user-1',
          auth_identities: [
            {
              identifier: 'member@example.com',
              provider: 'email',
            },
          ],
          notification_prefs: {
            subscription_expiring_email: true,
            subscription_expiring_sms: true,
          },
          profile: {
            first_name: 'Jamie',
            last_name: 'Rivera',
            phone: '+639171234567',
          },
        },
      },
    ]);
    repo.findThreeDayWarningCandidates.mockResolvedValue([]);
    repo.findOneDayWarningCandidates.mockResolvedValue([]);

    await service.runWarningCron();

    expect(repo.markWarningSent).toHaveBeenCalledWith(
      'sub-1',
      'warned_7d_at',
      expect.any(Date),
      true,
    );
    const warningDispatchArgs = notificationsService.dispatch.mock.calls[0] as
      | [
          string,
          NotificationType,
          {
            title: string;
            email?: { subject: string };
            sms?: { body: string };
            data?: {
              subscription_id: string;
              plan_id: string;
              days_remaining: number;
            };
          },
        ]
      | undefined;

    expect(warningDispatchArgs?.[0]).toBe('user-1');
    expect(warningDispatchArgs?.[1]).toBe(
      NotificationType.subscription_expiring,
    );
    expect(warningDispatchArgs?.[2].title).toBe(
      'Monthly Membership expires in 7 days',
    );
    expect(warningDispatchArgs?.[2].email?.subject).toBe(
      'Monthly Membership expires in 7 days',
    );
    expect(warningDispatchArgs?.[2].sms?.body).toContain(
      'Monthly Membership expires in 7 days',
    );
    expect(warningDispatchArgs?.[2].data).toEqual(
      expect.objectContaining({
        subscription_id: 'sub-1',
        plan_id: 'plan-1',
        days_remaining: 7,
      }),
    );
  });

  it('expires ended subscriptions and dispatches subscription_expired notifications', async () => {
    repo.findExpiringSubscriptions.mockResolvedValue([
      {
        id: 'sub-1',
        status: 'past_due',
        expires_at: new Date('2026-03-20T00:00:00.000Z'),
        plan: { id: 'plan-1', name: 'Monthly Membership' },
        user: {
          id: 'user-1',
          auth_identities: [
            {
              identifier: 'member@example.com',
              provider: 'email',
            },
          ],
          notification_prefs: {
            subscription_expired_email: true,
          },
          profile: {
            first_name: 'Jamie',
            last_name: 'Rivera',
            phone: '+639171234567',
          },
        },
      },
    ]);

    await service.runExpiryCron();

    expect(repo.expireSubscription).toHaveBeenCalledWith('sub-1');
    const expiredDispatchArgs = notificationsService.dispatch.mock.calls[0] as
      | [
          string,
          NotificationType,
          {
            title: string;
            email?: { subject: string };
            data?: {
              subscription_id: string;
              plan_id: string;
            };
          },
        ]
      | undefined;

    expect(expiredDispatchArgs?.[0]).toBe('user-1');
    expect(expiredDispatchArgs?.[1]).toBe(
      NotificationType.subscription_expired,
    );
    expect(expiredDispatchArgs?.[2].title).toBe(
      'Monthly Membership has expired',
    );
    expect(expiredDispatchArgs?.[2].email?.subject).toBe(
      'Monthly Membership has expired',
    );
    expect(expiredDispatchArgs?.[2].data).toEqual(
      expect.objectContaining({
        subscription_id: 'sub-1',
        plan_id: 'plan-1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      SUBSCRIPTION_EXPIRED_EVENT,
      expect.objectContaining({
        subscriptionId: 'sub-1',
        userId: 'user-1',
        planId: 'plan-1',
        previousStatus: 'past_due',
      }),
    );
  });

  it('dispatches payment_confirmed through notifications when the subscription payment completes', async () => {
    repo.findSubscriptionNotificationContextByIdOrThrow.mockResolvedValue({
      id: 'sub-1',
      expires_at: new Date('2026-04-20T00:00:00.000Z'),
      plan: { id: 'plan-1', name: 'Monthly Membership' },
      user: {
        id: 'user-1',
        auth_identities: [
          {
            identifier: 'member@example.com',
            provider: 'email',
          },
        ],
        notification_prefs: {
          payment_confirmed_email: true,
        },
        profile: {
          first_name: 'Jamie',
          last_name: 'Rivera',
        },
      },
    });

    await service.handlePaymentConfirmedNotification({
      paymentId: 'payment-1',
      userId: 'member-1',
      payableType: 'subscription',
      payableId: 'sub-1',
      amount: '1499',
    });

    const paymentDispatchArgs = notificationsService.dispatch.mock.calls[0] as
      | [
          string,
          NotificationType,
          {
            title: string;
            email?: { subject: string };
            data?: {
              subscription_id: string;
              plan_id: string;
              payment_id: string;
              amount: string;
            };
          },
        ]
      | undefined;

    expect(paymentDispatchArgs?.[0]).toBe('user-1');
    expect(paymentDispatchArgs?.[1]).toBe(NotificationType.payment_confirmed);
    expect(paymentDispatchArgs?.[2].title).toBe('Payment confirmed');
    expect(paymentDispatchArgs?.[2].email?.subject).toBe(
      'Payment confirmed for Monthly Membership',
    );
    expect(paymentDispatchArgs?.[2].data).toEqual(
      expect.objectContaining({
        subscription_id: 'sub-1',
        plan_id: 'plan-1',
        payment_id: 'payment-1',
        amount: '1499',
      }),
    );
  });
});
