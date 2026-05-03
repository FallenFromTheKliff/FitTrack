"use client";

import { DndContext } from "@dnd-kit/core";
import { motion } from "framer-motion";

import { CONFIRM_COPY } from "@/utils/confirmCopy";
import {
  SCHEDULE_EMOJI_OPTIONS,
  type ScheduleResource,
} from "@/data/facilities/resources";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitSelect } from "@/components/fit/FitCard";
import { ConfirmModal, FitModal, VenueDetailsModal } from "@/components/modals";

import {
  CompactFloorLayout,
  EditVenueModal,
  VenueManagementTable,
} from "@/components/map";
import { FacilitiesArchiveModal } from "@/components/map/FacilitiesArchiveModal";
import type { FacilitiesPageController } from "@/components/map/useFacilitiesPageController";

type Props = {
  controller: FacilitiesPageController;
};

export default function FacilitiesMapPageView({ controller }: Props) {
  return (
    <FitSection
      as="section"
      heading=""
      hideHeading
      bare
      noPadding
      className={controller.themeTransition}
      style={controller.fadeIn}
    >
      <div style={{ ...controller.fs.mapCard, marginBottom: 12 }}>
        {controller.activeTab === "venues" ||
        controller.activeTab === "equipment" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <FitButton
              variant="ghost"
              label="< FACILITIES MAP"
              onClick={controller.handleOpenMap}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {controller.activeTab === "venues" &&
              controller.isVenueEditorOpen ? (
                <FitButton
                  variant="ghost"
                  label="BACK TO VENUES"
                  onClick={controller.handleCloseVenueEditor}
                />
              ) : null}
              <FitButton
                variant="ghost"
                label="MANAGE ARCHIVE"
                onClick={() => controller.setArchiveModalOpen(true)}
              />
              {controller.activeTab === "venues" ? (
                <FitButton
                  variant="primary"
                  label="ADD VENUE"
                  onClick={() => controller.handleOpenVenueEditor("create")}
                />
              ) : null}
            </div>
          </div>
        ) : null}
        <motion.div style={controller.viewSlideStyle}>
          {controller.activeTab === "venues" ? (
            controller.isVenueEditorOpen ? (
              <EditVenueModal
                isVisible={controller.isVenueEditorOpen}
                editTarget={controller.venueEditTarget}
                initialValues={controller.venueInitialValues}
                submitLabel={
                  controller.isVenueSubmitting
                    ? controller.venueSavingLabel
                    : "SAVE VENUE"
                }
                isLoading={controller.isVenueSubmitting}
                onUploadImage={controller.handleUploadVenueImage}
                onSubmit={(data) =>
                  controller.handleVenueSubmit(
                    data,
                    controller.venueEditTarget,
                    controller.handleCloseVenueEditor,
                  )
                }
                onDelete={() => {
                  if (!controller.venueEditTarget) return;
                  controller.handleCloseVenueEditor();
                  controller.handleDeleteVenueRequest(
                    controller.venueEditTarget,
                  );
                }}
              />
            ) : (
              <VenueManagementTable
                colors={controller.colors}
                venues={controller.venues}
                isLoading={controller.venuesLoading}
                onEditVenue={(venue) =>
                  controller.handleOpenVenueEditor("edit", venue)
                }
              />
            )
          ) : controller.activeTab === "equipment" ? (
            controller.equipmentManagementNode
          ) : (
            <DndContext
              sensors={controller.sensors}
              onDragStart={controller.handleDragStart}
              onDragEnd={controller.handleDragEnd}
            >
              {controller.isCompact ? (
                <CompactFloorLayout
                  colors={controller.colors}
                  isDrawerOpen={controller.isDrawerOpen}
                  drawerButtonWidth={controller.drawerButtonWidth}
                  onToggleDrawer={() =>
                    controller.setIsDrawerOpen((prev) => !prev)
                  }
                  floorPlanNode={controller.floorPlanNode}
                  drawerNode={
                    <>
                      {controller.equipmentPanelNode}
                      {controller.layoutStatusNode}
                    </>
                  }
                  quickRegionNode={controller.quickRegionNode}
                  editorNode={controller.editorNode}
                />
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 360px)",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: controller.colors.border,
                      borderRadius: 12,
                      padding: 14,
                      minWidth: 0,
                    }}
                  >
                    {controller.floorPlanNode}
                  </div>
                  <div style={{ alignSelf: "start", minWidth: 0 }}>
                    {controller.editorNode}
                  </div>
                </div>
              )}
            </DndContext>
          )}
        </motion.div>
      </div>

      {controller.combinedMessage && (
        <FitText
          style={{
            fontSize: 15,
            color: controller.colors.success,
            fontWeight: 500,
          }}
        >
          {controller.combinedMessage}
        </FitText>
      )}
      <VenueDetailsModal
        venue={controller.selectedFloorVenue}
        isOpen={!!controller.selectedFloorVenue && !controller.isEditMode}
        onClose={() => controller.setSelectedFloorVenue(null)}
      />
      <FacilitiesArchiveModal
        archivedEquipment={controller.archivedEquipment}
        archivedVenues={controller.archivedVenues}
        colors={controller.colors}
        filter={controller.archiveFilter}
        isLoadingEquipment={controller.archivedEquipmentLoading}
        isLoadingVenues={controller.archivedVenuesLoading}
        isOpen={controller.archiveModalOpen}
        isRestoringEquipment={controller.restoreEquipmentMutation.isPending}
        isRestoringVenue={controller.restoreVenueMutation.isPending}
        onClose={() => controller.setArchiveModalOpen(false)}
        onFilterChange={controller.setArchiveFilter}
        onRestoreEquipment={(equipment) =>
          controller.handleRestoreEquipment(equipment)
        }
        onRestoreVenue={(venue) => controller.handleRestoreVenue(venue)}
      />
      <FitModal
        isOpen={controller.resourceModalOpen}
        onClose={() => controller.setResourceModalOpen(false)}
        title="Manage Resources"
        subtitle="Add trainers or facilities to the schedule roster"
        maxWidth={480}
        closeAriaLabel="Close manage resources"
        footer={
          <FitButton
            variant="primary"
            label={
              controller.resourceLoading
                ? controller.resourceLoadingLabel
                : "ADD RESOURCE"
            }
            loading={controller.resourceLoading}
            onClick={controller.handleAddResource}
            style={{ flex: 1 }}
          />
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <FitText
              as="label"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: controller.colors.textPrimary,
                marginBottom: 4,
                display: "block",
              }}
            >
              Resource Name{" "}
              <FitText as="span" style={{ color: controller.colors.danger }}>
                *
              </FitText>
            </FitText>
            <FitTextInput
              value={controller.resourceDraft.name}
              onChange={(e) =>
                controller.setResourceDraft((p) => ({
                  ...p,
                  name: e.target.value,
                }))
              }
              placeholder="e.g., James Wilson"
              style={{
                width: "100%",
                padding: "10px 13px",
                borderRadius: 8,
                border: `1px solid ${controller.colors.fieldBorder}`,
                backgroundColor: controller.colors.fieldBg,
                fontSize: 15,
              }}
            />
          </div>
          <div>
            <FitText
              as="label"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: controller.colors.textPrimary,
                marginBottom: 4,
                display: "block",
              }}
            >
              Type{" "}
              <FitText as="span" style={{ color: controller.colors.danger }}>
                *
              </FitText>
            </FitText>
            <FitSelect
              fullWidth
              value={controller.resourceDraft.type}
              onChange={(e) =>
                controller.setResourceDraft((p) => ({
                  ...p,
                  type: e.target.value as ScheduleResource["type"] | "",
                }))
              }
              placeholder="Select Type"
              options={[
                { label: "Trainer / Staff", value: "trainer" },
                { label: "Facility / Venue", value: "facility" },
              ]}
              style={{
                borderColor: controller.colors.fieldBorder,
                backgroundColor: controller.colors.fieldBg,
              }}
            />
          </div>
          <div>
            <FitText
              as="label"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: controller.colors.textPrimary,
                marginBottom: 4,
                display: "block",
              }}
            >
              Icon
            </FitText>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SCHEDULE_EMOJI_OPTIONS.map((emoji) => (
                <FitButton
                  key={emoji}
                  variant="ghost"
                  onClick={() =>
                    controller.setResourceDraft((p) => ({ ...p, icon: emoji }))
                  }
                  style={{
                    width: 42,
                    height: 42,
                    padding: 0,
                    borderRadius: 9,
                    fontSize: 20,
                    border: `1px solid ${controller.resourceDraft.icon === emoji ? controller.colors.brand : controller.colors.border}`,
                    backgroundColor:
                      controller.resourceDraft.icon === emoji
                        ? `${controller.colors.brand}20`
                        : controller.colors.surfaceRaised,
                  }}
                >
                  <FitText as="span">{emoji}</FitText>
                </FitButton>
              ))}
            </div>
          </div>
          {controller.scheduleResources.length > 0 && (
            <div>
              <FitText
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: controller.colors.textMuted,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                  display: "block",
                }}
              >
                Added Resources
              </FitText>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {controller.scheduleResources.map((resource) => (
                  <div
                    key={resource.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 12px",
                      borderRadius: 9,
                      backgroundColor: controller.colors.surfaceRaised,
                      border: `1px solid ${controller.colors.border}`,
                    }}
                  >
                    <FitText as="span" style={{ fontSize: 18 }}>
                      {resource.icon}
                    </FitText>
                    <FitText style={{ fontSize: 14, flex: 1 }}>
                      {resource.name}
                    </FitText>
                    <FitText
                      style={{
                        fontSize: 12,
                        color: controller.colors.textMuted,
                        textTransform: "capitalize",
                      }}
                    >
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
        isOpen={!!controller.venueDeleteTarget}
        title="Delete Venue"
        message={
          controller.venueDeleteTarget?.isSystem
            ? `${controller.venueDeleteTarget.name} is part of the core floor plan and cannot be removed.`
            : controller.deleteHasReservations
              ? `${controller.venueDeleteTarget?.name ?? "This venue"} has active reservations. Deleting it will immediately cancel them. Proceed?`
              : `Delete ${controller.venueDeleteTarget?.name ?? "this venue"}?`
        }
        confirmLabel="DELETE VENUE"
        loadingLabel="DELETING VENUE"
        loadingTitle="DELETING VENUE"
        isLoading={controller.deleteVenueMutation.isPending}
        isDanger
        onConfirm={() =>
          controller.handleDeleteVenue(controller.venueDeleteTarget, () => {
            controller.setVenueDeleteTarget(null);
            controller.setDeleteHasReservations(false);
          })
        }
        onCancel={() => {
          controller.setVenueDeleteTarget(null);
          controller.setDeleteHasReservations(false);
        }}
      />
      <ConfirmModal
        isOpen={controller.showUnsavedConfirm}
        title="Unsaved Changes"
        message="You have unsaved placed equipment. Save changes before leaving Edit Mode?"
        confirmLabel={CONFIRM_COPY.saveAndExit.confirmLabel}
        onConfirm={() =>
          controller.handleSaveAndExit(() =>
            controller.showVenueMessage("Layout saved."),
          )
        }
        onCancel={() => controller.setShowUnsavedConfirm(false)}
      />
      <ConfirmModal
        isOpen={controller.clearFloorConfirmOpen}
        title="Clear Floor"
        message={`Archive every equipment placement on ${controller.activeFloorLabel}? You can restore archived placements from Manage Archive.`}
        confirmLabel="CLEAR FLOOR"
        loadingLabel="CLEARING FLOOR"
        loadingTitle="CLEARING FLOOR"
        isDanger
        isLoading={controller.deleteEquipmentMutation.isPending}
        onConfirm={controller.handleClearFloor}
        onCancel={() => controller.setClearFloorConfirmOpen(false)}
      />
      <ConfirmModal
        isOpen={!!controller.deleteTarget}
        title="Remove Equipment"
        message={`Remove ${controller.deleteTargetEquipment?.name ?? "this equipment"} from the floor plan?`}
        confirmLabel="REMOVE"
        isDanger
        onConfirm={controller.handleConfirmCellDelete}
        onCancel={() => controller.setDeleteTarget(null)}
      />
    </FitSection>
  );
}
