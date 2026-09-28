"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAllNotificationsMutationOptions,
  deleteNotificationMutationOptions,
  markAllNotificationsReadMutationOptions,
  markNotificationReadMutationOptions,
  notificationInboxQueryOptions,
  notificationUnreadCountQueryOptions
} from "@fittrack/query";

import { useAuth } from "@/contexts/AuthContext";
import { webApiClient } from "@/lib/api-client";

const HEADER_INBOX_LIMIT = 8;

export function useHeaderNotifications() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  const inboxQuery = useQuery({
    ...notificationInboxQueryOptions(webApiClient, userId, {
      limit: HEADER_INBOX_LIMIT,
      page: 1
    }),
    enabled: Boolean(userId)
  });

  const unreadCountQuery = useQuery({
    ...notificationUnreadCountQueryOptions(webApiClient, userId),
    enabled: Boolean(userId)
  });

  const markReadMutation = useMutation(
    markNotificationReadMutationOptions(webApiClient, queryClient, userId)
  );
  const markAllReadMutation = useMutation(
    markAllNotificationsReadMutationOptions(webApiClient, queryClient, userId)
  );
  const deleteMutation = useMutation(
    deleteNotificationMutationOptions(webApiClient, queryClient, userId)
  );
  const deleteAllMutation = useMutation(
    deleteAllNotificationsMutationOptions(webApiClient, queryClient, userId)
  );

  return {
    hasNotifications: (inboxQuery.data?.data.length ?? 0) > 0,
    isBusy:
      inboxQuery.isFetching ||
      markReadMutation.isPending ||
      markAllReadMutation.isPending ||
      deleteMutation.isPending ||
      deleteAllMutation.isPending,
    notifications: inboxQuery.data?.data ?? [],
    unreadCount: unreadCountQuery.data?.count ?? 0,
    markAllRead: () => markAllReadMutation.mutateAsync(),
    markRead: (notificationId: string) =>
      markReadMutation.mutateAsync(notificationId),
    removeNotification: (notificationId: string) =>
      deleteMutation.mutateAsync(notificationId),
    removeAllNotifications: () => deleteAllMutation.mutateAsync()
  };
}
