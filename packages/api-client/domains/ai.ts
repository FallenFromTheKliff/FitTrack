import type {
  AiChatMessageRecord,
  AiChatRequest,
  AiChatResponse,
  AiChatSessionRecord,
  AiGeneratePlanInput,
  AiTrainingPlanDetailRecord,
  AiPaginationParams,
  PaginatedResult
} from "@fittrack/types";
import { unwrapPaginatedResponse, unwrapResponse, unwrapVoidResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type {
  AiChatMessageRecord,
  AiChatRequest,
  AiChatResponse,
  AiChatSessionRecord,
  AiGeneratePlanInput,
  AiTrainingPlanDetailRecord,
  AiPaginationParams,
  PaginatedResult
} from "@fittrack/types";

function toPaginationParams(params?: AiPaginationParams) {
  return {
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.page !== undefined ? { page: params.page } : {})
  };
}

export function createAiApi(transport: ApiTransport) {
  return {
    chat(payload: AiChatRequest) {
      return unwrapResponse<AiChatResponse>(
        transport.post("/ai/chat", payload),
        "Unable to send AI message."
      );
    },
    listSessions(params?: AiPaginationParams): Promise<PaginatedResult<AiChatSessionRecord>> {
      return unwrapPaginatedResponse<AiChatSessionRecord>(
        transport.get("/ai/chat/sessions", { params: toPaginationParams(params) }),
        "Unable to load AI chat sessions."
      );
    },
    getSessionById(sessionId: string) {
      return unwrapResponse<AiChatSessionRecord>(
        transport.get(`/ai/chat/sessions/${sessionId}`),
        "Unable to load AI chat session."
      );
    },
    listMessages(
      sessionId: string,
      params?: AiPaginationParams
    ): Promise<PaginatedResult<AiChatMessageRecord>> {
      return unwrapPaginatedResponse<AiChatMessageRecord>(
        transport.get(`/ai/chat/sessions/${sessionId}/messages`, { params: toPaginationParams(params) }),
        "Unable to load AI chat messages."
      );
    },
    archiveSession(sessionId: string) {
      return unwrapVoidResponse(
        transport.delete(`/ai/chat/sessions/${sessionId}`),
        "Unable to archive AI chat session."
      );
    },
    generatePlan(payload: AiGeneratePlanInput) {
      return unwrapResponse<AiTrainingPlanDetailRecord>(
        transport.post("/ai/generate-plan", payload),
        "Unable to generate an AI training plan."
      );
    }
  };
}
