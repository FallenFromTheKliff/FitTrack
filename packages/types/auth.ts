import type { MemberTier, Role } from "./base";
import type { MemberProfile } from "./member";

export interface AuthUser {
  id: string;
  name?: string;
  email: string;
  status?: "active" | "frozen" | "expired";
  phone_no?: string | null;
  role?: Role;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  tier?: MemberTier;
  memberSince?: string;
  avatarInitials?: string;
  avatarUri?: string;
  weightKg?: number;
  heightCm?: number;
  currentCalories?: number;
  dateOfBirth?: string;
  profile?: MemberProfile;
}

export interface User extends AuthUser {
  status: "active" | "frozen" | "expired";
  lastCheckIn?: string;
}

export interface IAuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; otpRequired?: boolean; error?: string }>;
  register: (data: {
    email: string;
    phone_no?: string;
    password: string;
  }) => Promise<{ success: boolean; userId?: string; error?: string }>;
  logout: () => void | Promise<void>;
  deleteUser?: () => void | Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
  sendOTP: (destination: string) => Promise<{ success: boolean }>;
  verifyOTP: (code: string) => Promise<{ success: boolean; error?: string }>;
  verifyCurrentPassword?: (password: string) => Promise<boolean>;
  changePassword?: (currentPassword: string, nextPassword: string) => Promise<{ success: boolean; error?: string }>;
  commitLogin: () => Promise<void>;
}