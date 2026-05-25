"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminDeletionRequestsQueryOptions,
  approveDeletionRequestMutationOptions,
  manualAttendanceCheckInMutationOptions,
  rejectDeletionRequestMutationOptions,
  reviewMembershipPaymentsQueryOptions,
  scanAttendanceQrMutationOptions,
  updateAdminMembershipCardMutationOptions,
  verifyMembershipPaymentMutationOptions,
  verifyNonMemberMutationOptions,
} from "@fittrack/query";
import { useDebounce, useLoadingText } from "@fittrack/hooks";
import type {
  AttendanceCheckInRecord,
  MemberDirectoryFilters,
  MemberRecord,
  MembershipCardRecord,
} from "@fittrack/types";
import type { AdminCreateUserData } from "@fittrack/validators";
import { fullName } from "@fittrack/utils";

import { useAuth } from "@/contexts/AuthContext";
import { useMembers } from "@/contexts/MemberContext";
import {
  MEMBER_FILTER_OPTIONS,
  MEMBER_TIER_FILTER_OPTIONS,
  MEMBER_STATUS_TABS,
  type DeletionRequest,
  type MemberStatusTab,
} from "@/data/members/members";
import { webApiClient } from "@/lib/api-client";
import { getBrowserViewportState } from "@/utils/browserViewport";
import type { AttendanceScanFeedback } from "@/components/accounts/AttendanceScanModal";
import {
  EDIT_MEMBER_EDITABLE_KEYS,
  GRID_ROWS_PER_PAGE,
  LIST_ROWS_PER_PAGE,
  MIN_ACTION_DELAY_MS,
  filterMembers,
  formatLastCheckIn,
  formatReviewPayableLabel,
  getActionErrorMessage,
  getDirectoryMemberStatus,
  getEditDraftValues,
  getMembershipFieldValue,
  getMembershipPaymentReviewLabel,
  getPendingRequestsByUserId,
  normalizeDraftValue,
  parseOptionalNumber,
  type ContentMode,
  type DirectoryViewMode,
} from "@/components/accounts/accountComponentUtils";

type ToastTone = "success" | "error" | "info" | "warning";
type SelectOption = { label: string; value: string };
type NoticeModalState = {
  description?: string;
  title: string;
  tone: ToastTone;
} | null;
type PaymentReviewAction = "approve" | "reject" | null;
export type CoachClientPanelMode = "overview" | "schedule" | "feedback";
type PendingMembershipPayment = {
  id: string;
  user_id: string;
  amount: number | string;
  payable_type?: string | null;
  provider?: string | null;
  status: string;
};

const MANUAL_VERIFICATION_ROLE_NAMES = new Set(["ADMIN", "STAFF", "USER", "COACH"]);

function canManuallyVerifyAccountTarget(
  member: MemberRecord | null,
  options: {
    canManageAccounts: boolean;
    canManageAdminAccounts: boolean;
    currentUserId?: string;
    pendingRequestsByUserId: Map<string, DeletionRequest>;
  },
) {
  if (!options.canManageAccounts || !member || member.id === options.currentUserId) return false;
  if (!member.role?.name || !MANUAL_VERIFICATION_ROLE_NAMES.has(member.role.name)) return false;
  if (member.role.name === "ADMIN" && !options.canManageAdminAccounts) return false;
  if (member.status !== "pending") return false;
  if (options.pendingRequestsByUserId.has(member.id)) return false;
  return getDirectoryMemberStatus(member, options.pendingRequestsByUserId) !== "Archived";
}

function getManualVerificationFallbackMessage(member: MemberRecord | null) {
  return member?.role?.name === "USER"
    ? "Failed to promote this account to verified non-member."
    : "Failed to verify this account.";
}

