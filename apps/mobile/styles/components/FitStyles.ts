import { StyleSheet } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

import type { ThemeColors } from "@fittrack/types";
import { R } from "@fittrack/ui/tokens";

export function makeFitInputFieldStyles(colors: ThemeColors, compact = false) {
  return StyleSheet.create({
    wrapper: { gap: 4 },
    labelRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
    label: { fontSize: 13, color: colors.textPrimary, marginLeft: 2 },
    labelOptional: { fontSize: 11, color: colors.textMuted },
    labelDisabled: { color: colors.textDisabled },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.fieldBg,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      borderRadius: R.md,
      paddingHorizontal: 14,
      paddingVertical: compact ? 2 : 4
    },
    inputRowFocused: { borderColor: colors.brand },
    inputRowError: { borderColor: colors.danger },
    inputRowDisabled: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border
    },
    multilineInput: {
      minHeight: 96,
      textAlignVertical: "top",
      paddingVertical: 10
    },
    pressableField: {
      flex: 1,
      paddingVertical: 14,
      justifyContent: "center"
    },
    pressableFieldText: { fontSize: 15 },
    pressableFieldTextFilled: { color: colors.textPrimary },
    pressableFieldTextPlaceholder: { color: colors.textMuted },
    eyeBtn: { padding: 6 },
    fieldIcon: { marginRight: 10 },
    errorRow: { height: 18, marginLeft: 2 },
    errorText: { fontSize: 11, color: colors.danger }
  });
}

export function makeFitSectionStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { marginBottom: 28 },
    heading: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 10,
      paddingHorizontal: 4
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden"
    }
  });
}

export function makeFitCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 14
    },
    rowBorder: {},
    rowBorderOverlay: {
      position: "absolute",
      bottom: 0,
      left: 16,
      right: 0,
      height: 1
    },
    iconBadge: {
      width: 38,
      height: 38,
      borderRadius: R.lg,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center"
    },
    textGroup: { flex: 1, gap: 4 },
    labelRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    trailingRow: {
      marginLeft: "auto",
      flexDirection: "row",
      alignItems: "center",
      gap: 8
    },
    rowSelected: { borderWidth: 2, borderRadius: R.lg },
    ratingPill: { flexDirection: "row", alignItems: "center", gap: 4 },
    ratingText: { fontSize: 13, fontWeight: "700" },
    avatarInitials: { fontSize: 14, fontWeight: "700" },
    label: { fontSize: 15, fontWeight: "500" },
    subtitle: { fontSize: 12 },
    trailingPill: {
      borderWidth: 1,
      borderRadius: R.xl,
      paddingHorizontal: 7,
      paddingVertical: 2
    },
    trailingPillText: { fontSize: 10, fontWeight: "700" },
    progressTrack: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginTop: 6,
      overflow: "hidden"
    },
    progressFill: { height: 4, borderRadius: 2 },
    dropdownBody: { overflow: "hidden" },
    dropdownInner: {
      paddingHorizontal: 16,
      paddingBottom: 14
    },
    dropdownDivider: {
      height: 1,
      marginBottom: 12
    },
    statTile: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      gap: 4
    },
    statValue: {
      fontSize: 22,
      fontWeight: "700"
    },
    statLabel: { fontSize: 11 }
  });
}

export function makeFitFABStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    container: { position: "absolute", bottom: 24, right: 20, zIndex: 210 },
    fab: {
      width: 74,
      height: 74,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      elevation: 8,
      boxShadow: "0 4px 16px rgba(0,0,0,0.35)"
    },
    iconWrap: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center"
    },
    iconLayer: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center"
    }
  });
}

export const makeFitSearchStyles = (colors: ReturnType<typeof useTheme>["colors"]) => {
  return StyleSheet.create({
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      height: 46,
      gap: 8
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      paddingVertical: 0,
      paddingHorizontal: 0
    },
    searchClear: { marginRight: 2 }
  });
};

export function makeFitFilterStyles(colors: ThemeColors) {
  return StyleSheet.create({
    filterDropdown: {
      position: "absolute",
      top: 68,
      left: 20,
      right: 20,
      zIndex: 200
    },
    filterPanel: {
      backgroundColor: colors.surface,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
      elevation: 8,
      boxShadow: "0 4px 12px rgba(0,0,0,0.18)"
    },
    filterSection: { gap: 6 },
    filterLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, color: colors.textMuted },
    filterOptions: { flexDirection: "row", gap: 8, flex: 1 },
    filterChip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 7,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised
    },
    filterChipText: { fontSize: 13, color: colors.textSecondary },
    dateRow: { flexDirection: "row", gap: 8 },
    datePicker: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised
    },
    datePickerText: { fontSize: 13, color: colors.textMuted, flex: 1 },
    dateResetBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingTop: 6,
      alignSelf: "flex-end"
    },
    dateResetText: { fontSize: 12, color: colors.textMuted }
  });
}

export function makeFABMenuStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: {
      position: "absolute",
      bottom: 106,
      right: 20,
      zIndex: 199,
      gap: 6
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 11,
      paddingHorizontal: 16,
      minWidth: 220
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: R.md,
      alignItems: "center",
      justifyContent: "center"
    },
    label: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
    sub: { fontSize: 13, color: colors.textMuted, marginTop: 1 }
  });
}
