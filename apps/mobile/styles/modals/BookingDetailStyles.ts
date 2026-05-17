import { StyleSheet } from "react-native";

import type { ThemeColors } from "@fittrack/types";
import { MAX_WIDTH, R } from "@fittrack/ui/tokens";

export function makeBookingDetailModalStyles(colors: ThemeColors) {
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
    body: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 12
    },
    resourceCard: {
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: R.lg,
      overflow: "hidden",
      marginBottom: 12
    },
    resourceImageArea: {
      width: "100%",
      aspectRatio: 16 / 7,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center"
    },
    resourceEmoji: {
      fontSize: 20,
      textAlign: "center",
      marginTop: 8
    },
    resourceName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
      paddingBottom: 10,
      paddingTop: 2
    },
    dateTimeRow: {
      flexDirection: "row",
      backgroundColor: colors.surfaceRaised,
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: 12
    },
    dateTimeCell: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 4
    },
    dateTimeDivider: {
      width: 1,
      backgroundColor: colors.border
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: colors.textMuted,
      textTransform: "uppercase"
    },
    detailValue: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textPrimary
    },
    coachCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surfaceRaised,
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12
    },
    coachAvatar: {
      width: 38,
      height: 38,
      borderRadius: R.md,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center"
    },
    coachAvatarText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textMuted
    },
    coachInfo: {
      flex: 1,
      gap: 2
    },
    coachName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary
    },
    coachSub: {
      fontSize: 12,
      color: colors.textMuted
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: R.lg,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4
    },
    statusText: {
      fontSize: 14,
      fontWeight: "600"
    },
    priceCard: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 4
    },
    timelineCard: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: R.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10
    },
    timelineList: {
      gap: 0
    },
    timelineRow: {
      flexDirection: "row",
      gap: 10
    },
    timelineRail: {
      width: 18,
      alignItems: "center"
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      marginTop: 5
    },
    timelineLine: {
      flex: 1,
      minHeight: 22,
      borderLeftWidth: 1,
      borderStyle: "dotted",
      borderColor: colors.border
    },
    timelineContent: {
      flex: 1,
      paddingBottom: 12
    },
    timelineTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary
    },
    timelineMeta: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted
    },
    priceValue: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.textPrimary
    },
    priceSub: {
      fontSize: 12,
      color: colors.textMuted
    },
    footer: {
      flexDirection: "column",
      gap: 10,
      padding: 16,
      borderTopWidth: 1
    },
    footerActionWrap: {
      width: "100%"
    }
  });
}
