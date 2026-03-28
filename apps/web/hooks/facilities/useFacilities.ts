"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import {
  createVenueMutationOptions,
  deleteVenueMutationOptions,
  updateVenueMutationOptions,
  venuesQueryOptions
} from "@fittrack/query";
import { webApiClient } from "@/lib/api-client";

import { COLS, ROWS, LAYOUT_KEY, EQUIPMENT } from "@/data/facilities/mapTypes";
import type { VenueRecord, VenueEquipmentAssignments, EquipmentDef } from "@/data/facilities/mapTypes";
import { buildFacilityFloorVenues, type FacilityFloorId } from "@/data/facilities/floorPlans";

export type VenuePayload = {
  name: string;
  description?: string;
  capacity: number;
  hourlyRate?: number;
  minimumHours: number;
  iconKey: string;
  gridColumn: number;
  gridRow: number;
  gridWidth: number;
  gridHeight: number;
  isReservable: boolean;
  displayOrder: number;
};

type VenueEquipmentAssignmentsByFloor = Record<FacilityFloorId, VenueEquipmentAssignments>;

function createEmptyAssignments(): VenueEquipmentAssignmentsByFloor {
  return { "floor-1": {}, "floor-2": {}, "floor-3": {} };
}

function isCellMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

function isVenueAssignmentMap(value: unknown): value is VenueEquipmentAssignments {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every((entry) => Array.isArray(entry) && entry.every((item) => typeof item === "string"));
}

function resolveVenueForCell(floorId: FacilityFloorId, cellId: string) {
  const [, rowValue, colValue] = cellId.split("-");
  const row = Number(rowValue) + 1;
  const column = Number(colValue) + 1;
  if (!Number.isFinite(row) || !Number.isFinite(column)) return null;
  const floorVenues = buildFacilityFloorVenues([])[floorId];
  return floorVenues.find((venue) => {
    const gridColumn = venue.gridColumn ?? 1;
    const gridRow = venue.gridRow ?? 1;
    const gridWidth = venue.gridWidth ?? 2;
    const gridHeight = venue.gridHeight ?? 2;
    return (
      column >= gridColumn &&
      column <= gridColumn + gridWidth - 1 &&
      row >= gridRow &&
      row <= gridRow + gridHeight - 1
    );
  }) ?? null;
}

function migrateLegacyAssignments(floorId: FacilityFloorId, legacyMap: Record<string, string>): VenueEquipmentAssignments {
  const nextAssignments: VenueEquipmentAssignments = {};
  Object.entries(legacyMap).forEach(([cellId, equipmentId]) => {
    const venue = resolveVenueForCell(floorId, cellId);
    if (!venue?.mapId) return;
    const current = nextAssignments[venue.mapId] ?? [];
    nextAssignments[venue.mapId] = current.includes(equipmentId) ? current : [...current, equipmentId];
  });
  return nextAssignments;
}

