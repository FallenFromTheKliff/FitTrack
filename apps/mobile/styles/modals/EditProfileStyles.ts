import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui";

export function makeEditProfileModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20
    },
    card: {
      width: "100%",
      maxWidth: MAX_WIDTH,
      height: 680,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden"
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    tabPill: {
      flexDirection: "row",
      backgroundColor: colors.surfaceRaised,
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3
    },
    tabBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: R.md
    },
    tabBtnActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border
    },
    tabLabel: { fontSize: 13, color: colors.textSecondary },
    tabLabelActive: { color: colors.textPrimary, fontWeight: "600" },
    statusBadge: {
      borderRadius: R.md,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3
    },
    statusText: { fontSize: 11, fontWeight: "600" },
    body: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    avatarRow: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      gap: 4
    },
    avatarWrap: {
      position: "relative",
      width: 72,
      height: 72,
      overflow: "hidden",
      borderRadius: R.lg
    },
    avatarImage: {
      width: 72,
      height: 72,
      borderRadius: R.lg,
      borderWidth: 2,
      borderColor: colors.borderStrong
    },
    avatarCircle: {
      width: 72,
      height: 72,
      borderRadius: R.lg,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.borderStrong
    },
    avatarInitialsText: {
      fontSize: 26,
      fontWeight: "700",
      color: "#FFFFFF"
    },
    avatarCameraBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 22,
      height: 22,
      borderRadius: R.sm,
      backgroundColor: colors.brand,
      borderWidth: 2,
      borderColor: colors.surface,
      alignItems: "center",
      justifyContent: "center"
    },
    fitRow: { gap: 4 },
    fitLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted, letterSpacing: 0.4 },
    fitReadValue: { fontSize: 14, color: colors.textPrimary, fontWeight: "500" },
    fitInput: {
      backgroundColor: colors.fieldBg,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      borderRadius: R.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 46,
      fontSize: 15,
      color: colors.textPrimary
    },
    bmiCard: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginTop: 4,
      gap: 2
    },
    bmiRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 2
    },
    bmiValue: { fontSize: 22, fontWeight: "700" },
    bmiLabel: { fontSize: 13, color: colors.textMuted },
    footer: {
      flexDirection: "row",
      gap: 8,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    saveBtn: { flex: 1 },
    cancelBtn: { flex: 1 }
  });
}