import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';

import { NotificationsRepository } from './notifications.repository';

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
    subscription_expiring_sms: false,
    subscription_expired_email: true,
    booking_confirmed_email: true,
    booking_confirmed_sms: false,
    booking_cancelled_email: true,
    venue_booking_reminder_email: true,
    venue_booking_reminder_sms: false,
    booking_no_show_email: true,
    appointment_confirmed_email: true,
    appointment_confirmed_sms: false,
    coach_appointment_reminder_email: true,
    coach_appointment_reminder_sms: false,
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

describe('NotificationsRepository', () => {
  type NotificationDelegateMock = {
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
  };

  type NotificationPreferenceDelegateMock = {
    findUnique: jest.Mock;
    update: jest.Mock;
  };

  const notification = {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  } satisfies NotificationDelegateMock;

  const notificationPreference = {
    findUnique: jest.fn(),
    update: jest.fn(),
  } satisfies NotificationPreferenceDelegateMock;

  type PrismaMock = {
    notification: NotificationDelegateMock;
    notificationPreference: NotificationPreferenceDelegateMock;
    $transaction: jest.Mock<
      Promise<unknown>,
      [
        (
          callback: (tx: {
            notification: NotificationDelegateMock;
          }) => Promise<unknown>,
        ) => Promise<unknown>,
      ]
    >;
  };

  const prisma: PrismaMock = {
    notification,
    notificationPreference,
    $transaction: jest.fn(
      async (
        callback: (tx: {
          notification: NotificationDelegateMock;
        }) => Promise<unknown>,
      ) => callback({ notification }),
    ),
  };

  let repo: NotificationsRepository;

  beforeEach(() => {
    repo = new NotificationsRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists owned in-app notifications with unread filtering and recent-first ordering', async () => {
    notification.findMany.mockResolvedValue([createNotificationRecord()]);
    notification.count.mockResolvedValue(1);

    await repo.listOwnedInAppNotifications('user-1', {
      unread_only: true,
      page: 2,
      limit: 5,
    });

    expect(notification.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        channel: NotificationChannel.in_app,
        read_at: null,
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      include: undefined,
      select: undefined,
      skip: 5,
      take: 5,
    });
    expect(notification.count).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        channel: NotificationChannel.in_app,
        read_at: null,
      },
    });
  });

  it('counts unread owned in-app notifications', async () => {
    notification.count.mockResolvedValue(3);

    await expect(
      repo.countOwnedUnreadInAppNotifications('user-1'),
    ).resolves.toBe(3);

    expect(notification.count).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        channel: NotificationChannel.in_app,
        read_at: null,
      },
    });
  });

  it('loads notification preferences by user ownership key', async () => {
    notificationPreference.findUnique.mockResolvedValue(
      createPreferenceRecord(),
    );

    await expect(repo.findNotificationPrefsOrThrow('user-1')).resolves.toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        payment_failed_email: true,
      }),
    );

    expect(notificationPreference.findUnique).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      include: undefined,
    });
  });

  it('updates notification preferences by user ownership key', async () => {
    notificationPreference.update.mockResolvedValue(
      createPreferenceRecord({
        booking_cancelled_email: false,
        ai_session_archived_email: false,
      }),
    );

    await expect(
      repo.updateNotificationPrefs('user-1', {
        booking_cancelled_email: false,
        ai_session_archived_email: false,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        booking_cancelled_email: false,
        ai_session_archived_email: false,
      }),
    );

    expect(notificationPreference.update).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      data: {
        booking_cancelled_email: false,
        ai_session_archived_email: false,
      },
      include: undefined,
    });
  });

  it('creates persisted dispatch notifications in one transaction', async () => {
    notification.create
      .mockResolvedValueOnce(
        createNotificationRecord({
          id: 'notif-in-app',
          status: NotificationStatus.sent,
          channel: NotificationChannel.in_app,
          sent_at: new Date('2026-03-28T07:00:00.000Z'),
        }),
      )
      .mockResolvedValueOnce(
        createNotificationRecord({
          id: 'notif-email',
          channel: NotificationChannel.email,
        }),
      );

    await expect(
      repo.createDispatchNotifications('user-1', NotificationType.system, [
        {
          channel: NotificationChannel.in_app,
          title: 'System notice',
          body: 'A new system notice is available.',
          data: { severity: 'info' },
          status: NotificationStatus.sent,
          sent_at: new Date('2026-03-28T07:00:00.000Z'),
        },
        {
          channel: NotificationChannel.email,
          title: 'System notice',
          body: 'A new system notice is available.',
          status: NotificationStatus.pending,
        },
      ]),
    ).resolves.toHaveLength(2);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const firstCreateArgs = notification.create.mock.calls[0] as
      | [
          {
            data: {
              user_id: string;
              type: NotificationType;
              channel: NotificationChannel;
              title: string;
              status: NotificationStatus;
              sent_at?: Date;
            };
          },
        ]
      | undefined;
    const secondCreateArgs = notification.create.mock.calls[1] as
      | [
          {
            data: {
              user_id: string;
              type: NotificationType;
              channel: NotificationChannel;
              title: string;
              status: NotificationStatus;
            };
          },
        ]
      | undefined;

    expect(firstCreateArgs?.[0].data).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        type: NotificationType.system,
        channel: NotificationChannel.in_app,
        title: 'System notice',
        status: NotificationStatus.sent,
        sent_at: new Date('2026-03-28T07:00:00.000Z'),
      }),
    );
    expect(secondCreateArgs?.[0].data).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        type: NotificationType.system,
        channel: NotificationChannel.email,
        title: 'System notice',
        status: NotificationStatus.pending,
      }),
    );
  });

  it('marks one owned unread in-app notification as read', async () => {
    notification.findUnique.mockResolvedValue(createNotificationRecord());
    notification.update.mockResolvedValue(
      createNotificationRecord({
        status: NotificationStatus.read,
        read_at: new Date('2026-03-28T05:00:00.000Z'),
      }),
    );

    await repo.markOwnedInAppNotificationRead('user-1', 'notif-1');

    expect(notification.findUnique).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      include: undefined,
    });
    const updateArgs = notification.update.mock.calls[0] as
      | [
          {
            where: { id: string };
            data: { status: NotificationStatus; read_at: Date };
          },
        ]
      | undefined;

    expect(updateArgs?.[0].where).toEqual({
      id: 'notif-1',
    });
    expect(updateArgs?.[0].data.status).toBe(NotificationStatus.read);
    expect(updateArgs?.[0].data.read_at).toBeInstanceOf(Date);
  });

  it('treats already-read notifications as a safe no-op', async () => {
    const record = createNotificationRecord({
      status: NotificationStatus.read,
      read_at: new Date('2026-03-28T05:00:00.000Z'),
    });
    notification.findUnique.mockResolvedValue(record);

    await expect(
      repo.markOwnedInAppNotificationRead('user-1', 'notif-1'),
    ).resolves.toEqual(record);
    expect(notification.update).not.toHaveBeenCalled();
  });

  it('marks all unread owned in-app notifications as read and returns the count', async () => {
    notification.updateMany.mockResolvedValue({ count: 4 });

    await expect(
      repo.markAllOwnedInAppNotificationsRead('user-1'),
    ).resolves.toBe(4);

    const updateManyArgs = notification.updateMany.mock.calls[0] as
      | [
          {
            where: {
              user_id: string;
              channel: NotificationChannel;
              read_at: null;
            };
            data: { status: NotificationStatus; read_at: Date };
          },
        ]
      | undefined;

    expect(updateManyArgs?.[0].where).toEqual({
      user_id: 'user-1',
      channel: NotificationChannel.in_app,
      read_at: null,
    });
    expect(updateManyArgs?.[0].data.status).toBe(NotificationStatus.read);
    expect(updateManyArgs?.[0].data.read_at).toBeInstanceOf(Date);
  });

  it('deletes only owned in-app notifications after the ownership check passes', async () => {
    notification.findUnique.mockResolvedValue(createNotificationRecord());
    notification.delete.mockResolvedValue({ id: 'notif-1' });

    await repo.deleteOwnedInAppNotification('user-1', 'notif-1');

    expect(notification.findUnique).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      include: undefined,
    });
    expect(notification.delete).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
    });
  });

  it('marks persisted notification deliveries as sent', async () => {
    notification.update.mockResolvedValue(
      createNotificationRecord({
        id: 'notif-email',
        channel: NotificationChannel.email,
        status: NotificationStatus.sent,
        sent_at: new Date('2026-03-28T09:00:00.000Z'),
      }),
    );

    await repo.markNotificationSent('notif-email');

    const sentUpdateArgs = notification.update.mock.calls[0] as
      | [
          {
            where: { id: string };
            data: {
              status: NotificationStatus;
              sent_at: Date;
              error: null;
            };
            include?: undefined;
          },
        ]
      | undefined;

    expect(sentUpdateArgs).toBeDefined();
    expect(sentUpdateArgs?.[0].where).toEqual({ id: 'notif-email' });
    expect(sentUpdateArgs?.[0].data.status).toBe(NotificationStatus.sent);
    expect(sentUpdateArgs?.[0].data.sent_at).toBeInstanceOf(Date);
    expect(sentUpdateArgs?.[0].data.error).toBeNull();
    expect(sentUpdateArgs?.[0].include).toBeUndefined();
  });

  it('marks persisted notification deliveries as failed', async () => {
    notification.update.mockResolvedValue(
      createNotificationRecord({
        id: 'notif-sms',
        channel: NotificationChannel.sms,
        status: NotificationStatus.failed,
        error: 'Provider timeout',
      }),
    );

    await repo.markNotificationFailed('notif-sms', 'Provider timeout');

    const failedUpdateArgs = notification.update.mock.calls[0] as
      | [
          {
            where: { id: string };
            data: {
              status: NotificationStatus;
              error: string;
              sent_at: null;
            };
            include?: undefined;
          },
        ]
      | undefined;

    expect(failedUpdateArgs).toBeDefined();
    expect(failedUpdateArgs?.[0].where).toEqual({ id: 'notif-sms' });
    expect(failedUpdateArgs?.[0].data.status).toBe(NotificationStatus.failed);
    expect(failedUpdateArgs?.[0].data.error).toBe('Provider timeout');
    expect(failedUpdateArgs?.[0].data.sent_at).toBeNull();
    expect(failedUpdateArgs?.[0].include).toBeUndefined();
  });
});
