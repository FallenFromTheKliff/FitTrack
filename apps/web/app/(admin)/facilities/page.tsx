"use client";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { useDebounce, useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { facilitiesMapStyles } from "@/styles/pageStyles";
import { CONFIRM_COPY } from "@/utils/confirmCopy";
import { api } from "@/lib/axios";
import { useFitSensors } from "@/hooks/useFitSensors";
import { sleep } from "@/utils/sleep";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { FACILITY_TABS, type FacilityTab } from "@/data/facilities/venueFields";
import {
  type BookingRecord,
  SCHEDULE_EMOJI_OPTIONS,
  type ScheduleResource
} from "@/data/facilities/resources";

import FitPill from "@/components/fit/FitPill";
import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitSelect } from "@/components/fit/FitCard";
import { ConfirmModal, FitModal } from "@/components/modals";

import {
  EQUIPMENT,
  CompactFloorLayout,
  EditVenueModal,
  EquipmentPanel,
  FloorToggle,
  FloorPlanPanel,
  LayoutEditorPanel,
  LayoutStatusPanel,
  VenueManagementTable
} from "@/components/map";
import type { VenueRecord } from "@/components/map";
import { useVenueMutations, useFloorLayout } from "@/hooks/facilities/useFacilities";
import { FACILITY_FLOOR_MAP, buildFacilityFloorVenues, type FloorVenueRecord } from "@/data/facilities/floorPlans";
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
  const [activeTab, setActiveTab] = useState<FacilityTab>("floor");
  const { message, showMessage } = useTimedMessage(FEEDBACK_DURATION_MS.standard);

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
    setGridSize,
    deleteTargetCell,
    setDeleteTargetCell,
    placedItems,
    equipmentById,
    placedCount,
    handleSaveLayout,
    handleToggleEditMode,
    handleSaveAndExit,
    handleConfirmCellDelete,
    handleClearFloor,
    handleExport,
    placeDraggedItem
  } = useFloorLayout();

  const [venueModalOpen, setVenueModalOpen] = useState(false);
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

  const { data: activeBookings = [] } = useQuery<BookingRecord[]>({
    queryKey: ["admin-bookings-active"],
    queryFn: async () => {
      const { data } = await api.get<{ bookings?: BookingRecord[] } | BookingRecord[]>(
        "/admin/bookings?status=confirmed"
      );
      return Array.isArray(data) ? data : (data.bookings ?? []);
    }
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
    const sourceCellId = event.active.data.current?.sourceCellId as string | undefined;
    const cellId = event.over?.id as string | undefined;
    if (!equipmentId || !cellId || !cellId.startsWith("cell-")) return;
    placeDraggedItem(equipmentId, cellId, sourceCellId);
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

  const deleteTargetEquipment = deleteTargetCell
    ? equipmentById[placedItems[deleteTargetCell]]
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
      placedCount={placedCount}
      gridSize={gridSize}
    />
  );

  const floorPlanNode = (
    <FloorPlanPanel
      colors={colors}
      floor={activeFloorConfig}
      isCompact={isCompact}
      isEditMode={isEditMode}
      placedItems={placedItems}
      equipmentById={equipmentById}
      venues={activeFloorVenues}
      floorPlanPadding={isCompact ? 10 : 14}
      floorPlanMinHeight={isCompact ? 360 : 560}
      selectedVenueMapId={selectedFloorVenue?.mapId}
      onRequestDelete={setDeleteTargetCell}
      onSelectVenue={setSelectedFloorVenue}
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
      gridSize={gridSize}
      onToggleEditMode={handleToggleEditMode}
      onLayoutNameChange={(value) => setLayoutName(value)}
      onLayoutTypeChange={(e: ChangeEvent<HTMLSelectElement>) => {
        if (!isEditMode) return;
        setLayoutType(e.target.value);
      }}
      onGridSizeChange={(e: ChangeEvent<HTMLSelectElement>) => {
        if (!isEditMode) return;
        setGridSize(e.target.value);
      }}
      onSave={() => handleSaveLayout(() => showVenueMessage("Layout saved."))}
      onClearFloor={handleClearFloor}
      onExport={() => handleExport(layoutName, layoutType, gridSize)}
    />
  );

  const venueInitialValues = buildVenueInitialValues(venueEditTarget);
  const combinedMessage = message || venueMessage;

  return (
    <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
      <div style={{ ...fs.mapCard, marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 0 12px",
            borderBottom: `1px solid ${colors.border}`,
            marginBottom: 14,
            gap: 10
          }}
        >
          <FitPill
            options={[...FACILITY_TABS]}
            active={activeTab}
            onChange={setActiveTab}
          />
          {activeTab === "venues" ? (
            <div style={{ display: "flex", gap: 10 }}>
              <FitButton
                variant="ghost"
                label="MANAGE RESOURCES"
                onClick={() => setResourceModalOpen(true)}
              />
              <FitButton
                variant="primary"
                label="ADD VENUE"
                onClick={() => {
                  setVenueEditTarget(null);
                  setVenueModalOpen(true);
                }}
              />
            </div>
          ) : (
            <FloorToggle
              colors={colors}
              activeFloor={activeFloor}
              onChange={(floorId) => {
                setActiveFloor(floorId);
                setSelectedFloorVenue(null);
              }}
            />
          )}
        </div>
        {activeTab === "venues" ? (
          <VenueManagementTable
            colors={colors}
            venues={venues}
            isLoading={venuesLoading}
            onAddVenue={() => {
              setVenueEditTarget(null);
              setVenueModalOpen(true);
            }}
            onEditVenue={(venue) => {
              setVenueEditTarget(venue);
              setVenueModalOpen(true);
            }}
          />
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
      </div>

      {combinedMessage && (
        <FitText style={{ fontSize: 15, color: colors.success, fontWeight: 500 }}>
          {combinedMessage}
        </FitText>
      )}
      <EditVenueModal
        isOpen={venueModalOpen}
        editTarget={venueEditTarget}
        initialValues={venueInitialValues}
        submitLabel={isVenueSubmitting ? venueSavingLabel : "SAVE VENUE"}
        isLoading={isVenueSubmitting}
        onSubmit={(data) => handleVenueSubmit(data, venueEditTarget, () => {
          setVenueModalOpen(false);
          setVenueEditTarget(null);
        })}
        onDelete={() => {
          if (!venueEditTarget) return;
          setVenueModalOpen(false);
          handleDeleteVenueRequest(venueEditTarget);
        }}
        onCancel={() => {
          if (isVenueSubmitting) return;
          setVenueModalOpen(false);
          setVenueEditTarget(null);
        }}
      />
      <FitModal
        isOpen={!!selectedFloorVenue}
        onClose={() => setSelectedFloorVenue(null)}
        title={selectedFloorVenue?.name ?? "Venue Details"}
        subtitle={selectedFloorVenue ? `${FACILITY_FLOOR_MAP[selectedFloorVenue.floorId].label} - ${selectedFloorVenue.isReservable === false ? "Facility zone" : "Reservable venue"}` : undefined}
        maxWidth={460}
        closeAriaLabel="Close venue details"
        footer={
          selectedFloorVenue ? (
            <FitButton
              variant="primary"
              label="CLOSE"
              onClick={() => setSelectedFloorVenue(null)}
              style={{ flex: 1 }}
            />
          ) : null
        }
      >
        {selectedFloorVenue ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10
              }}
            >
              {[
                { label: "Capacity", value: String(selectedFloorVenue.capacity ?? "N/A") },
                { label: "Minimum Hours", value: `${selectedFloorVenue.minimumHours ?? 1}` },
                { label: "Rate", value: selectedFloorVenue.hourlyRate ? `$${selectedFloorVenue.hourlyRate}/hr` : "Facility only" },
                {
                  label: "Grid Zone",
                  value: `C${selectedFloorVenue.gridColumn ?? 1}/R${selectedFloorVenue.gridRow ?? 1}`
                }
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surfaceRaised,
                    padding: "12px 14px"
                  }}
                >
                  <FitText style={{ fontSize: 11, color: colors.textMuted, fontWeight: 700 }}>{item.label}</FitText>
                  <FitText style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{item.value}</FitText>
                </div>
              ))}
            </div>
            <div
              style={{
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceRaised,
                padding: "14px 16px"
              }}
            >
              <FitText style={{ fontSize: 12, color: colors.textMuted, fontWeight: 700, marginBottom: 6 }}>
                Description
              </FitText>
              <FitText style={{ fontSize: 14, lineHeight: 1.5 }}>
                {selectedFloorVenue.description ?? "No description provided for this venue yet."}
              </FitText>
            </div>
          </div>
        ) : null}
      </FitModal>
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
              style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginBottom: 8, display: "block" }}
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
              style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginBottom: 8, display: "block" }}
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
              style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginBottom: 8, display: "block" }}
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
                  marginBottom: 8,
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
        cancelLabel="KEEP VENUE"
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
        cancelLabel="KEEP EDITING"
        onConfirm={() => handleSaveAndExit(() => showVenueMessage("Layout saved."))}
        onCancel={() => setShowUnsavedConfirm(false)}
      />
      <ConfirmModal
        isOpen={!!deleteTargetCell}
        title="Remove Equipment"
        message={`Remove ${deleteTargetEquipment?.name ?? "this equipment"} from the floor plan?`}
        confirmLabel="REMOVE"
        cancelLabel="KEEP EQUIPMENT"
        isDanger
        onConfirm={handleConfirmCellDelete}
        onCancel={() => setDeleteTargetCell(null)}
      />
    </FitSection>
  );
}

