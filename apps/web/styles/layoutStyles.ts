import type { CSSProperties } from "react";
import { themes, type ThemeColors } from "@fittrack/ui";
import type { ThemeKey } from "@fittrack/types";
import { getReadableTextColor } from "@/utils/contrast";

function getLayoutBackground(colors: ThemeColors, activeThemeKey?: ThemeKey): string {
    switch (activeThemeKey) {
        case "night":
            return "#151515";
        case "dark":
            return colors.base;
        case "navy":
            return colors.base;
        default:
            return colors.base;
    }
}

function getSidebarBackground(colors: ThemeColors, activeThemeKey?: ThemeKey): string {
    switch (activeThemeKey) {
        case "sunlight":
            return "#F3ECE3";
        case "dark":
            return "#121212";
        case "light":
            return "#E7EEF6";
        case "navy":
            return "#1B2531";
        default:
            return colors.base;
    }
}

export function layoutStyles(colors: ThemeColors, activeThemeKey?: ThemeKey) {
    const layoutBg = getLayoutBackground(colors, activeThemeKey);

    return {
        root: {
            display: "flex",
            height: "100vh",
            overflow: "hidden",
            backgroundColor: layoutBg
        } as CSSProperties,
        desktopSidebarWrap: {
            height: "100vh",
            overflow: "hidden",
            flexShrink: 0
        } as CSSProperties,
        main: {
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            overflow: "hidden"
        } as CSSProperties,
        content: {
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 24px 24px",
            backgroundColor: layoutBg
        } as CSSProperties,
        mobileSidebarBackdrop: {
            zIndex: 40,
            backgroundColor: colors.overlay
        } as CSSProperties,
        mobileSidebarPanel: {
            zIndex: 45,
            backgroundColor: colors.base,
            width: "min(84vw, 300px)"
        } as CSSProperties,
        notificationsBackdrop: {
            position: "fixed",
            inset: 0,
            zIndex: 55,
            backgroundColor: colors.overlay
        } as CSSProperties,
        notificationsPanel: {
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "min(420px, 92vw)",
            backgroundColor: colors.surface,
            borderLeft: `1px solid ${colors.border}`,
            color: colors.textPrimary,
            zIndex: 60,
            display: "flex",
            flexDirection: "column"
        } as CSSProperties,
        notificationsPanelHeader: {
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "20px 20px 16px",
            borderBottom: `1px solid ${colors.border}`
        } as CSSProperties,
        notificationsCloseBtn: {
            width: 30,
            height: 30,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surfaceRaised,
            color: colors.textPrimary,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center"
        } as CSSProperties,
        notificationsListWrap: {
            flex: 1,
            overflowY: "auto"
        } as CSSProperties,
        notificationsEmptyState: {
            minHeight: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            padding: 24,
            textAlign: "center"
        } as CSSProperties,
        notificationRow: {
            padding: "14px 20px"
        } as CSSProperties
    };
}

