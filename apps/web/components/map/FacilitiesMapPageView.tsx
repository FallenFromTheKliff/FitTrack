"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getVenueBookingBlockReason } from "@fittrack/api-client";
import {
  CheckCircle2,
  Dumbbell,
  Grid2X2,
  Hand,
  Lock,
  LockOpen,
  MapPinned,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Route,
  Scan,
  Search,
  Smartphone,
  SquarePen,
  Trash2,
} from "lucide-react";

import {
  FACILITY_FLOORS,
  FACILITY_FLOOR_MAP,
  type FacilityFloorId,
  type FloorVenueRecord,
} from "@/data/facilities/floorPlans";
import { COLS, ROWS } from "@/data/facilities/mapTypes";

import { FitDropdown, FitText, FitTextInput } from "@/components/fit";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import {
  ConfirmModal,
  DetailsModal,
  FitModal,
  VenueDetailsContent,
  VenueDetailsModal,
} from "@/components/modals";
import {
  INVENTORY_EQUIPMENT_EDIT_FIELDS,
  validateInventoryEquipmentDetailForm,
} from "@/data/inventory/inventory";

import { EditVenueModal } from "@/components/map";
import { FacilitiesArchiveModal } from "@/components/map/FacilitiesArchiveModal";
import { FacilitiesVenuesTable } from "@/components/map/FacilitiesVenuesTable";
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

