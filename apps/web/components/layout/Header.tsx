"use client";
import { useState } from "react";
import { Bell, ListFilter, Menu } from "lucide-react";
import { type PageKey } from "@fittrack/app-config";

import { useTheme } from "@/contexts/ThemeContext";
import { useHeaderNotifications } from "@/hooks/notifications/useHeaderNotifications";
import { headerStyles } from "@/styles/layoutStyles";
import HeaderMessage from "@/components/layout/HeaderMessage";
import NotificationsPanel from "@/components/layout/NotificationsPanel";
import FitButton from "@/components/fit/FitButton";
import { FitSelect } from "@/components/fit";
import {
  ANALYTICS_SECTION_FILTER_OPTIONS,
  useAnalyticsSectionFilter,
  type AnalyticsSectionFilter,
} from "@/contexts/AnalyticsSectionFilterContext";

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
  const { sectionFilter, setSectionFilter } = useAnalyticsSectionFilter();
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
        {pageKey === "analytics" ? (
          <div style={s.analyticsHeaderFilterWrap}>
            <ListFilter
              size={16}
              strokeWidth={2}
              style={s.analyticsHeaderFilterIcon}
              aria-hidden="true"
            />
            <FitSelect
              compact
              value={sectionFilter}
              onChange={(event) =>
                setSectionFilter(event.target.value as AnalyticsSectionFilter)
              }
              options={[...ANALYTICS_SECTION_FILTER_OPTIONS]}
              name="analyticsHeaderSectionFilter"
              aria-label="Filter Data Analytics sections"
              style={s.analyticsHeaderFilter}
            />
          </div>
        ) : null}
        <div style={s.notificationButtonWrap}>
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
