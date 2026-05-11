import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import type { AuthEvents } from "../auth/auth-events";
import type { TokenSet, TokenStore } from "../auth/token-store";
import { resolveApiBaseUrl } from "../base-url";

declare module "axios" {
  interface AxiosRequestConfig {
    _preserveSessionOn401?: boolean;
  }

  interface InternalAxiosRequestConfig {
    _preserveSessionOn401?: boolean;
  }
}

export type ApiTransportConfig = {
  authEvents?: AuthEvents;
  baseURL: string;
  captureTokensFromResponses?: boolean;
  headers?: Record<string, string>;
  refreshPath?: string;
  tokenStore?: TokenStore;
};

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

function isApiEnvelope<T>(value: T | { data: T }): value is { data: T } {
  return typeof value === "object" && value !== null && "data" in value;
}

function isTokenShape(value: unknown): value is { access_token: string; refresh_token?: string | null } {
  if (!value || typeof value !== "object") return false;
  if (!("access_token" in value)) return false;
  return typeof (value as { access_token?: unknown }).access_token === "string";
}

function extractTokenSet(data: unknown): TokenSet | null {
  const tokenSource = isApiEnvelope(data) ? data.data : data;
  if (!isTokenShape(tokenSource)) return null;
  return {
    accessToken: tokenSource.access_token,
    refreshToken: typeof tokenSource.refresh_token === "string" ? tokenSource.refresh_token : undefined
  };
}

function isPathMatch(url: string | undefined, path: string) {
  if (!url) return false;
  return url === path || url.endsWith(path);
}

function normalizeRequestHeaders(headers?: Record<string, string>) {
  return {
    "Content-Type": "application/json",
    ...headers
  };
}

function isFormDataPayload(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

export function createAxiosTransport({
  authEvents,
  baseURL,
  captureTokensFromResponses = true,
  headers,
  refreshPath = "/auth/refresh",
  tokenStore
}: ApiTransportConfig) {
  const resolvedBaseURL = resolveApiBaseUrl(baseURL);
  const transport = axios.create({
    baseURL: resolvedBaseURL,
    headers: normalizeRequestHeaders(headers),
    withCredentials: true
  });

  let hydrationPromise: Promise<void> | null = null;
  let hydrated = false;
  let refreshPromise: Promise<string | null> | null = null;

  async function ensureHydrated() {
    if (!tokenStore?.hydrate || hydrated) return;
    if (!hydrationPromise) {
      hydrationPromise = Promise.resolve(tokenStore.hydrate()).then(() => {
        hydrated = true;
      });
    }
    await hydrationPromise;
  }

  async function refreshAccessToken() {
    if (!tokenStore) return null;
    await ensureHydrated();
    const refreshToken = await tokenStore.getRefreshToken();
    if (!refreshToken) return null;
    const response = await axios.post(
      `${resolvedBaseURL}${refreshPath}`,
      { refresh_token: refreshToken },
      {
        headers: normalizeRequestHeaders(headers),
        withCredentials: true
      }
    );
    const nextTokens = extractTokenSet(response.data);
    if (!nextTokens) return null;
    await tokenStore.setTokens(nextTokens);
    return nextTokens.accessToken;
  }

  transport.interceptors.request.use(async (config) => {
    await ensureHydrated();
    config.headers = config.headers ?? {};
    if (isFormDataPayload(config.data)) {
      const requestHeaders = config.headers as Record<string, unknown> & {
        delete?: (name: string) => void;
      };
      requestHeaders.delete?.("Content-Type");
      requestHeaders.delete?.("content-type");
      delete requestHeaders["Content-Type"];
      delete requestHeaders["content-type"];
    }
    if (!tokenStore) return config;
    const accessToken = await tokenStore.getAccessToken();
    if (!accessToken) return config;
    config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
  });

  transport.interceptors.response.use(
    async (response) => {
      if (tokenStore && captureTokensFromResponses) {
        const nextTokens = extractTokenSet(response.data);
        if (nextTokens) {
          await tokenStore.setTokens(nextTokens);
        }
        if (isPathMatch(response.config.url, "/auth/logout")) {
          await tokenStore.clearTokens();
        }
      }
      return response;
    },
    async (error: unknown) => {
      if (!tokenStore || !axios.isAxiosError(error)) {
        return Promise.reject(error);
      }
      const original = error.config as RetriableRequestConfig | undefined;
      if (
        !original ||
        // Some authenticated endpoints intentionally use 401 for invalid user input.
        // Those responses should surface to the caller without clearing the session.
        original._preserveSessionOn401 ||
        error.response?.status !== 401 ||
        original._retry ||
        isPathMatch(original.url, refreshPath)
      ) {
        return Promise.reject(error);
      }
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const accessToken = await refreshPromise;
        if (!accessToken) {
          throw error;
        }
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return transport(original);
      } catch (refreshError: unknown) {
        await tokenStore.clearTokens();
        await authEvents?.onAuthFailure?.();
        return Promise.reject(refreshError);
      }
    }
  );

  return transport;
}

export type ApiTransport = AxiosInstance;
