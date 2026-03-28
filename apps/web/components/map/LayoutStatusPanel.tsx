"use client";
import type { ThemeColors } from "@fittrack/types";
import { FACILITY_FLOOR_MAP, type FacilityFloorId } from "@/data/facilities/floorPlans";

import { FitText } from "@/components/fit/FitText";

type Props = {
  colors: ThemeColors;
  panelPadding: number;
  assignedCount: number;
  activeFloor: FacilityFloorId;
};

export function LayoutStatusPanel({ colors, panelPadding, assignedCount, activeFloor }: Props) {
  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: panelPadding
      }}
    >
      <FitText style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: "block" }}>
        Layout Status
      </FitText>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>Equipment Assigned</FitText>
          <FitText style={{ fontSize: 13, fontWeight: 600 }}>{assignedCount}</FitText>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>Floor Level</FitText>
          <FitText style={{ fontSize: 13, fontWeight: 600 }}>{FACILITY_FLOOR_MAP[activeFloor].label}</FitText>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>Status</FitText>
          <FitText style={{ fontSize: 13, fontWeight: 700, color: colors.success }}>Saved</FitText>
        </div>
      </div>
    </div>
  );
}
