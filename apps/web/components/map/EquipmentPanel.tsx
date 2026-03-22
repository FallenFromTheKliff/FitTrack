"use client";
import type { ThemeColors } from "@fittrack/types";

import { FitText } from "@/components/fit/FitText";
import { DraggableEquipment } from "./DndEquipment";
import type { EquipmentDef } from "../../data/facilities/mapTypes";

type Props = {
  equipment: EquipmentDef[];
  colors: ThemeColors;
  isEditMode: boolean;
  panelPadding: number;
  equipmentCardPadding: string;
};

export function EquipmentPanel({ equipment, colors, isEditMode, panelPadding, equipmentCardPadding }: Props) {
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
        Available Equipment
      </FitText>
      <div style={{ display: "grid", gap: 8 }}>
        {equipment.map((item) => (
          <div
            key={item.id}
            style={{
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceRaised,
              borderRadius: 8,
              padding: equipmentCardPadding
            }}
          >
            <DraggableEquipment item={item} disabled={!isEditMode} />
          </div>
        ))}
      </div>
    </div>
  );
}