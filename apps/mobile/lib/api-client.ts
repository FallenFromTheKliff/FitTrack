import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@fittrack/app-core";
import { createApiClient, createTokenStore, resolveApiBaseUrl } from "@fittrack/api-client";

const DEFAULT_MOBILE_API_BASE_URL = "http://localhost:3001/v1";
const FITTRACK_API_DEV_PORT = "3001";
const FITTRACK_API_BASE_PATH = "/v1";

type SourceCodeNativeModule = {
  scriptURL?: string;
};

function isLocalOrPrivateHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    /^10\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

function getNativeDevBundleHostname() {
  const sourceCode = NativeModules.SourceCode as SourceCodeNativeModule | undefined;
  const scriptURL = sourceCode?.scriptURL;

  if (!scriptURL) {
    return null;
  }

  try {
    const parsedScriptUrl = new URL(scriptURL);

    if (!["http:", "https:"].includes(parsedScriptUrl.protocol)) {
      return null;
    }

    if (!isLocalOrPrivateHost(parsedScriptUrl.hostname)) {
      return null;
    }

    return parsedScriptUrl.hostname;
  } catch {
    return null;
  }
}

function buildDevApiUrlFromHost(configuredBaseUrl: string, hostname: string) {
  const parsedBaseUrl = new URL(configuredBaseUrl);
  parsedBaseUrl.hostname = hostname === "localhost" ? "127.0.0.1" : hostname;
  parsedBaseUrl.port = FITTRACK_API_DEV_PORT;

  if (parsedBaseUrl.pathname === "" || parsedBaseUrl.pathname === "/") {
    parsedBaseUrl.pathname = FITTRACK_API_BASE_PATH;
  }

  return parsedBaseUrl.toString().replace(/\/+$/, "");
}

function resolveMobileApiBaseUrl() {
  const configuredBaseUrl = resolveApiBaseUrl(
    process.env.EXPO_PUBLIC_API_URL,
    DEFAULT_MOBILE_API_BASE_URL
  );

  if (Platform.OS !== "web") {
    const nativeDevBundleHostname = getNativeDevBundleHostname();

    if (!nativeDevBundleHostname) {
      return configuredBaseUrl;
    }

    try {
      const parsedBaseUrl = new URL(configuredBaseUrl);

      if (!isLocalOrPrivateHost(parsedBaseUrl.hostname)) {
        return configuredBaseUrl;
      }

      // Native dev clients load the JS bundle from Metro's LAN host. Reuse that
      // host for the API so Wi-Fi/IP changes do not require rebuilding the APK.
      // If Metro is reached through USB localhost/ADB reverse, use localhost for
      // the API too so the phone follows the same USB tunnel.
      return buildDevApiUrlFromHost(configuredBaseUrl, nativeDevBundleHostname);
    } catch {
      return configuredBaseUrl;
    }
  }

  if (typeof window === "undefined") {
    return configuredBaseUrl;
  }

  try {
    const pageHostname = window.location.hostname;
    const parsedBaseUrl = new URL(configuredBaseUrl);

    if (
      !pageHostname ||
      !isLocalOrPrivateHost(pageHostname) ||
      !isLocalOrPrivateHost(parsedBaseUrl.hostname)
    ) {
      return configuredBaseUrl;
    }

    // Expo web may be opened through localhost, 127.0.0.1, or the current LAN IP.
    // Follow the page host so desktop browser testing does not keep calling a
    // stale physical-device LAN address from apps/mobile/.env.local.
    return buildDevApiUrlFromHost(configuredBaseUrl, pageHostname);
  } catch {
    return configuredBaseUrl;
  }
}

export const MOBILE_API_BASE_URL = resolveMobileApiBaseUrl();

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
