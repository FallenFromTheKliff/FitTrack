import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@fittrack/api-client";
import { invalidateAttendanceQrQuery, invalidateProfileDeletionStatusQuery } from "./cache";
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

export function attendanceQrQueryOptions(client: Pick<ApiClient, "users">, userId?: string) {
  return queryOptions({
    queryKey: queryKeys.attendanceQr(userId),
    queryFn: () => client.users.getAttendanceQr(),
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 300_000,
  });
}

export function refreshAttendanceQrMutationOptions(
  client: Pick<ApiClient, "users">,
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: ({ userId }: { userId?: string }) => client.users.refreshQr(),
    onSuccess: async (data, variables) => {
      queryClient.setQueryData(queryKeys.attendanceQr(variables.userId), data);
    },
  });
}

export function requestDeletionMutationOptions(client: Pick<ApiClient, "users">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ reason }: { reason?: string; userId?: string }) => client.users.requestDeletion(reason),
    onSuccess: async (_data, variables) => {
      await invalidateProfileDeletionStatusQuery(queryClient, variables.userId);
    }
  });
}

export function cancelDeletionRequestMutationOptions(client: Pick<ApiClient, "users">, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: ({ userId }: { userId?: string }) => client.users.cancelDeletionRequest(),
    onSuccess: async (_data, variables) => {
      await invalidateProfileDeletionStatusQuery(queryClient, variables.userId);
    }
  });
}

export function submitAppFeedbackMutationOptions(client: Pick<ApiClient, "users">) {
  return mutationOptions({
    mutationFn: ({
      category,
      message,
    }: {
      category?: "bug_report" | "feature_request" | "general_feedback";
      message: string;
    }) => client.users.submitAppFeedback({ category, message }),
  });
}

export function invalidateAttendanceQrForUser(queryClient: QueryClient, userId?: string) {
  return invalidateAttendanceQrQuery(queryClient, userId);
}
