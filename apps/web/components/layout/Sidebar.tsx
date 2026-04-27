"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dumbbell,
  LayoutDashboard,
  Users,
  CalendarDays,
  Grid2X2,
  Package,
  BarChart2,
  Settings,
  LogOut,
  ChevronRight,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTheme, useFontClass } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTimedMessage } from "@fittrack/hooks";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { canAccessWebPage, getWebPortalLabel } from "@/lib/portal-access";
import { sidebarStyles } from "@/styles/layoutStyles";
import { CONFIRM_COPY } from "@/utils/confirmCopy";
import { sleep } from "@/utils/sleep";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import { ConfirmModal } from "@/components/modals";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  pageKey:
    | "dashboard"
    | "members"
    | "schedule"
    | "exercise-lab"
    | "gamification"
    | "ai"
    | "facilities"
    | "inventory"
    | "analytics"
    | "settings";
};

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    pageKey: "dashboard",
  },
  { href: "/members", label: "Members", icon: Users, pageKey: "members" },
  {
    href: "/schedule",
    label: "Gym Operations",
    icon: CalendarDays,
    pageKey: "schedule",
  },
  {
    href: "/exercise-lab",
    label: "Exercise Lab",
    icon: Dumbbell,
    pageKey: "exercise-lab",
  },
  {
    href: "/gamification",
    label: "Gamification",
    icon: Trophy,
    pageKey: "gamification",
  },
  { href: "/ai", label: "BrodigyAI", icon: Bot, pageKey: "ai" },
  {
    href: "/facilities",
    label: "Facilities",
    icon: Grid2X2,
    pageKey: "facilities",
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: Package,
    pageKey: "inventory",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart2,
    pageKey: "analytics",
  },
  { href: "/settings", label: "Settings", icon: Settings, pageKey: "settings" },
];

type Props = {
  collapsed?: boolean;
  isMobileOverlay?: boolean;
  onClose?: () => void;
  onCollapseToggle?: () => void;
};

