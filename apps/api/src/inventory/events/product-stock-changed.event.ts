export const PRODUCT_STOCK_CHANGED_EVENT = 'inventory.product.stock-changed';

export interface ProductStockChangedEvent {
  productIds: string[];
}
