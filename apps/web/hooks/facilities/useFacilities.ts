"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GymLayoutEquipmentMutationInput,
  InventoryEquipmentRecord,
  InventoryEquipmentUpdateInput,
  VenueMutationPayload
} from "@fittrack/api-client";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import {
  archivedGymLayoutEquipmentQueryOptions,
  archivedVenuesQueryOptions,
  createGymLayoutEquipmentMutationOptions,
  createVenueMutationOptions,
  deleteGymLayoutEquipmentMutationOptions,
  deleteVenueMutationOptions,
  gymLayoutEquipmentQueryOptions,
  gymLayoutFloorPlanMediaQueryOptions,
  inventoryEquipmentQueryOptions,
  restoreGymLayoutEquipmentMutationOptions,
  restoreVenueMutationOptions,
  updateGymLayoutEquipmentMutationOptions,
  updateGymLayoutFloorPlanMediaMutationOptions,
  updateInventoryEquipmentMutationOptions,
  updateVenueMutationOptions,
  uploadImageMutationOptions,
  operationalVenuesQueryOptions
} from "@fittrack/query";
import {
  buildVenueEquipmentAssignmentsFromRecords,
  gridColumnToPositionX,
  gridRowToPositionY,
  type GymLayoutEquipmentRecord,
  isEquipmentInsideVenue,
  resolveEquipmentGridPlacement
} from "@fittrack/types";
import type {
  EquipmentStatus,
  InventoryEquipmentStatusCounts
} from "@fittrack/types";
import { webApiClient } from "@/lib/api-client";

import { COLS, ROWS, EQUIPMENT } from "@/data/facilities/mapTypes";
import type { VenueRecord, EquipmentDef } from "@/data/facilities/mapTypes";
import {
  buildFacilityFloorVenues,
  type FacilityFloorId,
  type FloorVenueRecord
} from "@/data/facilities/floorPlans";

export type VenuePayload = VenueMutationPayload;
export type FloorLayoutEquipmentDisplay = EquipmentDef & {
  imageUrl: string | null;
  inventoryItemId: string | null;
  status: EquipmentStatus;
  venueId: string | null;
};

export type FacilityPaletteEquipment = EquipmentDef;

type FacilityPaletteEquipmentWithPlacement = FacilityPaletteEquipment & {
  imageUrl?: string | null;
  placedQuantity?: number;
  placementKey?: string;
  quantityTotal?: number;
  statusCounts?: InventoryEquipmentStatusCounts;
};

export type QuickFloorRegionTemplate = {
  capacity: number;
  description: string;
  gridHeight: number;
  gridWidth: number;
  iconKey: string;
  key: string;
  name: string;
};

type DisplayEquipmentSeed = Pick<GymLayoutEquipmentRecord, "iconKey" | "name" | "type">;

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

