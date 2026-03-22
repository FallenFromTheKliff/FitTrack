"use client";
import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { DndContext, type DragEndEvent, type DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDebounce } from "@fittrack/hooks";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { facilitiesMapStyles } from "@/styles/pageStyles";
import { CONFIRM_COPY } from "@/utils/confirmCopy";
import { api } from "@/lib/axios";
import { VENUE_FIELDS, FACILITY_TABS, VENUE_INITIAL_VALUES, type FacilityTab } from "@/data/facilities/venueFields";

import FitPill from "@/components/fit/FitPill";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import DetailsModal from "@/components/modals/DetailsModal";
import ConfirmModal from "@/components/modals/ConfirmModal";

import { EQUIPMENT, CompactFloorLayout, EquipmentPanel, FloorPlanPanel, LayoutEditorPanel, LayoutStatusPanel, VenueManagementTable } from "@/components/map";
import type { VenueRecord } from "@/components/map";
import { useVenueMutations, useFloorLayout } from "@/hooks/facilities/useFacilities";

type BookingRecord = { id: string; venueId: number; status: string };

export default function FacilitiesMapPage() {
    const { colors } = useTheme();
    const fs = facilitiesMapStyles(colors);
    const fadeIn = useFadeIn();
    const themeTransition = useThemeTransition();
    const [activeTab, setActiveTab] = useState<FacilityTab>("floor");

    const {
        venues, venuesLoading, isVenueSubmitting,
        venueSavingLabel, deleteVenueMutation, message,
        showMessage, handleVenueSubmit, handleDeleteVenue
    } = useVenueMutations();

    const {
        isEditMode, hasUnsavedChanges, showUnsavedConfirm,
        setShowUnsavedConfirm, layoutName, setLayoutName,
        layoutType, setLayoutType, gridSize,
        setGridSize, deleteTargetCell, setDeleteTargetCell,
        placedItems, equipmentById, placedCount,
        handleSaveLayout, handleToggleEditMode, handleSaveAndExit,
        handleConfirmCellDelete, handleClearFloor, handleExport,
        placeDraggedItem
    } = useFloorLayout();

    const [venueModalOpen, setVenueModalOpen] = useState(false);
    const [venueEditTarget, setVenueEditTarget] = useState<VenueRecord | null>(null);
    const [venueDeleteTarget, setVenueDeleteTarget] = useState<VenueRecord | null>(null);
    const [deleteHasReservations, setDeleteHasReservations] = useState(false);

    const { data: activeBookings = [] } = useQuery<BookingRecord[]>({
        queryKey: ["admin-bookings-active"],
        queryFn: async () => {
            const { data } = await api.get<{ bookings?: BookingRecord[] } | BookingRecord[]>("/admin/bookings?status=confirmed");
            return Array.isArray(data) ? data : (data.bookings ?? []);
        }
    });

    const [rawViewportWidth, setRawViewportWidth] = useState(0);
    const debouncedViewportWidth = useDebounce(rawViewportWidth, 120);
    const isCompact = debouncedViewportWidth > 0 &&
        debouncedViewportWidth <= (window.screen?.availWidth || window.screen?.width || window.innerWidth) * 0.6;
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

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 4 } })
    );

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
        const hasActive = activeBookings.some((b) => b.venueId === venue.id);
        setDeleteHasReservations(hasActive);
        setVenueDeleteTarget(venue);
    };

    const deleteTargetEquipment = deleteTargetCell ? equipmentById[placedItems[deleteTargetCell]] : null;
    const drawerButtonWidth = 44;

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
            isCompact={isCompact}
            isEditMode={isEditMode}
            placedItems={placedItems}
            equipmentById={equipmentById}
            venues={venues}
            floorPlanPadding={isCompact ? 10 : 14}
            floorPlanMinHeight={isCompact ? 360 : 560}
            onRequestDelete={setDeleteTargetCell}
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
            onSave={() => handleSaveLayout(() => showMessage("Layout saved."))}
            onClearFloor={handleClearFloor}
            onExport={() => handleExport(layoutName, layoutType, gridSize)}
        />
    );

    const venueInitialValues = venueEditTarget
        ? {
            name: venueEditTarget.name ?? "",
            description: venueEditTarget.description ?? "",
            capacity: String(venueEditTarget.capacity ?? ""),
            hourlyRate: String(venueEditTarget.hourlyRate ?? ""),
            minimumHours: String(venueEditTarget.minimumHours ?? 1),
            iconKey: venueEditTarget.iconKey ?? "gym-area",
            gridColumn: String(venueEditTarget.gridColumn ?? 1),
            gridRow: String(venueEditTarget.gridRow ?? 1),
            gridWidth: String(venueEditTarget.gridWidth ?? 2),
            gridHeight: String(venueEditTarget.gridHeight ?? 2),
            isReservable: String(venueEditTarget.isReservable !== false),
            displayOrder: String(venueEditTarget.displayOrder ?? 0)
        }
        : VENUE_INITIAL_VALUES;

    return (
        <section className={themeTransition} style={fadeIn}>
            <div style={{ ...fs.mapCard, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0 12px", borderBottom: `1px solid ${colors.border}`, marginBottom: 14 }}>
                    <FitPill
                        options={[...FACILITY_TABS]}
                        active={activeTab}
                        onChange={setActiveTab}
                    />
                    {activeTab === "venues" && (
                        <FitButton
                            variant="primary"
                            label="ADD VENUE"
                            onClick={() => { setVenueEditTarget(null); setVenueModalOpen(true); }}
                        />
                    )}
                </div>
                {activeTab === "venues" ? (
                    <VenueManagementTable
                        colors={colors}
                        venues={venues}
                        isLoading={venuesLoading}
                        onAddVenue={() => { setVenueEditTarget(null); setVenueModalOpen(true); }}
                        onEditVenue={(venue) => { setVenueEditTarget(venue); setVenueModalOpen(true); }}
                        onDeleteVenue={handleDeleteVenueRequest}
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
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 12, alignItems: "start" }}>
                                <div style={{ backgroundColor: colors.border, borderRadius: 12, padding: 14, display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "stretch" }}>
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
            {message && (
                <FitText style={{ fontSize: 14, color: colors.success, fontWeight: 500 }}>{message}</FitText>
            )}
            <DetailsModal
                isOpen={venueModalOpen}
                title={venueEditTarget ? "Edit Venue" : "Add Venue"}
                subtitle="Create or update active venues used for reservations."
                fields={VENUE_FIELDS}
                initialValues={venueInitialValues}
                submitLabel={isVenueSubmitting ? venueSavingLabel : "SAVE VENUE"}
                isLoading={isVenueSubmitting}
                onSubmit={(data) => handleVenueSubmit(data, venueEditTarget, () => {
                    setVenueModalOpen(false);
                    setVenueEditTarget(null);
                })}
                onCancel={() => {
                    if (isVenueSubmitting) return;
                    setVenueModalOpen(false);
                    setVenueEditTarget(null);
                }}
            />
            <ConfirmModal
                isOpen={!!venueDeleteTarget}
                title="Delete Venue"
                message={
                    venueDeleteTarget?.isSystem
                        ? `${venueDeleteTarget.name} is part of the core floor plan and cannot be removed.`
                        : deleteHasReservations
                            ? `${venueDeleteTarget?.name ?? "This venue"} has active reservations. Deleting it will immediately cancel them and members will see "[MOVED/DELETED]" in their bookings. Proceed?`
                            : `Delete ${venueDeleteTarget?.name ?? "this venue"}?`
                }
                confirmLabel="DELETE VENUE"
                cancelLabel="KEEP VENUE"
                loadingLabel="DELETING VENUE"
                loadingTitle="DELETING VENUE"
                isLoading={deleteVenueMutation.isPending}
                isDanger
                onConfirm={() => handleDeleteVenue(venueDeleteTarget, () => {
                    setVenueDeleteTarget(null);
                    setDeleteHasReservations(false);
                })}
                onCancel={() => {
                    setVenueDeleteTarget(null);
                    setDeleteHasReservations(false);
                }}
            />
            <ConfirmModal
                isOpen={showUnsavedConfirm}
                title="Unsaved Changes"
                message="You have unsaved placed equipment in the floor plan. Save changes before leaving Edit Mode, or keep editing?"
                confirmLabel={CONFIRM_COPY.saveAndExit.confirmLabel}
                cancelLabel="KEEP EDITING"
                onConfirm={() => handleSaveAndExit(() => showMessage("Layout saved."))}
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
        </section>
    );
}