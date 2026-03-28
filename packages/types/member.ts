import type { Role } from "./base";

export interface MemberProfile {
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  currentWeightKg?: number | null;
  heightCm?: number | null;
  membershipType?: string;
}

export interface RoleReference {
  id: number;
  name: Role;
}

export interface MemberRecord {
  id: string;
  email: string;
  phone_no?: string | null;
  roleId?: number;
  role?: RoleReference;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  profile?: MemberProfile | null;
}

export type CreateStaffInput = {
  email: string;
  password: string;
  phone_no?: string;
  firstName?: string;
  lastName?: string;
};

export interface IMemberContext {
  members: MemberRecord[];
  isLoading: boolean;
  error: string | null;
  fetchMembers: () => Promise<void>;
  createStaff: (data: CreateStaffInput) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
}