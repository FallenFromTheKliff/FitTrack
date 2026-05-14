"use client";
import {
  useCallback,
  useMemo,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RegisterPayload } from "@fittrack/api-client";
import type { IAuthContext, AuthUser } from "@fittrack/types";
import { createAuthController, toActionErrorMessage } from "@fittrack/app-core";
import {
  authCurrentUserQueryOptions,
  changePasswordActionMutationOptions,
  loginActionMutationOptions,
  logoutActionMutationOptions,
  patchAuthUserQueryData,
  registerActionMutationOptions,
  setAuthUserQueryData,
  verifyCurrentPasswordActionMutationOptions,
  verifyOtpActionMutationOptions,
} from "@fittrack/query";
import { webApiClient, webSessionStore } from "@/lib/api-client";
import { WEB_ROLE_GATE } from "@/lib/portal-access";

type Props = {
  children: ReactNode;
  onUserLoaded: (userId: string) => Promise<void>;
  onUserCleared: () => void;
};

const AuthContext = createContext<IAuthContext | null>(null);
const LOGOUT_REDIRECT_STORAGE_KEY = "fittrack.logoutRedirectPath";

function getLogoutRedirectPath(role: AuthUser["role"] | null | undefined) {
  return role === "USER" || !role ? "/member-login" : "/login";
}

export function AuthProvider({ children, onUserLoaded, onUserCleared }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const controller = useMemo(
    () =>
      createAuthController({
        client: webApiClient,
        onUserLoaded,
        onUserCleared,
        roleGate: WEB_ROLE_GATE,
        sessionStore: webSessionStore,
      }),
    [onUserCleared, onUserLoaded],
  );
  const authUserOptions = useMemo(
    () => authCurrentUserQueryOptions(() => controller.loadCurrentUser()),
    [controller],
  );

  const { data: user = null, isLoading } = useQuery(authUserOptions);

  const isAuthenticated = !!user;

  const setUser = useCallback(
    (next: AuthUser | null) => {
      setAuthUserQueryData(queryClient, next);
    },
    [queryClient],
  );

  const loginMutation = useMutation(
    loginActionMutationOptions((email, password, options) =>
      controller.login(email, password, options),
    ),
  );

  const login = useCallback(
    async (
      email: string,
      password: string,
      options?: { portal?: "team" | "member" },
    ) => {
      try {
        const data = await loginMutation.mutateAsync({
          email,
          password,
          portal: options?.portal,
        });
        if (!data.success) {
          return {
            success: false as const,
            error: data.error ?? "Invalid credentials.",
            reason: data.reason,
          };
        }
        return {
          success: true as const,
          otpRequired: data.otpRequired,
          user: data.user,
        };
      } catch (error: unknown) {
        return {
          success: false as const,
          error: toActionErrorMessage(error, "Invalid credentials."),
        };
      }
    },
    [loginMutation],
  );

  const registerMutation = useMutation(
    registerActionMutationOptions((payload: RegisterPayload) =>
      controller.register(payload),
    ),
  );

  const register = useCallback(
    async (payload: {
      email: string;
      firstName: string;
      lastName: string;
      password: string;
      phone?: string;
    }) => {
      try {
        const data = await registerMutation.mutateAsync({
          email: payload.email,
          first_name: payload.firstName,
          last_name: payload.lastName,
          password: payload.password,
          phone: payload.phone,
        });
        if (!data.success)
          return {
            success: false as const,
            error: data.error ?? "Registration failed.",
          };
        return { success: true as const, userId: data.userId };
      } catch (error: unknown) {
        return {
          success: false as const,
          error: toActionErrorMessage(error, "Registration failed."),
        };
      }
    },
    [registerMutation],
  );

  const verifyCurrentPasswordMutation = useMutation(
    verifyCurrentPasswordActionMutationOptions((currentPassword: string) =>
      controller.verifyCurrentPassword(currentPassword),
    ),
  );

  const verifyCurrentPassword = useCallback(
    async (password: string) => {
      try {
        return await verifyCurrentPasswordMutation.mutateAsync(password);
      } catch {
        return false;
      }
    },
    [verifyCurrentPasswordMutation],
  );

  const changePasswordMutation = useMutation(
    changePasswordActionMutationOptions((currentPassword, newPassword) =>
      controller.changePassword(currentPassword, newPassword),
    ),
  );

  const changePassword = useCallback(
    async (currentPassword: string, nextPassword: string) => {
      try {
        if (!user?.id)
          return { success: false as const, error: "No user session." };
        await changePasswordMutation.mutateAsync({
          currentPassword,
          newPassword: nextPassword,
        });
        return { success: true as const };
      } catch (error: unknown) {
        return {
          success: false as const,
          error: toActionErrorMessage(error, "Password change failed."),
        };
      }
    },
    [user?.id, changePasswordMutation],
  );

  const logoutMutation = useMutation(
    logoutActionMutationOptions(() => controller.logout()),
  );

  const logout = useCallback(async () => {
    const redirectPath = getLogoutRedirectPath(user?.role);
    window.sessionStorage.setItem(LOGOUT_REDIRECT_STORAGE_KEY, redirectPath);
    try {
      await logoutMutation.mutateAsync();
    } catch {
      void 0;
    }
    setUser(null);
    queryClient.clear();
    router.replace(redirectPath);
  }, [logoutMutation, queryClient, router, setUser, user?.role]);

  const deleteUser = useCallback(async () => {
    await logout();
  }, [logout]);

  const updateUser = useCallback(
    async (patch: Partial<AuthUser>) => {
      patchAuthUserQueryData(queryClient, patch);
    },
    [queryClient],
  );

  const sendOTP = useCallback(
    async (_destination: string) => {
      try {
        const success = await controller.sendOTP();
        return { success };
      } catch {
        return { success: false as const };
      }
    },
    [controller],
  );

  const verifyOTPMutation = useMutation(
    verifyOtpActionMutationOptions((code: string) =>
      controller.verifyOTP(code),
    ),
  );

  const verifyOTP = useCallback(
    async (code: string) => {
      try {
        const data = await verifyOTPMutation.mutateAsync(code);
        if (!data.success)
          return {
            success: false as const,
            error: data.error ?? "Invalid OTP.",
          };
        return { success: true as const };
      } catch (error: unknown) {
        return {
          success: false as const,
          error: toActionErrorMessage(error, "Invalid OTP."),
        };
      }
    },
    [verifyOTPMutation],
  );

  const commitLogin = useCallback(async () => {
    const authUser = await controller.commitLogin();
    if (authUser === undefined) return;
    if (!authUser) {
      setUser(null);
      return;
    }
    setUser(authUser);
    void controller
      .loadCurrentUser()
      .then((hydratedUser) => {
        if (hydratedUser !== undefined) setUser(hydratedUser);
      })
      .catch(() => {});
    return authUser;
  }, [controller, setUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        deleteUser,
        updateUser,
        sendOTP,
        verifyOTP,
        verifyCurrentPassword,
        changePassword,
        commitLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): IAuthContext {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
