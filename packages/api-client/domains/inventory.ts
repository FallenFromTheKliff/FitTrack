import type {
  InventoryCreateSaleInput,
  InventoryEquipmentCreateInput,
  InventoryEquipmentArchiveInput,
  InventoryEquipmentDetailRecord,
  InventoryEquipmentListParams,
  InventoryEquipmentRecord,
  InventoryEquipmentUpdateInput,
  InventoryEquipmentWriteOffInput,
  InventoryEquipmentWriteOffRecord,
  InventoryPaginatedResult,
  InventoryProductCategory,
  InventoryProductListParams,
  InventoryProductMutationInput,
  InventoryProductRecord,
  InventorySalesAnalyticsRecord,
  InventoryAnalyticsPeriod,
  InventoryRestockInput,
  InventorySaleCheckoutRecord,
  InventorySaleListParams,
  InventorySaleSource,
  InventorySalesSummaryRecord,
  InventorySaleTransactionDetailRecord,
  InventorySaleTransactionSummaryRecord
} from "@fittrack/types";
import { unwrapPaginatedResponse, unwrapResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type {
  InventoryCreateSaleInput,
  InventoryEquipmentCreateInput,
  InventoryEquipmentArchiveInput,
  InventoryEquipmentDetailRecord,
  InventoryEquipmentListParams,
  InventoryEquipmentRecord,
  InventoryEquipmentUpdateInput,
  InventoryEquipmentWriteOffInput,
  InventoryEquipmentWriteOffRecord,
  InventoryPaginatedResult,
  InventoryProductCategory,
  InventoryProductListParams,
  InventoryProductMutationInput,
  InventoryProductRecord,
  InventorySalesAnalyticsRecord,
  InventoryAnalyticsPeriod,
  InventoryRestockInput,
  InventorySaleCheckoutRecord,
  InventorySaleListParams,
  InventorySaleSource,
  InventorySalesSummaryRecord,
  InventorySaleTransactionDetailRecord,
  InventorySaleTransactionSummaryRecord
} from "@fittrack/types";

type InventoryProductApiRecord = {
  category: InventoryProductCategory;
  cost: string | number;
  created_at: string;
  description: string | null;
  id: string;
  image_url: string | null;
  is_active: boolean;
  name: string;
  price: string | number;
  reorder_threshold: number;
  stock_quantity: number;
  updated_at: string;
};

type InventoryEquipmentApiRecord = {
  created_at: string;
  description: string | null;
  id: string;
  image_url: string | null;
  is_active: boolean;
  name: string;
  quantity_current: number;
  quantity_total: number;
  unit: string;
  updated_at: string;
};

type InventoryEquipmentWriteOffActorApiRecord = {
  first_name: string | null;
  id: string;
  last_name: string | null;
};

type InventoryEquipmentWriteOffApiRecord = {
  created_at: string;
  equipment_id: string;
  id: string;
  performed_by: string;
  performer: InventoryEquipmentWriteOffActorApiRecord | null;
  quantity_before: number;
  quantity_lost: number;
  quantity_set_to: number;
  reason: string;
  updated_at: string;
};

type InventoryEquipmentDetailApiRecord = InventoryEquipmentApiRecord & {
  write_offs: InventoryEquipmentWriteOffApiRecord[];
};

type InventorySaleStaffApiRecord = {
  first_name: string | null;
  id: string;
  last_name: string | null;
};

type InventorySaleItemProductApiRecord = {
  id: string;
  image_url: string | null;
  name: string;
};

type InventorySaleTransactionItemApiRecord = {
  id: string;
  product: InventorySaleItemProductApiRecord | null;
  product_id: string;
  quantity: number;
  subtotal: string | number;
  unit_price: string | number;
};

type InventorySaleTransactionSummaryApiRecord = {
  created_at: string;
  customer_name: string | null;
  customer_user_id: string | null;
  id: string;
  items_count: number;
  notes: string | null;
  payment_id: string | null;
  payment_method: "cash" | "paymongo";
  processed_by: string;
  source: "manual" | "mobile";
  staff: InventorySaleStaffApiRecord | null;
  status: "cancelled" | "completed" | "pending";
  total_amount: string | number;
  updated_at: string;
};

type InventorySaleTransactionDetailApiRecord =
  InventorySaleTransactionSummaryApiRecord & {
    items: InventorySaleTransactionItemApiRecord[];
  };

type InventorySaleCheckoutApiRecord = {
  checkout_url: string | null;
  payment_id: string;
  payment_status:
    | "awaiting_verification"
    | "completed"
    | "failed"
    | "pending"
    | "processing";
  sale_id: string;
  status: "cancelled" | "completed" | "pending";
};

type InventorySalesSummaryApiRecord = {
  completed_sales_count: number;
  total_revenue: string | number;
};

type InventorySalesAnalyticsPointApiRecord = {
  bucket_label: string;
  revenue: string | number;
};

type InventorySalesAnalyticsTopProductApiRecord = {
  name: string;
  value: string | number;
};

type InventorySalesAnalyticsApiRecord = {
  period: InventoryAnalyticsPeriod;
  revenue_series: InventorySalesAnalyticsPointApiRecord[];
  top_products_by_inventory_value: InventorySalesAnalyticsTopProductApiRecord[];
  top_products_by_stocks_sold: InventorySalesAnalyticsTopProductApiRecord[];
};

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapProduct(record: InventoryProductApiRecord): InventoryProductRecord {
  return {
    category: record.category,
    cost: toNumber(record.cost),
    createdAt: record.created_at,
    description: record.description,
    id: record.id,
    imageUrl: record.image_url,
    isActive: record.is_active,
    name: record.name,
    price: toNumber(record.price),
    reorderThreshold: record.reorder_threshold,
    stockQuantity: record.stock_quantity,
    updatedAt: record.updated_at
  };
}

function mapEquipment(
  record: InventoryEquipmentApiRecord
): InventoryEquipmentRecord {
  return {
    createdAt: record.created_at,
    description: record.description,
    id: record.id,
    imageUrl: record.image_url,
    isActive: record.is_active,
    name: record.name,
    quantityCurrent: record.quantity_current,
    quantityTotal: record.quantity_total,
    unit: record.unit,
    updatedAt: record.updated_at
  };
}

function mapEquipmentWriteOff(
  record: InventoryEquipmentWriteOffApiRecord
): InventoryEquipmentWriteOffRecord {
  return {
    createdAt: record.created_at,
    equipmentId: record.equipment_id,
    id: record.id,
    performedBy: record.performed_by,
    performer: record.performer
      ? {
          firstName: record.performer.first_name,
          id: record.performer.id,
          lastName: record.performer.last_name
        }
      : null,
    quantityBefore: record.quantity_before,
    quantityLost: record.quantity_lost,
    quantitySetTo: record.quantity_set_to,
    reason: record.reason,
    updatedAt: record.updated_at
  };
}

function mapEquipmentDetail(
  record: InventoryEquipmentDetailApiRecord
): InventoryEquipmentDetailRecord {
  return {
    ...mapEquipment(record),
    writeOffs: record.write_offs.map(mapEquipmentWriteOff)
  };
}

function mapSaleSummary(
  record: InventorySaleTransactionSummaryApiRecord
): InventorySaleTransactionSummaryRecord {
  return {
    createdAt: record.created_at,
    customerName: record.customer_name,
    customerUserId: record.customer_user_id,
    id: record.id,
    itemsCount: record.items_count,
    notes: record.notes,
    paymentId: record.payment_id,
    paymentMethod: record.payment_method,
    processedBy: record.processed_by,
    source: record.source,
    staff: record.staff
      ? {
          firstName: record.staff.first_name,
          id: record.staff.id,
          lastName: record.staff.last_name
        }
      : null,
    status: record.status,
    totalAmount: toNumber(record.total_amount),
    updatedAt: record.updated_at
  };
}

function mapSaleDetail(
  record: InventorySaleTransactionDetailApiRecord
): InventorySaleTransactionDetailRecord {
  return {
    ...mapSaleSummary(record),
    items: record.items.map((item) => ({
      id: item.id,
      product: item.product
        ? {
            id: item.product.id,
            imageUrl: item.product.image_url,
            name: item.product.name
          }
        : null,
      productId: item.product_id,
      quantity: item.quantity,
      subtotal: toNumber(item.subtotal),
      unitPrice: toNumber(item.unit_price)
    }))
  };
}

function mapSaleCheckout(
  record: InventorySaleCheckoutApiRecord
): InventorySaleCheckoutRecord {
  return {
    checkoutUrl: record.checkout_url,
    paymentId: record.payment_id,
    paymentStatus: record.payment_status,
    saleId: record.sale_id,
    status: record.status
  };
}

function mapSalesSummary(
  record: InventorySalesSummaryApiRecord
): InventorySalesSummaryRecord {
  return {
    completedSalesCount: record.completed_sales_count,
    totalRevenue: toNumber(record.total_revenue)
  };
}

function mapSalesAnalytics(
  record: InventorySalesAnalyticsApiRecord
): InventorySalesAnalyticsRecord {
  return {
    period: record.period,
    revenueSeries: record.revenue_series.map((point) => ({
      bucketLabel: point.bucket_label,
      revenue: toNumber(point.revenue)
    })),
    topProductsByInventoryValue: record.top_products_by_inventory_value.map((item) => ({
      name: item.name,
      value: toNumber(item.value)
    })),
    topProductsByStocksSold: record.top_products_by_stocks_sold.map((item) => ({
      name: item.name,
      value: toNumber(item.value)
    }))
  };
}

function toProductListParams(params?: InventoryProductListParams) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.search ? { search: params.search } : {}),
    ...(params?.inStockOnly !== undefined ? { in_stock_only: params.inStockOnly } : {})
  };
}

