import { infiniteQueryOptions, mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  CreateNutritionLogPayload,
  NutritionHistoryParams,
  NutritionLogListParams,
  RecalculateNutritionPayload,
  UpdateNutritionLogPayload
} from "@fittrack/api-client";
import { queryKeys } from "./query-keys";

function invalidateNutritionLogQueries(queryClient: QueryClient, userId?: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.nutritionLogs(userId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.nutritionDailySummary(userId) })
  ]);
}

function invalidateNutritionTargetQueries(queryClient: QueryClient, userId?: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.nutritionActive(userId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.nutritionHistory(userId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.nutritionDailySummary(userId) })
  ]);
}

export function nutritionActiveTdeeQueryOptions<T>(client: Pick<ApiClient, "nutrition">, userId?: string) {
  return queryOptions({
    queryKey: queryKeys.nutritionActive(userId),
    queryFn: async () => {
      if (!userId) return null;
      return client.nutrition.getActiveProfile<T>();
    }
  });
}

export function nutritionHistoryQueryOptions<T>(
  client: Pick<ApiClient, "nutrition">,
  userId?: string,
  params?: NutritionHistoryParams
) {
  return queryOptions({
    queryKey: queryKeys.nutritionHistory(userId, params),
    queryFn: async () => {
      if (!userId) {
        return {
          data: [],
          meta: { page: 1, limit: params?.limit ?? 0, total: 0, total_pages: 0 }
        };
      }
      return client.nutrition.listTdeeHistory<T>(params);
    }
  });
}

export function nutritionLogsQueryOptions<T>(
  client: Pick<ApiClient, "nutrition">,
  userId?: string,
  params?: NutritionLogListParams
) {
  return queryOptions({
    queryKey: queryKeys.nutritionLogs(userId, params),
    queryFn: async () => {
      if (!userId) {
        return {
          data: [],
          meta: { page: 1, limit: params?.limit ?? 0, total: 0, total_pages: 0 }
        };
      }
      return client.nutrition.listLogs<T>(params);
    }
  });
}

export function nutritionLogsInfiniteQueryOptions<T>(
  client: Pick<ApiClient, "nutrition">,
  userId?: string,
  params?: Omit<NutritionLogListParams, "page">
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.nutritionLogs(userId, { ...params, infinite: true }),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (!userId) {
        return {
          data: [],
          meta: { page: 1, limit: params?.limit ?? 0, total: 0, total_pages: 0 }
        };
      }
      return client.nutrition.listLogs<T>({ ...params, page: pageParam });
    },
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.total_pages ? lastPage.meta.page + 1 : undefined
  });
}

export function nutritionDailySummaryQueryOptions<T>(
  client: Pick<ApiClient, "nutrition">,
  userId?: string,
  date?: string
) {
  return queryOptions({
    queryKey: queryKeys.nutritionDailySummary(userId, date),
    queryFn: async () => {
      if (!userId || !date) return null;
      return client.nutrition.getDailySummary<T>(date);
    }
  });
}

export function recalculateNutritionMutationOptions(client: Pick<ApiClient, "nutrition">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: RecalculateNutritionPayload; userId?: string }) =>
      client.nutrition.recalculate(payload),
    onSuccess: async (_data, variables) => {
      await invalidateNutritionTargetQueries(queryClient, variables.userId);
    }
  });
}

export function createNutritionLogMutationOptions(client: Pick<ApiClient, "nutrition">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: CreateNutritionLogPayload; userId?: string }) =>
      client.nutrition.createLog(payload),
    onSuccess: async (_data, variables) => {
      await invalidateNutritionLogQueries(queryClient, variables.userId);
    }
  });
}

export function updateNutritionLogMutationOptions(client: Pick<ApiClient, "nutrition">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateNutritionLogPayload; userId?: string }) =>
      client.nutrition.updateLog(id, payload),
    onSuccess: async (_data, variables) => {
      await invalidateNutritionLogQueries(queryClient, variables.userId);
    }
  });
}

export function deleteNutritionLogMutationOptions(client: Pick<ApiClient, "nutrition">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id }: { id: string; userId?: string }) => client.nutrition.deleteLog(id),
    onSuccess: async (_data, variables) => {
      await invalidateNutritionLogQueries(queryClient, variables.userId);
    }
  });
}
