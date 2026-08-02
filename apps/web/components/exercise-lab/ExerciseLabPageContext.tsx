"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ChevronRight,
  Pencil,
  RefreshCcw,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateMuscleDefinitionInput,
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
  FitPill,
  FitText,
} from "@/components/fit";
import type {
  FitTableAction,
  FitTableColumn,
} from "@/components/fit/FitTable";
import { createExerciseDraft } from "@/components/exercise-lab/exercise-lab-data";
import {
  CREATOR_DECISION_STATES,
  EMPTY_LIBRARY_EXERCISES,
  EMPTY_REVIEW_CANDIDATES,
  MUSCLE_LIBRARY_PAGE_SIZE,
  filterEmptyExerciseDraft,
  formatDate,
  getCreatorStateTone,
  getErrorMessage,
  getEvidenceSummary,
  getReviewStatusColor,
  isValidOptionalHttpUrl,
  normalizeExerciseName,
  scoreExerciseMatch,
  toTitleCase,
  type ConfirmationState,
  type ExerciseDraft,
  type ExerciseReviewCandidateLike,
  type LibraryScope,
  type MuscleDefinitionDraft,
  type SheetState,
  type SurfaceMode,
} from "@/components/exercise-lab/exerciseLabShared";
import type {
  EditorColors,
  ExerciseEditorTab,
} from "@/components/exercise-lab/ExerciseContractEditors";

