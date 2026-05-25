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
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    headerIcon: {
      alignItems: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: R.md,
      borderWidth: 1,
      height: 32,
      justifyContent: "center",
      width: 32
    },
    headerTitle: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: 17,
      fontWeight: "700"
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
      paddingTop: 16,
      paddingBottom: 10
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
      boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
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
      flexWrap: "wrap",
      gap: 10,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    footerAction: {
      flex: 1,
      minWidth: 116
    },
    loadPanel: {
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface
    },
    loadInputWrap: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 12
    },
    loadTextInput: {
      paddingHorizontal: 0,
      paddingVertical: 12
    },
    loadUnitRow: {
      flexDirection: "row",
      gap: 8
    },
    loadUnitChip: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      paddingVertical: 9
    },
    loadUnitText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase"
    },
    loadSliderWrap: {
      gap: 8,
      paddingVertical: 2
    },
    loadSliderHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    },
    loadSliderLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700"
    },
    loadSliderValue: {
      color: colors.brand,
      fontSize: 13,
      fontWeight: "800"
    },
    loadSliderTrack: {
      height: 28,
      justifyContent: "center",
      position: "relative" as const
    },
    loadSliderFill: {
      backgroundColor: colors.brand,
      borderRadius: 999,
      height: 6
    },
    loadSliderThumb: {
      position: "absolute" as const,
      top: 5,
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.surface,
      backgroundColor: colors.brand,
      boxShadow: "0 2px 5px rgba(0,0,0,0.25)",
      transform: [{ translateX: -9 }]
    },
    loadSliderScaleRow: {
      flexDirection: "row",
      justifyContent: "space-between"
    },
    loadSliderLimit: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600"
    },
    loadErrorText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: "600"
    },
    loadSavedText: {
      color: colors.brand,
      fontSize: 12,
      fontWeight: "700"
    },
    loadActions: {
      flexDirection: "row",
      gap: 10
    }
  });
}
