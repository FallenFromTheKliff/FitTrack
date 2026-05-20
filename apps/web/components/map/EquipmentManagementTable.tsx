"use client";

import { useEffect, useMemo, useState } from "react";
import type { ThemeColors } from "@fittrack/types";

import FitButton from "@/components/fit/FitButton";
import FitPagination from "@/components/fit/FitPagination";
import { FitText } from "@/components/fit/FitText";
import type { EquipmentDef } from "@/data/facilities/mapTypes";

type Props = {
  colors: ThemeColors;
  embedded?: boolean;
  equipment: EquipmentDef[];
  equipmentRemainingById: Record<string, number | null>;
  onPlaceEquipment: (equipmentId: string) => void;
  onSelectEquipment?: (equipment: EquipmentDef) => void;
  selectedEquipmentId?: string | null;
};

const COLS =
  "minmax(150px, 1fr) minmax(112px, 0.58fr) minmax(106px, 0.48fr) minmax(112px, 0.52fr) minmax(104px, 0.48fr) 116px";
const PAGE_SIZE = 5;

export function EquipmentManagementTable({
  colors,
  embedded = false,
  equipment,
  equipmentRemainingById,
  onPlaceEquipment,
  onSelectEquipment,
  selectedEquipmentId,
}: Props) {
  const [page, setPage] = useState(1);
  const sortedEquipment = useMemo(
    () =>
      [...equipment].sort((left, right) => {
        const categoryDiff = left.category.localeCompare(right.category);
        if (categoryDiff !== 0) return categoryDiff;
        return left.name.localeCompare(right.name);
      }),
    [equipment],
  );
  const totalPages = Math.max(1, Math.ceil(sortedEquipment.length / PAGE_SIZE));
  const rows = sortedEquipment.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  if (equipment.length === 0) {
    return (
      <FitText style={{ fontSize: 13, color: colors.textMuted }}>
        No active inventory equipment is available for floor placement.
      </FitText>
    );
  }

  return (
    <div
      style={{
        border: embedded ? "none" : `1px solid ${colors.border}`,
        borderRadius: embedded ? 0 : 10,
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        height: embedded ? "100%" : undefined,
        maxWidth: "100%",
        minHeight: 0,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          backgroundColor: colors.surfaceRaised,
          display: "grid",
          gridTemplateColumns: COLS,
          minWidth: 760,
        }}
      >
        {["NAME", "CATEGORY", "SOURCE", "AVAILABLE", "STATUS", "ACTION"].map(
          (heading) => (
            <FitText
              key={heading}
              style={{
                color: colors.textMuted,
                fontSize: 10,
                fontWeight: 800,
                padding: "8px 10px",
              }}
            >
              {heading}
            </FitText>
          ),
        )}
      </div>
      <div
        style={{
          alignContent: "start",
          display: "grid",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {rows.map((item) => {
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
              onClick={() => {
                onSelectEquipment?.(item);
              }}
              style={{
                borderTop: `1px solid ${colors.border}`,
                backgroundColor:
                  selectedEquipmentId === item.id ? `${colors.brand}16` : undefined,
                boxShadow:
                  selectedEquipmentId === item.id
                    ? `inset 0 0 0 1px ${colors.brand}88, 0 0 18px ${colors.brand}2e`
                    : undefined,
                cursor: onSelectEquipment ? "pointer" : "default",
                display: "grid",
                gridTemplateColumns: COLS,
                minWidth: 760,
                position: "relative",
                transition: "background-color 140ms ease, box-shadow 140ms ease",
                zIndex: selectedEquipmentId === item.id ? 1 : undefined,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  minWidth: 0,
                  padding: "8px 10px",
                }}
              >
                <FitText
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </FitText>
              </div>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  minWidth: 0,
                  padding: "8px 10px",
                }}
              >
                <FitText
                  style={{
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.category}
                </FitText>
              </div>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  padding: "8px 10px",
                }}
              >
                <FitText style={{ fontSize: 12 }}>
                  {item.sourceLabel === "inventory" ? "Inventory" : "Palette"}
                </FitText>
              </div>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  padding: "8px 10px",
                }}
              >
                <FitText style={{ fontSize: 12 }}>{availabilityLabel}</FitText>
              </div>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  padding: "8px 10px",
                }}
              >
                <FitText
                  style={{
                    color: isOutOfStock ? colors.warning : colors.success,
                    fontSize: 11,
                  }}
                >
                  {isOutOfStock ? "Fully placed" : "Placeable"}
                </FitText>
              </div>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 6,
                  padding: "6px 8px",
                }}
              >
                <FitButton
                  disabled={isOutOfStock}
                  label="PLACE"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPlaceEquipment(item.id);
                  }}
                  style={{ height: 30, minHeight: 30 }}
                  textStyle={{ fontSize: 11 }}
                  variant="ghost"
                />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ borderTop: `1px solid ${colors.border}`, padding: "8px 10px" }}>
        <FitPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          showSinglePage
          ariaLabel="Equipment management pagination"
        />
      </div>
    </div>
  );
}
