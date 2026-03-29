import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui/tokens";

export function makeConfirmStyles(colors: ThemeColors) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.overlay
    },
    modalBlur: { ...StyleSheet.absoluteFill },
    container: {
      backgroundColor: colors.surface,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      width: "85%",
      maxWidth: MAX_WIDTH,
      padding: 24,
      gap: 8
    },
    title: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 },
    message: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 8 },
    actions: { flexDirection: "row", gap: 10, marginTop: 8 },
    actionBtn: { flex: 1, paddingVertical: 13 },
    actionBtnText: { fontSize: 15 }
  });
}