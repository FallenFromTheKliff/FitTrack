import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@fittrack/api-client";
import { queryKeys } from "./query-keys";

export function profileDeletionStatusQueryOptions(client: Pick<ApiClient, "users">, userId?: string) {
  return queryOptions({
    queryKey: queryKeys.profileDeletionStatus(userId),
    queryFn: async () => {
      const data = await client.users.getDeletionRequestStatus();
      const normalized = data.status?.toLowerCase() ?? "";
      if (normalized === "pending") return "pending" as const;
      if (normalized === "approved") return "approved" as const;
      return "none" as const;
    }
  });
}

export function requestDeletionMutationOptions(client: Pick<ApiClient, "users">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ reason }: { reason?: string; userId?: string }) => client.users.requestDeletion(reason),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profileDeletionStatus(variables.userId) });
    }
  });
}

export function cancelDeletionRequestMutationOptions(client: Pick<ApiClient, "users">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ userId }: { userId?: string }) => client.users.cancelDeletionRequest(),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profileDeletionStatus(variables.userId) });
    }
  });
}