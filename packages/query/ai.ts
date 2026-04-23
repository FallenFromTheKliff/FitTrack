import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { AiChatRequest, AiGeneratePlanInput, AiPaginationParams, ApiClient } from "@fittrack/api-client";
import {
  invalidateAiChatMessagesQuery,
  invalidateAiChatSessionQuery,
  invalidateAiChatSessionsQuery,
  invalidateNotificationQueries
} from "./cache";
import { queryKeys } from "./query-keys";

export function aiChatSessionsQueryOptions(client: Pick<ApiClient, "ai">, params?: AiPaginationParams) {
  return queryOptions({
    queryKey: queryKeys.aiChatSessions(params),
    queryFn: () => client.ai.listSessions(params)
  });
}

export function aiChatSessionQueryOptions(client: Pick<ApiClient, "ai">, sessionId: string) {
  return queryOptions({
    queryKey: queryKeys.aiChatSession(sessionId),
    queryFn: () => client.ai.getSessionById(sessionId)
  });
}

export function aiChatMessagesQueryOptions(
  client: Pick<ApiClient, "ai">,
  sessionId: string,
  params?: AiPaginationParams
) {
  return queryOptions({
    queryKey: queryKeys.aiChatMessages(sessionId, params),
    queryFn: () => client.ai.listMessages(sessionId, params)
  });
}

export function aiChatMutationOptions(
  client: Pick<ApiClient, "ai">,
  queryClient: QueryClient,
  userId?: string
) {
  return mutationOptions({
    mutationFn: (payload: AiChatRequest) => client.ai.chat(payload),
    onSuccess: async (data) => {
      await Promise.all([
        invalidateAiChatSessionsQuery(queryClient),
        invalidateAiChatSessionQuery(queryClient, data.session_id),
        invalidateAiChatMessagesQuery(queryClient, data.session_id),
        invalidateNotificationQueries(queryClient, userId)
      ]);
    }
  });
}

export function archiveAiChatSessionMutationOptions(
  client: Pick<ApiClient, "ai">,
  queryClient: QueryClient,
  _userId?: string
) {
  return mutationOptions({
    mutationFn: ({ sessionId }: { sessionId: string }) => client.ai.archiveSession(sessionId),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateAiChatSessionsQuery(queryClient),
        invalidateAiChatSessionQuery(queryClient, variables.sessionId),
        invalidateAiChatMessagesQuery(queryClient, variables.sessionId)
      ]);
    }
  });
}

export function restoreAiChatSessionMutationOptions(
  client: Pick<ApiClient, "ai">,
  queryClient: QueryClient
) {
  return mutationOptions({
    mutationFn: ({ sessionId }: { sessionId: string }) => client.ai.restoreSession(sessionId),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateAiChatSessionsQuery(queryClient),
        invalidateAiChatSessionQuery(queryClient, variables.sessionId),
        invalidateAiChatMessagesQuery(queryClient, variables.sessionId)
      ]);
    }
  });
}

export function generateAiPlanMutationOptions(client: Pick<ApiClient, "ai">) {
  return mutationOptions({
    mutationFn: (payload: AiGeneratePlanInput) => client.ai.generatePlan(payload)
  });
}
