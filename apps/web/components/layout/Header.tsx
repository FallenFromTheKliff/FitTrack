"use client";
import { useState } from "react";
import { Bell, Menu } from "lucide-react";
import { type PageKey } from "@fittrack/app-config";
import type { Notification } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { headerStyles } from "@/styles/layoutStyles";
import HeaderMessage from "@/components/layout/HeaderMessage";
import NotificationsPanel from "@/components/layout/NotificationsPanel";
import FitButton from "@/components/fit/FitButton";

type Props = {
  onMenuToggle: () => void;
  showMenuButton: boolean;
  pageKey: PageKey;
};

export default function Header({ onMenuToggle, showMenuButton, pageKey }: Props) {
  const { colors, activeThemeKey } = useTheme();
  const s = headerStyles(colors, activeThemeKey);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isNotifHovered, setIsNotifHovered] = useState(false);
  const notifications: Notification[] = [];
  const unread = notifications.filter((item) => !item.read).length;

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
        {unread > 0 ? <span style={s.unreadBadge}>{unread}</span> : null}
      </div>
    </header>
    <NotificationsPanel isOpen={notifOpen} notifications={notifications} unreadCount={unread} onClose={() => setNotifOpen(false)} />
    </>
  );
}
