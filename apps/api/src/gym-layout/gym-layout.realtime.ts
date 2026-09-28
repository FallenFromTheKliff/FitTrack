import { type GymLayoutEquipmentResponseDTO } from './dto/gym-layout.dto';

export const GYM_LAYOUT_NAMESPACE = '/gym-layout';
export const GYM_LAYOUT_STATUS_HASH_KEY = 'equipment_status';
export const GYM_LAYOUT_STATUS_CHANNEL = 'equipment:status';
export const GYM_LAYOUT_SNAPSHOT_EVENT = 'gym-layout.snapshot';
export const GYM_LAYOUT_DELTA_EVENT = 'gym-layout.delta';

export type GymLayoutDeltaOperation = 'upsert' | 'remove';

export interface GymLayoutRealtimeDelta {
  equipment: GymLayoutEquipmentResponseDTO;
  operation: GymLayoutDeltaOperation;
}
