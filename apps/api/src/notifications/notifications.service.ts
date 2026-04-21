import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  NotificationChannel,
  NotificationPreference,
  NotificationStatus,
  NotificationType,
  type Notification,
} from '@prisma/client';
import type { Queue } from 'bull';

import type { PaginatedResult } from '../common/base-repository/base-repository';
import { QUEUE_MAIL } from '../queue/queue.constants';
import {
  UserService,
  type NotificationDispatchContext,
} from '../user/user.service';
import {
  NotificationFilterDTO,
  MarkAllReadResponseDTO,
  NotificationResponseDTO,
  UnreadCountResponseDTO,
} from './dto/notification.dto';
import {
  NotificationPreferencesResponseDTO,
  UpdateNotificationPreferencesDTO,
} from './dto/notification-preferences.dto';
import {
  NOTIFICATION_DELIVERY_FAILED_EVENT,
  NOTIFICATION_DELIVERY_SENT_EVENT,
  type NotificationDeliveryFailedEvent,
  type NotificationDeliverySentEvent,
} from './notification-delivery.events';
import {
  type NotificationDispatchPayload,
  type QueuedNotificationDelivery,
} from './notification-dispatch.types';
import { NotificationsRepository } from './notifications.repository';

const GENERIC_QUEUE_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: true as const,
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly userService: UserService,
    @InjectQueue(QUEUE_MAIL) private readonly mailQueue: Queue,
  ) {}

  async dispatch(
    userId: string,
    type: NotificationType,
    payload: NotificationDispatchPayload,
  ): Promise<void> {
    const context =
      await this.userService.getNotificationDispatchContext(userId);
    const preferences = await this.repo.findNotificationPrefsOrThrow(userId);
    const plans = this.buildDispatchPlans(type, payload, context, preferences);
    const notifications = await this.repo.createDispatchNotifications(
      userId,
      type,
      plans.map(({ notification }) => notification),
    );

    await Promise.all(
      plans.flatMap((plan, index) => {
        if (!plan.queue) {
          return [];
        }

        return [
          this.enqueueDelivery({
            ...plan.queue,
            notification_id: notifications[index].id,
          }),
        ];
      }),
    );
  }

  async getMyNotifications(
    userId: string,
    dto: NotificationFilterDTO,
  ): Promise<PaginatedResult<NotificationResponseDTO>> {
    const result = await this.repo.listOwnedInAppNotifications(userId, dto);

    return {
      data: result.data.map((notification) =>
        this.toNotificationResponse(notification),
      ),
      meta: result.meta,
    };
  }

  async getUnreadCount(userId: string): Promise<UnreadCountResponseDTO> {
    return {
      count: await this.repo.countOwnedUnreadInAppNotifications(userId),
    };
  }

  async getPreferences(
    userId: string,
  ): Promise<NotificationPreferencesResponseDTO> {
    const preferences = await this.repo.findNotificationPrefsOrThrow(userId);
    return this.toNotificationPreferencesResponse(preferences);
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDTO,
  ): Promise<NotificationPreferencesResponseDTO> {
    const preferences = await this.repo.updateNotificationPrefs(userId, dto);
    return this.toNotificationPreferencesResponse(preferences);
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationResponseDTO> {
    const notification = await this.repo.markOwnedInAppNotificationRead(
      userId,
      notificationId,
    );

    return this.toNotificationResponse(notification);
  }

  async markAllRead(userId: string): Promise<MarkAllReadResponseDTO> {
    return {
      updated_count: await this.repo.markAllOwnedInAppNotificationsRead(userId),
    };
  }

  deleteNotification(userId: string, notificationId: string): Promise<void> {
    return this.repo.deleteOwnedInAppNotification(userId, notificationId);
  }

  @OnEvent(NOTIFICATION_DELIVERY_SENT_EVENT, { async: true })
  handleNotificationDeliverySent(
    event: NotificationDeliverySentEvent,
  ): Promise<Notification> {
    return this.repo.markNotificationSent(event.notificationId);
  }

  @OnEvent(NOTIFICATION_DELIVERY_FAILED_EVENT, { async: true })
  handleNotificationDeliveryFailed(
    event: NotificationDeliveryFailedEvent,
  ): Promise<Notification> {
    return this.repo.markNotificationFailed(event.notificationId, event.error);
  }

  private toNotificationResponse(
    notification: Notification,
  ): NotificationResponseDTO {
    return {
      id: notification.id,
      type: notification.type,
      channel: notification.channel,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? null,
      status: notification.status,
      sent_at: notification.sent_at?.toISOString() ?? null,
      read_at: notification.read_at?.toISOString() ?? null,
      error: notification.error ?? null,
      created_at: notification.created_at.toISOString(),
      updated_at: notification.updated_at.toISOString(),
    };
  }

  private toNotificationPreferencesResponse(
    preferences: NotificationPreference,
  ): NotificationPreferencesResponseDTO {
    return {
      subscription_expiring_email: preferences.subscription_expiring_email,
      subscription_expired_email: preferences.subscription_expired_email,
      booking_confirmed_email: preferences.booking_confirmed_email,
      booking_cancelled_email: preferences.booking_cancelled_email,
      booking_no_show_email: preferences.booking_no_show_email,
      appointment_confirmed_email: preferences.appointment_confirmed_email,
      appointment_completed_email: preferences.appointment_completed_email,
      appointment_cancelled_email: preferences.appointment_cancelled_email,
      rank_up_email: preferences.rank_up_email,
      payment_confirmed_email: preferences.payment_confirmed_email,
      payment_failed_email: preferences.payment_failed_email,
      ai_session_archived_email: preferences.ai_session_archived_email,
      system_email: preferences.system_email,
    };
  }

  private buildDispatchPlans(
    type: NotificationType,
    payload: NotificationDispatchPayload,
    context: NotificationDispatchContext,
    preferences: NotificationPreference,
  ): Array<{
    notification: {
      channel: NotificationChannel;
      title: string;
      body: string;
      data?: NotificationDispatchPayload['data'];
      status: NotificationStatus;
      sent_at?: Date;
    };
    queue?: Omit<QueuedNotificationDelivery, 'notification_id'>;
  }> {
    const dispatchedAt = new Date();
    const plans: Array<{
      notification: {
        channel: NotificationChannel;
        title: string;
        body: string;
        data?: NotificationDispatchPayload['data'];
        status: NotificationStatus;
        sent_at?: Date;
      };
      queue?: Omit<QueuedNotificationDelivery, 'notification_id'>;
    }> = [
      {
        notification: {
          channel: NotificationChannel.in_app,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          status: NotificationStatus.sent,
          sent_at: dispatchedAt,
        },
      },
    ];

    if (
      payload.email &&
      context.preferred_email &&
      this.isEmailDeliveryEnabled(type, preferences)
    ) {
      plans.push({
        notification: {
          channel: NotificationChannel.email,
          title: payload.email.subject,
          body: payload.body,
          data: payload.data,
          status: NotificationStatus.pending,
        },
        queue: {
          channel: NotificationChannel.email,
          destination: context.preferred_email,
          subject: payload.email.subject,
          html: payload.email.html,
        },
      });
    }

    return plans;
  }

  private isEmailDeliveryEnabled(
    type: NotificationType,
    preferences: NotificationPreference,
  ): boolean {
    switch (type) {
      case NotificationType.subscription_expiring:
        return preferences.subscription_expiring_email;
      case NotificationType.subscription_expired:
        return preferences.subscription_expired_email;
      case NotificationType.booking_confirmed:
        return preferences.booking_confirmed_email;
      case NotificationType.booking_cancelled:
        return preferences.booking_cancelled_email;
      case NotificationType.booking_no_show:
        return preferences.booking_no_show_email;
      case NotificationType.appointment_confirmed:
        return preferences.appointment_confirmed_email;
      case NotificationType.appointment_completed:
        return preferences.appointment_completed_email;
      case NotificationType.appointment_cancelled:
        return preferences.appointment_cancelled_email;
      case NotificationType.rank_up:
        return preferences.rank_up_email;
      case NotificationType.payment_confirmed:
        return preferences.payment_confirmed_email;
      case NotificationType.payment_failed:
        return preferences.payment_failed_email;
      case NotificationType.low_stock:
      case NotificationType.equipment_write_off:
        return preferences.system_email;
      case NotificationType.ai_session_archived:
        return preferences.ai_session_archived_email;
      case NotificationType.system:
        return preferences.system_email;
      default:
        return false;
    }
  }

  private async enqueueDelivery(
    delivery: QueuedNotificationDelivery,
  ): Promise<void> {
    try {
      if (delivery.channel === NotificationChannel.email) {
        await this.mailQueue.add(
          'send-generic',
          {
            to: delivery.destination,
            subject: delivery.subject!,
            html: delivery.html!,
            notification: {
              notification_id: delivery.notification_id,
            },
          },
          GENERIC_QUEUE_OPTIONS,
        );
        return;
      }
    } catch (error) {
      await this.repo.markNotificationFailed(
        delivery.notification_id,
        this.formatError(error),
      );
      this.logger.error(
        `Failed to enqueue ${delivery.channel} delivery for notification ${delivery.notification_id}`,
        this.formatError(error),
      );
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
