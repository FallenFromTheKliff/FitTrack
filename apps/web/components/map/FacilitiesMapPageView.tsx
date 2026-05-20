"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type CSSProperties } from "react";
import {
  ArchiveRestore,
  Dumbbell,
  Grid2X2,
  Lock,
  LockOpen,
  MapPinned,
  Minus,
  Plus,
  SlidersHorizontal,
  SquarePen,
  Table2,
} from "lucide-react";

import { CONFIRM_COPY } from "@/utils/confirmCopy";
import {
  SCHEDULE_EMOJI_OPTIONS,
  type ScheduleResource,
} from "@/data/facilities/resources";
import {
  FACILITY_FLOORS,
  type FacilityFloorId,
  type FloorVenueRecord,
} from "@/data/facilities/floorPlans";

import { FitDropdown, FitText, FitTextInput } from "@/components/fit";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitSelect } from "@/components/fit/FitCard";
import { ConfirmModal, FitModal, VenueDetailsContent, VenueDetailsModal } from "@/components/modals";

import {
  EquipmentManagementTable,
  EditVenueModal,
  VenueManagementTable,
} from "@/components/map";
import { FacilitiesArchiveModal } from "@/components/map/FacilitiesArchiveModal";
import type { FacilitiesPageController } from "@/components/map/useFacilitiesPageController";

const FacilitiesKonvaMap = dynamic(() => import("./FacilitiesKonvaMap"), {
  ssr: false,
});

type Props = {
  controller: FacilitiesPageController;
};

const ZOOM_OPTIONS = [
  { label: "75%", value: "0.75" },
  { label: "85%", value: "0.85" },
  { label: "90%", value: "0.9" },
  { label: "100%", value: "1" },
  { label: "125%", value: "1.25" },
];