export function headerStyles(colors: ThemeColors, activeThemeKey?: ThemeKey) {
    const headerBg = getLayoutBackground(colors, activeThemeKey);
    const onDanger = getReadableTextColor(colors.danger, colors.textPrimary, themes.sunlight.surface);

    return {
        header: {
            minHeight: 96,
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            position: "sticky",
            top: 0,
            zIndex: 30,
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: headerBg
        } as CSSProperties,
        leftSection: {
            flex: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "10px 20px",
            gap: 10,
            backgroundColor: headerBg
        } as CSSProperties,
        rightSection: {
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 16px",
            position: "relative",
            backgroundColor: "transparent",
            borderLeft: "none",
            overflow: "visible"
        } as CSSProperties,
        messageWrap: {
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minWidth: 0,
            flex: 1
        } as CSSProperties,
        messageTitle: {
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
        } as CSSProperties,
        messageSubtitle: {
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 6,
            marginBottom: 0,
            lineHeight: 1.35,
            paddingBottom: 2,
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
        } as CSSProperties,
        iconBtn: {
            width: 44,
            height: 44,
            borderRadius: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: colors.textMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        } as CSSProperties,
        notificationButton: {
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            minWidth: 44,
            minHeight: 44,
            backgroundColor: "transparent",
            border: "none",
            boxShadow: "none",
            padding: 0,
            color: colors.textPrimary
        } as CSSProperties,
        unreadBadge: {
            position: "absolute",
            top: 4,
            right: -8,
            minWidth: 18,
            height: 18,
            borderRadius: 10,
            backgroundColor: colors.danger,
            border: `2px solid ${colors.surface}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            color: onDanger,
            lineHeight: 1,
            padding: "0 3px"
        } as CSSProperties
    };
}

export function sidebarStyles(colors: ThemeColors, activeThemeKey?: ThemeKey) {
    const onBrand = colors.onBrand ?? getReadableTextColor(colors.brand, colors.textPrimary, themes.sunlight.surface);

    const sidebarBg = getSidebarBackground(colors, activeThemeKey);
    const sidebarBorder = colors.border;
    const separatorColor = colors.border;

    const textPrimary = colors.textPrimary;
    const textMuted = colors.textMuted;
    const manageText = colors.brand;

    const cardBg = colors.surfaceRaised;
    const cardBorder = colors.border;

    return {
        sidebar: {
            backgroundColor: sidebarBg,
            borderRight: `1px solid ${sidebarBorder}`,
            padding: "0 14px 20px",
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            width: 300,
            overflow: "hidden"
        } as CSSProperties,
        logoRow: {
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
            minHeight: 96,
            padding: "0 6px",
            marginTop: 0,
            marginBottom: 0,
            flexShrink: 0
        } as CSSProperties,
        topSeparator: {
            width: "100%",
            height: 1,
            backgroundColor: separatorColor,
            marginBottom: 14,
            flexShrink: 0
        } as CSSProperties,
        logoTitle: {
            color: textPrimary
        } as CSSProperties,
        logoSubtitle: {
            color: textMuted
        } as CSSProperties,
        logoMark: {
            width: 46,
            height: 46,
            borderRadius: 10,
            backgroundColor: colors.brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
        } as CSSProperties,
        profileCard: (active: boolean): CSSProperties => ({
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "14px 14px",
            borderRadius: 12,
            marginBottom: 10,
            cursor: "pointer",
            backgroundColor: cardBg,
            border: `1px solid ${active ? colors.brand : cardBorder}`,
            boxShadow: "none",
            textDecoration: "none",
            flexShrink: 0
        }),
        profileCardTop: {
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            width: "100%"
        } as CSSProperties,
        profileSeparator: {
            width: "100%",
            height: 1,
            backgroundColor: separatorColor,
            marginBottom: 14,
            flexShrink: 0
        } as CSSProperties,
        profileCardAvatar: {
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: colors.brand,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
        } as CSSProperties,
        profileName: {
            color: textPrimary
        } as CSSProperties,
        profileAvatarText: {
            color: onBrand
        } as CSSProperties,
        profileCardInfo: {
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            textAlign: "left",
            justifyContent: "flex-start",
            gap: 4,
            paddingTop: 2
        } as CSSProperties,
        profileManageWrap: {
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
            marginLeft: -1,
            alignSelf: "flex-start",
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: "3px 7px",
            width: "fit-content",
            backgroundColor: sidebarBg,
            color: manageText
        } as CSSProperties,
        profileManage: {
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            color: manageText,
            margin: 0,
            width: "fit-content"
        } as CSSProperties,
        navList: {
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            paddingBottom: 16
        } as CSSProperties,
        navItem: (active: boolean): CSSProperties => ({
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 14px",
            borderRadius: 12,
            cursor: "pointer",
            backgroundColor: active ? colors.brand : "transparent",
            color: active ? onBrand : textMuted,
            fontSize: 16,
            fontWeight: active ? 600 : 400,
            border: "none",
            width: "100%",
            textAlign: "left",
            transition: "background-color 0.15s",
            textDecoration: "none",
            overflow: "hidden",
            whiteSpace: "nowrap"
        }),
                navLabel: (active: boolean): CSSProperties => ({
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            color: active ? onBrand : textMuted
        }),
        navChevron: {
            fontSize: 20,
            fontWeight: 600,
            lineHeight: 1,
            marginLeft: 8,
            flexShrink: 0
        } as CSSProperties,
        logoutSeparator: {
            width: "100%",
            height: 1,
            backgroundColor: separatorColor,
            marginTop: 10,
            marginBottom: 12,
            flexShrink: 0
        } as CSSProperties,
        logoutBtn: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 14px",
            marginTop: 0,
            borderRadius: 12,
            cursor: "pointer",
            background: "none",
            border: `1px solid ${colors.danger}`,
            color: colors.danger,
            fontSize: 16,
            fontWeight: 600,
            width: "100%",
            textAlign: "left",
            flexShrink: 0
        } as CSSProperties
    };
}
