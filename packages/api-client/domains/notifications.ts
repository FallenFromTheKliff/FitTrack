import type {
  MarkAllNotificationsReadResult,
  DeleteAllNotificationsResult,
  NotificationInboxResult,
  NotificationListParams,
  NotificationPreferencesRecord,
  NotificationPreferencesUpdateInput,
  NotificationRecord,
  NotificationUnreadCountRecord,
} from "@fittrack/types";
import { unwrapPaginatedResponse, unwrapResponse, unwrapVoidResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type {
  MarkAllNotificationsReadResult,
  DeleteAllNotificationsResult,
  NotificationInboxResult,
  NotificationListParams,
  NotificationPreferencesRecord,
  NotificationPreferencesUpdateInput,
  NotificationRecord,
  NotificationUnreadCountRecord,
} from "@fittrack/types";

type NotificationApiRecord = {
  body: string;
  channel: NotificationRecord["channel"];
  created_at: string;
  data: Record<string, unknown> | null;
  error: string | null;
  id: string;
  read_at: string | null;
  sent_at: string | null;
  status: NotificationRecord["status"];
  title: string;
  type: NotificationRecord["type"];
  updated_at: string;
};

type NotificationPreferencesApiRecord = {
  ai_session_archived_email: boolean;
  appointment_cancelled_email: boolean;
  appointment_completed_email: boolean;
  appointment_confirmed_email: boolean;
  booking_cancelled_email: boolean;
  booking_confirmed_email: boolean;
  booking_no_show_email: boolean;
  payment_confirmed_email: boolean;
  payment_failed_email: boolean;
  rank_up_email: boolean;
  subscription_expired_email: boolean;
  subscription_expiring_email: boolean;
  system_email: boolean;
};

type MarkAllReadApiRecord = {
  updated_count: number;
};

type DeleteAllNotificationsApiRecord = {
  deleted_count: number;
};

function mapNotification(record: NotificationApiRecord): NotificationRecord {
  return {
    body: record.body,
    channel: record.channel,
    createdAt: record.created_at,
    data: record.data,
    error: record.error,
    id: record.id,
    readAt: record.read_at,
    sentAt: record.sent_at,
    status: record.status,
    title: record.title,
    type: record.type,
    updatedAt: record.updated_at,
  };
}

function mapNotificationPreferences(
  record: NotificationPreferencesApiRecord,
): NotificationPreferencesRecord {
  return {
    aiSessionArchivedEmail: record.ai_session_archived_email,
    appointmentCancelledEmail: record.appointment_cancelled_email,
    appointmentCompletedEmail: record.appointment_completed_email,
    appointmentConfirmedEmail: record.appointment_confirmed_email,
    bookingCancelledEmail: record.booking_cancelled_email,
    bookingConfirmedEmail: record.booking_confirmed_email,
    bookingNoShowEmail: record.booking_no_show_email,
    paymentConfirmedEmail: record.payment_confirmed_email,
    paymentFailedEmail: record.payment_failed_email,
    rankUpEmail: record.rank_up_email,
    subscriptionExpiredEmail: record.subscription_expired_email,
    subscriptionExpiringEmail: record.subscription_expiring_email,
    systemEmail: record.system_email,
  };
}

function toNotificationListParams(params?: NotificationListParams) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.unreadOnly !== undefined
      ? { unread_only: params.unreadOnly }
      : {}),
  };
}

