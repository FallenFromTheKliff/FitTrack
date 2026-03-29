import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import type { AuthEvents } from "../auth/auth-events";
import type { TokenSet, TokenStore } from "../auth/token-store";

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

function isTokenShape(value: unknown): value is { access_token: string; refresh_token?: string | null } {
  if (!value || typeof value !== "object") return false;
  if (!("access_token" in value)) return false;
  return typeof (value as { access_token?: unknown }).access_token === "string";
}

function extractTokenSet(data: unknown): TokenSet | null {
  if (!isTokenShape(data)) return null;
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined
  };
}

function isPathMatch(url: string | undefined, path: string) {
  if (!url) return false;
  return url === path || url.endsWith(path);
}

export function createAxiosTransport({
  authEvents,
  baseURL,
  captureTokensFromResponses = true,
  headers,
  refreshPath = "/auth/refresh",
  tokenStore
}: ApiTransportConfig) {
  const transport = axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
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
      `${baseURL}${refreshPath}`,
      { refresh_token: refreshToken },
      {
        headers: {
          "Content-Type": "application/json",
          ...headers
        }
      }
    );
    const nextTokens = extractTokenSet(response.data);
    if (!nextTokens) return null;
    await tokenStore.setTokens(nextTokens);
    return nextTokens.accessToken;
  }

  transport.interceptors.request.use(async (config) => {
    await ensureHydrated();
    if (!tokenStore) return config;
    const accessToken = await tokenStore.getAccessToken();
    if (!accessToken) return config;
    config.headers = config.headers ?? {};
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
        error.response?.status !== 401 ||
        !original ||
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