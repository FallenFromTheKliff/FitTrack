import {
  positionXToGridColumn,
  positionYToGridRow,
  type GymLayoutEquipmentMutationInput,
  type GymLayoutEquipmentRecord,
  type FacilityFloorPlanMediaMutationInput,
  type FacilityFloorPlanMediaRecord,
  type FacilityMapSnapshot,
  type FacilityMapRegionSnapshot,
  type FacilityTodayBookingSnapshot,
  type FacilityTodayBookingState,
  type FacilityOperatingHourSnapshot,
} from "@fittrack/types";
import { unwrapResponse, unwrapVoidResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type {
  FacilityFloorPlanMediaMutationInput,
  FacilityFloorPlanMediaRecord,
  FacilityMapSnapshot,
  FacilityTodayBookingSnapshot,
  FacilityTodayBookingState,
  FacilityOperatingHourSnapshot,
  GymLayoutEquipmentMutationInput,
  GymLayoutEquipmentRecord,
} from "@fittrack/types";

type GymLayoutEquipmentApiRecord = {
  created_at: string;
  floor_id: GymLayoutEquipmentRecord["floorId"];
  grid_column: number | null;
  grid_height: number | null;
  grid_row: number | null;
  grid_width: number | null;
  icon_key: string | null;
  id: string;
  image_url: string | null;
  inventory_item_id: string | null;
  is_active: boolean;
  name: string;
  position_x: number;
  position_y: number;
  placed_quantity: number;
  remaining_placeable_quantity: number | null;
  status: GymLayoutEquipmentRecord["status"];
  type: string;
  updated_at: string;
  venue_id: string | null;
};

type FacilityFloorPlanMediaApiRecord = {
  created_at: string;
  floor_id: FacilityFloorPlanMediaRecord["floorId"];
  grid_height: number;
  grid_width: number;
  image_url: string | null;
  footprint_cells: FacilityFloorPlanMediaRecord["footprintCells"];
  path_cells: FacilityFloorPlanMediaRecord["pathCells"];
  entry_cells: FacilityFloorPlanMediaRecord["entryCells"];
  exit_cells: FacilityFloorPlanMediaRecord["exitCells"];
  updated_at: string;
};

type FacilityMapRegionApiRecord = {
  booking_block_reason: string | null;
  capacity: number | null;
  description: string | null;
  floor_id: FacilityMapRegionSnapshot["floorId"];
  grid_column: number;
  grid_height: number;
  grid_row: number;
  grid_width: number;
  hourly_rate: number | null;
  icon_key: string | null;
  id: string;
  image_url: string | null;
  image_urls?: string[] | null;
  is_bookable: boolean;
  is_reservable: boolean;
  minimum_hours: number | null;
  name: string;
  region_kind: FacilityMapRegionSnapshot["regionKind"];
  source_venue_id: string;
  status: FacilityMapRegionSnapshot["status"];
  today_bookings?: Array<{
    id: string;
    starts_at: string;
    ends_at: string;
  }>;
  today_booking_state?: FacilityTodayBookingState;
};

type FacilityMapSnapshotApiRecord = {
  floors: Array<{
    entry_cells: FacilityFloorPlanMediaRecord["entryCells"];
    equipment: GymLayoutEquipmentApiRecord[];
    exit_cells: FacilityFloorPlanMediaRecord["exitCells"];
    floor_id: FacilityFloorPlanMediaRecord["floorId"];
    footprint_cells: FacilityFloorPlanMediaRecord["footprintCells"];
    grid_columns: number;
    grid_rows: number;
    image_url: string | null;
    path_cells: FacilityFloorPlanMediaRecord["pathCells"];
    regions: FacilityMapRegionApiRecord[];
  }>;
  generated_at: string;
  operating_hours?: Array<{
    closes_at: string;
    day_of_week: number;
    is_closed: boolean;
    label: string | null;
    opens_at: string;
  }>;
};

function normalizeVenueImageUrls(
  values: readonly (string | null | undefined)[] | null | undefined,
) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values ?? []) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function mapGymLayoutEquipment(
  record: GymLayoutEquipmentApiRecord,
): GymLayoutEquipmentRecord {
  return {
    createdAt: record.created_at,
    floorId: record.floor_id,
    gridColumn: record.grid_column ?? positionXToGridColumn(record.position_x),
    gridHeight: record.grid_height,
    gridRow: record.grid_row ?? positionYToGridRow(record.position_y),
    gridWidth: record.grid_width,
    iconKey: record.icon_key,
    id: record.id,
    imageUrl: record.image_url,
    inventoryItemId: record.inventory_item_id,
    isActive: record.is_active,
    name: record.name,
    positionX: record.position_x,
    positionY: record.position_y,
    placedQuantity: record.placed_quantity,
    remainingPlaceableQuantity: record.remaining_placeable_quantity,
    status: record.status,
    type: record.type,
    updatedAt: record.updated_at,
    venueId: record.venue_id,
  };
}