function toNotificationPreferencesPayload(
  payload: NotificationPreferencesUpdateInput,
) {
  return {
    ...(payload.aiSessionArchivedEmail !== undefined
      ? { ai_session_archived_email: payload.aiSessionArchivedEmail }
      : {}),
    ...(payload.appointmentCancelledEmail !== undefined
      ? { appointment_cancelled_email: payload.appointmentCancelledEmail }
      : {}),
    ...(payload.appointmentCompletedEmail !== undefined
      ? { appointment_completed_email: payload.appointmentCompletedEmail }
      : {}),
    ...(payload.appointmentConfirmedEmail !== undefined
      ? { appointment_confirmed_email: payload.appointmentConfirmedEmail }
      : {}),
    ...(payload.bookingCancelledEmail !== undefined
      ? { booking_cancelled_email: payload.bookingCancelledEmail }
      : {}),
    ...(payload.bookingConfirmedEmail !== undefined
      ? { booking_confirmed_email: payload.bookingConfirmedEmail }
      : {}),
    ...(payload.bookingNoShowEmail !== undefined
      ? { booking_no_show_email: payload.bookingNoShowEmail }
      : {}),
    ...(payload.paymentConfirmedEmail !== undefined
      ? { payment_confirmed_email: payload.paymentConfirmedEmail }
      : {}),
    ...(payload.paymentFailedEmail !== undefined
      ? { payment_failed_email: payload.paymentFailedEmail }
      : {}),
    ...(payload.rankUpEmail !== undefined
      ? { rank_up_email: payload.rankUpEmail }
      : {}),
    ...(payload.subscriptionExpiredEmail !== undefined
      ? { subscription_expired_email: payload.subscriptionExpiredEmail }
      : {}),
    ...(payload.subscriptionExpiringEmail !== undefined
      ? { subscription_expiring_email: payload.subscriptionExpiringEmail }
      : {}),
    ...(payload.systemEmail !== undefined
      ? { system_email: payload.systemEmail }
      : {}),
  };
}

export function createNotificationsApi(transport: ApiTransport) {
  return {
    async listInbox(
      params?: NotificationListParams,
    ): Promise<NotificationInboxResult> {
      const result = await unwrapPaginatedResponse<NotificationApiRecord>(
        transport.get("/notifications/my", {
          params: toNotificationListParams(params),
        }),
        "Unable to load notifications.",
      );

      return {
        ...result,
        data: result.data.map(mapNotification),
      };
    },
    async getUnreadCount(): Promise<NotificationUnreadCountRecord> {
      return unwrapResponse<NotificationUnreadCountRecord>(
        transport.get("/notifications/unread-count"),
        "Unable to load notification count.",
      );
    },
    async getPreferences(): Promise<NotificationPreferencesRecord> {
      return mapNotificationPreferences(
        await unwrapResponse<NotificationPreferencesApiRecord>(
          transport.get("/notifications/preferences"),
          "Unable to load notification preferences.",
        ),
      );
    },
    async updatePreferences(
      payload: NotificationPreferencesUpdateInput,
    ): Promise<NotificationPreferencesRecord> {
      return mapNotificationPreferences(
        await unwrapResponse<NotificationPreferencesApiRecord>(
          transport.patch(
            "/notifications/preferences",
            toNotificationPreferencesPayload(payload),
          ),
          "Unable to update notification preferences.",
        ),
      );
    },
    async markRead(notificationId: string): Promise<NotificationRecord> {
      return mapNotification(
        await unwrapResponse<NotificationApiRecord>(
          transport.patch(`/notifications/${notificationId}/read`),
          "Unable to mark notification as read.",
        ),
      );
    },
    async markAllRead(): Promise<MarkAllNotificationsReadResult> {
      const result = await unwrapResponse<MarkAllReadApiRecord>(
        transport.patch("/notifications/read-all"),
        "Unable to mark notifications as read.",
      );

      return {
        updatedCount: result.updated_count,
      };
    },
    deleteNotification(notificationId: string) {
      return unwrapVoidResponse(
        transport.delete(`/notifications/${notificationId}`),
        "Unable to delete notification.",
      );
    },
    async deleteAllNotifications(): Promise<DeleteAllNotificationsResult> {
      const result = await unwrapResponse<DeleteAllNotificationsApiRecord>(
        transport.delete("/notifications"),
        "Unable to delete notifications.",
      );

      return {
        deletedCount: result.deleted_count,
      };
    },
  };
}