function toSaleListParams(params?: InventorySaleListParams) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.startDate ? { start_date: params.startDate } : {}),
    ...(params?.endDate ? { end_date: params.endDate } : {})
  };
}

function toEquipmentListParams(params?: InventoryEquipmentListParams) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {})
  };
}

function toProductMutationInput(payload: InventoryProductMutationInput) {
  return {
    ...(payload.category !== undefined ? { category: payload.category } : {}),
    ...(payload.cost !== undefined ? { cost: payload.cost } : {}),
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.price !== undefined ? { price: payload.price } : {}),
    ...(payload.stockQuantity !== undefined ? { stock_quantity: payload.stockQuantity } : {}),
    ...(payload.reorderThreshold !== undefined
      ? { reorder_threshold: payload.reorderThreshold }
      : {}),
    ...(payload.imageUrl !== undefined ? { image_url: payload.imageUrl } : {}),
    ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {})
  };
}

function toEquipmentCreateInput(payload: InventoryEquipmentCreateInput) {
  return {
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.imageUrl !== undefined ? { image_url: payload.imageUrl } : {}),
    name: payload.name,
    quantity_current: payload.quantityCurrent,
    quantity_total: payload.quantityTotal,
    ...(payload.unit !== undefined ? { unit: payload.unit } : {})
  };
}

