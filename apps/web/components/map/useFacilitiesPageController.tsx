"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { VenueBookingRecord } from "@fittrack/api-client";
import { useDebounce, useTimedMessage } from "@fittrack/hooks";
import { adminBookingsQueryOptions } from "@fittrack/query";
import {
  isEquipmentInsideVenue,
  resolveEquipmentGridPlacement,
} from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useSectionTransition } from "@/hooks/animations/useSectionTransition";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { facilitiesMapStyles } from "@/styles/pageStyles";
import { webApiClient } from "@/lib/api-client";
import { getBrowserViewportState } from "@/utils/browserViewport";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import {
  buildVenueCreateOpenSnapshot,
  buildVenueInitialValues,
} from "@/app/(auth)/facilities/helpers";
import type { VenueRecord } from "@/components/map";
import {
  useVenueMutations,
  useFloorLayout,
} from "@/hooks/facilities/useFacilities";
import {
  FACILITY_FLOOR_MAP,
  buildFacilityFloorVenues,
  type FloorVenueRecord,
} from "@/data/facilities/floorPlans";
import {
  persistVenueLayoutSelection,
  resolveVenueResizeLayout,
} from "./facilityVenueLayout";

export function useFacilitiesPageController() {
  const { colors } = useTheme();
  const fs = facilitiesMapStyles(colors);
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const [activeTab, setActiveTab] = useState<"floor" | "venues">("floor");
  const { message, showMessage } = useTimedMessage(
    FEEDBACK_DURATION_MS.standard,
  );
  const { style: viewSlideStyle } = useSectionTransition(activeTab, {
    duration: 110,
    fromY: 0,
  });
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(
    null,
  );
  const [pendingSavedVenuePlacement, setPendingSavedVenuePlacement] =
    useState<FloorVenueRecord | null>(null);
  const savedVenuePlacementInFlightRef = useRef<string | null>(null);

  const {
    venues,
    venuesReady,
    venuesError,
    refetchVenues,
    archivedVenues,
    archivedVenuesError,
    refetchArchivedVenues,
    venuesLoading,
    archivedVenuesLoading,
    isVenueSubmitting,
    venueSavingLabel,
    deleteVenueMutation,
    restoreVenueMutation,
    message: venueMessage,
    showMessage: showVenueMessage,
    handleVenueSubmit,
    handleDeleteVenue,
    handleRestoreVenue,
    handleUploadVenueImage,
    handleUpdateVenueLayout,
    toggleVenueMaintenance,
  } = useVenueMutations();

  const {
    activeFloor,
    setActiveFloor,
    isEditMode,
    hasUnsavedChanges,
    assignedEquipment,
    activeFloorImageUrl,
    activeFloorBounds,
    cellDraft,
    cellDraftReady,
    cellMapSaving,
    lastMutationFailure,
    archivedEquipment,
    archivedEquipmentError,
    refetchArchivedEquipment,
    archivedEquipmentLoading,
    availableEquipment,
    inventoryEquipment,
    equipmentRemainingById,
    equipmentById,
    deleteEquipmentMutation,
    restoreEquipmentMutation,
    equipmentPlacementPending,
    message: layoutMessage,
    handleToggleEditMode,
    updateCellMapDraft,
    applyCellMapDraft,
    handleRemoveEquipmentFromCanvas,
    handleRestoreEquipment,
    handleUploadFloorPlanImage,
    handleResizeFloorBounds,
    handleUpdateInventoryEquipmentFromFacilities,
    updateFloorPlanMediaMutation,
    updateInventoryEquipmentMutation,
    assignEquipmentToVenue,
    liveEquipment,
    updateEquipmentPlacement,
    toggleEquipmentMaintenance,
  } = useFloorLayout();

  const [venueEditorMode, setVenueEditorMode] = useState<
    "create" | "edit" | null
  >(null);
  const [venueEditorReturnTab, setVenueEditorReturnTab] = useState<
    "floor" | "venues"
  >("venues");
  const [venueCreateInitialValues, setVenueCreateInitialValues] = useState<Record<string, string> | null>(null);
  const [pendingCreateVenueOpen, setPendingCreateVenueOpen] = useState(false);
  const [venueEditTarget, setVenueEditTarget] = useState<VenueRecord | null>(
    null,
  );
  const [venueDeleteTarget, setVenueDeleteTarget] =
    useState<VenueRecord | null>(null);
  const [selectedFloorVenue, setSelectedFloorVenue] =
    useState<FloorVenueRecord | null>(null);
  const [deleteHasReservations, setDeleteHasReservations] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<
    "all" | "venues" | "equipment"
  >("all");

  const venuePlacementDataReady =
    venuesReady && cellDraftReady && cellDraft.floorId === activeFloor;
  useEffect(() => {
    if (!pendingCreateVenueOpen || !venuePlacementDataReady) return;
    setVenueCreateInitialValues(
      buildVenueCreateOpenSnapshot({
        dataReady: true,
        entryCells: cellDraft.entryCells,
        exitCells: cellDraft.exitCells,
        floorId: activeFloor,
        footprintCells: cellDraft.footprintCells,
        pathCells: cellDraft.pathCells,
        venues,
      }),
    );
    setPendingCreateVenueOpen(false);
    setVenueEditTarget(null);
    setVenueEditorMode("create");
  }, [
    activeFloor,
    cellDraft,
    pendingCreateVenueOpen,
    venues,
    venuePlacementDataReady,
  ]);

  const {
    data: activeBookings = [],
    error: activeBookingsError,
    isLoading: activeBookingsLoading,
  } = useQuery({
    ...adminBookingsQueryOptions<VenueBookingRecord>(webApiClient),
    select: (bookings) =>
      bookings.filter(
        (booking) =>
          booking.status === "confirmed" ||
          booking.status === "balance_pending",
      ),
  });

  const [rawViewportMode, setRawViewportMode] = useState({
    isHamburgerMode: false,
    width: 0,
  });
  const debouncedViewportMode = useDebounce(rawViewportMode, 120);
  const isCompact = debouncedViewportMode.isHamburgerMode;

  useEffect(() => {
    const evaluate = () => {
      const { isBrowserWindowResized, viewportWidth } =
        getBrowserViewportState();

      setRawViewportMode({
        isHamburgerMode: isBrowserWindowResized || viewportWidth < 1024,
        width: viewportWidth,
      });
    };
    evaluate();
    window.addEventListener("resize", evaluate);
    window.visualViewport?.addEventListener("resize", evaluate);
    return () => {
      window.removeEventListener("resize", evaluate);
      window.visualViewport?.removeEventListener("resize", evaluate);
    };
  }, []);

  const handleDeleteVenueRequest = (venue: VenueRecord) => {
    const hasActive = activeBookings.some(
      (booking) => booking.venueId === venue.id,
    );
    setDeleteHasReservations(hasActive);
    setVenueDeleteTarget(venue);
  };

  const floorVenues = useMemo(() => buildFacilityFloorVenues(venues), [venues]);
  const managementFloorVenues = useMemo(
    () => buildFacilityFloorVenues(venues, { includeUnmapped: true }),
    [venues],
  );
  const activeFloorConfig = FACILITY_FLOOR_MAP[activeFloor];
  const activeFloorLabel = activeFloorConfig.label;
  const activeFloorVenues = floorVenues[activeFloor];
  const activeFloorManagementVenues = managementFloorVenues[activeFloor];
  const unmappedVenueAssets = useMemo(
    () =>
      Object.values(managementFloorVenues)
        .flat()
        .filter((venue) => venue.isMapped === false && !venue.isSystem)
        .sort(
          (left, right) =>
            (left.displayOrder ?? 0) - (right.displayOrder ?? 0) ||
            left.name.localeCompare(right.name),
        ),
    [managementFloorVenues],
  );

  useEffect(() => {
    if (!pendingSavedVenuePlacement) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPendingSavedVenuePlacement(null);
      showVenueMessage("Saved venue placement cancelled.");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingSavedVenuePlacement, showVenueMessage]);

  const selectedEquipmentName =
    availableEquipment.find((item) => item.id === selectedEquipmentId)?.name ??
    null;
  const handleMoveVenueFromCanvas = async (
    venueMapId: string,
    placement: { gridColumn: number; gridRow: number },
  ) => {
    if (!isEditMode) {
      return false;
    }

    const movingVenue = activeFloorVenues.find(
      (candidate) => candidate.mapId === venueMapId,
    );
    if (!movingVenue) {
      return false;
    }

    const liveVenueId = movingVenue.sourceVenueId ?? movingVenue.id;
    const liveVenue = venues.find(
      (candidate) => String(candidate.id) === String(liveVenueId),
    );
    if (!liveVenue || liveVenue.isSystem) {
      return false;
    }

    const moved = await handleUpdateVenueLayout(liveVenue, {
      floorId: activeFloor,
      gridColumn: placement.gridColumn,
      gridRow: placement.gridRow,
    });
    if (!moved) return false;

    setSelectedFloorVenue({
      ...movingVenue,
      gridColumn: placement.gridColumn,
      gridRow: placement.gridRow,
    });
    return true;
  };

  const handleAssignEquipmentFromCanvas = (
    equipmentId: string,
    venueMapId: string,
    preferredCell?: { gridColumn: number; gridRow: number },
  ) => {
    setPendingSavedVenuePlacement(null);
    setSelectedEquipmentId(equipmentId);
    void assignEquipmentToVenue(equipmentId, venueMapId, preferredCell);
  };

  const handleMoveEquipmentFromCanvas = (
    equipmentId: string,
    venueMapId: string,
    placement: { gridColumn: number; gridRow: number },
  ) => {
    if (!isEditMode) {
      return false;
    }

    return updateEquipmentPlacement(equipmentId, venueMapId, placement);
  };

  const handleToggleSavedVenuePlacement = (venue: FloorVenueRecord) => {
    if (!isEditMode || venue.isMapped !== false || venue.isSystem) return;
    setSelectedEquipmentId(null);
    setSelectedFloorVenue(null);
    setPendingSavedVenuePlacement((current) =>
      current?.mapId === venue.mapId ? null : venue,
    );
  };

  const handlePlaceSavedVenueAtCell = async (
    candidate: FloorVenueRecord,
    placement: { gridColumn: number; gridRow: number },
  ) => {
    if (
      !isEditMode ||
      pendingSavedVenuePlacement?.mapId !== candidate.mapId ||
      savedVenuePlacementInFlightRef.current
    ) {
      return false;
    }

    const liveVenueId = candidate.sourceVenueId ?? candidate.id;
    const liveVenue = venues.find(
      (venue) => String(venue.id) === String(liveVenueId),
    );
    if (!liveVenue || liveVenue.isMapped !== false || liveVenue.isSystem) {
      showVenueMessage("This saved venue is no longer available for placement.");
      setPendingSavedVenuePlacement(null);
      return false;
    }

    savedVenuePlacementInFlightRef.current = String(liveVenue.id);
    try {
      const placed = await handleUpdateVenueLayout(liveVenue, {
        floorId: activeFloor,
        gridColumn: placement.gridColumn,
        gridRow: placement.gridRow,
        isMapped: true,
      });
      if (!placed) return false;

      setPendingSavedVenuePlacement(null);
      setSelectedFloorVenue({
        ...candidate,
        floorId: activeFloor,
        gridColumn: placement.gridColumn,
        gridRow: placement.gridRow,
        isMapped: true,
      });
      showVenueMessage(`${liveVenue.name} placed on ${activeFloorLabel}.`);
      return true;
    } finally {
      savedVenuePlacementInFlightRef.current = null;
    }
  };

  const handleResizeRegionByMapId = async (
    venueMapId: string,
    resize:
      | { width: number; height: number }
      | {
          gridColumn: number;
          gridHeight: number;
          gridRow: number;
          gridWidth: number;
        },
  ) => {
    const targetVenue = activeFloorVenues.find(
      (candidate) => candidate.mapId === venueMapId,
    );
    if (!targetVenue) {
      return false;
    }

    const liveVenueId = targetVenue.sourceVenueId ?? targetVenue.id;
    const liveVenue = venues.find(
      (candidate) => String(candidate.id) === String(liveVenueId),
    );
    if (!liveVenue || liveVenue.isSystem) {
      return false;
    }

    const currentGridWidth = Math.max(
      1,
      targetVenue.gridWidth ?? liveVenue.gridWidth ?? 2,
    );
    const currentGridHeight = Math.max(
      1,
      targetVenue.gridHeight ?? liveVenue.gridHeight ?? 2,
    );
    const currentGridColumn =
      targetVenue.gridColumn ?? liveVenue.gridColumn ?? 1;
    const currentGridRow = targetVenue.gridRow ?? liveVenue.gridRow ?? 1;

    const nextLayout = resolveVenueResizeLayout(
      {
        gridColumn: currentGridColumn,
        gridHeight: currentGridHeight,
        gridRow: currentGridRow,
        gridWidth: currentGridWidth,
      },
      resize,
    );
    const {
      gridColumn: nextGridColumn,
      gridHeight: nextGridHeight,
      gridRow: nextGridRow,
      gridWidth: nextGridWidth,
    } = nextLayout;

    const nextVenueBounds: FloorVenueRecord = {
      ...targetVenue,
      gridColumn: nextGridColumn,
      gridHeight: nextGridHeight,
      gridRow: nextGridRow,
      gridWidth: nextGridWidth,
    };
    const liveVenueKey = String(targetVenue.sourceVenueId ?? targetVenue.id);
    const equipmentOutsideNextBounds = liveEquipment.some((item) => {
      const belongsToVenue =
        item.venueId === liveVenueKey ||
        isEquipmentInsideVenue(item, targetVenue);
      if (!belongsToVenue) return false;
      const placement = resolveEquipmentGridPlacement(item);
      return !isEquipmentInsideVenue(
        {
          ...item,
          gridColumn: placement.gridColumn,
          gridRow: placement.gridRow,
        },
        nextVenueBounds,
      );
    });
    if (equipmentOutsideNextBounds) {
      showVenueMessage(
        "Move mapped equipment inside the proposed venue bounds before shrinking it.",
      );
      return false;
    }

    return persistVenueLayoutSelection({
      next: nextVenueBounds,
      previous: targetVenue,
      select: setSelectedFloorVenue,
      persist: () => handleUpdateVenueLayout(liveVenue, {
        floorId: activeFloor,
        gridColumn: nextGridColumn,
        gridRow: nextGridRow,
        gridWidth: nextGridWidth,
        gridHeight: nextGridHeight,
      }),
    });
  };

  const resolveLiveVenueByMapId = (venueMapId: string) => {
    const floorVenue = activeFloorVenues.find(
      (candidate) => candidate.mapId === venueMapId,
    );
    if (!floorVenue) {
      return null;
    }

    const liveVenueId = floorVenue.sourceVenueId ?? floorVenue.id;
    return (
      venues.find(
        (candidate) => String(candidate.id) === String(liveVenueId),
      ) ?? null
    );
  };

  const handleRemoveVenueFromCanvas = async (venueMapId: string) => {
    const liveVenue = resolveLiveVenueByMapId(venueMapId);
    if (!liveVenue) {
      showVenueMessage("This venue is no longer available on the map.");
      return false;
    }
    if (liveVenue.isSystem) {
      showVenueMessage("Core floor-plan regions cannot be removed.");
      return false;
    }

    const removed = await handleUpdateVenueLayout(
      liveVenue,
      { isMapped: false },
      { silent: true },
    );
    if (!removed) {
      showVenueMessage("Unable to remove this venue from the map.");
      return false;
    }

    setSelectedFloorVenue(null);
    showVenueMessage(
      liveVenue.name +
        " removed from the map. Its venue record remains available.",
    );
    return true;
  };

  const handleOpenEquipmentPanel = () => {
    setPendingSavedVenuePlacement(null);
  };

  const handleOpenEquipmentManager = () => {
    setActiveTab("floor");
    setVenueEditorMode(null);
    setVenueEditTarget(null);
    if (!isEditMode) {
      handleToggleEditMode();
    }
    window.setTimeout(handleOpenEquipmentPanel, 0);
  };

  const handlePlaceEquipmentFromManager = (equipmentId: string) => {
    setPendingSavedVenuePlacement(null);
    setSelectedEquipmentId(equipmentId);
    setSelectedFloorVenue(null);
    setActiveTab("floor");
    if (!isEditMode) {
      handleToggleEditMode();
    }
    showVenueMessage(
      "Equipment selected. Drag it from Available Equipment onto a venue tile.",
    );
    window.setTimeout(handleOpenEquipmentPanel, 0);
  };

  const handleClearCanvasPlacement = () => {
    setSelectedEquipmentId(null);
    setPendingSavedVenuePlacement(null);
  };

  const venueInitialValues = useMemo(
    () => venueEditTarget
      ? buildVenueInitialValues(venueEditTarget)
      : venueCreateInitialValues ?? buildVenueInitialValues(null),
    [venueCreateInitialValues, venueEditTarget],
  );
  const combinedMessage = message || layoutMessage || venueMessage;
  const isVenueEditorOpen = activeTab === "venues" && venueEditorMode !== null;
  const handleCloseVenueEditor = () => {
    setVenueEditorMode(null);
    setVenueEditTarget(null);
    setVenueCreateInitialValues(null);
    setPendingCreateVenueOpen(false);
    setActiveTab(venueEditorReturnTab);
  };

  const handleOpenVenueEditor = (
    mode: "create" | "edit",
    venue: VenueRecord | null = null,
  ) => {
    setPendingSavedVenuePlacement(null);
    setVenueEditorReturnTab(activeTab);
    setActiveTab("venues");
    setVenueEditTarget(venue);
    if (mode === "create" && !venuePlacementDataReady) {
      setVenueCreateInitialValues(null);
      setPendingCreateVenueOpen(true);
      setVenueEditorMode(null);
      showVenueMessage("Loading the selected floor map before opening venue placement…");
      return;
    }
    setPendingCreateVenueOpen(false);
    setVenueCreateInitialValues(
      mode === "create"
        ? buildVenueCreateOpenSnapshot({
            dataReady: true,
            entryCells: cellDraft.entryCells,
            exitCells: cellDraft.exitCells,
            floorId: activeFloor,
            footprintCells: cellDraft.footprintCells,
            pathCells: cellDraft.pathCells,
            venues,
          })
        : null,
    );
    setVenueEditorMode(mode);
  };

  const handleOpenMap = () => {
    setSelectedFloorVenue(null);
    setActiveTab("floor");
    setVenueEditorMode(null);
    setVenueEditTarget(null);
    setVenueCreateInitialValues(null);
    setPendingCreateVenueOpen(false);
    setPendingSavedVenuePlacement(null);
  };

  return {
    activeTab,
    activeFloor,
    activeFloorConfig,
    activeFloorImageUrl,
    activeFloorBounds,
    cellDraft,
    cellDraftReady,
    cellMapSaving,
    lastMutationFailure,
    activeFloorLabel,
    activeFloorManagementVenues,
    activeFloorVenues,
    archivedEquipment,
    archivedEquipmentError,
    refetchArchivedEquipment,
    archivedEquipmentLoading,
    archivedVenues,
    archivedVenuesError,
    refetchArchivedVenues,
    archivedVenuesLoading,
    archiveFilter,
    archiveModalOpen,
    combinedMessage,
    colors,
    assignedEquipment,
    deleteHasReservations,
    deleteEquipmentMutation,
    deleteVenueMutation,
    equipmentById,
    equipmentRemainingById,
    availableEquipment,
    inventoryEquipment,
    fadeIn,
    fs,
    handleCloseVenueEditor,
    handleRemoveEquipmentFromCanvas,
    handleRemoveVenueFromCanvas,
    handleResizeRegionByMapId,
    handleResizeFloorBounds,
    handleUpdateInventoryEquipmentFromFacilities,
    handleDeleteVenue,
    handleDeleteVenueRequest,
    handleAssignEquipmentFromCanvas,
    handleClearCanvasPlacement,
    handlePlaceSavedVenueAtCell,
    handleToggleSavedVenuePlacement,
    handleOpenEquipmentManager,
    handleOpenEquipmentPanel,
    handleOpenMap,
    handleOpenVenueEditor,
    handlePlaceEquipmentFromManager,
    handleMoveVenueFromCanvas,
    handleMoveEquipmentFromCanvas,
    toggleEquipmentMaintenance,
    toggleVenueMaintenance,
    handleRestoreEquipment,
    handleRestoreVenue,
    handleVenueSubmit,
    handleUploadFloorPlanImage,
    handleUploadVenueImage,
    handleToggleEditMode,
    updateCellMapDraft,
    applyCellMapDraft,
    hasUnsavedChanges,
    isCompact,
    isEditMode,
    isVenueEditorOpen,
    isVenueSubmitting,
    liveEquipment,
    pendingSavedVenuePlacement,
    selectedEquipmentId,
    selectedEquipmentName,
    selectedFloorVenue,
    setActiveTab,
    setActiveFloor,
    setArchiveFilter,
    setArchiveModalOpen,
    setDeleteHasReservations,
    setSelectedEquipmentId,
    setSelectedFloorVenue,
    showMessage,
    showVenueMessage,
    themeTransition,
    restoreEquipmentMutation,
    restoreVenueMutation,
    equipmentPlacementPending,
    updateFloorPlanMediaMutation,
    updateInventoryEquipmentMutation,
    venueDeleteTarget,
    venueEditTarget,
    venueEditorReturnTab,
    venueInitialValues,
    venueSavingLabel,
    venues,
    unmappedVenueAssets,
    venuesError,
    refetchVenues,
    activeBookings,
    activeBookingsError,
    activeBookingsLoading,
    venuesLoading,
    viewSlideStyle,
    setVenueDeleteTarget,
    setVenueEditTarget,
    setVenueEditorMode,
  } as const;
}

export type FacilitiesPageController = ReturnType<
  typeof useFacilitiesPageController
>;
