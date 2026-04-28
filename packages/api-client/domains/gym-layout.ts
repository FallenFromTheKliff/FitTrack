import {
  positionXToGridColumn,
  positionYToGridRow,
  type GymLayoutEquipmentMutationInput,
  type GymLayoutEquipmentRecord,
} from "@fittrack/types";
import { unwrapResponse, unwrapVoidResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type {
  GymLayoutEquipmentMutationInput,
  GymLayoutEquipmentRecord,
} from "@fittrack/types";

type GymLayoutEquipmentApiRecord = {
  created_at: string;
  floor_id: GymLayoutEquipmentRecord["floorId"];
  grid_column: number | null;
  grid_row: number | null;
  icon_key: string | null;
  id: string;
  is_active: boolean;
  name: string;
  position_x: number;
  position_y: number;
  status: GymLayoutEquipmentRecord["status"];
  type: string;
  updated_at: string;
};

function mapGymLayoutEquipment(
  record: GymLayoutEquipmentApiRecord,
): GymLayoutEquipmentRecord {
  return {
    createdAt: record.created_at,
    floorId: record.floor_id,
    gridColumn: record.grid_column ?? positionXToGridColumn(record.position_x),
    gridRow: record.grid_row ?? positionYToGridRow(record.position_y),
    iconKey: record.icon_key,
    id: record.id,
    isActive: record.is_active,
    name: record.name,
    positionX: record.position_x,
    positionY: record.position_y,
    status: record.status,
    type: record.type,
    updatedAt: record.updated_at,
  };
}

function toGymLayoutMutationPayload(payload: GymLayoutEquipmentMutationInput) {
  return {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.type !== undefined ? { type: payload.type } : {}),
    ...(payload.floorId !== undefined ? { floor_id: payload.floorId } : {}),
    ...(payload.gridColumn !== undefined ? { grid_column: payload.gridColumn } : {}),
    ...(payload.gridRow !== undefined ? { grid_row: payload.gridRow } : {}),
    ...(payload.positionX !== undefined ? { position_x: payload.positionX } : {}),
    ...(payload.positionY !== undefined ? { position_y: payload.positionY } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.iconKey !== undefined ? { icon_key: payload.iconKey } : {}),
    ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
  };
}

function toGymLayoutCreatePayload(payload: GymLayoutEquipmentMutationInput) {
  return {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.type !== undefined ? { type: payload.type } : {}),
    ...(payload.floorId !== undefined ? { floor_id: payload.floorId } : {}),
    ...(payload.gridColumn !== undefined ? { grid_column: payload.gridColumn } : {}),
    ...(payload.gridRow !== undefined ? { grid_row: payload.gridRow } : {}),
    ...(payload.positionX !== undefined ? { position_x: payload.positionX } : {}),
    ...(payload.positionY !== undefined ? { position_y: payload.positionY } : {}),
    ...(payload.iconKey !== undefined ? { icon_key: payload.iconKey } : {}),
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
  };
}
