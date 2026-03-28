"use client";
import { useDroppable } from "@dnd-kit/core";
import { Map } from "lucide-react";

import type { ThemeColors } from "@fittrack/types";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import { getVenueIcon, COLS, ROWS } from "@/data/facilities/mapTypes";
import type { EquipmentDef, VenueEquipmentAssignments } from "@/data/facilities/mapTypes";
import type { FacilityFloorDefinition, FloorVenueRecord } from "@/data/facilities/floorPlans";

type Props = {
  colors: ThemeColors;
  floor: FacilityFloorDefinition;
  isCompact: boolean;
  isEditMode: boolean;
  assignedEquipment: VenueEquipmentAssignments;
  equipmentById: Record<string, EquipmentDef>;
  venues: FloorVenueRecord[];
  floorPlanPadding: number;
  floorPlanMinHeight: number;
  selectedVenueMapId?: string | null;
  onRequestDelete: (venueMapId: string, equipmentId: string) => void;
  onSelectVenue: (venue: FloorVenueRecord) => void;
  onOpenVenues: () => void;
};

type VenueCardProps = {
  colors: ThemeColors;
  floor: FacilityFloorDefinition;
  venue: FloorVenueRecord;
  equipmentById: Record<string, EquipmentDef>;
  assignedIds: string[];
  isEditMode: boolean;
  isSelected: boolean;
  markerBackground: string;
  onSelectVenue: (venue: FloorVenueRecord) => void;
  onRequestDelete: (venueMapId: string, equipmentId: string) => void;
};

function VenueCard({
  colors,
  floor,
  venue,
  equipmentById,
  assignedIds,
  isEditMode,
  isSelected,
  markerBackground,
  onSelectVenue,
  onRequestDelete
}: VenueCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `venue-${venue.mapId}`,
    disabled: !isEditMode
  });
  const Icon = getVenueIcon(venue.iconKey);
  const assignedEquipment = assignedIds.map((itemId) => equipmentById[itemId]).filter(Boolean);
  const iconSize = assignedEquipment.length >= 6 ? 12 : 14;
  const gridColumn = Math.max(1, venue.gridColumn ?? 1);
  const gridRow = Math.max(1, venue.gridRow ?? 1);
  const gridWidth = Math.max(1, venue.gridWidth ?? 2);
  const gridHeight = Math.max(1, venue.gridHeight ?? 2);

  return (
    <FitButton
      buttonRef={setNodeRef}
      variant="card"
      onClick={() => {
        if (isEditMode) return;
        onSelectVenue(venue);
      }}
      disabled={false}
      aria-label={isEditMode ? `Assign equipment to ${venue.name} on ${floor.label}` : `Open details for ${venue.name} on ${floor.label}`}
      style={{
        gridColumn: `${gridColumn} / span ${gridWidth}`,
        gridRow: `${gridRow} / span ${gridHeight}`,
        border: `1px solid ${isOver || isSelected ? colors.brand : `${colors.brand}66`}`,
        borderRadius: 10,
        padding: 8,
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
        backgroundColor: "transparent",
        pointerEvents: "auto",
        boxShadow: isOver || isSelected ? `0 0 0 1px ${colors.brand}` : "none",
        textAlign: "left"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 9,
          backgroundColor: isOver || isSelected ? colors.brand : markerBackground,
          opacity: 0.5
        }}
      />
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateRows: "auto auto auto",
          alignContent: "center",
          justifyItems: "center",
          gap: 4,
          width: "100%",
          minWidth: 0
        }}
      >
        <Icon size={16} color={colors.brand} strokeWidth={2} />
        <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textPrimary, textAlign: "center" }}>
          {venue.name}
        </FitText>
        <div style={{ display: "grid", gap: 4, width: "100%" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", minHeight: 22 }}>
            {assignedEquipment.length > 0 ? assignedEquipment.map((item) => (
              <div
                key={`${venue.mapId}-${item.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  minWidth: 22,
                  height: 22,
                  padding: "0 6px",
                  borderRadius: 999,
                  border: `1px solid ${item.color}`,
                  backgroundColor: `${item.color}22`,
                  color: item.color
                }}
                title={item.name}
              >
                <item.icon size={iconSize} color={item.color} strokeWidth={2} />
                {isEditMode ? (
                  <FitButton
                    variant="ghost"
                    label="×"
                    aria-label={`Remove ${item.name} from ${venue.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRequestDelete(venue.mapId, item.id);
                    }}
                    style={{
                      minWidth: 12,
                      height: 12,
                      padding: 0,
                      border: "none",
                      backgroundColor: "transparent",
                      color: item.color,
                      fontSize: 11,
                      lineHeight: 1
                    }}
                    textStyle={{ fontSize: 11, fontWeight: 700, color: item.color }}
                  />
                ) : null}
              </div>
            )) : (
              <FitText style={{ fontSize: 10, color: colors.textMuted }}>
                {isEditMode ? "Drop equipment here" : venue.isReservable === false ? "Facility zone" : "Reservable"}
              </FitText>
            )}
          </div>
          {assignedEquipment.length > 0 ? (
            <FitText style={{ fontSize: 10, color: colors.textMuted, textAlign: "center" }}>
              {venue.isReservable === false ? "Facility zone" : "Reservable"}
            </FitText>
          ) : null}
        </div>
      </div>
    </FitButton>
  );
}

