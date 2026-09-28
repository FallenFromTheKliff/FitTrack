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
  Badge,
  Dumbbell,
  Flame,
  Medal,
  Pencil,
  RefreshCcw,
  Star,
  Target,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FITNESS_PROGRESSION_LIBRARY_ICON_KEYS,
  type ProgressionIconKind,
} from "@fittrack/types";
import type {
  CreateMuscleDefinitionInput,
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
  fitnessExercisesQueryOptions,
  fitnessMuscleDefinitionsQueryOptions,
  uploadImageMutationOptions,
  updateFitnessExerciseMutationOptions,
  updateExerciseMovementFamilyMutationOptions,
  updateMuscleDefinitionMutationOptions,
} from "@fittrack/query";
import {
  normalizeExerciseMuscleTargets,
  buildRenderableAssetUrl,
  validateExerciseEditorContract,
  createGeneratedExerciseRigFromMovementContract,
  validatePoseMovementContract,
  type ExerciseEditorValidationIssue,
} from "@fittrack/utils";

import { WEB_API_BASE_URL, webApiClient } from "@/lib/api-client";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { FitText } from "@/components/fit";
import type {
  FitTableAction,
  FitTableColumn,
} from "@/components/fit/FitTable";
import { createExerciseDraft } from "@/components/exercise-lab/exercise-lab-data";
import {
  EMPTY_LIBRARY_EXERCISES,
  getExerciseWorkbenchSteps,
  MUSCLE_LIBRARY_PAGE_SIZE,
  type ExerciseWorkbenchStep,
  type ExerciseWorkbenchStepId,
  filterEmptyExerciseDraft,
  getErrorMessage,
  normalizeExerciseName,
  shouldPersistCanonicalFamilyProfile,
  toTitleCase,
  type ConfirmationState,
  type ExerciseDraft,
  type LibraryScope,
  type MuscleDefinitionDraft,
  type SheetState,
  type SurfaceMode,
} from "@/components/exercise-lab/exerciseLabShared";
import type {
  EditorColors,
  ExerciseEditorTab,
} from "@/components/exercise-lab/ExerciseContractEditors";

export type MuscleIconKey =
  (typeof FITNESS_PROGRESSION_LIBRARY_ICON_KEYS)[number];

export type MuscleDefinitionEditorDraft = MuscleDefinitionDraft & {
  iconAssetKey: string | null;
  iconKey: MuscleIconKey;
  iconKind: ProgressionIconKind;
};

const MUSCLE_ICON_LABELS: Record<MuscleIconKey, string> = {
  badge: "Badge",
  dumbbell: "Dumbbell",
  flame: "Flame",
  medal: "Medal",
  star: "Star",
  target: "Target",
  trophy: "Trophy",
};

export const MUSCLE_ICON_OPTIONS = FITNESS_PROGRESSION_LIBRARY_ICON_KEYS.map(
  (value) => ({ label: MUSCLE_ICON_LABELS[value], value }),
);

export const MUSCLE_ICON_ACCEPT =
  "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";
export const MUSCLE_ICON_UPLOAD_ERROR =
  "Choose a managed PNG, JPEG, or WebP image. SVG files are not supported.";

const ALLOWED_MUSCLE_ICON_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_MUSCLE_ICON_FILE_PATTERN = /\.(?:jpe?g|png|webp)$/i;

const MUSCLE_ICON_COMPONENTS: Record<MuscleIconKey, LucideIcon> = {
  badge: Badge,
  dumbbell: Dumbbell,
  flame: Flame,
  medal: Medal,
  star: Star,
  target: Target,
  trophy: Trophy,
};

const CATALOG_ACTION_BUTTON_STYLE: CSSProperties = {
  borderRadius: 6,
  height: 32,
  minHeight: 32,
  minWidth: 32,
  padding: 0,
  width: 32,
};

export function getDefaultMuscleIconKey(
  value: string | null | undefined,
): MuscleIconKey {
  return (
    MUSCLE_ICON_OPTIONS.find((option) => option.value === value)?.value ??
    "dumbbell"
  );
}

export function getMuscleIconComponent(
  value: string | null | undefined,
): LucideIcon {
  return MUSCLE_ICON_COMPONENTS[getDefaultMuscleIconKey(value)];
}

export function isAllowedMuscleIconFile(file: File) {
  return (
    ALLOWED_MUSCLE_ICON_MIME_TYPES.has(file.type.toLowerCase()) &&
    ALLOWED_MUSCLE_ICON_FILE_PATTERN.test(file.name)
  );
}

export type MuscleIconColors = {
  accent: string;
  background: string;
  border: string;
};

export function MuscleDefinitionIcon({
  colors,
  definition,
  onImageError,
  onImageLoad,
  size = 38,
  assetUrl: assetUrlOverride,
}: {
  colors: MuscleIconColors;
  definition?: Pick<
    MuscleDefinitionRecord,
    "iconAssetKey" | "iconKey" | "iconKind"
  > | null;
  onImageError?: () => void;
  onImageLoad?: () => void;
  size?: number;
  assetUrl?: string | null;
}) {
  const assetUrl =
    assetUrlOverride !== undefined
      ? assetUrlOverride
      : definition?.iconKind === "custom"
        ? buildRenderableAssetUrl({
            apiBaseUrl: WEB_API_BASE_URL,
            assetKey: definition.iconAssetKey ?? null,
          })
        : null;
  const [imageError, setImageError] = useState(false);
  const Icon = getMuscleIconComponent(definition?.iconKey);

  useEffect(() => {
    setImageError(false);
  }, [assetUrl]);

  const showImage = Boolean(assetUrl) && !imageError;

  return (
    <span
      aria-hidden="true"
      style={{
        alignItems: "center",
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: 9,
        display: "inline-flex",
        flexShrink: 0,
        height: size,
        justifyContent: "center",
        overflow: "hidden",
        width: size,
      }}
    >
      {showImage ? (
        <img
          alt=""
          src={assetUrl ?? undefined}
          onError={() => {
            setImageError(true);
            onImageError?.();
          }}
          onLoad={onImageLoad}
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
      ) : (
        <Icon color={colors.accent} size={Math.max(16, Math.round(size * 0.46))} />
      )}
    </span>
  );
}

