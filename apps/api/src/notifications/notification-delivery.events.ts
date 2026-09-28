import { NotificationChannel } from '@prisma/client';

export const NOTIFICATION_DELIVERY_SENT_EVENT = 'notification.delivery.sent';
export const NOTIFICATION_DELIVERY_FAILED_EVENT =
  'notification.delivery.failed';

export interface NotificationDeliverySentEvent {
  notificationId: string;
  channel: NotificationChannel;
}

export interface NotificationDeliveryFailedEvent {
  notificationId: string;
  channel: NotificationChannel;
  error: string;
}
