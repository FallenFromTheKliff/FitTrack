import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  ApiClient,
  GymProfileRecord,
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
