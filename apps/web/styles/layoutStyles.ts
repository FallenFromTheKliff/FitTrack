import type { CSSProperties } from "react";
import { themes } from "@fittrack/ui/theme";
import type { ThemeColors } from "@fittrack/ui/tokens";
import type { ThemeKey } from "@fittrack/types";
import { getReadableTextColor } from "@fittrack/utils";

export const SIDEBAR_WIDTH = 280;

function getLayoutBackground(colors: ThemeColors): string {
    return colors.base;
}

function getSidebarBackground(colors: ThemeColors, activeThemeKey?: ThemeKey): string {
    switch (activeThemeKey) {
        case "sunlight":
            return colors.surfaceRaised;
        case "dark":
            return colors.surfaceRaised;
        case "light":
            return colors.surfaceRaised;
        case "navy":
            return colors.surfaceRaised;
        default:
            return colors.surfaceRaised;
    }
}

export function layoutStyles(colors: ThemeColors, activeThemeKey?: ThemeKey) {
    const layoutBg = getLayoutBackground(colors);
    const backgroundClusterColors = [colors.border, colors.surfaceRaised] as const;

    return {
        root: {
            display: "flex",
            height: "100vh",
            overflow: "hidden",
            backgroundColor: layoutBg,
            position: "relative",
            isolation: "isolate"
        } as CSSProperties,
        backgroundLayer: {
            zIndex: 0,
            backgroundColor: layoutBg
        } as CSSProperties,
        backgroundLine: (index: number): CSSProperties => {
            const clusterIndex = index % backgroundClusterColors.length;
            const clusterColor = backgroundClusterColors[clusterIndex];

            return {
                left: -420,
                right: -420,
                top: `${-9 + index * 32}%`,
                transform: "rotate(-3deg)",
                gap: 0,
                padding: "14px 0 16px",
                borderTop: `7px solid ${clusterColor}`,
                borderBottom: `7px solid ${clusterColor}`,
                color: clusterColor,
                opacity: activeThemeKey === "sunlight" || activeThemeKey === "light" ? 0.056 : 0.07,
                filter: "blur(1px)",
                fontSize: clusterIndex === 0 ? 192 : 176,
                lineHeight: 0.9,
                fontWeight: 900,
                letterSpacing: 0,
                userSelect: "none"
            };
        },
        backgroundWord: (_index: number): CSSProperties => ({
            color: "inherit"
        }),
        backgroundFadeLeft: {
            left: 0,
            width: "clamp(96px, 9vw, 170px)",
            background: `linear-gradient(90deg, ${layoutBg} 0%, transparent 100%)`
        } as CSSProperties,
        backgroundFadeRight: {
            right: 0,
            width: "clamp(96px, 9vw, 170px)",
            background: `linear-gradient(270deg, ${layoutBg} 0%, transparent 100%)`
        } as CSSProperties,
        desktopSidebarWrap: {
            height: "100vh",
            overflow: "hidden",
            flexShrink: 0,
            position: "relative",
            zIndex: 2
        } as CSSProperties,
        main: {
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            position: "relative",
            zIndex: 1
        } as CSSProperties,
        content: {
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            padding: "22px 18px 0",
            backgroundColor: "transparent",
            display: "flex",
            flexDirection: "column"
        } as CSSProperties,
        contentBody: {
            flex: 1,
            minHeight: 0,
            display: "block",
            overflowY: "auto",
            overflowX: "hidden",
            paddingBottom: 18
        } as CSSProperties,
        mobileSidebarBackdrop: {
            zIndex: 40,
            backgroundColor: colors.overlay
        } as CSSProperties,
        mobileSidebarPanel: {
            zIndex: 45,
            backgroundColor: colors.base,
            width: `min(84vw, ${SIDEBAR_WIDTH}px)`
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
            overflowY: "auto",
            padding: 16
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
        notificationCard: (isRead: boolean): CSSProperties => ({
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: 16,
            borderRadius: 18,
            border: `1px solid ${isRead ? colors.border : colors.brand}`,
            backgroundColor: isRead ? colors.surface : colors.surfaceRaised,
            boxShadow: `0 14px 34px ${colors.overlay}`
        }),
        notificationCardHeader: {
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12
        } as CSSProperties,
        notificationCardCopy: {
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6
        } as CSSProperties,
        notificationStateBadge: (isRead: boolean): CSSProperties => ({
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 60,
            padding: "6px 10px",
            borderRadius: 999,
            border: `1px solid ${isRead ? colors.border : colors.brand}`,
            color: isRead ? colors.textMuted : colors.brand,
            backgroundColor: colors.surface
        }),
        notificationCardFooter: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap"
        } as CSSProperties,
        notificationTimestamp: {
            fontSize: 12,
            color: colors.textMuted
        } as CSSProperties,
        notificationActionGroup: {
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            flexWrap: "wrap"
        } as CSSProperties
    };
}

