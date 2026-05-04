import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  CreateGymPromotionInput,
  GymKnowledgePaginationParams,
} from "@fittrack/api-client";

import { queryKeys } from "./query-keys";

export function gymPromotionsQueryOptions(
  client: Pick<ApiClient, "gymKnowledge">,
  params?: GymKnowledgePaginationParams,
) {
  return queryOptions({
    queryKey: queryKeys.gymKnowledgePromotions(params),
    queryFn: () => client.gymKnowledge.listPromotions(params),
  });
}

export function createGymPromotionMutationOptions(
  client: Pick<ApiClient, "gymKnowledge">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (payload: CreateGymPromotionInput) =>
      client.gymKnowledge.createPromotion(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.gymKnowledgePromotions(),
      });
    },
  });
}

export function deactivateGymPromotionMutationOptions(
  client: Pick<ApiClient, "gymKnowledge">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (promotionId: string) =>
      client.gymKnowledge.deactivatePromotion(promotionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.gymKnowledgePromotions(),
      });
    },
  });
}
