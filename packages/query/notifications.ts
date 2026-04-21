import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  NotificationListParams,
  NotificationPreferencesUpdateInput,
} from "@fittrack/api-client";
import { invalidateNotificationQueries } from "./cache";
import { queryKeys } from "./query-keys";

export function notificationInboxQueryOptions(
  client: Pick<ApiClient, "notifications">,
  userId?: string,
  params?: NotificationListParams,
) {
  return queryOptions({
    queryKey: queryKeys.notificationInbox(userId, params),
    queryFn: () => client.notifications.listInbox(params),
  });
}

export function notificationUnreadCountQueryOptions(
  client: Pick<ApiClient, "notifications">,
  userId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.notificationUnreadCount(userId),
    queryFn: () => client.notifications.getUnreadCount(),
  });
}

export function notificationPreferencesQueryOptions(
  client: Pick<ApiClient, "notifications">,
  userId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.notificationPreferences(userId),
    queryFn: () => client.notifications.getPreferences(),
  });
}

async function invalidateNotifications(
  queryClient: QueryClient,
  userId?: string,
) {
  await invalidateNotificationQueries(queryClient, userId);
}

export function updateNotificationPreferencesMutationOptions(
  client: Pick<ApiClient, "notifications">,
  queryClient: QueryClient,
  userId?: string,
) {
  return mutationOptions({
    mutationFn: (payload: NotificationPreferencesUpdateInput) =>
      client.notifications.updatePreferences(payload),
    onSuccess: async () => {
      await invalidateNotifications(queryClient, userId);
    },
  });
}

export function markNotificationReadMutationOptions(
  client: Pick<ApiClient, "notifications">,
  queryClient: QueryClient,
  userId?: string,
) {
  return mutationOptions({
    mutationFn: (notificationId: string) =>
      client.notifications.markRead(notificationId),
    onSuccess: async () => {
      await invalidateNotifications(queryClient, userId);
    },
  });
}

export function markAllNotificationsReadMutationOptions(
  client: Pick<ApiClient, "notifications">,
  queryClient: QueryClient,
  userId?: string,
) {
  return mutationOptions({
    mutationFn: () => client.notifications.markAllRead(),
    onSuccess: async () => {
      await invalidateNotifications(queryClient, userId);
    },
  });
}

export function deleteNotificationMutationOptions(
  client: Pick<ApiClient, "notifications">,
  queryClient: QueryClient,
  userId?: string,
) {
  return mutationOptions({
    mutationFn: (notificationId: string) =>
      client.notifications.deleteNotification(notificationId),
    onSuccess: async () => {
      await invalidateNotifications(queryClient, userId);
    },
  });
}
