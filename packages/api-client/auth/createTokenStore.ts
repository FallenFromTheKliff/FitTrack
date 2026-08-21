import type { Awaitable, TokenStore } from "./token-store";

export interface KeyValueStorageAdapter {
  getItem: (key: string) => Awaitable<string | null>;
  removeItem: (key: string) => Awaitable<void>;
  setItem: (key: string, value: string) => Awaitable<void>;
}

type CreateTokenStoreConfig = {
  accessTokenKey: string;
  cache?: "memory" | "none";
  refreshTokenKey: string;
  storage: KeyValueStorageAdapter;
};

export function createTokenStore({
  accessTokenKey,
  cache = "none",
  refreshTokenKey,
  storage
}: CreateTokenStoreConfig): TokenStore {
  const useMemoryCache = cache === "memory";
  let hydrationPromise: Promise<void> | null = null;
  let hydrated = !useMemoryCache;
  let accessTokenCache: string | null = null;
  let refreshTokenCache: string | null = null;

  async function hydrate() {
    if (!useMemoryCache || hydrated) return;
    if (!hydrationPromise) {
      hydrationPromise = Promise.all([
        storage.getItem(accessTokenKey),
        storage.getItem(refreshTokenKey)
      ]).then(([accessToken, refreshToken]) => {
        accessTokenCache = accessToken;
        refreshTokenCache = refreshToken;
        hydrated = true;
      });
    }
    await hydrationPromise;
  }

  async function getStoredToken(key: string) {
    const token = await storage.getItem(key);
    return typeof token === "string" && token.trim() !== "" ? token : null;
  }

  async function getCurrentRefreshToken() {
    if (useMemoryCache) {
      await hydrate();
      return refreshTokenCache;
    }
    return getStoredToken(refreshTokenKey);
  }

  return {
    hydrate: useMemoryCache ? hydrate : undefined,
    async getAccessToken() {
      if (useMemoryCache) {
        await hydrate();
        return accessTokenCache;
      }
      return getStoredToken(accessTokenKey);
    },
    async getRefreshToken() {
      return getCurrentRefreshToken();
    },
    async setTokens({ accessToken, refreshToken }) {
      const nextRefreshToken = typeof refreshToken === "string" && refreshToken.trim() !== ""
        ? refreshToken
        : await getCurrentRefreshToken();

      if (useMemoryCache) {
        hydrated = true;
        accessTokenCache = accessToken;
        refreshTokenCache = nextRefreshToken;
      }

      await storage.setItem(accessTokenKey, accessToken);
      if (nextRefreshToken) {
        await storage.setItem(refreshTokenKey, nextRefreshToken);
        return;
      }
      await storage.removeItem(refreshTokenKey);
    },
    async clearTokens() {
      if (useMemoryCache) {
        hydrated = true;
        accessTokenCache = null;
        refreshTokenCache = null;
      }
      await Promise.all([
        storage.removeItem(accessTokenKey),
        storage.removeItem(refreshTokenKey)
      ]);
    }
  };
}
