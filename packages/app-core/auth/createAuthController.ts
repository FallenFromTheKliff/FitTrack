import {
  ApiClientError,
  toApiClientError,
  type ApiClient,
  type LoginSuccessResponse,
  type RegisterPayload,
} from "@fittrack/api-client";
import type { AuthUser, LoginPortal } from "@fittrack/types";
import {
  createPendingAuthSession,
  getRoleGateDeniedMessage,
  isRoleAllowedForGate,
  mapLoginSuccessUser,
  mapProfileToAuthUser,
  resolveAccountStatus,
  type RoleGateConfig,
  type SessionStoreAdapter,
} from "./auth-session";

type AuthControllerConfig = {
  client: Pick<ApiClient, "auth" | "users">;
  onUserCleared: () => void;
  onUserLoaded: (userId: string) => Promise<void>;
  roleGate?: RoleGateConfig;
  sessionStore: SessionStoreAdapter;
};

function isLoginSuccess(
  value: LoginSuccessResponse | { otpRequired?: boolean },
): value is LoginSuccessResponse {
  return "access_token" in value;
}

function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createAuthController({
  client,
  onUserCleared,
  onUserLoaded,
  roleGate,
  sessionStore,
}: AuthControllerConfig) {
  const pending = createPendingAuthSession();
  const shouldFetchDeletionStatus = (user: AuthUser | null | undefined) =>
    user?.role === "USER";

  const clearRejectedSession = async () => {
    await sessionStore.clearTokens();
    pending.clear();
    onUserCleared();
  };

  const shouldRejectRole = async (user: AuthUser | null | undefined) => {
    if (isRoleAllowedForGate(user?.role, roleGate)) {
      return false;
    }
    await clearRejectedSession();
    return true;
  };

  return {
    async loadCurrentUser(options?: { includeDeletionStatus?: boolean }) {
      const token = await sessionStore.getAccessToken();
      if (!token) return null;
      let profile;
      try {
        profile = await client.users.getProfile();
      } catch (error) {
        const apiError = toApiClientError(error, "Unable to load current user.");
        if (
          apiError instanceof ApiClientError &&
          (apiError.status === 401 || apiError.status === 403)
        ) {
          await sessionStore.clearTokens();
          pending.clear();
          onUserCleared();
          return null;
        }
        throw apiError;
      }
      let authUser = mapProfileToAuthUser(profile);
      if (options?.includeDeletionStatus) {
        const status = shouldFetchDeletionStatus(authUser)
          ? await (async () => {
              try {
                const request = await client.users.getDeletionRequestStatus();
                return resolveAccountStatus(
                  profile.deletedAt,
                  request.status ?? null,
                );
              } catch {
                return resolveAccountStatus(profile.deletedAt, null);
              }
            })()
          : resolveAccountStatus(profile.deletedAt, null);
        authUser = { ...authUser, status };
      }
      if (authUser.status === "expired") {
        await sessionStore.clearTokens();
        pending.clear();
        onUserCleared();
        return null;
      }
      if (await shouldRejectRole(authUser)) {
        return null;
      }
      await onUserLoaded(authUser.id);
      return authUser;
    },
    async login(
      email: string,
      password: string,
      options?: {
        placeholderRole?: AuthUser["role"];
        portal?: LoginPortal;
      },
    ) {
      try {
        const normalizedEmail = normalizeAuthEmail(email);
        const data = await client.auth.login({
          email: normalizedEmail,
          password,
          portal: options?.portal,
        });
        if ("otpRequired" in data && data.otpRequired) {
          const placeholder: AuthUser = {
            id: "",
            email: normalizedEmail,
            role: options?.placeholderRole ?? "USER",
          };
          pending.setPendingUser(placeholder);
          pending.setPendingEmail(normalizedEmail);
          pending.setPendingCredentials({ email: normalizedEmail, password });
          return {
            success: true as const,
            otpRequired: true as const,
            user: placeholder,
          };
        }
        if (!isLoginSuccess(data)) {
          return {
            success: false as const,
            otpRequired: false as const,
            error: "Invalid login response.",
          };
        }
        const authUser = mapLoginSuccessUser(data, normalizedEmail);
        if (await shouldRejectRole(authUser)) {
          return {
            success: false as const,
            otpRequired: false as const,
            error: getRoleGateDeniedMessage(roleGate),
            reason: "PORTAL_ROLE_MISMATCH" as const,
          };
        }
        await sessionStore.setTokens({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
        });
        pending.setPendingUser(authUser);
        pending.setPendingEmail(authUser.email);
        pending.setPendingCredentials({ email: normalizedEmail, password });
        return {
          success: true as const,
          otpRequired: false as const,
          user: authUser,
        };
      } catch (error) {
        const apiError = toApiClientError(error, "Login failed.");
        if (apiError.status === 423) {
          return {
            success: false as const,
            otpRequired: false as const,
            error: apiError.message,
            reason: "ACCOUNT_LOCKED" as const,
          };
        }
        return {
          success: false as const,
          otpRequired: false as const,
          error: "Invalid credentials.",
        };
      }
    },
    async register(
      payload: RegisterPayload,
      options?: { placeholderRole?: AuthUser["role"] },
    ) {
      const normalizedPayload = {
        ...payload,
        email: normalizeAuthEmail(payload.email),
      };
      const data = await client.auth.register(normalizedPayload);
      if (!data.user_id) {
        return { success: false as const, error: "Registration failed." };
      }
      const placeholder: AuthUser = {
        id: data.user_id,
        email: normalizedPayload.email,
        role: options?.placeholderRole ?? "USER",
      };
      pending.setPendingUser(placeholder);
      pending.setPendingEmail(normalizedPayload.email);
      pending.clearCredentials();
      return {
        success: true as const,
        user: placeholder,
        userId: data.user_id,
      };
    },
    async verifyOTP(
      code: string,
      options?: { persistSession?: boolean },
    ) {
      const pendingUser = pending.getPendingUser();
      if (!pendingUser?.id) {
        return { success: false as const, error: "No pending session." };
      }
      const verify = await client.auth.verifyEmail({
        user_id: pendingUser.id,
        code,
      });
      if (!isLoginSuccess(verify)) {
        return { success: false as const, error: "Verification failed." };
      }
      const verifiedUser = mapLoginSuccessUser(
        verify,
        pending.getPendingEmail() ?? undefined,
      );
      if (await shouldRejectRole(verifiedUser)) {
        return {
          success: false as const,
          error: getRoleGateDeniedMessage(roleGate),
        };
      }
      if (options?.persistSession === false) {
        pending.clear();
        return { success: true as const };
      }
      await sessionStore.setTokens({
        accessToken: verify.access_token,
        refreshToken: verify.refresh_token,
      });
      pending.setPendingUser(verifiedUser);
      pending.clearCredentials();
      return { success: true as const };
    },
    async sendOTP() {
      const pendingUser = pending.getPendingUser();
      if (!pendingUser?.id) {
        return false;
      }
      await client.auth.resendOtp({ user_id: pendingUser.id });
      return true;
    },
    async commitLogin(options?: { includeDeletionStatus?: boolean }) {
      const pendingUser = pending.getPendingUser();
      if (!pendingUser) return undefined;
      let user = pendingUser;
      if (options?.includeDeletionStatus) {
        if (shouldFetchDeletionStatus(user)) {
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
        } else {
          user = { ...user, status: user.status ?? "active" };
        }
      }
      if (await shouldRejectRole(user)) {
        return null;
      }
      pending.clearUser();
      if (user.id) {
        await onUserLoaded(user.id);
      }
      return user;
    },
    async verifyCurrentPassword(password: string) {
      const data = await client.auth.verifyCurrentPassword(password);
      return !!data.verified;
    },
    async changePassword(currentPassword: string, newPassword: string) {
      await client.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
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
    },
  };
}
