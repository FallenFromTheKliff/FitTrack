"use client";

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@fittrack/app-core";
import { createApiClient, createTokenStore, resolveApiBaseUrl } from "@fittrack/api-client";

const DEFAULT_WEB_API_BASE_URL =
  process.env.NODE_ENV === "production" ? "/v1" : "http://127.0.0.1:3001/v1";

const PUBLIC_AUTH_SAFE_PREFIXES = ["/", "/login", "/member-login", "/forgot-password"];

export const WEB_API_BASE_URL = resolveApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL,
  DEFAULT_WEB_API_BASE_URL
);

function getSafeStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage;
}

function isPublicAuthSafePath(pathname: string) {
  return PUBLIC_AUTH_SAFE_PREFIXES.some((prefix) =>
    prefix === "/" ? pathname === "/" : pathname.startsWith(prefix),
  );
}

export const webSessionStore = createTokenStore({
  accessTokenKey: ACCESS_TOKEN_KEY,
  refreshTokenKey: REFRESH_TOKEN_KEY,
  storage: {
    getItem(key) {
      return getSafeStorage()?.getItem(key) ?? null;
    },
    removeItem(key) {
      getSafeStorage()?.removeItem(key);
    },
    setItem(key, value) {
      getSafeStorage()?.setItem(key, value);
    }
  }
});

export const webApiClient = createApiClient({
  baseURL: WEB_API_BASE_URL,
  tokenStore: webSessionStore,
  authEvents: {
    onAuthFailure() {
      getSafeStorage()?.removeItem(ACCESS_TOKEN_KEY);
      getSafeStorage()?.removeItem(REFRESH_TOKEN_KEY);
      if (typeof window === "undefined") return;
      if (isPublicAuthSafePath(window.location.pathname)) {
        return;
      }
      window.location.href = "/login";
    }
  }
});