function toEquipmentUpdateInput(payload: InventoryEquipmentUpdateInput) {
  return {
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.imageUrl !== undefined ? { image_url: payload.imageUrl } : {}),
    ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.quantityCurrent !== undefined
      ? { quantity_current: payload.quantityCurrent }
      : {}),
    ...(payload.quantityTotal !== undefined
      ? { quantity_total: payload.quantityTotal }
      : {}),
    ...(payload.unit !== undefined ? { unit: payload.unit } : {})
  };
}

function toEquipmentWriteOffInput(payload: InventoryEquipmentWriteOffInput) {
  return {
    quantity_set_to: payload.quantitySetTo,
    reason: payload.reason
  };
}

function toEquipmentArchiveInput(payload: InventoryEquipmentArchiveInput) {
  return {
    quantity_to_archive: payload.quantityToArchive,
    reason: payload.reason
  };
}

function toCreateSaleInput(payload: InventoryCreateSaleInput) {
  return {
    ...(payload.customerName !== undefined ? { customer_name: payload.customerName } : {}),
    ...(payload.customerUserId !== undefined
      ? { customer_user_id: payload.customerUserId }
      : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    payment_method: payload.paymentMethod,
    items: payload.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      ...(item.unitPrice !== undefined ? { unit_price: item.unitPrice } : {})
    }))
  };
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createInventoryApi(transport: ApiTransport) {
  return {
    async listProducts(
      params?: InventoryProductListParams
    ): Promise<InventoryPaginatedResult<InventoryProductRecord>> {
      const result = await unwrapPaginatedResponse<InventoryProductApiRecord>(
        transport.get("/inventory/products", { params: toProductListParams(params) }),
        "Unable to load inventory products."
      );
      return {
        ...result,
        data: result.data.map(mapProduct)
      };
    },
    async getProductById(productId: string) {
      return mapProduct(
        await unwrapResponse<InventoryProductApiRecord>(
          transport.get(`/inventory/products/${productId}`),
          "Unable to load inventory product."
        )
      );
    },
    async createProduct(payload: InventoryProductMutationInput) {
      return mapProduct(
        await unwrapResponse<InventoryProductApiRecord>(
          transport.post("/inventory/products", toProductMutationInput(payload)),
          "Unable to create inventory product."
        )
      );
    },
    async updateProduct(productId: string, payload: InventoryProductMutationInput) {
      return mapProduct(
        await unwrapResponse<InventoryProductApiRecord>(
          transport.patch(`/inventory/products/${productId}`, toProductMutationInput(payload)),
          "Unable to update inventory product."
        )
      );
    },
    async restockProduct(productId: string, payload: InventoryRestockInput) {
      return mapProduct(
        await unwrapResponse<InventoryProductApiRecord>(
          transport.post(`/inventory/products/${productId}/restock`, {
            quantity: payload.quantity,
            ...(payload.notes ? { notes: payload.notes } : {})
          }),
          "Unable to restock inventory product."
        )
      );
    },
    async listEquipment(
      params?: InventoryEquipmentListParams
    ): Promise<InventoryPaginatedResult<InventoryEquipmentRecord>> {
      const result = await unwrapPaginatedResponse<InventoryEquipmentApiRecord>(
        transport.get("/inventory/equipment", { params: toEquipmentListParams(params) }),
        "Unable to load inventory equipment."
      );
      return {
        ...result,
        data: result.data.map(mapEquipment)
      };
    },
    async getEquipmentById(equipmentId: string) {
      return mapEquipmentDetail(
        await unwrapResponse<InventoryEquipmentDetailApiRecord>(
          transport.get(`/inventory/equipment/${equipmentId}`),
          "Unable to load inventory equipment item."
        )
      );
    },
    async createEquipment(payload: InventoryEquipmentCreateInput) {
      return mapEquipment(
        await unwrapResponse<InventoryEquipmentApiRecord>(
          transport.post("/inventory/equipment", toEquipmentCreateInput(payload)),
          "Unable to create inventory equipment item."
        )
      );
    },
    async updateEquipment(equipmentId: string, payload: InventoryEquipmentUpdateInput) {
      return mapEquipment(
        await unwrapResponse<InventoryEquipmentApiRecord>(
          transport.patch(`/inventory/equipment/${equipmentId}`, toEquipmentUpdateInput(payload)),
          "Unable to update inventory equipment item."
        )
      );
    },
    async writeOffEquipment(equipmentId: string, payload: InventoryEquipmentWriteOffInput) {
      return mapEquipmentWriteOff(
        await unwrapResponse<InventoryEquipmentWriteOffApiRecord>(
          transport.post(
            `/inventory/equipment/${equipmentId}/writeoff`,
            toEquipmentWriteOffInput(payload)
          ),
          "Unable to record inventory equipment write-off."
        )
      );
    },
    async archiveEquipment(equipmentId: string, payload: InventoryEquipmentArchiveInput) {
      return mapEquipment(
        await unwrapResponse<InventoryEquipmentApiRecord>(
          transport.post(
            `/inventory/equipment/${equipmentId}/archive`,
            toEquipmentArchiveInput(payload)
          ),
          "Unable to archive inventory equipment item."
        )
      );
    },
    async listSales(
      params?: InventorySaleListParams
    ): Promise<InventoryPaginatedResult<InventorySaleTransactionSummaryRecord>> {
      const result = await unwrapPaginatedResponse<InventorySaleTransactionSummaryApiRecord>(
        transport.get("/inventory/sales", { params: toSaleListParams(params) }),
        "Unable to load inventory sales."
      );
      return {
        ...result,
        data: result.data.map(mapSaleSummary)
      };
    },
    async getSalesSummary(params?: InventorySaleListParams) {
      return mapSalesSummary(
        await unwrapResponse<InventorySalesSummaryApiRecord>(
          transport.get("/inventory/sales/summary", {
            params: toSaleListParams(params)
          }),
          "Unable to load inventory sales summary."
        )
      );
    },
    async getSalesAnalytics(period: InventoryAnalyticsPeriod) {
      return mapSalesAnalytics(
        await unwrapResponse<InventorySalesAnalyticsApiRecord>(
          transport.get("/inventory/sales/analytics", {
            params: { period }
          }),
          "Unable to load inventory sales analytics."
        )
      );
    },
    async getSaleById(saleId: string) {
      return mapSaleDetail(
        await unwrapResponse<InventorySaleTransactionDetailApiRecord>(
          transport.get(`/inventory/sales/${saleId}`),
          "Unable to load inventory sale."
        )
      );
    },
    async createSale(payload: InventoryCreateSaleInput) {
      const result = await unwrapResponse<
        InventorySaleCheckoutApiRecord | InventorySaleTransactionDetailApiRecord
      >(
        transport.post("/inventory/sales", toCreateSaleInput(payload), {
          headers: {
            "Idempotency-Key": createIdempotencyKey()
          }
        }),
        "Unable to create inventory sale."
      );
      return "sale_id" in result ? mapSaleCheckout(result) : mapSaleDetail(result);
    }
  };
}
