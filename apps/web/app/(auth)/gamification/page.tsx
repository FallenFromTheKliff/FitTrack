"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Archive,
  CheckCircle2,
  Crown,
  EyeOff,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminGamificationSeasonStandingListParams,
  FitnessRankingGovernanceStatus,
} from "@fittrack/api-client";
import type {
  AdminGamificationOverviewRecord,
  AdminGamificationRankingProfileRecord,
  AdminGamificationSeasonStandingRecord,
  AdminGamificationSeasonSummaryRecord,
  FitnessRankingVisibility,
  FitnessSeasonStatus,
} from "@fittrack/types";
import {
  adminGamificationSeasonStandingsQueryOptions,
  adminGamificationSeasonsQueryOptions,
  adminGamificationOverviewQueryOptions,
  fitnessAchievementReviewsQueryOptions,
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
} from "@/components/fit";
import type { FitTableColumn } from "@/components/fit/FitTable";
import { ConfirmModal } from "@/components/modals";
import {
  ACHIEVEMENT_REVIEW_STATUS_COLORS,
  type AchievementReviewRecord,
  type AchievementReviewStatus,
} from "@/data/progress/milestones";

export const dynamic = "force-dynamic";

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
  { label: "All", value: "all" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
];

type GamificationTab = "overview" | "milestones";
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