function EquipmentInspectorImage({
  color,
  name,
  src,
}: {
  color: string;
  name: string;
  src?: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  if (!src || imageFailed) {
    return (
      <Dumbbell size={19} color={color} aria-label={name + " image fallback"} />
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setImageFailed(true)}
      style={{ height: "100%", objectFit: "cover", width: "100%" }}
    />
  );
}

export default function FacilitiesMapPageView({ controller }: Props) {
  const [zoom, setZoom] = useState("1");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [assetRailTab, setAssetRailTab] = useState<
    "equipment" | "venues" | "paths"
  >("equipment");
  const [canvasTool, setCanvasTool] = useState<"select" | "pan">("select");
  const [layoutModalVenue, setLayoutModalVenue] =
    useState<FloorVenueRecord | null>(null);
  const [selectedPlacedEquipmentId, setSelectedPlacedEquipmentId] = useState<
    string | null
  >(null);
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [equipmentCategoryFilter, setEquipmentCategoryFilter] = useState("all");
  const [equipmentEditorOpen, setEquipmentEditorOpen] = useState(false);
  const [equipmentMapRemovalTarget, setEquipmentMapRemovalTarget] = useState<
    (typeof controller.liveEquipment)[number] | null
  >(null);
  const [venueMapRemovalTarget, setVenueMapRemovalTarget] =
    useState<FloorVenueRecord | null>(null);
  const [equipmentMaintenanceTarget, setEquipmentMaintenanceTarget] = useState<
    (typeof controller.liveEquipment)[number] | null
  >(null);
  const [venueMaintenanceTarget, setVenueMaintenanceTarget] =
    useState<FloorVenueRecord | null>(null);
  const maintenanceAffectedBookings = useMemo(() => {
    if (
      !venueMaintenanceTarget ||
      venueMaintenanceTarget.status === "maintenance"
    ) {
      return [];
    }
    const venueId = String(
      venueMaintenanceTarget.sourceVenueId ?? venueMaintenanceTarget.id,
    );
    const now = Date.now();
    return controller.activeBookings
      .filter(
        (booking) =>
          String(booking.venueId) === venueId &&
          new Date(booking.endTime).getTime() > now,
      )
      .sort(
        (left, right) =>
          new Date(left.startTime).getTime() -
          new Date(right.startTime).getTime(),
      );
  }, [controller.activeBookings, venueMaintenanceTarget]);
  const selectedVenue = useMemo(
    () => controller.selectedFloorVenue,
    [controller.selectedFloorVenue],
  );
  const selectedPlacedEquipment = useMemo(
    () =>
      controller.liveEquipment.find(
        (item) => item.id === selectedPlacedEquipmentId,
      ) ?? null,
    [controller.liveEquipment, selectedPlacedEquipmentId],
  );
  const selectedVenueBookings = useMemo(() => {
    if (!selectedVenue) return [];
    const venueId = String(selectedVenue.sourceVenueId ?? selectedVenue.id);
    return controller.activeBookings
      .filter((booking) => String(booking.venueId) === venueId)
      .sort(
        (left, right) =>
          new Date(left.startTime).getTime() -
          new Date(right.startTime).getTime(),
      );
  }, [controller.activeBookings, selectedVenue]);
  const selectedInventoryEquipment = useMemo(
    () =>
      selectedPlacedEquipment?.inventoryItemId
        ? (controller.availableEquipment.find(
            (item) => item.id === selectedPlacedEquipment.inventoryItemId,
          ) ?? null)
        : null,
    [controller.availableEquipment, selectedPlacedEquipment],
  );
  const selectedInventoryRecord = useMemo(
    () =>
      selectedPlacedEquipment?.inventoryItemId
        ? (controller.inventoryEquipment.find(
            (item) => item.id === selectedPlacedEquipment.inventoryItemId,
          ) ?? null)
        : null,
    [controller.inventoryEquipment, selectedPlacedEquipment],
  );
  const facilityEquipmentEditFields = useMemo(
    () =>
      INVENTORY_EQUIPMENT_EDIT_FIELDS.map((field) =>
        field.name === "status"
          ? {
              ...field,
              hint: "Status quantities remain managed in Inventory.",
              readOnly: true,
            }
          : field,
      ),
    [],
  );

  useEffect(() => {
    if (selectedPlacedEquipmentId && !selectedPlacedEquipment) {
      setSelectedPlacedEquipmentId(null);
    }
  }, [selectedPlacedEquipment, selectedPlacedEquipmentId]);

  const activeFloorVenues = controller.activeFloorVenues;
  const setSelectedFloorVenue = controller.setSelectedFloorVenue;
  useEffect(() => {
    if (
      selectedVenue &&
      !activeFloorVenues.some((venue) => venue.mapId === selectedVenue.mapId)
    ) {
      setSelectedFloorVenue(null);
      setLayoutModalVenue(null);
    }
  }, [activeFloorVenues, selectedVenue, setSelectedFloorVenue]);
  const equipmentCategories = useMemo(
    () =>
      Array.from(
        new Set(controller.availableEquipment.map((item) => item.category)),
      ).sort((left, right) => left.localeCompare(right)),
    [controller.availableEquipment],
  );
  const filteredAvailableEquipment = useMemo(() => {
    const query = equipmentSearch.trim().toLowerCase();
    return controller.availableEquipment.filter((item) => {
      const matchesCategory =
        equipmentCategoryFilter === "all" ||
        item.category === equipmentCategoryFilter;
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [controller.availableEquipment, equipmentCategoryFilter, equipmentSearch]);
  const availableEquipmentCategories = [
    { label: "All categories", value: "all" },
    ...equipmentCategories.map((category) => ({
      label: category,
      value: category,
    })),
  ];
  const filteredRegionTemplates = useMemo(() => {
    const query = equipmentSearch.trim().toLowerCase();
    return controller.quickRegionTemplates.filter((template) => {
      const isPath = template.key === "walkway";
      if (assetRailTab === "paths" ? !isPath : isPath) return false;
      return (
        !query ||
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query)
      );
    });
  }, [assetRailTab, controller.quickRegionTemplates, equipmentSearch]);
  const selectedPlacedEquipmentVenue = useMemo(
    () =>
      selectedPlacedEquipment
        ? (controller.activeFloorVenues.find(
            (venue) =>
              venue.mapId === selectedPlacedEquipment.venueId ||
              String(venue.sourceVenueId ?? venue.id) ===
                selectedPlacedEquipment.venueId,
          ) ?? null)
        : null,
    [controller.activeFloorVenues, selectedPlacedEquipment],
  );
  const activeZoom = Number(zoom);
  const mapZoom = activeZoom * 0.82;
  const activeCanvasTool = controller.quickPlacementTemplate
    ? controller.quickPlacementTemplate.key === "walkway"
      ? "path"
      : "region"
    : canvasTool;

  const handleFloorChange = (value: string) => {
    controller.setActiveFloor(value as FacilityFloorId);
    controller.setSelectedFloorVenue(null);
    setSelectedPlacedEquipmentId(null);
    setLayoutModalVenue(null);
    setPan({ x: 0, y: 0 });
    setZoom("1");
    setCanvasTool("select");
    controller.handleClearCanvasPlacement();
  };

  const handleSelectCanvasTool = (tool: "select" | "pan") => {
    controller.handleClearCanvasPlacement();
    setCanvasTool(tool);
  };

  const handleActivateQuickTool = (templateKey: string) => {
    const template = controller.quickRegionTemplates.find(
      (candidate) => candidate.key === templateKey,
    );
    if (!template) return;
    setCanvasTool("select");
    controller.handleToggleQuickPlacementTemplate(template);
  };

  const handleFitView = () => {
    setPan({ x: 0, y: 0 });
    setZoom("1");
  };

  const handlePreviewMobileMap = () => {
    const previewUrl = new URL(window.location.href);
    previewUrl.searchParams.set("preview", "mobile");
    const preview = window.open(
      previewUrl.toString(),
      "fittrack-facilities-mobile-preview",
      "popup,width=430,height=900",
    );
    preview?.focus();
  };

  const handleSelectMapVenue = (venue: FloorVenueRecord) => {
    const isSelectedAgain = selectedVenue?.mapId === venue.mapId;
    controller.setSelectedFloorVenue(isSelectedAgain ? null : venue);
    setSelectedPlacedEquipmentId(null);
    setLayoutModalVenue(
      !isSelectedAgain && controller.isCompact ? venue : null,
    );
  };

  const handleSelectMapEquipment = (
    equipment: (typeof controller.liveEquipment)[number],
  ) => {
    setSelectedPlacedEquipmentId((current) =>
      current === equipment.id ? null : equipment.id,
    );
    controller.setSelectedFloorVenue(null);
    setLayoutModalVenue(null);
  };

  const modeButtonStyle = (mode: typeof controller.activeTab) => ({
    borderColor:
      controller.activeTab === mode
        ? controller.colors.brand
        : controller.colors.border,
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
        gridTemplateColumns: controller.isCompact
          ? "minmax(0, 1fr)"
          : "minmax(220px, 1fr) 150px auto auto auto",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}
      >
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
            Facilities Planner
          </FitText>
          <FitText
            style={{
              color: controller.colors.textSecondary,
              display: "block",
              fontSize: 13,
              marginTop: 4,
            }}
          >
            Build and maintain the gym floor map.
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
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(2, auto)",
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
      </div>
      <div
        style={{
          alignItems: "center",
          color: controller.colors.success,
          display: "inline-flex",
          fontSize: 11,
          fontWeight: 750,
          gap: 6,
          justifyContent: controller.isCompact ? "flex-start" : "center",
          whiteSpace: "nowrap",
        }}
      >
        <CheckCircle2 size={16} />
        {controller.hasUnsavedChanges ? "Saving changes" : "All changes saved"}
      </div>
      <FitButton
        variant="primary"
        label="Preview mobile map"
        icon={Smartphone}
        onClick={handlePreviewMobileMap}
        style={{ minHeight: 38, whiteSpace: "nowrap" }}
      />
    </div>
  );

  const renderMapView = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: controller.isCompact
          ? "minmax(0, 1fr)"
          : "240px minmax(0, 1fr) 300px",
        gap: 12,
        minHeight: 0,
        height: controller.isCompact ? "auto" : "100%",
      }}
    >
      <style jsx global>{`
        .facilities-asset-scroll {
          scrollbar-width: none;
        }
        .facilities-asset-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {renderAssetRail()}
      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          gap: 10,
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            minWidth: 0,
          }}
        >
          <FitButton
            variant={activeCanvasTool === "select" ? "primary" : "ghost"}
            label="Select"
            icon={MousePointer2}
            onClick={() => handleSelectCanvasTool("select")}
            style={{ minHeight: 34 }}
          />
          <FitButton
            variant={activeCanvasTool === "pan" ? "primary" : "ghost"}
            label="Pan"
            icon={Hand}
            onClick={() => handleSelectCanvasTool("pan")}
            style={{ minHeight: 34 }}
          />
          <FitButton
            variant={activeCanvasTool === "path" ? "primary" : "ghost"}
            label="Path"
            icon={Route}
            disabled={!controller.isEditMode}
            onClick={() => handleActivateQuickTool("walkway")}
            style={{ minHeight: 34 }}
          />
          <FitButton
            variant={activeCanvasTool === "region" ? "primary" : "ghost"}
            label={
              activeCanvasTool === "region"
                ? "Cancel Quick Region"
                : "Quick Region"
            }
            icon={Scan}
            disabled={!controller.isEditMode}
            onClick={() => handleActivateQuickTool("general-floor")}
            style={{ minHeight: 34 }}
          />
          <FitButton
            variant="ghost"
            label="Fit view"
            icon={Maximize2}
            onClick={handleFitView}
            style={{ minHeight: 34 }}
          />
          <FitButton
            variant={controller.isEditMode ? "primary" : "ghost"}
            label={controller.isEditMode ? "Editing" : "Edit layout"}
            icon={controller.isEditMode ? LockOpen : Lock}
            onClick={controller.handleToggleEditMode}
            style={{
              marginLeft: controller.isCompact ? 0 : "auto",
              minHeight: 34,
            }}
          />
        </div>
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
            equipment={controller.liveEquipment}
            floorBounds={controller.activeFloorBounds}
            floorImageUrl={controller.activeFloorImageUrl}
            isEditMode={controller.isEditMode && activeCanvasTool !== "pan"}
            onAssignEquipmentToVenue={
              controller.handleAssignEquipmentFromCanvas
            }
            onDropEquipmentToVenue={controller.handleAssignEquipmentFromCanvas}
            onMoveEquipment={controller.handleMoveEquipmentFromCanvas}
            onMoveVenue={controller.handleMoveVenueFromCanvas}
            onResizeFloorBounds={controller.handleResizeFloorBounds}
            onResizeVenue={controller.handleResizeRegionByMapId}
            onPanChange={setPan}
            onPlaceQuickRegionAtCell={
              controller.handleCreateQuickFloorRegionAtFromCanvas
            }
            onSelectVenue={
              activeCanvasTool === "pan"
                ? () => undefined
                : handleSelectMapVenue
            }
            onSelectEquipment={
              activeCanvasTool === "pan"
                ? () => undefined
                : handleSelectMapEquipment
            }
            pan={pan}
            quickRegionTemplate={controller.quickPlacementTemplate}
            selectedEquipmentId={controller.selectedEquipmentId}
            selectedVenueMapId={selectedVenue?.mapId}
            venues={controller.activeFloorVenues}
            zoom={mapZoom}
          />
          {!controller.isCompact ? (
            <div
              aria-label="Facilities minimap"
              style={{
                backgroundColor: `${controller.colors.base}E6`,
                border: `1px solid ${controller.colors.border}`,
                borderRadius: 8,
                bottom: 58,
                height: 76,
                overflow: "hidden",
                position: "absolute",
                right: 12,
                width: 116,
                zIndex: 3,
              }}
            >
              {controller.activeFloorVenues.map((venue) => (
                <span
                  key={venue.mapId}
                  style={{
                    backgroundColor:
                      selectedVenue?.mapId === venue.mapId
                        ? controller.colors.brand
                        : `${controller.colors.textMuted}99`,
                    borderRadius: 2,
                    height: `${Math.max(8, ((venue.gridHeight ?? 1) / ROWS) * 100)}%`,
                    left: `${(((venue.gridColumn ?? 1) - 1) / COLS) * 100}%`,
                    position: "absolute",
                    top: `${(((venue.gridRow ?? 1) - 1) / ROWS) * 100}%`,
                    width: `${Math.max(8, ((venue.gridWidth ?? 1) / COLS) * 100)}%`,
                  }}
                />
              ))}
            </div>
          ) : null}
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
                setZoom((current) => {
                  const currentIndex = ZOOM_OPTIONS.findIndex(
                    (option) => option.value === current,
                  );
                  return (
                    ZOOM_OPTIONS[Math.max(0, currentIndex - 1)]?.value ?? "0.75"
                  );
                })
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
                setZoom((current) => {
                  const currentIndex = ZOOM_OPTIONS.findIndex(
                    (option) => option.value === current,
                  );
                  return (
                    ZOOM_OPTIONS[
                      Math.min(ZOOM_OPTIONS.length - 1, currentIndex + 1)
                    ]?.value ?? "1.25"
                  );
                })
              }
              style={{ width: 34, height: 34, minHeight: 34, padding: 0 }}
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
          <FitText
            style={{ color: controller.colors.textSecondary, fontSize: 12 }}
          >
            Tip: select a region or placed item to inspect details, then enable
            edit mode to move nodes or place inventory.
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
      {!controller.isCompact || selectedVenue || selectedPlacedEquipment
        ? renderLayoutRail()
        : null}
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

  const renderAvailableEquipmentPanel = () => (
    <div
      style={{
        ...detailCardStyle,
        display: "grid",
        gap: 8,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          alignItems: "baseline",
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <FitText style={{ display: "block", fontSize: 14, fontWeight: 800 }}>
          Available Equipment
        </FitText>
        <FitText
          style={{ color: controller.colors.textSecondary, fontSize: 11 }}
        >
          {filteredAvailableEquipment.length}/
          {controller.availableEquipment.length}
        </FitText>
      </div>
      <div style={{ display: "grid", gap: 7 }}>
        <FitDropdown
          ariaLabel="Filter available equipment"
          compact
          fullWidth
          value={equipmentCategoryFilter}
          options={availableEquipmentCategories}
          onChange={setEquipmentCategoryFilter}
          style={{ minWidth: 0 }}
        />
      </div>
      <div
        className="facilities-asset-scroll"
        style={{
          display: "grid",
          gap: 7,
          minHeight: 0,
          maxHeight: controller.isCompact ? 330 : "none",
          overflowY: "auto",
          paddingRight: 3,
        }}
      >
        {filteredAvailableEquipment.length > 0 ? (
          filteredAvailableEquipment.map((item) => {
            const Icon = item.icon;
            const remaining = controller.equipmentRemainingById[item.id];
            const isFullyPlaced = remaining !== null && remaining <= 0;
            const isSelected = controller.selectedEquipmentId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                draggable={!isFullyPlaced}
                disabled={isFullyPlaced}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "copy";
                  event.dataTransfer.setData(
                    "application/x-fittrack-equipment-id",
                    item.id,
                  );
                  event.dataTransfer.setData("text/plain", item.id);
                }}
                onClick={() =>
                  controller.handlePlaceEquipmentFromManager(item.id)
                }
                style={{
                  alignItems: "center",
                  backgroundColor: isSelected
                    ? `${controller.colors.brand}18`
                    : controller.colors.surfaceRaised,
                  border: `1px solid ${isSelected ? controller.colors.brand : controller.colors.border}`,
                  borderRadius: 8,
                  color: controller.colors.textPrimary,
                  cursor: isFullyPlaced ? "not-allowed" : "grab",
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "30px minmax(0, 1fr) auto",
                  minHeight: 48,
                  opacity: isFullyPlaced ? 0.55 : 1,
                  padding: "6px 8px",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    alignItems: "center",
                    backgroundColor: `${item.color}18`,
                    borderRadius: 7,
                    display: "flex",
                    height: 30,
                    justifyContent: "center",
                    overflow: "hidden",
                    width: 30,
                  }}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      style={{
                        height: "100%",
                        objectFit: "cover",
                        width: "100%",
                      }}
                    />
                  ) : (
                    <Icon size={16} color={item.color} />
                  )}
                </span>
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
                      marginTop: 2,
                    }}
                  >
                    {item.category}
                  </FitText>
                </span>
                <span style={{ textAlign: "right" }}>
                  <FitText
                    style={{ display: "block", fontSize: 12, fontWeight: 850 }}
                  >
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
          })
        ) : (
          <FitText
            style={{
              color: controller.colors.textSecondary,
              fontSize: 12,
              lineHeight: 1.45,
              padding: 12,
              textAlign: "center",
            }}
          >
            No available equipment matches this filter.
          </FitText>
        )}
      </div>
    </div>
  );

  const renderAssetRail = () => {
    const assetTabs = [
      { label: "Equipment", value: "equipment" as const },
      { label: "Venues", value: "venues" as const },
      { label: "Paths", value: "paths" as const },
    ];

    return (
      <aside
        style={{
          ...rightRailStyle,
          gridTemplateRows: "auto auto auto minmax(0, 1fr)",
          padding: 10,
        }}
      >
        <div
          style={{
            alignItems: "baseline",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <FitText style={{ fontSize: 13, fontWeight: 850 }}>
            Asset Library
          </FitText>
          <FitText style={{ color: controller.colors.textMuted, fontSize: 10 }}>
            {controller.activeFloorLabel}
          </FitText>
        </div>
        <div style={{ position: "relative" }}>
          <Search
            aria-hidden="true"
            size={15}
            color={controller.colors.textMuted}
            style={{ left: 9, position: "absolute", top: 11, zIndex: 1 }}
          />
          <FitTextInput
            aria-label="Search facilities assets"
            value={equipmentSearch}
            onChange={(event) => setEquipmentSearch(event.target.value)}
            placeholder="Search assets"
            style={{ minHeight: 36, paddingLeft: 30, width: "100%" }}
          />
        </div>
        <div
          style={{
            display: "grid",
            gap: 4,
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          }}
        >
          {assetTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setAssetRailTab(tab.value)}
              style={{
                backgroundColor:
                  assetRailTab === tab.value
                    ? controller.colors.brand
                    : controller.colors.surface,
                border: `1px solid ${
                  assetRailTab === tab.value
                    ? controller.colors.brand
                    : controller.colors.border
                }`,
                borderRadius: 7,
                color:
                  assetRailTab === tab.value
                    ? controller.colors.base
                    : controller.colors.textSecondary,
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 800,
                minHeight: 30,
                padding: "0 5px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          className="facilities-asset-scroll"
          style={{ minHeight: 0, overflowY: "auto", paddingRight: 2 }}
        >
          {assetRailTab === "equipment" ? (
            renderAvailableEquipmentPanel()
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <FitText
                style={{ color: controller.colors.textSecondary, fontSize: 10 }}
              >
                {filteredRegionTemplates.length} reusable asset
                {filteredRegionTemplates.length === 1 ? "" : "s"}
              </FitText>
              {filteredRegionTemplates.map((template) => {
                const isActive =
                  controller.quickPlacementTemplateKey === template.key;
                const AssetIcon = template.key === "walkway" ? Route : Grid2X2;
                return (
                  <div
                    key={template.key}
                    style={{
                      ...detailCardStyle,
                      borderColor: isActive
                        ? controller.colors.brand
                        : controller.colors.border,
                      display: "grid",
                      gap: 7,
                      padding: 9,
                    }}
                  >
                    <div
                      style={{
                        alignItems: "center",
                        display: "grid",
                        gap: 8,
                        gridTemplateColumns: "30px minmax(0, 1fr)",
                      }}
                    >
                      <span
                        style={{
                          alignItems: "center",
                          backgroundColor: `${controller.colors.brand}18`,
                          borderRadius: 7,
                          display: "flex",
                          height: 30,
                          justifyContent: "center",
                          width: 30,
                        }}
                      >
                        <AssetIcon size={16} color={controller.colors.brand} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <FitText
                          style={{
                            display: "block",
                            fontSize: 11,
                            fontWeight: 850,
                          }}
                        >
                          {template.name}
                        </FitText>
                        <FitText
                          style={{
                            color: controller.colors.success,
                            display: "block",
                            fontSize: 9,
                            marginTop: 2,
                          }}
                        >
                          Reusable · {template.gridWidth}×{template.gridHeight}
                        </FitText>
                      </span>
                    </div>
                    <FitText
                      style={{
                        color: controller.colors.textMuted,
                        fontSize: 9,
                        lineHeight: 1.4,
                      }}
                    >
                      {template.description}
                    </FitText>
                    <div
                      style={{
                        display: "grid",
                        gap: 5,
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      }}
                    >
                      <FitButton
                        variant="ghost"
                        label="Add"
                        disabled={!controller.isEditMode}
                        onClick={() =>
                          controller.handleAddQuickRegion(template)
                        }
                        style={{ minHeight: 30 }}
                      />
                      <FitButton
                        variant={isActive ? "primary" : "ghost"}
                        label={isActive ? "Cancel" : "Place"}
                        disabled={!controller.isEditMode}
                        onClick={() =>
                          controller.handleToggleQuickPlacementTemplate(
                            template,
                          )
                        }
                        style={{ minHeight: 30 }}
                      />
                    </div>
                  </div>
                );
              })}
              {filteredRegionTemplates.length === 0 ? (
                <FitText
                  style={{
                    color: controller.colors.textMuted,
                    fontSize: 11,
                    padding: 10,
                    textAlign: "center",
                  }}
                >
                  No assets match this search.
                </FitText>
              ) : null}
            </div>
          )}
        </div>
      </aside>
    );
  };

  const renderPlacedEquipmentCard = () => {
    if (!selectedPlacedEquipment) return null;
    const canToggleMaintenance =
      selectedPlacedEquipment.status === "available" ||
      selectedPlacedEquipment.status === "maintenance";
    const isMaintenance = selectedPlacedEquipment.status === "maintenance";
    const isUnavailable =
      selectedPlacedEquipment.status === "broken" ||
      selectedPlacedEquipment.status === "missing";
    const availableQuantity = selectedInventoryEquipment
      ? (controller.equipmentRemainingById[selectedInventoryEquipment.id] ??
        selectedInventoryEquipment.quantityAvailable ??
        null)
      : (selectedPlacedEquipment.remainingPlaceableQuantity ?? null);
    const totalQuantity = selectedInventoryEquipment?.quantityTotal ?? null;
    const detailItems = [
      [
        "Type",
        selectedPlacedEquipment.type ||
          selectedInventoryEquipment?.category ||
          "Equipment",
      ],
      ["Status", selectedPlacedEquipment.status],
      [
        "Available / total",
        (availableQuantity ?? "N/A") + " / " + (totalQuantity ?? "N/A"),
      ],
      [
        "Location",
        (selectedPlacedEquipmentVenue?.name ??
          selectedPlacedEquipment.floorId) +
          " · C" +
          (selectedPlacedEquipment.gridColumn ?? 1) +
          " / R" +
          (selectedPlacedEquipment.gridRow ?? 1),
      ],
      ["Placement ID", selectedPlacedEquipment.id],
      ["Inventory ID", selectedPlacedEquipment.inventoryItemId ?? "Not linked"],
    ];
    return (
      <div style={{ ...detailCardStyle, display: "grid", gap: 8 }}>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div
            style={{
              alignItems: "center",
              backgroundColor: `${controller.colors.brand}18`,
              borderRadius: 8,
              display: "flex",
              height: 38,
              justifyContent: "center",
              overflow: "hidden",
              width: 38,
            }}
          >
            <EquipmentInspectorImage
              color={controller.colors.brand}
              name={selectedPlacedEquipment.name}
              src={selectedPlacedEquipment.imageUrl}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <FitText
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 850,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedPlacedEquipment.name}
            </FitText>
            <FitText
              style={{
                color: isMaintenance
                  ? controller.colors.warning
                  : isUnavailable
                    ? controller.colors.danger
                    : controller.colors.textSecondary,
                display: "block",
                fontSize: 10,
                marginTop: 2,
                textTransform: "capitalize",
              }}
            >
              {selectedPlacedEquipment.status} ·{" "}
              {selectedPlacedEquipmentVenue?.name ?? "Floor map"}
            </FitText>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: 6,
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          }}
        >
          {detailItems.map(([label, value]) => (
            <div
              key={label}
              style={{
                border: "1px solid " + controller.colors.border,
                borderRadius: 7,
                minWidth: 0,
                padding: "7px 8px",
              }}
            >
              <FitText
                style={{
                  color: controller.colors.textMuted,
                  display: "block",
                  fontSize: 9,
                  textTransform: "uppercase",
                }}
              >
                {label}
              </FitText>
              <FitText
                title={String(value)}
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 700,
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textTransform: label === "Status" ? "capitalize" : undefined,
                  whiteSpace: "nowrap",
                }}
              >
                {value}
              </FitText>
            </div>
          ))}
        </div>
        <FitButton
          variant="primary"
          label="Edit equipment"
          icon={SquarePen}
          disabled={!selectedInventoryRecord}
          fullWidth
          style={{ minHeight: 32 }}
          textStyle={{ fontSize: 11, fontWeight: 800 }}
          onClick={() => setEquipmentEditorOpen(true)}
        />
        <FitButton
          variant={isMaintenance ? "ghost" : "danger"}
          label={isMaintenance ? "Mark Available" : "Mark Maintenance"}
          disabled={!canToggleMaintenance}
          fullWidth
          style={{ minHeight: 32 }}
          textStyle={{ fontSize: 11, fontWeight: 800 }}
          onClick={() => setEquipmentMaintenanceTarget(selectedPlacedEquipment)}
        />
        {controller.isEditMode ? (
          <>
            <FitButton
              variant="danger"
              label="Remove from map"
              icon={Trash2}
              fullWidth
              style={{ minHeight: 32 }}
              textStyle={{ fontSize: 11, fontWeight: 800 }}
              onClick={() =>
                setEquipmentMapRemovalTarget(selectedPlacedEquipment)
              }
            />
            <FitText
              style={{
                color: controller.colors.textSecondary,
                fontSize: 10,
                lineHeight: 1.4,
              }}
            >
              Removes this placement only. The inventory record remains
              available.
            </FitText>
          </>
        ) : null}
        {!canToggleMaintenance ? (
          <FitText
            style={{
              color: controller.colors.textSecondary,
              fontSize: 10,
              lineHeight: 1.4,
            }}
          >
            {selectedPlacedEquipment.status} equipment keeps its current status.
          </FitText>
        ) : null}
      </div>
    );
  };

  const renderLayoutRail = () => {
    if (selectedPlacedEquipment) {
      return (
        <aside
          className="facilities-asset-scroll"
          style={{ ...rightRailStyle, overflowY: "auto" }}
        >
          {renderPlacedEquipmentCard()}
        </aside>
      );
    }
    if (selectedVenue) return renderVenueDetailCard();
    return renderEmptyRightCard(
      "No map item selected",
      "Select a venue or placed equipment node to review its details here.",
    );
  };

  const renderVenueDetailCard = () => {
    if (!selectedVenue) {
      return renderEmptyRightCard(
        "No venue selected",
        "Select a venue from the table to review its details here.",
      );
    }

    const bookingBlockReason = getVenueBookingBlockReason(selectedVenue);

    return (
      <aside
        className="facilities-asset-scroll"
        style={{
          ...rightRailStyle,
          alignContent: "start",
          overflowY: "auto",
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
          <FitText
            style={{
              color:
                selectedVenue.status === "maintenance"
                  ? controller.colors.danger
                  : controller.colors.textSecondary,
              fontSize: 11,
              textTransform: "capitalize",
            }}
          >
            {selectedVenue.status ?? "available"}
          </FitText>
          <FitText
            style={{
              color: controller.colors.textSecondary,
              fontSize: 10,
              lineHeight: 1.45,
            }}
          >
            {FACILITY_FLOOR_MAP[selectedVenue.floorId].label} · C
            {selectedVenue.gridColumn ?? 1} / R{selectedVenue.gridRow ?? 1} · ID{" "}
            {String(selectedVenue.sourceVenueId ?? selectedVenue.id)}
          </FitText>
          <FitText
            style={{
              color: controller.colors.textSecondary,
              fontSize: 10,
              lineHeight: 1.45,
            }}
          >
            Dimensions {selectedVenue.gridWidth ?? 1} ×{" "}
            {selectedVenue.gridHeight ?? 1} grid cells
          </FitText>
          <div
            style={{ ...detailCardStyle, display: "grid", gap: 7, padding: 10 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <FitText
                style={{ color: controller.colors.textMuted, fontSize: 10 }}
              >
                Map visibility
              </FitText>
              <FitText style={{ fontSize: 10.5, fontWeight: 800 }}>
                {selectedVenue.isMapped === false ? "Not visible" : "Visible"}
              </FitText>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <FitText
                style={{ color: controller.colors.textMuted, fontSize: 10 }}
              >
                Booking
              </FitText>
              <FitText
                style={{
                  color: bookingBlockReason
                    ? controller.colors.danger
                    : controller.colors.success,
                  fontSize: 10.5,
                  fontWeight: 800,
                  textAlign: "right",
                }}
              >
                {bookingBlockReason
                  ? selectedVenue.status === "maintenance"
                    ? "Unavailable — Maintenance"
                    : "Unavailable"
                  : "Available"}
              </FitText>
            </div>
            {bookingBlockReason ? (
              <FitText
                style={{
                  color: controller.colors.danger,
                  fontSize: 9.5,
                  lineHeight: 1.4,
                }}
              >
                {bookingBlockReason}
              </FitText>
            ) : null}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <FitText
                style={{ color: controller.colors.textMuted, fontSize: 10 }}
              >
                Active bookings
              </FitText>
              <FitText style={{ fontSize: 10.5, fontWeight: 800 }}>
                {selectedVenueBookings.length}
              </FitText>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <FitText
                style={{ color: controller.colors.textMuted, fontSize: 10 }}
              >
                Next booking
              </FitText>
              <FitText
                style={{ fontSize: 10.5, fontWeight: 800, textAlign: "right" }}
              >
                {selectedVenueBookings[0]
                  ? new Date(selectedVenueBookings[0].startTime).toLocaleString(
                      [],
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                      },
                    )
                  : "None scheduled"}
              </FitText>
            </div>
          </div>
          <FitButton
            variant="ghost"
            label="View Details"
            icon={MapPinned}
            fullWidth
            style={{ minHeight: 34 }}
            textStyle={{ fontSize: 12, fontWeight: 800 }}
            onClick={() => setLayoutModalVenue(selectedVenue)}
          />
          <FitButton
            variant="primary"
            label="Edit Venue"
            icon={SquarePen}
            fullWidth
            style={{ minHeight: 36 }}
            textStyle={{ fontSize: 12, fontWeight: 800 }}
            onClick={() =>
              controller.handleOpenVenueEditor("edit", selectedVenue)
            }
          />
          <FitButton
            variant={
              selectedVenue.status === "maintenance" ? "ghost" : "danger"
            }
            label={
              selectedVenue.status === "maintenance"
                ? "Mark Available"
                : "Mark Maintenance"
            }
            disabled={
              selectedVenue.status !== "available" &&
              selectedVenue.status !== "maintenance"
            }
            fullWidth
            style={{ minHeight: 34 }}
            textStyle={{ fontSize: 12, fontWeight: 800 }}
            onClick={() => setVenueMaintenanceTarget(selectedVenue)}
          />
          {controller.isEditMode ? (
            <>
              <FitButton
                variant="danger"
                label="Remove from map"
                icon={Trash2}
                fullWidth
                style={{ minHeight: 34 }}
                textStyle={{ fontSize: 12, fontWeight: 800 }}
                onClick={() => setVenueMapRemovalTarget(selectedVenue)}
              />
              <FitText
                style={{
                  color: controller.colors.textSecondary,
                  fontSize: 10,
                  lineHeight: 1.4,
                }}
              >
                Removes the placement only. Bookings and the venue record
                remain.
              </FitText>
            </>
          ) : null}
        </div>
      </aside>
    );
  };

  const renderVenuesView = () => (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: controller.isCompact
          ? "minmax(0, 1fr)"
          : "minmax(0, 1fr) 300px",
        height: controller.isCompact ? "auto" : "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          height: controller.isCompact ? "auto" : "100%",
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <FacilitiesVenuesTable
          activeBookings={controller.activeBookings}
          colors={controller.colors}
          equipment={controller.liveEquipment}
          floorId={controller.activeFloor}
          isError={controller.venuesError}
          isLoading={controller.venuesLoading}
          venues={controller.activeFloorVenues}
          onAddVenue={() => controller.handleOpenVenueEditor("create")}
          onArchiveVenue={(venue) => controller.handleDeleteVenueRequest(venue)}
          onEditVenue={(venue) =>
            controller.handleOpenVenueEditor("edit", venue)
          }
          onFloorChange={handleFloorChange}
          onOpenArchive={() => controller.setArchiveModalOpen(true)}
          onRemoveFromMap={(venue) => setVenueMapRemovalTarget(venue)}
          onRetry={() => void controller.refetchVenues()}
          onSelectVenue={(venue) => {
            const isSelectedAgain = selectedVenue?.id === venue.id;
            controller.setSelectedFloorVenue(isSelectedAgain ? null : venue);
            setLayoutModalVenue(
              !isSelectedAgain && controller.isCompact ? venue : null,
            );
          }}
          onToggleMaintenance={(venue) => setVenueMaintenanceTarget(venue)}
          onViewDetails={(venue) => setLayoutModalVenue(venue)}
          selectedVenueId={selectedVenue?.id}
        />
      </div>
      {controller.isCompact ? null : renderVenueDetailCard()}
    </div>
  );

  const renderVenueEditorSurface = () => (
    <FitModal
      isOpen={controller.isVenueEditorOpen}
      onClose={controller.handleCloseVenueEditor}
      title={controller.venueEditTarget ? "Edit Venue" : "Add Venue"}
      subtitle="Update the member-facing venue profile and map placement."
      icon={SquarePen}
      maxWidth={820}
      noScroll
      closeAriaLabel="Close venue editor"
      contentStyle={{ padding: 0 }}
    >
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
    </FitModal>
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
          gridTemplateRows: "auto minmax(0, 1fr)",
          gap: 12,
          height: controller.isCompact ? "auto" : "100%",
          minHeight: 0,
          overflow: controller.isCompact ? "visible" : "hidden",
        }}
      >
        <div
          style={{
            ...controller.fs.mapCard,
            padding: controller.isCompact ? 12 : 14,
          }}
        >
          {renderTopBar()}
        </div>
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
              ? renderVenuesView()
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
        activeBookings={controller.activeBookings}
        isOpen={
          !!layoutModalVenue &&
          (controller.activeTab === "floor" ||
            controller.activeTab === "venues")
        }
        onClose={() => {
          setLayoutModalVenue(null);
        }}
        onEditVenue={(venue) => {
          setLayoutModalVenue(null);
          controller.handleOpenVenueEditor("edit", venue);
        }}
        onViewMap={(venue) => {
          setLayoutModalVenue(null);
          controller.setActiveFloor(venue.floorId);
          controller.setActiveTab("floor");
          controller.setSelectedFloorVenue(venue);
        }}
      />
      <DetailsModal
        isOpen={equipmentEditorOpen && !!selectedInventoryRecord}
        title="Edit Equipment"
        subtitle={selectedInventoryRecord?.name ?? "Inventory equipment"}
        fields={facilityEquipmentEditFields}
        initialValues={
          selectedInventoryRecord && selectedPlacedEquipment
            ? {
                name: selectedInventoryRecord.name,
                description: selectedInventoryRecord.description ?? "",
                unit: selectedInventoryRecord.unit,
                status:
                  selectedPlacedEquipment.status === "maintenance"
                    ? "Under Maintenance"
                    : selectedPlacedEquipment.status === "broken"
                      ? "Broken"
                      : selectedPlacedEquipment.status === "missing"
                        ? "Missing"
                        : "Available",
              }
            : undefined
        }
        disableUnchanged
        validateOnChange
        validate={validateInventoryEquipmentDetailForm}
        isLoading={controller.updateInventoryEquipmentMutation.isPending}
        submitLabel={
          controller.updateInventoryEquipmentMutation.isPending
            ? "SAVING..."
            : "SAVE CHANGES"
        }
        onCancel={() => setEquipmentEditorOpen(false)}
        onSubmit={(data) => {
          if (!selectedInventoryRecord) return;
          void controller
            .handleUpdateInventoryEquipmentFromFacilities(
              selectedInventoryRecord.id,
              data,
            )
            .then((saved) => {
              if (saved) setEquipmentEditorOpen(false);
            });
        }}
      />
      {controller.isVenueEditorOpen ? renderVenueEditorSurface() : null}
      <FacilitiesArchiveModal
        archivedEquipment={controller.archivedEquipment}
        archivedVenues={controller.archivedVenues}
        colors={controller.colors}
        filter={controller.archiveFilter}
        isLoadingEquipment={controller.archivedEquipmentLoading}
        isLoadingVenues={controller.archivedVenuesLoading}
        isErrorEquipment={controller.archivedEquipmentError}
        isErrorVenues={controller.archivedVenuesError}
        isOpen={controller.archiveModalOpen}
        isRestoringEquipment={controller.restoreEquipmentMutation.isPending}
        isRestoringVenue={controller.restoreVenueMutation.isPending}
        onClose={() => controller.setArchiveModalOpen(false)}
        onFilterChange={controller.setArchiveFilter}
        onRetryEquipment={() => void controller.refetchArchivedEquipment()}
        onRetryVenues={() => void controller.refetchArchivedVenues()}
        onRestoreEquipment={(equipment) =>
          controller.handleRestoreEquipment(equipment)
        }
        onRestoreVenue={(venue) => controller.handleRestoreVenue(venue)}
      />
      <ConfirmModal
        isOpen={!!equipmentMapRemovalTarget}
        title="Remove equipment from map"
        message={
          "Remove " +
          (equipmentMapRemovalTarget?.name ?? "this equipment") +
          " from the floor map? Its inventory record and quantities will remain."
        }
        confirmLabel="REMOVE FROM MAP"
        loadingLabel="REMOVING"
        loadingTitle="REMOVING EQUIPMENT"
        isDanger
        isLoading={controller.deleteEquipmentMutation.isPending}
        onConfirm={async () => {
          if (!equipmentMapRemovalTarget) return;
          const removed = await controller.handleRemoveEquipmentFromCanvas(
            equipmentMapRemovalTarget.id,
          );
          if (!removed) return;
          if (selectedPlacedEquipmentId === equipmentMapRemovalTarget.id) {
            setSelectedPlacedEquipmentId(null);
          }
          setEquipmentMapRemovalTarget(null);
        }}
        onCancel={() => setEquipmentMapRemovalTarget(null)}
      />
      <ConfirmModal
        isOpen={!!venueMapRemovalTarget}
        title="Remove venue from map"
        message={
          "Remove " +
          (venueMapRemovalTarget?.name ?? "this venue") +
          " from the floor map? Its venue record, bookings, and history will remain."
        }
        confirmLabel="REMOVE FROM MAP"
        loadingLabel="REMOVING"
        loadingTitle="REMOVING VENUE"
        isDanger
        isLoading={controller.isVenueSubmitting}
        onConfirm={async () => {
          if (!venueMapRemovalTarget) return;
          const removed = await controller.handleRemoveVenueFromCanvas(
            venueMapRemovalTarget.mapId,
          );
          if (!removed) return;
          setVenueMapRemovalTarget(null);
          setLayoutModalVenue(null);
        }}
        onCancel={() => setVenueMapRemovalTarget(null)}
      />
      <ConfirmModal
        isOpen={!!controller.venueDeleteTarget}
        title="Archive Venue"
        message={
          controller.venueDeleteTarget?.isSystem
            ? `${controller.venueDeleteTarget.name} is part of the core floor plan and cannot be archived.`
            : controller.deleteHasReservations
              ? `${controller.venueDeleteTarget?.name ?? "This venue"} has active reservations. Archiving it will immediately cancel them. Proceed?`
              : `Archive ${controller.venueDeleteTarget?.name ?? "this venue"}?`
        }
        confirmLabel="ARCHIVE VENUE"
        loadingLabel="ARCHIVING VENUE"
        loadingTitle="ARCHIVING VENUE"
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
        isOpen={!!venueMaintenanceTarget}
        title={
          venueMaintenanceTarget?.status === "maintenance"
            ? "Mark venue available"
            : "Mark venue for maintenance"
        }
        message={
          venueMaintenanceTarget?.status === "maintenance"
            ? `${venueMaintenanceTarget?.name ?? "This venue"} will be restored for new bookings.`
            : `${venueMaintenanceTarget?.name ?? "This venue"} will stop accepting new bookings immediately. Existing bookings will not be automatically cancelled. This changes venue availability only.`
        }
        confirmLabel={
          venueMaintenanceTarget?.status === "maintenance"
            ? "MARK AVAILABLE"
            : "MARK MAINTENANCE"
        }
        loadingLabel="UPDATING VENUE"
        loadingTitle="UPDATING VENUE"
        isLoading={controller.isVenueSubmitting}
        confirmDisabled={
          venueMaintenanceTarget?.status !== "maintenance" &&
          (controller.activeBookingsLoading ||
            Boolean(controller.activeBookingsError))
        }
        onConfirm={async () => {
          if (!venueMaintenanceTarget) return;
          const updated = await controller.toggleVenueMaintenance(
            venueMaintenanceTarget,
          );
          if (updated) setVenueMaintenanceTarget(null);
        }}
        onCancel={() => setVenueMaintenanceTarget(null)}
      >
        {venueMaintenanceTarget?.status !== "maintenance" ? (
          <div
            style={{
              backgroundColor: `${controller.colors.warning}12`,
              border: `1px solid ${controller.colors.warning}44`,
              borderRadius: 12,
              display: "grid",
              gap: 8,
              marginTop: 10,
              maxHeight: 190,
              overflowY: "auto",
              padding: 12,
            }}
          >
            <FitText
              style={{
                color: controller.colors.textPrimary,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {controller.activeBookingsLoading
                ? "Loading affected upcoming bookings..."
                : controller.activeBookingsError
                  ? "Affected bookings could not be loaded. Close and retry before changing availability."
                  : `${maintenanceAffectedBookings.length} upcoming active booking${maintenanceAffectedBookings.length === 1 ? "" : "s"} ${maintenanceAffectedBookings.length === 1 ? "requires" : "require"} manual resolution.`}
            </FitText>
            {!controller.activeBookingsLoading &&
            !controller.activeBookingsError
              ? maintenanceAffectedBookings.slice(0, 5).map((booking) => (
                  <FitText
                    key={booking.id}
                    style={{
                      color: controller.colors.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    {booking.user?.profile?.firstName ||
                      booking.user?.email ||
                      "Member"}{" "}
                    ·{" "}
                    {new Date(booking.startTime).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Manila",
                    })}
                  </FitText>
                ))
              : null}
            {maintenanceAffectedBookings.length > 5 ? (
              <FitText
                style={{ color: controller.colors.textMuted, fontSize: 11 }}
              >
                +{maintenanceAffectedBookings.length - 5} more in Gym Operations
              </FitText>
            ) : null}
          </div>
        ) : null}
      </ConfirmModal>
      <ConfirmModal
        isOpen={!!equipmentMaintenanceTarget}
        title={
          equipmentMaintenanceTarget?.status === "maintenance"
            ? "Mark equipment available"
            : "Mark equipment for maintenance"
        }
        message={`${equipmentMaintenanceTarget?.name ?? "This equipment"} will be marked ${
          equipmentMaintenanceTarget?.status === "maintenance"
            ? "available"
            : "for maintenance"
        }.`}
        confirmLabel={
          equipmentMaintenanceTarget?.status === "maintenance"
            ? "MARK AVAILABLE"
            : "MARK MAINTENANCE"
        }
        loadingLabel="UPDATING EQUIPMENT"
        loadingTitle="UPDATING EQUIPMENT"
        isLoading={controller.equipmentPlacementPending}
        onConfirm={async () => {
          if (!equipmentMaintenanceTarget) return;
          const updated = await controller.toggleEquipmentMaintenance(
            equipmentMaintenanceTarget,
          );
          if (updated) setEquipmentMaintenanceTarget(null);
        }}
        onCancel={() => setEquipmentMaintenanceTarget(null)}
      />
    </FitSection>
  );
}
