"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { type PageKey } from "@fittrack/app-config";

import { useAuth } from "@/contexts/AuthContext";
import { MemberProvider } from "@/contexts/MemberContext";
import { ScheduleProvider } from "@/contexts/ScheduleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useDebounce } from "@fittrack/hooks";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { canAccessWebPage, isWebPortalRole } from "@/lib/portal-access";
import { SIDEBAR_WIDTH, layoutStyles } from "@/styles/layoutStyles";

import { AnalyticsSectionFilterProvider } from "@/contexts/AnalyticsSectionFilterContext";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

function getPageKey(pathname: string): PageKey {
  if (pathname.startsWith("/memberships-promos")) return "memberships-promos";
  if (pathname.startsWith("/members")) return "members";
  if (pathname.startsWith("/schedule")) return "schedule";
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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { colors, activeThemeKey } = useTheme();
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const s = layoutStyles(colors, activeThemeKey);
  const themeTransition = useThemeTransition();
  const pageKey = getPageKey(pathname);

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const mobileSidebarRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const debouncedViewportWidth = useDebounce(viewportWidth, 120);
  const isHalfScreenOrLess = useMemo(() => {
    if (!debouncedViewportWidth) return false;
    return debouncedViewportWidth < 1260;
  }, [debouncedViewportWidth]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!isWebPortalRole(user?.role)) {
      router.replace("/login");
      return;
    }
    if (!canAccessWebPage(user.role, pageKey)) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, pageKey, router, user?.role]);

  useEffect(() => {
    const evaluateViewportMode = () => {
      setViewportWidth(window.outerWidth || window.innerWidth);
    };
    evaluateViewportMode();
    window.addEventListener("resize", evaluateViewportMode);
    return () => window.removeEventListener("resize", evaluateViewportMode);
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
    if (!isMobileOpen || !isHalfScreenOrLess) return;
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
  }, [isMobileOpen, isHalfScreenOrLess]);

  useEffect(() => {
    if (!isHalfScreenOrLess && isMobileOpen) setIsMobileOpen(false);
  }, [isHalfScreenOrLess, isMobileOpen]);

  if (isLoading || !isAuthenticated) return null;
  if (!isWebPortalRole(user?.role) || !canAccessWebPage(user.role, pageKey))
    return null;

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
              <span key={`${line}-${index}`} style={s.backgroundWord(index)}>
                {word}
              </span>
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
      {!isHalfScreenOrLess ? (
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
              showMenuButton={isHalfScreenOrLess}
              pageKey={pageKey}
            />
            <div style={s.contentBody}>{children}</div>
          </main>
        </AnalyticsSectionFilterProvider>
      </div>
      {isHalfScreenOrLess ? (
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

  if (pageKey === "schedule") {
    content = <ScheduleProvider>{content}</ScheduleProvider>;
  }

  if (pageKey === "members") {
    content = <MemberProvider>{content}</MemberProvider>;
  }

  return content;
}
