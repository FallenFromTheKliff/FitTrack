import type {
  AttendanceQrCodeRecord,
  MemberProfile,
  MembershipCardRecord,
  Role,
} from "@fittrack/types";
import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapResponse, unwrapVoidResponse } from "../request";

export type UserProfileResponse = {
  deletedAt?: string | null;
  email: string;
  email_verified_at?: string | null;
  emailVerified?: boolean;
  id: string;
  membership_card?: MembershipCardRecord | null;
  membershipCard?: MembershipCardRecord | null;
  phone?: string | null;
  phone_verified_at?: string | null;
  phoneVerified?: boolean;
  phone_no?: string | null;
  profile?: (MemberProfile & {
    activity_level?: string | null;
    avatar_url?: string | null;
    date_of_birth?: string | null;
    fitness_goal?: string | null;
    first_name?: string | null;
    height_cm?: number | null;
    last_name?: string | null;
    membership_type?: string | null;
    phone?: string | null;
    weight_kg?: number | null;
  }) | null;
  role?: {
    id?: number;
    name?: Role;
  } | Role | string | null;
  qr_code_token?: string | null;
  qrCodeReady?: boolean;
  attendanceQrReady?: boolean;
  qrCodeToken?: string | null;
  status?: string | null;
};

export type UpdateUserProfilePayload = {
  activityLevel?: string;
  avatarUrl?: string;
  currentWeightKg?: number;
  dateOfBirth?: string;
  firstName?: string;
  fitnessGoal?: string;
  gender?: string;
  heightCm?: number;
  lastName?: string;
};

export type UpdateUserPhonePayload = {
  phone_number: string;
};

export type UploadUserAvatarResponse = {
  avatar_url: string;
};

export type AttendanceQrCodeResponse = AttendanceQrCodeRecord;

type RawUserProfile = NonNullable<UserProfileResponse["profile"]>;

function normalizeMembershipCard(
  card: MembershipCardRecord | null | undefined
): MembershipCardRecord | null {
  if (!card) return null;
  const rawCard = card as MembershipCardRecord & {
    activated_at?: string | null;
    purchased_at?: string | null;
    revoke_reason?: string | null;
    revoked_at?: string | null;
    updated_at?: string | null;
    verified_at?: string | null;
  };

  return {
    activatedAt: rawCard.activatedAt ?? rawCard.activated_at ?? null,
    purchasedAt: rawCard.purchasedAt ?? rawCard.purchased_at ?? null,
    revokeReason: rawCard.revokeReason ?? rawCard.revoke_reason ?? null,
    revokedAt: rawCard.revokedAt ?? rawCard.revoked_at ?? null,
    source: rawCard.source ?? null,
    status: rawCard.status,
    updatedAt: rawCard.updatedAt ?? rawCard.updated_at ?? null,
    verifiedAt: rawCard.verifiedAt ?? rawCard.verified_at ?? null
  };
}

function hasVerifiedTimestamp(value?: string | null) {
  return typeof value === "string" && value.trim() !== "";
}

