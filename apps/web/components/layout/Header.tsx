"use client";
import { useState } from "react";
import { Bell, Menu } from "lucide-react";
import { type PageKey } from "@fittrack/app-config";

import { useTheme } from "@/contexts/ThemeContext";
import { useHeaderNotifications } from "@/hooks/notifications/useHeaderNotifications";
import { headerStyles } from "@/styles/layoutStyles";
import HeaderMessage from "@/components/layout/HeaderMessage";
import NotificationsPanel from "@/components/layout/NotificationsPanel";
import FitButton from "@/components/fit/FitButton";

type Props = {
  onMenuToggle: () => void;
  showMenuButton: boolean;
  pageKey: PageKey;
};

export default function Header({
  onMenuToggle,
  showMenuButton,
  pageKey,
}: Props) {
  const { colors, activeThemeKey } = useTheme();
  const s = headerStyles(colors, activeThemeKey);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isNotifHovered, setIsNotifHovered] = useState(false);
  const {
    isBusy,
    notifications,
    unreadCount,
    markAllRead,
    markRead,
    removeAllNotifications,
    removeNotification
  } = useHeaderNotifications();
  const unreadBadgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <>
    <header className="fit-app-header" style={s.header}>
      <div style={s.leftSection}>
        {showMenuButton ? (
          <FitButton
            variant="ghost"
            iconOnly
            icon={Menu}
            iconSize={23}
            className="fit-header-menu-button"
            onClick={onMenuToggle}
            style={s.iconBtn}
            aria-label="Open sidebar"
          />
        ) : null}
        <HeaderMessage pageKey={pageKey} />
      </div>
      <div style={s.rightSection}>
        <div style={s.notificationButtonWrap}>
          <FitButton
            variant="iconClear"
            iconOnly
            icon={Bell}
            iconSize={23}
            className="fit-header-notification-button"
            onClick={() => setNotifOpen((value) => !value)}
            onMouseEnter={() => setIsNotifHovered(true)}
            onMouseLeave={() => setIsNotifHovered(false)}
            style={{ ...s.notificationButton, color: isNotifHovered ? colors.brand : colors.textPrimary }}
            aria-label="Toggle notifications panel"
            title={
              unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                : "No unread notifications"
            }
          />
          {unreadCount > 0 ? (
            <span style={s.unreadBadge} aria-label={`${unreadCount} unread notifications`}>
              {unreadBadgeLabel}
            </span>
          ) : null}
        </div>
      </div>
    </header>
    <NotificationsPanel
      isBusy={isBusy}
      isOpen={notifOpen}
      notifications={notifications}
      unreadCount={unreadCount}
      onClose={() => setNotifOpen(false)}
      onDelete={removeNotification}
      onDeleteAll={removeAllNotifications}
      onMarkAllRead={markAllRead}
      onMarkRead={markRead}
    />
    </>
  );
}
