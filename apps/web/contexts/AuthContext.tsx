"use client";
import { useState, useCallback, useRef, createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import type { IAuthContext, AuthUser, Role } from "@fittrack/types";
import { api } from "@/lib/axios";

type Props = {
  children: ReactNode;
  onUserLoaded: (userId: string) => Promise<void>;
  onUserCleared: () => void;
};

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    role: Role;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    phone_no?: string | null;
  };
};

type OtpResponse = {
  otpRequired: true;
  message?: string;
  reason?: string;
};

const AuthContext = createContext<IAuthContext | null>(null);

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data.message.join(" ");
    if (typeof data?.message === "string") return data.message;
  }
  return fallback;
}

export function AuthProvider({ children, onUserLoaded, onUserCleared }: Props) {
  const queryClient = useQueryClient();
  const [loginAttempts, setAttempts] = useState(0);
  const pendingUser = useRef<AuthUser | null>(null);
  const pendingEmailRef = useRef<string | null>(null);
  const pendingCredentialsRef = useRef<{ email: string; password: string } | null>(null);

  const {
    data: user = null,
    isLoading
  } = useQuery<AuthUser | null>({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const token = localStorage.getItem("fittrack_access_token");
      if (!token) return null;
      const { data } = await api.get("/users/profile");
      const authUser: AuthUser = {
        id: data.id,
        email: data.email,
        role: data.role?.name as Role,
        phone_no: data.phone_no,
        profile: data.profile
      };
      await onUserLoaded(authUser.id);
      return authUser;
    },
    retry: false,
    staleTime: Infinity
  });

  const isAuthenticated = !!user;

  const setUser = useCallback((next: AuthUser | null) => {
    queryClient.setQueryData<AuthUser | null>(["auth-user"], next);
  }, [queryClient]);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data } = await api.post<LoginResponse | OtpResponse>("/auth/login", { email, password });
      return data;
    }
  });

  const login = useCallback(async (email: string, password: string) => {
    if (loginAttempts >= 5) return { success: false as const, error: "Account locked." };
    try {
      const data = await loginMutation.mutateAsync({ email, password });
      if ("otpRequired" in data && data.otpRequired) {
        pendingEmailRef.current = email;
        pendingCredentialsRef.current = { email, password };
        setAttempts(0);
        return { success: true as const, otpRequired: true as const };
      }
      if (!("access_token" in data)) return { success: false as const, error: "Invalid login response." };
      localStorage.setItem("fittrack_access_token", data.access_token);
      localStorage.setItem("fittrack_refresh_token", data.refresh_token);
      pendingUser.current = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        phone_no: data.user.phone_no,
        emailVerified: data.user.emailVerified,
        phoneVerified: data.user.phoneVerified
      };
      pendingEmailRef.current = data.user.email;
      pendingCredentialsRef.current = { email, password };
      setAttempts(0);
      return { success: true as const, otpRequired: false as const };
    } catch (error: unknown) {
      setAttempts((n) => n + 1);
      return { success: false as const, error: toErrorMessage(error, "Invalid credentials.") };
    }
  }, [loginAttempts, loginMutation]);

  const registerMutation = useMutation({
    mutationFn: async (payload: { email: string; phone_no?: string; password: string }) => {
      const { data } = await api.post<{ userId?: string }>("/auth/register", payload);
      return data;
    }
  });

  const register = useCallback(async (payload: { email: string; phone_no?: string; password: string }) => {
    try {
      const data = await registerMutation.mutateAsync(payload);
      return { success: true as const, userId: data.userId };
    } catch (error: unknown) {
      return { success: false as const, error: toErrorMessage(error, "Registration failed.") };
    }
  }, [registerMutation]);

  const verifyCurrentPasswordMutation = useMutation({
    mutationFn: async (currentPassword: string) => {
      const { data } = await api.post<{ verified?: boolean }>("/auth/verify-current-password", { currentPassword });
      return !!data.verified;
    }
  });

  const verifyCurrentPassword = useCallback(async (password: string) => {
    try {
      return await verifyCurrentPasswordMutation.mutateAsync(password);
    } catch {
      return false;
    }
  }, [verifyCurrentPasswordMutation]);

  const changePasswordMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await api.post("/auth/change-password", { email, password });
    }
  });

  const changePassword = useCallback(async (_currentPassword: string, nextPassword: string) => {
    try {
      if (!user?.email) return { success: false as const, error: "No user session." };
      await changePasswordMutation.mutateAsync({ email: user.email, password: nextPassword });
      return { success: true as const };
    } catch (error: unknown) {
      return { success: false as const, error: toErrorMessage(error, "Password change failed.") };
    }
  }, [user?.email, changePasswordMutation]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const refresh = localStorage.getItem("fittrack_refresh_token");
      if (refresh) await api.post("/auth/logout", { refresh_token: refresh });
    }
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      void 0;
    }
    localStorage.removeItem("fittrack_access_token");
    localStorage.removeItem("fittrack_refresh_token");
    pendingUser.current = null;
    pendingEmailRef.current = null;
    pendingCredentialsRef.current = null;
    setUser(null);
    queryClient.clear();
    onUserCleared();
  }, [logoutMutation, setUser, queryClient, onUserCleared]);

  const deleteUser = useCallback(async () => {
    await logout();
  }, [logout]);

  const updateUser = useCallback(async (patch: Partial<AuthUser>) => {
    queryClient.setQueryData<AuthUser | null>(["auth-user"], (prev) => {
      if (!prev) return prev;
      return { ...prev, ...patch };
    });
  }, [queryClient]);

  const sendOTP = useCallback(async (_destination: string) => {
    return { success: true as const };
  }, []);

  const verifyOTPMutation = useMutation({
    mutationFn: async ({ email, otp }: { email: string; otp: string }) => {
      const verify = await api.post<{ emailVerified?: boolean }>("/auth/verify-email", { email, otp });
      if (!verify.data.emailVerified) throw new Error("Verification failed.");
      const creds = pendingCredentialsRef.current;
      if (!creds) throw new Error("No pending credentials.");
      const relogin = await api.post<LoginResponse>("/auth/login", creds);
      return relogin.data;
    }
  });

  const verifyOTP = useCallback(async (code: string) => {
    try {
      const email = pendingEmailRef.current;
      if (!email) return { success: false as const, error: "No pending session." };
      const data = await verifyOTPMutation.mutateAsync({ email, otp: code });
      localStorage.setItem("fittrack_access_token", data.access_token);
      localStorage.setItem("fittrack_refresh_token", data.refresh_token);
      pendingUser.current = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        phone_no: data.user.phone_no,
        emailVerified: data.user.emailVerified,
        phoneVerified: data.user.phoneVerified
      };
      pendingCredentialsRef.current = null;
      return { success: true as const };
    } catch (error: unknown) {
      return { success: false as const, error: toErrorMessage(error, "Invalid OTP.") };
    }
  }, [verifyOTPMutation]);

  const commitLogin = useCallback(async () => {
    if (!pendingUser.current) return;
    const authUser = pendingUser.current;
    pendingUser.current = null;
    if (authUser.id) await onUserLoaded(authUser.id);
    setUser(authUser);
  }, [onUserLoaded, setUser]);

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