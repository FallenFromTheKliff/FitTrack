import type {
  CreateFitnessExerciseInput,
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  ExerciseReviewEvidenceRecord,
  ExerciseReviewSubmissionRecord,
  ExerciseReviewSubmissionStatus,
  FitnessCreatorState,
  FitnessExerciseCategory,
  FitnessExerciseRecord,
} from "@fittrack/api-client";
import type { ThemeColors } from "@fittrack/types";
import {
  getPrimaryExerciseMuscleGroup,
  normalizeExerciseHandShapeProfile,
  normalizeExerciseMovementProfile,
  normalizeExerciseMuscleTargets,
} from "@fittrack/utils";

import type { AchievementReviewRecord } from "@/data/progress/milestones";

export type SurfaceMode = "library" | "milestones" | "muscles" | "review";
export type LibraryScope = "active" | "all";
export type MilestoneScope = "all" | "closed" | "pending";
export type MuscleDefinitionDraft = {
  aliases: string;
  bodyRegion: string;
  key: string;
  name: string;
  sortOrder: number;
};
export type ExerciseReviewCandidateLike = ExerciseReviewSubmissionRecord;
export type SheetState =
  | { mode: "create" }
  | { candidateId: string; mode: "publish" }
  | { exercise: FitnessExerciseRecord; mode: "edit" }
  | null;
export type ConfirmationState =
  | { mode: "archive"; exercise: FitnessExerciseRecord; nextActive: boolean }
  | { candidate: ExerciseReviewCandidateLike; mode: "leave-private" }
  | { mode: "discard-sheet" }
  | null;
export type ExerciseDraft = {
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

export const DRAWER_WIDTH = 420;
export const EMPTY_REVIEW_CANDIDATES: ExerciseReviewSubmissionRecord[] = [];
export const EMPTY_LIBRARY_EXERCISES: FitnessExerciseRecord[] = [];
export const MUSCLE_LIBRARY_PAGE_SIZE = 7;
export const SURFACE_MODE_OPTIONS: Array<{ label: string; value: SurfaceMode }> = [
  { label: "Review", value: "review" },
  { label: "Library", value: "library" },
  { label: "Muscles", value: "muscles" },
  { label: "Milestones", value: "milestones" },
];
export const CREATOR_STATE_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Candidate", value: "candidate" },
  { label: "Pending review", value: "pending_review" },
  { label: "Approved", value: "approved" },
  { label: "Suspended", value: "suspended" },
  { label: "Revoked", value: "revoked" },
] as const;
export const REVIEW_STATUS_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "All statuses", value: "" },
  { label: "Published", value: "published" },
  { label: "Left private", value: "left_private" },
  { label: "Rejected", value: "rejected" },
] as const;
export const CREATOR_DECISION_STATES = new Set<FitnessCreatorState>([
  "approved",
  "suspended",
  "revoked",
]);

export function getCreatorStateTone(state: FitnessCreatorState) {
  if (state === "approved") return "success";
  if (state === "suspended" || state === "revoked") return "danger";
  if (state === "pending_review") return "warning";
  if (state === "candidate") return "brand";
  return "muted";
}

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

export function formatDateTime(value?: string) {
  if (!value) return "Not reviewed yet";
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getMilestoneMetric(review: AchievementReviewRecord) {
  const match = review.badgeLabel.match(/\d+/);
  if (match) {
    return { label: "earned", value: `${match[0]}x` };
  }

  if (review.badgeLabel.toLowerCase().includes("streak")) {
    return { label: "streak", value: "7d" };
  }

  return { label: "badge", value: review.memberInitials };
}

export function getMilestonePrimaryTag(review: AchievementReviewRecord) {
  return review.badgeLabel
    .replace(/\s+Milestone$/i, "")
    .replace(/\s+Badge$/i, "");
}

export function getMilestoneSecondaryTag(review: AchievementReviewRecord) {
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

export function scoreExerciseMatch(
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

export function getEvidenceBars(evidence: ExerciseReviewEvidenceRecord | null) {
  if (Array.isArray(evidence)) return evidence;
  return [];
}

export function getEvidenceSummary(evidence: ExerciseReviewEvidenceRecord | null) {
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

export function getReviewStatusColor(status: ExerciseReviewSubmissionStatus, colors: ThemeColors) {
  if (status === "published") return colors.success;
  if (status === "rejected") return colors.danger;
  if (status === "left_private") return colors.warning;
  return colors.brand;
}

export function filterEmptyExerciseDraft(draft: ExerciseDraft): CreateFitnessExerciseInput {
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
