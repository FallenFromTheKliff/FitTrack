"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import { useDroppable } from "@dnd-kit/core";
import type Konva from "konva";
import type {
  GymLayoutEquipmentRecord,
  FacilityGridCell,
  ThemeColors,
} from "@fittrack/types";
import {
  FACILITY_GRID_MAX_COLUMNS,
  FACILITY_GRID_MAX_CELLS,
  FACILITY_GRID_MAX_ROWS,
  isEquipmentInsideVenue,
  resolveEquipmentGridPlacement,
} from "@fittrack/types";
import {
  cellKey,
  expandRectangleToCells,
  isRectangleInsideFootprint,
} from "@fittrack/utils";

import { COLS, ROWS } from "@/data/facilities/mapTypes";
import type { FloorVenueRecord } from "@/data/facilities/floorPlans";
import type { VenueEquipmentAssignments } from "@/data/facilities/mapTypes";
import type { FacilityCellActionPhase } from "./facilityCellDraft";
import {
  clampFacilityMapZoom,
  FACILITY_MAP_ZOOM_STEP,
  type FacilityContentBounds,
  getFacilityContentEnvelope,
  resolveFacilityMapFocalPan,
  resolveFacilityMapGeometry,
  resolveFacilityMapVisibleCellBounds,
} from "./facilityMapGeometry";
import {
  enumerateFacilityGridCandidates,
  findNearestFacilityPlacement,
} from "./facilityMapPlacement";
import { normalizeVenueImageUrls } from "./venueImageGallery";

type EquipmentDisplay = {
  color: string;
  id: string;
  name: string;
};

type Props = {
  assignedEquipment: VenueEquipmentAssignments;
  colors: ThemeColors;
  equipmentById: Record<string, EquipmentDisplay>;
  equipment?: GymLayoutEquipmentRecord[];
  footprintCells?: FacilityGridCell[];
  pathCells?: FacilityGridCell[];
  entryCells?: FacilityGridCell[];
  exitCells?: FacilityGridCell[];
  routeCells?: FacilityGridCell[];
  cellTool?: import("@/hooks/facilities/useFacilities").FacilityCellEditorTool | null;
  floorImageUrl?: string | null;
  floorId?: string;
  floorBounds?: { gridHeight: number; gridWidth: number };
  fitToFloorBounds?: boolean;
  contentReady?: boolean;
  fitRequestKey?: string | number;
  height?: number;
  isEditMode: boolean;
  pan: { x: number; y: number };
  pendingVenuePlacement?: FloorVenueRecord | null;
  selectedEquipmentId?: string | null;
  selectedVenueMapId?: string | null;
  venues: FloorVenueRecord[];
  zoom: number;
  onAssignEquipmentToVenue: (equipmentId: string, venueMapId: string) => void;
  onDropEquipmentToVenue?: (
    equipmentId: string,
    venueMapId: string,
    placement: { gridColumn: number; gridRow: number },
  ) => void;
  onMoveEquipment?: (
    equipmentId: string,
    venueMapId: string,
    placement: { gridColumn: number; gridRow: number },
  ) => boolean | Promise<boolean>;
  onMoveVenue?: (
    venueMapId: string,
    placement: { gridColumn: number; gridRow: number },
  ) => boolean | Promise<boolean>;
  onResizeFloorBounds?: (bounds: {
    gridHeight: number;
    gridWidth: number;
  }) => boolean | Promise<boolean>;
  onResizeVenue?: (
    venueMapId: string,
    layout: {
      gridColumn: number;
      gridHeight: number;
      gridRow: number;
      gridWidth: number;
    },
  ) => boolean | Promise<boolean>;
  onPanChange: (pan: { x: number; y: number }) => void;
  onZoomChange?: (zoom: number, pan: { x: number; y: number }) => void;
  onPlaceVenueAtCell?: (
    venue: FloorVenueRecord,
    placement: { gridColumn: number; gridRow: number },
  ) => boolean | Promise<boolean>;
  onSelectVenue: (venue: FloorVenueRecord) => void;
  onSelectEquipment?: (equipment: GymLayoutEquipmentRecord) => void;
  onCellAction?: (
    tool: import("@/hooks/facilities/useFacilities").FacilityCellEditorTool,
    cell: FacilityGridCell,
    phase?: FacilityCellActionPhase,
  ) => void;
};

type ZoneTone = "available" | "equipment" | "reservable" | "support";
type GridCell = { gridColumn: number; gridRow: number };
type VenueLayout = GridCell & { gridHeight: number; gridWidth: number };

type EquipmentDropPlacement = GridCell & { venueMapId: string };
type ClientPoint = { x: number; y: number };

export type FacilityEquipmentDropData = {
  acceptEquipmentDrop: (
    equipmentId: string,
    clientX: number,
    clientY: number,
  ) => void;
  floorId: string;
  kind: "facility-map";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveClientPoint(event: MouseEvent | TouchEvent): ClientPoint | null {
  if ("touches" in event) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: event.clientX, y: event.clientY };
}

function isInteractiveNode(node: Konva.Node | null) {
  let current = node;
  while (current) {
    if (
      current.getAttr("venueMapId") ||
      current.getAttr("equipmentId") ||
      current.name() === "venue-resize-transformer" ||
      current.getClassName() === "Transformer"
    ) {
      return true;
    }
    current = current.getParent();
  }
  return false;
}

function toVenueLayout(venue: FloorVenueRecord): VenueLayout {
  return {
    gridColumn: Math.max(1, venue.gridColumn ?? 1),
    gridRow: Math.max(1, venue.gridRow ?? 1),
    gridWidth: Math.max(1, venue.gridWidth ?? 1),
    gridHeight: Math.max(1, venue.gridHeight ?? 1),
  };
}

function rectanglesOverlap(left: VenueLayout, right: VenueLayout) {
  return !(
    left.gridColumn + left.gridWidth - 1 < right.gridColumn ||
    right.gridColumn + right.gridWidth - 1 < left.gridColumn ||
    left.gridRow + left.gridHeight - 1 < right.gridRow ||
    right.gridRow + right.gridHeight - 1 < left.gridRow
  );
}

function resolveNearestVenuePlacement(args: {
  entryCells: readonly FacilityGridCell[];
  exitCells: readonly FacilityGridCell[];
  footprintCells: readonly FacilityGridCell[];
  pathCells: readonly FacilityGridCell[];
  raw: GridCell;
  venue: FloorVenueRecord;
  venues: readonly FloorVenueRecord[];
}) {
  const current = toVenueLayout(args.venue);
  const maxColumn = FACILITY_GRID_MAX_COLUMNS - current.gridWidth + 1;
  const maxRow = FACILITY_GRID_MAX_ROWS - current.gridHeight + 1;
  const footprint = args.footprintCells.length > 0 ? args.footprintCells : null;
  const candidates = footprint
    ? footprint
        .filter(
          (cell) =>
            cell.column >= 1 &&
            cell.row >= 1 &&
            cell.column <= maxColumn &&
            cell.row <= maxRow,
        )
        .map((cell) => ({ gridColumn: cell.column, gridRow: cell.row }))
    : enumerateFacilityGridCandidates({
        maxColumn: Math.min(maxColumn, COLS),
        maxRow: Math.min(maxRow, ROWS),
      });
  const paths = new Set(
    [...args.pathCells, ...args.entryCells, ...args.exitCells].map(cellKey),
  );

  return findNearestFacilityPlacement(args.raw, candidates, (candidate) => {
    const nextLayout: VenueLayout = {
      ...current,
      gridColumn: candidate.gridColumn,
      gridRow: candidate.gridRow,
    };
    const cells = expandRectangleToCells(nextLayout);
    if (footprint && !isRectangleInsideFootprint(nextLayout, [...footprint])) {
      return false;
    }
    if (cells.some((cell) => paths.has(cellKey(cell)))) return false;
    return !args.venues.some((other) => {
      if (
        other.mapId === args.venue.mapId ||
        other.floorId !== args.venue.floorId ||
        other.isMapped === false
      ) {
        return false;
      }
      return rectanglesOverlap(nextLayout, toVenueLayout(other));
    });
  });
}

