import type { PaginatedResult } from "@fittrack/types";

import { unwrapPaginatedResponse, unwrapResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type AuditLogListParams = {
  action?: string;
  endDate?: string;
  entity?: string;
  entityId?: string;
  limit?: number;
  page?: number;
  startDate?: string;
  userId?: string;
};

export type AuditActorProfileRecord = {
  first_name: string | null;
  last_name: string | null;
};

export type AuditActorRecord = {
  id: string;
  profile: AuditActorProfileRecord | null;
  role: "admin" | "staff" | "member" | "coach";
  status: "pending" | "active" | "suspended" | "banned";
};

export type AuditLogRecord = {
  action: string;
  actor: AuditActorRecord | null;
  after: unknown;
  before: unknown;
  created_at: string;
  entity: string;
  entity_id: string;
  id: string;
  ip_address: string | null;
  user_id: string | null;
};

function toAuditListParams(params?: AuditLogListParams) {
  return {
    ...(params?.action ? { action: params.action } : {}),
    ...(params?.endDate ? { end_date: params.endDate } : {}),
    ...(params?.entity ? { entity: params.entity } : {}),
    ...(params?.entityId ? { entity_id: params.entityId } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.startDate ? { start_date: params.startDate } : {}),
    ...(params?.userId ? { user_id: params.userId } : {}),
  };
}

export function createAuditApi(transport: ApiTransport) {
  return {
    listLogs(params?: AuditLogListParams): Promise<PaginatedResult<AuditLogRecord>> {
      return unwrapPaginatedResponse<AuditLogRecord>(
        transport.get("/audit", { params: toAuditListParams(params) }),
        "Unable to load audit logs.",
      );
    },
    getLogById(logId: string) {
      return unwrapResponse<AuditLogRecord>(
        transport.get(`/audit/${logId}`),
        "Unable to load audit log.",
      );
    },
  };
}
