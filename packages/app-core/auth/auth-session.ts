import type { LoginSuccessResponse, UserProfileResponse } from "@fittrack/api-client";
import type { AuthUser, Role } from "@fittrack/types";

export const ACCESS_TOKEN_KEY = "fittrack_access_token";
export const REFRESH_TOKEN_KEY = "fittrack_refresh_token";

export type Awaitable<T> = T | Promise<T>;

export type SessionStoreAdapter = {
  getAccessToken: () => Awaitable<string | null>;
  getRefreshToken: () => Awaitable<string | null>;
  setTokens: (tokens: { accessToken: string; refreshToken?: string | null }) => Awaitable<void>;
  clearTokens: () => Awaitable<void>;
};

export type PendingCredentials = {
  email: string;
  password: string;
};

export function mapProfileToAuthUser(profile: UserProfileResponse, status?: AuthUser["status"]): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role?.name as Role,
    phone_no: profile.phone_no,
    emailVerified: profile.emailVerified,
    phoneVerified: profile.phoneVerified,
    profile: profile.profile ?? undefined,
    ...(status ? { status } : {})
  };
}

export function mapLoginSuccessUser(payload: LoginSuccessResponse): AuthUser {
  return {
    id: payload.user.id,
    email: payload.user.email,
    role: payload.user.role as Role,
    phone_no: payload.user.phone_no,
    emailVerified: payload.user.emailVerified,
    phoneVerified: payload.user.phoneVerified,
    profile: payload.user.profile ?? undefined
  };
}

export function resolveAccountStatus(deletedAt?: string | null, requestStatus?: string | null): AuthUser["status"] {
  if (deletedAt) return "expired";
  const normalized = requestStatus?.toLowerCase() ?? "";
  if (normalized === "pending") return "frozen";
  if (normalized === "approved") return "expired";
  return "active";
}

export function createPendingAuthSession() {
  let pendingUser: AuthUser | null = null;
  let pendingEmail: string | null = null;
  let pendingCredentials: PendingCredentials | null = null;

  return {
    getPendingUser() {
      return pendingUser;
    },
    getPendingEmail() {
      return pendingEmail;
    },
    getPendingCredentials() {
      return pendingCredentials;
    },
    setPendingUser(user: AuthUser | null) {
      pendingUser = user;
    },
    setPendingEmail(email: string | null) {
      pendingEmail = email;
    },
    setPendingCredentials(credentials: PendingCredentials | null) {
      pendingCredentials = credentials;
    },
    clearCredentials() {
      pendingCredentials = null;
    },
    clearUser() {
      pendingUser = null;
    },
    clear() {
      pendingUser = null;
      pendingEmail = null;
      pendingCredentials = null;
    }
  };
}