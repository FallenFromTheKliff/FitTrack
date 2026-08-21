import type { Prisma } from '@prisma/client';
import { NotificationChannel } from '@prisma/client';

export interface NotificationDispatchPayload {
  title: string;
  body: string;
  data?: Prisma.JsonValue | null;
  email?: {
    subject: string;
    html: string;
  };
  sms?: {
    body: string;
  };
}

export interface NotificationQueueMetadata {
  notification_id: string;
}

export interface QueuedNotificationDelivery {
  notification_id: string;
  channel: NotificationChannel;
  destination: string;
  subject?: string;
  html?: string;
  body?: string;
}