export function headerStyles(colors: ThemeColors) {
    const onDanger = getReadableTextColor(colors.danger, colors.textPrimary, themes.sunlight.surface);

    return {
        header: {
            minHeight: 82,
            display: "flex",
            alignItems: "flex-start",
            flexShrink: 0,
            position: "relative",
            zIndex: 30,
            borderBottom: "none",
            backgroundColor: "transparent",
            marginBottom: 16
        } as CSSProperties,
        leftSection: {
            flex: "1 1 auto",
            minWidth: 0,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            padding: 0,
            gap: 10,
            backgroundColor: "transparent"
        } as CSSProperties,
        rightSection: {
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            padding: "4px 0 0",
            position: "relative",
            backgroundColor: "transparent",
            borderLeft: "none",
            overflow: "visible"
        } as CSSProperties,
        analyticsHeaderFilterWrap: {
            display: "inline-flex",
            alignItems: "center",
            minWidth: 0,
            flexShrink: 0
        } as CSSProperties,
        analyticsHeaderFilter: {
            minWidth: 154,
            height: 32,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            color: colors.textPrimary,
            fontSize: 12
        } as CSSProperties,
        messageWrap: {
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            minWidth: 0,
            flex: 1
        } as CSSProperties,
        messageTitle: {
            fontSize: 38,
            fontWeight: 500,
            lineHeight: 1.08,
            margin: 0,
            display: "block",
            whiteSpace: "normal",
            overflowWrap: "break-word"
        } as CSSProperties,
        messageSubtitle: {
            fontSize: 15,
            color: colors.brandLight,
            marginTop: 8,
            marginBottom: 0,
            lineHeight: 1.35,
            paddingBottom: 2,
            display: "block",
            whiteSpace: "normal",
            overflowWrap: "break-word"
        } as CSSProperties,
        iconBtn: {
            width: 40,
            height: 40,
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
            minWidth: 36,
            minHeight: 36,
            backgroundColor: "transparent",
            border: "none",
            boxShadow: "none",
            padding: 0,
            color: colors.textPrimary
        } as CSSProperties,
        notificationButtonWrap: {
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
        } as CSSProperties,
        unreadBadge: {
            position: "absolute",
            top: -4,
            right: -6,
            minWidth: 22,
            height: 22,
            borderRadius: 999,
            backgroundColor: colors.danger,
            border: `2px solid ${colors.surface}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 800,
            color: onDanger,
            lineHeight: 1,
            padding: "0 6px",
            boxShadow: `0 8px 18px ${colors.overlay}`,
            zIndex: 2,
            pointerEvents: "none"
        } as CSSProperties
    };
}

export function sidebarStyles(colors: ThemeColors, activeThemeKey?: ThemeKey) {
    const onBrand = colors.onBrand ?? getReadableTextColor(colors.brand, themes.sunlight.surface, colors.textPrimary);

    const sidebarBg = getSidebarBackground(colors, activeThemeKey);
    const sidebarBorder = colors.border;
    const separatorColor = colors.border;

    const textPrimary = colors.textPrimary;
    const textMuted = colors.textSecondary;
    const manageText = colors.brand;

    const cardBg = colors.surfaceRaised;
    const cardBorder = colors.border;

    return {
        sidebar: {
            backgroundColor: sidebarBg,
            borderRight: `1px solid ${sidebarBorder}`,
            padding: "8px 14px 10px",
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            width: SIDEBAR_WIDTH,
            overflow: "hidden"
        } as CSSProperties,
        logoRow: {
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
            minHeight: 58,
            padding: "0 6px",
            marginTop: 0,
            marginBottom: 0,
            flexShrink: 0
        } as CSSProperties,
        topSeparator: {
            width: "100%",
            height: 1,
            backgroundColor: separatorColor,
            marginBottom: 10,
            flexShrink: 0
        } as CSSProperties,
        logoTitle: {
            color: textPrimary
        } as CSSProperties,
        logoSubtitle: {
            color: colors.textSecondary
        } as CSSProperties,
        logoMark: {
            width: 44,
            height: 44,
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
            padding: "7px 12px",
            borderRadius: 12,
            marginTop: 2,
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
            marginBottom: 10,
            flexShrink: 0
        } as CSSProperties,
        profileCardAvatar: {
            width: 44,
            height: 44,
            borderRadius: 14,
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
            marginTop: 4,
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
            fontSize: 10,
            fontWeight: 600,
            color: manageText,
            margin: 0,
            width: "fit-content"
        } as CSSProperties,
        navList: {
            flex: 1,
            overflow: "visible",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingBottom: 0
        } as CSSProperties,
        navSection: {
            display: "flex",
            flexDirection: "column",
            gap: 3,
            flexShrink: 0
        } as CSSProperties,
        navSectionLabel: {
            fontSize: 10,
            fontWeight: 800,
            lineHeight: 1,
            color: colors.textMuted,
            letterSpacing: 0,
            textTransform: "uppercase",
            padding: "0 12px 4px"
        } as CSSProperties,
        navSectionItems: {
            display: "flex",
            flexDirection: "column",
            gap: 3
        } as CSSProperties,
        navItem: (active: boolean): CSSProperties => ({
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "9px 12px",
            borderRadius: 12,
            cursor: "pointer",
            backgroundColor: active ? colors.brand : "transparent",
            color: active ? onBrand : textMuted,
            fontSize: 14,
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
            marginTop: 4,
            marginBottom: 6,
            flexShrink: 0
        } as CSSProperties,
        logoutBtn: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 14px",
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
