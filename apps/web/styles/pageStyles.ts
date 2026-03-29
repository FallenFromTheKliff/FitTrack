import type { CSSProperties } from "react";
import { themes } from "@fittrack/ui/theme";
import type { ThemeColors } from "@fittrack/ui/tokens";
import { getReadableTextColor } from "@fittrack/utils";
export function profileStyles(colors: ThemeColors) {
    const onBrandLight = getReadableTextColor(colors.brandLight, colors.textPrimary, themes.sunlight.surface);

    return {
        pageHeader: {
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 0
        } as CSSProperties,
        banner: {
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "24px 28px",
            backgroundColor: colors.brand,
            borderRadius: 14,
            marginBottom: 20
        } as CSSProperties,
        avatarWrap: {
            width: 72,
            height: 72,
            borderRadius: 10,
            backgroundColor: colors.brandLight,
            border: "2px solid rgba(255,255,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
        } as CSSProperties,
        avatarInitials: {
            fontSize: 26,
            fontWeight: 700,
            color: onBrandLight
        } as CSSProperties,
        bannerInfo: {
            flex: 1,
            minWidth: 0
        } as CSSProperties,
        bannerName: {
            fontSize: 20,
            fontWeight: 700,
            color: colors.onBrand ?? getReadableTextColor(colors.brand, colors.textPrimary, themes.sunlight.surface)
        } as CSSProperties,
        bannerEmail: {
            fontSize: 13,
            color: colors.onBrand ?? getReadableTextColor(colors.brand, colors.textPrimary, themes.sunlight.surface),
            opacity: 0.85,
            marginTop: 2
        } as CSSProperties,
        bannerMeta: {
            fontSize: 12,
            color: colors.onBrand ?? getReadableTextColor(colors.brand, colors.textPrimary, themes.sunlight.surface),
            opacity: 0.7,
            marginTop: 3
        } as CSSProperties,
        outerWrap: {
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
        } as CSSProperties,
        innerWrap: {
            width: "clamp(575px, 85vw, 1650px)",
            maxWidth: "100%"
        } as CSSProperties,
        shell: {
            borderRadius: 18,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surfaceRaised,
            padding: 14
        } as CSSProperties,
        twoColGrid: {
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.9fr)",
            gap: 14,
            alignItems: "start"
        } as CSSProperties,
        panel: {
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
            padding: 14
        } as CSSProperties,
        panelHeader: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10
        } as CSSProperties,
        fieldLabel: {
            fontSize: 12,
            color: colors.textMuted,
            marginBottom: 8,
            display: "block"
        } as CSSProperties,
        twoColumnFieldGrid: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14
        } as CSSProperties,
        inputBase: {
            width: "100%",
            padding: "12px 14px 12px 38px",
            borderRadius: 10,
            fontSize: 14,
            minHeight: 46,
            backgroundColor: colors.fieldBg,
            border: `1px solid ${colors.fieldBorder}`,
            color: colors.textPrimary,
            outline: "none"
        } as CSSProperties,
        inputDisabled: {
            width: "100%",
            padding: "12px 14px 12px 38px",
            borderRadius: 10,
            fontSize: 14,
            minHeight: 46,
            backgroundColor: colors.surfaceRaised,
            color: colors.textMuted,
            border: `1px solid ${colors.border}`,
            outline: "none"
        } as CSSProperties,
        fieldIcon: {
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none"
        } as CSSProperties,
        actionBtn: {
            minHeight: 50,
            fontSize: 16,
            fontWeight: 700
        } as CSSProperties,
        avatarCircle: {
            width: 82,
            height: 82,
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.brand,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center"
        } as CSSProperties,
        bmiCard: {
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surfaceRaised,
            padding: 10,
            marginBottom: 10
        } as CSSProperties,
        securityPanel: {
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            gap: 8
        } as CSSProperties
    };
}

