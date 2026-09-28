"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useDebounce, useTimedMessage } from "@fittrack/hooks";
import {
  archiveInventoryEquipmentMutationOptions,
  createInventorySaleMutationOptions,
  createInventoryEquipmentMutationOptions,
  createInventoryProductMutationOptions,
  inventoryEquipmentDetailQueryOptions,
  inventoryEquipmentQueryOptions,
  inventoryProductDetailQueryOptions,
  inventoryProductsQueryOptions,
  inventorySalesAnalyticsQueryOptions,
  inventorySalesSummaryQueryOptions,
  inventorySalesQueryOptions,
  restockInventoryProductMutationOptions,
  transitionInventoryEquipmentMutationOptions,
  uploadImageMutationOptions,
  updateInventoryEquipmentMutationOptions,
  updateInventoryProductMutationOptions
} from "@fittrack/query";
import type {
  InventoryEquipmentCreateInput,
  InventoryEquipmentDetailRecord,
  InventoryEquipmentRecord,
  InventoryEquipmentStatusTransitionInput,
  InventoryEquipmentUpdateInput,
  InventoryArchiveFilter,
  InventoryProductCategory,
  InventoryProductMutationInput,
  InventoryProductRecord
} from "@fittrack/types";
import type {
  EquipmentAvailabilityStatus,
  InventoryAnalyticsPeriod,
  InventoryRevenueWindowFilter,
  InventoryTopRetailMetric,
  InventoryTab,
  RetailStockStatus
} from "@/data/inventory/inventory";
import { webApiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import {
  filterEquipmentItems,
  filterRetailProducts,
  getEquipmentMissingCount,
  getEquipmentStatusRows,
  getRetailInventoryStatus,
} from "@/app/(auth)/inventory/helpers";

const INVENTORY_LIST_PARAMS = { limit: 100, page: 1 } as const;

function toInventoryIsActive(archiveFilter: InventoryArchiveFilter): boolean | undefined {
  if (archiveFilter === "active") return true;
  if (archiveFilter === "archived") return false;
  return undefined;
}
const EMPTY_META = { page: 1, limit: 0, total: 0, total_pages: 0 } as const;
const EQUIPMENT_PRESET_NAMES: Record<string, string> = {
  "adjustable-bench": "Adjustable Bench",
  "concept-rower": "Concept Rower",
  "hex-dumbbell-set": "Hex Dumbbell Set",
  "spin-bike": "Spin Bike",
  "squat-rack": "Squat Rack",
  treadmill: "Treadmill"
};

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function resolveSalesRevenueSummaryWindow(filter: InventoryRevenueWindowFilter) {
  if (filter === "all") return undefined;

  const end = new Date();

  if (filter === "today") {
    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 0, 0, 0, 0)
    );

    return {
      endDate: toDateOnly(end),
      startDate: toDateOnly(start)
    };
  }

  if (filter === "1m") {
    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1, 0, 0, 0, 0)
    );

    return {
      endDate: toDateOnly(end),
      startDate: toDateOnly(start)
    };
  }

  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1, 0, 0, 0, 0)
  );

  return {
    endDate: toDateOnly(end),
    startDate: toDateOnly(start)
  };
}

export type InventoryRetailTableRow = InventoryProductRecord & {
  status: RetailStockStatus;
  totalValue: number;
};

export type InventoryEquipmentTableRow = InventoryEquipmentRecord & {
  missingCount: number;
  rowId: string;
  status: EquipmentAvailabilityStatus;
  statusQuantity: number;
};

const EQUIPMENT_STATUS_BUCKET_BY_LABEL = {
  Available: "available",
  "Under Maintenance": "maintenance",
  Broken: "broken",
  Missing: "missing"
} as const;

export type InventoryEquipmentDetailRow = InventoryEquipmentDetailRecord & {
  missingCount: number;
  rowId: string;
  status: EquipmentAvailabilityStatus;
  statusQuantity: number;
};

export type InventoryRetailSaleInput = {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  notes?: string;
};

