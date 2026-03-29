import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui/tokens";

export function makeExerciseModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      height: 640,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden"
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    headerIcon: {
      width: 38,
      height: 38,
      borderRadius: R.md,
      borderWidth: 1,
      backgroundColor: colors.brand + "22",
      borderColor: colors.brand + "44",
      alignItems: "center",
      justifyContent: "center"
    },
    headerTextWrap: {
      flex: 1
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2
    },
    filtersArea: {
      zIndex: 10,
      position: "relative" as const
    },
    filtersWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8
    },
    searchFieldWrap: {
      flex: 1
    },
    filterBtn: {
      paddingLeft: 4,
      paddingVertical: 6
    },
    filterOverlay: {
      position: "absolute" as const,
      top: "100%" as any,
      left: 16,
      right: 16,
      zIndex: 20,
      backgroundColor: colors.surface,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      elevation: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8
    },
    filterLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.5,
      color: colors.textMuted,
      marginBottom: 6
    },
    filterOptions: {
      flexDirection: "row",
      gap: 8
    },
    filterChip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 7,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised
    },
    filterChipText: {
      fontSize: 13,
      color: colors.textSecondary
    },
    body: { flex: 1 },
    listContent: {
      padding: 16,
      gap: 10
    },
    referenceCard: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 8
    },
    cardHeadRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8
    },
    cardTitleWrap: {
      flex: 1,
      gap: 2
    },
    referenceName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary
    },
    referenceGroup: {
      fontSize: 12,
      color: colors.textMuted
    },
    levelBadge: {
      borderRadius: R.md,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    levelBadgeText: {
      fontSize: 11,
      fontWeight: "700"
    },
    referenceRecommendation: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18
    },
    emptyText: {
      fontSize: 13,
      textAlign: "center",
      color: colors.textMuted,
      paddingVertical: 24
    },
    footer: {
      flexDirection: "row",
      gap: 10,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border
    }
  });
}