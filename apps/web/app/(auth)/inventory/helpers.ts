import type {
  InventoryEquipmentRecord,
  InventoryProductCategory,
  InventoryProductRecord,
  InventorySaleTransactionDetailRecord,
  InventorySaleTransactionSummaryRecord
} from "@fittrack/types";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import type {
  EquipmentAvailabilityStatus,
  InventoryAnalyticsPeriod,
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
  if (quantityCurrent === 0) return "Broken";
  if (quantityCurrent < quantityTotal) return "Under Maintenance";
  return "Available";
}

export function getTopProductsByInventoryValue(products: InventoryProductRecord[]) {
  return products
    .map((product) => ({
      name: product.name,
      value: product.price * product.stockQuantity
    }))
    .sort((a, b) => b.value - a.value);
}

export function getTopProductsByStocksSold(
  sales: InventorySaleTransactionDetailRecord[]
) {
  const totals = new Map<string, { name: string; value: number }>();

  for (const sale of sales) {
    if (sale.status !== "completed") continue;

    for (const item of sale.items) {
      const name = item.product?.name ?? item.productId.slice(0, 8).toUpperCase();
      const current = totals.get(item.productId) ?? { name, value: 0 };
      current.value += item.quantity;
      totals.set(item.productId, current);
    }
  }

  return [...totals.values()].sort((a, b) => b.value - a.value);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const current = startOfDay(date);
  const day = current.getDay();
  const diff = (day + 6) % 7;
  current.setDate(current.getDate() - diff);
  return current;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarter(date: Date) {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterMonth, 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addYears(date: Date, years: number) {
  return new Date(date.getFullYear() + years, 0, 1);
}

function formatBucketLabel(date: Date, period: InventoryAnalyticsPeriod) {
  if (period === "Daily") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (period === "Weekly") {
    return `Week of ${date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })}`;
  }

  if (period === "Monthly") {
    return date.toLocaleDateString("en-US", { month: "short" });
  }

  if (period === "Quarterly") {
    return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  }

  return date.getFullYear().toString();
}

export function buildSalesRevenueSeries(
  sales: InventorySaleTransactionSummaryRecord[],
  period: InventoryAnalyticsPeriod
) {
  const now = new Date();
  const buckets = new Map<string, { label: string; revenue: number }>();
  const bucketCount =
    period === "Daily"
      ? 7
      : period === "Weekly"
        ? 8
        : period === "Monthly"
          ? 6
          : period === "Quarterly"
            ? 4
            : 5;
  const getStart =
    period === "Daily"
      ? startOfDay
      : period === "Weekly"
        ? startOfWeek
        : period === "Monthly"
          ? startOfMonth
          : period === "Quarterly"
            ? startOfQuarter
            : startOfYear;
  const advance =
    period === "Daily"
      ? (date: Date, offset: number) => addDays(date, offset)
      : period === "Weekly"
        ? (date: Date, offset: number) => addDays(date, offset * 7)
        : period === "Monthly"
          ? addMonths
          : period === "Quarterly"
            ? (date: Date, offset: number) => addMonths(date, offset * 3)
            : addYears;

  const startingBucket = advance(getStart(now), -(bucketCount - 1));

  for (let index = 0; index < bucketCount; index += 1) {
    const bucketDate = advance(startingBucket, index);
    const key = getStart(bucketDate).toISOString();
    buckets.set(key, {
      label: formatBucketLabel(bucketDate, period),
      revenue: 0
    });
  }

  for (const sale of sales) {
    if (sale.status !== "completed") continue;
    const bucketDate = getStart(new Date(sale.createdAt));
    const key = bucketDate.toISOString();
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += sale.totalAmount;
  }

  return [...buckets.values()];
}
