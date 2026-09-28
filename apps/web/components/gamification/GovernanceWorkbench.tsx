"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleDot,
  Crown,
  EyeOff,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type {
  AdminGamificationIntegrityCaseRecord,
  AdminGamificationOverviewRecord,
  AdminGamificationRankingProfileRecord,
  FitnessRankingGovernanceStatus,
} from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import {
  FitButton,
  FitDropdown,
  FitPill,
  FitSearch,
  FitText,
  FitTextArea,
} from "@/components/fit";
import { FitModal } from "@/components/modals";

import styles from "./GovernanceWorkbench.module.css";

export type GovernanceView = "integrity" | "rankings" | "audit";
type IntegrityResolutionStatus = "resolved_valid" | "resolved_invalid";
type RankingDraft = Extract<
  FitnessRankingGovernanceStatus,
  "normal" | "hidden_by_admin" | "disqualified"
>;

export interface GovernanceWorkbenchProps {
  activeView: GovernanceView;
  formatDateTime: (value?: string | null) => string;
  integrityPending: boolean;
  labelize: (value: string) => string;
  onActiveViewChange: (view: GovernanceView) => void;
  onApplyRanking: (profile: AdminGamificationRankingProfileRecord) => void;
  onRankingDraftChange: (userId: string, value: RankingDraft) => void;
  onRankingNoteChange: (userId: string, value: string) => void;
  onResolveIntegrity: (
    caseId: string,
    status: IntegrityResolutionStatus,
    rationale: string,
  ) => void;
  overview: AdminGamificationOverviewRecord | undefined;
  rankingDrafts: Record<string, RankingDraft | undefined>;
  rankingNotes: Record<string, string | undefined>;
  rankingPending: boolean;
}

interface ResolveIntegrityModalProps {
  integrityCase: AdminGamificationIntegrityCaseRecord | null;
  isLoading: boolean;
  onClose: () => void;
  onResolve: (
    caseId: string,
    status: IntegrityResolutionStatus,
    rationale: string,
  ) => void;
  preferredStatus: IntegrityResolutionStatus;
}

const rankingOptions: Array<{ label: string; value: RankingDraft }> = [
  { label: "Restore normal", value: "normal" },
  { label: "Hide from rankings", value: "hidden_by_admin" },
  { label: "Disqualify season", value: "disqualified" },
];

