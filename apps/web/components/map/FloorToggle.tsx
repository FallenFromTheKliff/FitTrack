"use client";
import type { ThemeColors } from "@fittrack/types";

import { FACILITY_FLOORS, type FacilityFloorId } from "@/data/facilities/floorPlans";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Props = {
  colors: ThemeColors;
  activeFloor: FacilityFloorId;
  onChange: (floorId: FacilityFloorId) => void;
};

export function FloorToggle({ colors, activeFloor, onChange }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: 4,
        borderRadius: 14,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surfaceRaised
      }}
    >
      <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, padding: "0 4px 0 8px" }}>
        LEVEL
      </FitText>
      {FACILITY_FLOORS.map((floor) => (
        <FitButton
          key={floor.id}
          variant={activeFloor === floor.id ? "primary" : "ghost"}
          label={floor.label}
          active={activeFloor === floor.id}
          onClick={() => onChange(floor.id)}
          style={{ minWidth: 92 }}
        />
      ))}
    </div>
  );
}
