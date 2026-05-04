"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useSearchParams } from "next/navigation";
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
  resolveAdminGamificationIntegrityCaseMutationOptions,
  updateAdminGamificationRankingOverrideMutationOptions,
  updateAdminGamificationSeasonStatusMutationOptions,
} from "@fittrack/query";

import { webApiClient } from "@/lib/api-client";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import {
  FitButton,
  FitPagination,
  FitPill,
  FitSearch,
  FitSection,
  FitSelect,
  FitText,
  FitTextArea,
} from "@/components/fit";
import { ConfirmModal } from "@/components/modals";
import {
  ACHIEVEMENT_REVIEW_SEED,
  ACHIEVEMENT_REVIEW_STATUS_COLORS,
  type AchievementReviewRecord,
  type AchievementReviewStatus,
} from "@/data/progress/milestones";

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

export default function GamificationAdminDashboard() {
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
  >(ACHIEVEMENT_REVIEW_SEED);
  const [milestoneStatus, setMilestoneStatus] =
    useState<AchievementReviewStatus | "all">("Pending");
  const [milestoneSearch, setMilestoneSearch] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(
    ACHIEVEMENT_REVIEW_SEED[0]?.id ?? "",
  );
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
      limit: 8,
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
    seasonMutation.error ??
    integrityMutation.error ??
    rankingMutation.error;

  const panelStyle = {
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 22,
    padding: 18,
  };
  const subPanelStyle = {
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
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
      className={themeTransition}
      style={fadeIn}
    >
      <div style={{ display: "grid", gap: 22 }}>
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 28,
            padding: "24px clamp(18px, 3vw, 32px)",
            background: `radial-gradient(circle at top left, ${colors.brand}22, transparent 32%), ${colors.surface}`,
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: 18,
            alignItems: "stretch",
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <FitPill
              mode="status"
              label="Admin Gamification"
              color={colors.brand}
              style={{ width: "fit-content" }}
            />
            <FitText
              as="h1"
              style={{
                fontSize: "clamp(30px, 5vw, 56px)",
                lineHeight: 0.92,
                letterSpacing: "-0.06em",
                fontWeight: 900,
              }}
            >
              Governance cockpit for seasons, rankings, milestones, and XP trust.
            </FitText>
            <FitText as="p" style={{ ...muted, maxWidth: 760 }}>
              This operator layer keeps progression fair: spot unhealthy XP
              patterns, resolve integrity queues, restore ranking participation,
              and manage milestone review without duplicating Exercise Lab.
            </FitText>
          </div>
          <div
            style={{
              ...panelStyle,
              display: "grid",
              gap: 14,
              alignContent: "space-between",
            }}
          >
            <FitText style={{ ...muted, textTransform: "uppercase" }}>
              Latest sync
            </FitText>
            <FitText style={{ fontSize: 26, fontWeight: 800 }}>
              {overview ? formatDateTime(overview.generatedAt) : "Loading"}
            </FitText>
            <FitButton
              variant="ghost"
              icon={RefreshCcw}
              label="Refresh governance"
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
            gap: 10,
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
                  padding: "10px 16px",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "overview" ? (
          <>
            <MetricGrid overview={overview} />

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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 18,
          }}
        >
          <FitSection
            heading="Season Control"
            action={<Trophy size={16} color={colors.brand} />}
            style={panelStyle}
            bare
          >
            {overview?.activeSeason ? (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={subPanelStyle}>
                  <FitText style={{ fontSize: 22, fontWeight: 800 }}>
                    {overview.activeSeason.title}
                  </FitText>
                  <FitText style={muted}>
                    {labelize(overview.activeSeason.status)} season with{" "}
                    {overview.activeSeason.standingCount} standings,{" "}
                    {overview.activeSeason.hiddenCount} hidden, and{" "}
                    {overview.activeSeason.disqualifiedCount} disqualified.
                  </FitText>
                </div>
                <FitTextArea
                  value={seasonRationale}
                  onChange={(event) => setSeasonRationale(event.target.value)}
                  rows={3}
                  placeholder="Lifecycle rationale"
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {activeSeasonActions.map((status) => (
                    <FitButton
                      key={status}
                      variant={status === "archived" ? "ghost" : "primary"}
                      icon={status === "archived" ? Archive : CheckCircle2}
                      label={`Move to ${labelize(status)}`}
                      loading={seasonMutation.isPending}
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
              <EmptyState copy="No active season is currently eligible for lifecycle controls." />
            )}
          </FitSection>

          <FitSection
            heading="Integrity Review"
            action={<ShieldAlert size={16} color={colors.brand} />}
            style={panelStyle}
            bare
          >
            <RecordList emptyCopy="No open integrity cases. Clean board, bro.">
              {overview?.integrity.cases.map((integrityCase) => (
                <div key={integrityCase.caseId} style={subPanelStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <FitText style={{ fontWeight: 800 }}>
                        {integrityCase.memberName}
                      </FitText>
                      <FitText style={muted}>
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
                    value={integrityNotes[integrityCase.caseId] ?? ""}
                    onChange={(event) =>
                      updateDraft(
                        setIntegrityNotes,
                        integrityCase.caseId,
                        event.target.value,
                      )
                    }
                    rows={2}
                    placeholder="Resolution rationale"
                    style={{ marginTop: 12 }}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <FitButton
                      variant="ghost"
                      icon={ShieldCheck}
                      label="Resolve valid"
                      loading={integrityMutation.isPending}
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
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 18,
          }}
        >
          <FitSection
            heading="Ranking Governance"
            action={<Crown size={16} color={colors.brand} />}
            style={panelStyle}
            bare
          >
            <RecordList emptyCopy="No admin-governed ranking profiles yet.">
              {overview?.rankings.profiles.map((profile) => (
                <div key={profile.userId} style={subPanelStyle}>
                  <ProfileHeading
                    title={profile.memberName}
                    subtitle={`${labelize(profile.governanceStatus)} • ${labelize(
                      profile.visibility,
                    )}`}
                  />
                  <FitSelect
                    fullWidth
                    value={
                      rankingStateDrafts[profile.userId] ??
                      (profile.governanceStatus === "disqualified"
                        ? "normal"
                        : "hidden_by_admin")
                    }
                    options={RANKING_GOVERNANCE_OPTIONS}
                    onChange={(event) =>
                      setRankingStateDrafts((current) => ({
                        ...current,
                        [profile.userId]: event.target
                          .value as RankingStateDraftMap[string],
                      }))
                    }
                    style={{ marginTop: 12 }}
                  />
                  <FitTextArea
                    value={rankingNotes[profile.userId] ?? ""}
                    onChange={(event) =>
                      updateDraft(
                        setRankingNotes,
                        profile.userId,
                        event.target.value,
                      )
                    }
                    rows={2}
                    placeholder="Ranking governance rationale"
                    style={{ marginTop: 10 }}
                  />
                  <FitButton
                    fullWidth
                    variant="primary"
                    icon={ShieldCheck}
                    label="Apply ranking decision"
                    loading={rankingMutation.isPending}
                    onClick={() => updateRanking(profile)}
                    style={{ marginTop: 12 }}
                  />
                </div>
              ))}
            </RecordList>
          </FitSection>

        </div>

        <FitSection
          heading="Audit And Corrections"
          action={<Activity size={16} color={colors.brand} />}
          style={panelStyle}
          bare
        >
          <RecordList emptyCopy="No moderation actions have been recorded yet.">
            {overview?.audit.recentActions.map((action) => (
              <div
                key={action.id}
                style={{
                  ...subPanelStyle,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div>
                  <FitText style={{ fontWeight: 800 }}>
                    {labelize(action.actionType)}
                  </FitText>
                  <FitText style={muted}>
                    {action.targetName} • {formatDateTime(action.createdAt)}
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
          </>
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
    limit: 8,
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

  return (
    <FitSection
      heading="Season Performance"
      action={<Trophy size={16} color={colors.brand} />}
      bare
      style={{
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surfaceRaised,
        borderRadius: 22,
        padding: 18,
      }}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
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
          <FitSelect
            fullWidth
            value={selectedSeasonId}
            options={seasonOptions}
            onChange={(event) => onSeasonChange(event.target.value)}
          />
          <FitSelect
            fullWidth
            value={selectedVisibility}
            options={SEASON_VISIBILITY_OPTIONS}
            onChange={(event) =>
              onVisibilityChange(event.target.value as FitnessRankingVisibility | "")
            }
          />
          <FitSelect
            fullWidth
            value={selectedGovernance}
            options={SEASON_GOVERNANCE_OPTIONS}
            onChange={(event) =>
              onGovernanceChange(
                event.target.value as FitnessRankingGovernanceStatus | "",
              )
            }
          />
          <label
            style={{
              alignItems: "center",
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              color: colors.textSecondary,
              display: "flex",
              gap: 10,
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

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "separate",
              borderSpacing: 0,
              minWidth: 920,
              width: "100%",
            }}
          >
            <thead>
              <tr>
                {[
                  "Rank",
                  "Participant",
                  "Season",
                  "EXP",
                  "Top Muscle",
                  "Milestones",
                  "Governance",
                  "Last Earned",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      borderBottom: `1px solid ${colors.border}`,
                      color: colors.textMuted,
                      fontSize: 11,
                      padding: "10px 12px",
                      textAlign: "left",
                      textTransform: "uppercase",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={`${row.userId}-${row.seasonId}`}>
                    <td style={{ padding: "12px" }}>
                      <FitText style={{ fontWeight: 900 }}>
                        {row.rankPosition ? `#${row.rankPosition}` : "--"}
                      </FitText>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <FitText style={{ fontWeight: 800 }}>
                        {row.displayAlias ?? row.memberName}
                      </FitText>
                      <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                        {row.memberName}
                      </FitText>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <FitText style={{ fontWeight: 700 }}>
                        {row.seasonTitle}
                      </FitText>
                      <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                        {labelize(row.seasonStatus)}
                      </FitText>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <FitText style={{ fontWeight: 800 }}>
                        {row.totalXp.toLocaleString("en-US")} XP
                      </FitText>
                      <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                        {row.seasonPoints.toLocaleString("en-US")} season pts
                      </FitText>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <FitText style={{ fontWeight: 800 }}>
                        {row.topMuscle ?? "No muscle yet"}
                      </FitText>
                      <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                        {row.topMuscleXp.toLocaleString("en-US")} XP
                      </FitText>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <FitText style={{ fontWeight: 800 }}>
                        {row.milestoneClaimedCount}/
                        {row.milestoneUnlockedCount}
                      </FitText>
                      <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                        claimed/unlocked
                      </FitText>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <FitPill
                          mode="status"
                          label={labelize(row.visibility)}
                          color={row.visibility === "private" ? colors.warning : colors.brand}
                        />
                        <FitPill
                          mode="status"
                          label={labelize(row.governanceStatus)}
                          color={
                            row.isDisqualified
                              ? colors.danger
                              : row.isHidden
                                ? colors.warning
                                : colors.success
                          }
                        />
                      </div>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <FitText style={{ color: colors.textSecondary, fontSize: 13 }}>
                        {formatDateTime(row.lastEarnedAt)}
                      </FitText>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: 18 }}>
                    <EmptyState copy="No season standings match the current filters." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <FitPagination
          currentPage={meta.page}
          totalPages={Math.max(1, meta.total_pages)}
          onPageChange={onPageChange}
          ariaLabel="Season standing pagination"
        />
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
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: 14,
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
              borderRadius: 20,
              padding: 18,
              display: "grid",
              gap: 10,
            }}
          >
            <Icon size={18} color={colors.brand} />
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
              {metric.label}
            </FitText>
            <FitText style={{ fontSize: 28, fontWeight: 900 }}>
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

  return <div style={{ display: "grid", gap: 12 }}>{entries}</div>;
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
      <FitText style={{ fontWeight: 800 }}>{title}</FitText>
      <FitText style={{ color: colors.textMuted, fontSize: 13, marginTop: 3 }}>
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
        borderRadius: 18,
        padding: 18,
      }}
    >
      <FitText style={{ color: colors.textMuted, fontSize: 13 }}>
        {copy}
      </FitText>
    </div>
  );
}
