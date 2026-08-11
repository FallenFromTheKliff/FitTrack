import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import Animated from "react-native-reanimated";
import { AlertTriangle } from "lucide-react-native";
import type {
  NotificationInboxResult,
  NotificationRecord,
  NotificationUnreadCountRecord,
} from "@fittrack/types";
import {
  deleteAllNotificationsMutationOptions,
  deleteNotificationMutationOptions,
  markAllNotificationsReadMutationOptions,
  markNotificationReadMutationOptions,
  notificationInboxQueryOptions,
  notificationUnreadCountQueryOptions,
  queryKeys,
} from "@fittrack/query";

import NotificationInboxItem from "@/components/settings/NotificationInboxItem";
import { AnimatedFitText, FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransition } from "@/hooks/animations/core/useThemeTransition";
import { mobileApiClient } from "@/lib/api-client";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";

const PAGE_SIZE = 10;
const LOAD_MORE_THRESHOLD = 140;

type SwipeDirection = -1 | 1;

type NotificationCacheSnapshot = {
  inbox: Array<[QueryKey, NotificationInboxResult | undefined]>;
  unreadCount: NotificationUnreadCountRecord | undefined;
};

function addToSet(current: Set<string>, values: Iterable<string>) {
  const next = new Set(current);
  for (const value of values) next.add(value);
  return next;
}

