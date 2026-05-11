import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import {
  STATUS_COLORS,
  type DeletionRequest,
  type MemberStatusTab,
} from "@/data/members/members";
import { WEB_API_BASE_URL } from "@/lib/api-client";
import type { MemberRecord } from "@fittrack/types";
import { buildRenderableAssetUrl, fullName } from "@fittrack/utils";

export const MIN_ACTION_DELAY_MS = FEEDBACK_DURATION_MS.standard;
export type ContentMode = "directory" | "create";
export type DirectoryViewMode = "list" | "grid";

export const LIST_ROWS_PER_PAGE = 10;
export const GRID_ROWS_PER_PAGE = 8;
export const EDIT_MEMBER_EDITABLE_KEYS = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "gender",
  "activityLevel",
  "fitnessGoal",
  "currentWeightKg",
  "heightCm",
] as const;

export function formatDateForInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function normalizeDraftValue(value?: string) {
  return (value ?? "").trim();
}

export function parseOptionalNumber(value?: string) {
  const trimmed = normalizeDraftValue(value);
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function validateEditDraft(data: Record<string, string>) {
  const errors: Record<string, string> = {};
  const firstName = normalizeDraftValue(data.firstName);
  const lastName = normalizeDraftValue(data.lastName);
  const dateOfBirth = normalizeDraftValue(data.dateOfBirth);
  const currentWeightKg = normalizeDraftValue(data.currentWeightKg);
  const heightCm = normalizeDraftValue(data.heightCm);

  if (!firstName) errors.firstName = "First name is required";
  else if (firstName.length < 2)
    errors.firstName = "First name must be at least 2 characters";

  if (!lastName) errors.lastName = "Last name is required";
  else if (lastName.length < 2)
    errors.lastName = "Last name must be at least 2 characters";

  if (dateOfBirth) {
    const date = new Date(`${dateOfBirth}T00:00:00`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
      Number.isNaN(date.getTime())
    ) {
      errors.dateOfBirth = "Date of birth must use YYYY-MM-DD";
    } else if (date > new Date()) {
      errors.dateOfBirth = "Date of birth cannot be in the future";
    }
  }

  if (currentWeightKg) {
    const weight = Number(currentWeightKg);
    if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
      errors.currentWeightKg = "Weight must be between 30 and 300 kg";
    }
  }

  if (heightCm) {
    const height = Number(heightCm);
    if (!Number.isFinite(height) || height < 100 || height > 250) {
      errors.heightCm = "Height must be between 100 and 250 cm";
    }
  }

  return errors;
}

export function getMemberAvatarUrl(member: MemberRecord) {
  return buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: member.profile?.avatarUrl?.trim(),
  });
}

export function getMembershipFieldValue(member: MemberRecord | null) {
  if (!member || member.role?.name !== "USER") return "not_applicable";
  return member.membershipCard?.status ?? "none";
}

export function formatMembershipStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatReviewPayableLabel(value?: string) {
  if (value === "membership_card") return "Membership Card";
  if (value === "subscription") return "Loaded Plan";
  return formatMembershipStatus(value ?? "payment");
}

export function getMembershipPaymentReviewLabel(value?: string) {
  return value === "membership_card"
    ? "membership card payment"
    : "membership payment";
}

export function formatMembershipAccess(
  value: ReturnType<typeof getMembershipFieldValue>,
) {
  switch (value) {
    case "active":
      return "Member";
    case "pending_verification":
      return "Pending verification";
    case "revoked":
      return "Revoked";
    case "none":
      return "Non-member";
    default:
      return "Not Applicable";
  }
}

export function getMembershipAccessLabel(member: MemberRecord | null) {
  return formatMembershipAccess(getMembershipFieldValue(member));
}

export function getDirectoryRoleLabel(roleName?: string | null) {
  switch (roleName) {
    case "ADMIN":
      return "Admin";
    case "STAFF":
      return "Staff";
    case "USER":
      return "Member";
    case "COACH":
      return "Coach";
    default:
      return "Member";
  }
}

export function getScanReadinessLabel(member: MemberRecord) {
  if (member.attendanceQrReady) return "Scan ready";
  if (member.qrCodeReady) return "QR locked";
  return "QR unavailable";
}