function FloorPlanSvg({
  colors,
  floor
}: {
  colors: ThemeColors;
  floor: FacilityFloorDefinition;
}) {
  if (floor.id === "floor-2") {
    return (
      <svg viewBox="0 0 140 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }} aria-hidden>
        <rect x="4" y="8" width="132" height="84" rx="18" fill={colors.brand} opacity={0.08} />
        <path d="M10 14h44v30H10z" fill={colors.surface} opacity={0.55} stroke={colors.border} strokeWidth="1.5" />
        <path d="M58 14h72v30H58z" fill={colors.surfaceRaised} opacity={0.7} stroke={colors.border} strokeWidth="1.5" />
        <path d="M18 50h48v34H18z" fill={colors.surfaceRaised} opacity={0.72} stroke={colors.border} strokeWidth="1.5" />
        <path d="M70 50h54v34H70z" fill={colors.surface} opacity={0.55} stroke={colors.border} strokeWidth="1.5" />
        <path d="M44 38h52v24H44z" fill="none" stroke={colors.brand} strokeWidth="2" strokeDasharray="4 4" opacity={0.75} />
      </svg>
    );
  }

  if (floor.id === "floor-3") {
    return (
      <svg viewBox="0 0 140 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }} aria-hidden>
        <rect x="6" y="10" width="128" height="80" rx="20" fill={colors.brand} opacity={0.08} />
        <path d="M12 18h116v64H12z" fill={colors.surfaceRaised} opacity={0.68} stroke={colors.border} strokeWidth="1.5" />
        <path d="M22 30h96v40H22z" fill={colors.surface} opacity={0.48} stroke={colors.border} strokeWidth="1.5" />
        <circle cx="70" cy="50" r="18" fill="none" stroke={colors.brand} strokeWidth="2" opacity={0.4} />
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

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[\da-fA-F]{6}$/.test(normalized)) return null;
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function brightness(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 255000;
}

function darken(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const next = [rgb.r, rgb.g, rgb.b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value * (1 - amount)))))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `#${next}`;
}

export function FloorPlanPanel({
  colors,
  floor,
  isCompact,
  isEditMode,
  assignedEquipment,
  equipmentById,
  venues,
  floorPlanPadding,
  floorPlanMinHeight,
  selectedVenueMapId,
  onRequestDelete,
  onSelectVenue,
  onOpenVenues
}: Props) {
  const gap = isCompact ? 1 : 2;
  const baseBrightness = brightness(colors.base);
  const surfaceBrightness = brightness(colors.surfaceRaised);
  const lowContrast =
    baseBrightness !== null &&
    surfaceBrightness !== null &&
    Math.abs(baseBrightness - surfaceBrightness) < 0.1;
  const mapBackground = lowContrast ? darken(colors.base, 0.16) : colors.base;
  const markerBackground = lowContrast ? colors.surface : colors.surfaceRaised;

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
        <FitButton variant="ghost" label="VENUES >" onClick={onOpenVenues} />
      </div>
      <div
        style={{
          position: "relative",
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: mapBackground,
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
              width: "100%",
              height: "100%",
              aspectRatio: `${COLS} / ${ROWS}`,
              maxWidth: "100%",
              maxHeight: "100%"
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
              {venues.map((venue) => {
                return (
                  <VenueCard
                    key={venue.mapId}
                    colors={colors}
                    floor={floor}
                    venue={venue}
                    equipmentById={equipmentById}
                    assignedIds={assignedEquipment[venue.mapId] ?? []}
                    isEditMode={isEditMode}
                    isSelected={selectedVenueMapId === venue.mapId}
                    markerBackground={markerBackground}
                    onSelectVenue={onSelectVenue}
                    onRequestDelete={onRequestDelete}
                  />
                );
              })}
            </div>
            {Object.keys(assignedEquipment).length === 0 && (
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
            ? `Edit Mode is active for ${floor.label}. Drag equipment onto a venue to assign inherited icons.`
            : "Tip: Click a venue to inspect details, then use the venues button to switch into venue management."}
        </FitText>
      </div>
    </div>
  );
}
