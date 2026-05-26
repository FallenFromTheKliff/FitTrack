"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
} from "react";
import dynamic from "next/dynamic";
import { useDroppable } from "@dnd-kit/core";
import { ImagePlus, Map } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { buildRenderableAssetUrl } from "@fittrack/utils";

import type { ThemeColors } from "@fittrack/types";

import { FitText, FitTextArea, FitTextInput } from "@/components/fit/FitText";
import { FitSelect } from "@/components/fit/FitCard";
import FitButton from "@/components/fit/FitButton";
import { FitModal } from "@/components/modals";
import { getVenueIcon, COLS, ROWS } from "@/data/facilities/mapTypes";
import type { VenueEquipmentAssignments } from "@/data/facilities/mapTypes";
import type {
  FacilityFloorDefinition,
  FloorVenueRecord,
} from "@/data/facilities/floorPlans";
import {
  VENUE_BOOKING_OPTIONS,
  VENUE_ICON_OPTIONS,
} from "@/data/facilities/venueFields";
import type { QuickFloorRegionTemplate } from "@/hooks/facilities/useFacilities";
import { WEB_API_BASE_URL } from "@/lib/api-client";

const FacilitiesKonvaMap = dynamic(() => import("./FacilitiesKonvaMap"), {
  ssr: false,
});

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

type AssignedEquipmentDisplay = {
  color: string;
  icon: LucideIcon;
  id: string;
  name: string;
};

type VenueCellPlacement = {
  gridColumn: number;
  gridRow: number;
};

type Props = {
  colors: ThemeColors;
  floor: FacilityFloorDefinition;
  isCompact: boolean;
  isEditMode: boolean;
  assignedEquipment: VenueEquipmentAssignments;
  equipmentById: Record<string, AssignedEquipmentDisplay>;
  venues: FloorVenueRecord[];
  floorPlanPadding: number;
  floorPlanMinHeight: number;
  floorImageUrl?: string | null;
  selectedVenueMapId?: string | null;
  onRequestDelete: (venueMapId: string, equipmentId: string) => void;
  selectedEquipmentId?: string | null;
  selectedEquipmentName?: string | null;
  onAssignEquipmentToVenue: (
    equipmentId: string,
    venueMapId: string,
    preferredCell?: VenueCellPlacement,
  ) => void;
  quickRegionTemplate?: QuickFloorRegionTemplate | null;
  onMoveVenue?: (venueMapId: string, placement: VenueCellPlacement) => void;
  onPlaceQuickRegionAtCell?: (
    template: QuickFloorRegionTemplate,
    placement: VenueCellPlacement,
  ) => void;
  onNudgeVenue?: (
    venueMapId: string,
    delta: { column: number; row: number },
  ) => void;
  onResizeVenue?: (
    venueMapId: string,
    delta: { width: number; height: number },
  ) => void;
  isVenueSubmitting?: boolean;
  isUploadingFloorImage?: boolean;
  onSubmitVenueEdit?: (
    venueMapId: string,
    data: Record<string, string>,
  ) => Promise<boolean>;
  onRequestVenueDelete?: (venueMapId: string) => void;
  onOpenEquipment: () => void;
  onSelectVenue: (venue: FloorVenueRecord) => void;
  onOpenVenues: () => void;
  onUploadFloorImage?: (file: File) => void | Promise<void>;
};

type VenueCardProps = {
  colors: ThemeColors;
  floor: FacilityFloorDefinition;
  venue: FloorVenueRecord;
  equipmentById: Record<string, AssignedEquipmentDisplay>;
  assignedIds: string[];
  isEditMode: boolean;
  isSelected: boolean;
  markerBackground: string;
  selectedEquipmentId?: string | null;
  onAssignEquipmentToVenue: (
    equipmentId: string,
    venueMapId: string,
    preferredCell?: VenueCellPlacement,
  ) => void;
  canDragVenue: boolean;
  onSelectVenue: (venue: FloorVenueRecord) => void;
  onRequestDelete: (venueMapId: string, equipmentId: string) => void;
  onMoveDragStart: (venueMapId: string) => void;
  onMoveVenue?: (venueMapId: string, placement: VenueCellPlacement) => void;
  onNudgeVenue?: (
    venueMapId: string,
    delta: { column: number; row: number },
  ) => void;
  onResizeVenue?: (
    venueMapId: string,
    delta: { width: number; height: number },
  ) => void;
  onOpenEditModal?: (venue: FloorVenueRecord) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildVenueFormValues(venue: FloorVenueRecord): Record<string, string> {
  return {
    name: venue.name ?? "",
    description: venue.description ?? "",
    capacity: String(venue.capacity ?? 1),
    hourlyRate:
      venue.isReservable === false
        ? ""
        : venue.hourlyRate != null
          ? String(venue.hourlyRate)
          : "",
    minimumHours: String(venue.minimumHours ?? 1),
    iconKey: venue.iconKey ?? "gym-area",
    floorId: venue.floorId ?? "floor-1",
    gridColumn: String(venue.gridColumn ?? 1),
    gridRow: String(venue.gridRow ?? 1),
    gridWidth: String(venue.gridWidth ?? 2),
    gridHeight: String(venue.gridHeight ?? 2),
    isReservable: String(venue.isReservable !== false),
    displayOrder: String(venue.displayOrder ?? 0),
  };
}

function resolveVenueDropCell(
  event: DragEvent<HTMLDivElement>,
  venue: FloorVenueRecord,
): VenueCellPlacement | null {
  const rect = event.currentTarget.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }

  const venueGridColumn = Math.max(1, venue.gridColumn ?? 1);
  const venueGridRow = Math.max(1, venue.gridRow ?? 1);
  const venueGridWidth = Math.max(1, venue.gridWidth ?? 2);
  const venueGridHeight = Math.max(1, venue.gridHeight ?? 2);

  const localX = clamp(event.clientX - rect.left, 0, rect.width - 1);
  const localY = clamp(event.clientY - rect.top, 0, rect.height - 1);

  const relativeColumn = clamp(
    Math.floor((localX / rect.width) * venueGridWidth),
    0,
    venueGridWidth - 1,
  );
  const relativeRow = clamp(
    Math.floor((localY / rect.height) * venueGridHeight),
    0,
    venueGridHeight - 1,
  );

  return {
    gridColumn: venueGridColumn + relativeColumn,
    gridRow: venueGridRow + relativeRow,
  };
}

