"use client";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import { useDebounce, useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { useQuery } from "@tanstack/react-query";
import { adminBookingsQueryOptions } from "@fittrack/query";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { usePowerSlide } from "@/hooks/animations/usePowerSlide";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { facilitiesMapStyles } from "@/styles/pageStyles";
import { CONFIRM_COPY } from "@/utils/confirmCopy";
import { webApiClient } from "@/lib/api-client";
import { useFitSensors } from "@/hooks/useFitSensors";
import { sleep } from "@/utils/sleep";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import {
  type BookingRecord,
  SCHEDULE_EMOJI_OPTIONS,
  type ScheduleResource
} from "@/data/facilities/resources";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitSelect } from "@/components/fit/FitCard";
import { ConfirmModal, FitModal, VenueDetailsModal } from "@/components/modals";

import {
  EQUIPMENT,
  CompactFloorLayout,
  EditVenueModal,
  EquipmentPanel,
  FloorPlanPanel,
  LayoutEditorPanel,
  LayoutStatusPanel,
  VenueManagementTable
} from "@/components/map";
import type { VenueRecord } from "@/components/map";
import { useVenueMutations, useFloorLayout } from "@/hooks/facilities/useFacilities";
import { FACILITY_FLOOR_MAP, buildFacilityFloorVenues, type FacilityFloorId, type FloorVenueRecord } from "@/data/facilities/floorPlans";
import {
  buildVenueInitialValues,
  createScheduleResourceId,
  getDefaultResourceDraft,
  isCompactViewport
} from "./helpers";

