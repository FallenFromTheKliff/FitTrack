import { StyleSheet } from "react-native";

import { R, MAX_WIDTH } from "@fittrack/ui/tokens";

export function makeTimeSlotModalStyles() {
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
      height: "78%",
      maxHeight: "78%",
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
    headerTitle: { fontSize: 17, fontWeight: "600", flex: 1 },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      flexWrap: "wrap"
    },
    legendLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12 },
    grid: { flexDirection: "row", flexWrap: "wrap", flexGrow: 1, padding: 12, paddingBottom: 24, gap: 8 },
    slotCard: {
      width: "31%",
      borderRadius: R.md,
      borderWidth: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: "center",
      gap: 2,
      position: "relative"
    },
    slotTime: { fontSize: 17, fontWeight: "600", textAlign: "center" },
    slotDuration: { fontSize: 13, textAlign: "center" },
    slotSpots: { fontSize: 13, fontWeight: "700", textAlign: "center" },
    slotCheck: { position: "absolute", top: 5, right: 5 },
    footer: { padding: 16, borderTopWidth: 1 }
  });
}
