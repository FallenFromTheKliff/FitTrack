"use client";
import { useState, useCallback, useMemo, createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  verifyOtpActionMutationOptions
} from "@fittrack/query";
import { webApiClient, webSessionStore } from "@/lib/api-client";

type Props = {
  children: ReactNode;
  onUserLoaded: (userId: string) => Promise<void>;
  onUserCleared: () => void;
};

const AuthContext = createContext<IAuthContext | null>(null);

export function AuthProvider({ children, onUserLoaded, onUserCleared }: Props) {
  const queryClient = useQueryClient();
  const [loginAttempts, setAttempts] = useState(0);
  const controller = useMemo(() => createAuthController({
    client: webApiClient,
    onUserLoaded,
    onUserCleared,
    sessionStore: webSessionStore
  }), [onUserCleared, onUserLoaded]);
  const authUserOptions = useMemo(
    () => authCurrentUserQueryOptions(() => controller.loadCurrentUser()),
    [controller]
  );

  const {
    data: user = null,
    isLoading
  } = useQuery(authUserOptions);

  const isAuthenticated = !!user;

  const setUser = useCallback((next: AuthUser | null) => {
    setAuthUserQueryData(queryClient, next);
  }, [queryClient]);

  const loginMutation = useMutation(loginActionMutationOptions((email, password) => controller.login(email, password)));

  const login = useCallback(async (email: string, password: string) => {
    if (loginAttempts >= 5) return { success: false as const, error: "Account locked." };
    try {
      const data = await loginMutation.mutateAsync({ email, password });
      if (!data.success) {
        setAttempts((n) => n + 1);
        return { success: false as const, error: data.error ?? "Invalid credentials." };
      }
      setAttempts(0);
      return { success: true as const, otpRequired: data.otpRequired };
    } catch (error: unknown) {
      setAttempts((n) => n + 1);
      return { success: false as const, error: toActionErrorMessage(error, "Invalid credentials.") };
    }
  }, [loginAttempts, loginMutation]);

  const registerMutation = useMutation(registerActionMutationOptions((payload: { email: string; phone_no?: string; password: string }) =>
    controller.register(payload)
  ));

  const register = useCallback(async (payload: { email: string; phone_no?: string; password: string }) => {
    try {
      const data = await registerMutation.mutateAsync(payload);
      if (!data.success) return { success: false as const, error: data.error ?? "Registration failed." };
      return { success: true as const, userId: data.userId };
    } catch (error: unknown) {
      return { success: false as const, error: toActionErrorMessage(error, "Registration failed.") };
    }
  }, [registerMutation]);

  const verifyCurrentPasswordMutation = useMutation(
    verifyCurrentPasswordActionMutationOptions((currentPassword: string) => controller.verifyCurrentPassword(currentPassword))
  );

  const verifyCurrentPassword = useCallback(async (password: string) => {
    try {
      return await verifyCurrentPasswordMutation.mutateAsync(password);
    } catch {
      return false;
    }
  }, [verifyCurrentPasswordMutation]);

  const changePasswordMutation = useMutation(
    changePasswordActionMutationOptions((email, password) => controller.changePassword(email, password))
  );

  const changePassword = useCallback(async (_currentPassword: string, nextPassword: string) => {
    try {
      if (!user?.email) return { success: false as const, error: "No user session." };
      await changePasswordMutation.mutateAsync({ email: user.email, password: nextPassword });
      return { success: true as const };
    } catch (error: unknown) {
      return { success: false as const, error: toActionErrorMessage(error, "Password change failed.") };
    }
  }, [user?.email, changePasswordMutation]);

  const logoutMutation = useMutation(logoutActionMutationOptions(() => controller.logout()));

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      void 0;
    }
    setUser(null);
    queryClient.clear();
  }, [logoutMutation, queryClient, setUser]);

  const deleteUser = useCallback(async () => {
    await logout();
  }, [logout]);

  const updateUser = useCallback(async (patch: Partial<AuthUser>) => {
    patchAuthUserQueryData(queryClient, patch);
  }, [queryClient]);

  const sendOTP = useCallback(async (_destination: string) => {
    return { success: true as const };
  }, []);

  const verifyOTPMutation = useMutation(verifyOtpActionMutationOptions((code: string) => controller.verifyOTP(code)));

  const verifyOTP = useCallback(async (code: string) => {
    try {
      const data = await verifyOTPMutation.mutateAsync(code);
      if (!data.success) return { success: false as const, error: data.error ?? "Invalid OTP." };
      return { success: true as const };
    } catch (error: unknown) {
      return { success: false as const, error: toActionErrorMessage(error, "Invalid OTP.") };
    }
  }, [verifyOTPMutation]);

  const commitLogin = useCallback(async () => {
    const authUser = await controller.commitLogin();
    if (authUser === undefined) return;
    if (!authUser) {
      setUser(null);
      return;
    }
    setUser(authUser);
  }, [controller, setUser]);

  return (
    <AuthContext.Provider value={{
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
      commitLogin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): IAuthContext {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
