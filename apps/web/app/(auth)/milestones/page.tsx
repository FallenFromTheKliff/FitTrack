"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  AlertTriangle,
  Apple,
  Archive,
  Bot,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Dumbbell,
  Flame,
  Grid2X2,
  ListFilter,
  Medal,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminMilestoneDefinitionListParams,
  AdminMilestoneDefinitionRecord,
  FitnessMilestoneCategory,
  FitnessMilestoneDefinitionStatus,
  FitnessMilestoneEvidenceRequirement,
  FitnessMilestoneTriggerType,
  FitnessMilestoneVerificationPolicy,
  UpsertAdminMilestoneDefinitionInput,
} from "@fittrack/types";
import {
  adminMilestonesQueryOptions,
  archiveAdminMilestoneMutationOptions,
  createAdminMilestoneMutationOptions,
  restoreAdminMilestoneMutationOptions,
  updateAdminMilestoneMutationOptions,
} from "@fittrack/query";

import { webApiClient } from "@/lib/api-client";
import { useTheme } from "@/contexts/ThemeContext";
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
  FitTextInput,
} from "@/components/fit";
import { FitModal } from "@/components/modals";

export const dynamic = "force-dynamic";

type ManagementTab = "rules" | "insights";

type DefinitionDraft = {
  advancedOpen: boolean;
  badgeIcon: string;
  badgeTone: string;
  category: FitnessMilestoneCategory;
  conditionJson: string;
  description: string;
  endsAt: string;
  evidenceRequirement: FitnessMilestoneEvidenceRequirement;
  isHidden: boolean;
  key: string;
  metric: string;
  rewardJson: string;
  sortOrder: string;
  startsAt: string;
  status: FitnessMilestoneDefinitionStatus;
  target: string;
  title: string;
  triggerType: FitnessMilestoneTriggerType;
  verificationPolicy: FitnessMilestoneVerificationPolicy;
  xpBonus: string;
};

type MetricOption = {
  helper: string;
  label: string;
  suggestedCategory: FitnessMilestoneCategory;
  suggestedTriggerType: FitnessMilestoneTriggerType;
  value: string;
};

const CATEGORY_OPTIONS: Array<{
  label: string;
  value: FitnessMilestoneCategory | "all";
}> = [
  { label: "All categories", value: "all" },
  { label: "Training", value: "training" },
  { label: "Weighted lifting", value: "weighted_lifting" },
  { label: "Nutrition", value: "nutrition" },
  { label: "Coaching", value: "coaching" },
  { label: "Booking venues", value: "booking" },
  { label: "Brodigy AI", value: "ai" },
  { label: "Attendance", value: "attendance" },
  { label: "Consistency", value: "consistency" },
  { label: "Season", value: "season" },
  { label: "Creator", value: "creator" },
  { label: "Governance", value: "governance" },
];

const STATUS_OPTIONS: Array<{
  label: string;
  value: FitnessMilestoneDefinitionStatus | "all";
}> = [
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
  { label: "All statuses", value: "all" },
];

const TRIGGER_OPTIONS: Array<{
  label: string;
  value: FitnessMilestoneTriggerType | "all";
}> = [
  { label: "All triggers", value: "all" },
  { label: "Source event", value: "source_event" },
  { label: "Summary threshold", value: "summary_threshold" },
  { label: "Streak", value: "streak" },
  { label: "Manual", value: "manual" },
  { label: "Composite", value: "composite" },
];

const METRIC_OPTIONS: MetricOption[] = [
  {
    label: "Completed workouts",
    value: "completed_workout_sessions",
    helper: "Counts finished workout sessions from the auto rep tracker flow.",
    suggestedCategory: "training",
    suggestedTriggerType: "source_event",
  },
  {
    label: "Weighted exercise logs",
    value: "weighted_exercise_logs",
    helper: "Counts exercises where the member entered a lifting weight.",
    suggestedCategory: "weighted_lifting",
    suggestedTriggerType: "source_event",
  },
  {
    label: "Highest lifted weight",
    value: "max_weight_kg",
    helper: "Uses the member's highest saved lift in kg.",
    suggestedCategory: "weighted_lifting",
    suggestedTriggerType: "summary_threshold",
  },
  {
    label: "Nutrition logs",
    value: "nutrition_logs",
    helper: "Counts member-created nutrition entries.",
    suggestedCategory: "nutrition",
    suggestedTriggerType: "source_event",
  },
  {
    label: "Completed coaching sessions",
    value: "coaching_appointments_completed",
    helper: "Counts coach appointments marked completed.",
    suggestedCategory: "coaching",
    suggestedTriggerType: "source_event",
  },
  {
    label: "Coaching no-shows",
    value: "coaching_no_shows",
    helper: "Counts missed coaching appointments.",
    suggestedCategory: "coaching",
    suggestedTriggerType: "summary_threshold",
  },
  {
    label: "Completed venue bookings",
    value: "venue_bookings_completed",
    helper: "Counts venue or facility bookings marked completed.",
    suggestedCategory: "booking",
    suggestedTriggerType: "source_event",
  },
  {
    label: "Booking no-shows",
    value: "booking_no_shows",
    helper: "Counts missed venue bookings.",
    suggestedCategory: "booking",
    suggestedTriggerType: "summary_threshold",
  },
  {
    label: "Brodigy AI chats",
    value: "ai_chat_messages",
    helper: "Counts member messages sent to Brodigy AI.",
    suggestedCategory: "ai",
    suggestedTriggerType: "source_event",
  },
  {
    label: "Brodigy AI actions",
    value: "ai_action_count",
    helper: "Counts completed AI-guided actions.",
    suggestedCategory: "ai",
    suggestedTriggerType: "source_event",
  },
  {
    label: "Gym chat messages",
    value: "gym_chat_messages",
    helper: "Counts messages in the gym chat experience.",
    suggestedCategory: "ai",
    suggestedTriggerType: "source_event",
  },
  {
    label: "Season points",
    value: "current_season_points",
    helper: "Uses the current season points total.",
    suggestedCategory: "season",
    suggestedTriggerType: "summary_threshold",
  },
  {
    label: "Current streak",
    value: "current_streak",
    helper: "Uses the member's active streak length.",
    suggestedCategory: "consistency",
    suggestedTriggerType: "streak",
  },
  {
    label: "Longest streak",
    value: "longest_streak",
    helper: "Uses the member's best streak length.",
    suggestedCategory: "consistency",
    suggestedTriggerType: "streak",
  },
  {
    label: "Total XP",
    value: "total_xp",
    helper: "Uses the member's lifetime XP total.",
    suggestedCategory: "season",
    suggestedTriggerType: "summary_threshold",
  },
  {
    label: "Tracked muscle groups",
    value: "tracked_muscle_groups",
    helper: "Counts distinct muscle groups trained.",
    suggestedCategory: "training",
    suggestedTriggerType: "summary_threshold",
  },
];

const BADGE_TONE_OPTIONS = [
  { label: "Ember", value: "ember" },
  { label: "Gold", value: "gold" },
  { label: "Green", value: "green" },
  { label: "Blue", value: "blue" },
  { label: "Violet", value: "violet" },
];

const BADGE_ICON_OPTIONS = [
  { label: "Medal", value: "medal" },
  { label: "Trophy", value: "trophy" },
  { label: "Shield", value: "shield" },
  { label: "Spark", value: "spark" },
  { label: "Bolt", value: "bolt" },
];

const QUICK_TARGETS = [1, 10, 50, 100];

const RULE_TYPE_OPTIONS: Array<{
  label: string;
  value: FitnessMilestoneTriggerType;
}> = [
  { label: "Count every completion", value: "source_event" },
  { label: "Reach a total", value: "summary_threshold" },
  { label: "Keep a streak", value: "streak" },
  { label: "Staff marks it done", value: "manual" },
  { label: "Advanced combo", value: "composite" },
];

const STATUS_TONES: Record<string, string> = {
  active: "#22C55E",
  draft: "#A1A1AA",
  archived: "#F97316",
  pending: "#F59E0B",
  approved: "#22C55E",
  rejected: "#EF4444",
};

