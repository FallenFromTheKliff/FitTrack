"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
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
  FitnessExerciseCategory,
  FitnessExerciseRecord,
  UpdateFitnessExerciseInput,
} from "@fittrack/api-client";
import {
  createFitnessExerciseMutationOptions,
  fitnessExerciseReviewSubmissionsQueryOptions,
  fitnessExercisesQueryOptions,
  updateExerciseReviewSubmissionMutationOptions,
  updateFitnessExerciseMutationOptions,
} from "@fittrack/query";

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
  FitText,
  FitTextArea,
  FitTextInput,
} from "@/components/fit";
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

type SurfaceMode = "library" | "milestones" | "review";
type LibraryScope = "active" | "all";
type MilestoneScope = "all" | "closed" | "pending";
type SheetState =
  | { mode: "create" }
  | { candidateId: string; mode: "publish" }
  | { exercise: FitnessExerciseRecord; mode: "edit" }
  | null;

type ExerciseReviewCandidateLike = {
  category: FitnessExerciseCategory;
  description: string | null;
  evidenceBars: number[] | null;
  id: string;
  instructions: string | null;
  matchHint: string | null;
  muscleGroup: string;
  originLabel: string;
  proposedName: string;
  queueTag: string;
  sourceLabel: string;
  summary: string;
  title: string;
  triggerLabel: string;
};

type ExerciseDraft = {
  category: FitnessExerciseCategory;
  description: string;
  imageUrl: string;
  instructions: string;
  muscleGroup: string;
  name: string;
  publishNote: string;
  videoUrl: string;
};

const DRAWER_WIDTH = 420;

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
  if (normalizedMatchHint && exercise.name.toLowerCase() === normalizedMatchHint)
    score += 22;
  if (
    normalizedMatchHint &&
    exercise.name.toLowerCase().includes(normalizedMatchHint)
  )
    score += 10;

  return score;
}

