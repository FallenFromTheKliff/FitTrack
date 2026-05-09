"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { ThemeColors } from "@fittrack/types";

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
  floorImageUrl?: string | null;
  height?: number;
  isEditMode: boolean;
  pan: { x: number; y: number };
  quickRegionTemplate?: QuickFloorRegionTemplate | null;
  selectedEquipmentId?: string | null;
  selectedVenueMapId?: string | null;
  venues: FloorVenueRecord[];
  zoom: number;
  onAssignEquipmentToVenue: (equipmentId: string, venueMapId: string) => void;
  onMoveVenue?: (
    venueMapId: string,
    placement: { gridColumn: number; gridRow: number },
  ) => void;
  onPanChange: (pan: { x: number; y: number }) => void;
  onPlaceQuickRegionAtCell?: (
    template: QuickFloorRegionTemplate,
    placement: { gridColumn: number; gridRow: number },
  ) => void;
  onSelectVenue: (venue: FloorVenueRecord) => void;
};

type ZoneTone = "available" | "equipment" | "reservable" | "support";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function useContainerSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(960);
  const [height, setHeight] = useState(560);

  useEffect(() => {
    if (!ref.current) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(320, Math.floor(entry.contentRect.width)));
      setHeight(Math.max(360, Math.floor(entry.contentRect.height)));
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

export default function FacilitiesKonvaMap({
  assignedEquipment,
  colors,
  equipmentById,
  floorImageUrl,
  height: requestedHeight,
  isEditMode,
  onAssignEquipmentToVenue,
  onMoveVenue,
  onPanChange,
  onPlaceQuickRegionAtCell,
  onSelectVenue,
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
  const planWidth = basePlanWidth * planScale;
  const planHeight = basePlanHeight * planScale;
  const planX = (width - planWidth) / 2 + pan.x;
  const planY = (height - planHeight) / 2 + pan.y;
  const cellWidth = planWidth / COLS;
  const cellHeight = planHeight / ROWS;
  const [hoverCell, setHoverCell] = useState<{ gridColumn: number; gridRow: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    panX: number;
    panY: number;
    pointerX: number;
    pointerY: number;
  } | null>(null);

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

    const localX = clamp(pointer.x - planX, 0, planWidth - 1);
    const localY = clamp(pointer.y - planY, 0, planHeight - 1);

    return {
      gridColumn: clamp(Math.floor(localX / cellWidth) + 1, 1, COLS),
      gridRow: clamp(Math.floor(localY / cellHeight) + 1, 1, ROWS),
    };
  };

  const setStageCursor = (
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
    cursor: string,
  ) => {
    const container = event.target.getStage()?.container();
    container?.style.setProperty("cursor", cursor);
  };

  const isVenueNode = (node: Konva.Node | null) => {
    let current = node;
    while (current) {
      if (current.getAttr("venueMapId")) {
        return true;
      }
      current = current.getParent();
    }
    return false;
  };

  const startPan = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (quickRegionTemplate || selectedEquipmentId || isVenueNode(event.target)) {
      return;
    }
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    panStartRef.current = {
      panX: pan.x,
      panY: pan.y,
      pointerX: pointer.x,
      pointerY: pointer.y,
    };
    setIsPanning(true);
    setStageCursor(event, "grabbing");
  };

  const updatePan = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!panStartRef.current) return false;
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return true;
    onPanChange({
      x: panStartRef.current.panX + pointer.x - panStartRef.current.pointerX,
      y: panStartRef.current.panY + pointer.y - panStartRef.current.pointerY,
    });
    setHoverCell(null);
    return true;
  };

  const endPan = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    panStartRef.current = null;
    setIsPanning(false);
    setStageCursor(event, quickRegionTemplate ? "crosshair" : "grab");
  };

  const renderVenue = (venue: FloorVenueRecord) => {
    const gridColumn = Math.max(1, venue.gridColumn ?? 1);
    const gridRow = Math.max(1, venue.gridRow ?? 1);
    const gridWidth = Math.max(1, venue.gridWidth ?? 2);
    const gridHeight = Math.max(1, venue.gridHeight ?? 2);
    const x = planX + (gridColumn - 1) * cellWidth + 6;
    const y = planY + (gridRow - 1) * cellHeight + 6;
    const w = gridWidth * cellWidth - 12;
    const h = gridHeight * cellHeight - 12;
    const selected = selectedVenueMapId === venue.mapId;
    const tone = venue.isReservable === false ? "support" : "reservable";
    const accent = toneColor(tone, colors);
    const assigned = (assignedEquipment[venue.mapId] ?? [])
        .map((id) => equipmentById[id])
        .filter(Boolean);
    const draggable =
      isEditMode &&
      !venue.isSystem &&
      !selectedEquipmentId &&
      !quickRegionTemplate;
    const title = venue.name;
    const sublabel = venue.isReservable === false ? "Support Zone" : "Reservable";

    return (
      <Group
        key={venue.mapId}
        venueMapId={venue.mapId}
        x={x}
        y={y}
        draggable={draggable}
        onMouseEnter={(event) => {
          setStageCursor(
            event,
            selectedEquipmentId && isEditMode ? "copy" : draggable ? "move" : "pointer",
          );
        }}
        onMouseLeave={(event) => {
          setStageCursor(event, isPanning ? "grabbing" : "grab");
        }}
        onDragEnd={(event) => {
          if (!onMoveVenue) return;
          onMoveVenue(venue.mapId, {
            gridColumn: clamp(Math.round((event.target.x() - planX) / cellWidth) + 1, 1, COLS - gridWidth + 1),
            gridRow: clamp(Math.round((event.target.y() - planY) / cellHeight) + 1, 1, ROWS - gridHeight + 1),
          });
        }}
        onClick={(event) => {
          event.cancelBubble = true;
          if (selectedEquipmentId && isEditMode) {
            onAssignEquipmentToVenue(selectedEquipmentId, venue.mapId);
            return;
          }
          onSelectVenue(venue);
        }}
        onTap={(event) => {
          event.cancelBubble = true;
          onSelectVenue(venue);
        }}
      >
        <Rect
          width={w}
          height={h}
          cornerRadius={10}
          fill={selected ? `${colors.brand}33` : `${colors.surfaceRaised}f2`}
          stroke={selected ? colors.brand : accent}
          strokeWidth={selected ? 2.5 : 1.5}
          shadowColor={accent}
          shadowBlur={selected ? 18 : 4}
          opacity={0.96}
        />
        {selected ? (
          <Rect
            x={-6}
            y={-6}
            width={w + 12}
            height={h + 12}
            cornerRadius={12}
            stroke={colors.brand}
            strokeWidth={2}
            dash={[14, 8]}
          />
        ) : null}
        <Text
          x={12}
          y={Math.max(12, h * 0.36 - 12)}
          width={Math.max(40, w - 24)}
          text={title}
          fill={colors.textPrimary}
          fontSize={Math.max(11, Math.min(15, w / 14))}
          fontStyle="bold"
          align="center"
          ellipsis
          wrap="none"
        />
        <Text
          x={12}
          y={Math.max(34, h * 0.36 + 10)}
          width={Math.max(40, w - 24)}
          text={sublabel}
          fill={accent}
          fontSize={10}
          align="center"
          ellipsis
          wrap="none"
        />
        {assigned.slice(0, 4).map((item, index) => (
          <Group key={item.id} x={12 + index * 42} y={Math.max(52, h - 28)}>
            <Rect
              width={34}
              height={18}
              cornerRadius={9}
              fill={`${item.color}24`}
              stroke={item.color}
              strokeWidth={1}
            />
            <Text
              x={5}
              y={4}
              width={24}
              text={item.name.slice(0, 3).toUpperCase()}
              fill={item.color}
              fontSize={8}
              fontStyle="bold"
              align="center"
            />
          </Group>
        ))}
      </Group>
    );
  };

  return (
    <div
      ref={ref}
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
        onMouseDown={startPan}
        onMouseMove={(event) => {
          if (updatePan(event)) return;
          const stage = event.target.getStage();
          if (!stage || !quickRegionTemplate) return;
          setHoverCell(resolvePointerCell(stage));
        }}
        onMouseUp={endPan}
        onMouseLeave={(event) => {
          setHoverCell(null);
          endPan(event);
        }}
        onTouchStart={startPan}
        onTouchMove={(event) => {
          if (updatePan(event)) return;
          const stage = event.target.getStage();
          if (!stage || !quickRegionTemplate) return;
          setHoverCell(resolvePointerCell(stage));
        }}
        onTouchEnd={endPan}
        onClick={(event) => {
          if (!quickRegionTemplate || !onPlaceQuickRegionAtCell) return;
          const stage = event.target.getStage();
          if (!stage) return;
          const cell = resolvePointerCell(stage);
          if (!cell) return;
          onPlaceQuickRegionAtCell(quickRegionTemplate, {
            gridColumn: clamp(cell.gridColumn, 1, COLS - quickRegionTemplate.gridWidth + 1),
            gridRow: clamp(cell.gridRow, 1, ROWS - quickRegionTemplate.gridHeight + 1),
          });
        }}
      >
        <Layer>
          <Rect
            name="pan-surface"
            x={0}
            y={0}
            width={width}
            height={height}
            cornerRadius={14}
            fill={colors.base}
            stroke={colors.border}
            strokeWidth={1}
          />
          {image ? (
            <KonvaImage
              image={image}
              x={planX}
              y={planY}
              width={planWidth}
              height={planHeight}
              opacity={0.16}
            />
          ) : null}
          <Rect
            x={planX + cellWidth * 0.55}
            y={planY + cellHeight * 0.55}
            width={cellWidth * 12.9}
            height={cellHeight * 8.65}
            cornerRadius={32}
            fill={`${colors.surfaceRaised}70`}
            stroke={`${colors.textMuted}55`}
            strokeWidth={3}
          />
          {Array.from({ length: COLS + 1 }).map((_, index) => (
            <Rect
              key={`col-${index}`}
              x={planX + index * cellWidth}
              y={planY}
              width={1}
              height={planHeight}
              fill={colors.border}
              opacity={0.16}
            />
          ))}
          {Array.from({ length: ROWS + 1 }).map((_, index) => (
            <Rect
              key={`row-${index}`}
              x={planX}
              y={planY + index * cellHeight}
              width={planWidth}
              height={1}
              fill={colors.border}
              opacity={0.16}
            />
          ))}
          {venues.map((venue) => renderVenue(venue))}
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
            />
          ) : null}
        </Layer>
      </Stage>
    </div>
  );
}