export default function FacilitiesMapPage() {
  const { colors } = useTheme();
  const fs = facilitiesMapStyles(colors);
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const [activeTab, setActiveTab] = useState<"floor" | "venues">("floor");
  const [viewMotionKey, setViewMotionKey] = useState(0);
  const [viewMotionDirection, setViewMotionDirection] = useState<"left" | "right">("right");
  const { message, showMessage } = useTimedMessage(FEEDBACK_DURATION_MS.standard);
  const { style: viewSlideStyle } = usePowerSlide(viewMotionKey, viewMotionDirection);

  const {
    venues,
    venuesLoading,
    isVenueSubmitting,
    venueSavingLabel,
    deleteVenueMutation,
    message: venueMessage,
    showMessage: showVenueMessage,
    handleVenueSubmit,
    handleDeleteVenue
  } = useVenueMutations();

  const {
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
    deleteTarget,
    setDeleteTarget,
    assignedEquipment,
    equipmentById,
    assignedCount,
    handleSaveLayout,
    handleToggleEditMode,
    handleSaveAndExit,
    handleConfirmCellDelete,
    handleClearFloor,
    handleExport,
    assignEquipmentToVenue
  } = useFloorLayout();

  const [venueEditorMode, setVenueEditorMode] = useState<"create" | "edit" | null>(null);
  const [venueEditTarget, setVenueEditTarget] = useState<VenueRecord | null>(null);
  const [venueDeleteTarget, setVenueDeleteTarget] = useState<VenueRecord | null>(null);
  const [selectedFloorVenue, setSelectedFloorVenue] = useState<FloorVenueRecord | null>(null);
  const [deleteHasReservations, setDeleteHasReservations] = useState(false);

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
        icon: resourceDraft.icon
      }
    ]);
    setResourceLoading(false);
    setResourceModalOpen(false);
    setResourceDraft(getDefaultResourceDraft());
    showMessage(`${trimmedName} added as a resource.`);
  };

  const { data: activeBookings = [] } = useQuery({
    ...adminBookingsQueryOptions<BookingRecord>(webApiClient),
    select: (bookings) => bookings.filter((booking) => booking.status === "confirmed")
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
    if (!isCompact && isDrawerOpen) setIsDrawerOpen(false);
  }, [isCompact, isDrawerOpen]);

  const sensors = useFitSensors();

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isEditMode) return;
    const equipmentId = event.active.data.current?.equipmentId as string | undefined;
    const dropTargetId = event.over?.id as string | undefined;
    if (!equipmentId || !dropTargetId || !dropTargetId.startsWith("venue-")) return;
    assignEquipmentToVenue(equipmentId, dropTargetId.replace("venue-", ""));
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!isCompact) return;
    const activeId = String(event.active.id ?? "");
    const sourceCellId = event.active.data.current?.sourceCellId as string | undefined;
    if (activeId.startsWith("equip-") && !sourceCellId) setIsDrawerOpen(false);
  };

  const handleDeleteVenueRequest = (venue: VenueRecord) => {
    const hasActive = activeBookings.some((booking) => booking.venueId === venue.id);
    setDeleteHasReservations(hasActive);
    setVenueDeleteTarget(venue);
  };

  const deleteTargetEquipment = deleteTarget
    ? equipmentById[deleteTarget.equipmentId]
    : null;
  const drawerButtonWidth = 44;
  const floorVenues = useMemo(() => buildFacilityFloorVenues(venues), [venues]);
  const activeFloorConfig = FACILITY_FLOOR_MAP[activeFloor];
  const activeFloorVenues = floorVenues[activeFloor];

  const equipmentPanelNode = (
    <EquipmentPanel
      equipment={EQUIPMENT}
      colors={colors}
      isEditMode={isEditMode}
      panelPadding={isCompact ? 12 : 14}
      equipmentCardPadding={isCompact ? "8px 9px" : "10px 10px"}
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
      floorPlanMinHeight={isCompact ? 360 : 560}
      selectedVenueMapId={selectedFloorVenue?.mapId}
      onRequestDelete={(venueMapId, equipmentId) => setDeleteTarget({ venueMapId, equipmentId })}
      onSelectVenue={setSelectedFloorVenue}
      onOpenVenues={() => {
        setViewMotionDirection("right");
        setViewMotionKey((prev) => prev + 1);
        setActiveTab("venues");
      }}
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
      onToggleEditMode={handleToggleEditMode}
      onLayoutNameChange={(value) => setLayoutName(value)}
      onLayoutTypeChange={(e: ChangeEvent<HTMLSelectElement>) => {
        if (!isEditMode) return;
        setLayoutType(e.target.value);
      }}
      onFloorChange={(e: ChangeEvent<HTMLSelectElement>) => {
        if (!isEditMode) return;
        setActiveFloor(e.target.value as FacilityFloorId);
        setSelectedFloorVenue(null);
      }}
      onSave={() => handleSaveLayout(() => showVenueMessage("Layout saved."))}
      onClearFloor={handleClearFloor}
      onExport={() => handleExport(layoutName, layoutType, gridSize)}
    />
  );

  const venueInitialValues = buildVenueInitialValues(venueEditTarget);
  const combinedMessage = message || venueMessage;
  const isVenueEditorOpen = activeTab === "venues" && venueEditorMode !== null;

  const handleCloseVenueEditor = () => {
    if (isVenueSubmitting) return;
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

  return (
    <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
      <div style={{ ...fs.mapCard, marginBottom: 12 }}>
        {activeTab === "venues" ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <FitButton variant="ghost" label="< FACILITIES MAP" onClick={handleOpenMap} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {isVenueEditorOpen ? (
                <FitButton variant="ghost" label="BACK TO VENUES" onClick={handleCloseVenueEditor} />
              ) : null}
              <FitButton
                variant="ghost"
                label="MANAGE RESOURCES"
                onClick={() => setResourceModalOpen(true)}
              />
              <FitButton
                variant="primary"
                label="ADD VENUE"
                onClick={() => handleOpenVenueEditor("create")}
              />
            </div>
          </div>
        ) : null}
        <motion.div style={viewSlideStyle}>
          {activeTab === "venues" ? (
            isVenueEditorOpen ? (
              <EditVenueModal
                isVisible={isVenueEditorOpen}
                editTarget={venueEditTarget}
                initialValues={venueInitialValues}
                submitLabel={isVenueSubmitting ? venueSavingLabel : "SAVE VENUE"}
                isLoading={isVenueSubmitting}
                onSubmit={(data) => handleVenueSubmit(data, venueEditTarget, handleCloseVenueEditor)}
                onDelete={() => {
                  if (!venueEditTarget) return;
                  handleCloseVenueEditor();
                  handleDeleteVenueRequest(venueEditTarget);
                }}
              />
            ) : (
              <VenueManagementTable
                colors={colors}
                venues={venues}
                isLoading={venuesLoading}
                onEditVenue={(venue) => handleOpenVenueEditor("edit", venue)}
              />
            )
          ) : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              {isCompact ? (
                <CompactFloorLayout
                  colors={colors}
                  isDrawerOpen={isDrawerOpen}
                  drawerButtonWidth={drawerButtonWidth}
                  onToggleDrawer={() => setIsDrawerOpen((prev) => !prev)}
                  floorPlanNode={floorPlanNode}
                  drawerNode={<>{equipmentPanelNode}{layoutStatusNode}</>}
                  editorNode={editorNode}
                />
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 300px",
                    gap: 12,
                    alignItems: "start"
                  }}
                >
                  <div
                    style={{
                      backgroundColor: colors.border,
                      borderRadius: 12,
                      padding: 14,
                      display: "grid",
                      gridTemplateColumns: "220px 1fr",
                      gap: 12,
                      alignItems: "stretch"
                    }}
                  >
                    <div style={{ display: "grid", gap: 10 }}>
                      {equipmentPanelNode}
                      {layoutStatusNode}
                    </div>
                    {floorPlanNode}
                  </div>
                  {editorNode}
                </div>
              )}
            </DndContext>
          )}
        </motion.div>
      </div>

      {combinedMessage && (
        <FitText style={{ fontSize: 15, color: colors.success, fontWeight: 500 }}>
          {combinedMessage}
        </FitText>
      )}
      <VenueDetailsModal
        venue={selectedFloorVenue}
        isOpen={!!selectedFloorVenue}
        onClose={() => setSelectedFloorVenue(null)}
      />
      <FitModal
        isOpen={resourceModalOpen}
        onClose={() => setResourceModalOpen(false)}
        title="Manage Resources"
        subtitle="Add trainers or facilities to the schedule roster"
        maxWidth={480}
        closeAriaLabel="Close manage resources"
        footer={
          <FitButton
            variant="primary"
            label={resourceLoading ? resourceLoadingLabel : "ADD RESOURCE"}
            loading={resourceLoading}
            onClick={handleAddResource}
            style={{ flex: 1 }}
          />
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <FitText
              as="label"
              style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginBottom: 4, display: "block" }}
            >
              Resource Name <FitText as="span" style={{ color: colors.danger }}>*</FitText>
            </FitText>
            <FitTextInput
              value={resourceDraft.name}
              onChange={(e) => setResourceDraft((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g., James Wilson"
              style={{
                width: "100%",
                padding: "10px 13px",
                borderRadius: 8,
                border: `1px solid ${colors.fieldBorder}`,
                backgroundColor: colors.fieldBg,
                fontSize: 15
              }}
            />
          </div>
          <div>
            <FitText
              as="label"
              style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginBottom: 4, display: "block" }}
            >
              Type <FitText as="span" style={{ color: colors.danger }}>*</FitText>
            </FitText>
            <FitSelect
              fullWidth
              value={resourceDraft.type}
              onChange={(e) => setResourceDraft((p) => ({ ...p, type: e.target.value as ScheduleResource["type"] | "" }))}
              placeholder="Select Type"
              options={[
                { label: "Trainer / Staff", value: "trainer" },
                { label: "Facility / Venue", value: "facility" }
              ]}
              style={{ borderColor: colors.fieldBorder, backgroundColor: colors.fieldBg }}
            />
          </div>
          <div>
            <FitText
              as="label"
              style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginBottom: 4, display: "block" }}
            >
              Icon
            </FitText>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SCHEDULE_EMOJI_OPTIONS.map((emoji) => (
                <FitButton
                  key={emoji}
                  variant="ghost"
                  onClick={() => setResourceDraft((p) => ({ ...p, icon: emoji }))}
                  style={{
                    width: 42,
                    height: 42,
                    padding: 0,
                    borderRadius: 9,
                    fontSize: 20,
                    border: `1px solid ${resourceDraft.icon === emoji ? colors.brand : colors.border}`,
                    backgroundColor:
                      resourceDraft.icon === emoji
                        ? `${colors.brand}20`
                        : colors.surfaceRaised
                  }}
                >
                  <FitText as="span">{emoji}</FitText>
                </FitButton>
              ))}
            </div>
          </div>
          {scheduleResources.length > 0 && (
            <div>
              <FitText
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                  display: "block"
                }}
              >
                Added Resources
              </FitText>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {scheduleResources.map((resource) => (
                  <div
                    key={resource.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 12px",
                      borderRadius: 9,
                      backgroundColor: colors.surfaceRaised,
                      border: `1px solid ${colors.border}`
                    }}
                  >
                    <FitText as="span" style={{ fontSize: 18 }}>{resource.icon}</FitText>
                    <FitText style={{ fontSize: 14, flex: 1 }}>{resource.name}</FitText>
                    <FitText style={{ fontSize: 12, color: colors.textMuted, textTransform: "capitalize" }}>
                      {resource.type}
                    </FitText>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </FitModal>
      <ConfirmModal
        isOpen={!!venueDeleteTarget}
        title="Delete Venue"
        message={
          venueDeleteTarget?.isSystem
            ? `${venueDeleteTarget.name} is part of the core floor plan and cannot be removed.`
            : deleteHasReservations
              ? `${venueDeleteTarget?.name ?? "This venue"} has active reservations. Deleting it will immediately cancel them. Proceed?`
              : `Delete ${venueDeleteTarget?.name ?? "this venue"}?`
        }
        confirmLabel="DELETE VENUE"
        loadingLabel="DELETING VENUE"
        loadingTitle="DELETING VENUE"
        isLoading={deleteVenueMutation.isPending}
        isDanger
        onConfirm={() =>
          handleDeleteVenue(venueDeleteTarget, () => {
            setVenueDeleteTarget(null);
            setDeleteHasReservations(false);
          })
        }
        onCancel={() => {
          setVenueDeleteTarget(null);
          setDeleteHasReservations(false);
        }}
      />
      <ConfirmModal
        isOpen={showUnsavedConfirm}
        title="Unsaved Changes"
        message="You have unsaved placed equipment. Save changes before leaving Edit Mode?"
        confirmLabel={CONFIRM_COPY.saveAndExit.confirmLabel}
        onConfirm={() => handleSaveAndExit(() => showVenueMessage("Layout saved."))}
        onCancel={() => setShowUnsavedConfirm(false)}
      />
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Remove Equipment"
        message={`Remove ${deleteTargetEquipment?.name ?? "this equipment"} from the floor plan?`}
        confirmLabel="REMOVE"
        isDanger
        onConfirm={handleConfirmCellDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </FitSection>
  );
}