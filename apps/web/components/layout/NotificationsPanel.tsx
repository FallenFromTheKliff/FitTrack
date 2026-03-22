"use client";
import { X } from "lucide-react";
import type { Notification } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { layoutStyles } from "@/styles/layoutStyles";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type NotificationsPanelProps = {
  isOpen: boolean;
  notifications: Notification[];
  unreadCount: number;
  onClose: () => void;
};

export default function NotificationsPanel({ isOpen, notifications, unreadCount, onClose }: NotificationsPanelProps) {
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
          <FitButton variant="ghost" iconOnly icon={X} iconSize={16} onClick={onClose} style={s.notificationsCloseBtn} aria-label="Close notifications panel" />
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
                  backgroundColor: item.read ? colors.surface : colors.surfaceRaised
                }}
              >
                <FitText style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</FitText>
                <FitText as="p" style={{ fontSize: 13, color: colors.textMuted, marginTop: 3 }}>
                  {item.body}
                </FitText>
                <FitText as="p" style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
                  {item.createdAt}
                </FitText>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}