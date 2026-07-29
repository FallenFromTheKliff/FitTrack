import type { MemberTier, Role } from "./base";
import type { MemberProfile, MembershipCardRecord } from "./member";

export interface AuthUser {
  id: string;
  name?: string;
  email: string;
  status?: "active" | "frozen" | "expired";
  phone_no?: string | null;
  role?: Role;
  emailVerified?: boolean;
  hasAcceptedPrivacy?: boolean;
  phoneVerified?: boolean;
  tier?: MemberTier;
  memberSince?: string;
  avatarInitials?: string;
  avatarUri?: string;
  weightKg?: number;
  heightCm?: number;
  currentCalories?: number;
  dateOfBirth?: string;
  gender?: string;
  activityLevel?: string;
  fitnessGoal?: string;
  membershipAccess?: "member" | "non-member";
  membershipCard?: MembershipCardRecord | null;
  profile?: MemberProfile;
  qrCodeReady?: boolean;
  attendanceQrReady?: boolean;
  qrCodeToken?: string | null;
  privacyAcceptedAt?: string | null;
}

export interface User extends AuthUser {
  status: "active" | "frozen" | "expired";
  lastCheckIn?: string;
}

export type LoginFailureReason = "PORTAL_ROLE_MISMATCH" | "ACCOUNT_LOCKED";
export type LoginPortal = "team" | "member";

export interface IAuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    options?: { portal?: LoginPortal },
  ) => Promise<{
    success: boolean;
    otpRequired?: boolean;
    error?: string;
    reason?: LoginFailureReason;
    user?: AuthUser;
  }>;
  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
    acceptedTerms: true;
    legalVersion: string;
  }) => Promise<{ success: boolean; userId?: string; error?: string }>;
  logout: () => void | Promise<void>;
  deleteUser?: () => void | Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
  sendOTP: (destination: string) => Promise<{ success: boolean }>;
  verifyOTP: (code: string) => Promise<{ success: boolean; error?: string }>;
  verifyCurrentPassword?: (password: string) => Promise<boolean>;
  changePassword?: (
    currentPassword: string,
    nextPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
  acceptPrivacyPolicy?: () => Promise<{ success: boolean; error?: string }>;
  commitLogin: () => Promise<AuthUser | null | undefined>;
}
