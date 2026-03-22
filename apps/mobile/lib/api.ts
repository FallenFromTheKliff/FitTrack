import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const ACCESS_TOKEN_KEY = "fittrack_access_token";
const REFRESH_TOKEN_KEY = "fittrack_refresh_token";

let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let authHydrationPromise: Promise<void> | null = null;

function setTokenCache(accessToken: string | null, refreshToken: string | null = refreshTokenCache) {
  accessTokenCache = accessToken;
  refreshTokenCache = refreshToken;
}

function clearTokenCache() {
  accessTokenCache = null;
  refreshTokenCache = null;
}

export function hydrateMobileApiAuth() {
  if (!authHydrationPromise) {
    authHydrationPromise = AsyncStorage.multiGet([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]).then((entries) => {
      const accessToken = entries.find(([key]) => key === ACCESS_TOKEN_KEY)?.[1] ?? null;
      const refreshToken = entries.find(([key]) => key === REFRESH_TOKEN_KEY)?.[1] ?? null;
      setTokenCache(accessToken, refreshToken);
    });
  }
  return authHydrationPromise;
}

export const mobileApi = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" }
});

mobileApi.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  if (accessTokenCache) {
    config.headers.Authorization = `Bearer ${accessTokenCache}`;
  }
  return config;
});

mobileApi.interceptors.response.use(
  (res) => {
    const accessToken = typeof res.data?.access_token === "string" ? res.data.access_token : null;
    const refreshToken = typeof res.data?.refresh_token === "string" ? res.data.refresh_token : null;
    if (accessToken) {
      setTokenCache(accessToken, refreshToken ?? refreshTokenCache);
    }
    if (res.config.url === "/auth/logout") {
      clearTokenCache();
    }
    return res;
  },
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refresh = refreshTokenCache ?? await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE}/auth/refresh`, { refresh_token: refresh });
          setTokenCache(data.access_token, typeof data.refresh_token === "string" ? data.refresh_token : refresh);
          await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
          if (typeof data.refresh_token === "string") {
            await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
          }
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return mobileApi(original);
        } catch {
          clearTokenCache();
          await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
        }
      }
    }
    return Promise.reject(error);
  }
);