function removeFromSet(current: Set<string>, values: Iterable<string>) {
  const next = new Set(current);
  for (const value of values) next.delete(value);
  return next;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function updatePaginationMeta(
  result: NotificationInboxResult,
  total: number,
): NotificationInboxResult {
  const limit = Math.max(result.meta.limit, 1);
  return {
    ...result,
    meta: {
      ...result.meta,
      total,
      total_pages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export default function NotificationInboxPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { surfaceStyle, textMutedStyle } = useThemeTransition();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);
  const userId = user?.id;

  const [loadedPageCount, setLoadedPageCount] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [optimisticDismissals, setOptimisticDismissals] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingDismissals, setPendingDismissals] = useState<Set<string>>(
    () => new Set(),
  );
  const [dismissErrors, setDismissErrors] = useState<Record<string, string>>({});
  const [clearAllConfirmVisible, setClearAllConfirmVisible] = useState(false);
  const [clearAllTargetIds, setClearAllTargetIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [clearAllBusy, setClearAllBusy] = useState(false);
  const [clearAllError, setClearAllError] = useState<string | null>(null);
  const [inboxMessage, setInboxMessage] = useState<string | null>(null);
  const [restoreToken, setRestoreToken] = useState(0);
  const [actionLocked, setActionLocked] = useState(false);

  const actionLockRef = useRef(false);
  const optimisticDismissalsRef = useRef(new Set<string>());
  const pendingDirectionsRef = useRef(new Map<string, SwipeDirection>());
  const clearAllTargetIdsRef = useRef(new Set<string>());
  const clearAllCompletedIdsRef = useRef(new Set<string>());
  const clearAllCommitStartedRef = useRef(false);
  const notificationsRef = useRef<NotificationRecord[]>([]);
  const activeNotificationsRef = useRef<NotificationRecord[]>([]);

  const inboxRoot = useMemo(
    () =>
      userId
        ? queryKeys.notificationInbox(userId)
        : (["notifications", "inbox"] as const),
    [userId],
  );
  const unreadCountKey = useMemo(
    () => queryKeys.notificationUnreadCount(userId),
    [userId],
  );

  const inboxQueries = useQueries({
    queries: Array.from({ length: loadedPageCount }, (_, index) => ({
      ...notificationInboxQueryOptions(mobileApiClient, userId, {
        limit: PAGE_SIZE,
        page: index + 1,
      }),
      enabled: Boolean(userId),
    })),
  });
  const unreadCountQuery = useQuery({
    ...notificationUnreadCountQueryOptions(mobileApiClient, userId),
    enabled: Boolean(userId),
  });
  const markReadMutation = useMutation(
    markNotificationReadMutationOptions(mobileApiClient, queryClient, userId),
  );
  const markAllReadMutation = useMutation(
    markAllNotificationsReadMutationOptions(mobileApiClient, queryClient, userId),
  );
  const deleteMutation = useMutation(
    deleteNotificationMutationOptions(mobileApiClient, queryClient, userId),
  );
  const deleteAllMutation = useMutation(
    deleteAllNotificationsMutationOptions(mobileApiClient, queryClient, userId),
  );

  const notifications = useMemo(() => {
    const seen = new Set<string>();
    const merged: NotificationRecord[] = [];

    for (const query of inboxQueries) {
      for (const notification of query.data?.data ?? []) {
        if (seen.has(notification.id)) continue;
        seen.add(notification.id);
        merged.push(notification);
      }
    }

    return merged;
  }, [inboxQueries]);
  const activeNotifications = useMemo(
    () =>
      notifications.filter((notification) => !optimisticDismissals.has(notification.id)),
    [notifications, optimisticDismissals],
  );
  const clearAllOrder = useMemo(
    () => new Map([...clearAllTargetIds].map((id, index) => [id, index])),
    [clearAllTargetIds],
  );
  const totalPages = inboxQueries.reduce(
    (highest, query) => Math.max(highest, query.data?.meta.total_pages ?? 0),
    0,
  );
  const hasMore = totalPages > loadedPageCount;
  const isLoadingMore = Boolean(
    loadedPageCount > 1 && inboxQueries[loadedPageCount - 1]?.isPending,
  );
  const hasQueryError = inboxQueries.some((query) => query.isError);
  const isInitialLoading = Boolean(
    userId &&
      notifications.length === 0 &&
      inboxQueries.some((query) => query.isPending),
  );
  const unreadCount =
    unreadCountQuery.data?.count ??
    notifications.filter((notification) => !notification.readAt).length;
  const isTransitioning =
    pendingDismissals.size > 0 || clearAllTargetIds.size > 0;
  const statusMessage =
    clearAllError ??
    inboxMessage ??
    (hasQueryError ? "Couldn't load the inbox. Try again." : null);

  notificationsRef.current = notifications;
  activeNotificationsRef.current = activeNotifications;
  optimisticDismissalsRef.current = optimisticDismissals;

  const updateOptimisticDismissals = useCallback(
    (updater: (current: Set<string>) => Set<string>) => {
      setOptimisticDismissals((current) => {
        const next = updater(current);
        optimisticDismissalsRef.current = next;
        return next;
      });
    },
    [],
  );

  const takeCacheSnapshot = useCallback(async (): Promise<NotificationCacheSnapshot> => {
    await Promise.all([
      queryClient.cancelQueries({ queryKey: inboxRoot }),
      queryClient.cancelQueries({ queryKey: unreadCountKey }),
    ]);

    return {
      inbox: queryClient.getQueriesData<NotificationInboxResult>({
        queryKey: inboxRoot,
      }),
      unreadCount: queryClient.getQueryData<NotificationUnreadCountRecord>(
        unreadCountKey,
      ),
    };
  }, [inboxRoot, queryClient, unreadCountKey]);

  const restoreCacheSnapshot = useCallback(
    (snapshot: NotificationCacheSnapshot) => {
      for (const [queryKey, data] of snapshot.inbox) {
        if (data !== undefined) queryClient.setQueryData(queryKey, data);
      }
      if (snapshot.unreadCount !== undefined) {
        queryClient.setQueryData(unreadCountKey, snapshot.unreadCount);
      }
    },
    [queryClient, unreadCountKey],
  );

  const setInboxCache = useCallback(
    (updater: (current: NotificationInboxResult) => NotificationInboxResult) => {
      queryClient.setQueriesData<NotificationInboxResult>(
        { queryKey: inboxRoot },
        (current) => (current ? updater(current) : current),
      );
    },
    [inboxRoot, queryClient],
  );

  const updateUnreadCache = useCallback(
    (updater: (count: number) => number) => {
      queryClient.setQueryData<NotificationUnreadCountRecord>(
        unreadCountKey,
        (current) =>
          current
            ? { ...current, count: Math.max(0, updater(current.count)) }
            : current,
      );
    },
    [queryClient, unreadCountKey],
  );

  const removeNotificationFromCache = useCallback(
    (notificationId: string, wasUnread: boolean) => {
      setInboxCache((current) => {
        if (!current.data.some((item) => item.id === notificationId)) return current;
        const total = Math.max(0, current.meta.total - 1);
        return updatePaginationMeta(
          {
            ...current,
            data: current.data.filter((item) => item.id !== notificationId),
          },
          total,
        );
      });
      if (wasUnread) updateUnreadCache((count) => count - 1);
    },
    [setInboxCache, updateUnreadCache],
  );

  const removeAllNotificationsFromCache = useCallback(() => {
    setInboxCache((current) =>
      updatePaginationMeta({ ...current, data: [] }, 0),
    );
    queryClient.setQueryData<NotificationUnreadCountRecord>(
      unreadCountKey,
      (current) => (current ? { ...current, count: 0 } : current),
    );
  }, [queryClient, setInboxCache, unreadCountKey]);

  const markNotificationReadInCache = useCallback(
    (notificationId: string, readAt: string) => {
      setInboxCache((current) => ({
        ...current,
        data: current.data.map((item) =>
          item.id === notificationId ? { ...item, readAt } : item,
        ),
      }));
      updateUnreadCache((count) => count - 1);
    },
    [setInboxCache, updateUnreadCache],
  );

  const markAllNotificationsReadInCache = useCallback(() => {
    const readAt = new Date().toISOString();
    setInboxCache((current) => ({
      ...current,
      data: current.data.map((item) =>
        item.readAt ? item : { ...item, readAt },
      ),
    }));
    queryClient.setQueryData<NotificationUnreadCountRecord>(
      unreadCountKey,
      (current) => (current ? { ...current, count: 0 } : current),
    );
  }, [queryClient, setInboxCache, unreadCountKey]);

  const beginAction = useCallback(() => {
    if (actionLockRef.current) return false;
    actionLockRef.current = true;
    setActionLocked(true);
    return true;
  }, []);

  const endAction = useCallback(() => {
    actionLockRef.current = false;
    setActionLocked(false);
  }, []);

  const commitIndividualDismissal = useCallback(
    async (notificationId: string) => {
      const notification = notificationsRef.current.find(
        (item) => item.id === notificationId,
      );
      const wasUnread = Boolean(notification && !notification.readAt);
      let snapshot: NotificationCacheSnapshot | null = null;

      try {
        snapshot = await takeCacheSnapshot();
        removeNotificationFromCache(notificationId, wasUnread);
        await deleteMutation.mutateAsync(notificationId);
      } catch (error) {
        if (snapshot) restoreCacheSnapshot(snapshot);
        updateOptimisticDismissals((current) => {
          const next = new Set(current);
          next.delete(notificationId);
          return next;
        });
        setDismissErrors((current) => ({
          ...current,
          [notificationId]: getErrorMessage(
            error,
            "Couldn't dismiss this notification. It was restored.",
          ),
        }));
        setRestoreToken((current) => current + 1);
      } finally {
        pendingDirectionsRef.current.delete(notificationId);
        setPendingDismissals((current) => removeFromSet(current, [notificationId]));
        endAction();
      }
    },
    [
      deleteMutation,
      endAction,
      removeNotificationFromCache,
      restoreCacheSnapshot,
      takeCacheSnapshot,
      updateOptimisticDismissals,
    ],
  );

  const commitClearAll = useCallback(
    async (targetIds: string[]) => {
      let snapshot: NotificationCacheSnapshot | null = null;

      try {
        snapshot = await takeCacheSnapshot();
        removeAllNotificationsFromCache();
        await deleteAllMutation.mutateAsync();
        setClearAllError(null);
      } catch (error) {
        if (snapshot) restoreCacheSnapshot(snapshot);
        updateOptimisticDismissals((current) =>
          removeFromSet(current, targetIds),
        );
        setClearAllError(
          getErrorMessage(
            error,
            "Couldn't clear the inbox. Your notifications were restored.",
          ),
        );
        setRestoreToken((current) => current + 1);
      } finally {
        clearAllTargetIdsRef.current = new Set();
        clearAllCompletedIdsRef.current = new Set();
        clearAllCommitStartedRef.current = false;
        setClearAllTargetIds(new Set());
        setPendingDismissals(new Set());
        setClearAllBusy(false);
        endAction();
      }
    },
    [
      deleteAllMutation,
      endAction,
      removeAllNotificationsFromCache,
      restoreCacheSnapshot,
      takeCacheSnapshot,
      updateOptimisticDismissals,
    ],
  );

  const handleItemExitComplete = useCallback(
    (notificationId: string) => {
      const clearTarget = clearAllTargetIdsRef.current;
      if (clearTarget.has(notificationId)) {
        clearAllCompletedIdsRef.current.add(notificationId);
        if (
          !clearAllCommitStartedRef.current &&
          clearAllCompletedIdsRef.current.size >= clearTarget.size
        ) {
          clearAllCommitStartedRef.current = true;
          void commitClearAll([...clearTarget]);
        }
        return;
      }

      if (pendingDirectionsRef.current.has(notificationId)) {
        void commitIndividualDismissal(notificationId);
      }
    },
    [commitClearAll, commitIndividualDismissal],
  );

  const handleDismissRequest = useCallback(
    (notificationId: string, direction: SwipeDirection) => {
      if (
        clearAllBusy ||
        actionLockRef.current ||
        optimisticDismissalsRef.current.has(notificationId)
      ) {
        return false;
      }
      if (!beginAction()) return false;

      pendingDirectionsRef.current.set(notificationId, direction);
      setPendingDismissals(new Set([notificationId]));
      setInboxMessage(null);
      setDismissErrors((current) => {
        if (!current[notificationId]) return current;
        const next = { ...current };
        delete next[notificationId];
        return next;
      });
      updateOptimisticDismissals((current) => addToSet(current, [notificationId]));
      return true;
    },
    [beginAction, clearAllBusy, updateOptimisticDismissals],
  );

  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      const notification = notificationsRef.current.find(
        (item) => item.id === notificationId,
      );
      if (!notification || notification.readAt || !beginAction()) return;

      let snapshot: NotificationCacheSnapshot | null = null;
      try {
        snapshot = await takeCacheSnapshot();
        markNotificationReadInCache(notificationId, new Date().toISOString());
        setInboxMessage(null);
        await markReadMutation.mutateAsync(notificationId);
      } catch (error) {
        if (snapshot) restoreCacheSnapshot(snapshot);
        setInboxMessage(
          getErrorMessage(error, "Couldn't mark this notification as read."),
        );
      } finally {
        endAction();
      }
    },
    [
      beginAction,
      endAction,
      markNotificationReadInCache,
      markReadMutation,
      restoreCacheSnapshot,
      takeCacheSnapshot,
    ],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (
      (unreadCount === 0 &&
        !notificationsRef.current.some((notification) => !notification.readAt)) ||
      !beginAction()
    ) {
      return;
    }

    let snapshot: NotificationCacheSnapshot | null = null;
    try {
      snapshot = await takeCacheSnapshot();
      markAllNotificationsReadInCache();
      setInboxMessage(null);
      await markAllReadMutation.mutateAsync();
    } catch (error) {
      if (snapshot) restoreCacheSnapshot(snapshot);
      setInboxMessage(
        getErrorMessage(error, "Couldn't mark all notifications as read."),
      );
    } finally {
      endAction();
    }
  }, [
    beginAction,
    endAction,
    markAllNotificationsReadInCache,
    markAllReadMutation,
    restoreCacheSnapshot,
    takeCacheSnapshot,
    unreadCount,
  ]);

  const startClearAll = useCallback(() => {
    if (actionLockRef.current || clearAllBusy) return;
    const targetIds = activeNotificationsRef.current.map((item) => item.id);
    if (targetIds.length === 0 || !beginAction()) return;

    clearAllTargetIdsRef.current = new Set(targetIds);
    clearAllCompletedIdsRef.current = new Set();
    clearAllCommitStartedRef.current = false;
    setClearAllBusy(true);
    setClearAllError(null);
    setInboxMessage(null);
    setClearAllTargetIds(new Set(targetIds));
    setPendingDismissals(new Set(targetIds));
    updateOptimisticDismissals((current) => addToSet(current, targetIds));
  }, [beginAction, clearAllBusy, updateOptimisticDismissals]);

  const handleClearAllPress = useCallback(() => {
    if (
      actionLockRef.current ||
      clearAllBusy ||
      activeNotificationsRef.current.length === 0
    ) {
      return;
    }
    setClearAllConfirmVisible(true);
  }, [clearAllBusy]);

  const handleRefresh = useCallback(async () => {
    if (actionLockRef.current || isRefreshing || !userId) return;
    setIsRefreshing(true);
    setInboxMessage(null);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inboxRoot }),
        queryClient.invalidateQueries({ queryKey: unreadCountKey }),
      ]);
    } catch (error) {
      setInboxMessage(getErrorMessage(error, "Couldn't refresh notifications."));
    } finally {
      setIsRefreshing(false);
    }
  }, [inboxRoot, isRefreshing, queryClient, unreadCountKey, userId]);

  const handleLoadMore = useCallback(() => {
    if (
      !hasMore ||
      isLoadingMore ||
      actionLockRef.current ||
      clearAllBusy
    ) {
      return;
    }
    setLoadedPageCount((current) => Math.min(current + 1, totalPages));
  }, [clearAllBusy, hasMore, isLoadingMore, totalPages]);

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const remaining =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (remaining <= LOAD_MORE_THRESHOLD) handleLoadMore();
    },
    [handleLoadMore],
  );

  useEffect(() => {
    setLoadedPageCount(1);
    setOptimisticDismissals(new Set());
    setPendingDismissals(new Set());
    setDismissErrors({});
    setClearAllTargetIds(new Set());
    setClearAllBusy(false);
    setClearAllConfirmVisible(false);
    setClearAllError(null);
    setInboxMessage(null);
    clearAllTargetIdsRef.current = new Set();
    clearAllCompletedIdsRef.current = new Set();
    clearAllCommitStartedRef.current = false;
    optimisticDismissalsRef.current = new Set();
    pendingDirectionsRef.current.clear();
    actionLockRef.current = false;
    setActionLocked(false);
  }, [userId]);

  const renderList = notifications.length > 0 || isTransitioning;

  return (
    <>
      <Animated.View style={[s.notificationBody, surfaceStyle]}>
        <View style={s.notificationContent}>
          <View style={s.notificationHeaderRow}>
            <View style={s.notificationHeaderCopy}>
              <AnimatedFitText style={[s.sectionLabel, textMutedStyle]}>
                NOTIFICATION INBOX
              </AnimatedFitText>
              <FitText style={s.notificationSummaryText}>
                {unreadCount > 0
                  ? `${unreadCount > 99 ? "99+" : unreadCount} unread`
                  : "All caught up"}
              </FitText>
            </View>
            {inboxQueries.some((query) => query.isFetching) ? (
              <ActivityIndicator color={colors.brand} size="small" />
            ) : null}
          </View>

          {statusMessage ? (
            <View style={s.notificationStatusBanner}>
              <AlertTriangle color={colors.warning} size={16} strokeWidth={2} />
              <FitText style={s.notificationStatusBannerText}>
                {statusMessage}
              </FitText>
            </View>
          ) : null}

          {clearAllTargetIds.size > 0 ? (
            <View style={s.notificationStatusBanner}>
              <ActivityIndicator color={colors.brand} size="small" />
              <FitText style={[s.notificationStatusBannerText, { color: colors.brand }]}>
                Clearing this inbox…
              </FitText>
            </View>
          ) : null}

          <View style={s.infoCard}>
            {isInitialLoading ? (
              <View style={s.notificationLoading}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : hasQueryError && notifications.length === 0 ? (
              <View style={s.notificationEmpty}>
                <FitText style={s.notificationEmptyTitle}>Inbox unavailable</FitText>
                <FitText style={s.notificationEmptyText}>
                  Check your connection and try again.
                </FitText>
                <FitButton
                  label={isRefreshing ? "Retrying…" : "Retry"}
                  onPress={() => void handleRefresh()}
                  disabled={isRefreshing || actionLocked}
                  style={s.notificationLoadMore}
                  textStyle={s.notificationLoadMoreText}
                  variant="ghost"
                />
              </View>
            ) : renderList ? (
              <FitModalScrollView
                contentContainerStyle={{ paddingBottom: 4 }}
                fill={false}
                nestedScrollEnabled
                onScroll={handleListScroll}
                refreshControl={
                  <RefreshControl
                    colors={[colors.brand]}
                    onRefresh={() => void handleRefresh()}
                    refreshing={isRefreshing}
                    tintColor={colors.brand}
                  />
                }
                scrollEventThrottle={16}
                showScrollCue={false}
                style={{ maxHeight: 410 }}
              >
                {notifications.map((notification) => {
                  const isClearTarget = clearAllTargetIds.has(notification.id);
                  const orderIndex = clearAllOrder.get(notification.id) ?? 0;
                  const itemDirection: SwipeDirection = isClearTarget
                    ? orderIndex % 2 === 0
                      ? 1
                      : -1
                    : pendingDirectionsRef.current.get(notification.id) ?? 1;

                  return (
                    <NotificationInboxItem
                      errorMessage={dismissErrors[notification.id]}
                      exitDelay={isClearTarget ? orderIndex * 65 : 0}
                      exitDirection={itemDirection}
                      isDismissed={optimisticDismissals.has(notification.id)}
                      isInteractionDisabled={actionLocked || clearAllBusy}
                      key={notification.id}
                      notification={notification}
                      onDismissRequest={handleDismissRequest}
                      onExitComplete={handleItemExitComplete}
                      onMarkRead={handleMarkRead}
                      restoreToken={restoreToken}
                    />
                  );
                })}
                {hasMore ? (
                  <FitButton
                    disabled={isLoadingMore || actionLocked || clearAllBusy}
                    label={isLoadingMore ? "Loading more…" : "Load more"}
                    onPress={handleLoadMore}
                    style={s.notificationLoadMore}
                    textStyle={s.notificationLoadMoreText}
                    variant="ghost"
                  />
                ) : null}
              </FitModalScrollView>
            ) : (
              <View style={s.notificationEmpty}>
                <FitText style={s.notificationEmptyTitle}>No notifications yet</FitText>
                <FitText style={s.notificationEmptyText}>
                  You are all caught up. New updates will appear here.
                </FitText>
              </View>
            )}
          </View>
        </View>

        <View style={s.notificationFooter}>
          <View style={s.notificationFooterActions}>
            <FitButton
              disabled={
                unreadCount === 0 || actionLocked || clearAllBusy || isRefreshing
              }
              label={markAllReadMutation.isPending ? "Marking…" : "Mark all read"}
              onPress={() => void handleMarkAllRead()}
              style={s.notificationFooterAction}
              textStyle={s.notificationFooterActionText}
              variant="ghost"
            />
            {activeNotifications.length > 0 ? (
              <FitButton
                disabled={actionLocked || clearAllBusy || isRefreshing}
                label={clearAllBusy ? "Clearing…" : "Clear all"}
                onPress={handleClearAllPress}
                style={s.notificationFooterAction}
                textStyle={s.notificationFooterActionText}
                variant="danger"
              />
            ) : null}
          </View>
          <FitButton
            disabled={clearAllBusy}
            label="Close"
            onPress={onClose}
            style={s.notificationFooterClose}
            variant="primary"
          />
        </View>
      </Animated.View>

      <ConfirmModal
        isDestructive
        isLoading={clearAllBusy}
        isVisible={clearAllConfirmVisible}
        loadingLabel="CLEARING"
        loadingTitle="Clearing notifications"
        message="Clear every notification from your FitTrack inbox?"
        noLabel="Cancel"
        onNo={() => {
          if (!clearAllBusy) setClearAllConfirmVisible(false);
        }}
        onYes={() => {
          if (clearAllBusy) return;
          setClearAllConfirmVisible(false);
          startClearAll();
        }}
        title="Clear notifications?"
        yesLabel="Clear all"
      />
    </>
  );
}
