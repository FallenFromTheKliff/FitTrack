import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui/tokens";

export function makePrefModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20
    },
    backdropPress: { ...StyleSheet.absoluteFill },
    card: {
      width: "100%",
      maxWidth: MAX_WIDTH,
      maxHeight: "82%",
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden"
    },
    scrollContent: {
      flexGrow: 1
    },
    scrollContentWithCue: {
      paddingBottom: 28
    },
    scrollContentWithFixedClose: {
      paddingBottom: 20
    },
    scrollCue: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: R.md,
      borderWidth: 1,
      bottom: 10,
      boxShadow: "0 4px 12px rgba(0,0,0,0.16)",
      elevation: 7,
      height: 34,
      justifyContent: "center",
      position: "absolute",
      width: 34
    },
    scrollCueWithFixedClose: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: R.md,
      borderWidth: 1,
      bottom: 78,
      boxShadow: "0 4px 12px rgba(0,0,0,0.16)",
      elevation: 7,
      height: 34,
      justifyContent: "center",
      position: "absolute",
      width: 34
    },
    scrollCueWithFixedCloseAccessory: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: R.md,
      borderWidth: 1,
      bottom: 128,
      boxShadow: "0 4px 12px rgba(0,0,0,0.16)",
      elevation: 7,
      height: 34,
      justifyContent: "center",
      position: "absolute",
      width: 34
    },
    fixedCloseFooter: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12
    },
    fixedCloseButton: {
      alignItems: "center",
      backgroundColor: colors.brand,
      borderRadius: R.md,
      minHeight: 52,
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    fixedCloseText: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 15,
      fontWeight: "800"
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: R.md,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10
    },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary, flex: 1 },
    closeButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: R.md,
      borderWidth: 1,
      height: 32,
      justifyContent: "center",
      marginLeft: 10,
      width: 32,
    },
    body: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 0,
      gap: 16
    },
    notificationBody: {
      flexGrow: 1,
      gap: 0
    },
    notificationContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16
    },
    notificationFooter: {
      flexDirection: "row",
      gap: 10,
      marginTop: "auto",
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    footer: {
      flexDirection: "row",
      gap: 10,
      marginHorizontal: -16,
      marginTop: "auto",
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    feedbackCategoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    feedbackCategoryButton: {
      flexGrow: 1,
      minWidth: 118,
      paddingHorizontal: 10,
      paddingVertical: 9
    },
    feedbackCategoryButtonText: {
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center"
    },
    feedbackFooterButtonText: {
      fontSize: 13,
      fontWeight: "700"
    },
    cancelBtn: { flex: 1 },
    applyBtn: { flex: 1 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: colors.textMuted,
      marginBottom: 8
    },
    themeGrid: { gap: 8 },
    themeCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      height: 44,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      paddingLeft: 14,
      overflow: "hidden"
    },
    themeCardLabel: { fontSize: 15, color: colors.textSecondary },
    fontRow: { flexDirection: "row", gap: 8 },
    fontCard: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised
    },
    fontCardActive: { borderColor: colors.brand, backgroundColor: colors.brand + "18" },
    fontCardLabel: { fontSize: 15, color: colors.textSecondary },
    fontCardLabelActive: { color: colors.brand, fontWeight: "600" },
    toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    toggleInfo: { flex: 1, gap: 2, paddingRight: 12 },
    toggleLabel: { fontSize: 15, fontWeight: "500", color: colors.textPrimary },
    toggleHint: { fontSize: 12, color: colors.textMuted },
    dirtyBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.warning + "44",
      backgroundColor: colors.warning + "14",
      paddingVertical: 8,
      paddingHorizontal: 12
    },
    dirtyBannerText: { fontSize: 13, color: colors.warning, flex: 1 },
    infoCard: {
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 10
    },
    infoCardDivider: { height: 1, backgroundColor: colors.border },
    infoCardHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    pillRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised
    },
    pillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
    pillText: { fontSize: 13, color: colors.textSecondary },
    pillTextActive: { color: "#FFFFFF", fontWeight: "600" },
    infoCardTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 2
    },
    reqRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8
    },
    reqText: {
      fontSize: 13,
      color: colors.textMuted,
      flex: 1
    },
    reqTextMet: {
      color: colors.textPrimary,
      fontWeight: "500"
    }
  });
}