function mapFloorPlanMedia(
  record: FacilityFloorPlanMediaApiRecord,
): FacilityFloorPlanMediaRecord {
  return {
    createdAt: record.created_at,
    floorId: record.floor_id,
    gridHeight: record.grid_height,
    gridWidth: record.grid_width,
    imageUrl: record.image_url,
    footprintCells: record.footprint_cells,
    pathCells: record.path_cells,
    entryCells: record.entry_cells,
    exitCells: record.exit_cells,
    updatedAt: record.updated_at,
  };
}

export function mapFacilityMapSnapshot(
  record: FacilityMapSnapshotApiRecord,
): FacilityMapSnapshot {
  return {
    generatedAt: record.generated_at,
    operatingHours: (record.operating_hours ?? []).map(
      (hour): FacilityOperatingHourSnapshot => ({
        dayOfWeek: hour.day_of_week,
        opensAt: hour.opens_at,
        closesAt: hour.closes_at,
        isClosed: hour.is_closed,
        label: hour.label,
      }),
    ),
    floors: record.floors.map((floor) => ({
      floorId: floor.floor_id,
      gridColumns: floor.grid_columns,
      gridRows: floor.grid_rows,
      imageUrl: floor.image_url,
      footprintCells: floor.footprint_cells,
      pathCells: floor.path_cells,
      entryCells: floor.entry_cells,
      exitCells: floor.exit_cells,
      equipment: floor.equipment.map(mapGymLayoutEquipment),
      regions: floor.regions.map((region) => ({
        id: region.id,
        sourceVenueId: region.source_venue_id,
        floorId: region.floor_id,
        name: region.name,
        description: region.description,
        iconKey: region.icon_key,
        imageUrl: region.image_url,
        imageUrls: normalizeVenueImageUrls([
          region.image_url,
          ...(region.image_urls ?? []),
        ]),
        gridColumn: region.grid_column,
        gridRow: region.grid_row,
        gridWidth: region.grid_width,
        gridHeight: region.grid_height,
        isReservable: region.is_reservable,
        isBookable: region.is_bookable,
        bookingBlockReason: region.booking_block_reason,
        status: region.status,
        capacity: region.capacity,
        hourlyRate: region.hourly_rate,
        minimumHours: region.minimum_hours,
        regionKind: region.region_kind,
        todayBookings: (region.today_bookings ?? []).map(
          (booking): FacilityTodayBookingSnapshot => ({
            id: booking.id,
            startTime: booking.starts_at,
            endTime: booking.ends_at,
          }),
        ),
        todayBookingState: region.today_booking_state ?? "none",
      })),
    })),
  };
}

function toGymLayoutMutationPayload(payload: GymLayoutEquipmentMutationInput) {
  return {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.type !== undefined ? { type: payload.type } : {}),
    ...(payload.floorId !== undefined ? { floor_id: payload.floorId } : {}),
    ...(payload.gridColumn !== undefined ? { grid_column: payload.gridColumn } : {}),
    ...(payload.gridHeight !== undefined ? { grid_height: payload.gridHeight } : {}),
    ...(payload.gridRow !== undefined ? { grid_row: payload.gridRow } : {}),
    ...(payload.gridWidth !== undefined ? { grid_width: payload.gridWidth } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.iconKey !== undefined ? { icon_key: payload.iconKey } : {}),
    ...(payload.inventoryItemId !== undefined
      ? { inventory_item_id: payload.inventoryItemId }
      : {}),
    ...(payload.venueId !== undefined ? { venue_id: payload.venueId } : {}),
    ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
  };
}

