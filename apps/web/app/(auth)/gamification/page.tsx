"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Archive,
  CheckCircle2,
  Crown,
  EyeOff,
  Pencil,
  PlusCircle,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  AdminGamificationMuscleLeaderboardListParams,
  AdminGamificationSeasonCreateInput,
  AdminGamificationSeasonUpdateInput,
  AdminManualExpGrantInput,
  AdminGamificationSeasonStandingListParams,
  FitnessRankingGovernanceStatus,
} from "@fittrack/api-client";
import type {
  AdminGamificationOverviewRecord,
  AdminGamificationRankingProfileRecord,
  AdminGamificationSeasonStandingRecord,
  AdminGamificationSeasonSummaryRecord,
  FitnessMasteryRank,
  FitnessMuscleLeaderboardEntryRecord,
  FitnessRankingVisibility,
  FitnessSeasonStatus,
  MemberRecord,
  MuscleDefinitionRecord,
} from "@fittrack/types";
import {
  getFitnessExpProgressionState,
  getFitnessTargetExpDelta,
} from "@fittrack/types";
import {
  adminGamificationManualExpMembersQueryOptions,
  adminGamificationMuscleStandingsQueryOptions,
  adminGamificationSeasonStandingsQueryOptions,
  adminGamificationSeasonsQueryOptions,
  adminGamificationOverviewQueryOptions,
  createAdminGamificationSeasonMutationOptions,
  createAdminManualExpGrantMutationOptions,
  fitnessAchievementReviewsQueryOptions,
  fitnessMuscleDefinitionsQueryOptions,
  resolveAdminGamificationIntegrityCaseMutationOptions,
  updateAdminGamificationRankingOverrideMutationOptions,
  updateAdminGamificationSeasonMutationOptions,
  updateAdminGamificationSeasonStatusMutationOptions,
} from "@fittrack/query";

import { webApiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import {
  FitButton,
  FitDropdown,
  FitPagination,
  FitPill,
  FitSearch,
  FitSection,
  FitSelect,
  FitTable,
  FitText,
  FitTextArea,
  FitTextInput,
} from "@/components/fit";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { ConfirmModal, FitModal } from "@/components/modals";
import RankingReviewModal from "@/components/gamification/RankingReviewModal";
import {
  GovernanceWorkbench,
  type GovernanceView,
} from "@/components/gamification/GovernanceWorkbench";
import {
  ACHIEVEMENT_REVIEW_STATUS_COLORS,
  type AchievementReviewRecord,
  type AchievementReviewStatus,
} from "@/data/progress/milestones";
import styles from "./gamification.module.css";

export const dynamic = "force-dynamic";
const legacyGovernanceQueueEnabled = false;
const MASTERY_RANK_OPTIONS: FitnessMasteryRank[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "adamantite",
];
const MASTERY_RANK_COLORS: Record<FitnessMasteryRank, string> = {
  adamantite: "#a78bfa",
  bronze: "#b7794b",
  gold: "#d9a441",
  platinum: "#5fc9d7",
  silver: "#94a3b8",
};

const RANKING_GOVERNANCE_OPTIONS: {
  label: string;
  value: Extract<
    FitnessRankingGovernanceStatus,
    "normal" | "hidden_by_admin" | "disqualified"
  >;
}[] = [
  { label: "Restore normal", value: "normal" },
  { label: "Hide from rankings", value: "hidden_by_admin" },
  { label: "Disqualify season", value: "disqualified" },
];

const SEASON_VISIBILITY_OPTIONS: Array<{
  label: string;
  value: FitnessRankingVisibility | "";
}> = [
  { label: "All visibility", value: "" },
  { label: "Public", value: "public" },
  { label: "Anonymous", value: "anonymous" },
  { label: "Private", value: "private" },
];

const SEASON_GOVERNANCE_OPTIONS: Array<{
  label: string;
  value: FitnessRankingGovernanceStatus | "";
}> = [
  { label: "All governance", value: "" },
  { label: "Normal", value: "normal" },
  { label: "Hidden", value: "hidden_by_admin" },
  { label: "Disqualified", value: "disqualified" },
];

const MILESTONE_STATUS_OPTIONS: Array<{
  label: string;
  value: AchievementReviewStatus | "all";
}> = [
  { label: "Pending", value: "Pending" },
  { label: "All Review Statuses", value: "all" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
];

type GamificationTab = "overview" | "milestones";
type ManualExpAllocationDraft = {
  amount: number;
  muscleGroup: string;
};
type ManualExpDraft = {
  amount: string;
  allocations: ManualExpAllocationDraft[];
  editingAllocationIndex: number | null;
  muscleGroup: string;
  rationale: string;
  targetLevel: FitnessMasteryRank | "";
  userId: string;
};
type ManualExpFieldErrors = {
  allocations: string | null;
  amount: string | null;
  member: string | null;
  muscle: string | null;
  rationale: string | null;
  targetLevel: string | null;
};
type CursorPaginationMeta = {
  limit: number;
  next_cursor?: string | null;
  page: number;
  snapshot?: string | null;
  total: number;
  total_pages: number;
};
type ManualExpTargetLevelPreview = {
  currentLifetimeExp: number | null;
  delta: number | null;
  targetLevel: FitnessMasteryRank;
};
type SeasonDraft = {
  autoStartNext: boolean;
  description: string;
  endsAt: string;
  startsAt: string;
  title: string;
};
type AdminConfirmationState = {
  confirmIcon?: LucideIcon;
  confirmLabel: string;
  isDanger?: boolean;
  message: string;
  onConfirm: () => void;
  title: string;
};

function normalizeSeasonSelection(value: string) {
  const candidate = value.trim();
  return ["", "all", "current", "empty", "none"].includes(
    candidate.toLowerCase(),
  )
    ? ""
    : candidate;
}

function getSeasonScheduleValidation(draft: SeasonDraft) {
  if (draft.title.trim().length < 3) {
    return "Season name must be at least 3 characters.";
  }

  const startsAt = new Date(draft.startsAt);
  const endsAt = new Date(draft.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return "Enter a valid start and end date for the season.";
  }
  if (endsAt <= startsAt) {
    return "The season end must be after the season start.";
  }

  return null;
}

function createManualExpDraft(): ManualExpDraft {
  return {
    allocations: [],
    amount: "",
    editingAllocationIndex: null,
    muscleGroup: "",
    rationale:
      "Coach verified the member completed the post-session work without camera tracking.",
    userId: "",
    targetLevel: "",
  };
}

function getManualExpTargetLevelPreview(
  targetLevel: ManualExpDraft["targetLevel"],
  currentLifetimeExp: number | null,
): ManualExpTargetLevelPreview | null {
  if (!targetLevel) return null;

  if (
    currentLifetimeExp === null ||
    !Number.isFinite(currentLifetimeExp)
  ) {
    return {
      currentLifetimeExp: null,
      delta: null,
      targetLevel,
    };
  }

  const normalizedCurrentLifetimeExp = Math.max(
    0,
    Math.floor(currentLifetimeExp),
  );

  return {
    currentLifetimeExp: normalizedCurrentLifetimeExp,
    delta: getFitnessTargetExpDelta(
      normalizedCurrentLifetimeExp,
      targetLevel,
    ),
    targetLevel,
  };
}

function getManualExpTargetLevelAuditSuffix(
  targetPreview: ManualExpTargetLevelPreview | null,
) {
  if (
    !targetPreview ||
    targetPreview.currentLifetimeExp === null ||
    !targetPreview.delta ||
    targetPreview.delta < 1
  ) {
    return "";
  }

  return (
    "Target-level audit: " +
    targetPreview.currentLifetimeExp.toLocaleString("en-US") +
    " lifetime EXP -> " +
    labelize(targetPreview.targetLevel) +
    "; +" +
    targetPreview.delta.toLocaleString("en-US") +
    " EXP."
  );
}

function getManualExpGrantRationale(
  rationale: string,
  targetPreview: ManualExpTargetLevelPreview | null,
) {
  const auditSuffix = getManualExpTargetLevelAuditSuffix(targetPreview);
  return auditSuffix ? rationale + "\n" + auditSuffix : rationale;
}

function getManualExpFieldErrors(
  draft: ManualExpDraft,
  selectedMember: MemberRecord | undefined,
  muscleDefinitions: MuscleDefinitionRecord[],
  targetPreview: ManualExpTargetLevelPreview | null,
): ManualExpFieldErrors {
  const muscleGroup = draft.muscleGroup.trim();
  const amountIsDigitsOnly = /^\d+$/.test(draft.amount);
  const amount = amountIsDigitsOnly ? Number(draft.amount) : Number.NaN;
  const totalAllocatedExp = draft.allocations.reduce(
    (total, allocation) => total + allocation.amount,
    0,
  );
  const muscleDefinition = muscleDefinitions.find(
    (definition) =>
      definition.key.toLowerCase() === muscleGroup.toLowerCase(),
  );
  const duplicateAllocation = draft.allocations.some(
    (allocation, index) =>
      index !== draft.editingAllocationIndex &&
      allocation.muscleGroup.toLowerCase() === muscleGroup.toLowerCase(),
  );
  const rationale = draft.rationale.trim();
  const submittedRationale = getManualExpGrantRationale(
    rationale,
    targetPreview,
  );

  return {
    allocations:
      draft.editingAllocationIndex !== null
        ? "Save or cancel the allocation edit before review."
        : draft.allocations.length === 0
          ? "Add at least one muscle allocation."
          : null,
    amount:
      !amountIsDigitsOnly || !Number.isInteger(amount) || amount < 1 || amount > 1_000
        ? "Enter digits only for a whole-number amount from 1 to 1,000."
        : null,
    member:
      draft.userId && selectedMember
        ? null
        : "Choose an eligible active member.",
    muscle: !muscleGroup
      ? "Choose a muscle group."
      : !muscleDefinition
        ? "Choose a muscle group from the loaded definitions."
        : duplicateAllocation
          ? "This muscle already has an allocation. Edit the existing row instead."
          : null,
    rationale:
      rationale.length < 3
        ? "Reviewer rationale must be at least 3 characters."
        : submittedRationale.length > 500
          ? "Reviewer rationale, including the target-level audit, must be 500 characters or fewer."
          : null,
    targetLevel:
      targetPreview === null
        ? null
        : targetPreview.currentLifetimeExp === null
          ? "Current lifetime EXP is unavailable for this member, so a target level cannot be audited."
          : targetPreview.delta === null || targetPreview.delta < 1
            ? "Choose a target level above the member's current lifetime level."
            : totalAllocatedExp !== targetPreview.delta
              ? "Target " +
                labelize(targetPreview.targetLevel) +
                " requires exactly " +
                targetPreview.delta.toLocaleString("en-US") +
                " EXP across the muscle allocations. Current total: " +
                totalAllocatedExp.toLocaleString("en-US") +
                " EXP."
              : null,
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return "No timestamp yet";
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSeasonRemaining(endsAt: string, now: number) {
  const remainingMs = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "Closing on the next lifecycle sweep";
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${Math.max(1, minutes)}m remaining`;
}

function labelize(value: string) {
  return value
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function masteryRankColor(rank: FitnessMasteryRank) {
  return MASTERY_RANK_COLORS[rank];
}

function masteryRankLabel(rank: FitnessMasteryRank) {
  return labelize(rank);
}

function getMemberDisplayName(member: MemberRecord) {
  const firstName = member.profile?.firstName?.trim() ?? "";
  const lastName = member.profile?.lastName?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || member.email;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function getSeasonNextActions(
  status: FitnessSeasonStatus,
): FitnessSeasonStatus[] {
  if (status === "draft") return ["active", "archived"];
  if (status === "active") return ["closed", "archived"];
  if (status === "closed") return ["archived"];
  return [];
}

type DraftMap = Record<string, string>;
type RankingStateDraftMap = Record<
  string,
  Extract<
    FitnessRankingGovernanceStatus,
    "normal" | "hidden_by_admin" | "disqualified"
  >
>;

export default function GamificationPage() {
  const { user } = useAuth();

  if (user?.role === "COACH") {
    return <CoachGamificationPage />;
  }

  return <AdminGamificationPage />;
}

function CoachGamificationPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const fadeIn = useFadeIn({ duration: 180 });
  const themeTransition = useThemeTransition();
  const cardStyle: CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    display: "grid",
    gap: 8,
    minHeight: 132,
    padding: 16,
  };

  const coachSignals = [
    {
      icon: Trophy,
      label: "Client Progress",
      value: "Rankings",
      helper: "Review motivation signals without admin override controls.",
    },
    {
      icon: Activity,
      label: "Muscle Mastery",
      value: "Trends",
      helper: "Use progression context when planning session work.",
    },
    {
      icon: ShieldCheck,
      label: "Integrity Notes",
      value: "Read-only",
      helper: "Keep coaching guidance separate from governance actions.",
    },
  ];

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
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            padding: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <FitText
              style={{
                color: colors.textPrimary,
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              Coach Gamification
            </FitText>
            <FitText
              as="p"
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                marginTop: 4,
              }}
            >
              Member progress context for coaching decisions.
            </FitText>
          </div>
          <FitButton
            variant="primary"
            label="OPEN CLIENTS"
            onClick={() => router.push("/accounts")}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          {coachSignals.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} style={cardStyle}>
                <Icon size={18} color={colors.brand} />
                <FitText
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    fontWeight: 850,
                  }}
                >
                  {item.label}
                </FitText>
                <FitText
                  style={{
                    color: colors.textPrimary,
                    fontSize: 24,
                    fontWeight: 900,
                  }}
                >
                  {item.value}
                </FitText>
                <FitText
                  as="p"
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                  }}
                >
                  {item.helper}
                </FitText>
              </div>
            );
          })}
        </div>

        <div
          style={{
            ...cardStyle,
            alignItems: "center",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            minHeight: 0,
          }}
        >
          <div>
            <FitText
              style={{
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: 850,
              }}
            >
              Exercise references
            </FitText>
            <FitText
              as="p"
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                marginTop: 4,
              }}
            >
              Pair progression context with movement cues before the next
              session.
            </FitText>
          </div>
          <FitButton
            variant="ghost"
            label="OPEN LAB"
            onClick={() => router.push("/exercise-lab")}
          />
        </div>
      </div>
    </FitSection>
  );
}

function AdminGamificationPage() {
  const { colors } = useTheme();
  const fadeIn = useFadeIn({ duration: 240 });
  const themeTransition = useThemeTransition();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab] = useState<GamificationTab>("overview");
  const [confirmationState, setConfirmationState] =
    useState<AdminConfirmationState | null>(null);
  const [manualExpOpen, setManualExpOpen] = useState(false);
  const [seasonManagerOpen, setSeasonManagerOpen] = useState(false);
  const [seasonEditId, setSeasonEditId] = useState<string | null>(null);
  const [seasonDraft, setSeasonDraft] = useState<SeasonDraft>({
    autoStartNext: true,
    description: "",
    endsAt: "",
    startsAt: "",
    title: "",
  });
  const [governanceView, setGovernanceView] =
    useState<GovernanceView>("integrity");
  const [manualMemberSearch, setManualMemberSearch] = useState("");
  const [seasonRationale, setSeasonRationale] = useState(
    "Admin lifecycle review completed.",
  );
  const [seasonClock, setSeasonClock] = useState(() => Date.now());
  const [seasonStandingPage, setSeasonStandingPage] = useState(1);
  const [seasonStandingCursor, setSeasonStandingCursor] = useState<string>();
  const [seasonStandingSnapshot, setSeasonStandingSnapshot] = useState<string>();
  const [leaderboardMode, setLeaderboardMode] =
    useState<"overall" | "muscle">("overall");
  const [muscleStandingPage, setMuscleStandingPage] = useState(1);
  const [muscleStandingCursor, setMuscleStandingCursor] = useState<string>();
  const [muscleStandingSnapshot, setMuscleStandingSnapshot] = useState<string>();
  const [muscleStandingScope, setMuscleStandingScope] =
    useState<"lifetime" | "season">("season");
  const [selectedStandingMuscle, setSelectedStandingMuscle] = useState("");
  const [seasonStandingSearch, setSeasonStandingSearch] = useState("");
  const [seasonFilterId, setSeasonFilterId] = useState("");
  const [seasonMuscleFilter, setSeasonMuscleFilter] = useState("");
  const [seasonVisibilityFilter, setSeasonVisibilityFilter] =
    useState<FitnessRankingVisibility | "">("");
  const [seasonGovernanceFilter, setSeasonGovernanceFilter] =
    useState<FitnessRankingGovernanceStatus | "">("");
  const [seasonIncludeArchived, setSeasonIncludeArchived] = useState(false);
  const [milestoneReviews, setMilestoneReviews] = useState<
    AchievementReviewRecord[]
  >([]);
  const [milestoneStatus, setMilestoneStatus] =
    useState<AchievementReviewStatus | "all">("Pending");
  const [milestoneSearch, setMilestoneSearch] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [integrityNotes, setIntegrityNotes] = useState<DraftMap>({});
  const [rankingNotes, setRankingNotes] = useState<DraftMap>({});
  const [rankingStateDrafts, setRankingStateDrafts] =
    useState<RankingStateDraftMap>({});
  const [manualExpDraft, setManualExpDraft] = useState<ManualExpDraft>(
    createManualExpDraft,
  );
  const manualExpSubmittingRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setSeasonClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const overviewQuery = useQuery(
    adminGamificationOverviewQueryOptions(webApiClient),
  );
  const deferredManualMemberSearch = useDeferredValue(
    manualMemberSearch.trim(),
  );
  const membersQuery = useQuery({
    ...adminGamificationManualExpMembersQueryOptions(
      webApiClient,
      deferredManualMemberSearch,
    ),
    enabled: manualExpOpen && deferredManualMemberSearch.length >= 2,
  });
  const manualExpEligibleMembers = membersQuery.data ?? [];
  const muscleDefinitionsQuery = useQuery({
    ...fitnessMuscleDefinitionsQueryOptions(webApiClient),
    enabled: manualExpOpen || leaderboardMode === "muscle",
  });
  const manualExpMuscleDefinitions = useMemo(
    () => muscleDefinitionsQuery.data ?? [],
    [muscleDefinitionsQuery.data],
  );
  useEffect(() => {
    if (manualExpMuscleDefinitions.length === 0) return;
    setSelectedStandingMuscle((current) =>
      manualExpMuscleDefinitions.some((definition) => definition.key === current)
        ? current
        : manualExpMuscleDefinitions[0].key,
    );
  }, [manualExpMuscleDefinitions]);
  const normalizedSeasonFilterId = normalizeSeasonSelection(seasonFilterId);
  const seasonFilterParams = useMemo<AdminGamificationSeasonStandingListParams>(
    () => ({
      includeArchived: seasonIncludeArchived,
      limit: 10,
      page: seasonStandingPage,
      ...(seasonStandingCursor ? { cursor: seasonStandingCursor } : {}),
      ...(seasonStandingSnapshot ? { snapshot: seasonStandingSnapshot } : {}),
      ...(normalizedSeasonFilterId
        ? { seasonId: normalizedSeasonFilterId }
        : {}),
      ...(seasonMuscleFilter.trim()
        ? { muscleKey: seasonMuscleFilter.trim() }
        : {}),
      ...(seasonStandingSearch.trim()
        ? { search: seasonStandingSearch.trim() }
        : {}),
      ...(seasonVisibilityFilter
        ? { visibility: seasonVisibilityFilter }
        : {}),
      ...(seasonGovernanceFilter
        ? { governanceStatus: seasonGovernanceFilter }
        : {}),
    }),
    [
      seasonGovernanceFilter,
      seasonIncludeArchived,
      seasonMuscleFilter,
      seasonStandingPage,
      seasonStandingCursor,
      seasonStandingSnapshot,
      seasonStandingSearch,
      seasonVisibilityFilter,
      normalizedSeasonFilterId,
    ],
  );
  const seasonsQuery = useQuery(
    adminGamificationSeasonsQueryOptions(webApiClient),
  );
  const seasonStandingsQuery = useQuery({
    ...adminGamificationSeasonStandingsQueryOptions(
      webApiClient,
      seasonFilterParams,
    ),
    placeholderData: keepPreviousData,
  });
  const muscleStandingParams =
    useMemo<AdminGamificationMuscleLeaderboardListParams>(
      () => ({
        limit: 10,
        muscleKey: selectedStandingMuscle,
        page: muscleStandingPage,
        scope: muscleStandingScope,
        ...(muscleStandingCursor ? { cursor: muscleStandingCursor } : {}),
        ...(muscleStandingSnapshot ? { snapshot: muscleStandingSnapshot } : {}),
        ...(muscleStandingScope === "season" && normalizedSeasonFilterId
          ? { seasonId: normalizedSeasonFilterId }
          : {}),
        ...(seasonStandingSearch.trim()
          ? { search: seasonStandingSearch.trim() }
          : {}),
      }),
      [
        muscleStandingPage,
        muscleStandingCursor,
        muscleStandingSnapshot,
        muscleStandingScope,
        normalizedSeasonFilterId,
        seasonStandingSearch,
        selectedStandingMuscle,
      ],
    );
  const muscleStandingsQuery = useQuery({
    ...adminGamificationMuscleStandingsQueryOptions(
      webApiClient,
      muscleStandingParams,
    ),
    placeholderData: keepPreviousData,
    enabled:
      leaderboardMode === "muscle" &&
      manualExpMuscleDefinitions.some(
        (definition) => definition.key === selectedStandingMuscle,
      ),
  });
  const milestoneReviewsQuery = useQuery({
    ...fitnessAchievementReviewsQueryOptions(webApiClient),
    enabled: false,
  });
  const seasonMutation = useMutation(
    updateAdminGamificationSeasonStatusMutationOptions(
      webApiClient,
      queryClient,
    ),
  );
  const createSeasonMutation = useMutation(
    createAdminGamificationSeasonMutationOptions(webApiClient, queryClient),
  );
  const updateSeasonMutation = useMutation(
    updateAdminGamificationSeasonMutationOptions(webApiClient, queryClient),
  );
  const integrityMutation = useMutation(
    resolveAdminGamificationIntegrityCaseMutationOptions(
      webApiClient,
      queryClient,
    ),
  );
  const rankingMutation = useMutation(
    updateAdminGamificationRankingOverrideMutationOptions(
      webApiClient,
      queryClient,
    ),
  );
  const manualExpMutation = useMutation(
    createAdminManualExpGrantMutationOptions(webApiClient, queryClient),
  );
  const seasonMutationPending =
    seasonMutation.isPending ||
    createSeasonMutation.isPending ||
    updateSeasonMutation.isPending;
  const selectedManualExpMember = manualExpEligibleMembers.find(
    (member) => member.id === manualExpDraft.userId,
  );
  const selectedManualExpStanding = seasonStandingsQuery.data?.data.find(
    (standing) => standing.userId === manualExpDraft.userId,
  );
  const selectedManualExpLifetimeExp =
    selectedManualExpStanding?.totalXp ?? null;
  const manualExpTargetLevelPreview = getManualExpTargetLevelPreview(
    manualExpDraft.targetLevel,
    selectedManualExpLifetimeExp,
  );
  const manualExpFieldErrors = getManualExpFieldErrors(
    manualExpDraft,
    selectedManualExpMember,
    manualExpMuscleDefinitions,
    manualExpTargetLevelPreview,
  );
  const manualExpComposerActive =
    manualExpDraft.editingAllocationIndex !== null ||
    Boolean(manualExpDraft.amount.trim() || manualExpDraft.muscleGroup.trim());
  const manualExpReviewBlocked = Boolean(
    manualExpFieldErrors.member ||
      manualExpFieldErrors.allocations ||
      manualExpFieldErrors.rationale ||
      manualExpFieldErrors.targetLevel ||
      (manualExpComposerActive &&
        (manualExpFieldErrors.muscle || manualExpFieldErrors.amount)),
  );
  const seasonDraftValidation = getSeasonScheduleValidation(seasonDraft);
  const refreshGamificationViews = () =>
    Promise.all([
      overviewQuery.refetch(),
      seasonsQuery.refetch(),
      seasonStandingsQuery.refetch(),
      ...(leaderboardMode === "muscle" ? [muscleStandingsQuery.refetch()] : []),
    ]);
  const rankingViewsFetching =
    overviewQuery.isFetching ||
    seasonsQuery.isFetching ||
    seasonStandingsQuery.isFetching ||
    (leaderboardMode === "muscle" && muscleStandingsQuery.isFetching);
  const changeSeasonStandingPage = (nextPage: number) => {
    setSeasonStandingCursor(undefined);
    setSeasonStandingSnapshot(undefined);
    setSeasonStandingPage(nextPage);
  };
  const advanceSeasonStandingCursor = (
    cursor: string,
    snapshot?: string | null,
  ) => {
    setSeasonStandingCursor(cursor);
    setSeasonStandingSnapshot(snapshot ?? undefined);
    setSeasonStandingPage((current) => current + 1);
  };
  const changeMuscleStandingPage = (nextPage: number) => {
    setMuscleStandingCursor(undefined);
    setMuscleStandingSnapshot(undefined);
    setMuscleStandingPage(nextPage);
  };
  const advanceMuscleStandingCursor = (
    cursor: string,
    snapshot?: string | null,
  ) => {
    setMuscleStandingCursor(cursor);
    setMuscleStandingSnapshot(snapshot ?? undefined);
    setMuscleStandingPage((current) => current + 1);
  };
  useEffect(() => {
    if (searchParams.get("tab") === "milestones") {
      router.replace("/milestones");
    }
  }, [router, searchParams]);

  useEffect(() => {
    const reviews = milestoneReviewsQuery.data ?? [];
    setMilestoneReviews(reviews);
    setSelectedMilestoneId((current) =>
      current && reviews.some((review) => review.id === current)
        ? current
        : (reviews[0]?.id ?? ""),
    );
  }, [milestoneReviewsQuery.data]);

  useEffect(() => {
    setSeasonStandingPage(1);
    setSeasonStandingCursor(undefined);
    setSeasonStandingSnapshot(undefined);
  }, [
    seasonGovernanceFilter,
    seasonIncludeArchived,
    seasonMuscleFilter,
    seasonStandingSearch,
    seasonVisibilityFilter,
    normalizedSeasonFilterId,
  ]);

  useEffect(() => {
    setMuscleStandingPage(1);
    setMuscleStandingCursor(undefined);
    setMuscleStandingSnapshot(undefined);
  }, [
    muscleStandingScope,
    normalizedSeasonFilterId,
    seasonStandingSearch,
    selectedStandingMuscle,
  ]);

  const overview = overviewQuery.data;
  const activeSeasonActions = useMemo(
    () =>
      overview?.activeSeason
        ? getSeasonNextActions(overview.activeSeason.status)
        : [],
    [overview?.activeSeason],
  );
  const panelStyle = {
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
    padding: 10,
  };
  const subPanelStyle = {
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 8,
  };
  const overviewBottomCardStyle = {
    ...panelStyle,
    padding: 0,
    display: "grid",
    gap: 0,
    overflow: "hidden",
  };
  const overviewBottomContentStyle = {
    ...subPanelStyle,
    border: 0,
    borderRadius: 0,
    display: "grid",
    gap: 10,
    minWidth: 0,
    overflow: "visible",
    padding: 14,
  };
  const muted = { color: colors.textMuted, fontSize: 13, lineHeight: 1.5 };

  const updateDraft = (
    setter: Dispatch<SetStateAction<DraftMap>>,
    key: string,
    value: string,
  ) => setter((current) => ({ ...current, [key]: value }));

  const resolveIntegrityCase = (
    caseId: string,
    status: "resolved_valid" | "resolved_invalid",
    rationale = integrityNotes[caseId]?.trim() ||
      (status === "resolved_valid"
        ? "Manual review confirmed this progression can stand."
        : "Manual review confirmed this progression should stay invalid."),
  ) => {
    integrityMutation.mutate({
      caseId,
      payload: { status, rationale },
    });
  };

  const updateRanking = (profile: AdminGamificationRankingProfileRecord) => {
    const governanceStatus =
      rankingStateDrafts[profile.userId] ??
      (profile.governanceStatus === "disqualified"
        ? "normal"
        : "hidden_by_admin");
    const rationale =
      rankingNotes[profile.userId]?.trim() ||
      "Admin ranking-governance review completed.";

    setConfirmationState({
      confirmIcon: ShieldCheck,
      confirmLabel: "Apply ranking decision",
      isDanger: governanceStatus === "disqualified",
      message: `${profile.memberName} will move to ${labelize(governanceStatus)} ranking governance with the saved admin note.`,
      title: "Apply Ranking Governance Decision?",
      onConfirm: () => {
        rankingMutation.mutate({
          userId: profile.userId,
          payload: {
            governanceStatus,
            rationale,
            adminNote: governanceStatus === "normal" ? null : rationale,
          },
        });
      },
    });
  };

  const moderateStanding = (
    standing: AdminGamificationSeasonStandingRecord,
    governanceStatus: Extract<
      FitnessRankingGovernanceStatus,
      "normal" | "hidden_by_admin" | "disqualified"
    >,
    rationale: string,
  ) => {
    const actionLabel =
      governanceStatus === "normal"
        ? "be restored to the rankings"
        : governanceStatus === "hidden_by_admin"
          ? "be hidden from the rankings"
          : "be disqualified from this season";

    setConfirmationState({
      confirmIcon:
        governanceStatus === "normal" ? ShieldCheck : ShieldAlert,
      confirmLabel:
        governanceStatus === "normal"
          ? "Restore ranking"
          : governanceStatus === "hidden_by_admin"
            ? "Hide from rankings"
            : "Disqualify",
      isDanger: governanceStatus === "disqualified",
      message: `${standing.memberName} will ${actionLabel}. Their FitTrack account will remain active.`,
      title: "Confirm Ranking Decision?",
      onConfirm: () => {
        rankingMutation.mutate({
          userId: standing.userId,
          payload: {
            governanceStatus,
            rationale,
            adminNote: governanceStatus === "normal" ? null : rationale,
          },
        });
      },
    });
  };

  const openSeasonManager = () => {
    if (seasonMutationPending) return;
    setSeasonEditId(null);
    if (!seasonDraft.startsAt || !seasonDraft.endsAt) {
      const startsAt = new Date();
      startsAt.setDate(startsAt.getDate() + 7);
      startsAt.setHours(0, 0, 0, 0);
      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + 90);
      endsAt.setHours(23, 59, 0, 0);
      setSeasonDraft((current) => ({
        ...current,
        endsAt: toLocalDateTimeInput(endsAt),
        startsAt: toLocalDateTimeInput(startsAt),
      }));
    }
    setSeasonManagerOpen(true);
  };

  const openSeasonEditor = (season: AdminGamificationSeasonSummaryRecord) => {
    if (seasonMutationPending) return;
    setSeasonEditId(season.id);
    setSeasonDraft({
      autoStartNext: season.autoStartNext,
      description: "",
      endsAt: toLocalDateTimeInput(new Date(season.endsAt)),
      startsAt: toLocalDateTimeInput(new Date(season.startsAt)),
      title: season.title,
    });
    setSeasonManagerOpen(true);
  };

  const submitSeasonDraft = () => {
    const validationMessage = getSeasonScheduleValidation(seasonDraft);
    if (validationMessage) {
      setConfirmationState({
        confirmIcon: ShieldAlert,
        confirmLabel: "Close",
        message: validationMessage,
        title: "Season Schedule Needs Attention",
        onConfirm: () => undefined,
      });
      return;
    }

    const startsAt = new Date(seasonDraft.startsAt);
    const endsAt = new Date(seasonDraft.endsAt);
    if (seasonEditId) {
      const payload: AdminGamificationSeasonUpdateInput = {
        autoStartNext: seasonDraft.autoStartNext,
        endsAt: endsAt.toISOString(),
        startsAt: startsAt.toISOString(),
        title: seasonDraft.title.trim(),
      };
      updateSeasonMutation.mutate(
        { payload, seasonId: seasonEditId },
        {
          onSuccess: () => {
            setSeasonEditId(null);
            setSeasonManagerOpen(false);
            setSeasonDraft({
              autoStartNext: true,
              description: "",
              endsAt: "",
              startsAt: "",
              title: "",
            });
          },
        },
      );
      return;
    }

    const payload: AdminGamificationSeasonCreateInput = {
      autoStartNext: seasonDraft.autoStartNext,
      description: seasonDraft.description.trim() || null,
      endsAt: endsAt.toISOString(),
      startsAt: startsAt.toISOString(),
      title: seasonDraft.title.trim(),
    };
    createSeasonMutation.mutate(payload, {
      onSuccess: () => {
        setSeasonEditId(null);
        setSeasonManagerOpen(false);
        setSeasonDraft({
          autoStartNext: true,
          description: "",
          endsAt: "",
          startsAt: "",
          title: "",
        });
      },
    });
  };

  const openManualExpModal = () => {
    manualExpMutation.reset();
    setManualExpOpen(true);
  };

  const closeManualExpModal = () => {
    if (manualExpMutation.isPending) return;
    manualExpMutation.reset();
    setManualExpOpen(false);
    setManualMemberSearch("");
    setManualExpDraft(createManualExpDraft());
  };

  const updateManualExpDraft: Dispatch<SetStateAction<ManualExpDraft>> = (
    value,
  ) => {
    manualExpMutation.reset();
    setManualExpDraft(value);
  };

  const updateManualMemberSearch = (value: string) => {
    manualExpMutation.reset();
    setManualMemberSearch(value);
  };

  const submitManualExpGrant = () => {
    const selectedMember = selectedManualExpMember;
    const rationale = manualExpDraft.rationale.trim();

    if (manualExpReviewBlocked || !selectedMember) return;

    const submittedRationale = getManualExpGrantRationale(
      rationale,
      manualExpTargetLevelPreview,
    );
    const payload: AdminManualExpGrantInput = {
      allocations: manualExpDraft.allocations,
      rationale: submittedRationale,
      userId: manualExpDraft.userId,
    };
    const totalExp = payload.allocations.reduce(
      (total, allocation) => total + allocation.amount,
      0,
    );
    const allocationSummary = payload.allocations
      .map((allocation) => {
        const definition = manualExpMuscleDefinitions.find(
          (candidate) => candidate.key === allocation.muscleGroup,
        );
        return `${definition?.name ?? labelize(allocation.muscleGroup)} ${allocation.amount.toLocaleString("en-US")} EXP`;
      })
      .join("; ");

    setConfirmationState({
      confirmIcon: PlusCircle,
      confirmLabel: "Grant EXP",
      message:
        "Member: " +
        getMemberDisplayName(selectedMember) +
        ". Allocations: " +
        allocationSummary +
        ". Total EXP: " +
        totalExp.toLocaleString("en-US") +
        ". Rationale: " +
        submittedRationale,
      title: "Apply Manual EXP Grant?",
      onConfirm: () => {
        if (manualExpSubmittingRef.current || manualExpMutation.isPending) {
          return;
        }
        manualExpSubmittingRef.current = true;
        manualExpMutation.mutate(
          { idempotencyKey: crypto.randomUUID(), payload },
          {
            onSuccess: () => {
              setManualExpOpen(false);
              setManualExpDraft(createManualExpDraft());
              setManualMemberSearch("");
            },
            onSettled: () => {
              manualExpSubmittingRef.current = false;
            },
          },
        );
      },
    });
  };

  return (
    <FitSection
      as="section"
      heading=""
      hideHeading
      bare
      noPadding
      className={`${themeTransition} gamification-admin-shell ${styles.adminShell}`}
      style={{
        ...fadeIn,
        height: "100%",
        marginBottom: 0,
        overflowX: "hidden",
        overflowY: "auto",
        paddingRight: 4,
        scrollbarGutter: "stable",
      }}
    >
      <div
        data-ui="gamification-admin-page"
        className={styles.adminPage}
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        <div
          data-ui="gamification-command-center"
          className={`gamification-governance-header ${styles.commandCenter}`}
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            padding: 12,
            backgroundColor: colors.surface,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: 8,
            minHeight: 0,
          }}
        >
          <div
            style={{
              alignItems: "flex-start",
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "space-between",
            }}
          >
            <div className={styles.commandIdentity} style={{ display: "grid", gap: 5, minWidth: 240 }}>
              <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <FitText
                  as="h2"
                  style={{
                    fontSize: 18,
                    lineHeight: 1.15,
                    letterSpacing: 0,
                    fontWeight: 900,
                  }}
                >
                  {overview?.activeSeason?.title ?? "No active season"}
                </FitText>
                {overview?.activeSeason ? (
                  <FitPill
                    mode="status"
                    label={labelize(overview.activeSeason.status)}
                    color={colors.brand}
                  />
                ) : null}
              </div>
              <FitText style={muted}>
                {overview?.activeSeason
                  ? `${overview.activeSeason.standingCount} standings / ${overview.activeSeason.hiddenCount} hidden / ${overview.activeSeason.disqualifiedCount} disqualified`
                  : "Create or activate a season to begin tracking standings."}
              </FitText>
            </div>
            <div
              className={`gamification-sync-card ${styles.commandActions}`}
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <FitButton
                variant="ghost"
                icon={Crown}
                label="Manage seasons"
                onClick={openSeasonManager}
                style={{ minHeight: 34, paddingInline: 10 }}
              />
              <span data-ui="gamification-manual-exp-trigger">
                <FitButton
                  variant="primary"
                  icon={PlusCircle}
                  label="Grant EXP"
                  onClick={openManualExpModal}
                  style={{ minHeight: 36, minWidth: 112, paddingInline: 14 }}
                />
              </span>
              <FitButton
                variant="ghost"
                icon={RefreshCcw}
                label="Refresh"
                loading={rankingViewsFetching}
                onClick={() => void refreshGamificationViews()}
                style={{ minHeight: 34, paddingInline: 10 }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 7, minHeight: 0 }}>
            {overview?.activeSeason ? (
              <div
                data-ui="gamification-active-season"
                className={`gamification-active-season-panel ${styles.activeSeason}`}
                style={{
                  ...subPanelStyle,
                  backgroundColor: "transparent",
                  border: 0,
                  borderRadius: 0,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr)",
                  padding: 0,
                }}
              >
                <details
                  data-ui="gamification-season-controls"
                  style={{
                    borderTop: `1px solid ${colors.border}`,
                  }}
                >
                  <summary
                    style={{
                      alignItems: "center",
                      color: colors.textSecondary,
                      cursor: "pointer",
                      display: "flex",
                      fontSize: 13,
                      fontWeight: 800,
                      minHeight: 32,
                    }}
                  >
                    <span>Season controls</span>
                  </summary>
                  <div
                    className="gamification-season-control-grid"
                    style={{
                      alignItems: "end",
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "minmax(220px, 1fr) auto",
                      marginTop: 10,
                    }}
                  >
                    <FitTextArea
                      aria-label="Lifecycle rationale"
                      id="gamification-season-lifecycle-rationale"
                      value={seasonRationale}
                      onChange={(event) => setSeasonRationale(event.target.value)}
                      rows={2}
                      placeholder="Lifecycle rationale"
                      style={{ minHeight: 58 }}
                    />
                    <div
                      className="gamification-active-season-actions"
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        justifyContent: "flex-end",
                      }}
                    >
                      {activeSeasonActions.map((status) => (
                        <FitButton
                          key={status}
                          variant={status === "archived" ? "ghost" : "primary"}
                          icon={status === "archived" ? Archive : CheckCircle2}
                          label={
                            status === "archived"
                              ? "Archive"
                              : status === "closed"
                                ? "Close"
                                : labelize(status)
                          }
                          loading={seasonMutationPending}
                          style={{ minHeight: 34, minWidth: 86, paddingInline: 10 }}
                          textStyle={{ fontSize: 12, whiteSpace: "nowrap" }}
                          onClick={() =>
                            setConfirmationState({
                              confirmIcon:
                                status === "archived" ? Archive : CheckCircle2,
                              confirmLabel: `Move to ${labelize(status)}`,
                              isDanger: status === "archived",
                              message: `${overview.activeSeason!.title} will move from ${labelize(overview.activeSeason!.status)} to ${labelize(status)}. This affects season availability and admin reporting.`,
                              title: "Confirm Season Lifecycle Change?",
                              onConfirm: () => {
                                seasonMutation.mutate({
                                  seasonId: overview.activeSeason!.id,
                                  payload: {
                                    status,
                                    rationale:
                                      seasonRationale.trim() ||
                                      "Admin lifecycle review completed.",
                                  },
                                });
                              },
                            })
                          }
                        />
                      ))}
                      {activeSeasonActions.length === 0 ? (
                        <FitText style={muted}>
                          No safe lifecycle move is currently available.
                        </FitText>
                      ) : null}
                    </div>
                  </div>
                </details>
              </div>
            ) : (
              <FitText style={muted}>
                No active season is currently eligible for lifecycle controls.
              </FitText>
            )}
          </div>
          {overviewQuery.error ? (
            <FitText role="alert" style={{ color: colors.danger, fontSize: 12 }}>
              {getErrorMessage(
                overviewQuery.error,
                "Unable to load ranking governance overview.",
              )}
            </FitText>
          ) : null}
        </div>

        {activeTab === "overview" ? (
          <div
            data-ui="gamification-overview"
            className="gamification-overview-grid"
            style={{
              display: "grid",
              gridTemplateRows: "auto",
              gap: 14,
              minHeight: 0,
              overflow: "visible",
            }}
          >
            <MetricGrid overview={overview} />

            <div style={{ minHeight: 0, overflow: "visible" }}>
              {leaderboardMode === "overall" ? (
                <SeasonPerformanceTable
                actionError={rankingMutation.error}
                includeArchived={seasonIncludeArchived}
                leaderboardMode={leaderboardMode}
                loadError={seasonStandingsQuery.error ?? seasonsQuery.error}
                muscleFilter={seasonMuscleFilter}
                onIncludeArchivedChange={setSeasonIncludeArchived}
                onLeaderboardModeChange={setLeaderboardMode}
                onMuscleFilterChange={setSeasonMuscleFilter}
                onNextCursor={advanceSeasonStandingCursor}
                onPageChange={changeSeasonStandingPage}
                onSearchChange={setSeasonStandingSearch}
                onSeasonChange={(value) =>
                  setSeasonFilterId(normalizeSeasonSelection(value))
                }
                onVisibilityChange={setSeasonVisibilityFilter}
                onGovernanceChange={setSeasonGovernanceFilter}
                onModerate={moderateStanding}
                onOpenManualExp={openManualExpModal}
                onOpenSeasonManager={openSeasonManager}
                onRefresh={() => void refreshGamificationViews()}
                moderationPending={rankingMutation.isPending}
                page={seasonStandingPage}
                refreshing={rankingViewsFetching}
                search={seasonStandingSearch}
                selectedGovernance={seasonGovernanceFilter}
                selectedSeasonId={normalizedSeasonFilterId}
                selectedVisibility={seasonVisibilityFilter}
                seasons={seasonsQuery.data ?? []}
                standings={seasonStandingsQuery.data}
              />
              ) : (
                <MusclePerformanceTable
                  actionError={rankingMutation.error}
                  governanceProfiles={overview?.rankings.profiles ?? []}
                  leaderboardMode={leaderboardMode}
                  loadError={
                    muscleStandingsQuery.error ??
                    seasonsQuery.error ??
                    muscleDefinitionsQuery.error
                  }
                  moderationPending={rankingMutation.isPending}
                  muscleDefinitions={manualExpMuscleDefinitions}
                  onLeaderboardModeChange={setLeaderboardMode}
                  onModerate={moderateStanding}
                  onMuscleChange={setSelectedStandingMuscle}
                  onOpenManualExp={openManualExpModal}
                  onOpenSeasonManager={openSeasonManager}
                  onNextCursor={advanceMuscleStandingCursor}
                  onPageChange={changeMuscleStandingPage}
                  onRefresh={() => void refreshGamificationViews()}
                  onScopeChange={setMuscleStandingScope}
                  onSearchChange={setSeasonStandingSearch}
                  onSeasonChange={(value) =>
                    setSeasonFilterId(normalizeSeasonSelection(value))
                  }
                  page={muscleStandingPage}
                  refreshing={
                    rankingViewsFetching
                  }
                  scope={muscleStandingScope}
                  search={seasonStandingSearch}
                  selectedMuscle={selectedStandingMuscle}
                  selectedSeasonId={normalizedSeasonFilterId}
                  seasons={seasonsQuery.data ?? []}
                  standings={muscleStandingsQuery.data}
                />
              )}
            </div>

            {legacyGovernanceQueueEnabled ? (
            <FitSection
              heading="Governance Queue"
              action={
                <FitPill
                  mode="status"
                  label={`${(overview?.integrity.cases.length ?? 0) + (overview?.rankings.profiles.length ?? 0)} actionable`}
                  color={colors.brand}
                />
              }
              className={`gamification-governance-workspace ${styles.governanceWorkspace}`}
              style={overviewBottomCardStyle}
              bare
            >
              <GovernanceWorkbench
                activeView={governanceView}
                formatDateTime={formatDateTime}
                integrityPending={integrityMutation.isPending}
                labelize={labelize}
                onActiveViewChange={setGovernanceView}
                onApplyRanking={updateRanking}
                onRankingDraftChange={(userId, value) =>
                  setRankingStateDrafts((current) => ({
                    ...current,
                    [userId]: value,
                  }))
                }
                onRankingNoteChange={(userId, value) =>
                  updateDraft(setRankingNotes, userId, value)
                }
                onResolveIntegrity={resolveIntegrityCase}
                overview={overview}
                rankingDrafts={rankingStateDrafts}
                rankingNotes={rankingNotes}
                rankingPending={rankingMutation.isPending}
              />
              <div
                aria-hidden="true"
                className={styles.governanceBody}
                hidden
                style={{ display: "none" }}
              >
              <div
                role="tablist"
                aria-label="Gamification governance views"
                data-ui="gamification-governance-tabs"
                data-ui-peer-contract="quiet-equal"
                className={styles.governanceTabs}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                {[
                  {
                    id: "integrity" as const,
                    icon: ShieldAlert,
                    label: "Integrity",
                    count: overview?.integrity.cases.length ?? 0,
                  },
                  {
                    id: "rankings" as const,
                    icon: Crown,
                    label: "Rankings",
                    count: overview?.rankings.profiles.length ?? 0,
                  },
                  {
                    id: "audit" as const,
                    icon: Activity,
                    label: "Audit log",
                    count: overview?.audit.recentActions.length ?? 0,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const selected = governanceView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      id={`gamification-governance-tab-${item.id}`}
                      aria-controls={`gamification-governance-panel-${item.id}`}
                      aria-selected={selected}
                      data-ui={`gamification-governance-tab-${item.id}`}
                      className={styles.governanceTab}
                      onClick={() => setGovernanceView(item.id)}
                      style={{
                        alignItems: "center",
                        backgroundColor: "transparent",
                        border: 0,
                        borderBottom: selected
                          ? `2px solid ${colors.brand}`
                          : "2px solid transparent",
                        color: selected ? colors.textPrimary : colors.textMuted,
                        cursor: "pointer",
                        display: "flex",
                        gap: 8,
                        justifyContent: "center",
                        minHeight: 46,
                        padding: "8px 12px",
                      }}
                    >
                      <Icon size={15} color={selected ? colors.brand : colors.textMuted} />
                      <FitText
                        as="span"
                        style={{
                          color: "inherit",
                          fontSize: 12,
                          fontWeight: selected ? 800 : 700,
                        }}
                      >
                        {item.label}
                      </FitText>
                      <FitText
                        as="span"
                        style={{
                          color: selected ? colors.brand : colors.textMuted,
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {item.count}
                      </FitText>
                    </button>
                  );
                })}
              </div>

              {governanceView === "integrity" ? (
                <div
                  role="tabpanel"
                  id="gamification-governance-panel-integrity"
                  aria-labelledby="gamification-governance-tab-integrity"
                  className={`gamification-integrity-review-panel ${styles.governancePanel}`}
                  data-ui="gamification-integrity-review-panel"
                  style={overviewBottomContentStyle}
                >
                  <div>
                    <FitText style={{ display: "block", fontWeight: 800 }}>
                      Review suspicious progression
                    </FitText>
                    <FitText style={muted}>
                      Confirm whether an AI-flagged result should remain valid before it affects trusted rankings.
                    </FitText>
                  </div>
                  <RecordList emptyCopy="No open integrity cases.">
                    {overview?.integrity.cases.slice(0, 1).map((integrityCase) => (
                      <div
                        key={integrityCase.caseId}
                        className={styles.governanceRecord}
                        style={subPanelStyle}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <div>
                            <FitText style={{ display: "block", fontWeight: 800 }}>
                              {integrityCase.memberName}
                            </FitText>
                            <FitText
                              style={{
                                ...muted,
                                display: "-webkit-box",
                                marginTop: 4,
                                overflow: "hidden",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 1,
                              }}
                            >
                              {integrityCase.summary ?? "No case summary provided."}
                            </FitText>
                          </div>
                          <FitPill
                            mode="status"
                            label={labelize(integrityCase.riskLevel)}
                            color={
                              integrityCase.riskLevel === "high"
                                ? colors.danger
                                : colors.brand
                            }
                          />
                        </div>
                        <label
                          htmlFor={`gamification-integrity-rationale-${integrityCase.caseId}`}
                          style={{ display: "grid", gap: 6, marginTop: 10 }}
                        >
                          <FitText
                            style={{
                              color: colors.textSecondary,
                              fontSize: 12,
                              fontWeight: 750,
                            }}
                          >
                            Reviewer rationale
                          </FitText>
                          <FitTextArea
                            aria-label="Reviewer rationale for this integrity decision"
                            id={`gamification-integrity-rationale-${integrityCase.caseId}`}
                            rows={2}
                            value={integrityNotes[integrityCase.caseId] ?? ""}
                            onChange={(event) =>
                              updateDraft(
                                setIntegrityNotes,
                                integrityCase.caseId,
                                event.target.value,
                              )
                            }
                            placeholder="Explain why this activity is valid or invalid."
                          />
                        </label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                          <FitButton
                            variant="ghost"
                            icon={ShieldCheck}
                            label="Resolve valid"
                            loading={integrityMutation.isPending}
                            style={{ minHeight: 32, padding: "6px 10px" }}
                            textStyle={{ fontSize: 11, fontWeight: 800 }}
                            onClick={() =>
                              resolveIntegrityCase(
                                integrityCase.caseId,
                                "resolved_valid",
                              )
                            }
                          />
                          <FitButton
                            variant="danger"
                            icon={EyeOff}
                            label="Resolve invalid"
                            loading={integrityMutation.isPending}
                            style={{ minHeight: 32, padding: "6px 10px" }}
                            textStyle={{ fontSize: 11, fontWeight: 800 }}
                            onClick={() =>
                              resolveIntegrityCase(
                                integrityCase.caseId,
                                "resolved_invalid",
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </RecordList>
                </div>
              ) : governanceView === "rankings" ? (
                <div
                  role="tabpanel"
                  id="gamification-governance-panel-rankings"
                  aria-labelledby="gamification-governance-tab-rankings"
                  className={`gamification-ranking-governance-panel ${styles.governancePanel}`}
                  data-ui="gamification-ranking-governance-panel"
                  style={overviewBottomContentStyle}
                >
                  <div>
                    <FitText style={{ display: "block", fontWeight: 800 }}>
                      Control public ranking eligibility
                    </FitText>
                    <FitText style={muted}>
                      Restore, hide, or disqualify an exceptional profile without changing earned workout history.
                    </FitText>
                  </div>
                  <RecordList emptyCopy="No admin-governed ranking profiles yet.">
                    {overview?.rankings.profiles.slice(0, 1).map((profile) => (
                      <div
                        key={profile.userId}
                        className={styles.governanceRecord}
                        style={subPanelStyle}
                      >
                        <ProfileHeading
                          title={profile.memberName}
                          subtitle={`${labelize(profile.governanceStatus)} / ${labelize(
                            profile.visibility,
                          )}`}
                        />
                        <div
                          style={{
                            display: "grid",
                            gap: 8,
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                            marginTop: 10,
                          }}
                        >
                          <FitDropdown
                            fullWidth
                            value={
                              rankingStateDrafts[profile.userId] ??
                              (profile.governanceStatus === "disqualified"
                                ? "normal"
                                : "hidden_by_admin")
                            }
                            options={RANKING_GOVERNANCE_OPTIONS}
                            onChange={(value) =>
                              setRankingStateDrafts((current) => ({
                                ...current,
                                [profile.userId]:
                                  value as RankingStateDraftMap[string],
                              }))
                            }
                          />
                          <FitButton
                            variant="primary"
                            icon={ShieldCheck}
                            label="Apply"
                            loading={rankingMutation.isPending}
                            onClick={() => updateRanking(profile)}
                            style={{ minHeight: 36, padding: "8px 12px" }}
                            textStyle={{ fontSize: 11, fontWeight: 800 }}
                          />
                        </div>
                        <FitTextArea
                          aria-label="Admin note for this ranking governance decision"
                          id={`gamification-ranking-governance-note-${profile.userId}`}
                          rows={2}
                          value={rankingNotes[profile.userId] ?? ""}
                          onChange={(event) =>
                            updateDraft(
                              setRankingNotes,
                              profile.userId,
                              event.target.value,
                            )
                          }
                          placeholder="Admin note for this ranking governance decision"
                          style={{
                            marginTop: 8,
                            width: "100%",
                            minHeight: 52,
                          }}
                        />
                      </div>
                    ))}
                  </RecordList>
                </div>
              ) : (
                <div
                  role="tabpanel"
                  id="gamification-governance-panel-audit"
                  aria-labelledby="gamification-governance-tab-audit"
                  className={`gamification-audit-panel ${styles.governancePanel}`}
                  data-ui="gamification-audit-panel"
                  style={overviewBottomContentStyle}
                >
                  <div>
                    <FitText style={{ display: "block", fontWeight: 800 }}>
                      Trace moderation and corrections
                    </FitText>
                    <FitText style={muted}>
                      Review recent immutable admin actions so corrections remain explainable.
                    </FitText>
                  </div>
                  <div
                    data-ui="gamification-audit-records"
                    style={{
                      maxHeight: "none",
                      overflowY: "visible",
                      paddingRight: 4,
                    }}
                  >
                    <RecordList emptyCopy="No moderation actions have been recorded yet.">
                      {overview?.audit.recentActions.slice(0, 5).map((action) => (
                        <div
                          key={action.id}
                          className={styles.auditRecord}
                          style={{
                            ...subPanelStyle,
                            alignItems: "center",
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                          }}
                        >
                          <div>
                            <FitText style={{ display: "block", fontWeight: 800 }}>
                              {labelize(action.actionType)}
                            </FitText>
                            <FitText style={{ ...muted, display: "block", marginTop: 4 }}>
                              {action.targetName} / {formatDateTime(action.createdAt)}
                            </FitText>
                            {action.rationale ? (
                              <FitText style={{ ...muted, marginTop: 6 }}>
                                {action.rationale}
                              </FitText>
                            ) : null}
                          </div>
                          <FitPill
                            mode="status"
                            label={
                              action.progressionGrantId
                                ? "XP grant"
                                : action.integrityCaseId
                                  ? "Integrity"
                                  : action.seasonId
                                    ? "Season"
                                    : "Profile"
                            }
                            color={colors.brand}
                          />
                        </div>
                      ))}
                    </RecordList>
                  </div>
                </div>
              )}
              </div>
            </FitSection>
            ) : null}
          </div>
        ) : (
          <MilestoneManagementPanel
            notes={milestoneNotes}
            onNotesChange={setMilestoneNotes}
            onReviewsChange={setMilestoneReviews}
            onSearchChange={setMilestoneSearch}
            onSelectedChange={setSelectedMilestoneId}
            onStatusChange={setMilestoneStatus}
            reviews={milestoneReviews}
            search={milestoneSearch}
            selectedId={selectedMilestoneId}
            status={milestoneStatus}
          />
        )}
      </div>
      <style>{`
        .gamification-metric-item + .gamification-metric-item {
          border-left: 1px solid ${colors.border};
        }

        @media (max-width: 1180px) {
          .gamification-governance-header {
            grid-template-columns: minmax(0, 1fr) !important;
            align-items: stretch !important;
          }

          .gamification-active-season-panel {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .gamification-season-control-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .gamification-active-season-actions {
            justify-content: flex-start !important;
            flex-wrap: wrap !important;
          }

          .gamification-sync-card {
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: center !important;
          }
        }

        @media (max-width: 960px) {
          .gamification-admin-shell {
            padding-right: 0 !important;
          }

          .gamification-overview-grid {
            grid-template-rows: auto !important;
          }

          .gamification-metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .gamification-metric-item:nth-child(3) {
            border-left: 0;
          }

          .gamification-metric-item:nth-child(n + 3) {
            border-top: 1px solid ${colors.border};
          }

          .gamification-bottom-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }

        @media (max-width: 640px) {
          .gamification-metric-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .gamification-metric-item + .gamification-metric-item {
            border-left: 0;
            border-top: 1px solid ${colors.border};
          }

          .gamification-sync-card {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
      <FitModal
        isOpen={seasonManagerOpen}
        onClose={() => {
          if (!seasonMutationPending) {
            setSeasonManagerOpen(false);
            setSeasonEditId(null);
          }
        }}
        title="Season planner"
        icon={Crown}
        maxWidth={760}
        closeAriaLabel="Close season planner"
        containerStyle={{
          borderRadius: 6,
          maxHeight: "calc(100dvh - 64px)",
        }}
        contentStyle={{
          maxHeight: "calc(100dvh - 204px)",
          padding: 18,
        }}
        footer={
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              width: "100%",
            }}
          >
            <FitButton
              variant="ghost"
              label="Close"
              disabled={seasonMutationPending}
              onClick={() => {
                setSeasonManagerOpen(false);
                setSeasonEditId(null);
              }}
              style={{ minHeight: 36, minWidth: 88 }}
            />
            <FitButton
              variant="primary"
              icon={seasonEditId ? CheckCircle2 : PlusCircle}
              label={seasonEditId ? "Save changes" : "Create draft"}
              loading={seasonMutationPending}
              disabled={Boolean(seasonDraftValidation)}
              onClick={submitSeasonDraft}
              style={{ minHeight: 36, minWidth: seasonEditId ? 132 : 126 }}
            />
          </div>
        }
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 800 }}>
              Season lifecycle
            </FitText>
            <span
              aria-label="Season planner help"
              tabIndex={0}
              title="Schedule or force-start an eligible draft."
              style={{
                alignItems: "center",
                border: `1px solid ${colors.border}`,
                borderRadius: "50%",
                color: colors.textMuted,
                display: "inline-flex",
                fontSize: 11,
                fontWeight: 900,
                height: 18,
                justifyContent: "center",
                width: 18,
              }}
            >
              ?
            </span>
          </div>
          {overview?.activeSeason ? (
            <section
              style={{
                alignItems: "center",
                backgroundColor: `${colors.brand}12`,
                border: `1px solid ${colors.brand}50`,
                borderLeft: `3px solid ${colors.brand}`,
                borderRadius: 5,
                display: "grid",
                gap: 12,
                gridTemplateColumns: "minmax(0, 1fr) auto",
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Active season
                </FitText>
                <FitText style={{ fontSize: 15, fontWeight: 850 }}>
                  {overview.activeSeason.title}
                </FitText>
                <FitText style={muted}>
                  {formatSeasonRemaining(overview.activeSeason.endsAt, seasonClock)}
                  {" · "}Auto-closes {formatDateTime(overview.activeSeason.endsAt)}
                </FitText>
              </div>
              <FitButton
                variant="danger"
                icon={CheckCircle2}
                label="Close season"
                loading={seasonMutationPending}
                onClick={() =>
                  setConfirmationState({
                    confirmIcon: CheckCircle2,
                    confirmLabel: "Close season",
                    message: `${overview.activeSeason!.title} will stop immediately. Its final standings will remain available in season history.`,
                    title: "Close Active Season?",
                    onConfirm: () => {
                      seasonMutation.mutate({
                        seasonId: overview.activeSeason!.id,
                        payload: {
                          status: "closed",
                          rationale:
                            seasonRationale.trim() ||
                            "Admin manually closed the active season.",
                        },
                      });
                    },
                  })
                }
                style={{ minHeight: 36, minWidth: 118 }}
              />
            </section>
          ) : (
            <section
              style={{
                border: `1px dashed ${colors.border}`,
                borderRadius: 7,
                padding: 12,
              }}
            >
              <FitText style={muted}>
                No season is active. Start an eligible draft below or wait for its scheduled auto-start.
              </FitText>
            </section>
          )}
          <section
            style={{
              borderTop: `1px solid ${colors.border}`,
              display: "grid",
              gap: 12,
              paddingTop: 16,
            }}
          >
            <div style={{ borderLeft: `3px solid ${colors.brand}`, paddingLeft: 10 }}>
              <FitText
                as="h3"
                style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.2 }}
              >
                {seasonEditId ? "Edit scheduled season" : "Schedule a season"}
              </FitText>
              <FitText style={{ ...muted, marginTop: 3 }}>
                {seasonEditId
                  ? "Update the schedule before the draft starts."
                  : "Drafts start automatically at their scheduled time when no other season is active."}
              </FitText>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 800 }}>
                Season name
              </FitText>
              <FitTextInput
                aria-label="Season name"
                value={seasonDraft.title}
                placeholder="e.g. FitTrack Strength Season"
                onChange={(event) =>
                  setSeasonDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 800 }}>
                Description (optional)
              </FitText>
              <FitTextArea
                aria-label="Season description"
                value={seasonDraft.description}
                rows={2}
                placeholder="What this season emphasizes"
                onChange={(event) =>
                  setSeasonDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            {seasonDraftValidation ? (
              <FitText role="alert" style={{ color: colors.danger, fontSize: 12 }}>
                {seasonDraftValidation}
              </FitText>
            ) : null}
            {seasonsQuery.error ||
            createSeasonMutation.error ||
            updateSeasonMutation.error ||
            seasonMutation.error ? (
              <FitText role="alert" style={{ color: colors.danger, fontSize: 12 }}>
                {getErrorMessage(
                  createSeasonMutation.error ??
                    updateSeasonMutation.error ??
                    seasonMutation.error ??
                    seasonsQuery.error,
                  "Unable to load or update seasons.",
                )}
              </FitText>
            ) : null}
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 800 }}>
                  Starts
                </FitText>
                <FitTextInput
                  aria-label="Season start date and time"
                  type="datetime-local"
                  value={seasonDraft.startsAt}
                  onChange={(event) =>
                    setSeasonDraft((current) => ({
                      ...current,
                      startsAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 800 }}>
                  Ends
                </FitText>
                <FitTextInput
                  aria-label="Season end date and time"
                  type="datetime-local"
                  value={seasonDraft.endsAt}
                  onChange={(event) =>
                    setSeasonDraft((current) => ({
                      ...current,
                      endsAt: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label
              style={{
                alignItems: "center",
                border: `1px solid ${colors.border}`,
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                gap: 10,
                minHeight: 42,
                padding: "8px 10px",
              }}
            >
              <input
                type="checkbox"
                checked={seasonDraft.autoStartNext}
                onChange={(event) =>
                  setSeasonDraft((current) => ({
                    ...current,
                    autoStartNext: event.target.checked,
                  }))
                }
              />
              <span>
                <FitText style={{ fontSize: 13, fontWeight: 800 }}>
                  Auto-start when eligible
                </FitText>
                <FitText style={{ ...muted, display: "block", marginTop: 2 }}>
                  Starts after the scheduled time only when no active season exists.
                </FitText>
              </span>
            </label>
          </section>

          <section
            style={{
              borderTop: `1px solid ${colors.border}`,
              display: "grid",
              gap: 10,
              paddingTop: 16,
            }}
          >
            <div style={{ borderLeft: `3px solid ${colors.brand}`, paddingLeft: 10 }}>
              <FitText
                as="h3"
                style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.2 }}
              >
                Scheduled drafts
              </FitText>
              <FitText style={{ ...muted, marginTop: 3 }}>
                Manual start remains available for demos and schedule changes.
              </FitText>
            </div>
            {(seasonsQuery.data ?? []).filter((season) => season.status === "draft").length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {(seasonsQuery.data ?? [])
                  .filter((season) => season.status === "draft")
                  .map((season) => (
                    <div
                      key={season.id}
                      style={{
                        alignItems: "center",
                        border: `1px solid ${colors.border}`,
                        borderRadius: 4,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                        justifyContent: "space-between",
                        padding: 10,
                      }}
                    >
                      <div style={{ display: "grid", gap: 3 }}>
                        <FitText style={{ fontSize: 13, fontWeight: 850 }}>
                          {season.title}
                        </FitText>
                        <FitText style={muted}>
                          {formatDateTime(season.startsAt)} – {formatDateTime(season.endsAt)}
                        </FitText>
                        <FitText style={{ ...muted, fontSize: 11 }}>
                          {season.autoStartNext ? "Auto-start enabled" : "Manual start only"}
                        </FitText>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <FitButton
                          variant="ghost"
                          icon={Pencil}
                          label="Edit"
                          disabled={seasonMutationPending}
                          onClick={() => openSeasonEditor(season)}
                          style={{ minHeight: 34, minWidth: 76 }}
                        />
                        <FitButton
                          variant="ghost"
                          icon={CheckCircle2}
                          label={overview?.activeSeason ? "Active season running" : "Force start"}
                          disabled={Boolean(overview?.activeSeason) || seasonMutationPending}
                          loading={seasonMutationPending}
                          onClick={() =>
                            seasonMutation.mutate({
                              seasonId: season.id,
                              payload: {
                                status: "active",
                                rationale: "Admin manually started the scheduled season.",
                              },
                            })
                          }
                          style={{ minHeight: 34, minWidth: 116 }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div
                style={{
                  border: `1px dashed ${colors.border}`,
                  borderRadius: 6,
                  padding: 14,
                  textAlign: "center",
                }}
              >
                <FitText style={muted}>No draft seasons are scheduled yet.</FitText>
              </div>
            )}
          </section>
        </div>
      </FitModal>
      <FitModal
        isOpen={manualExpOpen}
        onClose={closeManualExpModal}
        title="Grant Manual EXP"
        subtitle="Apply an audited correction after verified member activity."
        icon={PlusCircle}
        maxWidth={600}
        closeAriaLabel="Close manual EXP grant"
        containerStyle={{
          borderRadius: 8,
          maxHeight: "calc(100dvh - 64px)",
        }}
        contentStyle={{
          maxHeight: "calc(100dvh - 224px)",
          padding: 18,
        }}
        footer={
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              width: "100%",
            }}
          >
            <FitButton
              variant="ghost"
              label="Cancel"
              disabled={manualExpMutation.isPending}
              onClick={closeManualExpModal}
              style={{ minHeight: 36, minWidth: 88 }}
              textStyle={{ fontSize: 12, fontWeight: 750 }}
            />
            <span
              data-ui="gamification-manual-exp-submit"
              style={{ display: "block" }}
            >
            <FitButton
              variant="primary"
              icon={PlusCircle}
              label="Review grant"
              loading={manualExpMutation.isPending}
              disabled={manualExpReviewBlocked || manualExpMutation.isPending}
              onClick={submitManualExpGrant}
                style={{ minHeight: 36, minWidth: 124 }}
                textStyle={{ fontSize: 12, fontWeight: 800 }}
              />
            </span>
          </div>
        }
      >
        <ManualExpGrantPanel
          draft={manualExpDraft}
          members={manualExpEligibleMembers}
          memberSearch={manualMemberSearch}
          membersLoading={membersQuery.isFetching}
          muscleDefinitions={manualExpMuscleDefinitions}
          musclesLoading={muscleDefinitionsQuery.isFetching}
          fieldErrors={manualExpFieldErrors}
          loadError={membersQuery.error ?? muscleDefinitionsQuery.error}
          mutationError={manualExpMutation.error}
          currentLifetimeExp={selectedManualExpLifetimeExp}
          onDraftChange={updateManualExpDraft}
          onMemberSearchChange={updateManualMemberSearch}
        />
      </FitModal>
      <ConfirmModal
        isOpen={confirmationState !== null}
        title={confirmationState?.title ?? "Confirm action"}
        message={confirmationState?.message ?? ""}
        confirmLabel={confirmationState?.confirmLabel ?? "Confirm"}
        confirmIcon={confirmationState?.confirmIcon}
        isDanger={confirmationState?.isDanger}
        isLoading={
          seasonMutationPending ||
          integrityMutation.isPending ||
          manualExpMutation.isPending ||
          rankingMutation.isPending
        }
        loadingLabel="Applying..."
        onConfirm={() => {
          confirmationState?.onConfirm();
          setConfirmationState(null);
        }}
        onCancel={() => setConfirmationState(null)}
      />
    </FitSection>
  );
}

function SeasonPerformanceTable({
  actionError,
  includeArchived,
  leaderboardMode,
  loadError,
  moderationPending,
  muscleFilter,
  onGovernanceChange,
  onIncludeArchivedChange,
  onLeaderboardModeChange,
  onModerate,
  onMuscleFilterChange,
  onOpenManualExp,
  onOpenSeasonManager,
  onNextCursor,
  onPageChange,
  onRefresh,
  onSearchChange,
  onSeasonChange,
  onVisibilityChange,
  page,
  refreshing,
  search,
  selectedGovernance,
  selectedSeasonId,
  selectedVisibility,
  seasons,
  standings,
}: {
  actionError: unknown;
  includeArchived: boolean;
  leaderboardMode: "overall" | "muscle";
  loadError: unknown;
  moderationPending: boolean;
  muscleFilter: string;
  onGovernanceChange: (value: FitnessRankingGovernanceStatus | "") => void;
  onIncludeArchivedChange: (value: boolean) => void;
  onLeaderboardModeChange: (value: "overall" | "muscle") => void;
  onModerate: (
    standing: AdminGamificationSeasonStandingRecord,
    status: Extract<
      FitnessRankingGovernanceStatus,
      "normal" | "hidden_by_admin" | "disqualified"
    >,
    rationale: string,
  ) => void;
  onMuscleFilterChange: (value: string) => void;
  onOpenManualExp: () => void;
  onOpenSeasonManager: () => void;
  onNextCursor: (cursor: string, snapshot?: string | null) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onSeasonChange: (value: string) => void;
  onVisibilityChange: (value: FitnessRankingVisibility | "") => void;
  page: number;
  refreshing: boolean;
  search: string;
  selectedGovernance: FitnessRankingGovernanceStatus | "";
  selectedSeasonId: string;
  selectedVisibility: FitnessRankingVisibility | "";
  seasons: AdminGamificationSeasonSummaryRecord[];
  standings:
      | {
        data: AdminGamificationSeasonStandingRecord[];
        meta: CursorPaginationMeta;
      }
    | undefined;
}) {
  const { colors } = useTheme();
  const [reviewTarget, setReviewTarget] =
    useState<AdminGamificationSeasonStandingRecord | null>(null);
  const rows = standings?.data ?? [];
  const meta = standings?.meta ?? {
    limit: 10,
    page,
    total: 0,
    total_pages: 1,
  };
  const defaultSeason =
    seasons.find((season) => season.status === "active") ??
    seasons.find((season) => season.status === "closed") ??
    null;
  const displayedSeason = rows[0]
    ? { status: rows[0].seasonStatus, title: rows[0].seasonTitle }
    : seasons.find((season) => season.id === selectedSeasonId) ?? defaultSeason;
  const isHistoricalSeason =
    displayedSeason?.status === "closed" || displayedSeason?.status === "archived";
  const hasSeasonHistory = seasons.some((season) => season.status === "closed");
  const hasActiveSeason = seasons.some((season) => season.status === "active");
  const emptyMessage =
    seasons.length > 0 && !hasSeasonHistory && !hasActiveSeason
      ? "No season history yet. Create and start a season to populate standings."
      : "No season standings match the current filters.";
  const seasonOptions = [
    {
      label: defaultSeason
        ? `${defaultSeason.title} (${defaultSeason.status === "closed" ? "Previous" : "Current"})`
        : "No season history",
      value: "",
    },
    ...seasons
      .filter(
        (season) =>
          season.status === "active" ||
          season.status === "closed" ||
          (includeArchived && season.status === "archived"),
      )
      .map((season) => ({
        label: `${season.title} (${labelize(season.status)})`,
        value: season.id,
      })),
  ];
  const tableColumns: FitTableColumn<AdminGamificationSeasonStandingRecord>[] = [
    {
      key: "rank",
      heading: "Overall rank",
      render: (row) => {
        const rowIndex = rows.indexOf(row);
        const displayRank =
          row.rankPosition ??
          (meta.page - 1) * meta.limit + (rowIndex >= 0 ? rowIndex : 0) + 1;

        return (
          <FitText
            style={{
              alignItems: "center",
              backgroundColor:
                displayRank <= 3 ? `${colors.brand}18` : "transparent",
              border:
                displayRank <= 3
                  ? `1px solid ${colors.brand}55`
                  : "1px solid transparent",
              borderRadius: 8,
              color:
                displayRank <= 3 ? colors.brand : colors.textPrimary,
              display: "inline-flex",
              fontSize: 12,
              fontWeight: 900,
              height: 28,
              justifyContent: "center",
              minWidth: 32,
            }}
          >
            #{displayRank}
          </FitText>
        );
      },
    },
    {
      key: "participant",
      heading: "Participant",
      render: (row, themeColors) => (
        <div style={{ display: "grid", gap: 2 }}>
          <FitText style={{ display: "block", fontSize: 13, fontWeight: 850 }}>
            {row.displayAlias ?? row.memberName}
          </FitText>
          <FitText
            style={{
              color: themeColors.textMuted,
              display: "block",
              fontSize: 11,
            }}
          >
            {row.memberName}
          </FitText>
        </div>
      ),
    },
    {
      key: "season",
      heading: "Season",
      render: (row, themeColors) => (
        <div style={{ display: "grid", gap: 2 }}>
          <FitText
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 760,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.seasonTitle}
          </FitText>
          <FitText
            style={{
              color: themeColors.textMuted,
              display: "block",
              fontSize: 11,
            }}
          >
            {labelize(row.seasonStatus)}
          </FitText>
        </div>
      ),
    },
    {
      key: "exp",
      heading: "Total EXP (rank basis)",
      align: "right",
      render: (row, themeColors) => {
        const lifetime =
          row.lifetimeProgression ?? getFitnessExpProgressionState(row.totalXp);
        const season =
          row.seasonProgression ??
          getFitnessExpProgressionState(row.seasonPoints);
        const rankColor = masteryRankColor(lifetime.level);

        return (
          <div style={{ display: "grid", gap: 3, justifyItems: "end" }}>
            <FitText
              style={{ color: rankColor, display: "block", fontSize: 13, fontWeight: 900 }}
            >
              {masteryRankLabel(lifetime.level)} · {row.totalXp.toLocaleString("en-US")} EXP
            </FitText>
            <FitText
              style={{
                color: themeColors.textSecondary,
                display: "block",
                fontSize: 11,
              }}
            >
              Lifetime {lifetime.progressPercent}% to next level
            </FitText>
            <FitText
              style={{ color: masteryRankColor(season.level), display: "block", fontSize: 11 }}
            >
              Season {masteryRankLabel(season.level)} · {season.progressPercent}% ({row.seasonPoints.toLocaleString("en-US")} pts)
            </FitText>
          </div>
        );
      },
    },
    {
      key: "topMuscle",
      heading: "Top Muscle",
      render: (row, themeColors) => (
        <div style={{ display: "grid", gap: 2 }}>
          <FitText style={{ display: "block", fontSize: 13, fontWeight: 850 }}>
            {row.topMuscle ?? "No muscle yet"}
          </FitText>
          <FitText
            style={{
              color: themeColors.textMuted,
              display: "block",
              fontSize: 11,
            }}
          >
            {row.topMuscleXp.toLocaleString("en-US")} XP
          </FitText>
        </div>
      ),
    },
    {
      key: "milestones",
      heading: "Milestones",
      render: (row, themeColors) => (
        <div style={{ display: "grid", gap: 2 }}>
          <FitText style={{ display: "block", fontSize: 13, fontWeight: 850 }}>
            {row.milestoneClaimedCount}/{row.milestoneUnlockedCount}
          </FitText>
          <FitText
            style={{
              color: themeColors.textMuted,
              display: "block",
              fontSize: 11,
            }}
          >
            claimed/unlocked
          </FitText>
        </div>
      ),
    },
    {
      key: "governance",
      heading: "Governance",
      render: (row, themeColors) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <FitPill
            mode="status"
            label={row.visibility === "private" ? "Private · excluded" : labelize(row.visibility)}
            color={row.visibility === "private" ? themeColors.warning : themeColors.brand}
            style={{ borderRadius: 6 }}
          />
          <FitPill
            mode="status"
            label={labelize(row.governanceStatus)}
            color={
              row.isDisqualified
                ? themeColors.danger
                : row.isHidden
                  ? themeColors.warning
                  : themeColors.success
            }
            style={{ borderRadius: 6 }}
          />
        </div>
      ),
    },
    {
      key: "lastEarned",
      heading: "Last Earned",
      render: (row, themeColors) => (
        <FitText style={{ color: themeColors.textSecondary, fontSize: 12 }}>
          {formatDateTime(row.lastEarnedAt)}
        </FitText>
      ),
    },
    {
      key: "review",
      heading: "",
      align: "right",
      render: (row) => (
        <FitButton
          variant={
            row.rankPosition && row.rankPosition <= 3 ? "primary" : "ghost"
          }
          icon={ShieldAlert}
          label="Review"
          onClick={() => setReviewTarget(row)}
          style={{ minHeight: 32, minWidth: 86, paddingInline: 10 }}
          textStyle={{ fontSize: 11, fontWeight: 800 }}
        />
      ),
    },
  ];
  const rangeStart = meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const rangeEnd = Math.min(meta.total, meta.page * meta.limit);
  const nextCursor = meta.next_cursor ?? null;

  return (
    <>
    <FitSection
      heading=""
      hideHeading
      className={styles.leaderboard}
      bare
      noPadding
      style={{
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surfaceRaised,
        borderRadius: 8,
        marginBottom: 0,
        overflow: "hidden",
        padding: 12,
        display: "grid",
        gridTemplateRows: "auto",
        minHeight: 0,
      }}
    >
      <div className={styles.leaderboardBody}>
        <div className={styles.leaderboardHeader}>
          <div className={styles.leaderboardHeading}>
            <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10 }}>
              <FitText
                as="h3"
                style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}
              >
                Season standings
              </FitText>
              <span
                aria-label={`${meta.total.toLocaleString("en-US")} competitors`}
                style={{
                  alignItems: "baseline",
                  borderLeft: `2px solid ${colors.brand}`,
                  display: "inline-flex",
                  gap: 5,
                  paddingLeft: 8,
                }}
              >
                <FitText style={{ color: colors.brand, fontSize: 13, fontWeight: 900 }}>
                  {meta.total.toLocaleString("en-US")}
                </FitText>
                <FitText style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 700 }}>
                  competitors
                </FitText>
              </span>
              {displayedSeason ? (
                <FitPill
                  mode="status"
                  label={isHistoricalSeason ? "Previous season" : "Current season"}
                  color={isHistoricalSeason ? colors.warning : colors.brand}
                  style={{ borderRadius: 6 }}
                />
              ) : null}
            </div>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
              Overall rank uses canonical total EXP. Selected-season score remains context.
            </FitText>
          </div>
          <div className={styles.leaderboardActions}>
            <div style={{ display: "flex", gap: 4 }}>
              <FitButton
                variant={leaderboardMode === "overall" ? "primary" : "ghost"}
                label="Overall"
                onClick={() => onLeaderboardModeChange("overall")}
                style={{ minHeight: 32, minWidth: 72, paddingInline: 10 }}
                textStyle={{ fontSize: 11, fontWeight: 800 }}
              />
              <FitButton
                variant={leaderboardMode === "muscle" ? "primary" : "ghost"}
                label="By muscle"
                onClick={() => onLeaderboardModeChange("muscle")}
                style={{ minHeight: 32, minWidth: 84, paddingInline: 10 }}
                textStyle={{ fontSize: 11, fontWeight: 800 }}
              />
            </div>
            <FitButton
              variant="ghost"
              icon={Crown}
              label="Manage seasons"
              onClick={onOpenSeasonManager}
              style={{ minHeight: 32, paddingInline: 9 }}
              textStyle={{ fontSize: 11, fontWeight: 760 }}
            />
            <FitButton
              variant="primary"
              icon={PlusCircle}
              label="Grant EXP"
              onClick={onOpenManualExp}
              style={{ minHeight: 32, minWidth: 98, paddingInline: 10 }}
              textStyle={{ fontSize: 11, fontWeight: 800 }}
            />
            <FitButton
              variant="ghost"
              icon={RefreshCcw}
              label="Refresh"
              loading={refreshing}
              onClick={onRefresh}
              style={{ minHeight: 32, paddingInline: 9 }}
              textStyle={{ fontSize: 11, fontWeight: 760 }}
            />
          </div>
        </div>
        {loadError || actionError ? (
          <FitText
            role="alert"
            style={{ color: colors.danger, fontSize: 12, padding: "0 10px 8px" }}
          >
            {getErrorMessage(
              actionError ?? loadError,
              actionError
                ? "Unable to update this ranking entry."
                : "Unable to load season standings.",
            )}
          </FitText>
        ) : null}
        <div
          className={styles.filterToolbar}
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            padding: 10,
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: colors.surfaceRaised,
            borderRadius: "8px 8px 0 0",
          }}
        >
          <FitSearch
            ariaLabel="Search member"
            compact
            placeholder="Search member"
            value={search}
            onChangeText={onSearchChange}
          />
          <FitDropdown
            fullWidth
            value={selectedSeasonId}
            options={seasonOptions}
            onChange={onSeasonChange}
          />
          <details className={styles.advancedFilters}>
            <summary style={{ borderColor: colors.border, color: colors.textSecondary }}>
              Advanced filters
              <span>
                {[muscleFilter, selectedVisibility, selectedGovernance]
                  .filter(Boolean)
                  .length + (includeArchived ? 1 : 0)}
              </span>
            </summary>
            <div
              className={styles.advancedFilterGrid}
              style={{
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                boxShadow: "0 18px 48px rgba(0, 0, 0, 0.24)",
              }}
            >
              <FitSearch
                ariaLabel="Filter by muscle or EXP area"
                compact
                placeholder="Muscle or EXP area"
                value={muscleFilter}
                onChangeText={onMuscleFilterChange}
              />
              <FitDropdown
                fullWidth
                value={selectedVisibility}
                options={SEASON_VISIBILITY_OPTIONS}
                onChange={(value) =>
                  onVisibilityChange(value as FitnessRankingVisibility | "")
                }
              />
              <FitDropdown
                fullWidth
                value={selectedGovernance}
                options={SEASON_GOVERNANCE_OPTIONS}
                onChange={(value) =>
                  onGovernanceChange(
                    value as FitnessRankingGovernanceStatus | "",
                  )
                }
              />
              <label
                className={styles.archivedToggle}
                style={{
                  borderColor: colors.border,
                  color: colors.textSecondary,
                }}
              >
                <input
                  checked={includeArchived}
                  onChange={(event) => onIncludeArchivedChange(event.target.checked)}
                  type="checkbox"
                />
                Include archived
              </label>
            </div>
          </details>
        </div>

        <FitText
          data-season-performance-scroll-hint="true"
          style={{
            color: colors.textSecondary,
            fontSize: 11,
            paddingTop: 8,
          }}
        >
          Scroll horizontally to review every leaderboard field.
        </FitText>
        <div
          className={styles.tableViewport}
          style={{
            minWidth: 0,
            minHeight: 0,
            overflowX: "visible",
            overflowY: "visible",
            padding: "4px 0 0",
          }}
          data-season-performance-table="true"
        >
          <FitTable
            columns={tableColumns}
            rows={rows}
            getRowKey={(row) => `${row.userId}-${row.seasonId}`}
            emptyMessage={emptyMessage}
            emptyStateHeight={480}
            compact
            overflowX
            style={{
              border: 0,
              borderRadius: 0,
            }}
            tableStyle={{ minWidth: 1080, tableLayout: "fixed" }}
          />
        </div>
        <style>{`
          [data-season-performance-table="true"] th {
            padding: 7px 10px !important;
          }
          [data-season-performance-table="true"] td {
            line-height: 1.25 !important;
            padding: 6px 10px !important;
          }
          [data-season-performance-scroll-hint="true"] {
            display: none;
          }
          @media (max-width: 900px) {
            [data-season-performance-scroll-hint="true"] {
              display: block;
            }
          }
        `}</style>
        <div
          className={styles.tableFooter}
          style={{
            alignItems: "center",
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 2px 0",
          }}
        >
          <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>
            Showing {rangeStart} to {rangeEnd} of {meta.total} results
          </FitText>
          {meta.total > 0 ? (
            <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
              {nextCursor ? (
                <FitButton
                  label="Load next"
                  variant="ghost"
                  disabled={refreshing}
                  onClick={() => onNextCursor(nextCursor, meta.snapshot)}
                  style={{ minHeight: 32 }}
                  textStyle={{ fontSize: 11, fontWeight: 800 }}
                />
              ) : null}
              <FitPagination
                currentPage={meta.page}
                totalPages={Math.max(1, meta.total_pages)}
                onPageChange={(nextPage) => {
                  if (nextPage === meta.page + 1 && nextCursor) {
                    onNextCursor(nextCursor, meta.snapshot);
                    return;
                  }
                  onPageChange(nextPage);
                }}
                ariaLabel="Season standing pagination"
                showSinglePage
              />
            </div>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      </div>
    </FitSection>
    <RankingReviewModal
      standing={reviewTarget}
      isPending={moderationPending}
      onClose={() => setReviewTarget(null)}
      onDecision={(standing, status, rationale) => {
        setReviewTarget(null);
        onModerate(standing, status, rationale);
      }}
    />
    </>
  );
}

