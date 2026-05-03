import type { Role } from "./base";

export interface MemberProfile {
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  activityLevel?: string | null;
  fitnessGoal?: string | null;
  currentWeightKg?: number | null;
  heightCm?: number | null;
  membershipType?: string | null;
  avatarUrl?: string | null;
}

export interface RoleReference {
  id: number;
  name: Role;
}

export type MembershipCardStatus =
  | "none"
  | "pending_verification"
  | "active"
  | "revoked";

export type MembershipCardSource =
  | "cash"
  | "paymongo"
  | "admin_grant"
  | "admin_repair";

export type MemberAccountStatus = "pending" | "active" | "suspended" | "banned";

export interface MembershipCardRecord {
  activatedAt?: string | null;
  purchasedAt?: string | null;
  revokeReason?: string | null;
  revokedAt?: string | null;
  source?: MembershipCardSource | null;
  status: MembershipCardStatus;
  updatedAt?: string | null;
  verifiedAt?: string | null;
}

export interface MemberRecord {
  id: string;
  email: string;
  phone_no?: string | null;
  status?: MemberAccountStatus | null;
  lastCheckInAt?: string | null;
  membershipCard?: MembershipCardRecord | null;
  roleId?: number;
  role?: RoleReference;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  qrCodeReady?: boolean;
  attendanceQrReady?: boolean;
  deletedAt?: string | null;
  restoredAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  profile?: MemberProfile | null;
}

export type CreateUserRole = "admin" | "staff" | "member";

export type CreateUserInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: CreateUserRole;
  phone_no?: string;
};

export type UpdateMemberInput = {
  id: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  activityLevel?: string;
  fitnessGoal?: string;
  currentWeightKg?: number;
  heightCm?: number;
};

export type UpdateMembershipCardInput = {
  action: "grant" | "revoke";
  id: string;
  reason?: string;
  source?: Extract<MembershipCardSource, "admin_grant" | "admin_repair">;
};

export interface AttendanceQrCodeRecord {
  ready: boolean;
  qrValue: string | null;
  expiresAt: string | null;
  refreshAvailableAt: string | null;
  reason: string | null;
}

export type ScanAttendanceQrInput = {
  qrValue: string;
};

export type ManualAttendanceCheckInInput = {
  userId: string;
};

export interface RestoreUserResult {
  message: string;
  user: {
    id: string;
    deletedAt: string | null;
    restoredAt?: string | null;
  };
}

export interface AttendanceCheckInRecord {
  attendance_id: string;
  check_in_at: string;
  member_name: string;
}

export interface IMemberContext {
  members: MemberRecord[];
  isLoading: boolean;
  error: string | null;
  fetchMembers: () => Promise<void>;
  createUser: (data: CreateUserInput) => Promise<{ success: boolean; error?: string }>;
  updateMember: (data: UpdateMemberInput) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  restoreUser: (id: string) => Promise<{ success: boolean; error?: string }>;
}
