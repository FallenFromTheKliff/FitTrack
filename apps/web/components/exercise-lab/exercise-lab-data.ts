"use client";

import type { FitnessExerciseCategory } from "@fittrack/api-client";

export type ExerciseLabReviewCandidate = {
  category: FitnessExerciseCategory;
  description: string;
  evidenceBars: number[];
  id: string;
  instructions: string;
  matchHint: string;
  muscleGroup: string;
  origin: string;
  proposedName: string;
  queueTag: string;
  sourceLabel: string;
  summary: string;
  title: string;
  trigger: string;
};

export const EXERCISE_CATEGORY_OPTIONS = [
  { label: "Strength", value: "strength" },
  { label: "Cardio", value: "cardio" },
  { label: "Flexibility", value: "flexibility" },
  { label: "Balance", value: "balance" },
] as const;

export const EXERCISE_REVIEW_CANDIDATES: ExerciseLabReviewCandidate[] = [
  {
    id: "rotational-press-pattern",
    title: "Rotational press pattern",
    sourceLabel: "submitted client",
    queueTag: "needs match",
    summary: "Client trace / detected unknown movement",
    origin: "client custom",
    trigger: "unknown after 3 reps",
    proposedName: "Standing rotational press",
    category: "strength",
    muscleGroup: "shoulders",
    description:
      "Standing press pattern with torso rotation and controlled deceleration through the shoulder line.",
    instructions:
      "Brace the core, rotate through the torso, then press while keeping the shoulder stacked and the return controlled.",
    matchHint: "landmine press",
    evidenceBars: [24, 38, 62, 34, 28, 18],
  },
  {
    id: "band-resisted-hinge-pulse",
    title: "Band-resisted hinge pulse",
    sourceLabel: "movement trace available",
    queueTag: "reviewable",
    summary: "Custom hinge variation recorded by mobile tracker",
    origin: "client custom",
    trigger: "unknown after 3 reps",
    proposedName: "Band-resisted hinge pulse",
    category: "strength",
    muscleGroup: "glutes",
    description:
      "Short-range hinge pulses against elastic resistance with emphasis on glute lockout and posture control.",
    instructions:
      "Anchor the band securely, hinge with a neutral spine, then pulse through the top range without shrugging.",
    matchHint: "banded good morning",
    evidenceBars: [18, 32, 51, 55, 36, 22],
  },
  {
    id: "single-leg-hold-variation",
    title: "Single-leg hold variation",
    sourceLabel: "asymmetry surfaced",
    queueTag: "edge case",
    summary: "Balance-focused custom hold with unilateral stability bias",
    origin: "client custom",
    trigger: "unknown after 3 reps",
    proposedName: "Single-leg balance hold",
    category: "balance",
    muscleGroup: "core",
    description:
      "Static single-leg hold that emphasizes hip control, trunk alignment, and slow corrective balance reactions.",
    instructions:
      "Keep the standing knee soft, square the hips, and hold the trunk upright while resisting sway.",
    matchHint: "single-leg reach hold",
    evidenceBars: [14, 18, 43, 27, 21, 30],
  },
  {
    id: "overhead-cable-chop",
    title: "Overhead cable chop",
    sourceLabel: "compare against library",
    queueTag: "compare",
    summary: "Rotational cable movement with diagonal power pattern",
    origin: "client custom",
    trigger: "unknown after 3 reps",
    proposedName: "Overhead cable chop",
    category: "strength",
    muscleGroup: "core",
    description:
      "Diagonal pull pattern that trains rotational force transfer from the trunk through the upper body.",
    instructions:
      "Set the shoulders down, drive through the torso, and finish the diagonal pull without collapsing the ribs.",
    matchHint: "cable wood chop",
    evidenceBars: [22, 26, 58, 49, 30, 20],
  },
  {
    id: "shoulder-mobility-cluster",
    title: "Shoulder mobility cluster",
    sourceLabel: "no canonical fit yet",
    queueTag: "new candidate",
    summary: "Mobility-focused sequence that may need a new global definition",
    origin: "client custom",
    trigger: "unknown after 3 reps",
    proposedName: "Shoulder mobility cluster",
    category: "flexibility",
    muscleGroup: "shoulders",
    description:
      "Clustered shoulder mobility sequence combining controlled circles, holds, and overhead reach transitions.",
    instructions:
      "Move through each shoulder position slowly, breathe through the range, and avoid compensating through the low back.",
    matchHint: "new global candidate",
    evidenceBars: [12, 22, 28, 35, 39, 44],
  },
];

export function createExerciseDraft(
  candidate?: {
    category?: FitnessExerciseCategory;
    description?: string | null;
    instructions?: string | null;
    muscleGroup?: string;
    origin?: string;
    originLabel?: string;
    proposedName?: string;
    trigger?: string;
    triggerLabel?: string;
  },
) {
  return {
    name: candidate?.proposedName ?? "",
    category: candidate?.category ?? "strength",
    muscleGroup: candidate?.muscleGroup ?? "",
    description: candidate?.description ?? "",
    instructions: candidate?.instructions ?? "",
    imageUrl: "",
    videoUrl: "",
    publishNote: candidate
      ? `Source: ${candidate.originLabel ?? candidate.origin ?? "client custom"}. Trigger: ${candidate.triggerLabel ?? candidate.trigger ?? "unknown after 3 reps"}. Preserve provenance when publishing.`
      : "",
  };
}
