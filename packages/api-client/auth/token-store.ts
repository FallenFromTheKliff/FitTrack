export type Awaitable<T> = T | Promise<T>;

export type TokenSet = {
  accessToken: string;
  refreshToken?: string | null;
};

export interface TokenStore {
  hydrate?: () => Awaitable<void>;
  getAccessToken: () => Awaitable<string | null>;
  getRefreshToken: () => Awaitable<string | null>;
  setTokens: (tokens: TokenSet) => Awaitable<void>;
  clearTokens: () => Awaitable<void>;
}
