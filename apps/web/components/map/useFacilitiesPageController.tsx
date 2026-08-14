"use client";

import { useEffect, useMemo, useState } from "react";
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
import { buildVenueInitialValues } from "@/app/(auth)/facilities/helpers";
import type { VenueRecord } from "@/components/map";
import {
  useVenueMutations,
  useFloorLayout,
  type QuickFloorRegionTemplate,
} from "@/hooks/facilities/useFacilities";
import {
  FACILITY_FLOOR_MAP,
  buildFacilityFloorVenues,
  type FloorVenueRecord,
} from "@/data/facilities/floorPlans";
import { COLS, ROWS } from "@/data/facilities/mapTypes";

const QUICK_FLOOR_REGION_TEMPLATES: QuickFloorRegionTemplate[] = [
  {
    key: "general-floor",
    name: "General Floor",
    description:
      "Flexible open training space for circuits, bodyweight work, and coach-led movement blocks.",
    iconKey: "gym-area",
    gridWidth: 4,
    gridHeight: 2,
    capacity: 10,
  },
  {
    key: "dumbbell-area",
    name: "Dumbbell Area",
    description:
      "Dedicated free-weight zone that pairs well with nearby strength equipment placements.",
    iconKey: "gym-area",
    gridWidth: 3,
    gridHeight: 2,
    capacity: 8,
  },
  {
    key: "functional-zone",
    name: "Functional Zone",
    description:
      "Multi-use room tile for stretching, recovery, or small-group functional training.",
    iconKey: "yoga",
    gridWidth: 3,
    gridHeight: 2,
    capacity: 6,
  },
  {
    key: "walkway",
    name: "Path / Walkway",
    description:
      "Built-in circulation path for keeping equipment access clear without consuming inventory.",
    iconKey: "gym-area",
    gridWidth: 2,
    gridHeight: 1,
    capacity: 1,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
  const [quickPlacementTemplateKey, setQuickPlacementTemplateKey] = useState<
    string | null
  >(null);

  const {
    venues,
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
    handleCreateQuickFloorRegion,
    handleCreateQuickFloorRegionAt,
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
  const activeFloorConfig = FACILITY_FLOOR_MAP[activeFloor];
  const activeFloorLabel = activeFloorConfig.label;
  const activeFloorVenues = floorVenues[activeFloor];
  const quickPlacementTemplate = useMemo(
    () =>
      QUICK_FLOOR_REGION_TEMPLATES.find(
        (template) => template.key === quickPlacementTemplateKey,
      ) ?? null,
    [quickPlacementTemplateKey],
  );

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

    const liveVenueKey = String(movingVenue.sourceVenueId ?? movingVenue.id);
    const hasContainedEquipment = liveEquipment.some(
      (item) =>
        item.venueId === liveVenueKey ||
        isEquipmentInsideVenue(item, movingVenue),
    );
    if (hasContainedEquipment) {
      showVenueMessage(
        "Move equipment out of this venue before moving the venue itself.",
      );
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
    setQuickPlacementTemplateKey(null);
    setSelectedEquipmentId(equipmentId);
    void assignEquipmentToVenue(equipmentId, venueMapId, preferredCell);
  };

  const handleMoveEquipmentFromCanvas = (
    equipmentId: string,
    venueMapId: string,
    placement: { gridColumn: number; gridRow: number },
  ) => {
    if (!isEditMode) {
      return;
    }

    void updateEquipmentPlacement(equipmentId, venueMapId, placement);
  };

  const handleCreateQuickFloorRegionAtFromCanvas = (
    template: QuickFloorRegionTemplate,
    placement: { gridColumn: number; gridRow: number },
  ) => {
    void handleCreateQuickFloorRegionAt(template, activeFloor, placement).then(
      (created) => {
        if (created) setQuickPlacementTemplateKey(null);
      },
    );
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

    const isAbsoluteLayout = "gridWidth" in resize;
    const nextGridWidth = clamp(
      isAbsoluteLayout ? resize.gridWidth : currentGridWidth + resize.width,
      2,
      COLS,
    );
    const nextGridHeight = clamp(
      isAbsoluteLayout ? resize.gridHeight : currentGridHeight + resize.height,
      2,
      ROWS,
    );
    const nextGridColumn = clamp(
      isAbsoluteLayout ? resize.gridColumn : currentGridColumn,
      1,
      COLS - nextGridWidth + 1,
    );
    const nextGridRow = clamp(
      isAbsoluteLayout ? resize.gridRow : currentGridRow,
      1,
      ROWS - nextGridHeight + 1,
    );

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

    setSelectedFloorVenue(nextVenueBounds);
    return handleUpdateVenueLayout(liveVenue, {
      floorId: activeFloor,
      gridColumn: nextGridColumn,
      gridRow: nextGridRow,
      gridWidth: nextGridWidth,
      gridHeight: nextGridHeight,
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
    setQuickPlacementTemplateKey(null);
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
    setQuickPlacementTemplateKey(null);
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

  const handleToggleQuickPlacementTemplate = (
    template: QuickFloorRegionTemplate,
  ) => {
    if (!isEditMode) return;
    setSelectedEquipmentId(null);
    setSelectedFloorVenue(null);
    setQuickPlacementTemplateKey((current) =>
      current === template.key ? null : template.key,
    );
  };

  const handleAddQuickRegion = (template: QuickFloorRegionTemplate) => {
    if (!isEditMode) return;
    setQuickPlacementTemplateKey(null);
    void handleCreateQuickFloorRegion(template, activeFloor);
  };

  const handleClearCanvasPlacement = () => {
    setSelectedEquipmentId(null);
    setQuickPlacementTemplateKey(null);
  };

  const venueInitialValues = buildVenueInitialValues(venueEditTarget);
  const combinedMessage = message || layoutMessage || venueMessage;
  const isVenueEditorOpen = activeTab === "venues" && venueEditorMode !== null;
  const handleCloseVenueEditor = () => {
    setVenueEditorMode(null);
    setVenueEditTarget(null);
    setActiveTab(venueEditorReturnTab);
  };

  const handleOpenVenueEditor = (
    mode: "create" | "edit",
    venue: VenueRecord | null = null,
  ) => {
    setVenueEditorReturnTab(activeTab);
    setActiveTab("venues");
    setVenueEditTarget(venue);
    setVenueEditorMode(mode);
  };

  const handleOpenMap = () => {
    setSelectedFloorVenue(null);
    setActiveTab("floor");
    setVenueEditorMode(null);
    setVenueEditTarget(null);
  };

  return {
    activeTab,
    activeFloor,
    activeFloorConfig,
    activeFloorImageUrl,
    activeFloorBounds,
    activeFloorLabel,
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
    handleCreateQuickFloorRegionAtFromCanvas,
    handleAddQuickRegion,
    handleClearCanvasPlacement,
    handleToggleQuickPlacementTemplate,
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
    hasUnsavedChanges,
    isCompact,
    isEditMode,
    isVenueEditorOpen,
    isVenueSubmitting,
    liveEquipment,
    quickPlacementTemplate,
    quickPlacementTemplateKey,
    quickRegionTemplates: QUICK_FLOOR_REGION_TEMPLATES,
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
