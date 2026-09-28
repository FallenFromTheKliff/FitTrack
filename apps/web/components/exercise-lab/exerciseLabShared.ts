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
export type ExerciseWorkbenchStep = 1 | 2 | 3 | 4 | 5 | 6;
export type ExerciseWorkbenchStepId =
  | "setup"
  | "training"
  | "tracking"
  | "movement"
  | "hand"
  | "review";

export type ExerciseWorkbenchStepDefinition = {
  description: string;
  id: ExerciseWorkbenchStepId;
  label: string;
  optional?: boolean;
  step: ExerciseWorkbenchStep;
};

const WORKBENCH_STEP_COPY: Record<
  ExerciseWorkbenchStepId,
  Omit<ExerciseWorkbenchStepDefinition, "step" | "id">
> = {
  setup: {
    description: "Name the movement and add coaching guidance.",
    label: "Exercise Setup",
  },
  training: {
    description: "Assign the muscles this movement trains.",
    label: "EXP Allocation",
  },
  tracking: {
    description: "Choose how this exercise is tracked.",
    label: "Tracking Choice",
  },
  movement: {
    description: "Define the movement phases and counting rules.",
    label: "Movement Builder",
  },
  hand: {
    description: "Document grip or hand-shape requirements when needed.",
    label: "Hand Setup",
    optional: true,
  },
  review: {
    description: "Verify the definition before publishing it.",
    label: "Review & Publish",
  },
};

/**
 * Build the visible workflow from the same progressive-disclosure rules as
 * the Figma Make reference. Media is intentionally not a workflow state;
 * legacy media fields remain on ExerciseDraft and in the persistence payload.
 *
 * Every camera-tracked exercise owns a Movement Builder state. Ownership is
 * resolved by the workbench (local override, canonical shared contract, or
 * inherited inspect-only contract); the workflow itself must not hide that
 * state based on the selected tracking source.
 */
export function getExerciseWorkbenchSteps(input: {
  trackingMode: ExerciseTrackingMode;
}): ExerciseWorkbenchStepDefinition[] {
  const ids: ExerciseWorkbenchStepId[] = ["setup", "training", "tracking"];
  if (input.trackingMode !== "manual") {
    ids.push("movement");
    ids.push("hand");
  }
  ids.push("review");
  return ids.map((id, index) => ({
    ...WORKBENCH_STEP_COPY[id],
    id,
    step: (index + 1) as ExerciseWorkbenchStep,
  }));
}

/**
 * Canonical workflow shape retained for consumers that need a complete
 * workflow definition. Manual exercises omit tracking-only states; inherited
 * exercises still expose Movement Builder for effective-contract inspection.
 */
export const EXERCISE_WORKBENCH_STEPS = getExerciseWorkbenchSteps({
  trackingMode: "override",
});
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
      saveExerciseAfter?: boolean;
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

export function shouldPersistCanonicalFamilyProfile(input: {
  draft: ExerciseDraft;
  exerciseId: string;
  initialMovementProfile: ExerciseMovementProfileRecord | null;
}) {
  return Boolean(
    input.draft.trackingMode === "inherit" &&
      input.draft.movementFamily?.canonicalExerciseId === input.exerciseId &&
      input.draft.movementProfile &&
      JSON.stringify(input.draft.movementProfile) !==
        JSON.stringify(input.initialMovementProfile),
  );
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
