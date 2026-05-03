import type { CSSProperties } from "react";
import type { ThemeColors } from "@fittrack/ui/tokens";

export function authStyles(colors: ThemeColors) {
  return {
    screen: {
      minHeight: "100vh",
      display: "flex",
      backgroundColor: colors.base
    } as CSSProperties,
    bgOverlay: {
      position: "fixed",
      inset: 0,
      backgroundSize: "cover",
      backgroundPosition: "center",
      filter: "brightness(0.25)",
      zIndex: 0
    } as CSSProperties,
    content: {
      position: "relative",
      zIndex: 1,
      display: "flex",
      width: "100%",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0",
      maxWidth: "100%",
      margin: "0"
    } as CSSProperties,
    heroPanel: {
      display: "none",
      flex: "1 1 0%",
      minWidth: 0,
      minHeight: "100vh",
      alignItems: "center",
      justifyContent: "center",
      paddingLeft: 48,
      paddingRight: 24
    } as CSSProperties,
    heroPanelInner: {
      width: "100%",
      maxWidth: 480
    } as CSSProperties,
    heroTitle: {
      fontSize: 58,
      fontWeight: 800,
      lineHeight: 1.1,
      color: colors.textPrimary
    } as CSSProperties,
    heroTitleAccent: {
      fontSize: 58,
      fontWeight: 800,
      lineHeight: 1.1,
      color: colors.brand
    } as CSSProperties,
    heroSubtitle: {
      fontSize: 16,
      color: "rgba(255,255,255,0.55)",
      marginTop: 12,
      maxWidth: 360
    } as CSSProperties,
    heroStatsRow: {
      marginTop: 24,
      display: "flex",
      gap: 16
    } as CSSProperties,
    heroStatItem: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      minWidth: 0,
      fontSize: 12,
      color: "rgba(255,255,255,0.4)",
      borderLeft: `2px solid ${colors.brand}`,
      paddingLeft: 10
    } as CSSProperties,
    heroStatValue: {
      fontSize: 20,
      fontWeight: 700,
      lineHeight: 1.1,
      color: colors.textPrimary
    } as CSSProperties,
    heroStatLabel: {
      fontSize: 12,
      color: "rgba(255,255,255,0.4)",
      textTransform: "uppercase",
      letterSpacing: 0.4
    } as CSSProperties,
    card: {
      backgroundColor: `${colors.surface}CC`,
      border: `1px solid ${colors.border}`,
      borderRadius: 0,
      padding: "48px 41px",
      width: "min(100%, 560px)",
      maxWidth: 560,
      minWidth: 320,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      backdropFilter: "blur(4px)",
      flexShrink: 0
    } as CSSProperties,
    cardInner: {
      width: "100%",
      maxWidth: 420,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center"
    } as CSSProperties,
    cardHeader: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      marginBottom: 12,
      transform: "translateY(-14px)"
    } as CSSProperties,
    logoCircle: {
      width: 58,
      height: 58,
      borderRadius: 10,
      backgroundColor: colors.brand,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      margin: 0
    } as CSSProperties,
    brandRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      marginTop: 0
    } as CSSProperties,
    brandRowWrap: {
      width: "100%",
      display: "flex",
      justifyContent: "center"
    } as CSSProperties,
    title: {
      fontSize: 36,
      fontWeight: 700,
      color: colors.textPrimary,
      textAlign: "center"
    } as CSSProperties,
    subtitle: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 2
    } as CSSProperties,
    badge: {
      display: "inline-block",
      fontSize: 13,
      fontWeight: 600,
      color: colors.brand,
      backgroundColor: `${colors.brand}18`,
      border: `1px solid ${colors.brand}40`,
      borderRadius: 10,
      padding: "3px 12px",
      marginTop: 7
    } as CSSProperties,
    fields: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginTop: 24
    } as CSSProperties,
    fieldItem: {
      width: "100%"
    } as CSSProperties,
    loginInputRow: {
      paddingLeft: 18,
      paddingRight: 18,
      paddingTop: 15,
      paddingBottom: 15,
      minHeight: 56
    } as CSSProperties,
    forgotRow: {
      width: "100%"
    } as CSSProperties,
    forgotBtn: {
      background: "none",
      border: "none",
      cursor: "pointer",
      fontSize: 14,
      color: colors.brand,
      textAlign: "right",
      padding: "2px 0",
      display: "block",
      marginLeft: "auto"
    } as CSSProperties,
    errorBanner: {
      backgroundColor: `${colors.danger}15`,
      border: `1px solid ${colors.danger}40`,
      borderRadius: 8,
      padding: "10px 14px",
      marginTop: 10
    } as CSSProperties,
    errorRow: {
      display: "flex",
      alignItems: "center",
      gap: 8
    } as CSSProperties,
    errorText: {
      fontSize: 16,
      color: colors.danger
    } as CSSProperties,
    errorMeta: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2
    } as CSSProperties,
    copyright: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 24
    } as CSSProperties,
    signInWrap: {
      width: "100%",
      marginTop: 14
    } as CSSProperties,
    loginPrimaryBtn: {
      minHeight: 64,
      paddingTop: 18,
      paddingBottom: 18,
      fontSize: 17,
      fontWeight: 800
    } as CSSProperties
  };
}
