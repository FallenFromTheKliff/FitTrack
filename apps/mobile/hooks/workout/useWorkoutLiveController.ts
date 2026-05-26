import { useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraView, type CameraType } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import { ApiClientError } from "@fittrack/api-client";

import type {
  CreateExerciseDraftProposalInput,
  CreateExerciseReviewSubmissionInput,
  ExerciseAiDraftEvidenceRecord,
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  FitnessExerciseCategory,
  IThemeContext,
  PoseCameraFacingMode,
  PoseEquipmentContext,
  PoseEquipmentDetectionBoxRecord,
  PoseEquipmentDetectionRecord,
  PoseEquipmentSource,
  PoseKeypointRecord,
  PoseMovementContractRecord,
  PoseSequenceFrameRecord,
  PoseSessionQualityState,
} from "@fittrack/types";
import type { ExerciseReference } from "@/data/exercises";
import type {
  NativeEquipmentSnapshot,
  NativePoseFrame,
} from "@/components/workout/NativeVisionPoseCamera.types";
import type { ExerciseCreationDraft } from "@/components/modals/workout/ExerciseCreationReviewModal";
import {
  buildExerciseAiDraftEvidence,
  buildExerciseRigFromPoseFrames,
  buildFallbackPoseMovementContract,
  createDefaultExerciseMuscleTargets,
  createExerciseMovementProfile,
  getPrimaryExerciseMuscleGroup,
  normalizeExerciseHandShapeProfile,
  normalizeExerciseMovementProfile,
  normalizeExerciseMuscleTargets,
  computePoseSignals,
  getPoseJointAngle,
  getPoseMovementContractAngle,
  summarizeMovementGuidance,
} from "@fittrack/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useWorkoutTimer } from "@/hooks/workout/useWorkoutTimer";
import { useCameraCountdown } from "@/hooks/workout/useCameraCountdown";
import {
  analyzePoseSessionMutationOptions,
  completeWorkoutSessionMutationOptions,
  createExerciseDraftProposalMutationOptions,
  createExerciseReviewSubmissionMutationOptions,
  fitnessExercisesQueryOptions,
  fitnessPlanDetailQueryOptions,
  fitnessPlansQueryOptions,
  fitnessSessionsQueryOptions,
  finalizePoseSessionMutationOptions,
  logWorkoutSetMutationOptions,
  startPoseSessionMutationOptions,
  startWorkoutSessionMutationOptions,
} from "@fittrack/query";
import { useTimedMessage } from "@fittrack/hooks";
import {
  makeScreenStyles,
  makeWorkoutStyles,
} from "@/styles/shared/ScreenStyles";
import {
  mobileApiClient,
} from "@/lib/api-client";
import {
  createBrowserPoseAnalyzer,
  type BrowserPoseAnalyzer,
} from "@/lib/workout/browserPoseAnalyzer";
import {
  createPoseRepEngineState,
  stepPoseRepEngine,
} from "@/lib/workout/poseRepEngine";

type SelectedExercise = {
  exerciseId: string;
  handShapeProfile: ExerciseHandShapeProfileRecord | null;
  label: string;
  movementProfile: ExerciseMovementProfileRecord | null;
  muscleGroup: string;
  muscleTargets: ExerciseMuscleTargetRecord[];
  recommendation: string;
};

type LiveExerciseRecord = {
  category: string;
  description: string | null;
  handShapeProfile: ExerciseHandShapeProfileRecord | null;
  id: string;
  instructions: string | null;
  movementProfile: ExerciseMovementProfileRecord | null;
  muscleGroup: string;
  muscleTargets: ExerciseMuscleTargetRecord[];
  name: string;
};

type LivePlanSummaryRecord = {
  id: string;
  isActive: boolean;
  title: string;
};

type LiveWorkoutSessionRecord = {
  id: string;
  startedAt: string;
  status: string;
};

const DEFAULT_POSE_FEEDBACK = [
  "Position yourself fully in frame",
  "Ensure good lighting for accurate tracking",
  "Perform exercises with full range of motion",
];
const NATIVE_POSE_FEEDBACK = [
  "Native landmark analysis is active.",
  "The on-device pose stream feeds auto detection and local rep counting.",
  "Lock the exercise manually if auto detection drifts.",
];
const POSE_FRAME_WINDOW_SIZE = 20;
const EXERCISE_CREATION_FRAME_WINDOW_SIZE = 80;
const EXERCISE_CREATION_MIN_REPS = 3;
const POSE_FRAME_BATCH_TRIGGER = 4;
const POSE_MIN_ANALYZE_FRAMES = 20;
const TRACKING_UNRELIABLE_MESSAGE =
  "Pose tracking is waiting for a reliable movement window. Keep shoulders, hips, and at least one full arm chain visible to resume live counting.";
const SUBJECT_LOCK_GESTURE_HOLD_MS = 3000;
const SUBJECT_LOCK_GESTURE_HOLD_SECONDS = Math.ceil(
  SUBJECT_LOCK_GESTURE_HOLD_MS / 1000,
);
const SUBJECT_LOCK_VISIBILITY_THRESHOLD = 0.4;
const SUBJECT_LOCK_RIG_VISIBILITY_THRESHOLD = 0.24;
const SUBJECT_LOCK_MIN_VISIBLE_RIG_POINTS = 5;
const SUBJECT_LOCK_LOST_FRAME_LIMIT = 10;
const CAMERA_SWITCH_REMOUNT_MS = 350;
const EQUIPMENT_CONTEXT_FRESH_MS = 6500;
const EQUIPMENT_DETECTION_HOLD_MS = 5200;
const EQUIPMENT_DETECTION_SAMPLE_WINDOW_MS = 7500;
const EQUIPMENT_DETECTION_STRONG_CONFIDENCE = 0.52;
const EQUIPMENT_DETECTION_WEAK_CONFIDENCE = 0.35;
const EQUIPMENT_DETECTION_MIN_WEAK_HITS = 2;
const NATIVE_MIN_RELIABLE_LANDMARKS = 12;
const NATIVE_MIN_AVERAGE_VISIBILITY = 0.36;
const NATIVE_POSE_LOW_VISIBILITY_ALPHA = 0.2;
const NATIVE_POSE_NORMAL_ALPHA = 0.32;
const NATIVE_POSE_HIGH_VISIBILITY_ALPHA = 0.44;
const NATIVE_POSE_HOLD_LAST_GOOD_MS = 420;
const NATIVE_POSE_CORE_TELEPORT_DISTANCE = 0.14;
const NATIVE_POSE_SEGMENT_SHIFT_DISTANCE = 0.12;
const NATIVE_POSE_MIN_STABILIZER_VISIBILITY = 0.14;
const SUBJECT_LOCK_CORE_LANDMARK_INDEXES = [11, 12, 23, 24] as const;
const SUBJECT_LOCK_RIG_LANDMARK_INDEXES = [
  0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28,
] as const;
const NATIVE_POSE_SEGMENTS = [
  [11, 12],
  [23, 24],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
] as const;
const WEIGHTED_EQUIPMENT_CONTEXTS = new Set<PoseEquipmentContext>([
  "dumbbell",
  "barbell",
  "cable",
  "machine",
  "kettlebell",
  "band",
  "mixed",
]);
const KG_PER_POUND = 0.45359237;
const MAX_WORKOUT_LOAD_KG = 1000;
const MIN_WORKOUT_LOAD_SLIDER_VALUE = 1;
const EXERCISE_NAME_ALIAS_GROUPS = [
  ["barbell back squat", "back squat", "squat"],
  ["dumbbell bench press", "bench press", "dumbbell bench"],
  ["push up", "push-up", "pushup"],
  ["incline push up", "incline push-up", "incline pushup"],
  ["dumbbell bicep curl", "dumbbell curl", "bicep curl", "curl", "bicep_curl"],
  ["dip", "tricep dip", "bench dip", "assisted dip", "parallel bar dip"],
  ["pull up", "pull-up", "pullup", "chin up", "chin-up", "chinup", "pull_up"],
  ["seated cable row", "cable row"],
  ["jump rope", "jump-rope", "jump rope"],
] as const;
const NORMALIZED_EXERCISE_ALIAS_GROUPS = EXERCISE_NAME_ALIAS_GROUPS.map(
  (group) =>
    group.map((value) =>
      value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "),
    ),
);

type WorkoutLoadUnit = "kg" | "lb";

function formatWorkoutLoadNumber(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatWorkoutLoadValue(weightKg: number | null, unit: WorkoutLoadUnit) {
  if (weightKg === null) return "";
  const displayValue = unit === "kg" ? weightKg : weightKg / KG_PER_POUND;
  return formatWorkoutLoadNumber(displayValue);
}

function getWorkoutLoadSliderMax(unit: WorkoutLoadUnit) {
  return unit === "kg"
    ? MAX_WORKOUT_LOAD_KG
    : Math.floor(MAX_WORKOUT_LOAD_KG / KG_PER_POUND);
}

function clampWorkoutLoadSliderValue(value: number, unit: WorkoutLoadUnit) {
  return Math.min(
    getWorkoutLoadSliderMax(unit),
    Math.max(MIN_WORKOUT_LOAD_SLIDER_VALUE, Math.round(value)),
  );
}

function getWorkoutLoadDisplayValue(weightKg: number | null, unit: WorkoutLoadUnit) {
  if (weightKg === null) return null;
  return unit === "kg" ? weightKg : weightKg / KG_PER_POUND;
}

function getWorkoutLoadSliderValue(
  inputValue: string,
  savedWeightKg: number | null,
  unit: WorkoutLoadUnit,
) {
  const parsedInputValue = Number(inputValue.trim());
  if (Number.isFinite(parsedInputValue) && parsedInputValue > 0) {
    return clampWorkoutLoadSliderValue(parsedInputValue, unit);
  }

  const savedDisplayValue = getWorkoutLoadDisplayValue(savedWeightKg, unit);
  if (savedDisplayValue !== null) {
    return clampWorkoutLoadSliderValue(savedDisplayValue, unit);
  }

  return MIN_WORKOUT_LOAD_SLIDER_VALUE;
}

function isWeightedEquipmentContext(context: PoseEquipmentContext | null) {
  return context !== null && WEIGHTED_EQUIPMENT_CONTEXTS.has(context);
}

function parseWorkoutLoadInput(value: string, unit: WorkoutLoadUnit) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return { error: null, weightKg: null };
  }

  const numericValue = Number(trimmedValue);
  if (!Number.isFinite(numericValue)) {
    return { error: "Enter a valid load.", weightKg: null };
  }
  if (numericValue <= 0) {
    return { error: "Load must be greater than 0.", weightKg: null };
  }

  const weightKg = Number(
    (unit === "kg" ? numericValue : numericValue * KG_PER_POUND).toFixed(2),
  );
  if (weightKg > MAX_WORKOUT_LOAD_KG) {
    return {
      error: `Load must be ${MAX_WORKOUT_LOAD_KG} kg or less.`,
      weightKg: null,
    };
  }

  return { error: null, weightKg };
}

function sanitizeWorkoutLoadInput(value: string) {
  const cleanedValue = value.replace(/[^0-9.]/g, "");
  const [wholePart = "", ...decimalParts] = cleanedValue.split(".");
  if (decimalParts.length === 0) return wholePart;
  return `${wholePart}.${decimalParts.join("").slice(0, 2)}`;
}

function getPointDistance(
  a: PoseKeypointRecord | undefined,
  b: PoseKeypointRecord | undefined,
) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isVisiblePoint(point: PoseKeypointRecord | undefined) {
  return (point?.visibility ?? 0) >= SUBJECT_LOCK_VISIBILITY_THRESHOLD;
}

function isRigPointVisible(point: PoseKeypointRecord | undefined) {
  return (point?.visibility ?? 0) >= SUBJECT_LOCK_RIG_VISIBILITY_THRESHOLD;
}

