"use client";

import { useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
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
  UserCheck,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FitnessCreatorState,
  FitnessRankingGovernanceStatus,
} from "@fittrack/api-client";
import type {
  AdminGamificationCreatorProfileRecord,
  AdminGamificationOverviewRecord,
  AdminGamificationRankingProfileRecord,
  FitnessSeasonStatus,
} from "@fittrack/types";
import {
  adminGamificationOverviewQueryOptions,
  resolveAdminGamificationIntegrityCaseMutationOptions,
  updateAdminGamificationCreatorStateMutationOptions,
  updateAdminGamificationRankingOverrideMutationOptions,
  updateAdminGamificationSeasonStatusMutationOptions,
} from "@fittrack/query";

import { webApiClient } from "@/lib/api-client";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import {
  FitButton,
  FitPill,
  FitSection,
  FitSelect,
  FitText,
  FitTextArea,
} from "@/components/fit";

const CREATOR_STATE_OPTIONS: { label: string; value: FitnessCreatorState }[] = [
  { label: "Candidate", value: "candidate" },
  { label: "Pending review", value: "pending_review" },
  { label: "Approved", value: "approved" },
  { label: "Suspended", value: "suspended" },
  { label: "Revoked", value: "revoked" },
  { label: "None", value: "none" },
];

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
type CreatorStateDraftMap = Record<string, FitnessCreatorState>;
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
  const [seasonRationale, setSeasonRationale] = useState(
    "Admin lifecycle review completed.",
  );
  const [integrityNotes, setIntegrityNotes] = useState<DraftMap>({});
  const [rankingNotes, setRankingNotes] = useState<DraftMap>({});
  const [rankingStateDrafts, setRankingStateDrafts] =
    useState<RankingStateDraftMap>({});
  const [creatorNotes, setCreatorNotes] = useState<DraftMap>({});
  const [creatorStateDrafts, setCreatorStateDrafts] =
    useState<CreatorStateDraftMap>({});

  const overviewQuery = useQuery(
    adminGamificationOverviewQueryOptions(webApiClient),
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
  const creatorMutation = useMutation(
    updateAdminGamificationCreatorStateMutationOptions(
      webApiClient,
      queryClient,
    ),
  );

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
    seasonMutation.error ??
    integrityMutation.error ??
    rankingMutation.error ??
    creatorMutation.error;

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

    rankingMutation.mutate({
      userId: profile.userId,
      payload: {
        governanceStatus,
        rationale,
        adminNote: governanceStatus === "normal" ? null : rationale,
      },
    });
  };

  const updateCreator = (profile: AdminGamificationCreatorProfileRecord) => {
    const state = creatorStateDrafts[profile.userId] ?? profile.state;
    const rationale =
      creatorNotes[profile.userId]?.trim() ||
      "Admin creator-governance review completed.";

    creatorMutation.mutate({
      userId: profile.userId,
      payload: {
        state,
        rationale,
        adminNotes: rationale,
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
              Governance cockpit for seasons, rankings, creators, and XP trust.
            </FitText>
            <FitText as="p" style={{ ...muted, maxWidth: 760 }}>
              Batch 6 separates admin gamification from Exercise Lab. This page
              is the operator layer: spot unhealthy progression, resolve review
              queues, restore ranking participation, and keep creator privileges
              audit-safe.
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

        <MetricGrid overview={overview} />

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
                        seasonMutation.mutate({
                          seasonId: overview.activeSeason!.id,
                          payload: {
                            status,
                            rationale:
                              seasonRationale.trim() ||
                              "Admin lifecycle review completed.",
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

          <FitSection
            heading="Creator Governance"
            action={<UserCheck size={16} color={colors.brand} />}
            style={panelStyle}
            bare
          >
            <RecordList emptyCopy="No creator profiles need attention yet.">
              {overview?.creators.profiles.map((profile) => (
                <div key={profile.userId} style={subPanelStyle}>
                  <ProfileHeading
                    title={profile.memberName}
                    subtitle={`${profile.stateLabel} • ${profile.publishedSubmissionCount}/${profile.submissionCount} published`}
                  />
                  <FitSelect
                    fullWidth
                    value={creatorStateDrafts[profile.userId] ?? profile.state}
                    options={CREATOR_STATE_OPTIONS}
                    onChange={(event) =>
                      setCreatorStateDrafts((current) => ({
                        ...current,
                        [profile.userId]: event.target
                          .value as FitnessCreatorState,
                      }))
                    }
                    style={{ marginTop: 12 }}
                  />
                  <FitTextArea
                    value={
                      creatorNotes[profile.userId] ?? profile.adminNotes ?? ""
                    }
                    onChange={(event) =>
                      updateDraft(
                        setCreatorNotes,
                        profile.userId,
                        event.target.value,
                      )
                    }
                    rows={2}
                    placeholder="Creator governance note"
                    style={{ marginTop: 10 }}
                  />
                  <FitButton
                    fullWidth
                    variant="primary"
                    icon={UserCheck}
                    label="Save creator state"
                    loading={creatorMutation.isPending}
                    onClick={() => updateCreator(profile)}
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
      </div>
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
      label: "Creator candidates",
      value: overview?.creators.candidateCount ?? 0,
      icon: UserCheck,
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