function normalizeStoredAssignments(value: unknown): VenueEquipmentAssignmentsByFloor {
  const emptyAssignments = createEmptyAssignments();
  if (!value || typeof value !== "object") return emptyAssignments;
  const rawFloors = "floors" in (value as Record<string, unknown>)
    ? (value as { floors?: Partial<Record<FacilityFloorId, unknown>> }).floors
    : value as Partial<Record<FacilityFloorId, unknown>>;

  return {
    "floor-1": isVenueAssignmentMap(rawFloors?.["floor-1"])
      ? rawFloors["floor-1"]
      : isCellMap(rawFloors?.["floor-1"])
        ? migrateLegacyAssignments("floor-1", rawFloors["floor-1"])
        : isCellMap(value)
          ? migrateLegacyAssignments("floor-1", value)
          : {},
    "floor-2": isVenueAssignmentMap(rawFloors?.["floor-2"])
      ? rawFloors["floor-2"]
      : isCellMap(rawFloors?.["floor-2"])
        ? migrateLegacyAssignments("floor-2", rawFloors["floor-2"])
        : {},
    "floor-3": isVenueAssignmentMap(rawFloors?.["floor-3"])
      ? rawFloors["floor-3"]
      : isCellMap(rawFloors?.["floor-3"])
        ? migrateLegacyAssignments("floor-3", rawFloors["floor-3"])
        : {}
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

export function checkVenueOverlap(
    payload: Pick<VenuePayload, "gridColumn" | "gridRow" | "gridWidth" | "gridHeight">,
    venues: VenueRecord[],
    excludeId?: number
): string | null {
  for (const v of venues) {
    if (excludeId !== undefined && v.id === excludeId) continue;
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

  const { data: venues = [], isLoading: venuesLoading } = useQuery(venuesQueryOptions(webApiClient));

  const createVenueMutation = useMutation(createVenueMutationOptions(webApiClient, queryClient));

  const updateVenueMutation = useMutation(updateVenueMutationOptions(webApiClient, queryClient));

  const deleteVenueMutation = useMutation(deleteVenueMutationOptions(webApiClient, queryClient));

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

    if (!Number.isFinite(capacity) || capacity <= 0) return "Capacity must be greater than zero.";
    if (hourlyRate !== undefined && (!Number.isFinite(hourlyRate) || hourlyRate < 0)) return "Hourly rate must be zero or greater.";
    if (!Number.isFinite(gridColumn) || gridColumn < 1 || gridColumn > COLS) return `Grid column must be between 1 and ${COLS}.`;
    if (!Number.isFinite(gridRow) || gridRow < 1 || gridRow > ROWS) return `Grid row must be between 1 and ${ROWS}.`;
    if (!Number.isFinite(gridWidth) || gridWidth < 1 || gridColumn + gridWidth - 1 > COLS) return `Grid width must keep the venue inside the ${COLS} column layout.`;
    if (!Number.isFinite(gridHeight) || gridHeight < 1 || gridRow + gridHeight - 1 > ROWS) return `Grid height must keep the venue inside the ${ROWS} row layout.`;

    const name = (data.name ?? "").trim();
    if (!name) return "Venue name is required.";

    return {
      name,
      description: (data.description ?? "").trim() || undefined,
      capacity,
      hourlyRate,
      minimumHours: Number.isFinite(minHoursRaw) && minHoursRaw > 0 ? minHoursRaw : 1,
      iconKey: (data.iconKey ?? "").trim() || "gym-area",
      gridColumn,
      gridRow,
      gridWidth,
      gridHeight,
      isReservable: data.isReservable !== "false",
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0
    };
  };

  const handleVenueSubmit = async (
      data: Record<string, string>,
      editTarget: VenueRecord | null,
      onSuccess: () => void
  ) => {
    const result = buildPayload(data);
    if (typeof result === "string") { showMessage(result); return; }
    const overlapError = checkVenueOverlap(result, venues, editTarget?.id);
    if (overlapError) { showMessage(overlapError); return; }
    try {
      if (editTarget) {
        await updateVenueMutation.mutateAsync({ id: editTarget.id, payload: result });
        showMessage("Venue updated.");
      } else {
        await createVenueMutation.mutateAsync(result);
        showMessage("Venue created.");
      }
      onSuccess();
    } catch {
      showMessage("Unable to save venue.");
    }
  };

  const handleDeleteVenue = async (
      target: VenueRecord | null,
      onSuccess: () => void
  ) => {
    if (!target) return;
    try {
      await deleteVenueMutation.mutateAsync(target.id);
      showMessage("Venue deleted.");
      onSuccess();
    } catch {
      showMessage("Unable to delete venue.");
    }
  };

  return {
    venues,
    venuesLoading,
    isVenueSubmitting,
    venueSavingLabel,
    deleteVenueMutation,
    message,
    showMessage,
    handleVenueSubmit,
    handleDeleteVenue
  };
}

export function useFloorLayout() {
  const [activeFloor, setActiveFloor] = useState<FacilityFloorId>("floor-1");
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [layoutName, setLayoutName] = useState("Main Floor Plan");
  const [layoutType, setLayoutType] = useState("custom");
  const [gridSize, setGridSize] = useState("40");
  const [deleteTarget, setDeleteTarget] = useState<{ venueMapId: string; equipmentId: string } | null>(null);
  const [equipmentAssignmentsByFloor, setEquipmentAssignmentsByFloor] = useState<VenueEquipmentAssignmentsByFloor>(() => {
    if (typeof window === "undefined") return createEmptyAssignments();
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) return createEmptyAssignments();
      return normalizeStoredAssignments(JSON.parse(raw) as unknown);
    } catch {
      return createEmptyAssignments();
    }
  });

  const equipmentById = useMemo(
      () => Object.fromEntries(EQUIPMENT.map((item) => [item.id, item])) as Record<string, EquipmentDef>,
      []
  );
  const assignedEquipment = equipmentAssignmentsByFloor[activeFloor] ?? {};
  const assignedCount = Object.values(assignedEquipment).reduce((count, items) => count + items.length, 0);

  const handleSaveLayout = (onSaved?: () => void) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ floors: equipmentAssignmentsByFloor }));
    }
    setHasUnsavedChanges(false);
    onSaved?.();
  };

  const handleToggleEditMode = () => {
    if (!isEditMode) { setIsEditMode(true); return; }
    if (hasUnsavedChanges && assignedCount > 0) { setShowUnsavedConfirm(true); return; }
    setIsEditMode(false);
  };

  const handleSaveAndExit = (onSaved?: () => void) => {
    handleSaveLayout(onSaved);
    setIsEditMode(false);
    setShowUnsavedConfirm(false);
  };

  const handleConfirmCellDelete = () => {
    if (!deleteTarget) return;
    setEquipmentAssignmentsByFloor((prev) => {
      const nextFloorAssignments = { ...(prev[activeFloor] ?? {}) };
      const currentItems = nextFloorAssignments[deleteTarget.venueMapId] ?? [];
      const nextItems = currentItems.filter((itemId, index) => itemId !== deleteTarget.equipmentId || index !== currentItems.indexOf(deleteTarget.equipmentId));
      if (nextItems.length === 0) {
        delete nextFloorAssignments[deleteTarget.venueMapId];
      } else {
        nextFloorAssignments[deleteTarget.venueMapId] = nextItems;
      }
      return { ...prev, [activeFloor]: nextFloorAssignments };
    });
    setHasUnsavedChanges(true);
    setDeleteTarget(null);
  };

  const handleClearFloor = () => {
    if (!isEditMode) return;
    setEquipmentAssignmentsByFloor((prev) => ({ ...prev, [activeFloor]: {} }));
    setHasUnsavedChanges(true);
  };

  const handleExport = (name: string, type: string, size: string) => {
    const payload = {
      layoutName: name,
      layoutType: type,
      gridSize: size,
      rows: ROWS,
      cols: COLS,
      activeFloor,
      floors: equipmentAssignmentsByFloor
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fittrack-layout-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const assignEquipmentToVenue = (equipmentId: string, venueMapId: string) => {
    setEquipmentAssignmentsByFloor((prev) => {
      const nextFloorAssignments = { ...(prev[activeFloor] ?? {}) };
      const currentItems = nextFloorAssignments[venueMapId] ?? [];
      nextFloorAssignments[venueMapId] = currentItems.includes(equipmentId)
        ? currentItems
        : [...currentItems, equipmentId];
      return { ...prev, [activeFloor]: nextFloorAssignments };
    });
    setHasUnsavedChanges(true);
  };

  return {
    activeFloor,
    setActiveFloor,
    isEditMode,
    hasUnsavedChanges,
    showUnsavedConfirm,
    setShowUnsavedConfirm,
    layoutName,
    setLayoutName,
    layoutType,
    setLayoutType,
    gridSize,
    setGridSize,
    deleteTarget,
    setDeleteTarget,
    assignedEquipment,
    equipmentAssignmentsByFloor,
    equipmentById,
    assignedCount,
    handleSaveLayout,
    handleToggleEditMode,
    handleSaveAndExit,
    handleConfirmCellDelete,
    handleClearFloor,
    handleExport,
    assignEquipmentToVenue
  };
}
