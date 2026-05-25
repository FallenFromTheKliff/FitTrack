"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { type PageKey } from "@fittrack/app-config";
import type { Role } from "@fittrack/types";

import { useAuth } from "@/contexts/AuthContext";
import { MemberProvider } from "@/contexts/MemberContext";
import { ScheduleProvider } from "@/contexts/ScheduleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import {
  canAccessWebPage,
  getWebPortalFallbackPath,
  isWebPortalRole,
} from "@/lib/portal-access";
import { SIDEBAR_WIDTH, layoutStyles } from "@/styles/layoutStyles";

import { AnalyticsSectionFilterProvider } from "@/contexts/AnalyticsSectionFilterContext";
import { FitText } from "@/components/fit/FitText";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { getBrowserViewportState } from "@/utils/browserViewport";

function getPageKey(pathname: string, role: Role | null | undefined): PageKey {
  if (role === "USER") {
    if (pathname.startsWith("/facilities")) return "member-facilities";
    if (pathname.startsWith("/bookings")) return "member-bookings";
    if (pathname.startsWith("/nutrition")) return "member-nutrition";
    if (pathname.startsWith("/mastery")) return "member-mastery";
    if (pathname.startsWith("/workout")) return "member-workout";
    if (pathname.startsWith("/profile")) return "member-profile";
    if (pathname.startsWith("/dashboard")) return "member-home";
  }

  if (role === "COACH") {
    if (pathname.startsWith("/dashboard")) return "coach-dashboard";
    if (pathname.startsWith("/accounts")) return "coach-clients";
    if (pathname.startsWith("/schedule")) return "coach-sessions";
    if (pathname.startsWith("/analytics")) return "coach-earnings";
    if (pathname.startsWith("/gamification")) return "coach-gamification";
    if (pathname.startsWith("/exercise-lab")) return "coach-exercise-lab";
  }

  if (pathname.startsWith("/bookings")) return "member-bookings";
  if (pathname.startsWith("/nutrition")) return "member-nutrition";
  if (pathname.startsWith("/mastery")) return "member-mastery";
  if (pathname.startsWith("/workout")) return "member-workout";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/memberships-promos")) return "memberships-promos";
  if (pathname.startsWith("/accounts")) return "accounts";
  if (pathname.startsWith("/schedule")) return "schedule";
  if (pathname.startsWith("/milestones")) return "milestones";
  if (pathname.startsWith("/exercise-lab")) return "exercise-lab";
  if (pathname.startsWith("/gamification")) return "gamification";
  if (pathname.startsWith("/gym-actions")) return "gym-actions";
  if (pathname.startsWith("/ai")) return "ai";
  if (pathname.startsWith("/facilities")) return "facilities";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/analytics")) return "analytics";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/profile")) return "profile";
  return "dashboard";
}

const BACKGROUND_LINES = Array.from({ length: 4 }, (_, index) => index);
const BACKGROUND_WORDS = Array.from({ length: 24 }, (_, index) =>
  index % 2 === 0 ? "FITTRACK" : "SERTFIT",
);
const SIGN_OUT_BOTTOM_GAP = 31;
const LOGOUT_REDIRECT_STORAGE_KEY = "fittrack.logoutRedirectPath";
const FIXED_HEIGHT_PAGE_KEYS = new Set<PageKey>([
  "coach-dashboard",
  "accounts",
  "schedule",
  "facilities",
  "inventory",
  "exercise-lab",
  "ai",
  "coach-clients",
  "coach-sessions",
  "coach-earnings",
  "coach-gamification",
  "coach-exercise-lab",
  "member-home",
  "member-facilities",
  "member-bookings",
  "member-nutrition",
  "member-mastery",
  "member-workout",
  "member-profile",
]);

function takePendingLogoutRedirectPath() {
  if (typeof window === "undefined") return null;
  const path = window.sessionStorage.getItem(LOGOUT_REDIRECT_STORAGE_KEY);
  if (path !== "/login" && path !== "/member-login") return null;
  window.sessionStorage.removeItem(LOGOUT_REDIRECT_STORAGE_KEY);
  return path;
}

