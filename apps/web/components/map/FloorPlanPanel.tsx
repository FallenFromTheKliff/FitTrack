"use client";
import { Map } from "lucide-react";

import type { ThemeColors } from "@fittrack/types";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import { DropCell, PlacedEquipmentTile } from "./DndEquipment";
import { getVenueIcon, COLS, ROWS } from "@/data/facilities/mapTypes";
import type { EquipmentDef, PlacedMap } from "@/data/facilities/mapTypes";
import type { FacilityFloorDefinition, FloorVenueRecord } from "@/data/facilities/floorPlans";

type Props = {
  colors: ThemeColors;
  floor: FacilityFloorDefinition;
  isCompact: boolean;
  isEditMode: boolean;
  placedItems: PlacedMap;
  equipmentById: Record<string, EquipmentDef>;
  venues: FloorVenueRecord[];
  floorPlanPadding: number;
  floorPlanMinHeight: number;
  selectedVenueMapId?: string | null;
  onRequestDelete: (cellId: string) => void;
  onSelectVenue: (venue: FloorVenueRecord) => void;
};

function FloorPlanSvg({
  colors,
  floor
}: {
  colors: ThemeColors;
  floor: FacilityFloorDefinition;
}) {
  if (floor.id === "floor-2") {
    return (
      <svg viewBox="0 0 140 100" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }} aria-hidden>
        <rect x="8" y="14" width="124" height="72" rx="18" fill={colors.brand} opacity={0.08} />
        <path d="M22 24h48v52H22z" fill={colors.surface} opacity={0.6} stroke={colors.border} strokeWidth="1.5" />
        <path d="M78 20h42v60H78z" fill={colors.surfaceRaised} opacity={0.8} stroke={colors.brand} strokeWidth="1.5" />
        <path d="M48 35h40v30H48z" fill="none" stroke={colors.brand} strokeWidth="2" strokeDasharray="4 4" opacity={0.75} />
        <circle cx="68" cy="50" r="14" fill={colors.brand} opacity={0.06} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 140 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }} aria-hidden>
      <rect x="4" y="6" width="132" height="88" rx="18" fill={colors.brand} opacity={0.06} />
      <path d="M8 12h44v38H8z" fill={colors.surface} opacity={0.55} stroke={colors.border} strokeWidth="1.5" />
      <path d="M54 12h44v38H54z" fill={colors.surfaceRaised} opacity={0.7} stroke={colors.border} strokeWidth="1.5" />
      <path d="M100 24h32v26h-32z" fill={colors.surface} opacity={0.5} stroke={colors.border} strokeWidth="1.5" />
      <path d="M8 58h56v28H8z" fill={colors.surfaceRaised} opacity={0.72} stroke={colors.border} strokeWidth="1.5" />
      <path d="M66 58h66v28H66z" fill={colors.surface} opacity={0.5} stroke={colors.border} strokeWidth="1.5" />
    </svg>
  );
}

