"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useDebounce, useTimedMessage } from "@fittrack/hooks";
import {
  createInventoryEquipmentMutationOptions,
  createInventoryProductMutationOptions,
  inventoryEquipmentDetailQueryOptions,
  inventoryEquipmentQueryOptions,
  inventoryProductDetailQueryOptions,
  inventoryProductsQueryOptions,
  inventorySalesQueryOptions,
  restockInventoryProductMutationOptions,
  updateInventoryEquipmentMutationOptions,
  updateInventoryProductMutationOptions,
  writeOffInventoryEquipmentMutationOptions
} from "@fittrack/query";
import type {
  InventoryEquipmentCreateInput,
  InventoryEquipmentDetailRecord,
  InventoryEquipmentRecord,
  InventoryEquipmentUpdateInput,
  InventoryEquipmentWriteOffInput,
  InventoryProductCategory,
  InventoryProductMutationInput,
  InventoryProductRecord
} from "@fittrack/types";
import type {
  EquipmentAvailabilityStatus,
  InventoryTab,
  RetailStockStatus
} from "@/data/inventory/inventory";
import { webApiClient } from "@/lib/api-client";
import {
  buildMonthlySalesSeries,
  filterEquipmentItems,
  filterRetailProducts,
  getEquipmentAvailabilityStatus,
  getRetailInventoryStatus,
  getTopProducts
} from "@/app/(admin)/inventory/helpers";

const INVENTORY_LIST_PARAMS = { limit: 100, page: 1 } as const;
const EMPTY_META = { page: 1, limit: 0, total: 0, total_pages: 0 } as const;

export type InventoryRetailTableRow = InventoryProductRecord & {
  status: RetailStockStatus;
  totalValue: number;
};

export type InventoryEquipmentTableRow = InventoryEquipmentRecord & {
  missingCount: number;
  status: EquipmentAvailabilityStatus;
};

export type InventoryEquipmentDetailRow = InventoryEquipmentDetailRecord & {
  missingCount: number;
  status: EquipmentAvailabilityStatus;
};