export function formatLastCheckIn(value?: string | null) {
  if (!value) return "No attendance yet";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No attendance yet";

  return parsed.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDisplayDate(value?: string | null) {
  if (!value) return "Not provided";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not provided";

  return parsed.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDisplayDateTime(value?: string | null) {
  if (!value) return "Not provided";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not provided";

  return parsed.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDetailValue(value?: string | number | null) {
  if (value == null) return "Not provided";
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : "Not provided";
}

export function getMemberInitials(member: MemberRecord) {
  const source = fullName(member) || member.email || "Member";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function getDirectoryAccessLabel(
  member: MemberRecord,
  pendingRequestsByUserId: Map<string, DeletionRequest>,
) {
  const directoryStatus = getDirectoryMemberStatus(
    member,
    pendingRequestsByUserId,
  );
  const accessLabel = getMembershipAccessLabel(member);
  const roleLabel = getDirectoryRoleLabel(member.role?.name);

  if (directoryStatus === "Archived") return "Archived";
  if (member.role?.name !== "USER") return `${roleLabel} access`;
  if (member.status === "active" && accessLabel === "Non-member") {
    return "Verified Non-Member";
  }

  return accessLabel;
}

export function getDirectoryStatusLabel(
  member: MemberRecord,
  pendingRequestsByUserId: Map<string, DeletionRequest>,
) {
  const status = getDirectoryMemberStatus(member, pendingRequestsByUserId);
  const accessLabel = getMembershipAccessLabel(member);

  if (status === "Termination Requests") return "Termination request";
  if (status === "Archived") return "Archived";
  if (member.status === "pending") return "Pending";
  if (member.status === "suspended") return "Suspended";
  if (member.status === "banned") return "Banned";
  if (
    accessLabel === "Pending verification" ||
    accessLabel === "Revoked"
  )
    return "Pending";

  return "Active";
}

export function getDirectoryStatusColor(
  member: MemberRecord,
  pendingRequestsByUserId: Map<string, DeletionRequest>,
  warningColor: string,
) {
  const statusLabel = getDirectoryStatusLabel(member, pendingRequestsByUserId);
  if (statusLabel === "Termination request")
    return STATUS_COLORS["Termination request"] ?? warningColor;
  if (statusLabel === "Archived") return STATUS_COLORS.Archived ?? warningColor;
  if (statusLabel === "Pending") return warningColor;
  return STATUS_COLORS.Active ?? warningColor;
}

export function getEditDraftValues(
  member: MemberRecord | null,
): Record<string, string> {
  return {
    firstName: member?.profile?.firstName ?? "",
    lastName: member?.profile?.lastName ?? "",
    email: member?.email ?? "",
    phone_no: member?.phone_no ?? "",
    dateOfBirth: formatDateForInput(member?.profile?.dateOfBirth),
    gender: member?.profile?.gender ?? "",
    activityLevel: member?.profile?.activityLevel ?? "",
    fitnessGoal: member?.profile?.fitnessGoal ?? "",
    currentWeightKg:
      member?.profile?.currentWeightKg != null
        ? String(member.profile.currentWeightKg)
        : "",
    heightCm:
      member?.profile?.heightCm != null ? String(member.profile.heightCm) : "",
    membershipAccess: getMembershipFieldValue(member),
  };
}

export function getActionErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error) {
    const maybeError = error as {
      message?: string;
      response?: { data?: { detail?: string; message?: string } };
    };

    return (
      maybeError.response?.data?.detail ??
      maybeError.response?.data?.message ??
      maybeError.message ??
      fallback
    );
  }

  return fallback;
}

export function getPendingRequestsByUserId(deletionRequests: DeletionRequest[]) {
  const map = new Map<string, DeletionRequest>();

  deletionRequests.forEach((request) => {
    const status = request.status?.toLowerCase() ?? "";
    const userId = request.userId ?? request.user?.id ?? "";
    if (!userId || status !== "pending") return;
    map.set(userId, request);
  });

  return map;
}

export function isArchivedMember(
  member: MemberRecord,
  _pendingRequestsByUserId: Map<string, DeletionRequest>
) {
  return Boolean(member.deletedAt);
}

export function getDirectoryMemberStatus(
  member: MemberRecord,
  pendingRequestsByUserId: Map<string, DeletionRequest>
): Exclude<MemberStatusTab, "All"> {
  if (pendingRequestsByUserId.has(member.id)) return "Termination Requests";
  return isArchivedMember(member, pendingRequestsByUserId) ? "Archived" : "Active";
}

export function filterMembers(
  members: MemberRecord[],
  query: string,
  activeChip: string,
  activeStatus: MemberStatusTab,
  pendingRequestsByUserId: Map<string, DeletionRequest>
) {
  return members.filter((member) => {
    const normalizedQuery = query.toLowerCase();
    const name = fullName(member).toLowerCase();
    const matchesSearch =
      name.includes(normalizedQuery) || member.email.toLowerCase().includes(normalizedQuery);
    const role = member.role?.name ?? "USER";
    const matchesStatus =
      activeStatus === "All" ||
      getDirectoryMemberStatus(member, pendingRequestsByUserId) === activeStatus;
    const matchesChip =
      activeStatus === "Termination Requests"
        ? role === "USER"
        : activeChip === "all" ||
          (activeChip === "Admin"
            ? role === "ADMIN"
            : activeChip === "Staff"
              ? role === "STAFF"
              : activeChip === "Member"
                  ? role === "USER"
                  : true);

    return matchesSearch && matchesChip && matchesStatus;
  });
}