export function FloorPlanPanel({
  colors,
  floor,
  isCompact,
  isEditMode,
  placedItems,
  equipmentById,
  venues,
  floorPlanPadding,
  floorPlanMinHeight,
  selectedVenueMapId,
  onRequestDelete,
  onSelectVenue
}: Props) {
  const placedCount = Object.keys(placedItems).length;
  const gap = isCompact ? 1 : 2;
  const canvasPercent = `${floor.canvasScale * 100}%`;

  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: isCompact ? "none" : `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: floorPlanPadding,
        display: "flex",
        flexDirection: "column",
        height: "100%"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
        <div style={{ display: "grid", gap: 2 }}>
          <FitText style={{ fontSize: 13, fontWeight: 700 }}>{floor.label} Floor Plan</FitText>
          <FitText style={{ fontSize: 11, color: colors.textMuted }}>{floor.subtitle}</FitText>
        </div>
        <FitText style={{ fontSize: 12, color: colors.textMuted }}>{COLS} x {ROWS} Grid</FitText>
      </div>
      <div
        style={{
          position: "relative",
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.base,
          padding: isCompact ? 6 : 8,
          minHeight: floorPlanMinHeight,
          flex: 1,
          overflow: "hidden"
        }}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: isCompact ? 10 : 14 }}>
          <div
            style={{
              position: "relative",
              width: canvasPercent,
              height: canvasPercent,
              maxWidth: "100%",
              maxHeight: "100%",
              transition: "width 220ms ease, height 220ms ease"
            }}
          >
            <div style={{ position: "absolute", inset: 0, borderRadius: 14, overflow: "hidden" }}>
              <FloorPlanSvg colors={colors} floor={floor} />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
                gap
              }}
            >
              {Array.from({ length: ROWS * COLS }).map((_, index) => {
                const row = Math.floor(index / COLS);
                const col = index % COLS;
                const cellId = `cell-${row}-${col}`;
                const placed = placedItems[cellId];
                const placedDef = placed ? equipmentById[placed] : null;
                return (
                  <DropCell key={`${floor.id}-${cellId}`} id={cellId}>
                    {placedDef ? (
                      <PlacedEquipmentTile
                        cellId={cellId}
                        item={placedDef}
                        onRequestDelete={onRequestDelete}
                        disabled={!isEditMode}
                        removeIconColor={colors.danger}
                      />
                    ) : null}
                  </DropCell>
                );
              })}
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
                gap
              }}
            >
              {venues.map((venue) => {
                const Icon = getVenueIcon(venue.iconKey);
                const gridColumn = Math.max(1, venue.gridColumn ?? 1);
                const gridRow = Math.max(1, venue.gridRow ?? 1);
                const gridWidth = Math.max(1, venue.gridWidth ?? 2);
                const gridHeight = Math.max(1, venue.gridHeight ?? 2);
                const isSelected = selectedVenueMapId === venue.mapId;

                return (
                  <FitButton
                    key={venue.mapId}
                    variant="card"
                    onClick={() => onSelectVenue(venue)}
                    disabled={isEditMode}
                    aria-label={`Open details for ${venue.name} on ${floor.label}`}
                    style={{
                      gridColumn: `${gridColumn} / span ${gridWidth}`,
                      gridRow: `${gridRow} / span ${gridHeight}`,
                      border: `1px solid ${isSelected ? colors.brand : `${colors.brand}66`}`,
                      borderRadius: 10,
                      padding: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSelected ? `${colors.brand}16` : "rgba(255,255,255,0.18)",
                      backdropFilter: "blur(4px)",
                      pointerEvents: isEditMode ? "none" : "auto",
                      boxShadow: isSelected ? `0 0 0 1px ${colors.brand}` : "none"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        minWidth: 96
                      }}
                    >
                      <Icon size={16} color={colors.brand} strokeWidth={2} />
                      <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textPrimary, textAlign: "center" }}>
                        {venue.name}
                      </FitText>
                      <FitText style={{ fontSize: 10, color: colors.textMuted }}>
                        {venue.isReservable === false ? "Facility zone" : "Reservable"}
                      </FitText>
                    </div>
                  </FitButton>
                );
              })}
            </div>
            {placedCount === 0 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none"
                }}
              >
                <Map size={32} color={colors.textMuted} strokeWidth={1.5} />
                <FitText style={{ marginTop: 12, fontSize: 15, color: colors.textMuted }}>
                  {floor.emptyTitle}
                </FitText>
                <FitText style={{ marginTop: 4, fontSize: 13, color: colors.textMuted }}>
                  {floor.emptySubtitle}
                </FitText>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: isCompact ? 8 : 10,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          padding: "10px 12px"
        }}
      >
        <FitText style={{ fontSize: 12, color: colors.textMuted }}>
          {isEditMode
            ? `Edit Mode is active for ${floor.label}. Drag equipment within the visible plan footprint.`
            : `Tip: Click a venue to inspect details. Toggle floors to compare the main layout with the smaller upper deck.`}
        </FitText>
      </div>
    </div>
  );
}
