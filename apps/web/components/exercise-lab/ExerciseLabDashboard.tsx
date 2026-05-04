"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  FileText,
  PanelRightOpen,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateFitnessExerciseInput,
  CreateMuscleDefinitionInput,
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  ExerciseReviewEvidenceRecord,
  ExerciseReviewSubmissionRecord,
  ExerciseReviewSubmissionStatus,
  FitnessCreatorState,
  FitnessExerciseCategory,
  FitnessExerciseRecord,
  MuscleDefinitionRecord,
  UpdateFitnessExerciseInput,
  UpdateMuscleDefinitionInput,
} from "@fittrack/api-client";
import {
  archiveMuscleDefinitionMutationOptions,
  createMuscleDefinitionMutationOptions,
  createFitnessExerciseMutationOptions,
  fitnessExerciseReviewSubmissionsQueryOptions,
  fitnessExercisesQueryOptions,
  fitnessMuscleDefinitionsQueryOptions,
  updateExerciseReviewSubmissionMutationOptions,
  updateFitnessExerciseMutationOptions,
  updateMuscleDefinitionMutationOptions,
} from "@fittrack/query";
import {
  getPrimaryExerciseMuscleGroup,
  normalizeExerciseHandShapeProfile,
  normalizeExerciseMovementProfile,
  normalizeExerciseMuscleTargets,
  validateExerciseEditorContract,
} from "@fittrack/utils";

import { webApiClient } from "@/lib/api-client";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { useTimedMessage } from "@fittrack/hooks";
import {
  FitButton,
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
import type {
  FitTableAction,
  FitTableColumn,
} from "@/components/fit/FitTable";
import { ConfirmModal, FitModal } from "@/components/modals";
import {
  ACHIEVEMENT_REVIEW_SEED,
  ACHIEVEMENT_REVIEW_STATUS_COLORS,
  type AchievementReviewRecord,
  type AchievementReviewStatus,
} from "@/data/progress/milestones";

import {
  createExerciseDraft,
  EXERCISE_CATEGORY_OPTIONS,
} from "./exercise-lab-data";
import {
  ExerciseEditorTabs,
  HandShapeProfileEditor,
  MovementProfileEditor,
  MuscleTargetsEditor,
  type EditorColors,
  type ExerciseEditorTab,
} from "./ExerciseContractEditors";

type SurfaceMode = "library" | "milestones" | "muscles" | "review";
type LibraryScope = "active" | "all";
type MilestoneScope = "all" | "closed" | "pending";
type MuscleDefinitionDraft = {
  aliases: string;
  bodyRegion: string;
  key: string;
  name: string;
  sortOrder: number;
};
type SheetState =
  | { mode: "create" }
  | { candidateId: string; mode: "publish" }
  | { exercise: FitnessExerciseRecord; mode: "edit" }
  | null;
type ConfirmationState =
  | { mode: "archive"; exercise: FitnessExerciseRecord; nextActive: boolean }
  | { candidate: ExerciseReviewCandidateLike; mode: "leave-private" }
  | { mode: "discard-sheet" }
  | null;

type ExerciseReviewCandidateLike = ExerciseReviewSubmissionRecord;

type ExerciseDraft = {
  category: FitnessExerciseCategory;
  description: string;
  imageUrl: string;
  instructions: string;
  handShapeProfile: ExerciseHandShapeProfileRecord;
  movementProfile: ExerciseMovementProfileRecord | null;
  muscleGroup: string;
  muscleTargets: ExerciseMuscleTargetRecord[];
  name: string;
  publishNote: string;
  videoUrl: string;
};

const DRAWER_WIDTH = 420;
const EMPTY_REVIEW_CANDIDATES: ExerciseReviewSubmissionRecord[] = [];
const EMPTY_LIBRARY_EXERCISES: FitnessExerciseRecord[] = [];
const CREATOR_STATE_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Candidate", value: "candidate" },
  { label: "Pending review", value: "pending_review" },
  { label: "Approved", value: "approved" },
  { label: "Suspended", value: "suspended" },
  { label: "Revoked", value: "revoked" },
] as const;

const REVIEW_STATUS_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "All statuses", value: "" },
  { label: "Published", value: "published" },
  { label: "Left private", value: "left_private" },
  { label: "Rejected", value: "rejected" },
] as const;

const CREATOR_DECISION_STATES = new Set<FitnessCreatorState>([
  "approved",
  "suspended",
  "revoked",
]);

function getCreatorStateTone(state: FitnessCreatorState) {
  if (state === "approved") return "success";
  if (state === "suspended" || state === "revoked") return "danger";
  if (state === "pending_review") return "warning";
  if (state === "candidate") return "brand";
  return "muted";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value?: string) {
  if (!value) return "Not reviewed yet";
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMilestoneMetric(review: AchievementReviewRecord) {
  const match = review.badgeLabel.match(/\d+/);
  if (match) {
    return { label: "earned", value: `${match[0]}x` };
  }

  if (review.badgeLabel.toLowerCase().includes("streak")) {
    return { label: "streak", value: "7d" };
  }

  return { label: "badge", value: review.memberInitials };
}

function getMilestonePrimaryTag(review: AchievementReviewRecord) {
  return review.badgeLabel
    .replace(/\s+Milestone$/i, "")
    .replace(/\s+Badge$/i, "");
}

function getMilestoneSecondaryTag(review: AchievementReviewRecord) {
  if (review.badgeLabel.toLowerCase().includes("streak")) return "consistency";
  if (review.badgeLabel.toLowerCase().includes("boxing")) return "skill";
  if (review.badgeLabel.toLowerCase().includes("workout")) return "volume";
  return "progress";
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function scoreExerciseMatch(
  candidate: ExerciseReviewCandidateLike,
  exercise: FitnessExerciseRecord,
) {
  const normalizedMatchHint = candidate.matchHint?.trim().toLowerCase() ?? "";
  const candidateTokens = new Set(
    tokenize(
      [
        candidate.title,
        candidate.proposedName,
        candidate.matchHint ?? "",
        candidate.muscleGroup,
        candidate.description ?? "",
      ].join(" "),
    ),
  );
  const exerciseTokens = tokenize(
    [exercise.name, exercise.muscleGroup, exercise.description ?? ""].join(" "),
  );

  let score = 0;
  for (const token of exerciseTokens) {
    if (candidateTokens.has(token)) score += token.length > 5 ? 10 : 6;
  }

  if (exercise.category === candidate.category) score += 18;
  if (
    exercise.muscleGroup.toLowerCase() === candidate.muscleGroup.toLowerCase()
  )
    score += 12;
  if (
    normalizedMatchHint &&
    exercise.name.toLowerCase() === normalizedMatchHint
  )
    score += 22;
  if (
    normalizedMatchHint &&
    exercise.name.toLowerCase().includes(normalizedMatchHint)
  )
    score += 10;

  return score;
}

function getEvidenceBars(evidence: ExerciseReviewEvidenceRecord | null) {
  if (Array.isArray(evidence)) return evidence;
  return [18, 28, 44, 34, 24, 20];
}

function getDraftEvidence(evidence: ExerciseReviewEvidenceRecord | null) {
  return !Array.isArray(evidence) &&
    evidence?.schemaVersion === "exercise_ai_draft_v1"
    ? evidence
    : null;
}

function getEvidenceSummary(evidence: ExerciseReviewEvidenceRecord | null) {
  if (Array.isArray(evidence)) {
    return `${evidence.length} evidence bars`;
  }
  if (evidence && typeof evidence === "object") {
    const capturedReps =
      "captured_reps" in evidence && typeof evidence.captured_reps === "number"
        ? evidence.captured_reps
        : "repCount" in evidence && typeof evidence.repCount === "number"
          ? evidence.repCount
          : null;
    const confidence =
      "confidence_avg" in evidence && typeof evidence.confidence_avg === "number"
        ? evidence.confidence_avg
        : "confidence" in evidence && typeof evidence.confidence === "number"
          ? evidence.confidence
          : null;
    const confidenceLabel =
      confidence !== null ? ` / ${Math.round(confidence * 100)}% confidence` : "";
    return capturedReps !== null
      ? `${capturedReps} reps${confidenceLabel}`
      : `Structured evidence${confidenceLabel}`;
  }
  return "Evidence pending";
}

function getReviewStatusColor(
  status: ExerciseReviewSubmissionStatus,
  colors: ReturnType<typeof useTheme>["colors"],
) {
  if (status === "published") return colors.success;
  if (status === "rejected") return colors.danger;
  if (status === "left_private") return colors.warning;
  return colors.brand;
}

function filterEmptyExerciseDraft(
  draft: ExerciseDraft,
): CreateFitnessExerciseInput {
  const muscleTargets = normalizeExerciseMuscleTargets(
    draft.muscleTargets,
    draft.muscleGroup,
  );
  const muscleGroup = getPrimaryExerciseMuscleGroup(
    muscleTargets,
    draft.muscleGroup,
  );
  return {
    name: draft.name.trim(),
    category: draft.category,
    muscleGroup,
    muscleTargets,
    movementProfile: normalizeExerciseMovementProfile(draft.movementProfile),
    handShapeProfile: normalizeExerciseHandShapeProfile(draft.handShapeProfile),
    ...(draft.description.trim()
      ? { description: draft.description.trim() }
      : {}),
    ...(draft.instructions.trim()
      ? { instructions: draft.instructions.trim() }
      : {}),
    ...(draft.imageUrl?.trim() ? { imageUrl: draft.imageUrl.trim() } : {}),
    ...(draft.videoUrl?.trim() ? { videoUrl: draft.videoUrl.trim() } : {}),
  };
}

function normalizeExerciseName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isValidOptionalHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function ExerciseLabField({
  children,
  hint,
  label,
}: {
  children: React.ReactNode;
  hint?: string;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <FitText
        as="span"
        style={{
          fontSize: 10.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: colors.textMuted,
        }}
      >
        {label}
      </FitText>
      {children}
      {hint ? (
        <FitText
          as="span"
          style={{ fontSize: 12, color: colors.textSecondary }}
        >
          {hint}
        </FitText>
      ) : null}
    </label>
  );
}

function ExerciseLabDrawer({
  children,
  isOpen,
  onClose,
  title,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}) {
  const { colors } = useTheme();
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const panelRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !portalRoot) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const dialogs = Array.from(
        document.querySelectorAll('[role="dialog"][aria-modal="true"]'),
      );
      if (dialogs[dialogs.length - 1] !== panelRef.current) return;
      event.preventDefault();
      onCloseRef.current();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [isOpen, portalRoot]);

  if (!portalRoot || !isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        pointerEvents: "auto",
        transition: "background-color 180ms ease",
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: `min(${DRAWER_WIDTH}px, 92vw)`,
          height: "100%",
          backgroundColor: colors.surfaceRaised,
          borderLeft: `1px solid ${colors.border}`,
          boxShadow: "-16px 0 40px rgba(0,0,0,0.28)",
          transform: "translateX(0)",
          transition: "transform 220ms ease",
          display: "grid",
          gridTemplateRows: "auto 1fr",
          padding: 20,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingBottom: 16,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <FitText id={titleId} style={{ fontSize: 18, fontWeight: 800 }}>{title}</FitText>
          <FitButton
            aria-label="Close drawer"
            icon={X}
            iconOnly
            variant="ghost"
            onClick={onClose}
          />
        </div>
        <div style={{ overflowY: "auto", paddingTop: 16 }}>{children}</div>
      </aside>
    </div>,
    portalRoot,
  );
}

