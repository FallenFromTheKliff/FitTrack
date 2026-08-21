import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/ui/tokens";

export function makeAuthStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.base },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
      paddingVertical: 48
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 14,
      backgroundColor: colors.brand,
      borderWidth: 1,
      borderColor: colors.brand,
      alignItems: "center",
      alignSelf: "center",
      justifyContent: "center",
      marginBottom: 16
    },
    titleBlock: { alignItems: "center", marginBottom: 48 },
    title: {
      fontSize: 30,
      fontWeight: "700",
      letterSpacing: 0.5,
      color: colors.textPrimary
    },
    subtitle: { fontSize: 14, marginTop: 4, color: colors.textSecondary },
    backBtn: { alignSelf: "flex-start", marginBottom: 28 },
    fields: { gap: 4, marginBottom: 6 },
    forgotPassword: {
      fontSize: 12,
      alignSelf: "flex-end",
      marginTop: 4,
      color: colors.brand
    },
    statusMessage: {
      fontSize: 13,
      textAlign: "center",
      marginTop: 16,
      lineHeight: 18,
      color: colors.textSecondary
    },
    primaryBtn: { marginTop: 40 },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 32,
      marginBottom: 16
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontSize: 12, color: colors.textMuted },
    termsText: {
      fontSize: 12,
      textAlign: "center",
      marginTop: 16,
      lineHeight: 20,
      color: colors.textMuted
    },
    termsLink: { fontSize: 12, fontWeight: "600", color: colors.brand },
    copyright: {
      fontSize: 11,
      textAlign: "center",
      marginTop: 36,
      color: colors.textMuted
    }
  });
}