function normalizeOptionalText(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseNonNegativeInteger(
  value: string | undefined,
  label: string
): { error?: string; value?: number } {
  const parsed = Number((value ?? "").trim());

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
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
  const parsed = Number((value ?? "").trim());

  if (!Number.isFinite(parsed)) {
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

function toEquipmentRow(
  equipment: InventoryEquipmentRecord
): InventoryEquipmentTableRow {
  const missingCount = Math.max(equipment.quantityTotal - equipment.quantityCurrent, 0);

  return {
    ...equipment,
    missingCount,
    status: getEquipmentAvailabilityStatus(
      equipment.quantityCurrent,
      equipment.quantityTotal
    )
  };
}

function toEquipmentDetailRow(
  equipment: InventoryEquipmentDetailRecord
): InventoryEquipmentDetailRow {
  return {
    ...equipment,
    missingCount: Math.max(equipment.quantityTotal - equipment.quantityCurrent, 0),
    status: getEquipmentAvailabilityStatus(
      equipment.quantityCurrent,
      equipment.quantityTotal
    )
  };
}

export function useInventoryDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const consumedDeepLinkRef = useRef<string | null>(null);
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState<InventoryTab>("retail");
  const [retailStockFilter, setRetailStockFilter] = useState<"All" | RetailStockStatus>("All");
  const [retailCategoryFilter, setRetailCategoryFilter] =
    useState<InventoryProductCategory | "all">("all");
  const [equipmentStatusFilter, setEquipmentStatusFilter] =
    useState<"All" | EquipmentAvailabilityStatus>("All");
  const [createRetailOpen, setCreateRetailOpen] = useState(false);
  const [selectedRetailId, setSelectedRetailId] = useState<string | null>(null);
  const [restockRetailId, setRestockRetailId] = useState<string | null>(null);
  const [archiveRetailId, setArchiveRetailId] = useState<string | null>(null);
  const [createEquipmentOpen, setCreateEquipmentOpen] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [writeOffEquipmentId, setWriteOffEquipmentId] = useState<string | null>(null);
  const [archiveEquipmentId, setArchiveEquipmentId] = useState<string | null>(null);
  const debouncedQ = useDebounce(q, 250);
  const { message, showMessage } = useTimedMessage(2500);

  const {
    data: productsResponse = { data: [], meta: EMPTY_META },
    isLoading: productsLoading,
    isRefetching: productsRefetching,
    refetch: refetchProducts
  } = useQuery({
    ...inventoryProductsQueryOptions(webApiClient, INVENTORY_LIST_PARAMS),
    staleTime: 60_000,
    gcTime: 300_000
  });

  const {
    data: equipmentResponse = { data: [], meta: EMPTY_META },
    isLoading: equipmentLoading,
    isRefetching: equipmentRefetching,
    refetch: refetchEquipment
  } = useQuery({
    ...inventoryEquipmentQueryOptions(webApiClient, INVENTORY_LIST_PARAMS),
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

  const productDetailQuery = useQuery({
    ...inventoryProductDetailQueryOptions(webApiClient, selectedRetailId ?? undefined),
    enabled: Boolean(selectedRetailId)
  });

  const equipmentDetailQuery = useQuery({
    ...inventoryEquipmentDetailQueryOptions(webApiClient, selectedEquipmentId ?? undefined),
    enabled: Boolean(selectedEquipmentId)
  });

  const createProductMutation = useMutation(
    createInventoryProductMutationOptions(webApiClient, queryClient)
  );
  const updateProductMutation = useMutation(
    updateInventoryProductMutationOptions(webApiClient, queryClient)
  );
  const archiveProductMutation = useMutation(
    updateInventoryProductMutationOptions(webApiClient, queryClient)
  );
  const restockProductMutation = useMutation(
    restockInventoryProductMutationOptions(webApiClient, queryClient)
  );
  const createEquipmentMutation = useMutation(
    createInventoryEquipmentMutationOptions(webApiClient, queryClient)
  );
  const updateEquipmentMutation = useMutation(
    updateInventoryEquipmentMutationOptions(webApiClient, queryClient)
  );
  const archiveEquipmentMutation = useMutation(
    updateInventoryEquipmentMutationOptions(webApiClient, queryClient)
  );
  const writeOffEquipmentMutation = useMutation(
    writeOffInventoryEquipmentMutationOptions(webApiClient, queryClient)
  );

  const retailProducts = useMemo(
    () => productsResponse.data.map(toRetailRow),
    [productsResponse.data]
  );
  const equipmentItems = useMemo(
    () => equipmentResponse.data.map(toEquipmentRow),
    [equipmentResponse.data]
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
  const filteredEquipmentItems = useMemo(
    () =>
      filterEquipmentItems(equipmentItems, debouncedQ, equipmentStatusFilter),
    [equipmentItems, debouncedQ, equipmentStatusFilter]
  );
  const topProducts = useMemo(
    () => getTopProducts(retailProducts).slice(0, 6),
    [retailProducts]
  );
  const monthlySales = useMemo(
    () => buildMonthlySalesSeries(salesResponse.data),
    [salesResponse.data]
  );
  const retailTotalValue = useMemo(
    () => retailProducts.reduce((acc, product) => acc + product.totalValue, 0),
    [retailProducts]
  );
  const totalRevenue = useMemo(
    () => monthlySales.reduce((acc, bucket) => acc + bucket.revenue, 0),
    [monthlySales]
  );
  const retailLowStockCount = retailProducts.filter(
    (product) => product.status === "Low Stock"
  ).length;
  const equipmentAttentionCount = equipmentItems.filter(
    (item) => item.status === "Attention" || item.status === "Unavailable"
  ).length;
  const equipmentCurrentUnits = useMemo(
    () => equipmentItems.reduce((acc, item) => acc + item.quantityCurrent, 0),
    [equipmentItems]
  );
  const equipmentMissingUnits = useMemo(
    () => equipmentItems.reduce((acc, item) => acc + item.missingCount, 0),
    [equipmentItems]
  );
  const selectedRetail = useMemo(() => {
    if (!selectedRetailId) return null;
    if (productDetailQuery.data && productDetailQuery.data.id === selectedRetailId) {
      return toRetailRow(productDetailQuery.data);
    }

    return retailProducts.find((product) => product.id === selectedRetailId) ?? null;
  }, [selectedRetailId, productDetailQuery.data, retailProducts]);
  const selectedEquipmentDetail = useMemo(
    () =>
      equipmentDetailQuery.data
        ? toEquipmentDetailRow(equipmentDetailQuery.data)
        : null,
    [equipmentDetailQuery.data]
  );
  const selectedEquipment = useMemo(() => {
    if (!selectedEquipmentId) return null;
    if (
      selectedEquipmentDetail &&
      selectedEquipmentDetail.id === selectedEquipmentId
    ) {
      return selectedEquipmentDetail;
    }

    return (
      equipmentItems.find((equipment) => equipment.id === selectedEquipmentId) ?? null
    );
  }, [selectedEquipmentId, selectedEquipmentDetail, equipmentItems]);
  const restockRetailTarget = useMemo(() => {
    if (!restockRetailId) return null;
    if (selectedRetail?.id === restockRetailId) return selectedRetail;
    return retailProducts.find((product) => product.id === restockRetailId) ?? null;
  }, [restockRetailId, selectedRetail, retailProducts]);
  const archiveRetailTarget = useMemo(() => {
    if (!archiveRetailId) return null;
    if (selectedRetail?.id === archiveRetailId) return selectedRetail;
    return retailProducts.find((product) => product.id === archiveRetailId) ?? null;
  }, [archiveRetailId, selectedRetail, retailProducts]);
  const writeOffEquipmentTarget = useMemo(() => {
    if (!writeOffEquipmentId) return null;
    if (selectedEquipment?.id === writeOffEquipmentId) return selectedEquipment;
    return (
      equipmentItems.find((equipment) => equipment.id === writeOffEquipmentId) ?? null
    );
  }, [writeOffEquipmentId, selectedEquipment, equipmentItems]);
  const archiveEquipmentTarget = useMemo(() => {
    if (!archiveEquipmentId) return null;
    if (selectedEquipment?.id === archiveEquipmentId) return selectedEquipment;
    return (
      equipmentItems.find((equipment) => equipment.id === archiveEquipmentId) ?? null
    );
  }, [archiveEquipmentId, selectedEquipment, equipmentItems]);
  const isRefreshing = productsRefetching || equipmentRefetching || salesRefetching;
  const isRetailLoading = productsLoading;
  const isEquipmentLoading = equipmentLoading;
  const isAnalyticsLoading = productsLoading || salesLoading;

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const modalParam = searchParams.get("modal");
    const productId = searchParams.get("productId");
    const equipmentId = searchParams.get("equipmentId");
    const normalizedTab: InventoryTab | null =
      tabParam === "retail" || tabParam === "equipment" || tabParam === "analytics"
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
      setWriteOffEquipmentId(null);
      setSelectedEquipmentId(equipmentId);
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
    setSelectedRetailId(productId);
  };

  const openRetailRestock = (productId: string) => {
    setRestockRetailId(productId);
  };

  const openRetailArchive = (productId: string) => {
    setArchiveRetailId(productId);
  };

  const openEquipmentDetails = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
  };

  const openEquipmentWriteOff = (equipmentId: string) => {
    setWriteOffEquipmentId(equipmentId);
  };

  const openEquipmentArchive = (equipmentId: string) => {
    setArchiveEquipmentId(equipmentId);
  };

  const handleCreateRetail = async (data: Record<string, string>) => {
    const name = normalizeOptionalText(data.name);
    const category = data.category as InventoryProductCategory | undefined;
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
      ...(normalizeOptionalText(data.description) !== undefined
        ? { description: normalizeOptionalText(data.description) }
        : {}),
      ...(normalizeOptionalText(data.imageUrl) !== undefined
        ? { imageUrl: normalizeOptionalText(data.imageUrl) }
        : {}),
      name,
      price: price.value,
      reorderThreshold: reorderThreshold.value,
      stockQuantity: stockQuantity.value
    };

    try {
      await createProductMutation.mutateAsync({ payload });
      setCreateRetailOpen(false);
      showMessage(`${name} added to retail inventory.`);
    } catch {
      showMessage("Failed to add the retail product.");
    }
  };

  const handleUpdateRetail = async (data: Record<string, string>) => {
    if (!selectedRetail) return;

    const name = normalizeOptionalText(data.name);
    const category = data.category as InventoryProductCategory | undefined;
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
      description: normalizeOptionalText(data.description),
      imageUrl: normalizeOptionalText(data.imageUrl),
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
    if (!restockRetailTarget) return;

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

  const handleArchiveRetail = async () => {
    if (!archiveRetailTarget) return;

    try {
      await archiveProductMutation.mutateAsync({
        payload: { isActive: false },
        productId: archiveRetailTarget.id
      });
      setArchiveRetailId(null);
      if (selectedRetailId === archiveRetailTarget.id) {
        setSelectedRetailId(null);
      }
      showMessage(`${archiveRetailTarget.name} archived from retail inventory.`);
    } catch {
      showMessage("Failed to archive the retail product.");
    }
  };

  const handleCreateEquipment = async (data: Record<string, string>) => {
    const name = normalizeOptionalText(data.name);
    const unit = normalizeOptionalText(data.unit);
    const quantityTotal = parseNonNegativeInteger(
      data.quantityTotal,
      "Total quantity"
    );
    const quantityCurrent = parseNonNegativeInteger(
      data.quantityCurrent,
      "Current quantity"
    );

    if (!name) {
      showMessage("Equipment name is required.");
      return;
    }
    if (!unit) {
      showMessage("Equipment unit is required.");
      return;
    }
    if (quantityTotal.error) {
      showMessage(quantityTotal.error);
      return;
    }
    if (quantityCurrent.error) {
      showMessage(quantityCurrent.error);
      return;
    }
    if ((quantityCurrent.value ?? 0) > (quantityTotal.value ?? 0)) {
      showMessage("Current quantity cannot be greater than total quantity.");
      return;
    }

    const payload: InventoryEquipmentCreateInput = {
      ...(normalizeOptionalText(data.description) !== undefined
        ? { description: normalizeOptionalText(data.description) }
        : {}),
      name,
      quantityCurrent: quantityCurrent.value ?? 0,
      quantityTotal: quantityTotal.value ?? 0,
      unit
    };

    try {
      await createEquipmentMutation.mutateAsync({ payload });
      setCreateEquipmentOpen(false);
      showMessage(`${name} added to equipment inventory.`);
    } catch {
      showMessage("Failed to add the equipment item.");
    }
  };

  const handleUpdateEquipment = async (data: Record<string, string>) => {
    if (!selectedEquipment) return;

    const name = normalizeOptionalText(data.name);
    const unit = normalizeOptionalText(data.unit);

    if (!name) {
      showMessage("Equipment name is required.");
      return;
    }
    if (!unit) {
      showMessage("Equipment unit is required.");
      return;
    }

    const payload: InventoryEquipmentUpdateInput = {
      description: normalizeOptionalText(data.description),
      name,
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

    const quantitySetTo = parseNonNegativeInteger(
      data.quantitySetTo,
      "New current quantity"
    );
    const reason = normalizeOptionalText(data.reason);

    if (quantitySetTo.error) {
      showMessage(quantitySetTo.error);
      return;
    }
    if (!reason) {
      showMessage("A write-off reason is required.");
      return;
    }
    if ((quantitySetTo.value ?? 0) > writeOffEquipmentTarget.quantityCurrent) {
      showMessage("New current quantity cannot exceed the current quantity.");
      return;
    }

    const payload: InventoryEquipmentWriteOffInput = {
      quantitySetTo: quantitySetTo.value ?? 0,
      reason
    };

    try {
      await writeOffEquipmentMutation.mutateAsync({
        equipmentId: writeOffEquipmentTarget.id,
        payload
      });
      setWriteOffEquipmentId(null);
      showMessage(`${writeOffEquipmentTarget.name} write-off recorded.`);
    } catch {
      showMessage("Failed to record the equipment write-off.");
    }
  };

  const handleArchiveEquipment = async () => {
    if (!archiveEquipmentTarget) return;

    try {
      await archiveEquipmentMutation.mutateAsync({
        equipmentId: archiveEquipmentTarget.id,
        payload: { isActive: false }
      });
      setArchiveEquipmentId(null);
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
    closeEquipmentArchive: () => setArchiveEquipmentId(null),
    closeEquipmentDetails: () => setSelectedEquipmentId(null),
    closeEquipmentWriteOff: () => setWriteOffEquipmentId(null),
    closeRetailArchive: () => setArchiveRetailId(null),
    closeRetailDetails: () => setSelectedRetailId(null),
    closeRetailRestock: () => setRestockRetailId(null),
    createEquipmentOpen,
    createEquipmentPending: createEquipmentMutation.isPending,
    createRetailOpen,
    createRetailPending: createProductMutation.isPending,
    equipmentAttentionCount,
    equipmentCount: equipmentItems.length,
    equipmentCurrentUnits,
    equipmentDetailLoading: equipmentDetailQuery.isFetching,
    equipmentMissingUnits,
    equipmentStatusFilter,
    equipmentWriteOffPending: writeOffEquipmentMutation.isPending,
    filteredEquipmentItems,
    filteredRetailProducts,
    handleArchiveEquipment,
    handleArchiveRetail,
    handleCreateEquipment,
    handleCreateRetail,
    handleRefresh,
    handleRestockRetail,
    handleUpdateEquipment,
    handleUpdateRetail,
    handleWriteOffEquipment,
    isAnalyticsLoading,
    isEquipmentLoading,
    isRefreshing,
    isRetailLoading,
    message,
    monthlySales,
    openCreateEquipment: () => setCreateEquipmentOpen(true),
    openCreateRetail: () => setCreateRetailOpen(true),
    openEquipmentArchive,
    openEquipmentDetails,
    openEquipmentWriteOff,
    openRetailArchive,
    openRetailDetails,
    openRetailRestock,
    productDetailLoading: productDetailQuery.isFetching,
    q,
    retailCategoryFilter,
    retailDetailOpen: Boolean(selectedRetailId),
    retailLowStockCount,
    retailProductCount: retailProducts.length,
    retailRestockOpen: Boolean(restockRetailId),
    retailRestockPending: restockProductMutation.isPending,
    restockRetailTarget,
    retailStockFilter,
    retailTotalValue,
    selectedEquipment,
    selectedEquipmentDetail,
    selectedRetail,
    setCreateEquipmentOpen,
    setCreateRetailOpen,
    setEquipmentStatusFilter,
    setQ,
    setRetailCategoryFilter,
    setRetailStockFilter,
    setShowFilters,
    setTab,
    showFilters,
    tab,
    topProducts,
    totalRevenue,
    updateEquipmentPending: updateEquipmentMutation.isPending,
    updateRetailPending: updateProductMutation.isPending,
    writeOffEquipmentOpen: Boolean(writeOffEquipmentId),
    writeOffEquipmentTarget
  };
}
