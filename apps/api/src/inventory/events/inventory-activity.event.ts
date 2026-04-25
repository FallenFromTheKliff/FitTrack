export const INVENTORY_ACTIVITY_EVENT = 'inventory.activity';

export type InventoryActivityEvent = {
  action:
    | 'equipment_archived'
    | 'equipment_created'
    | 'equipment_updated'
    | 'product_archived'
    | 'product_created'
    | 'product_restocked'
    | 'product_sale_recorded'
    | 'product_updated';
  actorId: string;
  details?: Record<string, number | string | null | undefined>;
  entityId: string;
  entityName: string;
};
