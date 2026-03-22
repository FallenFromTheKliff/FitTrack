"use client";
import { Map } from "lucide-react";

import type { ThemeColors } from "@fittrack/types";

import { FitText } from "@/components/fit/FitText";
import { DropCell, PlacedEquipmentTile } from "./DndEquipment";
import { getVenueIcon, COLS, ROWS } from "@/data/facilities/mapTypes";
import type { EquipmentDef, PlacedMap, VenueRecord } from "@/data/facilities/mapTypes";

type Props = {
    colors: ThemeColors;
    isCompact: boolean;
    isEditMode: boolean;
    placedItems: PlacedMap;
    equipmentById: Record<string, EquipmentDef>;
    venues: VenueRecord[];
    floorPlanPadding: number;
    floorPlanMinHeight: number;
    onRequestDelete: (cellId: string) => void;
};

export function FloorPlanPanel({
    colors,
    isCompact,
    isEditMode,
    placedItems,
    equipmentById,
    venues,
    floorPlanPadding,
    floorPlanMinHeight,
    onRequestDelete
}: Props) {
    const placedCount = Object.keys(placedItems).length;
    const gap = isCompact ? 1 : 2;

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <FitText style={{ fontSize: 13, fontWeight: 700 }}>Floor Plan</FitText>
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
                <div style={{ position: "relative", height: "100%" }}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
                            gap,
                            height: "100%"
                        }}
                    >
                        {Array.from({ length: ROWS * COLS }).map((_, index) => {
                            const row = Math.floor(index / COLS);
                            const col = index % COLS;
                            const cellId = `cell-${row}-${col}`;
                            const placed = placedItems[cellId];
                            const placedDef = placed ? equipmentById[placed] : null;
                            return (
                                <DropCell key={cellId} id={cellId}>
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
                            gap,
                            pointerEvents: "none"
                        }}
                    >
                        {venues.map((venue) => {
                            const Icon = getVenueIcon(venue.iconKey);
                            const gridColumn = Math.max(1, venue.gridColumn ?? 1);
                            const gridRow = Math.max(1, venue.gridRow ?? 1);
                            const gridWidth = Math.max(1, venue.gridWidth ?? 2);
                            const gridHeight = Math.max(1, venue.gridHeight ?? 2);
                            return (
                                <div
                                    key={`venue-zone-${venue.id}`}
                                    style={{
                                        gridColumn: `${gridColumn} / span ${gridWidth}`,
                                        gridRow: `${gridRow} / span ${gridHeight}`,
                                        border: `1px solid ${colors.brand}66`,
                                        borderRadius: 10,
                                        padding: 6,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
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
                                </div>
                            );
                        })}
                    </div>
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
                            Drag equipment here to start
                        </FitText>
                        <FitText style={{ marginTop: 4, fontSize: 13, color: colors.textMuted }}>
                            Equipment will snap to grid
                        </FitText>
                    </div>
                )}
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
                    Tip: Drag equipment from the sidebar to place it on the floor. Use the trash icon to remove a placed item.
                </FitText>
            </div>
        </div>
    );
}