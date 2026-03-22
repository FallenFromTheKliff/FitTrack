import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui";

export function makeOTPModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
      backgroundColor: colors.overlay
    },
    card: {
      width: "100%",
      maxWidth: MAX_WIDTH,
      alignSelf: "center",
      borderRadius: R.lg,
      padding: 28,
      alignItems: "center",
      backgroundColor: colors.surface
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      backgroundColor: colors.brand
    },
    title: { fontSize: 24, fontWeight: "700", marginBottom: 8, color: colors.textPrimary },
    subtitle: {
      fontSize: 13,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 20,
      color: colors.textSecondary
    },
    phoneMasked: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
    digitRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
    digitBox: {
      width: 44,
      height: 52,
      borderRadius: R.sm,
      borderWidth: 1,
      fontSize: 22,
      fontWeight: "700",
      textAlign: "center",
      borderColor: colors.border,
      backgroundColor: colors.fieldBg,
      color: colors.textPrimary
    },
    digitBoxFilled: { borderColor: colors.brand },
    demoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: R.sm,
      paddingVertical: 8,
      paddingHorizontal: 14,
      marginBottom: 16,
      width: "100%",
      backgroundColor: colors.surfaceRaised
    },
    demoLabel: { fontSize: 12, fontWeight: "600", color: colors.brand },
    demoValue: { fontSize: 12, color: colors.textMuted },
    demoCode: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
    verifyBtn: { width: "100%", marginBottom: 16 },
    resendRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
    resendText: { fontSize: 13, color: colors.textMuted },
    resendBtn: { marginLeft: 4 },
    copyright: { fontSize: 11, color: colors.textMuted }
  });
}