import { useState, useEffect, useCallback, useMemo, createContext, useContext, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AuthUser } from "@fittrack/types";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, createAuthController } from "@fittrack/app-core";
import { mobileApiClient } from "@/lib/api";

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
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

export function AuthProvider({ children, onUserLoaded, onUserCleared }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionStore = useMemo(() => ({
    getAccessToken: () => AsyncStorage.getItem(ACCESS_TOKEN_KEY),
    getRefreshToken: () => AsyncStorage.getItem(REFRESH_TOKEN_KEY),
    setTokens: ({ accessToken, refreshToken }: { accessToken: string; refreshToken?: string | null }) =>
      AsyncStorage.multiSet([[ACCESS_TOKEN_KEY, accessToken], [REFRESH_TOKEN_KEY, refreshToken ?? ""]]),
    clearTokens: () => AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY])
  }), []);
  const controller = useMemo(() => createAuthController({
    client: mobileApiClient,
    onUserLoaded,
    onUserCleared,
    sessionStore
  }), [onUserCleared, onUserLoaded, sessionStore]);
  const isAuthenticated = !!user;

  useEffect(() => {
    (async () => {
      try {
        const nextUser = await controller.loadCurrentUser({ includeDeletionStatus: true });
        setUser(nextUser);
      } catch {
        await sessionStore.clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [controller, sessionStore]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const data = await controller.login(email, password, { placeholderRole: "USER" });
        if (!data.success || !data.user) {
          return undefined;
        }
        return { user: data.user, needsOTP: data.otpRequired };
      } catch {
        return undefined;
      }
    }, [controller]
  );

  const commitLogin = useCallback(async () => {
    const nextUser = await controller.commitLogin({ includeDeletionStatus: true });
    if (nextUser === undefined) return;
    setUser(nextUser);
  }, [controller]);

  const register = useCallback(
    async (data: RegisterInput): Promise<AuthUser | undefined> => {
      try {
        const res = await controller.register({
          email: data.email,
          phone_no: data.phone,
          password: data.password
        }, { placeholderRole: "USER" });
        if (!res.success || !res.user) {
          return undefined;
        }
        return res.user;
      } catch {
        return undefined;
      }
    }, [controller]
  );

  const logout = useCallback(async () => {
    await controller.logout();
    setUser(null);
  }, [controller]);

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
      return await controller.verifyCurrentPassword(password);
    } catch {
      return false;
    }
  }, [controller]);

  const changePassword = useCallback(async (_currentPassword: string, nextPassword: string): Promise<{ success: true } | { success: false; error: string }> => {
    try {
      if (!user?.email) return { success: false, error: "No user session." };
      await controller.changePassword(user.email, nextPassword);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: toErrorMessage(error, "Password change failed.") };
    }
  }, [controller, user?.email]);

  const verifyOTP = useCallback(async (code: string) => {
    try {
      const result = await controller.verifyOTP(code);
      if (!result.success && result.error === "No pending session.") {
        return { success: false as const, error: "No pending email." };
      }
      return result;
    } catch (error: unknown) {
      return { success: false as const, error: toErrorMessage(error, "Invalid OTP.") };
    }
  }, [controller]);

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
