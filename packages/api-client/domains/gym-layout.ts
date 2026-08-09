import {
  positionXToGridColumn,
  positionYToGridRow,
  type GymLayoutEquipmentMutationInput,
  type GymLayoutEquipmentRecord,
  type FacilityFloorPlanMediaMutationInput,
  type FacilityFloorPlanMediaRecord,
} from "@fittrack/types";
import { unwrapResponse, unwrapVoidResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type {
  FacilityFloorPlanMediaMutationInput,
  FacilityFloorPlanMediaRecord,
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
  updated_at: string;
};

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
    updatedAt: record.updated_at,
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
    ...(payload.positionX !== undefined ? { position_x: payload.positionX } : {}),
    ...(payload.positionY !== undefined ? { position_y: payload.positionY } : {}),
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
    ...(payload.positionX !== undefined ? { position_x: payload.positionX } : {}),
    ...(payload.positionY !== undefined ? { position_y: payload.positionY } : {}),
    ...(payload.iconKey !== undefined ? { icon_key: payload.iconKey } : {}),
    ...(payload.inventoryItemId !== undefined
      ? { inventory_item_id: payload.inventoryItemId }
      : {}),
    ...(payload.venueId !== undefined ? { venue_id: payload.venueId } : {}),
  };
}

function toFloorPlanMediaPayload(payload: FacilityFloorPlanMediaMutationInput) {
  return {
    ...(payload.gridHeight !== undefined ? { grid_height: payload.gridHeight } : {}),
    ...(payload.gridWidth !== undefined ? { grid_width: payload.gridWidth } : {}),
    ...(payload.imageUrl !== undefined ? { image_url: payload.imageUrl } : {}),
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