type AccountsPageContextValue = {
  activeChip: string;
  activeCoachActivityLevel: string;
  activeCoachMembershipStatus: string;
  activeCoachSessionStatus: string;
  activeStatus: MemberStatusTab;
  activeTier: string;
  addLoading: boolean;
  addLoadingLabel: string;
  approveRequestLoadingLabel: string;
  archiveLoading: boolean;
  archiveLoadingLabel: string;
  archiveTarget: MemberRecord | null;
  canArchiveEditTarget: boolean;
  canEditTargetDetails: boolean;
  canInspectAccounts: boolean;
  canManageAccounts: boolean;
  canManageMemberCard: boolean;
  canManualCheckInTarget: boolean;
  canRestoreEditTarget: boolean;
  canVerifyNonMemberTarget: boolean;
  canTerminateEditTarget: boolean;
  closeInspector: () => void;
  coachClientPanelMode: CoachClientPanelMode;
  contentMode: ContentMode;
  deleteTarget: MemberRecord | null;
  directoryEmptyMessage: string;
  directoryPageSize: number;
  editConfirmOpen: boolean;
  editDraft: Record<string, string>;
  editInitialValues: Record<string, string>;
  editLoading: boolean;
  editLoadingLabel: string;
  editModalOpen: boolean;
  editPendingRequest: DeletionRequest | undefined;
  editTarget: MemberRecord | null;
  filtered: MemberRecord[];
  grantCardTarget: MemberRecord | null;
  handleAdd: (data: AdminCreateUserData) => Promise<void>;
  handleApproveMembershipPayment: () => Promise<void>;
  handleArchiveMember: () => Promise<void>;
  handleAttendanceScan: (qrValue: string) => Promise<void>;
  handleDelete: () => Promise<void>;
  handleEdit: (data: Record<string, string>) => Promise<void>;
  handleGrantMembershipCard: () => Promise<void>;
  handleManualCheckIn: (member: MemberRecord) => Promise<void>;
  handleMessageMember: (member: MemberRecord) => void;
  handleRejectDeleteRequest: () => Promise<void>;
  handleRejectMembershipPayment: () => Promise<void>;
  handleRestoreMember: () => Promise<void>;
  handleRevokeMembershipCard: () => Promise<void>;
  handleVerifyNonMember: () => Promise<void>;
  isAccountsHamburgerMode: boolean;
  isAdmin: boolean;
  isApproveDeletionPending: boolean;
  isCoach: boolean;
  isCreateMode: boolean;
  isEditTargetArchived: boolean;
  isManualAttendancePending: boolean;
  isMembershipCardPending: boolean;
  isMembershipPaymentReviewPending: boolean;
  isRejectDeletionPending: boolean;
  isScanAttendancePending: boolean;
  isSelfEdit: boolean;
  isStaff: boolean;
  isTerminationRequestsView: boolean;
  manualCheckInLoadingLabel: string;
  members: MemberRecord[];
  membershipCardLoadingLabel: string;
  mobileInspectorOpen: boolean;
  noticeModal: NoticeModalState;
  openEditModal: () => void;
  openInspector: (member: MemberRecord) => void;
  page: number;
  pageLoading: boolean;
  paginatedRows: MemberRecord[];
  paymentReviewAction: PaymentReviewAction;
  paymentReviewLoadingLabel: string;
  pendingEditSubmission: Record<string, string> | null;
  pendingMembershipPayment: PendingMembershipPayment | undefined;
  pendingRequestsByUserId: Map<string, DeletionRequest>;
  q: string;
  queueEditConfirmation: (data: Record<string, string>) => void;
  rejectLoadingLabel: string;
  restoreLoading: boolean;
  restoreLoadingLabel: string;
  restoreTarget: MemberRecord | null;
  verifyNonMemberTarget: MemberRecord | null;
  revokeCardTarget: MemberRecord | null;
  roleSelectOptions: SelectOption[];
  scanFeedback: AttendanceScanFeedback | null;
  scanOpen: boolean;
  setActiveChip: Dispatch<SetStateAction<string>>;
  setActiveCoachActivityLevel: Dispatch<SetStateAction<string>>;
  setActiveCoachMembershipStatus: Dispatch<SetStateAction<string>>;
  setActiveCoachSessionStatus: Dispatch<SetStateAction<string>>;
  setActiveStatus: Dispatch<SetStateAction<MemberStatusTab>>;
  setActiveTier: Dispatch<SetStateAction<string>>;
  setArchiveTarget: Dispatch<SetStateAction<MemberRecord | null>>;
  setCoachClientPanelMode: Dispatch<SetStateAction<CoachClientPanelMode>>;
  setContentMode: Dispatch<SetStateAction<ContentMode>>;
  setDeleteTarget: Dispatch<SetStateAction<MemberRecord | null>>;
  setEditConfirmOpen: Dispatch<SetStateAction<boolean>>;
  setEditDraft: Dispatch<SetStateAction<Record<string, string>>>;
  setEditModalOpen: Dispatch<SetStateAction<boolean>>;
  setGrantCardTarget: Dispatch<SetStateAction<MemberRecord | null>>;
  setNoticeModal: Dispatch<SetStateAction<NoticeModalState>>;
  setPage: Dispatch<SetStateAction<number>>;
  setPaymentReviewAction: Dispatch<SetStateAction<PaymentReviewAction>>;
  setPendingEditSubmission: Dispatch<SetStateAction<Record<string, string> | null>>;
  setQ: Dispatch<SetStateAction<string>>;
  setRestoreTarget: Dispatch<SetStateAction<MemberRecord | null>>;
  setVerifyNonMemberTarget: Dispatch<SetStateAction<MemberRecord | null>>;
  setRevokeCardTarget: Dispatch<SetStateAction<MemberRecord | null>>;
  setScanFeedback: Dispatch<SetStateAction<AttendanceScanFeedback | null>>;
  setScanOpen: Dispatch<SetStateAction<boolean>>;
  setViewMode: Dispatch<SetStateAction<DirectoryViewMode>>;
  statusSelectOptions: SelectOption[];
  tierSelectOptions: SelectOption[];
  totalPages: number;
  viewMode: DirectoryViewMode;
};

