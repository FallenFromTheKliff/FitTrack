"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BadgeCheck,
  CreditCard,
  Filter,
  LayoutGrid,
  List,
  Pencil,
  ScanLine,
  UserPlus,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminDeletionRequestsQueryOptions,
  approveDeletionRequestMutationOptions,
  manualAttendanceCheckInMutationOptions,
  reviewMembershipPaymentsQueryOptions,
  rejectDeletionRequestMutationOptions,
  scanAttendanceQrMutationOptions,
  updateAdminMembershipCardMutationOptions,
  verifyMembershipPaymentMutationOptions,
} from "@fittrack/query";
import type { AdminCreateUserData } from "@fittrack/validators";

import { useTheme } from "@/contexts/ThemeContext";
import { useMembers } from "@/contexts/MemberContext";
import { useAuth } from "@/contexts/AuthContext";
import { WEB_API_BASE_URL, webApiClient } from "@/lib/api-client";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useDebounce, useLoadingText } from "@fittrack/hooks";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { getBrowserViewportState } from "@/utils/browserViewport";
import {
  buildRenderableAssetUrl,
  fullName,
} from "@fittrack/utils";
import {
  EDIT_MEMBER_FIELDS,
  MEMBER_FILTER_OPTIONS,
  MEMBER_STATUS_TABS,
  MEMBERSHIP_CARD_STATUS_COLORS,
  STATUS_COLORS,
  type DeletionRequest,
  type MemberStatusTab,
} from "@/data/members/members";
import type {
  AttendanceCheckInRecord,
  MemberRecord,
  MembershipCardRecord,
} from "@fittrack/types";

import {
  FitButton,
  FitPill,
  FitSearch,
  FitSection,
  FitSelect,
  FitText,
} from "@/components/fit";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { ConfirmModal, DetailsModal, FitModal } from "@/components/modals";
import {
  filterMembers,
  getDirectoryMemberStatus,
  getPendingRequestsByUserId,
  MIN_ACTION_DELAY_MS,
} from "./helpers";
import AttendanceScanModal, {
  type AttendanceScanFeedback,
} from "./AttendanceScanModal";
import AddUserPanel from "./AddUserPanel";
import MemberInspectorPanel from "./MemberInspectorPanel";
import MembersDirectoryPanel from "./MembersDirectoryPanel";

type ContentMode = "directory" | "create";
type DirectoryViewMode = "list" | "grid";

const LIST_ROWS_PER_PAGE = 10;
const GRID_ROWS_PER_PAGE = 8;
const USE_MODAL_INSPECTOR = false;
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

function formatMembershipAccess(
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

function getMembershipAccessLabel(member: MemberRecord | null) {
  return formatMembershipAccess(getMembershipFieldValue(member));
}

function getDirectoryRoleLabel(roleName?: string | null) {
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
    minute: "2-digit",
  });
}

