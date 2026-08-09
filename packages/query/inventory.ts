import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  InventoryAnalyticsPeriod,
  InventoryCreateSaleInput,
  InventoryEquipmentArchiveInput,
  InventoryEquipmentCreateInput,
  InventoryEquipmentRecord,
  InventoryEquipmentListParams,
  InventoryEquipmentStatusTransitionInput,
  InventoryEquipmentUpdateInput,
  InventoryEquipmentWriteOffInput,
  InventoryPaginatedResult,
  InventoryProductMutationInput,
  InventoryProductRecord,
  InventoryProductListParams,
  InventoryRestockInput,
  InventorySaleListParams
} from "@fittrack/api-client";
import {
  invalidateAnalyticsQueries,
  invalidateInventoryQueries,
  invalidateNotificationQueries
} from "./cache";
import { queryKeys } from "./query-keys";

function syncProductCaches(
  queryClient: QueryClient,
  product: InventoryProductRecord,
) {
  queryClient.setQueryData(queryKeys.inventoryProductDetail(product.id), product);
  queryClient.setQueriesData<InventoryPaginatedResult<InventoryProductRecord>>(
    { queryKey: queryKeys.inventoryProducts() },
    (previous) => {
      if (!previous || !Array.isArray(previous.data)) return previous;

      return {
        ...previous,
        data: product.isActive
          ? previous.data.map((item) =>
              item.id === product.id ? product : item
            )
          : previous.data.filter((item) => item.id !== product.id),
      };
    },
  );
}

function syncEquipmentCaches(
  queryClient: QueryClient,
  equipment: InventoryEquipmentRecord,
) {
  queryClient.setQueriesData<InventoryPaginatedResult<InventoryEquipmentRecord>>(
    { queryKey: queryKeys.inventoryEquipment() },
    (previous) => {
      if (!previous || !Array.isArray(previous.data)) return previous;

      return {
        ...previous,
        data: previous.data.map((item) =>
          item.id === equipment.id ? equipment : item
        ),
      };
    },
  );
}

async function settleInventoryInvalidations(
  invalidations: Array<Promise<unknown>>,
) {
  await Promise.allSettled(invalidations);
}

export function inventoryProductsQueryOptions(
  client: Pick<ApiClient, "inventory">,
  params?: InventoryProductListParams
) {
  return queryOptions({
    queryKey: queryKeys.inventoryProducts(params),
    queryFn: () => client.inventory.listProducts(params)
  });
}

export function inventoryProductDetailQueryOptions(
  client: Pick<ApiClient, "inventory">,
  productId?: string
) {
  return queryOptions({
    queryKey: queryKeys.inventoryProductDetail(productId),
    queryFn: async () => {
      if (!productId) return null;
      return client.inventory.getProductById(productId);
    }
  });
}

export function inventorySalesQueryOptions(
  client: Pick<ApiClient, "inventory">,
  params?: InventorySaleListParams
) {
  return queryOptions({
    queryKey: queryKeys.inventorySales(params),
    queryFn: () => client.inventory.listSales(params)
  });
}

export function inventorySaleDetailQueryOptions(
  client: Pick<ApiClient, "inventory">,
  saleId?: string
) {
  return queryOptions({
    queryKey: queryKeys.inventorySaleDetail(saleId),
    queryFn: async () => {
      if (!saleId) return null;
      return client.inventory.getSaleById(saleId);
    }
  });
}

export function inventorySalesSummaryQueryOptions(
  client: Pick<ApiClient, "inventory">,
  params?: Pick<InventorySaleListParams, "endDate" | "startDate">
) {
  return queryOptions({
    queryKey: queryKeys.inventorySalesSummary(params),
    queryFn: () => client.inventory.getSalesSummary(params)
  });
}

export function inventorySalesAnalyticsQueryOptions(
  client: Pick<ApiClient, "inventory">,
  period: InventoryAnalyticsPeriod
) {
  return queryOptions({
    queryKey: queryKeys.inventorySalesAnalytics(period),
    queryFn: () => client.inventory.getSalesAnalytics(period)
  });
}

export function inventoryEquipmentQueryOptions(
  client: Pick<ApiClient, "inventory">,
  params?: InventoryEquipmentListParams
) {
  return queryOptions({
    queryKey: queryKeys.inventoryEquipment(params),
    queryFn: () => client.inventory.listEquipment(params)
  });
}

export function inventoryEquipmentDetailQueryOptions(
  client: Pick<ApiClient, "inventory">,
  equipmentId?: string
) {
  return queryOptions({
    queryKey: queryKeys.inventoryEquipmentDetail(equipmentId),
    queryFn: async () => {
      if (!equipmentId) return null;
      return client.inventory.getEquipmentById(equipmentId);
    }
  });
}

export function createInventoryProductMutationOptions(
  client: Pick<ApiClient, "inventory">,
  queryClient: QueryClient,
  userId?: string
) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: InventoryProductMutationInput }) =>
      client.inventory.createProduct(payload),
    onSuccess: async (product) => {
      syncProductCaches(queryClient, product);
      await settleInventoryInvalidations([
        invalidateInventoryQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateNotificationQueries(queryClient, userId)
      ]);
    }
  });
}

