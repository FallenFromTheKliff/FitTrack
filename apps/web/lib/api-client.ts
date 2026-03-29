"use client";

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@fittrack/app-core";
import { createApiClient } from "@fittrack/api-client";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const webTokenStore = {
  getAccessToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens({ accessToken, refreshToken }: { accessToken: string; refreshToken?: string | null }) {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (typeof refreshToken === "string" && refreshToken.trim() !== "") {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },
  clearTokens() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

export const webApiClient = createApiClient({
  baseURL: BASE,
  tokenStore: webTokenStore,
  authEvents: {
    onAuthFailure() {
      if (typeof window === "undefined") return;
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      window.location.href = "/login";
    }
  }
});