function formatRelativeTime(value: string) {
  const difference = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(difference / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function GovernanceWorkbench({
  activeView,
  formatDateTime,
  integrityPending,
  labelize,
  onActiveViewChange,
  onApplyRanking,
  onRankingDraftChange,
  onRankingNoteChange,
  onResolveIntegrity,
  overview,
  rankingDrafts,
  rankingNotes,
  rankingPending,
}: GovernanceWorkbenchProps) {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedIntegrityId, setSelectedIntegrityId] = useState("");
  const [selectedRankingId, setSelectedRankingId] = useState("");
  const [selectedAuditId, setSelectedAuditId] = useState("");
  const [resolveTarget, setResolveTarget] =
    useState<AdminGamificationIntegrityCaseRecord | null>(null);
  const [preferredResolution, setPreferredResolution] =
    useState<IntegrityResolutionStatus>("resolved_valid");

  const integrityCases = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (overview?.integrity.cases ?? []).filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.memberName.toLowerCase().includes(normalizedSearch) ||
        item.caseId.toLowerCase().includes(normalizedSearch) ||
        item.summary?.toLowerCase().includes(normalizedSearch);
      return (
        matchesSearch && (filter === "all" || item.riskLevel === filter)
      );
    });
  }, [filter, overview?.integrity.cases, search]);

  const rankingProfiles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (overview?.rankings.profiles ?? []).filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.memberName.toLowerCase().includes(normalizedSearch) ||
        item.userId.toLowerCase().includes(normalizedSearch);
      return (
        matchesSearch &&
        (filter === "all" || item.governanceStatus === filter)
      );
    });
  }, [filter, overview?.rankings.profiles, search]);

  const auditActions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (overview?.audit.recentActions ?? []).filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.targetName.toLowerCase().includes(normalizedSearch) ||
        item.actionType.toLowerCase().includes(normalizedSearch) ||
        item.rationale?.toLowerCase().includes(normalizedSearch);
      const kind = item.progressionGrantId
        ? "exp"
        : item.integrityCaseId
          ? "integrity"
          : item.seasonId
            ? "season"
            : "profile";
      return matchesSearch && (filter === "all" || kind === filter);
    });
  }, [filter, overview?.audit.recentActions, search]);

  useEffect(() => {
    if (
      !selectedIntegrityId ||
      !integrityCases.some((item) => item.caseId === selectedIntegrityId)
    ) {
      setSelectedIntegrityId(integrityCases[0]?.caseId ?? "");
    }
  }, [integrityCases, selectedIntegrityId]);

  useEffect(() => {
    if (
      !selectedRankingId ||
      !rankingProfiles.some((item) => item.userId === selectedRankingId)
    ) {
      setSelectedRankingId(rankingProfiles[0]?.userId ?? "");
    }
  }, [rankingProfiles, selectedRankingId]);

  useEffect(() => {
    if (
      !selectedAuditId ||
      !auditActions.some((item) => item.id === selectedAuditId)
    ) {
      setSelectedAuditId(auditActions[0]?.id ?? "");
    }
  }, [auditActions, selectedAuditId]);

  const selectedIntegrity =
    integrityCases.find((item) => item.caseId === selectedIntegrityId) ?? null;
  const selectedRanking =
    rankingProfiles.find((item) => item.userId === selectedRankingId) ?? null;
  const selectedAudit =
    auditActions.find((item) => item.id === selectedAuditId) ?? null;

  const tabs = [
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
  ];

  const filterOptions =
    activeView === "integrity"
      ? [
          { label: "All severity", value: "all" },
          { label: "High", value: "high" },
          { label: "Medium", value: "medium" },
          { label: "Low", value: "low" },
        ]
      : activeView === "rankings"
        ? [
            { label: "All governance", value: "all" },
            { label: "Normal", value: "normal" },
            { label: "Hidden", value: "hidden_by_admin" },
            { label: "Disqualified", value: "disqualified" },
          ]
        : [
            { label: "All actions", value: "all" },
            { label: "Integrity", value: "integrity" },
            { label: "EXP grant", value: "exp" },
            { label: "Season", value: "season" },
            { label: "Profile", value: "profile" },
          ];

  const switchView = (view: GovernanceView) => {
    setSearch("");
    setFilter("all");
    onActiveViewChange(view);
  };

  const openResolution = (
    integrityCase: AdminGamificationIntegrityCaseRecord,
    status: IntegrityResolutionStatus,
  ) => {
    setPreferredResolution(status);
    setResolveTarget(integrityCase);
  };

  return (
    <>
      <div className={styles.workbench} data-ui="gamification-governance-workbench">
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Gamification governance views"
          style={{ borderColor: colors.border }}
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            const selected = item.id === activeView;
            return (
              <button
                className={styles.tab}
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => switchView(item.id)}
                style={{
                  backgroundColor: selected
                    ? `${colors.brand}10`
                    : "transparent",
                  borderBottomColor: selected
                    ? colors.brand
                    : "transparent",
                  color: selected ? colors.textPrimary : colors.textMuted,
                }}
              >
                <Icon size={14} />
                <span style={{ fontSize: 12, fontWeight: 800 }}>
                  {item.label}
                </span>
                <span
                  className={styles.tabCount}
                  style={{
                    borderColor: selected ? `${colors.brand}66` : colors.border,
                    color: selected ? colors.brand : colors.textMuted,
                  }}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className={styles.body}
          style={{ backgroundColor: colors.surface }}
        >
          <div className={styles.master} style={{ borderColor: colors.border }}>
            <div
              className={styles.toolbar}
              style={{ borderColor: colors.border }}
            >
              <FitSearch
                ariaLabel={`Search ${activeView}`}
                placeholder={
                  activeView === "integrity"
                    ? "Search case or member"
                    : activeView === "rankings"
                      ? "Search governed member"
                      : "Search audit activity"
                }
                value={search}
                onChangeText={setSearch}
              />
              <FitDropdown
                fullWidth
                value={filter}
                options={filterOptions}
                onChange={setFilter}
              />
            </div>

            {activeView === "integrity" ? (
              <IntegrityMasterList
                cases={integrityCases}
                colors={colors}
                onSelect={setSelectedIntegrityId}
                selectedId={selectedIntegrityId}
              />
            ) : activeView === "rankings" ? (
              <RankingMasterList
                colors={colors}
                onSelect={setSelectedRankingId}
                profiles={rankingProfiles}
                selectedId={selectedRankingId}
              />
            ) : (
              <AuditMasterList
                actions={auditActions}
                colors={colors}
                formatDateTime={formatDateTime}
                labelize={labelize}
                onSelect={setSelectedAuditId}
                selectedId={selectedAuditId}
              />
            )}
          </div>

          {activeView === "integrity" ? (
            <IntegrityInspector
              colors={colors}
              integrityCase={selectedIntegrity}
              onResolve={openResolution}
            />
          ) : activeView === "rankings" ? (
            <RankingInspector
              colors={colors}
              labelize={labelize}
              note={selectedRanking ? rankingNotes[selectedRanking.userId] ?? "" : ""}
              onApply={onApplyRanking}
              onDraftChange={onRankingDraftChange}
              onNoteChange={onRankingNoteChange}
              pending={rankingPending}
              profile={selectedRanking}
              selectedDraft={
                selectedRanking
                  ? rankingDrafts[selectedRanking.userId]
                  : undefined
              }
            />
          ) : (
            <AuditInspector
              action={selectedAudit}
              colors={colors}
              formatDateTime={formatDateTime}
              labelize={labelize}
            />
          )}
        </div>
      </div>

      <ResolveIntegrityModal
        integrityCase={resolveTarget}
        isLoading={integrityPending}
        preferredStatus={preferredResolution}
        onClose={() => setResolveTarget(null)}
        onResolve={(caseId, status, rationale) => {
          onResolveIntegrity(caseId, status, rationale);
          setResolveTarget(null);
        }}
      />
    </>
  );
}

