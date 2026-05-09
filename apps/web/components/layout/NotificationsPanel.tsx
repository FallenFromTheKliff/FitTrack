"use client";
import { useState } from "react";
import { X } from "lucide-react";
import type { NotificationRecord } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { layoutStyles } from "@/styles/layoutStyles";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import { ConfirmModal, FitModal } from "@/components/modals";

type NotificationsPanelProps = {
  isBusy: boolean;
  isOpen: boolean;
  notifications: NotificationRecord[];
  unreadCount: number;
  onClose: () => void;
  onDelete: (notificationId: string) => Promise<unknown>;
  onDeleteAll: () => Promise<unknown>;
  onMarkAllRead: () => Promise<unknown>;
  onMarkRead: (notificationId: string) => Promise<unknown>;
};

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Date unavailable";
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return timestamp.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function getNotificationTimestamp(item: NotificationRecord) {
  return item.createdAt || item.sentAt;
}

export default function NotificationsPanel({
  isBusy,
  isOpen,
  notifications,
  unreadCount,
  onClose,
  onDelete,
  onDeleteAll,
  onMarkAllRead,
  onMarkRead
}: NotificationsPanelProps) {
  const { colors } = useTheme();
  const s = layoutStyles(colors);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);

  if (!isOpen) return null;

  const handleDeleteAll = () => {
    if (notifications.length === 0 || isBusy) return;
    setDeleteAllConfirmOpen(true);
  };

  return (
    <>
      <FitModal
        isOpen={isOpen}
        onClose={onClose}
        title="Notifications panel"
        maxWidth={420}
        noScroll
        hideHeaderText
        hideCloseButton
        hideHeaderDivider
        headerStyle={{ display: "none" }}
        overlayStyle={{
          ...s.notificationsBackdrop,
          alignItems: "stretch",
          justifyContent: "flex-end",
          padding: 0,
        }}
        containerStyle={{
          width: "min(420px, 92vw)",
          maxWidth: "min(420px, 92vw)",
          height: "100vh",
          maxHeight: "100vh",
          borderRadius: 0,
          borderLeft: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          boxShadow: "none",
        }}
        contentStyle={{
          padding: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={s.notificationsPanelHeader}>
          <div>
            <FitText as="h2" style={{ fontSize: 18, fontWeight: 700 }}>Notifications</FitText>
            <FitText as="p" style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
              {unreadCount > 0 ? `${unreadCount} unread` : "No unread notifications"}
            </FitText>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FitButton
              variant="ghost"
              label="MARK ALL"
              onClick={() => void onMarkAllRead()}
              disabled={unreadCount === 0 || isBusy}
              style={{ fontSize: 12 }}
            />
            <FitButton
              variant="ghost"
              label="DELETE ALL"
              onClick={handleDeleteAll}
              disabled={notifications.length === 0 || isBusy}
              style={{ fontSize: 12, color: colors.danger }}
            />
            <FitButton variant="ghost" iconOnly icon={X} iconSize={16} onClick={onClose} style={s.notificationsCloseBtn} aria-label="Close notifications panel" />
          </div>
        </div>
        <div style={s.notificationsListWrap}>
          {notifications.length === 0 ? (
            <div style={s.notificationsEmptyState}>
              <FitText style={{ fontSize: 15, fontWeight: 600 }}>No notifications yet</FitText>
              <FitText as="p" style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                You are all caught up.
              </FitText>
            </div>
          ) : (
            notifications.map((item, index) => (
              <div
                key={item.id}
                style={{
                  ...s.notificationCard(item.readAt !== null),
                  marginBottom: index < notifications.length - 1 ? 12 : 0
                }}
              >
                <div style={s.notificationCardHeader}>
                  <div style={s.notificationCardCopy}>
                    <FitText as="h3" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                      {item.title}
                    </FitText>
                    <FitText as="p" style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.5 }}>
                      {item.body}
                    </FitText>
                  </div>
                  <div style={s.notificationStateBadge(item.readAt !== null)}>
                    <FitText style={{ fontSize: 11, fontWeight: 700 }}>
                      {item.readAt ? "Read" : "Unread"}
                    </FitText>
                  </div>
                </div>
                <div style={s.notificationCardFooter}>
                  <FitText as="p" style={s.notificationTimestamp}>
                    {formatTimestamp(getNotificationTimestamp(item))}
                  </FitText>
                  <div style={s.notificationActionGroup}>
                    {!item.readAt ? (
                      <FitButton
                        variant="ghost"
                        label="MARK READ"
                        onClick={() => void onMarkRead(item.id)}
                        disabled={isBusy}
                        style={{ fontSize: 12 }}
                      />
                    ) : null}
                    <FitButton
                      variant="ghost"
                      label="DELETE"
                      onClick={() => void onDelete(item.id)}
                      disabled={isBusy}
                      style={{ fontSize: 12, color: colors.textMuted }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </FitModal>
      <ConfirmModal
        isOpen={deleteAllConfirmOpen}
        title="Delete notifications"
        message="Delete all notifications from this inbox?"
        confirmLabel="DELETE ALL"
        isDanger
        onCancel={() => setDeleteAllConfirmOpen(false)}
        onConfirm={() => {
          setDeleteAllConfirmOpen(false);
          void onDeleteAll();
        }}
      />
    </>
  );
}