function formatDisplayDate(value?: string | null) {
  if (!value) return "Not provided";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not provided";

  return parsed.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDisplayDateTime(value?: string | null) {
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

function formatDetailValue(value?: string | number | null) {
  if (value == null) return "Not provided";
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : "Not provided";
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

  return accessLabel;
}

function getDirectoryStatusLabel(
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
    accessLabel === "Non-member" ||
    accessLabel === "Revoked"
  )
    return "Pending";

  return "Active";
}

function getDirectoryStatusColor(
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

function getEditDraftValues(
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
  const { colors, onBrandTextColor } = useTheme();
  const { user } = useAuth();
  const {
    members,
    isLoading,
    error: membersError,
    fetchMembers,
    createUser,
    updateMember,
    deleteUser,
    restoreUser,
  } = useMembers();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
  const canInspectAccounts = isAdmin || isStaff;
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 250);
  const [activeChip, setActiveChip] = useState("all");
  const [activeStatus, setActiveStatus] = useState<MemberStatusTab>("All");
  const [viewMode, setViewMode] = useState<DirectoryViewMode>("list");
  const isTerminationRequestsView = activeStatus === "Termination Requests";
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();

  const [addLoading, setAddLoading] = useState(false);
  const addLoadingLabel = useLoadingText("ADDING USER", addLoading);

  const [editTarget, setEditTarget] = useState<MemberRecord | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>(
    getEditDraftValues(null),
  );
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [pendingEditSubmission, setPendingEditSubmission] = useState<Record<
    string,
    string
  > | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MemberRecord | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MemberRecord | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<MemberRecord | null>(null);
  const [grantCardTarget, setGrantCardTarget] = useState<MemberRecord | null>(
    null,
  );
  const [revokeCardTarget, setRevokeCardTarget] = useState<MemberRecord | null>(
    null,
  );
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanFeedback, setScanFeedback] =
    useState<AttendanceScanFeedback | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [isAccountsHamburgerMode, setIsAccountsHamburgerMode] = useState(false);
  const [paymentReviewAction, setPaymentReviewAction] = useState<
    "approve" | "reject" | null
  >(null);
  const { data: deletionRequests = [], error: deletionRequestsError } =
    useQuery({
      ...adminDeletionRequestsQueryOptions<DeletionRequest>(webApiClient),
      enabled: canInspectAccounts,
    });
  const {
    data: pendingMembershipPayments = {
      data: [],
      meta: { page: 1, limit: 0, total: 0, total_pages: 0 },
    },
    error: pendingMembershipPaymentsError,
  } = useQuery({
    ...reviewMembershipPaymentsQueryOptions(webApiClient, {
      limit: 50,
      page: 1,
      status: "awaiting_verification",
    }),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (canInspectAccounts) void fetchMembers();
  }, [canInspectAccounts, fetchMembers]);

  useEffect(() => {
    const evaluateViewportMode = () => {
      const { isBrowserWindowResized, viewportWidth } =
        getBrowserViewportState();

      setIsAccountsHamburgerMode(isBrowserWindowResized || viewportWidth < 1260);
    };

    evaluateViewportMode();
    window.addEventListener("resize", evaluateViewportMode);
    window.visualViewport?.addEventListener("resize", evaluateViewportMode);
    return () => {
      window.removeEventListener("resize", evaluateViewportMode);
      window.visualViewport?.removeEventListener("resize", evaluateViewportMode);
    };
  }, []);

  useEffect(() => {
    if (!isAccountsHamburgerMode) {
      setMobileInspectorOpen(false);
    }
  }, [isAccountsHamburgerMode]);

  useEffect(() => {
    if (!membersError || !canInspectAccounts) return;
    notify("error", "Could not load the account directory", membersError);
  }, [canInspectAccounts, membersError]);

  useEffect(() => {
    if (!deletionRequestsError || !canInspectAccounts) return;
    notifyActionError(
      "Termination requests could not be loaded",
      deletionRequestsError,
      "Failed to load pending termination requests.",
    );
  }, [canInspectAccounts, deletionRequestsError]);

  useEffect(() => {
    if (!pendingMembershipPaymentsError || !isAdmin) return;
    notifyActionError(
      "Payment reviews could not be loaded",
      pendingMembershipPaymentsError,
      "Failed to load pending membership payment reviews.",
    );
  }, [isAdmin, pendingMembershipPaymentsError]);

  const roleScopedMembers = useMemo(() => {
    return members.filter((member) => {
      if (isStaff) {
        return member.role?.name !== "ADMIN";
      }

      return true;
    });
  }, [isStaff, members]);

  const pendingRequestsByUserId = useMemo(
    () =>
      canInspectAccounts
        ? getPendingRequestsByUserId(deletionRequests)
        : new Map<string, DeletionRequest>(),
    [canInspectAccounts, deletionRequests],
  );
  const membershipReviewPayments = useMemo(
    () =>
      pendingMembershipPayments.data.filter(
        (payment) =>
          payment.payable_type === "subscription" ||
          payment.payable_type === "membership_card",
      ),
    [pendingMembershipPayments.data],
  );
  const pendingMembershipPayment = useMemo(
    () =>
      editTarget
        ? membershipReviewPayments.find(
            (payment) => payment.user_id === editTarget.id,
          )
        : undefined,
    [editTarget, membershipReviewPayments],
  );
  const [contentMode, setContentMode] = useState<ContentMode>("directory");
  useEffect(() => {
    if (contentMode !== "directory") {
      setEditTarget(null);
      setEditModalOpen(false);
      setEditConfirmOpen(false);
      setPendingEditSubmission(null);
    }
  }, [contentMode]);
  const primaryCommandTextColor = onBrandTextColor;
  const [page, setPage] = useState(1);
  const directoryPageSize =
    viewMode === "grid" ? GRID_ROWS_PER_PAGE : LIST_ROWS_PER_PAGE;

  const filtered = useMemo(
    () =>
      filterMembers(
        roleScopedMembers,
        debouncedQ,
        activeChip,
        activeStatus,
        pendingRequestsByUserId,
      ),
    [
      roleScopedMembers,
      debouncedQ,
      activeChip,
      activeStatus,
      pendingRequestsByUserId,
    ],
  );

  useEffect(() => setPage(1), [debouncedQ, activeChip, activeStatus, viewMode]);

  useEffect(() => {
    if (isTerminationRequestsView && activeChip !== "Member") {
      setActiveChip("Member");
    }
  }, [activeChip, isTerminationRequestsView]);

  useEffect(() => {
    if (isStaff && activeChip === "Admin") {
      setActiveChip("all");
    }
  }, [activeChip, isStaff]);

  useEffect(() => {
    if (contentMode !== "directory" || !editTarget) return;
    const matchedMember = filtered.find(
      (member) => member.id === editTarget.id,
    );
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
    const maxPage = Math.max(1, Math.ceil(filtered.length / directoryPageSize));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [directoryPageSize, filtered.length, page]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * directoryPageSize;
    return filtered.slice(start, start + directoryPageSize);
  }, [directoryPageSize, filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / directoryPageSize));
  const editInitialValues = useMemo(
    () => getEditDraftValues(editTarget),
    [editTarget],
  );
  const archiveLoadingLabel = useLoadingText(
    "ARCHIVING ACCOUNT",
    archiveLoading,
  );

  useEffect(() => {
    setEditDraft(editInitialValues);
  }, [editInitialValues]);

  useEffect(() => {
    if (
      contentMode !== "directory" ||
      !editTarget ||
      editModalOpen ||
      editConfirmOpen
    )
      return;
    if (paginatedRows.some((member) => member.id === editTarget.id)) return;
    setEditTarget(null);
  }, [contentMode, editConfirmOpen, editModalOpen, editTarget, paginatedRows]);

  useEffect(() => {
    if (editTarget) return;
    setEditModalOpen(false);
    setEditConfirmOpen(false);
    setPendingEditSubmission(null);
    setMobileInspectorOpen(false);
  }, [editTarget]);

  const editPendingRequest = editTarget
    ? pendingRequestsByUserId.get(editTarget.id)
    : undefined;
  const isEditTargetArchived = editTarget
    ? getDirectoryMemberStatus(editTarget, pendingRequestsByUserId) ===
      "Archived"
    : false;
  const isSelfEdit = editTarget?.id === user?.id;
  const hasEditChanges = useMemo(() => {
    if (!editTarget) return false;
    const initialValues = getEditDraftValues(editTarget);
    return EDIT_MEMBER_EDITABLE_KEYS.some(
      (key) =>
        normalizeDraftValue(editDraft[key]) !==
        normalizeDraftValue(initialValues[key]),
    );
  }, [editDraft, editTarget]);
  const canArchiveEditTarget = Boolean(
    (isAdmin || (isStaff && editTarget?.role?.name === "USER")) &&
    editTarget &&
    !isSelfEdit &&
    editTarget.role?.name !== "ADMIN" &&
    !editPendingRequest &&
    !isEditTargetArchived,
  );
  const canTerminateEditTarget = Boolean(
    isAdmin && !isSelfEdit && editPendingRequest,
  );
  const canRestoreEditTarget = Boolean(
    editTarget &&
      !isSelfEdit &&
      isEditTargetArchived &&
      editTarget.role?.name !== "ADMIN" &&
      (isAdmin || (isStaff && editTarget.role?.name === "USER")),
  );
  const canEditTargetDetails = Boolean(
    canInspectAccounts && editTarget && !isSelfEdit,
  );
  const canManualCheckInTarget = Boolean(
    canInspectAccounts &&
    editTarget &&
    !isSelfEdit &&
    editTarget.role?.name === "USER" &&
    (editTarget.status === "active" || editTarget.status === "pending") &&
    !editPendingRequest &&
    !isEditTargetArchived,
  );
  const canManageMemberCard = Boolean(
    canInspectAccounts &&
    editTarget &&
    !isSelfEdit &&
    editTarget.role?.name === "USER",
  );

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
      phone_no: data.phone_no,
    });
    setAddLoading(false);
    if (result.success) {
      setContentMode("directory");
      notify(
        "success",
        `${role === "admin" ? "Admin" : role === "staff" ? "Staff" : "Member"} account created`,
        "Verification OTP sent to the account email.",
      );
      return;
    }
    notify(
      "error",
      "Could not create account",
      result.error ?? "Check the form details and try again.",
    );
  };

  const approveDeletionMutation = useMutation(
    approveDeletionRequestMutationOptions(webApiClient, queryClient, {
      reviewNotes: "Approved via account module.",
    }),
  );

  const rejectDeletionMutation = useMutation(
    rejectDeletionRequestMutationOptions(webApiClient, queryClient, {
      reviewNotes: "Rejected via account module.",
    }),
  );
  const membershipCardMutation = useMutation(
    updateAdminMembershipCardMutationOptions(webApiClient, queryClient),
  );
  const scanAttendanceMutation = useMutation(
    scanAttendanceQrMutationOptions(webApiClient, queryClient),
  );
  const manualAttendanceMutation = useMutation(
    manualAttendanceCheckInMutationOptions(webApiClient, queryClient),
  );
  const membershipPaymentReviewMutation = useMutation(
    verifyMembershipPaymentMutationOptions(webApiClient, queryClient),
  );

  const rejectLoadingLabel = useLoadingText(
    "REJECTING REQUEST",
    rejectDeletionMutation.isPending,
  );
  const approveRequestLoadingLabel = useLoadingText(
    "APPROVING REQUEST",
    approveDeletionMutation.isPending,
  );
  const membershipCardLoadingLabel = useLoadingText(
    "UPDATING MEMBERSHIP",
    membershipCardMutation.isPending,
  );
  const manualCheckInLoadingLabel = useLoadingText(
    "CHECKING IN",
    manualAttendanceMutation.isPending,
  );
  const paymentReviewLoadingLabel = useLoadingText(
    "UPDATING PAYMENT",
    membershipPaymentReviewMutation.isPending,
  );
  const editLoadingLabel = useLoadingText("UPDATING MEMBER", editLoading);
  const restoreLoadingLabel = useLoadingText(
    "RESTORING ACCOUNT",
    restoreLoading,
  );
  const pageLoading = isLoading;

  const openInspector = (member: MemberRecord) => {
    const isSelectedAgain = editTarget?.id === member.id;
    setEditTarget(isSelectedAgain ? null : member);
    if (isAccountsHamburgerMode) {
      setMobileInspectorOpen(!isSelectedAgain);
    }
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
    setGrantCardTarget(null);
    setRevokeCardTarget(null);
    setArchiveTarget(null);
    setRestoreTarget(null);
    setEditTarget(null);
    setMobileInspectorOpen(false);
  };

  const patchOpenMember = (memberId: string, patch: Partial<MemberRecord>) => {
    setEditTarget((current) =>
      current?.id === memberId ? { ...current, ...patch } : current,
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const request = pendingRequestsByUserId.get(deleteTarget.id);
    if (!request) {
      notify(
        "warning",
        "Termination request missing",
        "Refresh the page if this request was already handled elsewhere.",
      );
      setDeleteTarget(null);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, MIN_ACTION_DELAY_MS));
    try {
      await approveDeletionMutation.mutateAsync(request.id);
      setDeleteTarget(null);
      closeInspector();
      notify(
        "success",
        "Termination request approved",
        "The account was soft-deleted and moved to Archived.",
      );
    } catch {
      notify(
        "error",
        "Could not approve the request",
        "Try again after the latest request state has loaded.",
      );
    }
  };

  const handleRejectDeleteRequest = async () => {
    if (!editTarget) return;
    const request = pendingRequestsByUserId.get(editTarget.id);
    if (!request) {
      notify(
        "warning",
        "Termination request missing",
        "Refresh the page if this request was already handled elsewhere.",
      );
      return;
    }
    try {
      await rejectDeletionMutation.mutateAsync(request.id);
      closeInspector();
      notify(
        "success",
        "Termination request denied",
        "The account stays active in the directory.",
      );
    } catch {
      notify(
        "error",
        "Could not deny the request",
        "Try again after the latest request state has loaded.",
      );
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
      notify(
        "success",
        `${memberName} archived`,
        "The account has been moved out of the active directory.",
      );
      return;
    }
    notify(
      "error",
      "Could not archive this person",
      result.error ?? "Try again after the directory refreshes.",
    );
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
      notify(
        "success",
        `${memberName} restored`,
        "The account is back in the active directory.",
      );
      return;
    }
    notify(
      "error",
      "Could not restore this person",
      result.error ?? "Try again after the directory refreshes.",
    );
  };

  const handleGrantMembershipCard = async () => {
    const target = grantCardTarget ?? editTarget;
    if (!target || target.role?.name !== "USER") return;
    const cardStatus = getMembershipFieldValue(target);

    try {
      const result = await membershipCardMutation.mutateAsync({
        id: target.id,
        payload: {
          action: "grant",
          source: cardStatus === "revoked" ? "admin_repair" : "admin_grant",
        },
      });

      patchOpenMember(target.id, {
        membershipCard: (result.membershipCard ??
          null) as MembershipCardRecord | null,
      });
      setGrantCardTarget(null);
      notify("success", "Member access updated", result.message);
    } catch (error) {
      notifyActionError(
        "Could not update member access",
        error,
        "Failed to update membership-card access.",
      );
    }
  };

  const handleRevokeMembershipCard = async () => {
    if (!revokeCardTarget) return;

    try {
      const result = await membershipCardMutation.mutateAsync({
        id: revokeCardTarget.id,
        payload: {
          action: "revoke",
          reason: "Revoked via account module.",
          source: "admin_repair",
        },
      });

      patchOpenMember(revokeCardTarget.id, {
        membershipCard: (result.membershipCard ??
          null) as MembershipCardRecord | null,
      });
      setRevokeCardTarget(null);
      notify("success", "Member access updated", result.message);
    } catch (error) {
      notifyActionError(
        "Could not update member access",
        error,
        "Failed to revoke membership-card access.",
      );
    }
  };

  const handleManualCheckIn = async (member: MemberRecord) => {
    try {
      const result = await manualAttendanceMutation.mutateAsync({
        userId: member.id,
      });
      patchOpenMember(member.id, { lastCheckInAt: result.check_in_at });
      notify(
        "success",
        `${result.member_name} checked in`,
        `Attendance recorded ${formatLastCheckIn(result.check_in_at)}.`,
      );
    } catch (error) {
      notifyActionError(
        "Could not check in this account",
        error,
        "Failed to manually check in this account.",
      );
    }
  };

  const handleAttendanceScan = async (qrValue: string) => {
    const trimmedQrValue = qrValue.trim();
    if (!trimmedQrValue) {
      setScanFeedback({
        tone: "error",
        title: "Scan failed",
        detail: "A QR code value is required before attendance can be logged.",
      });
      notify(
        "error",
        "QR code required",
        "Add or scan a QR value before logging attendance.",
      );
      return;
    }

    try {
      const result: AttendanceCheckInRecord =
        await scanAttendanceMutation.mutateAsync({
          qrValue: trimmedQrValue,
        });
      setScanFeedback({
        tone: "success",
        title: `Checked in ${result.member_name}`,
        detail: `Attendance recorded ${formatLastCheckIn(result.check_in_at)}.`,
      });
      notify(
        "success",
        `Checked in ${result.member_name}`,
        `Attendance recorded ${formatLastCheckIn(result.check_in_at)}.`,
      );
    } catch (error) {
      const detail = getActionErrorMessage(
        error,
        "Unable to scan this QR code.",
      );
      const tone = /already|open attendance/i.test(detail)
        ? "warning"
        : "error";
      setScanFeedback({
        tone,
        title: tone === "warning" ? "Already checked in" : "Scan failed",
        detail,
      });
      notify(
        tone,
        tone === "warning" ? "Attendance already logged" : "Scan failed",
        detail,
      );
    }
  };

  const handleApproveMembershipPayment = async () => {
    if (!pendingMembershipPayment) return;
    const reviewLabel = getMembershipPaymentReviewLabel(
      pendingMembershipPayment.payable_type,
    );
    try {
      await membershipPaymentReviewMutation.mutateAsync({
        paymentId: pendingMembershipPayment.id,
        payload: { action: "approve" },
        affectedUserId: pendingMembershipPayment.user_id,
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
            verifiedAt: new Date().toISOString(),
          } as MembershipCardRecord,
        });
        await fetchMembers();
      }
      notify(
        "success",
        "Payment review approved",
        `${formatReviewPayableLabel(pendingMembershipPayment.payable_type)} has been marked as approved.`,
      );
    } catch {
      notify(
        "error",
        "Could not approve the payment review",
        `Try again while the ${reviewLabel} request is still pending.`,
      );
    } finally {
      setPaymentReviewAction(null);
    }
  };

  const handleRejectMembershipPayment = async () => {
    if (!pendingMembershipPayment) return;
    const reviewLabel = getMembershipPaymentReviewLabel(
      pendingMembershipPayment.payable_type,
    );
    try {
      await membershipPaymentReviewMutation.mutateAsync({
        paymentId: pendingMembershipPayment.id,
        payload: {
          action: "reject",
          rejectionReason: "Rejected via account module.",
        },
        affectedUserId: pendingMembershipPayment.user_id,
      });
      if (pendingMembershipPayment.payable_type === "membership_card") {
        patchOpenMember(pendingMembershipPayment.user_id, {
          membershipCard: {
            ...(editTarget?.membershipCard ?? { status: "revoked" }),
            revokeReason: "Rejected via account module.",
            revokedAt: new Date().toISOString(),
            status: "revoked",
          } as MembershipCardRecord,
        });
        await fetchMembers();
      }
      notify(
        "success",
        "Payment review declined",
        `${formatReviewPayableLabel(pendingMembershipPayment.payable_type)} remains blocked for now.`,
      );
    } catch {
      notify(
        "error",
        "Could not decline the payment review",
        `Try again while the ${reviewLabel} request is still pending.`,
      );
    } finally {
      setPaymentReviewAction(null);
    }
  };

  const queueEditConfirmation = (data: Record<string, string>) => {
    if (!hasEditChanges) return;
    setEditDraft(data);
    setPendingEditSubmission(data);
    setEditModalOpen(false);
    setEditConfirmOpen(true);
  };

  const handleEdit = async (data: Record<string, string>) => {
    if (!editTarget || !canEditTargetDetails) {
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
          dateOfBirth:
            nextDateOfBirth || editTarget.profile?.dateOfBirth || null,
          gender: nextGender || editTarget.profile?.gender || null,
          activityLevel:
            nextActivityLevel || editTarget.profile?.activityLevel || null,
          fitnessGoal:
            nextFitnessGoal || editTarget.profile?.fitnessGoal || null,
          currentWeightKg:
            nextWeight ?? editTarget.profile?.currentWeightKg ?? null,
          heightCm: nextHeight ?? editTarget.profile?.heightCm ?? null,
        },
      });
      setEditModalOpen(false);
      setEditConfirmOpen(false);
      setPendingEditSubmission(null);
      notify(
        "success",
        "Account details updated",
        "The account modal now reflects the saved changes.",
      );
      return;
    }
    setEditConfirmOpen(false);
    setPendingEditSubmission(null);
    setEditModalOpen(true);
    notify(
      "error",
      "Could not update account details",
      result.error ?? "Review the highlighted values and try again.",
    );
  };

  const handleMessageMember = (member: MemberRecord) => {
    if (!member.email.trim()) {
      notify(
        "info",
        "No email available",
        "This account cannot be contacted by email yet.",
      );
      return;
    }

    window.location.href = `mailto:${member.email}`;
  };

  const memberColumns: FitTableColumn<MemberRecord>[] = [
    {
      key: "name",
      heading: "NAME",
      render: (member, c) => {
        const avatarUrl = getMemberAvatarUrl(member);
        const initials = getMemberInitials(member);

        return (
          <div
            className="members-directory-panel__identity"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <div
              className="members-directory-panel__identity-avatar"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: c.surfaceRaised,
                border: `1px solid ${c.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <FitText
                style={{
                  fontSize: 10.5,
                  fontWeight: 850,
                  color: c.brand,
                  letterSpacing: "0.03em",
                }}
              >
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
                    objectFit: "cover",
                  }}
                />
              ) : null}
            </div>
            <div
              className="members-directory-panel__identity-copy"
              style={{ display: "grid", gap: 3, minWidth: 0 }}
            >
              <FitText
                className="members-directory-panel__primary-text"
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: c.textPrimary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {fullName(member) || "Unnamed account"}
              </FitText>
              <FitText
                className="members-directory-panel__secondary-text"
                style={{
                  fontSize: 11,
                  color: c.textSecondary,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {member.email}
              </FitText>
            </div>
          </div>
        );
      },
    },
    {
      key: "userType",
      heading: "USER TYPE",
      render: (member, c) => (
        <FitText
          className="members-directory-panel__emphasis-text"
          style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary }}
        >
          {getDirectoryRoleLabel(member.role?.name)}
        </FitText>
      ),
    },
    {
      key: "status",
      heading: "STATUS",
      render: (member, c) => {
        const statusLabel = getDirectoryStatusLabel(
          member,
          pendingRequestsByUserId,
        );
        const profileTone = getDirectoryStatusColor(
          member,
          pendingRequestsByUserId,
          c.warning,
        );

        return (
          <FitPill
            mode="status"
            label={statusLabel}
            color={profileTone ?? c.textMuted}
            fontSize={9}
          />
        );
      },
    },
    {
      key: "tier",
      heading: "TIER",
      render: (member, c) => {
        const accessLabel = getDirectoryAccessLabel(
          member,
          pendingRequestsByUserId,
        );

        return (
          <FitText
            className="members-directory-panel__emphasis-text"
            style={{ fontSize: 12, fontWeight: 700, color: c.textPrimary }}
          >
            {accessLabel}
          </FitText>
        );
      },
    },
    {
      key: "lastCheckIn",
      heading: "LAST CHECK-IN",
      render: (member, c) => (
        <FitText
          className="members-directory-panel__emphasis-text"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: member.lastCheckInAt ? c.textPrimary : c.textSecondary,
          }}
        >
          {formatLastCheckIn(member.lastCheckInAt)}
        </FitText>
      ),
    },
  ];

  const renderMobileCard = (member: MemberRecord) => {
    const avatarUrl = getMemberAvatarUrl(member);
    const statusLabel = getDirectoryStatusLabel(
      member,
      pendingRequestsByUserId,
    );
    const roleLabel = getDirectoryRoleLabel(member.role?.name);
    const showRoleLabel = member.role?.name !== "USER";
    const accessLabel = getDirectoryAccessLabel(
      member,
      pendingRequestsByUserId,
    );
    const initials = getMemberInitials(member);

    return (
      <div
        className="members-account-card"
        style={{
          display: "grid",
          gap: 14,
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
          boxShadow: "0 12px 24px rgba(0,0,0,0.10)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 0,
              flex: "1 1 240px",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <FitText
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: colors.surfaceRaised,
                  letterSpacing: "0.04em",
                }}
              >
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
                    objectFit: "cover",
                  }}
                />
              ) : null}
            </div>
            <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
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
                  color={getDirectoryStatusColor(
                    member,
                    pendingRequestsByUserId,
                    colors.warning,
                  )}
                  fontSize={10}
                />
              </div>
              <FitText
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: colors.textPrimary,
                }}
              >
                {fullName(member) || "Unnamed account"}
              </FitText>
              <FitText style={{ fontSize: 12.5, color: colors.textSecondary }}>
                {member.email}
              </FitText>
            </div>
          </div>
          <FitPill
            mode="status"
            label={accessLabel}
            color={
              MEMBERSHIP_CARD_STATUS_COLORS[accessLabel] ?? colors.textMuted
            }
            fontSize={11}
          />
        </div>
        <div
          className="members-mobile-meta-grid"
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          }}
        >
          <div style={{ display: "grid", gap: 5 }}>
            <FitText
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: colors.textMuted,
                letterSpacing: "0.06em",
              }}
            >
              LAST ACTIVITY
            </FitText>
            <FitText style={{ fontSize: 12.5, color: colors.textSecondary }}>
              {formatLastCheckIn(member.lastCheckInAt)}
            </FitText>
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            <FitText
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: colors.textMuted,
                letterSpacing: "0.06em",
              }}
            >
              ACCESS
            </FitText>
            <FitText
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: colors.textSecondary,
              }}
            >
              {accessLabel}
            </FitText>
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            <FitText
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: colors.textMuted,
                letterSpacing: "0.06em",
              }}
            >
              ACCOUNT
            </FitText>
            <FitPill
              mode="status"
              label={statusLabel}
              color={getDirectoryStatusColor(
                member,
                pendingRequestsByUserId,
                colors.warning,
              )}
              fontSize={12}
            />
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            <FitText
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: colors.textMuted,
                letterSpacing: "0.06em",
              }}
            >
              SCAN
            </FitText>
            <FitText
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: member.attendanceQrReady
                  ? colors.brand
                  : colors.textSecondary,
              }}
            >
              {getScanReadinessLabel(member)}
            </FitText>
          </div>
        </div>
      </div>
    );
  };

  const renderGridCard = (member: MemberRecord) => {
    const avatarUrl = getMemberAvatarUrl(member);
    const statusLabel = getDirectoryStatusLabel(
      member,
      pendingRequestsByUserId,
    );
    const accessLabel = getDirectoryAccessLabel(
      member,
      pendingRequestsByUserId,
    );
    const initials = getMemberInitials(member);

    return (
      <div
        className="members-grid-card"
        style={{
          display: "grid",
          gridTemplateRows: "46px 42px 38px 38px",
          justifyItems: "center",
          alignContent: "space-between",
          gap: 10,
          minHeight: 180,
          padding: "14px 10px",
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          boxShadow: "none",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 8,
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <FitText
            style={{
              fontSize: 15,
              fontWeight: 850,
              color: colors.brand,
              letterSpacing: "0.03em",
            }}
          >
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
                objectFit: "cover",
              }}
            />
          ) : null}
        </div>
        <div style={{ display: "grid", gap: 2, width: "100%", minWidth: 0 }}>
          <FitText
            style={{
              fontSize: 13.5,
              fontWeight: 850,
              color: colors.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fullName(member) || "Unnamed account"}
          </FitText>
          <FitText
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: colors.textSecondary,
            }}
          >
            {getDirectoryRoleLabel(member.role?.name)}
          </FitText>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
          <FitPill
            mode="status"
            label={statusLabel}
            color={getDirectoryStatusColor(
              member,
              pendingRequestsByUserId,
              colors.warning,
            )}
            fontSize={10}
          />
          <FitPill
            mode="status"
            label={accessLabel}
            color={MEMBERSHIP_CARD_STATUS_COLORS[accessLabel] ?? colors.textMuted}
            fontSize={10}
            borderOpacity="35"
            bgOpacity="12"
          />
        </div>
        <div style={{ display: "grid", gap: 2 }}>
          <FitText
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: colors.textMuted,
              letterSpacing: "0.04em",
            }}
          >
            Last Check-in
          </FitText>
          <FitText
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: member.lastCheckInAt ? colors.textPrimary : colors.textSecondary,
            }}
          >
            {formatLastCheckIn(member.lastCheckInAt)}
          </FitText>
        </div>
      </div>
    );
  };

  const isCreateMode = contentMode === "create";
  const roleVisibleFilterOptions = isStaff
    ? MEMBER_FILTER_OPTIONS.filter((option) => option.value !== "Admin")
    : MEMBER_FILTER_OPTIONS;
  const roleSelectOptions = roleVisibleFilterOptions.map((option) => ({
    label: option.label,
    value: option.value,
  }));
  const directoryEmptyMessage = isTerminationRequestsView
    ? "No termination requests match your current filters."
    : "No accounts match your current filters.";
  const statusSelectOptions = MEMBER_STATUS_TABS.map((option) => ({
    label: option.key === "Termination Requests" ? "Requests" : option.label,
    value: option.key,
  }));
  const directoryToolbar = (
    <div
      className="members-directory-toolbar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        minHeight: 40,
      }}
    >
      <div
        className="members-directory-toolbar-left"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          flex: "1 1 360px",
        }}
      >
        <div
          className="members-directory-search"
          style={{ flex: "1 1 250px", minWidth: 220, maxWidth: 320 }}
        >
          <FitSearch
            id="members_people_search"
            name="members_people_search"
            ariaLabel="Search accounts by name, email, or mobile number"
            value={q}
            onChangeText={setQ}
            placeholder="Search accounts..."
          />
        </div>
      </div>
      <div
        className="members-directory-toolbar-right"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          flex: "1 1 520px",
          minWidth: 0,
          marginLeft: "auto",
          flexWrap: "wrap",
        }}
      >
        <div
          className="members-view-toggle"
          aria-label="Account view mode"
          style={{
            display: "inline-flex",
            gap: 4,
            padding: 3,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
            flex: "0 0 auto",
          }}
        >
          <FitButton
            variant="chip"
            icon={List}
            iconOnly
            iconSize={15}
            active={viewMode === "list"}
            title="List view"
            aria-label="Show accounts as a list"
            onClick={() => setViewMode("list")}
            style={{ minHeight: 31, width: 33, borderRadius: 7 }}
          />
          <FitButton
            variant="chip"
            icon={LayoutGrid}
            iconOnly
            iconSize={15}
            active={viewMode === "grid"}
            title="Grid view"
            aria-label="Show accounts as a grid"
            onClick={() => setViewMode("grid")}
            style={{ minHeight: 31, width: 33, borderRadius: 7 }}
          />
        </div>
        <div
          className="members-toolbar-status-filter"
          style={{
            display: "grid",
            gridTemplateColumns: "14px minmax(96px, 124px)",
            alignItems: "center",
            gap: 6,
            flex: "0 0 auto",
            minWidth: 0,
          }}
        >
          <Filter size={14} color={colors.textMuted} strokeWidth={2} />
          <FitSelect
            compact
            fullWidth
            aria-label="Filter accounts by status"
            name="membersStatusFilter"
            value={activeStatus}
            options={statusSelectOptions}
            onChange={(event) => {
              const nextStatus = event.target.value as MemberStatusTab;
              setActiveStatus(nextStatus);
              if (nextStatus === "Termination Requests") {
                setActiveChip("Member");
              }
            }}
            style={{
              width: "100%",
              minWidth: 0,
              height: 38,
              borderRadius: 8,
              paddingLeft: 8,
              paddingRight: 22,
              fontSize: 12,
            }}
          />
        </div>
        <div
          className="members-toolbar-filters"
          style={{
            display: "grid",
            gridTemplateColumns: "14px minmax(82px, 102px)",
            alignItems: "center",
            gap: 6,
            flex: "0 0 auto",
            minWidth: 0,
          }}
        >
          <Filter size={14} color={colors.textMuted} strokeWidth={2} />
          <FitSelect
            compact
            fullWidth
            aria-label="Filter accounts by role"
            name="membersRoleFilter"
            value={activeChip}
            options={roleSelectOptions}
            onChange={(event) => {
              const nextRole = event.target.value;
              if (isTerminationRequestsView && nextRole !== "Member") return;
              setActiveChip(nextRole);
            }}
            style={{
              width: "100%",
              minWidth: 0,
              height: 38,
              borderRadius: 8,
              paddingLeft: 8,
              paddingRight: 22,
              fontSize: 12,
            }}
          />
        </div>
      </div>
    </div>
  );
  const accountInspectorCommandRow =
    canInspectAccounts || isAdmin ? (
      <div
        className="members-inspector-command-row"
        style={{
          display: "grid",
          gridTemplateColumns: isAdmin ? "minmax(0, 0.86fr) minmax(0, 1fr)" : "1fr",
          gap: 8,
          minWidth: 0,
        }}
      >
        {isAdmin ? (
          <FitButton
            variant="ghost"
            label="SCAN QR"
            icon={ScanLine}
            iconSize={14}
            title="Scan QR Attendance"
            aria-label="Scan QR Attendance"
            style={{
              minHeight: 40,
              borderRadius: 8,
              paddingInline: 8,
              border: `1px solid ${colors.brand}42`,
              backgroundColor: colors.surfaceRaised,
              color: colors.brand,
            }}
            onClick={() => {
              setScanOpen(true);
              setScanFeedback(null);
            }}
            textStyle={{
              color: colors.brand,
              fontSize: 10.75,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          />
        ) : null}
        {canInspectAccounts ? (
          <FitButton
            variant="primary"
            label="CREATE ACCOUNT"
            icon={UserPlus}
            iconSize={14}
            style={{
              backgroundColor: colors.brand,
              color: primaryCommandTextColor,
              border: `1px solid ${colors.brand}`,
              minHeight: 40,
              borderRadius: 8,
              paddingInline: 10,
            }}
            onClick={() => {
              setContentMode("create");
            }}
            textStyle={{
              color: primaryCommandTextColor,
              fontSize: 10.75,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          />
        ) : null}
      </div>
    ) : null;
  const secondaryActionStyle = {
    border: `1px solid ${colors.border}`,
    backgroundColor: `${colors.surfaceRaised}cc`,
    borderRadius: 8,
    minHeight: 42,
  };

  const primaryActionStyle = {
    backgroundColor: colors.brand,
    color: primaryCommandTextColor,
    border: `1px solid ${colors.brand}`,
    borderRadius: 8,
    minHeight: 42,
  };

  const warningActionStyle = {
    border: `1px solid ${colors.danger}45`,
    backgroundColor: `${colors.danger}10`,
    borderRadius: 8,
    minHeight: 42,
  };
  const emptyAccountValue = "N/A";
  const detailsCardStyle = {
    display: "grid",
    gridTemplateColumns: "122px minmax(0, 1fr)",
    gap: 22,
    alignItems: "start",
    padding: "13px 0",
    borderBottom: `1px solid ${colors.border}`,
  };
  const accountDetailsAvatarUrl = editTarget
    ? getMemberAvatarUrl(editTarget)
    : null;
  const accountDetailsTitle = editTarget
    ? fullName(editTarget) || "Unnamed account"
    : emptyAccountValue;
  const accountActionLabel = canRestoreEditTarget
    ? "Restore Account"
    : "Archive Account";
  const accountLifecycleActionStyle = canRestoreEditTarget
    ? {
        border: `1px solid ${colors.brand}42`,
        backgroundColor: `${colors.brand}10`,
        borderRadius: 8,
        minHeight: 42,
      }
    : warningActionStyle;
  const accountLifecycleActionColor = canRestoreEditTarget
    ? colors.brand
    : colors.danger;
  const accountStatusLabel = editTarget
    ? getDirectoryStatusLabel(editTarget, pendingRequestsByUserId)
    : emptyAccountValue;
  const editTargetMembershipStatus = editTarget
    ? getMembershipFieldValue(editTarget)
    : "none";
  const memberCardActionLabel =
    editTargetMembershipStatus === "active"
      ? "Revoke Membership"
      : editTargetMembershipStatus === "revoked"
      ? "Restore Membership"
      : "Grant Membership";
  const membershipActionTone =
    editTargetMembershipStatus === "active"
      ? {
          color: colors.danger,
          border: `1px solid ${colors.danger}42`,
          backgroundColor: `${colors.danger}10`,
        }
      : editTargetMembershipStatus === "revoked"
        ? {
            color: colors.brand,
            border: `1px solid ${colors.brand}42`,
            backgroundColor: `${colors.brand}10`,
          }
        : {
            color: colors.brand,
            border: `1px solid ${colors.brand}42`,
            backgroundColor: colors.surfaceRaised,
          };
  const memberCardGrantedAt =
    editTarget?.membershipCard?.activatedAt ??
    editTarget?.membershipCard?.verifiedAt ??
    editTarget?.membershipCard?.purchasedAt ??
    null;
  const memberCardVerifiedAt = editTarget?.membershipCard?.verifiedAt ?? null;
  const memberCardActivatedAt = editTarget?.membershipCard?.activatedAt ?? null;
  const memberCardWasRestored =
    editTarget?.membershipCard?.status === "active" &&
    !!memberCardVerifiedAt &&
    (editTarget.membershipCard.source === "admin_repair" ||
      (!!memberCardActivatedAt &&
        Math.abs(
          new Date(memberCardVerifiedAt).getTime() -
            new Date(memberCardActivatedAt).getTime(),
        ) > 1000));
  const memberCardTimestampItems =
    editTarget?.role?.name === "USER" && editTarget.membershipCard
      ? [
          memberCardGrantedAt
            ? {
                label: "Date & Time Granted",
                value: formatDisplayDateTime(memberCardGrantedAt),
              }
            : null,
          editTarget.membershipCard.status === "revoked" &&
          editTarget.membershipCard.revokedAt
            ? {
                label: "Date & Time Revoked",
                value: formatDisplayDateTime(
                  editTarget.membershipCard.revokedAt,
                ),
              }
            : null,
          memberCardWasRestored && memberCardVerifiedAt
            ? {
                label: "Date & Time Restored",
                value: formatDisplayDateTime(memberCardVerifiedAt),
              }
            : null,
        ].filter(
          (item): item is { label: string; value: string } => item !== null,
        )
      : [];
  const accountOverviewItems = editTarget
    ? [
        {
          label: "Access",
          value: getDirectoryAccessLabel(editTarget, pendingRequestsByUserId),
        },
        { label: "Account status", value: accountStatusLabel },
        { label: "Scan status", value: getScanReadinessLabel(editTarget) },
        {
          label: "Last activity",
          value: formatLastCheckIn(editTarget.lastCheckInAt),
        },
      ]
    : [];
  const accountProfileItems = editTarget
    ? [
        { label: "Role", value: getDirectoryRoleLabel(editTarget.role?.name) },
        { label: "Email", value: editTarget.email },
        { label: "Phone", value: formatDetailValue(editTarget.phone_no) },
        {
          label: "Date of birth",
          value: formatDisplayDate(editTarget.profile?.dateOfBirth),
        },
        {
          label: "Gender",
          value: formatDetailValue(editTarget.profile?.gender),
        },
        {
          label: "Activity level",
          value: formatDetailValue(editTarget.profile?.activityLevel),
        },
        {
          label: "Fitness goal",
          value: formatDetailValue(editTarget.profile?.fitnessGoal),
        },
        {
          label: "Weight",
          value:
            editTarget.profile?.currentWeightKg != null
              ? `${editTarget.profile.currentWeightKg} kg`
              : "Not provided",
        },
        {
          label: "Height",
          value:
            editTarget.profile?.heightCm != null
              ? `${editTarget.profile.heightCm} cm`
              : "Not provided",
        },
        { label: "Created", value: formatDisplayDate(editTarget.createdAt) },
        ...(editTarget.deletedAt
          ? [
              {
                label: "Date & Time Archived",
                value: formatDisplayDateTime(editTarget.deletedAt),
              },
            ]
          : editTarget.restoredAt && accountStatusLabel === "Active"
            ? [
                {
                  label: "Date & Time Unarchived",
                  value: formatDisplayDateTime(editTarget.restoredAt),
                },
              ]
            : []),
        ...memberCardTimestampItems,
      ]
    : [];
  const accountAccessLabel = editTarget
    ? getDirectoryAccessLabel(editTarget, pendingRequestsByUserId)
    : emptyAccountValue;
  const accountInspectorSections = [
    {
      title: "User Details",
      items: [
        {
          label: "User Type",
          value: editTarget
            ? getDirectoryRoleLabel(editTarget.role?.name)
            : emptyAccountValue,
        },
        { label: "Access", value: accountAccessLabel },
        { label: "Email", value: editTarget?.email ?? emptyAccountValue },
      ],
    },
    {
      title: "Activity",
      items: [
        {
          label: "Last Check-in",
          value: editTarget
            ? formatLastCheckIn(editTarget.lastCheckInAt)
            : emptyAccountValue,
        },
        {
          label: "Scan Status",
          value: editTarget ? getScanReadinessLabel(editTarget) : emptyAccountValue,
        },
      ],
    },
  ];
  const canRunAccountArchiveAction = canArchiveEditTarget || canRestoreEditTarget;
  const accountInspectorFooter = (
    <div style={{ display: "grid", gap: 10 }}>
      <FitButton
        variant="primary"
        label="Edit Details"
        icon={Pencil}
        iconSize={14}
        disabled={!editTarget || !canEditTargetDetails}
        onClick={editTarget && canEditTargetDetails ? openEditModal : undefined}
        style={primaryActionStyle}
        textStyle={{ color: primaryCommandTextColor, fontWeight: 800 }}
      />
      <FitButton
        variant="ghost"
        label={editTarget ? memberCardActionLabel : "Manage Membership"}
        icon={CreditCard}
        iconSize={14}
        disabled={
          !editTarget || !canManageMemberCard || membershipCardMutation.isPending
        }
        onClick={() => {
          if (!editTarget || !canManageMemberCard) return;
          if (getMembershipFieldValue(editTarget) === "active") {
            setRevokeCardTarget(editTarget);
            return;
          }
          setGrantCardTarget(editTarget);
        }}
        style={{
          ...secondaryActionStyle,
          border: membershipActionTone.border,
          backgroundColor: membershipActionTone.backgroundColor,
        }}
        textStyle={{ color: membershipActionTone.color, fontWeight: 800 }}
      />
      <FitButton
        variant="ghost"
        label={editTarget ? accountActionLabel : "Archive Account"}
        icon={Archive}
        iconSize={14}
        disabled={!editTarget || !canRunAccountArchiveAction}
        onClick={() => {
          if (!editTarget) return;
          if (canRestoreEditTarget) {
            setRestoreTarget(editTarget);
            return;
          }
          if (canArchiveEditTarget) {
            setArchiveTarget(editTarget);
          }
        }}
        style={accountLifecycleActionStyle}
        textStyle={{ color: accountLifecycleActionColor, fontWeight: 800 }}
      />
    </div>
  );
  const accountInspectorBody = (
    <>
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 8,
          padding: "0 0 4px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: 8,
            border: `1px ${editTarget ? "solid" : "dashed"} ${colors.border}`,
            backgroundColor: colors.surfaceRaised,
            color: editTarget ? colors.brand : colors.textMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <FitText
            style={{
              fontSize: editTarget ? 24 : 15,
              fontWeight: 850,
              letterSpacing: "0.04em",
            }}
          >
            {editTarget ? getMemberInitials(editTarget) : emptyAccountValue}
          </FitText>
          {accountDetailsAvatarUrl ? (
            <img
              src={accountDetailsAvatarUrl}
              alt={`${accountDetailsTitle} profile`}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : null}
        </div>
        <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
          <FitText
            style={{
              fontSize: 16,
              fontWeight: 850,
              color: colors.textPrimary,
              lineHeight: 1.22,
              overflowWrap: "anywhere",
            }}
          >
            {accountDetailsTitle}
          </FitText>
          <FitText
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: editTarget ? colors.brand : colors.textSecondary,
              lineHeight: 1.28,
              overflowWrap: "anywhere",
            }}
          >
            {editTarget?.email ?? emptyAccountValue}
          </FitText>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
            <FitPill
              mode="status"
              label={accountStatusLabel}
              color={editTarget ? getDirectoryStatusColor(editTarget, pendingRequestsByUserId, colors.warning) : colors.textMuted}
              fontSize={9.5}
            />
            <FitPill
              mode="status"
              label={accountAccessLabel}
              color={editTarget ? colors.brand : colors.textMuted}
              fontSize={9.5}
              borderOpacity="35"
              bgOpacity="12"
            />
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {accountInspectorSections.map((section) => (
          <div
            key={section.title}
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            <FitText
              style={{
                fontSize: 11,
                fontWeight: 850,
                color: colors.brand,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {section.title}
            </FitText>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  section.items.length > 2
                    ? "repeat(2, minmax(0, 1fr))"
                    : "1fr",
                gap: 8,
              }}
            >
              {section.items.map((item) => {
                const isEmailDetail = item.label === "Email";

                return (
                <div
                  key={item.label}
                  style={{
                    display: "grid",
                    gap: 5,
                    minWidth: 0,
                    padding: "10px 11px",
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surfaceRaised,
                    gridColumn: isEmailDetail ? "1 / -1" : undefined,
                  }}
                  >
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 9.5,
                      fontWeight: 850,
                      color: colors.textMuted,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.label}
                  </FitText>
                  <FitText
                    excludeGlobalScale={isEmailDetail}
                    style={{
                      fontSize: isEmailDetail ? 10.5 : 12.25,
                      fontWeight: 800,
                      color: colors.textPrimary,
                      lineHeight: 1.3,
                      overflowWrap: "anywhere",
                      wordBreak: "normal",
                      whiteSpace: isEmailDetail ? "normal" : undefined,
                    }}
                  >
                    {item.value}
                  </FitText>
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
  const accountInspectorNode = (
    <div
      className="members-directory-inspector"
      style={{
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        gap: 10,
        height: "100%",
        minHeight: 0,
      }}
    >
      {accountInspectorCommandRow}
      <MemberInspectorPanel
        ariaLabel="Account details"
        footer={accountInspectorFooter}
      >
        {accountInspectorBody}
      </MemberInspectorPanel>
    </div>
  );

  return (
    <FitSection
      as="section"
      heading=""
      hideHeading
      bare
      noPadding
      className={themeTransition}
      style={fadeIn}
    >
      <div
        className={
          isCreateMode ? "members-shell members-shell-create" : "members-shell"
        }
        style={{
          display: "grid",
          gap: isCreateMode ? 0 : 18,
          width: "100%",
        }}
      >
        {isCreateMode ? (
          <div
            key="create"
            className="members-create-shell"
            style={{
              width: "100%",
              maxWidth: "none",
              margin: 0,
            }}
          >
            <AddUserPanel
              existingAccounts={members}
              isLoading={addLoading}
              loadingLabel={addLoadingLabel}
              onBack={() => setContentMode("directory")}
              onSubmit={handleAdd}
            />
          </div>
        ) : (
          <div
            key={contentMode}
            className="members-directory-stage"
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "minmax(0, 1fr) minmax(284px, 0.36fr)",
              alignItems: "stretch",
              height: "calc(100vh - 154px)",
              minHeight: 600,
              width: "100%",
              marginRight: 0,
              padding: 0,
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
            }}
          >
            <MembersDirectoryPanel
              activeRowId={editTarget?.id}
              emptyMessage={directoryEmptyMessage}
              filteredCount={filtered.length}
              isAdmin={isAdmin}
              onPageChange={setPage}
              onRowClick={openInspector}
              page={page}
              pageSize={directoryPageSize}
              pageLoading={pageLoading}
              renderGridCard={renderGridCard}
              renderMobileCard={renderMobileCard}
              rows={paginatedRows}
              tableColumns={memberColumns}
              toolbar={directoryToolbar}
              totalPages={totalPages}
              viewMode={viewMode}
            />
            {accountInspectorNode}
          </div>
        )}
      </div>
      <style>{`
        @keyframes members-create-in {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .members-create-shell {
          animation: members-create-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .members-create-shell {
            animation: none !important;
          }
        }

        @media (max-width: 1259px) {
          .members-directory-stage {
            grid-template-columns: 1fr !important;
            height: auto !important;
            min-height: 0 !important;
          }

          .members-directory-inspector {
            display: none !important;
          }
        }

        @media (max-width: 860px) {
          .members-directory-toolbar {
            align-items: stretch !important;
            flex-wrap: wrap !important;
          }

          .members-directory-search {
            flex-basis: auto !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;
          }

          .members-toolbar-filters,
          .members-toolbar-status-filter {
            width: 100% !important;
          }

          .members-directory-toolbar-left,
          .members-directory-toolbar-right {
            width: 100% !important;
            justify-content: flex-start !important;
          }

          .members-directory-toolbar-left {
            display: grid !important;
            grid-template-columns: minmax(188px, 1fr);
            align-items: center !important;
            gap: 8px !important;
          }
        }

        @media (max-width: 560px) {
          .members-directory-toolbar {
            gap: 8px !important;
          }

          .members-directory-toolbar-left {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
          }

          .members-directory-toolbar-right {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }

          .members-toolbar-filters,
          .members-toolbar-status-filter {
            grid-column: 1 / -1 !important;
          }

          .members-directory-toolbar-right > button {
            width: 100% !important;
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
      {canInspectAccounts ? (
        <FitModal
          isOpen={
            mobileInspectorOpen &&
            !!editTarget &&
            isAccountsHamburgerMode &&
            !editModalOpen &&
            !editConfirmOpen
          }
          onClose={closeInspector}
          title="Account details"
          maxWidth={448}
          noScroll
          hideHeaderText
          hideHeaderDivider
          headerStyle={{ paddingBottom: 0 }}
        >
          <div
            className="members-account-details-modal"
            style={{
              height: "min(720px, calc(100vh - 96px))",
              minHeight: 0,
            }}
          >
            <MemberInspectorPanel
              ariaLabel="Account details"
              footer={accountInspectorFooter}
            >
              {accountInspectorBody}
            </MemberInspectorPanel>
          </div>
        </FitModal>
      ) : null}
      {USE_MODAL_INSPECTOR && canInspectAccounts ? (
        <FitModal
          isOpen={!!editTarget && !editModalOpen && !editConfirmOpen}
          onClose={closeInspector}
          title={accountDetailsTitle}
          subtitle={editTarget?.email}
          maxWidth={920}
        >
          {editTarget ? (
            <div style={{ display: "grid", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.textPrimary,
                    color: colors.surfaceRaised,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    position: "relative",
                    flexShrink: 0,
                  }}
                >
                  <FitText
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {getMemberInitials(editTarget)}
                  </FitText>
                  {accountDetailsAvatarUrl ? (
                    <img
                      src={accountDetailsAvatarUrl}
                      alt={`${accountDetailsTitle} profile`}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : null}
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    minWidth: 0,
                    flex: "1 1 240px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <FitPill
                      mode="status"
                      label={getDirectoryStatusLabel(
                        editTarget,
                        pendingRequestsByUserId,
                      )}
                      color={getDirectoryStatusColor(
                        editTarget,
                        pendingRequestsByUserId,
                        colors.warning,
                      )}
                      fontSize={11}
                    />
                    <FitPill
                      mode="status"
                      label={getDirectoryAccessLabel(
                        editTarget,
                        pendingRequestsByUserId,
                      )}
                      color={
                        MEMBERSHIP_CARD_STATUS_COLORS[
                          getDirectoryAccessLabel(
                            editTarget,
                            pendingRequestsByUserId,
                          )
                        ] ?? colors.textMuted
                      }
                      fontSize={11}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                {accountOverviewItems.map((item) => (
                  <div key={item.label} style={detailsCardStyle}>
                    <FitText
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: colors.textMuted,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {item.label}
                    </FitText>
                    <FitText
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: colors.textPrimary,
                        lineHeight: 1.35,
                      }}
                    >
                      {item.value}
                    </FitText>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <FitText
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: colors.textPrimary,
                  }}
                >
                  Profile details
                </FitText>
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  }}
                >
                  {accountProfileItems.map((item) => (
                    <div key={item.label} style={detailsCardStyle}>
                      <FitText
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: colors.textMuted,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {item.label}
                      </FitText>
                      <FitText
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: colors.textPrimary,
                          lineHeight: 1.35,
                        }}
                      >
                        {item.value}
                      </FitText>
                    </div>
                  ))}
                </div>
              </div>

              {isAdmin && !isSelfEdit && pendingMembershipPayment ? (
                <div
                  style={{
                    ...detailsCardStyle,
                    gap: 8,
                    border: `1px solid ${colors.brand}1f`,
                    backgroundColor: `${colors.brand}08`,
                  }}
                >
                  <FitText
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: colors.textMuted,
                      letterSpacing: "0.05em",
                    }}
                  >
                    Payment review
                  </FitText>
                  <FitText
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: colors.textPrimary,
                    }}
                  >
                    PHP{" "}
                    {Number(pendingMembershipPayment.amount).toLocaleString(
                      "en-PH",
                    )}
                  </FitText>
                  <FitText
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      lineHeight: 1.45,
                    }}
                  >
                    {formatReviewPayableLabel(
                      pendingMembershipPayment.payable_type,
                    )}{" "}
                    - {formatMembershipStatus(pendingMembershipPayment.status)}
                  </FitText>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    <FitButton
                      variant="primary"
                      label={
                        membershipPaymentReviewMutation.isPending
                          ? paymentReviewLoadingLabel
                          : "Approve"
                      }
                      icon={BadgeCheck}
                      iconSize={14}
                      onClick={() => setPaymentReviewAction("approve")}
                      disabled={membershipPaymentReviewMutation.isPending}
                      style={{ ...primaryActionStyle, minHeight: 36 }}
                      textStyle={{ color: primaryCommandTextColor }}
                    />
                    <FitButton
                      variant="danger"
                      label="Reject"
                      onClick={() => setPaymentReviewAction("reject")}
                      disabled={membershipPaymentReviewMutation.isPending}
                      style={{
                        ...secondaryActionStyle,
                        border: `1px solid ${colors.danger}`,
                        backgroundColor: colors.danger,
                        minHeight: 36,
                      }}
                      textStyle={{ color: primaryCommandTextColor }}
                    />
                  </div>
                </div>
              ) : null}

              {!isSelfEdit ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <FitText
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.textPrimary,
                    }}
                  >
                    Account actions
                  </FitText>

                  {canEditTargetDetails ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: canManualCheckInTarget
                          ? "repeat(2, minmax(0, 1fr))"
                          : "1fr",
                        gap: 10,
                      }}
                    >
                      <FitButton
                        variant="primary"
                        label="Edit details"
                        icon={Pencil}
                        iconSize={14}
                        onClick={openEditModal}
                        style={primaryActionStyle}
                        textStyle={{ color: primaryCommandTextColor }}
                      />
                      {canManualCheckInTarget ? (
                        <FitButton
                          variant="ghost"
                          label={
                            manualAttendanceMutation.isPending
                              ? manualCheckInLoadingLabel
                              : "Check in"
                          }
                          disabled={manualAttendanceMutation.isPending}
                          onClick={() => {
                            void handleManualCheckIn(editTarget);
                          }}
                          style={secondaryActionStyle}
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {isAdmin ? (
                    <FitButton
                      variant="ghost"
                      label="Message"
                      onClick={() => handleMessageMember(editTarget)}
                      style={secondaryActionStyle}
                    />
                  ) : null}

                  {canManageMemberCard &&
                  getMembershipFieldValue(editTarget) !== "active" ? (
                    <FitButton
                      variant="ghost"
                      label={
                        membershipCardMutation.isPending
                          ? membershipCardLoadingLabel
                          : memberCardActionLabel
                      }
                      disabled={membershipCardMutation.isPending}
                      onClick={() => setGrantCardTarget(editTarget)}
                      style={{
                        ...secondaryActionStyle,
                        border: `1px solid ${colors.brand}30`,
                        backgroundColor: `${colors.brand}10`,
                      }}
                      textStyle={{ color: colors.brand }}
                    />
                  ) : null}

                  {canManageMemberCard &&
                  getMembershipFieldValue(editTarget) === "active" ? (
                    <FitButton
                      variant="ghost"
                      label="Revoke Membership"
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
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      <FitButton
                        variant="ghost"
                        label={
                          rejectDeletionMutation.isPending
                            ? rejectLoadingLabel
                            : "Deny request"
                        }
                        onClick={handleRejectDeleteRequest}
                        disabled={rejectDeletionMutation.isPending}
                        style={secondaryActionStyle}
                      />
                      <FitButton
                        variant="danger"
                        label="Approve request"
                        onClick={() => setDeleteTarget(editTarget)}
                        style={{ borderRadius: 10, minHeight: 40 }}
                      />
                    </div>
                  ) : null}

                  {canArchiveEditTarget ? (
                    <FitButton
                      variant="ghost"
                      label={accountActionLabel}
                      onClick={() => setArchiveTarget(editTarget)}
                      style={accountLifecycleActionStyle}
                      textStyle={{ color: accountLifecycleActionColor, fontWeight: 700 }}
                    />
                  ) : null}

                  {canRestoreEditTarget ? (
                    <FitButton
                      variant="ghost"
                      label={accountActionLabel}
                      onClick={() => setRestoreTarget(editTarget)}
                      style={accountLifecycleActionStyle}
                      textStyle={{ color: accountLifecycleActionColor, fontWeight: 700 }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </FitModal>
      ) : null}
      {canEditTargetDetails ? (
        <DetailsModal
          isOpen={editModalOpen && !!editTarget}
          title="Edit account details"
          subtitle={
            editTarget
              ? `${fullName(editTarget) || "Unnamed account"} - ${getDirectoryAccessLabel(editTarget, pendingRequestsByUserId)}`
              : ""
          }
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
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                backgroundColor: `${colors.surface}ee`,
              }}
            >
              {[
                {
                  label: "Access",
                  value: getDirectoryAccessLabel(
                    editTarget,
                    pendingRequestsByUserId,
                  ),
                },
                {
                  label: "Scan status",
                  value: getScanReadinessLabel(editTarget),
                },
              ].map((item) => (
                <div key={item.label} style={{ display: "grid", gap: 3 }}>
                  <FitText
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: colors.textMuted,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {item.label}
                  </FitText>
                  <FitText
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: colors.textPrimary,
                    }}
                  >
                    {item.value}
                  </FitText>
                </div>
              ))}
            </div>
          ) : null}
        </DetailsModal>
      ) : null}
      {canEditTargetDetails ? (
        <ConfirmModal
          isOpen={editConfirmOpen && !!editTarget && !!pendingEditSubmission}
          title="Confirm account update"
          message={
            editTarget
              ? `Save the updated profile details for ${fullName(editTarget) || editTarget.email}? Access controls stay unchanged, and the page will refresh with the new account information.`
              : "Save these updated account details?"
          }
          confirmLabel="SAVE ACCOUNT DETAILS"
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
        <ConfirmModal
          isOpen={paymentReviewAction !== null && !!pendingMembershipPayment}
          title={
            paymentReviewAction === "reject"
              ? "Reject Payment Review"
              : "Approve Payment Review"
          }
          message={
            pendingMembershipPayment
              ? paymentReviewAction === "reject"
                ? `Reject this ${formatReviewPayableLabel(pendingMembershipPayment.payable_type).toLowerCase()} review? The payment will remain blocked until the member submits a new valid proof.`
                : `Approve this ${formatReviewPayableLabel(pendingMembershipPayment.payable_type).toLowerCase()} for PHP ${Number(
                    pendingMembershipPayment.amount,
                  ).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}?`
              : "Review this payment action before continuing."
          }
          confirmLabel={
            paymentReviewAction === "reject" ? "REJECT PAYMENT" : "APPROVE PAYMENT"
          }
          loadingLabel={paymentReviewLoadingLabel}
          isDanger={paymentReviewAction === "reject"}
          isLoading={membershipPaymentReviewMutation.isPending}
          onConfirm={() => {
            if (paymentReviewAction === "reject") {
              void handleRejectMembershipPayment();
              return;
            }
            void handleApproveMembershipPayment();
          }}
          onCancel={() => setPaymentReviewAction(null)}
        />
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
      {canManageMemberCard ? (
        <ConfirmModal
          isOpen={!!grantCardTarget}
          title={
            grantCardTarget &&
            getMembershipFieldValue(grantCardTarget) === "revoked"
              ? "Restore Membership"
              : "Grant Membership"
          }
          message={
            grantCardTarget &&
            getMembershipFieldValue(grantCardTarget) === "revoked"
              ? `Restore membership access for ${grantCardTarget.email}? This re-enables scan access and member-only app access without creating a new membership-card payment.`
              : `Grant membership access to ${grantCardTarget?.email ?? "this account"} after one-time payment approval? This enables member-only access and prepares the card for future scans.`
          }
          confirmLabel={
            grantCardTarget &&
            getMembershipFieldValue(grantCardTarget) === "revoked"
              ? "RESTORE MEMBERSHIP"
              : "GRANT MEMBERSHIP"
          }
          loadingLabel={membershipCardLoadingLabel}
          confirmIcon={BadgeCheck}
          isLoading={membershipCardMutation.isPending}
          onConfirm={handleGrantMembershipCard}
          onCancel={() => setGrantCardTarget(null)}
        />
      ) : null}
      {canManageMemberCard ? (
        <ConfirmModal
          isOpen={!!revokeCardTarget}
          title="Revoke Membership"
          message={`Revoke membership access for ${revokeCardTarget?.email ?? "this account"}? The account stays active, but scan access and member-only app access return to the non-member state. The original one-time payment record is preserved.`}
          confirmLabel="REVOKE MEMBERSHIP"
          loadingLabel={membershipCardLoadingLabel}
          confirmIcon={Archive}
          isDanger
          isLoading={membershipCardMutation.isPending}
          onConfirm={handleRevokeMembershipCard}
          onCancel={() => setRevokeCardTarget(null)}
        />
      ) : null}
      {canInspectAccounts ? (
        <ConfirmModal
          isOpen={!!deleteTarget}
          title="Approve Termination Request"
          message={`Approve the termination request for ${deleteTarget?.email ?? "this account"}? The account will be soft-deleted and moved to Archived until it is restored.`}
          confirmLabel="APPROVE REQUEST"
          loadingLabel={approveRequestLoadingLabel}
          confirmIcon={BadgeCheck}
          isDanger
          isLoading={approveDeletionMutation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
      {archiveTarget ? (
        <ConfirmModal
          isOpen={!!archiveTarget}
          title="Archive Account"
          message={`Archive ${archiveTarget?.email ?? "this account"} from the account directory? The profile stays recoverable in Archived.`}
          confirmLabel="ARCHIVE ACCOUNT"
          loadingLabel={archiveLoadingLabel}
          confirmIcon={Archive}
          isDanger
          isLoading={archiveLoading}
          onConfirm={handleArchiveMember}
          onCancel={() => setArchiveTarget(null)}
        />
      ) : null}
      {restoreTarget ? (
        <ConfirmModal
          isOpen={!!restoreTarget}
          title="Restore Account"
          message={`Restore ${restoreTarget?.email ?? "this account"} to the account directory? This clears soft deletion and cancels any pending deletion request for the account.`}
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
