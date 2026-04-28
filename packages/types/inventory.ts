import type { PaginationMeta } from "./membership";

export const INVENTORY_PRODUCT_CATEGORIES = [
  "supplements",
  "beverages",
  "snacks",
  "accessories",
  "recovery",
  "merchandise",
  "other"
] as const;

export type InventoryProductCategory =
  typeof INVENTORY_PRODUCT_CATEGORIES[number];

export type InventoryProductListParams = {
  inStockOnly?: boolean;
  limit?: number;
  page?: number;
  search?: string;
};

export type InventorySaleListParams = {
  endDate?: string;
  limit?: number;
  page?: number;
  startDate?: string;
};

export type InventoryProductRecord = {
  category: InventoryProductCategory;
  cost: number;
  createdAt: string;
  description: string | null;
  id: string;
  imageUrl: string | null;
  isActive: boolean;
  name: string;
  price: number;
  reorderThreshold: number;
  stockQuantity: number;
  updatedAt: string;
};

export type InventoryProductMutationInput = {
  category?: InventoryProductCategory;
  cost?: number;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  name?: string;
  price?: number;
  reorderThreshold?: number;
  stockQuantity?: number;
};

export type InventoryRestockInput = {
  notes?: string;
  quantity: number;
};

export type InventoryEquipmentListParams = {
  limit?: number;
  page?: number;
};

export type InventoryEquipmentRecord = {
  createdAt: string;
  description: string | null;
  id: string;
  imageUrl: string | null;
  isActive: boolean;
  name: string;
  quantityCurrent: number;
  quantityTotal: number;
  unit: string;
  updatedAt: string;
};

export type InventoryEquipmentCreateInput = {
  description?: string;
  imageUrl?: string;
  name: string;
  quantityCurrent: number;
  quantityTotal: number;
  unit?: string;
};

export type InventoryEquipmentUpdateInput = {
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  name?: string;
  quantityCurrent?: number;
  quantityTotal?: number;
  unit?: string;
};

export type InventoryEquipmentWriteOffInput = {
  quantitySetTo: number;
  reason: string;
};

export type InventoryEquipmentArchiveInput = {
  quantityToArchive: number;
  reason: string;
};

export type InventoryEquipmentWriteOffActorRecord = {
  firstName: string | null;
  id: string;
  lastName: string | null;
};

export type InventoryEquipmentWriteOffRecord = {
  createdAt: string;
  equipmentId: string;
  id: string;
  performedBy: string;
  performer: InventoryEquipmentWriteOffActorRecord | null;
  quantityBefore: number;
  quantityLost: number;
  quantitySetTo: number;
  reason: string;
  updatedAt: string;
};

export type InventoryEquipmentDetailRecord = InventoryEquipmentRecord & {
  writeOffs: InventoryEquipmentWriteOffRecord[];
};

export type InventorySalePaymentMethod = "cash" | "paymongo";
export type InventorySaleSource = "manual" | "mobile";
export type InventorySaleStatus = "cancelled" | "completed" | "pending";
export type InventoryPaymentStatus =
  | "awaiting_verification"
  | "completed"
  | "failed"
  | "pending"
  | "processing";

export type InventorySaleItemProductRecord = {
  id: string;
  imageUrl: string | null;
  name: string;
};

export type InventorySaleStaffRecord = {
  firstName: string | null;
  id: string;
  lastName: string | null;
};

export type InventorySaleTransactionItemRecord = {
  id: string;
  product: InventorySaleItemProductRecord | null;
  productId: string;
  quantity: number;
  subtotal: number;
  unitPrice: number;
};

export type InventorySaleTransactionSummaryRecord = {
  createdAt: string;
  customerName: string | null;
  customerUserId: string | null;
  id: string;
  itemsCount: number;
  notes: string | null;
  paymentId: string | null;
  paymentMethod: InventorySalePaymentMethod;
  processedBy: string;
  source: InventorySaleSource;
  staff: InventorySaleStaffRecord | null;
  status: InventorySaleStatus;
  totalAmount: number;
  updatedAt: string;
};

export type InventorySaleTransactionDetailRecord =
  InventorySaleTransactionSummaryRecord & {
    items: InventorySaleTransactionItemRecord[];
  };

export type InventorySaleCheckoutRecord = {
  checkoutUrl: string | null;
  paymentId: string;
  paymentStatus: InventoryPaymentStatus;
  saleId: string;
  status: InventorySaleStatus;
};

export type InventoryCreateSaleItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
};

export type InventoryCreateSaleInput = {
  customerName?: string;
  customerUserId?: string;
  items: InventoryCreateSaleItemInput[];
  notes?: string;
  paymentMethod: InventorySalePaymentMethod;
};

export type InventoryPaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};
