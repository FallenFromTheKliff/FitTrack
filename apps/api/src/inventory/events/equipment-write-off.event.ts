export const EQUIPMENT_WRITEOFF_EVENT = 'inventory.equipment.write-off';

export interface EquipmentWriteOffEvent {
  equipmentId: string;
  equipmentName: string;
  quantityBefore: number;
  quantitySetTo: number;
  quantityLost: number;
  reason: string;
  performedBy: string;
}
