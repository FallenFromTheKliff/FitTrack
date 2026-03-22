import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { MAX_WIDTH, R } from "@fittrack/ui";

export function makeAppointmentModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    fill: {
      flex: 1
    },
    backdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20
    },
    card: {
      width: "100%",
      maxWidth: MAX_WIDTH,
      maxHeight: "86%",
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
      borderColor: colors.brand + "44",
      backgroundColor: colors.brand + "22",
      alignItems: "center",
      justifyContent: "center"
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary
    },
    headerSubtitle: {
      fontSize: 12,
      marginTop: 1,
      color: colors.textMuted
    },
    body: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.7,
      color: colors.textMuted,
      marginBottom: 8
    },
    coachList: {
      gap: 8
    },
    coachRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      padding: 12
    },
    coachAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brand + "22"
    },
    coachAvatarText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.brand
    },
    coachInfo: {
      flex: 1
    },
    coachName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary
    },
    coachSpecialty: {
      fontSize: 12,
      marginTop: 2,
      color: colors.textMuted
    },
    fieldBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      marginBottom: 10
    },
    fieldBtnText: {
      fontSize: 14,
      flex: 1,
      color: colors.textMuted
    },
    helperText: {
      fontSize: 12,
      color: colors.textMuted
    },
    errorText: {
      fontSize: 12,
      marginTop: 6,
      color: colors.danger
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
