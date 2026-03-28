import { useState, useEffect, useCallback, useRef, createContext, useContext, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";

import type { AuthUser, Role } from "@fittrack/types";
import { mobileApi } from "@/lib/api";

type RegisterInput = { email: string; phone: string; password: string };
type LoginResult = { user: AuthUser; needsOTP: boolean } | undefined;
type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  commitLogin: () => Promise<void>;
  register: (data: RegisterInput) => Promise<AuthUser | undefined>;
  logout: () => Promise<void>;
  deleteUser: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
  sendOTP: (destination: string) => Promise<{ success: boolean }>;
  verifyOTP: (code: string) => Promise<{ success: boolean; error?: string }>;
  verifyCurrentPassword: (password: string) => Promise<boolean>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<{ success: true } | { success: false; error: string }>;
};

type Props = {
  children: ReactNode;
  onUserLoaded: (userId: string) => Promise<void>;
  onUserCleared: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) {
      return data.message.join(" ");
    }
    if (typeof data?.message === "string") {
      return data.message;
    }
  }
  return fallback;
}

export function AuthProvider({ children, onUserLoaded, onUserCleared }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pendingUser = useRef<AuthUser | null>(null);
  const pendingEmailRef = useRef<string | null>(null);
  const pendingCredentialsRef = useRef<{ email: string; password: string } | null>(null);

  const isAuthenticated = !!user;

  const resolveAccountStatus = useCallback((deletedAt?: string | null, requestStatus?: string | null) => {
    if (deletedAt) return "expired" as const;
    const normalized = requestStatus?.toLowerCase() ?? "";
    if (normalized === "pending") return "frozen" as const;
    if (normalized === "approved") return "expired" as const;
    return "active" as const;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("fittrack_access_token");
        if (token) {
          const { data } = await mobileApi.get("/users/profile");
          let requestStatus: string | null = null;
          try {
            const req = await mobileApi.get<{ status?: string | null }>("/users/deletion-request");
            requestStatus = req.data?.status ?? null;
          } catch {}
          const status = resolveAccountStatus(data.deletedAt, requestStatus);
          if (status === "expired") {
            await AsyncStorage.multiRemove(["fittrack_access_token", "fittrack_refresh_token"]);
            onUserCleared();
            setUser(null);
            return;
          }
          const authUser: AuthUser = {
            id: data.id,
            email: data.email,
            role: data.role?.name as Role,
            phone_no: data.phone_no,
            profile: data.profile,
            status
          };
          await onUserLoaded(authUser.id);
          setUser(authUser);
        }
      } catch {
        await AsyncStorage.multiRemove(["fittrack_access_token", "fittrack_refresh_token"]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [onUserCleared, onUserLoaded, resolveAccountStatus]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const { data } = await mobileApi.post("/auth/login", { email, password });
        if (data.otpRequired) {
          pendingEmailRef.current = email;
          pendingCredentialsRef.current = { email, password };
          const placeholder: AuthUser = { id: "", email, role: "USER" };
          pendingUser.current = placeholder;
          return { user: placeholder, needsOTP: true };
        }
        await AsyncStorage.setItem("fittrack_access_token", data.access_token);
        await AsyncStorage.setItem("fittrack_refresh_token", data.refresh_token);
        const authUser: AuthUser = {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role as Role,
          phone_no: data.user.phone_no,
          emailVerified: data.user.emailVerified,
          phoneVerified: data.user.phoneVerified
        };
        pendingEmailRef.current = data.user.email;
        pendingCredentialsRef.current = { email, password };
        pendingUser.current = authUser;
        return { user: authUser, needsOTP: false };
      } catch {
        return undefined;
      }
    }, []
  );

  const commitLogin = useCallback(async () => {
    if (!pendingUser.current) return;
    const authUser = pendingUser.current;
    pendingUser.current = null;
    try {
      const req = await mobileApi.get<{ status?: string | null }>("/users/deletion-request");
      const status = resolveAccountStatus(null, req.data?.status ?? null);
      if (status === "expired") {
        await AsyncStorage.multiRemove(["fittrack_access_token", "fittrack_refresh_token"]);
        onUserCleared();
        setUser(null);
        return;
      }
      await onUserLoaded(authUser.id);
      setUser({ ...authUser, status });
    } catch {
      await onUserLoaded(authUser.id);
      setUser({ ...authUser, status: "active" });
    }
  }, [onUserCleared, onUserLoaded, resolveAccountStatus]);

  const register = useCallback(
    async (data: RegisterInput): Promise<AuthUser | undefined> => {
      try {
        const res = await mobileApi.post<{ userId: string; email: string }>("/auth/register", {
          email: data.email,
          phone_no: data.phone,
          password: data.password
        });
        pendingEmailRef.current = res.data.email;
        pendingCredentialsRef.current = { email: data.email, password: data.password };
        const placeholder: AuthUser = { id: res.data.userId, email: res.data.email, role: "USER" };
        return placeholder;
      } catch {
        return undefined;
      }
    }, []
  );

  const logout = useCallback(async () => {
    try {
      const refresh = await AsyncStorage.getItem("fittrack_refresh_token");
      if (refresh) {
        await mobileApi.post("/auth/logout", { refresh_token: refresh });
      }
    } catch {}
    await AsyncStorage.multiRemove(["fittrack_access_token", "fittrack_refresh_token"]);
    pendingUser.current = null;
    onUserCleared();
    setUser(null);
  }, [onUserCleared]);

  const deleteUser = useCallback(async () => {
    if (!user?.id) return;
    onUserCleared();
    setUser(null);
  }, [onUserCleared, user?.id]);

  const updateUser = useCallback(async (patch: Partial<AuthUser>) => {
    const enrichedPatch = patch.name
      ? { ...patch, avatarInitials: patch.name.slice(0, 2).toUpperCase() }
      : patch;
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...enrichedPatch };
    });
  }, []);

  const sendOTP = useCallback(async (_destination: string) => {
    return { success: true as const };
  }, []);

  const verifyCurrentPassword = useCallback(async (password: string) => {
    try {
      const { data } = await mobileApi.post<{ verified?: boolean }>("/auth/verify-current-password", { currentPassword: password });
      return !!data.verified;
    } catch {
      return false;
    }
  }, []);

  const changePassword = useCallback(async (_currentPassword: string, nextPassword: string): Promise<{ success: true } | { success: false; error: string }> => {
    try {
      if (!user?.email) return { success: false, error: "No user session." };
      await mobileApi.post("/auth/change-password", { email: user.email, password: nextPassword });
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: toErrorMessage(error, "Password change failed.") };
    }
  }, [user?.email]);

  const verifyOTP = useCallback(async (code: string) => {
    try {
      const email = pendingEmailRef.current;
      if (!email) {
        return { success: false as const, error: "No pending email." };
      }
      await mobileApi.post("/auth/verify-email", { email, otp: code });
      if (pendingCredentialsRef.current) {
        const creds = pendingCredentialsRef.current;
        pendingCredentialsRef.current = null;
        const { data } = await mobileApi.post("/auth/login", { email: creds.email, password: creds.password });
        await AsyncStorage.setItem("fittrack_access_token", data.access_token);
        await AsyncStorage.setItem("fittrack_refresh_token", data.refresh_token);
        const authUser: AuthUser = {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role as Role,
          phone_no: data.user.phone_no,
          emailVerified: data.user.emailVerified,
          phoneVerified: data.user.phoneVerified
        };
        pendingUser.current = authUser;
      }
      return { success: true as const };
    } catch (error: unknown) {
      return { success: false as const, error: toErrorMessage(error, "Invalid OTP.") };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        commitLogin,
        register,
        logout,
        deleteUser,
        updateUser,
        sendOTP,
        verifyOTP,
        verifyCurrentPassword,
        changePassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
