import AsyncStorage from "@react-native-async-storage/async-storage";
import { createApiClient } from "@fittrack/api-client";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const ACCESS_TOKEN_KEY = "fittrack_access_token";
const REFRESH_TOKEN_KEY = "fittrack_refresh_token";

let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let hydrationPromise: Promise<void> | null = null;

function setTokenCache(accessToken: string | null, refreshToken: string | null = refreshTokenCache) {
  accessTokenCache = accessToken;
  refreshTokenCache = refreshToken;
}

const mobileTokenStore = {
  hydrate() {
    if (!hydrationPromise) {
      hydrationPromise = AsyncStorage.multiGet([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]).then((entries) => {
        const accessToken = entries.find(([key]) => key === ACCESS_TOKEN_KEY)?.[1] ?? null;
        const refreshToken = entries.find(([key]) => key === REFRESH_TOKEN_KEY)?.[1] ?? null;
        setTokenCache(accessToken, refreshToken);
      });
    }
    return hydrationPromise;
  },
  getAccessToken() {
    return accessTokenCache;
  },
  getRefreshToken() {
    return refreshTokenCache;
  },
  async setTokens({ accessToken, refreshToken }: { accessToken: string; refreshToken?: string | null }) {
    setTokenCache(accessToken, typeof refreshToken === "string" ? refreshToken : refreshTokenCache);
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (typeof refreshToken === "string" && refreshToken.trim() !== "") {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },
  async clearTokens() {
    setTokenCache(null, null);
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  }
};

export function hydrateMobileApiAuth() {
  return mobileTokenStore.hydrate();
}

export const mobileApiClient = createApiClient({
  baseURL: BASE,
  tokenStore: mobileTokenStore
});
