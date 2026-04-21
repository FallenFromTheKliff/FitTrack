import type { AxiosResponse } from "axios";
import type { PaginatedResult, PaginationMeta } from "@fittrack/types";
import { toApiClientError } from "./errors/api-client-error";

type ApiEnvelope<T> = {
  data: T;
  meta?: {
    limit: number;
    page: number;
    total: number;
    total_pages: number;
  };
};

function isApiEnvelope<T>(value: T | ApiEnvelope<T>): value is ApiEnvelope<T> {
  return typeof value === "object" && value !== null && "data" in value;
}

export async function unwrapResponse<T>(request: Promise<AxiosResponse<T>>, fallback: string) {
  try {
    const response = await request;
    return isApiEnvelope(response.data) ? response.data.data : response.data;
  } catch (error: unknown) {
    throw toApiClientError(error, fallback);
  }
}

export async function unwrapVoidResponse(request: Promise<AxiosResponse<unknown>>, fallback: string) {
  try {
    await request;
  } catch (error: unknown) {
    throw toApiClientError(error, fallback);
  }
}

function createDefaultPaginationMeta(total: number): PaginationMeta {
  return {
    page: 1,
    limit: total,
    total,
    total_pages: total > 0 ? 1 : 0
  };
}

export async function unwrapPaginatedResponse<T>(
  request: Promise<AxiosResponse<T[] | ApiEnvelope<T[]>>>,
  fallback: string
): Promise<PaginatedResult<T>> {
  try {
    const response = await request;
    if (isApiEnvelope(response.data)) {
      return {
        data: Array.isArray(response.data.data) ? response.data.data : [],
        meta: response.data.meta ?? createDefaultPaginationMeta(Array.isArray(response.data.data) ? response.data.data.length : 0)
      };
    }

    const data = Array.isArray(response.data) ? response.data : [];
    return {
      data,
      meta: createDefaultPaginationMeta(data.length)
    };
  } catch (error: unknown) {
    throw toApiClientError(error, fallback);
  }
}

export function getListFromEnvelope<T>(data: T[] | { bookings?: T[] } | { requests?: T[] }, key: "bookings" | "requests") {
  if (Array.isArray(data)) return data;
  if (key === "bookings") {
    const list = (data as { bookings?: T[] }).bookings;
    return Array.isArray(list) ? list : [];
  }
  const list = (data as { requests?: T[] }).requests;
  return Array.isArray(list) ? list : [];
}
