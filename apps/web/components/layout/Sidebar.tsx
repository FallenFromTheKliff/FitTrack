"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Apple,
  Building2,
  CalendarCheck,
  Dumbbell,
  Home,
  MessageCircle,
  Users,
  CalendarDays,
  Grid2X2,
  Package,
  BarChart2,
  Settings,
  LogOut,
  ChevronRight,
  Bot,
  BadgePercent,
  ClipboardList,
  Trophy,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PageKey } from "@fittrack/app-config";

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
  pageKey: PageKey;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const MANAGEMENT_NAV_SECTIONS: NavSection[] = [
  {
    label: "Main",
    items: [
      {
        href: "/analytics",
        label: "Data Analytics",
        icon: BarChart2,
        pageKey: "analytics",
      },
      { href: "/accounts", label: "Accounts", icon: Users, pageKey: "accounts" },
      {
        href: "/schedule",
        label: "Gym Operations",
        icon: CalendarDays,
        pageKey: "schedule",
      },
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
        href: "/gym-actions",
        label: "Gym Actions",
        icon: ClipboardList,
        pageKey: "gym-actions",
      },
    ],
  },
  {
    label: "Fitness Ops",
    items: [
      {
        href: "/gamification",
        label: "Gamification",
        icon: Trophy,
        pageKey: "gamification",
      },
      {
        href: "/exercise-lab",
        label: "Exercise Labs",
        icon: Dumbbell,
        pageKey: "exercise-lab",
      },
      {
        href: "/memberships-promos",
        label: "Memberships",
        icon: BadgePercent,
        pageKey: "memberships-promos",
      },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/ai", label: "BrodigyAI", icon: Bot, pageKey: "ai" },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        pageKey: "settings",
      },
    ],
  },
];

const COACH_NAV_SECTIONS: NavSection[] = [
  {
    label: "Main",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: Home,
        pageKey: "coach-dashboard",
      },
      {
        href: "/accounts",
        label: "Clients",
        icon: Users,
        pageKey: "coach-clients",
      },
      {
        href: "/schedule",
        label: "Sessions",
        icon: ClipboardList,
        pageKey: "coach-sessions",
      },
    ],
  },
  {
    label: "Performance",
    items: [
      {
        href: "/analytics",
        label: "Earnings",
        icon: WalletCards,
        pageKey: "coach-earnings",
      },
      {
        href: "/gamification",
        label: "Gamification",
        icon: Trophy,
        pageKey: "coach-gamification",
      },
      {
        href: "/exercise-lab",
        label: "Exercise Lab",
        icon: Dumbbell,
        pageKey: "coach-exercise-lab",
      },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/ai", label: "BrodigyAI", icon: Bot, pageKey: "ai" },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        pageKey: "settings",
      },
    ],
  },
];

const MEMBER_NAV_SECTIONS: NavSection[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Home", icon: Home, pageKey: "member-home" },
      {
        href: "/facilities",
        label: "Gym Facilities",
        icon: Building2,
        pageKey: "member-facilities",
      },
      {
        href: "/bookings",
        label: "Bookings",
        icon: CalendarCheck,
        pageKey: "member-bookings",
      },
    ],
  },
  {
    label: "Fitness Ops",
    items: [
      {
        href: "/nutrition",
        label: "Nutrition",
        icon: Apple,
        pageKey: "member-nutrition",
      },
      {
        href: "/mastery",
        label: "Muscle Mastery",
        icon: Trophy,
        pageKey: "member-mastery",
      },
      {
        href: "/workout",
        label: "Workout",
        icon: Dumbbell,
        pageKey: "member-workout",
      },
      {
        href: "/ai",
        label: "BrodigyAI",
        icon: MessageCircle,
        pageKey: "ai",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        pageKey: "settings",
      },
    ],
  },
];

function getNavSectionsForRole(role: string | null | undefined) {
  if (role === "USER") return MEMBER_NAV_SECTIONS;
  if (role === "COACH") return COACH_NAV_SECTIONS;
  return MANAGEMENT_NAV_SECTIONS;
}

function isRouteMatch(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}

type Props = {
  isMobileOverlay?: boolean;
  onClose?: () => void;
};

export default function Sidebar({
  isMobileOverlay = false,
  onClose,
}: Props) {
  const path = usePathname() ?? "/";
  const { colors, activeThemeKey } = useTheme();
  const { user, logout } = useAuth();
  const { message, showMessage } = useTimedMessage(
    FEEDBACK_DURATION_MS.standard,
  );
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const fontClass = useFontClass();
  const s = sidebarStyles(colors, activeThemeKey);
  const initials =
    user?.avatarInitials ?? user?.name?.slice(0, 2).toUpperCase() ?? "AU";
  const isCoach = user?.role === "COACH";
  const profileHref = "/profile";
  const isProfileActive = isRouteMatch(path, profileHref);
  const portalLabel = getWebPortalLabel(user?.role);
  const visibleNavSections = useMemo(
    () =>
      getNavSectionsForRole(user?.role)
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            canAccessWebPage(user?.role, item.pageKey),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [user?.role],
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
          <Dumbbell size={24} color={colors.onBrand} strokeWidth={2} />
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 0,
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
      </div>
      <div style={s.topSeparator} />
      <Link
        href={profileHref}
        style={s.profileCard(isProfileActive)}
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
          <div style={s.profileCardInfo}>
            <FitText
              style={{
                ...s.profileName,
                fontSize: 15,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
              excludeGlobalScale
            >
              {user?.name ?? (isCoach ? "Coach" : "Admin")}
            </FitText>
            <div style={s.profileManageWrap}>
              <Settings size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
              <FitText as="p" style={s.profileManage} excludeGlobalScale>
                Manage Profile Details
              </FitText>
            </div>
          </div>
        </div>
      </Link>
      <div style={s.profileSeparator} />
      <nav style={s.navList}>
        {visibleNavSections.map((section) => (
          <div key={section.label} style={s.navSection}>
            <FitText as="p" style={s.navSectionLabel} excludeGlobalScale>
              {section.label}
            </FitText>
            <div style={s.navSectionItems}>
              {section.items.map((item) => {
                const isActive =
                  item.href === "/analytics"
                    ? isRouteMatch(path, "/analytics")
                    : isRouteMatch(path, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={fontClass}
                    style={s.navItem(isActive)}
                    onClick={isMobileOverlay ? onClose : undefined}
                  >
                    <item.icon
                      size={22}
                      strokeWidth={2}
                      style={{ flexShrink: 0 }}
                    />
                    <FitText
                      as="span"
                      style={{
                        ...s.navLabel(isActive),
                        display: "block",
                        flex: 1,
                        fontSize: 14,
                      }}
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
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
        onCancel={() => {
          if (!logoutLoading) setLogoutOpen(false);
        }}
        onConfirm={handleLogout}
      />
    </aside>
  );
}
