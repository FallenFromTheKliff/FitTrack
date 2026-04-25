"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { VenueBookingRecord } from "@fittrack/api-client";
import { useDebounce, useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { adminBookingsQueryOptions } from "@fittrack/query";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { usePowerSlide } from "@/hooks/animations/usePowerSlide";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { FitText } from "@/components/fit/FitText";
import { facilitiesMapStyles } from "@/styles/pageStyles";
import { webApiClient } from "@/lib/api-client";
import { sleep } from "@/utils/sleep";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import type { ScheduleResource } from "@/data/facilities/resources";
import {
  buildVenueInitialValues,
  createScheduleResourceId,
  getDefaultResourceDraft,
  isCompactViewport,
} from "@/app/(admin)/facilities/helpers";
import {
  EquipmentPanel,
  FloorPlanPanel,
  LayoutEditorPanel,
  LayoutStatusPanel,
  QuickRegionPanel,
  QuickRegionSummaryCard,
} from "@/components/map";
import type { VenueRecord } from "@/components/map";
import {
  useVenueMutations,
  useFloorLayout,
  type QuickFloorRegionTemplate,
} from "@/hooks/facilities/useFacilities";
import {
  FACILITY_FLOOR_MAP,
  buildFacilityFloorVenues,
  type FacilityFloorId,
  type FloorVenueRecord,
} from "@/data/facilities/floorPlans";
import { COLS, ROWS } from "@/data/facilities/mapTypes";

const QUICK_FLOOR_REGION_TEMPLATES: QuickFloorRegionTemplate[] = [
  {
    key: "general-floor",
    name: "General Floor",
    description: "Flexible open training space for circuits, bodyweight work, and coach-led movement blocks.",
    iconKey: "gym-area",
    gridWidth: 4,
    gridHeight: 2,
    capacity: 10,
  },
  {
    key: "dumbbell-area",
    name: "Dumbbell Area",
    description: "Dedicated free-weight zone that pairs well with nearby strength equipment placements.",
    iconKey: "gym-area",
    gridWidth: 3,
    gridHeight: 2,
    capacity: 8,
  },
  {
    key: "functional-zone",
    name: "Functional Zone",
    description: "Multi-use room tile for stretching, recovery, or small-group functional training.",
    iconKey: "yoga",
    gridWidth: 3,
    gridHeight: 2,
    capacity: 6,
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
  const [viewMotionKey, setViewMotionKey] = useState(0);
  const [viewMotionDirection, setViewMotionDirection] = useState<"left" | "right">("right");
  const { message, showMessage } = useTimedMessage(FEEDBACK_DURATION_MS.standard);
  const { style: viewSlideStyle } = usePowerSlide(viewMotionKey, viewMotionDirection);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [quickPlacementTemplateKey, setQuickPlacementTemplateKey] = useState<string | null>(null);

  const {
    venues,
    archivedVenues,
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
    handleCreateQuickFloorRegion,
    handleCreateQuickFloorRegionAt,
    handleUpdateVenueLayout,
  } = useVenueMutations();

  const {
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
    deleteTarget,
    setDeleteTarget,
    assignedEquipment,
    archivedEquipment,
    archivedEquipmentLoading,
    availableEquipment,
    equipmentRemainingById,
    equipmentById,
    assignedCount,
    deleteEquipmentMutation,
    restoreEquipmentMutation,
    message: layoutMessage,
    handleSaveLayout,
    handleToggleEditMode,
    handleSaveAndExit,
    handleConfirmCellDelete,
    handleRequestClearFloor,
    handleClearFloor,
    handleRestoreEquipment,
    assignEquipmentToVenue,
  } = useFloorLayout();

  const [venueEditorMode, setVenueEditorMode] = useState<"create" | "edit" | null>(null);
  const [venueEditTarget, setVenueEditTarget] = useState<VenueRecord | null>(null);
  const [venueDeleteTarget, setVenueDeleteTarget] = useState<VenueRecord | null>(null);
  const [selectedFloorVenue, setSelectedFloorVenue] = useState<FloorVenueRecord | null>(null);
  const [deleteHasReservations, setDeleteHasReservations] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<"all" | "venues" | "equipment">("all");

  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceLoading, setResourceLoading] = useState(false);
  const resourceLoadingLabel = useLoadingText("ADDING RESOURCE", resourceLoading);
  const [resourceDraft, setResourceDraft] = useState(getDefaultResourceDraft);
  const [scheduleResources, setScheduleResources] = useState<ScheduleResource[]>([]);

  const handleAddResource = async () => {
    const trimmedName = resourceDraft.name.trim();
    const resourceType = resourceDraft.type;
    if (!trimmedName || !resourceType) {
      showMessage("Resource name and type are required.");
      return;
    }
    setResourceLoading(true);
    await sleep(FEEDBACK_DURATION_MS.standard);
    setScheduleResources((prev) => [
      ...prev,
      {
        id: createScheduleResourceId(resourceType, trimmedName),
        name: trimmedName,
        type: resourceType,
        icon: resourceDraft.icon,
      },
    ]);
    setResourceLoading(false);
    setResourceModalOpen(false);
    setResourceDraft(getDefaultResourceDraft());
    showMessage(`${trimmedName} added as a resource.`);
  };

  const { data: activeBookings = [] } = useQuery({
    ...adminBookingsQueryOptions<VenueBookingRecord>(webApiClient),
    select: (bookings) => bookings.filter((booking) => booking.status === "confirmed"),
  });

  const [rawViewportWidth, setRawViewportWidth] = useState(0);
  const debouncedViewportWidth = useDebounce(rawViewportWidth, 120);
  const isCompact = isCompactViewport(debouncedViewportWidth);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const evaluate = () => setRawViewportWidth(window.outerWidth || window.innerWidth);
    evaluate();
    window.addEventListener("resize", evaluate);
    return () => window.removeEventListener("resize", evaluate);
  }, []);

  useEffect(() => {
    if (!isCompact && isDrawerOpen) {
      setIsDrawerOpen(false);
    }
  }, [isCompact, isDrawerOpen]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isEditMode) {
      return;
    }
    const equipmentId = event.active.data.current?.equipmentId as string | undefined;
    const dropTargetId = event.over?.id as string | undefined;
    if (!equipmentId || !dropTargetId || !dropTargetId.startsWith("venue-")) {
      return;
    }
    setQuickPlacementTemplateKey(null);
    setSelectedEquipmentId(equipmentId);
    void assignEquipmentToVenue(equipmentId, dropTargetId.replace("venue-", ""));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const equipmentId = event.active.data.current?.equipmentId as string | undefined;
    if (equipmentId) {
      setQuickPlacementTemplateKey(null);
      setSelectedEquipmentId(equipmentId);
    }
    if (!isCompact) {
      return;
    }
    const activeId = String(event.active.id ?? "");
    const sourceCellId = event.active.data.current?.sourceCellId as string | undefined;
    if (activeId.startsWith("equip-") && !sourceCellId) {
      setIsDrawerOpen(false);
    }
  };

  const handleDeleteVenueRequest = (venue: VenueRecord) => {
    const hasActive = activeBookings.some((booking) => booking.venueId === venue.id);
    setDeleteHasReservations(hasActive);
    setVenueDeleteTarget(venue);
  };

  const handleToggleFloorEditMode = () => {
    if (isEditMode) {
      setSelectedEquipmentId(null);
      setQuickPlacementTemplateKey(null);
    }
    handleToggleEditMode();
  };

  const deleteTargetEquipment = deleteTarget ? equipmentById[deleteTarget.equipmentId] : null;
  const drawerButtonWidth = 44;
  const floorVenues = useMemo(() => buildFacilityFloorVenues(venues), [venues]);
  const activeFloorConfig = FACILITY_FLOOR_MAP[activeFloor];
  const activeFloorLabel = activeFloorConfig.label;
  const activeFloorVenues = floorVenues[activeFloor];
  const authoredRegionCount = activeFloorVenues.filter(
    (venue) => venue.isReservable === false && !venue.isSystem,
  ).length;

  const quickPlacementTemplate = useMemo(
    () => QUICK_FLOOR_REGION_TEMPLATES.find((template) => template.key === quickPlacementTemplateKey) ?? null,
    [quickPlacementTemplateKey],
  );

  const selectedEquipmentName =
    availableEquipment.find((item) => item.id === selectedEquipmentId)?.name ?? null;

  const handleMoveVenueFromCanvas = (venueMapId: string, placement: { gridColumn: number; gridRow: number }) => {
    if (!isEditMode) {
      return;
    }

    const movingVenue = activeFloorVenues.find((candidate) => candidate.mapId === venueMapId);
    if (!movingVenue) {
      return;
    }

    const liveVenueId = movingVenue.sourceVenueId ?? movingVenue.id;
    const liveVenue = venues.find((candidate) => String(candidate.id) === String(liveVenueId));
    if (!liveVenue || liveVenue.isSystem) {
      return;
    }

    setSelectedFloorVenue(movingVenue);
    void handleUpdateVenueLayout(liveVenue, {
      floorId: activeFloor,
      gridColumn: placement.gridColumn,
      gridRow: placement.gridRow,
    });
  };

  const handleNudgeRegionByMapId = (
    venueMapId: string,
    delta: { column: number; row: number },
  ) => {
    const targetVenue = activeFloorVenues.find((candidate) => candidate.mapId === venueMapId);
    if (!targetVenue) {
      return;
    }

    const liveVenueId = targetVenue.sourceVenueId ?? targetVenue.id;
    const liveVenue = venues.find((candidate) => String(candidate.id) === String(liveVenueId));
    if (!liveVenue || liveVenue.isSystem) {
      return;
    }

    const currentGridWidth = Math.max(1, targetVenue.gridWidth ?? liveVenue.gridWidth ?? 2);
    const currentGridHeight = Math.max(1, targetVenue.gridHeight ?? liveVenue.gridHeight ?? 2);
    const currentGridColumn = targetVenue.gridColumn ?? liveVenue.gridColumn ?? 1;
    const currentGridRow = targetVenue.gridRow ?? liveVenue.gridRow ?? 1;

    const nextGridColumn = clamp(currentGridColumn + delta.column, 1, COLS - currentGridWidth + 1);
    const nextGridRow = clamp(currentGridRow + delta.row, 1, ROWS - currentGridHeight + 1);

    setSelectedFloorVenue(targetVenue);
    void handleUpdateVenueLayout(liveVenue, {
      floorId: activeFloor,
      gridColumn: nextGridColumn,
      gridRow: nextGridRow,
    });
  };

  const handleResizeRegionByMapId = (
    venueMapId: string,
    delta: { width: number; height: number },
  ) => {
    const targetVenue = activeFloorVenues.find((candidate) => candidate.mapId === venueMapId);
    if (!targetVenue) {
      return;
    }

    const liveVenueId = targetVenue.sourceVenueId ?? targetVenue.id;
    const liveVenue = venues.find((candidate) => String(candidate.id) === String(liveVenueId));
    if (!liveVenue || liveVenue.isSystem) {
      return;
    }

    const currentGridWidth = Math.max(1, targetVenue.gridWidth ?? liveVenue.gridWidth ?? 2);
    const currentGridHeight = Math.max(1, targetVenue.gridHeight ?? liveVenue.gridHeight ?? 2);
    const currentGridColumn = targetVenue.gridColumn ?? liveVenue.gridColumn ?? 1;
    const currentGridRow = targetVenue.gridRow ?? liveVenue.gridRow ?? 1;

    const nextGridWidth = clamp(currentGridWidth + delta.width, 1, COLS);
    const nextGridHeight = clamp(currentGridHeight + delta.height, 1, ROWS);
    const nextGridColumn = clamp(currentGridColumn, 1, COLS - nextGridWidth + 1);
    const nextGridRow = clamp(currentGridRow, 1, ROWS - nextGridHeight + 1);

    setSelectedFloorVenue(targetVenue);
    void handleUpdateVenueLayout(liveVenue, {
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
      venues.find((candidate) => String(candidate.id) === String(liveVenueId)) ??
      null
    );
  };

  const handleSubmitVenueFromCanvas = async (
    venueMapId: string,
    data: Record<string, string>,
  ) => {
    const liveVenue = resolveLiveVenueByMapId(venueMapId);
    if (!liveVenue) {
      showVenueMessage("Unable to resolve this venue for editing.");
      return false;
    }

    return handleVenueSubmit(data, liveVenue, () => {
      const updatedFloorVenue = activeFloorVenues.find(
        (candidate) => candidate.mapId === venueMapId,
      );
      if (updatedFloorVenue) {
        setSelectedFloorVenue(updatedFloorVenue);
      }
    });
  };

  const handleRequestVenueDeleteFromCanvas = (venueMapId: string) => {
    const liveVenue = resolveLiveVenueByMapId(venueMapId);
    if (!liveVenue) {
      showVenueMessage("Unable to resolve this venue for deletion.");
      return;
    }
    handleDeleteVenueRequest(liveVenue);
  };

  const equipmentPanelNode = (
    <EquipmentPanel
      equipment={availableEquipment}
      equipmentRemainingById={equipmentRemainingById}
      colors={colors}
      isEditMode={isEditMode}
      panelPadding={isCompact ? 12 : 14}
      equipmentCardPadding={isCompact ? "8px 9px" : "10px 10px"}
      selectedEquipmentId={selectedEquipmentId}
      onSelectEquipment={(equipmentId) => {
        setQuickPlacementTemplateKey(null);
        setSelectedEquipmentId(equipmentId);
      }}
    />
  );

  const layoutStatusNode = (
    <LayoutStatusPanel
      colors={colors}
      panelPadding={isCompact ? 12 : 14}
      assignedCount={assignedCount}
      activeFloor={activeFloor}
    />
  );

  const floorPlanNode = (
    <FloorPlanPanel
      colors={colors}
      floor={activeFloorConfig}
      isCompact={isCompact}
      isEditMode={isEditMode}
      assignedEquipment={assignedEquipment}
      equipmentById={equipmentById}
      venues={activeFloorVenues}
      floorPlanPadding={isCompact ? 10 : 14}
      floorPlanMinHeight={isCompact ? 360 : 500}
      selectedVenueMapId={selectedFloorVenue?.mapId}
      onRequestDelete={(venueMapId, equipmentId) => setDeleteTarget({ venueMapId, equipmentId })}
      selectedEquipmentId={selectedEquipmentId}
      selectedEquipmentName={selectedEquipmentName}
      onAssignEquipmentToVenue={(equipmentId, venueMapId, preferredCell) => {
        setQuickPlacementTemplateKey(null);
        setSelectedEquipmentId(equipmentId);
        void assignEquipmentToVenue(equipmentId, venueMapId, preferredCell);
      }}
      quickRegionTemplate={quickPlacementTemplate}
      onPlaceQuickRegionAtCell={(template, placement) => {
        void handleCreateQuickFloorRegionAt(template, activeFloor, placement);
      }}
      onMoveVenue={handleMoveVenueFromCanvas}
      onNudgeVenue={handleNudgeRegionByMapId}
      onResizeVenue={handleResizeRegionByMapId}
      isVenueSubmitting={isVenueSubmitting}
      onSubmitVenueEdit={handleSubmitVenueFromCanvas}
      onRequestVenueDelete={handleRequestVenueDeleteFromCanvas}
      onSelectVenue={setSelectedFloorVenue}
      onOpenVenues={() => {
        setViewMotionDirection("right");
        setViewMotionKey((prev) => prev + 1);
        setActiveTab("venues");
      }}
    />
  );

  const quickRegionNode = (
    <QuickRegionPanel
      colors={colors}
      isCompact={isCompact}
      isEditMode={isEditMode}
      activeFloor={activeFloor}
      authoredRegionCount={authoredRegionCount}
      quickRegionTemplates={QUICK_FLOOR_REGION_TEMPLATES}
      quickPlacementTemplateKey={quickPlacementTemplateKey}
      selectedRegionName={selectedFloorVenue?.name ?? null}
      onCreateQuickRegion={(template) => {
        void handleCreateQuickFloorRegion(template, activeFloor);
      }}
      onToggleQuickPlacementTemplate={(template) => {
        if (!isEditMode) {
          return;
        }
        setSelectedEquipmentId(null);
        setQuickPlacementTemplateKey((current) => (current === template.key ? null : template.key));
      }}
      onOpenVenueManager={() => {
        setViewMotionDirection("right");
        setViewMotionKey((prev) => prev + 1);
        setActiveTab("venues");
      }}
    />
  );

  const quickRegionSidebarNode = (
    <QuickRegionPanel
      colors={colors}
      isCompact
      isEditMode={isEditMode}
      activeFloor={activeFloor}
      authoredRegionCount={authoredRegionCount}
      quickRegionTemplates={QUICK_FLOOR_REGION_TEMPLATES}
      quickPlacementTemplateKey={quickPlacementTemplateKey}
      selectedRegionName={selectedFloorVenue?.name ?? null}
      showSummaryCard={false}
      onCreateQuickRegion={(template) => {
        void handleCreateQuickFloorRegion(template, activeFloor);
      }}
      onToggleQuickPlacementTemplate={(template) => {
        if (!isEditMode) {
          return;
        }
        setSelectedEquipmentId(null);
        setQuickPlacementTemplateKey((current) => (current === template.key ? null : template.key));
      }}
      onOpenVenueManager={() => {
        setViewMotionDirection("right");
        setViewMotionKey((prev) => prev + 1);
        setActiveTab("venues");
      }}
    />
  );

  const quickRegionSummaryNode = (
    <QuickRegionSummaryCard
      colors={colors}
      authoredRegionCount={authoredRegionCount}
      selectedRegionName={selectedFloorVenue?.name ?? null}
      onOpenVenueManager={() => {
        setViewMotionDirection("right");
        setViewMotionKey((prev) => prev + 1);
        setActiveTab("venues");
      }}
      footerNode={
        quickPlacementTemplateKey ? (
          <FitText style={{ fontSize: 12, color: colors.brand }}>
            Canvas placement is active. Click a floor tile to place the selected template.
          </FitText>
        ) : null
      }
    />
  );

  const editorNode = (
    <LayoutEditorPanel
      colors={colors}
      isCompact={isCompact}
      isEditMode={isEditMode}
      hasUnsavedChanges={hasUnsavedChanges}
      layoutName={layoutName}
      layoutType={layoutType}
      activeFloor={activeFloor}
      onToggleEditMode={handleToggleFloorEditMode}
      onLayoutNameChange={(value) => setLayoutName(value)}
      onLayoutTypeChange={(e: ChangeEvent<HTMLSelectElement>) => {
        if (!isEditMode) {
          return;
        }
        setLayoutType(e.target.value);
      }}
      onFloorChange={(e: ChangeEvent<HTMLSelectElement>) => {
        if (!isEditMode) {
          return;
        }
        setActiveFloor(e.target.value as FacilityFloorId);
        setSelectedFloorVenue(null);
      }}
      onSave={() => handleSaveLayout(() => showVenueMessage("Layout saved."))}
      onClearFloor={handleRequestClearFloor}
      onOpenArchive={() => setArchiveModalOpen(true)}
      quickRegionNode={!isCompact ? quickRegionSidebarNode : undefined}
      quickRegionSummaryNode={!isCompact ? quickRegionSummaryNode : undefined}
      layoutStatusNode={!isCompact ? layoutStatusNode : undefined}
      equipmentPanelNode={!isCompact ? equipmentPanelNode : undefined}
    />
  );

  const venueInitialValues = buildVenueInitialValues(venueEditTarget);
  const combinedMessage = message || layoutMessage || venueMessage;
  const isVenueEditorOpen = activeTab === "venues" && venueEditorMode !== null;

  const handleCloseVenueEditor = () => {
    if (isVenueSubmitting) {
      return;
    }
    setViewMotionDirection("left");
    setViewMotionKey((prev) => prev + 1);
    setVenueEditorMode(null);
    setVenueEditTarget(null);
  };

  const handleOpenVenueEditor = (mode: "create" | "edit", venue: VenueRecord | null = null) => {
    setViewMotionDirection("right");
    setViewMotionKey((prev) => prev + 1);
    setVenueEditTarget(venue);
    setVenueEditorMode(mode);
  };

  const handleOpenMap = () => {
    setSelectedFloorVenue(null);
    setViewMotionDirection("left");
    setViewMotionKey((prev) => prev + 1);
    setActiveTab("floor");
    setVenueEditorMode(null);
    setVenueEditTarget(null);
  };

  return {
    activeTab,
    activeFloorLabel,
    archivedEquipment,
    archivedEquipmentLoading,
    archivedVenues,
    archivedVenuesLoading,
    archiveFilter,
    archiveModalOpen,
    combinedMessage,
    colors,
    clearFloorConfirmOpen,
    deleteHasReservations,
    deleteEquipmentMutation,
    deleteTarget,
    deleteTargetEquipment,
    deleteVenueMutation,
    drawerButtonWidth,
    editorNode,
    equipmentPanelNode,
    fadeIn,
    floorPlanNode,
    fs,
    handleAddResource,
    handleCloseVenueEditor,
    handleConfirmCellDelete,
    handleClearFloor,
    handleDeleteVenue,
    handleDeleteVenueRequest,
    handleDragEnd,
    handleDragStart,
    handleOpenMap,
    handleOpenVenueEditor,
    handleRestoreEquipment,
    handleRestoreVenue,
    handleSaveAndExit,
    handleVenueSubmit,
    handleToggleEditMode,
    hasUnsavedChanges,
    isCompact,
    isDrawerOpen,
    isEditMode,
    isVenueEditorOpen,
    isVenueSubmitting,
    layoutName,
    layoutStatusNode,
    layoutType,
    quickRegionNode,
    resourceDraft,
    resourceLoading,
    resourceLoadingLabel,
    resourceModalOpen,
    scheduleResources,
    selectedFloorVenue,
    sensors,
    setActiveTab,
    setArchiveFilter,
    setArchiveModalOpen,
    setClearFloorConfirmOpen,
    setDeleteHasReservations,
    setDeleteTarget,
    setIsDrawerOpen,
    setResourceDraft,
    setResourceModalOpen,
    setSelectedFloorVenue,
    setShowUnsavedConfirm,
    showMessage,
    showUnsavedConfirm,
    showVenueMessage,
    themeTransition,
    restoreEquipmentMutation,
    restoreVenueMutation,
    venueDeleteTarget,
    venueEditTarget,
    venueInitialValues,
    venueSavingLabel,
    venues,
    venuesLoading,
    viewSlideStyle,
    setVenueDeleteTarget,
    setVenueEditTarget,
    setVenueEditorMode,
  } as const;
}

export type FacilitiesPageController = ReturnType<typeof useFacilitiesPageController>;
