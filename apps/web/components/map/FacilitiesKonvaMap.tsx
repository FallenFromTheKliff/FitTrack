"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type {
  GymLayoutEquipmentRecord,
  FacilityGridCell,
  ThemeColors,
} from "@fittrack/types";
import {
  isEquipmentInsideVenue,
  resolveEquipmentGridPlacement,
} from "@fittrack/types";

import { COLS, ROWS } from "@/data/facilities/mapTypes";
import type { FloorVenueRecord } from "@/data/facilities/floorPlans";
import type { VenueEquipmentAssignments } from "@/data/facilities/mapTypes";
import type { QuickFloorRegionTemplate } from "@/hooks/facilities/useFacilities";

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
  floorBounds?: { gridHeight: number; gridWidth: number };
  height?: number;
  isEditMode: boolean;
  pan: { x: number; y: number };
  quickRegionTemplate?: QuickFloorRegionTemplate | null;
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
  onPlaceQuickRegionAtCell?: (
    template: QuickFloorRegionTemplate,
    placement: { gridColumn: number; gridRow: number },
  ) => void;
  onSelectVenue: (venue: FloorVenueRecord) => void;
  onSelectEquipment?: (equipment: GymLayoutEquipmentRecord) => void;
  onCellAction?: (
    tool: import("@/hooks/facilities/useFacilities").FacilityCellEditorTool,
    cell: FacilityGridCell,
  ) => void;
};

