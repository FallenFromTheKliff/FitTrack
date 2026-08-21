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
  updateMuscleDefinitionMutationOptions,
} from "@fittrack/query";
import {
  normalizeExerciseMuscleTargets,
  buildRenderableAssetUrl,
  validateExerciseEditorContract,
} from "@fittrack/utils";

import { WEB_API_BASE_URL, webApiClient } from "@/lib/api-client";
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
  EMPTY_LIBRARY_EXERCISES,
  MUSCLE_LIBRARY_PAGE_SIZE,
  filterEmptyExerciseDraft,
  formatDate,
  getErrorMessage,
  isValidOptionalHttpUrl,
  normalizeExerciseName,
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
  const [editingMuscleId, setEditingMuscleId] = useState<string | null>(null);
  const [muscleEditorOpen, setMuscleEditorOpen] = useState(false);
  const [musclePage, setMusclePage] = useState(1);
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [draft, setDraft] = useState<ExerciseDraft>(createExerciseDraft());
  const [activeEditorTab, setActiveEditorTab] =
    useState<ExerciseEditorTab>("basics");
  const initialDraftRef = useRef<ExerciseDraft>(createExerciseDraft());
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
          name: nextState.exercise.name,
        }),
        imageUrl: nextState.exercise.imageUrl ?? "",
        videoUrl: nextState.exercise.videoUrl ?? "",
      };
    } else {
      nextDraft = createExerciseDraft();
    }

    initialDraftRef.current = nextDraft;
    setDraft(nextDraft);
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

  const handleMuscleIconFileChange = (file: File) => {
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
    if (muscleDraft.name.trim().length < 2) {
      showMessage("Muscle name must be at least 2 characters.");
      return;
    }
    if (muscleDraft.bodyRegion.trim().length < 2) {
      showMessage("Body region must be at least 2 characters.");
      return;
    }

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
          showMessage(message);
          return;
        }
      }

      if (!iconAssetKey?.trim()) {
        const message =
          "Upload a managed PNG, JPEG, or WebP image before saving.";
        setMuscleIconUploadError(message);
        showMessage(message);
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

      showMessage(`${createdExercise.name} was added to the global library.`);

      handleModeChange("library");
      setLibrarySearch(createdExercise.name);
      closeSheetAfterSave();
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to save exercise."));
    }
  };

  const confirmationTitle =
    confirmationState?.mode === "discard-sheet"
      ? "Discard changes?"
      : confirmationState?.mode === "archive"
        ? confirmationState.nextActive
          ? "Restore global exercise?"
          : "Archive global exercise?"
        : "";
  const confirmationMessage =
    confirmationState?.mode === "discard-sheet"
      ? "You have unsaved edits in this sheet. Closing now will drop the draft changes."
      : confirmationState?.mode === "archive"
          ? confirmationState.nextActive
            ? `${confirmationState.exercise.name} will become available in the active global library again.`
            : `${confirmationState.exercise.name} will be hidden from the active global library, but can still be restored later.`
          : "";
  const confirmationLabel =
    confirmationState?.mode === "discard-sheet"
      ? "Discard changes"
      : confirmationState?.mode === "archive"
          ? confirmationState.nextActive
            ? "Restore exercise"
            : "Archive exercise"
          : "Confirm";
  const confirmationLoadingLabel =
    confirmationState?.mode === "archive"
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
      : false;
  const handleConfirmAction = () => {
    if (!confirmationState) return;
    if (confirmationState.mode === "discard-sheet") {
      setConfirmationState(null);
      resetSheet(null);
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
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 10,
            minWidth: 210,
          }}
        >
          <MuscleDefinitionIcon
            colors={{
              accent: c.brand,
              background: c.surfaceRaised,
              border: c.border,
            }}
            definition={definition}
            size={38}
          />
          <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <FitText
              style={{
                color: c.textPrimary,
                fontSize: 14,
                fontWeight: 850,
              }}
            >
              {definition.name}
            </FitText>
            <FitText style={{ color: c.textSecondary, fontSize: 12 }}>
              {definition.key} / {
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
    draftValidationError,
    duplicateDraftExercise,
    editorColors,
    editingMuscleId,
    fadeIn,
    feedbackMessage,
    formError,
    fullMotion,
    handleCloseSheet,
    handleConfirmAction,
    handleModeChange,
    handleMuscleIconFileChange,
    handleOpenCreate,
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
    mode,
    muscleDefinitions,
    muscleDefinitionsQuery,
    muscleDraft,
    muscleIconUploadError,
    muscleEditorOpen,
    musclePage,
    muscleSearch,
    muscleTableActions,
    muscleTableColumns,
    muscleTotalPages,
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
    sheetPending,
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
