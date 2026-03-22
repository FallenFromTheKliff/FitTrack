import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui";

export function makeCalendarModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    navRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    monthLabel: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.textPrimary,
      minWidth: 160,
      textAlign: "center"
    },
    weekRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 4
    },
    weekDay: {
      flex: 1,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 12,
      paddingBottom: 12
    },
    dayCell: {
      width: "14.28%",
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: R.md,
      marginBottom: 4
    },
    dayCellSelected: { backgroundColor: colors.borderStrong, borderRadius: R.md },
    dayCellToday: { borderWidth: 1, borderColor: colors.brand, borderRadius: R.md },
    dayText: { fontSize: 17, color: colors.textPrimary },
    footer: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border
    }
  });
}