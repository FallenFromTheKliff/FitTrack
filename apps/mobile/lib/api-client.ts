import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@fittrack/app-core";
import { createApiClient, createTokenStore, resolveApiBaseUrl } from "@fittrack/api-client";

const BASE = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);

export const mobileSessionStore = createTokenStore({
  accessTokenKey: ACCESS_TOKEN_KEY,
  cache: "memory",
  refreshTokenKey: REFRESH_TOKEN_KEY,
  storage: {
    getItem(key) {
      return AsyncStorage.getItem(key);
    },
    removeItem(key) {
      return AsyncStorage.removeItem(key);
    },
    setItem(key, value) {
      return AsyncStorage.setItem(key, value);
    }
  }
});

export function hydrateMobileApiAuth() {
  return mobileSessionStore.hydrate?.() ?? Promise.resolve();
}

export const mobileApiClient = createApiClient({
  baseURL: BASE,
  tokenStore: mobileSessionStore
});
