import {
  ChatContext,
  NotificationType,
  PayableType,
  UserRole,
} from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';

import type { NotificationDispatchPayload } from './notification-dispatch.types';
import { NotificationDomainEventsListener } from './notification-domain-events.listener';
import { NotificationsService } from './notifications.service';

describe('NotificationDomainEventsListener', () => {
  let listener: NotificationDomainEventsListener;

  const notificationsService = {
    dispatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDomainEventsListener,
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    listener = module.get<NotificationDomainEventsListener>(
      NotificationDomainEventsListener,
    );
    jest.clearAllMocks();
  });

  it('dispatches welcome notices for registered users through the system path', async () => {
    await listener.handleUserRegistered({
      userId: 'user-1',
      role: UserRole.member,
      source: 'email_verification',
      registeredAt: '2026-03-28T08:00:00.000Z',
    });

    const dispatchCalls = notificationsService.dispatch.mock.calls as Array<
      [string, NotificationType, NotificationDispatchPayload]
    >;

    expect(dispatchCalls[0]?.[0]).toBe('user-1');
    expect(dispatchCalls[0]?.[1]).toBe(NotificationType.system);
    expect(dispatchCalls[0]?.[2].title).toBe('Welcome to FitTrack');
    expect((dispatchCalls[0]?.[2].data as Record<string, unknown>).source).toBe(
      'email_verification',
    );
  });

  it('dispatches TDEE recalculation notices through the system path', async () => {
    await listener.handleTdeeRecalculated({
      userId: 'user-1',
      tdeeProfileId: 'tdee-1',
      macroTargetId: 'macro-1',
      recalculatedAt: '2026-03-28T08:00:00.000Z',
    });

    const dispatchCalls = notificationsService.dispatch.mock.calls as Array<
      [string, NotificationType, NotificationDispatchPayload]
    >;

    expect(dispatchCalls[0]?.[0]).toBe('user-1');
    expect(dispatchCalls[0]?.[1]).toBe(NotificationType.system);
    expect(dispatchCalls[0]?.[2].title).toBe('Nutrition targets updated');
    expect(
      (dispatchCalls[0]?.[2].data as Record<string, unknown>).tdee_profile_id,
    ).toBe('tdee-1');
  });

  it('dispatches archived AI session notices through the dedicated preference path', async () => {
    await listener.handleAiSessionArchived({
      userId: 'user-1',
      sessionId: 'session-1',
      contextType: ChatContext.nutrition,
      archivedAt: '2026-03-28T08:00:00.000Z',
    });

    const dispatchCalls = notificationsService.dispatch.mock.calls as Array<
      [string, NotificationType, NotificationDispatchPayload]
    >;

    expect(dispatchCalls[0]?.[0]).toBe('user-1');
    expect(dispatchCalls[0]?.[1]).toBe(NotificationType.ai_session_archived);
    expect(dispatchCalls[0]?.[2].title).toBe('AI chat session archived');
    expect(
      (dispatchCalls[0]?.[2].data as Record<string, unknown>).session_id,
    ).toBe('session-1');
  });

  it('dispatches payment failure notices through the payment_failed path', async () => {
    await listener.handlePaymentFailed({
      userId: 'user-1',
      paymentId: 'payment-1',
      payableType: PayableType.subscription,
      payableId: 'sub-1',
      amount: '1499',
      reason: 'Receipt was unreadable.',
      failedAt: '2026-03-28T08:00:00.000Z',
    });

    const dispatchCalls = notificationsService.dispatch.mock.calls as Array<
      [string, NotificationType, NotificationDispatchPayload]
    >;

    expect(dispatchCalls[0]?.[0]).toBe('user-1');
    expect(dispatchCalls[0]?.[1]).toBe(NotificationType.payment_failed);
    expect(dispatchCalls[0]?.[2].title).toBe('Payment failed');
    expect(
      (dispatchCalls[0]?.[2].data as Record<string, unknown>).payment_id,
    ).toBe('payment-1');
  });
});