function normalizeOptionalText(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseNonNegativeInteger(
  value: string | undefined,
  label: string
): { error?: string; value?: number } {
  const normalized = (value ?? "").trim();
  const parsed = Number(normalized);

  if (!/^\d+$/.test(normalized) || !Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { error: `${label} must be a whole number.` };
  }

  if (parsed < 0) {
    return { error: `${label} cannot be negative.` };
  }

  return { value: parsed };
}

function parsePositiveNumber(
  value: string | undefined,
  label: string
): { error?: string; value?: number } {
  const normalized = (value ?? "").trim();
  const parsed = Number(normalized);

  if (!/^\d+(?:\.\d+)?$/.test(normalized) || !Number.isFinite(parsed)) {
    return { error: `${label} must be a number.` };
  }

  if (parsed <= 0) {
    return { error: `${label} must be greater than 0.` };
  }

  return { value: parsed };
}

function toRetailRow(product: InventoryProductRecord): InventoryRetailTableRow {
  return {
    ...product,
    status: getRetailInventoryStatus(product.stockQuantity, product.reorderThreshold),
    totalValue: product.price * product.stockQuantity
  };
}

function toEquipmentRows(
  equipment: InventoryEquipmentRecord
): InventoryEquipmentTableRow[] {
  const missingCount = getEquipmentMissingCount(equipment);

  return getEquipmentStatusRows(equipment).map(({ quantity, status }) => ({
    ...equipment,
    missingCount,
    rowId: `${equipment.id}:${status}`,
    status,
    statusQuantity: quantity
  }));
}

function toEquipmentDetailRow(
  equipment: InventoryEquipmentDetailRecord,
  preferredStatus?: EquipmentAvailabilityStatus | null
): InventoryEquipmentDetailRow {
  const statusRows = getEquipmentStatusRows(equipment);
  const selectedStatusRow =
    statusRows.find((row) => row.status === preferredStatus) ?? statusRows[0];

  return {
    ...equipment,
    missingCount: getEquipmentMissingCount(equipment),
    rowId: `${equipment.id}:${selectedStatusRow.status}`,
    status: selectedStatusRow.status,
    statusQuantity: selectedStatusRow.quantity
  };
}

function resolveEquipmentStatusUpdate(
  status: EquipmentAvailabilityStatus,
  equipment: InventoryEquipmentTableRow | InventoryEquipmentDetailRow
): Pick<
  InventoryEquipmentUpdateInput,
  "quantityCurrent" | "quantityMaintenance" | "quantityBroken" | "quantityMissing"
> {
  const total = Math.max(equipment.quantityTotal, 0);
  const statusCounts = equipment.statusCounts;
  const hasCanonicalCounts = ["maintenance", "broken", "missing"].every(
    (key) => typeof statusCounts?.[key as keyof typeof statusCounts] === "number"
  );

  if (!hasCanonicalCounts) {
    return {
      quantityBroken: status === "Broken" ? total : 0,
      quantityCurrent: status === "Available" ? total : 0,
      quantityMaintenance: status === "Under Maintenance" ? total : 0,
      quantityMissing: status === "Missing" ? total : 0
    };
  }

  const counts = {
    available: Math.max(statusCounts.available ?? equipment.quantityCurrent, 0),
    broken: Math.max(statusCounts.broken ?? 0, 0),
    maintenance: Math.max(statusCounts.maintenance ?? 0, 0),
    missing: Math.max(statusCounts.missing ?? 0, 0)
  };
  const statusKeys = {
    Available: "available",
    Broken: "broken",
    Missing: "missing",
    "Under Maintenance": "maintenance"
  } as const;
  const currentKey = statusKeys[equipment.status];
  const nextKey = statusKeys[status];
  const movedQuantity = Math.min(counts[currentKey], Math.max(equipment.statusQuantity, 0));

  counts[currentKey] = Math.max(counts[currentKey] - movedQuantity, 0);
  counts[nextKey] += movedQuantity;

  return {
    quantityBroken: counts.broken,
    quantityCurrent: counts.available,
    quantityMaintenance: counts.maintenance,
    quantityMissing: counts.missing
  };
}

export function useInventoryDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const consumedDeepLinkRef = useRef<string | null>(null);
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState<InventoryTab>("retail");
  const [salesRevenuePeriod, setSalesRevenuePeriod] =
    useState<InventoryAnalyticsPeriod>("Monthly");
  const [salesRevenueWindowFilter, setSalesRevenueWindowFilter] =
    useState<InventoryRevenueWindowFilter>("all");
  const [topRetailMetric, setTopRetailMetric] =
    useState<InventoryTopRetailMetric>("By Inventory Value");
  const [retailStockFilter, setRetailStockFilter] = useState<"All" | RetailStockStatus>("All");
  const [retailCategoryFilter, setRetailCategoryFilter] =
    useState<InventoryProductCategory | "all">("all");
  const [equipmentStatusFilter, setEquipmentStatusFilter] =
    useState<"All" | EquipmentAvailabilityStatus>("All");
  const [equipmentArchiveFilter, setEquipmentArchiveFilter] =
    useState<InventoryArchiveFilter>("active");
  const [retailArchiveFilter, setRetailArchiveFilter] =
    useState<InventoryArchiveFilter>("active");
  const [createRetailOpen, setCreateRetailOpen] = useState(false);
  const [selectedRetailId, setSelectedRetailId] = useState<string | null>(null);
  const [restockRetailId, setRestockRetailId] = useState<string | null>(null);
  const [saleRetailId, setSaleRetailId] = useState<string | null>(null);
  const [retailSaleOpen, setRetailSaleOpen] = useState(false);
  const [archiveRetailId, setArchiveRetailId] = useState<string | null>(null);
  const [createEquipmentOpen, setCreateEquipmentOpen] = useState(false);
  const [createEquipmentPreset, setCreateEquipmentPreset] = useState("new");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [selectedEquipmentStatus, setSelectedEquipmentStatus] =
    useState<EquipmentAvailabilityStatus | null>(null);
  const [equipmentDetailsDeepLinkId, setEquipmentDetailsDeepLinkId] =
    useState<string | null>(null);
  const [writeOffEquipmentId, setWriteOffEquipmentId] = useState<string | null>(null);
  const [writeOffEquipmentStatus, setWriteOffEquipmentStatus] =
    useState<EquipmentAvailabilityStatus | null>(null);
  const [archiveEquipmentId, setArchiveEquipmentId] = useState<string | null>(null);
  const [archiveEquipmentStatus, setArchiveEquipmentStatus] =
    useState<EquipmentAvailabilityStatus | null>(null);
  const [createRetailImageUrl, setCreateRetailImageUrl] = useState("");
  const [detailRetailImageUrl, setDetailRetailImageUrl] = useState("");
  const [createEquipmentImageUrl, setCreateEquipmentImageUrl] = useState("");
  const [detailEquipmentImageUrl, setDetailEquipmentImageUrl] = useState("");
  const uploadPendingRef = useRef(false);
  const [inventoryImageUploadPending, setInventoryImageUploadPending] = useState(false);
  const debouncedQ = useDebounce(q, 250);
  const { message, showMessage } = useTimedMessage(2500);
  const notificationUserId = user?.id;

  const retailListParams = useMemo(() => {
    const isActive = toInventoryIsActive(retailArchiveFilter);
    return isActive === undefined
      ? INVENTORY_LIST_PARAMS
      : { ...INVENTORY_LIST_PARAMS, isActive };
  }, [retailArchiveFilter]);

  const equipmentListParams = useMemo(() => {
    const isActive = toInventoryIsActive(equipmentArchiveFilter);
    return isActive === undefined
      ? INVENTORY_LIST_PARAMS
      : { ...INVENTORY_LIST_PARAMS, isActive };
  }, [equipmentArchiveFilter]);

  const {
    data: productsResponse = { data: [], meta: EMPTY_META },
    isLoading: productsLoading,
    isRefetching: productsRefetching,
    refetch: refetchProducts
  } = useQuery({
    ...inventoryProductsQueryOptions(webApiClient, retailListParams),
    staleTime: 60_000,
    gcTime: 300_000
  });

  const {
    data: equipmentResponse = { data: [], meta: EMPTY_META },
    isLoading: equipmentLoading,
    isRefetching: equipmentRefetching,
    refetch: refetchEquipment
  } = useQuery({
    ...inventoryEquipmentQueryOptions(webApiClient, equipmentListParams),
    staleTime: 60_000,
    gcTime: 300_000
  });

  const {
    data: salesResponse = { data: [], meta: EMPTY_META },
    isLoading: salesLoading,
    isRefetching: salesRefetching,
    refetch: refetchSales
  } = useQuery({
    ...inventorySalesQueryOptions(webApiClient, INVENTORY_LIST_PARAMS),
    staleTime: 60_000,
    gcTime: 300_000
  });
  const salesRevenueSummaryWindow = useMemo(
    () => resolveSalesRevenueSummaryWindow(salesRevenueWindowFilter),
    [salesRevenueWindowFilter]
  );
  const { data: salesSummary } = useQuery({
    ...inventorySalesSummaryQueryOptions(webApiClient, salesRevenueSummaryWindow),
    staleTime: 60_000,
    gcTime: 300_000
  });
  const { data: salesAnalytics, isLoading: salesAnalyticsLoading } = useQuery({
    ...inventorySalesAnalyticsQueryOptions(webApiClient, salesRevenuePeriod),
    staleTime: 60_000,
    gcTime: 300_000
  });

  const productDetailQuery = useQuery({
    ...inventoryProductDetailQueryOptions(webApiClient, selectedRetailId ?? undefined),
    enabled: Boolean(selectedRetailId && selectedRetailId !== archiveRetailId)
  });

  const restockProductDetailQuery = useQuery({
    ...inventoryProductDetailQueryOptions(webApiClient, restockRetailId ?? undefined),
    enabled: Boolean(restockRetailId)
  });

  const equipmentDetailQuery = useQuery({
    ...inventoryEquipmentDetailQueryOptions(webApiClient, selectedEquipmentId ?? undefined),
    enabled: Boolean(selectedEquipmentId)
  });

  const createProductMutation = useMutation(
    createInventoryProductMutationOptions(webApiClient, queryClient, notificationUserId)
  );
  const updateProductMutation = useMutation(
    updateInventoryProductMutationOptions(webApiClient, queryClient, notificationUserId)
  );
  const archiveProductMutation = useMutation(
    updateInventoryProductMutationOptions(webApiClient, queryClient, notificationUserId)
  );
  const restockProductMutation = useMutation(
    restockInventoryProductMutationOptions(webApiClient, queryClient, notificationUserId)
  );
  const createSaleMutation = useMutation(
    createInventorySaleMutationOptions(webApiClient, queryClient, notificationUserId)
  );
  const uploadImageMutation = useMutation(uploadImageMutationOptions(webApiClient));
  const createEquipmentMutation = useMutation(
    createInventoryEquipmentMutationOptions(webApiClient, queryClient, notificationUserId)
  );
  const updateEquipmentMutation = useMutation(
    updateInventoryEquipmentMutationOptions(webApiClient, queryClient, notificationUserId)
  );
  const archiveEquipmentMutation = useMutation(
    archiveInventoryEquipmentMutationOptions(webApiClient, queryClient, notificationUserId)
  );
  const transitionEquipmentMutation = useMutation(
    transitionInventoryEquipmentMutationOptions(webApiClient, queryClient, notificationUserId)
  );

  const retailProducts = useMemo(
    () => productsResponse.data.map(toRetailRow),
    [productsResponse.data]
  );
  const equipmentRecords = useMemo(
    () => equipmentResponse.data,
    [equipmentResponse.data]
  );
  const equipmentItems = useMemo(
    () => equipmentRecords.flatMap(toEquipmentRows),
    [equipmentRecords]
  );
  const filteredRetailProducts = useMemo(
    () =>
      filterRetailProducts(
        retailProducts,
        debouncedQ,
        retailStockFilter,
        retailCategoryFilter
      ),
    [retailProducts, debouncedQ, retailStockFilter, retailCategoryFilter]
  );
  const retailSaleProducts = useMemo(
    () =>
      retailProducts.filter(
        (product) => product.isActive && product.stockQuantity > 0
      ),
    [retailProducts]
  );
  const filteredEquipmentItems = useMemo(
    () =>
      filterEquipmentItems(equipmentItems, debouncedQ, equipmentStatusFilter),
    [equipmentItems, debouncedQ, equipmentStatusFilter]
  );
  const topProducts = useMemo(
    () =>
      topRetailMetric === "By Stocks Sold"
        ? (salesAnalytics?.topProductsByStocksSold ?? [])
        : (salesAnalytics?.topProductsByInventoryValue ?? []),
    [salesAnalytics, topRetailMetric]
  );
  const salesRevenueSeries = useMemo(
    () => salesAnalytics?.revenueSeries ?? [],
    [salesAnalytics]
  );
  const retailTotalValue = useMemo(
    () => retailProducts.reduce((acc, product) => acc + product.totalValue, 0),
    [retailProducts]
  );
  const totalRevenue = useMemo(
    () =>
      salesSummary?.totalRevenue ??
      salesResponse.data.reduce(
        (acc, sale) => (sale.status === "completed" ? acc + sale.totalAmount : acc),
        0
      ),
    [salesResponse.data, salesSummary?.totalRevenue]
  );
  const retailLowStockCount = retailProducts.filter(
    (product) => product.status === "Low Stock"
  ).length;
  const equipmentStatusCounts = useMemo(() => {
    const counts: Record<EquipmentAvailabilityStatus, number> = {
      Available: 0,
      Broken: 0,
      Missing: 0,
      "Under Maintenance": 0
    };

    for (const item of equipmentItems) {
      counts[item.status] += item.statusQuantity;
    }

    return counts;
  }, [equipmentItems]);
  const equipmentAttentionCount =
    equipmentStatusCounts["Under Maintenance"] +
    equipmentStatusCounts.Broken +
    equipmentStatusCounts.Missing;
  const equipmentCurrentUnits = useMemo(
    () => equipmentRecords.reduce((acc, item) => acc + item.quantityCurrent, 0),
    [equipmentRecords]
  );
  const equipmentTotalUnits = useMemo(
    () => equipmentRecords.reduce((acc, item) => acc + item.quantityTotal, 0),
    [equipmentRecords]
  );
  const equipmentMissingUnits = equipmentStatusCounts.Missing;
  const selectedRetail = useMemo(() => {
    if (!selectedRetailId) return null;
    if (productDetailQuery.data && productDetailQuery.data.id === selectedRetailId) {
      return toRetailRow(productDetailQuery.data);
    }

    return retailProducts.find((product) => product.id === selectedRetailId) ?? null;
  }, [selectedRetailId, productDetailQuery.data, retailProducts]);
  const selectedEquipmentRow = useMemo(() => {
    if (!selectedEquipmentId) return null;

    return (
      equipmentItems.find(
        (equipment) =>
          equipment.id === selectedEquipmentId &&
          (!selectedEquipmentStatus || equipment.status === selectedEquipmentStatus)
      ) ?? equipmentItems.find((equipment) => equipment.id === selectedEquipmentId) ?? null
    );
  }, [equipmentItems, selectedEquipmentId, selectedEquipmentStatus]);
  const selectedEquipmentDetail = useMemo(
    () =>
      equipmentDetailQuery.data
        ? toEquipmentDetailRow(
            equipmentDetailQuery.data,
            selectedEquipmentStatus ?? selectedEquipmentRow?.status
          )
        : null,
    [equipmentDetailQuery.data, selectedEquipmentRow?.status, selectedEquipmentStatus]
  );
  const selectedEquipment = useMemo(() => {
    if (!selectedEquipmentId) return null;
    if (
      selectedEquipmentDetail &&
      selectedEquipmentDetail.id === selectedEquipmentId
    ) {
      return selectedEquipmentDetail;
    }

    return selectedEquipmentRow;
  }, [selectedEquipmentId, selectedEquipmentDetail, selectedEquipmentRow]);
  const restockRetailTarget = useMemo(() => {
    if (!restockRetailId) return null;
    if (selectedRetail?.id === restockRetailId) return selectedRetail;
    if (
      restockProductDetailQuery.data &&
      restockProductDetailQuery.data.id === restockRetailId
    ) {
      return toRetailRow(restockProductDetailQuery.data);
    }
    return retailProducts.find((product) => product.id === restockRetailId) ?? null;
  }, [restockRetailId, selectedRetail, restockProductDetailQuery.data, retailProducts]);
  const archiveRetailTarget = useMemo(() => {
    if (!archiveRetailId) return null;
    if (selectedRetail?.id === archiveRetailId) return selectedRetail;
    return retailProducts.find((product) => product.id === archiveRetailId) ?? null;
  }, [archiveRetailId, selectedRetail, retailProducts]);
  const saleRetailTarget = useMemo(() => {
    if (!saleRetailId) return null;
    if (selectedRetail?.id === saleRetailId) return selectedRetail;
    return retailProducts.find((product) => product.id === saleRetailId) ?? null;
  }, [saleRetailId, selectedRetail, retailProducts]);
  const retailSaleProductOptions = useMemo(
    () =>
      retailSaleProducts.map((product) => ({
        label: `${product.name} (${product.stockQuantity} in stock)`,
        value: product.id
      })),
    [retailSaleProducts]
  );
  const writeOffEquipmentTarget = useMemo(() => {
    if (!writeOffEquipmentId) return null;
    if (
      selectedEquipment?.id === writeOffEquipmentId &&
      (!writeOffEquipmentStatus || selectedEquipment.status === writeOffEquipmentStatus)
    ) {
      return selectedEquipment;
    }
    return (
      equipmentItems.find(
        (equipment) =>
          equipment.id === writeOffEquipmentId &&
          (!writeOffEquipmentStatus || equipment.status === writeOffEquipmentStatus)
      ) ?? null
    );
  }, [writeOffEquipmentId, writeOffEquipmentStatus, selectedEquipment, equipmentItems]);
  const archiveEquipmentTarget = useMemo(() => {
    if (!archiveEquipmentId) return null;
    if (
      selectedEquipment?.id === archiveEquipmentId &&
      (!archiveEquipmentStatus || selectedEquipment.status === archiveEquipmentStatus)
    ) {
      return selectedEquipment;
    }
    return (
      equipmentItems.find(
        (equipment) =>
          equipment.id === archiveEquipmentId &&
          (!archiveEquipmentStatus || equipment.status === archiveEquipmentStatus)
      ) ?? null
    );
  }, [archiveEquipmentId, archiveEquipmentStatus, selectedEquipment, equipmentItems]);

  useEffect(() => {
    if (!createRetailOpen) {
      setCreateRetailImageUrl("");
    }
  }, [createRetailOpen]);

  useEffect(() => {
    setDetailRetailImageUrl(selectedRetail?.imageUrl ?? "");
  }, [selectedRetail?.id, selectedRetail?.imageUrl]);

  useEffect(() => {
    if (!createEquipmentOpen) {
      setCreateEquipmentImageUrl("");
      setCreateEquipmentPreset("new");
    }
  }, [createEquipmentOpen]);

  useEffect(() => {
    setDetailEquipmentImageUrl(selectedEquipment?.imageUrl ?? "");
  }, [selectedEquipment?.id, selectedEquipment?.imageUrl]);

  const isRefreshing = productsRefetching || equipmentRefetching || salesRefetching;
  const isRetailLoading = productsLoading;
  const isEquipmentLoading = equipmentLoading;
  const isAnalyticsLoading =
    productsLoading ||
    salesLoading ||
    salesAnalyticsLoading;
  const retailRestockLoading = Boolean(restockRetailId) &&
    !restockRetailTarget &&
    restockProductDetailQuery.isFetching;

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const modalParam = searchParams.get("modal");
    const productId = searchParams.get("productId");
    const equipmentId = searchParams.get("equipmentId");
    const normalizedTab: InventoryTab | null =
      tabParam === "retail" || tabParam === "equipment"
        ? tabParam
        : null;

    if (normalizedTab) {
      setTab(normalizedTab);
    }

    if (!modalParam) return;

    const signature = [normalizedTab ?? "", modalParam, productId ?? "", equipmentId ?? ""].join("|");
    if (consumedDeepLinkRef.current === signature) return;

    if (normalizedTab === "retail" && modalParam === "restock" && productId) {
      consumedDeepLinkRef.current = signature;
      setSelectedRetailId(null);
      setRestockRetailId(productId);
    }

    if (normalizedTab === "equipment" && modalParam === "details" && equipmentId) {
      consumedDeepLinkRef.current = signature;
      setArchiveEquipmentId(null);
      setArchiveEquipmentStatus(null);
      setWriteOffEquipmentId(null);
      setSelectedEquipmentId(equipmentId);
      setSelectedEquipmentStatus(null);
      setEquipmentDetailsDeepLinkId(equipmentId);
    }

    const nextParams = new URLSearchParams();
    if (normalizedTab) {
      nextParams.set("tab", normalizedTab);
    }

    const nextUrl = nextParams.toString()
      ? `/inventory?${nextParams.toString()}`
      : "/inventory";

    router.replace(nextUrl, { scroll: false });
  }, [router, searchParams]);

  const handleRefresh = async () => {
    await Promise.all([refetchProducts(), refetchEquipment(), refetchSales()]);
    showMessage("Inventory data refreshed.");
  };

  const openRetailDetails = (productId: string) => {
    setSelectedRetailId((current) => (current === productId ? null : productId));
  };

  const openRetailRestock = (productId: string) => {
    setRestockRetailId(productId);
  };

  const openRetailArchive = (productId: string) => {
    setArchiveRetailId(productId);
  };

  const openRetailSale = (productId?: string) => {
    setSaleRetailId(productId ?? null);
    setRetailSaleOpen(true);
  };

  const openEquipmentDetails = (
    equipmentId: string,
    status?: EquipmentAvailabilityStatus
  ) => {
    const nextStatus = status ?? null;
    setSelectedEquipmentId((current) =>
      current === equipmentId && selectedEquipmentStatus === nextStatus
        ? null
        : equipmentId
    );
    setSelectedEquipmentStatus((current) =>
      selectedEquipmentId === equipmentId && current === nextStatus
        ? null
        : nextStatus
    );
  };

  const openEquipmentWriteOff = (
    equipmentId: string,
    status?: EquipmentAvailabilityStatus
  ) => {
    setWriteOffEquipmentId(equipmentId);
    setWriteOffEquipmentStatus(
      status ?? (selectedEquipmentId === equipmentId ? selectedEquipmentStatus : null)
    );
  };

  const openEquipmentArchive = (
    equipmentId: string,
    status?: EquipmentAvailabilityStatus
  ) => {
    setArchiveEquipmentId(equipmentId);
    setArchiveEquipmentStatus(
      status ?? (selectedEquipmentId === equipmentId ? selectedEquipmentStatus : null)
    );
  };

  const handleUploadInventoryImage = async (
    file: File,
    scope: "create-equipment" | "create-retail" | "detail-equipment" | "detail-retail"
  ): Promise<boolean> => {
    if (uploadPendingRef.current || uploadImageMutation.isPending) return false;

    uploadPendingRef.current = true;
    setInventoryImageUploadPending(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResult = await uploadImageMutation.mutateAsync(formData);
      const nextUrl = uploadResult.url?.trim() ?? "";
      if (!nextUrl) throw new Error("Upload response did not include an image URL.");

      if (scope === "create-retail") setCreateRetailImageUrl(nextUrl);
      if (scope === "detail-retail") setDetailRetailImageUrl(nextUrl);
      if (scope === "create-equipment") setCreateEquipmentImageUrl(nextUrl);
      if (scope === "detail-equipment") setDetailEquipmentImageUrl(nextUrl);

      showMessage("Image uploaded.");
      return true;
    } catch {
      showMessage("Failed to upload the image.");
      return false;
    } finally {
      uploadPendingRef.current = false;
      setInventoryImageUploadPending(false);
    }
  };

  const handleCreateRetail = async (data: Record<string, string>) => {
    if (createProductMutation.isPending || inventoryImageUploadPending || uploadPendingRef.current) return;

    const name = normalizeOptionalText(data.name);
    const category = data.category as InventoryProductCategory | undefined;
    const cost = parsePositiveNumber(data.cost, "Cost");
    const price = parsePositiveNumber(data.price, "Price");
    const stockQuantity = parseNonNegativeInteger(
      data.stockQuantity,
      "Stock quantity"
    );
    const reorderThreshold = parseNonNegativeInteger(
      data.reorderThreshold,
      "Reorder threshold"
    );

    if (!name) {
      showMessage("Product name is required.");
      return;
    }
    if (!category) {
      showMessage("Choose a retail category.");
      return;
    }
    if (price.error) {
      showMessage(price.error);
      return;
    }
    if (cost.error) {
      showMessage(cost.error);
      return;
    }
    if (stockQuantity.error) {
      showMessage(stockQuantity.error);
      return;
    }
    if (reorderThreshold.error) {
      showMessage(reorderThreshold.error);
      return;
    }
    const payload: InventoryProductMutationInput = {
      category,
      cost: cost.value,
      ...(normalizeOptionalText(data.description) !== undefined
        ? { description: normalizeOptionalText(data.description) }
        : {}),
      ...(normalizeOptionalText(createRetailImageUrl) !== undefined
        ? { imageUrl: normalizeOptionalText(createRetailImageUrl) }
        : {}),
      name,
      price: price.value,
      reorderThreshold: reorderThreshold.value,
      stockQuantity: stockQuantity.value
    };

    try {
      await createProductMutation.mutateAsync({ payload });
      setCreateRetailOpen(false);
      setCreateRetailImageUrl("");
      showMessage(`${name} added to retail inventory.`);
    } catch {
      showMessage("Failed to add the retail product.");
    }
  };

  const handleUpdateRetail = async (data: Record<string, string>) => {
    if (!selectedRetail) return;

    const name = normalizeOptionalText(data.name);
    const category = data.category as InventoryProductCategory | undefined;
    const cost = parsePositiveNumber(data.cost, "Cost");
    const price = parsePositiveNumber(data.price, "Price");
    const stockQuantity = parseNonNegativeInteger(
      data.stockQuantity,
      "Stock quantity"
    );
    const reorderThreshold = parseNonNegativeInteger(
      data.reorderThreshold,
      "Reorder threshold"
    );

    if (!name) {
      showMessage("Product name is required.");
      return;
    }
    if (!category) {
      showMessage("Choose a retail category.");
      return;
    }
    if (price.error) {
      showMessage(price.error);
      return;
    }
    if (cost.error) {
      showMessage(cost.error);
      return;
    }
    if (stockQuantity.error) {
      showMessage(stockQuantity.error);
      return;
    }
    if (reorderThreshold.error) {
      showMessage(reorderThreshold.error);
      return;
    }

    const payload: InventoryProductMutationInput = {
      category,
      cost: cost.value,
      description: normalizeOptionalText(data.description),
      imageUrl: normalizeOptionalText(detailRetailImageUrl),
      name,
      price: price.value,
      reorderThreshold: reorderThreshold.value,
      stockQuantity: stockQuantity.value
    };

    try {
      await updateProductMutation.mutateAsync({
        payload,
        productId: selectedRetail.id
      });
      showMessage(`${name} updated.`);
    } catch {
      showMessage("Failed to update the retail product.");
    }
  };

  const handleRestockRetail = async (data: Record<string, string>) => {
    if (!restockRetailTarget) {
      showMessage("Retail item is still loading. Try restock again in a moment.");
      return;
    }

    const quantity = parseNonNegativeInteger(data.quantity, "Quantity added");
    if (quantity.error) {
      showMessage(quantity.error);
      return;
    }
    if ((quantity.value ?? 0) < 1) {
      showMessage("Quantity added must be at least 1.");
      return;
    }

    try {
      await restockProductMutation.mutateAsync({
        payload: {
          ...(normalizeOptionalText(data.notes) !== undefined
            ? { notes: normalizeOptionalText(data.notes) }
            : {}),
          quantity: quantity.value ?? 1
        },
        productId: restockRetailTarget.id
      });
      setRestockRetailId(null);
      showMessage(`${restockRetailTarget.name} restocked.`);
    } catch {
      showMessage("Failed to restock the retail product.");
    }
  };

  const handleRestoreRetail = async () => {
    const target = selectedRetail;
    if (!target || target.isActive) return;

    try {
      await updateProductMutation.mutateAsync({
        productId: target.id,
        payload: { isActive: true }
      });
      showMessage(target.name + " restored to retail inventory.");
    } catch {
      showMessage("Failed to restore the retail product.");
    }
  };

  const handleArchiveRetail = async () => {
    if (!archiveRetailTarget) return;

    const archivedProductId = archiveRetailTarget.id;
    const archivedProductDetailKey = inventoryProductDetailQueryOptions(
      webApiClient,
      archivedProductId
    ).queryKey;

    try {
      await queryClient.cancelQueries({
        exact: true,
        queryKey: archivedProductDetailKey
      });
      await archiveProductMutation.mutateAsync({
        payload: { isActive: false },
        productId: archivedProductId
      });
      if (selectedRetailId === archivedProductId) {
        setSelectedRetailId(null);
      }
      setArchiveRetailId(null);
      queryClient.removeQueries({
        exact: true,
        queryKey: archivedProductDetailKey
      });
      showMessage(`${archiveRetailTarget.name} archived from retail inventory.`);
    } catch {
      showMessage("Failed to archive the retail product.");
    }
  };

  const handleCreateEquipment = async (data: Record<string, string>) => {
    const presetSelection = data.presetSelection ?? createEquipmentPreset;
    const quantity = parseNonNegativeInteger(data.quantity, "Quantity");

    if (quantity.error) {
      showMessage(quantity.error);
      return;
    }

    if ((quantity.value ?? 0) < 1) {
      showMessage("Quantity must be at least 1.");
      return;
    }

    if (presetSelection !== "new") {
      const presetName = EQUIPMENT_PRESET_NAMES[presetSelection];
      const existingEquipment = equipmentRecords.find(
        (item) => item.name.toLowerCase() === presetName.toLowerCase()
      );

      try {
        if (existingEquipment) {
          await updateEquipmentMutation.mutateAsync({
            equipmentId: existingEquipment.id,
            payload: {
              quantityCurrent: existingEquipment.quantityCurrent + (quantity.value ?? 0),
              quantityTotal: existingEquipment.quantityTotal + (quantity.value ?? 0)
            }
          });
          setCreateEquipmentOpen(false);
          showMessage(`${presetName} quantity updated.`);
          return;
        }

        await createEquipmentMutation.mutateAsync({
          payload: {
            description: undefined,
            imageUrl: undefined,
            name: presetName,
            quantityCurrent: quantity.value ?? 0,
            quantityTotal: quantity.value ?? 0,
            unit: "units"
          }
        });
        setCreateEquipmentOpen(false);
        showMessage(`${presetName} added to equipment inventory.`);
      } catch {
        showMessage("Failed to save the equipment item.");
      }
      return;
    }

    const name = normalizeOptionalText(data.name);

    if (!name) {
      showMessage("Equipment name is required.");
      return;
    }

    const payload: InventoryEquipmentCreateInput = {
      ...(normalizeOptionalText(data.description) !== undefined
        ? { description: normalizeOptionalText(data.description) }
        : {}),
      ...(normalizeOptionalText(createEquipmentImageUrl) !== undefined
        ? { imageUrl: normalizeOptionalText(createEquipmentImageUrl) }
        : {}),
      name,
      quantityCurrent: quantity.value ?? 0,
      quantityTotal: quantity.value ?? 0,
      unit: "units"
    };

    try {
      await createEquipmentMutation.mutateAsync({ payload });
      setCreateEquipmentOpen(false);
      setCreateEquipmentImageUrl("");
      showMessage(`${name} added to equipment inventory.`);
    } catch {
      showMessage("Failed to add the equipment item.");
    }
  };

  const handleRecordRetailSale = async (input: InventoryRetailSaleInput) => {
    const saleItems = input.items.map((item) => ({
      ...item,
      product: retailProducts.find((product) => product.id === item.productId) ?? null
    }));

    if (saleItems.length === 0) {
      showMessage("Add at least one retail product to the sale.");
      return;
    }

    for (const item of saleItems) {
      if (!item.product) {
        showMessage("Choose a valid retail product to sell.");
        return;
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        showMessage(`Quantity sold for ${item.product.name} must be at least 1.`);
        return;
      }
      if (item.quantity > item.product.stockQuantity) {
        showMessage(`Only ${item.product.stockQuantity} ${item.product.name} item(s) are in stock.`);
        return;
      }
    }

    try {
      await createSaleMutation.mutateAsync({
        payload: {
          items: saleItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity
          })),
          ...(normalizeOptionalText(input.notes) !== undefined
            ? { notes: normalizeOptionalText(input.notes) }
            : {}),
          paymentMethod: "cash"
        }
      });
      setRetailSaleOpen(false);
      setSaleRetailId(null);
      showMessage(`${saleItems.length} sale item(s) recorded.`);
    } catch {
      showMessage("Failed to record the retail sale.");
    }
  };

  const handleUpdateEquipment = async (data: Record<string, string>) => {
    if (!selectedEquipment) return;

    const name = normalizeOptionalText(data.name);
    const unit = normalizeOptionalText(data.unit);
    const nextStatus = data.status as EquipmentAvailabilityStatus | undefined;

    if (!name) {
      showMessage("Equipment name is required.");
      return;
    }
    if (!unit) {
      showMessage("Equipment unit is required.");
      return;
    }
    if (
      nextStatus !== "Available" &&
      nextStatus !== "Under Maintenance" &&
      nextStatus !== "Broken" &&
      nextStatus !== "Missing"
    ) {
      showMessage("Choose a valid equipment status.");
      return;
    }

    const nextStatusCounts = resolveEquipmentStatusUpdate(nextStatus, selectedEquipment);

    const payload: InventoryEquipmentUpdateInput = {
      description: normalizeOptionalText(data.description),
      imageUrl: normalizeOptionalText(detailEquipmentImageUrl),
      name,
      ...nextStatusCounts,
      unit
    };

    try {
      await updateEquipmentMutation.mutateAsync({
        equipmentId: selectedEquipment.id,
        payload
      });
      showMessage(`${name} updated.`);
    } catch {
      showMessage("Failed to update the equipment item.");
    }
  };

  const handleWriteOffEquipment = async (data: Record<string, string>) => {
    if (!writeOffEquipmentTarget) return;

    const quantity = parseNonNegativeInteger(data.quantity, "Quantity to move");
    const destinationStatus = data.destinationStatus as EquipmentAvailabilityStatus;

    if (quantity.error) {
      showMessage(quantity.error);
      return;
    }
    if (
      destinationStatus !== "Available" &&
      destinationStatus !== "Under Maintenance" &&
      destinationStatus !== "Broken" &&
      destinationStatus !== "Missing"
    ) {
      showMessage("Choose a valid destination status.");
      return;
    }
    if (destinationStatus === writeOffEquipmentTarget.status) {
      showMessage("Choose a different destination status.");
      return;
    }
    if ((quantity.value ?? 0) > writeOffEquipmentTarget.statusQuantity) {
      showMessage("Quantity to move cannot exceed the selected status quantity.");
      return;
    }

    const payload: InventoryEquipmentStatusTransitionInput = {
      sourceStatus: EQUIPMENT_STATUS_BUCKET_BY_LABEL[writeOffEquipmentTarget.status],
      destinationStatus: EQUIPMENT_STATUS_BUCKET_BY_LABEL[destinationStatus],
      quantity: quantity.value ?? 0
    };

    try {
      await transitionEquipmentMutation.mutateAsync({
        equipmentId: writeOffEquipmentTarget.id,
        payload
      });
      setWriteOffEquipmentId(null);
      setWriteOffEquipmentStatus(null);
      showMessage(`${writeOffEquipmentTarget.name}: ${quantity.value} unit(s) moved.`);
    } catch {
      showMessage("Failed to move the equipment quantity.");
    }
  };

  const handleRestoreEquipment = async () => {
    const target = selectedEquipment;
    if (!target || target.isActive) return;

    try {
      await updateEquipmentMutation.mutateAsync({
        equipmentId: target.id,
        payload: { isActive: true }
      });
      showMessage(target.name + " restored to equipment inventory.");
    } catch {
      showMessage("Failed to restore the equipment item.");
    }
  };

  const handleArchiveEquipment = async (data: Record<string, string>) => {
    if (!archiveEquipmentTarget) return;

    const quantityToArchive = parseNonNegativeInteger(
      data.quantityToArchive,
      "Quantity to archive"
    );
    const reason = normalizeOptionalText(data.reason);

    if (quantityToArchive.error) {
      showMessage(quantityToArchive.error);
      return;
    }
    if ((quantityToArchive.value ?? 0) < 1) {
      showMessage("Quantity to archive must be at least 1.");
      return;
    }
    if ((quantityToArchive.value ?? 0) > archiveEquipmentTarget.statusQuantity) {
      showMessage("Quantity to archive cannot exceed the selected status quantity.");
      return;
    }
    if (!reason) {
      showMessage("An archive reason is required.");
      return;
    }

    try {
      await archiveEquipmentMutation.mutateAsync({
        equipmentId: archiveEquipmentTarget.id,
        payload: {
          sourceStatus: EQUIPMENT_STATUS_BUCKET_BY_LABEL[archiveEquipmentTarget.status],
          quantityToArchive: quantityToArchive.value ?? 0,
          reason
        }
      });
      setArchiveEquipmentId(null);
      setArchiveEquipmentStatus(null);
      if (selectedEquipmentId === archiveEquipmentTarget.id) {
        setSelectedEquipmentId(null);
      }
      showMessage(`${archiveEquipmentTarget.name} archived from equipment inventory.`);
    } catch {
      showMessage("Failed to archive the equipment item.");
    }
  };

  return {
    archiveEquipmentOpen: Boolean(archiveEquipmentId),
    archiveEquipmentPending: archiveEquipmentMutation.isPending,
    archiveEquipmentTarget,
    archiveRetailOpen: Boolean(archiveRetailId),
    archiveRetailPending: archiveProductMutation.isPending,
    archiveRetailTarget,
    createEquipmentImageUrl,
    createEquipmentPreset,
    createRetailImageUrl,
    closeEquipmentArchive: () => {
      setArchiveEquipmentId(null);
      setArchiveEquipmentStatus(null);
    },
    closeEquipmentDetails: () => {
      setSelectedEquipmentId(null);
      setSelectedEquipmentStatus(null);
    },
    closeEquipmentWriteOff: () => {
      setWriteOffEquipmentId(null);
      setWriteOffEquipmentStatus(null);
    },
    closeRetailArchive: () => setArchiveRetailId(null),
    closeRetailDetails: () => setSelectedRetailId(null),
    closeRetailRestock: () => setRestockRetailId(null),
    closeRetailSale: () => {
      setRetailSaleOpen(false);
      setSaleRetailId(null);
    },
    createEquipmentOpen,
    createEquipmentPending: createEquipmentMutation.isPending,
    createRetailOpen,
    createRetailPending: createProductMutation.isPending,
    inventoryImageUploadPending,
    detailEquipmentImageUrl,
    detailRetailImageUrl,
    equipmentAttentionCount,
    equipmentCount: equipmentRecords.length,
    equipmentCurrentUnits,
    equipmentDetailLoading: equipmentDetailQuery.isFetching,
    equipmentDetailsDeepLinkId,
    equipmentMissingUnits,
    equipmentStatusCounts,
    equipmentArchiveFilter,
    equipmentStatusFilter,
    equipmentTotalUnits,
    equipmentWriteOffPending: transitionEquipmentMutation.isPending,
    filteredEquipmentItems,
    filteredRetailProducts,
    handleArchiveEquipment,
    handleRestoreEquipment,
    handleArchiveRetail,
    handleRestoreRetail,
    handleCreateEquipment,
    handleCreateRetail,
    handleRefresh,
    handleRecordRetailSale,
    handleRestockRetail,
    handleUploadInventoryImage,
    handleUpdateEquipment,
    handleUpdateRetail,
    handleWriteOffEquipment,
    isAnalyticsLoading,
    isEquipmentLoading,
    isRefreshing,
    isRetailLoading,
    message,
    salesRevenuePeriod,
    salesRevenueWindowFilter,
    salesRevenueSeries,
    openCreateEquipment: () => setCreateEquipmentOpen(true),
    openCreateRetail: () => setCreateRetailOpen(true),
    openEquipmentArchive,
    openEquipmentDetails,
    openEquipmentWriteOff,
    openRetailArchive,
    openRetailDetails,
    openRetailRestock,
    openRetailSale,
    productDetailLoading: productDetailQuery.isFetching,
    q,
    retailArchiveFilter,
    retailCategoryFilter,
    retailDetailOpen: Boolean(selectedRetailId),
    retailLowStockCount,
    retailProductCount: retailProducts.length,
    retailProducts,
    retailSaleProducts,
    retailRestockOpen: Boolean(restockRetailId),
    retailRestockLoading,
    retailRestockPending: restockProductMutation.isPending,
    retailSaleOpen,
    retailSalePending: createSaleMutation.isPending,
    retailSaleProductOptions,
    restockRetailTarget,
    saleRetailTarget,
    retailStockFilter,
    retailTotalValue,
    selectedEquipment,
    selectedEquipmentDetail,
    selectedRetail,
    setCreateEquipmentOpen,
    setCreateEquipmentPreset,
    setCreateRetailOpen,
    setCreateEquipmentImageUrl,
    setCreateRetailImageUrl,
    setDetailEquipmentImageUrl,
    setDetailRetailImageUrl,
    setEquipmentArchiveFilter,
    setEquipmentStatusFilter,
    setQ,
    setRetailArchiveFilter,
    setRetailCategoryFilter,
    setRetailStockFilter,
    setSalesRevenuePeriod,
    setSalesRevenueWindowFilter,
    setShowFilters,
    setTab,
    setTopRetailMetric,
    showFilters,
    tab,
    topProducts,
    topRetailMetric,
    totalRevenue,
    updateEquipmentPending: updateEquipmentMutation.isPending,
    updateRetailPending: updateProductMutation.isPending,
    writeOffEquipmentOpen: Boolean(writeOffEquipmentId),
    writeOffEquipmentTarget
  };
}
