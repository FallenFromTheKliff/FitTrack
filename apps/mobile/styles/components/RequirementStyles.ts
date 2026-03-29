import { StyleSheet } from "react-native";

import { R, type ThemeColors } from "@fittrack/ui/tokens";

export function makeRequirementStyles(colors: ThemeColors, allMet: boolean) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.fieldBg,
      borderRadius: R.md,
      padding: 12,
      borderWidth: 1,
      borderColor: allMet ? colors.brand : colors.danger,
      marginTop: 6
    },
    header: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
    row: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    text: { fontSize: 13, color: colors.textDisabled, marginLeft: 8 },
    textMet: { color: colors.textPrimary, fontWeight: "600" }
  });
}