function toLocalDateTimeInput(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function MusclePerformanceTable({
  actionError,
  governanceProfiles,
  leaderboardMode,
  loadError,
  moderationPending,
  muscleDefinitions,
  onLeaderboardModeChange,
  onModerate,
  onMuscleChange,
  onOpenManualExp,
  onOpenSeasonManager,
  onNextCursor,
  onPageChange,
  onRefresh,
  onScopeChange,
  onSearchChange,
  onSeasonChange,
  page,
  refreshing,
  scope,
  search,
  selectedMuscle,
  selectedSeasonId,
  seasons,
  standings,
}: {
  actionError: unknown;
  governanceProfiles: AdminGamificationRankingProfileRecord[];
  leaderboardMode: "overall" | "muscle";
  loadError: unknown;
  moderationPending: boolean;
  muscleDefinitions: MuscleDefinitionRecord[];
  onLeaderboardModeChange: (value: "overall" | "muscle") => void;
  onModerate: (
    standing: AdminGamificationSeasonStandingRecord,
    status: Extract<
      FitnessRankingGovernanceStatus,
      "normal" | "hidden_by_admin" | "disqualified"
    >,
    rationale: string,
  ) => void;
  onMuscleChange: (value: string) => void;
  onOpenManualExp: () => void;
  onOpenSeasonManager: () => void;
  onNextCursor: (cursor: string, snapshot?: string | null) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onScopeChange: (value: "lifetime" | "season") => void;
  onSearchChange: (value: string) => void;
  onSeasonChange: (value: string) => void;
  page: number;
  refreshing: boolean;
  scope: "lifetime" | "season";
  search: string;
  selectedMuscle: string;
  selectedSeasonId: string;
  seasons: AdminGamificationSeasonSummaryRecord[];
  standings:
    | {
        data: FitnessMuscleLeaderboardEntryRecord[];
        meta: CursorPaginationMeta;
      }
    | undefined;
}) {
  const { colors } = useTheme();
  const [reviewTarget, setReviewTarget] =
    useState<AdminGamificationSeasonStandingRecord | null>(null);
  const rows = standings?.data ?? [];
  const meta = standings?.meta ?? {
    limit: 10,
    page,
    total: 0,
    total_pages: 1,
  };
  const rangeStart = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const rangeEnd = Math.min(meta.page * meta.limit, meta.total);
  const nextCursor = meta.next_cursor ?? null;
  const muscleOptions = muscleDefinitions.map((definition) => ({
    label: definition.name,
    value: definition.key,
  }));
  const defaultSeason =
    seasons.find((season) => season.status === "active") ??
    seasons.find((season) => season.status === "closed") ??
    null;
  const seasonOptions = [
    {
      label: defaultSeason
        ? `${defaultSeason.title} (${defaultSeason.status === "closed" ? "Previous" : "Current"})`
        : "No season history",
      value: "",
    },
    ...seasons
      .filter((season) => season.status === "active" || season.status === "closed")
      .map((season) => ({
        label: `${season.title} (${labelize(season.status)})`,
        value: season.id,
      })),
  ];
  const selectedSeason =
    seasons.find((season) => season.id === selectedSeasonId) ??
    (rows[0]?.seasonId
      ? seasons.find((season) => season.id === rows[0].seasonId)
      : null) ??
    defaultSeason;
  const isHistoricalSeason =
    scope === "season" && selectedSeason?.status === "closed";
  const hasSeasonHistory = seasons.some((season) => season.status === "closed");
  const hasActiveSeason = seasons.some((season) => season.status === "active");
  const emptyMessage =
    scope === "season" &&
    seasons.length > 0 &&
    !hasSeasonHistory &&
    !hasActiveSeason
      ? "No season history yet. Create and start a season to populate standings."
      : "No muscle standings match the current filters.";
  const openReview = (row: FitnessMuscleLeaderboardEntryRecord) => {
    const profile = governanceProfiles.find(
      (candidate) => candidate.userId === row.userId,
    );

    setReviewTarget({
      displayAlias: profile?.displayAlias ?? row.displayName,
      governanceStatus: profile?.governanceStatus ?? "normal",
      isDisqualified: profile?.seasonIsDisqualified ?? false,
      isHidden: profile?.seasonIsHidden ?? false,
      lastEarnedAt: row.lastEarnedAt,
      memberName: profile?.memberName ?? row.displayName,
      milestoneClaimedCount: 0,
      milestoneUnlockedCount: 0,
      rankPosition: row.rankPosition,
      seasonId: row.seasonId ?? selectedSeason?.id ?? "lifetime",
      seasonPoints: row.xpPoints,
      seasonStatus: selectedSeason?.status ?? "active",
      seasonTitle:
        row.scope === "season"
          ? row.seasonTitle ?? selectedSeason?.title ?? "Current season"
          : "Lifetime muscle ranking",
      topMuscle: labelize(row.muscleKey),
      topMuscleXp: row.xpPoints,
      totalXp: row.xpPoints,
      userId: row.userId,
      visibility: profile?.visibility ?? "public",
    });
  };
  const columns: FitTableColumn<FitnessMuscleLeaderboardEntryRecord>[] = [
    {
      key: "rank",
      heading: "Rank",
      render: (row) => (
        <FitText
          style={{
            alignItems: "center",
            backgroundColor:
              row.rankPosition <= 3 ? `${colors.brand}18` : "transparent",
            border:
              row.rankPosition <= 3
                ? `1px solid ${colors.brand}55`
                : "1px solid transparent",
            borderRadius: 8,
            color:
              row.rankPosition <= 3 ? colors.brand : colors.textPrimary,
            display: "inline-flex",
            fontSize: 12,
            fontWeight: 900,
            height: 28,
            justifyContent: "center",
            minWidth: 32,
          }}
        >
          #{row.rankPosition}
        </FitText>
      ),
    },
    {
      key: "participant",
      heading: "Participant",
      render: (row) => (
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          {row.avatarUrl ? (
            <img
              alt={`${row.displayName} profile`}
              src={row.avatarUrl}
              style={{ borderRadius: "50%", height: 28, objectFit: "cover", width: 28 }}
            />
          ) : null}
          <div style={{ display: "grid", gap: 2 }}>
            <FitText style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 850 }}>
              {row.displayName}
            </FitText>
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              {row.isCurrentUser ? "Current account" : "Gym member"}
            </FitText>
          </div>
        </div>
      ),
    },
    {
      key: "muscle",
      heading: "Muscle",
      render: (row) => (
        <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 750 }}>
          {labelize(row.muscleKey)}
        </FitText>
      ),
    },
    {
      key: "scope",
      heading: "Scope",
      render: (row) => (
        <div style={{ display: "grid", gap: 2 }}>
          <FitText
            title={row.scope === "season" ? row.seasonTitle ?? "Current season" : "Lifetime"}
            style={{
              color: colors.textPrimary,
              display: "block",
              fontSize: 12,
              fontWeight: 800,
              maxWidth: 210,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.scope === "season" ? row.seasonTitle ?? "Current season" : "Lifetime"}
          </FitText>
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            {labelize(row.scope)}
          </FitText>
        </div>
      ),
    },
    {
      key: "experience",
      heading: "Muscle EXP",
      align: "right",
      render: (row) => {
        const progression =
          row.progression ?? getFitnessExpProgressionState(row.xpPoints);
        const rankColor = masteryRankColor(progression.level);

        return (
          <div style={{ display: "grid", gap: 2, justifyItems: "end" }}>
            <FitText style={{ color: rankColor, fontSize: 13, fontWeight: 900 }}>
              {masteryRankLabel(progression.level)} · {row.xpPoints.toLocaleString("en-US")} EXP
            </FitText>
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              {progression.progressPercent}% to next level
            </FitText>
          </div>
        );
      },
    },
    {
      key: "last-earned",
      heading: "Last Earned",
      render: (row) => (
        <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>
          {row.lastEarnedAt ? formatDateTime(row.lastEarnedAt) : "No activity yet"}
        </FitText>
      ),
    },
    {
      key: "review",
      heading: "",
      align: "right",
      render: (row) => (
        <FitButton
          variant={row.rankPosition <= 3 ? "primary" : "ghost"}
          icon={ShieldAlert}
          label="Review"
          onClick={() => openReview(row)}
          style={{ minHeight: 32, minWidth: 86, paddingInline: 10 }}
          textStyle={{ fontSize: 11, fontWeight: 800 }}
        />
      ),
    },
  ];

  return (
    <>
    <FitSection
      heading=""
      hideHeading
      className={styles.leaderboard}
      bare
      noPadding
      style={{
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        marginBottom: 0,
        overflow: "hidden",
        padding: 12,
        display: "grid",
        gridTemplateRows: "auto",
        minHeight: 0,
      }}
    >
      <div className={styles.leaderboardBody}>
        <div className={styles.leaderboardHeader}>
          <div className={styles.leaderboardHeading}>
            <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10 }}>
              <FitText as="h3" style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>
                Muscle standings
              </FitText>
              <span
                aria-label={`${meta.total.toLocaleString("en-US")} competitors`}
                style={{
                  alignItems: "baseline",
                  borderLeft: `2px solid ${colors.brand}`,
                  display: "inline-flex",
                  gap: 5,
                  paddingLeft: 8,
                }}
              >
                <FitText style={{ color: colors.brand, fontSize: 13, fontWeight: 900 }}>
                  {meta.total.toLocaleString("en-US")}
                </FitText>
                <FitText style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 700 }}>
                  competitors
                </FitText>
              </span>
              {scope === "season" && selectedSeason ? (
                <FitPill
                  mode="status"
                  label={isHistoricalSeason ? "Previous season" : "Current season"}
                  color={isHistoricalSeason ? colors.warning : colors.brand}
                  style={{ borderRadius: 6 }}
                />
              ) : null}
            </div>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
              Compare true per-muscle EXP without changing the overall season ranking.
            </FitText>
          </div>
          <div className={styles.leaderboardActions}>
            <div style={{ display: "flex", gap: 4 }}>
              <FitButton
                variant={leaderboardMode === "overall" ? "primary" : "ghost"}
                label="Overall"
                onClick={() => onLeaderboardModeChange("overall")}
                style={{ minHeight: 32, minWidth: 72, paddingInline: 10 }}
                textStyle={{ fontSize: 11, fontWeight: 800 }}
              />
              <FitButton
                variant={leaderboardMode === "muscle" ? "primary" : "ghost"}
                label="By muscle"
                onClick={() => onLeaderboardModeChange("muscle")}
                style={{ minHeight: 32, minWidth: 84, paddingInline: 10 }}
                textStyle={{ fontSize: 11, fontWeight: 800 }}
              />
            </div>
            <FitButton
              variant="ghost"
              icon={Crown}
              label="Manage seasons"
              onClick={onOpenSeasonManager}
              style={{ minHeight: 32, paddingInline: 9 }}
              textStyle={{ fontSize: 11, fontWeight: 760 }}
            />
            <FitButton
              variant="primary"
              icon={PlusCircle}
              label="Grant EXP"
              onClick={onOpenManualExp}
              style={{ minHeight: 32, minWidth: 98, paddingInline: 10 }}
              textStyle={{ fontSize: 11, fontWeight: 800 }}
            />
            <FitButton
              variant="ghost"
              icon={RefreshCcw}
              label="Refresh"
              loading={refreshing}
              onClick={onRefresh}
              style={{ minHeight: 32, paddingInline: 9 }}
              textStyle={{ fontSize: 11, fontWeight: 760 }}
            />
          </div>
        </div>

        {loadError || actionError ? (
          <FitText
            role="alert"
            style={{ color: colors.danger, fontSize: 12, padding: "0 10px 8px" }}
          >
            {getErrorMessage(
              actionError ?? loadError,
              actionError
                ? "Unable to update this ranking entry."
                : "Unable to load muscle standings.",
            )}
          </FitText>
        ) : null}
        <div
          className={styles.muscleFilterToolbar}
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "minmax(180px, 1.4fr) repeat(3, minmax(150px, 1fr))",
            padding: 10,
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: colors.surfaceRaised,
            borderRadius: "8px 8px 0 0",
          }}
        >
          <FitSearch
            ariaLabel="Search muscle standing member"
            compact
            placeholder="Search member"
            value={search}
            onChangeText={onSearchChange}
          />
          <FitDropdown
            fullWidth
            value={selectedMuscle}
            options={
              muscleOptions.length > 0
                ? muscleOptions
                : [{ label: labelize(selectedMuscle), value: selectedMuscle }]
            }
            onChange={onMuscleChange}
          />
          <FitDropdown
            fullWidth
            value={scope}
            options={[
              { label: "This season", value: "season" },
              { label: "Lifetime", value: "lifetime" },
            ]}
            onChange={(value) => onScopeChange(value as "lifetime" | "season")}
          />
          {scope === "season" ? (
            <FitDropdown
              fullWidth
              value={selectedSeasonId}
              options={seasonOptions}
              onChange={onSeasonChange}
            />
          ) : (
            <div />
          )}
        </div>

        <div
          className={styles.tableViewport}
          data-muscle-performance-table="true"
          style={{
            minWidth: 0,
            minHeight: 0,
            overflowX: "visible",
            overflowY: "visible",
            padding: "4px 0 0",
          }}
        >
          <FitTable
            columns={columns}
            rows={rows}
            getRowKey={(row) =>
              `${row.userId}-${row.scope}-${row.seasonId ?? "lifetime"}-${row.muscleKey}`
            }
            emptyMessage={emptyMessage}
            emptyStateHeight={480}
            compact
            style={{ border: 0, borderRadius: 0 }}
            tableStyle={{ minWidth: 1080, tableLayout: "fixed" }}
          />
        </div>
        <style>{`
          [data-muscle-performance-table="true"] th {
            padding: 7px 10px !important;
          }
          [data-muscle-performance-table="true"] td {
            line-height: 1.25 !important;
            padding: 6px 10px !important;
          }
        `}</style>
        <div
          className={styles.tableFooter}
          style={{
            alignItems: "center",
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            padding: "10px 2px 0",
          }}
        >
          <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>
            Showing {rangeStart} to {rangeEnd} of {meta.total} results
          </FitText>
          {meta.total > 0 ? (
            <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
              {nextCursor ? (
                <FitButton
                  label="Load next"
                  variant="ghost"
                  disabled={refreshing}
                  onClick={() => onNextCursor(nextCursor, meta.snapshot)}
                  style={{ minHeight: 32 }}
                  textStyle={{ fontSize: 11, fontWeight: 800 }}
                />
              ) : null}
              <FitPagination
                currentPage={meta.page}
                totalPages={Math.max(1, meta.total_pages)}
                onPageChange={(nextPage) => {
                  if (nextPage === meta.page + 1 && nextCursor) {
                    onNextCursor(nextCursor, meta.snapshot);
                    return;
                  }
                  onPageChange(nextPage);
                }}
                ariaLabel="Muscle standing pagination"
                showSinglePage
              />
            </div>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      </div>
    </FitSection>
    <RankingReviewModal
      standing={reviewTarget}
      reviewContext="muscle"
      isPending={moderationPending}
      onClose={() => setReviewTarget(null)}
      onDecision={(standing, status, rationale) => {
        setReviewTarget(null);
        onModerate(standing, status, rationale);
      }}
    />
    </>
  );
}

