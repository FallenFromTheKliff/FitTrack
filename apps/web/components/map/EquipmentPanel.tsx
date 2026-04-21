"use client";
import type { ThemeColors } from "@fittrack/types";

import { FitText } from "@/components/fit/FitText";
import { DraggableEquipment } from "./DndEquipment";
import type { EquipmentDef } from "../../data/facilities/mapTypes";

type Props = {
  equipment: EquipmentDef[];
  equipmentRemainingById: Record<string, number | null>;
  colors: ThemeColors;
  isEditMode: boolean;
  panelPadding: number;
  equipmentCardPadding: string;
  selectedEquipmentId?: string | null;
  onSelectEquipment?: (equipmentId: string) => void;
};

export function EquipmentPanel({
  equipment,
  equipmentRemainingById,
  colors,
  isEditMode,
  panelPadding,
  equipmentCardPadding,
  selectedEquipmentId,
  onSelectEquipment,
}: Props) {
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
        {equipment.map((item) => {
          const remaining = equipmentRemainingById[item.id] ?? null;
          const isOutOfStock = remaining !== null && remaining <= 0;

          return (
            <div
              key={item.id}
              style={{
                border: `1px solid ${selectedEquipmentId === item.id ? item.color : colors.border}`,
                backgroundColor: selectedEquipmentId === item.id ? `${item.color}12` : colors.surfaceRaised,
                borderRadius: 8,
                padding: equipmentCardPadding,
                opacity: isOutOfStock ? 0.6 : 1,
              }}
            >
              <DraggableEquipment
                item={item}
                disabled={!isEditMode || isOutOfStock}
                selected={selectedEquipmentId === item.id}
                onSelect={onSelectEquipment}
                remainingQuantity={remaining}
                isOutOfStock={isOutOfStock}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
