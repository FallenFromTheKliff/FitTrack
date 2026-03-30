import { getQueueToken } from '@nestjs/bull';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';

import { QUEUE_MAIL, QUEUE_SMS } from '../queue/queue.constants';
import { UserService } from '../user/user.service';
import type {
  NotificationDeliveryFailedEvent,
  NotificationDeliverySentEvent,
} from './notification-delivery.events';
import type { NotificationDispatchPayload } from './notification-dispatch.types';
import type { NotificationFilterDTO } from './dto/notification.dto';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

function createNotificationRecord(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id: 'notif-1',
    user_id: 'user-1',
    type: NotificationType.subscription_expiring,
    channel: NotificationChannel.in_app,
    title: 'Subscription expiring soon',
    body: 'Your membership expires in 3 days.',
    data: { days_remaining: 3 },
    status: NotificationStatus.pending,
    sent_at: null,
    read_at: null,
    error: null,
    created_at: new Date('2026-03-28T02:00:00.000Z'),
    updated_at: new Date('2026-03-28T03:00:00.000Z'),
    ...overrides,
  };
}

function createPreferenceRecord(
  overrides: Partial<Record<string, boolean>> = {},
) {
  return {
    id: 'pref-1',
    user_id: 'user-1',
    subscription_expiring_email: true,
    subscription_expiring_sms: true,
    subscription_expired_email: true,
    booking_confirmed_email: true,
    booking_confirmed_sms: false,
    booking_cancelled_email: true,
    booking_no_show_email: true,
    appointment_confirmed_email: true,
    appointment_confirmed_sms: false,
    appointment_completed_email: true,
    appointment_cancelled_email: true,
    rank_up_email: true,
    payment_confirmed_email: true,
    payment_failed_email: true,
    ai_session_archived_email: true,
    system_email: true,
    created_at: new Date('2026-03-28T01:00:00.000Z'),
    updated_at: new Date('2026-03-28T01:30:00.000Z'),
    ...overrides,
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;

  const repo = {
    createDispatchNotifications: jest.fn(),
    listOwnedInAppNotifications: jest.fn(),
    countOwnedUnreadInAppNotifications: jest.fn(),
    findNotificationPrefsOrThrow: jest.fn(),
    updateNotificationPrefs: jest.fn(),
    markOwnedInAppNotificationRead: jest.fn(),
    markAllOwnedInAppNotificationsRead: jest.fn(),
    deleteOwnedInAppNotification: jest.fn(),
    markNotificationSent: jest.fn(),
    markNotificationFailed: jest.fn(),
  };

  const userService = {
    getNotificationDispatchContext: jest.fn(),
  };

  const mailQueue = {
    add: jest.fn(),
  };

  const smsQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: repo },
        { provide: UserService, useValue: userService },
        { provide: getQueueToken(QUEUE_MAIL), useValue: mailQueue },
        { provide: getQueueToken(QUEUE_SMS), useValue: smsQueue },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  it('maps paginated inbox notifications into response DTOs', async () => {
    repo.listOwnedInAppNotifications.mockResolvedValue({
      data: [createNotificationRecord()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(
      service.getMyNotifications('user-1', {
        unread_only: true,
        page: 1,
        limit: 20,
      } satisfies NotificationFilterDTO),
    ).resolves.toEqual({
      data: [
        {
          id: 'notif-1',
          type: NotificationType.subscription_expiring,
          channel: NotificationChannel.in_app,
          title: 'Subscription expiring soon',
          body: 'Your membership expires in 3 days.',
          data: { days_remaining: 3 },
          status: NotificationStatus.pending,
          sent_at: null,
          read_at: null,
          error: null,
          created_at: '2026-03-28T02:00:00.000Z',
          updated_at: '2026-03-28T03:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    expect(repo.listOwnedInAppNotifications).toHaveBeenCalledWith('user-1', {
      unread_only: true,
      page: 1,
      limit: 20,
    });
  });

  it('returns the unread count through the repository', async () => {
    repo.countOwnedUnreadInAppNotifications.mockResolvedValue(5);

    await expect(service.getUnreadCount('user-1')).resolves.toEqual({
      count: 5,
    });
  });

  it('returns notification preferences through the notifications repository', async () => {
    repo.findNotificationPrefsOrThrow.mockResolvedValue(
      createPreferenceRecord(),
    );

    await expect(service.getPreferences('user-1')).resolves.toEqual(
      expect.objectContaining({
        subscription_expiring_email: true,
        subscription_expired_email: true,
        booking_cancelled_email: true,
        appointment_completed_email: true,
        payment_failed_email: true,
        ai_session_archived_email: true,
      }),
    );
    expect(repo.findNotificationPrefsOrThrow).toHaveBeenCalledWith('user-1');
  });

  it('updates notification preferences through the notifications repository', async () => {
    repo.updateNotificationPrefs.mockResolvedValue(
      createPreferenceRecord({
        payment_failed_email: false,
        booking_cancelled_email: false,
      }),
    );

    await expect(
      service.updatePreferences('user-1', {
        payment_failed_email: false,
        booking_cancelled_email: false,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        payment_failed_email: false,
        booking_cancelled_email: false,
      }),
    );
    expect(repo.updateNotificationPrefs).toHaveBeenCalledWith('user-1', {
      payment_failed_email: false,
      booking_cancelled_email: false,
    });
  });

  it('marks a notification as read and maps the response payload', async () => {
    repo.markOwnedInAppNotificationRead.mockResolvedValue(
      createNotificationRecord({
        status: NotificationStatus.read,
        read_at: new Date('2026-03-28T05:00:00.000Z'),
      }),
    );

    await expect(service.markRead('user-1', 'notif-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'notif-1',
        status: NotificationStatus.read,
        read_at: '2026-03-28T05:00:00.000Z',
      }),
    );
  });

  it('returns the updated count for mark-all-read operations', async () => {
    repo.markAllOwnedInAppNotificationsRead.mockResolvedValue(4);

    await expect(service.markAllRead('user-1')).resolves.toEqual({
      updated_count: 4,
    });
  });

  it('delegates notification deletion to the repository', async () => {
    repo.deleteOwnedInAppNotification.mockResolvedValue(undefined);

    await service.deleteNotification('user-1', 'notif-1');

    expect(repo.deleteOwnedInAppNotification).toHaveBeenCalledWith(
      'user-1',
      'notif-1',
    );
  });

  it('dispatches in-app, email, and sms notifications using contact context plus persisted preferences', async () => {
    userService.getNotificationDispatchContext.mockResolvedValue({
      user_id: 'user-1',
      preferred_email: 'fit@example.com',
      preferred_phone: '+639171234567',
      phone_verified_at: new Date('2026-03-28T06:00:00.000Z'),
    });
    repo.findNotificationPrefsOrThrow.mockResolvedValue(
      createPreferenceRecord(),
    );
    repo.createDispatchNotifications.mockResolvedValue([
      createNotificationRecord({
        id: 'notif-in-app',
        status: NotificationStatus.sent,
        sent_at: new Date('2026-03-28T07:00:00.000Z'),
      }),
      createNotificationRecord({
        id: 'notif-email',
        channel: NotificationChannel.email,
      }),
      createNotificationRecord({
        id: 'notif-sms',
        channel: NotificationChannel.sms,
      }),
    ]);

    const payload: NotificationDispatchPayload = {
      title: 'Subscription expiring soon',
      body: 'Your membership expires in 3 days.',
      data: { days_remaining: 3 },
      email: {
        subject: 'Subscription expires in 3 days',
        html: '<p>Your membership expires in 3 days.</p>',
      },
      sms: {
        body: 'FitTrack: your membership expires in 3 days.',
      },
    };

    await service.dispatch(
      'user-1',
      NotificationType.subscription_expiring,
      payload,
    );

    expect(repo.findNotificationPrefsOrThrow).toHaveBeenCalledWith('user-1');
    expect(repo.createDispatchNotifications).toHaveBeenCalledWith(
      'user-1',
      NotificationType.subscription_expiring,
      [
        expect.objectContaining({
          channel: NotificationChannel.in_app,
          title: 'Subscription expiring soon',
          status: NotificationStatus.sent,
        }),
        expect.objectContaining({
          channel: NotificationChannel.email,
          title: 'Subscription expires in 3 days',
          status: NotificationStatus.pending,
        }),
        expect.objectContaining({
          channel: NotificationChannel.sms,
          body: 'FitTrack: your membership expires in 3 days.',
          status: NotificationStatus.pending,
        }),
      ],
    );
    expect(mailQueue.add).toHaveBeenCalledWith(
      'send-generic',
      expect.objectContaining({
        to: 'fit@example.com',
        subject: 'Subscription expires in 3 days',
        notification: { notification_id: 'notif-email' },
      }),
      expect.anything(),
    );
    expect(smsQueue.add).toHaveBeenCalledWith(
      'send-generic',
      expect.objectContaining({
        to: '+639171234567',
        body: 'FitTrack: your membership expires in 3 days.',
        notification: { notification_id: 'notif-sms' },
      }),
      expect.anything(),
    );
  });

  it('respects newly added email preference toggles for supported notification types', async () => {
    userService.getNotificationDispatchContext.mockResolvedValue({
      user_id: 'user-1',
      preferred_email: 'fit@example.com',
      preferred_phone: null,
      phone_verified_at: null,
    });
    repo.findNotificationPrefsOrThrow.mockResolvedValue(
      createPreferenceRecord({
        payment_failed_email: false,
      }),
    );
    repo.createDispatchNotifications.mockResolvedValue([
      createNotificationRecord({
        id: 'notif-in-app',
        type: NotificationType.payment_failed,
        status: NotificationStatus.sent,
        sent_at: new Date('2026-03-28T07:00:00.000Z'),
      }),
    ]);

    await service.dispatch('user-1', NotificationType.payment_failed, {
      title: 'Payment failed',
      body: 'We could not process your renewal payment.',
      email: {
        subject: 'Payment failed',
        html: '<p>We could not process your renewal payment.</p>',
      },
    });

    expect(repo.createDispatchNotifications).toHaveBeenCalledWith(
      'user-1',
      NotificationType.payment_failed,
      [expect.objectContaining({ channel: NotificationChannel.in_app })],
    );
    expect(mailQueue.add).not.toHaveBeenCalled();
  });

  it('uses system email gating for admin-only notification types', async () => {
    userService.getNotificationDispatchContext.mockResolvedValue({
      user_id: 'user-1',
      preferred_email: 'fit@example.com',
      preferred_phone: '+639171234567',
      phone_verified_at: new Date('2026-03-28T06:00:00.000Z'),
    });
    repo.findNotificationPrefsOrThrow.mockResolvedValue(
      createPreferenceRecord(),
    );
    repo.createDispatchNotifications.mockResolvedValue([
      createNotificationRecord({
        id: 'notif-in-app',
        type: NotificationType.low_stock,
        status: NotificationStatus.sent,
        sent_at: new Date('2026-03-28T07:00:00.000Z'),
      }),
      createNotificationRecord({
        id: 'notif-email',
        channel: NotificationChannel.email,
        type: NotificationType.low_stock,
        status: NotificationStatus.pending,
      }),
    ]);

    await service.dispatch('user-1', NotificationType.low_stock, {
      title: 'Low stock alert',
      body: 'Protein bars are running low.',
      email: {
        subject: 'Low stock alert',
        html: '<p>Protein bars are running low.</p>',
      },
      sms: {
        body: 'Protein bars are running low.',
      },
    });

    expect(repo.createDispatchNotifications).toHaveBeenCalledWith(
      'user-1',
      NotificationType.low_stock,
      [
        expect.objectContaining({ channel: NotificationChannel.in_app }),
        expect.objectContaining({ channel: NotificationChannel.email }),
      ],
    );
    expect(mailQueue.add).toHaveBeenCalledWith(
      'send-generic',
      expect.objectContaining({
        to: 'fit@example.com',
        subject: 'Low stock alert',
      }),
      expect.anything(),
    );
    expect(smsQueue.add).not.toHaveBeenCalled();
  });

  it('marks persisted deliveries as sent when processors acknowledge success', async () => {
    repo.markNotificationSent.mockResolvedValue(
      createNotificationRecord({
        id: 'notif-email',
        channel: NotificationChannel.email,
        status: NotificationStatus.sent,
      }),
    );

    await service.handleNotificationDeliverySent({
      notificationId: 'notif-email',
      channel: NotificationChannel.email,
    } satisfies NotificationDeliverySentEvent);

    expect(repo.markNotificationSent).toHaveBeenCalledWith('notif-email');
  });

  it('marks persisted deliveries as failed when processors report terminal failure', async () => {
    repo.markNotificationFailed.mockResolvedValue(
      createNotificationRecord({
        id: 'notif-sms',
        channel: NotificationChannel.sms,
        status: NotificationStatus.failed,
        error: 'Provider timeout',
      }),
    );

    await service.handleNotificationDeliveryFailed({
      notificationId: 'notif-sms',
      channel: NotificationChannel.sms,
      error: 'Provider timeout',
    } satisfies NotificationDeliveryFailedEvent);

    expect(repo.markNotificationFailed).toHaveBeenCalledWith(
      'notif-sms',
      'Provider timeout',
    );
  });

  it('marks a persisted delivery as failed if queue enqueueing throws after commit', async () => {
    userService.getNotificationDispatchContext.mockResolvedValue({
      user_id: 'user-1',
      preferred_email: 'fit@example.com',
      preferred_phone: null,
      phone_verified_at: null,
    });
    repo.findNotificationPrefsOrThrow.mockResolvedValue(
      createPreferenceRecord(),
    );
    repo.createDispatchNotifications.mockResolvedValue([
      createNotificationRecord({
        id: 'notif-in-app',
        status: NotificationStatus.sent,
        sent_at: new Date('2026-03-28T07:00:00.000Z'),
      }),
      createNotificationRecord({
        id: 'notif-email',
        channel: NotificationChannel.email,
      }),
    ]);
    mailQueue.add.mockRejectedValue(new Error('Queue offline'));

    await service.dispatch('user-1', NotificationType.system, {
      title: 'System notice',
      body: 'A new system notice is available.',
      email: {
        subject: 'System notice',
        html: '<p>A new system notice is available.</p>',
      },
    });

    expect(repo.markNotificationFailed).toHaveBeenCalledWith(
      'notif-email',
      'Queue offline',
    );
  });
});
