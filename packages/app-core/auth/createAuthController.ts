import type { ApiClient, LoginSuccessResponse, RegisterPayload } from "@fittrack/api-client";
import type { AuthUser } from "@fittrack/types";
import {
  createPendingAuthSession,
  mapLoginSuccessUser,
  mapProfileToAuthUser,
  resolveAccountStatus,
  type SessionStoreAdapter
} from "./auth-session";

type AuthControllerConfig = {
  client: Pick<ApiClient, "auth" | "users">;
  onUserCleared: () => void;
  onUserLoaded: (userId: string) => Promise<void>;
  sessionStore: SessionStoreAdapter;
};

function isLoginSuccess(value: LoginSuccessResponse | { otpRequired?: boolean }): value is LoginSuccessResponse {
  return "access_token" in value;
}

export function createAuthController({ client, onUserCleared, onUserLoaded, sessionStore }: AuthControllerConfig) {
  const pending = createPendingAuthSession();

  return {
    async loadCurrentUser(options?: { includeDeletionStatus?: boolean }) {
      const token = await sessionStore.getAccessToken();
      if (!token) return null;
      const profile = await client.users.getProfile();
      let status: AuthUser["status"] | undefined;
      if (options?.includeDeletionStatus) {
        try {
          const request = await client.users.getDeletionRequestStatus();
          status = resolveAccountStatus(profile.deletedAt, request.status ?? null);
        } catch {
          status = resolveAccountStatus(profile.deletedAt, null);
        }
      }
      if (status === "expired") {
        await sessionStore.clearTokens();
        pending.clear();
        onUserCleared();
        return null;
      }
      const authUser = mapProfileToAuthUser(profile, status);
      await onUserLoaded(authUser.id);
      return authUser;
    },
    async login(email: string, password: string, options?: { placeholderRole?: AuthUser["role"] }) {
      const data = await client.auth.login({ email, password });
      if ("otpRequired" in data && data.otpRequired) {
        const placeholder: AuthUser = { id: "", email, role: options?.placeholderRole ?? "USER" };
        pending.setPendingUser(placeholder);
        pending.setPendingEmail(email);
        pending.setPendingCredentials({ email, password });
        return { success: true as const, otpRequired: true as const, user: placeholder };
      }
      if (!isLoginSuccess(data)) {
        return { success: false as const, otpRequired: false as const, error: "Invalid login response." };
      }
      await sessionStore.setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
      const authUser = mapLoginSuccessUser(data);
      pending.setPendingUser(authUser);
      pending.setPendingEmail(data.user.email);
      pending.setPendingCredentials({ email, password });
      return { success: true as const, otpRequired: false as const, user: authUser };
    },
    async register(payload: RegisterPayload, options?: { placeholderRole?: AuthUser["role"] }) {
      const data = await client.auth.register(payload);
      if (!data.userId || !data.email) {
        return { success: false as const, error: "Registration failed." };
      }
      const placeholder: AuthUser = {
        id: data.userId,
        email: data.email,
        role: options?.placeholderRole ?? "USER"
      };
      pending.setPendingEmail(data.email);
      pending.setPendingCredentials({ email: payload.email, password: payload.password });
      return { success: true as const, user: placeholder, userId: data.userId };
    },
    async verifyOTP(code: string) {
      const email = pending.getPendingEmail();
      if (!email) {
        return { success: false as const, error: "No pending session." };
      }
      const verify = await client.auth.verifyEmail({ email, otp: code });
      if (!verify.emailVerified) {
        return { success: false as const, error: "Verification failed." };
      }
      const credentials = pending.getPendingCredentials();
      if (!credentials) {
        return { success: true as const };
      }
      const relogin = await client.auth.login(credentials);
      if (!isLoginSuccess(relogin)) {
        return { success: false as const, error: "OTP verification did not complete the session." };
      }
      await sessionStore.setTokens({ accessToken: relogin.access_token, refreshToken: relogin.refresh_token });
      pending.setPendingUser(mapLoginSuccessUser(relogin));
      pending.clearCredentials();
      return { success: true as const };
    },
    async commitLogin(options?: { includeDeletionStatus?: boolean }) {
      const pendingUser = pending.getPendingUser();
      if (!pendingUser) return undefined;
      pending.clearUser();
      let user = pendingUser;
      if (options?.includeDeletionStatus) {
        try {
          const request = await client.users.getDeletionRequestStatus();
          const status = resolveAccountStatus(null, request.status ?? null);
          if (status === "expired") {
            await sessionStore.clearTokens();
            pending.clear();
            onUserCleared();
            return null;
          }
          user = { ...user, status };
        } catch {
          user = { ...user, status: "active" };
        }
      }
      if (user.id) {
        await onUserLoaded(user.id);
      }
      return user;
    },
    async verifyCurrentPassword(password: string) {
      const data = await client.auth.verifyCurrentPassword(password);
      return !!data.verified;
    },
    async changePassword(email: string, password: string) {
      await client.auth.changePassword({ email, password });
    },
    async logout() {
      try {
        const refresh = await sessionStore.getRefreshToken();
        if (refresh) {
          await client.auth.logout({ refresh_token: refresh });
        }
      } catch {
        void 0;
      }
      await sessionStore.clearTokens();
      pending.clear();
      onUserCleared();
    }
  };
}