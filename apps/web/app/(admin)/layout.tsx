"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useDebounce } from "@fittrack/hooks";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { layoutStyles } from "@/styles/layoutStyles";
import type { PageKey } from "@/data/ui/labels";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

function getPageKey(pathname: string): PageKey {
  if (pathname.startsWith("/members")) return "members";
  if (pathname.startsWith("/schedule")) return "schedule";
  if (pathname.startsWith("/facilities")) return "facilities";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/analytics")) return "analytics";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/chatbot")) return "chatbot";
  if (pathname.startsWith("/profile")) return "profile";
  return "dashboard";
}

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
    const screenWidth = window.screen?.availWidth || window.screen?.width || window.innerWidth;
    return debouncedViewportWidth <= screenWidth * 0.6;
  }, [debouncedViewportWidth]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user?.role !== "ADMIN" && user?.role !== "STAFF") {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, user?.role, router]);

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
      if (mobileSidebarRef.current && target && mobileSidebarRef.current.contains(target)) {
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
  if (user?.role !== "ADMIN" && user?.role !== "STAFF") return null;

  return (
    <div className={themeTransition} style={s.root}>
      {!isHalfScreenOrLess ? <div style={s.desktopSidebarWrap}><Sidebar /></div> : null}
      <div style={s.main}>
        <Header onMenuToggle={() => setIsMobileOpen((v) => !v)} showMenuButton={isHalfScreenOrLess} pageKey={pageKey} />
        <main style={s.content}>{children}</main>
      </div>
      {isHalfScreenOrLess ? (
        <>
          <div
            className="fixed inset-0"
            style={{
              ...s.mobileSidebarBackdrop,
              opacity: isMobileOpen ? 1 : 0,
              pointerEvents: isMobileOpen ? "auto" : "none",
              transition: "opacity 200ms ease"
            }}
            onClick={() => setIsMobileOpen(false)}
          />
          <div
            className="fixed top-0 left-0 h-full"
            style={{
              ...s.mobileSidebarPanel,
              transform: isMobileOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 250ms ease"
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
}