export default function FacilitiesMapPageView({ controller }: Props) {
  const [zoom, setZoom] = useState("1");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [layoutModalVenue, setLayoutModalVenue] =
    useState<FloorVenueRecord | null>(null);
  const [selectedManagementEquipmentId, setSelectedManagementEquipmentId] =
    useState<string | null>(null);
  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false);
  const selectedVenue = useMemo(
    () => controller.selectedFloorVenue,
    [controller.selectedFloorVenue],
  );
  const selectedManagementEquipment = useMemo(
    () =>
      controller.availableEquipment.find(
        (item) => item.id === selectedManagementEquipmentId,
      ) ?? null,
    [controller.availableEquipment, selectedManagementEquipmentId],
  );
  const activeZoom = Number(zoom);
  const mapZoom = activeZoom * 0.82;
  const topGrid = controller.isCompact
    ? "minmax(0, 1fr)"
    : "minmax(260px, 1fr) 150px auto";

  const handleFloorChange = (value: string) => {
    controller.setActiveFloor(value as FacilityFloorId);
    controller.setSelectedFloorVenue(null);
    setSelectedManagementEquipmentId(null);
    setLayoutModalVenue(null);
    setPan({ x: 0, y: 0 });
    setZoom("1");
  };

  const handleSelectMapVenue = (venue: FloorVenueRecord) => {
    const isSelectedAgain = selectedVenue?.mapId === venue.mapId;
    controller.setSelectedFloorVenue(isSelectedAgain ? null : venue);
    setLayoutModalVenue(!isSelectedAgain && controller.isCompact ? venue : null);
  };

  const modeButtonStyle = (mode: typeof controller.activeTab) => ({
    borderColor:
      controller.activeTab === mode ? controller.colors.brand : controller.colors.border,
    backgroundColor:
      controller.activeTab === mode
        ? `${controller.colors.brand}18`
        : controller.colors.surfaceRaised,
    color:
      controller.activeTab === mode
        ? controller.colors.brand
        : controller.colors.textSecondary,
  });

  const renderTopBar = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: topGrid,
        gap: 10,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            border: `1px solid ${controller.colors.border}`,
            backgroundColor: `${controller.colors.brand}18`,
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
        >
          <Grid2X2 size={27} color={controller.colors.brand} />
        </div>
        <div style={{ minWidth: 0 }}>
          <FitText
            style={{
              color: controller.colors.textPrimary,
              display: "block",
              fontSize: 18,
              fontWeight: 800,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
            }}
          >
            {controller.activeFloorLabel} Layout
          </FitText>
          <FitText
            style={{
              color: controller.colors.textSecondary,
              display: "block",
              fontSize: 13,
              marginTop: 4,
            }}
          >
            {controller.activeFloorConfig.subtitle}
          </FitText>
        </div>
      </div>

      <FitDropdown
        ariaLabel="Facilities floor selector"
        value={controller.activeFloor}
        options={FACILITY_FLOORS.map((floor) => ({
          label: floor.label,
          value: floor.id,
        }))}
        onChange={handleFloorChange}
        style={{ minWidth: controller.isCompact ? "100%" : 120 }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: controller.isCompact
            ? "repeat(3, minmax(0, 1fr))"
            : "repeat(3, auto)",
          gap: 6,
          border: `1px solid ${controller.colors.border}`,
          borderRadius: 10,
          padding: 4,
          backgroundColor: controller.colors.surfaceRaised,
        }}
      >
        <FitButton
          variant="ghost"
          label="Layout"
          icon={Grid2X2}
          onClick={() => controller.setActiveTab("floor")}
          style={modeButtonStyle("floor")}
        />
        <FitButton
          variant="ghost"
          label="Venues"
          icon={MapPinned}
          onClick={() => controller.setActiveTab("venues")}
          style={modeButtonStyle("venues")}
        />
        <FitButton
          variant="ghost"
          label="Equipment"
          icon={SlidersHorizontal}
          onClick={() => controller.setActiveTab("equipment")}
          style={modeButtonStyle("equipment")}
        />
      </div>

    </div>
  );

  const renderMapView = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: controller.isCompact
          ? "minmax(0, 1fr)"
          : "minmax(0, 1fr) minmax(360px, 400px)",
        gap: 12,
        minHeight: 0,
        height: controller.isCompact ? "auto" : "100%",
      }}
    >
      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          display: "grid",
          gridTemplateRows: "minmax(0, 1fr) auto",
          gap: 10,
        }}
      >
        <div
          style={{
            minHeight: controller.isCompact ? 430 : 0,
            border: `1px solid ${controller.colors.border}`,
            borderRadius: 10,
            overflow: "hidden",
            position: "relative",
            backgroundColor: controller.colors.base,
            boxShadow: `inset 0 0 0 1px ${controller.colors.surfaceRaised}`,
          }}
        >
          <FacilitiesKonvaMap
            assignedEquipment={controller.assignedEquipment}
            colors={controller.colors}
            equipmentById={controller.equipmentById}
            floorImageUrl={controller.activeFloorImageUrl}
            isEditMode={controller.isEditMode}
            onAssignEquipmentToVenue={controller.handleAssignEquipmentFromCanvas}
            onMoveVenue={controller.handleMoveVenueFromCanvas}
            onPanChange={setPan}
            onPlaceQuickRegionAtCell={
              controller.handleCreateQuickFloorRegionAtFromCanvas
            }
            onSelectVenue={handleSelectMapVenue}
            pan={pan}
            quickRegionTemplate={controller.quickPlacementTemplate}
            selectedEquipmentId={controller.selectedEquipmentId}
            selectedVenueMapId={selectedVenue?.mapId}
            venues={controller.activeFloorVenues}
            zoom={mapZoom}
          />
          <div
            style={{
              alignItems: "center",
              bottom: 12,
              display: "flex",
              gap: 6,
              position: "absolute",
              right: 12,
              zIndex: 3,
            }}
          >
            <FitButton
              aria-label="Zoom out"
              variant="ghost"
              icon={Minus}
              iconOnly
              onClick={() =>
                setZoom((current) => String(Math.max(0.75, Number(current) - 0.15)))
              }
              style={{ width: 34, height: 34, minHeight: 34, padding: 0 }}
            />
            <FitDropdown
              ariaLabel="Facilities map zoom"
              value={zoom}
              options={ZOOM_OPTIONS}
              onChange={(value) => setZoom(value)}
              style={{ minWidth: 82 }}
            />
            <FitButton
              aria-label="Zoom in"
              variant="ghost"
              icon={Plus}
              iconOnly
              onClick={() =>
                setZoom((current) => String(Math.min(1.25, Number(current) + 0.15)))
              }
              style={{ width: 34, height: 34, minHeight: 34, padding: 0 }}
            />
            <FitButton
              variant={controller.isEditMode ? "primary" : "ghost"}
              label={controller.isEditMode ? "Edit Mode: On" : "Edit Mode: Off"}
              icon={controller.isEditMode ? LockOpen : Lock}
              onClick={controller.handleToggleEditMode}
              style={{ height: 34, minHeight: 34, minWidth: 148 }}
              textStyle={{ fontSize: 12, whiteSpace: "nowrap" }}
            />
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            border: `1px solid ${controller.colors.border}`,
            borderRadius: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
            padding: "10px 14px",
            backgroundColor: controller.colors.surfaceRaised,
          }}
        >
          <FitText style={{ color: controller.colors.textSecondary, fontSize: 12 }}>
            Tip: select a region to inspect details, switch modes for table management, or enable edit mode to move regions.
          </FitText>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {[
              ["Available", controller.colors.success],
              ["Reservable", controller.colors.brand],
              ["Equipment Zone", controller.colors.brandLight],
              ["Support Zone", controller.colors.warning],
            ].map(([label, color]) => (
              <span
                key={label}
                style={{
                  alignItems: "center",
                  color: controller.colors.textSecondary,
                  display: "inline-flex",
                  fontSize: 11,
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 3,
                    backgroundColor: color,
                    display: "inline-block",
                  }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      {!controller.isCompact || controller.isEditMode ? renderLayoutRail() : null}
    </div>
  );

  const rightRailStyle: CSSProperties = {
    border: `1px solid ${controller.colors.border}`,
    borderRadius: 10,
    backgroundColor: controller.colors.surfaceRaised,
    minHeight: 0,
    overflow: "hidden",
    padding: 10,
    display: "grid",
    gap: 10,
    height: controller.isCompact ? "auto" : "100%",
    alignContent: "start",
  };

  const detailCardStyle: CSSProperties = {
    border: `1px solid ${controller.colors.border}`,
    borderRadius: 9,
    padding: 12,
    backgroundColor: controller.colors.surface,
  };

  const renderEmptyRightCard = (title: string, copy: string) => (
    <aside
      style={{
        ...rightRailStyle,
        alignContent: "center",
        justifyItems: "center",
        padding: 18,
      }}
    >
      <div
        style={{
          maxWidth: 270,
          textAlign: "center",
        }}
      >
        <MapPinned size={28} color={controller.colors.textMuted} />
        <FitText
          style={{
            display: "block",
            fontSize: 16,
            fontWeight: 850,
            marginTop: 12,
          }}
        >
          {title}
        </FitText>
        <FitText
          style={{
            color: controller.colors.textSecondary,
            display: "block",
            fontSize: 13,
            lineHeight: 1.5,
            marginTop: 6,
          }}
        >
          {copy}
        </FitText>
      </div>
    </aside>
  );

  const renderLayoutRail = () => {
    if (!controller.isEditMode) {
      if (selectedVenue && !controller.isCompact) {
        return renderVenueDetailCard();
      }

      return renderEmptyRightCard(
        "No venue selected",
        "Select a venue on the map to review its details here. Hamburger mode opens the same details in a modal.",
      );
    }

    return (
      <aside
        style={{
          ...rightRailStyle,
          gridTemplateRows: controller.isCompact ? undefined : "auto minmax(0, 1fr)",
        }}
      >
      <div
        style={{
          ...detailCardStyle,
          display: "grid",
          gap: 6,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <FitText style={{ display: "block", fontSize: 13, fontWeight: 800 }}>
          Quick Actions
        </FitText>
        <FitButton
          variant="ghost"
          label="Edit Region"
          icon={SquarePen}
          fullWidth
          disabled={!selectedVenue}
          style={{ height: 30, minHeight: 30 }}
          textStyle={{ fontSize: 12, whiteSpace: "nowrap" }}
          onClick={() => {
            if (!selectedVenue) return;
            controller.handleOpenVenueEditor("edit", selectedVenue);
          }}
        />
        <FitButton
          variant="ghost"
          label="Open Venue Management"
          icon={Table2}
          fullWidth
          style={{ height: 30, minHeight: 30 }}
          textStyle={{ fontSize: 12, whiteSpace: "nowrap" }}
          onClick={() => controller.setActiveTab("venues")}
        />
        <FitButton
          variant="ghost"
          label="Assign Equipment"
          icon={Dumbbell}
          fullWidth
          style={{ height: 30, minHeight: 30 }}
          textStyle={{ fontSize: 12, whiteSpace: "nowrap" }}
          onClick={() => controller.setActiveTab("equipment")}
        />
      </div>

      <div
        style={{
          ...detailCardStyle,
          display: "grid",
          gap: 7,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <FitText style={{ display: "block", fontSize: 14, fontWeight: 800 }}>
          Available Equipment
        </FitText>
        {controller.availableEquipment.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const remaining = controller.equipmentRemainingById[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => controller.handlePlaceEquipmentFromManager(item.id)}
              style={{
                alignItems: "center",
                backgroundColor:
                  controller.selectedEquipmentId === item.id
                    ? `${controller.colors.brand}18`
                    : controller.colors.surfaceRaised,
                border: `1px solid ${controller.selectedEquipmentId === item.id ? controller.colors.brand : controller.colors.border}`,
                borderRadius: 8,
                color: controller.colors.textPrimary,
                cursor: "pointer",
                display: "grid",
                gap: 7,
                gridTemplateColumns: "22px minmax(0, 1fr) auto",
                minHeight: 43,
                padding: "5px 8px",
                textAlign: "left",
              }}
            >
              <Icon size={16} color={item.color} />
              <span style={{ minWidth: 0 }}>
                <FitText
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 800,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </FitText>
                <FitText
                  style={{
                    color: controller.colors.textSecondary,
                    display: "block",
                    fontSize: 9,
                  }}
                >
                  {item.category}
                </FitText>
              </span>
              <span style={{ textAlign: "right" }}>
                <FitText style={{ display: "block", fontSize: 11, fontWeight: 800 }}>
                  {remaining ?? "-"}
                </FitText>
                <FitText
                  style={{
                    color: controller.colors.textSecondary,
                    display: "block",
                    fontSize: 8,
                  }}
                >
                  Remaining
                </FitText>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
    );
  };

  const renderVenueDetailCard = () => {
    if (!selectedVenue) {
      return renderEmptyRightCard(
        "No venue selected",
        "Select a venue from the table to review its details here.",
      );
    }

    return (
      <aside
        style={{
          ...rightRailStyle,
          alignContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 10,
            minHeight: 0,
          }}
        >
          <VenueDetailsContent venue={selectedVenue} variant="rail" />
          <FitButton
            variant="primary"
            label="Edit Venue"
            icon={SquarePen}
            fullWidth
            style={{ minHeight: 36 }}
            textStyle={{ fontSize: 12, fontWeight: 800 }}
            onClick={() => controller.handleOpenVenueEditor("edit", selectedVenue)}
          />
        </div>
      </aside>
    );
  };

  const renderEquipmentDetailsContent = (
    equipment: NonNullable<typeof selectedManagementEquipment>,
    compact = false,
    showAction = true,
    showHeader = true,
  ) => {
    const Icon = equipment.icon;
    const remaining = controller.equipmentRemainingById[equipment.id] ?? null;
    const total = equipment.quantityAvailable ?? null;
    const details = [
      ["Source", equipment.sourceLabel === "inventory" ? "Inventory" : "Map palette"],
      ["Available", remaining === null ? "Palette item" : String(remaining)],
      ["Total", total === null ? "-" : String(total)],
      ["Status", remaining !== null && remaining <= 0 ? "Fully placed" : "Placeable"],
    ];

    return (
      <div
        style={{
          alignContent: compact ? "center" : undefined,
          display: "grid",
          gap: compact ? 10 : 14,
          justifyItems: compact ? "center" : undefined,
          minWidth: 0,
          textAlign: compact ? "center" : "left",
        }}
      >
        {showHeader ? (
          <div
            style={{
              alignItems: "center",
              display: compact ? "grid" : "flex",
              gap: compact ? 8 : 12,
              justifyItems: compact ? "center" : undefined,
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: compact ? 46 : 42,
                height: compact ? 46 : 42,
                borderRadius: 9,
                display: "grid",
                placeItems: "center",
                backgroundColor: `${controller.colors.brand}18`,
              }}
            >
              <Icon size={compact ? 22 : 21} color={equipment.color} />
            </span>
            <div style={{ minWidth: 0 }}>
              <FitText style={{ display: "block", fontSize: compact ? 16 : 16, fontWeight: 850 }}>
                {equipment.name}
              </FitText>
              <FitText
                style={{
                  color: controller.colors.textSecondary,
                  display: "block",
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                {equipment.category}
              </FitText>
            </div>
          </div>
        ) : null}
        <div
          style={{
            display: "grid",
            gap: compact ? 7 : 8,
            gridTemplateColumns: compact ? "repeat(2, minmax(0, 1fr))" : undefined,
            width: "100%",
          }}
        >
          {details.map(([label, value]) => (
            <div
              key={label}
              style={{
                border: compact ? `1px solid ${controller.colors.border}` : undefined,
                borderRadius: compact ? 8 : undefined,
                backgroundColor: compact ? controller.colors.surfaceRaised : undefined,
                display: compact ? "grid" : "flex",
                gap: compact ? 3 : 10,
                justifyContent: compact ? "center" : "space-between",
                minWidth: 0,
                padding: compact ? "8px 9px" : undefined,
              }}
            >
              <FitText style={{ color: controller.colors.textSecondary, fontSize: compact ? 9.5 : 12 }}>
                {label}
              </FitText>
              <FitText style={{ fontSize: compact ? 12 : 12, fontWeight: 750, textAlign: compact ? "center" : "right" }}>
                {value}
              </FitText>
            </div>
          ))}
        </div>
        {showAction ? (
          <FitButton
            variant="primary"
            label="Place Equipment"
            icon={Dumbbell}
            fullWidth
            disabled={remaining !== null && remaining <= 0}
            style={{ minHeight: compact ? 36 : 40 }}
            textStyle={{ fontSize: 12, fontWeight: 800 }}
            onClick={() => controller.handlePlaceEquipmentFromManager(equipment.id)}
          />
        ) : null}
      </div>
    );
  };

  const renderEquipmentDetailCard = () => {
    if (!selectedManagementEquipment) {
      return renderEmptyRightCard(
        "No equipment selected",
        "Select an equipment row to review placement availability and source details.",
      );
    }

    return (
      <aside
        style={{
          ...rightRailStyle,
          alignContent: "center",
          overflow: "hidden",
        }}
      >
        <div style={{ ...detailCardStyle, display: "grid", gap: 10 }}>
          {renderEquipmentDetailsContent(selectedManagementEquipment, true)}
        </div>
      </aside>
    );
  };

  const renderVenuesView = () => (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateRows: controller.isCompact ? undefined : "auto minmax(0, 1fr)",
        height: controller.isCompact ? "auto" : "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <FitText style={{ color: controller.colors.textSecondary, fontSize: 13 }}>
          Venue records for {controller.activeFloorLabel}. Selection and edits stay backed by the venue API.
        </FitText>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FitButton
            variant="ghost"
            label="Manage Archive"
            icon={ArchiveRestore}
            onClick={() => controller.setArchiveModalOpen(true)}
          />
          <FitButton
            variant="primary"
            label="Add Venue"
            icon={Plus}
            onClick={() => controller.handleOpenVenueEditor("create")}
          />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: controller.isCompact
            ? "minmax(0, 1fr)"
            : "minmax(0, 1fr) minmax(340px, 380px)",
          minHeight: 0,
          height: controller.isCompact ? "auto" : "100%",
        }}
      >
        <VenueManagementTable
          colors={controller.colors}
          venues={controller.activeFloorVenues}
          isLoading={controller.venuesLoading}
          embedded
          onEditVenue={(venue) => controller.handleOpenVenueEditor("edit", venue)}
          onSelectVenue={(venue) =>
            {
              const isSelectedAgain = selectedVenue?.id === venue.id;
              controller.setSelectedFloorVenue(isSelectedAgain ? null : venue);
              setLayoutModalVenue(!isSelectedAgain && controller.isCompact ? venue : null);
            }
          }
          selectedVenueId={selectedVenue?.id}
        />
        {controller.isCompact ? null : renderVenueDetailCard()}
      </div>
    </div>
  );

  const renderEquipmentView = () => (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateRows: controller.isCompact ? undefined : "auto minmax(0, 1fr)",
        height: controller.isCompact ? "auto" : "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <FitText style={{ color: controller.colors.textSecondary, fontSize: 13 }}>
          Equipment placement uses live inventory-backed availability and saves into the floor layout.
        </FitText>
        <FitButton
          variant="ghost"
          label="Manage Archive"
          icon={ArchiveRestore}
          onClick={() => controller.setArchiveModalOpen(true)}
        />
      </div>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: controller.isCompact
            ? "minmax(0, 1fr)"
            : "minmax(0, 1fr) minmax(340px, 380px)",
          minHeight: 0,
          height: controller.isCompact ? "auto" : "100%",
        }}
      >
        <EquipmentManagementTable
          colors={controller.colors}
          equipment={controller.availableEquipment}
          equipmentRemainingById={controller.equipmentRemainingById}
          embedded
          onPlaceEquipment={controller.handlePlaceEquipmentFromManager}
          onSelectEquipment={(equipment) => {
            const nextId =
              selectedManagementEquipmentId === equipment.id ? null : equipment.id;
            setSelectedManagementEquipmentId(nextId);
            setEquipmentModalOpen(Boolean(nextId && controller.isCompact));
          }}
          selectedEquipmentId={selectedManagementEquipmentId}
        />
        {controller.isCompact ? null : renderEquipmentDetailCard()}
      </div>
    </div>
  );

  const renderVenueEditorSurface = () => (
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
      backLabel={
        controller.venueEditorReturnTab === "floor"
          ? "Back to Layout"
          : controller.venueEditorReturnTab === "equipment"
            ? "Back to Equipment"
            : "Back to Venues"
      }
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
        controller.handleDeleteVenueRequest(controller.venueEditTarget);
      }}
      onBack={controller.handleCloseVenueEditor}
    />
  );

  return (
    <FitSection
      as="section"
      heading=""
      hideHeading
      bare
      noPadding
      className={controller.themeTransition}
      style={{
        ...controller.fadeIn,
        height: controller.isCompact ? "auto" : "calc(100vh - 154px)",
        marginBottom: 0,
        minHeight: 0,
        overflow: controller.isCompact ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: controller.isVenueEditorOpen
            ? "minmax(0, 1fr)"
            : "auto minmax(0, 1fr)",
          gap: 12,
          height: controller.isCompact ? "auto" : "100%",
          minHeight: 0,
          overflow: controller.isCompact ? "visible" : "hidden",
        }}
      >
        {!controller.isVenueEditorOpen ? (
          <div
            style={{
              ...controller.fs.mapCard,
              padding: controller.isCompact ? 12 : 14,
            }}
          >
            {renderTopBar()}
          </div>
        ) : null}
        <div
          style={{
            ...controller.fs.mapCard,
            display: "grid",
            gridTemplateRows: "minmax(0, 1fr)",
            minHeight: 0,
            overflow: controller.isCompact ? "visible" : "hidden",
            padding: controller.isCompact ? 12 : 14,
            position: "relative",
          }}
        >
          <div
            style={{
              height: controller.isCompact ? "auto" : "100%",
              minHeight: 0,
              overflow: controller.isCompact ? "visible" : "hidden",
            }}
          >
            {controller.activeTab === "venues"
              ? controller.isVenueEditorOpen
                ? renderVenueEditorSurface()
                : renderVenuesView()
              : controller.activeTab === "equipment"
                ? renderEquipmentView()
                : renderMapView()}
          </div>
        </div>
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
        venue={layoutModalVenue}
        isOpen={
          !!layoutModalVenue &&
          (controller.activeTab === "floor" || controller.activeTab === "venues") &&
          controller.isCompact
        }
        onClose={() => {
          setLayoutModalVenue(null);
        }}
      />
      <FitModal
        isOpen={equipmentModalOpen && controller.isCompact && !!selectedManagementEquipment}
        onClose={() => setEquipmentModalOpen(false)}
        title={selectedManagementEquipment?.name ?? "Equipment details"}
        subtitle={selectedManagementEquipment?.category ?? "Placement details"}
        icon={selectedManagementEquipment?.icon}
        maxWidth={460}
        closeAriaLabel="Close equipment details"
        footer={selectedManagementEquipment ? (
          <FitButton
            variant="primary"
            label="Place Equipment"
            icon={Dumbbell}
            disabled={
              (controller.equipmentRemainingById[selectedManagementEquipment.id] ?? null) !== null &&
              (controller.equipmentRemainingById[selectedManagementEquipment.id] ?? 0) <= 0
            }
            onClick={() => controller.handlePlaceEquipmentFromManager(selectedManagementEquipment.id)}
            style={{ flex: 1 }}
            textStyle={{ fontSize: 12, fontWeight: 800 }}
          />
        ) : undefined}
      >
        {selectedManagementEquipment
          ? renderEquipmentDetailsContent(selectedManagementEquipment, false, false, false)
          : null}
      </FitModal>
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
