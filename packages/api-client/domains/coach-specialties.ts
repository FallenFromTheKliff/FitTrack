import type { PaginatedResult } from "@fittrack/types";

import { unwrapPaginatedResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type CoachSpecialtyListParams = {
  limit?: number;
  page?: number;
  search?: string;
};

export type CoachSpecialtyRecord = {
  id: string;
  label: string;
};

function toCoachSpecialtyListParams(params?: CoachSpecialtyListParams) {
  return {
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.search?.trim() ? { search: params.search.trim() } : {}),
  };
}

export function createCoachSpecialtiesApi(transport: ApiTransport) {
  return {
    list(
      params?: CoachSpecialtyListParams,
    ): Promise<PaginatedResult<CoachSpecialtyRecord>> {
      return unwrapPaginatedResponse<CoachSpecialtyRecord>(
        transport.get("/coaching/specialties", {
          params: toCoachSpecialtyListParams(params),
        }),
        "Unable to load coach specialties.",
      );
    },
  };
}
