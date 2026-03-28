import type { AxiosResponse } from "axios";
import { toApiClientError } from "./errors/api-client-error";

export async function unwrapResponse<T>(request: Promise<AxiosResponse<T>>, fallback: string) {
  try {
    const response = await request;
    return response.data;
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

export function getListFromEnvelope<T>(data: T[] | { bookings?: T[] } | { requests?: T[] }, key: "bookings" | "requests") {
  if (Array.isArray(data)) return data;
  if (key === "bookings") {
    const list = (data as { bookings?: T[] }).bookings;
    return Array.isArray(list) ? list : [];
  }
  const list = (data as { requests?: T[] }).requests;
  return Array.isArray(list) ? list : [];
}