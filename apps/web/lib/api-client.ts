"use client";

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@fittrack/app-core";
import { createApiClient, createTokenStore, resolveApiBaseUrl } from "@fittrack/api-client";

const BASE = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

function getSafeStorage() {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => undefined
    };
  }
  return localStorage;
}

export const webSessionStore = createTokenStore({
  accessTokenKey: ACCESS_TOKEN_KEY,
  refreshTokenKey: REFRESH_TOKEN_KEY,
  storage: {
    getItem(key) {
      return getSafeStorage().getItem(key);
    },
    removeItem(key) {
      getSafeStorage().removeItem(key);
    },
    setItem(key, value) {
      getSafeStorage().setItem(key, value);
    }
  }
});

export const webApiClient = createApiClient({
  baseURL: BASE,
  tokenStore: webSessionStore,
  authEvents: {
    onAuthFailure() {
      getSafeStorage().removeItem(ACCESS_TOKEN_KEY);
      getSafeStorage().removeItem(REFRESH_TOKEN_KEY);
      if (typeof window === "undefined") return;
      window.location.href = "/login";
    }
  }
});