type CatalogColors = ReturnType<typeof useTheme>["colors"];

function CatalogStatusPill({
  colors,
  isActive,
}: {
  colors: CatalogColors;
  isActive: boolean;
}) {
  const tone = isActive ? colors.success : colors.textMuted;
  const label = isActive ? "Active" : "Archived";

  return (
    <span
      aria-label={label}
      data-catalog-status={isActive ? "active" : "archived"}
      style={{
        alignItems: "center",
        backgroundColor: `${tone}18`,
        border: "none",
        boxSizing: "border-box",
        borderRadius: 999,
        display: "inline-flex",
        gap: 5,
        justifyContent: "flex-start",
        maxWidth: "100%",
        padding: "4px 8px",
        whiteSpace: "nowrap",
        width: "100%",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          backgroundColor: tone,
          borderRadius: "50%",
          flexShrink: 0,
          height: 6,
          width: 6,
        }}
      />
      <FitText
        as="span"
        excludeGlobalScale
        style={{
          color: tone,
          fontSize: 11,
          fontWeight: 700,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </FitText>
    </span>
  );
}

function CatalogTrackingTag({
  colors,
  mode,
}: {
  colors: CatalogColors;
  mode: "inherit" | "override";
}) {
  return (
    <span
      aria-label={`${mode} tracking`}
      data-catalog-tracking-tag={mode}
      style={{
        backgroundColor: `${colors.brand}12`,
        border: "none",
        borderRadius: 999,
        color: colors.brand,
        display: "inline-flex",
        flexShrink: 0,
        fontSize: 9.5,
        fontWeight: 850,
        letterSpacing: "0.1em",
        lineHeight: 1.2,
        padding: "2px 5px",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {mode.toUpperCase()}
    </span>
  );
}

function formatCatalogDate(value: string) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return value.slice(0, 10) || value;
}

function CatalogSystemTag({ colors }: { colors: CatalogColors }) {
  return (
    <span
      aria-label="System muscle definition"
      data-catalog-system-tag="true"
      style={{
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 999,
        color: colors.textSecondary,
        display: "inline-flex",
        flexShrink: 0,
        fontSize: 9.5,
        fontWeight: 850,
        letterSpacing: "0.1em",
        lineHeight: 1.2,
        padding: "2px 5px",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      SYSTEM
    </span>
  );
}

function createEmptyMuscleDefinitionDraft(): MuscleDefinitionEditorDraft {
  return {
    aliases: "",
    bodyRegion: "",
    iconAssetKey: null,
    iconKey: "dumbbell",
    iconKind: "library",
    key: "",
    name: "",
    sortOrder: 500,
  };
}

export type MuscleDefinitionField =
  | "bodyRegion"
  | "icon"
  | "key"
  | "name"
  | "sortOrder";

export type MuscleDefinitionValidationErrors = Partial<
  Record<MuscleDefinitionField, string>
>;

export function getMuscleDefinitionValidationErrors(
  draft: MuscleDefinitionEditorDraft,
  hasPendingIcon: boolean,
): MuscleDefinitionValidationErrors {
  const errors: MuscleDefinitionValidationErrors = {};
  const name = draft.name.trim();
  const bodyRegion = draft.bodyRegion.trim();
  const key = draft.key.trim();

  if (!name) errors.name = "Muscle name is required.";
  else if (name.length < 2)
    errors.name = "Muscle name must be at least 2 characters.";
  else if (name.length > 120)
    errors.name = "Muscle name must not exceed 120 characters.";

  if (!bodyRegion) errors.bodyRegion = "Body region is required.";
  else if (bodyRegion.length < 2)
    errors.bodyRegion = "Body region must be at least 2 characters.";
  else if (bodyRegion.length > 80)
    errors.bodyRegion = "Body region must not exceed 80 characters.";

  if (key.length > 100)
    errors.key = "Key must not exceed 100 characters.";

  if (
    !Number.isFinite(draft.sortOrder) ||
    !Number.isInteger(draft.sortOrder) ||
    draft.sortOrder < 0
  ) {
    errors.sortOrder = "Sort order must be a whole number of 0 or greater.";
  }

  if (
    draft.iconKind === "custom" &&
    !hasPendingIcon &&
    !draft.iconAssetKey?.trim()
  ) {
    errors.icon = "Upload a managed PNG, JPEG, or WebP image before saving.";
  }

  return errors;
}

export type ExerciseDraftValidationIssue = ExerciseEditorValidationIssue & {
  movementStep?: number;
  stepId: ExerciseWorkbenchStepId;
};

function getMovementStepForIssue(issue: ExerciseEditorValidationIssue) {
  if (issue.path.includes("spatialRequirements")) return 4;
  if (
    issue.path.includes("repThresholds") ||
    issue.path.includes("holdDurationSeconds") ||
    issue.path.includes("partialRepPolicy") ||
    issue.path.includes("countAt") ||
    issue.path.includes("requiredSides") ||
    issue.path.includes("repModel")
  ) {
    return 3;
  }
  if (
    issue.path.includes("rig") ||
    issue.path.includes("trackingRequirements") ||
    issue.path.includes("primaryJoints")
  ) {
    return 2;
  }
  return 0;
}

function mapDraftValidationIssue(
  issue: ExerciseEditorValidationIssue,
): ExerciseDraftValidationIssue {
  if (issue.path.startsWith("muscleTargets")) {
    return { ...issue, stepId: "training" };
  }
  if (issue.path.startsWith("handShapeProfile")) {
    return { ...issue, stepId: "hand" };
  }
  if (issue.path.startsWith("movementProfile")) {
    return {
      ...issue,
      movementStep: getMovementStepForIssue(issue),
      stepId: "movement",
    };
  }
  if (
    issue.path === "name" ||
    issue.path === "instructions" ||
    issue.path === "description"
  ) {
    return { ...issue, stepId: "setup" };
  }
  if (issue.path.startsWith("tracking")) {
    return { ...issue, stepId: "tracking" };
  }
  return { ...issue, stepId: "review" };
}

function useExerciseLabPageState() {
  const { colors, settings } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const queryClient = useQueryClient();
  const [actionResult, setActionResult] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const actionReturnFocusRef = useRef<HTMLElement | null>(null);
  const showMessage = (message: string, tone: "success" | "error" = "success") => {
    actionReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActionResult({ message, tone });
  };
  const dismissActionResult = () => {
    setActionResult(null);
    requestAnimationFrame(() => {
      const previous = actionReturnFocusRef.current;
      const target = previous?.isConnected ? previous : document.querySelector<HTMLElement>('button[aria-label^="Edit "]');
      target?.focus();
    });
  };
  const [mode, setMode] = useState<SurfaceMode>("library");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryCategory, setLibraryCategory] = useState<string>("");
  const [libraryScope, setLibraryScope] = useState<LibraryScope>("active");
  const [libraryPage, setLibraryPage] = useState(1);
  const [muscleSearch, setMuscleSearch] = useState("");
  const [muscleDraft, setMuscleDraft] = useState<MuscleDefinitionEditorDraft>(
    createEmptyMuscleDefinitionDraft(),
  );
  const [pendingMuscleIconFile, setPendingMuscleIconFile] =
    useState<File | null>(null);
  const [muscleIconUploadError, setMuscleIconUploadError] = useState<
    string | null
  >(null);
  const [muscleFormError, setMuscleFormError] = useState<string | null>(null);
  const [muscleSubmitAttempted, setMuscleSubmitAttempted] = useState(false);
  const [muscleTouchedFields, setMuscleTouchedFields] = useState<
    Partial<Record<MuscleDefinitionField, boolean>>
  >({});
  const [editingMuscleId, setEditingMuscleId] = useState<string | null>(null);
  const [muscleEditorOpen, setMuscleEditorOpen] = useState(false);
  const [musclePage, setMusclePage] = useState(1);
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [exerciseWorkbenchStep, setExerciseWorkbenchStep] =
    useState<ExerciseWorkbenchStep>(1);
  const [draft, setDraft] = useState<ExerciseDraft>(createExerciseDraft());
  const [activeEditorTab, setActiveEditorTab] =
    useState<ExerciseEditorTab>("basics");
  const initialDraftRef = useRef<ExerciseDraft>(createExerciseDraft());
  const sharedFamilySubmitRef = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationState, setConfirmationState] =
    useState<ConfirmationState>(null);
  const [isCompact, setIsCompact] = useState(false);
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
  const muscleValidationErrors = useMemo(
    () =>
      getMuscleDefinitionValidationErrors(
        muscleDraft,
        Boolean(pendingMuscleIconFile),
      ),
    [muscleDraft, pendingMuscleIconFile],
  );

  useEffect(() => {
    const evaluateViewport = () => {
      setIsCompact(window.innerWidth < 1220);
    };
    evaluateViewport();
    window.addEventListener("resize", evaluateViewport);
    return () => window.removeEventListener("resize", evaluateViewport);
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (
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
  const uploadMuscleIconMutation = useMutation(
    uploadImageMutationOptions(webApiClient),
  );
  const updateMuscleDefinitionMutation = useMutation(
    updateMuscleDefinitionMutationOptions(webApiClient, queryClient),
  );
  const archiveMuscleDefinitionMutation = useMutation(
    archiveMuscleDefinitionMutationOptions(webApiClient, queryClient),
  );
  const updateExerciseMutation = useMutation(
    updateFitnessExerciseMutationOptions(webApiClient, queryClient),
  );
  const updateMovementFamilyMutation = useMutation(
    updateExerciseMovementFamilyMutationOptions(webApiClient, queryClient),
  );
  const workbenchMotionKey = mode;

  useEffect(() => {
    setLibraryPage(1);
  }, [librarySearch, libraryCategory, libraryScope]);

  useEffect(() => {
    setMusclePage(1);
  }, [muscleSearch]);

  const sheetPending =
    createExerciseMutation.isPending ||
    updateExerciseMutation.isPending;
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
    for (const exercise of libraryItems) {
      merged.set(exercise.id, exercise);
    }
    return Array.from(merged.values());
  }, [libraryItems]);
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
    expectedMovementExercise: draft.movementFamily?.key ?? null,
    handShapeProfile: draft.handShapeProfile,
    movementProfile:
      draft.trackingMode === "manual" ? null : draft.movementProfile,
    muscleGroup: draft.muscleGroup,
    muscleDefinitions: activeMuscleDefinitions,
    muscleTargets: draft.muscleTargets,
  });
  const trackingSourceError = draft.trackingMode === "inherit" && !draft.movementFamily
    ? "This exercise has no shared movement settings. In Tracking Choice, select Override this exercise to save your drawing."
    : null;
  const draftValidationIssues = useMemo<ExerciseDraftValidationIssue[]>(() => {
    const issues: ExerciseDraftValidationIssue[] = [];
    const name = draft.name.trim();
    const instructions = draft.instructions.trim();
    const description = draft.description.trim();

    if (name.length < 3) {
      issues.push(
        mapDraftValidationIssue({
          code: "exercise_name_too_short",
          message: "Exercise name must be at least 3 characters.",
          path: "name",
          suggestion: "Add a searchable exercise name with at least 3 characters.",
        }),
      );
    } else if (name.length > 90) {
      issues.push(
        mapDraftValidationIssue({
          code: "exercise_name_too_long",
          message: "Exercise name must stay under 90 characters.",
          path: "name",
          suggestion: "Shorten the exercise name to 90 characters or fewer.",
        }),
      );
    }
    if (duplicateDraftExercise) {
      issues.push(
        mapDraftValidationIssue({
          code: "exercise_name_duplicate",
          message: `A global exercise named "${duplicateDraftExercise.name}" already exists. Edit that record or choose a clearer name.`,
          path: "name",
          suggestion: "Choose a distinct searchable name or edit the existing exercise.",
        }),
      );
    }

    if (trackingSourceError) {
      issues.push(mapDraftValidationIssue({
        code: "exercise_tracking_source_missing",
        message: trackingSourceError,
        path: "trackingMode",
        suggestion: "Select Override this exercise to use your own movement settings.",
      }));
    }
    if (draft.trackingMode !== "manual") {
      issues.push(
        ...contractValidation.issues.map(mapDraftValidationIssue),
      );
    } else {
      issues.push(
        ...contractValidation.issues.filter(
          (issue) => !issue.path.startsWith("movementProfile"),
        ).map(mapDraftValidationIssue),
      );
    }

    if (instructions.length < 12) {
      issues.push(
        mapDraftValidationIssue({
          code: "exercise_instructions_too_short",
          message: "Instruction summary needs at least 12 characters.",
          path: "instructions",
          suggestion: "Add at least one concise coaching cue, 12 characters or longer.",
        }),
      );
    }
    if (description && description.length < 12) {
      issues.push(
        mapDraftValidationIssue({
          code: "exercise_description_too_short",
          message: "Description must be at least 12 characters or left blank.",
          path: "description",
          suggestion: "Add a fuller description or leave this optional field blank.",
        }),
      );
    }
    return issues;
  }, [
    contractValidation.issues,
    draft.description,
    draft.instructions,
    draft.name,
    draft.trackingMode,
    duplicateDraftExercise,
    trackingSourceError,
  ]);
  const exerciseWorkbenchSteps = useMemo(
    () =>
      getExerciseWorkbenchSteps({
        trackingMode: draft.trackingMode,
      }),
    [draft.trackingMode],
  );

  useEffect(() => {
    const lastStep = exerciseWorkbenchSteps.at(-1)?.step ?? 1;
    setExerciseWorkbenchStep((current) =>
      current > lastStep ? (lastStep as ExerciseWorkbenchStep) : current,
    );
  }, [exerciseWorkbenchSteps]);

  const definitionChecklist = [
    {
      complete: !draftValidationIssues.some((issue) => issue.path === "name"),
      label: duplicateDraftExercise
        ? `Name is already used by ${duplicateDraftExercise.name}`
        : "Unique searchable name",
    },
    {
      complete: !draftValidationIssues.some(
        (issue) => issue.stepId === "training",
      ),
      label: "Primary muscle and 100% Muscle Effort XP",
    },
    {
      complete: !draftValidationIssues.some(
        (issue) => issue.path === "instructions",
      ),
      label: "Movement instructions",
    },
    {
      complete:
        draft.trackingMode === "manual" ||
        !draftValidationIssues.some(
          (issue) => issue.stepId === "tracking" || issue.stepId === "movement" || issue.stepId === "hand",
        ),
      label: "Movement contract and visual rig",
    },
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
    if (!nextState) setExerciseWorkbenchStep(1);

    let nextDraft: ExerciseDraft;
    if (!nextState) {
      nextDraft = createExerciseDraft();
    } else if (nextState.mode === "edit") {
      nextDraft = {
        ...createExerciseDraft({
          aliases: nextState.exercise.aliases.map(({ kind, label }) => ({ kind, label })),
          category: nextState.exercise.category,
          description: nextState.exercise.description,
          handShapeProfile: nextState.exercise.handShapeProfile,
          instructions: nextState.exercise.instructions,
          movementProfile: nextState.exercise.movementProfile,
          movementProfileOverride: nextState.exercise.movementProfileOverride,
          movementFamily: nextState.exercise.movementFamily,
          trackingMode: nextState.exercise.trackingMode,
          muscleGroup: nextState.exercise.muscleGroup,
          muscleTargets: normalizeExerciseMuscleTargets(
            nextState.exercise.muscleTargets,
            nextState.exercise.muscleGroup,
          ),
          name: nextState.exercise.name,
        }),
        imageUrl: nextState.exercise.imageUrl ?? "",
        videoUrl: nextState.exercise.videoUrl ?? "",
      };
    } else {
      nextDraft = createExerciseDraft();
    }

    initialDraftRef.current = nextDraft;
    const contract = validatePoseMovementContract(nextDraft.movementProfile?.movementContract);
    if (nextDraft.trackingMode !== "manual" && contract.valid && contract.normalized &&
        nextDraft.movementProfile && !nextDraft.movementProfile.rig?.keyframes?.length) {
      nextDraft = { ...nextDraft, movementProfile: { ...nextDraft.movementProfile,
        rig: createGeneratedExerciseRigFromMovementContract({ movementContract: contract.normalized, exerciseLabel: nextDraft.name }),
      } };
    }
    setDraft(nextDraft);
  };

  const handleOpenCreate = () => {
    setMode("library");
    replaceSurfaceRoute("library");
    setExerciseWorkbenchStep(1);
    resetSheet({ mode: "create" });
  };

  const handleOpenEdit = (exercise: FitnessExerciseRecord) => {
    setMode("library");
    replaceSurfaceRoute("library");
    setExerciseWorkbenchStep(1);
    resetSheet({ mode: "edit", exercise });
  };

  const goToExerciseWorkbenchStep = (step: ExerciseWorkbenchStep) => {
    if (exerciseWorkbenchSteps.some((entry) => entry.step === step)) {
      setExerciseWorkbenchStep(step);
    }
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
      showMessage(getErrorMessage(error, "Unable to update exercise status."), "error");
    }
  };

  const markMuscleFieldTouched = (field: MuscleDefinitionField) => {
    setMuscleTouchedFields((current) => ({ ...current, [field]: true }));
    setMuscleFormError(null);
  };

  const handleMuscleIconFileChange = (file: File) => {
    markMuscleFieldTouched("icon");
    if (!isAllowedMuscleIconFile(file)) {
      setMuscleIconUploadError(MUSCLE_ICON_UPLOAD_ERROR);
      return false;
    }

    setMuscleIconUploadError(null);
    setPendingMuscleIconFile(file);
    setMuscleDraft((current) => ({
      ...current,
      iconAssetKey: null,
      iconKind: "custom",
    }));
    return true;
  };

  const selectMuscleLibraryIcon = (value: string) => {
    markMuscleFieldTouched("icon");
    setPendingMuscleIconFile(null);
    setMuscleIconUploadError(null);
    setMuscleDraft((current) => ({
      ...current,
      iconAssetKey: null,
      iconKey: getDefaultMuscleIconKey(value),
      iconKind: "library",
    }));
  };

  const resetMuscleDraft = (definition?: MuscleDefinitionRecord) => {
    const iconAssetKey = definition?.iconAssetKey ?? null;
    const iconKind: ProgressionIconKind =
      definition?.iconKind === "custom" && iconAssetKey
        ? "custom"
        : "library";
    setEditingMuscleId(definition?.id ?? null);
    setPendingMuscleIconFile(null);
    setMuscleIconUploadError(null);
    setMuscleFormError(null);
    setMuscleSubmitAttempted(false);
    setMuscleTouchedFields({});
    setMuscleDraft({
      aliases: definition?.aliases.join(", ") ?? "",
      bodyRegion: definition?.bodyRegion ?? "",
      iconAssetKey,
      iconKey: getDefaultMuscleIconKey(definition?.iconKey),
      iconKind,
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

  const toMuscleDefinitionPayload = (
    iconAssetKey = muscleDraft.iconAssetKey,
  ):
    | CreateMuscleDefinitionInput
    | UpdateMuscleDefinitionInput => ({
    aliases: muscleDraft.aliases
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean),
    bodyRegion: muscleDraft.bodyRegion.trim(),
    ...(editingMuscleId ? {} : { key: muscleDraft.key.trim() || undefined }),
    iconAssetKey:
      muscleDraft.iconKind === "custom" && iconAssetKey?.trim()
        ? iconAssetKey.trim()
        : null,
    iconKey:
      muscleDraft.iconKind === "custom" && iconAssetKey?.trim()
        ? null
        : getDefaultMuscleIconKey(muscleDraft.iconKey),
    iconKind:
      muscleDraft.iconKind === "custom" && iconAssetKey?.trim()
        ? "custom"
        : "library",
    name: muscleDraft.name.trim(),
    sortOrder: Number.isFinite(Number(muscleDraft.sortOrder))
      ? Number(muscleDraft.sortOrder)
      : 500,
  });

  const handleSaveMuscleDefinition = async () => {
    setMuscleSubmitAttempted(true);
    const validationErrors = getMuscleDefinitionValidationErrors(
      muscleDraft,
      Boolean(pendingMuscleIconFile),
    );
    if (Object.keys(validationErrors).length > 0) {
      setMuscleFormError("Correct the highlighted fields before saving.");
      return;
    }

    setMuscleFormError(null);
    setMuscleIconUploadError(null);

    let iconAssetKey = muscleDraft.iconAssetKey;
    if (muscleDraft.iconKind === "custom") {
      if (pendingMuscleIconFile) {
        try {
          const formData = new FormData();
          formData.append("file", pendingMuscleIconFile);
          const uploadResult = await uploadMuscleIconMutation.mutateAsync(
            formData,
          );
          iconAssetKey = uploadResult.fileKey?.trim() || null;
          if (!iconAssetKey) {
            throw new Error("Managed icon upload did not return a file key.");
          }
          setPendingMuscleIconFile(null);
          setMuscleDraft((current) => ({
            ...current,
            iconAssetKey,
            iconKind: "custom",
          }));
        } catch (error) {
          const message = getErrorMessage(
            error,
            "Unable to upload the muscle icon.",
          );
          setMuscleIconUploadError(message);
          setMuscleFormError(message);
          return;
        }
      }

      if (!iconAssetKey?.trim()) {
        const message =
          "Upload a managed PNG, JPEG, or WebP image before saving.";
        setMuscleIconUploadError(message);
        setMuscleFormError(message);
        return;
      }
    } else {
      iconAssetKey = null;
    }

    try {
      if (editingMuscleId) {
        await updateMuscleDefinitionMutation.mutateAsync({
          muscleDefinitionId: editingMuscleId,
          payload: toMuscleDefinitionPayload(
            iconAssetKey,
          ) as UpdateMuscleDefinitionInput,
        });
        showMessage(`${muscleDraft.name.trim()} was updated.`);
      } else {
        await createMuscleDefinitionMutation.mutateAsync({
          payload: toMuscleDefinitionPayload(
            iconAssetKey,
          ) as CreateMuscleDefinitionInput,
        });
        showMessage(`${muscleDraft.name.trim()} was added to Muscle Library.`);
      }
      resetMuscleDraft();
      setMuscleEditorOpen(false);
    } catch (error) {
      setMuscleFormError(
        getErrorMessage(error, "Unable to save muscle definition."),
      );
      showMessage(getErrorMessage(error, "Unable to save muscle definition."), "error");
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
      showMessage(getErrorMessage(error, "Unable to archive muscle."), "error");
    }
  };

  const validateDraft = () => {
    const name = draft.name.trim();
    const instructions = draft.instructions.trim();
    const description = draft.description.trim();

    if (name.length < 3)
      return "Exercise name must be at least 3 characters.";
    if (name.length > 90)
      return "Exercise name must stay under 90 characters.";
    if (duplicateDraftExercise) {
      return `A global exercise named "${duplicateDraftExercise.name}" already exists. Edit that record or choose a clearer name.`;
    }
    if (trackingSourceError) return trackingSourceError;
    if (contractValidation.errors.length) {
      return contractValidation.errors[0];
    }
    if (instructions.length < 12)
      return "Instruction summary needs at least 12 characters.";
    if (description && description.length < 12)
      return "Description must be at least 12 characters or left blank.";
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
        const persistSharedProfile = shouldPersistCanonicalFamilyProfile({
          draft,
          exerciseId: sheetState.exercise.id,
          initialMovementProfile:
            initialDraftRef.current?.movementProfile ?? null,
        }) || (draft.trackingMode === "inherit" && draft.movementFamily?.canonicalExerciseId === sheetState.exercise.id &&
          JSON.stringify(draft.handShapeProfile) !== JSON.stringify(initialDraftRef.current.handShapeProfile));
        if (
          persistSharedProfile &&
          draft.movementFamily &&
          draft.movementProfile
        ) {
          const affectedNames = draft.movementFamily.inheritingExerciseIds.map(
            (id) =>
              libraryItems.find((exercise) => exercise.id === id)?.name ?? id,
          );
          setConfirmationState({
            affectedNames,
            family: draft.movementFamily,
            mode: "shared-family",
            movementProfile: draft.movementProfile,
            saveExerciseAfter: true,
          });
          return;
        }
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

      showMessage(`${createdExercise.name} was added to the global library.`);

      handleModeChange("library");
      setLibrarySearch(createdExercise.name);
      closeSheetAfterSave();
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to save exercise."));
      showMessage(getErrorMessage(error, "Unable to save exercise."), "error");
    }
  };

  const handleSaveSharedMovementContract = () => {
    const family = draft.movementFamily;
    if (!family || !draft.movementProfile) return;
    const validation = validateExerciseEditorContract({
      expectedMovementExercise: family.key,
      handShapeProfile: draft.handShapeProfile,
      movementProfile: draft.movementProfile,
      muscleDefinitions: activeMuscleDefinitions,
      muscleGroup: draft.muscleGroup,
      muscleTargets: draft.muscleTargets,
    });
    if (validation.errors.length > 0) {
      setFormError(validation.errors[0]);
      return;
    }
    const affectedNames = family.inheritingExerciseIds.map((id) =>
      libraryItems.find((exercise) => exercise.id === id)?.name ?? id,
    );
    setConfirmationState({
      affectedNames,
      family,
      mode: "shared-family",
      movementProfile: draft.movementProfile,
    });
  };

  const confirmSharedMovementContract = async (
    state: Extract<ConfirmationState, { mode: "shared-family" }>,
  ) => {
    if (sharedFamilySubmitRef.current) return;
    const validation = validateExerciseEditorContract({
      expectedMovementExercise: state.family.key,
      handShapeProfile: draft.handShapeProfile,
      movementProfile: state.movementProfile,
      muscleDefinitions: activeMuscleDefinitions,
      muscleGroup: draft.muscleGroup,
      muscleTargets: draft.muscleTargets,
    });
    if (validation.errors.length > 0) {
      setFormError(validation.errors[0]);
      setConfirmationState(null);
      return;
    }
    sharedFamilySubmitRef.current = true;
    try {
      if (state.saveExerciseAfter && sheetState?.mode === "edit") {
        await updateExerciseMutation.mutateAsync({
          exerciseId: sheetState.exercise.id,
          payload: {
            ...filterEmptyExerciseDraft(draft),
            sharedMovementUpdate: {
              familyId: state.family.id,
              expectedRevision: state.family.contractRevision,
              movementProfile: state.movementProfile,
              handShapeProfile: draft.handShapeProfile,
            },
          },
        });
        showMessage(`${draft.name.trim()} and its shared tracking were saved.`);
        setConfirmationState(null);
        closeSheetAfterSave();
      } else {
        const result = await updateMovementFamilyMutation.mutateAsync({
          familyId: state.family.id,
          expectedRevision: state.family.contractRevision,
          movementProfile: state.movementProfile,
          handShapeProfile: draft.handShapeProfile,
        });
        setDraft((current) => ({ ...current, movementFamily: current.movementFamily
          ? { ...current.movementFamily, contractRevision: result.contract_revision } : null }));
        showMessage(
          `${state.family.displayName} shared tracking updated to revision ${result.contract_revision}.`,
        );
        setConfirmationState(null);
      }
    } catch (error) {
      setConfirmationState(null);
      showMessage(
        getErrorMessage(error, "Unable to finish saving exercise tracking."),
        "error",
      );
    } finally {
      sharedFamilySubmitRef.current = false;
    }
  };

  const confirmationTitle =
    confirmationState?.mode === "discard-sheet"
      ? "Discard changes?"
      : confirmationState?.mode === "archive"
        ? confirmationState.nextActive
          ? "Restore global exercise?"
          : "Archive global exercise?"
        : confirmationState?.mode === "shared-family"
          ? `Edit shared tracking for ${confirmationState.family.displayName}?`
          : "";
  const confirmationMessage =
    confirmationState?.mode === "discard-sheet"
      ? "You have unsaved edits in this sheet. Closing now will drop the draft changes."
      : confirmationState?.mode === "archive"
          ? confirmationState.nextActive
            ? `${confirmationState.exercise.name} will become available in the active global library again.`
            : `${confirmationState.exercise.name} will be hidden from the active global library, but can still be restored later.`
          : confirmationState?.mode === "shared-family"
            ? "This calibration is shared. Every active inheriting exercise listed below will use the new revision."
            : "";
  const confirmationLabel =
    confirmationState?.mode === "discard-sheet"
      ? "Discard changes"
      : confirmationState?.mode === "archive"
          ? confirmationState.nextActive
            ? "Restore exercise"
            : "Archive exercise"
          : confirmationState?.mode === "shared-family"
            ? "Update shared tracking"
            : "Confirm";
  const confirmationLoadingLabel =
    confirmationState?.mode === "archive"
        ? confirmationState.nextActive
          ? "Restoring..."
          : "Archiving..."
        : confirmationState?.mode === "shared-family"
          ? "Updating shared tracking..."
          : undefined;
  const confirmationIcon =
    confirmationState?.mode === "archive" && confirmationState.nextActive
      ? RefreshCcw
      : confirmationState?.mode === "discard-sheet"
        ? X
        : confirmationState?.mode === "shared-family"
          ? RefreshCcw
          : Archive;
  const confirmationLoading =
    confirmationState?.mode === "archive"
      ? updateExerciseMutation.isPending
      : confirmationState?.mode === "shared-family"
        ? updateMovementFamilyMutation.isPending
        : false;
  const handleConfirmAction = () => {
    if (!confirmationState) return;
    if (confirmationState.mode === "discard-sheet") {
      setConfirmationState(null);
      resetSheet(null);
      return;
    }
    if (confirmationState.mode === "shared-family") {
      void confirmSharedMovementContract(confirmationState);
      return;
    }
    void handleArchiveToggle(
      confirmationState.exercise,
      confirmationState.nextActive,
    );
  };
  const libraryTableColumns: FitTableColumn<FitnessExerciseRecord>[] = [
    {
      key: "name",
      heading: "Exercise",
      headingStyle: { width: "37.5%" },
      align: "left",
      render: (exercise, c) => {
        const trackingMode =
          exercise.trackingMode === "inherit" || exercise.trackingMode === "override"
            ? exercise.trackingMode
            : null;
        const supportingText =
          exercise.description?.trim() ||
          exercise.instructions?.trim() ||
          "No description or instructions saved yet.";

        return (
          <div
            data-catalog-exercise-tracking-mode={exercise.trackingMode}
            style={{ display: "grid", gap: 2, minWidth: 0 }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 6,
                minWidth: 0,
              }}
            >
              <FitText
                as="span"
                excludeGlobalScale
                style={{
                  color: c.textPrimary,
                  fontSize: 13,
                  fontWeight: 700,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {exercise.name}
              </FitText>
              {trackingMode ? (
                <CatalogTrackingTag colors={c} mode={trackingMode} />
              ) : null}
            </div>
            <FitText
              as="span"
              excludeGlobalScale
              style={{
                color: c.textSecondary,
                fontSize: 11.5,
                lineHeight: 1.25,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {supportingText}
            </FitText>
          </div>
        );
      },
    },
    {
      key: "category",
      heading: "Category",
      headingStyle: { width: "14%" },
      align: "left",
      render: (exercise, c) => (
        <FitText
          as="span"
          excludeGlobalScale
          style={{
            color: c.textSecondary,
            fontSize: 12.5,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          data-catalog-category="plain"
        >
          {toTitleCase(exercise.category)}
        </FitText>
      ),
    },
    {
      key: "muscle",
      heading: "Muscle",
      headingStyle: { width: "15.5%" },
      align: "left",
      render: (exercise, c) => (
        <FitText
          as="span"
          excludeGlobalScale
          style={{
            color: c.textSecondary,
            fontSize: 12.5,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {toTitleCase(exercise.muscleGroup)}
        </FitText>
      ),
    },
    {
      key: "status",
      heading: "Status",
      headingStyle: { width: "12.5%" },
      align: "left",
      render: (exercise, c) => (
        <CatalogStatusPill colors={c} isActive={exercise.isActive} />
      ),
    },
    {
      key: "updated",
      heading: "Updated",
      headingStyle: { width: "12.5%" },
      align: "left",
      render: (exercise, c) => (
        <FitText
          as="span"
          excludeGlobalScale
          style={{
            color: c.textSecondary,
            fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
            fontSize: 11.5,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {formatCatalogDate(exercise.updatedAt)}
        </FitText>
      ),
    },
  ];

  const libraryTableActions: FitTableAction<FitnessExerciseRecord>[] = [
    {
      icon: Pencil,
      iconSize: 16,
      iconOnly: true,
      label: "Edit",
      ariaLabel: (exercise) => `Edit ${exercise.name}`,
      onClick: handleOpenEdit,
      style: CATALOG_ACTION_BUTTON_STYLE,
      variant: "iconClear",
    },
    {
      icon: Archive,
      iconSize: 16,
      iconOnly: true,
      label: "Archive",
      ariaLabel: (exercise) => `Archive ${exercise.name}`,
      hidden: (exercise) => !exercise.isActive,
      onClick: (exercise) =>
        setConfirmationState({
          exercise,
          mode: "archive",
          nextActive: false,
        }),
      style: CATALOG_ACTION_BUTTON_STYLE,
      variant: "iconClear",
    },
    {
      icon: RefreshCcw,
      iconSize: 16,
      iconOnly: true,
      label: "Restore",
      ariaLabel: (exercise) => `Restore ${exercise.name}`,
      hidden: (exercise) => exercise.isActive,
      onClick: (exercise) =>
        setConfirmationState({
          exercise,
          mode: "archive",
          nextActive: true,
        }),
      style: CATALOG_ACTION_BUTTON_STYLE,
      variant: "iconClear",
    },
  ];

  const muscleTableColumns: FitTableColumn<MuscleDefinitionRecord>[] = [
    {
      key: "name",
      heading: "Muscle",
      headingStyle: { width: "31.35%" },
      align: "left",
      render: (definition, c) => (
        <div
          data-catalog-muscle-system={definition.isSystem ? "true" : "false"}
          style={{
            alignItems: "center",
            display: "flex",
            gap: 8,
            minWidth: 0,
          }}
        >
          <MuscleDefinitionIcon
            colors={{
              accent: c.brand,
              background: c.surfaceRaised,
              border: c.border,
            }}
            definition={definition}
            size={32}
          />
          <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 6,
                minWidth: 0,
              }}
            >
              <FitText
                as="span"
                excludeGlobalScale
                style={{
                  color: c.textPrimary,
                  fontSize: 13,
                  fontWeight: 700,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {definition.name}
              </FitText>
              {definition.isSystem ? <CatalogSystemTag colors={c} /> : null}
            </div>
            <FitText
              as="span"
              excludeGlobalScale
              style={{
                color: c.textSecondary,
                fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
                fontSize: 10.5,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {definition.key} · {
                definition.iconKind === "custom" && definition.iconAssetKey
                  ? "Managed icon"
                  : `${toTitleCase(getDefaultMuscleIconKey(definition.iconKey))} icon`
              }
            </FitText>
          </div>
        </div>
      ),
    },
    {
      key: "region",
      heading: "Region",
      headingStyle: { width: "15.67%" },
      align: "left",
      render: (definition, c) => (
        <FitText
          as="span"
          excludeGlobalScale
          style={{
            color: c.textSecondary,
            fontSize: 12.5,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {toTitleCase(definition.bodyRegion)}
        </FitText>
      ),
    },
    {
      key: "aliases",
      heading: "Aliases",
      headingStyle: { width: "18.81%" },
      align: "left",
      render: (definition, c) => (
        <FitText
          as="span"
          excludeGlobalScale
          style={{
            color: c.textSecondary,
            fontSize: 12.5,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {definition.aliases.length ? definition.aliases.join(", ") : "None"}
        </FitText>
      ),
    },
    {
      key: "sort",
      heading: "Sort",
      headingStyle: { width: "9.4%" },
      align: "left",
      render: (definition, c) => (
        <FitText
          as="span"
          excludeGlobalScale
          style={{
            color: c.textSecondary,
            fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
            fontSize: 12.5,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {definition.sortOrder}
        </FitText>
      ),
    },
    {
      key: "status",
      heading: "Status",
      headingStyle: { width: "12.55%" },
      align: "left",
      render: (definition, c) => (
        <CatalogStatusPill colors={c} isActive={definition.isActive} />
      ),
    },
  ];

  const muscleTableActions: FitTableAction<MuscleDefinitionRecord>[] = [
    {
      icon: Pencil,
      iconSize: 16,
      iconOnly: true,
      label: "Edit",
      ariaLabel: (definition) => `Edit ${definition.name}`,
      onClick: openMuscleEditor,
      style: CATALOG_ACTION_BUTTON_STYLE,
      variant: "iconClear",
    },
    {
      icon: Archive,
      iconSize: 16,
      iconOnly: true,
      label: "Archive",
      ariaLabel: (definition) => `Archive ${definition.name}`,
      hidden: (definition) => !definition.isActive,
      onClick: (definition) => void handleArchiveMuscleDefinition(definition),
      style: CATALOG_ACTION_BUTTON_STYLE,
      variant: "iconClear",
    },
    {
      icon: RefreshCcw,
      iconSize: 16,
      iconOnly: true,
      label: "Restore",
      ariaLabel: (definition) => `Restore ${definition.name}`,
      hidden: (definition) => definition.isActive,
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
            showMessage(getErrorMessage(error, "Unable to restore muscle."), "error"),
          ),
      style: CATALOG_ACTION_BUTTON_STYLE,
      variant: "iconClear",
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
    archiveMuscleDefinitionMutation,
    canAnimate,
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
    definitionChecklist,
    draft,
    draftValidationIssues,
    draftValidationError,
    duplicateDraftExercise,
    editorColors,
    exerciseWorkbenchStep,
    exerciseWorkbenchSteps,
    editingMuscleId,
    fadeIn,
    actionResult,
    dismissActionResult,
    formError,
    fullMotion,
    handleCloseSheet,
    handleConfirmAction,
    handleModeChange,
    handleMuscleIconFileChange,
    handleOpenCreate,
    handleSaveMuscleDefinition,
    handleSheetSubmit,
    handleSaveSharedMovementContract,
    goToExerciseWorkbenchStep,
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
    mode,
    muscleDefinitions,
    muscleDefinitionsQuery,
    muscleDraft,
    muscleFormError,
    muscleIconUploadError,
    muscleEditorOpen,
    musclePage,
    muscleSearch,
    muscleTableActions,
    muscleTableColumns,
    muscleTotalPages,
    muscleSubmitAttempted,
    muscleTouchedFields,
    muscleValidationErrors,
    markMuscleFieldTouched,
    openMuscleEditor,
    pendingMuscleIconFile,
    resetMuscleDraft,
    closeMuscleEditor,
    setActiveEditorTab,
    setConfirmationState,
    setDraft,
    setDraftField,
    setFormError,
    setLibraryCategory,
    setLibraryPage,
    setLibraryScope,
    setLibrarySearch,
    setMode,
    setMuscleDraft,
    setMusclePage,
    setMuscleSearch,
    selectMuscleLibraryIcon,
    sheetPending: sheetPending || updateMovementFamilyMutation.isPending,
    sheetState,
    showMessage,
    surfaceControlsStyle,
    surfaceTitleNavStyle,
    surfaceTopRowStyle,
    themeTransition,
    updateExerciseMutation,
    updateMuscleDefinitionMutation,
    uploadMuscleIconMutation,
    visibleMuscleDefinitions,
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