function averageVisibilityForIndexes(
  keypoints: PoseKeypointRecord[],
  indexes: readonly number[],
) {
  const values = indexes
    .map((index) => keypoints[index]?.visibility ?? 0)
    .filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toPointVisibility(point: PoseKeypointRecord | undefined) {
  return point?.visibility ?? 0;
}

function clonePoseKeypoint(point: PoseKeypointRecord): PoseKeypointRecord {
  return {
    visibility: point.visibility,
    x: point.x,
    y: point.y,
    z: point.z,
  };
}

function blendPoseKeypoint(
  previous: PoseKeypointRecord,
  current: PoseKeypointRecord,
): PoseKeypointRecord {
  const previousVisibility = toPointVisibility(previous);
  const currentVisibility = toPointVisibility(current);

  if (
    currentVisibility < NATIVE_POSE_MIN_STABILIZER_VISIBILITY &&
    previousVisibility >= NATIVE_POSE_MIN_STABILIZER_VISIBILITY
  ) {
    return {
      ...clonePoseKeypoint(previous),
      visibility: Math.max(0, previousVisibility * 0.82),
    };
  }

  if (previousVisibility < NATIVE_POSE_MIN_STABILIZER_VISIBILITY) {
    return clonePoseKeypoint(current);
  }

  const alpha =
    currentVisibility >= 0.7
      ? NATIVE_POSE_HIGH_VISIBILITY_ALPHA
      : currentVisibility >= 0.4
        ? NATIVE_POSE_NORMAL_ALPHA
        : NATIVE_POSE_LOW_VISIBILITY_ALPHA;
  const visibilityAlpha = Math.max(alpha, 0.5);

  return {
    visibility:
      previousVisibility +
      (currentVisibility - previousVisibility) * visibilityAlpha,
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
    z: (previous.z ?? 0) + ((current.z ?? 0) - (previous.z ?? 0)) * alpha,
  };
}

function averageTrackedJump(
  previous: PoseKeypointRecord[],
  current: PoseKeypointRecord[],
  indexes: readonly number[],
) {
  const jumps = indexes
    .map((index) => {
      const previousPoint = previous[index];
      const currentPoint = current[index];
      if (
        !previousPoint ||
        !currentPoint ||
        toPointVisibility(previousPoint) <
          NATIVE_POSE_MIN_STABILIZER_VISIBILITY ||
        toPointVisibility(currentPoint) < NATIVE_POSE_MIN_STABILIZER_VISIBILITY
      ) {
        return null;
      }
      return getPointDistance(previousPoint, currentPoint);
    })
    .filter((value): value is number => typeof value === "number");

  if (!jumps.length) return 0;
  return jumps.reduce((sum, value) => sum + value, 0) / jumps.length;
}

function averageSegmentShift(
  previous: PoseKeypointRecord[],
  current: PoseKeypointRecord[],
) {
  const shifts = NATIVE_POSE_SEGMENTS.map(([startIndex, endIndex]) => {
    const previousStart = previous[startIndex];
    const previousEnd = previous[endIndex];
    const currentStart = current[startIndex];
    const currentEnd = current[endIndex];
    if (
      !previousStart ||
      !previousEnd ||
      !currentStart ||
      !currentEnd ||
      Math.min(
        toPointVisibility(previousStart),
        toPointVisibility(previousEnd),
        toPointVisibility(currentStart),
        toPointVisibility(currentEnd),
      ) < NATIVE_POSE_MIN_STABILIZER_VISIBILITY
    ) {
      return null;
    }
    return Math.abs(
      getPointDistance(previousStart, previousEnd) -
        getPointDistance(currentStart, currentEnd),
    );
  }).filter((value): value is number => typeof value === "number");

  if (!shifts.length) return 0;
  return shifts.reduce((sum, value) => sum + value, 0) / shifts.length;
}

function stabilizeNativePoseFrame(
  frame: NativePoseFrame,
  previousStableFrame: NativePoseFrame | null,
): NativePoseFrame {
  if (!previousStableFrame) {
    return {
      ...frame,
      keypoints: frame.keypoints.map(clonePoseKeypoint),
    };
  }

  const elapsedMs = frame.capturedAtMs - previousStableFrame.capturedAtMs;
  const coreJump = averageTrackedJump(
    previousStableFrame.keypoints,
    frame.keypoints,
    SUBJECT_LOCK_CORE_LANDMARK_INDEXES,
  );
  const segmentShift = averageSegmentShift(
    previousStableFrame.keypoints,
    frame.keypoints,
  );
  const shouldHoldLastGoodFrame =
    elapsedMs <= NATIVE_POSE_HOLD_LAST_GOOD_MS &&
    (coreJump >= NATIVE_POSE_CORE_TELEPORT_DISTANCE ||
      segmentShift >= NATIVE_POSE_SEGMENT_SHIFT_DISTANCE);

  if (shouldHoldLastGoodFrame) {
    return {
      ...previousStableFrame,
      cameraFacing: frame.cameraFacing,
      capturedAtMs: frame.capturedAtMs,
      frameHeight: frame.frameHeight,
      frameWidth: frame.frameWidth,
    };
  }

  return {
    ...frame,
    keypoints: frame.keypoints.map((point, index) =>
      blendPoseKeypoint(previousStableFrame.keypoints[index] ?? point, point),
    ),
  };
}

function isSubjectLockBodyRigVisible(
  keypoints: PoseKeypointRecord[] | null | undefined,
) {
  if (!keypoints || keypoints.length < 33) return false;

  const visibleCorePoints = SUBJECT_LOCK_CORE_LANDMARK_INDEXES.filter((index) =>
    isRigPointVisible(keypoints[index]),
  ).length;
  const coreAverageVisibility = averageVisibilityForIndexes(
    keypoints,
    SUBJECT_LOCK_CORE_LANDMARK_INDEXES,
  );
  const visibleRigPoints = SUBJECT_LOCK_RIG_LANDMARK_INDEXES.filter((index) =>
    isRigPointVisible(keypoints[index]),
  ).length;
  const leftArmVisibility = averageVisibilityForIndexes(
    keypoints,
    [11, 13, 15],
  );
  const rightArmVisibility = averageVisibilityForIndexes(
    keypoints,
    [12, 14, 16],
  );
  const armChainVisible =
    Math.max(leftArmVisibility, rightArmVisibility) >=
    SUBJECT_LOCK_RIG_VISIBILITY_THRESHOLD;

  return (
    visibleCorePoints >= 3 &&
    coreAverageVisibility >= SUBJECT_LOCK_RIG_VISIBILITY_THRESHOLD &&
    armChainVisible &&
    visibleRigPoints >= SUBJECT_LOCK_MIN_VISIBLE_RIG_POINTS
  );
}

function getNativeFrameReliability(keypoints: PoseKeypointRecord[]) {
  const visibilityValues = keypoints.map((point) => point.visibility ?? 0);
  const averageVisibility =
    visibilityValues.length > 0
      ? visibilityValues.reduce((sum, value) => sum + value, 0) /
        visibilityValues.length
      : 0;
  const visibleLandmarks = visibilityValues.filter(
    (value) => value >= SUBJECT_LOCK_VISIBILITY_THRESHOLD,
  ).length;

  return {
    averageVisibility,
    isReliable:
      visibleLandmarks >= NATIVE_MIN_RELIABLE_LANDMARKS &&
      averageVisibility >= NATIVE_MIN_AVERAGE_VISIBILITY,
    visibleLandmarks,
  };
}

function isRockSignSubjectLockGesture(keypoints: PoseKeypointRecord[]) {
  return isRockSignSubjectLockGestureWithProfile(keypoints, null);
}

function isRockSignSubjectLockGestureWithProfile(
  keypoints: PoseKeypointRecord[],
  handShapeProfile: ExerciseHandShapeProfileRecord | null | undefined,
) {
  const profile = handShapeProfile?.subjectLockGesture;
  if (profile && !profile.enabled) return false;
  const hands = [
    { elbow: 13, index: 19, pinky: 17, shoulder: 11, thumb: 21, wrist: 15 },
    { elbow: 14, index: 20, pinky: 18, shoulder: 12, thumb: 22, wrist: 16 },
  ] as const;

  return hands.some((hand) => {
    const elbow = keypoints[hand.elbow];
    const wrist = keypoints[hand.wrist];
    const index = keypoints[hand.index];
    const pinky = keypoints[hand.pinky];
    const thumb = keypoints[hand.thumb];
    const shoulder = keypoints[hand.shoulder];
    if (
      !isVisiblePoint(elbow) ||
      !isVisiblePoint(wrist) ||
      !isVisiblePoint(index) ||
      !isVisiblePoint(pinky) ||
      !isVisiblePoint(thumb) ||
      !isVisiblePoint(shoulder)
    ) {
      return false;
    }

    const handAboveShoulder =
      wrist.y <= shoulder.y + (profile?.handAboveShoulderOffset ?? 0.22);
    const handRaisedFromElbow =
      wrist.y <= elbow.y + (profile?.handRaisedFromElbowOffset ?? 0.08);
    const indexLift = wrist.y - index.y;
    const pinkyLift = wrist.y - pinky.y;
    const indexExtended = indexLift >= (profile?.minFingerLift ?? 0.025);
    const pinkyExtended = pinkyLift >= (profile?.minFingerLift ?? 0.025);
    const fingerSpread =
      Math.abs(index.x - pinky.x) >= (profile?.minFingerSpreadX ?? 0.042) &&
      getPointDistance(index, pinky) >= (profile?.minFingerDistance ?? 0.05);
    const thumbOffset =
      getPointDistance(thumb, wrist) >= (profile?.minThumbOffset ?? 0.018);
    const thumbSeparated =
      getPointDistance(thumb, index) >=
        (profile?.minThumbSeparation ?? 0.03) &&
      getPointDistance(thumb, pinky) >=
        (profile?.minThumbSeparation ?? 0.03);
    const hornBalance =
      Math.abs(indexLift - pinkyLift) <=
      (profile?.maxHornLiftDelta ?? 0.14);
    const hornsLeadThumb =
      index.y <= thumb.y + (profile?.hornThumbLeadOffset ?? 0.08) &&
      pinky.y <= thumb.y + (profile?.hornThumbLeadOffset ?? 0.08);

    return (
      handAboveShoulder &&
      handRaisedFromElbow &&
      indexExtended &&
      pinkyExtended &&
      fingerSpread &&
      thumbOffset &&
      thumbSeparated &&
      hornBalance &&
      hornsLeadThumb
    );
  });
}

function toPoseNoCountEvidenceLabel(reason: string | null | undefined) {
  switch (reason) {
    case "bilateral_arm_motion_unconfirmed":
      return "both arms moving together";
    case "body_y_travel_below_min":
      return "vertical body travel";
    case "push_up_body_not_horizontal":
      return "push-up body line";
    case "body_line_failure":
      return "body-line stability";
    case "left_right_phase_desync":
      return "left/right timing sync";
    case "equipment_required":
      return "dumbbell or load";
    case "curl_grip_unconfirmed":
      return "closed dumbbell grip";
    case "curl_torso_not_upright":
      return "upright curl posture";
    case "hip_swing_over_tolerance":
      return "quiet hips during curls";
    default:
      return (reason ?? "tracking evidence").replace(/_/g, " ");
  }
}

function buildPoseNoCountStatusText(
  reason: string,
  options: {
    equipmentProviderEnabled: boolean | null;
    requiresEquipmentSnapshot: boolean;
  },
) {
  if (reason === "rep_cooldown_active") {
    return "Ignoring jitter between reps. Reset to the start position before the next count.";
  }

  if (reason === "equipment_required" && options.requiresEquipmentSnapshot) {
    if (options.equipmentProviderEnabled === false) {
      return "Weighted rep counting is paused because equipment detection is not configured.";
    }
    if (options.equipmentProviderEnabled === null) {
      return "Waiting for dumbbell or load detection before counting weighted reps.";
    }
  }

  if (reason === "equipment_required") {
    return "Select or confirm a weighted curl so FitTrack can use declared load context before counting.";
  }

  return `Waiting for clean ${toPoseNoCountEvidenceLabel(reason)} evidence before counting.`;
}

function defaultPaginated<T>() {
  return {
    data: [] as T[],
    meta: { page: 1, limit: 0, total: 0, total_pages: 0 },
  };
}

function toExerciseLevel(category: string): ExerciseReference["level"] {
  if (category === "strength") return "Intermediate";
  if (category === "balance") return "Advanced";
  return "Beginner";
}

function toSelectedExercise(
  currentPlanExercise: {
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string;
    notes: string | null;
    reps: number | null;
    sets: number;
  } | null,
  exercises: LiveExerciseRecord[],
): SelectedExercise | null {
  if (currentPlanExercise) {
    const matchingExercise = exercises.find(
      (exercise) => exercise.id === currentPlanExercise.exerciseId,
    );
    return {
      exerciseId: currentPlanExercise.exerciseId,
      handShapeProfile: matchingExercise?.handShapeProfile ?? null,
      label: currentPlanExercise.exerciseName,
      movementProfile: matchingExercise?.movementProfile ?? null,
      muscleGroup: currentPlanExercise.muscleGroup,
      muscleTargets: matchingExercise?.muscleTargets ?? [],
      recommendation:
        currentPlanExercise.notes ??
        `Follow the ${currentPlanExercise.sets} x ${currentPlanExercise.reps ?? "timed"} plan prescription.`,
    };
  }

  const firstExercise = exercises[0];
  if (!firstExercise) return null;
  return {
    exerciseId: firstExercise.id,
    handShapeProfile: firstExercise.handShapeProfile,
    label: firstExercise.name,
    movementProfile: firstExercise.movementProfile,
    muscleGroup: firstExercise.muscleGroup,
    muscleTargets: firstExercise.muscleTargets,
    recommendation:
      firstExercise.instructions ??
      firstExercise.description ??
      "Use controlled reps and keep your movement consistent.",
  };
}

function toExerciseReferences(
  exercises: LiveExerciseRecord[],
): ExerciseReference[] {
  return exercises.map((exercise) => ({
    id: exercise.id,
    level: toExerciseLevel(exercise.category),
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
    recommendation:
      exercise.instructions ??
      exercise.description ??
      "Use a controlled tempo and keep a consistent setup.",
  }));
}

function normalizeExerciseName(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getExerciseNameVariants(value: string | null | undefined) {
  const normalized = normalizeExerciseName(value);
  if (!normalized) return [];

  const variants = new Set([normalized]);
  for (const group of NORMALIZED_EXERCISE_ALIAS_GROUPS) {
    if (!group.includes(normalized)) continue;
    group.forEach((entry) => variants.add(entry));
  }

  return Array.from(variants);
}

function toDisplayExerciseName(value: string | null | undefined) {
  return normalizeExerciseName(value).replace(/\b\w/g, (char) =>
    char.toUpperCase(),
  );
}

function toPoseCameraFacingMode(cameraFacing: CameraType) {
  return cameraFacing === "front" ? "user" : "environment";
}

type EquipmentDetectionSample = {
  confidence: number;
  context: PoseEquipmentContext;
  capturedAtMs: number;
};

type EquipmentDetectionMemory = {
  failureCount: number;
  lastAccepted: PoseEquipmentDetectionRecord | null;
  lastAcceptedAtMs: number | null;
  samples: EquipmentDetectionSample[];
};

function createEquipmentDetectionMemory(): EquipmentDetectionMemory {
  return {
    failureCount: 0,
    lastAccepted: null,
    lastAcceptedAtMs: null,
    samples: [],
  };
}

function inferEquipmentContextFromDetectionBoxes(
  detections: PoseEquipmentDetectionBoxRecord[],
): PoseEquipmentContext | null {
  const contexts = new Set<PoseEquipmentContext>();
  for (const detection of detections) {
    const label = normalizeExerciseName(detection.label);
    if (
      /\b(dumbbell|dumbbells|dumbell|dumbells|db|free weight|hand weight)\b/.test(
        label,
      )
    ) {
      contexts.add("dumbbell");
    } else if (/\b(barbell|olympic bar|ez bar)\b/.test(label)) {
      contexts.add("barbell");
    } else if (/\b(cable|lat pulldown|pulldown|handle)\b/.test(label)) {
      contexts.add("cable");
    } else if (/\b(machine|chest press|leg press|smith)\b/.test(label)) {
      contexts.add("machine");
    } else if (/\bkettlebell\b/.test(label)) {
      contexts.add("kettlebell");
    } else if (/\bband\b/.test(label)) {
      contexts.add("band");
    } else if (/\bbench\b/.test(label)) {
      contexts.add("bench");
    }
  }

  if (contexts.size === 0) return null;
  return contexts.size > 1 ? "mixed" : (Array.from(contexts)[0] ?? null);
}

function getProviderEquipmentConfidence(
  detection: PoseEquipmentDetectionRecord,
) {
  const boxConfidence = detection.equipmentDetections.reduce<number | null>(
    (best, box) =>
      typeof box.confidence === "number"
        ? Math.max(best ?? 0, box.confidence)
        : best,
    null,
  );
  if (typeof detection.equipmentConfidence === "number") {
    return Math.max(detection.equipmentConfidence, boxConfidence ?? 0);
  }
  return boxConfidence;
}

function getProviderEquipmentContext(
  detection: PoseEquipmentDetectionRecord,
): PoseEquipmentContext | null {
  if (
    detection.equipmentContext !== null &&
    detection.equipmentContext !== "unknown"
  ) {
    return detection.equipmentContext;
  }
  return inferEquipmentContextFromDetectionBoxes(detection.equipmentDetections);
}

function averageEquipmentConfidence(samples: EquipmentDetectionSample[]) {
  if (!samples.length) return null;
  return (
    samples.reduce((sum, sample) => sum + sample.confidence, 0) / samples.length
  );
}

function stabilizeProviderEquipmentDetection(
  detection: PoseEquipmentDetectionRecord,
  memory: EquipmentDetectionMemory,
  capturedAtMs: number,
): {
  detection: PoseEquipmentDetectionRecord;
  detectedAtMs: number | null;
  usingHeldDetection: boolean;
} {
  memory.failureCount = 0;
  const context = getProviderEquipmentContext(detection);
  const confidence = getProviderEquipmentConfidence(detection);
  memory.samples = memory.samples.filter(
    (sample) =>
      capturedAtMs - sample.capturedAtMs <=
      EQUIPMENT_DETECTION_SAMPLE_WINDOW_MS,
  );

  if (
    context !== null &&
    confidence !== null &&
    confidence >= EQUIPMENT_DETECTION_WEAK_CONFIDENCE
  ) {
    memory.samples.push({ confidence, context, capturedAtMs });
  }

  const matchingSamples = context
    ? memory.samples.filter(
        (sample) =>
          sample.context === context &&
          sample.confidence >= EQUIPMENT_DETECTION_WEAK_CONFIDENCE,
      )
    : [];
  const weakConsensus =
    matchingSamples.length >= EQUIPMENT_DETECTION_MIN_WEAK_HITS;
  const strongHit =
    confidence !== null && confidence >= EQUIPMENT_DETECTION_STRONG_CONFIDENCE;
  const shouldAccept = context !== null && (strongHit || weakConsensus);

  if (shouldAccept) {
    const confidenceSamples = matchingSamples.length
      ? matchingSamples
      : [{ confidence: confidence ?? 0, context, capturedAtMs }];
    const smoothedConfidence = Math.max(
      confidence ?? 0,
      averageEquipmentConfidence(confidenceSamples) ?? 0,
    );
    const accepted: PoseEquipmentDetectionRecord = {
      ...detection,
      equipmentConfidence: smoothedConfidence,
      equipmentContext: context,
      equipmentDetections:
        detection.equipmentDetections.length > 0
          ? detection.equipmentDetections
          : (memory.lastAccepted?.equipmentDetections ?? []),
      equipmentSource: detection.equipmentSource ?? "provider_api",
      providerEnabled: detection.providerEnabled,
    };
    memory.lastAccepted = accepted;
    memory.lastAcceptedAtMs = capturedAtMs;
    return {
      detection: accepted,
      detectedAtMs: capturedAtMs,
      usingHeldDetection: false,
    };
  }

  if (
    memory.lastAccepted &&
    memory.lastAcceptedAtMs !== null &&
    capturedAtMs - memory.lastAcceptedAtMs <= EQUIPMENT_DETECTION_HOLD_MS
  ) {
    return {
      detection: {
        ...memory.lastAccepted,
        equipmentConflicts: [
          ...new Set([
            ...memory.lastAccepted.equipmentConflicts,
            "equipment_detection_temporal_hold",
          ]),
        ],
        providerEnabled: detection.providerEnabled,
      },
      detectedAtMs: memory.lastAcceptedAtMs,
      usingHeldDetection: true,
    };
  }

  memory.lastAccepted = null;
  memory.lastAcceptedAtMs = null;
  return {
    detection: {
      ...detection,
      equipmentConfidence: confidence,
      equipmentContext: null,
      equipmentSource: null,
    },
    detectedAtMs: null,
    usingHeldDetection: false,
  };
}

function getHeldEquipmentDetectionAfterFailure(
  memory: EquipmentDetectionMemory,
  capturedAtMs: number,
) {
  memory.failureCount += 1;
  if (
    memory.lastAccepted &&
    memory.lastAcceptedAtMs !== null &&
    capturedAtMs - memory.lastAcceptedAtMs <= EQUIPMENT_DETECTION_HOLD_MS
  ) {
    return {
      detection: {
        ...memory.lastAccepted,
        equipmentConflicts: [
          ...new Set([
            ...memory.lastAccepted.equipmentConflicts,
            "equipment_detection_transport_hold",
          ]),
        ],
      },
      detectedAtMs: memory.lastAcceptedAtMs,
    };
  }
  return null;
}

async function readNativeEquipmentFrameBase64(frameUri: string) {
  try {
    return await FileSystem.readAsStringAsync(frameUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (error) {
    throw new ApiClientError({
      kind: "unknown",
      message:
        error instanceof Error
          ? `Equipment snapshot file read failed: ${error.message}`
          : "Equipment snapshot file read failed.",
      raw: error,
    });
  }
}

async function detectNativeEquipmentSnapshot(input: {
  cameraFacingMode: PoseCameraFacingMode;
  exerciseHint: string | null | undefined;
  frameUri: string;
}) {
  const frameBase64 = await readNativeEquipmentFrameBase64(input.frameUri);

  return mobileApiClient.fitness.detectPoseEquipment({
    cameraFacingMode: input.cameraFacingMode,
    exerciseHint: input.exerciseHint,
    frameBase64,
  });
}

function inferExerciseEquipmentContext(
  label: string | null | undefined,
): PoseEquipmentContext | null {
  const normalized = normalizeExerciseName(label);
  if (!normalized) return null;

  const matches = new Set<PoseEquipmentContext>();
  if (/\b(push up|pull up|plank|burpee|bodyweight)\b/.test(normalized)) {
    matches.add("bodyweight");
  }
  if (/\b(dip|tricep dip|bench dip|assisted dip)\b/.test(normalized)) {
    matches.add("bodyweight");
  }
  if (/\b(dumbbell|db)\b/.test(normalized)) {
    matches.add("dumbbell");
  }
  if (/\b(bicep curl|curl)\b/.test(normalized)) {
    matches.add("dumbbell");
  }
  if (
    /\b(barbell|bench press|deadlift|back squat|front squat)\b/.test(normalized)
  ) {
    matches.add("barbell");
  }
  if (/\bcable\b/.test(normalized)) {
    matches.add("cable");
  }
  if (/\b(machine|leg press|lat pulldown|smith)\b/.test(normalized)) {
    matches.add("machine");
  }
  if (/\bkettlebell\b/.test(normalized)) {
    matches.add("kettlebell");
  }
  if (/\bband\b/.test(normalized)) {
    matches.add("band");
  }
  if (/\bbench\b/.test(normalized)) {
    matches.add("bench");
  }

  if (matches.size === 0) return null;
  return matches.size > 1 ? "mixed" : (Array.from(matches)[0] ?? null);
}

function isExplicitWeightedExerciseLabel(label: string | null | undefined) {
  const normalized = normalizeExerciseName(label);
  return /\b(dumbbell|dumbell|db|barbell|kettlebell|cable|machine|band|weighted|weight|load)\b/.test(
    normalized,
  );
}

function toEquipmentSource(
  isConfirmedByMember: boolean,
  context: PoseEquipmentContext | null,
): PoseEquipmentSource | undefined {
  if (!context) return undefined;
  return isConfirmedByMember ? "member" : "catalog";
}

function requiresVisualEquipmentContext(_context: PoseEquipmentContext | null) {
  // Object detection is intentionally optional telemetry now. Weighted exercise
  // integrity is driven by the selected exercise context plus pose mechanics.
  return false;
}

function buildPoseQualityFeedback(
  formFeedback: string[],
  qualityState: PoseSessionQualityState,
  reasons: string[],
  fallback: string[],
) {
  const base = formFeedback.length > 0 ? formFeedback : fallback;
  if (qualityState === "stable") return base.slice(0, 3);

  const readableReason =
    reasons[0]?.replace(/_/g, " ") ?? "tracking quality needs review";
  return [
    ...base,
    `Tracking quality is ${qualityState}: ${readableReason}.`,
  ].slice(0, 3);
}

function mergeExerciseReferences(liveReferences: ExerciseReference[]) {
  const merged = new Map<string, ExerciseReference>();

  for (const reference of liveReferences) {
    const normalizedName = normalizeExerciseName(reference.name);
    if (!normalizedName || merged.has(normalizedName)) continue;
    merged.set(normalizedName, reference);
  }

  return Array.from(merged.values());
}

function findExerciseByDetectedName(
  exercises: LiveExerciseRecord[],
  detectedName: string | null | undefined,
): SelectedExercise | null {
  const detectedVariants = getExerciseNameVariants(detectedName);
  if (!detectedVariants.length) return null;

  const matchedExercise = exercises.find((exercise) => {
    const exerciseVariants = getExerciseNameVariants(exercise.name);
    return detectedVariants.some((variant) =>
      exerciseVariants.includes(variant),
    );
  });
  if (!matchedExercise) return null;
  return {
    exerciseId: matchedExercise.id,
    handShapeProfile: matchedExercise.handShapeProfile,
    label: matchedExercise.name,
    movementProfile: matchedExercise.movementProfile,
    muscleGroup: matchedExercise.muscleGroup,
    muscleTargets: matchedExercise.muscleTargets,
    recommendation:
      matchedExercise.instructions ??
      matchedExercise.description ??
      "Use controlled reps and keep your movement consistent.",
  };
}

function findExerciseReferenceByName(
  references: ExerciseReference[],
  exerciseName: string | null | undefined,
) {
  const detectedVariants = getExerciseNameVariants(exerciseName);
  if (!detectedVariants.length) return null;

  return (
    references.find((reference) => {
      const referenceVariants = getExerciseNameVariants(reference.name);
      return detectedVariants.some((variant) =>
        referenceVariants.includes(variant),
      );
    }) ?? null
  );
}

function toPermissionGranted(
  permission: { granted?: boolean } | null | undefined,
) {
  return !!permission?.granted;
}

function toSavedExerciseOptions(references: ExerciseReference[]) {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const reference of references) {
    const normalizedName = normalizeExerciseName(reference.name);
    if (!normalizedName || seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    options.push(reference.name.trim());
  }

  return options;
}

export function useWorkoutLiveController() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const queryClient = useQueryClient();
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeWorkoutStyles(colors), [colors]);
  const { message, showMessage } = useTimedMessage(2500);

  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [isExerciseCreationReviewOpen, setIsExerciseCreationReviewOpen] =
    useState(false);
  const [exerciseCreationDraft, setExerciseCreationDraft] =
    useState<ExerciseCreationDraft | null>(null);
  const [isExerciseConfirmationVisible, setIsExerciseConfirmationVisible] =
    useState(false);
  const [exerciseConfirmationCandidates, setExerciseConfirmationCandidates] =
    useState<string[]>([]);
  const [customExerciseLabel, setCustomExerciseLabel] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [finishVisible, setFinishVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isPoseModelLoading, setIsPoseModelLoading] = useState(false);
  const [reps, setReps] = useState(0);
  const [currentKeypoints, setCurrentKeypoints] = useState<
    PoseKeypointRecord[] | null
  >(null);
  const [currentAngle, setCurrentAngle] = useState<number | null>(null);
  const [currentPhase, setCurrentPhase] = useState("primed");
  const [movementContract, setMovementContract] =
    useState<PoseMovementContractRecord | null>(null);
  const [lowConfidenceLandmarks, setLowConfidenceLandmarks] = useState<
    string[]
  >([]);
  const [poseFeedback, setPoseFeedback] = useState<string[]>([]);
  const [workoutSessionId, setWorkoutSessionId] = useState<string | null>(null);
  const [poseSessionId, setPoseSessionId] = useState<string | null>(null);
  const [acceptedFps, setAcceptedFps] = useState<number | null>(null);
  const [detectedExerciseName, setDetectedExerciseName] = useState<
    string | null
  >(null);
  const [confirmedExerciseLabel, setConfirmedExerciseLabel] = useState<
    string | null
  >(null);
  const [workoutLoadInputValue, setWorkoutLoadInputValue] = useState("");
  const [workoutLoadInputUnit, setWorkoutLoadInputUnit] =
    useState<WorkoutLoadUnit>("kg");
  const [workoutLoadInputError, setWorkoutLoadInputError] = useState<
    string | null
  >(null);
  const [workoutLoadKg, setWorkoutLoadKg] = useState<number | null>(null);
  const [nativeLandmarksActive, setNativeLandmarksActive] = useState(false);
  const [poseStatusOverride, setPoseStatusOverride] = useState<string | null>(
    null,
  );
  const [subjectLocked, setSubjectLocked] = useState(false);
  const [subjectLockConfidence, setSubjectLockConfidence] = useState<
    number | null
  >(null);
  const [providerEquipmentConfidence, setProviderEquipmentConfidence] =
    useState<number | null>(null);
  const [providerEquipmentConflicts, setProviderEquipmentConflicts] = useState<
    string[]
  >([]);
  const [providerEquipmentContext, setProviderEquipmentContext] =
    useState<PoseEquipmentContext | null>(null);
  const [providerEquipmentDetections, setProviderEquipmentDetections] =
    useState<PoseEquipmentDetectionBoxRecord[]>([]);
  const [providerEquipmentSource, setProviderEquipmentSource] =
    useState<PoseEquipmentSource | null>(null);
  const [providerEquipmentDetectedAtMs, setProviderEquipmentDetectedAtMs] =
    useState<number | null>(null);
  const [, setProviderEquipmentCheckedAtMs] = useState<number | null>(null);
  const [equipmentProviderEnabled, setEquipmentProviderEnabled] = useState<
    boolean | null
  >(null);
  const [subjectLockGestureProgress, setSubjectLockGestureProgress] =
    useState(0);
  const [subjectLockStatusText, setSubjectLockStatusText] = useState(
    `Tap Lock on me, or hold the rock-and-roll sign for ${SUBJECT_LOCK_GESTURE_HOLD_SECONDS} seconds once live landmarks are visible.`,
  );
  const isFrozen = user?.status === "frozen";
  const isWebPoseRuntime = Platform.OS === "web";
  const [cameraFacing, setCameraFacing] = useState<CameraType>(
    isWebPoseRuntime ? "front" : "back",
  );
  const [cameraRemountKey, setCameraRemountKey] = useState(0);
  const [isCameraSwitching, setIsCameraSwitching] = useState(false);

  const cameraRef = useRef<CameraView | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const frameInFlightRef = useRef(false);
  const countdownValueRef = useRef<number | null>(null);
  const isExerciseConfirmationVisibleRef = useRef(
    isExerciseConfirmationVisible,
  );
  const poseAnalyzerRef = useRef<BrowserPoseAnalyzer | null>(null);
  const poseAnalyzerPromiseRef = useRef<Promise<BrowserPoseAnalyzer> | null>(
    null,
  );
  const poseFrameBufferRef = useRef<PoseSequenceFrameRecord[]>([]);
  const exerciseCreationFrameBufferRef = useRef<PoseSequenceFrameRecord[]>([]);
  const framesSinceAnalyzeRef = useRef(0);
  const trackingReliabilityNotifiedRef = useRef(false);
  const confirmedExerciseLabelRef = useRef<string | null>(null);
  const workoutLoadKgRef = useRef<number | null>(null);
  const movementContractRef = useRef<PoseMovementContractRecord | null>(null);
  const poseSessionIdRef = useRef<string | null>(null);
  const isRecordingRef = useRef(false);
  const repEngineStateRef = useRef(createPoseRepEngineState());
  const liveRepCountRef = useRef(0);
  const averageConfidenceRef = useRef<number | null>(null);
  const analyzeErrorMessageRef = useRef<string | null>(null);
  const equipmentDetectErrorMessageRef = useRef<string | null>(null);
  const equipmentDetectionMemoryRef = useRef(createEquipmentDetectionMemory());
  const equipmentSnapshotInFlightRef = useRef(false);
  const stableNativePoseFrameRef = useRef<NativePoseFrame | null>(null);
  const subjectLockedRef = useRef(false);
  const subjectLockConfidenceRef = useRef<number | null>(null);
  const subjectLockGestureConsumedRef = useRef(false);
  const subjectLockGestureStartMsRef = useRef<number | null>(null);
  const subjectLockLostFramesRef = useRef(0);

  const setTrackedReps = (
    nextValue: number | ((currentValue: number) => number),
  ) => {
    const resolvedValue =
      typeof nextValue === "function"
        ? nextValue(liveRepCountRef.current)
        : nextValue;
    liveRepCountRef.current = resolvedValue;
    setReps(resolvedValue);
  };

  const setTrackedWorkoutLoadKg = (nextValue: number | null) => {
    workoutLoadKgRef.current = nextValue;
    setWorkoutLoadKg(nextValue);
  };

  const resetWorkoutLoadInput = () => {
    setWorkoutLoadInputValue("");
    setWorkoutLoadInputError(null);
    setTrackedWorkoutLoadKg(null);
  };

  const handleChangeWorkoutLoadInputValue = (value: string) => {
    const nextValue = sanitizeWorkoutLoadInput(value);
    const parsed = parseWorkoutLoadInput(nextValue, workoutLoadInputUnit);
    setWorkoutLoadInputValue(nextValue);
    setWorkoutLoadInputError(parsed.error);
  };

  const handleChangeWorkoutLoadInputUnit = (unit: WorkoutLoadUnit) => {
    if (unit === workoutLoadInputUnit) return;
    setWorkoutLoadInputUnit(unit);
    setWorkoutLoadInputValue(
      formatWorkoutLoadValue(workoutLoadKgRef.current, unit),
    );
    setWorkoutLoadInputError(null);
  };

  const handleApplyWorkoutLoadInput = () => {
    const parsed = parseWorkoutLoadInput(
      workoutLoadInputValue,
      workoutLoadInputUnit,
    );
    setWorkoutLoadInputError(parsed.error);
    if (parsed.error) return;
    if (parsed.weightKg === null) {
      showMessage("Enter a load before applying it.");
      return;
    }
    setTrackedWorkoutLoadKg(parsed.weightKg);
    showMessage(
      `Load set to ${formatWorkoutLoadValue(parsed.weightKg, workoutLoadInputUnit)} ${workoutLoadInputUnit}.`,
    );
  };

  const handleChangeWorkoutLoadSliderValue = (value: number) => {
    const nextValue = formatWorkoutLoadNumber(
      clampWorkoutLoadSliderValue(value, workoutLoadInputUnit),
    );
    const parsed = parseWorkoutLoadInput(nextValue, workoutLoadInputUnit);
    setWorkoutLoadInputValue(nextValue);
    setWorkoutLoadInputError(parsed.error);
  };

  const handleClearWorkoutLoadInput = () => {
    resetWorkoutLoadInput();
    showMessage("Load cleared.");
  };

  const rememberExerciseCreationFrame = (frame: PoseSequenceFrameRecord) => {
    exerciseCreationFrameBufferRef.current = [
      ...exerciseCreationFrameBufferRef.current,
      frame,
    ].slice(-EXERCISE_CREATION_FRAME_WINDOW_SIZE);
  };

  const setSubjectLockState = (
    locked: boolean,
    confidence: number | null,
    source: "gesture" | "manual" | "reset",
  ) => {
    subjectLockedRef.current = locked;
    subjectLockConfidenceRef.current = confidence;
    subjectLockGestureConsumedRef.current = false;
    subjectLockGestureStartMsRef.current = null;
    subjectLockLostFramesRef.current = 0;
    setSubjectLocked(locked);
    setSubjectLockConfidence(confidence);
    setSubjectLockGestureProgress(0);
    setSubjectLockStatusText(
      locked
        ? source === "gesture"
          ? "Rock-sign gesture locked this subject. Use Unlock target to release it."
          : "Manual subject lock is active. Tap Unlock target to release it."
        : `Subject lock is off. Tap Lock on me, or hold a clear rock-and-roll sign for ${SUBJECT_LOCK_GESTURE_HOLD_SECONDS} seconds once live landmarks are visible.`,
    );
  };

  const handleToggleSubjectLock = () => {
    const nextLocked = !subjectLockedRef.current;
    if (nextLocked && !isSubjectLockBodyRigVisible(currentKeypoints)) {
      const status =
        "Target lock needs a visible body rig first. Keep shoulders, hips, and one arm chain in frame.";
      setSubjectLockStatusText(status);
      showMessage(status);
      return;
    }
    setSubjectLockState(nextLocked, nextLocked ? 0.9 : null, "manual");
    showMessage(nextLocked ? "Subject locked." : "Subject unlocked.");
  };

  const resetRepEngineForSubjectLockWait = () => {
    const previousState = repEngineStateRef.current;
    if (
      previousState.phase === "primed" &&
      previousState.currentHighAngle === null &&
      previousState.currentLowAngle === null
    ) {
      return;
    }

    repEngineStateRef.current = {
      ...createPoseRepEngineState(),
      rawAngleData: previousState.rawAngleData,
      repCount: previousState.repCount,
    };
    setCurrentPhase("primed");
    setTrackedReps(previousState.repCount);
  };

  const canCountLockedSubject = (keypoints: PoseKeypointRecord[]) => {
    if (!subjectLockedRef.current) {
      subjectLockLostFramesRef.current = 0;
      return false;
    }

    if (isSubjectLockBodyRigVisible(keypoints)) {
      subjectLockLostFramesRef.current = 0;
      return true;
    }

    subjectLockLostFramesRef.current += 1;
    if (subjectLockLostFramesRef.current >= SUBJECT_LOCK_LOST_FRAME_LIMIT) {
      setSubjectLockState(false, null, "reset");
      setSubjectLockStatusText(
        "Subject lock was released because the body rig left the frame.",
      );
    }

    return false;
  };

  const resetSubjectLockGesture = () => {
    subjectLockGestureConsumedRef.current = false;
    subjectLockGestureStartMsRef.current = null;
    setSubjectLockGestureProgress(0);
  };

  const handleToggleCameraFacing = () => {
    if (isRecording || countdownValue !== null || isCameraSwitching) {
      showMessage("Pause tracking before switching cameras.");
      return;
    }

    const nextFacing: CameraType = cameraFacing === "back" ? "front" : "back";
    if (!cameraActive) {
      setCameraFacing(nextFacing);
      setCameraRemountKey((current) => current + 1);
      showMessage(
        `Switched to ${nextFacing === "front" ? "front" : "back"} camera.`,
      );
      return;
    }

    if (cameraSwitchTimerRef.current) {
      clearTimeout(cameraSwitchTimerRef.current);
      cameraSwitchTimerRef.current = null;
    }

    setIsCameraSwitching(true);
    setCameraActive(false);
    cameraRef.current = null;
    setCameraFacing(nextFacing);
    setCameraRemountKey((current) => current + 1);
    resetPoseTrackingBuffers();
    setSubjectLockState(false, null, "reset");
    setPoseStatusOverride(
      `Switching to ${nextFacing === "front" ? "front" : "back"} camera...`,
    );
    cameraSwitchTimerRef.current = setTimeout(() => {
      setCameraActive(true);
      setIsCameraSwitching(false);
      setPoseStatusOverride(
        `Switched to ${nextFacing === "front" ? "front" : "back"} camera. Recenter before recording.`,
      );
      showMessage(
        `Switched to ${nextFacing === "front" ? "front" : "back"} camera.`,
      );
      cameraSwitchTimerRef.current = null;
    }, CAMERA_SWITCH_REMOUNT_MS);
  };

  const updateSubjectLockGesture = (
    keypoints: PoseKeypointRecord[],
    capturedAtMs: number,
  ) => {
    if (subjectLockedRef.current) {
      if (subjectLockGestureStartMsRef.current !== null) {
        resetSubjectLockGesture();
      }
      return;
    }

    if (!isSubjectLockBodyRigVisible(keypoints)) {
      if (subjectLockGestureStartMsRef.current !== null) {
        resetSubjectLockGesture();
      }
      setSubjectLockStatusText(
        "Target lock needs a visible body rig first. Keep shoulders, hips, and one arm chain in frame.",
      );
      return;
    }

    if (!isRockSignSubjectLockGestureWithProfile(keypoints, activeHandShapeProfile)) {
      if (subjectLockGestureStartMsRef.current !== null) {
        resetSubjectLockGesture();
      }
      return;
    }

    const targetLockHoldMs =
      activeHandShapeProfile?.subjectLockGesture.holdMs ??
      SUBJECT_LOCK_GESTURE_HOLD_MS;
    const startMs = subjectLockGestureStartMsRef.current ?? capturedAtMs;
    subjectLockGestureStartMsRef.current = startMs;
    const heldMs = Math.max(0, capturedAtMs - startMs);
    const progress = Math.min(1, heldMs / targetLockHoldMs);
    const secondsLeft = Math.max(
      0,
      Math.ceil((targetLockHoldMs - heldMs) / 1000),
    );
    setSubjectLockGestureProgress(progress);
    setSubjectLockStatusText(
      `Rock-and-roll sign detected. Hold ${secondsLeft}s more to lock.`,
    );

    if (
      heldMs >= targetLockHoldMs &&
      !subjectLockGestureConsumedRef.current
    ) {
      subjectLockGestureConsumedRef.current = true;
      setSubjectLockState(true, 0.92, "gesture");
      showMessage("Subject locked by rock-sign gesture.");
    }
  };

  const {
    secondsRef,
    start,
    resume,
    pause,
    reset,
    cleanup: cleanupTimer,
  } = useWorkoutTimer();
  const {
    cameraActive,
    setCameraActive,
    countdownValue,
    permission,
    initCamera,
    cleanupCamera,
  } = useCameraCountdown();

  const {
    data: exercisesResponse = defaultPaginated<LiveExerciseRecord>(),
    isLoading: exercisesLoading,
  } = useQuery({
    ...fitnessExercisesQueryOptions(mobileApiClient, { limit: 50, page: 1 }),
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const {
    data: plansResponse = defaultPaginated<LivePlanSummaryRecord>(),
    isLoading: plansLoading,
  } = useQuery({
    ...fitnessPlansQueryOptions(mobileApiClient, user?.id, {
      limit: 20,
      page: 1,
    }),
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const preferredPlan = useMemo(
    () =>
      plansResponse.data.find((plan) => plan.isActive) ??
      plansResponse.data[0] ??
      null,
    [plansResponse.data],
  );
  const { data: planDetail = null } = useQuery({
    ...fitnessPlanDetailQueryOptions(mobileApiClient, preferredPlan?.id),
    enabled: !!preferredPlan?.id,
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const {
    data: sessionsResponse = defaultPaginated<LiveWorkoutSessionRecord>(),
    refetch: refetchSessions,
  } = useQuery({
    ...fitnessSessionsQueryOptions(mobileApiClient, user?.id, {
      limit: 10,
      page: 1,
    }),
    enabled: !!user?.id,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const startWorkoutSessionMutation = useMutation(
    startWorkoutSessionMutationOptions(mobileApiClient, queryClient),
  );
  const logWorkoutSetMutation = useMutation(
    logWorkoutSetMutationOptions(mobileApiClient, queryClient),
  );
  const completeWorkoutSessionMutation = useMutation(
    completeWorkoutSessionMutationOptions(mobileApiClient, queryClient),
  );
  const startPoseSessionMutation = useMutation(
    startPoseSessionMutationOptions(mobileApiClient, queryClient),
  );
  const analyzePoseSessionMutation = useMutation(
    analyzePoseSessionMutationOptions(mobileApiClient),
  );
  const finalizePoseSessionMutation = useMutation(
    finalizePoseSessionMutationOptions(mobileApiClient, queryClient),
  );
  const createExerciseReviewSubmissionMutation = useMutation(
    createExerciseReviewSubmissionMutationOptions(mobileApiClient, queryClient),
  );
  const createExerciseDraftProposalMutation = useMutation(
    createExerciseDraftProposalMutationOptions(mobileApiClient, queryClient),
  );

  const currentPlanExercise = useMemo(() => {
    if (!planDetail) return null;
    const sortedDays = [...planDetail.scheduleDays].sort((left, right) => {
      if (left.weekNumber !== right.weekNumber)
        return left.weekNumber - right.weekNumber;
      return left.dayOfWeek - right.dayOfWeek;
    });
    const firstDay = sortedDays[0];
    if (!firstDay) return null;
    return (
      [...firstDay.exercises].sort(
        (left, right) => left.orderIndex - right.orderIndex,
      )[0] ?? null
    );
  }, [planDetail]);

  const selectedExercise = useMemo(
    () => toSelectedExercise(currentPlanExercise, exercisesResponse.data),
    [currentPlanExercise, exercisesResponse.data],
  );
  const liveExerciseReferences = useMemo(
    () => toExerciseReferences(exercisesResponse.data),
    [exercisesResponse.data],
  );
  const exerciseReferences = useMemo(
    () => mergeExerciseReferences(liveExerciseReferences),
    [liveExerciseReferences],
  );
  const savedExerciseOptions = useMemo(
    () => toSavedExerciseOptions(exerciseReferences),
    [exerciseReferences],
  );
  const trackingExerciseLabel =
    confirmedExerciseLabel ??
    movementContract?.exercise ??
    detectedExerciseName ??
    null;
  const suggestedExerciseHint =
    confirmedExerciseLabel ??
    currentPlanExercise?.exerciseName ??
    selectedExercise?.label ??
    null;
  const trackingCatalogExerciseName =
    findExerciseReferenceByName(exerciseReferences, trackingExerciseLabel)
      ?.name ?? null;
  const equipmentContextLabel =
    trackingCatalogExerciseName ??
    suggestedExerciseHint ??
    trackingExerciseLabel;
  const declaredExerciseEquipmentContext = inferExerciseEquipmentContext(
    equipmentContextLabel,
  );
  const requiresEquipmentSnapshot = requiresVisualEquipmentContext(
    declaredExerciseEquipmentContext,
  );
  const providerEquipmentFresh =
    providerEquipmentDetectedAtMs !== null &&
    Date.now() - providerEquipmentDetectedAtMs <= EQUIPMENT_CONTEXT_FRESH_MS;
  const providerEquipmentHasPositiveContext =
    providerEquipmentContext !== null && providerEquipmentContext !== "unknown";
  const shouldUseProviderEquipmentResolution =
    requiresEquipmentSnapshot &&
    equipmentProviderEnabled === true &&
    providerEquipmentFresh &&
    providerEquipmentHasPositiveContext;
  const shouldUseDeclaredEquipmentFallback =
    requiresEquipmentSnapshot &&
    declaredExerciseEquipmentContext !== null &&
    WEIGHTED_EQUIPMENT_CONTEXTS.has(declaredExerciseEquipmentContext) &&
    isExplicitWeightedExerciseLabel(equipmentContextLabel) &&
    !shouldUseProviderEquipmentResolution &&
    equipmentProviderEnabled === false;
  const poseEquipmentContext = requiresEquipmentSnapshot
    ? shouldUseProviderEquipmentResolution
      ? providerEquipmentContext
      : shouldUseDeclaredEquipmentFallback
        ? declaredExerciseEquipmentContext
        : null
    : declaredExerciseEquipmentContext;
  const poseEquipmentSource = requiresEquipmentSnapshot
    ? shouldUseProviderEquipmentResolution
      ? (providerEquipmentSource ?? undefined)
      : shouldUseDeclaredEquipmentFallback
        ? toEquipmentSource(
            confirmedExerciseLabel !== null,
            declaredExerciseEquipmentContext,
          )
        : undefined
    : toEquipmentSource(
        confirmedExerciseLabel !== null,
        declaredExerciseEquipmentContext,
      );
  const poseEquipmentConfidence = requiresEquipmentSnapshot
    ? shouldUseProviderEquipmentResolution
      ? (providerEquipmentConfidence ?? undefined)
      : shouldUseDeclaredEquipmentFallback
        ? 0.58
        : undefined
    : declaredExerciseEquipmentContext
      ? 0.7
      : undefined;
  const poseEquipmentConflicts = shouldUseProviderEquipmentResolution
    ? providerEquipmentConflicts
    : shouldUseDeclaredEquipmentFallback
      ? ["equipment_provider_missed_selected_weighted_exercise"]
      : requiresEquipmentSnapshot && equipmentProviderEnabled === false
        ? ["equipment_provider_unavailable"]
        : [];
  const isWeightedTrackingExercise = isWeightedEquipmentContext(
    declaredExerciseEquipmentContext,
  );
  const workoutLoadInputVisible =
    !!trackingExerciseLabel && isWeightedTrackingExercise;
  const workoutLoadInputSavedLabel =
    workoutLoadKg === null
      ? null
      : `${formatWorkoutLoadValue(workoutLoadKg, workoutLoadInputUnit)} ${workoutLoadInputUnit}`;
  const workoutLoadSliderMin = MIN_WORKOUT_LOAD_SLIDER_VALUE;
  const workoutLoadSliderMax = getWorkoutLoadSliderMax(workoutLoadInputUnit);
  const workoutLoadSliderValue = getWorkoutLoadSliderValue(
    workoutLoadInputValue,
    workoutLoadKg,
    workoutLoadInputUnit,
  );
  const equipmentSnapshotActive =
    !isWebPoseRuntime &&
    isRecording &&
    requiresEquipmentSnapshot &&
    equipmentProviderEnabled !== false;
  const trackingExerciseReference = useMemo(
    () =>
      findExerciseReferenceByName(exerciseReferences, trackingExerciseLabel),
    [exerciseReferences, trackingExerciseLabel],
  );
  const trackingStructuredExercise = useMemo(
    () =>
      findExerciseByDetectedName(exercisesResponse.data, trackingExerciseLabel) ??
      selectedExercise,
    [exercisesResponse.data, selectedExercise, trackingExerciseLabel],
  );
  const activeHandShapeProfile =
    trackingStructuredExercise?.handShapeProfile ?? null;
  const activeMovementProfile =
    trackingStructuredExercise?.movementProfile ?? null;
  const activeMuscleTargets = trackingStructuredExercise?.muscleTargets ?? [];
  const planExerciseReference = useMemo(
    () =>
      findExerciseReferenceByName(
        exerciseReferences,
        currentPlanExercise?.exerciseName ?? selectedExercise?.label,
      ),
    [
      currentPlanExercise?.exerciseName,
      exerciseReferences,
      selectedExercise?.label,
    ],
  );
  const trackingDisabledReason = useMemo(() => {
    if (exercisesLoading) return null;
    if (exerciseReferences.length > 0) return null;
    return "The live exercise catalog is empty on this stack. Seed the workout catalog before starting tracked sets and EXP sync.";
  }, [exerciseReferences.length, exercisesLoading]);
  countdownValueRef.current = countdownValue;
  isExerciseConfirmationVisibleRef.current = isExerciseConfirmationVisible;
  const liveActiveSession = useMemo(
    () =>
      sessionsResponse.data.find(
        (session) => session.status === "in_progress",
      ) ?? null,
    [sessionsResponse.data],
  );
  const seconds = secondsRef.current;
  const calories = useMemo(
    () => Math.round((seconds / 60) * 6 + reps * 0.4),
    [reps, seconds],
  );
  const permissionGranted = toPermissionGranted(permission);
  const exerciseCreationReady =
    !!movementContractRef.current &&
    !!poseSessionIdRef.current &&
    repEngineStateRef.current.repCount >= EXERCISE_CREATION_MIN_REPS &&
    exerciseCreationFrameBufferRef.current.length >= 8;

  const buildCurrentExerciseCreationDraft = (): ExerciseCreationDraft | null => {
    const activeContract = movementContractRef.current;
    const activePoseSessionId = poseSessionIdRef.current;
    const repCount = repEngineStateRef.current.repCount;
    if (
      !activeContract ||
      !activePoseSessionId ||
      repCount < EXERCISE_CREATION_MIN_REPS
    ) {
      return null;
    }

    const exerciseLabel =
      confirmedExerciseLabelRef.current ??
      trackingExerciseLabel ??
      activeContract.exercise;
    const displayName = toDisplayExerciseName(exerciseLabel);
    const rig = buildExerciseRigFromPoseFrames({
      exerciseLabel,
      frames: exerciseCreationFrameBufferRef.current,
      movementContract: activeContract,
      poseSessionId: activePoseSessionId,
      rawAngleData: repEngineStateRef.current.rawAngleData,
    });
    const evidence: ExerciseAiDraftEvidenceRecord = buildExerciseAiDraftEvidence({
      confidence: averageConfidenceRef.current,
      integrityNotes: [
        subjectLockedRef.current
          ? "Subject lock was active during capture."
          : "Subject lock was not active for the entire capture.",
        ...poseEquipmentConflicts,
      ].filter(Boolean),
      movementContract: activeContract,
      repCount,
      rig,
    });
    const primaryMuscleGroup = getPrimaryExerciseMuscleGroup(activeMuscleTargets);
    const muscleGroup =
      primaryMuscleGroup ||
      trackingExerciseReference?.muscleGroup ||
      planExerciseReference?.muscleGroup ||
      selectedExercise?.muscleGroup ||
      "custom";
    const muscleTargets = normalizeExerciseMuscleTargets(
      activeMuscleTargets.length
        ? activeMuscleTargets
        : createDefaultExerciseMuscleTargets(muscleGroup),
      muscleGroup,
    );
    const normalizedHandShapeProfile =
      normalizeExerciseHandShapeProfile(activeHandShapeProfile);
    const handShapeProfile = {
      ...normalizedHandShapeProfile,
      grip: {
        ...normalizedHandShapeProfile.grip,
        required:
          normalizedHandShapeProfile.grip.required ||
          normalizeExerciseName(exerciseLabel).includes("curl"),
      },
    };
    const movementProfile =
      normalizeExerciseMovementProfile(activeMovementProfile, {
        movementContract: activeContract,
        rig,
      }) ??
      createExerciseMovementProfile({
        movementContract: activeContract,
        rig,
      });
    const category: FitnessExerciseCategory = "strength";

    return {
      category,
      description: `${displayName} captured from a live member pose session. The draft is based on ${repCount} counted reps, a ${activeContract.dominantJoint}-dominant movement contract, and the attached rig keyframes.`,
      evidence,
      handShapeProfile,
      instructions:
        trackingExerciseReference?.recommendation ??
        `Start in the captured setup, move through the shown range of motion, reach peak contraction, then return with control while keeping the tracked body chain visible.`,
      movementProfile,
      muscleGroup,
      muscleTargets,
      name: displayName,
      summary: `${repCount} reps captured with ${activeContract.dominantJoint}-dominant range-of-motion evidence.`,
    };
  };

  const handleOpenExerciseCreationReview = async () => {
    const localDraft = buildCurrentExerciseCreationDraft();
    if (!localDraft) {
      showMessage(
        `Capture ${EXERCISE_CREATION_MIN_REPS} clean reps with a visible rig before creating an exercise draft.`,
      );
      return;
    }

    const payload: CreateExerciseDraftProposalInput = {
      category: localDraft.category,
      description: localDraft.description,
      evidence: localDraft.evidence,
      handShapeProfile: localDraft.handShapeProfile,
      instructions: localDraft.instructions,
      movementProfile: localDraft.movementProfile,
      muscleGroup: localDraft.muscleGroup,
      muscleTargets: localDraft.muscleTargets,
      poseSessionId: poseSessionIdRef.current,
      proposedName: localDraft.name,
      summary: localDraft.summary,
    };

    try {
      const proposal = await createExerciseDraftProposalMutation.mutateAsync({
        payload,
        userId: user?.id,
      });
      setExerciseCreationDraft({
        category: proposal.category,
        description: proposal.description,
        evidence: proposal.evidence,
        handShapeProfile: proposal.handShapeProfile,
        instructions: proposal.instructions,
        movementProfile: proposal.movementProfile,
        muscleGroup: proposal.muscleGroup,
        muscleTargets: proposal.muscleTargets,
        name: proposal.proposedName,
        summary: proposal.summary,
      });
      showMessage("Exercise draft proposal generated.");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 403) {
        showMessage(error.message);
        return;
      }
      setExerciseCreationDraft(localDraft);
      showMessage("Using local draft fallback. Review it before submitting.");
    }
    setIsExerciseCreationReviewOpen(true);
    setIsExerciseModalOpen(false);
  };

  const handleSubmitExerciseCreationDraft = async () => {
    if (!exerciseCreationDraft) return;

    const payload: CreateExerciseReviewSubmissionInput = {
      category: exerciseCreationDraft.category,
      description: exerciseCreationDraft.description,
      evidenceBars: exerciseCreationDraft.evidence,
      handShapeProfile: exerciseCreationDraft.handShapeProfile,
      instructions: exerciseCreationDraft.instructions,
      matchHint: exerciseCreationDraft.evidence.movementContract?.exercise,
      movementProfile: exerciseCreationDraft.movementProfile,
      muscleGroup: exerciseCreationDraft.muscleGroup,
      muscleTargets: exerciseCreationDraft.muscleTargets,
      originLabel: "mobile creator session",
      poseSessionId: poseSessionIdRef.current,
      proposedName: exerciseCreationDraft.name,
      queueTag: "ai draft",
      sourceLabel: "mobile pose rig",
      summary: exerciseCreationDraft.summary,
      title: exerciseCreationDraft.name,
      triggerLabel: `${exerciseCreationDraft.evidence.repCount} reps captured`,
    };

    try {
      await createExerciseReviewSubmissionMutation.mutateAsync({
        payload,
        userId: user?.id,
      });
      setIsExerciseCreationReviewOpen(false);
      setExerciseCreationDraft(null);
      showMessage("Exercise draft submitted to Exercise Lab.");
    } catch (error) {
      showMessage(
        error instanceof ApiClientError
          ? error.message
          : "Failed to submit exercise draft.",
      );
    }
  };

  useEffect(() => {
    if (liveActiveSession?.id && !workoutSessionId) {
      setWorkoutSessionId(liveActiveSession.id);
    }
  }, [liveActiveSession, workoutSessionId]);

  useEffect(() => {
    poseSessionIdRef.current = poseSessionId;
  }, [poseSessionId]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const resetPoseTrackingBuffers = () => {
    poseFrameBufferRef.current = [];
    exerciseCreationFrameBufferRef.current = [];
    framesSinceAnalyzeRef.current = 0;
    trackingReliabilityNotifiedRef.current = false;
    frameInFlightRef.current = false;
    stableNativePoseFrameRef.current = null;
    subjectLockLostFramesRef.current = 0;
    setNativeLandmarksActive(false);
    resetSubjectLockGesture();
  };

  const resetEquipmentDetectionState = () => {
    equipmentSnapshotInFlightRef.current = false;
    equipmentDetectErrorMessageRef.current = null;
    equipmentDetectionMemoryRef.current = createEquipmentDetectionMemory();
    setEquipmentProviderEnabled(null);
    setProviderEquipmentConfidence(null);
    setProviderEquipmentCheckedAtMs(null);
    setProviderEquipmentConflicts([]);
    setProviderEquipmentContext(null);
    setProviderEquipmentDetections([]);
    setProviderEquipmentDetectedAtMs(null);
    setProviderEquipmentSource(null);
  };

  const resetPoseRuntimeState = (clearReps: boolean) => {
    movementContractRef.current = null;
    repEngineStateRef.current = createPoseRepEngineState();
    averageConfidenceRef.current = null;
    setNativeLandmarksActive(false);
    setMovementContract(null);
    setCurrentAngle(null);
    setCurrentKeypoints(null);
    setCurrentPhase("primed");
    setLowConfidenceLandmarks([]);
    if (clearReps) {
      setTrackedReps(0);
    }
  };

  const armFallbackMovementContract = (
    exerciseLabel: string | null | undefined,
    frameKeypoints: PoseKeypointRecord[] | null,
    statusText: string,
  ) => {
    const fallbackContract = buildFallbackPoseMovementContract(exerciseLabel);
    if (!fallbackContract) {
      return null;
    }

    const previousState = repEngineStateRef.current;
    repEngineStateRef.current = {
      ...createPoseRepEngineState(),
      rawAngleData: previousState.rawAngleData,
      repCount: previousState.repCount,
    };
    movementContractRef.current = fallbackContract;
    setMovementContract(fallbackContract);
    setCurrentPhase("primed");
    setCurrentAngle(
      frameKeypoints
        ? getPoseJointAngle(frameKeypoints, fallbackContract.dominantJoint)
        : null,
    );
    setPoseFeedback([
      `Local ${toDisplayExerciseName(fallbackContract.exercise)} counting is active.`,
      "Keep shoulders, hips, knees, and ankles visible to the camera.",
      "Controlled half reps can still count once the joint angle cycles through the range.",
    ]);
    setPoseStatusOverride(statusText);
    framesSinceAnalyzeRef.current = 0;
    analyzeErrorMessageRef.current = null;
    return fallbackContract;
  };

  const disposePoseAnalyzer = () => {
    poseAnalyzerRef.current?.dispose();
    poseAnalyzerRef.current = null;
    poseAnalyzerPromiseRef.current = null;
  };

  const stopFrameLoop = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  };

  const ensurePoseAnalyzerReady = async () => {
    if (!isWebPoseRuntime) {
      return null;
    }

    if (poseAnalyzerRef.current) {
      return poseAnalyzerRef.current;
    }

    if (!poseAnalyzerPromiseRef.current) {
      setIsPoseModelLoading(true);
      setPoseStatusOverride("Loading the browser pose model...");
      poseAnalyzerPromiseRef.current = createBrowserPoseAnalyzer()
        .then((analyzer) => {
          poseAnalyzerRef.current = analyzer;
          return analyzer;
        })
        .finally(() => {
          setIsPoseModelLoading(false);
        });
    }

    try {
      const analyzer = await poseAnalyzerPromiseRef.current;
      setPoseStatusOverride(null);
      return analyzer;
    } catch (error) {
      poseAnalyzerPromiseRef.current = null;
      poseAnalyzerRef.current = null;
      setPoseStatusOverride(
        "The browser pose model failed to load on this session.",
      );
      throw error;
    }
  };

  const handleNativePoseFrame = async (frame: NativePoseFrame) => {
    if (isWebPoseRuntime || frame.keypoints.length !== 33) {
      return;
    }

    const stableFrame = stabilizeNativePoseFrame(
      frame,
      stableNativePoseFrameRef.current,
    );
    stableNativePoseFrameRef.current = stableFrame;
    rememberExerciseCreationFrame(stableFrame);

    setNativeLandmarksActive(true);
    setCurrentKeypoints(stableFrame.keypoints);
    updateSubjectLockGesture(stableFrame.keypoints, stableFrame.capturedAtMs);

    const instantSignals = computePoseSignals([stableFrame]);
    const lowConfidenceLandmarks =
      instantSignals.visibility.lowConfidenceLandmarks;
    const reliability = getNativeFrameReliability(stableFrame.keypoints);
    setLowConfidenceLandmarks(lowConfidenceLandmarks);

    if (subjectLockedRef.current) {
      const nextConfidence = Math.max(
        subjectLockConfidenceRef.current ?? 0,
        reliability.averageVisibility,
      );
      subjectLockConfidenceRef.current = nextConfidence;
      setSubjectLockConfidence(nextConfidence);
    }

    if (!isRecordingRef.current || !poseSessionIdRef.current) {
      setPoseStatusOverride(
        reliability.isReliable
          ? "Native landmarks are live. Start recording to arm auto detection and rep counting."
          : "Native camera is live. Keep your full body visible to lock clean landmarks.",
      );
      return;
    }

    if (countdownValueRef.current !== null) {
      return;
    }

    if (!reliability.isReliable) {
      poseFrameBufferRef.current = [];
      framesSinceAnalyzeRef.current = 0;
      if (movementContractRef.current) {
        setCurrentAngle(
          getPoseMovementContractAngle(
            movementContractRef.current,
            stableFrame.keypoints,
          ),
        );
      } else {
        setCurrentAngle(null);
      }
      setPoseStatusOverride(TRACKING_UNRELIABLE_MESSAGE);
      setPoseFeedback([
        TRACKING_UNRELIABLE_MESSAGE,
        `Only ${reliability.visibleLandmarks} reliable landmarks are visible right now.`,
        "Square your body to the camera before expecting saved reps.",
      ]);
      return;
    }

    trackingReliabilityNotifiedRef.current = false;
    poseFrameBufferRef.current = [
      ...poseFrameBufferRef.current,
      stableFrame,
    ].slice(-POSE_FRAME_WINDOW_SIZE);
    framesSinceAnalyzeRef.current += 1;
    const bufferedFrames = poseFrameBufferRef.current.slice(
      -POSE_FRAME_WINDOW_SIZE,
    );
    const signals = computePoseSignals(bufferedFrames);
    setLowConfidenceLandmarks(signals.visibility.lowConfidenceLandmarks);
    averageConfidenceRef.current = signals.visibility.averageVisibility;

    if (!movementContractRef.current && confirmedExerciseLabelRef.current) {
      armFallbackMovementContract(
        confirmedExerciseLabelRef.current,
        stableFrame.keypoints,
        `Native landmark rep counting is armed for ${toDisplayExerciseName(
          confirmedExerciseLabelRef.current,
        )}.`,
      );
    }

    if (movementContractRef.current) {
      const liveAngle = getPoseMovementContractAngle(
        movementContractRef.current,
        stableFrame.keypoints,
      );
      setCurrentAngle(liveAngle);
      if (!canCountLockedSubject(stableFrame.keypoints)) {
        resetRepEngineForSubjectLockWait();
        setPoseFeedback([
          subjectLockedRef.current
            ? "Subject lock lost the body rig. Recenter and lock again before counting."
            : "Lock onto your body before rep counting starts.",
          "This prevents background pose jitter from creating phantom reps.",
          "Keep shoulders, hips, and one arm chain visible before tapping Lock on me.",
        ]);
        setPoseStatusOverride(
          subjectLockedRef.current
            ? "Subject lock is unstable. Counting is paused until the rig is visible again."
            : "Subject lock is required before rep counting. The overlay can move, but reps stay paused.",
        );
        return;
      }

      const repStep = stepPoseRepEngine(
        repEngineStateRef.current,
        movementContractRef.current,
        liveAngle,
        stableFrame.capturedAtMs,
        {
          equipmentContext: poseEquipmentContext,
          equipmentSource: poseEquipmentSource,
          handShapeProfile: activeHandShapeProfile,
          keypointFrames: bufferedFrames.map(
            (bufferedFrame) => bufferedFrame.keypoints,
          ),
          keypoints: stableFrame.keypoints,
          lowConfidenceLandmarks: signals.visibility.lowConfidenceLandmarks,
          signals,
        },
      );
      repEngineStateRef.current = repStep.nextState;
      setCurrentPhase(repStep.nextState.phase);
      setTrackedReps(repStep.nextState.repCount);

      const guidanceTips = summarizeMovementGuidance(
        movementContractRef.current,
        stableFrame.keypoints,
        repStep.nextState.phase,
        signals.visibility.lowConfidenceLandmarks,
      );
      setPoseFeedback(
        guidanceTips.length > 0
          ? guidanceTips.slice(0, 3)
          : NATIVE_POSE_FEEDBACK,
      );
      setPoseStatusOverride(
        repStep.noCountReason
          ? `Native landmarks are live. ${buildPoseNoCountStatusText(
              repStep.noCountReason,
              {
                equipmentProviderEnabled,
                requiresEquipmentSnapshot,
              },
            )}`
          : `Native landmark rep counting is live for ${toDisplayExerciseName(
              movementContractRef.current.exercise,
            )}.`,
      );
      return;
    }

    if (
      bufferedFrames.length < POSE_MIN_ANALYZE_FRAMES ||
      framesSinceAnalyzeRef.current < POSE_FRAME_BATCH_TRIGGER ||
      frameInFlightRef.current ||
      isExerciseConfirmationVisibleRef.current
    ) {
      setPoseStatusOverride(
        `Collecting a ${POSE_MIN_ANALYZE_FRAMES}-frame native landmark window before auto detection starts.`,
      );
      return;
    }

    const activePoseSessionId = poseSessionIdRef.current;
    if (!activePoseSessionId) {
      return;
    }

    frameInFlightRef.current = true;
    try {
      const analysis = await analyzePoseSessionMutation.mutateAsync({
        poseSessionId: activePoseSessionId,
        input: {
          cameraFacingMode: toPoseCameraFacingMode(cameraFacing),
          equipmentConfidence: poseEquipmentConfidence,
          equipmentConflicts: poseEquipmentConflicts,
          equipmentContext: poseEquipmentContext,
          equipmentSource: poseEquipmentSource,
          exerciseHint: suggestedExerciseHint,
          frames: bufferedFrames,
          landmarkSchema: "mediapipe_pose_v1",
          signals,
          subjectLockConfidence: subjectLockedRef.current
            ? Math.max(
                subjectLockConfidenceRef.current ?? 0,
                signals.visibility.averageVisibility,
              )
            : null,
          subjectLocked: subjectLockedRef.current,
        },
      });

      framesSinceAnalyzeRef.current = 0;
      analyzeErrorMessageRef.current = null;
      averageConfidenceRef.current = analysis.confidence;
      if (subjectLockedRef.current && analysis.subjectLockConfidence !== null) {
        subjectLockConfidenceRef.current = analysis.subjectLockConfidence;
        setSubjectLockConfidence(analysis.subjectLockConfidence);
      }
      setExerciseConfirmationCandidates(analysis.candidateExercises);

      if (analysis.exerciseClass) {
        setDetectedExerciseName(analysis.exerciseClass);
      }

      if (
        analysis.formFeedback.length > 0 ||
        analysis.sessionQualityState !== "stable"
      ) {
        setPoseFeedback(
          buildPoseQualityFeedback(
            analysis.formFeedback,
            analysis.sessionQualityState,
            analysis.sessionQualityReasons,
            NATIVE_POSE_FEEDBACK,
          ),
        );
      }

      if (analysis.needsConfirmation) {
        movementContractRef.current = null;
        setMovementContract(null);
        setCurrentAngle(null);
        setCurrentPhase("primed");
        setIsExerciseConfirmationVisible(true);
        setPoseStatusOverride(
          "Confirm the native exercise label to resume live rep counting.",
        );
        return;
      }

      if (analysis.movementContract) {
        movementContractRef.current = analysis.movementContract;
        setMovementContract(analysis.movementContract);
        setCurrentPhase("primed");
        const liveAngle = getPoseMovementContractAngle(
          analysis.movementContract,
          stableFrame.keypoints,
        );
        setCurrentAngle(liveAngle);
        const guidanceTips = summarizeMovementGuidance(
          analysis.movementContract,
          stableFrame.keypoints,
          "primed",
          signals.visibility.lowConfidenceLandmarks,
        );
        setPoseFeedback(
          guidanceTips.length > 0
            ? guidanceTips.slice(0, 3)
            : analysis.formFeedback.slice(0, 3),
        );
      }

      setIsExerciseConfirmationVisible(false);
      const displayExercise =
        confirmedExerciseLabelRef.current ??
        analysis.movementContract?.exercise ??
        analysis.exerciseClass ??
        null;
      setPoseStatusOverride(
        displayExercise
          ? `Native pose contract ready for ${toDisplayExerciseName(displayExercise)}. Rep counting is armed.`
          : "Native pose contract ready. Rep counting is armed.",
      );
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Native landmark analysis could not process the latest batch.";
      const fallbackContract = confirmedExerciseLabelRef.current
        ? armFallbackMovementContract(
            confirmedExerciseLabelRef.current,
            stableFrame.keypoints,
            `Using local native rep counting for ${toDisplayExerciseName(
              confirmedExerciseLabelRef.current,
            )} while auto detection reconnects.`,
          )
        : null;
      if (analyzeErrorMessageRef.current !== message) {
        analyzeErrorMessageRef.current = message;
        console.error("Native pose batch analyze failed", error);
        showMessage(
          fallbackContract
            ? `Switched ${toDisplayExerciseName(fallbackContract.exercise)} to the native local counter.`
            : "Native analysis paused. Confirm the exercise to keep counting.",
        );
      }
      if (!fallbackContract) {
        setPoseFeedback([
          "Native pose analysis is temporarily unavailable.",
          "Confirm the exercise to keep local rep counting active.",
          "Choose Push-Up manually if you want conventional push-ups pinned.",
        ]);
        setPoseStatusOverride(
          "Native analysis paused. Confirm the exercise to continue local rep counting.",
        );
        setIsExerciseConfirmationVisible(true);
      }
    } finally {
      frameInFlightRef.current = false;
    }
  };

  const handleNativeEquipmentSnapshot = async (
    snapshot: NativeEquipmentSnapshot,
  ) => {
    if (
      isWebPoseRuntime ||
      !isRecordingRef.current ||
      equipmentSnapshotInFlightRef.current
    ) {
      return;
    }

    equipmentSnapshotInFlightRef.current = true;
    try {
      const detection = await detectNativeEquipmentSnapshot({
        cameraFacingMode: toPoseCameraFacingMode(snapshot.cameraFacing),
        exerciseHint: suggestedExerciseHint ?? trackingExerciseLabel,
        frameUri: snapshot.frameUri,
      });
      const capturedAtMs = Date.now();
      const stabilizedDetection = stabilizeProviderEquipmentDetection(
        detection,
        equipmentDetectionMemoryRef.current,
        capturedAtMs,
      );
      const resolvedDetection = stabilizedDetection.detection;

      equipmentDetectErrorMessageRef.current = null;
      setProviderEquipmentCheckedAtMs(capturedAtMs);
      setEquipmentProviderEnabled(resolvedDetection.providerEnabled);
      setProviderEquipmentConfidence(resolvedDetection.equipmentConfidence);
      setProviderEquipmentConflicts(resolvedDetection.equipmentConflicts);
      setProviderEquipmentContext(resolvedDetection.equipmentContext);
      setProviderEquipmentDetections(resolvedDetection.equipmentDetections);
      setProviderEquipmentDetectedAtMs(stabilizedDetection.detectedAtMs);
      setProviderEquipmentSource(resolvedDetection.equipmentSource);
    } catch (error) {
      const capturedAtMs = Date.now();
      const heldDetection = getHeldEquipmentDetectionAfterFailure(
        equipmentDetectionMemoryRef.current,
        capturedAtMs,
      );
      if (heldDetection) {
        setProviderEquipmentCheckedAtMs(capturedAtMs);
        setProviderEquipmentConfidence(
          heldDetection.detection.equipmentConfidence,
        );
        setProviderEquipmentConflicts(
          heldDetection.detection.equipmentConflicts,
        );
        setProviderEquipmentContext(heldDetection.detection.equipmentContext);
        setProviderEquipmentDetections(
          heldDetection.detection.equipmentDetections,
        );
        setProviderEquipmentDetectedAtMs(heldDetection.detectedAtMs);
        setProviderEquipmentSource(heldDetection.detection.equipmentSource);
      }
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Native equipment detection failed.";
      const shouldLog =
        equipmentDetectErrorMessageRef.current !== message ||
        equipmentDetectionMemoryRef.current.failureCount % 4 === 0;
      if (shouldLog) {
        equipmentDetectErrorMessageRef.current = message;
        console.error("Native equipment detection failed", error);
      }
    } finally {
      equipmentSnapshotInFlightRef.current = false;
    }
  };

  const captureAndAnalyzeFrame = async (activePoseSessionId: string) => {
    if (
      frameInFlightRef.current ||
      countdownValueRef.current !== null ||
      isExerciseConfirmationVisibleRef.current
    ) {
      return;
    }

    if (!isWebPoseRuntime) {
      return;
    }

    const analyzer = poseAnalyzerRef.current;
    if (!analyzer) return;

    const frame = await analyzer.readFrame();
    if (!frame) {
      poseFrameBufferRef.current = [];
      framesSinceAnalyzeRef.current = 0;
      setCurrentKeypoints(null);
      setCurrentAngle(null);
      setLowConfidenceLandmarks([]);
      if (!trackingReliabilityNotifiedRef.current) {
        trackingReliabilityNotifiedRef.current = true;
        setPoseStatusOverride(TRACKING_UNRELIABLE_MESSAGE);
        setPoseFeedback([
          TRACKING_UNRELIABLE_MESSAGE,
          "Square your body to the camera and keep your whole movement visible.",
          "Wait for the live counter to resume before expecting saved reps.",
        ]);
      }
      return;
    }

    rememberExerciseCreationFrame(frame);
    setCurrentKeypoints(frame.keypoints);
    updateSubjectLockGesture(frame.keypoints, frame.capturedAtMs);
    const instantSignals = computePoseSignals([frame]);
    setLowConfidenceLandmarks(instantSignals.visibility.lowConfidenceLandmarks);

    if (!frame.isReliable) {
      poseFrameBufferRef.current = [];
      framesSinceAnalyzeRef.current = 0;
      if (movementContractRef.current) {
        setCurrentAngle(
          getPoseMovementContractAngle(
            movementContractRef.current,
            frame.keypoints,
          ),
        );
      } else {
        setCurrentAngle(null);
      }
      setPoseStatusOverride(TRACKING_UNRELIABLE_MESSAGE);
      setPoseFeedback([
        TRACKING_UNRELIABLE_MESSAGE,
        "Keep shoulders, hips, and at least one leg chain visible for live counting.",
        "The overlay stays live while the counter waits for a reliable full-body window.",
      ]);
      return;
    }

    trackingReliabilityNotifiedRef.current = false;
    poseFrameBufferRef.current = [...poseFrameBufferRef.current, frame].slice(
      -POSE_FRAME_WINDOW_SIZE,
    );
    framesSinceAnalyzeRef.current += 1;
    const bufferedFrames = poseFrameBufferRef.current.slice(
      -POSE_FRAME_WINDOW_SIZE,
    );
    const signals = computePoseSignals(bufferedFrames);
    setLowConfidenceLandmarks(signals.visibility.lowConfidenceLandmarks);

    if (movementContractRef.current) {
      const liveAngle = getPoseMovementContractAngle(
        movementContractRef.current,
        frame.keypoints,
      );
      setCurrentAngle(liveAngle);
      if (!canCountLockedSubject(frame.keypoints)) {
        resetRepEngineForSubjectLockWait();
        setPoseFeedback([
          subjectLockedRef.current
            ? "Subject lock lost the body rig. Recenter and lock again before counting."
            : "Lock onto your body before rep counting starts.",
          "This prevents background pose jitter from creating phantom reps.",
          "Keep shoulders, hips, and one arm chain visible before tapping Lock on me.",
        ]);
        setPoseStatusOverride(
          subjectLockedRef.current
            ? "Subject lock is unstable. Counting is paused until the rig is visible again."
            : "Subject lock is required before rep counting. The overlay can move, but reps stay paused.",
        );
        return;
      }

      const repStep = stepPoseRepEngine(
        repEngineStateRef.current,
        movementContractRef.current,
        liveAngle,
        frame.capturedAtMs,
        {
          equipmentContext: poseEquipmentContext,
          equipmentSource: poseEquipmentSource,
          handShapeProfile: activeHandShapeProfile,
          keypointFrames: bufferedFrames.map(
            (bufferedFrame) => bufferedFrame.keypoints,
          ),
          keypoints: frame.keypoints,
          lowConfidenceLandmarks: signals.visibility.lowConfidenceLandmarks,
          signals,
        },
      );
      repEngineStateRef.current = repStep.nextState;
      setCurrentPhase(repStep.nextState.phase);
      setTrackedReps(repStep.nextState.repCount);

      const guidanceTips = summarizeMovementGuidance(
        movementContractRef.current,
        frame.keypoints,
        repStep.nextState.phase,
        signals.visibility.lowConfidenceLandmarks,
      );
      setPoseFeedback(
        guidanceTips.length > 0
          ? guidanceTips.slice(0, 3)
          : DEFAULT_POSE_FEEDBACK,
      );
      setPoseStatusOverride(
        repStep.noCountReason
          ? buildPoseNoCountStatusText(repStep.noCountReason, {
              equipmentProviderEnabled,
              requiresEquipmentSnapshot,
            })
          : `Local rep counting is live for ${toDisplayExerciseName(
              movementContractRef.current.exercise,
            )} at ${acceptedFps ?? 0} fps.`,
      );
      return;
    }

    if (
      bufferedFrames.length < POSE_MIN_ANALYZE_FRAMES ||
      framesSinceAnalyzeRef.current < POSE_FRAME_BATCH_TRIGGER
    ) {
      setPoseStatusOverride(
        `Collecting a ${POSE_MIN_ANALYZE_FRAMES}-frame movement window before live rep counting starts.`,
      );
      return;
    }

    frameInFlightRef.current = true;
    try {
      const exerciseHint = suggestedExerciseHint;
      const analysis = await analyzePoseSessionMutation.mutateAsync({
        poseSessionId: activePoseSessionId,
        input: {
          cameraFacingMode: analyzer.getFacingMode(),
          equipmentConfidence: poseEquipmentConfidence,
          equipmentConflicts: poseEquipmentConflicts,
          equipmentContext: poseEquipmentContext,
          equipmentSource: poseEquipmentSource,
          exerciseHint,
          frames: bufferedFrames,
          landmarkSchema: "mediapipe_pose_v1",
          signals,
          subjectLockConfidence: subjectLockedRef.current
            ? Math.max(
                subjectLockConfidenceRef.current ?? 0,
                signals.visibility.averageVisibility,
              )
            : null,
          subjectLocked: subjectLockedRef.current,
        },
      });

      framesSinceAnalyzeRef.current = 0;
      analyzeErrorMessageRef.current = null;
      averageConfidenceRef.current = analysis.confidence;
      if (subjectLockedRef.current && analysis.subjectLockConfidence !== null) {
        subjectLockConfidenceRef.current = analysis.subjectLockConfidence;
        setSubjectLockConfidence(analysis.subjectLockConfidence);
      }
      setExerciseConfirmationCandidates(analysis.candidateExercises);

      if (analysis.exerciseClass) {
        setDetectedExerciseName(analysis.exerciseClass);
      }

      if (
        analysis.formFeedback.length > 0 ||
        analysis.sessionQualityState !== "stable"
      ) {
        setPoseFeedback(
          buildPoseQualityFeedback(
            analysis.formFeedback,
            analysis.sessionQualityState,
            analysis.sessionQualityReasons,
            DEFAULT_POSE_FEEDBACK,
          ),
        );
      }

      if (analysis.needsConfirmation) {
        movementContractRef.current = null;
        setMovementContract(null);
        setCurrentAngle(null);
        setCurrentPhase("primed");
        setIsExerciseConfirmationVisible(true);
        setPoseStatusOverride(
          "Confirm the live exercise label to resume auto rep counting.",
        );
        return;
      }

      if (analysis.movementContract) {
        movementContractRef.current = analysis.movementContract;
        setMovementContract(analysis.movementContract);
        setCurrentPhase("primed");
        const liveAngle = getPoseMovementContractAngle(
          analysis.movementContract,
          frame.keypoints,
        );
        setCurrentAngle(liveAngle);
        const guidanceTips = summarizeMovementGuidance(
          analysis.movementContract,
          frame.keypoints,
          "primed",
          signals.visibility.lowConfidenceLandmarks,
        );
        setPoseFeedback(
          analysis.sessionQualityState !== "stable"
            ? buildPoseQualityFeedback(
                guidanceTips.length > 0 ? guidanceTips : analysis.formFeedback,
                analysis.sessionQualityState,
                analysis.sessionQualityReasons,
                DEFAULT_POSE_FEEDBACK,
              )
            : guidanceTips.length > 0
              ? guidanceTips.slice(0, 3)
              : analysis.formFeedback.slice(0, 3),
        );
      }

      setIsExerciseConfirmationVisible(false);
      const displayExercise =
        confirmedExerciseLabelRef.current ??
        analysis.movementContract?.exercise ??
        analysis.exerciseClass ??
        null;
      setPoseStatusOverride(
        displayExercise
          ? `Pose contract ready for ${toDisplayExerciseName(displayExercise)}. Local rep counting is armed at ${acceptedFps ?? 0} fps.`
          : `Pose contract ready. Local rep counting is armed at ${acceptedFps ?? 0} fps.`,
      );
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Pose tracking could not analyze the latest keypoint batch.";
      const fallbackContract = confirmedExerciseLabelRef.current
        ? armFallbackMovementContract(
            confirmedExerciseLabelRef.current,
            frame.keypoints,
            `Using local rep counting for ${toDisplayExerciseName(
              confirmedExerciseLabelRef.current,
            )} while live pose analysis reconnects.`,
          )
        : null;
      if (analyzeErrorMessageRef.current !== message) {
        analyzeErrorMessageRef.current = message;
        console.error("Pose analyze batch failed", error);
        showMessage(
          fallbackContract
            ? `Switched ${toDisplayExerciseName(fallbackContract.exercise)} to the local counter.`
            : "Pose analysis paused. Confirm the exercise to continue local counting.",
        );
      }
      if (!fallbackContract) {
        setPoseFeedback([
          "Pose analysis is temporarily unavailable.",
          "Confirm the exercise to keep local rep counting active.",
          "Choose Push-Up to keep conventional push-ups counting locally.",
        ]);
        setPoseStatusOverride(
          "Pose analysis paused. Confirm the exercise to continue local rep counting.",
        );
        setIsExerciseConfirmationVisible(true);
      }
    } finally {
      frameInFlightRef.current = false;
    }
  };

  const startFrameLoop = (activePoseSessionId: string | null) => {
    stopFrameLoop();
    if (!activePoseSessionId) return;
    if (!isWebPoseRuntime) {
      setPoseStatusOverride(
        "Native landmark stream is armed. Move through 2-3 clean reps so auto detection can lock the exercise.",
      );
      return;
    }
    const intervalMs = Math.max(
      120,
      Math.round(1000 / Math.max(acceptedFps ?? 8, 1)),
    );
    frameIntervalRef.current = setInterval(() => {
      void captureAndAnalyzeFrame(activePoseSessionId);
    }, intervalMs);
  };

  const handleConfirmExerciseLabel = (label: string) => {
    const nextLabel = label.trim();
    if (!nextLabel) {
      showMessage("Choose or name the exercise so rep tracking can resume.");
      return;
    }

    const previousLabel = confirmedExerciseLabelRef.current;
    if (
      previousLabel !== nextLabel ||
      !isWeightedEquipmentContext(inferExerciseEquipmentContext(nextLabel))
    ) {
      resetWorkoutLoadInput();
    }
    confirmedExerciseLabelRef.current = nextLabel;
    setConfirmedExerciseLabel(nextLabel);
    setDetectedExerciseName(nextLabel);
    resetEquipmentDetectionState();
    setCustomExerciseLabel("");
    setIsExerciseConfirmationVisible(false);
    if (!isWebPoseRuntime) {
      analyzeErrorMessageRef.current = null;
      const fallbackContract = armFallbackMovementContract(
        nextLabel,
        currentKeypoints,
        `Native landmark rep counting is armed for ${toDisplayExerciseName(nextLabel)}.`,
      );
      if (!fallbackContract) {
        movementContractRef.current = null;
        setMovementContract(null);
        setCurrentAngle(null);
        setCurrentPhase("primed");
        framesSinceAnalyzeRef.current = POSE_FRAME_BATCH_TRIGGER;
        setPoseFeedback([
          `${toDisplayExerciseName(nextLabel)} is locked for native auto detection.`,
          "Move through a few clean reps so FitTrack can infer the movement contract.",
          "Native landmark rep counting will start once a movement contract is detected.",
        ]);
        setPoseStatusOverride(
          `Tracking ${toDisplayExerciseName(nextLabel)} on the next native landmark batch.`,
        );
      }
      showMessage(`Exercise confirmed: ${toDisplayExerciseName(nextLabel)}.`);
      return;
    }
    const fallbackContract = armFallbackMovementContract(
      nextLabel,
      currentKeypoints,
      `Local rep counting is armed for ${toDisplayExerciseName(nextLabel)} at ${acceptedFps ?? 0} fps.`,
    );
    if (!fallbackContract) {
      movementContractRef.current = null;
      setMovementContract(null);
      setCurrentAngle(null);
      setCurrentPhase("primed");
      framesSinceAnalyzeRef.current = POSE_FRAME_BATCH_TRIGGER;
      setPoseStatusOverride(
        `Tracking ${toDisplayExerciseName(nextLabel)} on the next live batch.`,
      );
    }
    showMessage(`Exercise confirmed: ${toDisplayExerciseName(nextLabel)}.`);
  };

  const handleSelectExerciseReference = (label: string) => {
    handleConfirmExerciseLabel(label);
    if (!isWeightedEquipmentContext(inferExerciseEquipmentContext(label))) {
      setIsExerciseModalOpen(false);
    }
  };

  const handleUseAutoDetection = () => {
    confirmedExerciseLabelRef.current = null;
    setConfirmedExerciseLabel(null);
    setDetectedExerciseName(null);
    resetWorkoutLoadInput();
    resetEquipmentDetectionState();
    setCustomExerciseLabel("");
    movementContractRef.current = null;
    setMovementContract(null);
    setCurrentAngle(null);
    setCurrentPhase("primed");
    analyzeErrorMessageRef.current = null;
    framesSinceAnalyzeRef.current = POSE_FRAME_BATCH_TRIGGER;
    setPoseStatusOverride(
      isWebPoseRuntime
        ? "Auto detection will choose the next visible movement batch."
        : "Native auto detection will choose the next stable movement batch.",
    );
    setPoseFeedback(
      isWebPoseRuntime
        ? [
            "Auto detection is active again.",
            "If the exercise label drifts, tap Exercise References and lock the preset manually.",
            "Choose Push-Up manually anytime if you want the counter pinned to push-ups.",
          ]
        : NATIVE_POSE_FEEDBACK,
    );
    setIsExerciseModalOpen(false);
    showMessage("Auto detection resumed.");
  };

  const handleCloseExerciseConfirmation = () => {
    setIsExerciseConfirmationVisible(false);
    setPoseStatusOverride(
      isWebPoseRuntime
        ? "Rep tracking stays paused until the exercise is confirmed."
        : "Native analysis stays limited until the exercise is confirmed.",
    );
    showMessage(
      isWebPoseRuntime
        ? "Rep tracking is paused until the exercise is confirmed."
        : "Native exercise analysis is limited until the exercise is confirmed.",
    );
  };

  const handleInitCamera = async () => {
    const initialized = await initCamera(isFrozen);
    if (!isFrozen && !initialized) {
      showMessage(
        "Camera permission is required before live tracking can start.",
      );
      return;
    }

    if (!initialized) return;

    try {
      await ensurePoseAnalyzerReady();
      showMessage(
        isWebPoseRuntime
          ? "Camera and pose model are ready for live workout tracking."
          : "Camera is ready. Native landmarks should appear before or during recording.",
      );
    } catch {
      cleanupCamera();
      showMessage("Camera opened, but the browser pose model could not load.");
    }
  };

  const ensureLiveWorkout = async () => {
    if (!(workoutSessionId ?? liveActiveSession?.id ?? null)) {
      const startedSession = await startWorkoutSessionMutation.mutateAsync({
        input: {
          ...(preferredPlan?.id ? { planId: preferredPlan.id } : {}),
        },
        userId: user?.id,
      });
      setWorkoutSessionId(startedSession.id);
    }

    let nextPoseSessionId = poseSessionId;
    if (!nextPoseSessionId && cameraActive && permissionGranted) {
      const startedPose = await startPoseSessionMutation.mutateAsync({
        input: {
          ...(suggestedExerciseHint
            ? { exerciseHint: suggestedExerciseHint }
            : {}),
        },
      });
      nextPoseSessionId = startedPose.poseSessionId;
      setPoseSessionId(startedPose.poseSessionId);
      setAcceptedFps(startedPose.acceptedFps);
    }

    return nextPoseSessionId;
  };

  const handleStartRecord = async () => {
    if (isFrozen || countdownValue !== null) return;
    if (trackingDisabledReason) {
      showMessage(trackingDisabledReason);
      return;
    }
    if (!cameraActive || !permissionGranted) {
      showMessage("Initialize the camera before starting live tracking.");
      return;
    }

    try {
      await ensurePoseAnalyzerReady();
      const livePoseSessionId = await ensureLiveWorkout();
      resetPoseTrackingBuffers();
      resetPoseRuntimeState(true);
      resetEquipmentDetectionState();
      setPoseFeedback([]);
      setIsRecording(true);
      setIsExerciseConfirmationVisible(false);
      start();
      startFrameLoop(livePoseSessionId);
      showMessage("Live workout started.");
    } catch {
      showMessage("Failed to start live workout.");
    }
  };

  const handleResumeRecord = async () => {
    if (isFrozen || countdownValue !== null) return;
    if (trackingDisabledReason) {
      showMessage(trackingDisabledReason);
      return;
    }
    if (!cameraActive || !permissionGranted) {
      showMessage("Initialize the camera before resuming live tracking.");
      return;
    }

    try {
      await ensurePoseAnalyzerReady();
      const livePoseSessionId = await ensureLiveWorkout();
      resetPoseTrackingBuffers();
      setIsRecording(true);
      resume();
      startFrameLoop(livePoseSessionId);
      showMessage("Workout resumed.");
    } catch {
      showMessage("Failed to resume workout.");
    }
  };

  const handlePause = () => {
    setIsRecording(false);
    stopFrameLoop();
    resetPoseTrackingBuffers();
    pause();
  };

  const handleStopRecord = () => {
    handlePause();
    setFinishVisible(true);
  };

  const handleFinishConfirm = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    stopFrameLoop();
    resetPoseTrackingBuffers();

    try {
      let finalizedReps = reps;
      let finalizedLoadInputKg: number | null = null;
      let finalizedDetectedExerciseName =
        detectedExerciseName ?? confirmedExerciseLabelRef.current ?? null;
      if (poseSessionId) {
        const finalizedEquipmentContextLabel =
          finalizedDetectedExerciseName ??
          confirmedExerciseLabelRef.current ??
          suggestedExerciseHint;
        const finalizedDeclaredEquipmentContext = inferExerciseEquipmentContext(
          finalizedEquipmentContextLabel,
        );
        finalizedLoadInputKg = isWeightedEquipmentContext(
          finalizedDeclaredEquipmentContext,
        )
          ? workoutLoadKgRef.current
          : null;
        const finalizedRequiresEquipmentSnapshot =
          requiresVisualEquipmentContext(finalizedDeclaredEquipmentContext);
        const finalizedProviderEquipmentFresh =
          providerEquipmentDetectedAtMs !== null &&
          Date.now() - providerEquipmentDetectedAtMs <=
            EQUIPMENT_CONTEXT_FRESH_MS;
        const finalizedProviderEquipmentHasPositiveContext =
          providerEquipmentContext !== null &&
          providerEquipmentContext !== "unknown";
        const finalizedUseProviderEquipmentResolution =
          finalizedRequiresEquipmentSnapshot &&
          equipmentProviderEnabled === true &&
          finalizedProviderEquipmentFresh &&
          finalizedProviderEquipmentHasPositiveContext;
        const finalizedUseDeclaredEquipmentFallback =
          finalizedRequiresEquipmentSnapshot &&
          finalizedDeclaredEquipmentContext !== null &&
          WEIGHTED_EQUIPMENT_CONTEXTS.has(finalizedDeclaredEquipmentContext) &&
          isExplicitWeightedExerciseLabel(finalizedEquipmentContextLabel) &&
          !finalizedUseProviderEquipmentResolution &&
          equipmentProviderEnabled === false;
        const finalizedResolvedEquipmentContext =
          finalizedRequiresEquipmentSnapshot
            ? finalizedUseProviderEquipmentResolution
              ? providerEquipmentContext
              : finalizedUseDeclaredEquipmentFallback
                ? finalizedDeclaredEquipmentContext
                : null
            : finalizedDeclaredEquipmentContext;
        const finalizedResolvedEquipmentSource =
          finalizedRequiresEquipmentSnapshot
            ? finalizedUseProviderEquipmentResolution
              ? (providerEquipmentSource ?? undefined)
              : finalizedUseDeclaredEquipmentFallback
                ? toEquipmentSource(
                    confirmedExerciseLabelRef.current !== null,
                    finalizedDeclaredEquipmentContext,
                  )
                : undefined
            : toEquipmentSource(
                confirmedExerciseLabelRef.current !== null,
                finalizedDeclaredEquipmentContext,
              );
        const finalizedResolvedEquipmentConfidence =
          finalizedRequiresEquipmentSnapshot
            ? finalizedUseProviderEquipmentResolution
              ? (providerEquipmentConfidence ?? undefined)
              : finalizedUseDeclaredEquipmentFallback
                ? 0.58
                : undefined
            : finalizedDeclaredEquipmentContext
              ? 0.7
              : undefined;
        const finalizedResolvedEquipmentConflicts =
          finalizedUseProviderEquipmentResolution
            ? providerEquipmentConflicts
            : finalizedUseDeclaredEquipmentFallback
              ? ["equipment_provider_missed_selected_weighted_exercise"]
              : finalizedRequiresEquipmentSnapshot &&
                  equipmentProviderEnabled === false
                ? ["equipment_provider_unavailable"]
                : [];
        const finalizedPose = await finalizePoseSessionMutation.mutateAsync({
          poseSessionId,
          input: {
            averageConfidence: averageConfidenceRef.current,
            detectedExerciseName: finalizedDetectedExerciseName,
            endedReason: "session_completed",
            equipmentConfidence: finalizedResolvedEquipmentConfidence,
            equipmentConflicts: finalizedResolvedEquipmentConflicts,
            equipmentContext: finalizedResolvedEquipmentContext,
            equipmentSource: finalizedResolvedEquipmentSource,
            finalRepCount: isWebPoseRuntime
              ? repEngineStateRef.current.repCount
              : liveRepCountRef.current,
            formFeedback: poseFeedback,
            movementContract: movementContractRef.current,
            rawAngleData: repEngineStateRef.current.rawAngleData,
            weightInputKg: finalizedLoadInputKg,
          },
        });
        finalizedReps = finalizedPose.repCountAi;
        setTrackedReps(finalizedPose.repCountAi);
        finalizedDetectedExerciseName =
          finalizedPose.detectedExerciseName ??
          detectedExerciseName ??
          confirmedExerciseLabelRef.current ??
          null;
        if (finalizedPose.detectedExerciseName) {
          setDetectedExerciseName(finalizedPose.detectedExerciseName);
        }
        const feedback = Array.isArray(
          finalizedPose.analysisSummary?.form_feedback,
        )
          ? finalizedPose.analysisSummary.form_feedback.filter(
              (entry): entry is string => typeof entry === "string",
            )
          : [];
        if (feedback.length > 0) {
          setPoseFeedback(feedback.slice(0, 3));
        }
      }

      const activeWorkoutId = workoutSessionId ?? liveActiveSession?.id ?? null;
      const finalizedTrackingLabel =
        confirmedExerciseLabelRef.current ??
        movementContractRef.current?.exercise ??
        finalizedDetectedExerciseName ??
        detectedExerciseName ??
        null;
      const detectedExerciseMatch =
        findExerciseByDetectedName(
          exercisesResponse.data,
          finalizedTrackingLabel,
        ) ??
        findExerciseByDetectedName(
          exercisesResponse.data,
          finalizedDetectedExerciseName,
        ) ??
        findExerciseByDetectedName(
          exercisesResponse.data,
          confirmedExerciseLabelRef.current,
        );
      const loggedExercise = detectedExerciseMatch ?? selectedExercise;
      if (activeWorkoutId && loggedExercise) {
        const loggedExerciseContext = inferExerciseEquipmentContext(
          finalizedTrackingLabel ?? loggedExercise.label,
        );
        const loggedWeightKg = isWeightedEquipmentContext(loggedExerciseContext)
          ? workoutLoadKgRef.current
          : null;
        await logWorkoutSetMutation.mutateAsync({
          sessionId: activeWorkoutId,
          userId: user?.id,
          input: {
            durationSeconds: secondsRef.current,
            exerciseId: loggedExercise.exerciseId,
            ...(poseSessionId ? { poseSessionId } : {}),
            ...(finalizedReps > 0 ? { repsCompleted: finalizedReps } : {}),
            ...(loggedWeightKg !== null ? { weightKg: loggedWeightKg } : {}),
            setNumber: 1,
          },
        });
      }

      if (activeWorkoutId) {
        await completeWorkoutSessionMutation.mutateAsync({
          sessionId: activeWorkoutId,
          userId: user?.id,
        });
      }

      await refetchSessions();
      setFinishVisible(false);
      cleanupCamera();
      cleanupTimer();
      reset();
      setIsRecording(false);
      setWorkoutSessionId(null);
      setPoseSessionId(null);
      setAcceptedFps(null);
      setDetectedExerciseName(null);
      setConfirmedExerciseLabel(null);
      resetWorkoutLoadInput();
      resetEquipmentDetectionState();
      confirmedExerciseLabelRef.current = null;
      setCustomExerciseLabel("");
      setExerciseConfirmationCandidates([]);
      setIsExerciseConfirmationVisible(false);
      setExerciseCreationDraft(null);
      setIsExerciseCreationReviewOpen(false);
      setPoseStatusOverride(null);
      resetPoseRuntimeState(true);
      setSubjectLockState(false, null, "reset");
      disposePoseAnalyzer();
      showMessage(
        loggedExercise
          ? "Workout saved to the live fitness stack."
          : "Workout session closed, but no exercise reference was available for set logging.",
      );
    } catch {
      showMessage("Failed to finish live workout.");
    } finally {
      setIsFinishing(false);
    }
  };

  const handleFinishCancel = () => {
    if (isFinishing) return;
    setFinishVisible(false);
    void handleResumeRecord();
  };

  useEffect(() => {
    return () => {
      if (cameraSwitchTimerRef.current) {
        clearTimeout(cameraSwitchTimerRef.current);
        cameraSwitchTimerRef.current = null;
      }
      stopFrameLoop();
      resetPoseTrackingBuffers();
      resetPoseRuntimeState(true);
      disposePoseAnalyzer();
      cleanupTimer();
      cleanupCamera();
    };
  }, [cleanupCamera, cleanupTimer]);

  return {
    base,
    cameraActive,
    cameraFacing,
    cameraRemountKey,
    cameraRef,
    calories,
    colors: colors as IThemeContext["colors"],
    countdownValue,
    currentAngle,
    currentKeypoints,
    currentPhase,
    currentPlanExerciseLabel: currentPlanExercise?.exerciseName ?? null,
    customExerciseLabel,
    exerciseConfirmationCandidates,
    exerciseCreationDraft,
    exerciseCreationReady,
    exerciseFocusText: trackingExerciseLabel
      ? `Tracking: ${toDisplayExerciseName(trackingExerciseLabel)}${trackingExerciseReference ? ` - ${trackingExerciseReference.muscleGroup}` : ""}`
      : currentPlanExercise?.exerciseName
        ? `Plan suggests: ${toDisplayExerciseName(currentPlanExercise.exerciseName)}${planExerciseReference ? ` - ${planExerciseReference.muscleGroup}` : ""}`
        : exercisesLoading
          ? "Loading live exercise library..."
          : "Auto detection is active. Lock a preset if you want to force a specific exercise.",
    exerciseModalEmptyMessage:
      selectedExercise || exercisesLoading
        ? "No exercises match your search."
        : "The live exercise catalog is empty on this stack. Seed the workout catalog before expecting tracked sets and EXP sync.",
    exerciseRecommendation:
      trackingExerciseReference?.recommendation ??
      planExerciseReference?.recommendation ??
      selectedExercise?.recommendation ??
      (exercisesLoading
        ? "Loading live exercise guidance..."
        : "Exercise references are empty, so tracked set logging and EXP sync stay blocked until the workout catalog is seeded."),
    exerciseReferences,
    exercisesLoading,
    equipmentSnapshotActive,
    equipmentDetectionBoxes:
      shouldUseProviderEquipmentResolution &&
      providerEquipmentContext === "dumbbell"
        ? providerEquipmentDetections
        : [],
    equipmentDetectionStatusText: shouldUseProviderEquipmentResolution
      ? `${toDisplayExerciseName(providerEquipmentContext ?? "load")} detected${
          typeof providerEquipmentConfidence === "number"
            ? ` ${Math.round(providerEquipmentConfidence * 100)}%`
            : ""
        }`
      : declaredExerciseEquipmentContext === "dumbbell"
        ? "Dumbbell declared"
        : declaredExerciseEquipmentContext &&
            WEIGHTED_EQUIPMENT_CONTEXTS.has(declaredExerciseEquipmentContext)
          ? `${toDisplayExerciseName(declaredExerciseEquipmentContext)} declared`
          : null,
    equipmentDetected:
      (shouldUseProviderEquipmentResolution &&
        providerEquipmentContext === "dumbbell"),
    feedbackItems:
      poseFeedback.length > 0
        ? poseFeedback
        : isWebPoseRuntime
          ? DEFAULT_POSE_FEEDBACK
          : NATIVE_POSE_FEEDBACK,
    finishVisible,
    isExerciseConfirmationVisible,
    isExerciseCreationReviewOpen,
    isExerciseCreationSubmitting:
      createExerciseReviewSubmissionMutation.isPending ||
      createExerciseDraftProposalMutation.isPending,
    isExerciseModalOpen,
    isFinishing,
    isFrozen,
    isCameraSwitching,
    isPoseModelLoading,
    isRecording,
    message,
    movementContract,
    lowConfidenceLandmarks,
    onChangeCustomExerciseLabel: setCustomExerciseLabel,
    onCloseExerciseConfirmation: handleCloseExerciseConfirmation,
    onCloseExerciseCreationReview: () =>
      setIsExerciseCreationReviewOpen(false),
    onCloseExerciseModal: () => setIsExerciseModalOpen(false),
    onConfirmExerciseLabel: handleConfirmExerciseLabel,
    onFinishCancel: handleFinishCancel,
    onFinishConfirm: handleFinishConfirm,
    onInitCamera: handleInitCamera,
    onNativeEquipmentSnapshot: handleNativeEquipmentSnapshot,
    onNativePoseFrame: handleNativePoseFrame,
    onOpenExerciseModal: () => {
      if (typeof document !== "undefined") {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(() => setIsExerciseModalOpen(true));
        return;
      }
      setIsExerciseModalOpen(true);
    },
    onOpenExerciseCreationReview: handleOpenExerciseCreationReview,
    onPause: handlePause,
    onResumeRecord: handleResumeRecord,
    onSelectExerciseReference: handleSelectExerciseReference,
    onStartRecord: handleStartRecord,
    onStopRecord: handleStopRecord,
    onToggleCameraFacing: handleToggleCameraFacing,
    onToggleSubjectLock: handleToggleSubjectLock,
    onUpdateExerciseCreationDraft: setExerciseCreationDraft,
    onSubmitExerciseCreationDraft: handleSubmitExerciseCreationDraft,
    onUseAutoDetection: handleUseAutoDetection,
    onApplyWorkoutLoadInput: handleApplyWorkoutLoadInput,
    onChangeWorkoutLoadInputUnit: handleChangeWorkoutLoadInputUnit,
    onChangeWorkoutLoadInputValue: handleChangeWorkoutLoadInputValue,
    onChangeWorkoutLoadSliderValue: handleChangeWorkoutLoadSliderValue,
    onClearWorkoutLoadInput: handleClearWorkoutLoadInput,
    opacity,
    permissionGranted,
    isTrackingReady: !trackingDisabledReason && !isPoseModelLoading,
    planStatusText: plansLoading
      ? "Loading live plan..."
      : preferredPlan
        ? preferredPlan.title
        : selectedExercise
          ? "No live training plan yet. Manual tracking can still use the shared exercise catalog."
          : "No live training plan or exercise catalog is loaded on this stack yet.",
    selectedTrackingExerciseLabel: confirmedExerciseLabel,
    workoutLoadInputError,
    workoutLoadInputSavedLabel,
    workoutLoadInputUnit,
    workoutLoadInputValue,
    workoutLoadInputVisible,
    workoutLoadSliderMax,
    workoutLoadSliderMin,
    workoutLoadSliderValue,
    poseStatusText: poseStatusOverride
      ? poseStatusOverride
      : poseSessionId
        ? isWebPoseRuntime
          ? movementContract
            ? `Local rep counting is active for ${toDisplayExerciseName(movementContract.exercise)} at ${acceptedFps ?? 0} fps.`
            : confirmedExerciseLabel
              ? `Pose tracking is live for ${toDisplayExerciseName(confirmedExerciseLabel)} at ${acceptedFps ?? 0} fps.`
              : `Pose tracking is live at ${acceptedFps ?? 0} fps.`
          : nativeLandmarksActive
            ? trackingExerciseLabel
              ? `Native landmark rep tracking is live for ${toDisplayExerciseName(trackingExerciseLabel)} at ${acceptedFps ?? 0} fps.`
              : `Native landmark rep tracking is live at ${acceptedFps ?? 0} fps.`
            : trackingExerciseLabel
              ? `Native landmark analysis is live for ${toDisplayExerciseName(trackingExerciseLabel)} at ${acceptedFps ?? 0} fps.`
              : `Native landmark analysis is live at ${acceptedFps ?? 0} fps.`
        : trackingDisabledReason
          ? trackingDisabledReason
          : !permissionGranted
            ? "Camera permission is required for pose tracking."
            : cameraActive
              ? isWebPoseRuntime
                ? "Pose session will start with the next recording pass."
                : "Native landmarks will arm the next recording pass."
              : "Initialize the camera to unlock the live pose path.",
    reps,
    s,
    savedExerciseOptions,
    seconds,
    sessionStatusText:
      liveActiveSession || workoutSessionId
        ? `Workout session ${workoutSessionId ?? liveActiveSession?.id ?? ""} is ready.`
        : "No in-progress workout session yet.",
    subjectLockConfidence,
    subjectLockGestureProgress,
    subjectLockReady: isSubjectLockBodyRigVisible(currentKeypoints),
    subjectLockStatusText,
    subjectLocked,
    trackingOverlayLabel: trackingExerciseLabel,
    trackingDisabledReason,
    translateY,
  };
}
