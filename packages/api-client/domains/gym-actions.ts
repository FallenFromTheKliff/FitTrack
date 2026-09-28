import type { PaginatedResult } from "@fittrack/types";

import { toApiClientError } from "../errors/api-client-error";
import { unwrapPaginatedResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type GymActionReportSection = "recent" | "transactions" | "audit" | "attendance";

export type GymActionsAttendanceListParams = {
  endDate?: string;
  limit?: number;
  order?: "asc" | "desc";
  page?: number;
  search?: string;
  startDate?: string;
  userId?: string;
};

export type GymActionsAttendanceRecord = {
  accessSource: string | null;
  checkInAt: string;
  checkInMethod: string | null;
  checkOutAt: string | null;
  id: string;
  memberEmail: string | null;
  memberName: string;
  scannedBy: string | null;
  userId: string;
};

export type GymActionsReportRow = {
  actor?: string;
  amount?: number;
  occurredAt?: string;
  primary: string;
  secondary?: string;
  status?: string;
};

export type GymActionsReportInput = {
  filterSummaries?: string[];
  rows: GymActionsReportRow[];
  section: GymActionReportSection;
  sectionLabel: string;
  title: string;
  totalRecords: number;
};

export type GymActionsPdfExportResult = {
  bytes: ArrayBuffer;
  contentType: string;
  fileName: string;
};

type GymActionsAttendanceApiRecord = {
  access_source?: string | null;
  check_in_at?: string;
  check_in_method?: string | null;
  check_out_at?: string | null;
  created_at?: string;
  id: string;
  scanned_by?: string | { email?: string | null; id?: string; name?: string | null } | null;
  updated_at?: string;
  user?: {
    email?: string | null;
    profile?: {
      first_name?: string | null;
      last_name?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
  user_id: string;
};

function toAttendanceListParams(params?: GymActionsAttendanceListParams) {
  return {
    ...(params?.endDate ? { end_date: params.endDate } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.order ? { order: params.order } : {}),
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.search?.trim() ? { search: params.search.trim() } : {}),
    ...(params?.startDate ? { start_date: params.startDate } : {}),
    ...(params?.userId ? { user_id: params.userId } : {}),
  };
}

function mapAttendanceRecord(record: GymActionsAttendanceApiRecord): GymActionsAttendanceRecord {
  const profile = record.user?.profile;
  const firstName = profile?.firstName ?? profile?.first_name ?? "";
  const lastName = profile?.lastName ?? profile?.last_name ?? "";
  const memberName = `${firstName} ${lastName}`.trim() || record.user?.email || record.user_id;
  const scannedBy =
    typeof record.scanned_by === "string"
      ? record.scanned_by
      : record.scanned_by?.name ?? record.scanned_by?.email ?? record.scanned_by?.id ?? null;

  return {
    accessSource: record.access_source ?? null,
    checkInAt: record.check_in_at ?? record.created_at ?? "",
    checkInMethod: record.check_in_method ?? null,
    checkOutAt: record.check_out_at ?? null,
    id: record.id,
    memberEmail: record.user?.email ?? null,
    memberName,
    scannedBy,
    userId: record.user_id,
  };
}

function toReportPayload(input: GymActionsReportInput) {
  return {
    ...(input.filterSummaries?.length ? { filter_summaries: input.filterSummaries } : {}),
    rows: input.rows.map((row) => ({
      ...(row.actor ? { actor: row.actor } : {}),
      ...(row.amount !== undefined ? { amount: row.amount } : {}),
      ...(row.occurredAt ? { occurred_at: row.occurredAt } : {}),
      primary: row.primary,
      ...(row.secondary ? { secondary: row.secondary } : {}),
      ...(row.status ? { status: row.status } : {}),
    })),
    section: input.section,
    section_label: input.sectionLabel,
    title: input.title,
    total_records: input.totalRecords,
  };
}

function extractAttachmentFileName(headerValue: unknown) {
  if (typeof headerValue !== "string") return null;
  const match = headerValue.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

export function createGymActionsApi(transport: ApiTransport) {
  return {
    async listAttendance(
      params?: GymActionsAttendanceListParams,
    ): Promise<PaginatedResult<GymActionsAttendanceRecord>> {
      const result = await unwrapPaginatedResponse<GymActionsAttendanceApiRecord>(
        transport.get("/attendance", { params: toAttendanceListParams(params) }),
        "Unable to load attendance records.",
      );
      return { ...result, data: result.data.map(mapAttendanceRecord) };
    },

    async exportPdf(input: GymActionsReportInput): Promise<GymActionsPdfExportResult> {
      try {
        const response = await transport.post<ArrayBuffer>(
          "/gym-actions/export/pdf",
          toReportPayload(input),
          { responseType: "arraybuffer" },
        );
        return {
          bytes: response.data,
          contentType:
            typeof response.headers["content-type"] === "string"
              ? response.headers["content-type"]
              : "application/pdf",
          fileName:
            extractAttachmentFileName(response.headers["content-disposition"]) ??
            "fittrack-gym-actions-export.pdf",
        };
      } catch (error: unknown) {
        throw toApiClientError(error, "Unable to export the Gym Actions PDF.");
      }
    },
  };
}
