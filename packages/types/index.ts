export type Role = "ADMIN" | "STAFF" | "USER" | "COACH";
export type ThemeKey = "night" | "sunlight" | "dark" | "light" | "navy";
export type FontKey = "standard" | "retro" | "painter";
export type AnimationLevel = "full" | "minimal" | "none";
export type SlotStatus = "available" | "full" | "waitlist";
export type BookingStatus = "confirmed" | "waitlisted" | "cancelled";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type EquipmentStatus = "available" | "maintenance" | "occupied";
export type MemberTier = "Basic" | "Premium" | "Elite";

export type ThemeColors = {
  brand: string;
  onBrand: string;
  brandLight: string;
  base: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  fieldBg: string;
  fieldBorder: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
}
export interface ThemeSettings {
  themeKey: ThemeKey;
  fontKey: FontKey;
  animationLevel: AnimationLevel;
}

export interface User extends AuthUser {
  status: "active" | "frozen" | "expired";
  lastCheckIn?: string;
}
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
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    currentWeightKg?: number | null;
    heightCm?: number | null;
    membershipType?: string;
  };
}

export interface Booking {
  id: string;
  memberId?: string;
  resourceId?: string;
  resourceName: string;
  resourceType: "venue" | "amenity" | "trainer";
  date: string;
  time: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  status: BookingStatus;
  price: number;
  trainerId?: string;
  trainerName?: string;
}

export interface CreateBookingDTO {
  resourceName: string;
  resourceType: Booking["resourceType"];
  date: string;
  time: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  price: number;
  trainerId?: string;
  trainerName?: string;
}

export interface Trainer {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  pricePerSession: number;
  avatarInitials: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  status: StockStatus;
  price: number;
}

export interface EquipmentItem {
  id: string;
  type: string;
  label: string;
  zone: "cardio" | "strength" | "functional";
  status: EquipmentStatus;
  gridX: number;
  gridY: number;
  rotation: number;
}

export interface Notification {
  id: string;
  type: "booking" | "badge" | "membership" | "system";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
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

export interface MemberRecord {
  id: string;
  email: string;
  phone_no?: string | null;
  roleId?: number;
  role?: { id: number; name: string };
  emailVerified?: boolean;
  phoneVerified?: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    currentWeightKg?: number | null;
    heightCm?: number | null;
    membershipType?: string;
  } | null;
}

export type CreateStaffInput = {
  email: string;
  password: string;
  phone_no?: string;
  firstName?: string;
  lastName?: string;
}

export interface IMemberContext {
  members: MemberRecord[];
  isLoading: boolean;
  error: string | null;
  fetchMembers: () => Promise<void>;
  createStaff: (data: CreateStaffInput) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
}
export interface IThemeContext {
  colors: ThemeColors;
  activeFont: FontKey;
  activeThemeKey: ThemeKey;
  prevThemeKey: ThemeKey;
  activeFontColor: string | null;
  activeIconColor: string | null;
  settings: ThemeSettings;
  loadUserSettings: (userId: string) => Promise<void>;
  clearUserSettings: () => void;
  setTheme: (key: ThemeKey) => void;
  setFont: (key: FontKey) => void;
  setAppearance: (themeKey: ThemeKey, fontKey: FontKey) => void;
  resetAppearance: () => void;
  setAnimationLevel: (level: AnimationLevel) => void;
  saveAllAppearance: (themeKey: ThemeKey, fontKey: FontKey, animationLevel: AnimationLevel) => void;
  previewTheme: (key: ThemeKey | null) => void;
  previewFont: (key: FontKey | null) => void;
}

export interface StorageAdapter {
  get: (key: string) => Promise<string | null>;
  set: (key: string, val: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
}
