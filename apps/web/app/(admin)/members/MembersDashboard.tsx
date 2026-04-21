"use client";
import { useEffect, useMemo, useState } from "react";
import { Archive, BadgeCheck, ScanLine, ShieldX, Skull, UserPlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminDeletionRequestsQueryOptions,
  approveDeletionRequestMutationOptions,
  manualAttendanceCheckInMutationOptions,
  reviewMembershipPaymentsQueryOptions,
  rejectDeletionRequestMutationOptions,
  scanAttendanceQrMutationOptions,
  staffUsersQueryOptions,
  updateAdminMembershipCardMutationOptions,
  verifyMembershipPaymentMutationOptions
} from "@fittrack/query";
import { themes } from "@fittrack/ui/theme";
import type { AdminCreateUserData } from "@fittrack/validators";

import { useTheme } from "@/contexts/ThemeContext";
import { useMembers } from "@/contexts/MemberContext";
import { useAuth } from "@/contexts/AuthContext";
import { WEB_API_BASE_URL, webApiClient } from "@/lib/api-client";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useDebounce, useLoadingText } from "@fittrack/hooks";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { CONFIRM_COPY } from "@/utils/confirmCopy";
import { buildRenderableAssetUrl, fullName, getReadableTextColor } from "@fittrack/utils";
import {
  ACHIEVEMENT_REVIEW_SEED,
  ACHIEVEMENT_REVIEW_STATUS_COLORS,
  EDIT_MEMBER_FIELDS,
  MEMBER_FILTER_OPTIONS,
  MEMBER_STATUS_TABS,
  MEMBERSHIP_CARD_STATUS_COLORS,
  STATUS_COLORS,
  type AchievementReviewRecord,
  type AchievementReviewStatus,
  type DeletionRequest,
  type MemberStatusTab
} from "@/data/members/members";
import type { AttendanceCheckInRecord, MemberRecord, MembershipCardRecord } from "@fittrack/types";

import { FitButton, FitInlineFilterChips, FitPill, FitSearch, FitSection, FitText } from "@/components/fit";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { ConfirmModal, DetailsModal } from "@/components/modals";
import type { FieldConfig } from "@/components/modals/DetailsModal";
import {
  filterMembers,
  getDirectoryMemberStatus,
  getPendingRequestsByUserId,
  MIN_ACTION_DELAY_MS
} from "./helpers";
import AttendanceScanModal, { type AttendanceScanFeedback } from "./AttendanceScanModal";
import AddUserPanel from "./AddUserPanel";
import MemberInspectorPanel from "./MemberInspectorPanel";
import MembersDirectoryPanel from "./MembersDirectoryPanel";
import MembersRouteShell, { type MembersRouteShellChip, type MembersRouteShellMetric } from "./MembersRouteShell";
import MembersReviewRail from "./MembersReviewRail";

type ContentMode = "directory" | "review" | "create";

const ACHIEVEMENT_REVIEW_FIELDS = [
  {
    name: "reviewerNotes",
    label: "Decision notes",
    type: "textarea",
    placeholder: "Summarize the milestone decision for the member."
  }
] satisfies FieldConfig[];

const ROWS_PER_PAGE = 5;
const PENDING_STATE_COLOR = "#8E84FF";
const EDIT_MEMBER_EDITABLE_KEYS = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "gender",
  "activityLevel",
  "fitnessGoal",
  "currentWeightKg",
  "heightCm",
] as const;

function formatDateForInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function normalizeDraftValue(value?: string) {
  return (value ?? "").trim();
}

