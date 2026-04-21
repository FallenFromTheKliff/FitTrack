import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui/tokens";

export function makeGoalsModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
      backgroundColor: "rgba(0,0,0,0.45)"
    },
    card: {
      width: "100%",
      maxWidth: MAX_WIDTH,
      maxHeight: "88%",
      flex: 1,
      borderRadius: R.xl,
      borderWidth: 1,
      overflow: "hidden"
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
      width: 38,
      height: 38,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.brand + "44",
      backgroundColor: colors.brand + "22",
      alignItems: "center",
      justifyContent: "center"
    },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
    headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    body: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: colors.textMuted,
      marginBottom: 8
    },
    sectionGap: { marginBottom: 16 },
    goalTypeRow: { flexDirection: "row", gap: 8 },
    goalTypePill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: R.md,
      borderWidth: 1
    },
    goalTypePillText: { fontSize: 13, fontWeight: "600" },
    readOnlyRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg
    },
    readOnlyLabel: { fontSize: 14, color: colors.textMuted },
    readOnlyValue: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
    inputFieldWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg
    },
    inputField: {
      fontSize: 15,
      color: colors.textPrimary,
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 2
    },
    fieldBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: R.md,
      borderWidth: 1,
      backgroundColor: colors.fieldBg
    },
    fieldBtnText: { fontSize: 14, color: colors.textMuted, flex: 1 },
    fieldNote: { fontSize: 11, color: colors.textDisabled, marginTop: 4, paddingHorizontal: 2 },
    footer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 18,
      borderTopWidth: 1
    }
  });
}
