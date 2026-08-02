"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Archive,
  CheckCircle2,
  Crown,
  EyeOff,
  PlusCircle,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminGamificationMuscleLeaderboardListParams,
  AdminGamificationSeasonCreateInput,
  AdminManualExpGrantInput,
  AdminGamificationSeasonStandingListParams,
  FitnessRankingGovernanceStatus,
} from "@fittrack/api-client";
import type {
  AdminGamificationOverviewRecord,
  AdminGamificationRankingProfileRecord,
  AdminGamificationSeasonStandingRecord,
  AdminGamificationSeasonSummaryRecord,
  FitnessMuscleLeaderboardEntryRecord,
  FitnessRankingVisibility,
  FitnessSeasonStatus,
  MemberRecord,
  MuscleDefinitionRecord,
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
type ManualExpDraft = {
  amount: string;
  appointmentId: string;
  muscleGroup: string;
  rationale: string;
  userId: string;
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
  const [leaderboardMode, setLeaderboardMode] =
    useState<"overall" | "muscle">("overall");
  const [muscleStandingPage, setMuscleStandingPage] = useState(1);
  const [muscleStandingScope, setMuscleStandingScope] =
    useState<"lifetime" | "season">("season");
  const [selectedStandingMuscle, setSelectedStandingMuscle] = useState("chest");
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
  const [manualExpDraft, setManualExpDraft] = useState<ManualExpDraft>({
    amount: "75",
    appointmentId: "",
    muscleGroup: "",
    rationale:
      "Coach verified the member completed the post-session work without camera tracking.",
    userId: "",
  });

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
    () =>
      (muscleDefinitionsQuery.data ?? []).filter(
        (definition) => definition.isActive,
      ),
    [muscleDefinitionsQuery.data],
  );
  const seasonFilterParams = useMemo<AdminGamificationSeasonStandingListParams>(
    () => ({
      includeArchived: seasonIncludeArchived,
      limit: 10,
      page: seasonStandingPage,
      ...(seasonFilterId ? { seasonId: seasonFilterId } : {}),
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
      seasonFilterId,
      seasonGovernanceFilter,
      seasonIncludeArchived,
      seasonMuscleFilter,
      seasonStandingPage,
      seasonStandingSearch,
      seasonVisibilityFilter,
    ],
  );
  const seasonsQuery = useQuery(
    adminGamificationSeasonsQueryOptions(webApiClient),
  );
  const seasonStandingsQuery = useQuery(
    adminGamificationSeasonStandingsQueryOptions(
      webApiClient,
      seasonFilterParams,
    ),
  );
  const muscleStandingParams =
    useMemo<AdminGamificationMuscleLeaderboardListParams>(
      () => ({
        limit: 10,
        muscleKey: selectedStandingMuscle,
        page: muscleStandingPage,
        scope: muscleStandingScope,
        ...(muscleStandingScope === "season" && seasonFilterId
          ? { seasonId: seasonFilterId }
          : {}),
        ...(seasonStandingSearch.trim()
          ? { search: seasonStandingSearch.trim() }
          : {}),
      }),
      [
        muscleStandingPage,
        muscleStandingScope,
        seasonFilterId,
        seasonStandingSearch,
        selectedStandingMuscle,
      ],
    );
  const muscleStandingsQuery = useQuery({
    ...adminGamificationMuscleStandingsQueryOptions(
      webApiClient,
      muscleStandingParams,
    ),
    enabled: leaderboardMode === "muscle",
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
  }, [
    seasonFilterId,
    seasonGovernanceFilter,
    seasonIncludeArchived,
    seasonMuscleFilter,
    seasonStandingSearch,
    seasonVisibilityFilter,
  ]);

  useEffect(() => {
    setMuscleStandingPage(1);
  }, [
    muscleStandingScope,
    seasonFilterId,
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
  const pageError =
    overviewQuery.error ??
    seasonsQuery.error ??
    seasonStandingsQuery.error ??
    muscleStandingsQuery.error ??
    membersQuery.error ??
    milestoneReviewsQuery.error ??
    seasonMutation.error ??
    createSeasonMutation.error ??
    integrityMutation.error ??
    manualExpMutation.error ??
    rankingMutation.error;

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

  const submitSeasonDraft = () => {
    const startsAt = new Date(seasonDraft.startsAt);
    const endsAt = new Date(seasonDraft.endsAt);
    if (
      !seasonDraft.title.trim() ||
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      setConfirmationState({
        confirmIcon: ShieldAlert,
        confirmLabel: "Close",
        message:
          "Add a season title and a valid date window where the end is after the start.",
        title: "Season Schedule Needs Attention",
        onConfirm: () => undefined,
      });
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

  const submitManualExpGrant = () => {
    const amount = Number(manualExpDraft.amount);
    const selectedMember = manualExpEligibleMembers.find(
      (member) => member.id === manualExpDraft.userId,
    );
    const rationale = manualExpDraft.rationale.trim();

    if (!manualExpDraft.userId || !selectedMember || !Number.isInteger(amount) || amount < 1) {
      setConfirmationState({
        confirmIcon: ShieldAlert,
        confirmLabel: "Close",
        message:
          "Choose an active member with verified membership-card access and enter a whole-number EXP amount before applying a manual grant.",
        title: "Manual EXP Needs A Valid Amount",
        onConfirm: () => undefined,
      });
      return;
    }

    if (!rationale) {
      setConfirmationState({
        confirmIcon: ShieldAlert,
        confirmLabel: "Close",
        message:
          "Add a reviewer rationale so the manual grant is audit-ready.",
        title: "Manual EXP Needs A Rationale",
        onConfirm: () => undefined,
      });
      return;
    }

    const payload: AdminManualExpGrantInput = {
      amount,
      rationale,
      userId: manualExpDraft.userId,
      ...(manualExpDraft.muscleGroup.trim()
        ? { muscleGroup: manualExpDraft.muscleGroup.trim() }
        : {}),
      ...(manualExpDraft.appointmentId.trim()
        ? { appointmentId: manualExpDraft.appointmentId.trim() }
        : {}),
    };

    setManualExpOpen(false);
    setConfirmationState({
      confirmIcon: PlusCircle,
      confirmLabel: "Grant EXP",
      message: `${amount} EXP will be added to ${selectedMember ? getMemberDisplayName(selectedMember) : "this member"} and logged as a manual post-session correction.`,
      title: "Apply Manual EXP Grant?",
      onConfirm: () => {
        manualExpMutation.mutate(
          { payload },
          {
            onSuccess: () => {
              setManualExpDraft((current) => ({
                ...current,
                amount: "75",
                appointmentId: "",
                muscleGroup: "",
                userId: "",
              }));
              setManualMemberSearch("");
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
                  onClick={() => setManualExpOpen(true)}
                  style={{ minHeight: 36, minWidth: 112, paddingInline: 14 }}
                />
              </span>
              <FitButton
                variant="ghost"
                icon={RefreshCcw}
                label="Refresh"
                loading={overviewQuery.isFetching}
                onClick={() => overviewQuery.refetch()}
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
                          loading={seasonMutation.isPending}
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
        </div>

        {pageError ? (
          <div
            style={{
              ...panelStyle,
              borderColor: `${colors.danger}55`,
              backgroundColor: `${colors.danger}10`,
            }}
          >
            <FitText style={{ color: colors.danger, fontWeight: 800 }}>
              {getErrorMessage(pageError, "Gamification admin action failed.")}
            </FitText>
          </div>
        ) : null}

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
                includeArchived={seasonIncludeArchived}
                leaderboardMode={leaderboardMode}
                muscleFilter={seasonMuscleFilter}
                onIncludeArchivedChange={setSeasonIncludeArchived}
                onLeaderboardModeChange={setLeaderboardMode}
                onMuscleFilterChange={setSeasonMuscleFilter}
                onPageChange={setSeasonStandingPage}
                onSearchChange={setSeasonStandingSearch}
                onSeasonChange={setSeasonFilterId}
                onVisibilityChange={setSeasonVisibilityFilter}
                onGovernanceChange={setSeasonGovernanceFilter}
                onModerate={moderateStanding}
                onOpenManualExp={() => setManualExpOpen(true)}
                onOpenSeasonManager={openSeasonManager}
                onRefresh={() => {
                  void Promise.all([
                    overviewQuery.refetch(),
                    seasonStandingsQuery.refetch(),
                  ]);
                }}
                moderationPending={rankingMutation.isPending}
                page={seasonStandingPage}
                refreshing={
                  overviewQuery.isFetching || seasonStandingsQuery.isFetching
                }
                search={seasonStandingSearch}
                selectedGovernance={seasonGovernanceFilter}
                selectedSeasonId={seasonFilterId}
                selectedVisibility={seasonVisibilityFilter}
                seasons={seasonsQuery.data ?? []}
                standings={seasonStandingsQuery.data}
              />
              ) : (
                <MusclePerformanceTable
                  governanceProfiles={overview?.rankings.profiles ?? []}
                  leaderboardMode={leaderboardMode}
                  moderationPending={rankingMutation.isPending}
                  muscleDefinitions={manualExpMuscleDefinitions}
                  onLeaderboardModeChange={setLeaderboardMode}
                  onModerate={moderateStanding}
                  onMuscleChange={setSelectedStandingMuscle}
                  onOpenManualExp={() => setManualExpOpen(true)}
                  onOpenSeasonManager={openSeasonManager}
                  onPageChange={setMuscleStandingPage}
                  onRefresh={() => {
                    void Promise.all([
                      overviewQuery.refetch(),
                      muscleStandingsQuery.refetch(),
                    ]);
                  }}
                  onScopeChange={setMuscleStandingScope}
                  onSearchChange={setSeasonStandingSearch}
                  onSeasonChange={setSeasonFilterId}
                  page={muscleStandingPage}
                  refreshing={
                    overviewQuery.isFetching || muscleStandingsQuery.isFetching
                  }
                  scope={muscleStandingScope}
                  search={seasonStandingSearch}
                  selectedMuscle={selectedStandingMuscle}
                  selectedSeasonId={seasonFilterId}
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
        onClose={() => setSeasonManagerOpen(false)}
        title="Season planner"
        subtitle="Schedule the next ranking season or manually start an eligible draft."
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
              disabled={createSeasonMutation.isPending}
              onClick={() => setSeasonManagerOpen(false)}
              style={{ minHeight: 36, minWidth: 88 }}
            />
            <FitButton
              variant="primary"
              icon={PlusCircle}
              label="Create draft"
              loading={createSeasonMutation.isPending}
              disabled={
                !seasonDraft.title.trim() ||
                !seasonDraft.startsAt ||
                !seasonDraft.endsAt
              }
              onClick={submitSeasonDraft}
              style={{ minHeight: 36, minWidth: 126 }}
            />
          </div>
        }
      >
        <div style={{ display: "grid", gap: 18 }}>
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
                loading={seasonMutation.isPending}
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
                Schedule a season
              </FitText>
              <FitText style={{ ...muted, marginTop: 3 }}>
                Drafts start automatically at their scheduled time when no other season is active.
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
                      <FitButton
                        variant="ghost"
                        icon={CheckCircle2}
                        label={overview?.activeSeason ? "Active season running" : "Start now"}
                        disabled={Boolean(overview?.activeSeason)}
                        loading={seasonMutation.isPending}
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
        onClose={() => {
          setManualExpOpen(false);
          setManualMemberSearch("");
        }}
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
              onClick={() => {
                setManualExpOpen(false);
                setManualMemberSearch("");
              }}
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
                label="Grant EXP"
                loading={manualExpMutation.isPending}
                disabled={!manualExpDraft.userId}
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
          onDraftChange={setManualExpDraft}
          onMemberSearchChange={setManualMemberSearch}
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
          seasonMutation.isPending ||
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
  includeArchived,
  leaderboardMode,
  moderationPending,
  muscleFilter,
  onGovernanceChange,
  onIncludeArchivedChange,
  onLeaderboardModeChange,
  onModerate,
  onMuscleFilterChange,
  onOpenManualExp,
  onOpenSeasonManager,
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
  includeArchived: boolean;
  leaderboardMode: "overall" | "muscle";
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
        meta: { limit: number; page: number; total: number; total_pages: number };
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
  const seasonOptions = [
    { label: "All seasons", value: "" },
    ...seasons.map((season) => ({
      label: `${season.title} (${labelize(season.status)})`,
      value: season.id,
    })),
  ];
  const tableColumns: FitTableColumn<AdminGamificationSeasonStandingRecord>[] = [
    {
      key: "rank",
      heading: "Rank",
      render: (row) => (
        <FitText
          style={{
            alignItems: "center",
            backgroundColor:
              row.rankPosition && row.rankPosition <= 3
                ? `${colors.brand}18`
                : "transparent",
            border:
              row.rankPosition && row.rankPosition <= 3
                ? `1px solid ${colors.brand}55`
                : "1px solid transparent",
            borderRadius: 8,
            color:
              row.rankPosition && row.rankPosition <= 3
                ? colors.brand
                : colors.textPrimary,
            display: "inline-flex",
            fontSize: 12,
            fontWeight: 900,
            height: 28,
            justifyContent: "center",
            minWidth: 32,
          }}
        >
          {row.rankPosition ? `#${row.rankPosition}` : "--"}
        </FitText>
      ),
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
      heading: "Season score",
      align: "right",
      render: (row, themeColors) => (
        <div style={{ display: "grid", gap: 2, justifyItems: "end" }}>
          <FitText style={{ display: "block", fontSize: 13, fontWeight: 850 }}>
            {row.seasonPoints.toLocaleString("en-US")} pts
          </FitText>
          <FitText
            style={{
              color: themeColors.textMuted,
              display: "block",
              fontSize: 11,
            }}
          >
            {row.totalXp.toLocaleString("en-US")} total XP
          </FitText>
        </div>
      ),
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
            label={labelize(row.visibility)}
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
            </div>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
              Compare member momentum, earned EXP, milestones, and ranking eligibility.
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
            emptyMessage="No season standings match the current filters."
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
            <FitPagination
              currentPage={meta.page}
              totalPages={Math.max(1, meta.total_pages)}
              onPageChange={onPageChange}
              ariaLabel="Season standing pagination"
              showSinglePage
            />
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
  governanceProfiles,
  leaderboardMode,
  moderationPending,
  muscleDefinitions,
  onLeaderboardModeChange,
  onModerate,
  onMuscleChange,
  onOpenManualExp,
  onOpenSeasonManager,
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
  governanceProfiles: AdminGamificationRankingProfileRecord[];
  leaderboardMode: "overall" | "muscle";
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
        meta: { limit: number; page: number; total: number; total_pages: number };
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
  const muscleOptions = muscleDefinitions.map((definition) => ({
    label: definition.name,
    value: definition.key,
  }));
  const seasonOptions = [
    { label: "Current season", value: "" },
    ...seasons
      .filter((season) => season.status === "active" || season.status === "closed")
      .map((season) => ({
        label: `${season.title} (${labelize(season.status)})`,
        value: season.id,
      })),
  ];
  const selectedSeason =
    seasons.find((season) => season.id === selectedSeasonId) ??
    seasons.find((season) => season.status === "active") ??
    null;
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
        <div style={{ display: "grid", gap: 2 }}>
          <FitText style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 850 }}>
            {row.displayName}
          </FitText>
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            {row.isCurrentUser ? "Current account" : "Gym member"}
          </FitText>
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
      render: (row) => (
        <FitText style={{ color: colors.brand, fontSize: 13, fontWeight: 900 }}>
          {row.xpPoints.toLocaleString("en-US")} EXP
        </FitText>
      ),
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
            emptyMessage="No muscle standings match the current filters."
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
            <FitPagination
              currentPage={meta.page}
              totalPages={Math.max(1, meta.total_pages)}
              onPageChange={onPageChange}
              ariaLabel="Muscle standing pagination"
              showSinglePage
            />
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
  draft,
  members,
  memberSearch,
  membersLoading,
  muscleDefinitions,
  musclesLoading,
  onDraftChange,
  onMemberSearchChange,
}: {
  draft: ManualExpDraft;
  members: MemberRecord[];
  memberSearch: string;
  membersLoading: boolean;
  muscleDefinitions: MuscleDefinitionRecord[];
  musclesLoading: boolean;
  onDraftChange: Dispatch<SetStateAction<ManualExpDraft>>;
  onMemberSearchChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  const selectedMember = members.find((member) => member.id === draft.userId);
  const visibleMembers = members.slice(0, 20);
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
        <FitSearch
          ariaLabel="Search eligible member for manual EXP"
          placeholder="Search member name or email"
          value={memberSearch}
          onChangeText={(value) => {
            onMemberSearchChange(value);
            updateDraft({ userId: "" });
          }}
        />
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
          {memberSearch.trim().length < 2 ? (
            <FitText style={{ color: colors.textMuted, padding: 12 }}>
              Enter at least 2 characters to search.
            </FitText>
          ) : membersLoading ? (
            <FitText style={{ color: colors.textMuted, padding: 12 }}>
              Searching eligible members...
            </FitText>
          ) : visibleMembers.length === 0 ? (
            <FitText style={{ color: colors.textMuted, padding: 12 }}>
              No eligible members match this search.
            </FitText>
          ) : (
            visibleMembers.map((member) => {
              const selected = member.id === draft.userId;
              return (
                <button
                  key={member.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => updateDraft({ userId: member.id })}
                  style={{
                    backgroundColor: selected
                      ? `${colors.brand}18`
                      : "transparent",
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
              );
            })
          )}
        </div>
        {members.length > visibleMembers.length ? (
          <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
            Showing the first 20 matches. Refine the search to narrow the list.
          </FitText>
        ) : null}
         {selectedMember ? (
           <div
             style={{
               alignItems: "center",
               backgroundColor: `${colors.brand}12`,
               border: `1px solid ${colors.brand}45`,
               borderRadius: 6,
               display: "flex",
               justifyContent: "space-between",
               minHeight: 36,
               padding: "7px 10px",
             }}
           >
             <FitText style={{ fontSize: 12, fontWeight: 800 }}>
               {getMemberDisplayName(selectedMember)}
             </FitText>
             <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
               Selected member
             </FitText>
           </div>
         ) : null}
      </div>
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "110px minmax(0, 1fr)",
          }}
        >
          <label style={fieldShell}>
            <FitText style={fieldLabel}>EXP amount</FitText>
            <span style={inputShell}>
              <FitTextInput
                aria-label="Manual EXP amount"
                id="gamification-manual-exp-amount"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.amount}
                placeholder="e.g. 75"
                onChange={(event) =>
                  updateDraft({
                    amount: event.target.value.replace(/[^0-9]/g, ""),
                  })
                }
              />
            </span>
          </label>
          <label style={fieldShell}>
            <FitText style={fieldLabel}>Muscle group (optional)</FitText>
            <span
              data-ui="gamification-manual-exp-muscle"
              style={inputShell}
            >
              <FitTextInput
                aria-label="Manual EXP muscle group"
                aria-autocomplete="list"
                aria-controls="gamification-manual-exp-muscle-options"
                id="gamification-manual-exp-muscle-group"
                list="gamification-manual-exp-muscle-options"
                role="combobox"
                value={draft.muscleGroup}
                placeholder={
                  musclesLoading ? "Loading muscles..." : "Search or select"
                }
                onChange={(event) =>
                  updateDraft({ muscleGroup: event.target.value })
                }
              />
              <datalist id="gamification-manual-exp-muscle-options">
                {muscleDefinitions.map((definition) => (
                  <option key={definition.id} value={definition.key}>
                    {definition.name}
                  </option>
                ))}
              </datalist>
            </span>
          </label>
        </div>
        <label style={fieldShell}>
          <FitText style={fieldLabel}>Related appointment (optional)</FitText>
          <span style={inputShell}>
            <FitTextInput
              aria-label="Manual EXP appointment ID"
              id="gamification-manual-exp-appointment-id"
              value={draft.appointmentId}
              placeholder="Paste the verified appointment ID when available"
              onChange={(event) =>
                updateDraft({ appointmentId: event.target.value })
              }
            />
          </span>
        </label>
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
        </label>
        {selectedMember ? (
          <div
            style={{
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              display: "grid",
              gap: 3,
              padding: "9px 10px",
            }}
          >
            <FitText style={{ fontSize: 11, fontWeight: 800 }}>
              Grant summary
            </FitText>
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              {draft.amount || "0"} EXP to {getMemberDisplayName(selectedMember)}
              {draft.muscleGroup ? ` · ${draft.muscleGroup}` : " · General"}
            </FitText>
          </div>
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
