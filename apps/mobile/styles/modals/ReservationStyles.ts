import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { R, MAX_WIDTH } from "@fittrack/ui/tokens";

export function makeReservationModalStyles(colors: ThemeColors) {
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
      maxHeight: "88%",
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
    optionalLabel: {
      fontSize: 11,
      fontWeight: "400",
      color: colors.textDisabled,
      letterSpacing: 0
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
    fieldBtnFlex: { flex: 1 },
    fieldBtnText: { fontSize: 14, color: colors.textMuted, flex: 1 },
    twoFieldRow: { flexDirection: "row", gap: 8 },
    validationHint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
    unavailableText: { fontSize: 13, color: colors.danger, fontWeight: "700", marginTop: 6 },
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
    inputPrefix: { fontSize: 16, color: colors.textMuted, marginTop: 1 },
    inputField: { fontSize: 15, color: colors.textPrimary, flex: 1, paddingVertical: 12, paddingHorizontal: 2 },
    paymentOptionList: {
      gap: 8,
      marginTop: 8
    },
    paymentOptionCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      padding: 12
    },
    paymentOptionCardDisabled: {
      opacity: 0.6
    },
    paymentOptionText: {
      flex: 1,
      gap: 2
    },
    paymentOptionLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary
    },
    paymentOptionMeta: {
      fontSize: 12,
      color: colors.textMuted
    },
    paymentOptionBody: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted
    },
    paymentSummaryCard: {
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      padding: 12,
      marginTop: 10,
      gap: 6
    },
    paymentSummaryEyebrow: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
      color: colors.textMuted,
      textTransform: "uppercase"
    },
    paymentSummaryTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary
    },
    paymentSummaryBody: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted
    },
    paymentSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    },
    paymentSummaryLabel: {
      fontSize: 12,
      color: colors.textMuted
    },
    paymentSummaryValue: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary
    },
    paymentSummaryDeadline: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      marginTop: 2
    },
    notesSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 16,
      marginBottom: 4
    },
    noteRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 6
    },
    noteContent: {
      flex: 1
    },
    noteFieldWrap: {
      flex: 1,
      alignItems: "flex-start",
      paddingVertical: 8
    },
    noteBullet: {
      fontSize: 16,
      color: colors.brand,
      marginTop: 4,
      lineHeight: 20
    },
    noteInput: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      paddingVertical: 2,
      paddingHorizontal: 2,
      minHeight: 28
    },
    noteRemoveBtn: {
      paddingTop: 10
    },
    noteCounter: {
      fontSize: 11,
      textAlign: "right",
      marginTop: 2
    },
    notesEmptyHint: {
      fontSize: 13,
      color: colors.textDisabled,
      paddingVertical: 8
    },
    amenityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    amenityCard: {
      width: "47.5%",
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      padding: 12,
      gap: 4,
      position: "relative"
    },
    amenityEmoji: { fontSize: 24 },
    amenityName: { fontSize: 13, fontWeight: "500", color: colors.textPrimary, lineHeight: 17 },
    amenityPrice: { fontSize: 12, color: colors.textMuted },
    amenityCheck: { position: "absolute", top: 8, right: 8 },
    trainerList: { gap: 8 },
    trainerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      padding: 12
    },
    trainerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.brand + "22",
      alignItems: "center",
      justifyContent: "center"
    },
    trainerAvatarText: { fontSize: 14, fontWeight: "700", color: colors.brand },
    trainerInfo: { flex: 1 },
    trainerName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
    trainerSpecialty: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    trainerRating: { fontSize: 12, fontWeight: "700", color: colors.warning, marginTop: 2 },
    footer: {
      flexDirection: "row",
      gap: 10,
      padding: 16,
      borderTopWidth: 1
    }
  });
}