type ZoneTone = "available" | "equipment" | "reservable" | "support";
type GridCell = { gridColumn: number; gridRow: number };
type VenueLayout = GridCell & { gridHeight: number; gridWidth: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  const [width, setWidth] = useState(960);
  const [height, setHeight] = useState(560);

  useEffect(() => {
    if (!ref.current) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(320, Math.floor(entry.contentRect.width));
      const nextHeight = Math.max(360, Math.floor(entry.contentRect.height));
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
  colors,
  height,
  isEditMode,
  record,
  width,
  x,
  y,
  onMove,
  onSelect,
  venue,
  venues,
  planX,
  planY,
  cellWidth,
  cellHeight,
  selected = false,
}: {
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
  onSelect?: (equipment: GymLayoutEquipmentRecord) => void;
  venue: FloorVenueRecord;
  venues: FloorVenueRecord[];
  planX: number;
  planY: number;
  cellWidth: number;
  cellHeight: number;
  selected?: boolean;
}) {
  const image = useLoadedImage(record.imageUrl);
  const accent = statusColor(record.status, colors);
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
      onMouseDown={(event) => {
        event.cancelBubble = true;
      }}
      onTouchStart={(event) => {
        event.cancelBubble = true;
      }}
      onMouseEnter={(event) => {
        const container = event.target.getStage()?.container();
        container?.style.setProperty("cursor", draggable ? "move" : "pointer");
      }}
      onDragEnd={(event) => {
        event.cancelBubble = true;
        if (!onMove) return;
        const nextColumn = clamp(
          Math.floor((event.target.x() - planX) / cellWidth) + 1,
          1,
          COLS,
        );
        const nextRow = clamp(
          Math.floor((event.target.y() - planY) / cellHeight) + 1,
          1,
          ROWS,
        );
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
        setPendingPlacement({
          gridColumn: nextColumn,
          gridRow: nextRow,
          venueMapId: targetVenue?.mapId ?? "",
        });
        void Promise.resolve(
          onMove(record.id, targetVenue?.mapId ?? "", {
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
          x={-width / 2 + 3}
          y={-height / 2 + 3}
          width={width - 6}
          height={height - 6}
          opacity={0.32}
          cornerRadius={6}
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
      <Text
        x={-width / 2 + 4}
        y={-Math.min(8, height / 5)}
        width={width - 8}
        text={record.name.slice(0, 12)}
        fill={colors.textPrimary}
        fontSize={Math.max(7, Math.min(10, width / 7))}
        fontStyle="bold"
        align="center"
        ellipsis
        wrap="none"
        listening={false}
        perfectDrawEnabled={false}
      />
      <Text
        x={-width / 2 + 4}
        y={Math.min(3, height / 5)}
        width={width - 8}
        text={pendingPlacement ? "Saving..." : record.status}
        fill={accent}
        fontSize={Math.max(7, Math.min(9, width / 8))}
        align="center"
        ellipsis
        wrap="none"
        listening={false}
        perfectDrawEnabled={false}
      />
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
  colors,
  isEditMode,
  isQuickPlacementActive,
  onAssignEquipmentToVenue,
  onMove,
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
  colors: ThemeColors;
  isEditMode: boolean;
  isQuickPlacementActive: boolean;
  onAssignEquipmentToVenue: (equipmentId: string, venueMapId: string) => void;
  onMove?: (
    venueMapId: string,
    placement: { gridColumn: number; gridRow: number },
  ) => boolean | Promise<boolean>;
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
  const width = Math.max(12, gridWidth * cellWidth - 12);
  const height = Math.max(12, gridHeight * cellHeight - 12);
  const nodeX = pendingLayout
    ? planX + (gridColumn - 1) * cellWidth + 6
    : x;
  const nodeY = pendingLayout
    ? planY + (gridRow - 1) * cellHeight + 6
    : y;
  const tone = venue.isReservable === false ? "support" : "reservable";
  const isMaintained = venue.status === "maintenance";
  const accent = isMaintained ? colors.danger : toneColor(tone, colors);
  const draggable =
    isEditMode &&
    !venue.isSystem &&
    !selectedEquipmentId &&
    !isQuickPlacementActive;
  const sublabel = isMaintained
    ? "Maintenance"
    : venue.isReservable === false
        ? "Support Zone"
        : "Reservable";

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
      onMouseDown={(event) => {
        event.cancelBubble = true;
      }}
      onTouchStart={(event) => {
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
        const rawColumn = Math.round((event.target.x() - planX - 6) / cellWidth) + 1;
        const rawRow = Math.round((event.target.y() - planY - 6) / cellHeight) + 1;
        const nextLayout: VenueLayout = {
          gridColumn: rawColumn,
          gridRow: rawRow,
          gridWidth,
          gridHeight,
        };
        setPendingLayout(nextLayout);
        event.target.position({
          x: planX + (nextLayout.gridColumn - 1) * cellWidth + 6,
          y: planY + (nextLayout.gridRow - 1) * cellHeight + 6,
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
          COLS - gridColumn + 1,
        );
        const nextGridHeight = clamp(
          Math.round(gridHeight * node.scaleY()),
          1,
          ROWS - gridRow + 1,
        );
        const nextGridColumn = clamp(
          Math.round((node.x() - planX - 6) / cellWidth) + 1,
          1,
          COLS - nextGridWidth + 1,
        );
        const nextGridRow = clamp(
          Math.round((node.y() - planY - 6) / cellHeight) + 1,
          1,
          ROWS - nextGridHeight + 1,
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
          x: planX + (nextGridColumn - 1) * cellWidth + 6,
          y: planY + (nextGridRow - 1) * cellHeight + 6,
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
        src={venue.imageUrl}
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
      <Text
        x={12}
        y={Math.max(12, height * 0.36 - 12)}
        width={Math.max(40, width - 24)}
        text={venue.name}
        fill={colors.textPrimary}
        fontSize={Math.max(11, Math.min(15, width / 14))}
        fontStyle="bold"
        align="center"
        ellipsis
        wrap="none"
        listening={false}
        perfectDrawEnabled={false}
      />
      <Text
        x={12}
        y={Math.max(34, height * 0.36 + 10)}
        width={Math.max(40, width - 24)}
        text={sublabel}
        fill={accent}
        fontSize={10}
        align="center"
        ellipsis
        wrap="none"
        listening={false}
        perfectDrawEnabled={false}
      />
      <Text
        x={12}
        y={Math.max(52, height - 28)}
        width={Math.max(40, width - 24)}
        text={String(assignedCount) + " equipment" + (assignedCount === 1 ? "" : "s")}
        fill={colors.textSecondary}
        fontSize={9}
        align="center"
        ellipsis
        wrap="none"
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
    {selected && isEditMode && !venue.isSystem && onResize ? (
      <Transformer
        ref={transformerRef}
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
  floorBounds = { gridHeight: ROWS, gridWidth: COLS },
  height: requestedHeight,
  isEditMode,
  onAssignEquipmentToVenue,
  onDropEquipmentToVenue,
  onMoveEquipment,
  onMoveVenue,
  onResizeFloorBounds,
  onResizeVenue,
  onPanChange,
  onPlaceQuickRegionAtCell,
  onSelectVenue,
  onSelectEquipment,
  onCellAction,
  pan,
  quickRegionTemplate,
  selectedEquipmentId,
  selectedVenueMapId,
  venues,
  zoom,
}: Props) {
  const { ref, width, height: measuredHeight } = useContainerSize();
  const image = useLoadedImage(floorImageUrl);
  const height = requestedHeight ?? measuredHeight;
  const planScale = clamp(zoom, 0.75, 1.25);
  const maxPlanWidth = Math.max(280, width - 36);
  const maxPlanHeight = Math.max(280, height - 44);
  const basePlanWidth = Math.min(maxPlanWidth, maxPlanHeight * (COLS / ROWS));
  const basePlanHeight = basePlanWidth * (ROWS / COLS);
  const planWidth = basePlanWidth * planScale * (floorBounds.gridWidth / COLS);
  const planHeight = basePlanHeight * planScale * (floorBounds.gridHeight / ROWS);
  const planX = (width - planWidth) / 2;
  const planY = (height - planHeight) / 2;
  const cellWidth = planWidth / COLS;
  const cellHeight = planHeight / ROWS;
  const panLimitX = Math.min(720, Math.max(180, width * 0.75));
  const panLimitY = Math.min(520, Math.max(180, height * 0.75));
  const gridLines = useMemo(() => [
    ...Array.from({ length: COLS + 1 }, (_, index) => (
      <Rect
        key={"col-" + index}
        x={planX + index * cellWidth}
        y={planY}
        width={1}
        height={planHeight}
        fill={colors.border}
        opacity={0.16}
        listening={false}
        perfectDrawEnabled={false}
      />
    )),
    ...Array.from({ length: ROWS + 1 }, (_, index) => (
      <Rect
        key={"row-" + index}
        x={planX}
        y={planY + index * cellHeight}
        width={planWidth}
        height={1}
        fill={colors.border}
        opacity={0.16}
        listening={false}
        perfectDrawEnabled={false}
      />
    )),
  ], [
    cellHeight,
    cellWidth,
    colors.border,
    planHeight,
    planWidth,
    planX,
    planY,
  ]);
  const [hoverCell, setHoverCell] = useState<GridCell | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [floorBoundsSelected, setFloorBoundsSelected] = useState(false);
  const floorBoundsRef = useRef<Konva.Rect>(null);
  const floorTransformerRef = useRef<Konva.Transformer>(null);
  const callbacksRef = useRef({
    onAssignEquipmentToVenue,
    onDropEquipmentToVenue,
    onMoveEquipment,
    onMoveVenue,
    onResizeFloorBounds,
    onResizeVenue,
    onPanChange,
    onPlaceQuickRegionAtCell,
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
      onPlaceQuickRegionAtCell,
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
    onPlaceQuickRegionAtCell,
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

  useEffect(() => {
    if (!floorBoundsSelected || !isEditMode || !onResizeFloorBounds) return;
    const node = floorBoundsRef.current;
    const transformer = floorTransformerRef.current;
    if (!node || !transformer) return;
    transformer.nodes([node]);
    transformer.getLayer()?.batchDraw();
  }, [floorBoundsSelected, isEditMode, onResizeFloorBounds]);

  useEffect(() => {
    if (selectedVenueMapId || selectedEquipmentId || quickRegionTemplate) {
      setFloorBoundsSelected(false);
    }
  }, [quickRegionTemplate, selectedEquipmentId, selectedVenueMapId]);

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

  const handlePlaceQuickRegionAtCell = useCallback((
    template: QuickFloorRegionTemplate,
    placement: GridCell,
  ) => {
    callbacksRef.current.onPlaceQuickRegionAtCell?.(template, placement);
  }, []);

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

  const quickPlacement = useMemo(() => {
    if (!quickRegionTemplate || !hoverCell) return null;
    return {
      gridColumn: clamp(hoverCell.gridColumn, 1, COLS - quickRegionTemplate.gridWidth + 1),
      gridRow: clamp(hoverCell.gridRow, 1, ROWS - quickRegionTemplate.gridHeight + 1),
    };
  }, [hoverCell, quickRegionTemplate]);

  const resolvePointerCell = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    const localX = clamp(pointer.x - planX - pan.x, 0, planWidth - 1);
    const localY = clamp(pointer.y - planY - pan.y, 0, planHeight - 1);

    return {
      gridColumn: clamp(Math.floor(localX / cellWidth) + 1, 1, COLS),
      gridRow: clamp(Math.floor(localY / cellHeight) + 1, 1, ROWS),
    };
  };
  const lastPaintedCellRef = useRef<string | null>(null);
  const applyCellToolAtStage = (stage: Konva.Stage) => {
    if (!cellTool || !onCellAction) return;
    const cell = resolvePointerCell(stage);
    if (!cell) return;
    const key = `${cell.gridColumn}:${cell.gridRow}`;
    if (lastPaintedCellRef.current === key) return;
    lastPaintedCellRef.current = key;
    onCellAction(cellTool, { column: cell.gridColumn, row: cell.gridRow });
  };

  const publishedCellNodes = useMemo(() => {
    const renderCells = (cells: FacilityGridCell[], fill: string, prefix: string, opacity: number) =>
      cells.map((cell) => (
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
  }, [cellHeight, cellWidth, colors, entryCells, exitCells, footprintCells, pathCells, planX, planY, routeCells]);

  const unpaintedCellNodes = useMemo(() => {
    const painted = new Set(
      footprintCells.map((cell) => `${cell.column}:${cell.row}`),
    );
    return Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: COLS }, (_, column) => ({
        column: column + 1,
        row: row + 1,
      })),
    )
      .flat()
      .filter((cell) => !painted.has(`${cell.column}:${cell.row}`))
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
  }, [cellHeight, cellWidth, colors.base, colors.border, footprintCells, planX, planY]);

  const constrainPan = useCallback((nextPan: { x: number; y: number }) => ({
    x: clamp(nextPan.x, -panLimitX, panLimitX),
    y: clamp(nextPan.y, -panLimitY, panLimitY),
  }), [panLimitX, panLimitY]);

  const handlePanDragStart = useCallback((
    event: Konva.KonvaEventObject<DragEvent>,
  ) => {
    setIsPanning(true);
    updateHoverCell(null);
    const container = event.target.getStage()?.container();
    container?.style.setProperty("cursor", "grabbing");
  }, [updateHoverCell]);

  const handlePanDragEnd = useCallback((
    event: Konva.KonvaEventObject<DragEvent>,
  ) => {
    const nextPan = constrainPan({
      x: event.target.x(),
      y: event.target.y(),
    });
    event.target.position(nextPan);
    handlePanChange(nextPan);
    setIsPanning(false);
    const container = event.target.getStage()?.container();
    container?.style.setProperty(
      "cursor",
      quickRegionTemplate ? "crosshair" : "grab",
    );
  }, [constrainPan, handlePanChange, quickRegionTemplate]);

  const cullingViewport = useMemo(() => ({
    bottom: height - pan.y + panLimitY + 96,
    left: -pan.x - panLimitX - 96,
    right: width - pan.x + panLimitX + 96,
    top: -pan.y - panLimitY - 96,
  }), [height, pan.x, pan.y, panLimitX, panLimitY, width]);

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
        colors={colors}
        isEditMode={isEditMode}
        isQuickPlacementActive={Boolean(quickRegionTemplate)}
        onAssignEquipmentToVenue={handleAssignEquipmentToVenue}
        onMove={handleMoveVenue}
        onResize={handleResizeVenue}
        onSelect={handleSelectVenue}
        planX={planX}
        planY={planY}
        selected={selectedVenueMapId === venue.mapId}
        selectedEquipmentId={selectedEquipmentId}
        venue={venue}
        x={planX + (gridColumn - 1) * cellWidth + 6}
        y={planY + (gridRow - 1) * cellHeight + 6}
      />
    );
  }), [
    assignedEquipment,
    cellHeight,
    cellWidth,
    colors,
    handleAssignEquipmentToVenue,
    handleMoveVenue,
    handleResizeVenue,
    handleSelectVenue,
    isEditMode,
    planX,
    planY,
    quickRegionTemplate,
    selectedEquipmentId,
    selectedVenueMapId,
    visibleVenues,
    equipmentById,
  ]);

  const resolveClientCell = (
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ) => {
    const stageX = clientX - rect.left;
    const stageY = clientY - rect.top;
    if (
      stageX < planX + pan.x ||
      stageX > planX + pan.x + planWidth ||
      stageY < planY + pan.y ||
      stageY > planY + pan.y + planHeight
    ) {
      return null;
    }

    return {
      gridColumn: clamp(Math.floor((stageX - planX - pan.x) / cellWidth) + 1, 1, COLS),
      gridRow: clamp(Math.floor((stageY - planY - pan.y) / cellHeight) + 1, 1, ROWS),
    };
  };

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
    const nodeWidth = Math.max(28, Math.min(cellWidth * 0.82, 78));
    const nodeHeight = Math.max(24, Math.min(cellHeight * 0.82, 54));
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
        colors={colors}
        height={nodeHeight}
        isEditMode={isEditMode}
        record={record}
        width={nodeWidth}
        x={x}
        y={y}
        onMove={handleMoveEquipment}
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
    colors,
    cullingViewport,
    equipment,
    handleMoveEquipment,
    handleSelectEquipment,
    isEditMode,
    planX,
    planY,
    venues,
  ]);

  return (
    <div
      ref={ref}
      onDragOver={(event) => {
        if (!isEditMode || !event.dataTransfer.types.includes("application/x-fittrack-equipment-id")) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        const cell = resolveClientCell(
          event.clientX,
          event.clientY,
          event.currentTarget.getBoundingClientRect(),
        );
        updateHoverCell(cell);
      }}
      onDrop={(event) => {
        const equipmentId =
          event.dataTransfer.getData("application/x-fittrack-equipment-id") ||
          event.dataTransfer.getData("text/plain");
        if (!isEditMode || !equipmentId || !onDropEquipmentToVenue) return;
        event.preventDefault();
        const cell = resolveClientCell(
          event.clientX,
          event.clientY,
          event.currentTarget.getBoundingClientRect(),
        );
        if (!cell) return;
        const targetVenue = venues.find((venue) => {
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
        if (!targetVenue) return;
        callbacksRef.current.onDropEquipmentToVenue?.(
          equipmentId,
          targetVenue.mapId,
          cell,
        );
        updateHoverCell(null);
      }}
      style={{
        cursor: isPanning ? "grabbing" : quickRegionTemplate ? "crosshair" : "grab",
        height: "100%",
        minHeight: 360,
        width: "100%",
      }}
    >
      <Stage
        width={width}
        height={height}
        onMouseDown={(event) => {
          if (!cellTool) return;
          const stage = event.target.getStage();
          if (stage) applyCellToolAtStage(stage);
        }}
        onMouseUp={() => { lastPaintedCellRef.current = null; }}
        onMouseMove={(event) => {
          const stage = event.target.getStage();
          if (stage && cellTool && event.evt.buttons === 1) {
            applyCellToolAtStage(stage);
            return;
          }
          if (!stage || !quickRegionTemplate) return;
          updateHoverCell(resolvePointerCell(stage));
        }}
        onMouseLeave={() => updateHoverCell(null)}
        onTouchMove={(event) => {
          const stage = event.target.getStage();
          if (stage && cellTool) {
            applyCellToolAtStage(stage);
            return;
          }
          if (!stage || !quickRegionTemplate) return;
          updateHoverCell(resolvePointerCell(stage));
        }}
        onClick={(event) => {
          if (!quickRegionTemplate || !callbacksRef.current.onPlaceQuickRegionAtCell) return;
          const stage = event.target.getStage();
          if (!stage) return;
          const cell = resolvePointerCell(stage);
          if (!cell) return;
          handlePlaceQuickRegionAtCell(quickRegionTemplate, {
            gridColumn: clamp(cell.gridColumn, 1, COLS - quickRegionTemplate.gridWidth + 1),
            gridRow: clamp(cell.gridRow, 1, ROWS - quickRegionTemplate.gridHeight + 1),
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
            x={pan.x}
            y={pan.y}
            draggable={!quickRegionTemplate && !cellTool}
            dragBoundFunc={constrainPan}
            onDragStart={handlePanDragStart}
            onDragEnd={handlePanDragEnd}
          >
            <Rect
              name="pan-surface"
              x={-panLimitX - width}
              y={-panLimitY - height}
              width={width + (panLimitX + width) * 2}
              height={height + (panLimitY + height) * 2}
              fill={colors.base}
              opacity={0.001}
              perfectDrawEnabled={false}
            />
          <Rect
            ref={floorBoundsRef}
            name="floor-bounds"
            x={planX}
            y={planY}
            width={planWidth}
            height={planHeight}
            fill={colors.surfaceRaised}
            opacity={0.035}
            stroke={floorBoundsSelected ? colors.brand : colors.border}
            strokeWidth={floorBoundsSelected ? 2 : 1}
            dash={floorBoundsSelected ? [10, 6] : undefined}
            onClick={(event) => {
              if (!isEditMode || !onResizeFloorBounds) return;
              event.cancelBubble = true;
              setFloorBoundsSelected(true);
            }}
            onTap={(event) => {
              if (!isEditMode || !onResizeFloorBounds) return;
              event.cancelBubble = true;
              setFloorBoundsSelected(true);
            }}
            onTransformStart={(event) => {
              event.cancelBubble = true;
            }}
            onTransformEnd={(event) => {
              event.cancelBubble = true;
              const node = floorBoundsRef.current;
              if (!node || !onResizeFloorBounds) return;
              const nextBounds = {
                gridHeight: clamp(
                  Math.round(floorBounds.gridHeight * node.scaleY()),
                  6,
                  20,
                ),
                gridWidth: clamp(
                  Math.round(floorBounds.gridWidth * node.scaleX()),
                  8,
                  30,
                ),
              };
              node.scale({ x: 1, y: 1 });
              void onResizeFloorBounds(nextBounds);
            }}
            perfectDrawEnabled={false}
          />
          {publishedCellNodes.footprint}
          {unpaintedCellNodes}
          {floorBoundsSelected && isEditMode && onResizeFloorBounds ? (
            <Transformer
              ref={floorTransformerRef}
              rotateEnabled={false}
              flipEnabled={false}
              enabledAnchors={["bottom-right"]}
              anchorFill={colors.brand}
              anchorStroke={colors.surfaceRaised}
              anchorSize={15}
              borderStroke={colors.brand}
              borderDash={[10, 6]}
              keepRatio={false}
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
          {gridLines}
          {venueNodes}
          {equipmentNodes}
          {publishedCellNodes.route}
          {quickPlacement && quickRegionTemplate ? (
            <Rect
              x={planX + (quickPlacement.gridColumn - 1) * cellWidth + 6}
              y={planY + (quickPlacement.gridRow - 1) * cellHeight + 6}
              width={quickRegionTemplate.gridWidth * cellWidth - 12}
              height={quickRegionTemplate.gridHeight * cellHeight - 12}
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
    </div>
  );
}
