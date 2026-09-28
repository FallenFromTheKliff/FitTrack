"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CircleAlert,
  Grid2X2,
  Map,
  RefreshCcw,
  UsersRound,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import {
  FACILITY_FLOOR_MAP,
  FACILITY_FLOORS,
  type FacilityFloorId,
  type FacilityGridCell,
  type GymLayoutEquipmentRecord,
  type FloorVenueRecord,
} from "@fittrack/types";
import {
  buildRenderableAssetUrl,
  findRouteAcrossPathCells,
  getVenueRouteTargets,
} from "@fittrack/utils";

import FitButton from "@/components/fit/FitButton";
import { useTheme } from "@/contexts/ThemeContext";
import { WEB_API_BASE_URL } from "@/lib/api-client";
import type { VenueEquipmentAssignments } from "@/data/facilities/mapTypes";

import { getVenueIcon } from "./MemberOnlyPageShared";
import {
  EmptyState,
  MemberPanelHeader,
  MemberSurface,
  MemberText,
} from "./MemberOnlyPrimitives";

const FacilitiesKonvaMap = dynamic(() => import("@/components/map/FacilitiesKonvaMap"), {
  ssr: false,
});

type Props = {
  activeFloor: FacilityFloorId;
  floorBounds?: { gridHeight: number; gridWidth: number };
  floorImageUrl?: string | null;
  footprintCells?: FacilityGridCell[];
  pathCells?: FacilityGridCell[];
  entryCells?: FacilityGridCell[];
  exitCells?: FacilityGridCell[];
  equipment?: GymLayoutEquipmentRecord[];
  isLoading?: boolean;
  onFloorChange: (floorId: FacilityFloorId) => void;
  phonePreview?: boolean;
  venues: FloorVenueRecord[];
};

type DetailView = "floor" | "zones";
type ThemeColors = ReturnType<typeof useTheme>["colors"];

type DetailRow = {
  icon: LucideIcon;
  label: string;
  meta?: string;
  tone?: "brand" | "muted" | "success" | "warning";
  value: string;
};

const DEFAULT_MEMBER_MAP_ZOOM = 0.86;
const ZOOM_STEP = 0.1;

function hidePlaceholderAssetUrl(assetUrl?: string | null) {
  const trimmedUrl = assetUrl?.trim();
  if (!trimmedUrl) return null;

  try {
    const { hostname } = new URL(trimmedUrl);
    if (
      hostname === "fittrack.dev" ||
      hostname === "fittrack.local" ||
      hostname.endsWith(".fittrack.local")
    ) {
      return null;
    }
  } catch {
    return trimmedUrl;
  }

  return trimmedUrl;
}

function getDetailToneColor(tone: DetailRow["tone"], colors: ThemeColors) {
  if (tone === "success") return colors.success;
  if (tone === "warning") return colors.warning;
  if (tone === "muted") return colors.textMuted;
  return colors.brand;
}

function FacilityDetailRow({
  colors,
  compact = false,
  row,
}: {
  colors: ThemeColors;
  compact?: boolean;
  row: DetailRow;
}) {
  const toneColor = getDetailToneColor(row.tone, colors);
  const Icon = row.icon;

  return (
    <div className={`member-only-facility-detail-box${compact ? " member-only-facility-detail-box-compact" : ""}`}>
      <div
        className="member-only-facility-detail-icon"
        style={{
          backgroundColor: `${toneColor}14`,
          borderColor: `${toneColor}36`,
          color: toneColor,
        }}
      >
        <Icon size={17} strokeWidth={2} />
      </div>
      <div className="member-only-facility-detail-copy">
        <span className="member-only-facility-detail-label">{row.label}</span>
        <strong className="member-only-facility-detail-value">{row.value}</strong>
        {row.meta ? <span className="member-only-facility-detail-meta">{row.meta}</span> : null}
      </div>
    </div>
  );
}

