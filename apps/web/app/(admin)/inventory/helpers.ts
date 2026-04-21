import type {
  InventoryEquipmentRecord,
  InventoryProductCategory,
  InventoryProductRecord,
  InventorySaleTransactionSummaryRecord
} from "@fittrack/types";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import type {
  EquipmentAvailabilityStatus,
  RetailStockStatus
} from "@/data/inventory/inventory";

export const MIN_ACTION_DELAY_MS = FEEDBACK_DURATION_MS.standard;

export function filterRetailProducts(
  products: Array<
    InventoryProductRecord & {
      status: RetailStockStatus;
      totalValue: number;
    }
  >,
  query: string,
  stockFilter: "All" | RetailStockStatus,
  categoryFilter: InventoryProductCategory | "all"
) {
  const normalizedQuery = query.trim().toLowerCase();

  return products.filter((product) => {
    const matchesSearch =
      normalizedQuery.length === 0 ||
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.id.toLowerCase().includes(normalizedQuery) ||
      product.category.toLowerCase().includes(normalizedQuery) ||
      (product.description ?? "").toLowerCase().includes(normalizedQuery);
    const matchesStock = stockFilter === "All" ? true : product.status === stockFilter;
    const matchesCategory =
      categoryFilter === "all" ? true : product.category === categoryFilter;

    return matchesSearch && matchesStock && matchesCategory;
  });
}

export function filterEquipmentItems(
  equipment: Array<
    InventoryEquipmentRecord & {
      missingCount: number;
      status: EquipmentAvailabilityStatus;
    }
  >,
  query: string,
  statusFilter: "All" | EquipmentAvailabilityStatus
) {
  const normalizedQuery = query.trim().toLowerCase();

  return equipment.filter((item) => {
    const matchesSearch =
      normalizedQuery.length === 0 ||
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.id.toLowerCase().includes(normalizedQuery) ||
      item.unit.toLowerCase().includes(normalizedQuery) ||
      (item.description ?? "").toLowerCase().includes(normalizedQuery);
    const matchesStatus = statusFilter === "All" ? true : item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
}

export function getRetailInventoryStatus(
  stockQuantity: number,
  reorderThreshold: number
): RetailStockStatus {
  if (stockQuantity === 0) return "Out of Stock";
  if (stockQuantity <= reorderThreshold) return "Low Stock";
  return "In Stock";
}

export function getEquipmentAvailabilityStatus(
  quantityCurrent: number,
  quantityTotal: number
): EquipmentAvailabilityStatus {
  if (quantityCurrent === 0) return "Unavailable";
  if (quantityCurrent < quantityTotal) return "Attention";
  return "Ready";
}

export function getTopProducts(products: InventoryProductRecord[]) {
  return products
    .map((product) => ({ name: product.name, value: product.price * product.stockQuantity }))
    .sort((a, b) => b.value - a.value);
}

function createBucketLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

export function buildMonthlySalesSeries(
  sales: InventorySaleTransactionSummaryRecord[]
) {
  const now = new Date();
  const buckets = new Map<string, { month: string; revenue: number }>();

  for (let index = 5; index >= 0; index -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${bucketDate.getFullYear()}-${bucketDate.getMonth()}`;
    buckets.set(key, {
      month: createBucketLabel(bucketDate),
      revenue: 0
    });
  }

  for (const sale of sales) {
    if (sale.status !== "completed") continue;
    const bucketDate = new Date(sale.createdAt);
    const key = `${bucketDate.getFullYear()}-${bucketDate.getMonth()}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += sale.totalAmount;
  }

  return [...buckets.values()];
}