function hasQrCodeToken(value?: string | null) {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeRole(value: Role | string | null | undefined): Role | undefined {
  switch (value?.toLowerCase()) {
    case "admin":
      return "ADMIN";
    case "staff":
      return "STAFF";
    case "coach":
      return "COACH";
    case "member":
    case "user":
      return "USER";
    default:
      return undefined;
  }
}

function normalizeProfile(profile: UserProfileResponse["profile"]): RawUserProfile | null | undefined {
  if (!profile) return profile;

  return {
    ...profile,
    currentWeightKg: profile.currentWeightKg ?? profile.weight_kg ?? null,
    dateOfBirth: profile.dateOfBirth ?? profile.date_of_birth ?? null,
    firstName: profile.firstName ?? profile.first_name ?? null,
    activityLevel: profile.activityLevel ?? profile.activity_level ?? null,
    avatarUrl: profile.avatarUrl ?? profile.avatar_url ?? null,
    fitnessGoal: profile.fitnessGoal ?? profile.fitness_goal ?? null,
    heightCm: profile.heightCm ?? profile.height_cm ?? null,
    lastName: profile.lastName ?? profile.last_name ?? null,
    membershipType: profile.membershipType ?? profile.membership_type ?? undefined
  };
}

function normalizeUserProfileResponse(profile: UserProfileResponse): UserProfileResponse {
  const normalizedRole =
    typeof profile.role === "string"
      ? normalizeRole(profile.role) ?? profile.role
      : profile.role
        ? {
            ...profile.role,
            ...(profile.role.name ? { name: normalizeRole(profile.role.name) ?? profile.role.name } : {})
          }
        : profile.role;
  const membershipCard = normalizeMembershipCard(
    profile.membershipCard ?? profile.membership_card ?? null
  );
  const qrCodeToken = profile.qrCodeToken ?? profile.qr_code_token ?? null;

  return {
    ...profile,
    emailVerified: profile.emailVerified ?? hasVerifiedTimestamp(profile.email_verified_at),
    membershipCard,
    phoneVerified: profile.phoneVerified ?? hasVerifiedTimestamp(profile.phone_verified_at),
    phone_no: profile.phone_no ?? profile.phone ?? null,
    profile: normalizeProfile(profile.profile),
    qrCodeReady: profile.qrCodeReady ?? hasQrCodeToken(qrCodeToken),
    attendanceQrReady: profile.attendanceQrReady ?? (
      membershipCard?.status === "active" &&
      hasQrCodeToken(qrCodeToken)
    ),
    qrCodeToken,
    role: normalizedRole
  };
}

function toProfileUpdateRequest(payload: UpdateUserProfilePayload) {
  return {
    ...(payload.firstName !== undefined ? { first_name: payload.firstName } : {}),
    ...(payload.lastName !== undefined ? { last_name: payload.lastName } : {}),
    ...(payload.avatarUrl !== undefined ? { avatar_url: payload.avatarUrl } : {}),
    ...(payload.dateOfBirth !== undefined ? { date_of_birth: payload.dateOfBirth } : {}),
    ...(payload.gender !== undefined ? { gender: payload.gender } : {}),
    ...(payload.currentWeightKg !== undefined ? { weight_kg: payload.currentWeightKg } : {}),
    ...(payload.heightCm !== undefined ? { height_cm: payload.heightCm } : {}),
    ...(payload.activityLevel !== undefined ? { activity_level: payload.activityLevel } : {}),
    ...(payload.fitnessGoal !== undefined ? { fitness_goal: payload.fitnessGoal } : {})
  };
}

export function createUsersApi(transport: ApiTransport) {
  return {
    getProfile() {
      return unwrapResponse<UserProfileResponse>(transport.get("/users/me"), "Unable to load profile.")
        .then(normalizeUserProfileResponse);
    },
    getDeletionRequestStatus() {
      return unwrapResponse<{ status?: string | null }>(
        transport.get("/users/deletion-request"),
        "Unable to load deletion request status."
      );
    },
    getAttendanceQr() {
      return unwrapResponse<AttendanceQrCodeResponse>(
        transport.get("/users/me/attendance-qr"),
        "Unable to load attendance QR."
      );
    },
    refreshQr() {
      return unwrapResponse<AttendanceQrCodeResponse>(
        transport.post("/users/me/refresh-qr", {}),
        "Unable to refresh attendance QR."
      );
    },
    updateProfile(payload: UpdateUserProfilePayload) {
      return unwrapVoidResponse(
        transport.patch("/users/me", toProfileUpdateRequest(payload)),
        "Unable to update profile."
      );
    },
    updatePhone(payload: UpdateUserPhonePayload) {
      return unwrapVoidResponse(
        transport.patch("/users/me/phone", payload),
        "Unable to update phone number."
      );
    },
    uploadAvatar(payload: FormData) {
      return unwrapResponse<UploadUserAvatarResponse>(
        transport.patch("/users/me/avatar", payload),
        "Unable to update avatar."
      );
    },
    requestDeletion(reason?: string) {
      return unwrapVoidResponse(
        transport.post("/users/request-deletion", reason ? { reason } : {}),
        "Unable to request account deletion."
      );
    },
    cancelDeletionRequest() {
      return unwrapVoidResponse(
        transport.delete("/users/deletion-request"),
        "Unable to cancel deletion request."
      );
    }
  };
}