function labelize(value: string) {
  return value
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<GamificationTab>("overview");
  const [confirmationState, setConfirmationState] =
    useState<AdminConfirmationState | null>(null);
  const [seasonRationale, setSeasonRationale] = useState(
    "Admin lifecycle review completed.",
  );
  const [seasonStandingPage, setSeasonStandingPage] = useState(1);
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

  const overviewQuery = useQuery(
    adminGamificationOverviewQueryOptions(webApiClient),
  );
  const seasonFilterParams = useMemo<AdminGamificationSeasonStandingListParams>(
    () => ({
      includeArchived: seasonIncludeArchived,
      limit: 6,
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
  const milestoneReviewsQuery = useQuery(
    fitnessAchievementReviewsQueryOptions(webApiClient),
  );
  const seasonMutation = useMutation(
    updateAdminGamificationSeasonStatusMutationOptions(
      webApiClient,
      queryClient,
    ),
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
  useEffect(() => {
    if (searchParams.get("tab") === "milestones") {
      setActiveTab("milestones");
    }
  }, [searchParams]);

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
    milestoneReviewsQuery.error ??
    seasonMutation.error ??
    integrityMutation.error ??
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
    padding: 14,
    display: "grid",
    gap: 10,
    gridTemplateRows: "auto minmax(0, 1fr)",
    minHeight: 250,
    overflow: "visible",
  };
  const overviewBottomContentStyle = {
    ...subPanelStyle,
    display: "grid",
    gap: 8,
    minWidth: 0,
    overflow: "visible",
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
  ) => {
    const rationale =
      integrityNotes[caseId]?.trim() ||
      (status === "resolved_valid"
        ? "Manual review confirmed this progression can stand."
        : "Manual review confirmed this progression should stay invalid.");

    setConfirmationState({
      confirmIcon: status === "resolved_valid" ? ShieldCheck : EyeOff,
      confirmLabel:
        status === "resolved_valid" ? "Resolve valid" : "Resolve invalid",
      isDanger: status === "resolved_invalid",
      message:
        status === "resolved_valid"
          ? "This closes the integrity case and keeps the related progression in force."
          : "This closes the integrity case and preserves the invalid progression decision.",
      title:
        status === "resolved_valid"
          ? "Resolve Integrity Case As Valid?"
          : "Resolve Integrity Case As Invalid?",
      onConfirm: () => {
        integrityMutation.mutate({
          caseId,
          payload: { status, rationale },
        });
      },
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

  return (
    <FitSection
      as="section"
      heading=""
      hideHeading
      bare
      noPadding
      className={`${themeTransition} gamification-admin-shell`}
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
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        <div
          className="gamification-governance-header"
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: 10,
            backgroundColor: colors.surface,
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) minmax(360px, 0.42fr)",
            gap: 8,
            alignItems: "center",
            minHeight: 0,
          }}
        >
          <div style={{ display: "grid", gap: 7, minHeight: 0 }}>
            <FitPill
              mode="status"
              label="Governance View"
              color={colors.brand}
              style={{ width: "fit-content" }}
            />
            <FitText
              as="h1"
              style={{
                fontSize: 18,
                lineHeight: 1.12,
                letterSpacing: 0,
                fontWeight: 900,
              }}
            >
              Seasons, rankings, integrity, and XP trust.
            </FitText>
            {overview?.activeSeason ? (
              <div
                className="gamification-active-season-panel"
                style={{
                  ...subPanelStyle,
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns:
                    "minmax(0, 1fr) minmax(210px, 0.36fr) minmax(190px, auto)",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    gap: 10,
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <FitText style={{ display: "block", fontSize: 16, fontWeight: 900 }}>
                      {overview.activeSeason.title}
                    </FitText>
                    <FitText style={muted}>
                      {labelize(overview.activeSeason.status)} /{" "}
                      {overview.activeSeason.standingCount} standings /{" "}
                      {overview.activeSeason.hiddenCount} hidden /{" "}
                      {overview.activeSeason.disqualifiedCount} disqualified
                    </FitText>
                  </div>
                  <FitPill
                    mode="status"
                    label={labelize(overview.activeSeason.status)}
                    color={colors.brand}
                  />
                </div>
                <FitTextArea
                  value={seasonRationale}
                  onChange={(event) => setSeasonRationale(event.target.value)}
                  rows={1}
                  placeholder="Lifecycle rationale"
                  style={{ minHeight: 38 }}
                />
                <div
                  className="gamification-active-season-actions"
                  style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
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
                      This season has no safe next lifecycle move.
                    </FitText>
                  ) : null}
                </div>
              </div>
            ) : (
              <FitText style={muted}>
                No active season is currently eligible for lifecycle controls.
              </FitText>
            )}
          </div>
          <div
            className="gamification-sync-card"
            style={{
              ...panelStyle,
              padding: 6,
              display: "grid",
              gap: 10,
              alignContent: "space-between",
            }}
          >
            <FitText style={{ ...muted, textTransform: "uppercase" }}>
              Latest sync
            </FitText>
            <FitText style={{ fontSize: 18, fontWeight: 800 }}>
              {overview ? formatDateTime(overview.generatedAt) : "Loading"}
            </FitText>
            <FitButton
              variant="ghost"
              icon={RefreshCcw}
              label="REFRESH"
              loading={overviewQuery.isFetching}
              onClick={() => overviewQuery.refetch()}
            />
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

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {[
            { label: "Governance Overview", value: "overview" as const },
            { label: "Milestone Management", value: "milestones" as const },
          ].map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                style={{
                  border: `1px solid ${isActive ? colors.brand : colors.border}`,
                  backgroundColor: isActive
                    ? `${colors.brand}16`
                    : colors.surfaceRaised,
                  borderRadius: 999,
                  color: isActive ? colors.brand : colors.textSecondary,
                  cursor: "pointer",
                  fontWeight: 800,
                  padding: "8px 14px",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "overview" ? (
          <div
            className="gamification-overview-grid"
            style={{
              display: "grid",
              gridTemplateRows: "auto minmax(430px, auto) minmax(250px, auto)",
              gap: 14,
              minHeight: 0,
              overflow: "visible",
            }}
          >
            <MetricGrid overview={overview} />

            <div style={{ minHeight: 0, overflow: "visible" }}>
              <SeasonPerformanceTable
                includeArchived={seasonIncludeArchived}
                muscleFilter={seasonMuscleFilter}
                onIncludeArchivedChange={setSeasonIncludeArchived}
                onMuscleFilterChange={setSeasonMuscleFilter}
                onPageChange={setSeasonStandingPage}
                onSearchChange={setSeasonStandingSearch}
                onSeasonChange={setSeasonFilterId}
                onVisibilityChange={setSeasonVisibilityFilter}
                onGovernanceChange={setSeasonGovernanceFilter}
                page={seasonStandingPage}
                search={seasonStandingSearch}
                selectedGovernance={seasonGovernanceFilter}
                selectedSeasonId={seasonFilterId}
                selectedVisibility={seasonVisibilityFilter}
                seasons={seasonsQuery.data ?? []}
                standings={seasonStandingsQuery.data}
              />
            </div>

        <div
          className="gamification-bottom-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
            alignItems: "stretch",
            minHeight: 0,
          }}
        >
          <FitSection
            heading="Integrity Review"
            action={<ShieldAlert size={16} color={colors.brand} />}
            style={overviewBottomCardStyle}
            bare
          >
            <RecordList emptyCopy="No open integrity cases.">
              {overview?.integrity.cases.slice(0, 1).map((integrityCase) => (
                <div key={integrityCase.caseId} style={overviewBottomContentStyle}>
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
                  <FitTextArea
                    rows={2}
                    value={integrityNotes[integrityCase.caseId] ?? ""}
                    onChange={(event) =>
                      updateDraft(
                        setIntegrityNotes,
                        integrityCase.caseId,
                        event.target.value,
                      )
                    }
                    placeholder="Reviewer rationale for this integrity decision"
                    style={{ marginTop: 10 }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
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
          </FitSection>
          <FitSection
            heading="Ranking Governance"
            action={<Crown size={16} color={colors.brand} />}
            style={overviewBottomCardStyle}
            bare
          >
            <RecordList emptyCopy="No admin-governed ranking profiles yet.">
              {overview?.rankings.profiles.slice(0, 1).map((profile) => (
                <div key={profile.userId} style={overviewBottomContentStyle}>
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
                          [profile.userId]: value as RankingStateDraftMap[string],
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
                    style={{ marginTop: 8 }}
                  />
                </div>
              ))}
            </RecordList>
          </FitSection>

        <FitSection
          heading="Audit And Corrections"
          action={<Activity size={16} color={colors.brand} />}
          style={overviewBottomCardStyle}
          bare
        >
          <RecordList emptyCopy="No moderation actions have been recorded yet.">
            {overview?.audit.recentActions.slice(0, 1).map((action) => (
              <div
                key={action.id}
                style={{
                  ...overviewBottomContentStyle,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                  alignItems: "center",
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
        </FitSection>
        </div>
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
        @media (max-width: 1180px) {
          .gamification-governance-header {
            grid-template-columns: minmax(0, 1fr) !important;
            align-items: stretch !important;
          }

          .gamification-active-season-panel {
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

          .gamification-bottom-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }

        @media (max-width: 640px) {
          .gamification-sync-card {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
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
  muscleFilter,
  onGovernanceChange,
  onIncludeArchivedChange,
  onMuscleFilterChange,
  onPageChange,
  onSearchChange,
  onSeasonChange,
  onVisibilityChange,
  page,
  search,
  selectedGovernance,
  selectedSeasonId,
  selectedVisibility,
  seasons,
  standings,
}: {
  includeArchived: boolean;
  muscleFilter: string;
  onGovernanceChange: (value: FitnessRankingGovernanceStatus | "") => void;
  onIncludeArchivedChange: (value: boolean) => void;
  onMuscleFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onSearchChange: (value: string) => void;
  onSeasonChange: (value: string) => void;
  onVisibilityChange: (value: FitnessRankingVisibility | "") => void;
  page: number;
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
  const rows = standings?.data ?? [];
  const meta = standings?.meta ?? {
    limit: 6,
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
        <FitText style={{ display: "block", fontSize: 13, fontWeight: 900 }}>
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
          <FitText style={{ display: "block", fontSize: 13, fontWeight: 760 }}>
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
      heading: "EXP",
      align: "right",
      render: (row, themeColors) => (
        <div style={{ display: "grid", gap: 2, justifyItems: "end" }}>
          <FitText style={{ display: "block", fontSize: 13, fontWeight: 850 }}>
            {row.totalXp.toLocaleString("en-US")} XP
          </FitText>
          <FitText
            style={{
              color: themeColors.textMuted,
              display: "block",
              fontSize: 11,
            }}
          >
            {row.seasonPoints.toLocaleString("en-US")} season pts
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
  ];
  const rangeStart = meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const rangeEnd = Math.min(meta.total, meta.page * meta.limit);

  return (
    <FitSection
      heading="Season Leaderboard"
      action={<Trophy size={16} color={colors.brand} />}
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
        minHeight: 430,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto auto auto",
          gap: 0,
          minHeight: 0,
          overflow: "visible",
        }}
      >
        <div
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
            compact
            placeholder="Search member"
            value={search}
            onChangeText={onSearchChange}
          />
          <FitSearch
            compact
            placeholder="Muscle or EXP area"
            value={muscleFilter}
            onChangeText={onMuscleFilterChange}
          />
          <FitDropdown
            fullWidth
            value={selectedSeasonId}
            options={seasonOptions}
            onChange={onSeasonChange}
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
            style={{
              alignItems: "center",
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.textSecondary,
              display: "flex",
              gap: 10,
              minHeight: 38,
              padding: "0 14px",
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

        <div
          style={{
            minWidth: 0,
            minHeight: 0,
            overflow: "auto",
            padding: "10px 0 0",
          }}
          data-season-performance-table="true"
        >
          <FitTable
            columns={tableColumns}
            rows={rows}
            getRowKey={(row) => `${row.userId}-${row.seasonId}`}
            emptyMessage="No season standings match the current filters."
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
          [data-season-performance-table="true"] th,
          [data-season-performance-table="true"] td {
            padding: 9px 10px !important;
          }
        `}</style>
        <div
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
          <FitPagination
            currentPage={meta.page}
            totalPages={Math.max(1, meta.total_pages)}
            onPageChange={onPageChange}
            ariaLabel="Season standing pagination"
            showSinglePage
          />
        </div>
      </div>
    </FitSection>
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
                    onClick={() => onSelectedChange(review.id)}
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
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: 8,
      }}
    >
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.label}
            style={{
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              borderRadius: 8,
              padding: 8,
              display: "grid",
              gap: 4,
            }}
          >
            <Icon size={15} color={colors.brand} />
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              {metric.label}
            </FitText>
            <FitText style={{ fontSize: 19, fontWeight: 900 }}>
              {metric.value}
            </FitText>
          </div>
        );
      })}
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
