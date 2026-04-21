import { useState, useEffect, useCallback, useMemo, createContext, useContext, type ReactNode } from "react";

import type { AuthUser } from "@fittrack/types";
import { createAuthController, resolveAccountStatus, toActionErrorMessage } from "@fittrack/app-core";
import { mobileApiClient, mobileSessionStore, subscribeMobileAuthFailure } from "@/lib/api-client";

type RegisterInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  password: string;
};
type LoginResult =
  | { user: AuthUser; needsOTP: boolean }
  | { error: string };
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
const MOBILE_ROLE_GATE = {
  allowedRoles: ["USER", "COACH"] as const,
  deniedMessage: "This account can't access the mobile app."
};

export function AuthProvider({ children, onUserLoaded, onUserCleared }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const controller = useMemo(() => createAuthController({
    client: mobileApiClient,
    onUserLoaded,
    onUserCleared,
    roleGate: MOBILE_ROLE_GATE,
    sessionStore: mobileSessionStore
  }), [onUserCleared, onUserLoaded]);
  const isAuthenticated = !!user;

  const hydrateMemberDeletionStatus = useCallback(async (nextUser: AuthUser | null): Promise<AuthUser | null> => {
    if (!nextUser) return nextUser;
    if (nextUser.role !== "USER") {
      return nextUser.status ? nextUser : { ...nextUser, status: "active" as AuthUser["status"] };
    }
    try {
      const request = await mobileApiClient.users.getDeletionRequestStatus();
      return {
        ...nextUser,
        status: resolveAccountStatus(null, request.status ?? null)
      };
    } catch {
      return {
        ...nextUser,
        status: nextUser.status ?? ("active" as AuthUser["status"])
      };
    }
  }, []);

  useEffect(() => subscribeMobileAuthFailure(() => {
    onUserCleared();
    setUser(null);
    setIsLoading(false);
  }), [onUserCleared]);

  useEffect(() => {
    (async () => {
      try {
        const nextUser = await controller.loadCurrentUser();
        setUser(await hydrateMemberDeletionStatus(nextUser));
      } catch {
        await mobileSessionStore.clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [controller, hydrateMemberDeletionStatus]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const data = await controller.login(email, password, { placeholderRole: "USER" });
        if (!data.success || !data.user) {
          return { error: data.error ?? "Invalid credentials." };
        }
        return { user: data.user, needsOTP: data.otpRequired };
      } catch (error: unknown) {
        return { error: toActionErrorMessage(error, "Invalid credentials.") };
      }
    }, [controller]
  );

  const commitLogin = useCallback(async () => {
    const nextUser = await controller.commitLogin();
    if (nextUser === undefined) return;
    setUser(await hydrateMemberDeletionStatus(nextUser));
  }, [controller, hydrateMemberDeletionStatus]);

  const register = useCallback(
    async (data: RegisterInput): Promise<AuthUser | undefined> => {
      try {
        const res = await controller.register({
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          password: data.password,
          phone: data.phone || undefined
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
    try {
      const success = await controller.sendOTP();
      return { success };
    } catch {
      return { success: false as const };
    }
  }, [controller]);

  const verifyCurrentPassword = useCallback(async (password: string) => {
    try {
      return await controller.verifyCurrentPassword(password);
    } catch {
      return false;
    }
  }, [controller]);

  const changePassword = useCallback(async (_currentPassword: string, nextPassword: string): Promise<{ success: true } | { success: false; error: string }> => {
    try {
      if (!user?.id) return { success: false, error: "No user session." };
      await controller.changePassword(_currentPassword, nextPassword);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: toActionErrorMessage(error, "Password change failed.") };
    }
  }, [controller, user?.id]);

  const verifyOTP = useCallback(async (code: string) => {
    try {
      const result = await controller.verifyOTP(code);
      if (!result.success && result.error === "No pending session.") {
        return { success: false as const, error: "No pending email." };
      }
      return result;
    } catch (error: unknown) {
      return { success: false as const, error: toActionErrorMessage(error, "Invalid OTP.") };
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
