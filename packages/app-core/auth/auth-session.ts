import type { LoginSuccessResponse, UserProfileResponse } from "@fittrack/api-client";
import type { AuthUser, Role } from "@fittrack/types";

export const ACCESS_TOKEN_KEY = "fittrack_access_token";
export const REFRESH_TOKEN_KEY = "fittrack_refresh_token";

export type Awaitable<T> = T | Promise<T>;

export type SessionStoreAdapter = {
  getAccessToken: () => Awaitable<string | null>;
  getRefreshToken: () => Awaitable<string | null>;
  setTokens: (tokens: { accessToken: string; refreshToken?: string | null }) => Awaitable<void>;
  clearTokens: () => Awaitable<void>;
};

export type PendingCredentials = {
  email: string;
  password: string;
};

export type RoleGateConfig = {
  allowedRoles: readonly Role[];
  deniedMessage: string;
};

type ApiProfileShape = NonNullable<UserProfileResponse["profile"] | LoginSuccessResponse["user"]["profile"]>;
type ApiMembershipShape = {
  membershipCard?: AuthUser["membershipCard"];
  membership_card?: AuthUser["membershipCard"];
  qrCodeReady?: boolean;
  attendanceQrReady?: boolean;
  qrCodeToken?: string | null;
  qr_code_token?: string | null;
};

