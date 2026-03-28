"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, LayoutDashboard, Users, CalendarDays, Grid2X2, Package, BarChart2, Settings, LogOut, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTheme, useFontClass } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTimedMessage } from "@fittrack/hooks";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { sidebarStyles } from "@/styles/layoutStyles";
import { CONFIRM_COPY } from "@/utils/confirmCopy";
import { sleep } from "@/utils/sleep";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import { ConfirmModal } from "@/components/modals";

type NavItem = { href: string; label: string; icon: LucideIcon; roles?: ("ADMIN" | "STAFF")[] };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/facilities", label: "Facilities", icon: Grid2X2, roles: ["ADMIN"] },
  { href: "/inventory", label: "Inventory", icon: Package, roles: ["ADMIN"] },
  { href: "/analytics", label: "Analytics", icon: BarChart2, roles: ["ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings }
];

type Props = {
  isMobileOverlay?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ isMobileOverlay = false, onClose }: Props) {
  const path = usePathname() ?? "/";
  const { colors, activeThemeKey } = useTheme();
  const { user, logout } = useAuth();
  const { message, showMessage } = useTimedMessage(FEEDBACK_DURATION_MS.standard);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const fontClass = useFontClass();
  const s = sidebarStyles(colors, activeThemeKey);
  const initials = user?.avatarInitials ?? user?.name?.slice(0, 2).toUpperCase() ?? "AU";
  const isProfileActive = path.startsWith("/profile");
  const portalLabel = user?.role === "STAFF" ? "Staff Portal" : "Admin Portal";
  const visibleNav = useMemo(
    () => NAV.filter((item) => !item.roles || item.roles.includes((user?.role as "ADMIN" | "STAFF") ?? "ADMIN")),
    [user?.role]
  );

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    showMessage("Logging out...");
    await sleep(FEEDBACK_DURATION_MS.standard);
    await logout();
  };

  return (
    <aside style={s.sidebar}>
      <div style={s.logoRow}>
        <div style={s.logoMark}>
          <Dumbbell size={25} color="white" strokeWidth={2} />
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 0
          }}
        >
          <FitText
            style={{
              ...s.logoTitle,
              fontSize: 25,
              fontWeight: 700,
              lineHeight: 1.04,
              display: "block",
              margin: 0
            }}
            excludeGlobalScale
          >
            FitTrack
          </FitText>
          <FitText
            as="p"
            style={{
              ...s.logoSubtitle,
              fontSize: 14,
              lineHeight: 1.1,
              display: "block",
              margin: "2px 0 0"
            }}
            excludeGlobalScale
          >
            {portalLabel}
          </FitText>
        </div>
      </div>
      <div style={s.topSeparator} />
      <Link
        href="/profile"
        style={s.profileCard(isProfileActive)}
        className={fontClass}
        onClick={isMobileOverlay ? onClose : undefined}
      >
        <div style={s.profileCardTop}>
          <div style={s.profileCardAvatar}>
            <FitText style={{ ...s.profileAvatarText, fontSize: 20, fontWeight: 700 }} excludeGlobalScale>
              {initials}
            </FitText>
          </div>
          <div style={s.profileCardInfo}>
            <FitText
              style={{
                ...s.profileName,
                fontSize: 16,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block"
              }}
              excludeGlobalScale
            >
              {user?.name ?? "Admin"}
            </FitText>
            <div style={s.profileManageWrap}>
              <Settings size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
              <FitText as="p" style={s.profileManage} excludeGlobalScale>Manage Profile Details</FitText>
            </div>
          </div>
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
              style={{ ...s.navItem(isActive), alignItems: "center" }}
              onClick={isMobileOverlay ? onClose : undefined}
            >
              <item.icon size={22} strokeWidth={2} style={{ flexShrink: 0 }} />
              <FitText
                as="span"
                style={{ ...s.navLabel(isActive), fontSize: 17, flex: 1 }}
                excludeGlobalScale
              >
                {item.label}
              </FitText>
              {isActive ? (
                <ChevronRight size={18} style={s.navChevron} className="shrink-0" />
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div style={s.logoutSeparator} />
      {message ? (
        <FitText style={{ fontSize: 13, color: colors.warning, marginBottom: 8 }} excludeGlobalScale>
          {message}
        </FitText>
      ) : null}
      <FitButton
        variant="sidebarLogout"
        icon={LogOut}
        iconSize={21}
        onClick={() => setLogoutOpen(true)}
        aria-label="SIGN OUT"
        style={s.logoutBtn}
      >
        SIGN OUT
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
        onCancel={() => { if (!logoutLoading) setLogoutOpen(false); }}
        onConfirm={handleLogout}
      />
    </aside>
  );
}