function filterEmptyExerciseDraft(
  draft: ExerciseDraft,
): CreateFitnessExerciseInput {
  return {
    name: draft.name.trim(),
    category: draft.category,
    muscleGroup: draft.muscleGroup.trim(),
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

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

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
          <FitText style={{ fontSize: 18, fontWeight: 800 }}>{title}</FitText>
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
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [draft, setDraft] = useState<ExerciseDraft>(createExerciseDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [matchDrawerOpen, setMatchDrawerOpen] = useState(false);
  const [matchSearch, setMatchSearch] = useState("");
  const [rejectTarget, setRejectTarget] =
    useState<ExerciseReviewCandidateLike | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(
    "",
  );
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
    if (
      requestedTab === "review" ||
      requestedTab === "milestones" ||
      requestedTab === "library"
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
  }, [searchParams]);

  const reviewQueueQuery = useQuery(
    fitnessExerciseReviewSubmissionsQueryOptions(webApiClient, {
      limit: 24,
      page: 1,
      status: "pending",
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

  const createExerciseMutation = useMutation(
    createFitnessExerciseMutationOptions(webApiClient, queryClient),
  );
  const updateReviewSubmissionMutation = useMutation(
    updateExerciseReviewSubmissionMutationOptions(webApiClient, queryClient),
  );
  const updateExerciseMutation = useMutation(
    updateFitnessExerciseMutationOptions(webApiClient, queryClient),
  );

  const pendingCandidates = reviewQueueQuery.data?.data ?? [];
  const reviewViewportHeight = Math.max(540, viewportHeight - 228);
  const workbenchMotionKey = `${mode}-${selectedCandidateId || "empty"}`;

  useEffect(() => {
    setLibraryPage(1);
  }, [librarySearch, libraryCategory, libraryScope]);

  useEffect(() => {
    if (!pendingCandidates.length) return;
    const stillSelected = pendingCandidates.some(
      (candidate) => candidate.id === selectedCandidateId,
    );
    if (!stillSelected) {
      setSelectedCandidateId(pendingCandidates[0].id);
    }
  }, [pendingCandidates, selectedCandidateId]);

  const selectedCandidate =
    pendingCandidates.find(
      (candidate) => candidate.id === selectedCandidateId,
    ) ?? null;
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
    if (mode !== "review") {
      setMatchDrawerOpen(false);
    }
  }, [mode]);

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
      ? (pendingCandidates.find(
          (candidate) => candidate.id === sheetState.candidateId,
        ) ?? null)
      : null;
  const sheetPending =
    createExerciseMutation.isPending ||
    updateExerciseMutation.isPending ||
    updateReviewSubmissionMutation.isPending;
  const libraryItems = libraryQuery.data?.data ?? [];
  const libraryMeta = libraryQuery.data?.meta;

  const setDraftField = <K extends keyof ExerciseDraft>(
    key: K,
    value: ExerciseDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const resetSheet = (nextState: SheetState) => {
    setSheetState(nextState);
    setFormError(null);

    if (!nextState) {
      setDraft(createExerciseDraft());
      return;
    }

    if (nextState.mode === "publish") {
      const candidate = pendingCandidates.find(
        (item) => item.id === nextState.candidateId,
      );
      setDraft(createExerciseDraft(candidate));
      return;
    }

    if (nextState.mode === "edit") {
      setDraft({
        name: nextState.exercise.name,
        category: nextState.exercise.category,
        muscleGroup: nextState.exercise.muscleGroup,
        description: nextState.exercise.description ?? "",
        instructions: nextState.exercise.instructions ?? "",
        imageUrl: nextState.exercise.imageUrl ?? "",
        videoUrl: nextState.exercise.videoUrl ?? "",
        publishNote: "",
      });
      return;
    }

    setDraft(createExerciseDraft());
  };

  const handleOpenPublish = () => {
    if (!selectedCandidate) return;
    resetSheet({ mode: "publish", candidateId: selectedCandidate.id });
  };

  const handleOpenCreate = () => {
    resetSheet({ mode: "create" });
  };

  const handleOpenEdit = (exercise: FitnessExerciseRecord) => {
    resetSheet({ mode: "edit", exercise });
  };

  const handleCloseSheet = () => {
    resetSheet(null);
  };

  const handleLeavePrivate = async () => {
    if (!selectedCandidate) return;
    try {
      await updateReviewSubmissionMutation.mutateAsync({
        submissionId: selectedCandidate.id,
        payload: { status: "left_private" },
      });
      showMessage(
        `${selectedCandidate.title} was left as a private custom exercise.`,
      );
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
    try {
      await updateReviewSubmissionMutation.mutateAsync({
        submissionId: rejectTarget.id,
        payload: { status: "rejected" },
      });
      showMessage(`${rejectTarget.title} was removed from the publish queue.`);
      setRejectTarget(null);
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
    setMilestoneScope("closed");
  };

  const handleArchiveToggle = async (exercise: FitnessExerciseRecord) => {
    try {
      const nextActive = !exercise.isActive;
      await updateExerciseMutation.mutateAsync({
        exerciseId: exercise.id,
        payload: { isActive: nextActive } satisfies UpdateFitnessExerciseInput,
      });
      showMessage(
        nextActive
          ? `${exercise.name} is active in the global library again.`
          : `${exercise.name} was archived from the global library.`,
      );
    } catch (error) {
      showMessage(getErrorMessage(error, "Unable to update exercise status."));
    }
  };

  const validateDraft = () => {
    if (!draft.name.trim()) return "Exercise name is required.";
    if (!draft.muscleGroup.trim()) return "Muscle group is required.";
    return null;
  };

  const handleSheetSubmit = async () => {
    const nextError = validateDraft();
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
        handleCloseSheet();
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
            reviewNotes: draft.publishNote,
            status: "published",
          },
        });
        showMessage(
          `${createdExercise.name} was published to the global library.`,
        );
      } else {
        showMessage(`${createdExercise.name} was added to the global library.`);
      }

      setMode("library");
      setLibrarySearch(createdExercise.name);
      handleCloseSheet();
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to save exercise."));
    }
  };

  const applyMatchReference = (exercise: FitnessExerciseRecord) => {
    setDraft((current) => ({
      ...current,
      category: exercise.category,
      muscleGroup: exercise.muscleGroup,
      instructions: exercise.instructions ?? current.instructions,
      description: exercise.description ?? current.description,
    }));
    setMatchDrawerOpen(false);
    showMessage(`Copied taxonomy cues from ${exercise.name}.`);
  };

  const topActionLabel =
    mode === "review"
      ? "Review publish candidates, compare existing global movements, and decide what reaches the shared library."
      : mode === "milestones"
        ? "Review workout achievement claims, inspect proof, and close progression decisions without leaving Exercise Lab."
        : "Search, edit, archive, and create reusable global exercise records for the whole FitTrack ecosystem.";

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
            gap: 10,
            padding: "12px 16px",
            borderRadius: 18,
            border: `1px solid ${colors.brand}55`,
            background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
            boxShadow: "0 18px 36px rgba(0,0,0,0.16)",
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
                Exercise review / milestone moderation / global exercise governance
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
                  maxWidth: 760,
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
                onClick={() => setMode("review")}
                style={{ minWidth: 126, minHeight: 42 }}
              />
              <FitButton
                active={mode === "milestones"}
                label="Milestones"
                variant={mode === "milestones" ? "primary" : "ghost"}
                onClick={() => setMode("milestones")}
                style={{ minWidth: 126, minHeight: 42 }}
              />
              <FitButton
                active={mode === "library"}
                label="Global library"
                variant={mode === "library" ? "primary" : "ghost"}
                onClick={() => setMode("library")}
                style={{ minWidth: 126, minHeight: 42 }}
              />
            </div>
          </div>
        </div>

        {mode === "review" ? (
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
                gridTemplateRows: "auto auto minmax(0, 1fr)",
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
                  Publish queue
                </FitText>
                <FitText style={{ fontSize: 11.5, color: colors.brand }}>
                  live custom exercises awaiting global review
                </FitText>
              </div>

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
                  Admin review queue backed by local database
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
                {reviewQueueQuery.isLoading ? (
                  <div
                    style={{
                      padding: 18,
                      borderRadius: 20,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <FitText
                      style={{ fontSize: 13, color: colors.textSecondary }}
                    >
                      Loading review queue...
                    </FitText>
                  </div>
                ) : reviewQueueQuery.isError ? (
                  <div
                    style={{
                      padding: 18,
                      borderRadius: 20,
                      border: `1px solid ${colors.danger}40`,
                      backgroundColor: `${colors.danger}10`,
                    }}
                  >
                    <FitText style={{ fontSize: 13, color: colors.danger }}>
                      {getErrorMessage(
                        reviewQueueQuery.error,
                        "Unable to load the exercise review queue.",
                      )}
                    </FitText>
                  </div>
                ) : pendingCandidates.length ? (
                  pendingCandidates.map((candidate, index) => {
                    const isActive = candidate.id === selectedCandidate?.id;
                    const queueAnimationDelay = fullMotion
                      ? `${Math.min(index, 5) * 38}ms`
                      : `${Math.min(index, 5) * 24}ms`;
                    return (
                      <button
                        key={candidate.id}
                        className={
                          canAnimate
                            ? "exercise-lab-queue-card exercise-lab-queue-card--animated"
                            : "exercise-lab-queue-card"
                        }
                        type="button"
                        onClick={() => setSelectedCandidateId(candidate.id)}
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
                          ...(canAnimate ? { animationDelay: queueAnimationDelay } : {}),
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
                            <Dumbbell size={14} color={colors.brand} />
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
                              {candidate.title}
                            </FitText>
                            <FitText
                              style={{
                                fontSize: 11.5,
                                color: colors.textSecondary,
                              }}
                            >
                              {candidate.sourceLabel}
                            </FitText>
                          </div>
                          <div
                            style={{
                              width: 3,
                              minHeight: 46,
                              borderRadius: 999,
                              backgroundColor: isActive
                                ? colors.brand
                                : `${colors.brand}22`,
                            }}
                          />
                        </div>
                        <div
                          style={{
                            justifySelf: "start",
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: `1px solid ${colors.brand}35`,
                            backgroundColor: `${colors.brand}10`,
                          }}
                        >
                          <FitText
                            style={{ fontSize: 10, color: colors.brand }}
                          >
                            {candidate.queueTag}
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
                      The publish queue is clear. New AI-detected custom
                      exercises will appear here after they cross the 3-rep
                      unknown threshold and are persisted for review.
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
                      width: 84,
                      height: 16,
                      borderRadius: 999,
                      backgroundColor: "rgba(46, 196, 242, 0.15)",
                      border: "1px solid rgba(46, 196, 242, 0.3)",
                    }}
                  />
                  <div
                    style={{
                      width: 102,
                      height: 16,
                      borderRadius: 999,
                      backgroundColor: `${colors.brand}10`,
                      border: `1px solid ${colors.brand}30`,
                    }}
                  />
                </div>
                <FitText style={{ fontSize: 20, fontWeight: 800 }}>
                  Review workbench
                </FitText>
                <FitText
                  style={{ fontSize: 11.5, color: colors.textSecondary }}
                >
                  Inspect evidence, compare contracts, then decide whether to
                  keep the exercise private or publish a reusable global record.
                </FitText>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
              {selectedCandidate ? (
                <div
                  key={workbenchMotionKey}
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
                          pose evidence
                        </FitText>
                      </div>
                      <div style={{ display: "grid", gap: 4 }}>
                        <FitText style={{ fontSize: 16, fontWeight: 800 }}>
                          Candidate
                        </FitText>
                        <FitText
                          style={{
                            fontSize: 11,
                            color: colors.textSecondary,
                          }}
                        >
                          {selectedCandidate.summary}
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
                        <div
                          style={{
                            height: 58,
                            borderRadius: 16,
                            border: `1px solid ${colors.border}`,
                            background:
                              "linear-gradient(180deg, rgba(25,27,36,0.92) 0%, rgba(16,18,23,0.98) 100%)",
                            display: "flex",
                            alignItems: "flex-end",
                            gap: 8,
                            padding: "0 14px 12px",
                          }}
                        >
                          {(selectedCandidate.evidenceBars ?? [
                            18, 28, 44, 34, 24, 20,
                          ]).map((bar, index) => (
                            <div
                              key={`${selectedCandidate.id}-bar-${index}`}
                              style={{
                                width: 16,
                                height: bar,
                                borderRadius: 8,
                                backgroundColor:
                                  index === 2
                                    ? colors.brand
                                    : `${colors.brand}2E`,
                                boxShadow:
                                  index === 2
                                    ? `0 0 0 1px ${colors.brand}55`
                                    : "none",
                              }}
                            />
                          ))}
                        </div>
                        <FitText
                          style={{ fontSize: 11.5, color: colors.textSecondary }}
                        >
                          {selectedCandidate.description}
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
                        Closest match
                      </FitText>
                      {closestMatch ? (
                        <>
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
                                  {Math.min(
                                    99,
                                    Math.max(
                                      58,
                                      matchSuggestions[0]?.score ?? 58,
                                    ),
                                  )}
                                  %
                                </FitText>
                                <FitText
                                  style={{
                                    fontSize: 9.5,
                                    color: colors.textMuted,
                                  }}
                                >
                                  fit score
                                </FitText>
                              </div>
                            </div>
                            <div style={{ display: "grid", gap: 10 }}>
                              <div
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
                                  {closestMatch.name}
                                </FitText>
                              </div>
                              <div
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
                                  {toTitleCase(closestMatch.category)} /{" "}
                                  {toTitleCase(closestMatch.muscleGroup)}
                                </FitText>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setMatchDrawerOpen(true)}
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
                            <span>Open match drawer for comparison</span>
                            <PanelRightOpen size={16} />
                          </button>
                        </>
                      ) : (
                        <div
                          style={{
                            padding: 18,
                            borderRadius: 18,
                            border: `1px dashed ${colors.border}`,
                            backgroundColor: colors.surfaceRaised,
                          }}
                        >
                          <FitText
                            style={{
                              fontSize: 13,
                              color: colors.textSecondary,
                            }}
                          >
                            No close live match surfaced yet. This candidate is
                            a strong manual review case for creating a new
                            global exercise.
                          </FitText>
                        </div>
                      )}
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
                          Client submission
                        </FitText>
                      </div>
                      <FitText
                        style={{ fontSize: 11.5, color: colors.textSecondary }}
                      >
                        source: {selectedCandidate.originLabel}
                      </FitText>
                      <FitText
                        style={{ fontSize: 11.5, color: colors.textSecondary }}
                      >
                        trigger: {selectedCandidate.triggerLabel}
                      </FitText>
                      <FitText
                        style={{ fontSize: 11.5, color: colors.textSecondary }}
                      >
                        status: pending publish review
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
                          Global match
                        </FitText>
                      </div>
                      <FitText
                        style={{ fontSize: 11.5, color: colors.textSecondary }}
                      >
                        {closestMatch?.name ??
                          selectedCandidate.matchHint ??
                          "Needs manual publish sheet"}
                      </FitText>
                      <FitText
                        style={{ fontSize: 11.5, color: colors.textSecondary }}
                      >
                        confidence:{" "}
                        {closestMatch ? "medium-high" : "manual review"}
                      </FitText>
                      <FitText
                        style={{ fontSize: 11.5, color: colors.textSecondary }}
                      >
                        action: ready for publish sheet
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
                        gap: 10,
                        gridTemplateColumns: isCompact
                          ? "minmax(0, 1fr)"
                          : "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.85fr)",
                      }}
                    >
                      <FitButton
                        label="Publish global"
                        variant="primary"
                        onClick={handleOpenPublish}
                        style={{
                          minHeight: 64,
                          justifyContent: "flex-start",
                          paddingInline: 16,
                        }}
                      >
                        <div
                          style={{ display: "grid", textAlign: "left", gap: 4 }}
                        >
                          <span style={{ fontWeight: 800 }}>
                            Publish global
                          </span>
                          <span style={{ fontSize: 11, opacity: 0.82 }}>
                            normalize and add to library
                          </span>
                        </div>
                      </FitButton>
                      <FitButton
                        label="Leave private"
                        variant="ghost"
                        onClick={handleLeavePrivate}
                        style={{
                          minHeight: 64,
                          justifyContent: "flex-start",
                          paddingInline: 16,
                        }}
                      >
                        <div
                          style={{ display: "grid", textAlign: "left", gap: 2 }}
                        >
                          <span style={{ fontWeight: 800 }}>Leave private</span>
                          <span style={{ fontSize: 10.5, opacity: 0.82 }}>
                            keep as client custom
                          </span>
                        </div>
                      </FitButton>
                      <FitButton
                        label="Reject"
                        variant="ghost"
                        onClick={() => setRejectTarget(selectedCandidate)}
                        style={{
                          minHeight: 64,
                          justifyContent: "flex-start",
                          paddingInline: 16,
                        }}
                      >
                        <div
                          style={{ display: "grid", textAlign: "left", gap: 2 }}
                        >
                          <span style={{ fontWeight: 800 }}>Reject</span>
                          <span style={{ fontSize: 10.5, opacity: 0.82 }}>
                            remove candidate
                          </span>
                        </div>
                      </FitButton>
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
                    No pending candidates are left in the publish queue.
                  </FitText>
                </div>
              )}
              </div>
            </section>
          </div>
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
                  setMilestoneScope(value as MilestoneScope)
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
                          <FitText style={{ fontSize: 10, color: colors.brand }}>
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
                          style={{ fontSize: 11.5, color: colors.textSecondary }}
                        >
                          member: {selectedMilestone.memberName.toLowerCase()}
                        </FitText>
                        <FitText
                          style={{ fontSize: 11.5, color: colors.textSecondary }}
                        >
                          source: workout progression
                        </FitText>
                        <FitText
                          style={{ fontSize: 11.5, color: colors.textSecondary }}
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
                          style={{ fontSize: 11.5, color: colors.textSecondary }}
                        >
                          status: {selectedMilestone.status.toLowerCase()}
                        </FitText>
                        <FitText
                          style={{ fontSize: 11.5, color: colors.textSecondary }}
                        >
                          reviewer note:{" "}
                          {selectedMilestone.reviewerNotes?.trim() ||
                            "proof matches log"}
                        </FitText>
                        <FitText
                          style={{ fontSize: 11.5, color: colors.textSecondary }}
                        >
                          reviewed: {formatDateTime(selectedMilestone.reviewedAt)}
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
                placeholder="Search exercise name, muscle group, or notes..."
                value={librarySearch}
                onChangeText={setLibrarySearch}
              />
              <FitSelect
                fullWidth
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
                          onClick={() => void handleArchiveToggle(exercise)}
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
                  onClick={() => {
                    handleCloseSheet();
                    handleLeavePrivate();
                  }}
                />
              ) : null}
              <FitButton
                label="Cancel"
                variant="ghost"
                onClick={handleCloseSheet}
              />
            </div>
            <FitButton
              label={
                sheetState?.mode === "edit"
                  ? "Save global exercise"
                  : sheetState?.mode === "publish"
                    ? "Publish global"
                    : "Create global exercise"
              }
              loading={sheetPending}
              onClick={() => void handleSheetSubmit()}
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
                        reviewer goal: publish or keep private
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Core", "Labels", "Guidance"].map((item, index) => (
                  <div
                    key={item}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      border: `1px solid ${
                        index === 0 ? `${colors.brand}55` : colors.border
                      }`,
                      backgroundColor:
                        index === 0 ? colors.brand : colors.surfaceRaised,
                    }}
                  >
                    <FitText
                      style={{
                        fontSize: 11,
                        color:
                          index === 0
                            ? (colors.onBrand ?? "#fff")
                            : colors.textPrimary,
                      }}
                    >
                      {item}
                    </FitText>
                  </div>
                ))}
              </div>

              <ExerciseLabField label="Exercise name">
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

              <ExerciseLabField label="Category">
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

              <ExerciseLabField label="Muscle group">
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.fieldBg,
                    padding: "12px 14px",
                  }}
                >
                  <FitTextInput
                    name="exerciseMuscleGroup"
                    value={draft.muscleGroup}
                    onChange={(event) =>
                      setDraftField("muscleGroup", event.target.value)
                    }
                    placeholder="Primary muscle group"
                  />
                </div>
              </ExerciseLabField>

              <ExerciseLabField label="Instruction summary">
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
                    value={draft.instructions ?? ""}
                    onChange={(event) =>
                      setDraftField("instructions", event.target.value)
                    }
                    placeholder="Describe how the movement should be performed."
                  />
                </div>
              </ExerciseLabField>

              <ExerciseLabField label="Description">
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
                    value={draft.description ?? ""}
                    onChange={(event) =>
                      setDraftField("description", event.target.value)
                    }
                    placeholder="Short exercise description."
                  />
                </div>
              </ExerciseLabField>
            </div>
          </div>

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
              publish notes / global governance
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
                  Use this sheet only when the submission is becoming a global
                  exercise record. Leaving it private does not require
                  publishing fields.
                </FitText>
              </div>
              <ExerciseLabField
                label="Publish note"
                hint="Keep provenance visible for future audit and model replacement work."
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
                            Math.min(index, 5) *
                            (fullMotion ? 34 : 20)
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

      <ConfirmModal
        isOpen={rejectTarget !== null}
        title="Reject submission"
        message={`Remove ${rejectTarget?.title ?? "this custom exercise"} from the publish queue? The client custom exercise stays private and will not be promoted to the global library.`}
        confirmLabel="Reject submission"
        loadingLabel="Rejecting..."
        confirmIcon={Archive}
        isDanger
        onConfirm={() => void handleReject()}
        onCancel={() => setRejectTarget(null)}
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
          animation: exercise-lab-queue-in ${fullMotion ? 260 : 180}ms cubic-bezier(0.18, 0.88, 0.24, 1) both;
        }

        .exercise-lab-workbench-body--animated {
          animation: exercise-lab-workbench-in ${fullMotion ? 240 : 160}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .exercise-lab-action-dock--animated {
          animation: exercise-lab-dock-in ${fullMotion ? 240 : 180}ms cubic-bezier(0.2, 0.8, 0.2, 1) ${fullMotion ? 80 : 40}ms both;
        }

        .exercise-lab-drawer-option--animated {
          animation: exercise-lab-drawer-option-in ${fullMotion ? 220 : 160}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
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