export function MemberFacilitiesMap({
  activeFloor,
  floorBounds,
  floorImageUrl,
  footprintCells = [],
  pathCells = [],
  entryCells = [],
  exitCells = [],
  equipment = [],
  isLoading = false,
  onFloorChange,
  phonePreview = false,
  venues,
}: Props) {
  const { colors } = useTheme();
  const [detailView, setDetailView] = useState<DetailView>("floor");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(DEFAULT_MEMBER_MAP_ZOOM);
  const [selectedVenueMapId, setSelectedVenueMapId] = useState<string | null>(null);
  const selectedVenue = useMemo(
    () => (selectedVenueMapId ? venues.find((venue) => venue.mapId === selectedVenueMapId) ?? null : null),
    [selectedVenueMapId, venues],
  );
  const activeFloorConfig = FACILITY_FLOOR_MAP[activeFloor];
  const activeFloorLabel = activeFloorConfig.label;
  const reservableCount = venues.filter(
    (venue) => venue.isBookable === true,
  ).length;
  const maintenanceCount = venues.filter(
    (venue) => venue.status === "maintenance",
  ).length;
  const supportCount = Math.max(
    venues.length - reservableCount - maintenanceCount,
    0,
  );
  const walkableCells = useMemo(
    () => [...pathCells, ...entryCells, ...exitCells],
    [entryCells, exitCells, pathCells],
  );
  const routeCells = useMemo(() => {
    if (!selectedVenue) return [];
    const targets = getVenueRouteTargets({
      gridColumn: selectedVenue.gridColumn ?? 1,
      gridRow: selectedVenue.gridRow ?? 1,
      gridWidth: selectedVenue.gridWidth ?? 1,
      gridHeight: selectedVenue.gridHeight ?? 1,
    }, walkableCells);
    return findRouteAcrossPathCells({ entryCells, exitCells, pathCells, targetCells: targets }) ?? [];
  }, [entryCells, exitCells, pathCells, selectedVenue, walkableCells]);
  const equipmentById = useMemo(() => Object.fromEntries(equipment.map((item) => [
    item.id, { id: item.id, name: item.name, color: colors.brand },
  ])), [colors.brand, equipment]);
  const assignedEquipment = useMemo(() => equipment.reduce<VenueEquipmentAssignments>((result, item) => {
    if (!item.venueId) return result;
    const venue = venues.find((candidate) => String(candidate.sourceVenueId ?? candidate.id) === String(item.venueId));
    if (!venue) return result;
    result[venue.mapId] = [...(result[venue.mapId] ?? []), item.id];
    return result;
  }, {}), [equipment, venues]);
  const renderedFloorImageUrl = hidePlaceholderAssetUrl(buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: floorImageUrl,
  }));
  const selectedVenueImageUrl = hidePlaceholderAssetUrl(buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: selectedVenue?.imageUrl ?? null,
  }));

  const floorRows = useMemo<DetailRow[]>(
    () => [
      {
        icon: Grid2X2,
        label: venues.length > 0 ? "Live floor data" : "Floor data",
        meta: isLoading
          ? "Reading the live venue catalog"
          : `${reservableCount} reservable zone${reservableCount === 1 ? "" : "s"} | ${maintenanceCount} under maintenance | ${supportCount} support area${supportCount === 1 ? "" : "s"}`,
        tone: venues.length > 0 ? "success" : "warning",
        value: isLoading
          ? "Loading floor"
          : venues.length > 0
            ? `${venues.length} mapped zone${venues.length === 1 ? "" : "s"}`
            : "Waiting for admin mapping",
      },
      {
        icon: Map,
        label: "Floor plan",
        meta: renderedFloorImageUrl ? "Staff-published floor image is visible on the map" : "Using the generated 2D layout",
        tone: renderedFloorImageUrl ? "success" : "brand",
        value: renderedFloorImageUrl ? "Image available" : "Canvas layout",
      },
    ],
    [
      isLoading,
      maintenanceCount,
      renderedFloorImageUrl,
      reservableCount,
      supportCount,
      venues.length,
    ],
  );

  const selectedVenueRows = useMemo<DetailRow[]>(() => {
    if (!selectedVenue) return [];
    const isUnderMaintenance = selectedVenue.status === "maintenance";
    const isBookingBlocked = selectedVenue.isBookable === false;

    return [
      ...(isUnderMaintenance
        ? [
            {
              icon: CircleAlert,
              label: "Venue status",
              meta: selectedVenue.bookingBlockReason ?? "Unavailable for new bookings",
              tone: "warning" as const,
              value: "Under maintenance",
            },
          ]
        : []),
      ...(!isUnderMaintenance && isBookingBlocked
        ? [
            {
              icon: CircleAlert,
              label: "Booking status",
              meta: selectedVenue.bookingBlockReason ?? "Unavailable for new bookings",
              tone: "warning" as const,
              value: "Not bookable",
            },
          ]
        : []),
      {
        icon: UsersRound,
        label: "Capacity",
        meta: isBookingBlocked
          ? selectedVenue.bookingBlockReason ?? "Unavailable for new bookings"
          : selectedVenue.isReservable
            ? "Reservable member zone"
            : "Shared facility area",
        tone: isBookingBlocked
          ? "warning"
          : selectedVenue.isReservable
            ? "success"
            : "brand",
        value: isBookingBlocked
          ? "Booking paused"
          : selectedVenue.capacity
            ? `${selectedVenue.capacity} slots`
            : "Capacity pending",
      },
      {
        icon: CalendarDays,
        label: "Booking",
        meta: selectedVenue.hourlyRate
          ? `PHP ${selectedVenue.hourlyRate} hourly rate${selectedVenue.minimumHours ? ` | ${selectedVenue.minimumHours} hr minimum` : ""}`
          : selectedVenue.isReservable
            ? "Rate pending"
            : "No reservation required",
        tone: isBookingBlocked
          ? "warning"
          : selectedVenue.isReservable
            ? "success"
            : "muted",
        value: isBookingBlocked
          ? selectedVenue.bookingBlockReason ?? "Unavailable for new bookings"
          : selectedVenue.isBookable
            ? "Reservations enabled"
            : "Open facility access",
      },
    ];
  }, [selectedVenue]);

  const setZoomBy = (delta: number) => {
    setZoom((current) => Math.min(1.25, Math.max(0.75, Number((current + delta).toFixed(2)))));
  };

  const resetMap = () => {
    setPan({ x: 0, y: 0 });
    setZoom(DEFAULT_MEMBER_MAP_ZOOM);
  };

  const selectFloor = (floorId: FacilityFloorId) => {
    if (floorId === activeFloor) return;
    onFloorChange(floorId);
    setSelectedVenueMapId(null);
    setDetailView("floor");
    resetMap();
  };

  const toggleVenueSelection = (venue: FloorVenueRecord, nextView: DetailView = detailView) => {
    const isSelectedAgain = selectedVenueMapId === venue.mapId;
    setSelectedVenueMapId(isSelectedAgain ? null : venue.mapId);
    setDetailView(nextView);
  };

  const selectVenueFromMap = (venue: FloorVenueRecord) => {
    toggleVenueSelection(venue, "floor");
  };

  const renderFloorTabs = () => (
    <div
      className="member-only-facility-floor-tabs"
      aria-label="Select floor"
      style={{ minWidth: 0, width: "100%" }}
    >
      {FACILITY_FLOORS.map((floor) => {
        const isActive = activeFloor === floor.id;
        return (
          <button
            key={floor.id}
            type="button"
            className="member-only-facility-floor-tab"
            style={{
              backgroundColor: isActive ? colors.brand : colors.surfaceRaised,
              borderColor: isActive ? colors.brand : colors.border,
              color: isActive ? colors.onBrand : colors.textSecondary,
            }}
            onClick={() => selectFloor(floor.id)}
          >
            {floor.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={`member-only-facility-map-shell${
        phonePreview ? " member-only-facility-map-shell-phone-preview" : ""
      }`}
      style={{ minWidth: 0, width: "100%" }}
    >
      <div className="member-only-facility-map-grid" style={{ minWidth: 0, width: "100%" }}>
        <MemberSurface
          className="member-only-facility-map-surface"
          style={{
            minHeight: 0,
            minWidth: 0,
            padding: 12,
            width: "100%",
          }}
        >
          <div className="member-only-facility-map-panel" style={{ minWidth: 0, width: "100%" }}>
            <div className="member-only-facility-map-top" style={{ minWidth: 0, width: "100%" }}>
              <MemberPanelHeader eyebrow="2D Map Layout" title={activeFloorLabel} />
              {renderFloorTabs()}
            </div>

            <div
              className="member-only-facility-map-stage"
              style={{ minWidth: 0, overflow: "hidden", width: "100%" }}
            >
              {isLoading ? (
                <EmptyState icon={Map} title="Loading facilities" hint="Reading the same venue catalog used by mobile." />
              ) : venues.length === 0 ? (
                <EmptyState icon={Map} title="No mapped zones yet" hint={activeFloorConfig.emptySubtitle} />
              ) : (
                <FacilitiesKonvaMap
                  assignedEquipment={assignedEquipment}
                  colors={colors}
                  equipmentById={equipmentById}
                  equipment={equipment}
                  footprintCells={footprintCells}
                  pathCells={pathCells}
                  entryCells={entryCells}
                  exitCells={exitCells}
                  fitToFloorBounds
                  floorId={activeFloor}
                  floorBounds={floorBounds}
                  contentReady={!isLoading}
                  routeCells={routeCells}
                  floorImageUrl={renderedFloorImageUrl}
                  height={undefined}
                  isEditMode={false}
                  onAssignEquipmentToVenue={() => undefined}
                  onPanChange={setPan}
                  onSelectVenue={selectVenueFromMap}
                  pan={pan}
                  selectedVenueMapId={selectedVenueMapId}
                  venues={venues}
                  zoom={zoom}
                />
              )}
            </div>

            {selectedVenue && routeCells.length === 0 ? (
              <MemberText variant="muted">No published path reaches this zone.</MemberText>
            ) : selectedVenue ? (
              <MemberText variant="muted">Route highlighted from the nearest published entry.</MemberText>
            ) : null}

            <div className="member-only-facility-map-bottom" aria-label="Map controls">
              <div className="member-only-facility-map-bottom-summary">
                {floorRows.map((row) => (
                  <FacilityDetailRow key={row.label} compact colors={colors} row={row} />
                ))}
              </div>
              <div className="member-only-facility-map-controls">
                <FitButton icon={ZoomIn} iconOnly label="Zoom in" onClick={() => setZoomBy(ZOOM_STEP)} variant="ghost" />
                <FitButton icon={ZoomOut} iconOnly label="Zoom out" onClick={() => setZoomBy(-ZOOM_STEP)} variant="ghost" />
                <FitButton icon={RefreshCcw} iconOnly label="Refresh map" onClick={resetMap} variant="ghost" />
              </div>
            </div>
          </div>
        </MemberSurface>

        <MemberSurface
          className="member-only-facility-map-detail"
          padded
          style={{ minWidth: 0, width: "100%" }}
        >
          <div className="member-only-facility-detail-panel" style={{ minWidth: 0, width: "100%" }}>
            <div className="member-only-facility-detail-top" style={{ minWidth: 0, width: "100%" }}>
              <div className="member-only-facility-detail-heading">
                <MemberText variant="brand">Floor view</MemberText>
                <MemberText as="h3" variant="body">
                  {activeFloorLabel}
                </MemberText>
              </div>
              <div className="member-only-facility-detail-tabs" aria-label="Facility detail view">
                {(["floor", "zones"] as const).map((view) => {
                  const isActive = detailView === view;
                  return (
                    <button
                      key={view}
                      type="button"
                      className="member-only-facility-detail-tab"
                      style={{
                        backgroundColor: isActive ? colors.surface : "transparent",
                        borderColor: isActive ? colors.border : "transparent",
                        color: isActive ? colors.textPrimary : colors.textMuted,
                      }}
                      onClick={() => setDetailView(view)}
                    >
                      {view === "floor" ? "Floor" : `Zones (${venues.length})`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="member-only-facility-detail-bottom">
              {detailView === "floor" ? (
                <div className="member-only-facility-detail-content">
                  {selectedVenue ? (
                    <div className="member-only-facility-selected-zone">
                      <div className="member-only-facility-zone-heading">
                        <span className="member-only-facility-zone-section-label">Zone</span>
                        <strong>{selectedVenue.name}</strong>
                      </div>

                      <div className="member-only-facility-zone-media">
                        <span className="member-only-facility-zone-section-label">Background photo</span>
                        {selectedVenueImageUrl ? (
                          <div className="member-only-facility-photo-frame">
                            <img src={selectedVenueImageUrl} alt={`${selectedVenue.name} background`} />
                          </div>
                        ) : (
                          <div className="member-only-facility-photo-empty">
                            <MemberText variant="muted">No member-facing background photo has been published yet.</MemberText>
                          </div>
                        )}
                      </div>

                      <div className="member-only-facility-zone-description">
                        <span className="member-only-facility-zone-section-label">Description</span>
                        <MemberText variant="muted">
                          {selectedVenue.description || "This zone has not published a member-facing description yet."}
                        </MemberText>
                      </div>

                      <div className="member-only-facility-zone-detail-list">
                        {selectedVenueRows.map((row) => {
                          const toneColor = getDetailToneColor(row.tone, colors);
                          const Icon = row.icon;

                          return (
                            <div key={row.label} className="member-only-facility-zone-detail-row">
                              <div className="member-only-facility-zone-detail-label">
                                <Icon size={15} strokeWidth={2} color={toneColor} />
                                <span>{row.label}</span>
                              </div>
                              <div className="member-only-facility-zone-detail-copy">
                                <strong>{row.value}</strong>
                                {row.meta ? <span>{row.meta}</span> : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="member-only-facility-detail-note">
                      <MemberText variant="muted">
                        Select a zone on the map to inspect its public photo, description, capacity, and booking details. Select it again to clear the view.
                      </MemberText>
                    </div>
                  )}
                </div>
              ) : isLoading ? (
                <EmptyState icon={Map} title="Loading zones" hint="Reading the live floor zones." />
              ) : venues.length === 0 ? (
                <EmptyState icon={Map} title="No zones mapped here yet" hint={activeFloorConfig.emptySubtitle} />
              ) : (
                <div className="member-only-facility-zone-grid">
                  {venues.map((venue) => {
                    const Icon = getVenueIcon(venue.iconKey);
                    const isSelected = selectedVenueMapId === venue.mapId;
                    return (
                      <button
                        key={venue.mapId}
                        type="button"
                        className="member-only-facility-zone-card"
                        style={{
                          backgroundColor: isSelected ? `${colors.brand}12` : colors.surfaceRaised,
                          borderColor: isSelected ? colors.brand : colors.border,
                        }}
                        onClick={() => toggleVenueSelection(venue, "floor")}
                      >
                        <span
                          className="member-only-facility-zone-icon"
                          style={{
                            backgroundColor: `${colors.brand}12`,
                            borderColor: isSelected ? `${colors.brand}55` : colors.border,
                            color: colors.brand,
                          }}
                        >
                          <Icon size={16} strokeWidth={2} />
                        </span>
                        <span className="member-only-facility-zone-copy">
                          <span className="member-only-facility-zone-title">{venue.name}</span>
                          <span className="member-only-facility-zone-meta">
                            {venue.status === "maintenance"
                              ? "Under maintenance"
                              : venue.isReservable
                                ? "Reservable"
                                : "Shared"} |{" "}
                            {venue.capacity ? `${venue.capacity} slots` : "Capacity pending"}
                          </span>
                        </span>
                        <Grid2X2 size={15} color={isSelected ? colors.brand : colors.textMuted} strokeWidth={2} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </MemberSurface>
      </div>
    </div>
  );
}