function parseOptionalNumber(value?: string) {
  const trimmed = normalizeDraftValue(value);
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function validateEditDraft(data: Record<string, string>) {
  const errors: Record<string, string> = {};
  const firstName = normalizeDraftValue(data.firstName);
  const lastName = normalizeDraftValue(data.lastName);
  const dateOfBirth = normalizeDraftValue(data.dateOfBirth);
  const currentWeightKg = normalizeDraftValue(data.currentWeightKg);
  const heightCm = normalizeDraftValue(data.heightCm);

  if (!firstName) errors.firstName = "First name is required";
  else if (firstName.length < 2) errors.firstName = "First name must be at least 2 characters";

  if (!lastName) errors.lastName = "Last name is required";
  else if (lastName.length < 2) errors.lastName = "Last name must be at least 2 characters";

  if (dateOfBirth) {
    const date = new Date(`${dateOfBirth}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(date.getTime())) {
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

function getMemberAvatarUrl(member: MemberRecord) {
  return buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: member.profile?.avatarUrl?.trim(),
  });
}

function getMembershipFieldValue(member: MemberRecord | null) {
  if (!member || member.role?.name !== "USER") return "not_applicable";
  return member.membershipCard?.status ?? "none";
}

function formatMembershipStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatReviewPayableLabel(value?: string) {
  if (value === "membership_card") return "Membership Card";
  if (value === "subscription") return "Loaded Plan";
  return formatMembershipStatus(value ?? "payment");
}

function getMembershipPaymentReviewLabel(value?: string) {
  return value === "membership_card"
    ? "membership card payment"
    : "membership payment";
}

function formatMembershipAccess(value: ReturnType<typeof getMembershipFieldValue>) {
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

function getMembershipAccessLabel(member: MemberRecord | null) {
  return formatMembershipAccess(getMembershipFieldValue(member));
}

function getDirectoryRoleLabel(roleName?: string | null) {
  switch (roleName) {
    case "ADMIN":
      return "Admin";
    case "STAFF":
      return "Staff";
    case "COACH":
      return "Coach";
    case "USER":
      return "Member";
    default:
      return "Member";
  }
}

function getScanReadinessLabel(member: MemberRecord) {
  if (member.attendanceQrReady) return "Scan ready";
  if (member.qrCodeReady) return "QR locked";
  return "QR unavailable";
}

function formatLastCheckIn(value?: string | null) {
  if (!value) return "No attendance yet";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No attendance yet";

  return parsed.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatPeopleCountLabel(count: number) {
  return count === 1 ? "1 person" : `${count} people`;
}

function getMemberInitials(member: MemberRecord) {
  const source = fullName(member) || member.email || "Member";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function getDirectoryAccessLabel(
  member: MemberRecord,
  pendingRequestsByUserId: Map<string, DeletionRequest>
) {
  const directoryStatus = getDirectoryMemberStatus(member, pendingRequestsByUserId);
  const accessLabel = getMembershipAccessLabel(member);
  const roleLabel = getDirectoryRoleLabel(member.role?.name);

  if (directoryStatus === "Archived") return "Archived";
  if (member.role?.name !== "USER") return `${roleLabel} access`;

  return accessLabel;
}

function getDirectoryStatusLabel(
  member: MemberRecord,
  pendingRequestsByUserId: Map<string, DeletionRequest>
) {
  const status = getDirectoryMemberStatus(member, pendingRequestsByUserId);
  const accessLabel = getMembershipAccessLabel(member);

  if (status === "Archived") return "Archived";
  if (accessLabel === "Pending verification" || accessLabel === "Non-member" || accessLabel === "Revoked") return "Pending";

  return "Active";
}

function getDirectoryStatusColor(
  member: MemberRecord,
  pendingRequestsByUserId: Map<string, DeletionRequest>,
  warningColor: string
) {
  const statusLabel = getDirectoryStatusLabel(member, pendingRequestsByUserId);
  if (statusLabel === "Archived") return STATUS_COLORS.Archived ?? warningColor;
  if (statusLabel === "Pending") return PENDING_STATE_COLOR;
  return STATUS_COLORS.Active ?? warningColor;
}

function getEditDraftValues(member: MemberRecord | null): Record<string, string> {
  return {
    firstName: member?.profile?.firstName ?? "",
    lastName: member?.profile?.lastName ?? "",
    email: member?.email ?? "",
    phone_no: member?.phone_no ?? "",
    dateOfBirth: formatDateForInput(member?.profile?.dateOfBirth),
    gender: member?.profile?.gender ?? "",
    activityLevel: member?.profile?.activityLevel ?? "",
    fitnessGoal: member?.profile?.fitnessGoal ?? "",
    currentWeightKg: member?.profile?.currentWeightKg != null ? String(member.profile.currentWeightKg) : "",
    heightCm: member?.profile?.heightCm != null ? String(member.profile.heightCm) : "",
    membershipAccess: getMembershipFieldValue(member)
  };
}

function getActionErrorMessage(error: unknown, fallback: string) {
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

type ToastTone = "success" | "error" | "info" | "warning";

function notify(tone: ToastTone, title: string, description?: string) {
  const options = description ? { description } : undefined;

  if (tone === "success") {
    toast.success(title, options);
    return;
  }

  if (tone === "error") {
    toast.error(title, options);
    return;
  }

  if (tone === "warning") {
    toast.warning(title, options);
    return;
  }

  toast.info(title, options);
}

function notifyActionError(title: string, error: unknown, fallback: string) {
  notify("error", title, getActionErrorMessage(error, fallback));
}

export default function MembersDashboard() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { members, isLoading, error: membersError, fetchMembers, createUser, updateMember, deleteUser, restoreUser } = useMembers();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 250);
  const [activeChip, setActiveChip] = useState("all");
  const [activeStatus, setActiveStatus] = useState<MemberStatusTab>("Active");
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();

  const [addLoading, setAddLoading] = useState(false);
  const addLoadingLabel = useLoadingText("ADDING USER", addLoading);

  const [editTarget, setEditTarget] = useState<MemberRecord | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>(getEditDraftValues(null));
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [pendingEditSubmission, setPendingEditSubmission] = useState<Record<string, string> | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MemberRecord | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MemberRecord | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<MemberRecord | null>(null);
  const [revokeCardTarget, setRevokeCardTarget] = useState<MemberRecord | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [achievementReviews, setAchievementReviews] = useState<AchievementReviewRecord[]>(ACHIEVEMENT_REVIEW_SEED);
  const [reviewTarget, setReviewTarget] = useState<AchievementReviewRecord | null>(null);
  const [reviewDraft, setReviewDraft] = useState<Record<string, string>>({ reviewerNotes: "" });
  const [scanOpen, setScanOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<AttendanceScanFeedback | null>(null);
  const { data: deletionRequests = [], error: deletionRequestsError } = useQuery({
    ...adminDeletionRequestsQueryOptions<DeletionRequest>(webApiClient),
    enabled: isAdmin
  });
  const {
    data: pendingMembershipPayments = { data: [], meta: { page: 1, limit: 0, total: 0, total_pages: 0 } },
    error: pendingMembershipPaymentsError
  } = useQuery({
    ...reviewMembershipPaymentsQueryOptions(webApiClient, {
      limit: 50,
      page: 1,
      status: "awaiting_verification"
    }),
    enabled: isAdmin
  });

  const { data: staffUsers = [], isLoading: staffUsersLoading, error: staffUsersError } = useQuery({
    ...staffUsersQueryOptions(webApiClient),
    enabled: isStaff
  });

  useEffect(() => {
    if (!isStaff) void fetchMembers();
  }, [fetchMembers, isStaff]);

  useEffect(() => {
    if (!membersError || isStaff) return;
    notify("error", "Could not load the members directory", membersError);
  }, [membersError, isStaff]);

  useEffect(() => {
    if (!staffUsersError || !isStaff) return;
    notifyActionError("Could not load the members directory", staffUsersError, "Failed to load the staff directory.");
  }, [isStaff, staffUsersError]);

  useEffect(() => {
    if (!deletionRequestsError || !isAdmin) return;
    notifyActionError(
      "Termination requests could not be loaded",
      deletionRequestsError,
      "Failed to load pending termination requests."
    );
  }, [deletionRequestsError, isAdmin]);

  useEffect(() => {
    if (!pendingMembershipPaymentsError || !isAdmin) return;
    notifyActionError(
      "Payment reviews could not be loaded",
      pendingMembershipPaymentsError,
      "Failed to load pending membership payment reviews."
    );
  }, [isAdmin, pendingMembershipPaymentsError]);

  useEffect(() => {
    setReviewDraft({ reviewerNotes: reviewTarget?.reviewerNotes ?? "" });
  }, [reviewTarget]);

  const roleScopedMembers = useMemo(() => {
    const sourceMembers = isStaff ? staffUsers : members;
    return sourceMembers.filter((member) => member.role?.name !== "COACH");
  }, [isStaff, members, staffUsers]);

  const pendingRequestsByUserId = useMemo(
    () => isAdmin ? getPendingRequestsByUserId(deletionRequests) : new Map<string, DeletionRequest>(),
    [deletionRequests, isAdmin]
  );
  const membershipReviewPayments = useMemo(
    () => pendingMembershipPayments.data.filter((payment) =>
      payment.payable_type === "subscription" || payment.payable_type === "membership_card"
    ),
    [pendingMembershipPayments.data]
  );
  const pendingMembershipPayment = useMemo(
    () => editTarget
      ? membershipReviewPayments.find((payment) => payment.user_id === editTarget.id)
      : undefined,
    [editTarget, membershipReviewPayments]
  );
  const [reviewFilter, setReviewFilter] = useState("Pending");
  const [contentMode, setContentMode] = useState<ContentMode>("directory");
  useEffect(() => {
    if (contentMode !== "directory") {
      setEditTarget(null);
      setEditModalOpen(false);
      setEditConfirmOpen(false);
      setPendingEditSubmission(null);
    }
  }, [contentMode]);
  const primaryCommandTextColor = getReadableTextColor(
    colors.brandLight,
    themes.sunlight.textPrimary,
    colors.textPrimary
  );
  const pendingAchievementReviews = useMemo(
    () => achievementReviews.filter((review) => {
      if (reviewFilter === "All") return true;
      return review.status === reviewFilter;
    }),
    [achievementReviews, reviewFilter]
  );
  const pendingReviewCount = useMemo(
    () => achievementReviews.filter((review) => review.status === "Pending").length,
    [achievementReviews]
  );
  const closedReviewCount = achievementReviews.length - pendingReviewCount;

  const [page, setPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);

  const filtered = useMemo(
    () => filterMembers(roleScopedMembers, debouncedQ, activeChip, activeStatus, pendingRequestsByUserId),
    [roleScopedMembers, debouncedQ, activeChip, activeStatus, pendingRequestsByUserId]
  );

  useEffect(() => setPage(1), [debouncedQ, activeChip, activeStatus]);
  useEffect(() => setReviewPage(1), [reviewFilter]);

  useEffect(() => {
    if (contentMode !== "directory" || !editTarget) return;
    const matchedMember = filtered.find((member) => member.id === editTarget.id);
    if (!matchedMember) {
      setEditTarget(null);
      setEditModalOpen(false);
      setEditConfirmOpen(false);
      setPendingEditSubmission(null);
      return;
    }

    if (matchedMember !== editTarget) {
      setEditTarget(matchedMember);
    }
  }, [contentMode, editTarget, filtered]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [filtered.length, page]);

  useEffect(() => {
    const maxReviewPage = Math.max(1, Math.ceil(pendingAchievementReviews.length / ROWS_PER_PAGE));
    if (reviewPage > maxReviewPage) {
      setReviewPage(maxReviewPage);
    }
  }, [pendingAchievementReviews.length, reviewPage]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return filtered.slice(start, start + ROWS_PER_PAGE);
  }, [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const editInitialValues = useMemo(() => getEditDraftValues(editTarget), [editTarget]);

  const paginatedReviews = useMemo(() => {
    const start = (reviewPage - 1) * ROWS_PER_PAGE;
    return pendingAchievementReviews.slice(start, start + ROWS_PER_PAGE);
  }, [pendingAchievementReviews, reviewPage]);
  const reviewTotalPages = Math.max(1, Math.ceil(pendingAchievementReviews.length / ROWS_PER_PAGE));
  const archiveLoadingLabel = useLoadingText("ARCHIVING MEMBER", archiveLoading);

  useEffect(() => {
    setEditDraft(editInitialValues);
  }, [editInitialValues]);

  useEffect(() => {
    if (contentMode !== "directory" || !editTarget || editModalOpen || editConfirmOpen) return;
    if (paginatedRows.some((member) => member.id === editTarget.id)) return;
    setEditTarget(null);
  }, [contentMode, editConfirmOpen, editModalOpen, editTarget, paginatedRows]);

  useEffect(() => {
    if (editTarget) return;
    setEditModalOpen(false);
    setEditConfirmOpen(false);
    setPendingEditSubmission(null);
  }, [editTarget]);

  const editPendingRequest = editTarget ? pendingRequestsByUserId.get(editTarget.id) : undefined;
  const isEditTargetArchived = editTarget
    ? getDirectoryMemberStatus(editTarget, pendingRequestsByUserId) === "Archived"
    : false;
  const isSelfEdit = editTarget?.id === user?.id;
  const hasEditChanges = useMemo(() => {
    if (!editTarget) return false;
    const initialValues = getEditDraftValues(editTarget);
    return EDIT_MEMBER_EDITABLE_KEYS.some((key) => normalizeDraftValue(editDraft[key]) !== normalizeDraftValue(initialValues[key]));
  }, [editDraft, editTarget]);
  const canArchiveEditTarget = Boolean(
    isAdmin &&
      editTarget &&
      !isSelfEdit &&
      editTarget.role?.name !== "ADMIN" &&
      !editPendingRequest &&
      !isEditTargetArchived
  );
  const canTerminateEditTarget = Boolean(isAdmin && !isSelfEdit && editPendingRequest);
  const canRestoreEditTarget = Boolean(isAdmin && editTarget && !isSelfEdit && isEditTargetArchived);
  const canEditTargetDetails = Boolean(isAdmin && editTarget && !isSelfEdit);
  const canManageMemberCard = Boolean(isAdmin && editTarget && !isSelfEdit && editTarget.role?.name === "USER");

  const handleAdd = async (data: AdminCreateUserData) => {
    setAddLoading(true);
    await new Promise((resolve) => setTimeout(resolve, MIN_ACTION_DELAY_MS));
    const role = data.role;
    const result = await createUser({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role,
      phone_no: data.phone_no
    });
    setAddLoading(false);
    if (result.success) {
      setContentMode("directory");
      if (role === "member") {
        notify("success", "Member account created", "Verification OTP sent to the member's email.");
      } else {
        notify(
          "success",
          `${role === "admin" ? "Admin" : "Staff"} account created`,
          "The account can sign in immediately."
        );
      }
      return;
    }
    notify("error", "Could not create account", result.error ?? "Check the form details and try again.");
  };

  const approveDeletionMutation = useMutation(
    approveDeletionRequestMutationOptions(
      webApiClient,
      queryClient,
      { reviewNotes: "Approved via members panel." }
    )
  );

  const rejectDeletionMutation = useMutation(
    rejectDeletionRequestMutationOptions(
      webApiClient,
      queryClient,
      { reviewNotes: "Rejected via members panel." }
    )
  );
  const membershipCardMutation = useMutation(
    updateAdminMembershipCardMutationOptions(webApiClient, queryClient)
  );
  const scanAttendanceMutation = useMutation(
    scanAttendanceQrMutationOptions(webApiClient, queryClient)
  );
  const manualAttendanceMutation = useMutation(
    manualAttendanceCheckInMutationOptions(webApiClient, queryClient)
  );
  const membershipPaymentReviewMutation = useMutation(
    verifyMembershipPaymentMutationOptions(webApiClient, queryClient)
  );

  const rejectLoadingLabel = useLoadingText("REJECTING REQUEST", rejectDeletionMutation.isPending);
  const membershipCardLoadingLabel = useLoadingText("UPDATING CARD", membershipCardMutation.isPending);
  const manualCheckInLoadingLabel = useLoadingText("CHECKING IN", manualAttendanceMutation.isPending);
  const paymentReviewLoadingLabel = useLoadingText("UPDATING PAYMENT", membershipPaymentReviewMutation.isPending);
  const editLoadingLabel = useLoadingText("UPDATING MEMBER", editLoading);
  const restoreLoadingLabel = useLoadingText("RESTORING ACCOUNT", restoreLoading);
  const pageLoading = isStaff ? staffUsersLoading : isLoading;

  const openInspector = (member: MemberRecord) => {
    setEditTarget((current) => (
      current?.id === member.id ? null : member
    ));
  };

  const openEditModal = () => {
    if (!canEditTargetDetails || !editTarget) return;
    setEditDraft(getEditDraftValues(editTarget));
    setPendingEditSubmission(null);
    setEditConfirmOpen(false);
    setEditModalOpen(true);
  };

  const closeInspector = () => {
    setEditModalOpen(false);
    setEditConfirmOpen(false);
    setPendingEditSubmission(null);
    setEditTarget(null);
  };

  const patchOpenMember = (memberId: string, patch: Partial<MemberRecord>) => {
    setEditTarget((current) => (
      current?.id === memberId
        ? { ...current, ...patch }
        : current
    ));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const request = pendingRequestsByUserId.get(deleteTarget.id);
    if (!request) {
      notify("warning", "Termination request missing", "Refresh the page if this request was already handled elsewhere.");
      setDeleteTarget(null);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, MIN_ACTION_DELAY_MS));
    try {
      await approveDeletionMutation.mutateAsync(request.id);
      setDeleteTarget(null);
      closeInspector();
      notify("success", "Account terminated", "The pending request was approved and the account was removed.");
    } catch {
      notify("error", "Could not terminate account", "Try again after the latest request state has loaded.");
    }
  };

  const handleRejectDeleteRequest = async () => {
    if (!editTarget) return;
    const request = pendingRequestsByUserId.get(editTarget.id);
    if (!request) {
      notify("warning", "Termination request missing", "Refresh the page if this request was already handled elsewhere.");
      return;
    }
    try {
      await rejectDeletionMutation.mutateAsync(request.id);
      closeInspector();
      notify("success", "Termination request declined", "The account stays active in the directory.");
    } catch {
      notify("error", "Could not decline the request", "Try again after the latest request state has loaded.");
    }
  };

  const handleArchiveMember = async () => {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    await new Promise((resolve) => setTimeout(resolve, MIN_ACTION_DELAY_MS));
    const memberName = fullName(archiveTarget) || archiveTarget.email;
    const result = await deleteUser(archiveTarget.id);
    setArchiveLoading(false);
    if (result.success) {
      setArchiveTarget(null);
      closeInspector();
      notify("success", `${memberName} archived`, "The account has been moved out of the active directory.");
      return;
    }
    notify("error", "Could not archive this person", result.error ?? "Try again after the directory refreshes.");
  };

  const handleRestoreMember = async () => {
    if (!restoreTarget) return;
    setRestoreLoading(true);
    await new Promise((resolve) => setTimeout(resolve, MIN_ACTION_DELAY_MS));
    const memberName = fullName(restoreTarget) || restoreTarget.email;
    const result = await restoreUser(restoreTarget.id);
    setRestoreLoading(false);
    if (result.success) {
      setRestoreTarget(null);
      closeInspector();
      notify("success", `${memberName} restored`, "The account is back in the active directory.");
      return;
    }
    notify("error", "Could not restore this person", result.error ?? "Try again after the directory refreshes.");
  };

  const handleGrantMembershipCard = async () => {
    if (!editTarget || editTarget.role?.name !== "USER") return;

    try {
      const result = await membershipCardMutation.mutateAsync({
        id: editTarget.id,
        payload: {
          action: "grant",
          source: editTarget.membershipCard ? "admin_repair" : "admin_grant"
        }
      });

      patchOpenMember(editTarget.id, {
        membershipCard: (result.membershipCard ?? null) as MembershipCardRecord | null
      });
      notify("success", "Member access updated", result.message);
    } catch (error) {
      notifyActionError("Could not update member access", error, "Failed to update membership-card access.");
    }
  };

  const handleRevokeMembershipCard = async () => {
    if (!revokeCardTarget) return;

    try {
      const result = await membershipCardMutation.mutateAsync({
        id: revokeCardTarget.id,
        payload: {
          action: "revoke",
          reason: "Revoked via members panel.",
          source: "admin_repair"
        }
      });

      patchOpenMember(revokeCardTarget.id, {
        membershipCard: (result.membershipCard ?? null) as MembershipCardRecord | null
      });
      setRevokeCardTarget(null);
      notify("success", "Member access updated", result.message);
    } catch (error) {
      notifyActionError("Could not update member access", error, "Failed to revoke membership-card access.");
    }
  };

  const handleManualCheckIn = async (member: MemberRecord) => {
    try {
      const result = await manualAttendanceMutation.mutateAsync({ userId: member.id });
      patchOpenMember(member.id, { lastCheckInAt: result.check_in_at });
      notify("success", `${result.member_name} checked in`, `Attendance recorded ${formatLastCheckIn(result.check_in_at)}.`);
    } catch (error) {
      notifyActionError("Could not check in this account", error, "Failed to manually check in this account.");
    }
  };

  const handleAttendanceScan = async (qrValue: string) => {
    const trimmedQrValue = qrValue.trim();
    if (!trimmedQrValue) {
      setScanFeedback({
        tone: "error",
        title: "Scan failed",
        detail: "A QR code value is required before attendance can be logged."
      });
      notify("error", "QR code required", "Add or scan a QR value before logging attendance.");
      return;
    }

    try {
      const result: AttendanceCheckInRecord = await scanAttendanceMutation.mutateAsync({
        qrValue: trimmedQrValue
      });
      setScanFeedback({
        tone: "success",
        title: `Checked in ${result.member_name}`,
        detail: `Attendance recorded ${formatLastCheckIn(result.check_in_at)}.`
      });
      notify("success", `Checked in ${result.member_name}`, `Attendance recorded ${formatLastCheckIn(result.check_in_at)}.`);
    } catch (error) {
      const detail = getActionErrorMessage(error, "Unable to scan this QR code.");
      const tone = /already|open attendance/i.test(detail) ? "warning" : "error";
      setScanFeedback({
        tone,
        title: tone === "warning" ? "Already checked in" : "Scan failed",
        detail
      });
      notify(tone, tone === "warning" ? "Attendance already logged" : "Scan failed", detail);
    }
  };

  const handleApproveMembershipPayment = async () => {
    if (!pendingMembershipPayment) return;
    const reviewLabel = getMembershipPaymentReviewLabel(pendingMembershipPayment.payable_type);
    try {
      await membershipPaymentReviewMutation.mutateAsync({
        paymentId: pendingMembershipPayment.id,
        payload: { action: "approve" },
        affectedUserId: pendingMembershipPayment.user_id
      });
      if (pendingMembershipPayment.payable_type === "membership_card") {
        patchOpenMember(pendingMembershipPayment.user_id, {
          membershipCard: {
            ...(editTarget?.membershipCard ?? { status: "active" }),
            activatedAt: new Date().toISOString(),
            revokeReason: null,
            revokedAt: null,
            source: pendingMembershipPayment.provider,
            status: "active",
            verifiedAt: new Date().toISOString()
          } as MembershipCardRecord
        });
        await fetchMembers();
      }
      notify("success", "Payment review approved", `${formatReviewPayableLabel(pendingMembershipPayment.payable_type)} has been marked as approved.`);
    } catch {
      notify("error", "Could not approve the payment review", `Try again while the ${reviewLabel} request is still pending.`);
    }
  };

  const handleRejectMembershipPayment = async () => {
    if (!pendingMembershipPayment) return;
    const reviewLabel = getMembershipPaymentReviewLabel(pendingMembershipPayment.payable_type);
    try {
      await membershipPaymentReviewMutation.mutateAsync({
        paymentId: pendingMembershipPayment.id,
        payload: {
          action: "reject",
          rejectionReason: "Rejected via members panel."
        },
        affectedUserId: pendingMembershipPayment.user_id
      });
      if (pendingMembershipPayment.payable_type === "membership_card") {
        patchOpenMember(pendingMembershipPayment.user_id, {
          membershipCard: {
            ...(editTarget?.membershipCard ?? { status: "revoked" }),
            revokeReason: "Rejected via members panel.",
            revokedAt: new Date().toISOString(),
            status: "revoked"
          } as MembershipCardRecord
        });
        await fetchMembers();
      }
      notify("success", "Payment review declined", `${formatReviewPayableLabel(pendingMembershipPayment.payable_type)} remains blocked for now.`);
    } catch {
      notify("error", "Could not decline the payment review", `Try again while the ${reviewLabel} request is still pending.`);
    }
  };

  const handleAchievementReviewDecision = (
    status: AchievementReviewStatus,
    reviewerNotes: string,
  ) => {
    if (!reviewTarget) return;
    const trimmedNotes = reviewerNotes.trim();
    if (status === "Rejected" && !trimmedNotes) {
      notify("warning", "Reviewer notes required", "Add a short reason before declining a milestone submission.");
      return;
    }

    setAchievementReviews((prev) =>
      prev.map((review) =>
        review.id === reviewTarget.id
          ? {
            ...review,
            status,
            reviewerNotes: trimmedNotes,
            reviewedAt: new Date().toISOString(),
          }
          : review
      )
    );
    setReviewTarget(null);
    notify(
      "success",
      status === "Approved" ? "Milestone approved" : "Milestone declined",
      trimmedNotes ? "Reviewer notes were saved with the decision." : undefined
    );
  };

  const queueEditConfirmation = (data: Record<string, string>) => {
    if (!hasEditChanges) return;
    setEditDraft(data);
    setPendingEditSubmission(data);
    setEditModalOpen(false);
    setEditConfirmOpen(true);
  };

  const handleEdit = async (data: Record<string, string>) => {
    if (!editTarget || !isAdmin || isSelfEdit) {
      setEditModalOpen(false);
      setEditConfirmOpen(false);
      setPendingEditSubmission(null);
      return;
    }
    const nextFirstName = normalizeDraftValue(data.firstName);
    const nextLastName = normalizeDraftValue(data.lastName);
    const nextDateOfBirth = normalizeDraftValue(data.dateOfBirth);
    const nextGender = normalizeDraftValue(data.gender);
    const nextActivityLevel = normalizeDraftValue(data.activityLevel);
    const nextFitnessGoal = normalizeDraftValue(data.fitnessGoal);
    const nextWeight = parseOptionalNumber(data.currentWeightKg);
    const nextHeight = parseOptionalNumber(data.heightCm);

    setEditLoading(true);
    await new Promise((resolve) => setTimeout(resolve, MIN_ACTION_DELAY_MS));
    const result = await updateMember({
      id: editTarget.id,
      ...(nextFirstName ? { firstName: nextFirstName } : {}),
      ...(nextLastName ? { lastName: nextLastName } : {}),
      ...(nextDateOfBirth ? { dateOfBirth: nextDateOfBirth } : {}),
      ...(nextGender ? { gender: nextGender } : {}),
      ...(nextActivityLevel ? { activityLevel: nextActivityLevel } : {}),
      ...(nextFitnessGoal ? { fitnessGoal: nextFitnessGoal } : {}),
      ...(nextWeight !== undefined ? { currentWeightKg: nextWeight } : {}),
      ...(nextHeight !== undefined ? { heightCm: nextHeight } : {}),
    });
    setEditLoading(false);
    if (result.success) {
      patchOpenMember(editTarget.id, {
        profile: {
          ...editTarget.profile,
          firstName: nextFirstName || editTarget.profile?.firstName || "",
          lastName: nextLastName || editTarget.profile?.lastName || "",
          dateOfBirth: nextDateOfBirth || editTarget.profile?.dateOfBirth || null,
          gender: nextGender || editTarget.profile?.gender || null,
          activityLevel: nextActivityLevel || editTarget.profile?.activityLevel || null,
          fitnessGoal: nextFitnessGoal || editTarget.profile?.fitnessGoal || null,
          currentWeightKg: nextWeight ?? editTarget.profile?.currentWeightKg ?? null,
          heightCm: nextHeight ?? editTarget.profile?.heightCm ?? null,
        }
      });
      setEditModalOpen(false);
      setEditConfirmOpen(false);
      setPendingEditSubmission(null);
      notify("success", "Member details updated", "The profile panel now reflects the saved changes.");
      return;
    }
    setEditConfirmOpen(false);
    setPendingEditSubmission(null);
    setEditModalOpen(true);
    notify("error", "Could not update member details", result.error ?? "Review the highlighted values and try again.");
  };

  const handleMessageMember = (member: MemberRecord) => {
    if (!member.email.trim()) {
      notify("info", "No email available", "This account cannot be contacted by email yet.");
      return;
    }

    window.location.href = `mailto:${member.email}`;
  };

  const memberColumns: FitTableColumn<MemberRecord>[] = [
    {
      key: "member",
      heading: "Member",
      render: (member, c) => {
        const roleLabel = getDirectoryRoleLabel(member.role?.name);
        const avatarUrl = getMemberAvatarUrl(member);
        const showRoleLabel = member.role?.name !== "USER";
        const initials = getMemberInitials(member);

        return (
          <div className="members-directory-panel__identity" style={{ display: "flex", gap: 9, alignItems: "center", minWidth: 0 }}>
            <div
              className="members-directory-panel__identity-avatar"
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                backgroundColor: c.textPrimary,
                border: `1px solid ${c.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative"
              }}
            >
              <FitText style={{ fontSize: 11, fontWeight: 800, color: c.surfaceRaised, letterSpacing: "0.04em" }}>
                {initials}
              </FitText>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${fullName(member) || member.email} avatar`}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }}
                />
              ) : null}
            </div>
            <div className="members-directory-panel__identity-copy" style={{ display: "grid", gap: 3, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
                <FitText className="members-directory-panel__primary-text" style={{ fontSize: 13.5, fontWeight: 700, color: c.textPrimary }}>
                  {fullName(member) || "Unnamed member"}
                </FitText>
                {showRoleLabel ? (
                  <FitPill
                    mode="status"
                    label={roleLabel}
                    color={c.brand}
                    fontSize={8.5}
                    borderOpacity="35"
                    bgOpacity="14"
                  />
                ) : null}
              </div>
              <FitText className="members-directory-panel__secondary-text" style={{ fontSize: 11.5, color: c.textSecondary, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {member.email}
              </FitText>
            </div>
          </div>
        );
      }
    },
    {
      key: "access",
      heading: "Access",
      render: (member, c) => {
        return (
          <FitText className="members-directory-panel__emphasis-text" style={{ fontSize: 12.5, fontWeight: 600, color: c.textPrimary }}>
            {getDirectoryAccessLabel(member, pendingRequestsByUserId)}
          </FitText>
        );
      }
    },
    {
      key: "activity",
      heading: "Last activity",
      render: (member, c) => (
        <FitText
          className="members-directory-panel__emphasis-text"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: member.lastCheckInAt ? c.textPrimary : c.textSecondary
          }}
        >
          {formatLastCheckIn(member.lastCheckInAt)}
        </FitText>
      )
    },
    {
      key: "status",
      heading: "Status",
      render: (member, c) => {
        const statusLabel = getDirectoryStatusLabel(member, pendingRequestsByUserId);
        const profileTone = getDirectoryStatusColor(member, pendingRequestsByUserId, c.warning);

        return (
          <FitPill
            mode="status"
            label={statusLabel}
            color={profileTone ?? c.textMuted}
            fontSize={9.5}
          />
        );
      }
    }
  ];

  const renderMobileCard = (member: MemberRecord) => {
    const avatarUrl = getMemberAvatarUrl(member);
    const statusLabel = getDirectoryStatusLabel(member, pendingRequestsByUserId);
    const roleLabel = getDirectoryRoleLabel(member.role?.name);
    const showRoleLabel = member.role?.name !== "USER";
    const accessLabel = getDirectoryAccessLabel(member, pendingRequestsByUserId);
    const initials = getMemberInitials(member);

    return (
      <div
        className="members-mobile-card"
        style={{
          display: "grid",
          gap: 12,
          padding: 14,
          borderRadius: 20,
          border: `1px solid ${colors.border}`,
          background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
          boxShadow: "0 12px 24px rgba(0,0,0,0.12)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 240px" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
                flexShrink: 0
              }}
            >
              <FitText style={{ fontSize: 13, fontWeight: 800, color: colors.surfaceRaised, letterSpacing: "0.04em" }}>
                {initials}
              </FitText>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${fullName(member) || member.email} avatar`}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }}
                />
              ) : null}
            </div>
            <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {showRoleLabel ? (
                  <FitPill
                    mode="status"
                    label={roleLabel}
                    color={colors.brand}
                    fontSize={10}
                    borderOpacity="35"
                    bgOpacity="14"
                  />
                ) : null}
                <FitPill
                  mode="status"
                  label={statusLabel}
                  color={getDirectoryStatusColor(member, pendingRequestsByUserId, colors.warning)}
                  fontSize={10}
                />
              </div>
              <FitText style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>
                {fullName(member) || "Unnamed member"}
              </FitText>
              <FitText style={{ fontSize: 12.5, color: colors.textSecondary }}>
                {member.email}
              </FitText>
            </div>
          </div>
          <FitPill
            mode="status"
            label={accessLabel}
            color={MEMBERSHIP_CARD_STATUS_COLORS[accessLabel] ?? colors.textMuted}
            fontSize={11}
          />
        </div>
        <div
          className="members-mobile-meta-grid"
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>
              LAST ACTIVITY
            </FitText>
            <FitText style={{ fontSize: 12.5, color: colors.textSecondary }}>
              {formatLastCheckIn(member.lastCheckInAt)}
            </FitText>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>
              ACCESS
            </FitText>
            <FitText style={{ fontSize: 12.5, fontWeight: 600, color: colors.textSecondary }}>
              {accessLabel}
            </FitText>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>
              ACCOUNT
            </FitText>
            <FitPill
              mode="status"
              label={statusLabel}
              color={getDirectoryStatusColor(member, pendingRequestsByUserId, colors.warning)}
              fontSize={12}
            />
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <FitText style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em" }}>
              SCAN
            </FitText>
            <FitText
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: member.attendanceQrReady ? colors.brand : colors.textSecondary
              }}
            >
              {getScanReadinessLabel(member)}
            </FitText>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <FitButton
            variant="ghost"
            label="View details"
            onClick={() => openInspector(member)}
            style={{
              border: `1px solid ${colors.brand}22`,
              backgroundColor: `${colors.brand}12`,
              color: colors.brand
            }}
          />
        </div>
      </div>
    );
  };

  const visibleRecordLabel = `${formatPeopleCountLabel(filtered.length)} visible`;
  const isDirectoryMode = contentMode === "directory";
  const isCreateMode = contentMode === "create";
  const activeSurfaceMode = contentMode === "review" ? "review" : "directory";
  const contentModeOptions = [
    { label: "Directory", key: "directory" },
    { label: "Milestones", key: "review" }
  ];
  const handleContentModeChange = (value: string) => {
    setContentMode(value === "review" ? "review" : "directory");
  };
  const reviewQueueCountLabel = pendingReviewCount === 1 ? "1 item waiting" : `${pendingReviewCount} items waiting`;
  const routeEyebrow = contentMode === "review"
    ? "Milestone queue"
    : "Members directory";
  const routeTitle = contentMode === "review"
    ? "Milestone approvals"
    : "Members";
  const routeSubtitle = contentMode === "review"
    ? "Review milestone submissions from one calmer queue."
    : "Find people, review access, and take action from one page.";
  const routeHeroChips: MembersRouteShellChip[] = [];
  const routeSummaryItems: MembersRouteShellMetric[] = [];
  const directoryMotionKey = `${page}-${activeStatus}-${activeChip}-${paginatedRows.map((member) => member.id).join(":")}`;
  const reviewMotionKey = `${reviewPage}-${reviewFilter}-${paginatedReviews.map((review) => review.id).join(":")}`;
  const directoryCommandSurface = (
    <div className="members-route-command-grid" style={{ display: "grid", gap: 10 }}>
      <div
        className="members-route-command-row"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "0 0 auto" }}>
          {isAdmin ? (
            <FitPill
              options={contentModeOptions}
              active={activeSurfaceMode}
              onChange={(value) => handleContentModeChange(value as string)}
            />
          ) : (
            <FitText style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
              Directory
            </FitText>
          )}
        </div>
        <div
          className="members-route-command-tray"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginLeft: "auto"
          }}
        >
          {isAdmin ? (
            <FitButton
              variant="ghost"
              label="Scan attendance"
              icon={ScanLine}
              iconSize={14}
              style={{
                minHeight: 38,
                borderRadius: 14,
                border: `1px solid ${colors.border}`,
                backgroundColor: `${colors.surfaceRaised}cc`
              }}
              onClick={() => {
                setScanFeedback(null);
                setScanOpen(true);
              }}
            />
          ) : null}
          {isAdmin ? (
            <FitButton
              variant="primary"
              label="Add account"
              icon={UserPlus}
              iconSize={14}
              style={{
                backgroundColor: colors.brandLight,
                color: primaryCommandTextColor,
                border: `1px solid ${colors.brand}2f`,
                boxShadow: `0 14px 28px -24px ${colors.brand}`,
                minHeight: 38,
                borderRadius: 14
              }}
              onClick={() => {
                setContentMode("create");
              }}
            />
          ) : null}
        </div>
      </div>

      <div
        className="members-route-command-row"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap"
        }}
      >
        <div
          className="members-filter-tray"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            flex: "1 1 100%",
            minWidth: 280,
            padding: "8px 10px",
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            backgroundColor: `${colors.surfaceRaised}d8`
          }}
        >
          <div style={{ flex: "1 1 280px", minWidth: 220, maxWidth: 420 }}>
            <FitSearch
              id="members_people_search"
              name="members_people_search"
              ariaLabel="Search people by name, email, or mobile number"
              value={q}
              onChangeText={setQ}
              placeholder="Search by member, email, or phone"
            />
          </div>
          <FitPill
            options={[...MEMBER_STATUS_TABS]}
            active={activeStatus}
            onChange={(value) => setActiveStatus(value as MemberStatusTab)}
          />
          <FitInlineFilterChips
            isOpen
            options={MEMBER_FILTER_OPTIONS}
            activeValue={activeChip}
            onChange={setActiveChip}
            maxWidth={620}
          />
        </div>
      </div>
    </div>
  );
  const reviewCommandSurface = (
    <div className="members-route-command-grid" style={{ display: "grid", gap: 12 }}>
      <div
        className="members-route-command-row"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap"
        }}
      >
        <div style={{ flex: "0 0 auto" }}>
          <FitPill
            options={contentModeOptions}
            active={activeSurfaceMode}
            onChange={(value) => handleContentModeChange(value as string)}
          />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginLeft: "auto" }}>
          <FitPill
            options={[
              { label: "All", key: "All" },
              { label: "Waiting", key: "Pending" },
              { label: "Approved", key: "Approved" },
              { label: "Needs reply", key: "Rejected" },
            ]}
            active={reviewFilter}
            onChange={(value) => setReviewFilter(value as string)}
          />
          {isAdmin ? (
            <FitButton
              variant="primary"
              label="Add account"
              icon={UserPlus}
              iconSize={14}
              style={{
                backgroundColor: colors.brandLight,
                color: primaryCommandTextColor,
                border: `1px solid ${colors.brand}2f`,
              }}
              onClick={() => {
                setContentMode("create");
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );

  const inspectorCardStyle = {
    display: "grid",
    gap: 6,
    padding: "14px 16px",
    borderRadius: 18,
    border: `1px solid ${colors.border}`,
    backgroundColor: `${colors.surface}f0`,
  };

  const secondaryActionStyle = {
    border: `1px solid ${colors.border}`,
    backgroundColor: `${colors.surfaceRaised}cc`,
    borderRadius: 14,
    minHeight: 38,
  };

  const primaryActionStyle = {
    backgroundColor: colors.brandLight,
    color: primaryCommandTextColor,
    border: `1px solid ${colors.brand}2f`,
    borderRadius: 14,
    minHeight: 38,
  };

  const warningActionStyle = {
    border: `1px solid ${colors.warning}28`,
    backgroundColor: `${colors.warning}10`,
    borderRadius: 14,
    minHeight: 40,
  };

  const desktopMemberInspector = isDirectoryMode ? (
    <MemberInspectorPanel
      key={editTarget ? editTarget.id : "empty"}
      eyebrow="Member details"
      title={editTarget ? fullName(editTarget) || "Unnamed member" : "Select a member"}
      description={
        editTarget
          ? "Member access, attendance, and quick actions stay here. Deeper profile edits open in a dedicated modal."
          : "Pick a person from People to review access, attendance, and account actions."
      }
      footer={
        !editTarget ? undefined : (
          <div style={{ display: "grid", gap: 10 }}>
            {canEditTargetDetails ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <FitButton
                  variant="primary"
                  label="Edit details"
                  onClick={openEditModal}
                  style={primaryActionStyle}
                  textStyle={{ color: primaryCommandTextColor }}
                />
                <FitButton
                  variant="ghost"
                  label={manualAttendanceMutation.isPending ? manualCheckInLoadingLabel : "Check in"}
                  disabled={manualAttendanceMutation.isPending}
                  onClick={() => {
                    void handleManualCheckIn(editTarget);
                  }}
                  style={secondaryActionStyle}
                />
              </div>
            ) : (
              <FitButton
                variant="ghost"
                label="Message"
                onClick={() => handleMessageMember(editTarget)}
                style={secondaryActionStyle}
              />
            )}

            {canEditTargetDetails ? (
              <FitButton
                variant="ghost"
                label="Message"
                onClick={() => handleMessageMember(editTarget)}
                style={secondaryActionStyle}
              />
            ) : null}

            {canManageMemberCard && getMembershipFieldValue(editTarget) !== "active" ? (
              <FitButton
                variant="ghost"
                label={membershipCardMutation.isPending ? membershipCardLoadingLabel : editTarget.membershipCard ? "Restore member card" : "Grant member card"}
                disabled={membershipCardMutation.isPending}
                onClick={() => {
                  void handleGrantMembershipCard();
                }}
                style={{
                  ...secondaryActionStyle,
                  border: `1px solid ${colors.brand}30`,
                  backgroundColor: `${colors.brand}10`,
                }}
                textStyle={{ color: colors.brand }}
              />
            ) : null}

            {canManageMemberCard && getMembershipFieldValue(editTarget) === "active" ? (
              <FitButton
                variant="ghost"
                label="Revoke card"
                disabled={membershipCardMutation.isPending}
                onClick={() => setRevokeCardTarget(editTarget)}
                style={{
                  ...secondaryActionStyle,
                  border: `1px solid ${colors.danger}25`,
                  backgroundColor: `${colors.danger}0d`,
                }}
                textStyle={{ color: colors.danger }}
              />
            ) : null}

            {canTerminateEditTarget ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <FitButton
                  variant="ghost"
                  label={rejectDeletionMutation.isPending ? rejectLoadingLabel : "Reject request"}
                  onClick={handleRejectDeleteRequest}
                  disabled={rejectDeletionMutation.isPending}
                  style={secondaryActionStyle}
                />
                <FitButton
                  variant="danger"
                  label="Terminate account"
                  onClick={() => setDeleteTarget(editTarget)}
                  style={{ borderRadius: 14, minHeight: 40 }}
                />
              </div>
            ) : null}

            {canArchiveEditTarget ? (
              <FitButton
                variant="ghost"
                label="Archive or restore account"
                onClick={() => setArchiveTarget(editTarget)}
                style={warningActionStyle}
                textStyle={{ color: colors.warning, fontWeight: 700 }}
              />
            ) : null}

            {canRestoreEditTarget ? (
              <FitButton
                variant="ghost"
                label="Archive or restore account"
                onClick={() => setRestoreTarget(editTarget)}
                style={warningActionStyle}
                textStyle={{ color: colors.warning, fontWeight: 700 }}
              />
            ) : null}
          </div>
        )
      }
    >
      {!editTarget ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { label: "Access", value: "Select a person" },
            { label: "Last activity", value: "Details appear here" },
            { label: "Actions", value: "Edit, check-in, and account controls" },
          ].map((item) => (
            <div key={item.label} style={inspectorCardStyle}>
              <FitText style={{ fontSize: 10.5, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.05em" }}>
                {item.label}
              </FitText>
              <FitText style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary, lineHeight: 1.35 }}>
                {item.value}
              </FitText>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { label: "Access", value: getDirectoryAccessLabel(editTarget, pendingRequestsByUserId) },
            { label: "Last activity", value: formatLastCheckIn(editTarget.lastCheckInAt) },
            { label: "Scan status", value: getScanReadinessLabel(editTarget) },
          ].map((item) => (
            <div key={item.label} style={inspectorCardStyle}>
              <FitText style={{ fontSize: 10.5, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.05em" }}>
                {item.label}
              </FitText>
              <FitText style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary, lineHeight: 1.35 }}>
                {item.value}
              </FitText>
            </div>
          ))}

          {isAdmin && !isSelfEdit && pendingMembershipPayment ? (
            <div
              style={{
                ...inspectorCardStyle,
                gap: 8,
                border: `1px solid ${colors.brand}1f`,
                backgroundColor: `${colors.brand}08`,
              }}
            >
              <FitText style={{ fontSize: 10.5, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.05em" }}>
                Payment review
              </FitText>
              <FitText style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
                PHP {Number(pendingMembershipPayment.amount).toLocaleString("en-PH")}
              </FitText>
              <FitText style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
                {formatReviewPayableLabel(pendingMembershipPayment.payable_type)} - {formatMembershipStatus(pendingMembershipPayment.status)}
              </FitText>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <FitButton
                  variant="primary"
                  label={membershipPaymentReviewMutation.isPending ? paymentReviewLoadingLabel : "Approve"}
                  onClick={handleApproveMembershipPayment}
                  disabled={membershipPaymentReviewMutation.isPending}
                  style={{ ...primaryActionStyle, minHeight: 36 }}
                  textStyle={{ color: primaryCommandTextColor }}
                />
                <FitButton
                  variant="ghost"
                  label="Reject"
                  onClick={handleRejectMembershipPayment}
                  disabled={membershipPaymentReviewMutation.isPending}
                  style={secondaryActionStyle}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </MemberInspectorPanel>
  ) : null;

  return (
    <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
      <div
        className={isCreateMode ? "members-shell members-shell-create" : "members-shell"}
        style={{
          display: "grid",
          gap: isCreateMode ? 0 : 18,
          maxWidth: 1240,
          margin: "0 auto",
          width: "100%"
        }}
      >
        {isCreateMode ? (
          <div
            key="create"
            className="members-create-shell"
            style={{
              width: "100%",
              maxWidth: 1160,
              margin: "0 auto",
            }}
          >
            <AddUserPanel
              existingAccounts={roleScopedMembers}
              isLoading={addLoading}
              loadingLabel={addLoadingLabel}
              onBack={() => setContentMode("directory")}
              onSubmit={handleAdd}
            />
          </div>
        ) : (
          <MembersRouteShell
            eyebrow={routeEyebrow}
            title={routeTitle}
            subtitle={routeSubtitle}
            heroChips={routeHeroChips}
            summaryItems={routeSummaryItems}
            commandSurface={isDirectoryMode ? directoryCommandSurface : reviewCommandSurface}
          >
            <div key={contentMode} style={{ display: "grid", gap: 16 }}>
              {isDirectoryMode ? (
                <div
                  className="members-directory-stage"
                  style={{
                    display: "grid",
                    gap: 16,
                    gridTemplateColumns: "minmax(0, 1fr) minmax(288px, 304px)",
                    alignItems: "start",
                  }}
                >
                  <MembersDirectoryPanel
                    activeRowId={editTarget?.id}
                    emptyMessage="No people match your current filters."
                    filteredCount={filtered.length}
                    isAdmin={isAdmin}
                    onPageChange={setPage}
                    onRowClick={openInspector}
                    page={page}
                    pageSize={ROWS_PER_PAGE}
                    pageLoading={pageLoading}
                    renderMobileCard={renderMobileCard}
                    rows={paginatedRows}
                    subtitle="Current people and access status."
                    tableMotionKey={directoryMotionKey}
                    tableColumns={memberColumns}
                    badgeLabel={visibleRecordLabel}
                    title="People"
                    totalPages={totalPages}
                  />
                  {desktopMemberInspector}
                </div>
              ) : isAdmin ? (
                <MembersReviewRail
                  closedCount={closedReviewCount}
                  countLabel={reviewQueueCountLabel}
                  currentPage={reviewPage}
                  onOpenReview={setReviewTarget}
                  onPageChange={setReviewPage}
                  pageSize={ROWS_PER_PAGE}
                  pendingCount={pendingReviewCount}
                  reviewFilter={reviewFilter}
                  reviews={paginatedReviews}
                  motionKey={reviewMotionKey}
                  totalPages={reviewTotalPages}
                  totalReviews={pendingAchievementReviews.length}
                />
              ) : null}
            </div>
          </MembersRouteShell>
        )}
      </div>
      <style>{`
        @keyframes members-create-in {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.992);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .members-create-shell {
          animation: members-create-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .members-mobile-card {
          transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
        }

        .members-mobile-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 30px rgba(0, 0, 0, 0.18);
        }

        @media (prefers-reduced-motion: reduce) {
          .members-create-shell {
            animation: none !important;
          }

          .members-mobile-card {
            transition: none !important;
          }
        }

        @media (max-width: 1100px) {
          .members-route-command-row {
            align-items: stretch !important;
          }

          .members-filter-cluster {
            margin-left: 0 !important;
          }
        }

        @media (max-width: 980px) {
          .members-directory-stage {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 860px) {
          .members-filter-cluster {
            width: 100%;
          }

          .members-filter-tray {
            width: 100%;
          }
        }

        @media (max-width: 640px) {
          .members-shell {
            gap: 14px !important;
          }

          .members-shell-create {
            gap: 0 !important;
          }

          .members-mobile-meta-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      {isAdmin ? (
        <DetailsModal
          isOpen={editModalOpen && !!editTarget}
          title="Edit member details"
          subtitle={editTarget ? `${fullName(editTarget) || "Unnamed member"} - ${getDirectoryAccessLabel(editTarget, pendingRequestsByUserId)}` : ""}
          fields={EDIT_MEMBER_FIELDS}
          initialValues={editInitialValues}
          submitLabel="Review update"
          disableUnchanged
          validate={validateEditDraft}
          onChange={setEditDraft}
          onSubmit={queueEditConfirmation}
          onCancel={() => {
            setEditDraft(getEditDraftValues(editTarget));
            setEditModalOpen(false);
            setPendingEditSubmission(null);
          }}
        >
          {editTarget ? (
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gap: 10,
                padding: 14,
                borderRadius: 16,
                border: `1px solid ${colors.border}`,
                backgroundColor: `${colors.surface}ee`,
              }}
            >
              {[
                { label: "Access", value: getDirectoryAccessLabel(editTarget, pendingRequestsByUserId) },
                { label: "Scan status", value: getScanReadinessLabel(editTarget) },
              ].map((item) => (
                <div key={item.label} style={{ display: "grid", gap: 3 }}>
                  <FitText style={{ fontSize: 10.5, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.05em" }}>
                    {item.label}
                  </FitText>
                  <FitText style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>
                    {item.value}
                  </FitText>
                </div>
              ))}
            </div>
          ) : null}
        </DetailsModal>
      ) : null}
      {isAdmin ? (
        <ConfirmModal
          isOpen={editConfirmOpen && !!editTarget && !!pendingEditSubmission}
          title="Confirm member update"
          message={editTarget
            ? `Save the updated profile details for ${fullName(editTarget) || editTarget.email}? Access controls stay unchanged, and the page will refresh with the new member information.`
            : "Save these updated member details?"}
          confirmLabel="SAVE MEMBER DETAILS"
          loadingLabel={editLoadingLabel}
          isLoading={editLoading}
          onConfirm={() => {
            if (!pendingEditSubmission) return;
            void handleEdit(pendingEditSubmission);
          }}
          onCancel={() => {
            setEditConfirmOpen(false);
            setPendingEditSubmission(null);
            setEditModalOpen(true);
          }}
        />
      ) : null}
      {isAdmin ? (
        <DetailsModal
          isOpen={!!reviewTarget}
          title="Review milestone"
          subtitle={reviewTarget ? `${reviewTarget.memberName} - ${reviewTarget.badgeLabel}` : ""}
          fields={ACHIEVEMENT_REVIEW_FIELDS}
          initialValues={{ reviewerNotes: reviewTarget?.reviewerNotes ?? "" }}
          submitLabel="Approve milestone"
          readOnly={reviewTarget?.status !== "Pending"}
          readOnlyBanner={reviewTarget?.status !== "Pending" ? "This milestone review is already closed." : undefined}
          onChange={setReviewDraft}
          onSubmit={(data) => handleAchievementReviewDecision("Approved", data.reviewerNotes ?? "")}
          onCancel={() => setReviewTarget(null)}
          dangerLabel={reviewTarget?.status === "Pending" ? "Decline milestone" : undefined}
          dangerIcon={ShieldX}
          onDanger={reviewTarget?.status === "Pending" ? () => handleAchievementReviewDecision("Rejected", reviewDraft.reviewerNotes ?? "") : undefined}
        >
          {reviewTarget ? (
            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 16,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface
              }}
            >
              <img
                src={reviewTarget.proofImageUrl}
                alt={`${reviewTarget.badgeLabel} proof preview`}
                style={{ width: "100%", height: 188, borderRadius: 14, objectFit: "cover", border: `1px solid ${colors.border}` }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <FitPill
                  mode="status"
                  label={reviewTarget.status}
                  color={ACHIEVEMENT_REVIEW_STATUS_COLORS[reviewTarget.status] ?? colors.textMuted}
                  fontSize={12}
                />
                <FitText style={{ fontSize: 13, color: colors.textMuted }}>
                  Submitted {new Date(reviewTarget.submittedAt).toLocaleString()}
                </FitText>
              </div>
              <FitText style={{ fontSize: 13, color: colors.textMuted, marginTop: 8 }}>
                {reviewTarget.proofCaption}
              </FitText>
              <FitText style={{ fontSize: 13, color: colors.textMuted, marginTop: 6 }}>
                Record the decision that best matches the milestone submission. Closed reviews stay visible here for audit context.
              </FitText>
            </div>
          ) : null}
        </DetailsModal>
      ) : null}
      {isAdmin ? (
        <AttendanceScanModal
          isOpen={scanOpen}
          isSubmitting={scanAttendanceMutation.isPending}
          feedback={scanFeedback}
          onClearFeedback={() => setScanFeedback(null)}
          onClose={() => {
            setScanOpen(false);
            setScanFeedback(null);
          }}
          onSubmitToken={handleAttendanceScan}
        />
      ) : null}
      {isAdmin ? (
        <ConfirmModal
          isOpen={!!revokeCardTarget}
          title="Revoke Member Card"
          message={`Revoke member-card access for ${revokeCardTarget?.email ?? "this account"}? The account stays active, but scan access and member-only app access return to the non-member state.`}
          confirmLabel="REVOKE CARD"
          loadingLabel={membershipCardLoadingLabel}
          confirmIcon={Archive}
          isDanger
          isLoading={membershipCardMutation.isPending}
          onConfirm={handleRevokeMembershipCard}
          onCancel={() => setRevokeCardTarget(null)}
        />
      ) : null}
      {isAdmin ? (
        <ConfirmModal
          isOpen={!!deleteTarget}
          title="Terminate Account"
          message={`Approve account termination for ${deleteTarget?.email ?? "this user"}? This permanently closes the account and cannot be undone.`}
          confirmLabel={CONFIRM_COPY.terminateAccount.confirmLabel}
          loadingLabel={CONFIRM_COPY.terminateAccount.loadingLabel}
          confirmIcon={Skull}
          isDanger
          isLoading={approveDeletionMutation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
      {isAdmin ? (
        <ConfirmModal
          isOpen={!!archiveTarget}
          title="Archive Member"
          message={`Archive ${archiveTarget?.email ?? "this account"} from the people directory? The profile stays recoverable in Archived.`}
          confirmLabel="ARCHIVE MEMBER"
          loadingLabel={archiveLoadingLabel}
          confirmIcon={Archive}
          isDanger
          isLoading={archiveLoading}
          onConfirm={handleArchiveMember}
          onCancel={() => setArchiveTarget(null)}
        />
      ) : null}
      {isAdmin ? (
        <ConfirmModal
          isOpen={!!restoreTarget}
          title="Restore Account"
          message={`Restore ${restoreTarget?.email ?? "this account"} to the people directory? This clears soft deletion and cancels any pending deletion request for the account.`}
          confirmLabel="RESTORE ACCOUNT"
          loadingLabel={restoreLoadingLabel}
          confirmIcon={BadgeCheck}
          isLoading={restoreLoading}
          onConfirm={handleRestoreMember}
          onCancel={() => setRestoreTarget(null)}
        />
      ) : null}
      <style>{`
        @media (max-width: 860px) {
          .members-grid { grid-template-columns: 1fr !important; }
          .members-kpis { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
          .members-kpis .fit-kpi-card { padding: 10px 12px !important; min-height: 72px !important; }
        }
      `}</style>
    </FitSection>
  );
}
