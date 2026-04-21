"use client";
import { X } from "lucide-react";
import type { NotificationRecord } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { layoutStyles } from "@/styles/layoutStyles";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type NotificationsPanelProps = {
  isBusy: boolean;
  isOpen: boolean;
  notifications: NotificationRecord[];
  unreadCount: number;
  onClose: () => void;
  onDelete: (notificationId: string) => Promise<unknown>;
  onMarkAllRead: () => Promise<unknown>;
  onMarkRead: (notificationId: string) => Promise<unknown>;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export default function NotificationsPanel({
  isBusy,
  isOpen,
  notifications,
  unreadCount,
  onClose,
  onDelete,
  onMarkAllRead,
  onMarkRead
}: NotificationsPanelProps) {
  const { colors } = useTheme();
  const s = layoutStyles(colors);

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          ...s.notificationsBackdrop
        }}
        onClick={onClose}
      />
      <div
        style={{
          ...s.notificationsPanel
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications panel"
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
                  ...s.notificationRow,
                  borderBottom: index < notifications.length - 1 ? `1px solid ${colors.border}` : "none",
                  backgroundColor: item.readAt ? colors.surface : colors.surfaceRaised
                }}
              >
                <FitText style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</FitText>
                <FitText as="p" style={{ fontSize: 13, color: colors.textMuted, marginTop: 3 }}>
                  {item.body}
                </FitText>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                  <FitText as="p" style={{ fontSize: 11, color: colors.textMuted }}>
                    {formatTimestamp(item.createdAt)}
                  </FitText>
                  <div style={{ display: "flex", gap: 8 }}>
                    {!item.readAt ? (
                      <FitButton
                        variant="ghost"
                        label="READ"
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
      </div>
    </>
  );
}
