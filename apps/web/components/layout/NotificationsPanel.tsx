"use client";
import { useState } from "react";
import { Bell } from "lucide-react";
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
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "No unread notifications"}
        icon={Bell}
        maxWidth={420}
        noScroll
        motionPreset="slide-right"
        overlayStyle={{
          ...s.notificationsBackdrop,
          alignItems: "stretch",
          justifyContent: "flex-end",
          padding: 0,
        }}
        headerStyle={{
          flexShrink: 0,
          minWidth: 0,
        }}
        containerStyle={{
          width: "min(420px, 92vw)",
          maxWidth: "min(420px, 92vw)",
          height: "100vh",
          maxHeight: "100vh",
          minHeight: 0,
          minWidth: 0,
          borderRadius: 0,
          borderLeft: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          boxShadow: "none",
          overflow: "hidden",
        }}
        contentStyle={{
          padding: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          flex: "1 1 auto",
          minHeight: 0,
          minWidth: 0,
        }}
        footerStyle={{
          flexShrink: 0,
          minWidth: 0,
        }}
        footer={
          <>
            <FitButton
              variant="ghost"
              className="member-notification-footer-action"
              label="MARK ALL"
              onClick={() => void onMarkAllRead()}
              disabled={unreadCount === 0 || isBusy}
              style={{ flex: "1 1 0", fontSize: 12, minWidth: 0 }}
            />
            <FitButton
              variant="ghost"
              className="member-notification-footer-action"
              label="DELETE ALL"
              onClick={handleDeleteAll}
              disabled={notifications.length === 0 || isBusy}
              style={{ flex: "1 1 0", fontSize: 12, minWidth: 0, color: colors.danger }}
            />
          </>
        }
      >
        <div
          data-fit-notifications-scroll="true"
          style={{
            ...s.notificationsListWrap,
            minHeight: 0,
            minWidth: 0,
            overscrollBehavior: "contain",
            scrollbarGutter: "stable",
          }}
        >
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
                className="member-notification-card"
                style={{
                  ...s.notificationCard(item.readAt !== null),
                  marginBottom: index < notifications.length - 1 ? 12 : 0
                }}
              >
                <div className="member-notification-card-header" style={s.notificationCardHeader}>
                  <div className="member-notification-card-copy" style={s.notificationCardCopy}>
                    <FitText
                      as="h3"
                      className="member-notification-title"
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        lineHeight: 1.3,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {item.title}
                    </FitText>
                    <FitText
                      as="p"
                      className="member-notification-body"
                      style={{
                        fontSize: 13,
                        color: colors.textMuted,
                        lineHeight: 1.5,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {item.body}
                    </FitText>
                  </div>
                  <div className="member-notification-state-badge" style={s.notificationStateBadge(item.readAt !== null)}>
                    <FitText className="member-notification-state" style={{ fontSize: 11, fontWeight: 700 }}>
                      {item.readAt ? "Read" : "Unread"}
                    </FitText>
                  </div>
                </div>
                <div className="member-notification-card-footer" style={s.notificationCardFooter}>
                  <FitText as="p" className="member-notification-timestamp" style={s.notificationTimestamp}>
                    {formatTimestamp(getNotificationTimestamp(item))}
                  </FitText>
                  <div className="member-notification-action-group" style={s.notificationActionGroup}>
                    {!item.readAt ? (
                      <FitButton
                        variant="ghost"
                        className="member-notification-action"
                        label="MARK READ"
                        onClick={() => void onMarkRead(item.id)}
                        disabled={isBusy}
                        style={{ fontSize: 12 }}
                      />
                    ) : null}
                    <FitButton
                      variant="ghost"
                      className="member-notification-action"
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
