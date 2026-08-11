import { GUARDS_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsController } from './notifications.controller';

function getMethodGuardMetadata(
  methodName:
    | 'getPreferences'
    | 'updatePreferences'
    | 'getMyNotifications'
    | 'getUnreadCount'
    | 'markAllRead'
    | 'markRead'
    | 'deleteAllNotifications'
    | 'deleteNotification',
): unknown[] | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(
    NotificationsController.prototype,
    methodName,
  );

  return Reflect.getMetadata(GUARDS_METADATA, descriptor?.value as object) as
    | unknown[]
    | undefined;
}

function getClassGuardMetadata(): unknown[] | undefined {
  return Reflect.getMetadata(GUARDS_METADATA, NotificationsController) as
    | unknown[]
    | undefined;
}

describe('NotificationsController', () => {
  const notificationsService = {
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    getMyNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    deleteAllNotifications: jest.fn(),
    deleteNotification: jest.fn(),
  };

  let controller: NotificationsController;

  beforeEach(() => {
    controller = new NotificationsController(notificationsService as never);
    jest.clearAllMocks();
  });

  it('protects the controller with JWT auth', () => {
    expect(getClassGuardMetadata()).toEqual([JwtAuthGuard]);
  });

  it.each([
    'getPreferences',
    'updatePreferences',
    'getMyNotifications',
    'getUnreadCount',
    'markAllRead',
    'markRead',
    'deleteAllNotifications',
    'deleteNotification',
  ] as const)('does not duplicate method-level guards for %s', (methodName) => {
    expect(getMethodGuardMetadata(methodName)).toBeUndefined();
  });

  it('loads preferences through the service', async () => {
    notificationsService.getPreferences.mockResolvedValue({
      system_email: true,
    });

    await controller.getPreferences({ sub: 'user-1' } as never);

    expect(notificationsService.getPreferences).toHaveBeenCalledWith('user-1');
  });

  it('updates preferences through the service', async () => {
    notificationsService.updatePreferences.mockResolvedValue({
      payment_failed_email: false,
    });

    await controller.updatePreferences({ sub: 'user-1' } as never, {
      payment_failed_email: false,
    });

    expect(notificationsService.updatePreferences).toHaveBeenCalledWith(
      'user-1',
      { payment_failed_email: false },
    );
  });

  it('lists inbox notifications through the service', async () => {
    notificationsService.getMyNotifications.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.getMyNotifications({ sub: 'user-1' } as never, {
      unread_only: true,
      page: 2,
      limit: 10,
    });

    expect(notificationsService.getMyNotifications).toHaveBeenCalledWith(
      'user-1',
      {
        unread_only: true,
        page: 2,
        limit: 10,
      },
    );
  });

  it('loads unread count through the service', async () => {
    notificationsService.getUnreadCount.mockResolvedValue({ count: 3 });

    await controller.getUnreadCount({ sub: 'user-1' } as never);

    expect(notificationsService.getUnreadCount).toHaveBeenCalledWith('user-1');
  });

  it('marks all notifications as read through the service', async () => {
    notificationsService.markAllRead.mockResolvedValue({ updated_count: 2 });

    await controller.markAllRead({ sub: 'user-1' } as never);

    expect(notificationsService.markAllRead).toHaveBeenCalledWith('user-1');
  });

  it('marks a single notification as read through the service', async () => {
    notificationsService.markRead.mockResolvedValue({ id: 'notif-1' });

    await controller.markRead('11111111-1111-4111-8111-111111111111', {
      sub: 'user-1',
    } as never);

    expect(notificationsService.markRead).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('clears notifications for the authenticated user through the service', async () => {
    notificationsService.deleteAllNotifications.mockResolvedValue({
      deleted_count: 2,
    });

    await expect(
      controller.deleteAllNotifications({ sub: 'user-1' } as never),
    ).resolves.toEqual({ deleted_count: 2 });

    expect(notificationsService.deleteAllNotifications).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('deletes notifications through the service and returns a confirmation message', async () => {
    notificationsService.deleteNotification.mockResolvedValue(undefined);

    await expect(
      controller.deleteNotification('11111111-1111-4111-8111-111111111111', {
        sub: 'user-1',
      } as never),
    ).resolves.toEqual({
      message: 'Notification deleted.',
    });

    expect(notificationsService.deleteNotification).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );
  });
});
