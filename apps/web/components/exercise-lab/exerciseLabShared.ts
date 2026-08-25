import type {
  CreateFitnessExerciseInput,
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseAliasInput,
  ExerciseMovementFamilySummaryRecord,
  ExerciseMuscleTargetRecord,
  FitnessExerciseCategory,
  FitnessExerciseRecord,
  ExerciseTrackingMode,
} from "@fittrack/api-client";
import {
  getPrimaryExerciseMuscleGroup,
  normalizeExerciseHandShapeProfile,
  normalizeExerciseMuscleTargets,
} from "@fittrack/utils";

export type SurfaceMode = "library" | "muscles";
export type LibraryScope = "active" | "all";
export type MuscleDefinitionDraft = {
  aliases: string;
  bodyRegion: string;
  key: string;
  name: string;
  sortOrder: number;
};
export type SheetState =
  | { mode: "create" }
  | { exercise: FitnessExerciseRecord; mode: "edit" }
  | null;
export type ConfirmationState =
  | { mode: "archive"; exercise: FitnessExerciseRecord; nextActive: boolean }
  | { mode: "discard-sheet" }
  | {
      mode: "shared-family";
      affectedNames: string[];
      family: ExerciseMovementFamilySummaryRecord;
      movementProfile: ExerciseMovementProfileRecord;
    }
  | null;
export type ExerciseDraft = {
  aliases: ExerciseAliasInput[];
  category: FitnessExerciseCategory;
  description: string;
  imageUrl: string;
  instructions: string;
  handShapeProfile: ExerciseHandShapeProfileRecord;
  movementProfile: ExerciseMovementProfileRecord | null;
  movementProfileOverride: Partial<ExerciseMovementProfileRecord> | null;
  movementFamily: ExerciseMovementFamilySummaryRecord | null;
  trackingMode: ExerciseTrackingMode;
  muscleGroup: string;
  muscleTargets: ExerciseMuscleTargetRecord[];
  name: string;
  videoUrl: string;
};

export const DRAWER_WIDTH = 420;
export const EMPTY_LIBRARY_EXERCISES: FitnessExerciseRecord[] = [];
export const MUSCLE_LIBRARY_PAGE_SIZE = 8;
export const SURFACE_MODE_OPTIONS: Array<{ label: string; value: SurfaceMode }> = [
  { label: "Exercise library", value: "library" },
  { label: "Muscle groups", value: "muscles" },
];

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function filterEmptyExerciseDraft(
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
    aliases: draft.aliases,
    name: draft.name.trim(),
    category: draft.category,
    muscleGroup,
    muscleTargets,
    ...(draft.trackingMode === "manual"
      ? { movementFamilyId: null, movementProfile: null, movementProfileOverride: null }
      : draft.trackingMode === "override"
        ? {
            movementFamilyId: draft.movementFamily?.id ?? null,
            movementProfileOverride: draft.movementProfile,
          }
        : { movementFamilyId: draft.movementFamily?.id ?? null }),
    trackingMode: draft.trackingMode,
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

export function normalizeExerciseName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isValidOptionalHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
