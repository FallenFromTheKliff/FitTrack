"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { api } from "@/lib/axios";

import { COLS, ROWS, LAYOUT_KEY, EQUIPMENT } from "@/data/facilities/mapTypes";
import type { VenueRecord, PlacedMap, EquipmentDef } from "@/data/facilities/mapTypes";
import type { FacilityFloorId } from "@/data/facilities/floorPlans";

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

  const { data: venues = [], isLoading: venuesLoading } = useQuery<VenueRecord[]>({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data } = await api.get<VenueRecord[]>("/venues?active=true");
      return data;
    }
  });

  const createVenueMutation = useMutation({
    mutationFn: async (payload: VenuePayload) => {
      await api.post("/admin/venues", payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["venues"] }); }
  });

  const updateVenueMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: VenuePayload }) => {
      await api.patch(`/admin/venues/${id}`, payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["venues"] }); }
  });

  const deleteVenueMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/venues/${id}`);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["venues"] }); }
  });

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
  const [deleteTargetCell, setDeleteTargetCell] = useState<string | null>(null);
  const [placedItemsByFloor, setPlacedItemsByFloor] = useState<Record<FacilityFloorId, PlacedMap>>(() => {
    if (typeof window === "undefined") return { "floor-1": {}, "floor-2": {} };
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) {
        return { "floor-1": {}, "floor-2": {} };
      }
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && "floors" in parsed) {
        const floors = (parsed as { floors?: Partial<Record<FacilityFloorId, PlacedMap>> }).floors;
        return {
          "floor-1": floors?.["floor-1"] ?? {},
          "floor-2": floors?.["floor-2"] ?? {}
        };
      }
      return { "floor-1": parsed as PlacedMap, "floor-2": {} };
    } catch {
      return { "floor-1": {}, "floor-2": {} };
    }
  });

  const equipmentById = useMemo(
      () => Object.fromEntries(EQUIPMENT.map((item) => [item.id, item])) as Record<string, EquipmentDef>,
      []
  );
  const placedItems = placedItemsByFloor[activeFloor] ?? {};
  const placedCount = Object.keys(placedItems).length;

  const handleSaveLayout = (onSaved?: () => void) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ floors: placedItemsByFloor }));
    }
    setHasUnsavedChanges(false);
    onSaved?.();
  };

  const handleToggleEditMode = () => {
    if (!isEditMode) { setIsEditMode(true); return; }
    if (hasUnsavedChanges && placedCount > 0) { setShowUnsavedConfirm(true); return; }
    setIsEditMode(false);
  };

  const handleSaveAndExit = (onSaved?: () => void) => {
    handleSaveLayout(onSaved);
    setIsEditMode(false);
    setShowUnsavedConfirm(false);
  };

  const handleConfirmCellDelete = () => {
    if (!deleteTargetCell) return;
    setPlacedItemsByFloor((prev) => {
      const nextFloorItems = { ...(prev[activeFloor] ?? {}) };
      delete nextFloorItems[deleteTargetCell];
      return { ...prev, [activeFloor]: nextFloorItems };
    });
    setHasUnsavedChanges(true);
    setDeleteTargetCell(null);
  };

  const handleClearFloor = () => {
    if (!isEditMode) return;
    setPlacedItemsByFloor((prev) => ({ ...prev, [activeFloor]: {} }));
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
      floors: placedItemsByFloor
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

  const placeDraggedItem = (equipmentId: string, cellId: string, sourceCellId?: string) => {
    setPlacedItemsByFloor((prev) => {
      const nextFloorItems = { ...(prev[activeFloor] ?? {}) };
      if (sourceCellId?.startsWith("cell-")) delete nextFloorItems[sourceCellId];
      nextFloorItems[cellId] = equipmentId;
      return { ...prev, [activeFloor]: nextFloorItems };
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
    deleteTargetCell,
    setDeleteTargetCell,
    placedItems,
    placedItemsByFloor,
    equipmentById,
    placedCount,
    handleSaveLayout,
    handleToggleEditMode,
    handleSaveAndExit,
    handleConfirmCellDelete,
    handleClearFloor,
    handleExport,
    placeDraggedItem
  };
}