const AccountsPageContext = createContext<AccountsPageContextValue | null>(null);

export function AccountsPageProvider({ children }: { children: ReactNode }) {
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
    setDirectoryFilters,
  } = useMembers();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
  const isCoach = user?.role === "COACH";
  const canManageAccounts = isAdmin || isStaff;
  const canInspectAccounts = canManageAccounts || isCoach;
  const [q, setQ] = useState("");
  const [noticeModal, setNoticeModal] = useState<NoticeModalState>(null);
  const debouncedQ = useDebounce(q, 250);
  const [activeChip, setActiveChip] = useState("all");
  const [activeStatus, setActiveStatus] = useState<MemberStatusTab>("All");
  const [activeTier, setActiveTier] = useState("all");
  const [activeCoachMembershipStatus, setActiveCoachMembershipStatus] =
    useState("all");
  const [activeCoachSessionStatus, setActiveCoachSessionStatus] =
    useState("all");
  const [activeCoachActivityLevel, setActiveCoachActivityLevel] =
    useState("all");
  const [coachClientPanelMode, setCoachClientPanelMode] =
    useState<CoachClientPanelMode>("overview");
  const [viewMode, setViewMode] = useState<DirectoryViewMode>("list");
  const isTerminationRequestsView = activeStatus === "Termination Requests";
  const directoryServerFilters = useMemo<MemberDirectoryFilters>(() => {
    const filters: MemberDirectoryFilters = {};
    const search = debouncedQ.trim();

    if (search) {
      filters.search = search;
    }

    if (activeStatus === "Active" || activeStatus === "Termination Requests") {
      filters.archived = false;
    } else if (activeStatus === "Archived") {
      filters.archived = true;
    }

    if (isCoach || activeStatus === "Termination Requests") {
      filters.role = "member";
    } else if (activeChip === "Admin") {
      filters.role = "admin";
    } else if (activeChip === "Staff") {
      filters.role = "staff";
    } else if (activeChip === "Coach") {
      filters.role = "coach";
    } else if (activeChip === "Member") {
      filters.role = "member";
    }

    if (!isCoach && activeTier !== "all") {
      filters.tier = activeTier as MemberDirectoryFilters["tier"];
    }

    if (isCoach && activeCoachMembershipStatus !== "all") {
      filters.tier =
        activeCoachMembershipStatus as MemberDirectoryFilters["tier"];
    }

    if (isCoach && activeCoachSessionStatus !== "all") {
      filters.sessionStatus =
        activeCoachSessionStatus as MemberDirectoryFilters["sessionStatus"];
    }

    if (isCoach && activeCoachActivityLevel !== "all") {
      filters.activityLevel = activeCoachActivityLevel;
    }

    return filters;
  }, [
    activeChip,
    activeCoachActivityLevel,
    activeCoachMembershipStatus,
    activeCoachSessionStatus,
    activeStatus,
    activeTier,
    debouncedQ,
    isCoach,
  ]);
  const [addLoading, setAddLoading] = useState(false);
  const addLoadingLabel = useLoadingText("ADDING USER", addLoading);
  const [editTarget, setEditTarget] = useState<MemberRecord | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>(
    getEditDraftValues(null),
  );
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [pendingEditSubmission, setPendingEditSubmission] = useState<Record<string, string> | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MemberRecord | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MemberRecord | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<MemberRecord | null>(null);
  const [verifyNonMemberTarget, setVerifyNonMemberTarget] = useState<MemberRecord | null>(null);
  const [grantCardTarget, setGrantCardTarget] = useState<MemberRecord | null>(null);
  const [revokeCardTarget, setRevokeCardTarget] = useState<MemberRecord | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<AttendanceScanFeedback | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [isAccountsHamburgerMode, setIsAccountsHamburgerMode] = useState(false);
  const [paymentReviewAction, setPaymentReviewAction] = useState<PaymentReviewAction>(null);
  const notify = useCallback((tone: ToastTone, title: string, description?: string) => {
    setNoticeModal({ description, title, tone });
  }, []);
  const notifyActionError = useCallback((title: string, error: unknown, fallback: string) => {
    notify("error", title, getActionErrorMessage(error, fallback));
  }, [notify]);
  const { data: deletionRequests = [], error: deletionRequestsError } = useQuery({
    ...adminDeletionRequestsQueryOptions<DeletionRequest>(webApiClient),
    enabled: canManageAccounts,
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
    enabled: canManageAccounts,
  });

  useEffect(() => {
    if (!canInspectAccounts) return;
    void fetchMembers().catch((error: unknown) => {
      notifyActionError("Could not refresh clients", error, "Failed to fetch members.");
    });
  }, [canInspectAccounts, fetchMembers, notifyActionError]);

  useEffect(() => {
    setDirectoryFilters(canInspectAccounts ? directoryServerFilters : {});
  }, [canInspectAccounts, directoryServerFilters, setDirectoryFilters]);

  useEffect(
    () => () => {
      setDirectoryFilters({});
    },
    [setDirectoryFilters],
  );

  useEffect(() => {
    const evaluateViewportMode = () => {
      const { isBrowserWindowResized, viewportWidth } = getBrowserViewportState();
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
  }, [canInspectAccounts, membersError, notify]);

  useEffect(() => {
    if (!deletionRequestsError || !canManageAccounts) return;
    notifyActionError(
      "Termination requests could not be loaded",
      deletionRequestsError,
      "Failed to load pending termination requests.",
    );
  }, [canManageAccounts, deletionRequestsError, notifyActionError]);

  useEffect(() => {
    if (!pendingMembershipPaymentsError || !canManageAccounts) return;
    notifyActionError(
      "Payment reviews could not be loaded",
      pendingMembershipPaymentsError,
      "Failed to load membership payment reviews awaiting verification.",
    );
  }, [canManageAccounts, pendingMembershipPaymentsError, notifyActionError]);

  const roleScopedMembers = useMemo(() => {
    return members.filter((member) => {
      if (isCoach) return member.role?.name === "USER";
      if (isStaff) return member.role?.name !== "ADMIN";
      return true;
    });
  }, [isCoach, isStaff, members]);

  const pendingRequestsByUserId = useMemo(
    () =>
      canManageAccounts
        ? getPendingRequestsByUserId(deletionRequests)
        : new Map<string, DeletionRequest>(),
    [canManageAccounts, deletionRequests],
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
        ? membershipReviewPayments.find((payment) => payment.user_id === editTarget.id)
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

  const [page, setPage] = useState(1);
  const directoryPageSize = viewMode === "grid" ? GRID_ROWS_PER_PAGE : LIST_ROWS_PER_PAGE;
  const filtered = useMemo(
    () =>
      filterMembers(
        roleScopedMembers,
        "",
        activeChip,
        activeStatus,
        pendingRequestsByUserId,
      ),
    [activeChip, activeStatus, pendingRequestsByUserId, roleScopedMembers],
  );

  useEffect(() => setPage(1), [debouncedQ, activeChip, activeStatus, activeTier, viewMode]);

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
    if (isCoach && activeChip !== "Member") {
      setActiveChip("Member");
    }
  }, [activeChip, isCoach]);

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
  const editInitialValues = useMemo(() => getEditDraftValues(editTarget), [editTarget]);
  const archiveLoadingLabel = useLoadingText("ARCHIVING ACCOUNT", archiveLoading);

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
    setMobileInspectorOpen(false);
  }, [editTarget]);

  const editPendingRequest = editTarget ? pendingRequestsByUserId.get(editTarget.id) : undefined;
  const isEditTargetArchived = editTarget
    ? getDirectoryMemberStatus(editTarget, pendingRequestsByUserId) === "Archived"
    : false;
  const isSelfEdit = editTarget?.id === user?.id;
  const hasEditChanges = useMemo(() => {
    if (!editTarget) return false;
    const initialValues = getEditDraftValues(editTarget);
    return EDIT_MEMBER_EDITABLE_KEYS.some(
      (key) => normalizeDraftValue(editDraft[key]) !== normalizeDraftValue(initialValues[key]),
    );
  }, [editDraft, editTarget]);
  const canArchiveEditTarget = Boolean(
    (isAdmin || (isStaff && editTarget?.role?.name === "USER")) &&
      editTarget &&
      !isSelfEdit &&
      editTarget.role?.name !== "ADMIN" &&
      editTarget.status !== "pending" &&
      !editPendingRequest &&
      !isEditTargetArchived,
  );
  const canVerifyNonMemberTarget = Boolean(
    canManuallyVerifyAccountTarget(editTarget, {
      canManageAccounts,
      canManageAdminAccounts: isAdmin,
      currentUserId: user?.id,
      pendingRequestsByUserId,
    }),
  );
  const canTerminateEditTarget = Boolean(isAdmin && !isSelfEdit && editPendingRequest);
  const canRestoreEditTarget = Boolean(
    editTarget &&
      !isSelfEdit &&
      isEditTargetArchived &&
      editTarget.role?.name !== "ADMIN" &&
      (isAdmin || (isStaff && editTarget.role?.name === "USER")),
  );
  const canEditTargetDetails = Boolean(canManageAccounts && editTarget && !isSelfEdit);
  const canManualCheckInTarget = Boolean(
    canManageAccounts &&
      editTarget &&
      !isSelfEdit &&
      editTarget.role?.name === "USER" &&
      editTarget.status === "active" &&
      !editPendingRequest &&
      !isEditTargetArchived,
  );
  const canManageMemberCard = Boolean(
    canManageAccounts &&
      editTarget &&
      !isSelfEdit &&
      editTarget.role?.name === "USER" &&
      editTarget.status !== "pending",
  );

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
  const verifyNonMemberMutation = useMutation(
    verifyNonMemberMutationOptions(webApiClient, queryClient),
  );
  const scanAttendanceMutation = useMutation(scanAttendanceQrMutationOptions(webApiClient, queryClient));
  const manualAttendanceMutation = useMutation(
    manualAttendanceCheckInMutationOptions(webApiClient, queryClient),
  );
  const membershipPaymentReviewMutation = useMutation(
    verifyMembershipPaymentMutationOptions(webApiClient, queryClient),
  );
  const rejectLoadingLabel = useLoadingText("REJECTING REQUEST", rejectDeletionMutation.isPending);
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
  const restoreLoadingLabel = useLoadingText("RESTORING ACCOUNT", restoreLoading);
  const pageLoading = isLoading;

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
      const roleLabel =
        role === "admin"
          ? "Admin"
          : role === "staff"
            ? "Staff"
            : role === "coach"
              ? "Coach"
              : "Member";
      const creationMessage =
        "Account is not verified yet. The verification OTP sends when they sign in.";
      notify(
        "success",
        `${roleLabel} account created`,
        creationMessage,
      );
      return;
    }
    notify("error", "Could not create account", result.error ?? "Check the form details and try again.");
  };

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
    setVerifyNonMemberTarget(null);
    setEditTarget(null);
    setMobileInspectorOpen(false);
  };

  const patchOpenMember = (memberId: string, patch: Partial<MemberRecord>) => {
    setEditTarget((current) => (current?.id === memberId ? { ...current, ...patch } : current));
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
      notify("success", "Termination request denied", "The account stays active in the directory.");
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
        membershipCard: (result.membershipCard ?? null) as MembershipCardRecord | null,
      });
      setGrantCardTarget(null);
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
          reason: "Revoked via account module.",
          source: "admin_repair",
        },
      });

      patchOpenMember(revokeCardTarget.id, {
        membershipCard: (result.membershipCard ?? null) as MembershipCardRecord | null,
      });
      setRevokeCardTarget(null);
      notify("success", "Member access updated", result.message);
    } catch (error) {
      notifyActionError("Could not update member access", error, "Failed to revoke membership-card access.");
    }
  };

  const handleVerifyNonMember = async () => {
    const target = verifyNonMemberTarget ?? editTarget;
    if (!target) return;
    if (
      !canManuallyVerifyAccountTarget(target, {
        canManageAccounts,
        canManageAdminAccounts: isAdmin,
        currentUserId: user?.id,
        pendingRequestsByUserId,
      })
    ) {
      return;
    }

    try {
      const result = await verifyNonMemberMutation.mutateAsync(target.id);
      patchOpenMember(target.id, {
        emailVerified: true,
        status: result.user.status ?? "active",
      });
      setVerifyNonMemberTarget(null);
      notify("success", "Account verified", result.message);
    } catch (error) {
      notifyActionError(
        "Could not verify this account",
        error,
        getManualVerificationFallbackMessage(target),
      );
    }
  };

  const handleManualCheckIn = async (member: MemberRecord) => {
    try {
      const result = await manualAttendanceMutation.mutateAsync({ userId: member.id });
      patchOpenMember(member.id, { lastCheckInAt: result.check_in_at });
      notify(
        "success",
        `${result.member_name} checked in`,
        `Attendance recorded ${formatLastCheckIn(result.check_in_at)}.`,
      );
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
        detail: "A QR code value is required before attendance can be logged.",
      });
      notify("error", "QR code required", "Add or scan a QR value before logging attendance.");
      return;
    }

    try {
      const result: AttendanceCheckInRecord = await scanAttendanceMutation.mutateAsync({
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
      const detail = getActionErrorMessage(error, "Unable to scan this QR code.");
      const tone = /already|open attendance/i.test(detail) ? "warning" : "error";
      setScanFeedback({
        tone,
        title: tone === "warning" ? "Already checked in" : "Scan failed",
        detail,
      });
      notify(tone, tone === "warning" ? "Attendance already logged" : "Scan failed", detail);
    }
  };

  const handleApproveMembershipPayment = async () => {
    if (!pendingMembershipPayment) return;
    const reviewLabel = getMembershipPaymentReviewLabel(pendingMembershipPayment.payable_type ?? undefined);
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
        `${formatReviewPayableLabel(pendingMembershipPayment.payable_type ?? undefined)} has been marked as approved.`,
      );
    } catch {
      notify(
        "error",
        "Could not approve the payment review",
        `Try again while the ${reviewLabel} request is still awaiting verification.`,
      );
    } finally {
      setPaymentReviewAction(null);
    }
  };

  const handleRejectMembershipPayment = async () => {
    if (!pendingMembershipPayment) return;
    const reviewLabel = getMembershipPaymentReviewLabel(pendingMembershipPayment.payable_type ?? undefined);
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
        `${formatReviewPayableLabel(pendingMembershipPayment.payable_type ?? undefined)} remains blocked for now.`,
      );
    } catch {
      notify(
        "error",
        "Could not decline the payment review",
        `Try again while the ${reviewLabel} request is still awaiting verification.`,
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
          dateOfBirth: nextDateOfBirth || editTarget.profile?.dateOfBirth || null,
          gender: nextGender || editTarget.profile?.gender || null,
          activityLevel: nextActivityLevel || editTarget.profile?.activityLevel || null,
          fitnessGoal: nextFitnessGoal || editTarget.profile?.fitnessGoal || null,
          currentWeightKg: nextWeight ?? editTarget.profile?.currentWeightKg ?? null,
          heightCm: nextHeight ?? editTarget.profile?.heightCm ?? null,
        },
      });
      setEditModalOpen(false);
      setEditConfirmOpen(false);
      setPendingEditSubmission(null);
      notify("success", "Account details updated", "The account modal now reflects the saved changes.");
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
      notify("info", "No email available", "This account cannot be contacted by email yet.");
      return;
    }

    window.location.href = `mailto:${member.email}`;
  };

  const isCreateMode = contentMode === "create";
  const roleVisibleFilterOptions = isCoach
    ? MEMBER_FILTER_OPTIONS.filter((option) => option.value === "Member")
    : isStaff
      ? MEMBER_FILTER_OPTIONS.filter((option) => option.value !== "Admin")
      : MEMBER_FILTER_OPTIONS;
  const roleSelectOptions = roleVisibleFilterOptions.map((option) => ({
    label: option.label,
    value: option.value,
  }));
  const tierSelectOptions = MEMBER_TIER_FILTER_OPTIONS.map((option) => ({
    label: option.label,
    value: option.value,
  }));
  const directoryEmptyMessage = isTerminationRequestsView
    ? "No termination requests match your current filters."
    : "No accounts match your current filters.";
  const coachVisibleStatusTabs = isCoach
    ? MEMBER_STATUS_TABS.filter((option) => option.key !== "Termination Requests")
    : MEMBER_STATUS_TABS;
  const statusSelectOptions = coachVisibleStatusTabs.map((option) => ({
    label: option.key === "Termination Requests" ? "Requests" : option.label,
    value: option.key,
  }));

  return (
    <AccountsPageContext.Provider
      value={{
        activeChip,
        activeCoachActivityLevel,
        activeCoachMembershipStatus,
        activeCoachSessionStatus,
        activeStatus,
        activeTier,
        addLoading,
        addLoadingLabel,
        approveRequestLoadingLabel,
        archiveLoading,
        archiveLoadingLabel,
        archiveTarget,
        canArchiveEditTarget,
        canEditTargetDetails,
        canInspectAccounts,
        canManageAccounts,
        canManageMemberCard,
        canManualCheckInTarget,
        canRestoreEditTarget,
        canVerifyNonMemberTarget,
        canTerminateEditTarget,
        closeInspector,
        coachClientPanelMode,
        contentMode,
        deleteTarget,
        directoryEmptyMessage,
        directoryPageSize,
        editConfirmOpen,
        editDraft,
        editInitialValues,
        editLoading,
        editLoadingLabel,
        editModalOpen,
        editPendingRequest,
        editTarget,
        filtered,
        grantCardTarget,
        handleAdd,
        handleApproveMembershipPayment,
        handleArchiveMember,
        handleAttendanceScan,
        handleDelete,
        handleEdit,
        handleGrantMembershipCard,
        handleManualCheckIn,
        handleMessageMember,
        handleRejectDeleteRequest,
        handleRejectMembershipPayment,
        handleRestoreMember,
        handleRevokeMembershipCard,
        handleVerifyNonMember,
        isAccountsHamburgerMode,
        isAdmin,
        isApproveDeletionPending: approveDeletionMutation.isPending,
        isCoach,
        isCreateMode,
        isEditTargetArchived,
        isManualAttendancePending: manualAttendanceMutation.isPending,
        isMembershipCardPending: membershipCardMutation.isPending,
        isMembershipPaymentReviewPending: membershipPaymentReviewMutation.isPending,
        isRejectDeletionPending: rejectDeletionMutation.isPending,
        isScanAttendancePending: scanAttendanceMutation.isPending,
        isSelfEdit,
        isStaff,
        isTerminationRequestsView,
        manualCheckInLoadingLabel,
        members,
        membershipCardLoadingLabel,
        mobileInspectorOpen,
        noticeModal,
        openEditModal,
        openInspector,
        page,
        pageLoading,
        paginatedRows,
        paymentReviewAction,
        paymentReviewLoadingLabel,
        pendingEditSubmission,
        pendingMembershipPayment,
        pendingRequestsByUserId,
        q,
        queueEditConfirmation,
        rejectLoadingLabel,
        restoreLoading,
        restoreLoadingLabel,
        restoreTarget,
        verifyNonMemberTarget,
        revokeCardTarget,
        roleSelectOptions,
        scanFeedback,
        scanOpen,
        setActiveChip,
        setActiveCoachActivityLevel,
        setActiveCoachMembershipStatus,
        setActiveCoachSessionStatus,
        setActiveStatus,
        setActiveTier,
        setArchiveTarget,
        setCoachClientPanelMode,
        setContentMode,
        setDeleteTarget,
        setEditConfirmOpen,
        setEditDraft,
        setEditModalOpen,
        setGrantCardTarget,
        setNoticeModal,
        setPage,
        setPaymentReviewAction,
        setPendingEditSubmission,
        setQ,
        setRestoreTarget,
        setVerifyNonMemberTarget,
        setRevokeCardTarget,
        setScanFeedback,
        setScanOpen,
        setViewMode,
        statusSelectOptions,
        tierSelectOptions,
        totalPages,
        viewMode,
      }}
    >
      {children}
    </AccountsPageContext.Provider>
  );
}

export function useAccountsPage() {
  const context = useContext(AccountsPageContext);

  if (!context) {
    throw new Error("useAccountsPage must be used inside AccountsPageProvider");
  }

  return context;
}
