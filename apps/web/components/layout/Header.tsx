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
    removeNotification
  } = useHeaderNotifications();

  return (
    <>
    <header style={s.header}>
      <div style={s.leftSection}>
        {showMenuButton ? (
          <FitButton
            variant="ghost"
            iconOnly
            icon={Menu}
            iconSize={23}
            onClick={onMenuToggle}
            style={s.iconBtn}
            aria-label="Open sidebar"
          />
        ) : null}
        <HeaderMessage pageKey={pageKey} />
      </div>
      <div style={s.rightSection}>
        <FitButton
          variant="iconClear"
          iconOnly
          icon={Bell}
          iconSize={23}
          onClick={() => setNotifOpen((value) => !value)}
          onMouseEnter={() => setIsNotifHovered(true)}
          onMouseLeave={() => setIsNotifHovered(false)}
          style={{ ...s.notificationButton, color: isNotifHovered ? colors.brand : colors.textPrimary }}
          aria-label="Toggle notifications panel"
        />
        {unreadCount > 0 ? <span style={s.unreadBadge}>{unreadCount}</span> : null}
      </div>
    </header>
    <NotificationsPanel
      isBusy={isBusy}
      isOpen={notifOpen}
      notifications={notifications}
      unreadCount={unreadCount}
      onClose={() => setNotifOpen(false)}
      onDelete={removeNotification}
      onMarkAllRead={markAllRead}
      onMarkRead={markRead}
    />
    </>
  );
}
