import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui/tokens";

export function makeDetailsModalStyles(colors: ThemeColors) {
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
      height: "88%",
      maxHeight: "88%",
      borderRadius: R.xl,
      borderWidth: 1,
      overflow: "hidden"
    },
    middle: {
      flex: 1,
      minHeight: 0
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      gap: 10
    },
    headerIcon: {
      width: 34,
      height: 34,
      borderRadius: R.md,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center"
    },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
    headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    body: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 20 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: colors.textMuted,
      marginBottom: 8,
      textTransform: "uppercase" as const
    },
    fieldBlock: {
      backgroundColor: colors.fieldBg,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    fieldText: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },
    fieldTextMuted: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    hoursRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.fieldBg,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: R.md,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5
    },
    statusText: { fontSize: 14, fontWeight: "600" },
    imagesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10
    },
    imageTile: {
      width: "47.5%",
      aspectRatio: 16 / 9,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
      gap: 6
    },
    imageTileLabel: { fontSize: 11, color: colors.textMuted, textAlign: "center" },
    footer: {
      flexDirection: "row",
      gap: 10,
      padding: 16,
      borderTopWidth: 1
    }
  });
}