function resolveNearestEquipmentPlacement(args: {
  equipment: GymLayoutEquipmentRecord;
  raw: GridCell;
  venues: readonly FloorVenueRecord[];
  equipmentRecords: readonly GymLayoutEquipmentRecord[];
}) {
  const candidates = args.venues
    .filter(
      (venue) =>
        venue.floorId === args.equipment.floorId && venue.isMapped !== false,
    )
    .flatMap((venue) =>
      expandRectangleToCells({
        gridColumn: venue.gridColumn ?? 1,
        gridRow: venue.gridRow ?? 1,
        gridWidth: venue.gridWidth ?? 1,
        gridHeight: venue.gridHeight ?? 1,
      }).map((cell) => ({
        gridColumn: cell.column,
        gridRow: cell.row,
        venueMapId: venue.mapId,
      })),
    );
  return findNearestFacilityPlacement(args.raw, candidates, (candidate) =>
    !args.equipmentRecords.some((other) => {
      if (other.id === args.equipment.id || other.floorId !== args.equipment.floorId) {
        return false;
      }
      const otherVenue = args.venues.find((venue) =>
        isEquipmentInsideVenue(other, venue),
      );
      if (!otherVenue || otherVenue.mapId !== candidate.venueMapId) return false;
      const placement = resolveEquipmentGridPlacement(other);
      return (
        placement.gridColumn === candidate.gridColumn &&
        placement.gridRow === candidate.gridRow
      );
    }),
  );
}

function getNodeInset(compact: boolean, cellWidth: number, cellHeight: number) {
  if (!compact) return 6;
  return Math.min(6, Math.min(cellWidth, cellHeight) * 0.14);
}

function isRectVisible(
  x: number,
  y: number,
  width: number,
  height: number,
  viewport: { bottom: number; left: number; right: number; top: number },
) {
  return (
    x + width >= viewport.left &&
    x <= viewport.right &&
    y + height >= viewport.top &&
    y <= viewport.bottom
  );
}

function useContainerSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!ref.current) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(0, Math.floor(entry.contentRect.width));
      const nextHeight = Math.max(0, Math.floor(entry.contentRect.height));
      setWidth((current) => (current === nextWidth ? current : nextWidth));
      setHeight((current) => (current === nextHeight ? current : nextHeight));
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, width, height } as const;
}

function useLoadedImage(src?: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return undefined;
    }

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return image;
}

function toneColor(tone: ZoneTone, colors: ThemeColors) {
  switch (tone) {
    case "available":
      return colors.success;
    case "reservable":
      return colors.brand;
    case "support":
      return colors.warning;
    default:
      return colors.brandLight;
  }
}

function statusColor(status: GymLayoutEquipmentRecord["status"], colors: ThemeColors) {
  if (status === "maintenance" || status === "broken" || status === "missing") {
    return colors.danger;
  }
  if (status === "occupied") {
    return colors.warning;
  }
  return colors.success;
}

