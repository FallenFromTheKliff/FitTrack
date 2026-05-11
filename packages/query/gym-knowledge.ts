import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  ApiClient,
  CreateGymPromotionInput,
  GymProfileRecord,
  GymKnowledgePaginationParams,
  UpdateGymProfileInput,
} from "@fittrack/api-client";

import { queryKeys } from "./query-keys";

export function gymProfileQueryOptions(
  client: Pick<ApiClient, "gymKnowledge">,
) {
  return queryOptions({
    queryKey: queryKeys.gymKnowledgeProfile(),
    queryFn: () => client.gymKnowledge.getProfile(),
  });
}

export function updateGymProfileMutationOptions(
  client: Pick<ApiClient, "gymKnowledge">,
  queryClient: QueryClient,
) {
  return mutationOptions<GymProfileRecord, unknown, UpdateGymProfileInput>({
    mutationFn: (payload: UpdateGymProfileInput) =>
      client.gymKnowledge.updateProfile(payload),
    onSuccess: (profile: GymProfileRecord) => {
      queryClient.setQueryData(queryKeys.gymKnowledgeProfile(), profile);
    },
  });
}

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