export function ExerciseLabDashboard() {
  const { colors, settings } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const queryClient = useQueryClient();
  const { message, showMessage } = useTimedMessage(
    FEEDBACK_DURATION_MS.standard,
  );
  const [mode, setMode] = useState<SurfaceMode>("review");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryCategory, setLibraryCategory] = useState<string>("");
  const [libraryScope, setLibraryScope] = useState<LibraryScope>("active");
  const [libraryPage, setLibraryPage] = useState(1);
  const [muscleSearch, setMuscleSearch] = useState("");
  const [muscleDraft, setMuscleDraft] = useState<MuscleDefinitionDraft>({
    aliases: "",
    bodyRegion: "arms",
    key: "",
    name: "",
    sortOrder: 500,
  });
  const [editingMuscleId, setEditingMuscleId] = useState<string | null>(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState<
    ExerciseReviewSubmissionStatus | ""
  >("pending");
  const [reviewCategory, setReviewCategory] = useState<
    FitnessExerciseCategory | ""
  >("");
  const [reviewMuscleFilter, setReviewMuscleFilter] = useState("");
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [draft, setDraft] = useState<ExerciseDraft>(createExerciseDraft());
  const [activeEditorTab, setActiveEditorTab] =
    useState<ExerciseEditorTab>("basics");
  const initialDraftRef = useRef<ExerciseDraft>(createExerciseDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [matchDrawerOpen, setMatchDrawerOpen] = useState(false);
  const [matchSearch, setMatchSearch] = useState("");
  const [confirmationState, setConfirmationState] =
    useState<ConfirmationState>(null);
  const [rejectTarget, setRejectTarget] =
    useState<ExerciseReviewCandidateLike | null>(null);
  const [rejectRationale, setRejectRationale] = useState("");
  const [rejectValidationError, setRejectValidationError] = useState<
    string | null
  >(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [reviewModalCandidate, setReviewModalCandidate] =
    useState<ExerciseReviewCandidateLike | null>(null);
  const [creatorStateDraft, setCreatorStateDraft] =
    useState<FitnessCreatorState>("none");
  const [creatorGovernanceNote, setCreatorGovernanceNote] = useState("");
  const [milestoneReviews, setMilestoneReviews] = useState<
    AchievementReviewRecord[]
  >(ACHIEVEMENT_REVIEW_SEED);
  const [milestoneScope, setMilestoneScope] =
    useState<MilestoneScope>("pending");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(
    ACHIEVEMENT_REVIEW_SEED[0]?.id ?? "",
  );
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [isCompact, setIsCompact] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(900);
  const canAnimate = settings.animationLevel !== "none";
  const fullMotion = settings.animationLevel === "full";
  const editorColors = useMemo<EditorColors>(
    () => ({
      background: colors.surface,
      border: colors.border,
      borderStrong: `${colors.brand}44`,
      card: colors.surfaceRaised,
      muted: colors.textMuted,
      primary: colors.brand,
      surface: colors.surfaceRaised,
      text: colors.textPrimary,
      textMuted: colors.textSecondary,
    }),
    [colors],
  );

  useEffect(() => {
    const evaluateViewport = () => {
      setIsCompact(window.innerWidth < 1220);
      setViewportHeight(window.innerHeight);
    };
    evaluateViewport();
    window.addEventListener("resize", evaluateViewport);
    return () => window.removeEventListener("resize", evaluateViewport);
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "milestones") {
      router.replace("/gamification?tab=milestones", { scroll: false });
      return;
    }
    if (
      requestedTab === "review" ||
      requestedTab === "library" ||
      requestedTab === "muscles"
    ) {
      setMode(requestedTab);
    }

    const requestedMilestoneScope = searchParams.get("milestone_scope");
    if (
      requestedMilestoneScope === "pending" ||
      requestedMilestoneScope === "closed" ||
      requestedMilestoneScope === "all"
    ) {
      setMilestoneScope(requestedMilestoneScope);
    }
  }, [router, searchParams]);

  const replaceSurfaceRoute = (
    nextMode: SurfaceMode,
    nextMilestoneScope = milestoneScope,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextMode);
    if (nextMode === "milestones") {
      params.set("milestone_scope", nextMilestoneScope);
    } else {
      params.delete("milestone_scope");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const handleModeChange = (nextMode: SurfaceMode) => {
    setMode(nextMode);
    replaceSurfaceRoute(nextMode);
  };

  const handleMilestoneScopeChange = (nextScope: MilestoneScope) => {
    setMilestoneScope(nextScope);
    replaceSurfaceRoute("milestones", nextScope);
  };

  const reviewQueueQuery = useQuery(
    fitnessExerciseReviewSubmissionsQueryOptions(webApiClient, {
      limit: 8,
      page: reviewPage,
      ...(reviewStatus ? { status: reviewStatus } : {}),
      ...(reviewSearch.trim() ? { search: reviewSearch.trim() } : {}),
      ...(reviewCategory ? { category: reviewCategory } : {}),
      ...(reviewMuscleFilter.trim()
        ? { muscleGroup: reviewMuscleFilter.trim() }
        : {}),
    }),
  );
  const reviewLibraryQuery = useQuery(
    fitnessExercisesQueryOptions(webApiClient, { limit: 60, page: 1 }),
  );
  const libraryQuery = useQuery(
    fitnessExercisesQueryOptions(webApiClient, {
      limit: 8,
      page: libraryPage,
      includeInactive: libraryScope === "all",
      ...(librarySearch.trim() ? { search: librarySearch.trim() } : {}),
      ...(libraryCategory
        ? { category: libraryCategory as FitnessExerciseCategory }
        : {}),
    }),
  );
  const muscleDefinitionsQuery = useQuery(
    fitnessMuscleDefinitionsQueryOptions(webApiClient, {
      includeArchived: true,
      ...(muscleSearch.trim() ? { search: muscleSearch.trim() } : {}),
    }),
  );

  const createExerciseMutation = useMutation(
    createFitnessExerciseMutationOptions(webApiClient, queryClient),
  );
  const createMuscleDefinitionMutation = useMutation(
    createMuscleDefinitionMutationOptions(webApiClient, queryClient),
  );
  const updateMuscleDefinitionMutation = useMutation(
    updateMuscleDefinitionMutationOptions(webApiClient, queryClient),
  );
  const archiveMuscleDefinitionMutation = useMutation(
    archiveMuscleDefinitionMutationOptions(webApiClient, queryClient),
  );
  const updateReviewSubmissionMutation = useMutation(
    updateExerciseReviewSubmissionMutationOptions(webApiClient, queryClient),
  );
  const updateExerciseMutation = useMutation(
    updateFitnessExerciseMutationOptions(webApiClient, queryClient),
  );

  const reviewCandidates =
    reviewQueueQuery.data?.data ?? EMPTY_REVIEW_CANDIDATES;
  const pendingCandidates = reviewCandidates;
  const visibleReviewCandidates = reviewCandidates;
  const reviewViewportHeight = Math.max(540, viewportHeight - 228);
  const workbenchMotionKey = `${mode}-${reviewModalCandidate?.id ?? "empty"}`;

  useEffect(() => {
    setLibraryPage(1);
  }, [librarySearch, libraryCategory, libraryScope]);

  useEffect(() => {
    setReviewPage(1);
  }, [reviewCategory, reviewMuscleFilter, reviewSearch, reviewStatus]);

  const selectedCandidate = reviewModalCandidate;
  const selectedDraftEvidence = selectedCandidate
    ? getDraftEvidence(selectedCandidate.evidenceBars)
    : null;
  const selectedCreatorTone = selectedCandidate
    ? getCreatorStateTone(selectedCandidate.creatorState)
    : "muted";
  const selectedCreatorToneColor =
    selectedCreatorTone === "success"
      ? colors.success
      : selectedCreatorTone === "danger"
        ? colors.danger
        : selectedCreatorTone === "warning"
          ? colors.warning
          : selectedCreatorTone === "brand"
            ? colors.brand
            : colors.textMuted;
  const filteredMilestones = useMemo(() => {
    if (milestoneScope === "all") return milestoneReviews;
    if (milestoneScope === "closed") {
      return milestoneReviews.filter((review) => review.status !== "Pending");
    }
    return milestoneReviews.filter((review) => review.status === "Pending");
  }, [milestoneReviews, milestoneScope]);
  const pendingMilestoneCount = useMemo(
    () =>
      milestoneReviews.filter((review) => review.status === "Pending").length,
    [milestoneReviews],
  );
  const closedMilestoneCount = milestoneReviews.length - pendingMilestoneCount;
  const milestoneWorkbenchMotionKey = `${milestoneScope}-${selectedMilestoneId || "empty"}`;

  useEffect(() => {
    if (!filteredMilestones.length) return;
    const stillSelected = filteredMilestones.some(
      (review) => review.id === selectedMilestoneId,
    );
    if (!stillSelected) {
      setSelectedMilestoneId(filteredMilestones[0].id);
    }
  }, [filteredMilestones, selectedMilestoneId]);

  const selectedMilestone =
    filteredMilestones.find((review) => review.id === selectedMilestoneId) ??
    null;
  const selectedMilestoneMetric = selectedMilestone
    ? getMilestoneMetric(selectedMilestone)
    : null;

  useEffect(() => {
    setMilestoneNotes(selectedMilestone?.reviewerNotes ?? "");
  }, [selectedMilestone]);

  useEffect(() => {
    setCreatorStateDraft(selectedCandidate?.creatorState ?? "none");
    setCreatorGovernanceNote(selectedCandidate?.creatorGovernanceNote ?? "");
  }, [
    selectedCandidate?.creatorGovernanceNote,
    selectedCandidate?.creatorState,
    selectedCandidate?.id,
  ]);

  const matchSuggestions = useMemo(() => {
    if (!selectedCandidate) return [];
    const reviewExercises = reviewLibraryQuery.data?.data ?? [];
    return [...reviewExercises]
      .map((exercise) => ({
        exercise,
        score: scoreExerciseMatch(selectedCandidate, exercise),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);
  }, [reviewLibraryQuery.data?.data, selectedCandidate]);

  const filteredMatches = useMemo(() => {
    if (!matchSearch.trim()) return matchSuggestions;
    const query = matchSearch.trim().toLowerCase();
    return matchSuggestions.filter(({ exercise }) =>
      [exercise.name, exercise.muscleGroup, exercise.category]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [matchSearch, matchSuggestions]);

  const closestMatch = matchSuggestions[0]?.exercise ?? null;
  const publishCandidate =
    sheetState?.mode === "publish"
      ? (reviewCandidates.find(
          (candidate) => candidate.id === sheetState.candidateId,
        ) ?? null)
      : null;
  const sheetPending =
    createExerciseMutation.isPending ||
    updateExerciseMutation.isPending ||
    updateReviewSubmissionMutation.isPending;
  const reviewMeta = reviewQueueQuery.data?.meta;
  const libraryItems = libraryQuery.data?.data ?? EMPTY_LIBRARY_EXERCISES;
  const libraryMeta = libraryQuery.data?.meta;
  const muscleDefinitions = muscleDefinitionsQuery.data ?? [];
  const activeMuscleDefinitions = muscleDefinitions.filter(
    (definition) => definition.isActive,
  );
  const knownGlobalExercises = useMemo(() => {
    const merged = new Map<string, FitnessExerciseRecord>();
    for (const exercise of [
      ...(reviewLibraryQuery.data?.data ?? []),
      ...libraryItems,
    ]) {
      merged.set(exercise.id, exercise);
    }
    return Array.from(merged.values());
  }, [libraryItems, reviewLibraryQuery.data?.data]);
  const reviewMatchByCandidateId = useMemo(() => {
    const reviewExercises = reviewLibraryQuery.data?.data ?? [];
    const matchById = new Map<
      string,
      { exercise: FitnessExerciseRecord; score: number }
    >();
    for (const candidate of reviewCandidates) {
      const match = [...reviewExercises]
        .map((exercise) => ({
          exercise,
          score: scoreExerciseMatch(candidate, exercise),
        }))
        .sort((left, right) => right.score - left.score)[0];
      if (match) matchById.set(candidate.id, match);
    }
    return matchById;
  }, [reviewCandidates, reviewLibraryQuery.data?.data]);
  const duplicateDraftExercise =
    draft.name.trim().length >= 3
      ? (knownGlobalExercises.find((exercise) => {
          if (
            sheetState?.mode === "edit" &&
            exercise.id === sheetState.exercise.id
          ) {
            return false;
          }
          return (
            normalizeExerciseName(exercise.name) ===
            normalizeExerciseName(draft.name)
          );
        }) ?? null)
      : null;
  const contractValidation = validateExerciseEditorContract({
    handShapeProfile: draft.handShapeProfile,
    movementProfile: draft.movementProfile,
    muscleGroup: draft.muscleGroup,
    muscleDefinitions: activeMuscleDefinitions,
    muscleTargets: draft.muscleTargets,
  });
  const definitionChecklist = [
    {
      complete: draft.name.trim().length >= 3 && !duplicateDraftExercise,
      label: duplicateDraftExercise
        ? `Name is already used by ${duplicateDraftExercise.name}`
        : "Unique searchable name",
    },
    {
      complete: !contractValidation.errors.some((error) =>
        error.toLowerCase().includes("muscle"),
      ),
      label: "Primary muscle and 100% Muscle Effort XP",
    },
    {
      complete: draft.instructions.trim().length >= 12,
      label: "Movement instructions",
    },
    {
      complete: !contractValidation.errors.some((error) =>
        error.toLowerCase().includes("movement") ||
        error.toLowerCase().includes("threshold") ||
        error.toLowerCase().includes("rig"),
      ),
      label: "Movement contract and visual rig",
    },
    {
      complete: isValidOptionalHttpUrl(draft.imageUrl),
      label: "Image URL is valid",
    },
    {
      complete: isValidOptionalHttpUrl(draft.videoUrl),
      label: "Video URL is valid",
    },
    ...(sheetState?.mode === "publish"
      ? [
          {
            complete: draft.publishNote.trim().length >= 12,
            label: "Publish provenance note",
          },
        ]
      : []),
  ];
  const completedDefinitionItems = definitionChecklist.filter(
    (item) => item.complete,
  ).length;

  const setDraftField = <K extends keyof ExerciseDraft>(
    key: K,
    value: ExerciseDraft[K],
  ) => {
    if (formError) setFormError(null);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const resetSheet = (nextState: SheetState) => {
    setSheetState(nextState);
    setFormError(null);
    setActiveEditorTab("basics");

    let nextDraft: ExerciseDraft;
    if (!nextState) {
      nextDraft = createExerciseDraft();
    } else if (nextState.mode === "publish") {
      const candidate = reviewCandidates.find(
        (item) => item.id === nextState.candidateId,
      );
      nextDraft = createExerciseDraft(candidate);
    } else if (nextState.mode === "edit") {
      nextDraft = {
        ...createExerciseDraft({
          category: nextState.exercise.category,
          description: nextState.exercise.description,
          handShapeProfile: nextState.exercise.handShapeProfile,
          instructions: nextState.exercise.instructions,
          movementProfile: nextState.exercise.movementProfile,
          muscleGroup: nextState.exercise.muscleGroup,
          muscleTargets: normalizeExerciseMuscleTargets(
            nextState.exercise.muscleTargets,
            nextState.exercise.muscleGroup,
          ),
          proposedName: nextState.exercise.name,
        }),
        imageUrl: nextState.exercise.imageUrl ?? "",
        videoUrl: nextState.exercise.videoUrl ?? "",
        publishNote: "",
      };
    } else {
      nextDraft = createExerciseDraft();
    }

    initialDraftRef.current = nextDraft;
    setDraft(nextDraft);
  };

  const handleOpenPublish = (
    candidate: ExerciseReviewCandidateLike | null = selectedCandidate,
  ) => {
    if (!candidate) return;
    setReviewModalCandidate(null);
    resetSheet({ mode: "publish", candidateId: candidate.id });
  };

  const handleOpenCreate = () => {
    resetSheet({ mode: "create" });
  };

  const handleOpenEdit = (exercise: FitnessExerciseRecord) => {
    resetSheet({ mode: "edit", exercise });
  };

  const handleCloseSheet = () => {
    if (
      sheetState &&
      JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current)
    ) {
      setConfirmationState({ mode: "discard-sheet" });
      return;
    }
    resetSheet(null);
  };

  const closeSheetAfterSave = () => {
    setConfirmationState(null);
    resetSheet(null);
  };

  const handleCreatorGovernanceUpdate = async () => {
    if (!selectedCandidate) return;

    const trimmedNote = creatorGovernanceNote.trim();
    if (CREATOR_DECISION_STATES.has(creatorStateDraft) && !trimmedNote) {
      showMessage("Add a short rationale before changing creator standing.");
      return;
    }

    try {
      const updatedCandidate = await updateReviewSubmissionMutation.mutateAsync({
        submissionId: selectedCandidate.id,
        payload: {
          creatorGovernanceNote: trimmedNote || undefined,
          creatorState: creatorStateDraft,
        },
      });
      setReviewModalCandidate(updatedCandidate);
      showMessage(
        `${selectedCandidate.title} creator state moved to ${toTitleCase(creatorStateDraft)}.`,
      );
    } catch (error) {
      showMessage(
        getErrorMessage(error, "Unable to update creator governance state."),
      );
    }
  };

  const handleLeavePrivate = async (
    candidate: ExerciseReviewCandidateLike | null = selectedCandidate,
  ) => {
    if (!candidate) return;
    try {
      await updateReviewSubmissionMutation.mutateAsync({
        submissionId: candidate.id,
        payload: {
          reviewNotes:
            "Left private from Exercise Lab review; not promoted to the global exercise library.",
          status: "left_private",
        },
      });
      showMessage(
        `${candidate.title} was left as a private custom exercise.`,
      );
      setConfirmationState(null);
      setReviewModalCandidate(null);
      resetSheet(null);
    } catch (error) {
      showMessage(
        getErrorMessage(
          error,
          "Unable to leave this submission as a private exercise.",
        ),
      );
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const trimmedRationale = rejectRationale.trim();
    if (trimmedRationale.length < 12) {
      setRejectValidationError(
        "Add a rejection rationale of at least 12 characters.",
      );
      showMessage("Add a rejection rationale of at least 12 characters.");
      return;
    }
    try {
      await updateReviewSubmissionMutation.mutateAsync({
        submissionId: rejectTarget.id,
        payload: {
          reviewNotes: trimmedRationale,
          status: "rejected",
        },
      });
      showMessage(`${rejectTarget.title} was removed from the publish queue.`);
      setRejectTarget(null);
      setRejectRationale("");
      setRejectValidationError(null);
      setReviewModalCandidate(null);
    } catch (error) {
      showMessage(
        getErrorMessage(error, "Unable to reject this review submission."),
      );
    }
  };

  const handleMilestoneDecision = (status: AchievementReviewStatus) => {
    if (!selectedMilestone) return;
    const trimmedNotes = milestoneNotes.trim();
    if (status === "Rejected" && !trimmedNotes) {
      showMessage("Add a short reviewer note before declining this claim.");
      return;
    }

    setMilestoneReviews((current) =>
      current.map((review) =>
        review.id === selectedMilestone.id
          ? {
              ...review,
              reviewedAt: new Date().toISOString(),
              reviewerNotes: trimmedNotes,
              status,
            }
          : review,
      ),
    );

    showMessage(
      status === "Approved"
        ? `${selectedMilestone.badgeLabel} was approved.`
        : `${selectedMilestone.badgeLabel} was declined.`,
    );
  };

  const handleOpenClosedMilestones = () => {
    handleMilestoneScopeChange("closed");
  };

  const handleArchiveToggle = async (
    exercise: FitnessExerciseRecord,
    nextActive = !exercise.isActive,
  ) => {
    try {
      await updateExerciseMutation.mutateAsync({
        exerciseId: exercise.id,
        payload: { isActive: nextActive } satisfies UpdateFitnessExerciseInput,
      });
      showMessage(
        nextActive
          ? `${exercise.name} is active in the global library again.`
          : `${exercise.name} was archived from the global library.`,
      );
      setConfirmationState(null);
    } catch (error) {
      showMessage(getErrorMessage(error, "Unable to update exercise status."));
    }
  };

  const resetMuscleDraft = (definition?: MuscleDefinitionRecord) => {
    setEditingMuscleId(definition?.id ?? null);
    setMuscleDraft({
      aliases: definition?.aliases.join(", ") ?? "",
      bodyRegion: definition?.bodyRegion ?? "arms",
      key: definition?.key ?? "",
      name: definition?.name ?? "",
      sortOrder: definition?.sortOrder ?? 500,
    });
  };

  const toMuscleDefinitionPayload = ():
    | CreateMuscleDefinitionInput
    | UpdateMuscleDefinitionInput => ({
    aliases: muscleDraft.aliases
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean),
    bodyRegion: muscleDraft.bodyRegion.trim(),
    ...(editingMuscleId ? {} : { key: muscleDraft.key.trim() || undefined }),
    name: muscleDraft.name.trim(),
    sortOrder: Number.isFinite(Number(muscleDraft.sortOrder))
      ? Number(muscleDraft.sortOrder)
      : 500,
  });

  const handleSaveMuscleDefinition = async () => {
    if (muscleDraft.name.trim().length < 2) {
      showMessage("Muscle name must be at least 2 characters.");
      return;
    }
    if (muscleDraft.bodyRegion.trim().length < 2) {
      showMessage("Body region must be at least 2 characters.");
      return;
    }

    try {
      if (editingMuscleId) {
        await updateMuscleDefinitionMutation.mutateAsync({
          muscleDefinitionId: editingMuscleId,
          payload: toMuscleDefinitionPayload() as UpdateMuscleDefinitionInput,
        });
        showMessage(`${muscleDraft.name.trim()} was updated.`);
      } else {
        await createMuscleDefinitionMutation.mutateAsync({
          payload: toMuscleDefinitionPayload() as CreateMuscleDefinitionInput,
        });
        showMessage(`${muscleDraft.name.trim()} was added to Muscle Library.`);
      }
      resetMuscleDraft();
    } catch (error) {
      showMessage(getErrorMessage(error, "Unable to save muscle definition."));
    }
  };

  const handleArchiveMuscleDefinition = async (
    definition: MuscleDefinitionRecord,
  ) => {
    try {
      await archiveMuscleDefinitionMutation.mutateAsync({
        muscleDefinitionId: definition.id,
      });
      showMessage(`${definition.name} was archived.`);
      if (editingMuscleId === definition.id) resetMuscleDraft();
    } catch (error) {
      showMessage(getErrorMessage(error, "Unable to archive muscle."));
    }
  };

  const validateDraft = () => {
    const name = draft.name.trim();
    const instructions = draft.instructions.trim();
    const description = draft.description.trim();
    const publishNote = draft.publishNote.trim();

    if (name.length < 3)
      return "Exercise name must be at least 3 characters.";
    if (name.length > 90)
      return "Exercise name must stay under 90 characters.";
    if (duplicateDraftExercise) {
      return `A global exercise named "${duplicateDraftExercise.name}" already exists. Edit that record or choose a clearer name.`;
    }
    if (contractValidation.errors.length) {
      return contractValidation.errors[0];
    }
    if (instructions.length < 12)
      return "Instruction summary needs at least 12 characters.";
    if (description && description.length < 12)
      return "Description must be at least 12 characters or left blank.";
    if (!isValidOptionalHttpUrl(draft.imageUrl))
      return "Image URL must be blank or start with http:// or https://.";
    if (!isValidOptionalHttpUrl(draft.videoUrl))
      return "Video URL must be blank or start with http:// or https://.";
    if (sheetState?.mode === "publish" && publishNote.length < 12)
      return "Publish note needs a short provenance or audit note.";
    return null;
  };
  const draftValidationError = validateDraft();

  const handleSheetSubmit = async () => {
    const nextError = draftValidationError;
    if (nextError) {
      setFormError(nextError);
      return;
    }

    try {
      if (sheetState?.mode === "edit") {
        await updateExerciseMutation.mutateAsync({
          exerciseId: sheetState.exercise.id,
          payload: filterEmptyExerciseDraft(draft),
        });
        showMessage(`${draft.name.trim()} was updated.`);
        closeSheetAfterSave();
        return;
      }

      const createdExercise = await createExerciseMutation.mutateAsync({
        payload: filterEmptyExerciseDraft(draft),
      });

      if (sheetState?.mode === "publish") {
        await updateReviewSubmissionMutation.mutateAsync({
          submissionId: sheetState.candidateId,
          payload: {
            publishedExerciseId: createdExercise.id,
            reviewNotes: draft.publishNote.trim(),
            status: "published",
          },
        });
        showMessage(
          `${createdExercise.name} was published to the global library.`,
        );
      } else {
        showMessage(`${createdExercise.name} was added to the global library.`);
      }

      handleModeChange("library");
      setLibrarySearch(createdExercise.name);
      closeSheetAfterSave();
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to save exercise."));
    }
  };

  const applyMatchReference = (exercise: FitnessExerciseRecord) => {
    setDraft((current) => ({
      ...current,
      category: exercise.category,
      muscleGroup: exercise.muscleGroup,
      muscleTargets: normalizeExerciseMuscleTargets(
        exercise.muscleTargets,
        exercise.muscleGroup,
      ),
      movementProfile: normalizeExerciseMovementProfile(
        exercise.movementProfile,
        current.movementProfile ?? undefined,
      ),
      handShapeProfile: normalizeExerciseHandShapeProfile(
        exercise.handShapeProfile ?? current.handShapeProfile,
      ),
      instructions: exercise.instructions ?? current.instructions,
      description: exercise.description ?? current.description,
    }));
    setMatchDrawerOpen(false);
    showMessage(`Copied taxonomy cues from ${exercise.name}.`);
  };

  const topActionLabel =
    mode === "review"
      ? "Review custom exercise submissions, compare them with existing records, and decide whether they join the global library."
      : mode === "muscles"
          ? "Manage canonical muscle targets used by Exercise Lab and muscle-level progression."
          : "Maintain canonical exercise records used across FitTrack plans and tracking.";
  const confirmationTitle =
    confirmationState?.mode === "discard-sheet"
      ? "Discard changes?"
      : confirmationState?.mode === "leave-private"
        ? "Leave exercise private?"
        : confirmationState?.mode === "archive"
          ? confirmationState.nextActive
            ? "Restore global exercise?"
            : "Archive global exercise?"
          : "";
  const confirmationMessage =
    confirmationState?.mode === "discard-sheet"
      ? "You have unsaved edits in this sheet. Closing now will drop the draft changes."
      : confirmationState?.mode === "leave-private"
        ? `${confirmationState.candidate.title} will leave the publish queue and remain available only as the client's private custom exercise.`
        : confirmationState?.mode === "archive"
          ? confirmationState.nextActive
            ? `${confirmationState.exercise.name} will become available in the active global library again.`
            : `${confirmationState.exercise.name} will be hidden from the active global library, but can still be restored later.`
          : "";
  const confirmationLabel =
    confirmationState?.mode === "discard-sheet"
      ? "Discard changes"
      : confirmationState?.mode === "leave-private"
        ? "Leave private"
        : confirmationState?.mode === "archive"
          ? confirmationState.nextActive
            ? "Restore exercise"
            : "Archive exercise"
          : "Confirm";
  const confirmationLoadingLabel =
    confirmationState?.mode === "leave-private"
      ? "Leaving private..."
      : confirmationState?.mode === "archive"
        ? confirmationState.nextActive
          ? "Restoring..."
          : "Archiving..."
        : undefined;
  const confirmationIcon =
    confirmationState?.mode === "archive" && confirmationState.nextActive
      ? RefreshCcw
      : confirmationState?.mode === "discard-sheet"
        ? X
        : Archive;
  const confirmationLoading =
    confirmationState?.mode === "archive"
      ? updateExerciseMutation.isPending
      : confirmationState?.mode === "leave-private"
        ? updateReviewSubmissionMutation.isPending
        : false;
  const handleConfirmAction = () => {
    if (!confirmationState) return;
    if (confirmationState.mode === "discard-sheet") {
      setConfirmationState(null);
      resetSheet(null);
      return;
    }
    if (confirmationState.mode === "leave-private") {
      void handleLeavePrivate(confirmationState.candidate);
      return;
    }
    void handleArchiveToggle(
      confirmationState.exercise,
      confirmationState.nextActive,
    );
  };

  const openReviewModal = (candidate: ExerciseReviewCandidateLike) => {
    setSelectedCandidateId(candidate.id);
    setReviewModalCandidate(candidate);
  };

  const reviewTableColumns = useMemo<
    FitTableColumn<ExerciseReviewCandidateLike>[]
  >(
    () => [
      {
        key: "submission",
        heading: "Submission",
        render: (candidate) => (
          <div style={{ display: "grid", gap: 3, minWidth: 220 }}>
            <FitText style={{ fontSize: 14, fontWeight: 800 }}>
              {candidate.title}
            </FitText>
            <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
              {candidate.proposedName}
            </FitText>
          </div>
        ),
      },
      {
        key: "creator",
        heading: "Creator",
        render: (candidate) => {
          const tone = getCreatorStateTone(candidate.creatorState);
          const toneColor =
            tone === "success"
              ? colors.success
              : tone === "danger"
                ? colors.danger
                : tone === "warning"
                  ? colors.warning
                  : tone === "brand"
                    ? colors.brand
                    : colors.textMuted;
          return (
            <div style={{ display: "grid", gap: 6, minWidth: 190 }}>
              <FitText style={{ fontSize: 13, fontWeight: 800 }}>
                {candidate.creatorDisplayName ?? "Creator member"}
              </FitText>
              <FitText style={{ fontSize: 11.5, color: colors.textSecondary }}>
                {candidate.creatorEmail ?? "Email unavailable"}
              </FitText>
              <FitPill
                mode="status"
                label={candidate.creatorStateLabel}
                color={toneColor}
                fontSize={11}
                style={{ width: "fit-content" }}
              />
            </div>
          );
        },
      },
      {
        key: "movement",
        heading: "Movement",
        render: (candidate) => (
          <div style={{ display: "grid", gap: 3 }}>
            <FitText style={{ fontSize: 13, fontWeight: 800 }}>
              {toTitleCase(candidate.category)}
            </FitText>
            <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
              {toTitleCase(candidate.muscleGroup)}
            </FitText>
          </div>
        ),
      },
      {
        key: "match",
        heading: "Match",
        render: (candidate) => {
          const match = reviewMatchByCandidateId.get(candidate.id);
          return (
            <div style={{ display: "grid", gap: 3, minWidth: 150 }}>
              <FitText style={{ fontSize: 13, fontWeight: 800 }}>
                {match?.exercise.name ?? candidate.matchHint ?? "Manual review"}
              </FitText>
              <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                {match ? `${Math.max(58, Math.min(96, match.score))}% fit` : "No close match"}
              </FitText>
            </div>
          );
        },
      },
      {
        key: "evidence",
        heading: "Evidence",
        render: (candidate) => (
          <div style={{ display: "grid", gap: 3, minWidth: 150 }}>
            <FitText style={{ fontSize: 13, fontWeight: 800 }}>
              {getEvidenceSummary(candidate.evidenceBars)}
            </FitText>
            <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
              {candidate.sourceLabel}
            </FitText>
          </div>
        ),
      },
      {
        key: "submitted",
        heading: "Submitted",
        render: (candidate) => (
          <FitText style={{ fontSize: 12.5, color: colors.textSecondary }}>
            {formatDate(candidate.createdAt)}
          </FitText>
        ),
      },
      {
        key: "status",
        heading: "Status",
        render: (candidate) => (
          <FitPill
            mode="status"
            label={toTitleCase(candidate.status)}
            color={getReviewStatusColor(candidate.status, colors)}
            fontSize={11}
          />
        ),
      },
    ],
    [colors, reviewMatchByCandidateId],
  );

  const reviewTableActions = useMemo<
    FitTableAction<ExerciseReviewCandidateLike>[]
  >(
    () => [
      {
        label: "Review",
        variant: "ghost",
        icon: PanelRightOpen,
        onClick: openReviewModal,
      },
    ],
    [],
  );

  const renderReviewSurface = () => (
    <FitSection
      heading="Exercise Review Queue"
      action={<Dumbbell size={16} color={colors.brand} />}
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
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
            Review submitted creator exercises, inspect details in a modal, and
            publish approved movements into the global library.
          </FitText>
          <FitPill
            mode="status"
            label={`${reviewMeta?.total ?? 0} ${reviewStatus ? toTitleCase(reviewStatus) : "Total"}`}
            color={colors.brand}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: isCompact
              ? "minmax(0, 1fr)"
              : "minmax(240px, 1.4fr) repeat(3, minmax(150px, 0.7fr))",
          }}
        >
          <FitSearch
            ariaLabel="Search exercise review queue"
            compact
            name="exercise-review-search"
            placeholder="Search exercise, creator, source, or match..."
            value={reviewSearch}
            onChangeText={setReviewSearch}
          />
          <FitSelect
            fullWidth
            aria-label="Exercise review status filter"
            id="exercise-review-status-filter"
            name="exercise-review-status-filter"
            value={reviewStatus}
            options={[...REVIEW_STATUS_OPTIONS]}
            onChange={(event) =>
              setReviewStatus(
                event.target.value as ExerciseReviewSubmissionStatus | "",
              )
            }
          />
          <FitSelect
            fullWidth
            aria-label="Exercise review category filter"
            id="exercise-review-category-filter"
            name="exercise-review-category-filter"
            value={reviewCategory}
            options={[
              { label: "All categories", value: "" },
              ...EXERCISE_CATEGORY_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value,
              })),
            ]}
            onChange={(event) =>
              setReviewCategory(event.target.value as FitnessExerciseCategory | "")
            }
          />
          <FitTextInput
            name="exercise-review-muscle-filter"
            value={reviewMuscleFilter}
            onChange={(event) => setReviewMuscleFilter(event.target.value)}
            placeholder="Muscle group"
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              backgroundColor: colors.fieldBg,
              padding: "0 14px",
              minHeight: 42,
            }}
          />
        </div>

        <FitTable
          columns={reviewTableColumns}
          rows={visibleReviewCandidates}
          getRowKey={(candidate) => candidate.id}
          getRowClassName={(candidate) =>
            candidate.id === selectedCandidateId ? "is-selected" : undefined
          }
          isLoading={reviewQueueQuery.isLoading}
          loadingMessage="Loading exercise review queue..."
          emptyMessage={
            reviewSearch.trim() || reviewCategory || reviewMuscleFilter.trim()
              ? "No exercise submissions match the current filters."
              : "The review queue is clear."
          }
          actions={reviewTableActions}
          onRowClick={openReviewModal}
          maxHeight={null}
        />

        {reviewQueueQuery.isError ? (
          <div
            style={{
              border: `1px solid ${colors.danger}45`,
              borderRadius: 16,
              backgroundColor: `${colors.danger}10`,
              padding: 12,
            }}
          >
            <FitText style={{ color: colors.danger, fontSize: 13 }}>
              {getErrorMessage(
                reviewQueueQuery.error,
                "Unable to load the exercise review queue.",
              )}
            </FitText>
          </div>
        ) : null}

        {reviewMeta ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
              Page {reviewMeta.page} of {Math.max(1, reviewMeta.total_pages)} /{" "}
              {reviewMeta.total} submissions
            </FitText>
            <FitPagination
              ariaLabel="Exercise review table pagination"
              currentPage={reviewMeta.page}
              totalPages={Math.max(1, reviewMeta.total_pages)}
              onPageChange={setReviewPage}
            />
          </div>
        ) : null}
      </div>
    </FitSection>
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
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 18,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surfaceRaised,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 4, maxWidth: 820 }}>
              <FitText
                style={{
                  fontSize: 11.5,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: colors.brand,
                }}
                excludeGlobalScale
              >
                Exercise library controls
              </FitText>
            </div>
            {message ? (
              <FitText style={{ fontSize: 13, color: colors.success }}>
                {message}
              </FitText>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <FitText
              style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.textSecondary,
                  maxWidth: 700,
                  lineHeight: 1.45,
                }}
              >
              {topActionLabel}
            </FitText>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <FitButton
                active={mode === "review"}
                label="Exercise review"
                variant={mode === "review" ? "primary" : "ghost"}
                onClick={() => handleModeChange("review")}
                style={{ minWidth: 126, minHeight: 42 }}
              />
              <FitButton
                active={mode === "library"}
                label="Global library"
                variant={mode === "library" ? "primary" : "ghost"}
                onClick={() => handleModeChange("library")}
                style={{ minWidth: 126, minHeight: 42 }}
              />
              <FitButton
                active={mode === "muscles"}
                label="Muscle Library"
                variant={mode === "muscles" ? "primary" : "ghost"}
                onClick={() => handleModeChange("muscles")}
                style={{ minWidth: 126, minHeight: 42 }}
              />
            </div>
          </div>
        </div>

        {mode === "review" ? (
          renderReviewSurface()
        ) : mode === "milestones" ? (
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: isCompact
                ? "minmax(0, 1fr)"
                : "minmax(236px, 266px) minmax(0, 1fr)",
              alignItems: "stretch",
            }}
          >
            <aside
              style={{
                display: "grid",
                gap: 10,
                gridTemplateRows: "auto auto auto minmax(0, 1fr)",
                minHeight: 0,
                maxHeight: reviewViewportHeight,
                padding: 14,
                borderRadius: 22,
                border: `1px solid ${colors.border}`,
                background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
                boxShadow: "0 18px 34px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <FitText style={{ fontSize: 18, fontWeight: 800 }}>
                  Milestone queue
                </FitText>
                <FitText style={{ fontSize: 11.5, color: colors.brand }}>
                  member progression claims awaiting moderation
                </FitText>
              </div>

              <FitPill
                mode="toggle"
                active={milestoneScope}
                onChange={(value) =>
                  handleMilestoneScopeChange(value as MilestoneScope)
                }
                options={[
                  {
                    key: "pending",
                    label: `Pending (${pendingMilestoneCount})`,
                  },
                  {
                    key: "closed",
                    label: `Closed (${closedMilestoneCount})`,
                  },
                  { key: "all", label: "All" },
                ]}
              />

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  backgroundColor: `${colors.warning}18`,
                  border: `1px solid ${colors.warning}35`,
                  justifySelf: "start",
                }}
              >
                <Sparkles size={13} color={colors.warning} />
                <FitText
                  style={{
                    fontSize: 10.5,
                    color: colors.warning,
                    fontWeight: 700,
                  }}
                >
                  workout achievements tied to the rep-tracking progression flow
                </FitText>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  minHeight: 0,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {filteredMilestones.length ? (
                  filteredMilestones.map((review, index) => {
                    const isActive = review.id === selectedMilestone?.id;
                    const queueAnimationDelay = fullMotion
                      ? `${Math.min(index, 5) * 38}ms`
                      : `${Math.min(index, 5) * 24}ms`;
                    const statusColor =
                      ACHIEVEMENT_REVIEW_STATUS_COLORS[review.status] ??
                      colors.textMuted;
                    return (
                      <button
                        key={review.id}
                        className={
                          canAnimate
                            ? "exercise-lab-queue-card exercise-lab-queue-card--animated"
                            : "exercise-lab-queue-card"
                        }
                        type="button"
                        onClick={() => setSelectedMilestoneId(review.id)}
                        style={{
                          display: "grid",
                          gap: 8,
                          padding: 14,
                          borderRadius: 18,
                          border: `1px solid ${
                            isActive ? `${colors.brand}AA` : colors.border
                          }`,
                          backgroundColor: isActive
                            ? `${colors.brand}12`
                            : colors.surface,
                          boxShadow: isActive
                            ? "0 12px 26px rgba(0,0,0,0.16)"
                            : "none",
                          textAlign: "left",
                          cursor: "pointer",
                          ...(canAnimate
                            ? { animationDelay: queueAnimationDelay }
                            : {}),
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              backgroundColor: `${colors.brand}12`,
                              border: `1px solid ${colors.brand}30`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <FileText size={14} color={colors.brand} />
                          </div>
                          <div
                            style={{
                              minWidth: 0,
                              display: "grid",
                              gap: 4,
                              flex: 1,
                            }}
                          >
                            <FitText style={{ fontSize: 14, fontWeight: 700 }}>
                              {review.badgeLabel}
                            </FitText>
                            <FitText
                              style={{
                                fontSize: 11.5,
                                color: colors.textSecondary,
                              }}
                            >
                              {review.memberName.toLowerCase()} /{" "}
                              {review.status === "Pending"
                                ? "proof submitted"
                                : "closed review"}
                            </FitText>
                          </div>
                          <div
                            style={{
                              width: 3,
                              minHeight: 46,
                              borderRadius: 999,
                              backgroundColor: isActive
                                ? colors.brand
                                : `${statusColor}66`,
                            }}
                          />
                        </div>
                        <div
                          style={{
                            justifySelf: "start",
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: `1px solid ${statusColor}55`,
                            backgroundColor: `${statusColor}16`,
                          }}
                        >
                          <FitText style={{ fontSize: 10, color: statusColor }}>
                            {review.status.toLowerCase()}
                          </FitText>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div
                    style={{
                      padding: 18,
                      borderRadius: 20,
                      border: `1px dashed ${colors.border}`,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <FitText
                      style={{ fontSize: 13, color: colors.textSecondary }}
                    >
                      No milestone claims match the current filter.
                    </FitText>
                  </div>
                )}
              </div>
            </aside>

            <section
              style={{
                display: "grid",
                gap: 12,
                minHeight: 0,
                padding: 14,
                borderRadius: 22,
                border: `1px solid ${colors.border}`,
                background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
                boxShadow: "0 18px 34px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: `1px solid rgba(46, 196, 242, 0.3)`,
                      backgroundColor: "rgba(46, 196, 242, 0.15)",
                    }}
                  >
                    <FitText style={{ fontSize: 10, color: "#7DE2FF" }}>
                      Pending queue
                    </FitText>
                  </div>
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: `1px solid ${colors.brand}30`,
                      backgroundColor: `${colors.brand}10`,
                    }}
                  >
                    <FitText style={{ fontSize: 10, color: colors.brand }}>
                      Closed reviews
                    </FitText>
                  </div>
                </div>
                <FitText style={{ fontSize: 20, fontWeight: 800 }}>
                  Milestone review
                </FitText>
                <FitText
                  style={{ fontSize: 11.5, color: colors.textSecondary }}
                >
                  Inspect proof, member context, and reviewer notes before
                  approving or rejecting the milestone claim.
                </FitText>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                {selectedMilestone ? (
                  <div
                    key={milestoneWorkbenchMotionKey}
                    className={
                      canAnimate
                        ? "exercise-lab-workbench-body exercise-lab-workbench-body--animated"
                        : "exercise-lab-workbench-body"
                    }
                    style={{ display: "grid", gap: 14 }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: isCompact
                          ? "minmax(0, 1fr)"
                          : "minmax(0, 1fr) minmax(300px, 400px)",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          padding: 14,
                          borderRadius: 22,
                          border: `1px solid ${colors.border}`,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <div
                          style={{
                            justifySelf: "start",
                            padding: "5px 12px",
                            borderRadius: 999,
                            border: `1px solid ${colors.brand}35`,
                            backgroundColor: `${colors.brand}10`,
                          }}
                        >
                          <FitText
                            style={{ fontSize: 10, color: colors.brand }}
                          >
                            proof image
                          </FitText>
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          <FitText style={{ fontSize: 16, fontWeight: 800 }}>
                            Proof preview
                          </FitText>
                          <FitText
                            style={{
                              fontSize: 11,
                              color: colors.textSecondary,
                            }}
                          >
                            submitted workout proof / achievement evidence
                          </FitText>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gap: 10,
                            borderRadius: 18,
                            border: `1px solid ${colors.border}`,
                            backgroundColor: colors.surfaceRaised,
                            padding: 16,
                          }}
                        >
                          <img
                            src={selectedMilestone.proofImageUrl}
                            alt={`${selectedMilestone.badgeLabel} proof preview`}
                            style={{
                              width: "100%",
                              height: 170,
                              objectFit: "cover",
                              borderRadius: 16,
                              border: `1px solid ${colors.border}`,
                            }}
                          />
                          <FitText
                            style={{
                              fontSize: 11.5,
                              color: colors.textSecondary,
                            }}
                          >
                            {selectedMilestone.proofCaption}
                          </FitText>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          padding: 14,
                          borderRadius: 22,
                          border: `1px solid ${colors.border}`,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <FitText style={{ fontSize: 16, fontWeight: 800 }}>
                          Claim summary
                        </FitText>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 18,
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              width: 68,
                              height: 68,
                              borderRadius: "50%",
                              border: `3px solid ${colors.brand}`,
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                placeItems: "center",
                              }}
                            >
                              <FitText
                                style={{
                                  fontSize: 22,
                                  fontWeight: 800,
                                  color: colors.textPrimary,
                                }}
                              >
                                {selectedMilestoneMetric?.value}
                              </FitText>
                              <FitText
                                style={{
                                  fontSize: 9.5,
                                  color: colors.textMuted,
                                }}
                              >
                                {selectedMilestoneMetric?.label}
                              </FitText>
                            </div>
                          </div>
                          <div style={{ display: "grid", gap: 10 }}>
                            {[
                              getMilestonePrimaryTag(selectedMilestone),
                              getMilestoneSecondaryTag(selectedMilestone),
                            ].map((tag) => (
                              <div
                                key={tag}
                                style={{
                                  padding: "5px 12px",
                                  borderRadius: 999,
                                  border: `1px solid ${colors.brand}35`,
                                  backgroundColor: `${colors.brand}10`,
                                  justifySelf: "start",
                                }}
                              >
                                <FitText
                                  style={{
                                    fontSize: 11,
                                    color: colors.textPrimary,
                                  }}
                                >
                                  {tag.toLowerCase()}
                                </FitText>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenClosedMilestones}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "14px 18px",
                            borderRadius: 16,
                            border: `1px solid rgba(82, 102, 133, 0.75)`,
                            backgroundColor: "rgba(46, 56, 71, 0.95)",
                            color: "#dbe8f7",
                            cursor: "pointer",
                          }}
                        >
                          <span>Open claim history</span>
                          <PanelRightOpen size={16} />
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 14,
                        gridTemplateColumns: isCompact
                          ? "minmax(0, 1fr)"
                          : "minmax(0, 1fr) minmax(0, 1fr)",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gap: 6,
                          padding: 14,
                          borderRadius: 20,
                          border: `1px solid ${colors.border}`,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              backgroundColor: `${colors.brand}12`,
                              border: `1px solid ${colors.brand}30`,
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <FileText size={13} color={colors.brand} />
                          </div>
                          <FitText style={{ fontSize: 16, fontWeight: 700 }}>
                            Member context
                          </FitText>
                        </div>
                        <FitText
                          style={{
                            fontSize: 11.5,
                            color: colors.textSecondary,
                          }}
                        >
                          member: {selectedMilestone.memberName.toLowerCase()}
                        </FitText>
                        <FitText
                          style={{
                            fontSize: 11.5,
                            color: colors.textSecondary,
                          }}
                        >
                          source: workout progression
                        </FitText>
                        <FitText
                          style={{
                            fontSize: 11.5,
                            color: colors.textSecondary,
                          }}
                        >
                          submitted: {formatDate(selectedMilestone.submittedAt)}
                        </FitText>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 6,
                          padding: 14,
                          borderRadius: 20,
                          border: `1px solid ${colors.border}`,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              backgroundColor: `${colors.brand}12`,
                              border: `1px solid ${colors.brand}30`,
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <ShieldCheck size={13} color={colors.brand} />
                          </div>
                          <FitText style={{ fontSize: 16, fontWeight: 700 }}>
                            Review state
                          </FitText>
                        </div>
                        <FitText
                          style={{
                            fontSize: 11.5,
                            color: colors.textSecondary,
                          }}
                        >
                          status: {selectedMilestone.status.toLowerCase()}
                        </FitText>
                        <FitText
                          style={{
                            fontSize: 11.5,
                            color: colors.textSecondary,
                          }}
                        >
                          reviewer note:{" "}
                          {selectedMilestone.reviewerNotes?.trim() ||
                            "proof matches log"}
                        </FitText>
                        <FitText
                          style={{
                            fontSize: 11.5,
                            color: colors.textSecondary,
                          }}
                        >
                          reviewed:{" "}
                          {formatDateTime(selectedMilestone.reviewedAt)}
                        </FitText>
                      </div>
                    </div>

                    <div
                      className={
                        canAnimate
                          ? "exercise-lab-action-dock exercise-lab-action-dock--animated"
                          : "exercise-lab-action-dock"
                      }
                      style={{
                        display: "grid",
                        gap: 10,
                        padding: 14,
                        borderRadius: 20,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.surface,
                        boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
                      }}
                    >
                      <div
                        style={{
                          height: 4,
                          borderRadius: 999,
                          backgroundColor: colors.brand,
                        }}
                      />
                      <div
                        style={{
                          display: "grid",
                          gap: 14,
                          gridTemplateColumns: isCompact
                            ? "minmax(0, 1fr)"
                            : "minmax(0, 1.1fr) minmax(0, 0.9fr)",
                        }}
                      >
                        <ExerciseLabField
                          label="Reviewer note"
                          hint="Required before rejecting. Saved with the moderation decision."
                        >
                          <div
                            style={{
                              borderRadius: 14,
                              border: `1px solid ${colors.border}`,
                              backgroundColor: colors.fieldBg,
                              padding: "12px 14px",
                            }}
                          >
                            <FitTextArea
                              name="milestoneReviewerNotes"
                              rows={3}
                              value={milestoneNotes}
                              onChange={(event) =>
                                setMilestoneNotes(event.target.value)
                              }
                              placeholder="Add a note for the claim audit trail."
                            />
                          </div>
                        </ExerciseLabField>

                        <div
                          style={{
                            display: "grid",
                            gap: 10,
                            gridTemplateColumns: isCompact
                              ? "minmax(0, 1fr)"
                              : "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.85fr)",
                          }}
                        >
                          <FitButton
                            label="Approve claim"
                            variant="primary"
                            onClick={() => handleMilestoneDecision("Approved")}
                            disabled={selectedMilestone.status !== "Pending"}
                            style={{
                              minHeight: 64,
                              justifyContent: "flex-start",
                              paddingInline: 16,
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                textAlign: "left",
                                gap: 4,
                              }}
                            >
                              <span style={{ fontWeight: 800 }}>
                                Approve claim
                              </span>
                              <span style={{ fontSize: 11, opacity: 0.82 }}>
                                mark milestone earned
                              </span>
                            </div>
                          </FitButton>
                          <FitButton
                            label="Closed reviews"
                            variant="ghost"
                            onClick={handleOpenClosedMilestones}
                            style={{
                              minHeight: 64,
                              justifyContent: "flex-start",
                              paddingInline: 16,
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                textAlign: "left",
                                gap: 2,
                              }}
                            >
                              <span style={{ fontWeight: 800 }}>
                                Closed reviews
                              </span>
                              <span style={{ fontSize: 10.5, opacity: 0.82 }}>
                                see recent decisions
                              </span>
                            </div>
                          </FitButton>
                          <FitButton
                            label="Reject claim"
                            variant="ghost"
                            onClick={() => handleMilestoneDecision("Rejected")}
                            disabled={selectedMilestone.status !== "Pending"}
                            style={{
                              minHeight: 64,
                              justifyContent: "flex-start",
                              paddingInline: 16,
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                textAlign: "left",
                                gap: 2,
                              }}
                            >
                              <span style={{ fontWeight: 800 }}>
                                Reject claim
                              </span>
                              <span style={{ fontSize: 10.5, opacity: 0.82 }}>
                                decline submission
                              </span>
                            </div>
                          </FitButton>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: 20,
                      borderRadius: 24,
                      border: `1px dashed ${colors.border}`,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <FitText
                      style={{ fontSize: 14, color: colors.textSecondary }}
                    >
                      No milestone claims match the current filter.
                    </FitText>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : mode === "muscles" ? (
          <section
            style={{
              display: "grid",
              gap: 18,
              padding: 22,
              borderRadius: 28,
              border: `1px solid ${colors.border}`,
              background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
              boxShadow: "0 18px 34px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <FitText style={{ fontSize: 28, fontWeight: 800 }}>
                  Muscle Library
                </FitText>
                <FitText
                  style={{ fontSize: 13.5, color: colors.textSecondary }}
                >
                  Canonical muscles used by Muscle Effort XP, rankings, and
                  exercise matching. Add missing muscles here, not inside the
                  exercise modal.
                </FitText>
              </div>
              <FitButton
                icon={RefreshCcw}
                label="Refresh"
                variant="ghost"
                onClick={() => void muscleDefinitionsQuery.refetch()}
              />
            </div>

            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: isCompact
                  ? "minmax(0, 1fr)"
                  : "minmax(300px, 390px) minmax(0, 1fr)",
              }}
            >
              <aside
                style={{
                  display: "grid",
                  gap: 12,
                  alignSelf: "start",
                  padding: 18,
                  borderRadius: 22,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText style={{ fontSize: 18, fontWeight: 800 }}>
                  {editingMuscleId ? "Edit muscle" : "Add muscle"}
                </FitText>
                <FitText
                  style={{ fontSize: 12.5, color: colors.textSecondary }}
                >
                  Keys are normalized identifiers such as `front_delts`; names
                  are what admins see in Exercise Lab.
                </FitText>
                <FitTextInput
                  name="muscle-definition-name"
                  placeholder="Muscle name, e.g. Biceps"
                  value={muscleDraft.name}
                  onChange={(event) =>
                    setMuscleDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    width: "100%",
                  }}
                />
                <FitTextInput
                  disabled={Boolean(editingMuscleId)}
                  name="muscle-definition-key"
                  placeholder="Optional key, auto-generated if blank"
                  value={muscleDraft.key}
                  onChange={(event) =>
                    setMuscleDraft((current) => ({
                      ...current,
                      key: event.target.value,
                    }))
                  }
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    opacity: editingMuscleId ? 0.55 : 1,
                    padding: "12px 14px",
                    width: "100%",
                  }}
                />
                <FitTextInput
                  name="muscle-definition-region"
                  placeholder="Body region, e.g. arms"
                  value={muscleDraft.bodyRegion}
                  onChange={(event) =>
                    setMuscleDraft((current) => ({
                      ...current,
                      bodyRegion: event.target.value,
                    }))
                  }
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    width: "100%",
                  }}
                />
                <FitTextInput
                  name="muscle-definition-aliases"
                  placeholder="Aliases separated by comma"
                  value={muscleDraft.aliases}
                  onChange={(event) =>
                    setMuscleDraft((current) => ({
                      ...current,
                      aliases: event.target.value,
                    }))
                  }
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    width: "100%",
                  }}
                />
                <FitTextInput
                  name="muscle-definition-sort-order"
                  placeholder="Sort order"
                  type="number"
                  value={String(muscleDraft.sortOrder)}
                  onChange={(event) =>
                    setMuscleDraft((current) => ({
                      ...current,
                      sortOrder: Number(event.target.value),
                    }))
                  }
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    width: "100%",
                  }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <FitButton
                    label={editingMuscleId ? "Save muscle" : "Create muscle"}
                    loading={
                      createMuscleDefinitionMutation.isPending ||
                      updateMuscleDefinitionMutation.isPending
                    }
                    onClick={() => void handleSaveMuscleDefinition()}
                  />
                  <FitButton
                    label="Reset"
                    variant="ghost"
                    onClick={() => resetMuscleDraft()}
                  />
                </div>
              </aside>

              <div style={{ display: "grid", gap: 14 }}>
                <FitSearch
                  ariaLabel="Search muscle library"
                  name="muscle-library-search"
                  placeholder="Search muscles, aliases, or body region..."
                  value={muscleSearch}
                  onChangeText={setMuscleSearch}
                />

                {muscleDefinitionsQuery.isLoading ? (
                  <div
                    style={{
                      padding: 18,
                      borderRadius: 22,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <FitText
                      style={{ fontSize: 14, color: colors.textSecondary }}
                    >
                      Loading muscle definitions...
                    </FitText>
                  </div>
                ) : muscleDefinitionsQuery.isError ? (
                  <div
                    style={{
                      padding: 18,
                      borderRadius: 22,
                      border: `1px solid ${colors.danger}40`,
                      backgroundColor: `${colors.danger}10`,
                    }}
                  >
                    <FitText style={{ fontSize: 14, color: colors.danger }}>
                      {getErrorMessage(
                        muscleDefinitionsQuery.error,
                        "Unable to load Muscle Library.",
                      )}
                    </FitText>
                  </div>
                ) : muscleDefinitions.length ? (
                  muscleDefinitions.map((definition) => (
                    <article
                      key={definition.id}
                      style={{
                        display: "grid",
                        gap: 10,
                        padding: 16,
                        borderRadius: 20,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "grid", gap: 4 }}>
                          <FitText style={{ fontSize: 17, fontWeight: 800 }}>
                            {definition.name}
                          </FitText>
                          <FitText
                            style={{
                              fontSize: 12.5,
                              color: colors.textSecondary,
                            }}
                          >
                            {definition.key} / {toTitleCase(definition.bodyRegion)}
                          </FitText>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <FitButton
                            icon={Pencil}
                            label="Edit"
                            variant="ghost"
                            onClick={() => resetMuscleDraft(definition)}
                          />
                          {definition.isActive ? (
                            <FitButton
                              icon={Archive}
                              label="Archive"
                              variant="ghost"
                              loading={archiveMuscleDefinitionMutation.isPending}
                              onClick={() =>
                                void handleArchiveMuscleDefinition(definition)
                              }
                            />
                          ) : (
                            <FitButton
                              icon={RefreshCcw}
                              label="Restore"
                              variant="ghost"
                              loading={updateMuscleDefinitionMutation.isPending}
                              onClick={() =>
                                void updateMuscleDefinitionMutation
                                  .mutateAsync({
                                    muscleDefinitionId: definition.id,
                                    payload: {
                                      isActive: true,
                                    } satisfies UpdateMuscleDefinitionInput,
                                  })
                                  .then(() =>
                                    showMessage(
                                      `${definition.name} was restored.`,
                                    ),
                                  )
                                  .catch((error) =>
                                    showMessage(
                                      getErrorMessage(
                                        error,
                                        "Unable to restore muscle.",
                                      ),
                                    ),
                                  )
                              }
                            />
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            border: `1px solid ${
                              definition.isActive
                                ? `${colors.success}44`
                                : colors.border
                            }`,
                            borderRadius: 999,
                            color: definition.isActive
                              ? colors.success
                              : colors.textMuted,
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "5px 9px",
                          }}
                        >
                          {definition.isActive ? "Active" : "Archived"}
                        </span>
                        {definition.isSystem ? (
                          <span
                            style={{
                              border: `1px solid ${colors.brand}33`,
                              borderRadius: 999,
                              color: colors.brand,
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "5px 9px",
                            }}
                          >
                            System
                          </span>
                        ) : null}
                        {definition.aliases.map((alias) => (
                          <span
                            key={alias}
                            style={{
                              border: `1px solid ${colors.border}`,
                              borderRadius: 999,
                              color: colors.textMuted,
                              fontSize: 11,
                              padding: "5px 9px",
                            }}
                          >
                            {alias}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <div
                    style={{
                      padding: 20,
                      borderRadius: 22,
                      border: `1px dashed ${colors.border}`,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <FitText
                      style={{ fontSize: 14, color: colors.textSecondary }}
                    >
                      No muscle definitions match the current search.
                    </FitText>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section
            style={{
              display: "grid",
              gap: 18,
              padding: 22,
              borderRadius: 28,
              border: `1px solid ${colors.border}`,
              background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
              boxShadow: "0 18px 34px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <FitText style={{ fontSize: 28, fontWeight: 800 }}>
                  Global library
                </FitText>
                <FitText
                  style={{ fontSize: 13.5, color: colors.textSecondary }}
                >
                  Search, edit, archive, and restore canonical FitTrack exercise
                  records.
                </FitText>
              </div>
              <FitButton
                icon={Plus}
                label="Create global exercise"
                onClick={handleOpenCreate}
              />
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: isCompact
                  ? "minmax(0, 1fr)"
                  : "minmax(260px, 360px) minmax(180px, 220px) auto auto",
              }}
            >
              <FitSearch
                ariaLabel="Search global exercises"
                name="exercise-library-search"
                placeholder="Search exercise name, muscle group, or notes..."
                value={librarySearch}
                onChangeText={setLibrarySearch}
              />
              <FitSelect
                fullWidth
                name="exercise-library-category"
                value={libraryCategory}
                onChange={(event) => setLibraryCategory(event.target.value)}
                options={EXERCISE_CATEGORY_OPTIONS.map((option) => ({
                  label: option.label,
                  value: option.value,
                }))}
                placeholder="All categories"
              />
              <FitPill
                mode="toggle"
                active={libraryScope}
                onChange={setLibraryScope}
                options={[
                  { key: "active", label: "Active only" },
                  { key: "all", label: "Include archived" },
                ]}
              />
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  justifyContent: isCompact ? "flex-start" : "flex-end",
                }}
              >
                <FitButton
                  icon={RefreshCcw}
                  label="Refresh"
                  variant="ghost"
                  onClick={() => void libraryQuery.refetch()}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              {libraryQuery.isLoading ? (
                <div
                  style={{
                    padding: 18,
                    borderRadius: 22,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                  }}
                >
                  <FitText
                    style={{ fontSize: 14, color: colors.textSecondary }}
                  >
                    Loading global exercise records...
                  </FitText>
                </div>
              ) : libraryQuery.isError ? (
                <div
                  style={{
                    padding: 18,
                    borderRadius: 22,
                    border: `1px solid ${colors.danger}40`,
                    backgroundColor: `${colors.danger}10`,
                  }}
                >
                  <FitText style={{ fontSize: 14, color: colors.danger }}>
                    {getErrorMessage(
                      libraryQuery.error,
                      "Unable to load the global exercise library.",
                    )}
                  </FitText>
                </div>
              ) : libraryItems.length ? (
                libraryItems.map((exercise) => (
                  <article
                    key={exercise.id}
                    style={{
                      display: "grid",
                      gap: 14,
                      padding: 18,
                      borderRadius: 24,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surface,
                      boxShadow: "0 14px 28px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <FitText style={{ fontSize: 20, fontWeight: 800 }}>
                            {exercise.name}
                          </FitText>
                          <div
                            style={{
                              padding: "4px 10px",
                              borderRadius: 999,
                              border: `1px solid ${colors.brand}35`,
                              backgroundColor: `${colors.brand}10`,
                            }}
                          >
                            <FitText
                              style={{
                                fontSize: 11,
                                color: colors.textPrimary,
                              }}
                            >
                              {toTitleCase(exercise.category)}
                            </FitText>
                          </div>
                          <div
                            style={{
                              padding: "4px 10px",
                              borderRadius: 999,
                              border: `1px solid ${
                                exercise.isActive
                                  ? `${colors.success}35`
                                  : `${colors.border}`
                              }`,
                              backgroundColor: exercise.isActive
                                ? `${colors.success}12`
                                : colors.surfaceRaised,
                            }}
                          >
                            <FitText
                              style={{
                                fontSize: 11,
                                color: exercise.isActive
                                  ? colors.success
                                  : colors.textMuted,
                              }}
                            >
                              {exercise.isActive ? "Active" : "Archived"}
                            </FitText>
                          </div>
                        </div>
                        <FitText
                          style={{ fontSize: 13, color: colors.textSecondary }}
                        >
                          {toTitleCase(exercise.muscleGroup)} / Updated{" "}
                          {formatDate(exercise.updatedAt)}
                        </FitText>
                        <FitText
                          style={{
                            fontSize: 13.5,
                            color: colors.textSecondary,
                          }}
                        >
                          {exercise.description ?? "No description saved yet."}
                        </FitText>
                      </div>
                      <div
                        style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                      >
                        <FitButton
                          icon={Pencil}
                          label="Edit"
                          variant="ghost"
                          onClick={() => handleOpenEdit(exercise)}
                        />
                        <FitButton
                          icon={exercise.isActive ? Archive : RefreshCcw}
                          label={exercise.isActive ? "Archive" : "Restore"}
                          variant="ghost"
                          onClick={() =>
                            setConfirmationState({
                              exercise,
                              mode: "archive",
                              nextActive: !exercise.isActive,
                            })
                          }
                        />
                      </div>
                    </div>
                    {exercise.instructions ? (
                      <div
                        style={{
                          padding: 14,
                          borderRadius: 18,
                          backgroundColor: colors.surfaceRaised,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <FitText
                          style={{ fontSize: 12, color: colors.textMuted }}
                        >
                          Instruction summary
                        </FitText>
                        <FitText
                          style={{
                            fontSize: 13.5,
                            color: colors.textSecondary,
                          }}
                        >
                          {exercise.instructions}
                        </FitText>
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div
                  style={{
                    padding: 20,
                    borderRadius: 22,
                    border: `1px dashed ${colors.border}`,
                    backgroundColor: colors.surface,
                  }}
                >
                  <FitText
                    style={{ fontSize: 14, color: colors.textSecondary }}
                  >
                    No global exercises match the current filters yet.
                  </FitText>
                </div>
              )}
            </div>

            {libraryMeta && libraryMeta.total_pages > 1 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <FitText
                  style={{ fontSize: 12.5, color: colors.textSecondary }}
                >
                  Showing page {libraryMeta.page} of {libraryMeta.total_pages} /{" "}
                  {libraryMeta.total} total exercises
                </FitText>
                <FitPagination
                  ariaLabel="Exercise library pagination"
                  currentPage={libraryMeta.page}
                  totalPages={libraryMeta.total_pages}
                  onPageChange={setLibraryPage}
                />
              </div>
            ) : null}
          </section>
        )}
      </div>

      <FitModal
        isOpen={reviewModalCandidate !== null}
        onClose={() => setReviewModalCandidate(null)}
        title="Exercise review"
        subtitle="Inspect the submitted movement, govern the creator state, and choose the review outcome."
        icon={PanelRightOpen}
        maxWidth={980}
        footer={
          selectedCandidate ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                width: "100%",
              }}
            >
              <FitButton
                label="Reject"
                variant="danger"
                disabled={selectedCandidate.status !== "pending" || sheetPending}
                onClick={() => {
                  setRejectRationale("");
                  setRejectValidationError(null);
                  setRejectTarget(selectedCandidate);
                }}
              />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <FitButton
                  label="Keep private"
                  variant="ghost"
                  disabled={selectedCandidate.status !== "pending" || sheetPending}
                  onClick={() =>
                    setConfirmationState({
                      candidate: selectedCandidate,
                      mode: "leave-private",
                    })
                  }
                />
                <FitButton
                  label="Review & Publish"
                  variant="primary"
                  disabled={selectedCandidate.status !== "pending" || sheetPending}
                  onClick={() => handleOpenPublish(selectedCandidate)}
                />
              </div>
            </div>
          ) : undefined
        }
      >
        {selectedCandidate ? (
          <div
            key={workbenchMotionKey}
            className={
              canAnimate
                ? "exercise-lab-workbench-body exercise-lab-workbench-body--animated"
                : "exercise-lab-workbench-body"
            }
            style={{ display: "grid", gap: 16 }}
          >
            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: isCompact
                  ? "minmax(0, 1fr)"
                  : "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  padding: 16,
                  borderRadius: 20,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
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
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ fontSize: 18, fontWeight: 900 }}>
                      {selectedCandidate.title}
                    </FitText>
                    <FitText style={{ fontSize: 12.5, color: colors.textSecondary }}>
                      {selectedCandidate.summary}
                    </FitText>
                  </div>
                  <FitPill
                    mode="status"
                    label={toTitleCase(selectedCandidate.status)}
                    color={getReviewStatusColor(selectedCandidate.status, colors)}
                  />
                </div>
                <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
                  Proposed global name:{" "}
                  <strong style={{ color: colors.textPrimary }}>
                    {selectedCandidate.proposedName}
                  </strong>
                </FitText>
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 16,
                    backgroundColor: colors.surfaceRaised,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "end",
                      gap: 8,
                      height: 48,
                    }}
                  >
                    {getEvidenceBars(selectedCandidate.evidenceBars).map(
                      (value, index) => (
                        <div
                          key={`${value}-${index}`}
                          style={{
                            width: 16,
                            height: Math.max(12, Math.min(44, value)),
                            borderRadius: 999,
                            backgroundColor:
                              index === 2 ? colors.brand : `${colors.brand}35`,
                          }}
                        />
                      ),
                    )}
                  </div>
                  <FitText
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      color: colors.textSecondary,
                    }}
                  >
                    {getEvidenceSummary(selectedCandidate.evidenceBars)}
                  </FitText>
                </div>
                <FitText style={{ fontSize: 12.5, color: colors.textSecondary }}>
                  {selectedCandidate.description ?? "No longer-form description submitted."}
                </FitText>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 16,
                  borderRadius: 20,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                  alignContent: "start",
                }}
              >
                <FitText style={{ fontSize: 16, fontWeight: 900 }}>
                  Closest match
                </FitText>
                {closestMatch ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div>
                        <FitText style={{ fontSize: 15, fontWeight: 800 }}>
                          {closestMatch.name}
                        </FitText>
                        <FitText
                          style={{ fontSize: 12, color: colors.textSecondary }}
                        >
                          {toTitleCase(closestMatch.category)} /{" "}
                          {toTitleCase(closestMatch.muscleGroup)}
                        </FitText>
                      </div>
                      <FitPill
                        mode="status"
                        label={`${Math.max(58, Math.min(96, matchSuggestions[0]?.score ?? 58))}% fit`}
                        color={colors.brand}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {matchSuggestions.slice(1, 4).map(({ exercise, score }) => (
                        <div
                          key={exercise.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 14,
                            padding: 10,
                            backgroundColor: colors.surfaceRaised,
                          }}
                        >
                          <FitText style={{ fontSize: 12.5, fontWeight: 800 }}>
                            {exercise.name}
                          </FitText>
                          <FitText
                            style={{ fontSize: 12, color: colors.textSecondary }}
                          >
                            {Math.max(58, Math.min(96, score))}% fit
                          </FitText>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
                    No close global exercise surfaced. Use the publish editor to
                    create a new canonical movement if the contract is clean.
                  </FitText>
                )}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: isCompact
                  ? "minmax(0, 1fr)"
                  : "repeat(2, minmax(0, 1fr))",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  borderRadius: 18,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText style={{ fontSize: 15, fontWeight: 800 }}>
                  Client submission
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  source: {selectedCandidate.originLabel}
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  trigger: {selectedCandidate.triggerLabel}
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  muscle: {toTitleCase(selectedCandidate.muscleGroup)}
                </FitText>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  borderRadius: 18,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText style={{ fontSize: 15, fontWeight: 800 }}>
                  Contract details
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  instructions:{" "}
                  {selectedCandidate.instructions ?? "No instructions submitted."}
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  reviewed: {formatDateTime(selectedCandidate.reviewedAt ?? undefined)}
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  note: {selectedCandidate.reviewNotes ?? "No review note yet."}
                </FitText>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                padding: 14,
                borderRadius: 18,
                border: `1px solid ${selectedCreatorToneColor}45`,
                background: `linear-gradient(135deg, ${selectedCreatorToneColor}12 0%, ${colors.surface} 74%)`,
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
                <div style={{ display: "grid", gap: 4 }}>
                  <FitText style={{ fontSize: 16, fontWeight: 900 }}>
                    Creator governance
                  </FitText>
                  <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                    {selectedCandidate.creatorDisplayName ?? "Creator member"} /{" "}
                    {selectedCandidate.creatorEmail ?? "email unavailable"}
                  </FitText>
                </div>
                <FitPill
                  mode="status"
                  label={selectedCandidate.creatorStateLabel}
                  color={selectedCreatorToneColor}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "repeat(4, minmax(0, 1fr))",
                }}
              >
                {[
                  ["Submissions", selectedCandidate.creatorSubmissionCount],
                  ["Published", selectedCandidate.creatorPublishedCount],
                  ["Rejected", selectedCandidate.creatorRejectedCount],
                  ["Candidate score", selectedCandidate.creatorCandidateScore],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 14,
                      backgroundColor: colors.surfaceRaised,
                      padding: 12,
                    }}
                  >
                    <FitText style={{ fontSize: 10, color: colors.textMuted }}>
                      {label}
                    </FitText>
                    <FitText style={{ fontSize: 20, fontWeight: 900 }}>
                      {value}
                    </FitText>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "minmax(220px, 0.6fr) minmax(0, 1fr) auto",
                  alignItems: "start",
                }}
              >
                <FitSelect
                  name="creatorState"
                  fullWidth
                  value={creatorStateDraft}
                  options={[...CREATOR_STATE_OPTIONS]}
                  onChange={(event) =>
                    setCreatorStateDraft(
                      event.target.value as FitnessCreatorState,
                    )
                  }
                />
                <FitTextArea
                  name="creatorGovernanceNote"
                  value={creatorGovernanceNote}
                  onChange={(event) => setCreatorGovernanceNote(event.target.value)}
                  placeholder="Rationale for creator standing or escalation note"
                  rows={3}
                />
                <FitButton
                  label="Save creator"
                  variant="ghost"
                  disabled={sheetPending}
                  loading={updateReviewSubmissionMutation.isPending}
                  onClick={handleCreatorGovernanceUpdate}
                  style={{ minHeight: 42 }}
                />
              </div>
              <FitText style={{ fontSize: 11.5, color: colors.textSecondary }}>
                Last state change:{" "}
                {formatDateTime(
                  selectedCandidate.creatorLastStateChangedAt ?? undefined,
                )}
              </FitText>
            </div>
          </div>
        ) : null}
      </FitModal>

      <FitModal
        isOpen={sheetState !== null}
        onClose={handleCloseSheet}
        title={
          sheetState?.mode === "publish"
            ? "Publish to global"
            : sheetState?.mode === "edit"
              ? "Edit global exercise"
              : "Create global exercise"
        }
        subtitle={
          sheetState?.mode === "publish"
            ? "Convert a client custom exercise into a reusable FitTrack movement."
            : sheetState?.mode === "edit"
              ? "Update taxonomy, guidance, and active state for an existing global record."
              : "Create a canonical exercise that other users can access."
        }
        icon={sheetState?.mode === "publish" ? ShieldCheck : Plus}
        maxWidth={980}
        footer={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {sheetState?.mode === "publish" ? (
                <FitButton
                  label="Leave private"
                  variant="ghost"
                  onClick={() =>
                    publishCandidate
                      ? setConfirmationState({
                          candidate: publishCandidate,
                          mode: "leave-private",
                        })
                      : undefined
                  }
                />
              ) : null}
              <FitButton
                label="Cancel"
                variant="ghost"
                onClick={handleCloseSheet}
              />
            </div>
            <FitButton
              disabled={Boolean(draftValidationError) || sheetPending}
              label={
                sheetState?.mode === "edit"
                  ? "Save global exercise"
                  : sheetState?.mode === "publish"
                    ? "Publish global"
                    : "Create global exercise"
              }
              loading={sheetPending}
              onClick={() => void handleSheetSubmit()}
              title={draftValidationError ?? undefined}
            />
          </div>
        }
      >
        <div style={{ display: "grid", gap: 18 }}>
          {formError ? (
            <div
              style={{
                padding: 14,
                borderRadius: 18,
                border: `1px solid ${colors.danger}45`,
                backgroundColor: `${colors.danger}10`,
              }}
            >
              <FitText style={{ fontSize: 13, color: colors.danger }}>
                {formError}
              </FitText>
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gap: 18,
              gridTemplateColumns:
                sheetState?.mode === "publish" && !isCompact
                  ? "minmax(0, 0.9fr) minmax(0, 1.1fr)"
                  : "minmax(0, 1fr)",
            }}
          >
            {sheetState?.mode === "publish" ? (
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  padding: 18,
                  borderRadius: 22,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <div
                  style={{
                    width: 6,
                    borderRadius: 999,
                    backgroundColor: colors.brand,
                    minHeight: 180,
                    justifySelf: "start",
                  }}
                />
                {publishCandidate ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 14,
                      marginTop: -180,
                      marginLeft: 24,
                    }}
                  >
                    <FitText style={{ fontSize: 20, fontWeight: 800 }}>
                      Publish candidate
                    </FitText>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: "rgba(38, 41, 48, 1)",
                          border: "1px solid rgba(84, 92, 107, 0.85)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Dumbbell size={14} color={colors.brand} />
                      </div>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <div
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: `1px solid ${colors.brand}35`,
                            backgroundColor: `${colors.brand}10`,
                          }}
                        >
                          <FitText
                            style={{ fontSize: 11, color: colors.brand }}
                          >
                            client custom
                          </FitText>
                        </div>
                        <div
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: `1px solid ${colors.brand}35`,
                            backgroundColor: `${colors.brand}10`,
                          }}
                        >
                          <FitText
                            style={{ fontSize: 11, color: colors.brand }}
                          >
                            pending publish
                          </FitText>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <FitText
                        style={{ fontSize: 13, color: colors.textSecondary }}
                      >
                        trigger: {publishCandidate.triggerLabel}
                      </FitText>
                      <FitText
                        style={{ fontSize: 13, color: colors.textSecondary }}
                      >
                        source label: {publishCandidate.sourceLabel}
                      </FitText>
                      <FitText
                        style={{ fontSize: 13, color: colors.textSecondary }}
                      >
                        decision: publish globally or keep private
                      </FitText>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gap: 16,
                padding: 18,
                borderRadius: 22,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 14,
                  padding: 14,
                  borderRadius: 18,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceRaised,
                }}
              >
                <div
                  style={{
                    alignItems: "flex-start",
                    display: "flex",
                    gap: 12,
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <FitText style={{ fontSize: 11, color: colors.brand }}>
                      exercise definition
                    </FitText>
                    <FitText style={{ fontSize: 18, fontWeight: 800 }}>
                      Canonical movement record
                    </FitText>
                    <FitText
                      style={{ fontSize: 12.5, color: colors.textSecondary }}
                    >
                      Save only the fields admins and mobile sessions can trust:
                      name, taxonomy, coaching guidance, and optional media.
                    </FitText>
                  </div>
                  <div
                    style={{
                      borderRadius: 999,
                      border: `1px solid ${colors.brand}45`,
                      backgroundColor: `${colors.brand}12`,
                      padding: "7px 12px",
                    }}
                  >
                    <FitText
                      style={{
                        color: colors.brand,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {completedDefinitionItems}/{definitionChecklist.length} ready
                    </FitText>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: isCompact
                      ? "minmax(0, 1fr)"
                      : "repeat(2, minmax(0, 1fr))",
                  }}
                >
                  {definitionChecklist.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        alignItems: "center",
                        display: "flex",
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      {item.complete ? (
                        <CheckCircle2 size={14} color={colors.success} />
                      ) : (
                        <X size={14} color={colors.textMuted} />
                      )}
                      <FitText
                        style={{
                          color: item.complete
                            ? colors.textSecondary
                            : colors.textMuted,
                          fontSize: 12,
                          lineHeight: 1.4,
                        }}
                      >
                        {item.label}
                      </FitText>
                    </div>
                  ))}
                </div>
              </div>

              <ExerciseEditorTabs
                activeTab={activeEditorTab}
                colors={editorColors}
                onChange={setActiveEditorTab}
              />

              {activeEditorTab === "basics" ? (
                <>
              <ExerciseLabField
                label="Exercise name"
                hint="Use the name users will recognize in plans and workout sessions."
              >
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.fieldBg,
                    padding: "12px 14px",
                  }}
                >
                  <FitTextInput
                    name="exerciseName"
                    value={draft.name}
                    onChange={(event) =>
                      setDraftField("name", event.target.value)
                    }
                    placeholder="Exercise name"
                  />
                </div>
              </ExerciseLabField>

              <ExerciseLabField
                label="Category"
                hint="Feeds search, filters, and mobile exercise context."
              >
                <FitSelect
                  fullWidth
                  value={draft.category}
                  onChange={(event) =>
                    setDraftField(
                      "category",
                      event.target.value as FitnessExerciseCategory,
                    )
                  }
                  options={EXERCISE_CATEGORY_OPTIONS.map((option) => ({
                    label: option.label,
                    value: option.value,
                  }))}
                />
              </ExerciseLabField>

              <ExerciseLabField
                label="Instruction summary"
                hint="Required. Write the movement cue future users and AI prompts can rely on."
              >
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.fieldBg,
                    padding: "12px 14px",
                  }}
                >
                  <FitTextArea
                    name="exerciseInstructions"
                    rows={4}
                    style={{
                      display: "block",
                      minHeight: 132,
                      resize: "vertical",
                      width: "100%",
                    }}
                    value={draft.instructions ?? ""}
                    onChange={(event) =>
                      setDraftField("instructions", event.target.value)
                    }
                    placeholder="Describe how the movement should be performed."
                  />
                </div>
              </ExerciseLabField>

              <ExerciseLabField
                label="Description"
                hint="Optional short context for admins and exercise references."
              >
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.fieldBg,
                    padding: "12px 14px",
                  }}
                >
                  <FitTextArea
                    name="exerciseDescription"
                    rows={3}
                    style={{
                      display: "block",
                      minHeight: 110,
                      resize: "vertical",
                      width: "100%",
                    }}
                    value={draft.description ?? ""}
                    onChange={(event) =>
                      setDraftField("description", event.target.value)
                    }
                    placeholder="Short exercise description."
                  />
                </div>
              </ExerciseLabField>
                </>
              ) : null}

              {activeEditorTab === "muscles" ? (
                <MuscleTargetsEditor
                  colors={editorColors}
                  fallbackMuscleGroup={draft.muscleGroup}
                  muscleDefinitions={activeMuscleDefinitions}
                  onManageMuscles={() => handleModeChange("muscles")}
                  onChange={(nextTargets) => {
                    const normalizedTargets = normalizeExerciseMuscleTargets(
                      nextTargets,
                      draft.muscleGroup,
                    );
                    setDraft((current) => ({
                      ...current,
                      muscleGroup: getPrimaryExerciseMuscleGroup(
                        normalizedTargets,
                        current.muscleGroup,
                      ),
                      muscleTargets: normalizedTargets,
                    }));
                    if (formError) setFormError(null);
                  }}
                  value={draft.muscleTargets}
                />
              ) : null}

              {activeEditorTab === "movement" ? (
                <MovementProfileEditor
                  colors={editorColors}
                  exerciseName={draft.name}
                  onChange={(nextProfile) =>
                    setDraftField("movementProfile", nextProfile)
                  }
                  value={draft.movementProfile}
                />
              ) : null}

              {activeEditorTab === "hands" ? (
                <HandShapeProfileEditor
                  colors={editorColors}
                  onChange={(nextProfile) =>
                    setDraftField("handShapeProfile", nextProfile)
                  }
                  value={draft.handShapeProfile}
                />
              ) : null}

              {activeEditorTab === "media" ? (
                <div
                style={{
                  display: "grid",
                  gap: 16,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "repeat(2, minmax(0, 1fr))",
                }}
              >
                <ExerciseLabField
                  label="Image URL"
                  hint="Optional visual reference. Must be http(s) if supplied."
                >
                  <div
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.fieldBg,
                      padding: "12px 14px",
                    }}
                  >
                    <FitTextInput
                      name="exerciseImageUrl"
                      value={draft.imageUrl ?? ""}
                      onChange={(event) =>
                        setDraftField("imageUrl", event.target.value)
                      }
                      placeholder="https://..."
                    />
                  </div>
                </ExerciseLabField>

                <ExerciseLabField
                  label="Video URL"
                  hint="Optional demo clip or coaching reference. Must be http(s) if supplied."
                >
                  <div
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.fieldBg,
                      padding: "12px 14px",
                    }}
                  >
                    <FitTextInput
                      name="exerciseVideoUrl"
                      value={draft.videoUrl ?? ""}
                      onChange={(event) =>
                        setDraftField("videoUrl", event.target.value)
                      }
                      placeholder="https://..."
                    />
                  </div>
                </ExerciseLabField>
                </div>
              ) : null}
            </div>
          </div>

          {sheetState?.mode === "publish" ? (
            <div
              style={{
                display: "grid",
                gap: 16,
                padding: 18,
                borderRadius: 22,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
              }}
            >
              <FitText style={{ fontSize: 11, color: colors.brand }}>
                publish decision / global governance
              </FitText>
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "minmax(0, 1fr) minmax(0, 1.2fr)",
                }}
              >
                <div
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surfaceRaised,
                  }}
                >
                  <FitText
                    style={{ fontSize: 12.5, color: colors.textSecondary }}
                  >
                    This note is stored with the review submission so future
                    admins understand why a private movement became canonical.
                    If the movement should stay personal, use Leave private.
                  </FitText>
                </div>
                <ExerciseLabField
                  label="Publish note"
                  hint="Required for publish. Keep provenance visible for future audit and model replacement work."
                >
                  <div
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.fieldBg,
                      padding: "12px 14px",
                    }}
                  >
                    <FitTextArea
                      name="exercisePublishNote"
                      rows={3}
                      value={draft.publishNote}
                      onChange={(event) =>
                        setDraftField("publishNote", event.target.value)
                      }
                      placeholder="Add governance notes for future reviewers."
                    />
                  </div>
                </ExerciseLabField>
              </div>
            </div>
          ) : null}
        </div>
      </FitModal>

      <ExerciseLabDrawer
        isOpen={mode === "review" && matchDrawerOpen}
        onClose={() => setMatchDrawerOpen(false)}
        title="Match search"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              padding: 14,
              borderRadius: 18,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
            }}
          >
            <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
              Use a live library record as taxonomy guidance before publishing a
              new global exercise.
            </FitText>
          </div>
          <div
            style={{
              borderRadius: 18,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Search size={16} color={colors.textMuted} />
              <FitTextInput
                name="matchSearch"
                value={matchSearch}
                onChange={(event) => setMatchSearch(event.target.value)}
                placeholder="Search suggested matches..."
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {filteredMatches.length ? (
              filteredMatches.map(({ exercise, score }, index) => (
                <button
                  key={exercise.id}
                  className={
                    canAnimate
                      ? "exercise-lab-drawer-option exercise-lab-drawer-option--animated"
                      : "exercise-lab-drawer-option"
                  }
                  type="button"
                  onClick={() => applyMatchReference(exercise)}
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 16,
                    borderRadius: 20,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                    cursor: "pointer",
                    textAlign: "left",
                    ...(canAnimate
                      ? {
                          animationDelay: `${
                            Math.min(index, 5) * (fullMotion ? 34 : 20)
                          }ms`,
                        }
                      : {}),
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <FitText style={{ fontSize: 16, fontWeight: 700 }}>
                      {exercise.name}
                    </FitText>
                    <div
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: `1px solid ${colors.brand}35`,
                        backgroundColor: `${colors.brand}10`,
                      }}
                    >
                      <FitText style={{ fontSize: 11, color: colors.brand }}>
                        {Math.max(58, Math.min(96, score))}% fit
                      </FitText>
                    </div>
                  </div>
                  <FitText
                    style={{ fontSize: 12.5, color: colors.textSecondary }}
                  >
                    {toTitleCase(exercise.category)} /{" "}
                    {toTitleCase(exercise.muscleGroup)}
                  </FitText>
                  <FitText
                    style={{ fontSize: 12.5, color: colors.textSecondary }}
                  >
                    {exercise.instructions ??
                      "No instruction summary saved yet."}
                  </FitText>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <CheckCircle2 size={14} color={colors.success} />
                    <FitText style={{ fontSize: 12, color: colors.success }}>
                      Use as publishing reference
                    </FitText>
                    <ChevronRight size={14} color={colors.textMuted} />
                  </div>
                </button>
              ))
            ) : (
              <div
                style={{
                  padding: 16,
                  borderRadius: 20,
                  border: `1px dashed ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
                  No live matches surfaced for the current search. This
                  candidate may need a brand-new global definition.
                </FitText>
              </div>
            )}
          </div>
        </div>
      </ExerciseLabDrawer>

      <FitModal
        isOpen={rejectTarget !== null}
        onClose={() => {
          setRejectTarget(null);
          setRejectRationale("");
          setRejectValidationError(null);
        }}
        title="Reject submission"
        subtitle="Decline promotion to the global library and leave a review rationale."
        icon={Archive}
        maxWidth={560}
        footer={
          <FitButton
            label="Reject submission"
            variant="danger"
            icon={Archive}
            loading={updateReviewSubmissionMutation.isPending}
            loadingLabel="Rejecting..."
            onClick={() => void handleReject()}
            style={{ width: "100%" }}
          />
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
            {rejectTarget?.title ?? "This custom exercise"} will leave the
            publish queue and will not become a reusable global movement.
          </FitText>
          <FitTextArea
            name="exerciseReviewRejectRationale"
            rows={4}
            value={rejectRationale}
            onChange={(event) => {
              setRejectRationale(event.target.value);
              if (rejectValidationError) setRejectValidationError(null);
            }}
            placeholder="Explain why this submission is not ready for the global library."
          />
          <FitText
            style={{
              fontSize: 11.5,
              color: rejectValidationError ? colors.danger : colors.textMuted,
            }}
          >
            {rejectValidationError ?? "Required: at least 12 characters."}
          </FitText>
        </div>
      </FitModal>
      <ConfirmModal
        isOpen={confirmationState !== null}
        title={confirmationTitle}
        message={confirmationMessage}
        confirmLabel={confirmationLabel}
        loadingLabel={confirmationLoadingLabel}
        confirmIcon={confirmationIcon}
        isDanger={
          confirmationState?.mode === "archive"
            ? !confirmationState.nextActive
            : true
        }
        isLoading={confirmationLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmationState(null)}
      />
      <style jsx>{`
        .exercise-lab-queue-card,
        .exercise-lab-drawer-option,
        .exercise-lab-action-dock {
          transition:
            transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
            box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
            border-color 160ms ease,
            background-color 160ms ease;
        }

        .exercise-lab-queue-card:hover,
        .exercise-lab-drawer-option:hover,
        .exercise-lab-action-dock:hover {
          transform: translateY(-1px);
        }

        .exercise-lab-queue-card--animated {
          animation: exercise-lab-queue-in ${fullMotion ? 260 : 180}ms
            cubic-bezier(0.18, 0.88, 0.24, 1) both;
        }

        .exercise-lab-workbench-body--animated {
          animation: exercise-lab-workbench-in ${fullMotion ? 240 : 160}ms
            cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .exercise-lab-action-dock--animated {
          animation: exercise-lab-dock-in ${fullMotion ? 240 : 180}ms
            cubic-bezier(0.2, 0.8, 0.2, 1) ${fullMotion ? 80 : 40}ms both;
        }

        .exercise-lab-drawer-option--animated {
          animation: exercise-lab-drawer-option-in ${fullMotion ? 220 : 160}ms
            cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        @keyframes exercise-lab-queue-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes exercise-lab-workbench-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes exercise-lab-dock-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes exercise-lab-drawer-option-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .exercise-lab-queue-card,
          .exercise-lab-drawer-option,
          .exercise-lab-action-dock,
          .exercise-lab-queue-card--animated,
          .exercise-lab-workbench-body--animated,
          .exercise-lab-action-dock--animated,
          .exercise-lab-drawer-option--animated {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </FitSection>
  );
}

export default ExerciseLabDashboard;