function resolveCanvasDropCell(
  event: DragEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
  canvas: HTMLDivElement | null,
) {
  if (!canvas) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }

  const localX = clamp(
    ("clientX" in event ? event.clientX : 0) - rect.left,
    0,
    rect.width - 1,
  );
  const localY = clamp(
    ("clientY" in event ? event.clientY : 0) - rect.top,
    0,
    rect.height - 1,
  );

  return {
    gridColumn: clamp(Math.floor((localX / rect.width) * COLS) + 1, 1, COLS),
    gridRow: clamp(Math.floor((localY / rect.height) * ROWS) + 1, 1, ROWS),
  };
}

function VenueCard({
  colors,
  floor,
  venue,
  equipmentById,
  assignedIds,
  isEditMode,
  isSelected,
  markerBackground,
  selectedEquipmentId,
  onAssignEquipmentToVenue,
  canDragVenue,
  onSelectVenue,
  onRequestDelete,
  onMoveDragStart,
  onMoveVenue,
  onOpenEditModal,
}: VenueCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `venue-${venue.mapId}`,
    disabled: !isEditMode,
  });
  const Icon = getVenueIcon(venue.iconKey);
  const assignedEquipment = assignedIds
    .map((itemId) => equipmentById[itemId])
    .filter(Boolean);
  const iconSize = assignedEquipment.length >= 6 ? 12 : 14;
  const gridColumn = Math.max(1, venue.gridColumn ?? 1);
  const gridRow = Math.max(1, venue.gridRow ?? 1);
  const gridWidth = Math.max(1, venue.gridWidth ?? 2);
  const gridHeight = Math.max(1, venue.gridHeight ?? 2);

  const sharedStyle = {
    gridColumn: `${gridColumn} / span ${gridWidth}`,
    gridRow: `${gridRow} / span ${gridHeight}`,
    border: `1px solid ${isOver || isSelected ? colors.brand : `${colors.brand}66`}`,
    borderRadius: 10,
    padding: 8,
    position: "relative" as const,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch",
    backgroundColor: "transparent",
    pointerEvents: "auto" as const,
    boxShadow: isOver || isSelected ? `0 0 0 1px ${colors.brand}` : "none",
    textAlign: "left" as const,
  };

  const content = (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 9,
          backgroundColor:
            isOver || isSelected ? colors.brand : markerBackground,
          opacity: 0.5,
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
          minWidth: 0,
        }}
      >
        <Icon size={16} color={colors.brand} strokeWidth={2} />
        <FitText
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: colors.textPrimary,
            textAlign: "center",
          }}
        >
          {venue.name}
        </FitText>
        <div style={{ display: "grid", gap: 4, width: "100%" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              justifyContent: "center",
              minHeight: 22,
            }}
          >
            {assignedEquipment.length > 0 ? (
              assignedEquipment.map((item) => (
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
                    color: item.color,
                  }}
                  title={item.name}
                >
                  <item.icon
                    size={iconSize}
                    color={item.color}
                    strokeWidth={2}
                  />
                  {isEditMode ? (
                    <span
                      aria-label={`Remove ${item.name} from ${venue.name}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRequestDelete(venue.mapId, item.id);
                      }}
                      style={{
                        minWidth: 12,
                        height: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "none",
                        backgroundColor: "transparent",
                        color: item.color,
                        fontSize: 11,
                        lineHeight: 1,
                        fontWeight: 700,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      x
                    </span>
                  ) : null}
                </div>
              ))
            ) : (
              <FitText style={{ fontSize: 10, color: colors.textMuted }}>
                {isEditMode
                  ? "Drop equipment here"
                  : venue.isReservable === false
                    ? "Facility zone"
                    : "Reservable"}
              </FitText>
            )}
          </div>
          {assignedEquipment.length > 0 ? (
            <FitText
              style={{
                fontSize: 10,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              {venue.isReservable === false ? "Facility zone" : "Reservable"}
            </FitText>
          ) : null}
        </div>
      </div>
    </>
  );

  if (isEditMode) {
    return (
      <div
        ref={setNodeRef}
        data-venue-card="true"
        role="button"
        tabIndex={0}
        draggable={canDragVenue && !selectedEquipmentId}
        aria-label={`Assign equipment to ${venue.name} on ${floor.label}`}
        onDragStart={(event) => {
          if (!canDragVenue || selectedEquipmentId) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "application/x-fittrack-venue-map-id",
            venue.mapId,
          );
          onMoveDragStart(venue.mapId);
        }}
        onDragOver={(event) => {
          if (
            event.dataTransfer.types.includes(
              "application/x-fittrack-venue-map-id",
            )
          ) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            return;
          }
          const hasDraggedEquipment =
            event.dataTransfer.types.includes("text/plain");
          if (!selectedEquipmentId && !hasDraggedEquipment) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          if (
            event.dataTransfer.types.includes(
              "application/x-fittrack-venue-map-id",
            )
          ) {
            event.preventDefault();
            const movedVenueMapId = event.dataTransfer.getData(
              "application/x-fittrack-venue-map-id",
            );
            const preferredCell = resolveVenueDropCell(event, venue);
            if (movedVenueMapId && preferredCell && onMoveVenue) {
              onMoveVenue(movedVenueMapId, preferredCell);
            }
            return;
          }
          event.preventDefault();
          const droppedEquipmentId =
            event.dataTransfer.getData("text/plain") || selectedEquipmentId;
          if (!droppedEquipmentId) return;
          const preferredCell = resolveVenueDropCell(event, venue);
          onAssignEquipmentToVenue(
            droppedEquipmentId,
            venue.mapId,
            preferredCell ?? undefined,
          );
        }}
        onClick={() => {
          onSelectVenue(venue);
          onOpenEditModal?.(venue);
        }}
        style={{
          ...sharedStyle,
          cursor: selectedEquipmentId
            ? "copy"
            : canDragVenue
              ? "grab"
              : "default",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <FitButton
      buttonRef={setNodeRef}
      data-venue-card="true"
      variant="card"
      onClick={() => onSelectVenue(venue)}
      disabled={false}
      aria-label={`Open details for ${venue.name} on ${floor.label}`}
      style={sharedStyle}
    >
      {content}
    </FitButton>
  );
}

function FloorPlanSvg({
  colors,
  floor,
}: {
  colors: ThemeColors;
  floor: FacilityFloorDefinition;
}) {
  if (floor.id === "floor-2") {
    return (
      <svg
        viewBox="0 0 140 100"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%" }}
        aria-hidden
      >
        <rect
          x="4"
          y="8"
          width="132"
          height="84"
          rx="18"
          fill={colors.brand}
          opacity={0.08}
        />
        <path
          d="M10 14h44v30H10z"
          fill={colors.surface}
          opacity={0.55}
          stroke={colors.border}
          strokeWidth="1.5"
        />
        <path
          d="M58 14h72v30H58z"
          fill={colors.surfaceRaised}
          opacity={0.7}
          stroke={colors.border}
          strokeWidth="1.5"
        />
        <path
          d="M18 50h48v34H18z"
          fill={colors.surfaceRaised}
          opacity={0.72}
          stroke={colors.border}
          strokeWidth="1.5"
        />
        <path
          d="M70 50h54v34H70z"
          fill={colors.surface}
          opacity={0.55}
          stroke={colors.border}
          strokeWidth="1.5"
        />
        <path
          d="M44 38h52v24H44z"
          fill="none"
          stroke={colors.brand}
          strokeWidth="2"
          strokeDasharray="4 4"
          opacity={0.75}
        />
      </svg>
    );
  }

  if (floor.id === "floor-3") {
    return (
      <svg
        viewBox="0 0 140 100"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%" }}
        aria-hidden
      >
        <rect
          x="6"
          y="10"
          width="128"
          height="80"
          rx="20"
          fill={colors.brand}
          opacity={0.08}
        />
        <path
          d="M12 18h116v64H12z"
          fill={colors.surfaceRaised}
          opacity={0.68}
          stroke={colors.border}
          strokeWidth="1.5"
        />
        <path
          d="M22 30h96v40H22z"
          fill={colors.surface}
          opacity={0.48}
          stroke={colors.border}
          strokeWidth="1.5"
        />
        <circle
          cx="70"
          cy="50"
          r="18"
          fill="none"
          stroke={colors.brand}
          strokeWidth="2"
          opacity={0.4}
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 140 100"
      preserveAspectRatio="none"
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    >
      <rect
        x="4"
        y="6"
        width="132"
        height="88"
        rx="18"
        fill={colors.brand}
        opacity={0.06}
      />
      <path
        d="M8 12h44v38H8z"
        fill={colors.surface}
        opacity={0.55}
        stroke={colors.border}
        strokeWidth="1.5"
      />
      <path
        d="M54 12h44v38H54z"
        fill={colors.surfaceRaised}
        opacity={0.7}
        stroke={colors.border}
        strokeWidth="1.5"
      />
      <path
        d="M100 24h32v26h-32z"
        fill={colors.surface}
        opacity={0.5}
        stroke={colors.border}
        strokeWidth="1.5"
      />
      <path
        d="M8 58h56v28H8z"
        fill={colors.surfaceRaised}
        opacity={0.72}
        stroke={colors.border}
        strokeWidth="1.5"
      />
      <path
        d="M66 58h66v28H66z"
        fill={colors.surface}
        opacity={0.5}
        stroke={colors.border}
        strokeWidth="1.5"
      />
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
    b: value & 255,
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
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value * (1 - amount)))),
    )
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
  floorImageUrl,
  selectedVenueMapId,
  onRequestDelete,
  selectedEquipmentId,
  selectedEquipmentName,
  onAssignEquipmentToVenue,
  quickRegionTemplate,
  onMoveVenue,
  onPlaceQuickRegionAtCell,
  onNudgeVenue,
  onResizeVenue,
  isVenueSubmitting = false,
  isUploadingFloorImage = false,
  onSubmitVenueEdit,
  onRequestVenueDelete,
  onOpenEquipment,
  onSelectVenue,
  onOpenVenues,
  onUploadFloorImage,
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
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const floorImageInputRef = useRef<HTMLInputElement | null>(null);
  const panStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [hoverCell, setHoverCell] = useState<VenueCellPlacement | null>(null);
  const [isRegionDragOver, setIsRegionDragOver] = useState(false);
  const [editingVenueMapId, setEditingVenueMapId] = useState<string | null>(
    null,
  );
  const [repositionVenueMapId, setRepositionVenueMapId] = useState<
    string | null
  >(null);
  const [venueFormData, setVenueFormData] = useState<Record<string, string>>(
    {},
  );

  const canvasWidth = isCompact ? 940 : 1260;
  const canvasHeight = Math.round((canvasWidth * ROWS) / COLS);
  const resolvedFloorImageUrl = buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: floorImageUrl ?? null,
  });
  const renderableFloorImageUrl = hidePlaceholderAssetUrl(resolvedFloorImageUrl);

  const quickRegionPlacement = useMemo(() => {
    if (!quickRegionTemplate || !hoverCell) {
      return null;
    }

    return {
      gridColumn: clamp(
        hoverCell.gridColumn,
        1,
        COLS - quickRegionTemplate.gridWidth + 1,
      ),
      gridRow: clamp(
        hoverCell.gridRow,
        1,
        ROWS - quickRegionTemplate.gridHeight + 1,
      ),
    };
  }, [hoverCell, quickRegionTemplate]);

  const editingVenue = useMemo(
    () => venues.find((venue) => venue.mapId === editingVenueMapId) ?? null,
    [editingVenueMapId, venues],
  );
  const repositionVenue = useMemo(
    () => venues.find((venue) => venue.mapId === repositionVenueMapId) ?? null,
    [repositionVenueMapId, venues],
  );
  const selectedEditableVenue = editingVenue ?? repositionVenue;
  const canEditSelectedVenue = Boolean(
    isEditMode && selectedEditableVenue && !selectedEditableVenue.isSystem,
  );

  useEffect(() => {
    if (!editingVenue) {
      setVenueFormData({});
      return;
    }
    setVenueFormData(buildVenueFormValues(editingVenue));
  }, [editingVenue]);

  useEffect(() => {
    if (!isEditMode) {
      setEditingVenueMapId(null);
      setRepositionVenueMapId(null);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (selectedEquipmentId || quickRegionTemplate) {
      setRepositionVenueMapId(null);
    }
  }, [quickRegionTemplate, selectedEquipmentId]);

  useEffect(() => {
    if (
      editingVenueMapId &&
      !venues.some((venue) => venue.mapId === editingVenueMapId)
    ) {
      setEditingVenueMapId(null);
    }
    if (
      repositionVenueMapId &&
      !venues.some((venue) => venue.mapId === repositionVenueMapId)
    ) {
      setRepositionVenueMapId(null);
    }
  }, [editingVenueMapId, repositionVenueMapId, venues]);

  const updateVenueFormField = (field: string, value: string) => {
    setVenueFormData((previous) => ({ ...previous, [field]: value }));
  };

  const handleFloorImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (file && onUploadFloorImage) {
      void onUploadFloorImage(file);
    }
  };

  const handleSubmitVenueEdit = async () => {
    if (!editingVenue || !onSubmitVenueEdit) {
      return;
    }

    const didSave = await onSubmitVenueEdit(editingVenue.mapId, venueFormData);
    if (didSave) {
      setEditingVenueMapId(null);
    }
  };

  const stopPanning = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  const beginPanning = (event: MouseEvent<HTMLDivElement>) => {
    if (quickRegionTemplate) {
      return;
    }
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("[data-venue-card='true']")) {
      return;
    }

    panStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsPanning(true);
  };

  const handleCanvasMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (isPanning && panStartRef.current) {
      const nextX =
        panStartRef.current.panX +
        (event.clientX - panStartRef.current.pointerX);
      const nextY =
        panStartRef.current.panY +
        (event.clientY - panStartRef.current.pointerY);
      setPan({ x: nextX, y: nextY });
    }

    if (!isEditMode || !quickRegionTemplate) {
      return;
    }

    setHoverCell(resolveCanvasDropCell(event, canvasRef.current));
  };

  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isEditMode || !quickRegionTemplate || !onPlaceQuickRegionAtCell) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("[data-venue-card='true']")) {
      return;
    }

    const dropCell = resolveCanvasDropCell(event, canvasRef.current);
    if (!dropCell) {
      return;
    }

    const placement = {
      gridColumn: clamp(
        dropCell.gridColumn,
        1,
        COLS - quickRegionTemplate.gridWidth + 1,
      ),
      gridRow: clamp(
        dropCell.gridRow,
        1,
        ROWS - quickRegionTemplate.gridHeight + 1,
      ),
    };

    onPlaceQuickRegionAtCell(quickRegionTemplate, placement);
  };

  const handleCanvasDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (
      !event.dataTransfer.types.includes("application/x-fittrack-venue-map-id")
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsRegionDragOver(true);
  };

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    const draggedVenueMapId = event.dataTransfer.getData(
      "application/x-fittrack-venue-map-id",
    );
    if (!draggedVenueMapId || !onMoveVenue) {
      return;
    }

    event.preventDefault();
    setIsRegionDragOver(false);

    const dropCell = resolveCanvasDropCell(event, canvasRef.current);
    if (!dropCell) {
      return;
    }

    onMoveVenue(draggedVenueMapId, dropCell);
    if (repositionVenueMapId === draggedVenueMapId) {
      setRepositionVenueMapId(null);
    }
  };

  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const isCanvasInteractable = !selectedEquipmentId && !quickRegionTemplate;
  const interactiveHint = quickRegionTemplate
    ? `Click the canvas to place ${quickRegionTemplate.name}.`
    : repositionVenue
      ? `Reposition mode active for ${repositionVenue.name}. Drag the selected region to a new tile.`
      : "Drag empty canvas space to pan the floor.";

  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: isCompact ? "none" : `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: floorPlanPadding,
        display: "flex",
        flexDirection: "column",
        height: "auto",
        width: "100%",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 10,
          gap: 10,
        }}
      >
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <FitText style={{ fontSize: 13, fontWeight: 700 }}>
              {floor.label} Floor Plan
            </FitText>
            <FitButton
              variant="ghost"
              label="VENUES >"
              onClick={onOpenVenues}
            />
            <FitButton
              variant="ghost"
              label="EQUIPMENT >"
              onClick={onOpenEquipment}
            />
            <input
              ref={floorImageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFloorImageChange}
            />
            <FitButton
              variant="ghost"
              icon={ImagePlus}
              label={renderableFloorImageUrl ? "REPLACE IMAGE" : "ADD IMAGE"}
              loading={isUploadingFloorImage}
              loadingLabel="UPLOADING"
              disabled={!isEditMode || !onUploadFloorImage}
              onClick={() => floorImageInputRef.current?.click()}
            />
          </div>
          <FitText style={{ fontSize: 11, color: colors.textMuted }}>
            {floor.subtitle}
          </FitText>
        </div>
      </div>
      <div
        style={{
          position: "relative",
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: mapBackground,
          padding: isCompact ? 6 : 8,
          minHeight: floorPlanMinHeight,
          maxHeight: isCompact ? "none" : 640,
          flex: 1,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FitButton
            variant="ghost"
            label="-"
            onClick={() =>
              setZoom((prev) =>
                clamp(Number((prev - 0.1).toFixed(2)), 0.7, 2.4),
              )
            }
            disabled={zoom <= 0.7}
            style={{ minWidth: 30, padding: "4px 8px" }}
          />
          <FitText
            style={{
              fontSize: 11,
              minWidth: 44,
              textAlign: "center",
              color: colors.textMuted,
            }}
          >
            {zoomLabel}
          </FitText>
          <FitButton
            variant="ghost"
            label="+"
            onClick={() =>
              setZoom((prev) =>
                clamp(Number((prev + 0.1).toFixed(2)), 0.7, 2.4),
              )
            }
            disabled={zoom >= 2.4}
            style={{ minWidth: 30, padding: "4px 8px" }}
          />
          <FitButton
            variant="ghost"
            label="RESET"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            style={{ minWidth: 58, padding: "4px 8px" }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: isCompact ? 10 : 14,
          }}
        >
          <FacilitiesKonvaMap
            assignedEquipment={assignedEquipment}
            colors={colors}
            equipmentById={equipmentById}
            floorImageUrl={renderableFloorImageUrl}
            isEditMode={isEditMode}
            onAssignEquipmentToVenue={(equipmentId, venueMapId) =>
              onAssignEquipmentToVenue(equipmentId, venueMapId)
            }
            onMoveVenue={onMoveVenue}
            onPanChange={setPan}
            onPlaceQuickRegionAtCell={onPlaceQuickRegionAtCell}
            onSelectVenue={onSelectVenue}
            pan={pan}
            quickRegionTemplate={quickRegionTemplate}
            selectedEquipmentId={selectedEquipmentId}
            selectedVenueMapId={selectedVenueMapId}
            venues={venues}
            zoom={zoom}
          />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            padding: isCompact ? 10 : 14,
          }}
          onMouseDown={beginPanning}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={stopPanning}
          onMouseLeave={() => {
            stopPanning();
            setHoverCell(null);
            setIsRegionDragOver(false);
          }}
        >
          <div
            ref={canvasRef}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: canvasWidth,
              height: "auto",
              maxHeight: canvasHeight,
              aspectRatio: `${COLS} / ${ROWS}`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center",
              transition: isPanning ? "none" : "transform 140ms ease",
              cursor:
                isEditMode && quickRegionTemplate
                  ? "crosshair"
                  : isCanvasInteractable
                    ? isPanning
                      ? "grabbing"
                      : "grab"
                    : "default",
            }}
            onClick={handleCanvasClick}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onDragLeave={() => setIsRegionDragOver(false)}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {renderableFloorImageUrl ? (
                <img
                  src={renderableFloorImageUrl}
                  alt={`${floor.label} uploaded floor plan`}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.42,
                  }}
                />
              ) : null}
              <FloorPlanSvg colors={colors} floor={floor} />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
                gap,
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
                    selectedEquipmentId={selectedEquipmentId}
                    onAssignEquipmentToVenue={onAssignEquipmentToVenue}
                    canDragVenue={
                      isEditMode &&
                      !venue.isSystem &&
                      !quickRegionTemplate &&
                      repositionVenueMapId === venue.mapId
                    }
                    onSelectVenue={onSelectVenue}
                    onRequestDelete={onRequestDelete}
                    onMoveDragStart={() => onSelectVenue(venue)}
                    onMoveVenue={onMoveVenue}
                    onOpenEditModal={(targetVenue) => {
                      if (!isEditMode || quickRegionTemplate) {
                        return;
                      }
                      setEditingVenueMapId(targetVenue.mapId);
                      setRepositionVenueMapId(null);
                    }}
                  />
                );
              })}
            </div>
            {quickRegionPlacement && quickRegionTemplate && (
              <div
                style={{
                  position: "absolute",
                  pointerEvents: "none",
                  display: "grid",
                  gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
                  inset: 0,
                  gap,
                  zIndex: 4,
                }}
              >
                <div
                  style={{
                    gridColumn: `${quickRegionPlacement.gridColumn} / span ${quickRegionTemplate.gridWidth}`,
                    gridRow: `${quickRegionPlacement.gridRow} / span ${quickRegionTemplate.gridHeight}`,
                    borderRadius: 10,
                    border: `2px dashed ${colors.brand}`,
                    backgroundColor: `${colors.brand}22`,
                  }}
                />
              </div>
            )}
            {isRegionDragOver ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  border: `2px dashed ${colors.brand}`,
                  borderRadius: 14,
                  backgroundColor: `${colors.brand}14`,
                  zIndex: 3,
                }}
              />
            ) : null}
            {venues.length === 0 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <Map size={32} color={colors.textMuted} strokeWidth={1.5} />
                <FitText
                  style={{
                    marginTop: 12,
                    fontSize: 15,
                    color: colors.textMuted,
                  }}
                >
                  {floor.emptyTitle}
                </FitText>
                <FitText
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: colors.textMuted,
                  }}
                >
                  {floor.emptySubtitle}
                </FitText>
              </div>
            )}
          </div>
        </div>
      </div>
      <FitModal
        isOpen={Boolean(editingVenue) && isEditMode}
        onClose={() => setEditingVenueMapId(null)}
        title={editingVenue ? `Edit ${editingVenue.name}` : "Edit Region"}
        subtitle={
          editingVenue?.isSystem
            ? "System regions are locked and cannot be repositioned or resized."
            : "Use quick move/resize controls or enter Reposition mode to drag the region on canvas."
        }
        maxWidth={560}
        closeAriaLabel="Close region editor"
        contentStyle={{ display: "grid", gap: 12 }}
        footer={editingVenue ? (
          <>
            <FitButton
              variant={
                repositionVenueMapId === editingVenue.mapId
                  ? "primary"
                  : "ghost"
              }
              label="REPOSITION"
              onClick={() => {
                if (!canEditSelectedVenue) {
                  return;
                }
                setRepositionVenueMapId(editingVenue.mapId);
                setEditingVenueMapId(null);
                onSelectVenue(editingVenue);
              }}
              disabled={!canEditSelectedVenue}
              style={{ flex: 1 }}
            />
            <FitButton
              variant="primary"
              label={isVenueSubmitting ? "SAVING VENUE" : "SAVE VENUE"}
              loading={isVenueSubmitting}
              onClick={() => {
                void handleSubmitVenueEdit();
              }}
              disabled={
                editingVenue.isSystem ||
                isVenueSubmitting ||
                !onSubmitVenueEdit
              }
              style={{ flex: 1 }}
            />
            {!editingVenue.isSystem && onRequestVenueDelete ? (
              <FitButton
                variant="danger"
                label="DELETE VENUE"
                onClick={() => {
                  setEditingVenueMapId(null);
                  onRequestVenueDelete(editingVenue.mapId);
                }}
                disabled={isVenueSubmitting}
                style={{ flex: 1 }}
              />
            ) : null}
          </>
        ) : undefined}
      >
        {editingVenue ? (
          <>
            <div style={{ display: "grid", gap: 8 }}>
              <FitText
                as="label"
                style={{ fontSize: 12, color: colors.textMuted }}
              >
                Name
              </FitText>
              <FitTextInput
                value={venueFormData.name ?? ""}
                onChange={(event) =>
                  updateVenueFormField("name", event.target.value)
                }
                disabled={editingVenue.isSystem || isVenueSubmitting}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: `1px solid ${colors.fieldBorder}`,
                  backgroundColor: colors.fieldBg,
                  color: colors.textPrimary,
                  height: 38,
                  padding: "0 10px",
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <FitText
                as="label"
                style={{ fontSize: 12, color: colors.textMuted }}
              >
                Description
              </FitText>
              <FitTextArea
                rows={3}
                value={venueFormData.description ?? ""}
                onChange={(event) =>
                  updateVenueFormField("description", event.target.value)
                }
                disabled={editingVenue.isSystem || isVenueSubmitting}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: `1px solid ${colors.fieldBorder}`,
                  backgroundColor: colors.fieldBg,
                  color: colors.textPrimary,
                  minHeight: 72,
                  padding: "8px 10px",
                  fontSize: 13,
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  as="label"
                  style={{ fontSize: 12, color: colors.textMuted }}
                >
                  Capacity
                </FitText>
                <FitTextInput
                  value={venueFormData.capacity ?? ""}
                  onChange={(event) =>
                    updateVenueFormField("capacity", event.target.value)
                  }
                  disabled={editingVenue.isSystem || isVenueSubmitting}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: `1px solid ${colors.fieldBorder}`,
                    backgroundColor: colors.fieldBg,
                    color: colors.textPrimary,
                    height: 36,
                    padding: "0 10px",
                    fontSize: 13,
                  }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  as="label"
                  style={{ fontSize: 12, color: colors.textMuted }}
                >
                  Hourly Rate
                </FitText>
                <FitTextInput
                  value={venueFormData.hourlyRate ?? ""}
                  onChange={(event) =>
                    updateVenueFormField("hourlyRate", event.target.value)
                  }
                  disabled={editingVenue.isSystem || isVenueSubmitting}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: `1px solid ${colors.fieldBorder}`,
                    backgroundColor: colors.fieldBg,
                    color: colors.textPrimary,
                    height: 36,
                    padding: "0 10px",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  as="label"
                  style={{ fontSize: 12, color: colors.textMuted }}
                >
                  Icon
                </FitText>
                <FitSelect
                  fullWidth
                  compact
                  value={venueFormData.iconKey ?? "gym-area"}
                  onChange={(event) =>
                    updateVenueFormField("iconKey", event.target.value)
                  }
                  options={VENUE_ICON_OPTIONS}
                  disabled={editingVenue.isSystem || isVenueSubmitting}
                  style={{
                    borderColor: colors.fieldBorder,
                    backgroundColor: colors.fieldBg,
                    minWidth: 0,
                  }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  as="label"
                  style={{ fontSize: 12, color: colors.textMuted }}
                >
                  User Booking
                </FitText>
                <FitSelect
                  fullWidth
                  compact
                  value={venueFormData.isReservable ?? "true"}
                  onChange={(event) =>
                    updateVenueFormField("isReservable", event.target.value)
                  }
                  options={VENUE_BOOKING_OPTIONS}
                  disabled={editingVenue.isSystem || isVenueSubmitting}
                  style={{
                    borderColor: colors.fieldBorder,
                    backgroundColor: colors.fieldBg,
                    minWidth: 0,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 6,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceRaised,
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                Grid Position: C{editingVenue.gridColumn ?? 1} / R
                {editingVenue.gridRow ?? 1}
              </FitText>
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                Region Size: {editingVenue.gridWidth ?? 1} x{" "}
                {editingVenue.gridHeight ?? 1}
              </FitText>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  as="label"
                  style={{ fontSize: 11, color: colors.textMuted }}
                >
                  Column
                </FitText>
                <FitTextInput
                  value={venueFormData.gridColumn ?? ""}
                  onChange={(event) =>
                    updateVenueFormField("gridColumn", event.target.value)
                  }
                  disabled={editingVenue.isSystem || isVenueSubmitting}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: `1px solid ${colors.fieldBorder}`,
                    backgroundColor: colors.fieldBg,
                    color: colors.textPrimary,
                    height: 34,
                    padding: "0 8px",
                    fontSize: 12,
                  }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  as="label"
                  style={{ fontSize: 11, color: colors.textMuted }}
                >
                  Row
                </FitText>
                <FitTextInput
                  value={venueFormData.gridRow ?? ""}
                  onChange={(event) =>
                    updateVenueFormField("gridRow", event.target.value)
                  }
                  disabled={editingVenue.isSystem || isVenueSubmitting}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: `1px solid ${colors.fieldBorder}`,
                    backgroundColor: colors.fieldBg,
                    color: colors.textPrimary,
                    height: 34,
                    padding: "0 8px",
                    fontSize: 12,
                  }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  as="label"
                  style={{ fontSize: 11, color: colors.textMuted }}
                >
                  Width
                </FitText>
                <FitTextInput
                  value={venueFormData.gridWidth ?? ""}
                  onChange={(event) =>
                    updateVenueFormField("gridWidth", event.target.value)
                  }
                  disabled={editingVenue.isSystem || isVenueSubmitting}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: `1px solid ${colors.fieldBorder}`,
                    backgroundColor: colors.fieldBg,
                    color: colors.textPrimary,
                    height: 34,
                    padding: "0 8px",
                    fontSize: 12,
                  }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  as="label"
                  style={{ fontSize: 11, color: colors.textMuted }}
                >
                  Height
                </FitText>
                <FitTextInput
                  value={venueFormData.gridHeight ?? ""}
                  onChange={(event) =>
                    updateVenueFormField("gridHeight", event.target.value)
                  }
                  disabled={editingVenue.isSystem || isVenueSubmitting}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: `1px solid ${colors.fieldBorder}`,
                    backgroundColor: colors.fieldBg,
                    color: colors.textPrimary,
                    height: 34,
                    padding: "0 8px",
                    fontSize: 12,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              <FitButton
                variant="ghost"
                label="MOVE LEFT"
                onClick={() =>
                  onNudgeVenue?.(editingVenue.mapId, { column: -1, row: 0 })
                }
                disabled={!canEditSelectedVenue}
                fullWidth
              />
              <FitButton
                variant="ghost"
                label="MOVE RIGHT"
                onClick={() =>
                  onNudgeVenue?.(editingVenue.mapId, { column: 1, row: 0 })
                }
                disabled={!canEditSelectedVenue}
                fullWidth
              />
              <FitButton
                variant="ghost"
                label="MOVE UP"
                onClick={() =>
                  onNudgeVenue?.(editingVenue.mapId, { column: 0, row: -1 })
                }
                disabled={!canEditSelectedVenue}
                fullWidth
              />
              <FitButton
                variant="ghost"
                label="MOVE DOWN"
                onClick={() =>
                  onNudgeVenue?.(editingVenue.mapId, { column: 0, row: 1 })
                }
                disabled={!canEditSelectedVenue}
                fullWidth
              />
              <FitButton
                variant="ghost"
                label="WIDER"
                onClick={() =>
                  onResizeVenue?.(editingVenue.mapId, { width: 1, height: 0 })
                }
                disabled={!canEditSelectedVenue}
                fullWidth
              />
              <FitButton
                variant="ghost"
                label="NARROWER"
                onClick={() =>
                  onResizeVenue?.(editingVenue.mapId, { width: -1, height: 0 })
                }
                disabled={!canEditSelectedVenue}
                fullWidth
              />
              <FitButton
                variant="ghost"
                label="TALLER"
                onClick={() =>
                  onResizeVenue?.(editingVenue.mapId, { width: 0, height: 1 })
                }
                disabled={!canEditSelectedVenue}
                fullWidth
              />
              <FitButton
                variant="ghost"
                label="SHORTER"
                onClick={() =>
                  onResizeVenue?.(editingVenue.mapId, { width: 0, height: -1 })
                }
                disabled={!canEditSelectedVenue}
                fullWidth
              />
            </div>

          </>
        ) : null}
      </FitModal>
      <div
        style={{
          marginTop: isCompact ? 8 : 10,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          padding: "10px 12px",
        }}
      >
        <FitText style={{ fontSize: 12, color: colors.textMuted }}>
          {isEditMode
            ? selectedEquipmentId
              ? `Edit Mode is active for ${floor.label}. Drag ${selectedEquipmentName ?? "the selected machine"} onto a blueprint tile to place it. Click any region to edit its details.`
              : `${interactiveHint} Click any region to edit details, and drag regions only when reposition mode is active.`
            : "Tip: Use pan/zoom to navigate this larger canvas. Click a venue to inspect details, then use the venues button to switch into venue management."}
        </FitText>
      </div>
    </div>
  );
}
