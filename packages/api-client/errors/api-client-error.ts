import { AxiosError } from "axios";

export type ApiClientErrorKind = "http" | "network" | "timeout" | "cancelled" | "unknown";

export class ApiClientError extends Error {
  status?: number;
  details?: unknown;
  kind: ApiClientErrorKind;
  raw: unknown;

  constructor({
    message,
    kind,
    status,
    details,
    raw
  }: {
    message: string;
    kind: ApiClientErrorKind;
    status?: number;
    details?: unknown;
    raw: unknown;
  }) {
    super(message);
    this.name = "ApiClientError";
    this.kind = kind;
    this.status = status;
    this.details = details;
    this.raw = raw;
  }
}

function extractMessage(details: unknown, fallback: string) {
  if (!details || typeof details !== "object") return fallback;
  if (!("message" in details)) return fallback;
  const message = (details as { message?: unknown }).message;
  if (Array.isArray(message)) {
    const joined = message.filter((item): item is string => typeof item === "string" && item.trim() !== "").join(" ");
    return joined || fallback;
  }
  return typeof message === "string" && message.trim() !== "" ? message : fallback;
}

export function toApiClientError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error;
  if (error instanceof AxiosError) {
    const details = error.response?.data;
    const code = error.code ?? "";
    const kind: ApiClientErrorKind = code === "ERR_CANCELED"
      ? "cancelled"
      : code === "ECONNABORTED"
        ? "timeout"
        : error.response
          ? "http"
          : error.request
            ? "network"
            : "unknown";
    return new ApiClientError({
      message: extractMessage(details, error.message || fallback),
      kind,
      status: error.response?.status,
      details,
      raw: error
    });
  }
  if (error instanceof Error) {
    return new ApiClientError({
      message: error.message || fallback,
      kind: "unknown",
      raw: error
    });
  }
  return new ApiClientError({
    message: fallback,
    kind: "unknown",
    raw: error
  });
}