export function createInventoryEquipmentMutationOptions(
  client: Pick<ApiClient, "inventory">,
  queryClient: QueryClient,
  userId?: string
) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: InventoryEquipmentCreateInput }) =>
      client.inventory.createEquipment(payload),
    onSuccess: async (equipment) => {
      syncEquipmentCaches(queryClient, equipment);
      await settleInventoryInvalidations([
        invalidateInventoryQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateNotificationQueries(queryClient, userId)
      ]);
    }
  });
}

export function updateInventoryProductMutationOptions(
  client: Pick<ApiClient, "inventory">,
  queryClient: QueryClient,
  userId?: string
) {
  return mutationOptions({
    mutationFn: ({
      payload,
      productId
    }: {
      payload: InventoryProductMutationInput;
      productId: string;
    }) => client.inventory.updateProduct(productId, payload),
    onSuccess: async (product, variables) => {
      syncProductCaches(queryClient, product);
      const invalidations = [
        invalidateInventoryQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateNotificationQueries(queryClient, userId),
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventoryProductDetail(variables.productId)
        })
      ];

      if (variables.payload.isActive === false) {
        void settleInventoryInvalidations(invalidations);
        return;
      }

      await settleInventoryInvalidations(invalidations);
    }
  });
}

export function updateInventoryEquipmentMutationOptions(
  client: Pick<ApiClient, "inventory">,
  queryClient: QueryClient,
  userId?: string
) {
  return mutationOptions({
    mutationFn: ({
      equipmentId,
      payload
    }: {
      equipmentId: string;
      payload: InventoryEquipmentUpdateInput;
    }) => client.inventory.updateEquipment(equipmentId, payload),
    onSuccess: async (equipment, variables) => {
      syncEquipmentCaches(queryClient, equipment);
      await settleInventoryInvalidations([
        invalidateInventoryQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateNotificationQueries(queryClient, userId),
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventoryEquipmentDetail(variables.equipmentId)
        })
      ]);
    }
  });
}

export function transitionInventoryEquipmentMutationOptions(
  client: Pick<ApiClient, "inventory">,
  queryClient: QueryClient,
  userId?: string
) {
  return mutationOptions({
    mutationFn: ({
      equipmentId,
      payload
    }: {
      equipmentId: string;
      payload: InventoryEquipmentStatusTransitionInput;
    }) => client.inventory.transitionEquipmentStatus(equipmentId, payload),
    onSuccess: async (equipment, variables) => {
      syncEquipmentCaches(queryClient, equipment);
      await settleInventoryInvalidations([
        invalidateInventoryQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateNotificationQueries(queryClient, userId),
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventoryEquipmentDetail(variables.equipmentId)
        })
      ]);
    }
  });
}

export function restockInventoryProductMutationOptions(
  client: Pick<ApiClient, "inventory">,
  queryClient: QueryClient,
  userId?: string
) {
  return mutationOptions({
    mutationFn: ({
      payload,
      productId
    }: {
      payload: InventoryRestockInput;
      productId: string;
    }) => client.inventory.restockProduct(productId, payload),
    onSuccess: async (product, variables) => {
      syncProductCaches(queryClient, product);
      await settleInventoryInvalidations([
        invalidateInventoryQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateNotificationQueries(queryClient, userId),
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventoryProductDetail(variables.productId)
        })
      ]);
    }
  });
}

export function writeOffInventoryEquipmentMutationOptions(
  client: Pick<ApiClient, "inventory">,
  queryClient: QueryClient,
  userId?: string
) {
  return mutationOptions({
    mutationFn: ({
      equipmentId,
      payload
    }: {
      equipmentId: string;
      payload: InventoryEquipmentWriteOffInput;
    }) => client.inventory.writeOffEquipment(equipmentId, payload),
    onSuccess: async (_, variables) => {
      await settleInventoryInvalidations([
        invalidateInventoryQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateNotificationQueries(queryClient, userId),
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventoryEquipmentDetail(variables.equipmentId)
        })
      ]);
    }
  });
}

export function createInventorySaleMutationOptions(
  client: Pick<ApiClient, "inventory">,
  queryClient: QueryClient,
  userId?: string
) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: InventoryCreateSaleInput }) =>
      client.inventory.createSale(payload),
    onSuccess: async (_, variables) => {
      await settleInventoryInvalidations([
        invalidateInventoryQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateNotificationQueries(queryClient, userId),
        ...variables.payload.items.map((item) =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.inventoryProductDetail(item.productId)
          })
        )
      ]);
    }
  });
}

export function archiveInventoryEquipmentMutationOptions(
  client: Pick<ApiClient, "inventory">,
  queryClient: QueryClient,
  userId?: string
) {
  return mutationOptions({
    mutationFn: ({
      equipmentId,
      payload
    }: {
      equipmentId: string;
      payload: InventoryEquipmentArchiveInput;
    }) => client.inventory.archiveEquipment(equipmentId, payload),
    onSuccess: async (equipment, variables) => {
      syncEquipmentCaches(queryClient, equipment);
      await settleInventoryInvalidations([
        invalidateInventoryQueries(queryClient),
        invalidateAnalyticsQueries(queryClient),
        invalidateNotificationQueries(queryClient, userId),
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventoryEquipmentDetail(variables.equipmentId)
        })
      ]);
    }
  });
}