function normalizeEquipmentKey(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveDisplayEquipmentId(item: DisplayEquipmentSeed) {
  const haystack = [
    normalizeEquipmentKey(item.name),
    normalizeEquipmentKey(item.iconKey),
    normalizeEquipmentKey(item.type)
  ]
    .filter(Boolean)
    .join(" ");

  if (haystack.includes("tread") || haystack.includes("run")) return "treadmill";
  if (haystack.includes("bike") || haystack.includes("cycle")) return "bike";
  if (haystack.includes("ellipt")) return "elliptical";
  if (haystack.includes("cable")) return "cable-machine";
  if (haystack.includes("squat") || haystack.includes("rack")) return "squat-rack";
  if (haystack.includes("bench")) return "bench";
  if (haystack.includes("yoga")) return "yoga-area";
  if (haystack.includes("recover") || haystack.includes("stretch")) return "recovery-zone";
  if (haystack.includes("hiit") || haystack.includes("conditioning")) return "hiit-zone";
  if (haystack.includes("cardio")) return "treadmill";
  if (haystack.includes("strength") || haystack.includes("dumbbell")) return "dumbbells";
  return "dumbbells";
}

function resolveDisplayEquipment(
  item: Pick<
    GymLayoutEquipmentRecord,
    "iconKey" | "id" | "imageUrl" | "inventoryItemId" | "name" | "status" | "type" | "venueId"
  >,
  paletteById: Record<string, EquipmentDef>
): FloorLayoutEquipmentDisplay {
  const paletteItem =
    paletteById[resolveDisplayEquipmentId(item)] ?? paletteById.dumbbells;

  return {
    ...paletteItem,
    id: item.id,
    imageUrl: item.imageUrl,
    inventoryItemId: item.inventoryItemId,
    name: item.name,
    status: item.status,
    venueId: item.venueId
  };
}

function findNextOpenVenueCell(
  venue: FloorVenueRecord,
  liveEquipment: Array<{
    floorId: FacilityFloorId;
    gridColumn: number;
    gridRow: number;
    positionX: number;
    positionY: number;
  }>
) {
  const occupiedCells = new Set(
    liveEquipment
      .filter((item) => isEquipmentInsideVenue(item, venue))
      .map((item) => {
        const placement = resolveEquipmentGridPlacement(item);
        return `${placement.gridColumn}:${placement.gridRow}`;
      })
  );

  const firstColumn = venue.gridColumn ?? 1;
  const lastColumn = firstColumn + (venue.gridWidth ?? 1) - 1;
  const firstRow = venue.gridRow ?? 1;
  const lastRow = firstRow + (venue.gridHeight ?? 1) - 1;

  for (let gridRow = firstRow; gridRow <= lastRow; gridRow += 1) {
    for (let gridColumn = firstColumn; gridColumn <= lastColumn; gridColumn += 1) {
      const key = `${gridColumn}:${gridRow}`;
      if (occupiedCells.has(key)) {
        continue;
      }

      return {
        gridColumn,
        gridRow,
        positionX: gridColumnToPositionX(gridColumn),
        positionY: gridRowToPositionY(gridRow)
      };
    }
  }

  return null;
}

function isGridCellInsideVenue(
  venue: FloorVenueRecord,
  gridColumn: number,
  gridRow: number,
) {
  const firstColumn = venue.gridColumn ?? 1;
  const firstRow = venue.gridRow ?? 1;
  const lastColumn = firstColumn + (venue.gridWidth ?? 1) - 1;
  const lastRow = firstRow + (venue.gridHeight ?? 1) - 1;

  return (
    gridColumn >= firstColumn &&
    gridColumn <= lastColumn &&
    gridRow >= firstRow &&
    gridRow <= lastRow
  );
}

function isGridCellOccupiedInVenue(
  venue: FloorVenueRecord,
  gridColumn: number,
  gridRow: number,
  liveEquipment: Array<{
    floorId: FacilityFloorId;
    gridColumn: number;
    gridRow: number;
    positionX: number;
    positionY: number;
  }>,
) {
  return liveEquipment.some((item) => {
    if (!isEquipmentInsideVenue(item, venue)) {
      return false;
    }

    const placement = resolveEquipmentGridPlacement(item);
    return (
      placement.gridColumn === gridColumn &&
      placement.gridRow === gridRow
    );
  });
}

function toGridPlacement(gridColumn: number, gridRow: number) {
  return {
    gridColumn,
    gridRow,
    positionX: gridColumnToPositionX(gridColumn),
    positionY: gridRowToPositionY(gridRow),
  };
}

function buildEquipmentMutationPayload(
  equipment: FacilityPaletteEquipment,
  venue: FloorVenueRecord,
  placement: {
    gridColumn: number;
    gridRow: number;
    positionX: number;
    positionY: number;
  }
): GymLayoutEquipmentMutationInput {
  return {
    floorId: venue.floorId,
    gridColumn: placement.gridColumn,
    gridRow: placement.gridRow,
    iconKey: equipment.iconKey ?? equipment.id,
    inventoryItemId: String(equipment.id),
    name: equipment.name,
    positionX: placement.positionX,
    positionY: placement.positionY,
    type: equipment.category.toLowerCase(),
    venueId: String(venue.sourceVenueId ?? venue.id),
  };
}

function resolveInventoryEquipmentSeed(
  item: Pick<InventoryEquipmentRecord, "description" | "name" | "unit">
) {
  return {
    iconKey: null,
    name: item.name,
    type: `${item.description ?? ""} ${item.unit ?? ""}`.trim(),
  };
}

function buildInventoryPaletteEquipment(
  item: InventoryEquipmentRecord,
  paletteById: Record<string, EquipmentDef>
): FacilityPaletteEquipmentWithPlacement {
  const fallback = paletteById.dumbbells;
  const paletteMatch =
    paletteById[resolveDisplayEquipmentId(resolveInventoryEquipmentSeed(item))] ??
    fallback;
  const placementKey = normalizeEquipmentKey(paletteMatch.iconKey ?? paletteMatch.id);

  return {
    ...paletteMatch,
    id: item.id,
    iconKey: paletteMatch.iconKey ?? paletteMatch.id,
    imageUrl: item.imageUrl,
    name: item.name,
    placedQuantity: item.placedQuantity,
    quantityAvailable: item.remainingPlaceableQuantity,
    quantityTotal: item.quantityTotal,
    detail: item.unit ? `${item.unit} inventory unit` : "Inventory tracked",
    sourceLabel: "inventory",
    statusCounts: item.statusCounts,
    placementKey,
  };
}

function venuesOverlap(
  a: { gridColumn: number; gridRow: number; gridWidth: number; gridHeight: number },
  b: { gridColumn: number; gridRow: number; gridWidth: number; gridHeight: number }
): boolean {
  const aRight = a.gridColumn + a.gridWidth - 1;
  const aBottom = a.gridRow + a.gridHeight - 1;
  const bRight = b.gridColumn + b.gridWidth - 1;
  const bBottom = b.gridRow + b.gridHeight - 1;
  return (
    a.gridColumn <= bRight &&
    aRight >= b.gridColumn &&
    a.gridRow <= bBottom &&
    aBottom >= b.gridRow
  );
}

function findNextOpenVenuePlacement(
  floorId: FacilityFloorId,
  gridWidth: number,
  gridHeight: number,
  venues: VenueRecord[],
) {
  const floorVenues = venues.filter((venue) => venue.floorId === floorId);

  for (let gridRow = 1; gridRow <= ROWS - gridHeight + 1; gridRow += 1) {
    for (let gridColumn = 1; gridColumn <= COLS - gridWidth + 1; gridColumn += 1) {
      const candidate = { gridColumn, gridRow, gridWidth, gridHeight };
      const overlaps = floorVenues.some((venue) =>
        venuesOverlap(candidate, {
          gridColumn: venue.gridColumn ?? 1,
          gridRow: venue.gridRow ?? 1,
          gridWidth: venue.gridWidth ?? 2,
          gridHeight: venue.gridHeight ?? 2,
        }),
      );

      if (!overlaps) {
        return candidate;
      }
    }
  }

  return null;
}

function createQuickRegionName(
  baseName: string,
  floorId: FacilityFloorId,
  venues: VenueRecord[],
) {
  const normalizedBase = baseName.trim().toLowerCase();
  const existingNames = venues
    .filter((venue) => venue.floorId === floorId)
    .map((venue) => venue.name.trim().toLowerCase());

  if (!existingNames.includes(normalizedBase)) {
    return baseName;
  }

  let suffix = 2;
  while (existingNames.includes(`${normalizedBase} ${suffix}`)) {
    suffix += 1;
  }

  return `${baseName} ${suffix}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeFloorId(value: string | null | undefined): FacilityFloorId {
  if (value === "floor-1" || value === "floor-2" || value === "floor-3") {
    return value;
  }
  return "floor-1";
}

function buildVenueMutationPayloadFromRecord(
  venue: VenueRecord,
  overrides: Partial<VenueMutationPayload> = {},
): VenueMutationPayload {
  return {
    name: venue.name,
    description: venue.description ?? undefined,
    capacity: venue.capacity ?? 1,
    hourlyRate: venue.hourlyRate ?? undefined,
    minimumHours: venue.minimumHours ?? 1,
    iconKey: venue.iconKey ?? "gym-area",
    imageUrl: venue.imageUrl ?? undefined,
    imageFit: venue.imageFit ?? "cover",
    imageFocalX: venue.imageFocalX ?? 0.5,
    imageFocalY: venue.imageFocalY ?? 0.5,
    imageCropZoom: venue.imageCropZoom ?? 1,
    floorId: normalizeFloorId(venue.floorId),
    gridColumn: venue.gridColumn ?? 1,
    gridRow: venue.gridRow ?? 1,
    gridWidth: venue.gridWidth ?? 2,
    gridHeight: venue.gridHeight ?? 2,
    isMapped: venue.isMapped ?? true,
    isReservable: venue.isReservable ?? false,
    displayOrder: venue.displayOrder ?? 0,
    status: venue.status ?? undefined,
    ...overrides,
  };
}

export function checkVenueOverlap(
  payload: Pick<VenuePayload, "floorId" | "gridColumn" | "gridRow" | "gridWidth" | "gridHeight">,
  venues: VenueRecord[],
  excludeId?: string | number
): string | null {
  for (const v of venues) {
    if (excludeId !== undefined && v.id === excludeId) continue;
    if (v.floorId !== payload.floorId) continue;
    const existing = {
      gridColumn: v.gridColumn ?? 1,
      gridRow: v.gridRow ?? 1,
      gridWidth: v.gridWidth ?? 2,
      gridHeight: v.gridHeight ?? 2
    };
    if (venuesOverlap(payload, existing)) {
      return `This position overlaps with "${v.name}". Adjust the grid position or size.`;
    }
  }
  return null;
}

export function useVenueMutations() {
  const queryClient = useQueryClient();
  const { message, showMessage } = useTimedMessage(2200);

  const venuesQuery = useQuery(operationalVenuesQueryOptions(webApiClient));
  const { data: venues = [], isLoading: venuesLoading } = venuesQuery;
  const archivedVenuesQuery = useQuery(archivedVenuesQueryOptions(webApiClient));
  const {
    data: archivedVenues = [],
    isLoading: archivedVenuesLoading,
  } = archivedVenuesQuery;

  const createVenueMutation = useMutation(createVenueMutationOptions(webApiClient, queryClient));

  const updateVenueMutation = useMutation(updateVenueMutationOptions(webApiClient, queryClient));

  const deleteVenueMutation = useMutation(deleteVenueMutationOptions(webApiClient, queryClient));
  const restoreVenueMutation = useMutation(restoreVenueMutationOptions(webApiClient, queryClient));
  const uploadImageMutation = useMutation(uploadImageMutationOptions(webApiClient));

  const isVenueSubmitting = createVenueMutation.isPending || updateVenueMutation.isPending;
  const venueSavingLabel = useLoadingText("SAVING VENUE", isVenueSubmitting);

  const buildPayload = (data: Record<string, string>): VenuePayload | string => {
    const capacity = Number(data.capacity ?? "");
    const hourlyRateRaw = (data.hourlyRate ?? "").trim();
    const hourlyRate = hourlyRateRaw === "" ? undefined : Number(hourlyRateRaw);
    const minHoursRaw = Number(data.minimumHours ?? "");
    const gridColumn = Number(data.gridColumn ?? "");
    const gridRow = Number(data.gridRow ?? "");
    const gridWidth = Number(data.gridWidth ?? "");
    const gridHeight = Number(data.gridHeight ?? "");
    const displayOrder = Number(data.displayOrder ?? "");
    const floorId = (data.floorId ?? "").trim();
    const isReservable = data.isReservable !== "false";
    const status = data.status?.trim() as EquipmentStatus | undefined;
    const imageFit = data.imageFit === "contain" ? "contain" : "cover";
    const imageFocalX = Number(data.imageFocalX ?? "0.5");
    const imageFocalY = Number(data.imageFocalY ?? "0.5");
    const imageCropZoom = Number(data.imageCropZoom ?? "1");

    if (!Number.isFinite(capacity) || capacity <= 0) return "Capacity must be greater than zero.";
    if (hourlyRate !== undefined && (!Number.isFinite(hourlyRate) || hourlyRate < 0)) return "Hourly rate must be zero or greater.";
    if (isReservable && (hourlyRate === undefined || hourlyRate <= 0)) return "Reservable venues require an hourly rate greater than zero.";
    if (floorId !== "floor-1" && floorId !== "floor-2" && floorId !== "floor-3") return "Select a valid floor.";
    if (!Number.isFinite(gridColumn) || gridColumn < 1 || gridColumn > COLS) return `Grid column must be between 1 and ${COLS}.`;
    if (!Number.isFinite(gridRow) || gridRow < 1 || gridRow > ROWS) return `Grid row must be between 1 and ${ROWS}.`;
    if (!Number.isFinite(gridWidth) || gridWidth < 1 || gridColumn + gridWidth - 1 > COLS) return `Grid width must keep the venue inside the ${COLS} column layout.`;
    if (!Number.isFinite(gridHeight) || gridHeight < 1 || gridRow + gridHeight - 1 > ROWS) return `Grid height must keep the venue inside the ${ROWS} row layout.`;
    if (!Number.isFinite(imageFocalX) || imageFocalX < 0 || imageFocalX > 1) return "Image focal X must be between 0 and 1.";
    if (!Number.isFinite(imageFocalY) || imageFocalY < 0 || imageFocalY > 1) return "Image focal Y must be between 0 and 1.";
    if (!Number.isFinite(imageCropZoom) || imageCropZoom < 1 || imageCropZoom > 4) return "Image crop zoom must be between 1 and 4.";

    const name = (data.name ?? "").trim();
    if (!name) return "Venue name is required.";

    return {
      name,
      description: (data.description ?? "").trim() || undefined,
      capacity,
      hourlyRate: isReservable ? hourlyRate : undefined,
      minimumHours: Number.isFinite(minHoursRaw) && minHoursRaw > 0 ? minHoursRaw : 1,
      iconKey: (data.iconKey ?? "").trim() || "gym-area",
      imageUrl: (data.imageUrl ?? "").trim() || undefined,
      imageFit,
      imageFocalX,
      imageFocalY,
      imageCropZoom,
      floorId,
      gridColumn,
      gridRow,
      gridWidth,
      gridHeight,
      isReservable,
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
      ...(status ? { status } : {}),
    };
  };

  const handleVenueSubmit = async (
    data: Record<string, string>,
    editTarget: VenueRecord | null,
    onSuccess: () => void
  ) => {
    const result = buildPayload(data);
    if (typeof result === "string") {
      showMessage(result);
      return false;
    }
    const overlapError = checkVenueOverlap(result, venues, editTarget?.id);
    if (overlapError) {
      showMessage(overlapError);
      return false;
    }
    try {
      if (editTarget) {
        await updateVenueMutation.mutateAsync({ id: editTarget.id, payload: result });
        showMessage("Venue updated.");
      } else {
        await createVenueMutation.mutateAsync(result);
        showMessage("Venue created.");
      }
      onSuccess();
      return true;
    } catch {
      showMessage("Unable to save venue.");
      return false;
    }
  };

  const handleDeleteVenue = async (
    target: VenueRecord | null,
    onSuccess: () => void
  ) => {
    if (!target) return;
    try {
      await deleteVenueMutation.mutateAsync(target.id);
      showMessage("Venue archived.");
      onSuccess();
    } catch {
      showMessage("Unable to delete venue.");
    }
  };

  const handleRestoreVenue = async (
    target: VenueRecord | null,
    onSuccess?: () => void,
  ) => {
    if (!target) return;
    try {
      await restoreVenueMutation.mutateAsync(target.id);
      showMessage(`${target.name} restored to active venues.`);
      onSuccess?.();
    } catch {
      showMessage("Unable to restore venue.");
    }
  };

  const handleUploadVenueImage = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResult = await uploadImageMutation.mutateAsync(formData);
      const nextUrl = uploadResult.url ?? "";
      showMessage("Venue image uploaded.");
      return nextUrl || null;
    } catch {
      showMessage("Unable to upload venue image.");
      return null;
    }
  };

  const handleCreateQuickFloorRegion = async (
    template: QuickFloorRegionTemplate,
    floorId: FacilityFloorId,
    onSuccess?: () => void,
  ) => {
    const placement = findNextOpenVenuePlacement(
      floorId,
      template.gridWidth,
      template.gridHeight,
      venues,
    );

    if (!placement) {
      showMessage("No open floor area is available for that region template on the selected floor.");
      return;
    }

    const payload: VenuePayload = {
      name: createQuickRegionName(template.name, floorId, venues),
      description: template.description,
      capacity: template.capacity,
      hourlyRate: undefined,
      minimumHours: 1,
      iconKey: template.iconKey,
      floorId,
      gridColumn: placement.gridColumn,
      gridRow: placement.gridRow,
      gridWidth: template.gridWidth,
      gridHeight: template.gridHeight,
      isReservable: false,
      displayOrder: 90,
    };

    try {
      await createVenueMutation.mutateAsync(payload);
      showMessage(`${payload.name} added to ${floorId.replace("floor-", "Floor ")} and synced to member facilities.`);
      onSuccess?.();
    } catch {
      showMessage("Unable to add this floor region right now.");
    }
  };

  const handleCreateQuickFloorRegionAt = async (
    template: QuickFloorRegionTemplate,
    floorId: FacilityFloorId,
    preferredPlacement: { gridColumn: number; gridRow: number },
    onSuccess?: () => void,
  ) => {
    const gridColumn = clamp(
      preferredPlacement.gridColumn,
      1,
      COLS - template.gridWidth + 1,
    );
    const gridRow = clamp(
      preferredPlacement.gridRow,
      1,
      ROWS - template.gridHeight + 1,
    );

    const payload: VenuePayload = {
      name: createQuickRegionName(template.name, floorId, venues),
      description: template.description,
      capacity: template.capacity,
      hourlyRate: undefined,
      minimumHours: 1,
      iconKey: template.iconKey,
      floorId,
      gridColumn,
      gridRow,
      gridWidth: template.gridWidth,
      gridHeight: template.gridHeight,
      isReservable: false,
      displayOrder: 90,
    };

    const overlapError = checkVenueOverlap(payload, venues);
    if (overlapError) {
      showMessage(overlapError);
      return false;
    }

    try {
      await createVenueMutation.mutateAsync(payload);
      showMessage(
        `${payload.name} placed on ${floorId.replace("floor-", "Floor ")} at C${gridColumn}/R${gridRow}.`,
      );
      onSuccess?.();
      return true;
    } catch {
      showMessage("Unable to place this floor region right now.");
      return false;
    }
  };

  const handleUpdateVenueLayout = async (
    venue: VenueRecord,
    placement: Partial<
      Pick<
        VenueMutationPayload,
        "floorId" | "gridColumn" | "gridRow" | "gridWidth" | "gridHeight" | "isMapped"
      >
    >,
    options?: { silent?: boolean },
  ) => {
    const currentPayload = buildVenueMutationPayloadFromRecord(venue);
    const floorId = normalizeFloorId(placement.floorId ?? currentPayload.floorId);
    const gridWidth = clamp(
      placement.gridWidth ?? currentPayload.gridWidth,
      1,
      COLS,
    );
    const gridHeight = clamp(
      placement.gridHeight ?? currentPayload.gridHeight,
      1,
      ROWS,
    );
    const gridColumn = clamp(
      placement.gridColumn ?? currentPayload.gridColumn,
      1,
      COLS - gridWidth + 1,
    );
    const gridRow = clamp(
      placement.gridRow ?? currentPayload.gridRow,
      1,
      ROWS - gridHeight + 1,
    );

    const payload = buildVenueMutationPayloadFromRecord(venue, {
      floorId,
      gridColumn,
      gridRow,
      gridWidth,
      gridHeight,
      isMapped: placement.isMapped ?? currentPayload.isMapped,
    });

    const overlapError =
      payload.isMapped === false
        ? null
        : checkVenueOverlap(payload, venues, venue.id);
    if (overlapError) {
      if (!options?.silent) {
        showMessage(overlapError);
      }
      return false;
    }

    try {
      await updateVenueMutation.mutateAsync({ id: venue.id, payload });
      if (!options?.silent) {
        showMessage(`${venue.name} layout updated.`);
      }
      return true;
    } catch {
      if (!options?.silent) {
        showMessage("Unable to update venue layout.");
      }
      return false;
    }
  };

  const toggleVenueMaintenance = async (venue: VenueRecord | null) => {
    if (!venue) return false;
    if (
      venue.status !== undefined &&
      venue.status !== null &&
      venue.status !== "available" &&
      venue.status !== "maintenance"
    ) {
      showMessage("Broken, missing, and occupied venues keep their current status.");
      return false;
    }

    try {
      await updateVenueMutation.mutateAsync({
        id: venue.id,
        payload: buildVenueMutationPayloadFromRecord(venue, {
          status: venue.status === "maintenance" ? "available" : "maintenance",
        }),
      });
      showMessage(
        venue.status === "maintenance"
          ? `${venue.name} marked available.`
          : `${venue.name} marked for maintenance.`,
      );
      return true;
    } catch {
      showMessage("Unable to update venue maintenance status.");
      return false;
    }
  };

  return {
    venues,
    venuesError: venuesQuery.isError,
    refetchVenues: venuesQuery.refetch,
    archivedVenues,
    archivedVenuesError: archivedVenuesQuery.isError,
    refetchArchivedVenues: archivedVenuesQuery.refetch,
    venuesLoading,
    archivedVenuesLoading,
    isVenueSubmitting,
    venueSavingLabel,
    deleteVenueMutation,
    restoreVenueMutation,
    message,
    showMessage,
    handleUpdateVenueLayout,
    toggleVenueMaintenance,
    handleVenueSubmit,
    handleDeleteVenue,
    handleRestoreVenue,
    handleUploadVenueImage,
    handleCreateQuickFloorRegion,
    handleCreateQuickFloorRegionAt
  };
}

export function useFloorLayout() {
  const queryClient = useQueryClient();
  const [activeFloor, setActiveFloor] = useState<FacilityFloorId>("floor-1");
  const [isEditMode, setIsEditMode] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [clearFloorConfirmOpen, setClearFloorConfirmOpen] = useState(false);
  const [layoutName, setLayoutName] = useState("Main Floor Plan");
  const [layoutType, setLayoutType] = useState("custom");
  const [gridSize, setGridSize] = useState("40");
  const [deleteTarget, setDeleteTarget] = useState<{ venueMapId: string; equipmentId: string } | null>(null);
  const { message, showMessage } = useTimedMessage(2200);
  const { data: venues = [] } = useQuery(
    operationalVenuesQueryOptions(webApiClient),
  );
  const { data: liveEquipment = [] } = useQuery(gymLayoutEquipmentQueryOptions(webApiClient));
  const { data: floorPlanMedia = [] } = useQuery(gymLayoutFloorPlanMediaQueryOptions(webApiClient));
  const archivedEquipmentQuery = useQuery(
    archivedGymLayoutEquipmentQueryOptions(webApiClient),
  );
  const {
    data: archivedEquipment = [],
    isLoading: archivedEquipmentLoading,
  } = archivedEquipmentQuery;
  const { data: inventoryEquipmentPage } = useQuery(
    inventoryEquipmentQueryOptions(webApiClient, { limit: 100, page: 1 })
  );
  const inventoryEquipment = useMemo(
    () => inventoryEquipmentPage?.data ?? [],
    [inventoryEquipmentPage?.data]
  );
  const displayEquipmentCatalogById = useMemo(
    () =>
      Object.fromEntries(
        EQUIPMENT.map((item) => [
          item.id,
          { ...item, iconKey: item.iconKey ?? item.id }
        ])
      ) as Record<string, EquipmentDef>,
    []
  );
  const availableEquipment = useMemo(() => {
    const activeInventoryEquipment = inventoryEquipment
      .filter((item) => item.isActive && item.quantityTotal > 0)
      .map((item) => buildInventoryPaletteEquipment(item, displayEquipmentCatalogById));

    return activeInventoryEquipment.sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [displayEquipmentCatalogById, inventoryEquipment]);
  const equipmentPaletteById = useMemo(
    () =>
      Object.fromEntries(
        availableEquipment.map((item) => [item.id, item])
      ) as Record<string, FacilityPaletteEquipment>,
    [availableEquipment]
  );
  const equipmentRemainingById = useMemo(() => {
    return availableEquipment.reduce<Record<string, number | null>>((accumulator, item) => {
      accumulator[item.id] = item.quantityAvailable ?? null;
      return accumulator;
    }, {});
  }, [availableEquipment]);
  const createEquipmentMutation = useMutation(
    createGymLayoutEquipmentMutationOptions(webApiClient, queryClient)
  );
  const updateEquipmentMutation = useMutation(
    updateGymLayoutEquipmentMutationOptions(webApiClient, queryClient)
  );
  const deleteEquipmentMutation = useMutation(
    deleteGymLayoutEquipmentMutationOptions(webApiClient, queryClient)
  );
  const restoreEquipmentMutation = useMutation(
    restoreGymLayoutEquipmentMutationOptions(webApiClient, queryClient)
  );
  const uploadImageMutation = useMutation(uploadImageMutationOptions(webApiClient));
  const updateFloorPlanMediaMutation = useMutation(
    updateGymLayoutFloorPlanMediaMutationOptions(webApiClient, queryClient)
  );
  const updateInventoryEquipmentMutation = useMutation(
    updateInventoryEquipmentMutationOptions(webApiClient, queryClient)
  );

  const equipmentById = useMemo(
    () =>
      Object.fromEntries(
        liveEquipment.map((item) => [
          item.id,
          resolveDisplayEquipment(item, displayEquipmentCatalogById)
        ])
      ) as Record<string, FloorLayoutEquipmentDisplay>,
    [displayEquipmentCatalogById, liveEquipment]
  );
  const floorVenues = useMemo(() => buildFacilityFloorVenues(venues), [venues]);
  const floorPlanImageByFloor = useMemo(
    () =>
      Object.fromEntries(
        floorPlanMedia.map((item) => [
          item.floorId,
          hidePlaceholderAssetUrl(item.imageUrl)
        ])
      ) as Record<FacilityFloorId, string | null>,
    [floorPlanMedia]
  );
  const activeFloorImageUrl = floorPlanImageByFloor[activeFloor] ?? null;
  const activeFloorBounds = useMemo(() => {
    const media = floorPlanMedia.find((item) => item.floorId === activeFloor);
    return {
      gridHeight: media?.gridHeight ?? ROWS,
      gridWidth: media?.gridWidth ?? COLS,
    };
  }, [activeFloor, floorPlanMedia]);
  const assignedEquipment = useMemo(
    () =>
      buildVenueEquipmentAssignmentsFromRecords(liveEquipment, floorVenues)[activeFloor] ?? {},
    [activeFloor, floorVenues, liveEquipment]
  );
  const assignedCount = Object.values(assignedEquipment).reduce((count, items) => count + items.length, 0);
  const hasUnsavedChanges = false;

  const handleSaveLayout = (onSaved?: () => void) => {
    onSaved?.();
  };

  const handleToggleEditMode = () => {
    setIsEditMode((current) => !current);
  };

  const handleSaveAndExit = (onSaved?: () => void) => {
    handleSaveLayout(onSaved);
    setIsEditMode(false);
    setShowUnsavedConfirm(false);
  };

  const handleRemoveEquipmentFromCanvas = async (equipmentId: string) => {
    try {
      // The gym-layout endpoint removes only this placement node. The source
      // inventory item is held separately and is never deleted by this call.
      await deleteEquipmentMutation.mutateAsync(equipmentId);
      await queryClient.invalidateQueries({
        queryKey: inventoryEquipmentQueryOptions(
          webApiClient,
          { limit: 100, page: 1 },
        ).queryKey,
      });
      showMessage("Equipment removed from the floor plan.");
      return true;
    } catch {
      showMessage("Unable to remove equipment from the floor plan.");
      return false;
    }
  };

  const handleConfirmCellDelete = async () => {
    if (!deleteTarget) return;
    const removed = await handleRemoveEquipmentFromCanvas(
      deleteTarget.equipmentId,
    );
    if (removed) {
      setDeleteTarget(null);
    }
  };

  const handleRequestClearFloor = () => {
    if (!isEditMode) return;
    const floorEquipment = liveEquipment.filter((item) => item.floorId === activeFloor);
    if (floorEquipment.length === 0) {
      showMessage("No equipment is assigned on this floor yet.");
      return;
    }
    setClearFloorConfirmOpen(true);
  };

  const handleClearFloor = async () => {
    if (!isEditMode) return;
    const floorEquipment = liveEquipment.filter((item) => item.floorId === activeFloor);
    if (floorEquipment.length === 0) {
      showMessage("No equipment is assigned on this floor yet.");
      return;
    }

    try {
      await Promise.all(
        floorEquipment.map((item) => deleteEquipmentMutation.mutateAsync(item.id))
      );
      showMessage("Floor equipment cleared.");
      setClearFloorConfirmOpen(false);
    } catch {
      showMessage("Unable to clear the current floor.");
    }
  };

  const handleRestoreEquipment = async (
    equipment: GymLayoutEquipmentRecord | null,
    onSuccess?: () => void,
  ) => {
    if (!equipment) return;
    try {
      await restoreEquipmentMutation.mutateAsync(equipment.id);
      showMessage(`${equipment.name} restored to the floor plan.`);
      onSuccess?.();
    } catch {
      showMessage("Unable to restore equipment.");
    }
  };

  const handleUploadFloorPlanImage = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResult = await uploadImageMutation.mutateAsync(formData);
      const nextUrl = uploadResult.url ?? null;
      if (!nextUrl) {
        showMessage("Unable to resolve the uploaded floor plan image.");
        return;
      }

      await updateFloorPlanMediaMutation.mutateAsync({
        floorId: activeFloor,
        imageUrl: nextUrl,
      });
      showMessage(`${activeFloor.replace("floor-", "Floor ")} image updated.`);
    } catch {
      showMessage("Unable to upload floor plan image.");
    }
  };

  const assignEquipmentToVenue = async (
    equipmentId: string,
    venueMapId: string,
    preferredCell?: {
      gridColumn: number;
      gridRow: number;
    },
  ) => {
    const equipment = equipmentPaletteById[equipmentId];
    const venue = floorVenues[activeFloor].find((candidate) => candidate.mapId === venueMapId);
    if (!equipment || !venue) return;

    if (equipment.quantityAvailable !== undefined) {
      if (equipment.quantityAvailable <= 0) {
        showMessage(`${equipment.name} has no remaining inventory units available to place on the floor map.`);
        return;
      }
    }

    const preferredPlacement =
      preferredCell &&
        isGridCellInsideVenue(venue, preferredCell.gridColumn, preferredCell.gridRow) &&
        !isGridCellOccupiedInVenue(
          venue,
          preferredCell.gridColumn,
          preferredCell.gridRow,
          liveEquipment,
        )
        ? toGridPlacement(preferredCell.gridColumn, preferredCell.gridRow)
        : null;

    const placement =
      preferredPlacement ?? findNextOpenVenueCell(venue, liveEquipment);
    if (!placement) {
      showMessage(`${venue.name} has no open grid cells left. Remove equipment or enlarge the venue first.`);
      return;
    }

    const payload = buildEquipmentMutationPayload(equipment, venue, placement);

    try {
      await createEquipmentMutation.mutateAsync(payload);
      showMessage(`${equipment.name} assigned to ${venue.name}.`);
    } catch {
      showMessage("Unable to assign equipment to this venue.");
    }
  };

  const handleResizeFloorBounds = async (bounds: {
    gridHeight: number;
    gridWidth: number;
  }) => {
    try {
      await updateFloorPlanMediaMutation.mutateAsync({
        floorId: activeFloor,
        gridHeight: Math.max(6, Math.min(20, bounds.gridHeight)),
        gridWidth: Math.max(8, Math.min(30, bounds.gridWidth)),
      });
      showMessage(`${activeFloor.replace("floor-", "Floor ")} bounds updated.`);
      return true;
    } catch {
      showMessage("Unable to resize the floor bounds.");
      return false;
    }
  };

  const handleUpdateInventoryEquipmentFromFacilities = async (
    equipmentId: string,
    data: Record<string, string>,
  ) => {
    const payload: InventoryEquipmentUpdateInput = {
      description: data.description?.trim() || undefined,
      name: data.name?.trim(),
      unit: data.unit?.trim(),
    };

    try {
      await updateInventoryEquipmentMutation.mutateAsync({ equipmentId, payload });
      await queryClient.invalidateQueries({
        queryKey: gymLayoutEquipmentQueryOptions(webApiClient).queryKey,
      });
      showMessage(`${payload.name ?? "Equipment"} updated.`);
      return true;
    } catch {
      showMessage("Unable to update equipment details.");
      return false;
    }
  };

  const updateEquipmentPlacement = async (
    equipmentId: string,
    venueMapId: string,
    preferredCell: { gridColumn: number; gridRow: number },
  ) => {
    const equipment = liveEquipment.find((item) => item.id === equipmentId);
    const venue = floorVenues[activeFloor].find(
      (candidate) => candidate.mapId === venueMapId,
    );

    if (!equipment || !venue) {
      return false;
    }

    if (
      !isGridCellInsideVenue(
        venue,
        preferredCell.gridColumn,
        preferredCell.gridRow,
      )
    ) {
      showMessage(`${equipment.name} must remain inside ${venue.name}.`);
      return false;
    }

    if (
      isGridCellOccupiedInVenue(
        venue,
        preferredCell.gridColumn,
        preferredCell.gridRow,
        liveEquipment.filter((item) => item.id !== equipmentId),
      )
    ) {
      showMessage("That venue cell already contains equipment.");
      return false;
    }

    try {
      await updateEquipmentMutation.mutateAsync({
        equipmentId,
        payload: {
          floorId: venue.floorId,
          gridColumn: preferredCell.gridColumn,
          gridRow: preferredCell.gridRow,
          positionX: gridColumnToPositionX(preferredCell.gridColumn),
          positionY: gridRowToPositionY(preferredCell.gridRow),
          venueId: String(venue.sourceVenueId ?? venue.id),
        },
      });
      showMessage(`${equipment.name} moved to ${venue.name}.`);
      return true;
    } catch {
      showMessage("Unable to move equipment on the floor map.");
      return false;
    }
  };

  const toggleEquipmentMaintenance = async (
    equipment: GymLayoutEquipmentRecord | null,
  ) => {
    if (!equipment) return false;
    if (equipment.status !== "available" && equipment.status !== "maintenance") {
      showMessage("Broken, missing, and occupied equipment keep their current status.");
      return false;
    }

    try {
      await updateEquipmentMutation.mutateAsync({
        equipmentId: equipment.id,
        payload: {
          floorId: equipment.floorId,
          status:
            equipment.status === "maintenance" ? "available" : "maintenance",
        },
      });
      showMessage(
        equipment.status === "maintenance"
          ? `${equipment.name} marked available.`
          : `${equipment.name} marked for maintenance.`,
      );
      return true;
    } catch {
      showMessage("Unable to update equipment maintenance status.");
      return false;
    }
  };

  return {
    activeFloor,
    setActiveFloor,
    isEditMode,
    hasUnsavedChanges,
    showUnsavedConfirm,
    setShowUnsavedConfirm,
    clearFloorConfirmOpen,
    setClearFloorConfirmOpen,
    layoutName,
    setLayoutName,
    layoutType,
    setLayoutType,
    gridSize,
    setGridSize,
    deleteTarget,
    setDeleteTarget,
    assignedEquipment,
    activeFloorImageUrl,
    activeFloorBounds,
    archivedEquipment,
    archivedEquipmentError: archivedEquipmentQuery.isError,
    refetchArchivedEquipment: archivedEquipmentQuery.refetch,
    archivedEquipmentLoading,
    availableEquipment,
    inventoryEquipment,
    equipmentRemainingById,
    equipmentById,
    liveEquipment,
    assignedCount,
    deleteEquipmentMutation,
    restoreEquipmentMutation,
    equipmentPlacementPending: updateEquipmentMutation.isPending,
    updateEquipmentPlacement,
    toggleEquipmentMaintenance,
    updateFloorPlanMediaMutation,
    updateInventoryEquipmentMutation,
    message,
    handleSaveLayout,
    handleToggleEditMode,
    handleSaveAndExit,
    handleConfirmCellDelete,
    handleRemoveEquipmentFromCanvas,
    handleRequestClearFloor,
    handleClearFloor,
    handleRestoreEquipment,
    handleUploadFloorPlanImage,
    handleResizeFloorBounds,
    handleUpdateInventoryEquipmentFromFacilities,
    assignEquipmentToVenue
  };
}
