import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui/tokens";

export const SIDEBAR_WIDTH = 284;

export function makeHeaderStyles(
    colors: ThemeColors,
    options: { compact?: boolean; topInset?: number } = {},
) {
  const compact = options.compact ?? false;
  const topInset = options.topInset ?? 0;
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: compact ? 12 : 20,
      paddingTop: compact ? Math.max(12, topInset + 8) : 38,
      paddingBottom: compact ? 12 : 18,
      backgroundColor: colors.surface,
      gap: compact ? 8 : 14
    },
    menuButton: {
      ...(compact
        ? {
            alignItems: "center" as const,
            justifyContent: "center" as const,
            minHeight: 44,
            minWidth: 44
          }
        : { padding: 4 }),
      position: "relative" as const
    },
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 0,
      ...(compact ? { gap: 4 } : {})
    },
    headerActionButton: {
      alignItems: "center",
      justifyContent: "center"
    },
    notificationBadge: {
      alignItems: "center",
      backgroundColor: colors.danger,
      borderColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1.5,
      height: 19,
      justifyContent: "center",
      minWidth: 19,
      paddingHorizontal: 4,
      position: "absolute" as const,
      right: compact ? 1 : -7,
      top: compact ? 1 : -7,
      zIndex: 2
    },
    notificationBadgeText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "800"
    }
  });
}

export function makeHeaderMessageStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, flexDirection: "column", justifyContent: "center", minWidth: 0 },
    screenName: { fontSize: 20, fontWeight: "700" },
    message: { fontSize: 13, marginTop: 1 }
  });
}

export function makeSidebarStyles(
    colors: ThemeColors,
    activeIconColor?: string | null
) {
  const ic = activeIconColor ?? colors.brand;
  return StyleSheet.create({
    modalOuter: {
      flex: 1,
      backgroundColor: "transparent",
      justifyContent: "center",
      alignItems: "center"
    },
    modalInner: {
      flex: 1,
      width: "100%",
      maxWidth: MAX_WIDTH,
      position: "relative",
      overflow: "hidden"
    },
    sidebar: {
      position: "absolute",
      top: 0,
      left: 0,
      bottom: 0,
      width: SIDEBAR_WIDTH,
      backgroundColor: colors.base,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      minHeight: 0,
      paddingHorizontal: 14,
      paddingBottom: 0
    },
    scroll: {
      flex: 1,
      minHeight: 0
    },
    scrollContent: {
      flexGrow: 0,
      paddingBottom: 12
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    logoIconWrap: {
      width: 42,
      height: 42,
      borderRadius: R.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brand,
      overflow: "hidden"
    },
    logoTextGroup: { flexDirection: "column", gap: 1 },
    logoTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
    logoSubtitle: { fontSize: 12, color: colors.textMuted },
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: R.lg,
      borderWidth: 1,
      padding: 10,
      gap: 10,
      marginBottom: 0
    },
    profileAvatar: {
      width: 40,
      height: 40,
      borderRadius: R.lg,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center"
    },
    profileAvatarText: { fontSize: 14, fontWeight: "700", color: ic },
    profileInfo: { flex: 1, gap: 2 },
    profileName: { fontSize: 14, fontWeight: "600", color: ic },
    profileTierRow: { fontSize: 11, color: colors.textMuted },
    profileManageHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
      backgroundColor: colors.surface,
      borderRadius: R.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 2,
      paddingHorizontal: 6,
      alignSelf: "flex-start"
    },
    profileManageHintText: { fontSize: 10, color: ic },
    navSeparator: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 12,
      marginTop: 14
    },
    navList: {
      gap: 8
    },
    navSection: {
      flexShrink: 0,
      gap: 3
    },
    navSectionItems: {
      gap: 3
    },
    navSectionLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.4,
      paddingHorizontal: 10,
      paddingBottom: 2,
      textTransform: "uppercase" as const
    },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: R.md,
      gap: 10
    },
    navItemActive: { backgroundColor: colors.surfaceRaised },
    navText: { fontSize: 14, color: colors.textMuted },
    navTextActive: { color: colors.onBrand ?? "#FFFFFF", fontSize: 14, fontWeight: "600" },
    bottomSection: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexShrink: 0,
      marginTop: 12,
      paddingTop: 12
    },
    logoutItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 13,
      paddingHorizontal: 12,
      borderRadius: R.md,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.danger
    },
    logoutText: { fontSize: 14, color: colors.danger, fontWeight: "600" }
  });
}