const VenueImage = memo(function VenueImage({
  colors,
  cropZoom,
  fit,
  focalX,
  focalY,
  height,
  src,
  width,
  x,
  y,
}: {
  colors: ThemeColors;
  cropZoom?: number | null;
  fit?: "cover" | "contain" | null;
  focalX?: number | null;
  focalY?: number | null;
  height: number;
  src?: string | null;
  width: number;
  x: number;
  y: number;
}) {
  const image = useLoadedImage(src);
  if (!image) return null;

  const naturalWidth = image.naturalWidth || image.width || 1;
  const naturalHeight = image.naturalHeight || image.height || 1;
  const normalizedFocalX = clamp(focalX ?? 0.5, 0, 1);
  const normalizedFocalY = clamp(focalY ?? 0.5, 0, 1);
  const normalizedZoom = clamp(cropZoom ?? 1, 1, 4);
  const baseScale =
    fit === "contain"
      ? Math.min(width / naturalWidth, height / naturalHeight)
      : Math.max(width / naturalWidth, height / naturalHeight);
  const renderScale = baseScale * normalizedZoom;
  const renderWidth = naturalWidth * renderScale;
  const renderHeight = naturalHeight * renderScale;
  const renderX =
    renderWidth >= width
      ? x - (renderWidth - width) * normalizedFocalX
      : x + (width - renderWidth) * normalizedFocalX;
  const renderY =
    renderHeight >= height
      ? y - (renderHeight - height) * normalizedFocalY
      : y + (height - renderHeight) * normalizedFocalY;

  return (
    <Group
      clipX={x}
      clipY={y}
      clipWidth={width}
      clipHeight={height}
      listening={false}
    >
      <KonvaImage
        image={image}
        x={renderX}
        y={renderY}
        width={renderWidth}
        height={renderHeight}
        opacity={0.3}
        cornerRadius={8}
        shadowColor={colors.base}
        shadowBlur={4}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
});

const EquipmentNode = memo(function EquipmentNode({
  compact = false,
  colors,
  height,
  isEditMode,
  record,
  width,
  x,
  y,
  onMove,
  resolveDrop,
  onSelect,
  venue,
  venues,
  planX,
  planY,
  cellWidth,
  cellHeight,
  cellToolActive,
  selected = false,
}: {
  compact?: boolean;
  colors: ThemeColors;
  height: number;
  isEditMode: boolean;
  record: GymLayoutEquipmentRecord;
  width: number;
  x: number;
  y: number;
  onMove?: (
    equipmentId: string,
    venueMapId: string,
    placement: { gridColumn: number; gridRow: number },
  ) => boolean | Promise<boolean>;
  resolveDrop?: (raw: GridCell) => EquipmentDropPlacement | null;
  onSelect?: (equipment: GymLayoutEquipmentRecord) => void;
  venue: FloorVenueRecord;
  venues: FloorVenueRecord[];
  planX: number;
  planY: number;
  cellWidth: number;
  cellHeight: number;
  cellToolActive?: boolean;
  selected?: boolean;
}) {
  const image = useLoadedImage(record.imageUrl);
  const accent = statusColor(record.status, colors);
  const textPadding = compact
    ? Math.min(4, Math.max(1, Math.min(width, height) * 0.12))
    : 4;
  const textWidth = compact
    ? Math.max(1, width - textPadding * 2)
    : width - 8;
  const imageInset = compact
    ? Math.min(3, Math.min(width, height) * 0.12)
    : 3;
  const nameFontSize = compact
    ? Math.max(5, Math.min(8, Math.min(width / 6, height / 2.8)))
    : Math.max(7, Math.min(10, width / 7));
  const statusFontSize = compact
    ? Math.max(5, Math.min(7, Math.min(width / 7, height / 3.2)))
    : Math.max(7, Math.min(9, width / 8));
  const showName = !compact || (width >= 20 && height >= 15);
  const showStatus = !compact || (width >= 34 && height >= 25);
  const [pendingPlacement, setPendingPlacement] = useState<{
    gridColumn: number;
    gridRow: number;
    venueMapId: string;
  } | null>(null);
  const draggable = isEditMode && Boolean(onMove) && !pendingPlacement;
  const activeVenue =
    pendingPlacement
      ? venues.find((candidate) => candidate.mapId === pendingPlacement.venueMapId) ?? venue
      : venue;
  const activePlacement = pendingPlacement ?? resolveEquipmentGridPlacement(record);
  const renderX = pendingPlacement
    ? planX + (activePlacement.gridColumn - 0.5) * cellWidth
    : x;
  const renderY = pendingPlacement
    ? planY + (activePlacement.gridRow - 0.5) * cellHeight
    : y;

  useEffect(() => {
    if (!pendingPlacement) return;
    const placement = resolveEquipmentGridPlacement(record);
    const persistedVenueId = String(record.venueId ?? "");
    const targetVenueId = String(activeVenue.sourceVenueId ?? activeVenue.id);
    if (
      placement.gridColumn === pendingPlacement.gridColumn &&
      placement.gridRow === pendingPlacement.gridRow &&
      (persistedVenueId === targetVenueId || isEquipmentInsideVenue(record, activeVenue))
    ) {
      setPendingPlacement(null);
    }
  }, [activeVenue, pendingPlacement, record]);

  return (
    <Group
      key={record.id}
      equipmentId={record.id}
      x={renderX}
      y={renderY}
      opacity={pendingPlacement ? 0.72 : 1}
      draggable={draggable}
      listening={!cellToolActive}
      onMouseDown={(event) => {
        event.cancelBubble = true;
      }}
      onTouchStart={(event) => {
        event.cancelBubble = true;
      }}
      onDragStart={(event) => {
        event.cancelBubble = true;
      }}
      onDragMove={(event) => {
        event.cancelBubble = true;
      }}
      onMouseEnter={(event) => {
        const container = event.target.getStage()?.container();
        container?.style.setProperty("cursor", draggable ? "move" : "pointer");
      }}
      onDragEnd={(event) => {
        event.cancelBubble = true;
        if (!onMove) return;
        const rawPlacement = {
          gridColumn: clamp(
            Math.floor((event.target.x() - planX) / cellWidth) + 1,
            1,
            FACILITY_GRID_MAX_COLUMNS,
          ),
          gridRow: clamp(
            Math.floor((event.target.y() - planY) / cellHeight) + 1,
            1,
            FACILITY_GRID_MAX_ROWS,
          ),
        };
        const snappedPlacement = resolveDrop?.(rawPlacement);
        const nextColumn = snappedPlacement?.gridColumn ?? rawPlacement.gridColumn;
        const nextRow = snappedPlacement?.gridRow ?? rawPlacement.gridRow;
        const targetVenue = venues.find((candidate) => {
          if (candidate.floorId !== venue.floorId || candidate.isMapped === false) {
            return false;
          }
          const left = candidate.gridColumn ?? 1;
          const top = candidate.gridRow ?? 1;
          const right = left + (candidate.gridWidth ?? 1) - 1;
          const bottom = top + (candidate.gridHeight ?? 1) - 1;
          return (
            nextColumn >= left &&
            nextColumn <= right &&
            nextRow >= top &&
            nextRow <= bottom
          );
        });
        const targetVenueId = snappedPlacement?.venueMapId ?? targetVenue?.mapId ?? "";
        setPendingPlacement({
          gridColumn: nextColumn,
          gridRow: nextRow,
          venueMapId: targetVenueId,
        });
        void Promise.resolve(
          onMove(record.id, targetVenueId, {
            gridColumn: nextColumn,
            gridRow: nextRow,
          }),
        ).then((persisted) => {
          if (!persisted) setPendingPlacement(null);
        });
      }}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect?.(record);
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect?.(record);
      }}
    >
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        cornerRadius={8}
        fill={`${colors.surfaceRaised}f5`}
        stroke={accent}
        strokeWidth={selected || pendingPlacement || record.status === "maintenance" ? 2.5 : 1.5}
        dash={pendingPlacement ? [7, 4] : undefined}
        shadowColor={accent}
        shadowBlur={selected || record.status === "maintenance" ? 12 : 4}
        perfectDrawEnabled={false}
      />
      {image ? (
        <KonvaImage
          image={image}
          x={-width / 2 + imageInset}
          y={-height / 2 + imageInset}
          width={Math.max(1, width - imageInset * 2)}
          height={Math.max(1, height - imageInset * 2)}
          opacity={0.32}
          cornerRadius={6}
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
      {showName ? (
        <Text
          x={-width / 2 + textPadding}
          y={compact ? -height / 2 + textPadding : -Math.min(8, height / 5)}
          width={textWidth}
          text={record.name.slice(0, 12)}
          fill={colors.textPrimary}
          fontSize={nameFontSize}
          fontStyle="bold"
          align="center"
          ellipsis
          wrap="none"
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
      {showStatus ? (
        <Text
          x={-width / 2 + textPadding}
          y={compact ? height / 2 - statusFontSize - textPadding : Math.min(3, height / 5)}
          width={textWidth}
          text={pendingPlacement ? "Saving..." : record.status}
          fill={accent}
          fontSize={statusFontSize}
          align="center"
          ellipsis
          wrap="none"
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
      {selected ? (
        <Rect
          x={-width / 2 - 3}
          y={-height / 2 - 3}
          width={width + 6}
          height={height + 6}
          cornerRadius={10}
          stroke={colors.brand}
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
    </Group>
  );
});

const VenueNode = memo(function VenueNode({
  assignedCount,
  cellHeight,
  cellWidth,
  compact = false,
  colors,
  isEditMode,
  isPlacementActive,
  onAssignEquipmentToVenue,
  cellToolActive,
  onMove,
  resolveDrop,
  onResize,
  onSelect,
  planX,
  planY,
  selected,
  selectedEquipmentId,
  venue,
  x,
  y,
}: {
  assignedCount: number;
  cellHeight: number;
  cellWidth: number;
  cellToolActive?: boolean;
  compact?: boolean;
  colors: ThemeColors;
  isEditMode: boolean;
  isPlacementActive: boolean;
  onAssignEquipmentToVenue: (equipmentId: string, venueMapId: string) => void;
  onMove?: (
    venueMapId: string,
    placement: { gridColumn: number; gridRow: number },
  ) => boolean | Promise<boolean>;
  resolveDrop?: (raw: GridCell) => GridCell | null;
  onResize?: (
    venueMapId: string,
    layout: VenueLayout,
  ) => boolean | Promise<boolean>;
  onSelect: (venue: FloorVenueRecord) => void;
  planX: number;
  planY: number;
  selected: boolean;
  selectedEquipmentId?: string | null;
  venue: FloorVenueRecord;
  x: number;
  y: number;
}) {
  const nodeRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [pendingLayout, setPendingLayout] = useState<VenueLayout | null>(null);
  const persistedLayout: VenueLayout = {
    gridColumn: Math.max(1, venue.gridColumn ?? 1),
    gridRow: Math.max(1, venue.gridRow ?? 1),
    gridWidth: Math.max(1, venue.gridWidth ?? 2),
    gridHeight: Math.max(1, venue.gridHeight ?? 2),
  };
  const activeLayout = pendingLayout ?? persistedLayout;
  const { gridColumn, gridRow, gridWidth, gridHeight } = activeLayout;
  const inset = getNodeInset(compact, cellWidth, cellHeight);
  const width = compact
    ? Math.max(1, Math.min(gridWidth * cellWidth, gridWidth * cellWidth - inset * 2))
    : Math.max(12, gridWidth * cellWidth - 12);
  const height = compact
    ? Math.max(1, Math.min(gridHeight * cellHeight, gridHeight * cellHeight - inset * 2))
    : Math.max(12, gridHeight * cellHeight - 12);
  const textPadding = compact
    ? Math.min(6, Math.max(1, Math.min(width, height) * 0.14))
    : 12;
  const textWidth = compact
    ? Math.max(1, width - textPadding * 2)
    : Math.max(40, width - 24);
  const labelFontSize = compact
    ? Math.max(7, Math.min(13, Math.min(width / 9, height / 3)))
    : Math.max(11, Math.min(15, width / 14));
  const sublabelFontSize = compact
    ? Math.max(6, Math.min(9, Math.min(width / 10, height / 5)))
    : 10;
  const countFontSize = compact ? Math.max(6, Math.min(8, width / 12)) : 9;
  const showLabel = !compact || (width >= 24 && height >= 18);
  const showSublabel = !compact || (width >= 64 && height >= 40);
  const showEquipmentCount = !compact || (width >= 88 && height >= 54);
  const nodeX = pendingLayout
    ? planX + (gridColumn - 1) * cellWidth + inset
    : x;
  const nodeY = pendingLayout
    ? planY + (gridRow - 1) * cellHeight + inset
    : y;
  const tone = venue.isReservable === false ? "support" : "reservable";
  const isMaintained = venue.status === "maintenance";
  const accent = isMaintained ? colors.danger : toneColor(tone, colors);
  const draggable =
    isEditMode &&
    !venue.isSystem &&
    !selectedEquipmentId &&
    !isPlacementActive;
  const sublabel = isMaintained
    ? "Maintenance"
    : venue.isReservable === false
        ? "Support Zone"
        : "Reservable";
  const venueImageUrl = normalizeVenueImageUrls(venue)[0] ?? null;

  useEffect(() => {
    if (!selected || !isEditMode || venue.isSystem || !onResize) return;
    const node = nodeRef.current;
    const transformer = transformerRef.current;
    if (!node || !transformer) return;
    transformer.nodes([node]);
    transformer.getLayer()?.batchDraw();
  }, [isEditMode, onResize, selected, venue.isSystem]);

  useEffect(() => {
    if (
      pendingLayout &&
      pendingLayout.gridColumn === persistedLayout.gridColumn &&
      pendingLayout.gridRow === persistedLayout.gridRow &&
      pendingLayout.gridWidth === persistedLayout.gridWidth &&
      pendingLayout.gridHeight === persistedLayout.gridHeight
    ) {
      setPendingLayout(null);
    }
  }, [
    pendingLayout,
    persistedLayout.gridColumn,
    persistedLayout.gridHeight,
    persistedLayout.gridRow,
    persistedLayout.gridWidth,
  ]);

  return (
    <>
    <Group
      ref={nodeRef}
      venueMapId={venue.mapId}
      x={nodeX}
      y={nodeY}
      draggable={draggable}
      listening={!cellToolActive}
      onMouseDown={(event) => {
        event.cancelBubble = true;
      }}
      onTouchStart={(event) => {
        event.cancelBubble = true;
      }}
      onDragStart={(event) => {
        event.cancelBubble = true;
      }}
      onDragMove={(event) => {
        event.cancelBubble = true;
      }}
      onMouseEnter={(event) => {
        const container = event.target.getStage()?.container();
        container?.style.setProperty(
          "cursor",
          selectedEquipmentId && isEditMode ? "copy" : draggable ? "move" : "pointer",
        );
      }}
      onMouseLeave={(event) => {
        const container = event.target.getStage()?.container();
        container?.style.setProperty("cursor", "grab");
      }}
      onDragEnd={async (event) => {
        event.cancelBubble = true;
        if (!onMove) return;
        const rawPlacement = {
          gridColumn: clamp(
            Math.round((event.target.x() - planX - inset) / cellWidth) + 1,
            1,
            FACILITY_GRID_MAX_COLUMNS,
          ),
          gridRow: clamp(
            Math.round((event.target.y() - planY - inset) / cellHeight) + 1,
            1,
            FACILITY_GRID_MAX_ROWS,
          ),
        };
        const snappedPlacement = resolveDrop?.(rawPlacement);
        const nextPlacement = snappedPlacement ?? rawPlacement;
        const nextLayout: VenueLayout = {
          gridColumn: nextPlacement.gridColumn,
          gridRow: nextPlacement.gridRow,
          gridWidth,
          gridHeight,
        };
        setPendingLayout(nextLayout);
        event.target.position({
          x: planX + (nextLayout.gridColumn - 1) * cellWidth + inset,
          y: planY + (nextLayout.gridRow - 1) * cellHeight + inset,
        });
        const persisted = await onMove(venue.mapId, nextLayout);
        if (!persisted) setPendingLayout(null);
      }}
      onTransformStart={(event) => {
        event.cancelBubble = true;
      }}
      onTransformEnd={async (event) => {
        event.cancelBubble = true;
        const node = nodeRef.current;
        if (!node || !onResize) return;
        const nextGridWidth = clamp(
          Math.round(gridWidth * node.scaleX()),
          1,
          FACILITY_GRID_MAX_COLUMNS - gridColumn + 1,
        );
        const nextGridHeight = clamp(
          Math.round(gridHeight * node.scaleY()),
          1,
          FACILITY_GRID_MAX_ROWS - gridRow + 1,
        );
        const nextGridColumn = clamp(
          Math.round((node.x() - planX - inset) / cellWidth) + 1,
          1,
          FACILITY_GRID_MAX_COLUMNS - nextGridWidth + 1,
        );
        const nextGridRow = clamp(
          Math.round((node.y() - planY - inset) / cellHeight) + 1,
          1,
          FACILITY_GRID_MAX_ROWS - nextGridHeight + 1,
        );
        const nextLayout: VenueLayout = {
          gridColumn: nextGridColumn,
          gridHeight: nextGridHeight,
          gridRow: nextGridRow,
          gridWidth: nextGridWidth,
        };
        setPendingLayout(nextLayout);
        node.scale({ x: 1, y: 1 });
        node.position({
          x: planX + (nextGridColumn - 1) * cellWidth + inset,
          y: planY + (nextGridRow - 1) * cellHeight + inset,
        });
        const persisted = await onResize(venue.mapId, nextLayout);
        if (!persisted) setPendingLayout(null);
      }}
      onClick={(event) => {
        event.cancelBubble = true;
        if (selectedEquipmentId && isEditMode) {
          onAssignEquipmentToVenue(selectedEquipmentId, venue.mapId);
          return;
        }
        onSelect(venue);
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(venue);
      }}
    >
      <Rect
        width={width}
        height={height}
        cornerRadius={10}
        fill={selected ? colors.brand + "33" : colors.surfaceRaised + "f2"}
        stroke={selected ? colors.brand : accent}
        strokeWidth={selected ? 2.5 : 1.5}
        shadowColor={accent}
        shadowBlur={selected ? 18 : 4}
        opacity={0.96}
        perfectDrawEnabled={false}
      />
      <VenueImage
        colors={colors}
        cropZoom={venue.imageCropZoom}
        fit={venue.imageFit}
        focalX={venue.imageFocalX}
        focalY={venue.imageFocalY}
        height={height}
        src={venueImageUrl}
        width={width}
        x={0}
        y={0}
      />
      {selected ? (
        <Rect
          x={-6}
          y={-6}
          width={width + 12}
          height={height + 12}
          cornerRadius={12}
          stroke={colors.brand}
          strokeWidth={2}
          dash={[14, 8]}
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
      {showLabel ? (
        <Text
          x={compact ? textPadding : 12}
          y={compact ? textPadding : Math.max(12, height * 0.36 - 12)}
          width={textWidth}
          text={venue.name}
          fill={colors.textPrimary}
          fontSize={labelFontSize}
          fontStyle="bold"
          align="center"
          ellipsis
          wrap="none"
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
      {showSublabel ? (
        <Text
          x={compact ? textPadding : 12}
          y={compact ? height / 2 - sublabelFontSize / 2 : Math.max(34, height * 0.36 + 10)}
          width={textWidth}
          text={sublabel}
          fill={accent}
          fontSize={sublabelFontSize}
          align="center"
          ellipsis
          wrap="none"
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
      {showEquipmentCount ? (
        <Text
          x={compact ? textPadding : 12}
          y={compact ? height - countFontSize - textPadding : Math.max(52, height - 28)}
          width={textWidth}
          text={String(assignedCount) + " equipment" + (assignedCount === 1 ? "" : "s")}
          fill={colors.textSecondary}
          fontSize={countFontSize}
          align="center"
          ellipsis
          wrap="none"
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
    </Group>
    {selected && isEditMode && !venue.isSystem && onResize ? (
      <Transformer
        ref={transformerRef}
        name="venue-resize-transformer"
        rotateEnabled={false}
        flipEnabled={false}
        enabledAnchors={[
          "top-left", "top-center", "top-right", "middle-left",
          "middle-right", "bottom-left", "bottom-center", "bottom-right",
        ]}
        anchorFill={colors.brand}
        anchorStroke={colors.surfaceRaised}
        anchorSize={14}
        borderStroke={colors.brand}
        borderDash={[8, 5]}
        keepRatio={false}
        onMouseDown={(event) => {
          event.cancelBubble = true;
        }}
        onTouchStart={(event) => {
          event.cancelBubble = true;
        }}
        boundBoxFunc={(oldBox, nextBox) =>
          nextBox.width >= cellWidth - 12 &&
          nextBox.height >= cellHeight - 12
            ? nextBox
            : oldBox
        }
      />
    ) : null}
    </>
  );
});

export default function FacilitiesKonvaMap({
  assignedEquipment,
  colors,
  equipmentById,
  equipment = [],
  footprintCells = [],
  pathCells = [],
  entryCells = [],
  exitCells = [],
  routeCells = [],
  cellTool = null,
  floorImageUrl,
  floorId = "facility-floor",
  floorBounds = { gridHeight: ROWS, gridWidth: COLS },
  fitToFloorBounds = false,
  contentReady = true,
  fitRequestKey,
  height: requestedHeight,
  isEditMode,
  onAssignEquipmentToVenue,
  onDropEquipmentToVenue,
  onMoveEquipment,
  onMoveVenue,
  onResizeFloorBounds,
  onResizeVenue,
  onPanChange,
  onZoomChange,
  onPlaceVenueAtCell,
  onSelectVenue,
  onSelectEquipment,
  onCellAction,
  pan,
  pendingVenuePlacement,
  selectedEquipmentId,
  selectedVenueMapId,
  venues,
  zoom,
}: Props) {
  const { ref, width, height: measuredHeight } = useContainerSize();
  const image = useLoadedImage(floorImageUrl);
  const height = requestedHeight ?? measuredHeight;
  const hasMeasuredSize = width > 0 && height > 0;
  const requestedFloorColumns = Math.max(1, Math.round(floorBounds.gridWidth || COLS));
  const requestedFloorRows = Math.max(1, Math.round(floorBounds.gridHeight || ROWS));
  const liveContentBounds = useMemo<FacilityContentBounds>(
    () =>
      getFacilityContentEnvelope({
        cells: [
          ...footprintCells,
          ...pathCells,
          ...entryCells,
          ...exitCells,
        ],
        equipment,
        fallback: {
          column: 1,
          row: 1,
          width: requestedFloorColumns,
          height: requestedFloorRows,
        },
        venues,
      }),
    [
      equipment,
      entryCells,
      exitCells,
      footprintCells,
      pathCells,
      requestedFloorColumns,
      requestedFloorRows,
      venues,
    ],
  );
  const [stableContentBounds, setStableContentBounds] =
    useState<FacilityContentBounds>(liveContentBounds);
  const stableFloorKeyRef = useRef<string | null>(null);
  const readyFloorKeyRef = useRef<string | null>(null);
  const fitRequestKeyRef = useRef<string | number | undefined>(fitRequestKey);

  useEffect(() => {
    if (stableFloorKeyRef.current !== floorId) {
      stableFloorKeyRef.current = floorId;
      readyFloorKeyRef.current = null;
      if (contentReady) {
        readyFloorKeyRef.current = floorId;
        setStableContentBounds(liveContentBounds);
      }
      return;
    }

    if (contentReady && readyFloorKeyRef.current !== floorId) {
      readyFloorKeyRef.current = floorId;
      setStableContentBounds(liveContentBounds);
    }
  }, [contentReady, floorId, liveContentBounds]);

  useEffect(() => {
    if (
      fitRequestKey === undefined ||
      fitRequestKeyRef.current === fitRequestKey
    ) {
      return;
    }
    fitRequestKeyRef.current = fitRequestKey;
    if (contentReady) setStableContentBounds(liveContentBounds);
  }, [contentReady, fitRequestKey, liveContentBounds]);

  const geometry = resolveFacilityMapGeometry({
    contentBounds: stableContentBounds,
    fitToFloorBounds,
    height,
    viewportWidth: width,
    zoom,
  });
  const {
    cellHeight,
    cellWidth,
    planHeight,
    planWidth,
    planX,
    planY,
  } = geometry;
  const [hoverCell, setHoverCell] = useState<GridCell | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const rectangleAnchorRef = useRef<FacilityGridCell | null>(null);
  const [rectanglePreview, setRectanglePreview] = useState<{
    anchor: FacilityGridCell;
    cell: FacilityGridCell;
  } | null>(null);
  const rectangleCurrentCellRef = useRef<FacilityGridCell | null>(null);
  const manualPanRef = useRef<{
    pointerClientX: number;
    pointerClientY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const manualPanCleanupRef = useRef<(() => void) | null>(null);
  const cellGestureModeRef = useRef<"edit" | null>(null);

  useEffect(() => () => {
    manualPanCleanupRef.current?.();
    manualPanCleanupRef.current = null;
    manualPanRef.current = null;
  }, []);
  const callbacksRef = useRef({
    onAssignEquipmentToVenue,
    onDropEquipmentToVenue,
    onMoveEquipment,
    onMoveVenue,
    onResizeFloorBounds,
    onResizeVenue,
    onPanChange,
    onZoomChange,
    onPlaceVenueAtCell,
    onSelectEquipment,
    onSelectVenue,
    onCellAction,
  });

  useEffect(() => {
    callbacksRef.current = {
      onAssignEquipmentToVenue,
      onDropEquipmentToVenue,
      onMoveEquipment,
      onMoveVenue,
      onResizeFloorBounds,
      onResizeVenue,
      onPanChange,
      onZoomChange,
      onPlaceVenueAtCell,
      onSelectEquipment,
      onSelectVenue,
      onCellAction,
    };
  }, [
    onAssignEquipmentToVenue,
    onDropEquipmentToVenue,
    onMoveEquipment,
    onMoveVenue,
    onResizeFloorBounds,
    onResizeVenue,
    onPanChange,
    onZoomChange,
    onPlaceVenueAtCell,
    onSelectEquipment,
    onSelectVenue,
    onCellAction,
  ]);

  const handleAssignEquipmentToVenue = useCallback((
    equipmentId: string,
    venueMapId: string,
  ) => {
    callbacksRef.current.onAssignEquipmentToVenue(equipmentId, venueMapId);
  }, []);

  const handleMoveEquipment = useCallback((
    equipmentId: string,
    venueMapId: string,
    placement: GridCell,
  ) => {
    return callbacksRef.current.onMoveEquipment?.(equipmentId, venueMapId, placement) ?? false;
  }, []);

  const handleMoveVenue = useCallback((
    venueMapId: string,
    placement: GridCell,
  ) => callbacksRef.current.onMoveVenue?.(venueMapId, placement) ?? false, []);

  const handleResizeVenue = useCallback((
    venueMapId: string,
    layout: VenueLayout,
  ) => callbacksRef.current.onResizeVenue?.(venueMapId, layout) ?? false, []);

  const handleSelectVenue = useCallback((venue: FloorVenueRecord) => {
    callbacksRef.current.onSelectVenue(venue);
  }, []);

  const handleSelectEquipment = useCallback((
    equipmentRecord: GymLayoutEquipmentRecord,
  ) => {
    callbacksRef.current.onSelectEquipment?.(equipmentRecord);
  }, []);

  const handlePanChange = useCallback((nextPan: { x: number; y: number }) => {
    callbacksRef.current.onPanChange(nextPan);
  }, []);

  const handleZoomChange = useCallback((
    nextZoom: number,
    nextPan: { x: number; y: number },
  ) => {
    callbacksRef.current.onZoomChange?.(nextZoom, nextPan);
  }, []);

  const handlePlaceVenueAtCell = useCallback((
    venue: FloorVenueRecord,
    placement: GridCell,
  ) => {
    return callbacksRef.current.onPlaceVenueAtCell?.(venue, placement) ?? false;
  }, []);

  const resolveVenueDrop = useCallback((venue: FloorVenueRecord, raw: GridCell) =>
    resolveNearestVenuePlacement({
      entryCells,
      exitCells,
      footprintCells,
      pathCells,
      raw,
      venue,
      venues,
    }), [entryCells, exitCells, footprintCells, pathCells, venues]);

  const resolveEquipmentDrop = useCallback((
    equipmentRecord: GymLayoutEquipmentRecord,
    raw: GridCell,
  ) => resolveNearestEquipmentPlacement({
    equipment: equipmentRecord,
    equipmentRecords: equipment,
    raw,
    venues,
  }), [equipment, venues]);

  const updateHoverCell = useCallback((nextCell: GridCell | null) => {
    setHoverCell((current) => {
      if (
        current?.gridColumn === nextCell?.gridColumn &&
        current?.gridRow === nextCell?.gridRow
      ) {
        return current;
      }
      return nextCell;
    });
  }, []);

  const pendingVenuePlacementCell = useMemo(() => {
    if (!pendingVenuePlacement || !hoverCell) return null;
    return {
      gridColumn: clamp(
        hoverCell.gridColumn,
        1,
        FACILITY_GRID_MAX_COLUMNS - Math.max(1, pendingVenuePlacement.gridWidth ?? 2) + 1,
      ),
      gridRow: clamp(
        hoverCell.gridRow,
        1,
        FACILITY_GRID_MAX_ROWS - Math.max(1, pendingVenuePlacement.gridHeight ?? 2) + 1,
      ),
    };
  }, [hoverCell, pendingVenuePlacement]);

  const resolvePointerCell = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    const localX = pointer.x - planX - pan.x;
    const localY = pointer.y - planY - pan.y;
    if (localX < 0 || localY < 0) return null;

    return {
      gridColumn: clamp(
        Math.floor(localX / cellWidth) + 1,
        1,
        FACILITY_GRID_MAX_COLUMNS,
      ),
      gridRow: clamp(
        Math.floor(localY / cellHeight) + 1,
        1,
        FACILITY_GRID_MAX_ROWS,
      ),
    };
  };
  const lastPaintedCellRef = useRef<string | null>(null);
  const applyCellToolAtStage = (stage: Konva.Stage) => {
    if (!cellTool || !callbacksRef.current.onCellAction) return;
    const cell = resolvePointerCell(stage);
    if (!cell) return;
    const key = `${cell.gridColumn}:${cell.gridRow}`;
    if (lastPaintedCellRef.current === key) return;
    lastPaintedCellRef.current = key;
    callbacksRef.current.onCellAction(cellTool, {
      column: cell.gridColumn,
      row: cell.gridRow,
    });
  };

  const updateManualPanFromClient = (point: ClientPoint) => {
    const gesture = manualPanRef.current;
    if (!gesture) return;
    handlePanChange({
      x: gesture.panX + point.x - gesture.pointerClientX,
      y: gesture.panY + point.y - gesture.pointerClientY,
    });
  };

  const cleanupManualPanListeners = () => {
    manualPanCleanupRef.current?.();
    manualPanCleanupRef.current = null;
  };

  const beginManualPan = (stage: Konva.Stage, clientPoint?: ClientPoint) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return false;
    cleanupManualPanListeners();
    const startPoint = clientPoint ?? { x: pointer.x, y: pointer.y };
    manualPanRef.current = {
      pointerClientX: startPoint.x,
      pointerClientY: startPoint.y,
      panX: pan.x,
      panY: pan.y,
    };
    const handleMouseMove = (event: MouseEvent) => {
      const point = resolveClientPoint(event);
      if (point) updateManualPanFromClient(point);
    };
    const handleMouseUp = () => endManualPan(stage);
    const handleTouchMove = (event: TouchEvent) => {
      const point = resolveClientPoint(event);
      if (!point) return;
      event.preventDefault();
      updateManualPanFromClient(point);
    };
    const handleTouchEnd = () => endManualPan(stage);
    const handleWindowBlur = () => endManualPan(stage);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    window.addEventListener("blur", handleWindowBlur);
    manualPanCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      window.removeEventListener("blur", handleWindowBlur);
    };
    setIsPanning(true);
    updateHoverCell(null);
    stage.container().style.setProperty("cursor", "grabbing");
    return true;
  };

  const endManualPan = (stage?: Konva.Stage) => {
    cleanupManualPanListeners();
    if (!manualPanRef.current) return;
    manualPanRef.current = null;
    setIsPanning(false);
    stage?.container().style.setProperty(
      "cursor",
      pendingVenuePlacement ? "crosshair" : "grab",
    );
  };

  const beginCellGesture = (stage: Konva.Stage) => {
    if (!cellTool) return;
    if (cellTool === "rectangle-fill") {
      cellGestureModeRef.current = "edit";
      beginRectangleFill(stage);
      return;
    }
    // Cell tools own the pointer from the initial down event. Invalid cells
    // are consumed by applyCellToolAtStage as no-ops; they must never start
    // the canvas pan gesture.
    cellGestureModeRef.current = "edit";
    applyCellToolAtStage(stage);
  };

  const beginRectangleFill = (stage: Konva.Stage) => {
    if (cellTool !== "rectangle-fill" || !callbacksRef.current.onCellAction) return;
    const cell = resolvePointerCell(stage);
    if (!cell) return;
    const nextCell = { column: cell.gridColumn, row: cell.gridRow };
    rectangleAnchorRef.current = nextCell;
    rectangleCurrentCellRef.current = nextCell;
    setRectanglePreview({ anchor: nextCell, cell: nextCell });
    lastPaintedCellRef.current = `${cell.gridColumn}:${cell.gridRow}`;
    callbacksRef.current.onCellAction(cellTool, nextCell, "start");
  };

  const updateRectanglePreview = (stage: Konva.Stage) => {
    if (cellTool !== "rectangle-fill" || !rectangleAnchorRef.current) return;
    const cell = resolvePointerCell(stage);
    if (!cell) return;
    const nextCell = {
      column: cell.gridColumn,
      row: cell.gridRow,
    };
    rectangleCurrentCellRef.current = nextCell;
    setRectanglePreview({ anchor: rectangleAnchorRef.current, cell: nextCell });
  };

  const commitRectangleFill = (stage: Konva.Stage) => {
    if (cellTool !== "rectangle-fill" || !rectangleAnchorRef.current) return;
    const resolvedCell = resolvePointerCell(stage);
    const cell = resolvedCell
      ? { column: resolvedCell.gridColumn, row: resolvedCell.gridRow }
      : rectangleCurrentCellRef.current;
    if (cell && callbacksRef.current.onCellAction) {
      callbacksRef.current.onCellAction(cellTool, {
        column: cell.column,
        row: cell.row,
      }, "commit");
    }
    rectangleAnchorRef.current = null;
    rectangleCurrentCellRef.current = null;
    setRectanglePreview(null);
    lastPaintedCellRef.current = null;
  };

  const cancelRectangleFill = () => {
    if (!rectangleAnchorRef.current) return;
    const anchor = rectangleAnchorRef.current;
    callbacksRef.current.onCellAction?.("rectangle-fill", anchor, "cancel");
    rectangleAnchorRef.current = null;
    rectangleCurrentCellRef.current = null;
    setRectanglePreview(null);
    lastPaintedCellRef.current = null;
  };

  const publishedCellNodes = useMemo(() => {
    const cullingViewport = {
      bottom: height - pan.y + 96,
      left: -pan.x - 96,
      right: width - pan.x + 96,
      top: -pan.y - 96,
    };
    const renderCells = (cells: FacilityGridCell[], fill: string, prefix: string, opacity: number) =>
      cells.filter((cell) => isRectVisible(
        planX + (cell.column - 1) * cellWidth,
        planY + (cell.row - 1) * cellHeight,
        cellWidth,
        cellHeight,
        cullingViewport,
      )).map((cell) => (
        <Rect key={`${prefix}-${cell.column}-${cell.row}`}
          x={planX + (cell.column - 1) * cellWidth}
          y={planY + (cell.row - 1) * cellHeight}
          width={cellWidth} height={cellHeight} fill={fill} opacity={opacity}
          listening={false} perfectDrawEnabled={false} />
      ));
    return {
      footprint: renderCells(footprintCells, colors.surfaceRaised, "footprint", 0.42),
      navigation: [
      ...renderCells(pathCells, colors.brand, "path", 0.2),
      ...renderCells(entryCells, colors.success, "entry", 0.5),
      ...renderCells(exitCells, colors.warning, "exit", 0.5),
      ],
      route: renderCells(routeCells, colors.brand, "route", 0.65),
    };
  }, [cellHeight, cellWidth, colors, entryCells, exitCells, footprintCells, height, pan.x, pan.y, pathCells, planX, planY, routeCells, width]);

  const unpaintedCellNodes = useMemo(() => {
    const painted = new Set(
      footprintCells.map((cell) => `${cell.column}:${cell.row}`),
    );
    const visibleCells = resolveFacilityMapVisibleCellBounds({
      geometry,
      height,
      padding: 96,
      pan,
      viewportWidth: width,
    });
    if (!visibleCells) return [];
    const { firstColumn, firstRow, lastColumn, lastRow } = visibleCells;
    if (
      (lastColumn - firstColumn + 1) * (lastRow - firstRow + 1) >
      FACILITY_GRID_MAX_CELLS
    ) {
      return [];
    }
    const cells: FacilityGridCell[] = [];
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        if (!painted.has(`${column}:${row}`)) cells.push({ column, row });
      }
    }
    return cells
      .map((cell) => (
        <Rect
          key={`unpainted-${cell.column}-${cell.row}`}
          name="unpainted-planning-cell"
          x={planX + (cell.column - 1) * cellWidth + 1}
          y={planY + (cell.row - 1) * cellHeight + 1}
          width={Math.max(1, cellWidth - 2)}
          height={Math.max(1, cellHeight - 2)}
          fill={colors.base}
          opacity={0.72}
          stroke={colors.border}
          strokeWidth={1}
          dash={[3, 4]}
          listening={false}
          perfectDrawEnabled={false}
        />
      ));
  }, [cellHeight, cellWidth, colors.base, colors.border, footprintCells, geometry, height, planX, planY, width, pan]);

  const cullingViewport = useMemo(() => ({
    bottom: height - pan.y + 96,
    left: -pan.x - 96,
    right: width - pan.x + 96,
    top: -pan.y - 96,
  }), [height, pan.x, pan.y, width]);

  const visibleVenues = useMemo(() => venues.filter((venue) => {
    const gridColumn = Math.max(1, venue.gridColumn ?? 1);
    const gridRow = Math.max(1, venue.gridRow ?? 1);
    const gridWidth = Math.max(1, venue.gridWidth ?? 2);
    const gridHeight = Math.max(1, venue.gridHeight ?? 2);
    const x = planX + (gridColumn - 1) * cellWidth;
    const y = planY + (gridRow - 1) * cellHeight;
    return (
      venue.mapId === selectedVenueMapId ||
      isRectVisible(
        x,
        y,
        gridWidth * cellWidth,
        gridHeight * cellHeight,
        cullingViewport,
      )
    );
  }), [
    cellHeight,
    cellWidth,
    cullingViewport,
    planX,
    planY,
    selectedVenueMapId,
    venues,
  ]);

  const venueNodes = useMemo(() => visibleVenues.map((venue) => {
    const gridColumn = Math.max(1, venue.gridColumn ?? 1);
    const gridRow = Math.max(1, venue.gridRow ?? 1);
    const nodeInset = getNodeInset(fitToFloorBounds, cellWidth, cellHeight);
    const assignedCount = (assignedEquipment[venue.mapId] ?? []).reduce(
      (count, equipmentId) => count + (equipmentById[equipmentId] ? 1 : 0),
      0,
    );

    return (
      <VenueNode
        key={venue.mapId}
        assignedCount={assignedCount}
        cellHeight={cellHeight}
        cellWidth={cellWidth}
        compact={fitToFloorBounds}
        colors={colors}
        cellToolActive={Boolean(cellTool)}
        isEditMode={isEditMode}
        isPlacementActive={Boolean(pendingVenuePlacement)}
        onAssignEquipmentToVenue={handleAssignEquipmentToVenue}
        onMove={handleMoveVenue}
        resolveDrop={(raw) => resolveVenueDrop(venue, raw)}
        onResize={handleResizeVenue}
        onSelect={handleSelectVenue}
        planX={planX}
        planY={planY}
        selected={selectedVenueMapId === venue.mapId}
        selectedEquipmentId={selectedEquipmentId}
        venue={venue}
        x={planX + (gridColumn - 1) * cellWidth + nodeInset}
        y={planY + (gridRow - 1) * cellHeight + nodeInset}
      />
    );
  }), [
    assignedEquipment,
    cellHeight,
    cellWidth,
    cellTool,
    colors,
    fitToFloorBounds,
    handleAssignEquipmentToVenue,
    handleMoveVenue,
    handleResizeVenue,
    handleSelectVenue,
    isEditMode,
    planX,
    planY,
    pendingVenuePlacement,
    resolveVenueDrop,
    selectedEquipmentId,
    selectedVenueMapId,
    visibleVenues,
    equipmentById,
  ]);

  const resolveClientCell = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => {
      const stageX = clientX - rect.left;
      const stageY = clientY - rect.top;
      const localX = stageX - planX - pan.x;
      const localY = stageY - planY - pan.y;
      if (localX < 0 || localY < 0) return null;

      return {
        gridColumn: clamp(
          Math.floor(localX / cellWidth) + 1,
          1,
          FACILITY_GRID_MAX_COLUMNS,
        ),
        gridRow: clamp(
          Math.floor(localY / cellHeight) + 1,
          1,
          FACILITY_GRID_MAX_ROWS,
        ),
      };
    },
    [cellHeight, cellWidth, pan.x, pan.y, planX, planY],
  );

  const equipmentNodes = useMemo(() => equipment.flatMap((record) => {
    const venue = venues.find((candidate) => {
      const venueId = String(candidate.sourceVenueId ?? candidate.id);
      return (
        (assignedEquipment[candidate.mapId] ?? []).includes(record.id) ||
        record.venueId === venueId ||
        isEquipmentInsideVenue(record, candidate)
      );
    });
    if (!venue) return [];

    const placement = resolveEquipmentGridPlacement(record);
    const nodeWidth = fitToFloorBounds
      ? Math.min(cellWidth, Math.max(1, cellWidth * 0.82))
      : Math.max(28, Math.min(cellWidth * 0.82, 78));
    const nodeHeight = fitToFloorBounds
      ? Math.min(cellHeight, Math.max(1, cellHeight * 0.82))
      : Math.max(24, Math.min(cellHeight * 0.82, 54));
    const x = planX + (placement.gridColumn - 0.5) * cellWidth;
    const y = planY + (placement.gridRow - 0.5) * cellHeight;
    if (
      !isRectVisible(
        x - nodeWidth / 2,
        y - nodeHeight / 2,
        nodeWidth,
        nodeHeight,
        cullingViewport,
      )
    ) {
      return [];
    }

    return [
      <EquipmentNode
        key={record.id}
        compact={fitToFloorBounds}
        colors={colors}
        cellToolActive={Boolean(cellTool)}
        height={nodeHeight}
        isEditMode={isEditMode}
        record={record}
        width={nodeWidth}
        x={x}
        y={y}
        onMove={handleMoveEquipment}
        resolveDrop={(raw) => resolveEquipmentDrop(record, raw)}
        onSelect={handleSelectEquipment}
        venue={venue}
        venues={venues}
        planX={planX}
        planY={planY}
        cellWidth={cellWidth}
        cellHeight={cellHeight}
      />,
    ];
  }), [
    assignedEquipment,
    cellHeight,
    cellWidth,
    cellTool,
    colors,
    cullingViewport,
    equipment,
    fitToFloorBounds,
    handleMoveEquipment,
    handleSelectEquipment,
    isEditMode,
    planX,
    planY,
    resolveEquipmentDrop,
    venues,
  ]);

  const acceptEquipmentDrop = useCallback(
    (equipmentId: string, clientX: number, clientY: number) => {
      if (!isEditMode || !callbacksRef.current.onDropEquipmentToVenue) return;
      const element = ref.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        updateHoverCell(null);
        return;
      }
      const cell = resolveClientCell(clientX, clientY, rect);
      if (!cell) {
        updateHoverCell(null);
        return;
      }
      const targetVenue = venues.find((venue) => {
        if (String(venue.floorId) !== String(floorId) || venue.isMapped === false) {
          return false;
        }
        const left = venue.gridColumn ?? 1;
        const top = venue.gridRow ?? 1;
        const right = left + (venue.gridWidth ?? 1) - 1;
        const bottom = top + (venue.gridHeight ?? 1) - 1;
        return (
          cell.gridColumn >= left &&
          cell.gridColumn <= right &&
          cell.gridRow >= top &&
          cell.gridRow <= bottom
        );
      });
      if (!targetVenue) {
        updateHoverCell(null);
        return;
      }
      callbacksRef.current.onDropEquipmentToVenue(
        equipmentId,
        targetVenue.mapId,
        cell,
      );
      updateHoverCell(null);
    },
    [floorId, isEditMode, ref, resolveClientCell, updateHoverCell, venues],
  );
  const { setNodeRef: setCanvasDroppableRef } = useDroppable({
    data: {
      acceptEquipmentDrop,
      floorId,
      kind: "facility-map",
    } satisfies FacilityEquipmentDropData,
    disabled: !isEditMode || !onDropEquipmentToVenue,
    id: `facility-map:${floorId}`,
  });
  const setContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      ref.current = element;
      setCanvasDroppableRef(element);
    },
    [ref, setCanvasDroppableRef],
  );

  return (
    <div
      ref={setContainerRef}
      style={{
        cursor: isPanning ? "grabbing" : pendingVenuePlacement ? "crosshair" : "grab",
        height: "100%",
        maxWidth: "100%",
        minHeight: 360,
        minWidth: 0,
        overflow: "hidden",
        width: "100%",
      }}
    >
      {hasMeasuredSize ? (
        <Stage
          width={width}
          height={height}
          onMouseDown={(event) => {
            const stage = event.target.getStage();
            if (!stage) return;
            const target = event.target as unknown as Konva.Node;
            if (cellTool) {
              event.cancelBubble = true;
              beginCellGesture(stage);
            } else if (!pendingVenuePlacement && !isInteractiveNode(target)) {
              const clientPoint = resolveClientPoint(event.evt as MouseEvent);
              beginManualPan(stage, clientPoint ?? undefined);
            }
          }}
          onMouseUp={(event) => {
            const stage = event.target.getStage();
            if (cellTool) event.cancelBubble = true;
            if (stage) endManualPan(stage);
            if (stage && cellTool === "rectangle-fill") commitRectangleFill(stage);
            cellGestureModeRef.current = null;
            lastPaintedCellRef.current = null;
          }}
          onMouseMove={(event) => {
            const stage = event.target.getStage();
            if (manualPanRef.current) return;
            if (stage && cellTool && event.evt.buttons === 1) {
              event.cancelBubble = true;
              if (cellTool === "rectangle-fill") {
                updateRectanglePreview(stage);
                return;
              }
              applyCellToolAtStage(stage);
              return;
            }
            if (!stage || !pendingVenuePlacement) return;
            updateHoverCell(resolvePointerCell(stage));
          }}
          onMouseLeave={() => {
            cancelRectangleFill();
            cellGestureModeRef.current = null;
            updateHoverCell(null);
          }}
          onTouchStart={(event) => {
            const stage = event.target.getStage();
            if (!stage) return;
            const target = event.target as unknown as Konva.Node;
            if (cellTool) {
              event.cancelBubble = true;
              beginCellGesture(stage);
            } else if (!pendingVenuePlacement && !isInteractiveNode(target)) {
              const clientPoint = resolveClientPoint(event.evt as TouchEvent);
              beginManualPan(stage, clientPoint ?? undefined);
            }
          }}
          onTouchMove={(event) => {
            const stage = event.target.getStage();
            if (manualPanRef.current) return;
            if (stage && cellTool) {
              event.cancelBubble = true;
              if (cellTool === "rectangle-fill") {
                updateRectanglePreview(stage);
                return;
              }
              applyCellToolAtStage(stage);
              return;
            }
            if (!stage || !pendingVenuePlacement) return;
            updateHoverCell(resolvePointerCell(stage));
          }}
          onTouchEnd={(event) => {
            const stage = event.target.getStage();
            if (cellTool) event.cancelBubble = true;
            if (stage) endManualPan(stage);
            if (stage && cellTool === "rectangle-fill") commitRectangleFill(stage);
            cellGestureModeRef.current = null;
            lastPaintedCellRef.current = null;
          }}
          onTouchCancel={() => {
            endManualPan();
            cancelRectangleFill();
            cellGestureModeRef.current = null;
            lastPaintedCellRef.current = null;
          }}
          onWheel={(event) => {
            if (!callbacksRef.current.onZoomChange) return;
            event.evt.preventDefault();
            event.cancelBubble = true;
            const stage = event.target.getStage();
            const pointer = stage?.getPointerPosition();
            if (!stage || !pointer) return;
            const direction = event.evt.deltaY < 0 ? 1 : -1;
            const nextZoom = clampFacilityMapZoom(
              Number((geometry.zoom + direction * FACILITY_MAP_ZOOM_STEP).toFixed(2)),
            );
            if (nextZoom === geometry.zoom) return;
            const nextGeometry = resolveFacilityMapGeometry({
              contentBounds: stableContentBounds,
              fitToFloorBounds,
              height,
              viewportWidth: width,
              zoom: nextZoom,
            });
            handleZoomChange(
              nextZoom,
              resolveFacilityMapFocalPan({
                currentGeometry: geometry,
                currentPan: pan,
                nextGeometry,
                pointerX: pointer.x,
                pointerY: pointer.y,
              }),
            );
          }}
          onClick={(event) => {
            if (
              cellTool ||
              !pendingVenuePlacement ||
              !callbacksRef.current.onPlaceVenueAtCell
            ) {
              return;
            }
            const stage = event.target.getStage();
            if (!stage) return;
            const cell = resolvePointerCell(stage);
            if (!cell) return;
            void handlePlaceVenueAtCell(pendingVenuePlacement, {
              gridColumn: clamp(
                cell.gridColumn,
                1,
                FACILITY_GRID_MAX_COLUMNS - Math.max(1, pendingVenuePlacement.gridWidth ?? 2) + 1,
              ),
              gridRow: clamp(
                cell.gridRow,
                1,
                FACILITY_GRID_MAX_ROWS - Math.max(1, pendingVenuePlacement.gridHeight ?? 2) + 1,
              ),
            });
          }}
        >
        <Layer>
          <Rect
            name="canvas-background"
            x={0}
            y={0}
            width={width}
            height={height}
            cornerRadius={14}
            fill={colors.base}
            stroke={colors.border}
            strokeWidth={1}
            listening={false}
            perfectDrawEnabled={false}
          />
          <Group
            name="facility-pan-group"
            x={pan.x}
            y={pan.y}
          >
            <Rect
              name="pan-surface"
              x={-100_000}
              y={-100_000}
              width={200_000}
              height={200_000}
              fill={colors.base}
              opacity={0.001}
              perfectDrawEnabled={false}
            />
          {publishedCellNodes.footprint}
          {unpaintedCellNodes}
          {rectanglePreview ? (
            <Rect
              name="rectangle-fill-preview"
              x={
                planX +
                (Math.min(rectanglePreview.anchor.column, rectanglePreview.cell.column) - 1) *
                  cellWidth +
                1
              }
              y={
                planY +
                (Math.min(rectanglePreview.anchor.row, rectanglePreview.cell.row) - 1) *
                  cellHeight +
                1
              }
              width={
                (Math.abs(rectanglePreview.anchor.column - rectanglePreview.cell.column) + 1) *
                  cellWidth -
                2
              }
              height={
                (Math.abs(rectanglePreview.anchor.row - rectanglePreview.cell.row) + 1) *
                  cellHeight -
                2
              }
              fill={`${colors.brand}33`}
              stroke={colors.brand}
              strokeWidth={2}
              dash={[6, 4]}
              listening={false}
              perfectDrawEnabled={false}
            />
          ) : null}
          {image ? (
            <KonvaImage
              image={image}
              x={planX}
              y={planY}
              width={planWidth}
              height={planHeight}
              opacity={0.16}
              listening={false}
              perfectDrawEnabled={false}
            />
          ) : null}
          {publishedCellNodes.navigation}
          {venueNodes}
          {equipmentNodes}
          {publishedCellNodes.route}
          {pendingVenuePlacementCell && pendingVenuePlacement ? (
            <Rect
              x={planX + (pendingVenuePlacementCell.gridColumn - 1) * cellWidth + 6}
              y={planY + (pendingVenuePlacementCell.gridRow - 1) * cellHeight + 6}
              width={Math.max(1, pendingVenuePlacement.gridWidth ?? 2) * cellWidth - 12}
              height={Math.max(1, pendingVenuePlacement.gridHeight ?? 2) * cellHeight - 12}
              cornerRadius={10}
              fill={`${colors.brand}22`}
              stroke={colors.brand}
              strokeWidth={2}
              dash={[8, 6]}
              listening={false}
              perfectDrawEnabled={false}
            />
          ) : null}
          </Group>
        </Layer>
        </Stage>
      ) : null}
    </div>
  );
}
