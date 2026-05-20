import {
  ChatContext,
  NotificationType,
  PayableType,
  UserRole,
} from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';

import type { NotificationDispatchPayload } from './notification-dispatch.types';
import { NotificationDomainEventsListener } from './notification-domain-events.listener';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

describe('NotificationDomainEventsListener', () => {
  let listener: NotificationDomainEventsListener;

  const notificationsService = {
    dispatch: jest.fn(),
  };
  const notificationsRepository = {
    listManagementNotificationRecipients: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDomainEventsListener,
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: NotificationsRepository,
          useValue: notificationsRepository,
        },
      ],
    }).compile();

    listener = module.get<NotificationDomainEventsListener>(
      NotificationDomainEventsListener,
    );
    jest.clearAllMocks();
    notificationsRepository.listManagementNotificationRecipients.mockResolvedValue(
      [],
    );
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

  it('dispatches account activity notices to management recipients', async () => {
    notificationsRepository.listManagementNotificationRecipients.mockResolvedValue(
      [{ user_id: 'admin-1' }, { user_id: 'staff-1' }],
    );

    await listener.handleAccountActivity({
      action: 'account_archived',
      actorId: 'actor-1',
      occurredAt: '2026-04-25T08:00:00.000Z',
      targetEmail: 'member@fittrack.test',
      targetName: 'Mina Rivera',
      targetRole: UserRole.member,
      targetUserId: 'member-1',
    });

    const dispatchCalls = notificationsService.dispatch.mock.calls as Array<
      [string, NotificationType, NotificationDispatchPayload]
    >;

    expect(dispatchCalls).toHaveLength(2);
    expect(dispatchCalls[0]?.[0]).toBe('admin-1');
    expect(dispatchCalls[1]?.[0]).toBe('staff-1');
    expect(dispatchCalls[0]?.[1]).toBe(NotificationType.system);
    expect(dispatchCalls[0]?.[2].title).toBe('Account archived: Mina Rivera');
    expect((dispatchCalls[0]?.[2].data as Record<string, unknown>).action).toBe(
      'account_archived',
    );
    expect(
      (dispatchCalls[0]?.[2].data as Record<string, unknown>).target_email,
    ).toBe('member@fittrack.test');
    expect(
      (dispatchCalls[0]?.[2].data as Record<string, unknown>).target_name,
    ).toBe('Mina Rivera');
  });

  it('uses generic manual verification wording for account verification activity', async () => {
    notificationsRepository.listManagementNotificationRecipients.mockResolvedValue(
      [{ user_id: 'admin-1' }],
    );

    await listener.handleAccountActivity({
      action: 'account_verified_non_member',
      actorId: 'actor-1',
      occurredAt: '2026-04-25T08:00:00.000Z',
      targetEmail: 'coach@fittrack.test',
      targetName: 'Kai Santos',
      targetRole: UserRole.coach,
      targetUserId: 'coach-1',
    });

    const dispatchCalls = notificationsService.dispatch.mock.calls as Array<
      [string, NotificationType, NotificationDispatchPayload]
    >;

    expect(dispatchCalls[0]?.[2].title).toBe('Account verified: Kai Santos');
    expect(dispatchCalls[0]?.[2].body).toBe(
      'Kai Santos (coach) was manually verified from the Account Module.',
    );
  });
});
