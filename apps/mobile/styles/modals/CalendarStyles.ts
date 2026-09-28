import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui/tokens";

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
    navRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8
    },
    compactNavRow: {
      width: "100%",
      minWidth: 0,
    },
    monthLabel: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.textPrimary,
      minWidth: 180,
      textAlign: "center"
    },
    compactMonthLabel: {
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
    },
    viewRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 8
    },
    viewButton: {
      minHeight: 38,
      paddingVertical: 0,
      paddingHorizontal: 8
    },
    viewButtonText: {
      fontSize: 13,
      fontWeight: "700"
    },
    body: {
      minHeight: 332
    },
    bodyContent: {
    },
    constrainedBody: {
      flex: 1,
      minHeight: 0,
    },
    constrainedBodyContent: {
      flexGrow: 1,
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
      paddingHorizontal: 2,
      marginBottom: 4
    },
    emptyDayCell: {
      width: "100%",
      height: 44
    },
    dayButton: {
      width: "100%",
      minHeight: 44,
      paddingVertical: 0,
      paddingHorizontal: 0
    },
    dayText: {
      fontSize: 16,
      fontWeight: "600"
    },
    monthGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: 8
    },
    monthCell: {
      width: "31%",
      minHeight: 48,
      paddingVertical: 0,
      paddingHorizontal: 0
    },
    yearGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: 8
    },
    yearCell: {
      width: "23%",
      minHeight: 48,
      paddingVertical: 0,
      paddingHorizontal: 0
    },
    pickerText: {
      fontSize: 14,
      fontWeight: "600"
    },
    footer: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    footerButton: {
      flex: 1,
      minHeight: 42
    },
    constrainedFooter: {
      flexWrap: "wrap",
    },
    constrainedFooterButton: {
      minWidth: 88,
    }
  });
}
