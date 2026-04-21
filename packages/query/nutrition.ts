import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  CreateNutritionLogPayload,
  NutritionHistoryParams,
  NutritionLogListParams,
  RecalculateNutritionPayload,
  UpdateNutritionLogPayload
} from "@fittrack/api-client";
import { invalidateNutritionQueries } from "./cache";
import { queryKeys } from "./query-keys";

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
      await invalidateNutritionQueries(queryClient, variables.userId);
    }
  });
}

export function createNutritionLogMutationOptions(client: Pick<ApiClient, "nutrition">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ payload }: { payload: CreateNutritionLogPayload; userId?: string }) =>
      client.nutrition.createLog(payload),
    onSuccess: async (_data, variables) => {
      await invalidateNutritionQueries(queryClient, variables.userId);
    }
  });
}

export function updateNutritionLogMutationOptions(client: Pick<ApiClient, "nutrition">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateNutritionLogPayload; userId?: string }) =>
      client.nutrition.updateLog(id, payload),
    onSuccess: async (_data, variables) => {
      await invalidateNutritionQueries(queryClient, variables.userId);
    }
  });
}

export function deleteNutritionLogMutationOptions(client: Pick<ApiClient, "nutrition">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id }: { id: string; userId?: string }) => client.nutrition.deleteLog(id),
    onSuccess: async (_data, variables) => {
      await invalidateNutritionQueries(queryClient, variables.userId);
    }
  });
}