function MilestoneManagementPanel({
  notes,
  onNotesChange,
  onReviewsChange,
  onSearchChange,
  onSelectedChange,
  onStatusChange,
  reviews,
  search,
  selectedId,
  status,
}: {
  notes: string;
  onNotesChange: (value: string) => void;
  onReviewsChange: Dispatch<SetStateAction<AchievementReviewRecord[]>>;
  onSearchChange: (value: string) => void;
  onSelectedChange: (value: string) => void;
  onStatusChange: (value: AchievementReviewStatus | "all") => void;
  reviews: AchievementReviewRecord[];
  search: string;
  selectedId: string;
  status: AchievementReviewStatus | "all";
}) {
  const { colors } = useTheme();
  const [confirmTarget, setConfirmTarget] = useState<{
    nextStatus: AchievementReviewStatus;
    review: AchievementReviewRecord;
  } | null>(null);
  const [isCompactMilestoneLayout, setIsCompactMilestoneLayout] = useState(false);
  const [mobileReviewOpen, setMobileReviewOpen] = useState(false);
  const filteredReviews = reviews.filter((review) => {
    const matchesStatus = status === "all" || review.status === status;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      review.memberName.toLowerCase().includes(q) ||
      review.memberEmail.toLowerCase().includes(q) ||
      review.badgeLabel.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });
  const selectedReview =
    filteredReviews.find((review) => review.id === selectedId) ??
    filteredReviews[0] ??
    null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 960px)");
    const update = () => setIsCompactMilestoneLayout(mediaQuery.matches);

    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  useEffect(() => {
    if (isCompactMilestoneLayout) return;
    setMobileReviewOpen(false);
  }, [isCompactMilestoneLayout]);

  const applyDecision = () => {
    if (!confirmTarget) return;
    const note =
      notes.trim() ||
      `${confirmTarget.nextStatus} from Admin Gamification milestone management.`;
    onReviewsChange((current) =>
      current.map((review) =>
        review.id === confirmTarget.review.id
          ? {
              ...review,
              reviewerNotes: note,
              reviewedAt: new Date().toISOString(),
              status: confirmTarget.nextStatus,
            }
          : review,
      ),
    );
    onNotesChange("");
    setConfirmTarget(null);
  };

  return (
    <FitSection
      heading="Milestone Management"
      action={<ShieldCheck size={16} color={colors.brand} />}
      bare
      style={{
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surfaceRaised,
        borderRadius: 22,
        padding: 18,
      }}
    >
      <div
        className="gamification-milestone-management-grid"
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "minmax(280px, 0.85fr) minmax(320px, 1.15fr)",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <FitSearch
            compact
            placeholder="Search member or milestone"
            value={search}
            onChangeText={onSearchChange}
          />
          <FitSelect
            fullWidth
            value={status}
            options={MILESTONE_STATUS_OPTIONS}
            onChange={(event) =>
              onStatusChange(event.target.value as AchievementReviewStatus | "all")
            }
          />
          <div style={{ display: "grid", gap: 10 }}>
            {filteredReviews.length ? (
              filteredReviews.map((review) => {
                const active = selectedReview?.id === review.id;
                return (
                  <button
                    key={review.id}
                    type="button"
                    onClick={() => {
                      onSelectedChange(review.id);
                      if (isCompactMilestoneLayout) setMobileReviewOpen(true);
                    }}
                    style={{
                      border: `1px solid ${active ? colors.brand : colors.border}`,
                      backgroundColor: active
                        ? `${colors.brand}12`
                        : colors.surface,
                      borderRadius: 18,
                      cursor: "pointer",
                      padding: 14,
                      textAlign: "left",
                    }}
                  >
                    <FitText style={{ fontWeight: 800 }}>
                      {review.badgeLabel}
                    </FitText>
                    <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                      {review.memberName} / {formatDateTime(review.submittedAt)}
                    </FitText>
                    <FitPill
                      mode="status"
                      label={review.status}
                      color={ACHIEVEMENT_REVIEW_STATUS_COLORS[review.status]}
                      style={{ marginTop: 8 }}
                    />
                  </button>
                );
              })
            ) : (
              <EmptyState copy="No milestone reviews match the current filters." />
            )}
          </div>
        </div>

        <div
          className="gamification-milestone-detail-panel"
          style={{
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
            borderRadius: 20,
            display: "grid",
            gap: 14,
            padding: 18,
          }}
        >
          {selectedReview ? (
            <>
              <div
                style={{
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: "minmax(180px, 260px) minmax(0, 1fr)",
                }}
              >
                <img
                  alt={`${selectedReview.badgeLabel} proof`}
                  src={selectedReview.proofImageUrl}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 16,
                    height: 180,
                    objectFit: "cover",
                    width: "100%",
                  }}
                />
                <div>
                  <FitText style={{ fontSize: 22, fontWeight: 900 }}>
                    {selectedReview.badgeLabel}
                  </FitText>
                  <FitText style={{ color: colors.textSecondary, marginTop: 6 }}>
                    {selectedReview.memberName} / {selectedReview.memberEmail}
                  </FitText>
                  <FitText style={{ color: colors.textMuted, fontSize: 13, marginTop: 10 }}>
                    {selectedReview.proofCaption}
                  </FitText>
                  <FitPill
                    mode="status"
                    label={selectedReview.status}
                    color={ACHIEVEMENT_REVIEW_STATUS_COLORS[selectedReview.status]}
                    style={{ marginTop: 12 }}
                  />
                </div>
              </div>
              <FitTextArea
                rows={3}
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Moderator notes for this milestone decision"
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <FitButton
                  icon={CheckCircle2}
                  label="Approve milestone"
                  onClick={() =>
                    setConfirmTarget({
                      nextStatus: "Approved",
                      review: selectedReview,
                    })
                  }
                  variant="primary"
                />
                <FitButton
                  icon={EyeOff}
                  label="Reject milestone"
                  onClick={() =>
                    setConfirmTarget({
                      nextStatus: "Rejected",
                      review: selectedReview,
                    })
                  }
                  variant="danger"
                />
              </div>
            </>
          ) : (
            <EmptyState copy="Select a milestone review to inspect proof and make a decision." />
          )}
        </div>
      </div>
      <FitModal
        isOpen={isCompactMilestoneLayout && mobileReviewOpen && Boolean(selectedReview)}
        onClose={() => setMobileReviewOpen(false)}
        title={selectedReview?.badgeLabel ?? "Milestone review"}
        subtitle={selectedReview ? selectedReview.memberName : "Review proof"}
        icon={ShieldCheck}
        maxWidth={720}
        closeAriaLabel="Close milestone review"
      >
        {selectedReview ? (
          <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <img
                alt={`${selectedReview.badgeLabel} proof`}
                src={selectedReview.proofImageUrl}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 16,
                  height: 180,
                  objectFit: "cover",
                  width: "100%",
                }}
              />
              <div style={{ minWidth: 0 }}>
                <FitText style={{ fontSize: 22, fontWeight: 900 }}>
                  {selectedReview.badgeLabel}
                </FitText>
                <FitText style={{ color: colors.textSecondary, marginTop: 6, overflowWrap: "anywhere" }}>
                  {selectedReview.memberName} / {selectedReview.memberEmail}
                </FitText>
                <FitText style={{ color: colors.textMuted, fontSize: 13, marginTop: 10 }}>
                  {selectedReview.proofCaption}
                </FitText>
                <FitPill
                  mode="status"
                  label={selectedReview.status}
                  color={ACHIEVEMENT_REVIEW_STATUS_COLORS[selectedReview.status]}
                  style={{ marginTop: 12 }}
                />
              </div>
            </div>
            <FitTextArea
              rows={3}
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Moderator notes for this milestone decision"
            />
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <FitButton
                icon={CheckCircle2}
                label="Approve milestone"
                onClick={() =>
                  setConfirmTarget({
                    nextStatus: "Approved",
                    review: selectedReview,
                  })
                }
                variant="primary"
              />
              <FitButton
                icon={EyeOff}
                label="Reject milestone"
                onClick={() =>
                  setConfirmTarget({
                    nextStatus: "Rejected",
                    review: selectedReview,
                  })
                }
                variant="danger"
              />
            </div>
          </div>
        ) : null}
      </FitModal>
      <style>{`
        @media (max-width: 960px) {
          .gamification-milestone-management-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .gamification-milestone-detail-panel {
            display: none !important;
          }
        }
      `}</style>
      <ConfirmModal
        isOpen={confirmTarget !== null}
        title={`${confirmTarget?.nextStatus ?? "Review"} Milestone?`}
        message={`This updates ${confirmTarget?.review.badgeLabel ?? "the selected milestone"} for ${confirmTarget?.review.memberName ?? "this member"} and stores the moderator note.`}
        confirmLabel={confirmTarget?.nextStatus ?? "Confirm"}
        confirmIcon={
          confirmTarget?.nextStatus === "Rejected" ? EyeOff : CheckCircle2
        }
        isDanger={confirmTarget?.nextStatus === "Rejected"}
        onConfirm={applyDecision}
        onCancel={() => setConfirmTarget(null)}
      />
    </FitSection>
  );
}

