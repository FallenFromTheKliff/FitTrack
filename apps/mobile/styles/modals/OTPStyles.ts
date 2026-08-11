import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui/tokens";

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
    notice: {
      width: "100%",
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      marginBottom: 16,
      color: colors.textMuted,
    },
    lockNotice: {
      width: "100%",
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 4,
      marginBottom: 16,
    },
    lockTitle: { fontSize: 13, fontWeight: "700", color: colors.danger },
    lockText: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
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
    digitBoxDisabled: { opacity: 0.55 },
    verifyBtn: { width: "100%", marginBottom: 16 },
    errorText: {
      width: "100%",
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      color: colors.danger,
      marginBottom: 12,
    },
    resendRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
    resendText: { fontSize: 13, color: colors.textMuted },
    resendBtn: { marginLeft: 4 },
    dismissBtn: { marginBottom: 12 },
    copyright: { fontSize: 11, color: colors.textMuted }
  });
}