function hasVerifiedTimestamp(value?: string | null) {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeRole(role: string | null | undefined): Role | undefined {
  switch (role?.toLowerCase()) {
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

function normalizeMemberProfile(profile: ApiProfileShape | null | undefined) {
  if (!profile) return undefined;

  return {
    activityLevel: profile.activityLevel ?? profile.activity_level ?? null,
    avatarUrl: profile.avatarUrl ?? profile.avatar_url ?? null,
    dateOfBirth: profile.dateOfBirth ?? profile.date_of_birth ?? null,
    fitnessGoal: profile.fitnessGoal ?? profile.fitness_goal ?? null,
    firstName: profile.firstName ?? profile.first_name ?? null,
    gender: profile.gender ?? null,
    currentWeightKg: profile.currentWeightKg ?? profile.weight_kg ?? null,
    heightCm: profile.heightCm ?? profile.height_cm ?? null,
    lastName: profile.lastName ?? profile.last_name ?? null,
    membershipType: profile.membershipType ?? profile.membership_type ?? undefined
  };
}

function buildDisplayName(profile: ReturnType<typeof normalizeMemberProfile>, email?: string) {
  const firstName = profile?.firstName?.trim() ?? "";
  const lastName = profile?.lastName?.trim() ?? "";
  return `${firstName} ${lastName}`.trim() || email;
}

function buildAvatarInitials(name?: string, email?: string) {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return undefined;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0]?.charAt(0) ?? ""}${parts[1]?.charAt(0) ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function resolveMembershipCard(payload: ApiMembershipShape): AuthUser["membershipCard"] {
  const card = payload.membershipCard ?? payload.membership_card ?? null;
  if (!card) return null;
  const rawCard = card as AuthUser["membershipCard"] & {
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
    verifiedAt: rawCard.verifiedAt ?? rawCard.verified_at ?? null,
  };
}

function resolveQrCodeToken(payload: ApiMembershipShape) {
  return payload.qrCodeToken ?? payload.qr_code_token ?? null;
}

function hasQrCodeToken(qrCodeToken: string | null) {
  return typeof qrCodeToken === "string" && qrCodeToken.trim() !== "";
}

function resolveQrCodeReady(payload: ApiMembershipShape, qrCodeToken: string | null) {
  return payload.qrCodeReady ?? hasQrCodeToken(qrCodeToken);
}

function resolveAttendanceQrReady(payload: ApiMembershipShape, qrCodeToken: string | null) {
  const membershipCard = resolveMembershipCard(payload);

  return payload.attendanceQrReady ?? (
    membershipCard?.status === "active" &&
    hasQrCodeToken(qrCodeToken)
  );
}

function resolveMembershipAccess(membershipCard: AuthUser["membershipCard"]): AuthUser["membershipAccess"] {
  return membershipCard?.status === "active" ? "member" : "non-member";
}

function resolveMemberSince(membershipCard: AuthUser["membershipCard"]) {
  if (membershipCard?.status !== "active") return undefined;
  return (
    membershipCard.activatedAt ??
    membershipCard.verifiedAt ??
    membershipCard.purchasedAt ??
    undefined
  );
}

export function getRoleGateDeniedMessage(roleGate?: RoleGateConfig) {
  return roleGate?.deniedMessage ?? "This account can't access this portal.";
}

export function isRoleAllowedForGate(role: Role | undefined, roleGate?: RoleGateConfig) {
  if (!roleGate) return true;
  return !!role && roleGate.allowedRoles.includes(role);
}

export function mapProfileToAuthUser(profile: UserProfileResponse, status?: AuthUser["status"]): AuthUser {
  const resolvedRole =
    typeof profile.role === "string"
      ? normalizeRole(profile.role)
      : normalizeRole(profile.role?.name);
  const normalizedProfile = normalizeMemberProfile(profile.profile);
  const name = buildDisplayName(normalizedProfile, profile.email);
  const membershipCard = resolveMembershipCard(profile);
  const qrCodeToken = resolveQrCodeToken(profile);

  return {
    id: profile.id,
    email: profile.email,
    name,
    role: resolvedRole,
    phone_no: profile.phone_no ?? profile.phone ?? null,
    emailVerified: profile.emailVerified ?? hasVerifiedTimestamp(profile.email_verified_at),
    phoneVerified: profile.phoneVerified ?? hasVerifiedTimestamp(profile.phone_verified_at),
    avatarInitials: buildAvatarInitials(name, profile.email),
    avatarUri: normalizedProfile?.avatarUrl ?? undefined,
    activityLevel: normalizedProfile?.activityLevel ?? undefined,
    dateOfBirth: normalizedProfile?.dateOfBirth ?? undefined,
    fitnessGoal: normalizedProfile?.fitnessGoal ?? undefined,
    gender: normalizedProfile?.gender ?? undefined,
    heightCm: normalizedProfile?.heightCm ?? undefined,
    membershipAccess: resolveMembershipAccess(membershipCard),
    membershipCard,
    memberSince: resolveMemberSince(membershipCard),
    profile: normalizedProfile,
    qrCodeReady: resolveQrCodeReady(profile, qrCodeToken),
    attendanceQrReady: resolveAttendanceQrReady(profile, qrCodeToken),
    qrCodeToken,
    weightKg: normalizedProfile?.currentWeightKg ?? undefined,
    ...(status ? { status } : {})
  };
}

export function mapLoginSuccessUser(
  payload: LoginSuccessResponse,
  fallbackEmail?: string
): AuthUser {
  const email = payload.user.email ?? fallbackEmail ?? "";
  const normalizedProfile = normalizeMemberProfile(payload.user.profile);
  const name = buildDisplayName(normalizedProfile, email);
  const membershipCard = resolveMembershipCard(payload.user);
  const qrCodeToken = resolveQrCodeToken(payload.user);

  return {
    id: payload.user.id,
    email,
    name,
    role: normalizeRole(payload.user.role),
    phone_no: payload.user.phone_no ?? payload.user.phone ?? null,
    emailVerified:
      payload.user.emailVerified ?? hasVerifiedTimestamp(payload.user.email_verified_at),
    phoneVerified:
      payload.user.phoneVerified ?? hasVerifiedTimestamp(payload.user.phone_verified_at),
    avatarInitials: buildAvatarInitials(name, email),
    avatarUri: normalizedProfile?.avatarUrl ?? undefined,
    activityLevel: normalizedProfile?.activityLevel ?? undefined,
    dateOfBirth: normalizedProfile?.dateOfBirth ?? undefined,
    fitnessGoal: normalizedProfile?.fitnessGoal ?? undefined,
    gender: normalizedProfile?.gender ?? undefined,
    heightCm: normalizedProfile?.heightCm ?? undefined,
    membershipAccess: resolveMembershipAccess(membershipCard),
    membershipCard,
    memberSince: resolveMemberSince(membershipCard),
    profile: normalizedProfile,
    qrCodeReady: resolveQrCodeReady(payload.user, qrCodeToken),
    attendanceQrReady: resolveAttendanceQrReady(payload.user, qrCodeToken),
    qrCodeToken,
    weightKg: normalizedProfile?.currentWeightKg ?? undefined
  };
}

export function resolveAccountStatus(deletedAt?: string | null, requestStatus?: string | null): AuthUser["status"] {
  if (deletedAt) return "expired";
  const normalized = requestStatus?.toLowerCase() ?? "";
  if (normalized === "pending") return "frozen";
  return "active";
}

export function createPendingAuthSession() {
  let pendingUser: AuthUser | null = null;
  let pendingEmail: string | null = null;
  let pendingCredentials: PendingCredentials | null = null;

  return {
    getPendingUser() {
      return pendingUser;
    },
    getPendingEmail() {
      return pendingEmail;
    },
    getPendingCredentials() {
      return pendingCredentials;
    },
    setPendingUser(user: AuthUser | null) {
      pendingUser = user;
    },
    setPendingEmail(email: string | null) {
      pendingEmail = email;
    },
    setPendingCredentials(credentials: PendingCredentials | null) {
      pendingCredentials = credentials;
    },
    clearCredentials() {
      pendingCredentials = null;
    },
    clearUser() {
      pendingUser = null;
    },
    clear() {
      pendingUser = null;
      pendingEmail = null;
      pendingCredentials = null;
    }
  };
}
