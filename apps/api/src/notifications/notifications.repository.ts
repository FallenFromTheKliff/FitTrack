import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Notification,
  NotificationChannel,
  NotificationPreference,
  NotificationStatus,
  NotificationType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationFilterDTO } from './dto/notification.dto';

interface DispatchNotificationWriteInput {
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Prisma.JsonValue | null;
  status: NotificationStatus;
  sent_at?: Date | null;
  read_at?: Date | null;
  error?: string | null;
}

export type ManagementNotificationRecipient = {
  user_id: string;
};

@Injectable()
export class NotificationsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listOwnedInAppNotifications(
    userId: string,
    dto: NotificationFilterDTO,
  ): Promise<PaginatedResult<Notification>> {
    return this.paginateByUserId<Notification>(
      this.prisma.notification,
      userId,
      {
        additionalWhere: {
          channel: NotificationChannel.in_app,
          ...(dto.unread_only ? { read_at: null } : {}),
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  countOwnedUnreadInAppNotifications(userId: string): Promise<number> {
    return this.count(this.prisma.notification, {
      user_id: userId,
      channel: NotificationChannel.in_app,
      read_at: null,
    });
  }

  findNotificationPrefsOrThrow(
    userId: string,
  ): Promise<NotificationPreference> {
    return this.findUniqueWhereOrThrow<NotificationPreference>(
      this.prisma.notificationPreference,
      { user_id: userId },
      'NotificationPreference',
    );
  }

  updateNotificationPrefs(
    userId: string,
    data: Prisma.NotificationPreferenceUpdateInput,
  ): Promise<NotificationPreference> {
    return this.updateOneOrThrow<NotificationPreference>(
      this.prisma.notificationPreference,
      { user_id: userId },
      data,
      'NotificationPreference',
    );
  }

  createDispatchNotifications(
    userId: string,
    type: NotificationType,
    notifications: DispatchNotificationWriteInput[],
  ): Promise<Notification[]> {
    return this.transaction(async (tx) => {
      const created: Notification[] = [];

      for (const notification of notifications) {
        const data = this.toNotificationDataInput(notification.data);

        created.push(
          await tx.notification.create({
            data: {
              user_id: userId,
              type,
              channel: notification.channel,
              title: notification.title,
              body: notification.body,
              status: notification.status,
              ...(data !== undefined ? { data } : {}),
              ...(notification.sent_at
                ? { sent_at: notification.sent_at }
                : {}),
              ...(notification.read_at
                ? { read_at: notification.read_at }
                : {}),
              ...(notification.error ? { error: notification.error } : {}),
            },
          }),
        );
      }

      return created;
    });
  }

  async markOwnedInAppNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<Notification> {
    const notification = await this.findOwnedInAppNotificationByIdOrThrow(
      userId,
      notificationId,
    );

    if (notification.read_at) {
      return notification;
    }

    return this.updateById<Notification>(
      this.prisma.notification,
      notificationId,
      {
        read_at: new Date(),
        status: NotificationStatus.read,
      },
    );
  }

  markNotificationSent(notificationId: string): Promise<Notification> {
    return this.updateById<Notification>(
      this.prisma.notification,
      notificationId,
      {
        status: NotificationStatus.sent,
        sent_at: new Date(),
        error: null,
      },
    );
  }

  markNotificationFailed(
    notificationId: string,
    error: string,
  ): Promise<Notification> {
    return this.updateById<Notification>(
      this.prisma.notification,
      notificationId,
      {
        status: NotificationStatus.failed,
        error,
        sent_at: null,
      },
    );
  }

  async deleteOwnedInAppNotification(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    await this.findOwnedInAppNotificationByIdOrThrow(userId, notificationId);
    await this.deleteById(this.prisma.notification, notificationId);
  }

  async deleteAllOwnedInAppNotifications(userId: string): Promise<number> {
    const result = await this.deleteMany(this.prisma.notification, {
      user_id: userId,
      channel: NotificationChannel.in_app,
    });

    return result.count;
  }

  async listManagementNotificationRecipients(): Promise<
    ManagementNotificationRecipient[]
  > {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.admin, UserRole.staff] },
        status: UserStatus.active,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    return users.map((user) => ({ user_id: user.id }));
  }

  async markAllOwnedInAppNotificationsRead(userId: string): Promise<number> {
    const result = await this.updateMany(
      this.prisma.notification,
      {
        user_id: userId,
        channel: NotificationChannel.in_app,
        read_at: null,
      },
      {
        read_at: new Date(),
        status: NotificationStatus.read,
      },
    );

    return result.count;
  }

  private async findOwnedInAppNotificationByIdOrThrow(
    userId: string,
    notificationId: string,
  ): Promise<Notification> {
    const notification = await this.findByIdAndAssertOwnership<Notification>(
      this.prisma.notification,
      notificationId,
      userId,
      'Notification',
    );

    if (notification.channel !== NotificationChannel.in_app) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'Notification Not Found',
        status: 404,
        detail: `In-app notification with id "${notificationId}" does not exist.`,
      });
    }

    return notification;
  }

  private toNotificationDataInput(
    data: Prisma.JsonValue | null | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (data === undefined || data === null) {
      return undefined;
    }

    return data as Prisma.InputJsonValue;
  }
}