export function dashboardStyles(colors: ThemeColors) {
    return {
        pageHeader: {
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 0
        } as CSSProperties,
        kpiGrid: {
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14
        } as CSSProperties,
        kpiCard: {
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 18
        } as CSSProperties,
        kpiIconWrap: {
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: colors.surfaceRaised,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        } as CSSProperties,
        kpiSpreadRow: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
        } as CSSProperties,
        chartCard: {
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 16
        } as CSSProperties,
        chartHeader: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12
        } as CSSProperties,
        chartTitleRow: {
            display: "flex",
            alignItems: "center",
            gap: 8
        } as CSSProperties,
        chartGrid: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginTop: 14
        } as CSSProperties,
        tableCard: {
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 16,
            marginTop: 14
        } as CSSProperties,
        tableHead: {
            fontSize: 13,
            fontWeight: 600,
            color: colors.textMuted,
            paddingBottom: 8,
            textAlign: "left"
        } as CSSProperties,
        tableRow: { borderTop: `1px solid ${colors.border}` } as CSSProperties,
        tableCell: {
            padding: "12px 0",
            fontSize: 14,
            color: colors.textPrimary
        } as CSSProperties,
        tableCellMuted: {
            padding: "12px 0",
            fontSize: 14,
            color: colors.textMuted
        } as CSSProperties,
        statusPill: (color: string): CSSProperties => ({
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 10px",
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: `${color}20`,
            color: color,
            border: `1px solid ${color}40`
        }),
        alertCard: {
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 16,
            marginTop: 14
        } as CSSProperties,
        alertItem: {
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "10px 0"
        } as CSSProperties,
        alertIconWrap: (color: string): CSSProperties => ({
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: `${color}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
        }),
        tooltipContent: {
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8
        } as CSSProperties,
        sidebarGrid: {
            display: "grid",
            gridTemplateColumns: "minmax(220px, 260px) 1fr",
            gap: 20,
            alignItems: "start"
        } as CSSProperties,
        statCard: {
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 16
        } as CSSProperties,
        successMsg: {
            fontSize: 13,
            color: colors.success,
            fontWeight: 500
        } as CSSProperties
    };
}

export function facilitiesMapStyles(colors: ThemeColors) {
    return {
        page: {
            display: "grid",
            gridTemplateColumns: "104px 1fr",
            gap: 14
        } as CSSProperties,
        panel: {
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 14
        } as CSSProperties,
        mapCard: {
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: 16
        } as CSSProperties
    };
}

export function chatbotStyles(colors: ThemeColors) {
    return {
        page: {
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0
        } as CSSProperties,
        panels: {
            display: "grid",
            flex: 1,
            minHeight: 0,
            height: "100%"
        } as CSSProperties,
        panel: {
            display: "flex",
            flexDirection: "column",
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            overflow: "hidden",
            minHeight: 0
        } as CSSProperties,
        panelHeader: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0
        } as CSSProperties,
        aiAvatar: {
            width: 30,
            height: 30,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
        } as CSSProperties,
        messagesArea: {
            flex: 1,
            overflowY: "auto",
            padding: "16px 16px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            position: "relative",
            minHeight: 0
        } as CSSProperties,
        chatWallpaper: {
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 0
        } as CSSProperties,
        aiRow: {
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            zIndex: 1
        } as CSSProperties,
        aiBubble: {
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            borderRadius: "4px 12px 12px 12px",
            padding: "10px 13px",
            maxWidth: "75%"
        } as CSSProperties,
        userBubble: {
            backgroundColor: colors.brand,
            borderRadius: "12px 4px 12px 12px",
            padding: "10px 13px",
            maxWidth: "75%",
            zIndex: 1
        } as CSSProperties,
        dotsWrap: {
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 2px"
        } as CSSProperties,
        dot: {
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: colors.textMuted,
            animation: "fitDotBounce 1.2s ease-in-out infinite"
        } as CSSProperties,
        inputBar: {
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            padding: "10px 12px",
            borderTop: `1px solid ${colors.border}`,
            flexShrink: 0
        } as CSSProperties,
        inputWrap: {
            flex: 1,
            position: "relative"
        } as CSSProperties,
        inputField: {
            width: "100%",
            resize: "none",
            backgroundColor: colors.fieldBg,
            border: `1px solid ${colors.fieldBorder}`,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            color: colors.textPrimary,
            outline: "none",
            lineHeight: 1.5,
            maxHeight: 120,
            overflowY: "auto"
        } as CSSProperties,
        sendBtn: {
            width: 36,
            height: 36,
            borderRadius: 10,
            padding: 0,
            flexShrink: 0
        } as CSSProperties,
        searchWrap: {
            position: "relative",
            padding: "8px 10px",
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0
        } as CSSProperties,
        searchInput: {
            width: "100%",
            backgroundColor: colors.fieldBg,
            border: `1px solid ${colors.fieldBorder}`,
            borderRadius: 8,
            padding: "7px 12px 7px 32px",
            fontSize: 12,
            color: colors.textPrimary,
            outline: "none"
        } as CSSProperties,
        sessionList: {
            flex: 1,
            overflowY: "auto",
            padding: "4px 0"
        } as CSSProperties,
        sessionItem: (isActive: boolean): CSSProperties => ({
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "10px 14px",
            cursor: "pointer",
            backgroundColor: isActive ? `${colors.brand}14` : "transparent",
            borderLeft: isActive ? `2px solid ${colors.brand}` : "2px solid transparent",
            transition: "background 0.15s"
        }),
        sessionIconWrap: {
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 1
        } as CSSProperties,
        sessionInfo: {
            flex: 1,
            minWidth: 0
        } as CSSProperties,
        groupLabel: {
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "10px 14px 4px"
        } as CSSProperties,
        emptyState: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "40px 20px"
        } as CSSProperties
    };
}