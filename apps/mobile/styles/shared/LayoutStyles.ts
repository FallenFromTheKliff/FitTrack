import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui/tokens";

export const SIDEBAR_WIDTH = 320;

export function makeHeaderStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 38,
      paddingBottom: 18,
      backgroundColor: colors.surface,
      gap: 14
    },
    menuButton: {
      padding: 4,
      position: "relative" as const
    },
    headerActions: {
      alignItems: "center",
      flexDirection: "row"
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
      right: -7,
      top: -7,
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
    container: { flex: 1, flexDirection: "column", justifyContent: "center" },
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
      paddingTop: 40,
      paddingHorizontal: 20,
      paddingBottom: 24
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 20,
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
      backgroundColor: colors.brand
    },
    logoTextGroup: { flexDirection: "column", gap: 1 },
    logoTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
    logoSubtitle: { fontSize: 12, color: colors.textMuted },
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: R.lg,
      borderWidth: 1,
      padding: 12,
      gap: 12,
      marginBottom: 0
    },
    profileAvatar: {
      width: 46,
      height: 46,
      borderRadius: R.lg,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center"
    },
    profileAvatarText: { fontSize: 16, fontWeight: "700", color: ic },
    profileInfo: { flex: 1, gap: 3 },
    profileName: { fontSize: 16, fontWeight: "600", color: ic },
    profileTierRow: { fontSize: 12, color: colors.textMuted },
    profileManageHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 5,
      backgroundColor: colors.surface,
      borderRadius: R.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 3,
      paddingHorizontal: 7,
      alignSelf: "flex-start"
    },
    profileManageHintText: { fontSize: 11, color: ic },
    navSeparator: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16
    },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: R.lg,
      marginBottom: 6,
      gap: 14
    },
    navItemActive: { backgroundColor: colors.surfaceRaised },
    navText: { fontSize: 17, color: colors.textMuted },
    navTextActive: { color: colors.textPrimary, fontWeight: "500" },
    bottomSection: {
      marginTop: "auto",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16
    },
    logoutItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 15,
      paddingHorizontal: 14,
      borderRadius: R.lg,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.danger
    },
    logoutText: { fontSize: 17, color: colors.danger, fontWeight: "500" }
  });
}