function formatLabel(value: string | null | undefined) {
  if (!value) return "None";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toJsonText(value: Record<string, unknown> | null | undefined) {
  return JSON.stringify(value ?? { metric: "completed_workout_sessions", target: 1 }, null, 2);
}

function getMetricOption(value: string) {
  return METRIC_OPTIONS.find((option) => option.value === value) ?? METRIC_OPTIONS[0];
}

function getMetricLabel(value: string | null | undefined) {
  if (!value) return "Custom rule";
  return getMetricOption(value).value === value ? getMetricOption(value).label : formatLabel(value);
}

function parsePositiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function slugifyMilestoneKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isAdvancedCondition(value: Record<string, unknown> | null | undefined) {
  if (!value) return false;
  return Boolean(value.all || value.any || typeof value.metric !== "string");
}

function buildSimpleCondition(draft: Pick<DefinitionDraft, "metric" | "target">) {
  return {
    metric: draft.metric,
    target: parsePositiveNumber(draft.target, 1),
  };
}

function buildRewardPayload(
  draft: Pick<DefinitionDraft, "badgeIcon" | "badgeTone" | "xpBonus">,
) {
  return {
    badge_tone: draft.badgeTone || "ember",
    icon: draft.badgeIcon || "medal",
    xp_bonus: Math.max(0, Math.round(parsePositiveNumber(draft.xpBonus, 0))),
  };
}

function describeCondition(value: Record<string, unknown> | null | undefined) {
  if (!value) return "No unlock rule set yet.";
  const metric = typeof value.metric === "string" ? value.metric : null;
  const target = typeof value.target === "number" ? value.target : null;
  if (metric && target !== null) {
    return `${getMetricLabel(metric)} reaches ${target.toLocaleString()}.`;
  }
  if (Array.isArray(value.all)) {
    return `${value.all.length} requirements must all be met.`;
  }
  if (Array.isArray(value.any)) {
    return `${value.any.length} possible requirements, any one can unlock it.`;
  }
  return "Custom unlock rule.";
}

function describeReward(value: Record<string, unknown> | null | undefined) {
  const xpBonus = typeof value?.xp_bonus === "number" ? value.xp_bonus : 0;
  const badgeTone = typeof value?.badge_tone === "string" ? value.badge_tone : "ember";
  const icon = typeof value?.icon === "string" ? value.icon : "medal";
  return `${xpBonus.toLocaleString()} XP bonus, ${formatLabel(badgeTone)} ${formatLabel(icon)} badge.`;
}

function getMetricIcon(metric: string | null | undefined): LucideIcon {
  if (!metric) return Medal;
  if (metric.includes("weight") || metric.includes("lift")) return Dumbbell;
  if (metric.includes("nutrition")) return Apple;
  if (metric.includes("coach")) return Users;
  if (metric.includes("booking") || metric.includes("venue")) return Building2;
  if (metric.includes("ai") || metric.includes("chat")) return Bot;
  if (metric.includes("streak")) return Flame;
  if (metric.includes("season") || metric.includes("xp")) return Trophy;
  return Target;
}

function getCategoryIcon(category: FitnessMilestoneCategory): LucideIcon {
  if (category === "weighted_lifting" || category === "training") return Dumbbell;
  if (category === "nutrition") return Apple;
  if (category === "coaching") return Users;
  if (category === "booking") return Building2;
  if (category === "ai") return Bot;
  if (category === "season") return Trophy;
  if (category === "consistency") return Flame;
  return Medal;
}

function getConnectedSources(record: AdminMilestoneDefinitionRecord) {
  const metric = String(record.conditionPayload?.metric ?? "");
  const sources = new Map<string, LucideIcon>();
  const add = (label: string, icon: LucideIcon) => sources.set(label, icon);

  if (
    record.category === "training" ||
    record.category === "weighted_lifting" ||
    metric.includes("workout") ||
    metric.includes("muscle")
  ) {
    add("Workout", Dumbbell);
  }
  if (record.category === "weighted_lifting" || metric.includes("weight") || metric.includes("lift")) {
    add("Weighted lifting", Dumbbell);
  }
  if (record.category === "nutrition" || metric.includes("nutrition")) add("Nutrition", Apple);
  if (record.category === "coaching" || metric.includes("coach")) add("Coaching", Users);
  if (record.category === "booking" || metric.includes("booking") || metric.includes("venue")) {
    add("Bookings", CalendarCheck);
  }
  if (record.category === "ai" || metric.includes("ai") || metric.includes("chat")) add("Brodigy AI", Bot);
  if (sources.size === 0) add(formatLabel(record.category), getCategoryIcon(record.category));

  return Array.from(sources, ([label, icon]) => ({ label, icon }));
}

function getRecordProgress(record: AdminMilestoneDefinitionRecord) {
  const total = Math.max(record.progressCount, record.unlockedCount, 1);
  return {
    label: `${record.unlockedCount.toLocaleString()}/${record.progressCount.toLocaleString()}`,
    percent: Math.min(100, Math.round((record.unlockedCount / total) * 100)),
  };
}

function createDefaultDraft(): DefinitionDraft {
  return {
    advancedOpen: false,
    badgeIcon: "medal",
    badgeTone: "ember",
    category: "training",
    conditionJson: toJsonText({ metric: "completed_workout_sessions", target: 1 }),
    description: "",
    endsAt: "",
    evidenceRequirement: "none",
    isHidden: false,
    key: "",
    metric: "completed_workout_sessions",
    rewardJson: toJsonText({ badge_tone: "ember", icon: "medal", xp_bonus: 0 }),
    sortOrder: "0",
    startsAt: "",
    status: "active",
    target: "1",
    title: "",
    triggerType: "source_event",
    verificationPolicy: "auto",
    xpBonus: "0",
  };
}

function draftFromRecord(record: AdminMilestoneDefinitionRecord): DefinitionDraft {
  const condition = record.conditionPayload ?? {};
  const metric =
    typeof condition.metric === "string"
      ? condition.metric
      : "completed_workout_sessions";
  const target =
    typeof condition.target === "number" ? String(condition.target) : "1";
  const reward = record.rewardPayload ?? {};

  return {
    advancedOpen: record.triggerType === "composite" || isAdvancedCondition(condition),
    badgeIcon: typeof reward.icon === "string" ? reward.icon : "medal",
    badgeTone: typeof reward.badge_tone === "string" ? reward.badge_tone : "ember",
    category: record.category,
    conditionJson: toJsonText(record.conditionPayload),
    description: record.description ?? "",
    endsAt: record.endsAt ?? "",
    evidenceRequirement: record.evidenceRequirement,
    isHidden: record.isHidden,
    key: record.key,
    metric,
    rewardJson: toJsonText(record.rewardPayload),
    sortOrder: String(record.sortOrder),
    startsAt: record.startsAt ?? "",
    status: record.status,
    target,
    title: record.title,
    triggerType: record.triggerType,
    verificationPolicy: record.verificationPolicy,
    xpBonus: typeof reward.xp_bonus === "number" ? String(reward.xp_bonus) : "0",
  };
}

function parseJsonObject(text: string, label: string) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("object expected");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be valid JSON object text.`);
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Action failed.";
}

function buildPayload(draft: DefinitionDraft): UpsertAdminMilestoneDefinitionInput {
  const usesAdvancedRule = draft.triggerType === "composite";
  const conditionPayload = usesAdvancedRule
    ? parseJsonObject(draft.conditionJson, "Advanced unlock rule")
    : buildSimpleCondition(draft);
  const rewardPayload = usesAdvancedRule
    ? parseJsonObject(draft.rewardJson, "Advanced reward")
    : buildRewardPayload(draft);

  return {
    category: draft.category,
    conditionPayload,
    description: draft.description.trim() || null,
    endsAt: draft.endsAt || null,
    evidenceRequirement: "none",
    isHidden: draft.isHidden,
    key: draft.key.trim() || slugifyMilestoneKey(draft.title),
    rewardPayload,
    sortOrder: Number(draft.sortOrder || 0),
    startsAt: draft.startsAt || null,
    status: draft.status,
    title: draft.title.trim(),
    triggerType: draft.triggerType,
    verificationPolicy: "auto",
  };
}

export default function MilestonesPage() {
  const { colors } = useTheme();
  const themeTransition = useThemeTransition();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ManagementTab>("rules");
  const [definitionSearch, setDefinitionSearch] = useState("");
  const [definitionPage, setDefinitionPage] = useState(1);
  const [definitionStatus, setDefinitionStatus] =
    useState<AdminMilestoneDefinitionListParams["status"]>("active");
  const [definitionCategory, setDefinitionCategory] =
    useState<AdminMilestoneDefinitionListParams["category"]>("all");
  const [definitionTrigger, setDefinitionTrigger] =
    useState<AdminMilestoneDefinitionListParams["triggerType"]>("all");
  const [definitionVerification, setDefinitionVerification] =
    useState<AdminMilestoneDefinitionListParams["verificationPolicy"]>("all");
  const [definitionEvidence, setDefinitionEvidence] =
    useState<AdminMilestoneDefinitionListParams["evidenceRequirement"]>("all");
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
  const [isDefinitionDetailsOpen, setIsDefinitionDetailsOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] =
    useState<AdminMilestoneDefinitionRecord | null>(null);
  const [definitionToArchive, setDefinitionToArchive] =
    useState<AdminMilestoneDefinitionRecord | null>(null);
  const [isDefinitionModalOpen, setIsDefinitionModalOpen] = useState(false);
  const [definitionStep, setDefinitionStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<DefinitionDraft>(createDefaultDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const definitionParams = useMemo<AdminMilestoneDefinitionListParams>(
    () => ({
      category: definitionCategory,
      evidenceRequirement: definitionEvidence,
      includeArchived: definitionStatus === "archived" || definitionStatus === "all",
      limit: 10,
      page: definitionPage,
      search: definitionSearch,
      sort: "updated_at",
      status: definitionStatus,
      triggerType: definitionTrigger,
      verificationPolicy: definitionVerification,
    }),
    [
      definitionCategory,
      definitionEvidence,
      definitionPage,
      definitionSearch,
      definitionStatus,
      definitionTrigger,
      definitionVerification,
    ],
  );

  const definitionsQuery = useQuery(
    adminMilestonesQueryOptions(webApiClient, definitionParams),
  );

  const definitions = definitionsQuery.data?.data ?? [];
  const selectedDefinition =
    definitions.find((item) => item.id === selectedDefinitionId) ?? null;

  useEffect(() => {
    setDefinitionPage(1);
  }, [
    definitionCategory,
    definitionEvidence,
    definitionSearch,
    definitionStatus,
    definitionTrigger,
    definitionVerification,
  ]);

  const createMutation = useMutation(
    createAdminMilestoneMutationOptions(webApiClient, queryClient),
  );
  const updateMutation = useMutation(
    updateAdminMilestoneMutationOptions(webApiClient, queryClient),
  );
  const archiveMutation = useMutation(
    archiveAdminMilestoneMutationOptions(webApiClient, queryClient),
  );
  const restoreMutation = useMutation(
    restoreAdminMilestoneMutationOptions(webApiClient, queryClient),
  );
  const definitionRows = definitions;
  const activeCount = definitions.filter((item) => item.status === "active").length;
  const archivedCount = definitions.filter((item) => item.status === "archived").length;

  const openCreateModal = () => {
    setEditingDefinition(null);
    setDraft(createDefaultDraft());
    setDefinitionStep(1);
    setFormError(null);
    setIsDefinitionModalOpen(true);
  };

  const openEditModal = (record: AdminMilestoneDefinitionRecord) => {
    setEditingDefinition(record);
    setDraft(draftFromRecord(record));
    setDefinitionStep(1);
    setFormError(null);
    setIsDefinitionModalOpen(true);
  };

  const duplicateDefinition = (record: AdminMilestoneDefinitionRecord) => {
    const sourceDraft = draftFromRecord(record);
    setEditingDefinition(null);
    setDraft({
      ...sourceDraft,
      key: `${sourceDraft.key || slugifyMilestoneKey(sourceDraft.title)}-copy`,
      status: "draft",
      title: `${sourceDraft.title} Copy`,
    });
    setDefinitionStep(1);
    setFormError(null);
    setIsDefinitionModalOpen(true);
  };

  const closeDefinitionModal = () => {
    setIsDefinitionModalOpen(false);
    setEditingDefinition(null);
    setDefinitionStep(1);
    setFormError(null);
  };

  const applyQuickRule = () => {
    setDraft((current) => ({
      ...current,
      advancedOpen: false,
      conditionJson: toJsonText(buildSimpleCondition(current)),
      rewardJson: toJsonText(buildRewardPayload(current)),
    }));
  };

  const submitDefinition = () => {
    setFormError(null);
    setActionMessage(null);
    let payload: UpsertAdminMilestoneDefinitionInput;

    try {
      payload = buildPayload(draft);
    } catch (error) {
      setFormError(getErrorMessage(error));
      return;
    }

    if (editingDefinition) {
      updateMutation.mutate(
        {
          milestoneDefinitionId: editingDefinition.id,
          payload,
        },
        {
          onError: (error) => setFormError(getErrorMessage(error)),
          onSuccess: () => {
            setActionMessage("Milestone definition updated.");
            closeDefinitionModal();
          },
        },
      );
      return;
    }

    createMutation.mutate(payload, {
      onError: (error) => setFormError(getErrorMessage(error)),
      onSuccess: () => {
        setActionMessage("Milestone definition created.");
        closeDefinitionModal();
      },
    });
  };

  const archiveDefinition = (record: AdminMilestoneDefinitionRecord) => {
    setDefinitionToArchive(record);
  };

  const confirmArchiveDefinition = () => {
    if (!definitionToArchive) return;
    setActionMessage(null);
    archiveMutation.mutate(definitionToArchive.id, {
      onError: (error) => setActionMessage(getErrorMessage(error)),
      onSuccess: () => {
        setActionMessage("Milestone archived.");
        setDefinitionToArchive(null);
      },
    });
  };

  const restoreDefinition = (record: AdminMilestoneDefinitionRecord) => {
    setActionMessage(null);
    restoreMutation.mutate(record.id, {
      onError: (error) => setActionMessage(getErrorMessage(error)),
      onSuccess: () => setActionMessage("Milestone restored."),
    });
  };

  const isSavingDefinition = createMutation.isPending || updateMutation.isPending;
  const canSaveDefinition =
    draft.title.trim().length > 0 && parsePositiveNumber(draft.target, 0) > 0;
  const canContinueDefinition =
    definitionStep === 1
      ? canSaveDefinition
      : definitionStep === 2
        ? parsePositiveNumber(draft.xpBonus, 0) >= 0
        : canSaveDefinition;
  const hasDefinitionFilters =
    definitionCategory !== "all" ||
    definitionStatus !== "active" ||
    definitionTrigger !== "all" ||
    definitionVerification !== "all" ||
    definitionEvidence !== "all" ||
    definitionSearch.trim().length > 0;

  return (
    <div className={`${themeTransition} milestones-admin-shell`}>
      <section className="milestones-route-toolbar">
        <div className="milestones-route-tabs">
          <FitPill
            mode="toggle"
            active={tab}
            onChange={(key) => setTab(key as ManagementTab)}
            options={[
              { key: "rules", label: "Manage milestones", icon: ListFilter },
              { key: "insights", label: "Insights", icon: Grid2X2 },
            ]}
          />
        </div>
        <div className="milestones-route-actions">
          <FitButton
            label="Create milestone"
            icon={Plus}
            onClick={openCreateModal}
          />
        </div>
      </section>

      <section className="milestones-stat-strip">
        <MetricCard
          icon={Medal}
          label="Active milestones"
          value={String(definitionsQuery.data?.meta.total ?? 0)}
          hint={`${activeCount} on page`}
          tone={colors.brand}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Auto evaluated"
          value={String(definitions.length)}
          hint="No proof"
          tone={colors.warning}
        />
        <MetricCard
          icon={ClipboardCheck}
          label="Integrity policy"
          value="Advisory"
          hint="Non-blocking"
          tone={colors.success}
        />
        <MetricCard
          icon={Archive}
          label="Archived milestones"
          value={String(archivedCount)}
          hint="Hidden"
          tone={colors.textSecondary}
        />
      </section>

      {actionMessage ? (
        <div className="milestones-action-banner">
          <FitText style={{ fontSize: 13, fontWeight: 700 }}>
            {actionMessage}
          </FitText>
        </div>
      ) : null}

      {tab === "rules" ? (
        <section className="milestones-workspace">
          <FitSection
            className="milestones-library-section"
            heading="Milestone library"
            action={
              <FitButton
                label="Clear filters"
                variant="ghost"
                icon={SlidersHorizontal}
                disabled={!hasDefinitionFilters}
                onClick={() => {
                  setDefinitionSearch("");
                  setDefinitionStatus("active");
                  setDefinitionCategory("all");
                  setDefinitionTrigger("all");
                  setDefinitionVerification("all");
                  setDefinitionEvidence("all");
                }}
              />
            }
          >
            <div className="milestones-toolbar">
              <FitSearch
                value={definitionSearch}
                onChangeText={setDefinitionSearch}
                placeholder="Search milestones..."
                compact
              />
              <div className="milestones-filter-row">
                <FitSelect
                  compact
                  options={STATUS_OPTIONS}
                  value={definitionStatus}
                  onChange={(event) =>
                    setDefinitionStatus(
                      event.target.value as AdminMilestoneDefinitionListParams["status"],
                    )
                  }
                />
                <FitSelect
                  compact
                  options={CATEGORY_OPTIONS}
                  value={definitionCategory}
                  onChange={(event) =>
                    setDefinitionCategory(
                      event.target.value as AdminMilestoneDefinitionListParams["category"],
                    )
                  }
                />
                <FitSelect
                  compact
                  options={TRIGGER_OPTIONS}
                  value={definitionTrigger}
                  onChange={(event) =>
                    setDefinitionTrigger(
                      event.target.value as AdminMilestoneDefinitionListParams["triggerType"],
                    )
                  }
                />
              </div>
            </div>
            <div className="milestones-rules-table-frame">
              <RuleLibrary
                rows={definitionRows}
                selectedId={isDefinitionDetailsOpen ? selectedDefinition?.id ?? null : null}
                isLoading={definitionsQuery.isLoading}
                onArchive={archiveDefinition}
                onDuplicate={duplicateDefinition}
                onEdit={openEditModal}
                onRestore={restoreDefinition}
                onSelect={(row) => {
                  setSelectedDefinitionId(row.id);
                  setIsDefinitionDetailsOpen(true);
                }}
              />
            </div>
            <div className="milestones-pagination-row">
              <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                {definitionsQuery.data?.meta.total ?? 0} definitions
              </FitText>
              <FitPagination
                currentPage={definitionsQuery.data?.meta.page ?? definitionPage}
                totalPages={Math.max(
                  1,
                  definitionsQuery.data?.meta.total_pages ?? 1,
                )}
                onPageChange={setDefinitionPage}
                showSinglePage
              />
            </div>
          </FitSection>
        </section>
      ) : (
        <MilestoneInsightsPanel
          definitions={definitions}
          onCreate={openCreateModal}
        />
      )}

      <FitModal
        isOpen={isDefinitionDetailsOpen && Boolean(selectedDefinition)}
        onClose={() => setIsDefinitionDetailsOpen(false)}
        title="Milestone details"
        subtitle="Inspect the automatic rule, reward, progress source, and lifecycle without compressing the library."
        icon={Medal}
        maxWidth={760}
      >
        <DefinitionInspector
          record={selectedDefinition}
          onEdit={(record) => {
            setIsDefinitionDetailsOpen(false);
            openEditModal(record);
          }}
          onArchive={(record) => {
            setIsDefinitionDetailsOpen(false);
            archiveDefinition(record);
          }}
          onDuplicate={(record) => {
            setIsDefinitionDetailsOpen(false);
            duplicateDefinition(record);
          }}
          onRestore={(record) => {
            setIsDefinitionDetailsOpen(false);
            restoreDefinition(record);
          }}
        />
      </FitModal>

      <FitModal
        isOpen={isDefinitionModalOpen}
        onClose={closeDefinitionModal}
        title={editingDefinition ? "Edit milestone" : "Create milestone"}
        subtitle="Set the goal and reward. Progress unlocks automatically from member activity."
        icon={Medal}
        maxWidth={1000}
        containerStyle={{ maxHeight: "calc(100dvh - 72px)" }}
        contentStyle={{ maxHeight: "calc(100dvh - 232px)" }}
        footer={
          <div className="milestone-modal-footer">
            <FitButton
              label="Cancel"
              variant="ghost"
              onClick={closeDefinitionModal}
            />
            <div className="milestone-modal-footer-actions">
              {definitionStep > 1 ? (
                <FitButton
                  label="Back"
                  variant="ghost"
                  onClick={() =>
                    setDefinitionStep((current) => (current - 1) as 1 | 2 | 3)
                  }
                />
              ) : null}
              {definitionStep < 3 ? (
                <FitButton
                  label="Next"
                  disabled={!canContinueDefinition}
                  onClick={() =>
                    setDefinitionStep((current) => (current + 1) as 1 | 2 | 3)
                  }
                />
              ) : (
                <FitButton
                  label={editingDefinition ? "Save milestone" : "Create milestone"}
                  icon={Save}
                  loading={isSavingDefinition}
                  disabled={!canSaveDefinition}
                  onClick={submitDefinition}
                />
              )}
            </div>
          </div>
        }
      >
        <DefinitionForm
          draft={draft}
          error={formError}
          onApplyQuickRule={applyQuickRule}
          onChange={setDraft}
          step={definitionStep}
        />
      </FitModal>

      <FitModal
        isOpen={Boolean(definitionToArchive)}
        onClose={() => setDefinitionToArchive(null)}
        title="Archive milestone"
        subtitle={
          definitionToArchive
            ? `Archive ${definitionToArchive.title}?`
            : "Archive this milestone?"
        }
        icon={AlertTriangle}
        maxWidth={520}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <FitButton
              label="Cancel"
              variant="ghost"
              onClick={() => setDefinitionToArchive(null)}
            />
            <FitButton
              label="Archive milestone"
              icon={Archive}
              variant="danger"
              loading={archiveMutation.isPending}
              onClick={confirmArchiveDefinition}
            />
          </div>
        }
      >
        <div className="milestone-confirm-body">
          <div className="milestone-confirm-icon">
            <Archive size={22} color={colors.danger} />
          </div>
          <div>
            <FitText style={{ display: "block", fontSize: 15, fontWeight: 900 }}>
              Stop new unlocks but keep history
            </FitText>
            <FitText style={{ display: "block", marginTop: 6, color: colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
              Existing member history stays intact. This rule leaves the active library and can
              be restored later from the archived filter.
            </FitText>
          </div>
        </div>
      </FitModal>

      <style>{`
        .milestones-admin-shell {
          display: flex;
          height: 100%;
          min-height: 0;
          flex-direction: column;
          gap: 10px;
          overflow: hidden;
          padding-bottom: 0;
        }

        .milestones-route-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid ${colors.border};
          padding: 0 0 8px;
          flex-shrink: 0;
        }

        .milestones-route-actions,
        .milestone-modal-footer-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .milestones-stat-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0;
          border: 1px solid ${colors.border};
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .milestones-stat-strip > * {
          border: 0 !important;
          border-radius: 0 !important;
          border-right: 1px solid ${colors.border} !important;
        }

        .milestones-stat-strip > *:last-child {
          border-right: 0 !important;
        }

        .milestone-modal-footer {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .milestones-action-banner {
          border: 1px solid ${colors.brand}55;
          border-radius: 12px;
          background: ${colors.brand}14;
          color: ${colors.textPrimary};
          padding: 10px 12px;
        }

        .milestones-workspace {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .milestones-toolbar {
          display: grid;
          grid-template-columns: minmax(220px, 0.86fr) minmax(0, 2.4fr);
          gap: 8px;
          margin-bottom: 10px;
        }

        .milestones-filter-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(100px, 1fr));
          gap: 8px;
        }

        .milestones-library-section {
          min-height: 0;
          margin-bottom: 0 !important;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .milestones-library-section > div:last-child {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .milestones-rules-table-frame {
          display: flex;
          flex: 0 0 510px;
          width: 100%;
          height: 510px;
          min-height: 510px;
          max-height: 510px;
          min-width: 0;
          overflow: hidden;
        }

        .milestone-confirm-body {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          border: 1px solid ${colors.danger}55;
          border-radius: 14px;
          background: ${colors.danger}12;
          padding: 14px;
        }

        .milestone-confirm-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          border: 1px solid ${colors.danger}66;
          background: ${colors.danger}16;
          flex-shrink: 0;
        }

        .milestones-pagination-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 38px;
          padding-top: 8px;
          flex-shrink: 0;
        }

        @media (max-width: 1180px) {
          .milestones-admin-shell {
            height: auto;
            min-height: 100%;
            overflow: visible;
          }

          .milestones-workspace {
            grid-template-columns: 1fr;
            overflow: visible;
          }

          .milestones-toolbar {
            grid-template-columns: 1fr;
          }

          .milestones-filter-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .milestones-stat-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .milestones-route-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .milestones-route-actions {
            justify-content: flex-start;
          }

          .milestones-stat-strip,
          .milestones-filter-row {
            grid-template-columns: 1fr;
          }

          .milestones-pagination-row {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

const stackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

function MetricCard({
  hint,
  icon: Icon,
  label,
  tone,
  value,
}: {
  hint: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
  value: string;
}) {
  const { colors } = useTheme();
  const accent = tone ?? colors.brand;
  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        background: colors.surface,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
        minHeight: 62,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: `${accent}18`,
          border: `1px solid ${accent}55`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={16} color={accent} />
      </div>
      <div style={{ minWidth: 0 }}>
        <FitText style={{ display: "block", fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{value}</FitText>
        <FitText style={{ display: "block", marginTop: 4, fontSize: 11, color: colors.textSecondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label} / {hint}
        </FitText>
      </div>
    </div>
  );
}

function RuleLibrary({
  isLoading,
  onArchive,
  onDuplicate,
  onEdit,
  onRestore,
  onSelect,
  rows,
  selectedId,
}: {
  isLoading: boolean;
  onArchive: (record: AdminMilestoneDefinitionRecord) => void;
  onDuplicate: (record: AdminMilestoneDefinitionRecord) => void;
  onEdit: (record: AdminMilestoneDefinitionRecord) => void;
  onRestore: (record: AdminMilestoneDefinitionRecord) => void;
  onSelect: (record: AdminMilestoneDefinitionRecord) => void;
  rows: AdminMilestoneDefinitionRecord[];
  selectedId: string | null;
}) {
  const { colors } = useTheme();
  const ruleStyles = ruleBoardStyles(colors);

  if (isLoading) {
    return (
      <div className="milestone-rule-board">
        <div className="milestone-rule-state">
          <FitText style={{ color: colors.textSecondary, fontSize: 13 }}>
            Loading milestone rules...
          </FitText>
        </div>
        <style>{ruleStyles}</style>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="milestone-rule-board">
        <div className="milestone-rule-empty">
          <div className="milestone-empty-icon">
            <Medal size={24} color={colors.brand} />
          </div>
          <FitText style={{ display: "block", fontSize: 16, fontWeight: 900 }}>
            No milestones match these filters
          </FitText>
          <FitText style={{ display: "block", marginTop: 4, color: colors.textSecondary, fontSize: 13 }}>
            Try clearing filters or create a milestone for workouts, nutrition, bookings, coaching, or Brodigy AI.
          </FitText>
        </div>
        <style>{ruleStyles}</style>
      </div>
    );
  }

  return (
    <div className="milestone-rule-board">
      <div className="milestone-rule-head">
        <span>Milestone</span>
        <span>Category</span>
        <span>Trigger</span>
        <span>Evaluation</span>
        <span>Status</span>
        <span>Progress</span>
        <span>Actions</span>
      </div>
      <div className="milestone-rule-body">
        {rows.map((row) => {
          const metric = String(row.conditionPayload?.metric ?? "");
          const Icon = getMetricIcon(metric);
          const progress = getRecordProgress(row);
          const isSelected = row.id === selectedId;
          const progressTone =
            row.pendingReviewCount > 0 ? colors.warning : STATUS_TONES[row.status] ?? colors.brand;

          return (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              className={isSelected ? "milestone-rule-row selected" : "milestone-rule-row"}
              onClick={() => onSelect(row)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(row);
                }
              }}
            >
              <span className="milestone-rule-main">
                <span className="milestone-rule-icon">
                  <Icon size={16} color={progressTone} />
                </span>
                <span>
                  <FitText style={{ display: "block", fontSize: 13, fontWeight: 900 }}>
                    {row.title}
                  </FitText>
                  <FitText style={{ display: "block", marginTop: 2, fontSize: 11, color: colors.textSecondary }}>
                    {row.description || row.key}
                  </FitText>
                </span>
              </span>
              <span>
                <FitText style={{ fontSize: 12, fontWeight: 800 }}>
                  {formatLabel(row.category)}
                </FitText>
              </span>
              <span>
                <FitText style={{ display: "block", fontSize: 12, fontWeight: 800 }}>
                  {formatLabel(row.triggerType)}
                </FitText>
                <FitText style={{ display: "block", marginTop: 2, fontSize: 11, color: colors.textSecondary }}>
                  {getMetricLabel(metric)}
                </FitText>
              </span>
              <span className="milestone-rule-evaluation">
                <FitText style={{ display: "block", fontSize: 12, fontWeight: 800 }}>
                  {row.verificationPolicy === "auto" ? "Automatic" : formatLabel(row.verificationPolicy)}
                </FitText>
                <FitText style={{ display: "block", marginTop: 2, fontSize: 11, color: colors.textSecondary }}>
                  {row.evidenceRequirement === "none" ? "No proof" : formatLabel(row.evidenceRequirement)}
                </FitText>
              </span>
              <span>
                <FitPill
                  mode="status"
                  label={formatLabel(row.status)}
                  color={STATUS_TONES[row.status] ?? colors.brand}
                />
              </span>
              <span className="milestone-rule-progress">
                <FitText style={{ display: "block", fontSize: 12, fontWeight: 900 }}>
                  {progress.label}
                </FitText>
                <span className="milestone-progress-track">
                  <span
                    className="milestone-progress-fill"
                    style={{ width: `${progress.percent}%`, background: progressTone }}
                  />
                </span>
              </span>
              <span className="milestone-rule-actions" onClick={(event) => event.stopPropagation()}>
                <FitButton
                  icon={Pencil}
                  iconOnly
                  variant="ghost"
                  aria-label={`Edit ${row.title}`}
                  onClick={() => onEdit(row)}
                />
                <FitButton
                  icon={Copy}
                  iconOnly
                  variant="ghost"
                  aria-label={`Duplicate ${row.title}`}
                  onClick={() => onDuplicate(row)}
                />
                {row.status === "archived" ? (
                  <FitButton
                    icon={RotateCcw}
                    iconOnly
                    variant="ghost"
                    aria-label={`Restore ${row.title}`}
                    onClick={() => onRestore(row)}
                  />
                ) : (
                  <FitButton
                    icon={Archive}
                    iconOnly
                    variant="ghost"
                    aria-label={`Archive ${row.title}`}
                    onClick={() => onArchive(row)}
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>
      <style>{ruleStyles}</style>
    </div>
  );
}

function ruleBoardStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return `
    .milestone-rule-board {
      border: 1px solid ${colors.border};
      border-radius: 12px;
      overflow: hidden;
      background: ${colors.surface};
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
    }

    .milestone-rule-state,
    .milestone-rule-empty {
      flex: 1;
      min-height: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      text-align: center;
    }

    .milestone-empty-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      margin: 0 auto 12px;
      border: 1px solid ${colors.brand}55;
      background: ${colors.brand}14;
    }

    .milestone-rule-head,
    .milestone-rule-row {
      display: grid;
      grid-template-columns: minmax(260px, 1.7fr) minmax(104px, 0.58fr) minmax(150px, 0.9fr) minmax(112px, 0.62fr) minmax(86px, 0.48fr) minmax(118px, 0.68fr) minmax(136px, 136px);
      align-items: center;
      gap: 10px;
    }

    .milestone-rule-head {
      padding: 9px 12px;
      border-bottom: 1px solid ${colors.border};
      color: ${colors.textSecondary};
      background: ${colors.surfaceRaised};
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .milestone-rule-body {
      flex: 1;
      min-height: 0;
      overflow-y: hidden;
      overflow-x: hidden;
    }

    .milestone-rule-row {
      width: 100%;
      position: relative;
      border: 0;
      border-bottom: 1px solid ${colors.border};
      background: transparent;
      color: ${colors.textPrimary};
      min-height: 56px;
      padding: 7px 12px;
      text-align: left;
      cursor: pointer;
      transition: background 160ms ease, border-color 160ms ease;
    }

    .milestone-rule-row:last-of-type {
      border-bottom: 0;
    }

    .milestone-rule-row:hover,
    .milestone-rule-row.selected {
      background: ${colors.brand}12;
    }

    .milestone-rule-row.selected::before {
      content: "";
      position: absolute;
      left: 0;
      top: 10px;
      bottom: 10px;
      width: 3px;
      border-radius: 999px;
      background: ${colors.brand};
    }

    .milestone-rule-main {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .milestone-rule-main > span:last-child,
    .milestone-rule-row > span,
    .milestone-rule-evaluation {
      min-width: 0;
    }

    .milestone-rule-main > span:last-child > *,
    .milestone-rule-row > span:not(.milestone-rule-main):not(.milestone-rule-actions) > * {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .milestone-rule-icon {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      border: 1px solid ${colors.border};
      background: ${colors.surfaceRaised};
    }

    .milestone-rule-progress {
      min-width: 0;
    }

    .milestone-progress-track {
      display: block;
      height: 5px;
      margin-top: 6px;
      border-radius: 999px;
      background: ${colors.border};
      overflow: hidden;
    }

    .milestone-progress-fill {
      display: block;
      height: 100%;
      border-radius: inherit;
    }

    .milestone-rule-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }

    @media (max-width: 1260px) {
      .milestone-rule-board {
        overflow-x: auto;
      }

      .milestone-rule-head,
      .milestone-rule-row {
        min-width: 1120px;
      }
    }
  `;
}

function DefinitionInspector({
  onArchive,
  onDuplicate,
  onEdit,
  onRestore,
  record,
}: {
  onArchive: (record: AdminMilestoneDefinitionRecord) => void;
  onDuplicate: (record: AdminMilestoneDefinitionRecord) => void;
  onEdit: (record: AdminMilestoneDefinitionRecord) => void;
  onRestore: (record: AdminMilestoneDefinitionRecord) => void;
  record: AdminMilestoneDefinitionRecord | null;
}) {
  const { colors } = useTheme();

  if (!record) {
    return null;
  }

  const metric = String(record.conditionPayload?.metric ?? "");
  const Icon = getMetricIcon(metric);
  const sources = getConnectedSources(record);

  return (
    <div className="milestones-details-panel">
      <div className="milestones-inspector-scroll">
        <div className="milestones-inspector-identity">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${colors.brand}66`,
              background: `${colors.brand}16`,
              flexShrink: 0,
            }}
          >
            <Icon size={20} color={colors.brand} />
          </div>
          <div className="milestones-inspector-title-block">
            <FitText
              style={{
                display: "block",
                fontSize: 17,
                fontWeight: 900,
                lineHeight: 1.18,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              {record.title}
            </FitText>
            <FitText
              style={{
                display: "block",
                fontSize: 12,
                color: colors.textSecondary,
                marginTop: 4,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              {record.key}
            </FitText>
            <div style={{ marginTop: 8 }}>
              <FitPill
                mode="status"
                label={formatLabel(record.status)}
                color={STATUS_TONES[record.status] ?? colors.brand}
              />
              <FitText style={{ marginLeft: 8, fontSize: 11, color: colors.textSecondary }}>
                {record.unlockedCount.toLocaleString()} unlocked / automatically evaluated
              </FitText>
            </div>
          </div>
        </div>

        <div className="milestones-inspector-grid">
          <InspectorFact label="Category" value={formatLabel(record.category)} />
          <InspectorFact label="Trigger" value={formatLabel(record.triggerType)} />
          <InspectorFact
            label="Verification"
            value="Automatic"
          />
          <InspectorFact
            label="Evidence"
            value="Not required"
          />
        </div>

        <div className="milestones-source-panel">
          <FitText style={{ display: "block", fontSize: 12, color: colors.textSecondary, fontWeight: 900 }}>
            Where progress comes from
          </FitText>
          <div className="milestones-source-chip-row">
            {sources.map(({ icon: SourceIcon, label }) => (
              <span key={label} className="milestones-source-chip">
                <SourceIcon size={13} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            background: colors.surfaceRaised,
            padding: 12,
          }}
        >
          <FitText style={{ display: "block", fontSize: 12, color: colors.textSecondary, fontWeight: 800 }}>
            Unlock rule
          </FitText>
          <FitText style={{ display: "block", marginTop: 6, fontSize: 14, fontWeight: 800 }}>
            {describeCondition(record.conditionPayload)}
          </FitText>
          <FitText style={{ display: "block", marginTop: 6, fontSize: 12, color: colors.textSecondary }}>
            {describeReward(record.rewardPayload)}
          </FitText>
        </div>

        <details>
          <summary
            style={{
              cursor: "pointer",
              color: colors.textPrimary,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <MoreHorizontal size={13} /> Technical details
          </summary>
          <div className="milestones-technical-summary">
            <FitText style={{ display: "block", fontSize: 12, color: colors.textSecondary }}>
              Rule key: {record.key}
            </FitText>
            <FitText style={{ display: "block", marginTop: 4, fontSize: 12, color: colors.textSecondary }}>
              Generated from the metric, target, and reward settings. Use edit only when changing the rule.
            </FitText>
          </div>
        </details>

        <div className="milestones-inspector-actions">
          <FitButton label="Edit" icon={Pencil} onClick={() => onEdit(record)} />
          <FitButton
            label="Duplicate"
            icon={Copy}
            variant="ghost"
            onClick={() => onDuplicate(record)}
          />
          {record.status === "archived" ? (
            <FitButton
              label="Restore"
              icon={RotateCcw}
              variant="ghost"
              onClick={() => onRestore(record)}
            />
          ) : (
            <FitButton
              label="Archive"
              icon={Archive}
              variant="ghost"
              onClick={() => onArchive(record)}
            />
          )}
        </div>
      </div>
      <style>{`
        .milestones-details-panel {
          display: flex;
          min-height: 0;
          flex-direction: column;
        }

        .milestones-inspector-scroll {
          display: flex;
          flex: 1;
          min-height: 0;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 2px;
        }

        .milestones-inspector-identity {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 0;
        }

        .milestones-inspector-title-block {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          gap: 2px;
        }

        .milestones-inspector-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 7px;
        }

        .milestones-source-panel,
        .milestones-review-flow {
          border: 1px solid ${colors.border};
          border-radius: 10px;
          background: ${colors.surfaceRaised};
          padding: 10px;
        }

        .milestones-source-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .milestones-source-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid ${colors.border};
          border-radius: 9px;
          background: ${colors.surface};
          color: ${colors.textPrimary};
          padding: 7px 9px;
          font-size: 12px;
          font-weight: 800;
        }

        .milestones-review-steps {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 8px;
        }

        .milestones-review-steps span {
          border: 1px solid ${colors.border};
          border-radius: 9px;
          background: ${colors.surface};
          color: ${colors.textPrimary};
          padding: 8px;
          font-size: 11px;
          font-weight: 850;
          text-align: center;
        }

        .milestones-technical-summary {
          margin-top: 8px;
          border: 1px solid ${colors.border};
          border-radius: 10px;
          background: ${colors.surfaceRaised};
          padding: 10px;
        }

        .milestones-inspector-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: auto;
        }

        summary {
          display: flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>
    </div>
  );
}

function InspectorFact({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 9,
        background: colors.surfaceRaised,
        padding: 9,
        minWidth: 0,
      }}
    >
      <FitText style={{ display: "block", fontSize: 11, color: colors.textSecondary }}>
        {label}
      </FitText>
      <FitText style={{ display: "block", fontSize: 13, fontWeight: 800, marginTop: 2, overflowWrap: "anywhere" }}>
        {value}
      </FitText>
    </div>
  );
}

function MilestoneInsightsPanel({
  definitions,
  onCreate,
}: {
  definitions: AdminMilestoneDefinitionRecord[];
  onCreate: () => void;
}) {
  const { colors } = useTheme();
  const categoryCoverage = CATEGORY_OPTIONS.filter((option) => option.value !== "all").map(
    (option) => ({
      label: option.label,
      count: definitions.filter((definition) => definition.category === option.value).length,
    }),
  );
  const automaticRules = definitions.filter(
    (definition) => definition.verificationPolicy === "auto",
  ).length;
  const coveredCategories = categoryCoverage.filter((item) => item.count > 0).length;
  const totalRules = Math.max(definitions.length, 1);
  const automaticPercent = Math.round((automaticRules / totalRules) * 100);
  const atRiskRules = [...definitions]
    .filter((definition) => definition.pendingReviewCount > 0 || definition.unlockedCount === 0)
    .sort((left, right) => right.pendingReviewCount - left.pendingReviewCount)
    .slice(0, 4);
  const mostUnlocked = [...definitions]
    .sort((left, right) => right.unlockedCount - left.unlockedCount)
    .slice(0, 4);
  const maxCategoryCount = Math.max(1, ...categoryCoverage.map((item) => item.count));

  return (
    <section className="milestones-insights-shell">
      <div className="milestones-insights-header">
        <div>
          <FitText as="h2" style={{ display: "block", fontSize: 19, fontWeight: 950 }}>
            Milestone insights
          </FitText>
          <FitText style={{ display: "block", marginTop: 3, color: colors.textSecondary, fontSize: 12 }}>
            Coverage, evaluation health, and the rules that need attention.
          </FitText>
        </div>
        <FitButton label="Create milestone" icon={Plus} onClick={onCreate} />
      </div>

      <div className="milestones-insights-dashboard">
        <section className="milestones-insight-panel milestones-coverage-panel">
          <div className="milestones-panel-heading">
            <div>
              <FitText as="h3" style={{ fontSize: 15, fontWeight: 900 }}>Category coverage</FitText>
              <FitText style={{ display: "block", marginTop: 2, fontSize: 11, color: colors.textSecondary }}>
                {coveredCategories} categories represented on this page
              </FitText>
            </div>
            <Grid2X2 size={17} color={colors.brand} />
          </div>
          <div className="milestones-coverage-list">
            {categoryCoverage.map((item) => (
              <div key={item.label} className="milestones-coverage-row">
                <span>{item.label}</span>
                <span className="milestones-coverage-track">
                  <span style={{ width: `${(item.count / maxCategoryCount) * 100}%` }} />
                </span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="milestones-insight-panel milestones-evaluation-panel">
          <div className="milestones-panel-heading">
            <div>
              <FitText as="h3" style={{ fontSize: 15, fontWeight: 900 }}>Evaluation breakdown</FitText>
              <FitText style={{ display: "block", marginTop: 2, fontSize: 11, color: colors.textSecondary }}>
                How progress is verified
              </FitText>
            </div>
            <ShieldCheck size={17} color={colors.success} />
          </div>
          <div className="milestones-evaluation-content">
            <div
              className="milestones-evaluation-donut"
              style={{ background: `conic-gradient(${colors.success} 0 ${automaticPercent}%, ${colors.border} ${automaticPercent}% 100%)` }}
            >
              <div><strong>{automaticPercent}%</strong><span>automatic</span></div>
            </div>
            <div className="milestones-evaluation-legend">
              <span><i style={{ background: colors.success }} />Automatic <strong>{automaticRules}</strong></span>
              <span><i style={{ background: colors.border }} />Other <strong>{definitions.length - automaticRules}</strong></span>
              <span><i style={{ background: colors.warning }} />Integrity <strong>Advisory</strong></span>
            </div>
          </div>
        </section>

        <section className="milestones-insight-panel milestones-list-panel">
          <div className="milestones-panel-heading">
            <div>
              <FitText as="h3" style={{ fontSize: 15, fontWeight: 900 }}>Needs attention</FitText>
              <FitText style={{ display: "block", marginTop: 2, fontSize: 11, color: colors.textSecondary }}>
                Pending review or no recorded unlocks
              </FitText>
            </div>
            <AlertTriangle size={17} color={colors.warning} />
          </div>
          <div className="milestones-compact-list">
            {atRiskRules.length ? atRiskRules.map((definition) => (
              <div key={definition.id}>
                <span><strong>{definition.title}</strong><small>{formatLabel(definition.category)}</small></span>
                <b>{definition.pendingReviewCount ? `${definition.pendingReviewCount} pending` : "0 unlocks"}</b>
              </div>
            )) : <div className="milestones-insight-empty">No rules need attention.</div>}
          </div>
        </section>

        <section className="milestones-insight-panel milestones-list-panel">
          <div className="milestones-panel-heading">
            <div>
              <FitText as="h3" style={{ fontSize: 15, fontWeight: 900 }}>Most unlocked</FitText>
              <FitText style={{ display: "block", marginTop: 2, fontSize: 11, color: colors.textSecondary }}>
                Highest member adoption on this page
              </FitText>
            </div>
            <Trophy size={17} color={colors.brand} />
          </div>
          <div className="milestones-compact-list">
            {mostUnlocked.length ? mostUnlocked.map((definition) => (
              <div key={definition.id}>
                <span><strong>{definition.title}</strong><small>{formatLabel(definition.category)}</small></span>
                <b>{definition.unlockedCount.toLocaleString()}</b>
              </div>
            )) : <div className="milestones-insight-empty">No unlock activity yet.</div>}
          </div>
        </section>
      </div>

      <style>{`
        .milestones-insights-shell {
          display: flex;
          flex: 1;
          min-height: 0;
          flex-direction: column;
          gap: 10px;
          overflow: hidden;
        }

        .milestones-insights-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          border: 1px solid ${colors.border};
          border-radius: 10px;
          background: ${colors.surface};
          padding: 12px 14px;
          flex-shrink: 0;
        }

        .milestones-insights-dashboard {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: repeat(2, minmax(0, 1fr));
          gap: 10px;
          flex: 1;
          min-height: 0;
        }

        .milestones-insight-panel {
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          border: 1px solid ${colors.border};
          border-radius: 10px;
          background: ${colors.surface};
          padding: 13px;
        }

        .milestones-panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .milestones-coverage-list,
        .milestones-compact-list {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .milestones-coverage-list {
          gap: 7px;
        }

        .milestones-coverage-row {
          display: grid;
          grid-template-columns: minmax(90px, 0.8fr) minmax(100px, 1.4fr) 24px;
          align-items: center;
          gap: 9px;
          color: ${colors.textSecondary};
          font-size: 11px;
        }

        .milestones-coverage-track {
          height: 6px;
          border-radius: 999px;
          background: ${colors.border};
          overflow: hidden;
        }

        .milestones-coverage-track span {
          display: block;
          height: 100%;
          min-width: 2px;
          border-radius: inherit;
          background: ${colors.brand};
        }

        .milestones-evaluation-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 26px;
          min-height: 165px;
        }

        .milestones-evaluation-donut {
          width: 124px;
          height: 124px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .milestones-evaluation-donut > div {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          display: grid;
          place-content: center;
          text-align: center;
          background: ${colors.surface};
        }

        .milestones-evaluation-donut strong { font-size: 22px; }
        .milestones-evaluation-donut span { color: ${colors.textSecondary}; font-size: 10px; }

        .milestones-evaluation-legend {
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 150px;
        }

        .milestones-evaluation-legend span {
          display: grid;
          grid-template-columns: 8px 1fr auto;
          align-items: center;
          gap: 8px;
          color: ${colors.textSecondary};
          font-size: 11px;
        }

        .milestones-evaluation-legend i {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }

        .milestones-compact-list > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 43px;
          border-top: 1px solid ${colors.border};
          padding: 7px 2px;
        }

        .milestones-compact-list > div:first-child { border-top: 0; }
        .milestones-compact-list span { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
        .milestones-compact-list strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
        .milestones-compact-list small { color: ${colors.textSecondary}; font-size: 10px; }
        .milestones-compact-list b { color: ${colors.brand}; font-size: 11px; white-space: nowrap; }
        .milestones-insight-empty { color: ${colors.textSecondary}; font-size: 12px; }

        @media (max-width: 980px) {
          .milestones-insights-shell { overflow: visible; }
          .milestones-insights-dashboard {
            grid-template-columns: 1fr;
            grid-template-rows: none;
          }
          .milestones-insights-header { align-items: flex-start; flex-direction: column; }
        }
      `}</style>
    </section>
  );
}

/*
 * Legacy manual-proof inspector retained only as historical source until the
 * corresponding API surface is removed. It is intentionally not compiled or
 * reachable: milestones now unlock from recorded activity without uploads.
function EvidenceInspector({
  isPending,
  onApprove,
  onReject,
  onReviewNotesChange,
  record,
  reviewNotes,
}: {
  isPending: boolean;
  onApprove: (record: FitnessMilestoneEvidenceSubmissionRecord) => void;
  onReject: (record: FitnessMilestoneEvidenceSubmissionRecord) => void;
  onReviewNotesChange: (value: string) => void;
  record: FitnessMilestoneEvidenceSubmissionRecord | null;
  reviewNotes: string;
}) {
  const { colors } = useTheme();

  if (!record) {
    return (
      <FitSection className="milestones-inspector-section" heading="Proof inspector">
        <div className="milestone-proof-empty">
          <div className="milestone-proof-empty-icon">
            <ClipboardCheck size={24} color={colors.brand} />
          </div>
          <FitText style={{ display: "block", fontSize: 16, fontWeight: 900 }}>
            Select a proof review
          </FitText>
          <FitText
            style={{
              display: "block",
              maxWidth: 300,
              color: colors.textSecondary,
              fontSize: 13,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            Manual proof appears only for legacy or evidence-based milestones. Choose a queue item to inspect its image or video.
          </FitText>
        </div>
        <style>{`
          .milestone-proof-empty {
            min-height: clamp(280px, 46vh, 520px);
            display: grid;
            place-content: center;
            justify-items: center;
            gap: 10px;
            border: 1px dashed ${colors.border};
            border-radius: 12px;
            background: ${colors.surfaceRaised};
            padding: 24px;
          }

          .milestone-proof-empty-icon {
            width: 48px;
            height: 48px;
            display: grid;
            place-items: center;
            border: 1px solid ${colors.brand}55;
            border-radius: 12px;
            background: ${colors.brand}12;
          }
        `}</style>
      </FitSection>
    );
  }

  const canReview = record.status === "pending";
  const hasUsableEvidenceUrl = !isPlaceholderEvidenceUrl(record.fileUrl);
  const mediaContent = record.evidenceType === "image" && hasUsableEvidenceUrl ? (
    <img src={record.fileUrl} alt={`${record.milestoneTitle ?? "Milestone"} proof`} />
  ) : (
    <div className="evidence-video-placeholder">
      <FileVideo size={36} color={colors.brand} />
      <FitText style={{ display: "block", marginTop: 10, fontWeight: 900 }}>
        {hasUsableEvidenceUrl ? "Open MP4 evidence" : "Evidence file unavailable"}
      </FitText>
      <FitText style={{ display: "block", marginTop: 4, fontSize: 12, color: colors.textSecondary }}>
        {hasUsableEvidenceUrl
          ? "MP4 uploads are capped at 15 MiB."
          : "Seeded placeholder media is not available in this environment."}
      </FitText>
    </div>
  );

  return (
    <FitSection className="milestones-inspector-section" heading="Proof inspector">
      <div className="evidence-review-card">
        <div className="evidence-review-person">
          <div className="evidence-avatar">
            {(record.memberName ?? "FT")
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <FitText style={{ display: "block", fontSize: 18, fontWeight: 950 }}>
              {record.milestoneTitle ?? "Milestone proof"}
            </FitText>
            <FitText style={{ display: "block", marginTop: 3, fontSize: 13, color: colors.textSecondary }}>
              {record.memberName ?? "FitTrack member"} - {formatDate(record.createdAt)}
            </FitText>
          </div>
        </div>

        {hasUsableEvidenceUrl ? (
          <a href={record.fileUrl} target="_blank" rel="noreferrer" className="evidence-media-card">
            {mediaContent}
          </a>
        ) : (
          <div className="evidence-media-card" aria-label="Evidence file unavailable">
            {mediaContent}
          </div>
        )}

        <div className="evidence-meta-grid">
          <InspectorFact label="Evidence type" value={formatLabel(record.evidenceType)} />
          <InspectorFact label="File size" value={`${Math.round(record.sizeBytes / 1024)} KB`} />
          <InspectorFact label="Decision" value={formatLabel(record.status)} />
          <InspectorFact label="Member" value={record.memberName ?? "FitTrack member"} />
        </div>

        {record.caption ? (
          <div className="evidence-caption">
            <FitText style={{ display: "block", fontSize: 12, color: colors.textSecondary, fontWeight: 900 }}>
              Member caption
            </FitText>
            <FitText style={{ display: "block", marginTop: 5, fontSize: 13 }}>
              {record.caption}
            </FitText>
          </div>
        ) : null}

        <FitTextArea
          id="milestone-evidence-review-notes"
          name="milestoneEvidenceReviewNotes"
          value={reviewNotes}
          onChange={(event) => onReviewNotesChange(event.target.value)}
          placeholder="Add a short note for this decision"
          style={{ minHeight: 96 }}
        />

        <div className="evidence-decision-row">
          <FitButton
            label="Approve"
            icon={CheckCircle2}
            disabled={!canReview}
            loading={isPending}
            onClick={() => onApprove(record)}
          />
          <FitButton
            label="Reject"
            icon={XCircle}
            variant="danger"
            disabled={!canReview}
            loading={isPending}
            onClick={() => onReject(record)}
          />
        </div>
      </div>
      <style>{`
        .evidence-review-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .evidence-review-person {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .evidence-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border: 1px solid ${colors.brand}55;
          background: ${colors.brand}18;
          color: ${colors.brand};
          font-weight: 950;
        }

        .evidence-media-card {
          min-height: 240px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid ${colors.border};
          border-radius: 14px;
          background: ${colors.surfaceRaised};
          color: ${colors.textPrimary};
          text-decoration: none;
        }

        .evidence-media-card img {
          width: 100%;
          height: 100%;
          max-height: 340px;
          object-fit: cover;
        }

        .evidence-video-placeholder {
          text-align: center;
          padding: 18px;
        }

        .evidence-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .evidence-caption {
          border: 1px solid ${colors.border};
          border-radius: 12px;
          background: ${colors.surfaceRaised};
          padding: 12px;
        }

        .evidence-decision-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
      `}</style>
    </FitSection>
  );
}
*/

function DefinitionForm({
  draft,
  error,
  onApplyQuickRule,
  onChange,
  step,
}: {
  draft: DefinitionDraft;
  error: string | null;
  onApplyQuickRule: () => void;
  onChange: (next: DefinitionDraft) => void;
  step: 1 | 2 | 3;
}) {
  const { colors } = useTheme();
  const selectedMetric = getMetricOption(draft.metric);
  const usesAdvancedRule = draft.triggerType === "composite";
  const previewCondition = usesAdvancedRule
    ? "Custom combo rule. Review Advanced options before saving."
    : describeCondition(buildSimpleCondition(draft));
  const previewReward = usesAdvancedRule
    ? "Custom reward details."
    : describeReward(buildRewardPayload(draft));
  const goalReady = draft.title.trim().length > 0 && parsePositiveNumber(draft.target, 0) > 0;
  const rewardReady = goalReady;

  const commitDraft = (nextDraft: DefinitionDraft) => {
    let next = { ...nextDraft };
    if (next.triggerType !== "composite") {
      next = {
        ...next,
        conditionJson: toJsonText(buildSimpleCondition(next)),
        rewardJson: toJsonText(buildRewardPayload(next)),
      };
    }
    onChange(next);
  };

  const update = <K extends keyof DefinitionDraft>(
    key: K,
    value: DefinitionDraft[K],
  ) => commitDraft({ ...draft, [key]: value });

  const updateMetric = (value: string) => {
    const metric = getMetricOption(value);
    commitDraft({
      ...draft,
      category: metric.suggestedCategory,
      metric: metric.value,
      triggerType:
        draft.triggerType === "composite"
          ? draft.triggerType
          : metric.suggestedTriggerType,
    });
  };

  const toggleAdvanced = () => {
    const nextAdvancedOpen = !draft.advancedOpen;
    commitDraft({
      ...draft,
      advancedOpen: nextAdvancedOpen,
    });
  };

  return (
    <div className="milestone-definition-form">
      {error ? (
        <div
          style={{
            border: "1px solid #EF444455",
            borderRadius: 10,
            background: "#EF444416",
            padding: 10,
          }}
        >
          <FitText style={{ fontSize: 13, color: "#EF4444", fontWeight: 700 }}>
            {error}
          </FitText>
        </div>
      ) : null}

      <div className="milestone-form-steps" aria-label="Milestone setup steps">
        <span className={step >= 1 ? "active" : ""} aria-current={step === 1 ? "step" : undefined}>
          <b>{step > 1 ? <CheckCircle2 size={13} /> : 1}</b> Goal
        </span>
        <span className={step >= 2 ? "active" : ""} aria-current={step === 2 ? "step" : undefined}>
          <b>{step > 2 ? <CheckCircle2 size={13} /> : 2}</b> Reward
        </span>
        <span className={step >= 3 ? "active" : ""} aria-current={step === 3 ? "step" : undefined}>
          <b>3</b> Review
        </span>
      </div>

      {step === 1 ? <section className="milestone-form-section milestone-goal-layout">
        <div className="milestone-goal-column">
          <div className="milestone-column-heading">
            <Target size={16} color={colors.brand} />
            <FitText style={{ fontSize: 14, fontWeight: 900 }}>Milestone identity</FitText>
          </div>
          <div className="milestone-form-grid milestone-detail-grid">
            <Field label="Title">
              <FitTextInput
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="First Weighted Lift"
              />
            </Field>
            <Field label="Short code">
              <FitTextInput
                value={draft.key}
                onChange={(event) => update("key", event.target.value)}
                placeholder={slugifyMilestoneKey(draft.title) || "first-weighted-lift"}
              />
            </Field>
          </div>
          <Field label="Member-facing description">
            <FitTextArea
              value={draft.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Describe what the member must complete."
              style={{ minHeight: 96 }}
            />
          </Field>
        </div>

        <div className="milestone-goal-column milestone-unlock-column">
          <div className="milestone-column-heading">
            <SlidersHorizontal size={16} color={colors.brand} />
            <FitText style={{ fontSize: 14, fontWeight: 900 }}>Unlock rule</FitText>
          </div>
          <Field label="What should count?">
            <FitSelect
              fullWidth
              options={METRIC_OPTIONS.map((metric) => ({
                label: metric.label,
                value: metric.value,
              }))}
              value={draft.metric}
              onChange={(event) => updateMetric(event.target.value)}
            />
          </Field>
          <div className="milestone-target-controls">
            <Field label="Target number">
              <FitTextInput
                type="number"
                min={1}
                value={draft.target}
                onChange={(event) => update("target", event.target.value)}
                placeholder="1, 50, 100..."
              />
            </Field>
            <div className="milestone-target-row" aria-label="Quick goal numbers">
              {QUICK_TARGETS.map((target) => (
                <button
                  key={target}
                  type="button"
                  className={draft.target === String(target) ? "active" : ""}
                  onClick={() => update("target", String(target))}
                >
                  {target === 1 ? "1st" : target.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <div className="milestone-helper-card milestone-helper-card--goal">
            <span className="milestone-helper-copy">
              <CheckCircle2 size={15} color={colors.success} />
              <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                {selectedMetric.helper}
              </FitText>
            </span>
            <FitButton
              label="Use quick rule"
              icon={SlidersHorizontal}
              variant="ghost"
              onClick={onApplyQuickRule}
            />
          </div>
        </div>

        <div className="milestone-form-grid milestone-form-grid--three milestone-rule-settings">
          <Field label="Category">
            <FitSelect
              fullWidth
              options={CATEGORY_OPTIONS.filter((option) => option.value !== "all")}
              value={draft.category}
              onChange={(event) =>
                update("category", event.target.value as FitnessMilestoneCategory)
              }
            />
          </Field>
          <Field label="Rule style">
            <FitSelect
              fullWidth
              options={RULE_TYPE_OPTIONS}
              value={draft.triggerType}
              onChange={(event) =>
                update("triggerType", event.target.value as FitnessMilestoneTriggerType)
              }
            />
          </Field>
          <Field label="Status">
            <FitSelect
              fullWidth
              options={STATUS_OPTIONS.filter((option) => option.value !== "all")}
              value={draft.status}
              onChange={(event) =>
                update("status", event.target.value as FitnessMilestoneDefinitionStatus)
              }
            />
          </Field>
        </div>
      </section> : null}

      {step === 2 && rewardReady ? (
        <section className="milestone-reward-layout">
          <div className="milestone-member-preview">
            <FitText style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 850 }}>
              Member preview
            </FitText>
            <div className="milestone-preview-medallion"><Dumbbell size={32} /></div>
            <FitText as="h3" style={{ fontSize: 18, fontWeight: 950, textAlign: "center" }}>
              {draft.title.trim() || "Untitled milestone"}
            </FitText>
            <FitText style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center" }}>
              Unlock after {previewCondition.toLowerCase()}.
            </FitText>
            <div className="milestone-preview-reward">
              <Sparkles size={18} color={colors.success} />
              <strong>{parsePositiveNumber(draft.xpBonus, 0)} EXP</strong>
            </div>
          </div>

          <section className="milestone-form-section milestone-reward-config">
            <div className="milestone-section-heading">
              <div className="milestone-section-icon milestone-section-icon--subtle">
                <Medal size={17} color={colors.success} />
              </div>
              <div>
                <FitText style={{ display: "block", fontSize: 15, fontWeight: 900 }}>
                  Reward configuration
                </FitText>
                <FitText style={{ display: "block", fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Choose the reward members see when the goal unlocks.
                </FitText>
              </div>
            </div>
            <Field label="EXP reward">
              <FitTextInput
                type="number"
                min={0}
                value={draft.xpBonus}
                onChange={(event) => update("xpBonus", event.target.value)}
              />
            </Field>
            <Field label="Badge">
              <FitSelect
                fullWidth
                options={BADGE_ICON_OPTIONS}
                value={draft.badgeIcon}
                onChange={(event) => update("badgeIcon", event.target.value)}
              />
            </Field>
            <Field label="Badge tone">
              <FitSelect
                fullWidth
                options={BADGE_TONE_OPTIONS}
                value={draft.badgeTone}
                onChange={(event) => update("badgeTone", event.target.value)}
              />
            </Field>
            <label className="milestone-checkbox-row milestone-visibility-row">
              <input
                type="checkbox"
                checked={!draft.isHidden}
                onChange={(event) => update("isHidden", !event.target.checked)}
              />
              Show locked milestone to members
            </label>
          </section>
        </section>
      ) : null}

      {step === 3 && rewardReady ? (
        <section className="milestone-review-layout">
          <div className="milestone-review-summary">
            <FitText as="h3" style={{ fontSize: 16, fontWeight: 950 }}>Summary</FitText>
            <div className="milestone-summary-group">
              <span>Goal</span>
              <strong>{draft.title || "Untitled milestone"}</strong>
              <p>{draft.description || "No member-facing description."}</p>
            </div>
            <div className="milestone-summary-grid">
              <InspectorFact label="Unlock rule" value={previewCondition} />
              <InspectorFact label="Category" value={formatLabel(draft.category)} />
              <InspectorFact label="Status" value={formatLabel(draft.status)} />
              <InspectorFact label="Reward" value={previewReward} />
            </div>
            <div className="milestone-review-readiness">
              <CheckCircle2 size={16} color={colors.success} />
              <span>Required goal and reward fields are complete.</span>
            </div>
          </div>

          <div className="milestone-member-preview milestone-member-preview--review">
            <FitText style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 850 }}>
              Member preview
            </FitText>
            <div className="milestone-preview-medallion"><Dumbbell size={34} /></div>
            <FitText as="h3" style={{ fontSize: 18, fontWeight: 950, textAlign: "center" }}>
              {draft.title.trim() || "Untitled milestone"}
            </FitText>
            <FitText style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 1.5 }}>
              {draft.description || previewCondition}
            </FitText>
            <div className="milestone-preview-reward">
              <Sparkles size={18} color={colors.success} />
              <strong>{parsePositiveNumber(draft.xpBonus, 0)} EXP</strong>
            </div>
          </div>
        </section>
      ) : null}

      {step === 1 ? <button
        type="button"
        className="milestone-advanced-toggle"
        onClick={toggleAdvanced}
      >
        {draft.advancedOpen ? "Hide schedule and visibility" : "Schedule and visibility"}
      </button> : null}

      {step === 1 && draft.advancedOpen ? (
        <section className="milestone-form-section">
          <div className="milestone-form-grid milestone-form-grid--three">
            <Field label="Starts at">
              <FitTextInput
                type="datetime-local"
                value={draft.startsAt ? draft.startsAt.slice(0, 16) : ""}
                onChange={(event) =>
                  update(
                    "startsAt",
                    event.target.value ? new Date(event.target.value).toISOString() : "",
                  )
                }
              />
            </Field>
            <Field label="Ends at">
              <FitTextInput
                type="datetime-local"
                value={draft.endsAt ? draft.endsAt.slice(0, 16) : ""}
                onChange={(event) =>
                  update(
                    "endsAt",
                    event.target.value ? new Date(event.target.value).toISOString() : "",
                  )
                }
              />
            </Field>
            <Field label="Sort order">
              <FitTextInput
                type="number"
                min={0}
                value={draft.sortOrder}
                onChange={(event) => update("sortOrder", event.target.value)}
              />
            </Field>
          </div>

          <label className="milestone-checkbox-row">
            <input
              type="checkbox"
              checked={draft.isHidden}
              onChange={(event) => update("isHidden", event.target.checked)}
            />
            Hide while locked
          </label>

          <details className="milestone-technical-details">
            <summary>Technical payload preview</summary>
            <FitText style={{ display: "block", marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
              FitTrack generates the rule payload from the choices above. Custom JSON stays hidden from normal setup.
            </FitText>
          </details>
        </section>
      ) : null}

      <style>{`
        .milestone-definition-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .milestone-form-steps {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          padding: 0 4px 2px;
        }

        .milestone-form-steps span {
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${colors.textSecondary};
          padding: 6px 0 10px;
          font-size: 12px;
          font-weight: 850;
          position: relative;
        }

        .milestone-form-steps span::after {
          content: "";
          position: absolute;
          left: 30px;
          right: -12px;
          bottom: 0;
          height: 1px;
          background: ${colors.border};
        }

        .milestone-form-steps span:last-child::after {
          right: 0;
        }

        .milestone-form-steps b {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          border: 1px solid ${colors.border};
          color: ${colors.textPrimary};
          font-size: 11px;
        }

        .milestone-form-steps span.active {
          color: ${colors.brand};
        }

        .milestone-form-steps span.active::after {
          background: ${colors.brand};
        }

        .milestone-form-steps span.active b {
          border-color: ${colors.brand};
          background: ${colors.brand};
          color: #ffffff;
        }

        .milestone-reward-layout,
        .milestone-review-layout {
          display: grid;
          grid-template-columns: minmax(280px, 0.82fr) minmax(360px, 1.18fr);
          gap: 16px;
          min-height: 388px;
        }

        .milestone-member-preview,
        .milestone-review-summary {
          min-width: 0;
          border: 1px solid ${colors.border};
          border-radius: 12px;
          background: ${colors.surfaceRaised};
          padding: 18px;
        }

        .milestone-member-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .milestone-preview-medallion {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          border: 2px solid ${colors.brand};
          border-radius: 20px;
          color: ${colors.brand};
          background: ${colors.brand}0D;
          transform: rotate(45deg);
        }

        .milestone-preview-medallion > * {
          transform: rotate(-45deg);
        }

        .milestone-preview-reward {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-top: 1px solid ${colors.border};
          padding-top: 12px;
          font-size: 16px;
        }

        .milestone-reward-config {
          justify-content: flex-start;
          gap: 12px;
          padding: 18px;
        }

        .milestone-visibility-row {
          margin-top: 2px;
          border: 1px solid ${colors.border};
          border-radius: 10px;
          background: ${colors.surface};
          padding: 12px;
        }

        .milestone-review-summary {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .milestone-summary-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
          border-bottom: 1px solid ${colors.border};
          padding-bottom: 14px;
        }

        .milestone-summary-group span {
          color: ${colors.textSecondary};
          font-size: 11px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .milestone-summary-group p {
          margin: 0;
          color: ${colors.textSecondary};
          font-size: 13px;
          line-height: 1.5;
        }

        .milestone-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .milestone-review-readiness {
          margin-top: auto;
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid ${colors.success}55;
          border-radius: 10px;
          background: ${colors.success}12;
          padding: 11px;
          color: ${colors.textPrimary};
          font-size: 12px;
          font-weight: 800;
        }

        .milestone-form-section {
          display: flex;
          flex-direction: column;
          gap: 9px;
          border: 1px solid ${colors.border};
          border-radius: 12px;
          background: ${colors.surfaceRaised};
          padding: 12px;
        }

        .milestone-goal-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 0;
          align-items: start;
          padding: 0;
          overflow: hidden;
        }

        .milestone-form-section--locked {
          opacity: 0.72;
        }

        .milestone-section-heading {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .milestone-goal-column {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 12px;
          padding: 18px;
        }

        .milestone-unlock-column {
          border-left: 1px solid ${colors.border};
        }

        .milestone-column-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 2px;
        }

        .milestone-rule-settings {
          grid-column: 1 / -1;
          border-top: 1px solid ${colors.border};
          padding: 14px 18px 18px;
        }

        .milestone-target-controls {
          display: grid;
          grid-template-columns: minmax(110px, 0.65fr) minmax(0, 1.35fr);
          align-items: end;
          gap: 10px;
        }

        .milestone-section-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: ${colors.brand}18;
          border: 1px solid ${colors.brand}55;
          flex-shrink: 0;
        }

        .milestone-section-icon--subtle {
          background: ${colors.surface};
          border-color: ${colors.border};
        }

        .milestone-form-section input:not([type="checkbox"]),
        .milestone-form-section textarea {
          width: 100%;
          min-height: 42px;
          border: 1px solid ${colors.border} !important;
          border-radius: 10px;
          background: ${colors.surface} !important;
          padding: 9px 11px;
          box-sizing: border-box;
        }

        .milestone-form-section input:not([type="checkbox"]):focus,
        .milestone-form-section textarea:focus {
          border-color: ${colors.brand}AA !important;
          box-shadow: 0 0 0 1px ${colors.brand}33;
        }

        .milestone-form-section textarea {
          line-height: 1.35;
        }

        .milestone-helper-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid ${colors.border};
          border-radius: 12px;
          background: ${colors.surface};
          padding: 10px;
        }

        .milestone-helper-card--goal {
          min-height: 58px;
        }

        .milestone-helper-copy {
          display: flex;
          min-width: 0;
          align-items: flex-start;
          gap: 8px;
        }

        .milestone-target-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          flex-wrap: wrap;
          gap: 6px;
          flex-shrink: 0;
          align-self: end;
        }

        .milestone-target-row button {
          min-width: 42px;
          min-height: 38px;
          border-radius: 10px;
          border: 1px solid ${colors.border};
          background: ${colors.surfaceRaised};
          color: ${colors.textPrimary};
          font-weight: 850;
          cursor: pointer;
        }

        .milestone-target-row button.active {
          border-color: ${colors.brand};
          background: ${colors.brand};
          color: #ffffff;
        }

        .milestone-preview-card {
          border: 1px solid ${colors.brand}55;
          border-radius: 12px;
          background: ${colors.brand}14;
          padding: 12px;
        }

        .milestone-advanced-toggle {
          align-self: flex-start;
          border: 1px solid ${colors.border};
          border-radius: 10px;
          background: ${colors.surfaceRaised};
          color: ${colors.textPrimary};
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 850;
          cursor: pointer;
        }

        .milestone-checkbox-row {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: ${colors.textPrimary};
          font-size: 13px;
          font-weight: 700;
        }

        .milestone-technical-details {
          border: 1px solid ${colors.border};
          border-radius: 10px;
          background: ${colors.surface};
          padding: 10px;
        }

        .milestone-technical-details summary {
          cursor: pointer;
          font-size: 12px;
          font-weight: 850;
          color: ${colors.textPrimary};
        }

        .milestone-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .milestone-form-grid--three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        @media (max-width: 760px) {
          .milestone-reward-layout,
          .milestone-review-layout {
            grid-template-columns: 1fr;
            min-height: 0;
          }

          .milestone-goal-layout,
          .milestone-target-controls {
            grid-template-columns: 1fr;
          }

          .milestone-unlock-column {
            border-top: 1px solid ${colors.border};
            border-left: 0;
          }

          .milestone-form-steps,
          .milestone-form-grid,
          .milestone-form-grid--three,
          .milestone-summary-grid {
            grid-template-columns: 1fr;
          }

          .milestone-helper-card {
            align-items: stretch;
            flex-direction: column;
          }

          .milestone-target-row {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}

function Field({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <label className={className} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <FitText style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 700 }}>
        {label}
      </FitText>
      {children}
    </label>
  );
}
