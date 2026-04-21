import type { PaginatedResult } from "./membership";

export type NotificationChannel = "email" | "in_app" | "sms";

export type NotificationStatus = "failed" | "pending" | "read" | "sent";

export type NotificationType =
  | "ai_session_archived"
  | "appointment_cancelled"
  | "appointment_completed"
  | "appointment_confirmed"
  | "booking_cancelled"
  | "booking_confirmed"
  | "booking_no_show"
  | "equipment_write_off"
  | "low_stock"
  | "payment_confirmed"
  | "payment_failed"
  | "rank_up"
  | "subscription_expired"
  | "subscription_expiring"
  | "system";

export type NotificationRecord = {
  body: string;
  channel: NotificationChannel;
  createdAt: string;
  data: Record<string, unknown> | null;
  error: string | null;
  id: string;
  readAt: string | null;
  sentAt: string | null;
  status: NotificationStatus;
  title: string;
  type: NotificationType;
  updatedAt: string;
};

export type NotificationListParams = {
  limit?: number;
  page?: number;
  unreadOnly?: boolean;
};

export type NotificationInboxResult = PaginatedResult<NotificationRecord>;

export type NotificationPreferencesRecord = {
  aiSessionArchivedEmail: boolean;
  appointmentCancelledEmail: boolean;
  appointmentCompletedEmail: boolean;
  appointmentConfirmedEmail: boolean;
  bookingCancelledEmail: boolean;
  bookingConfirmedEmail: boolean;
  bookingNoShowEmail: boolean;
  paymentConfirmedEmail: boolean;
  paymentFailedEmail: boolean;
  rankUpEmail: boolean;
  subscriptionExpiredEmail: boolean;
  subscriptionExpiringEmail: boolean;
  systemEmail: boolean;
};

export type NotificationPreferencesUpdateInput =
  Partial<NotificationPreferencesRecord>;

export type NotificationPreferenceField =
  keyof NotificationPreferencesRecord;

export type NotificationPreferenceGroup = {
  description: string;
  fields: NotificationPreferenceField[];
  id:
    | "bookings"
    | "coaching"
    | "membership"
    | "payments"
    | "progress"
    | "system";
  label: string;
};

export const NOTIFICATION_PREFERENCE_GROUPS: NotificationPreferenceGroup[] = [
  {
    id: "membership",
    label: "Membership Alerts",
    description: "Expiring and expired membership notices.",
    fields: ["subscriptionExpiringEmail", "subscriptionExpiredEmail"],
  },
  {
    id: "bookings",
    label: "Booking Updates",
    description: "Booking confirmations, cancellations, and no-show alerts.",
    fields: [
      "bookingConfirmedEmail",
      "bookingCancelledEmail",
      "bookingNoShowEmail",
    ],
  },
  {
    id: "coaching",
    label: "Coaching Sessions",
    description: "Coach appointment confirmations, completions, and changes.",
    fields: [
      "appointmentConfirmedEmail",
      "appointmentCompletedEmail",
      "appointmentCancelledEmail",
    ],
  },
  {
    id: "payments",
    label: "Payment Notices",
    description: "Successful or failed payment updates.",
    fields: ["paymentConfirmedEmail", "paymentFailedEmail"],
  },
  {
    id: "progress",
    label: "Progress Highlights",
    description: "Rank-up and archived AI session updates.",
    fields: ["rankUpEmail", "aiSessionArchivedEmail"],
  },
  {
    id: "system",
    label: "System Messages",
    description: "Operational notices such as stock or equipment alerts.",
    fields: ["systemEmail"],
  },
];

export type MarkAllNotificationsReadResult = {
  updatedCount: number;
};

export type NotificationUnreadCountRecord = {
  count: number;
};

export function buildNotificationPreferenceGroupPatch(
  fields: NotificationPreferenceField[],
  enabled: boolean,
): NotificationPreferencesUpdateInput {
  return Object.fromEntries(
    fields.map((field) => [field, enabled]),
  ) as NotificationPreferencesUpdateInput;
}

export function isNotificationPreferenceGroupEnabled(
  preferences: NotificationPreferencesRecord,
  group: Pick<NotificationPreferenceGroup, "fields">,
): boolean {
  return group.fields.some((field) => preferences[field]);
}
