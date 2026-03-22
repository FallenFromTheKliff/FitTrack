import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { MAX_WIDTH, R } from "@fittrack/ui";

export function makeForgotPasswordStyles(colors: ThemeColors) {
  return StyleSheet.create({
    fill: {
      flex: 1
    },
    backdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
      backgroundColor: colors.overlay
    },
    card: {
      width: "100%",
      maxWidth: MAX_WIDTH,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden"
    },
    header: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
      backgroundColor: colors.brand
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary
    },
    subtitle: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted
    },
    body: {
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 8
    },
    otpRow: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
      marginTop: 2
    },
    otpInput: {
      flex: 1,
      minWidth: 38,
      height: 48,
      borderRadius: R.sm,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      textAlign: "center",
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary
    },
    otpInputFilled: {
      borderColor: colors.brand
    },
    helperText: {
      marginTop: 10,
      fontSize: 12,
      color: colors.textMuted
    },
    errorText: {
      marginTop: 10,
      fontSize: 12,
      color: colors.danger
    },
    successText: {
      marginTop: 10,
      fontSize: 12,
      color: colors.success
    },
    passwordBox: {
      marginTop: 6
    },
    footer: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 18,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    buttonFlex: {
      flex: 1
    }
  });
}
