import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
  type ReactNode,
} from "react";

import type { AuthUser, LoginFailureReason } from "@fittrack/types";
import { toApiClientError } from "@fittrack/api-client";
import {
  createAuthController,
  resolveAccountStatus,
  toActionErrorMessage,
} from "@fittrack/app-core";
import {
  mobileApiClient,
  mobileSessionStore,
  subscribeMobileAuthFailure,
} from "@/lib/api-client";

type RegisterInput = {
  acceptedTerms: true;
  email: string;
  firstName: string;
  lastName: string;
  legalVersion: string;
  phone?: string;
  password: string;
};

export type RegistrationProblem = {
  status?: number;
  type?: string;
  remainingAttempts?: number;
  retryAfterSeconds?: number;
  lockedUntil?: string;
};

export type RegistrationOperationResult =
  | { success: true }
  | { success: false; error: string; problem?: RegistrationProblem };

export type RegisterResult =
  | { success: true; challengeId: string }
  | { success: false; error: string; problem?: RegistrationProblem };

type LoginResult =
  | { user: AuthUser; needsOTP: boolean }
  | { error: string; reason?: LoginFailureReason };
type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  commitLogin: () => Promise<void>;
  register: (data: RegisterInput) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  deleteUser: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
  sendOTP: (destination: string) => Promise<RegistrationOperationResult>;
  verifyOTP: (
    code: string,
    options?: { persistSession?: boolean },
  ) => Promise<RegistrationOperationResult>;
  clearRegistrationChallenge: () => void;
  verifyCurrentPassword: (password: string) => Promise<boolean>;
  changePassword: (
    currentPassword: string,
    nextPassword: string,
  ) => Promise<{ success: true } | { success: false; error: string }>;
  acceptPrivacyPolicy: () => Promise<{ success: true } | { success: false; error: string }>;
};

type Props = {
  children: ReactNode;
  onUserLoaded: (userId: string) => Promise<void>;
  onUserCleared: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);
const MOBILE_ROLE_GATE = {
  allowedRoles: ["USER", "COACH"] as const,
  deniedMessage: "This account can't access the mobile app.",
};

function getProblemRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function getProblemNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getProblemString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getRegistrationFailure(error: unknown, fallback: string) {
  const apiError = toApiClientError(error, fallback);
  const details = getProblemRecord(apiError.details);

  return {
    error: apiError.message,
    problem: {
      status: apiError.status ?? getProblemNumber(details, "status"),
      type: getProblemString(details, "type"),
      remainingAttempts: getProblemNumber(details, "remaining_attempts"),
      retryAfterSeconds: getProblemNumber(details, "retry_after_seconds"),
      lockedUntil: getProblemString(details, "locked_until"),
    } satisfies RegistrationProblem,
  };
}

function isTerminalRegistrationProblem(type?: string) {
  return (
    type === "REGISTRATION_CHALLENGE_EXPIRED" ||
    type === "REGISTRATION_CHALLENGE_COMPLETED" ||
    type === "REGISTRATION_UNAVAILABLE"
  );
}