function toGymLayoutCreatePayload(payload: GymLayoutEquipmentMutationInput) {
  return {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.type !== undefined ? { type: payload.type } : {}),
    ...(payload.floorId !== undefined ? { floor_id: payload.floorId } : {}),
    ...(payload.gridColumn !== undefined ? { grid_column: payload.gridColumn } : {}),
    ...(payload.gridHeight !== undefined ? { grid_height: payload.gridHeight } : {}),
    ...(payload.gridRow !== undefined ? { grid_row: payload.gridRow } : {}),
    ...(payload.gridWidth !== undefined ? { grid_width: payload.gridWidth } : {}),
    ...(payload.iconKey !== undefined ? { icon_key: payload.iconKey } : {}),
    ...(payload.inventoryItemId !== undefined
      ? { inventory_item_id: payload.inventoryItemId }
      : {}),
    ...(payload.venueId !== undefined ? { venue_id: payload.venueId } : {}),
  };
}

function toFloorPlanMediaPayload(payload: FacilityFloorPlanMediaMutationInput) {
  return {
    ...(payload.imageUrl !== undefined ? { image_url: payload.imageUrl } : {}),
    ...(payload.footprintCells !== undefined
      ? { footprint_cells: payload.footprintCells }
      : {}),
    ...(payload.pathCells !== undefined ? { path_cells: payload.pathCells } : {}),
    ...(payload.entryCells !== undefined ? { entry_cells: payload.entryCells } : {}),
    ...(payload.exitCells !== undefined ? { exit_cells: payload.exitCells } : {}),
  };
}

export function createGymLayoutApi(transport: ApiTransport) {
  return {
    async listEquipment() {
      const equipment = await unwrapResponse<GymLayoutEquipmentApiRecord[]>(
        transport.get("/gym-layout/equipment"),
        "Unable to load gym layout equipment.",
      );
      return equipment.map(mapGymLayoutEquipment);
    },
    async listArchivedEquipment() {
      const equipment = await unwrapResponse<GymLayoutEquipmentApiRecord[]>(
        transport.get("/gym-layout/equipment/archived"),
        "Unable to load archived gym layout equipment.",
      );
      return equipment.map(mapGymLayoutEquipment);
    },
    async listFloorPlanMedia() {
      const media = await unwrapResponse<FacilityFloorPlanMediaApiRecord[]>(
        transport.get("/gym-layout/floor-plans/media"),
        "Unable to load floor plan media.",
      );
      return media.map(mapFloorPlanMedia);
    },
    async getSnapshot() {
      return mapFacilityMapSnapshot(
        await unwrapResponse<FacilityMapSnapshotApiRecord>(
          transport.get("/gym-layout/snapshot"),
          "Unable to load the facility map.",
        ),
      );
    },
    async createEquipment(payload: GymLayoutEquipmentMutationInput) {
      return mapGymLayoutEquipment(
        await unwrapResponse<GymLayoutEquipmentApiRecord>(
          transport.post(
            "/gym-layout/equipment",
            toGymLayoutCreatePayload(payload),
          ),
          "Unable to create gym layout equipment.",
        ),
      );
    },
    async updateEquipment(
      equipmentId: string,
      payload: GymLayoutEquipmentMutationInput,
    ) {
      return mapGymLayoutEquipment(
        await unwrapResponse<GymLayoutEquipmentApiRecord>(
          transport.patch(
            `/gym-layout/equipment/${equipmentId}`,
            toGymLayoutMutationPayload(payload),
          ),
          "Unable to update gym layout equipment.",
        ),
      );
    },
    deleteEquipment(equipmentId: string) {
      return unwrapVoidResponse(
        transport.delete(`/gym-layout/equipment/${equipmentId}`),
        "Unable to delete gym layout equipment.",
      );
    },
    async restoreEquipment(equipmentId: string) {
      return mapGymLayoutEquipment(
        await unwrapResponse<GymLayoutEquipmentApiRecord>(
          transport.patch(`/gym-layout/equipment/${equipmentId}/restore`),
          "Unable to restore gym layout equipment.",
        ),
      );
    },
    async updateFloorPlanMedia(payload: FacilityFloorPlanMediaMutationInput) {
      return mapFloorPlanMedia(
        await unwrapResponse<FacilityFloorPlanMediaApiRecord>(
          transport.patch(
            `/gym-layout/floor-plans/${payload.floorId}/media`,
            toFloorPlanMediaPayload(payload),
          ),
          "Unable to update floor plan media.",
        ),
      );
    },
  };
}
