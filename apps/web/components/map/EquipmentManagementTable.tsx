"use client";

import type { ThemeColors } from "@fittrack/types";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import type { EquipmentDef } from "@/data/facilities/mapTypes";

type Props = {
  colors: ThemeColors;
  equipment: EquipmentDef[];
  equipmentRemainingById: Record<string, number | null>;
  onPlaceEquipment: (equipmentId: string) => void;
};

const COLS =
  "minmax(160px, 1fr) minmax(120px, 0.65fr) minmax(120px, 0.55fr) minmax(120px, 0.55fr) minmax(120px, 0.6fr) 130px";

export function EquipmentManagementTable({
  colors,
  equipment,
  equipmentRemainingById,
  onPlaceEquipment,
}: Props) {
  if (equipment.length === 0) {
    return (
      <FitText style={{ fontSize: 13, color: colors.textMuted }}>
        No active inventory equipment is available for floor placement.
      </FitText>
    );
  }

  const sortedEquipment = [...equipment].sort((left, right) => {
    const categoryDiff = left.category.localeCompare(right.category);
    if (categoryDiff !== 0) return categoryDiff;
    return left.name.localeCompare(right.name);
  });

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: COLS,
          backgroundColor: colors.surfaceRaised,
        }}
      >
        {["NAME", "CATEGORY", "SOURCE", "AVAILABLE", "STATUS", "ACTION"].map(
          (heading) => (
            <FitText
              key={heading}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "10px 12px",
                color: colors.textMuted,
              }}
            >
              {heading}
            </FitText>
          ),
        )}
      </div>
      {sortedEquipment.map((item) => {
        const remaining = equipmentRemainingById[item.id] ?? null;
        const total = item.quantityAvailable ?? null;
        const isOutOfStock = remaining !== null && remaining <= 0;
        const placedCount =
          total !== null && remaining !== null
            ? Math.max(0, total - remaining)
            : null;
        const availabilityLabel =
          total === null
            ? "Map palette"
            : `${placedCount ?? 0} / ${total} placed`;

        return (
          <div
            key={item.id}
            style={{
              display: "grid",
              gridTemplateColumns: COLS,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                minWidth: 0,
              }}
            >
              <FitText style={{ fontSize: 13, fontWeight: 600 }}>
                {item.name}
              </FitText>
            </div>
            <div
              style={{
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <FitText style={{ fontSize: 13 }}>{item.category}</FitText>
            </div>
            <div
              style={{
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <FitText style={{ fontSize: 13 }}>
                {item.sourceLabel === "inventory" ? "Inventory" : "Map palette"}
              </FitText>
            </div>
            <div
              style={{
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <FitText style={{ fontSize: 13 }}>{availabilityLabel}</FitText>
            </div>
            <div
              style={{
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <FitText
                style={{
                  fontSize: 12,
                  color: isOutOfStock ? colors.warning : colors.success,
                }}
              >
                {isOutOfStock ? "Fully placed" : "Placeable"}
              </FitText>
            </div>
            <div
              style={{
                padding: "8px 10px",
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <FitButton
                variant="ghost"
                label="PLACE"
                disabled={isOutOfStock}
                onClick={() => onPlaceEquipment(item.id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