export default function Sidebar({
  collapsed = false,
  isMobileOverlay = false,
  onClose,
  onCollapseToggle,
}: Props) {
  const path = usePathname() ?? "/";
  const { colors, activeThemeKey } = useTheme();
  const { user, logout } = useAuth();
  const { message, showMessage } = useTimedMessage(
    FEEDBACK_DURATION_MS.standard,
  );
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [isBrandHovered, setIsBrandHovered] = useState(false);
  const fontClass = useFontClass();
  const s = sidebarStyles(colors, activeThemeKey);
  const initials =
    user?.avatarInitials ?? user?.name?.slice(0, 2).toUpperCase() ?? "AU";
  const isProfileActive = path.startsWith("/profile");
  const portalLabel = getWebPortalLabel(user?.role);
  const visibleNav = useMemo(
    () => NAV.filter((item) => canAccessWebPage(user?.role, item.pageKey)),
    [user?.role],
  );
  const canToggleCollapse = !isMobileOverlay && !!onCollapseToggle;

  const brandContent = (
    <>
      <div
        style={{
          ...s.logoMark,
          transform:
            canToggleCollapse && isBrandHovered ? "translateY(-1px)" : "none",
          boxShadow:
            canToggleCollapse && isBrandHovered
              ? `0 10px 24px ${colors.brand}26`
              : "none",
          transition: "transform 180ms ease, box-shadow 180ms ease",
        }}
      >
        <Dumbbell size={24} color="white" strokeWidth={2} />
      </div>
      {!collapsed ? (
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 0,
            transform:
              canToggleCollapse && isBrandHovered ? "translateX(1px)" : "none",
            transition: "transform 180ms ease",
          }}
        >
          <FitText
            style={{
              ...s.logoTitle,
              fontSize: 23,
              fontWeight: 700,
              lineHeight: 1.02,
              display: "block",
              margin: 0,
            }}
            excludeGlobalScale
          >
            FitTrack
          </FitText>
          <FitText
            as="p"
            style={{
              ...s.logoSubtitle,
              fontSize: 13,
              lineHeight: 1.08,
              display: "block",
              margin: "2px 0 0",
            }}
            excludeGlobalScale
          >
            {portalLabel}
          </FitText>
        </div>
      ) : null}
      {canToggleCollapse ? (
        <div
          aria-hidden="true"
          style={{
            marginLeft: collapsed ? 0 : "auto",
            width: 34,
            height: 34,
            borderRadius: 10,
            border: `1px solid ${
              isBrandHovered ? `${colors.brand}55` : colors.border
            }`,
            backgroundColor: isBrandHovered
              ? `${colors.brand}14`
              : colors.surfaceRaised,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isBrandHovered ? colors.brand : colors.textMuted,
            opacity: collapsed ? 0.95 : isBrandHovered ? 1 : 0.82,
            transform:
              collapsed || isBrandHovered ? "translateX(0)" : "translateX(4px)",
            transition:
              "opacity 180ms ease, transform 180ms ease, color 180ms ease, background-color 180ms ease, border-color 180ms ease",
            flexShrink: 0,
          }}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} strokeWidth={2.1} />
          ) : (
            <PanelLeftClose size={18} strokeWidth={2.1} />
          )}
        </div>
      ) : null}
    </>
  );

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    showMessage("Logging out...");
    await sleep(FEEDBACK_DURATION_MS.standard);
    await logout();
  };

  return (
    <aside
      style={{
        ...s.sidebar,
        width: collapsed ? 96 : s.sidebar.width,
        padding: collapsed ? "0 10px 20px" : s.sidebar.padding,
        transition: "width 220ms ease, padding 220ms ease",
      }}
    >
      {canToggleCollapse ? (
        <button
          type="button"
          onClick={onCollapseToggle}
          onMouseEnter={() => setIsBrandHovered(true)}
          onMouseLeave={() => setIsBrandHovered(false)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            ...s.logoRow,
            width: "100%",
            border: `1px solid ${isBrandHovered ? `${colors.brand}40` : "transparent"}`,
            backgroundColor: isBrandHovered
              ? colors.surfaceRaised
              : "transparent",
            borderRadius: 16,
            cursor: "pointer",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? "0 2px" : "0 8px",
            transition:
              "background-color 180ms ease, border-color 180ms ease, transform 180ms ease",
            transform: isBrandHovered ? "translateX(1px)" : "none",
          }}
        >
          {brandContent}
        </button>
      ) : (
        <div style={s.logoRow}>{brandContent}</div>
      )}
      <div style={s.topSeparator} />
      <Link
        href="/profile"
        title={collapsed ? `${user?.name ?? "Admin"} profile` : undefined}
        aria-label={collapsed ? "Profile" : undefined}
        style={{
          ...s.profileCard(isProfileActive),
          padding: collapsed
            ? "12px 10px"
            : s.profileCard(isProfileActive).padding,
          alignItems: collapsed ? "center" : undefined,
        }}
        className={fontClass}
        onClick={isMobileOverlay ? onClose : undefined}
      >
        <div style={s.profileCardTop}>
          <div style={s.profileCardAvatar}>
            <FitText
              style={{ ...s.profileAvatarText, fontSize: 20, fontWeight: 700 }}
              excludeGlobalScale
            >
              {initials}
            </FitText>
          </div>
          {!collapsed ? (
            <div style={s.profileCardInfo}>
              <FitText
                style={{
                  ...s.profileName,
                  fontSize: 16,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "block",
                }}
                excludeGlobalScale
              >
                {user?.name ?? "Admin"}
              </FitText>
              <div style={s.profileManageWrap}>
                <Settings size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
                <FitText as="p" style={s.profileManage} excludeGlobalScale>
                  Manage Profile Details
                </FitText>
              </div>
            </div>
          ) : null}
        </div>
      </Link>
      <div style={s.profileSeparator} />
      <nav style={s.navList}>
        {visibleNav.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? path === "/dashboard"
              : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={fontClass}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              style={{
                ...s.navItem(isActive),
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                padding: collapsed ? "14px 10px" : s.navItem(isActive).padding,
              }}
              onClick={isMobileOverlay ? onClose : undefined}
            >
              <item.icon size={22} strokeWidth={2} style={{ flexShrink: 0 }} />
              {!collapsed ? (
                <>
                  <FitText
                    as="span"
                    style={{ ...s.navLabel(isActive), fontSize: 16, flex: 1 }}
                    excludeGlobalScale
                  >
                    {item.label}
                  </FitText>
                  {isActive ? (
                    <ChevronRight
                      size={18}
                      style={s.navChevron}
                      className="shrink-0"
                    />
                  ) : null}
                </>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div style={s.logoutSeparator} />
      {message ? (
        <FitText
          style={{ fontSize: 13, color: colors.warning, marginBottom: 8 }}
          excludeGlobalScale
        >
          {message}
        </FitText>
      ) : null}
      <FitButton
        variant="sidebarLogout"
        icon={LogOut}
        iconSize={21}
        onClick={() => setLogoutOpen(true)}
        aria-label={collapsed ? "Sign out" : "SIGN OUT"}
        title={collapsed ? "Sign out" : undefined}
        style={{
          ...s.logoutBtn,
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? "14px 10px" : s.logoutBtn.padding,
        }}
      >
        {!collapsed ? "SIGN OUT" : ""}
      </FitButton>
      <ConfirmModal
        isOpen={logoutOpen}
        title="Logging out?"
        message="You'll need to sign back in to access FitTrack."
        confirmLabel={CONFIRM_COPY.logout.confirmLabel}
        loadingLabel={CONFIRM_COPY.logout.loadingLabel}
        confirmIcon={LogOut}
        isDanger
        isLoading={logoutLoading}
        onCancel={() => {
          if (!logoutLoading) setLogoutOpen(false);
        }}
        onConfirm={handleLogout}
      />
    </aside>
  );
}
