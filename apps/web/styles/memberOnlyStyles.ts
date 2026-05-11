import type { CSSProperties } from "react";
import type { ThemeColors } from "@fittrack/ui/tokens";

type Tone = "brand" | "danger" | "muted" | "success" | "warning";

export function getMemberOnlyToneColor(tone: Tone, colors: ThemeColors) {
  switch (tone) {
    case "danger":
      return colors.danger;
    case "success":
      return colors.success;
    case "warning":
      return colors.warning;
    case "muted":
      return colors.textMuted;
    default:
      return colors.brand;
  }
}

export function makeMemberOnlyStyles(colors: ThemeColors) {
  return {
    screen: {
      color: colors.textPrimary,
      display: "flex",
      minHeight: "100%",
      width: "100%",
    } as CSSProperties,
    sectionHeaderRow: {
      alignItems: "center",
      display: "flex",
      gap: 12,
      justifyContent: "space-between",
    } as CSSProperties,
    sectionHeading: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "0.08em",
      margin: 0,
      textTransform: "uppercase",
    } as CSSProperties,
    surface: (dashed = false, extra?: CSSProperties): CSSProperties => ({
      backgroundColor: colors.surface,
      border: `1px ${dashed ? "dashed" : "solid"} ${colors.border}`,
      borderRadius: 14,
      overflow: "hidden",
      ...extra,
    }),
    surfacePadded: {
      display: "grid",
      gap: 12,
      padding: 16,
    } as CSSProperties,
    card: (selected: boolean, hasBorder: boolean, clickable: boolean): CSSProperties => ({
      alignItems: "center",
      backgroundColor: selected ? `${colors.brand}12` : colors.surface,
      border: selected ? `1.5px solid ${colors.brand}` : "1px solid transparent",
      borderBottom: hasBorder ? `1px solid ${colors.border}` : "1px solid transparent",
      borderRadius: 0,
      color: colors.textPrimary,
      cursor: clickable ? "pointer" : "default",
      display: "flex",
      gap: 12,
      minHeight: 72,
      padding: "14px 16px",
      textAlign: "left",
      width: "100%",
    }),
    cardIcon: (iconBg?: string, iconColor?: string): CSSProperties => ({
      alignItems: "center",
      backgroundColor: iconBg ?? `${colors.brand}18`,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      color: iconColor ?? colors.brand,
      display: "flex",
      flexShrink: 0,
      height: 44,
      justifyContent: "center",
      width: 44,
    }),
    cardIconLabel: (iconColor?: string): CSSProperties => ({
      color: iconColor ?? colors.brand,
      fontSize: 13,
      fontWeight: 800,
    }),
    cardBody: (hasSubtitle: boolean): CSSProperties => ({
      display: "grid",
      flex: 1,
      gap: hasSubtitle ? 6 : 0,
      minWidth: 0,
    }),
    cardTitleRow: {
      alignItems: "flex-start",
      display: "flex",
      gap: 10,
      justifyContent: "space-between",
      minWidth: 0,
    } as CSSProperties,
    cardTitle: {
      color: colors.textPrimary,
      display: "block",
      fontSize: 15,
      fontWeight: 700,
      overflow: "hidden",
      overflowWrap: "anywhere",
      textOverflow: "ellipsis",
      whiteSpace: "normal",
    } as CSSProperties,
    cardSubtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 1.45,
      margin: 0,
      overflowWrap: "anywhere",
    } as CSSProperties,
    trailingPill: (toneColor: string): CSSProperties => ({
      backgroundColor: `${toneColor}14`,
      border: `1px solid ${toneColor}44`,
      borderRadius: 999,
      color: toneColor,
      flexShrink: 0,
      fontSize: 11,
      fontWeight: 800,
      lineHeight: 1,
      padding: "6px 9px",
    }),
    statTile: {
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      display: "grid",
      gap: 6,
      minHeight: 96,
      padding: 14,
    } as CSSProperties,
    statLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: 600,
    } as CSSProperties,
    statValue: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: 800,
      lineHeight: 1,
    } as CSSProperties,
    progressTrack: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 5,
      overflow: "hidden",
    } as CSSProperties,
    progressFill: (progress: number, color?: string): CSSProperties => ({
      backgroundColor: color ?? colors.brand,
      borderRadius: 999,
      height: 5,
      width: `${Math.max(0, Math.min(progress, 1)) * 100}%`,
    }),
    emptyState: {
      alignItems: "center",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      justifyContent: "center",
      minHeight: 180,
      padding: 24,
      textAlign: "center",
    } as CSSProperties,
    emptyTitle: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: 700,
    } as CSSProperties,
    emptyHint: {
      color: colors.textMuted,
      fontSize: 13,
      margin: 0,
    } as CSSProperties,
    gateSurface: {
      backgroundColor: colors.surfaceRaised,
      display: "grid",
      gap: 12,
      padding: 16,
    } as CSSProperties,
    gateHeader: {
      alignItems: "center",
      display: "flex",
      gap: 12,
    } as CSSProperties,
    gateIcon: {
      alignItems: "center",
      backgroundColor: `${colors.brand}14`,
      border: `1px solid ${colors.brand}28`,
      borderRadius: 12,
      display: "flex",
      height: 40,
      justifyContent: "center",
      width: 40,
    } as CSSProperties,
    gateCopy: {
      display: "grid",
      flex: 1,
      gap: 3,
    } as CSSProperties,
    gateEyebrow: {
      color: colors.brand,
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: "0.08em",
    } as CSSProperties,
    gateTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: 800,
    } as CSSProperties,
    gateStatus: {
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: 700,
      padding: "6px 10px",
    } as CSSProperties,
    gateMessage: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 1.5,
      margin: 0,
    } as CSSProperties,
    chip: (active: boolean, disabled?: boolean): CSSProperties => ({
      backgroundColor: active ? `${colors.brand}14` : colors.surfaceRaised,
      border: `1px solid ${active ? colors.brand : colors.border}`,
      borderRadius: 999,
      color: active ? colors.brand : colors.textSecondary,
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: 12,
      fontWeight: 800,
      opacity: disabled ? 0.6 : 1,
      padding: "9px 12px",
    }),
    text: (variant: "body" | "brand" | "eyebrow" | "muted" | "subtitle" | "title"): CSSProperties => {
      const variants: Record<typeof variant, CSSProperties> = {
        body: {
          color: colors.textPrimary,
          fontSize: 14,
          lineHeight: 1.5,
          margin: 0,
        },
        brand: {
          color: colors.brand,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          margin: 0,
          textTransform: "uppercase",
        },
        eyebrow: {
          color: colors.textMuted,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          margin: 0,
          textTransform: "uppercase",
        },
        muted: {
          color: colors.textMuted,
          fontSize: 13,
          lineHeight: 1.45,
          margin: 0,
        },
        subtitle: {
          color: colors.textMuted,
          fontSize: 14,
          lineHeight: 1.45,
          margin: 0,
        },
        title: {
          color: colors.textPrimary,
          fontSize: 23,
          fontWeight: 800,
          lineHeight: 1.2,
          margin: 0,
        },
      };
      return variants[variant];
    },
    toneSurface: (tone: Tone = "brand", extra?: CSSProperties): CSSProperties => {
      const toneColor = getMemberOnlyToneColor(tone, colors);
      return {
        backgroundColor: `${toneColor}12`,
        border: `1px solid ${toneColor}30`,
        borderRadius: 14,
        display: "grid",
        gap: 12,
        padding: 16,
        ...extra,
      };
    },
    hero: {
      backgroundColor: colors.brand,
      borderRadius: 14,
      color: colors.onBrand,
      display: "grid",
      gap: 14,
      padding: 18,
    } as CSSProperties,
    heroText: (size: "caption" | "title" | "body"): CSSProperties => {
      if (size === "title") {
        return {
          color: colors.onBrand,
          fontSize: 26,
          fontWeight: 800,
          lineHeight: 1.15,
          margin: 0,
        };
      }
      if (size === "body") {
        return {
          color: colors.onBrand,
          fontSize: 13,
          lineHeight: 1.45,
          margin: 0,
          opacity: 0.88,
        };
      }
      return {
        color: colors.onBrand,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.08em",
        margin: 0,
        opacity: 0.9,
        textTransform: "uppercase",
      };
    },
    pill: (tone: Tone = "brand"): CSSProperties => {
      const toneColor = getMemberOnlyToneColor(tone, colors);
      return {
        backgroundColor: `${toneColor}12`,
        border: `1px solid ${toneColor}38`,
        borderRadius: 999,
        color: toneColor,
        display: "inline-flex",
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1,
        padding: "7px 10px",
        width: "fit-content",
      };
    },
    inlineRow: {
      alignItems: "center",
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
    } as CSSProperties,
    splitRow: {
      alignItems: "center",
      display: "flex",
      gap: 12,
      justifyContent: "space-between",
    } as CSSProperties,
    swatch: (base: string, brand: string): CSSProperties => ({
      background: `linear-gradient(135deg, ${base} 50%, ${brand} 50%)`,
      border: `1px solid ${colors.border}`,
      borderRadius: 6,
      height: 28,
      width: 56,
    }),
  };
}
