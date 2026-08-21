"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Dumbbell,
  type LucideIcon
} from "lucide-react";
import type { ThemeColors } from "@fittrack/ui/tokens";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import { LOGIN_BACKGROUND_IMAGE_URL } from "@/data/auth/auth";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { authStyles } from "@/styles/authStyles";

type StatusTone = "brand" | "success" | "warning" | "danger";

type StatusAction = {
  href?: string;
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
  replace?: boolean;
  variant?: "ghost" | "primary";
};

type StatusDetail = {
  body: string;
  title: string;
};

export type AuthStatusPageProps = {
  Icon: LucideIcon;
  badge?: string;
  body: string;
  detailHeading?: string;
  detailItems?: readonly StatusDetail[];
  footerNote?: string;
  heroAccent?: string;
  heroCalloutBody?: string;
  heroCalloutTitle?: string;
  heroStats?: readonly string[];
  heroSubtitle: string;
  heroTitle: string;
  noticeBody: string;
  noticeTitle: string;
  primaryAction: StatusAction;
  secondaryAction?: StatusAction;
  title: string;
  tone?: StatusTone;
};

function resolveAccent(colors: ThemeColors, tone: StatusTone) {
  if (tone === "success") return colors.success;
  if (tone === "warning") return colors.warning;
  if (tone === "danger") return colors.danger;
  return colors.brand;
}

function makeStatusStyles(colors: ThemeColors, accent: string) {
  const base = authStyles(colors);
  return {
    ...base,
    badgeAccent: {
      ...base.badge,
      color: accent,
      backgroundColor: `${accent}18`,
      border: `1px solid ${accent}40`
    } as CSSProperties,
    actions: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      width: "100%"
    } as CSSProperties,
    card: {
      ...base.card,
      width: "min(100%, 560px)",
      maxWidth: 560
    } as CSSProperties,
    cardInner: {
      ...base.cardInner,
      alignItems: "stretch",
      gap: 18,
      textAlign: "left"
    } as CSSProperties,
    detailBody: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 1.7,
      marginTop: 4
    } as CSSProperties,
    detailIconWrap: {
      alignItems: "center",
      backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      display: "flex",
      height: 34,
      justifyContent: "center",
      minWidth: 34,
      width: 34
    } as CSSProperties,
    detailItem: {
      alignItems: "flex-start",
      display: "flex",
      gap: 12
    } as CSSProperties,
    detailList: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    } as CSSProperties,
    detailTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: 700
    } as CSSProperties,
    footerNote: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 1.7,
      textAlign: "center"
    } as CSSProperties,
    header: {
      ...base.cardHeader,
      marginBottom: 0,
      width: "100%"
    } as CSSProperties,
    heroCallout: {
      backdropFilter: "blur(6px)",
      backgroundColor: "rgba(14, 14, 14, 0.45)",
      border: `1px solid ${colors.border}`,
      borderRadius: 16,
      marginTop: 28,
      maxWidth: 420,
      padding: 18
    } as CSSProperties,
    heroCalloutBody: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 1.7,
      marginTop: 8
    } as CSSProperties,
    heroCalloutTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase"
    } as CSSProperties,
    heroSubtitle: {
      ...base.heroSubtitle,
      lineHeight: 1.7,
      maxWidth: 420
    } as CSSProperties,
    heroTitle: {
      ...base.heroTitle,
      maxWidth: 420
    } as CSSProperties,
    heroTitleAccent: {
      ...base.heroTitleAccent,
      maxWidth: 420
    } as CSSProperties,
    noticeBody: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 1.65,
      marginTop: 4
    } as CSSProperties,
    noticeCard: {
      alignItems: "flex-start",
      backgroundColor: `${accent}14`,
      border: `1px solid ${accent}33`,
      borderRadius: 16,
      display: "flex",
      gap: 12,
      padding: 16,
      width: "100%"
    } as CSSProperties,
    noticeTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: 700
    } as CSSProperties,
    sectionCard: {
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: 16,
      padding: 18,
      width: "100%"
    } as CSSProperties,
    sectionHeading: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.08em",
      marginBottom: 14,
      textTransform: "uppercase"
    } as CSSProperties,
    statusBody: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 1.7,
      marginTop: 8
    } as CSSProperties,
    statusIconWrap: {
      alignItems: "center",
      backgroundColor: `${accent}18`,
      border: `1px solid ${accent}40`,
      borderRadius: 16,
      display: "flex",
      height: 64,
      justifyContent: "center",
      minWidth: 64,
      width: 64
    } as CSSProperties,
    statusPanel: {
      alignItems: "flex-start",
      backgroundColor: colors.surface,
      border: `1px solid ${accent}40`,
      borderRadius: 16,
      boxShadow: `0 18px 42px ${colors.base}55`,
      display: "flex",
      gap: 16,
      padding: 20,
      width: "100%"
    } as CSSProperties,
    statusTitle: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: 700,
      lineHeight: 1.15,
      margin: 0
    } as CSSProperties
  };
}

