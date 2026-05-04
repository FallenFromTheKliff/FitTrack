import { queryOptions } from "@tanstack/react-query";
import type { ApiClient, AuditLogListParams } from "@fittrack/api-client";

import { queryKeys } from "./query-keys";

export function auditLogsQueryOptions(
  client: Pick<ApiClient, "audit">,
  params?: AuditLogListParams,
) {
  return queryOptions({
    queryKey: queryKeys.auditLogs(params),
    queryFn: () => client.audit.listLogs(params),
  });
}