interface ThemeColors {
  brand: string;
  border: string;
  danger: string;
  fieldBg: string;
  success: string;
  surface: string;
  surfaceRaised: string;
  textMuted: string;
  textPrimary: string;
  textSecondary: string;
}

interface IntegrityMasterListProps {
  cases: AdminGamificationIntegrityCaseRecord[];
  colors: ThemeColors;
  onSelect: (caseId: string) => void;
  selectedId: string;
}

function IntegrityMasterList({
  cases,
  colors,
  onSelect,
  selectedId,
}: IntegrityMasterListProps) {
  return (
    <div>
      <div
        className={styles.listHeader}
        style={{ borderColor: colors.border, color: colors.textMuted }}
      >
        <span>Member</span>
        <span>Issue</span>
        <span>Severity</span>
        <span>Detected</span>
      </div>
      <div className={styles.list} data-ui="gamification-integrity-case-list">
        {cases.length === 0 ? (
          <WorkbenchEmpty
            colors={colors}
            title="No integrity cases"
            copy="No cases match the current search and severity filter."
          />
        ) : (
          cases.map((item) => {
            const selected = item.caseId === selectedId;
            return (
              <button
                className={styles.row}
                key={item.caseId}
                type="button"
                onClick={() => onSelect(item.caseId)}
                style={{
                  backgroundColor: selected
                    ? colors.surfaceRaised
                    : "transparent",
                  borderBottomColor: colors.border,
                  borderLeftColor: selected ? colors.brand : "transparent",
                  color: colors.textPrimary,
                }}
              >
                <span>
                  <span className={styles.rowPrimary}>{item.memberName}</span>
                  <span
                    className={styles.rowSecondary}
                    style={{ color: colors.textMuted }}
                  >
                    {item.caseId}
                  </span>
                </span>
                <span>
                  <span className={styles.rowPrimary}>Progression anomaly</span>
                  <span
                    className={styles.rowSecondary}
                    style={{ color: colors.textMuted }}
                  >
                    {item.evidenceEventCount} evidence events
                  </span>
                </span>
                <FitPill
                  mode="status"
                  label={item.riskLevel.toUpperCase()}
                  color={
                    item.riskLevel === "high" ? colors.danger : colors.brand
                  }
                />
                <span
                  className={styles.rowSecondary}
                  style={{ color: colors.textMuted }}
                >
                  {formatRelativeTime(item.openedAt)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

interface RankingMasterListProps {
  colors: ThemeColors;
  onSelect: (userId: string) => void;
  profiles: AdminGamificationRankingProfileRecord[];
  selectedId: string;
}

function RankingMasterList({
  colors,
  onSelect,
  profiles,
  selectedId,
}: RankingMasterListProps) {
  return (
    <div>
      <div
        className={styles.listHeader}
        style={{ borderColor: colors.border, color: colors.textMuted }}
      >
        <span>Member</span>
        <span>Governance</span>
        <span>Visibility</span>
        <span>Updated</span>
      </div>
      <div className={styles.list}>
        {profiles.length === 0 ? (
          <WorkbenchEmpty
            colors={colors}
            title="No governed rankings"
            copy="No profiles match the current search and governance filter."
          />
        ) : (
          profiles.map((item) => {
            const selected = item.userId === selectedId;
            return (
              <button
                className={styles.row}
                key={item.userId}
                type="button"
                onClick={() => onSelect(item.userId)}
                style={{
                  backgroundColor: selected
                    ? colors.surfaceRaised
                    : "transparent",
                  borderBottomColor: colors.border,
                  borderLeftColor: selected ? colors.brand : "transparent",
                  color: colors.textPrimary,
                }}
              >
                <span>
                  <span className={styles.rowPrimary}>{item.memberName}</span>
                  <span
                    className={styles.rowSecondary}
                    style={{ color: colors.textMuted }}
                  >
                    {item.displayAlias || item.userId}
                  </span>
                </span>
                <span className={styles.rowPrimary}>
                  {item.governanceStatus.replaceAll("_", " ")}
                </span>
                <FitPill
                  mode="status"
                  label={item.visibility}
                  color={colors.brand}
                />
                <span
                  className={styles.rowSecondary}
                  style={{ color: colors.textMuted }}
                >
                  {formatRelativeTime(item.updatedAt)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

interface AuditMasterListProps {
  actions: AdminGamificationOverviewRecord["audit"]["recentActions"];
  colors: ThemeColors;
  formatDateTime: (value?: string | null) => string;
  labelize: (value: string) => string;
  onSelect: (id: string) => void;
  selectedId: string;
}

function AuditMasterList({
  actions,
  colors,
  formatDateTime,
  labelize,
  onSelect,
  selectedId,
}: AuditMasterListProps) {
  return (
    <div>
      <div
        className={styles.listHeader}
        style={{ borderColor: colors.border, color: colors.textMuted }}
      >
        <span>Target</span>
        <span>Action</span>
        <span>Type</span>
        <span>Created</span>
      </div>
      <div className={styles.list}>
        {actions.length === 0 ? (
          <WorkbenchEmpty
            colors={colors}
            title="No audit activity"
            copy="No actions match the current search and type filter."
          />
        ) : (
          actions.map((item) => {
            const selected = item.id === selectedId;
            const kind = item.progressionGrantId
              ? "EXP"
              : item.integrityCaseId
                ? "Integrity"
                : item.seasonId
                  ? "Season"
                  : "Profile";
            return (
              <button
                className={styles.row}
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                style={{
                  backgroundColor: selected
                    ? colors.surfaceRaised
                    : "transparent",
                  borderBottomColor: colors.border,
                  borderLeftColor: selected ? colors.brand : "transparent",
                  color: colors.textPrimary,
                }}
              >
                <span>
                  <span className={styles.rowPrimary}>{item.targetName}</span>
                  <span
                    className={styles.rowSecondary}
                    style={{ color: colors.textMuted }}
                  >
                    {item.targetUserId}
                  </span>
                </span>
                <span className={styles.rowPrimary}>
                  {labelize(item.actionType)}
                </span>
                <FitPill mode="status" label={kind} color={colors.brand} />
                <span
                  className={styles.rowSecondary}
                  style={{ color: colors.textMuted }}
                  title={formatDateTime(item.createdAt)}
                >
                  {formatRelativeTime(item.createdAt)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

interface IntegrityInspectorProps {
  colors: ThemeColors;
  integrityCase: AdminGamificationIntegrityCaseRecord | null;
  onResolve: (
    integrityCase: AdminGamificationIntegrityCaseRecord,
    status: IntegrityResolutionStatus,
  ) => void;
}

function IntegrityInspector({
  colors,
  integrityCase,
  onResolve,
}: IntegrityInspectorProps) {
  if (!integrityCase) {
    return (
      <WorkbenchEmpty
        colors={colors}
        title="Select an integrity case"
        copy="Choose a case from the queue to inspect its evidence and resolution options."
      />
    );
  }

  return (
    <aside className={styles.inspector} data-ui="gamification-integrity-inspector">
      <div
        className={styles.inspectorHeader}
        style={{ borderColor: colors.border }}
      >
        <FitText
          style={{ color: colors.textMuted, fontSize: 10, fontWeight: 800 }}
        >
          {integrityCase.caseId}
        </FitText>
        <FitText as="h3" style={{ fontSize: 17, fontWeight: 850 }}>
          Progression anomaly investigation
        </FitText>
      </div>
      <div className={styles.inspectorBody}>
        <div className={styles.detailGrid} style={{ borderColor: colors.border }}>
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Member"
            value={integrityCase.memberName}
          />
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Risk"
            value={integrityCase.riskLevel.toUpperCase()}
          />
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Detected"
            value={formatRelativeTime(integrityCase.openedAt)}
          />
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Evidence"
            value={`${integrityCase.evidenceEventCount} events`}
          />
        </div>
        <div
          style={{
            backgroundColor: colors.fieldBg,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            display: "grid",
            gap: 6,
            padding: 12,
          }}
        >
          <FitText
            style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 800 }}
          >
            Flagged issue
          </FitText>
          <FitText style={{ fontSize: 13, lineHeight: 1.5 }}>
            {integrityCase.summary ?? "No case summary was provided."}
          </FitText>
        </div>
      </div>
      <div
        className={styles.inspectorFooter}
        style={{ borderColor: colors.border }}
      >
        <FitButton
          variant="ghost"
          icon={ShieldCheck}
          label="Resolve valid"
          onClick={() => onResolve(integrityCase, "resolved_valid")}
          style={{ minHeight: 34, minWidth: 112 }}
          textStyle={{ fontSize: 11, fontWeight: 800 }}
        />
        <FitButton
          variant="danger"
          icon={EyeOff}
          label="Resolve invalid"
          onClick={() => onResolve(integrityCase, "resolved_invalid")}
          style={{ minHeight: 34, minWidth: 122 }}
          textStyle={{ fontSize: 11, fontWeight: 800 }}
        />
      </div>
    </aside>
  );
}

interface RankingInspectorProps {
  colors: ThemeColors;
  labelize: (value: string) => string;
  note: string;
  onApply: (profile: AdminGamificationRankingProfileRecord) => void;
  onDraftChange: (userId: string, value: RankingDraft) => void;
  onNoteChange: (userId: string, value: string) => void;
  pending: boolean;
  profile: AdminGamificationRankingProfileRecord | null;
  selectedDraft: RankingDraft | undefined;
}

function RankingInspector({
  colors,
  labelize,
  note,
  onApply,
  onDraftChange,
  onNoteChange,
  pending,
  profile,
  selectedDraft,
}: RankingInspectorProps) {
  if (!profile) {
    return (
      <WorkbenchEmpty
        colors={colors}
        title="Select a ranking profile"
        copy="Choose a governed profile to inspect its visibility and update its ranking status."
      />
    );
  }
  const draft =
    selectedDraft ??
    (profile.governanceStatus === "disqualified"
      ? "normal"
      : "hidden_by_admin");

  return (
    <aside className={styles.inspector}>
      <div
        className={styles.inspectorHeader}
        style={{ borderColor: colors.border }}
      >
        <FitText
          style={{ color: colors.textMuted, fontSize: 10, fontWeight: 800 }}
        >
          RANKING GOVERNANCE
        </FitText>
        <FitText as="h3" style={{ fontSize: 17, fontWeight: 850 }}>
          {profile.memberName}
        </FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
          {labelize(profile.governanceStatus)} · {labelize(profile.visibility)}
        </FitText>
      </div>
      <div className={styles.inspectorBody}>
        <div className={styles.detailGrid} style={{ borderColor: colors.border }}>
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Current status"
            value={labelize(profile.governanceStatus)}
          />
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Visibility"
            value={labelize(profile.visibility)}
          />
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Season hidden"
            value={profile.seasonIsHidden ? "Yes" : "No"}
          />
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Disqualified"
            value={profile.seasonIsDisqualified ? "Yes" : "No"}
          />
        </div>
        <FitDropdown
          fullWidth
          value={draft}
          options={rankingOptions}
          onChange={(value) => onDraftChange(profile.userId, value as RankingDraft)}
        />
        <FitTextArea
          aria-label="Admin note for this ranking governance decision"
          id={`gamification-ranking-governance-note-${profile.userId}`}
          rows={3}
          value={note}
          onChange={(event) => onNoteChange(profile.userId, event.target.value)}
          placeholder="Explain this ranking-governance decision."
          style={{ minHeight: 78 }}
        />
      </div>
      <div
        className={styles.inspectorFooter}
        style={{ borderColor: colors.border }}
      >
        <FitButton
          variant="primary"
          icon={ShieldCheck}
          label="Apply decision"
          loading={pending}
          onClick={() => onApply(profile)}
          style={{ minHeight: 34, minWidth: 126 }}
          textStyle={{ fontSize: 11, fontWeight: 800 }}
        />
      </div>
    </aside>
  );
}

interface AuditInspectorProps {
  action: AdminGamificationOverviewRecord["audit"]["recentActions"][number] | null;
  colors: ThemeColors;
  formatDateTime: (value?: string | null) => string;
  labelize: (value: string) => string;
}

function AuditInspector({
  action,
  colors,
  formatDateTime,
  labelize,
}: AuditInspectorProps) {
  if (!action) {
    return (
      <WorkbenchEmpty
        colors={colors}
        title="Select an audit action"
        copy="Choose an action to review its target, timestamp, and recorded rationale."
      />
    );
  }

  return (
    <aside className={styles.inspector}>
      <div
        className={styles.inspectorHeader}
        style={{ borderColor: colors.border }}
      >
        <FitText
          style={{ color: colors.textMuted, fontSize: 10, fontWeight: 800 }}
        >
          IMMUTABLE AUDIT RECORD
        </FitText>
        <FitText as="h3" style={{ fontSize: 17, fontWeight: 850 }}>
          {labelize(action.actionType)}
        </FitText>
      </div>
      <div className={styles.inspectorBody}>
        <div className={styles.detailGrid} style={{ borderColor: colors.border }}>
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Target"
            value={action.targetName}
          />
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Created"
            value={formatDateTime(action.createdAt)}
          />
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Target ID"
            value={action.targetUserId}
          />
          <DetailCell
            borderColor={colors.border}
            colors={colors}
            label="Reference"
            value={
              action.progressionGrantId ??
              action.integrityCaseId ??
              action.seasonId ??
              "Profile action"
            }
          />
        </div>
        <div
          style={{
            backgroundColor: colors.fieldBg,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            display: "grid",
            gap: 6,
            padding: 12,
          }}
        >
          <FitText
            style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 800 }}
          >
            Recorded rationale
          </FitText>
          <FitText style={{ fontSize: 13, lineHeight: 1.5 }}>
            {action.rationale ?? "No rationale was recorded for this action."}
          </FitText>
        </div>
      </div>
      <div
        className={styles.inspectorFooter}
        style={{ borderColor: colors.border, justifyContent: "flex-start" }}
      >
        <FitPill
          mode="status"
          label="Read only"
          color={colors.textSecondary}
        />
      </div>
    </aside>
  );
}

interface DetailCellProps {
  borderColor: string;
  colors: ThemeColors;
  label: string;
  value: string;
}

function DetailCell({
  borderColor,
  colors,
  label,
  value,
}: DetailCellProps) {
  return (
    <div className={styles.detailCell} style={{ borderColor }}>
      <span className={styles.detailLabel} style={{ color: colors.textMuted }}>
        {label}
      </span>
      <span className={styles.detailValue} style={{ color: colors.textPrimary }}>
        {value}
      </span>
    </div>
  );
}

interface WorkbenchEmptyProps {
  colors: ThemeColors;
  copy: string;
  title: string;
}

function WorkbenchEmpty({ colors, copy, title }: WorkbenchEmptyProps) {
  return (
    <div className={styles.empty}>
      <Search size={22} color={colors.textMuted} />
      <FitText style={{ fontSize: 14, fontWeight: 800, marginTop: 10 }}>
        {title}
      </FitText>
      <FitText
        style={{
          color: colors.textMuted,
          fontSize: 12,
          lineHeight: 1.5,
          marginTop: 4,
          maxWidth: 320,
        }}
      >
        {copy}
      </FitText>
    </div>
  );
}

function ResolveIntegrityModal({
  integrityCase,
  isLoading,
  onClose,
  onResolve,
  preferredStatus,
}: ResolveIntegrityModalProps) {
  const { colors } = useTheme();
  const [rationale, setRationale] = useState("");
  const [resolution, setResolution] =
    useState<IntegrityResolutionStatus>(preferredStatus);

  useEffect(() => {
    if (!integrityCase) return;
    setRationale("");
    setResolution(preferredStatus);
  }, [integrityCase, preferredStatus]);

  const canSubmit = Boolean(integrityCase && rationale.trim().length >= 8);

  return (
    <FitModal
      isOpen={integrityCase !== null}
      onClose={onClose}
      title="Resolve integrity case"
      subtitle={
        integrityCase
          ? `${integrityCase.memberName} · ${integrityCase.riskLevel.toUpperCase()} risk`
          : "Review flagged progression"
      }
      icon={ShieldAlert}
      maxWidth={620}
      closeAriaLabel="Close integrity resolution"
      containerStyle={{ maxHeight: "calc(100dvh - 64px)", borderRadius: 8 }}
      contentStyle={{ maxHeight: "calc(100dvh - 236px)", padding: 18 }}
      footer={
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "flex-end",
            width: "100%",
          }}
        >
          <FitButton
            variant="ghost"
            label="Cancel"
            disabled={isLoading}
            onClick={onClose}
            style={{ minHeight: 36, minWidth: 88 }}
            textStyle={{ fontSize: 12 }}
          />
          <FitButton
            variant={resolution === "resolved_invalid" ? "danger" : "primary"}
            icon={
              resolution === "resolved_invalid" ? EyeOff : CheckCircle2
            }
            label={
              resolution === "resolved_invalid"
                ? "Resolve invalid"
                : "Resolve valid"
            }
            disabled={!canSubmit}
            loading={isLoading}
            onClick={() => {
              if (!integrityCase || !canSubmit) return;
              onResolve(integrityCase.caseId, resolution, rationale.trim());
            }}
            style={{ minHeight: 36, minWidth: 124 }}
            textStyle={{ fontSize: 12, fontWeight: 800 }}
          />
        </div>
      }
    >
      {integrityCase ? (
        <div className={styles.modalBody}>
          <div
            className={styles.modalSummary}
            style={{ borderColor: colors.border }}
          >
            <FitText
              style={{ color: colors.textMuted, fontSize: 10, fontWeight: 800 }}
            >
              FLAGGED ISSUE
            </FitText>
            <FitText style={{ fontSize: 13, lineHeight: 1.5 }}>
              {integrityCase.summary ?? "No case summary was provided."}
            </FitText>
          </div>
          <div
            className={styles.modalEvidence}
            style={{ borderColor: colors.border }}
          >
            <div style={{ borderColor: colors.border }}>
              <FitText style={{ color: colors.textMuted, fontSize: 10 }}>
                Evidence events
              </FitText>
              <FitText style={{ fontSize: 16, fontWeight: 850 }}>
                {integrityCase.evidenceEventCount}
              </FitText>
            </div>
            <div style={{ borderColor: colors.border }}>
              <FitText style={{ color: colors.textMuted, fontSize: 10 }}>
                Case opened
              </FitText>
              <FitText style={{ fontSize: 13, fontWeight: 800 }}>
                {formatRelativeTime(integrityCase.openedAt)}
              </FitText>
            </div>
          </div>
          <div
            role="group"
            aria-label="Resolution decision"
            style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}
          >
            <button
              type="button"
              onClick={() => setResolution("resolved_valid")}
              style={{
                alignItems: "center",
                backgroundColor:
                  resolution === "resolved_valid"
                    ? `${colors.success}18`
                    : colors.fieldBg,
                border: `1px solid ${
                  resolution === "resolved_valid"
                    ? colors.success
                    : colors.border
                }`,
                borderRadius: 6,
                color: colors.textPrimary,
                cursor: "pointer",
                display: "flex",
                fontSize: 12,
                fontWeight: 800,
                gap: 7,
                justifyContent: "center",
                minHeight: 38,
              }}
            >
              <ShieldCheck size={14} />
              Valid
            </button>
            <button
              type="button"
              onClick={() => setResolution("resolved_invalid")}
              style={{
                alignItems: "center",
                backgroundColor:
                  resolution === "resolved_invalid"
                    ? `${colors.danger}18`
                    : colors.fieldBg,
                border: `1px solid ${
                  resolution === "resolved_invalid"
                    ? colors.danger
                    : colors.border
                }`,
                borderRadius: 6,
                color: colors.textPrimary,
                cursor: "pointer",
                display: "flex",
                fontSize: 12,
                fontWeight: 800,
                gap: 7,
                justifyContent: "center",
                minHeight: 38,
              }}
            >
              <EyeOff size={14} />
              Invalid
            </button>
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <FitText
              style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 800 }}
            >
              Reviewer rationale
            </FitText>
            <FitTextArea
              aria-label="Reviewer rationale for integrity resolution"
              id="gamification-integrity-resolution-rationale"
              rows={4}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder="Explain why this progression is valid or invalid."
              style={{ minHeight: 94 }}
            />
            <FitText style={{ color: colors.textMuted, fontSize: 10 }}>
              At least 8 characters are required for the audit record.
            </FitText>
          </label>
          {resolution === "resolved_invalid" ? (
            <div
              style={{
                alignItems: "flex-start",
                backgroundColor: `${colors.danger}10`,
                border: `1px solid ${colors.danger}55`,
                borderRadius: 6,
                display: "flex",
                gap: 8,
                padding: 10,
              }}
            >
              <CircleDot size={14} color={colors.danger} />
              <FitText
                style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 1.45 }}
              >
                Invalid resolution preserves the anomaly decision and records
                this case for future moderation review.
              </FitText>
            </div>
          ) : null}
        </div>
      ) : null}
    </FitModal>
  );
}