export default function AuthenticatedPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { colors, activeThemeKey } = useTheme();
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const s = layoutStyles(colors, activeThemeKey);
  const themeTransition = useThemeTransition();
  const pageKey = getPageKey(pathname, user?.role);
  const fallbackPath = getWebPortalFallbackPath(user?.role);

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const mobileSidebarRef = useRef<HTMLDivElement | null>(null);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const [isHamburgerMode, setIsHamburgerMode] = useState(false);
  const [isBodyScrolling, setIsBodyScrolling] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(takePendingLogoutRedirectPath() ?? "/login");
      return;
    }
    if (!isWebPortalRole(user?.role)) {
      router.replace("/login");
      return;
    }
    if (!canAccessWebPage(user.role, pageKey)) {
      router.replace(fallbackPath);
    }
  }, [fallbackPath, isLoading, isAuthenticated, pageKey, router, user?.role]);

  useEffect(() => {
    const evaluateViewportMode = () => {
      const { isBrowserWindowResized, viewportWidth } =
        getBrowserViewportState();

      setIsHamburgerMode(isBrowserWindowResized || viewportWidth < 1024);
    };
    evaluateViewportMode();
    window.addEventListener("resize", evaluateViewportMode);
    window.visualViewport?.addEventListener("resize", evaluateViewportMode);
    return () => {
      window.removeEventListener("resize", evaluateViewportMode);
      window.visualViewport?.removeEventListener("resize", evaluateViewportMode);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (scrollIdleTimerRef.current) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMobileOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isMobileOpen]);

  useEffect(() => {
    if (!isMobileOpen || !isHamburgerMode) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        mobileSidebarRef.current &&
        target &&
        mobileSidebarRef.current.contains(target)
      ) {
        return;
      }
      setIsMobileOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isMobileOpen, isHamburgerMode]);

  useEffect(() => {
    if (!isHamburgerMode && isMobileOpen) setIsMobileOpen(false);
  }, [isHamburgerMode, isMobileOpen]);

  const handleContentScroll = () => {
    setIsBodyScrolling(true);
    if (scrollIdleTimerRef.current) {
      window.clearTimeout(scrollIdleTimerRef.current);
    }
    scrollIdleTimerRef.current = window.setTimeout(() => {
      setIsBodyScrolling(false);
    }, 5000);
  };

  if (isLoading || !isAuthenticated) return null;
  if (!isWebPortalRole(user?.role) || !canAccessWebPage(user.role, pageKey))
    return null;

  const locksToSignOutBoundary =
    !isHamburgerMode && FIXED_HEIGHT_PAGE_KEYS.has(pageKey);

  let content = (
    <div className={themeTransition} style={s.root}>
      <div
        className="fit-layout-background"
        style={s.backgroundLayer}
        aria-hidden="true"
      >
        {BACKGROUND_LINES.map((line) => (
          <div
            key={line}
            className="fit-layout-background-line"
            style={s.backgroundLine(line)}
          >
            {BACKGROUND_WORDS.map((word, index) => (
              <FitText
                key={`${line}-${index}`}
                as="span"
                style={s.backgroundWord(index)}
                excludeGlobalScale
              >
                {word}
              </FitText>
            ))}
          </div>
        ))}
        <div
          className="fit-layout-background-fade"
          style={s.backgroundFadeLeft}
        />
        <div
          className="fit-layout-background-fade"
          style={s.backgroundFadeRight}
        />
      </div>
      {!isHamburgerMode ? (
        <div
          style={{
            ...s.desktopSidebarWrap,
            width: SIDEBAR_WIDTH,
          }}
        >
          <Sidebar />
        </div>
      ) : null}
      <div style={s.main}>
        <AnalyticsSectionFilterProvider key={pageKey}>
          <main style={s.content}>
            <Header
              onMenuToggle={() => setIsMobileOpen((v) => !v)}
              showMenuButton={isHamburgerMode}
              pageKey={pageKey}
            />
            <div
              className={
                isBodyScrolling
                  ? "fit-browser-scrollpane fit-browser-scrollpane-active"
                  : "fit-browser-scrollpane"
              }
              data-fit-fixed-height={locksToSignOutBoundary ? pageKey : undefined}
              style={{
                ...s.contentBody,
                ...(locksToSignOutBoundary
                  ? {
                      display: "flex",
                      flexDirection: "column",
                      marginBottom: SIGN_OUT_BOTTOM_GAP,
                      overflowY: "hidden",
                      paddingBottom: 0,
                    }
                  : null),
              }}
              onScroll={handleContentScroll}
            >
              {children}
            </div>
          </main>
        </AnalyticsSectionFilterProvider>
      </div>
      {isHamburgerMode ? (
        <>
          <div
            className="fixed inset-0"
            style={{
              ...s.mobileSidebarBackdrop,
              opacity: isMobileOpen ? 1 : 0,
              pointerEvents: isMobileOpen ? "auto" : "none",
              transition: "opacity 200ms ease",
            }}
            onClick={() => setIsMobileOpen(false)}
          />
          <div
            className="fixed top-0 left-0 h-full"
            style={{
              ...s.mobileSidebarPanel,
              transform: isMobileOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 250ms ease",
            }}
            onClick={(event) => event.stopPropagation()}
            ref={mobileSidebarRef}
          >
            <Sidebar isMobileOverlay onClose={() => setIsMobileOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  );

  if (pageKey === "schedule" || pageKey === "coach-sessions") {
    content = <ScheduleProvider>{content}</ScheduleProvider>;
  }

  if (pageKey === "accounts" || pageKey === "coach-clients") {
    content = <MemberProvider>{content}</MemberProvider>;
  }

  return content;
}