function useExerciseLabPageState() {
  const { colors, settings } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const queryClient = useQueryClient();
  const { message: feedbackMessage, showMessage } = useTimedMessage(
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
    bodyRegion: "",
    key: "",
    name: "",
    sortOrder: 500,
  });
  const [editingMuscleId, setEditingMuscleId] = useState<string | null>(null);
  const [muscleEditorOpen, setMuscleEditorOpen] = useState(false);
  const [musclePage, setMusclePage] = useState(1);
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
    if (
      requestedTab === "review" ||
      requestedTab === "library" ||
      requestedTab === "muscles"
    ) {
      setMode(requestedTab);
    }
  }, [router, searchParams]);

  const replaceSurfaceRoute = (nextMode: SurfaceMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextMode);
    params.delete("milestone_scope");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const handleModeChange = (nextMode: SurfaceMode) => {
    setMode(nextMode);
    replaceSurfaceRoute(nextMode);
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
  const visibleReviewCandidates = reviewCandidates;
  const reviewViewportHeight = Math.max(540, viewportHeight - 228);
  const workbenchMotionKey = `${mode}-${reviewModalCandidate?.id ?? "empty"}`;

  useEffect(() => {
    setLibraryPage(1);
  }, [librarySearch, libraryCategory, libraryScope]);

  useEffect(() => {
    setReviewPage(1);
  }, [reviewCategory, reviewMuscleFilter, reviewSearch, reviewStatus]);

  useEffect(() => {
    setMusclePage(1);
  }, [muscleSearch]);

  const selectedCandidate = reviewModalCandidate;
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
  const muscleTotalPages = Math.max(
    1,
    Math.ceil(muscleDefinitions.length / MUSCLE_LIBRARY_PAGE_SIZE),
  );
  const visibleMuscleDefinitions = muscleDefinitions.slice(
    (musclePage - 1) * MUSCLE_LIBRARY_PAGE_SIZE,
    musclePage * MUSCLE_LIBRARY_PAGE_SIZE,
  );
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
      bodyRegion: definition?.bodyRegion ?? "",
      key: definition?.key ?? "",
      name: definition?.name ?? "",
      sortOrder: definition?.sortOrder ?? 500,
    });
  };

  const openMuscleEditor = (definition?: MuscleDefinitionRecord) => {
    resetMuscleDraft(definition);
    setMuscleEditorOpen(true);
  };

  const closeMuscleEditor = () => {
    setMuscleEditorOpen(false);
    resetMuscleDraft();
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
      setMuscleEditorOpen(false);
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
        align: "left",
        render: (candidate) => (
          <div style={{ display: "grid", gap: 3, minWidth: 210 }}>
            <FitText
              style={{ fontSize: 12.5, fontWeight: 850, lineHeight: "17px" }}
            >
              {candidate.title}
            </FitText>
            <FitText
              style={{
                fontSize: 12,
                lineHeight: "16px",
                color: colors.textSecondary,
              }}
            >
              {candidate.proposedName}
            </FitText>
            <div
              style={{
                alignItems: "center",
                color: getReviewStatusColor(candidate.status, colors),
                display: "inline-flex",
                fontSize: 10.5,
                fontWeight: 800,
                gap: 5,
                lineHeight: "13px",
                width: "fit-content",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  backgroundColor: "currentColor",
                  borderRadius: "50%",
                  height: 5,
                  width: 5,
                }}
              />
              {toTitleCase(candidate.status)}
            </div>
          </div>
        ),
      },
      {
        key: "creator",
        heading: "Creator",
        align: "left",
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
            <div style={{ display: "grid", gap: 3, minWidth: 190 }}>
              <FitText
                style={{ fontSize: 12.5, fontWeight: 800, lineHeight: "17px" }}
              >
                {candidate.creatorDisplayName ?? "Creator member"}
              </FitText>
              <FitText
                style={{
                  fontSize: 11.5,
                  lineHeight: "16px",
                  color: colors.textSecondary,
                }}
              >
                {candidate.creatorEmail ?? "Email unavailable"}
              </FitText>
              <FitPill
                mode="status"
                label={candidate.creatorStateLabel}
                color={toneColor}
                fontSize={9.5}
                style={{
                  borderRadius: 6,
                  flexShrink: 0,
                  marginTop: 1,
                  paddingBlock: 1,
                  width: "fit-content",
                }}
              />
            </div>
          );
        },
      },
      {
        key: "movement",
        heading: "Movement",
        align: "left",
        render: (candidate) => (
          <div style={{ display: "grid", gap: 3 }}>
            <FitText
              style={{ fontSize: 13, fontWeight: 800, lineHeight: "17px" }}
            >
              {toTitleCase(candidate.category)}
            </FitText>
            <FitText
              style={{
                fontSize: 12,
                lineHeight: "16px",
                color: colors.textSecondary,
              }}
            >
              {toTitleCase(candidate.muscleGroup)}
            </FitText>
          </div>
        ),
      },
      {
        key: "match",
        heading: "Closest match",
        align: "left",
        render: (candidate) => {
          const match = reviewMatchByCandidateId.get(candidate.id);
          return (
            <div style={{ display: "grid", gap: 3, minWidth: 130 }}>
              <FitText
                style={{ fontSize: 13, fontWeight: 800, lineHeight: "17px" }}
              >
                {match?.exercise.name ?? candidate.matchHint ?? "Manual review"}
              </FitText>
              <FitText
                style={{
                  fontSize: 12,
                  lineHeight: "16px",
                  color: colors.textSecondary,
                }}
              >
                {match ? `${Math.max(58, Math.min(96, match.score))}% fit` : "No close match"}
              </FitText>
            </div>
          );
        },
      },
      {
        key: "evidence",
        heading: "Evidence",
        align: "left",
        render: (candidate) => (
          <div style={{ display: "grid", gap: 3, minWidth: 130 }}>
            <FitText
              style={{ fontSize: 13, fontWeight: 800, lineHeight: "17px" }}
            >
              {getEvidenceSummary(candidate.evidenceBars)}
            </FitText>
            <FitText
              style={{
                fontSize: 12,
                lineHeight: "16px",
                color: colors.textSecondary,
              }}
            >
              {candidate.sourceLabel}
            </FitText>
          </div>
        ),
      },
      {
        key: "submitted",
        heading: "Submitted",
        align: "left",
        render: (candidate) => (
          <FitText
            style={{
              fontSize: 12.5,
              lineHeight: "17px",
              color: colors.textSecondary,
            }}
          >
            {formatDate(candidate.createdAt)}
          </FitText>
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
        ariaLabel: (candidate) => `Review ${candidate.title}`,
        variant: "ghost",
        onClick: openReviewModal,
        style: {
          borderRadius: 7,
          minHeight: 34,
          minWidth: 82,
        },
      },
      {
        label: "Open review",
        ariaLabel: (candidate) => `Open review for ${candidate.title}`,
        variant: "ghost",
        icon: ChevronRight,
        iconOnly: true,
        iconSize: 16,
        onClick: openReviewModal,
        style: {
          backgroundColor: "transparent",
          border: 0,
          borderRadius: 5,
          minHeight: 30,
          minWidth: 30,
          padding: 4,
        },
      },
    ],
    [],
  );

  const libraryTableColumns: FitTableColumn<FitnessExerciseRecord>[] = [
    {
      key: "name",
      heading: "Exercise",
      align: "left",
      render: (exercise, c) => (
        <div style={{ display: "grid", gap: 3, minWidth: 220 }}>
          <FitText style={{ fontSize: 14, fontWeight: 850, color: c.textPrimary }}>
            {exercise.name}
          </FitText>
          <FitText style={{ fontSize: 12, color: c.textSecondary }}>
            {exercise.description ?? "No description saved yet."}
          </FitText>
        </div>
      ),
    },
    {
      key: "category",
      heading: "Category",
      align: "left",
      render: (exercise, c) => (
        <FitPill
          mode="status"
          label={toTitleCase(exercise.category)}
          color={c.brand}
          fontSize={11}
          style={{ borderRadius: 6 }}
        />
      ),
    },
    {
      key: "muscle",
      heading: "Muscle",
      align: "left",
      render: (exercise, c) => (
        <FitText style={{ fontSize: 13, fontWeight: 800, color: c.textPrimary }}>
          {toTitleCase(exercise.muscleGroup)}
        </FitText>
      ),
    },
    {
      key: "status",
      heading: "Status",
      align: "left",
      render: (exercise, c) => (
        <FitPill
          mode="status"
          label={exercise.isActive ? "Active" : "Archived"}
          color={exercise.isActive ? c.success : c.textMuted}
          fontSize={11}
          style={{ borderRadius: 6 }}
        />
      ),
    },
    {
      key: "updated",
      heading: "Updated",
      align: "left",
      render: (exercise, c) => (
        <FitText style={{ fontSize: 12.5, color: c.textSecondary }}>
          {formatDate(exercise.updatedAt)}
        </FitText>
      ),
    },
  ];

  const libraryTableActions: FitTableAction<FitnessExerciseRecord>[] = [
    {
      icon: Pencil,
      label: "Edit",
      ariaLabel: (exercise) => `Edit ${exercise.name}`,
      onClick: handleOpenEdit,
      variant: "ghost",
    },
    {
      icon: Archive,
      label: "Archive",
      ariaLabel: (exercise) => `Archive ${exercise.name}`,
      disabled: (exercise) => !exercise.isActive,
      onClick: (exercise) =>
        setConfirmationState({
          exercise,
          mode: "archive",
          nextActive: false,
        }),
      variant: "ghost",
    },
    {
      icon: RefreshCcw,
      label: "Restore",
      ariaLabel: (exercise) => `Restore ${exercise.name}`,
      disabled: (exercise) => exercise.isActive,
      onClick: (exercise) =>
        setConfirmationState({
          exercise,
          mode: "archive",
          nextActive: true,
        }),
      variant: "ghost",
    },
  ];

  const muscleTableColumns: FitTableColumn<MuscleDefinitionRecord>[] = [
    {
      key: "name",
      heading: "Muscle",
      align: "left",
      render: (definition, c) => (
        <div style={{ display: "grid", gap: 3, minWidth: 180 }}>
          <FitText style={{ fontSize: 14, fontWeight: 850, color: c.textPrimary }}>
            {definition.name}
          </FitText>
          <FitText style={{ fontSize: 12, color: c.textSecondary }}>
            {definition.key}
          </FitText>
        </div>
      ),
    },
    {
      key: "region",
      heading: "Region",
      align: "left",
      render: (definition, c) => (
        <FitText style={{ fontSize: 13, fontWeight: 800, color: c.textPrimary }}>
          {toTitleCase(definition.bodyRegion)}
        </FitText>
      ),
    },
    {
      key: "aliases",
      heading: "Aliases",
      align: "left",
      render: (definition, c) => (
        <FitText style={{ fontSize: 12.5, color: c.textSecondary }}>
          {definition.aliases.length ? definition.aliases.join(", ") : "None"}
        </FitText>
      ),
    },
    {
      key: "sort",
      heading: "Sort",
      align: "left",
      render: (definition, c) => (
        <FitText style={{ fontSize: 13, color: c.textSecondary }}>
          {definition.sortOrder}
        </FitText>
      ),
    },
    {
      key: "status",
      heading: "Status",
      align: "left",
      render: (definition, c) => (
        <FitPill
          mode="status"
          label={definition.isActive ? "Active" : "Archived"}
          color={definition.isActive ? c.success : c.textMuted}
          fontSize={11}
          style={{ borderRadius: 6 }}
        />
      ),
    },
  ];

  const muscleTableActions: FitTableAction<MuscleDefinitionRecord>[] = [
    {
      icon: Pencil,
      label: "Edit",
      ariaLabel: (definition) => `Edit ${definition.name}`,
      onClick: openMuscleEditor,
      variant: "ghost",
    },
    {
      icon: Archive,
      label: "Archive",
      ariaLabel: (definition) => `Archive ${definition.name}`,
      disabled: (definition) => !definition.isActive,
      onClick: (definition) => void handleArchiveMuscleDefinition(definition),
      variant: "ghost",
    },
    {
      icon: RefreshCcw,
      label: "Restore",
      ariaLabel: (definition) => `Restore ${definition.name}`,
      disabled: (definition) => definition.isActive,
      onClick: (definition) =>
        void updateMuscleDefinitionMutation
          .mutateAsync({
            muscleDefinitionId: definition.id,
            payload: {
              isActive: true,
            } satisfies UpdateMuscleDefinitionInput,
          })
          .then(() => showMessage(`${definition.name} was restored.`))
          .catch((error) =>
            showMessage(getErrorMessage(error, "Unable to restore muscle.")),
          ),
      variant: "ghost",
    },
  ];

  const surfaceTopRowStyle: CSSProperties = {
    display: "grid",
    alignItems: "center",
    gap: 10,
    gridTemplateColumns: isCompact
      ? "minmax(0, 1fr)"
      : "minmax(260px, auto) minmax(0, 1fr)",
    minHeight: 50,
    padding: 8,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    backgroundColor: colors.surface,
  };
  const surfaceTitleNavStyle: CSSProperties = {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    minWidth: 0,
  };
  const surfaceControlsStyle: CSSProperties = {
    alignItems: "center",
    display: "grid",
    gap: 8,
    gridTemplateColumns: isCompact
      ? "minmax(0, 1fr)"
      : "minmax(220px, 1fr) repeat(auto-fit, minmax(140px, auto))",
    justifyContent: "end",
    minWidth: 0,
  };
  return {
    activeEditorTab,
    activeMuscleDefinitions,
    applyMatchReference,
    archiveMuscleDefinitionMutation,
    canAnimate,
    closestMatch,
    colors,
    completedDefinitionItems,
    confirmationIcon,
    confirmationLabel,
    confirmationLoading,
    confirmationLoadingLabel,
    confirmationMessage,
    confirmationState,
    confirmationTitle,
    contractValidation,
    createExerciseMutation,
    createMuscleDefinitionMutation,
    creatorGovernanceNote,
    creatorStateDraft,
    definitionChecklist,
    draft,
    draftValidationError,
    duplicateDraftExercise,
    editorColors,
    editingMuscleId,
    fadeIn,
    feedbackMessage,
    filteredMatches,
    formError,
    fullMotion,
    handleCloseSheet,
    handleConfirmAction,
    handleCreatorGovernanceUpdate,
    handleModeChange,
    handleOpenCreate,
    handleOpenPublish,
    handleReject,
    handleSaveMuscleDefinition,
    handleSheetSubmit,
    isCompact,
    libraryCategory,
    libraryItems,
    libraryMeta,
    libraryPage,
    libraryQuery,
    libraryScope,
    librarySearch,
    libraryTableActions,
    libraryTableColumns,
    matchDrawerOpen,
    matchSearch,
    matchSuggestions,
    mode,
    muscleDefinitions,
    muscleDefinitionsQuery,
    muscleDraft,
    muscleEditorOpen,
    musclePage,
    muscleSearch,
    muscleTableActions,
    muscleTableColumns,
    muscleTotalPages,
    openReviewModal,
    openMuscleEditor,
    publishCandidate,
    rejectRationale,
    rejectTarget,
    rejectValidationError,
    resetMuscleDraft,
    closeMuscleEditor,
    reviewCategory,
    reviewLibraryQuery,
    reviewMeta,
    reviewModalCandidate,
    reviewMuscleFilter,
    reviewPage,
    reviewQueueQuery,
    reviewSearch,
    reviewStatus,
    reviewTableActions,
    reviewTableColumns,
    reviewViewportHeight,
    selectedCandidate,
    selectedCandidateId,
    selectedCreatorToneColor,
    setActiveEditorTab,
    setConfirmationState,
    setCreatorGovernanceNote,
    setCreatorStateDraft,
    setDraft,
    setDraftField,
    setFormError,
    setLibraryCategory,
    setLibraryPage,
    setLibraryScope,
    setLibrarySearch,
    setMatchDrawerOpen,
    setMatchSearch,
    setMode,
    setMuscleDraft,
    setMusclePage,
    setMuscleSearch,
    setRejectRationale,
    setRejectTarget,
    setRejectValidationError,
    setReviewCategory,
    setReviewModalCandidate,
    setReviewMuscleFilter,
    setReviewPage,
    setReviewSearch,
    setReviewStatus,
    setSelectedCandidateId,
    sheetPending,
    sheetState,
    showMessage,
    surfaceControlsStyle,
    surfaceTitleNavStyle,
    surfaceTopRowStyle,
    themeTransition,
    updateExerciseMutation,
    updateMuscleDefinitionMutation,
    updateReviewSubmissionMutation,
    visibleMuscleDefinitions,
    visibleReviewCandidates,
    workbenchMotionKey,
  };
}

type ExerciseLabPageContextValue = ReturnType<typeof useExerciseLabPageState>;

const ExerciseLabPageContext = createContext<ExerciseLabPageContextValue | null>(
  null,
);

export function ExerciseLabPageProvider({ children }: { children: ReactNode }) {
  const value = useExerciseLabPageState();
  return (
    <ExerciseLabPageContext.Provider value={value}>
      {children}
    </ExerciseLabPageContext.Provider>
  );
}

export function useExerciseLabPage() {
  const context = useContext(ExerciseLabPageContext);
  if (!context) {
    throw new Error("useExerciseLabPage must be used within ExerciseLabPageProvider");
  }
  return context;
}