function MetricGrid({
  overview,
}: {
  overview: AdminGamificationOverviewRecord | undefined;
}) {
  const { colors } = useTheme();
  const metrics = [
    {
      label: "Open integrity",
      value: overview?.integrity.openCaseCount ?? 0,
      icon: ShieldAlert,
    },
    {
      label: "Governed rankings",
      value: overview?.rankings.governedProfileCount ?? 0,
      icon: Trophy,
    },
    {
      label: "Season standings",
      value: overview?.activeSeason?.standingCount ?? 0,
      icon: CheckCircle2,
    },
    {
      label: "Corrections logged",
      value: overview?.audit.recentCorrectionCount ?? 0,
      icon: Activity,
    },
  ];

  return (
    <div
      className={`gamification-metric-grid ${styles.metricGrid}`}
      data-ui="gamification-metric-strip"
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        overflow: "hidden",
      }}
    >
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            className={`gamification-metric-item ${styles.metricItem}`}
            data-ui="gamification-metric-item"
            key={metric.label}
            style={{
              alignItems: "center",
              display: "grid",
              gap: 8,
              gridTemplateColumns: "auto minmax(0, 1fr) auto",
              minHeight: 52,
              padding: "8px 12px",
            }}
          >
            <Icon size={15} color={colors.brand} />
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
              {metric.label}
            </FitText>
            <FitText style={{ fontSize: 18, fontWeight: 900 }}>
              {metric.value}
            </FitText>
          </div>
        );
      })}
    </div>
  );
}
function ManualExpGrantPanel({
  currentLifetimeExp,
  draft,
  fieldErrors,
  loadError,
  members,
  memberSearch,
  membersLoading,
  muscleDefinitions,
  musclesLoading,
  mutationError,
  onDraftChange,
  onMemberSearchChange,
}: {
  currentLifetimeExp: number | null;
  draft: ManualExpDraft;
  fieldErrors: ManualExpFieldErrors;
  loadError: unknown;
  members: MemberRecord[];
  memberSearch: string;
  membersLoading: boolean;
  muscleDefinitions: MuscleDefinitionRecord[];
  musclesLoading: boolean;
  mutationError: unknown;
  onDraftChange: Dispatch<SetStateAction<ManualExpDraft>>;
  onMemberSearchChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  const selectedMember = members.find((member) => member.id === draft.userId);
  const visibleMembers = members.slice(0, 20);
  const isActivelySearching =
    !selectedMember && memberSearch.trim().length >= 2;
  const composerActive =
    draft.editingAllocationIndex !== null ||
    Boolean(draft.amount.trim() || draft.muscleGroup.trim());
  const totalExp = draft.allocations.reduce(
    (total, allocation) => total + allocation.amount,
    0,
  );
  const targetPreview = getManualExpTargetLevelPreview(
    draft.targetLevel,
    currentLifetimeExp,
  );
  const inputShell: CSSProperties = {
    alignItems: "center",
    backgroundColor: colors.fieldBg,
    border: `1px solid ${colors.fieldBorder}`,
    borderRadius: 8,
    display: "flex",
    minHeight: 36,
    padding: "0 10px",
  };
  const fieldShell: CSSProperties = {
    display: "grid",
    gap: 6,
  };
  const fieldLabel: CSSProperties = {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: 750,
  };

  const updateDraft = (patch: Partial<ManualExpDraft>) =>
    onDraftChange((current) => ({ ...current, ...patch }));
  const clearComposer = () =>
    updateDraft({
      amount: "",
      editingAllocationIndex: null,
      muscleGroup: "",
    });
  const commitAllocation = () => {
    if (fieldErrors.amount || fieldErrors.muscle) return;

    const nextAllocation: ManualExpAllocationDraft = {
      amount: Number(draft.amount),
      muscleGroup: draft.muscleGroup,
    };
    const nextAllocations = [...draft.allocations];
    if (draft.editingAllocationIndex === null) {
      nextAllocations.push(nextAllocation);
    } else {
      nextAllocations[draft.editingAllocationIndex] = nextAllocation;
    }
    onDraftChange((current) => ({
      ...current,
      allocations: nextAllocations,
      amount: "",
      editingAllocationIndex: null,
      muscleGroup: "",
    }));
  };
  const errorText = (message: string | null) =>
    message ? (
      <FitText role="alert" style={{ color: colors.danger, fontSize: 11 }}>
        {message}
      </FitText>
    ) : null;

  return (
    <div
      data-ui="gamification-manual-exp-form"
       style={{ display: "grid", gap: 10 }}
    >
      <div
        data-ui="gamification-manual-exp-workflow"
        style={{ display: "grid", gap: 8 }}
      >
        <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
          Search eligible active members by name or email.
        </FitText>
        {selectedMember ? (
          <div
            style={{
              alignItems: "center",
              backgroundColor: `${colors.brand}12`,
              border: `1px solid ${colors.brand}45`,
              borderRadius: 8,
              display: "flex",
              justifyContent: "space-between",
              minHeight: 42,
              padding: "8px 10px",
            }}
          >
            <div style={{ display: "grid", gap: 2 }}>
              <FitText style={{ fontSize: 12, fontWeight: 800 }}>
                {getMemberDisplayName(selectedMember)}
              </FitText>
              <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                {selectedMember.email}
              </FitText>
            </div>
            <FitButton
              label="Change"
              variant="ghost"
              onClick={() => {
                onMemberSearchChange("");
                updateDraft({ userId: "" });
              }}
              style={{ minHeight: 30 }}
              textStyle={{ fontSize: 11, fontWeight: 800 }}
            />
          </div>
        ) : (
          <FitSearch
            ariaLabel="Search eligible member for manual EXP"
            placeholder="Search member name or email"
            value={memberSearch}
            onChangeText={(value) => {
              onMemberSearchChange(value);
              updateDraft({ userId: "" });
            }}
          />
        )}
        {isActivelySearching ? (
          <div
            data-ui="gamification-manual-exp-member-results"
            role="listbox"
            aria-label="Eligible member search results"
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              display: "grid",
              maxHeight: 176,
              overflowY: "auto",
            }}
          >
            {membersLoading ? (
              <FitText style={{ color: colors.textMuted, padding: 12 }}>
                Searching eligible members...
              </FitText>
            ) : visibleMembers.length === 0 ? (
              <FitText style={{ color: colors.textMuted, padding: 12 }}>
                No eligible members match this search.
              </FitText>
            ) : (
              visibleMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => updateDraft({ userId: member.id })}
                  style={{
                    backgroundColor: "transparent",
                    border: 0,
                    borderBottom: `1px solid ${colors.border}`,
                    color: colors.textPrimary,
                    cursor: "pointer",
                    display: "grid",
                    gap: 3,
                    padding: "10px 12px",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 800 }}>
                    {getMemberDisplayName(member)}
                  </span>
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>
                    {member.email}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
        {isActivelySearching && members.length > visibleMembers.length ? (
          <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
            Showing the first 20 matches. Refine the search to narrow the list.
          </FitText>
        ) : null}
        {errorText(fieldErrors.member)}
        {loadError ? (
          <FitText role="alert" style={{ color: colors.danger, fontSize: 11 }}>
            {getErrorMessage(
              loadError,
              "Unable to load eligible members or muscle definitions.",
            )}
          </FitText>
        ) : null}
      </div>
      <div
        data-ui="gamification-manual-exp-target-level"
        style={{
          backgroundColor: colors.surfaceRaised,
          border: "1px solid " + colors.border,
          borderRadius: 8,
          display: "grid",
          gap: 8,
          padding: 10,
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "space-between",
          }}
        >
          <FitText style={{ fontSize: 12, fontWeight: 850 }}>
            Target lifetime level
          </FitText>
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            Optional
          </FitText>
        </div>
        <FitDropdown
          ariaLabel="Optional target lifetime level"
          disabled={!selectedMember || currentLifetimeExp === null}
          fullWidth
          options={[
            { label: "No target level (manual EXP only)", value: "" },
            ...MASTERY_RANK_OPTIONS.map((rank) => ({
              label: masteryRankLabel(rank),
              value: rank,
            })),
          ]}
          value={draft.targetLevel}
          onChange={(value) =>
            updateDraft({
              targetLevel: value as ManualExpDraft["targetLevel"],
            })
          }
          style={{ minHeight: 36 }}
        />
        {!selectedMember ? (
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            Choose a member before calculating a target-level delta.
          </FitText>
        ) : currentLifetimeExp === null ? (
          <FitText role="status" style={{ color: colors.warning, fontSize: 11 }}>
            Current lifetime EXP is not in the loaded overall standings. EXP-only
            grants remain available; target-level auditing is unavailable for this
            member.
          </FitText>
        ) : targetPreview ? (
          <div style={{ display: "grid", gap: 3 }}>
            <FitText style={{ color: colors.textSecondary, fontSize: 11 }}>
              Current lifetime EXP: {targetPreview.currentLifetimeExp?.toLocaleString("en-US")}
              {" · "}Target: {masteryRankLabel(targetPreview.targetLevel)}
            </FitText>
            {targetPreview.delta && targetPreview.delta > 0 ? (
              <FitText style={{ color: colors.brand, fontSize: 12, fontWeight: 850 }}>
                Audited delta: +{targetPreview.delta.toLocaleString("en-US")} EXP.
                Allocate this exact total across one or more muscle groups.
              </FitText>
            ) : (
              <FitText role="alert" style={{ color: colors.warning, fontSize: 11 }}>
                This member is already at or above the selected target level.
              </FitText>
            )}
            {targetPreview.delta && targetPreview.delta > 0 ? (
              <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                The submitted reviewer rationale will record the starting lifetime
                EXP, target level, and EXP delta. The grant remains EXP-based.
              </FitText>
            ) : null}
          </div>
        ) : (
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            Set a target level only when this audited EXP grant should land on an
            exact lifetime threshold.
          </FitText>
        )}
        {errorText(fieldErrors.targetLevel)}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <FitText style={{ fontSize: 12, fontWeight: 850 }}>
          EXP allocations
        </FitText>
        <div
          style={{
            alignItems: "start",
            display: "grid",
            gap: 8,
            gridTemplateColumns: "minmax(0, 1fr) 120px auto",
          }}
        >
          <div style={fieldShell}>
            <FitText style={fieldLabel}>Muscle group</FitText>
            <FitDropdown
              ariaLabel="Manual EXP muscle group"
              disabled={musclesLoading || muscleDefinitions.length === 0}
              fullWidth
              options={muscleDefinitions.map((definition) => ({
                label: definition.name,
                value: definition.key,
              }))}
              placeholder={musclesLoading ? "Loading muscles..." : "Select muscle"}
              value={draft.muscleGroup}
              onChange={(muscleGroup) => updateDraft({ muscleGroup })}
              style={{ minHeight: 36 }}
            />
            {composerActive ? errorText(fieldErrors.muscle) : null}
          </div>
          <label style={fieldShell}>
            <FitText style={fieldLabel}>EXP amount</FitText>
            <span style={inputShell}>
              <FitTextInput
                aria-label="Manual EXP amount"
                id="gamification-manual-exp-amount"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.amount}
                placeholder="1-1,000"
                onChange={(event) =>
                  updateDraft({
                    amount: event.target.value,
                  })
                }
              />
            </span>
            {errorText(fieldErrors.amount)}
          </label>
          <div style={{ alignSelf: "end", display: "flex", gap: 6 }}>
            {draft.editingAllocationIndex !== null ? (
              <FitButton
                label="Cancel"
                variant="ghost"
                onClick={clearComposer}
                style={{ minHeight: 36 }}
                textStyle={{ fontSize: 11, fontWeight: 800 }}
              />
            ) : null}
            <FitButton
              icon={draft.editingAllocationIndex === null ? PlusCircle : Pencil}
              label={draft.editingAllocationIndex === null ? "Add" : "Save"}
              variant="ghost"
              disabled={Boolean(fieldErrors.amount || fieldErrors.muscle)}
              onClick={commitAllocation}
              style={{ minHeight: 36 }}
              textStyle={{ fontSize: 11, fontWeight: 800 }}
            />
          </div>
        </div>
        <div
          data-ui="gamification-manual-exp-allocation-list"
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            display: "grid",
            overflow: "hidden",
          }}
        >
          {draft.allocations.length === 0 ? (
            <FitText style={{ color: colors.textMuted, fontSize: 11, padding: 10 }}>
              No allocations added yet.
            </FitText>
          ) : (
            draft.allocations.map((allocation, index) => {
              const definition = muscleDefinitions.find(
                (candidate) => candidate.key === allocation.muscleGroup,
              );
              return (
                <div
                  key={allocation.muscleGroup}
                  style={{
                    alignItems: "center",
                    borderBottom:
                      index < draft.allocations.length - 1
                        ? `1px solid ${colors.border}`
                        : undefined,
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
                    padding: "8px 10px",
                  }}
                >
                  <FitText style={{ fontSize: 12, fontWeight: 800 }}>
                    {definition?.name ?? labelize(allocation.muscleGroup)}
                  </FitText>
                  <FitText style={{ color: colors.brand, fontSize: 12, fontWeight: 900 }}>
                    {allocation.amount.toLocaleString("en-US")} EXP
                  </FitText>
                  <FitButton
                    icon={Pencil}
                    label="Edit"
                    variant="ghost"
                    onClick={() =>
                      updateDraft({
                        amount: String(allocation.amount),
                        editingAllocationIndex: index,
                        muscleGroup: allocation.muscleGroup,
                      })
                    }
                    style={{ minHeight: 28 }}
                    textStyle={{ fontSize: 10, fontWeight: 800 }}
                  />
                  <FitButton
                    icon={Trash2}
                    label="Remove"
                    variant="ghost"
                    onClick={() =>
                      onDraftChange((current) => ({
                        ...current,
                        allocations: current.allocations.filter(
                          (_, allocationIndex) => allocationIndex !== index,
                        ),
                        amount:
                          current.editingAllocationIndex === index
                            ? ""
                            : current.amount,
                        editingAllocationIndex: null,
                        muscleGroup:
                          current.editingAllocationIndex === index
                            ? ""
                            : current.muscleGroup,
                      }))
                    }
                    style={{ minHeight: 28 }}
                    textStyle={{ fontSize: 10, fontWeight: 800 }}
                  />
                </div>
              );
            })
          )}
        </div>
        {errorText(fieldErrors.allocations)}
        <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 850 }}>
          Total: {totalExp.toLocaleString("en-US")} EXP
        </FitText>
      </div>
        <label style={fieldShell}>
          <FitText style={fieldLabel}>Reviewer rationale</FitText>
          <span
            style={{
              ...inputShell,
              alignItems: "stretch",
              minHeight: 76,
              padding: 10,
            }}
          >
            <FitTextArea
              aria-label="Reviewer rationale"
              id="gamification-manual-exp-rationale"
              rows={3}
              value={draft.rationale}
              placeholder="Explain the verified activity and why this adjustment is appropriate."
              onChange={(event) =>
                updateDraft({ rationale: event.target.value })
              }
            />
          </span>
          {errorText(fieldErrors.rationale)}
        </label>
        {mutationError ? (
          <FitText role="alert" style={{ color: colors.danger, fontSize: 12 }}>
            {getErrorMessage(
              mutationError,
              "Unable to apply the manual EXP grant. Review the allocations and try again.",
            )}
          </FitText>
        ) : null}
    </div>
  );
}

function RecordList({
  children,
  emptyCopy,
}: {
  children: ReactNode;
  emptyCopy: string;
}) {
  const entries = Array.isArray(children)
    ? children.filter(Boolean)
    : children
      ? [children]
      : [];

  if (entries.length === 0) {
    return <EmptyState copy={emptyCopy} />;
  }

  return (
    <div style={{ alignContent: "start", display: "grid", gap: 8, minHeight: 0 }}>
      {entries}
    </div>
  );
}

function ProfileHeading({
  subtitle,
  title,
}: {
  subtitle: string;
  title: string;
}) {
  const { colors } = useTheme();
  return (
    <div>
      <FitText style={{ display: "block", fontWeight: 800 }}>{title}</FitText>
      <FitText
        style={{
          color: colors.textMuted,
          display: "block",
          fontSize: 13,
          marginTop: 3,
        }}
      >
        {subtitle}
      </FitText>
    </div>
  );
}

function EmptyState({ copy }: { copy: string }) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        border: `1px dashed ${colors.border}`,
        backgroundColor: colors.surface,
        borderRadius: 8,
        padding: 14,
      }}
    >
      <FitText style={{ color: colors.textMuted, fontSize: 13 }}>
        {copy}
      </FitText>
    </div>
  );
}
