import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@fittrack/app-core";
import { createApiClient, createTokenStore, resolveApiBaseUrl } from "@fittrack/api-client";

export const MOBILE_API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  "http://127.0.0.1:3001/v1"
);

type MobileAuthFailureListener = () => void | Promise<void>;

const mobileAuthFailureListeners = new Set<MobileAuthFailureListener>();
let mobileAuthFailureInFlight: Promise<void> | null = null;

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

export function subscribeMobileAuthFailure(listener: MobileAuthFailureListener) {
  mobileAuthFailureListeners.add(listener);
  return () => {
    mobileAuthFailureListeners.delete(listener);
  };
}

async function notifyMobileAuthFailure() {
  if (mobileAuthFailureInFlight) {
    await mobileAuthFailureInFlight;
    return;
  }

  mobileAuthFailureInFlight = Promise.allSettled(
    [...mobileAuthFailureListeners].map((listener) => listener())
  ).then(() => undefined).finally(() => {
    mobileAuthFailureInFlight = null;
  });

  await mobileAuthFailureInFlight;
}

export const mobileApiClient = createApiClient({
  baseURL: MOBILE_API_BASE_URL,
  tokenStore: mobileSessionStore,
  authEvents: {
    onAuthFailure() {
      return notifyMobileAuthFailure();
    }
  }
});