export function AuthProvider({ children, onUserLoaded, onUserCleared }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [registrationChallengeId, setRegistrationChallengeId] = useState<string | null>(null);
  const controller = useMemo(
    () =>
      createAuthController({
        client: mobileApiClient,
        onUserLoaded,
        onUserCleared,
        roleGate: MOBILE_ROLE_GATE,
        sessionStore: mobileSessionStore,
      }),
    [onUserCleared, onUserLoaded],
  );
  const isAuthenticated = !!user;

  const hydrateMemberDeletionStatus = useCallback(
    async (nextUser: AuthUser | null): Promise<AuthUser | null> => {
      if (!nextUser) return nextUser;
      if (nextUser.role !== "USER") {
        return nextUser.status
          ? nextUser
          : { ...nextUser, status: "active" as AuthUser["status"] };
      }
      try {
        const request = await mobileApiClient.users.getDeletionRequestStatus();
        return {
          ...nextUser,
          status: resolveAccountStatus(null, request.status ?? null),
        };
      } catch {
        return {
          ...nextUser,
          status: nextUser.status ?? ("active" as AuthUser["status"]),
        };
      }
    },
    [],
  );

  useEffect(
    () =>
      subscribeMobileAuthFailure(() => {
        onUserCleared();
        setUser(null);
        setIsLoading(false);
      }),
    [onUserCleared],
  );

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
        const data = await controller.login(email, password, {
          placeholderRole: "USER",
        });
        if (!data.success || !data.user) {
          return {
            error: data.error ?? "Invalid credentials.",
            reason: data.reason,
          };
        }
        return { user: data.user, needsOTP: data.otpRequired };
      } catch (error: unknown) {
        return { error: toActionErrorMessage(error, "Invalid credentials.") };
      }
    },
    [controller],
  );

  const commitLogin = useCallback(async () => {
    const nextUser = await controller.commitLogin();
    if (nextUser === undefined) return;
    setUser(await hydrateMemberDeletionStatus(nextUser));
  }, [controller, hydrateMemberDeletionStatus]);

  const register = useCallback(
    async (data: RegisterInput): Promise<RegisterResult> => {
      setRegistrationChallengeId(null);
      try {
        const response = await mobileApiClient.auth.register({
          accepted_terms: data.acceptedTerms,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          legal_version: data.legalVersion,
          password: data.password,
          phone: data.phone || undefined,
        });
        const challengeId = response.user_id?.trim();
        if (!challengeId) {
          return {
            success: false,
            error: "Could not start registration verification.",
          };
        }
        setRegistrationChallengeId(challengeId);
        return { success: true, challengeId };
      } catch (error: unknown) {
        const failure = getRegistrationFailure(
          error,
          "Could not create account. Please try again.",
        );
        return {
          success: false,
          ...failure,
        };
      }
    },
    [],
  );

  const clearRegistrationChallenge = useCallback(() => {
    setRegistrationChallengeId(null);
  }, []);

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

  const acceptPrivacyPolicy = useCallback(async () => {
    try {
      const result = await mobileApiClient.users.acceptPrivacyPolicy();
      await updateUser({
        hasAcceptedPrivacy: result.hasAcceptedPrivacy,
        privacyAcceptedAt: result.privacyAcceptedAt ?? null,
      });
      return { success: true as const };
    } catch (error: unknown) {
      return {
        success: false as const,
        error: toActionErrorMessage(
          error,
          "Could not save privacy policy acceptance.",
        ),
      };
    }
  }, [updateUser]);

  const sendOTP = useCallback(
    async (_destination: string): Promise<RegistrationOperationResult> => {
      if (registrationChallengeId) {
        try {
          await mobileApiClient.auth.resendOtp({
            user_id: registrationChallengeId,
          });
          return { success: true };
        } catch (error: unknown) {
          return {
            success: false,
            ...getRegistrationFailure(
              error,
              "Could not resend the verification code.",
            ),
          };
        }
      }

      try {
        const success = await controller.sendOTP();
        return success
          ? { success: true }
          : { success: false, error: "Could not resend the verification code." };
      } catch (error: unknown) {
        return {
          success: false,
          ...getRegistrationFailure(
            error,
            "Could not resend the verification code.",
          ),
        };
      }
    },
    [controller, registrationChallengeId],
  );

  const verifyCurrentPassword = useCallback(
    async (password: string) => {
      try {
        return await controller.verifyCurrentPassword(password);
      } catch {
        return false;
      }
    },
    [controller],
  );

  const changePassword = useCallback(
    async (
      _currentPassword: string,
      nextPassword: string,
    ): Promise<{ success: true } | { success: false; error: string }> => {
      try {
        if (!user?.id) return { success: false, error: "No user session." };
        await controller.changePassword(_currentPassword, nextPassword);
        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error: toActionErrorMessage(error, "Password change failed."),
        };
      }
    },
    [controller, user?.id],
  );

  const verifyOTP = useCallback(
    async (
      code: string,
      options?: { persistSession?: boolean },
    ): Promise<RegistrationOperationResult> => {
      if (registrationChallengeId) {
        const challengeId = registrationChallengeId;
        try {
          await mobileApiClient.auth.verifyEmail({
            user_id: challengeId,
            code,
          });
          if (options?.persistSession === false) {
            await mobileSessionStore.clearTokens();
          }
          setRegistrationChallengeId(null);
          return { success: true };
        } catch (error: unknown) {
          const failure = getRegistrationFailure(error, "Invalid OTP.");
          if (isTerminalRegistrationProblem(failure.problem.type)) {
            setRegistrationChallengeId(null);
          }
          return {
            success: false,
            ...failure,
          };
        }
      }

      try {
        const result = await controller.verifyOTP(code, options);
        if (!result.success && result.error === "No pending session.") {
          return { success: false, error: "No pending email." };
        }
        return result.success
          ? { success: true }
          : { success: false, error: result.error ?? "Invalid OTP." };
      } catch (error: unknown) {
        return {
          success: false,
          ...getRegistrationFailure(error, "Invalid OTP."),
        };
      }
    },
    [controller, registrationChallengeId],
  );

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
        clearRegistrationChallenge,
        verifyCurrentPassword,
        changePassword,
        acceptPrivacyPolicy,
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