export function AuthStatusPage({
  Icon,
  badge,
  body,
  detailHeading,
  detailItems,
  footerNote,
  heroAccent,
  heroCalloutBody,
  heroCalloutTitle,
  heroStats,
  heroSubtitle,
  heroTitle,
  noticeBody,
  noticeTitle,
  primaryAction,
  secondaryAction,
  title,
  tone = "brand"
}: AuthStatusPageProps) {
  const { colors, onBrandTextColor } = useTheme();
  const fadeIn = useFadeIn();
  const router = useRouter();
  const themeTransition = useThemeTransition();
  const accent = resolveAccent(colors, tone);
  const s = makeStatusStyles(colors, accent);
  const runAction = (action: StatusAction) => {
    if (action.onClick) {
      action.onClick();
      return;
    }
    if (!action.href) return;
    if (action.replace) {
      router.replace(action.href);
      return;
    }
    router.push(action.href);
  };

  return (
    <div className={themeTransition} style={s.screen}>
      <div style={{ ...s.bgOverlay, backgroundImage: LOGIN_BACKGROUND_IMAGE_URL }} />
      <div style={{ ...s.content, ...fadeIn }}>
        <div className="auth-status-hero" style={s.heroPanel}>
          <div style={s.heroPanelInner}>
            <FitText as="h1" style={s.heroTitle}>
              {heroTitle}
            </FitText>
            {heroAccent ? (
              <FitText as="h1" style={s.heroTitleAccent}>
                {heroAccent}
              </FitText>
            ) : null}
            <FitText as="p" style={s.heroSubtitle}>
              {heroSubtitle}
            </FitText>
            {heroStats?.length ? (
              <div style={s.heroStatsRow}>
                {heroStats.map((stat) => (
                  <div key={stat}>
                    <FitText as="span" style={s.heroStatItem}>
                      {stat}
                    </FitText>
                  </div>
                ))}
              </div>
            ) : null}
            {heroCalloutTitle && heroCalloutBody ? (
              <div style={s.heroCallout}>
                <FitText as="p" style={s.heroCalloutTitle}>
                  {heroCalloutTitle}
                </FitText>
                <FitText as="p" style={s.heroCalloutBody}>
                  {heroCalloutBody}
                </FitText>
              </div>
            ) : null}
          </div>
        </div>
        <div className="auth-status-card" style={s.card}>
          <div style={s.cardInner}>
            <div style={s.header}>
              <div style={s.brandRowWrap}>
                <div style={s.brandRow}>
                  <span style={s.logoCircle}>
                    <Dumbbell size={26} color={onBrandTextColor} strokeWidth={2} />
                  </span>
                  <FitText as="h2" style={s.title}>
                    FitTrack
                  </FitText>
                </div>
              </div>
              <FitText as="p" style={s.subtitle}>
                Gym Management System
              </FitText>
              {badge ? <span style={s.badgeAccent}>{badge}</span> : null}
            </div>

            <div className="auth-status-panel" style={s.statusPanel}>
              <div style={s.statusIconWrap}>
                <Icon size={32} color={accent} strokeWidth={1.8} />
              </div>
              <div>
                <FitText as="h1" style={s.statusTitle}>
                  {title}
                </FitText>
                <FitText as="p" style={s.statusBody}>
                  {body}
                </FitText>
              </div>
            </div>

            {detailItems?.length ? (
              <div style={s.sectionCard}>
                {detailHeading ? (
                  <FitText as="p" style={s.sectionHeading}>
                    {detailHeading}
                  </FitText>
                ) : null}
                <div style={s.detailList}>
                  {detailItems.map((item) => (
                    <div key={item.title} style={s.detailItem}>
                      <div style={s.detailIconWrap}>
                        <CheckCircle2 size={16} color={accent} strokeWidth={2} />
                      </div>
                      <div>
                        <FitText as="p" style={s.detailTitle}>
                          {item.title}
                        </FitText>
                        <FitText as="p" style={s.detailBody}>
                          {item.body}
                        </FitText>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={s.noticeCard}>
              <AlertTriangle size={16} color={accent} strokeWidth={2} />
              <div>
                <FitText as="p" style={s.noticeTitle}>
                  {noticeTitle}
                </FitText>
                <FitText as="p" style={s.noticeBody}>
                  {noticeBody}
                </FitText>
              </div>
            </div>

            <div style={s.actions}>
              <FitButton
                fullWidth
                icon={primaryAction.icon}
                label={primaryAction.label}
                onClick={() => runAction(primaryAction)}
                style={s.loginPrimaryBtn}
                variant={primaryAction.variant ?? "primary"}
              />
              {secondaryAction ? (
                <FitButton
                  fullWidth
                  icon={secondaryAction.icon}
                  label={secondaryAction.label}
                  onClick={() => runAction(secondaryAction)}
                  style={{ fontSize: 15, fontWeight: 700, minHeight: 56 }}
                  variant={secondaryAction.variant ?? "ghost"}
                />
              ) : null}
            </div>

            {footerNote ? (
              <FitText as="p" style={s.footerNote}>
                {footerNote}
              </FitText>
            ) : null}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 599px) {
          .auth-status-card {
            padding: 36px 24px !important;
          }
        }
        @media (max-width: 640px) {
          .auth-status-card {
            min-height: auto !important;
          }
        }
        @media (max-width: 720px) {
          .auth-status-card {
            max-width: none !important;
            width: 100% !important;
          }
        }
        @media (max-width: 760px) {
          .auth-status-panel {
            flex-direction: column;
          }
        }
        @media (min-width: 900px) {
          .auth-status-hero {
            align-items: center;
            display: flex !important;
            justify-content: flex-start;
            padding-left: 0;
            padding-right: 0;
          }
        }
      `}</style>
    </div>
  );
}
