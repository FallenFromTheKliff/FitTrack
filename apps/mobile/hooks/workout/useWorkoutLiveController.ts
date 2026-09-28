import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraView, type CameraType } from "expo-camera";
import { ApiClientError } from "@fittrack/api-client";

import type {
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMovementContractIdentityRecord,
  ExerciseMuscleTargetRecord,
  FitnessExerciseRecord,
  IThemeContext,
  PoseEquipmentContext,
  PoseEquipmentSource,
  PoseKeypointRecord,
  PoseMovementContractRecord,
  PoseSequenceFrameRecord,
  PoseSequenceSignalsRecord,
  PoseSessionQualityState,
  PlannedPoseTrackingSnapshot,
} from "@fittrack/types";
import type { ExerciseReference } from "@/data/exercises";
import type {
  NativePoseFrame,
  NativePoseObservation,
} from "@/components/workout/NativeVisionPoseCamera.types";
import type {
  FitTrackMultiPoseError,
  FitTrackMultiPoseSessionStatus,
} from "@/modules/fittrack-multi-pose/src";
import type { WorkoutCameraTarget } from "@/components/workout/workout-camera-target";
import { applyPlannedTrackingSnapshotToTarget } from "@/components/workout/workout-camera-target";
import {
  buildFallbackPoseMovementContract,
  isValidPoseMovementContract,
  normalizeExerciseMovementProfile,
  createPoseSignalCache,
  getPoseMovementFrameAssessment,
  getPoseMovementContractAngle,
  getPoseFrameContractAngle,
  getRigMovementContract,
  getPoseRepAcceptancePolicy,
  createPoseDiagnostics,
  summarizeMovementGuidance,
  normalizeExerciseAlias,
  normalizeExerciseHandShapeProfile,
  advancePoseSubjectTracker,
  createPoseSubjectTrackerState,
  resetPoseSubjectTrackerState,
  resolveExerciseTracking,
  POSE_REP_MAX_FRAME_GAP_MS,
  type PoseSubjectCandidate,
} from "@fittrack/utils";
import type { CameraRotation, PoseCoordinateDimensions } from "@fittrack/utils";
import type { PoseRepEngineEvidence, PoseRepEngineState } from "@fittrack/utils/pose-rep-engine";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useWorkoutTimer } from "@/hooks/workout/useWorkoutTimer";
import { useCameraCountdown } from "@/hooks/workout/useCameraCountdown";
import {
  analyzePoseSessionMutationOptions,
  completeWorkoutSessionMutationOptions,
  fitnessExercisesQueryOptions,
  fitnessExerciseQueryOptions,
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
  advanceSubjectLockFrame,
  createSubjectLockState,
  invalidateSubjectLockState,
  isCurrentSubjectLockObservation,
  manuallyLockSubject,
  manuallyUnlockSubject,
  stabilizeNativePoseFrame as stabilizeNativePoseFramePure,
  type SubjectLockState,
} from "@/lib/workout/subjectLock";
import {
  createPoseRepEngineState,
  stepPoseStaticHold,
  stepPoseRepEngine,
} from "@/lib/workout/poseRepEngine";
import {
  hasMovementContractIdentityChanged,
  matchesPlannedTrackingSnapshot,
  mergeLatestWorkoutExercise,
  movementContractIdentityKey,
  refreshLatestWorkoutExercises,
  resolveWorkoutExerciseContract,
} from "@/lib/workout/exerciseContractResolver";

import { getWorkoutAutoFinishEvaluation } from "@/lib/workout/workoutAutoFinish";
type SelectedExercise = {
  exerciseId: string;
  handShapeProfile: ExerciseHandShapeProfileRecord | null;
  label: string;
  movementProfile: ExerciseMovementProfileRecord | null;
  movementContractIdentity: ExerciseMovementContractIdentityRecord | null;
  muscleGroup: string;
  muscleTargets: ExerciseMuscleTargetRecord[];
  recommendation: string;
};

type LiveExerciseRecord = FitnessExerciseRecord;

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

type WorkoutLiveControllerOptions = {
  cameraTarget?: WorkoutCameraTarget | null;
  onCameraSetCompleted?: (target: WorkoutCameraTarget) => void;
};

export type WorkoutCameraRuntimeState =
  | "tracking"
  | "saving"
  | "rest"
  | "ready"
  | "complete";

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
const POSE_FRAME_BATCH_TRIGGER = 4;
const POSE_MIN_ANALYZE_FRAMES = 20;
const TRACKING_UNRELIABLE_MESSAGE =
  "Pose tracking is waiting for a reliable movement window. Keep shoulders, hips, and at least one full arm chain visible to resume live counting.";
const SUBJECT_LOCK_VISIBILITY_THRESHOLD = 0.4;
const CAMERA_SWITCH_REMOUNT_MS = 350;
const NATIVE_MIN_RELIABLE_LANDMARKS = 12;
const NATIVE_MIN_AVERAGE_VISIBILITY = 0.36;
const POSE_VISUAL_TARGET_FPS = 9;
const POSE_SIGNAL_TARGET_FPS = 10;
const POSE_VISUAL_UPDATE_INTERVAL_MS = Math.round(1000 / POSE_VISUAL_TARGET_FPS);
const POSE_SIGNAL_UPDATE_INTERVAL_MS = Math.round(1000 / POSE_SIGNAL_TARGET_FPS);
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

function getPoseCoordinateDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
): PoseCoordinateDimensions | undefined {
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return undefined;
  }

  return { height, width };
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
    case "invalid_contract":
      return "saved movement contract";
    case "phase_acceptance_bands_overlap":
    case "phase_acceptance_bands_too_close":
      return "separated threshold bands";
    case "phase_order_unsupported":
    case "phase_order_invalid":
      return "supported phase order";
    case "evidence_insufficient":
      return "movement evidence";
    case "tracking_confidence_below_contract":
      return "tracking confidence";
    case "required_landmarks_unreliable":
      return "required landmarks";
    case "tracking_landmark_count_below_contract":
      return "required landmark count";
    case "pose_keypoints_missing":
      return "pose landmarks";
    case "tracking_requirements_invalid":
      return "tracking requirements";
    default:
      return (reason ?? "tracking evidence").replace(/_/g, " ");
  }
}

function buildPoseNoCountStatusText(
  reason: string,
) {
  if (reason === "rep_cooldown_active") {
    return "Ignoring jitter between reps. Reset to the start position before the next count.";
  }

  if (reason === "equipment_required") {
    return "Select or confirm the weighted exercise before counting.";
  }

  return `Waiting for clean ${toPoseNoCountEvidenceLabel(reason)} evidence before counting.`;
}

function buildPlannedRepPhaseStatusText(
  contract: PoseMovementContractRecord,
  phase: string,
  repCompleted = false,
) {
  const startAngle = Math.round(contract.repThresholds.up.angle);
  const peakAngle = Math.round(contract.repThresholds.down.angle);
  if (repCompleted) {
    return `Rep complete — reset to ${startAngle}° to arm the next rep.`;
  }
  if (phase === "down") {
    return `Counter armed — move to ${peakAngle}° peak.`;
  }
  if (phase === "up") {
    return `Return to ${startAngle}° to reset.`;
  }
  return `Extend to ${startAngle}° to arm.`;
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
      movementContractIdentity:
        matchingExercise?.movementContractIdentity ?? null,
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
    movementContractIdentity: firstExercise.movementContractIdentity,
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

function toDisplayExerciseName(value: string | null | undefined) {
  return normalizeExerciseAlias(value).replace(/\b\w/g, (char) =>
    char.toUpperCase(),
  );
}

function inferExerciseEquipmentContext(
  label: string | null | undefined,
): PoseEquipmentContext | null {
  const normalized = normalizeExerciseAlias(label);
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

function toEquipmentSource(
  isConfirmedByMember: boolean,
  context: PoseEquipmentContext | null,
): PoseEquipmentSource | undefined {
  if (!context) return undefined;
  return isConfirmedByMember ? "member" : "catalog";
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
    const normalizedName = normalizeExerciseAlias(reference.name);
    if (!normalizedName || merged.has(normalizedName)) continue;
    merged.set(normalizedName, reference);
  }

  return Array.from(merged.values());
}

function findExerciseByDetectedName(
  exercises: LiveExerciseRecord[],
  detectedName: string | null | undefined,
): SelectedExercise | null {
  const matchedExercise = resolveWorkoutExerciseContract({
    exercises,
    label: detectedName,
  })?.exercise ?? null;
  if (!matchedExercise) return null;
  return {
    exerciseId: matchedExercise.id,
    handShapeProfile: matchedExercise.handShapeProfile,
    label: matchedExercise.name,
    movementProfile: matchedExercise.movementProfile,
    movementContractIdentity: matchedExercise.movementContractIdentity,
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
  const normalized = normalizeExerciseAlias(exerciseName);
  if (!normalized) return null;
  return references.find(
    (reference) => normalizeExerciseAlias(reference.name) === normalized,
  ) ?? null;
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
    const normalizedName = normalizeExerciseAlias(reference.name);
    if (!normalizedName || seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    options.push(reference.name.trim());
  }

  return options;
}

export function useWorkoutLiveController(
  options: WorkoutLiveControllerOptions = {},
) {
  const { cameraTarget: requestedCameraTarget = null, onCameraSetCompleted } = options;
  const { user } = useAuth();
  const { colors } = useTheme();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const queryClient = useQueryClient();
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeWorkoutStyles(colors), [colors]);
  const { message, showMessage } = useTimedMessage(2500);

  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [isExerciseConfirmationVisible, setIsExerciseConfirmationVisible] =
    useState(false);
  const [exerciseConfirmationCandidates, setExerciseConfirmationCandidates] =
    useState<string[]>([]);
  const [customExerciseLabel, setCustomExerciseLabel] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [cameraRuntimeState, setCameraRuntimeState] =
    useState<WorkoutCameraRuntimeState>("ready");
  const [finishVisible, setFinishVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [autoFinishWarningSeconds, setAutoFinishWarningSeconds] = useState<
    number | null
  >(null);
  const [isPoseModelLoading, setIsPoseModelLoading] = useState(false);
  const [reps, setReps] = useState(0);
  const [currentKeypoints, setCurrentKeypoints] = useState<
    PoseKeypointRecord[] | null
  >(null);
  const [currentAngle, setCurrentAngle] = useState<number | null>(null);
  const [currentPhase, setCurrentPhase] = useState("primed");
  const [repPathUnblocked, setRepPathUnblocked] = useState(false);
  const [holdProgressSeconds, setHoldProgressSeconds] = useState(0);
  const [holdValid, setHoldValid] = useState(false);
  const [movementContract, setMovementContract] =
    useState<PoseMovementContractRecord | null>(null);
  const [lowConfidenceLandmarks, setLowConfidenceLandmarks] = useState<
    string[]
  >([]);
  const [poseFeedback, setPoseFeedback] = useState<string[]>([]);
  const [workoutSessionId, setWorkoutSessionId] = useState<string | null>(null);
  const [poseSessionId, setPoseSessionId] = useState<string | null>(null);
  const [activeSetSnapshot, setActiveSetSnapshot] = useState<PlannedPoseTrackingSnapshot | null>(null);
  const cameraTarget = useMemo(() => applyPlannedTrackingSnapshotToTarget(requestedCameraTarget, activeSetSnapshot), [requestedCameraTarget, activeSetSnapshot]);
  const activeSetSnapshotRef = useRef<PlannedPoseTrackingSnapshot | null>(null);
  const startingSetRef = useRef(false);
  const currentTargetKeyRef = useRef<string | null>(null);
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
  const isWebPoseRuntime = Platform.OS === "web";
  const [poseStatusOverride, setPoseStatusOverride] = useState<string | null>(
    null,
  );
  const [subjectLocked, setSubjectLocked] = useState(false);
  const [subjectLockRetained, setSubjectLockRetained] = useState(false);
  const [subjectLockConfidence, setSubjectLockConfidence] = useState<
    number | null
  >(null);
  const [subjectLockGestureProgress, setSubjectLockGestureProgress] =
    useState(0);
  const [subjectLockReady, setSubjectLockReady] = useState(false);
  const [subjectLockStatusText, setSubjectLockStatusText] = useState(
    "Ready. Keep one clear body fully visible to start counting.",
  );
  const [subjectTrackingEnabled, setSubjectTrackingEnabled] = useState(false);
  const [nativeMultiPoseAvailable, setNativeMultiPoseAvailable] = useState<
    boolean | null
  >(isWebPoseRuntime ? true : null);
  const [nativeMultiPoseStatus, setNativeMultiPoseStatus] =
    useState<FitTrackMultiPoseSessionStatus>(
      isWebPoseRuntime ? "ready" : "off",
    );
  const [nativeMultiPoseError, setNativeMultiPoseError] =
    useState<FitTrackMultiPoseError | null>(null);
  const isFrozen = user?.status === "frozen";
  const [cameraFacing, setCameraFacing] = useState<CameraType>(
    isWebPoseRuntime ? "front" : "back",
  );
  const [cameraRemountKey, setCameraRemountKey] = useState(0);
  const [nativeStreamGeneration, setNativeStreamGeneration] = useState(0);
  const [isCameraSwitching, setIsCameraSwitching] = useState(false);
  const [cameraFrameSize, setCameraFrameSize] = useState<{
    height: number;
    mirrorX: boolean;
    rotation: CameraRotation;
    width: number;
  } | null>(null);

  const cameraRef = useRef<CameraView | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const frameInFlightRef = useRef(false);
  const poseReadInFlightRef = useRef(false);
  const poseAnalysisRequestIdRef = useRef(0);
  const countdownValueRef = useRef<number | null>(null);
  const isExerciseConfirmationVisibleRef = useRef(
    isExerciseConfirmationVisible,
  );
  const poseAnalyzerRef = useRef<BrowserPoseAnalyzer | null>(null);
  const poseAnalyzerPromiseRef = useRef<Promise<BrowserPoseAnalyzer> | null>(
    null,
  );
  const poseAnalyzerGenerationRef = useRef(0);
  const poseFrameBufferRef = useRef<PoseSequenceFrameRecord[]>([]);
  const poseSignalCacheRef = useRef(
    createPoseSignalCache(
      POSE_SIGNAL_UPDATE_INTERVAL_MS,
      POSE_MIN_ANALYZE_FRAMES,
    ),
  );
  const lastVisualPoseAtMsRef = useRef(0);
  const framesSinceAnalyzeRef = useRef(0);
  const trackingReliabilityNotifiedRef = useRef(false);
  const confirmedExerciseLabelRef = useRef<string | null>(null);
  const workoutLoadKgRef = useRef<number | null>(null);
  const movementContractRef = useRef<PoseMovementContractRecord | null>(null);
  const movementContractIdentityRef = useRef<string | null>(null);
  const poseSessionIdRef = useRef<string | null>(null);
  const isRecordingRef = useRef(false);
  const repEngineStateRef = useRef(createPoseRepEngineState());
  const poseDiagnosticsRef = useRef(createPoseDiagnostics(Platform.OS === "web" ? "mobile-web" : "mobile-native"));
  const liveRepCountRef = useRef(0);
  const holdProgressSecondsRef = useRef(0);
  const averageConfidenceRef = useRef<number | null>(null);
  const analyzeErrorMessageRef = useRef<string | null>(null);
  const stableNativePoseFrameRef = useRef<NativePoseFrame | null>(null);
  const subjectLockedRef = useRef(false);
  const subjectLockConfidenceRef = useRef<number | null>(null);
  const subjectLockStateRef = useRef<SubjectLockState>(
    createSubjectLockState(),
  );
  const latestRawSubjectCandidateRef = useRef<{
    capturedAtMs: number;
    keypoints: PoseKeypointRecord[];
  } | null>(null);
  const subjectLockDecisionRef = useRef<{
    canCount: boolean;
    capturedAtMs: number;
    candidateFresh: boolean;
  } | null>(null);
  const subjectTrackingEnabledRef = useRef(false);
  const subjectTrackerStateRef = useRef(createPoseSubjectTrackerState("off"));
  const selectedSubjectKeypointsRef = useRef<PoseKeypointRecord[] | null>(null);
  const activeHandShapeProfileRef = useRef<
    ExerciseHandShapeProfileRecord | null
  >(null);
  const subjectLockEpochRef = useRef(0);
  const nativeStreamIdRef = useRef(cameraRemountKey);
  const nativeStreamGenerationRef = useRef(0);
  const cameraContinuityActiveRef = useRef(true);
  const plannedMovementKeyRef = useRef<string | null>(null);
  const autoCompletionKeyRef = useRef<string | null>(null);
  const autoFinalizeSetRef = useRef<(() => void) | null>(null);
  const autoFinishClockRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const autoFinishLastActivityAtMsRef = useRef<number | null>(null);
  const autoFinishPausedRef = useRef(false);
  const autoFinishWarningSecondsRef = useRef<number | null>(null);
  const isCameraSwitchingRef = useRef(false);
  const isFinishingRef = useRef(false);
  const latestNativeFrameCapturedAtMsRef = useRef(0);
  const latestBrowserFrameCapturedAtMsRef = useRef(0);
  const poseRuntimeErrorNotifiedRef = useRef(false);
  const cameraRuntimeStateRef = useRef<WorkoutCameraRuntimeState>("ready");
  const completionLatchRef = useRef<{
    key: string;
    status: "idle" | "saving" | "saved";
  } | null>(null);

  const bumpNativeStreamGeneration = useCallback(() => {
    const nextGeneration = nativeStreamGenerationRef.current + 1;
    nativeStreamGenerationRef.current = nextGeneration;
    setNativeStreamGeneration(nextGeneration);
  }, []);

  const setAutoFinishWarning = useCallback((nextValue: number | null) => {
    if (autoFinishWarningSecondsRef.current === nextValue) return;
    autoFinishWarningSecondsRef.current = nextValue;
    setAutoFinishWarningSeconds(nextValue);
  }, []);

  const stopAutoFinishClock = useCallback(() => {
    if (autoFinishClockRef.current) {
      clearInterval(autoFinishClockRef.current);
      autoFinishClockRef.current = null;
    }
  }, []);

  const resetAutoFinishTiming = useCallback(() => {
    stopAutoFinishClock();
    autoFinishLastActivityAtMsRef.current = null;
    autoFinishPausedRef.current = false;
    setAutoFinishWarning(null);
  }, [setAutoFinishWarning, stopAutoFinishClock]);

  const pauseAutoFinishTiming = useCallback(() => {
    stopAutoFinishClock();
    autoFinishLastActivityAtMsRef.current = null;
    autoFinishPausedRef.current = true;
    setAutoFinishWarning(null);
  }, [setAutoFinishWarning, stopAutoFinishClock]);

  const beginAutoFinishTiming = useCallback(
    (activityAtMs: number) => {
      const targetReps = activeSetSnapshotRef.current?.targetReps ?? cameraTarget?.targetReps ?? 0;
      const isStaticHoldTarget =
        movementContractRef.current?.repModel === "static_hold";
      if (
        !cameraTarget ||
        isStaticHoldTarget ||
        targetReps <= 0 ||
        liveRepCountRef.current < targetReps
      ) {
        resetAutoFinishTiming();
        return;
      }

      autoFinishPausedRef.current = false;
      autoFinishLastActivityAtMsRef.current = Number.isFinite(activityAtMs)
        ? activityAtMs
        : Date.now();
      setAutoFinishWarning(null);
      if (autoFinishClockRef.current) return;

      autoFinishClockRef.current = setInterval(() => {
        const evaluation = getWorkoutAutoFinishEvaluation({
          isCameraSwitching: isCameraSwitchingRef.current,
          isConfirmationBlocking: isExerciseConfirmationVisibleRef.current,
          isRepInProgress: repEngineStateRef.current.phase !== "primed",
          isRecording: isRecordingRef.current,
          isRuntimeTracking:
            cameraRuntimeStateRef.current === "tracking" &&
            !autoFinishPausedRef.current,
          isStaticHold: movementContractRef.current?.repModel === "static_hold",
          isTrackingReliable: !autoFinishPausedRef.current,
          lastActivityAtMs: autoFinishLastActivityAtMsRef.current,
          nowMs: Date.now(),
          repCount: liveRepCountRef.current,
          targetReps: activeSetSnapshotRef.current?.targetReps ?? cameraTarget.targetReps,
        });

        if (evaluation.status === "complete") {
          stopAutoFinishClock();
          setAutoFinishWarning(null);
          autoFinalizeSetRef.current?.();
          return;
        }

        if (evaluation.status === "ineligible") {
          stopAutoFinishClock();
          setAutoFinishWarning(null);
          return;
        }

        setAutoFinishWarning(
          evaluation.status === "warning" ? evaluation.warningSeconds : null,
        );
      }, 1000);
    },
    [cameraTarget, resetAutoFinishTiming, setAutoFinishWarning, stopAutoFinishClock],
  );

  const getCameraTargetKey = (target: WorkoutCameraTarget | null) =>
    target
      ? `${target.sessionId}:${target.planExerciseId}:${target.exerciseId}:${target.setNumber}`
      : null;
  currentTargetKeyRef.current = getCameraTargetKey(cameraTarget);

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

  const getBufferedPoseSignals = (
    frames: PoseSequenceFrameRecord[],
    capturedAtMs: number,
    coordinateDimensions?: PoseCoordinateDimensions,
  ) => {
    return poseSignalCacheRef.current.getBuffered(
      frames,
      capturedAtMs,
      coordinateDimensions,
    );
  };

  const publishPoseVisual = (
    keypoints: PoseKeypointRecord[],
    capturedAtMs: number,
  ) => {
    if (
      !lastVisualPoseAtMsRef.current ||
      capturedAtMs - lastVisualPoseAtMsRef.current >=
        POSE_VISUAL_UPDATE_INTERVAL_MS
    ) {
      lastVisualPoseAtMsRef.current = capturedAtMs;
      setCurrentKeypoints(keypoints);
    }
  };

  const syncSubjectLockTransition = (
    transition: ReturnType<typeof advanceSubjectLockFrame>,
    sourceOverride?: "gesture" | "manual" | "reset",
  ) => {
    const nextState = transition.nextState;
    const subjectRetained = nextState.locked;
    const activelyLocked =
      subjectRetained && transition.status === "locked";
    subjectLockStateRef.current = nextState;
    subjectLockedRef.current = activelyLocked;
    subjectLockConfidenceRef.current = activelyLocked
      ? sourceOverride === "gesture"
        ? 0.92
        : sourceOverride === "manual"
          ? 0.9
          : subjectLockConfidenceRef.current ?? 0.9
      : null;
    setSubjectLocked(activelyLocked);
    setSubjectLockRetained(subjectRetained);
    setSubjectLockConfidence(subjectLockConfidenceRef.current);
    setSubjectLockGestureProgress(nextState.gestureProgress);
    setSubjectLockReady(transition.candidateFresh && transition.bodyVisible);

    if (nextState.requiresGestureRelease) {
      setSubjectLockStatusText(
        "Tracking paused. Keep one clear body visible to resume.",
      );
    } else if (transition.status === "interrupted") {
      setSubjectLockStatusText(
        "Tracking paused while FitTrack validates the same body track.",
      );
    } else if (activelyLocked) {
      setSubjectLockStatusText("Subject tracking is following the selected body.");
    } else if (transition.status === "holding") {
      setSubjectLockStatusText("Finding one clear subject...");
    } else if (transition.status === "lost") {
      setSubjectLockStatusText(
        "Tracking paused after the body was lost or changed. Restart subject tracking to resume.",
      );
    } else if (!transition.bodyVisible) {
      setSubjectLockStatusText(
        "Keep shoulders, hips, and one arm chain visible for tracking.",
      );
    } else {
      setSubjectLockStatusText("Ready. Keep one clear body fully visible to start counting.");
    }
  };

  const clearSubjectLockAnalysisBuffers = useCallback(() => {
    poseFrameBufferRef.current = [];
    framesSinceAnalyzeRef.current = 0;
    poseSignalCacheRef.current.reset();
    stableNativePoseFrameRef.current = null;
    lastVisualPoseAtMsRef.current = 0;
    setNativeLandmarksActive(false);
  }, []);

  const invalidateSubjectLock = useCallback((reason: string) => {
    bumpNativeStreamGeneration();
    subjectLockEpochRef.current += 1;
    subjectLockStateRef.current = invalidateSubjectLockState(
      subjectLockStateRef.current,
      activeHandShapeProfileRef.current,
    );
    subjectLockedRef.current = false;
    subjectLockConfidenceRef.current = null;
    latestRawSubjectCandidateRef.current = null;
    subjectLockDecisionRef.current = null;
    setSubjectLocked(false);
    setSubjectLockRetained(false);
    setSubjectLockConfidence(null);
    setSubjectLockGestureProgress(0);
    setSubjectLockReady(false);
    setSubjectLockStatusText(
      reason === "rest"
        ? "Rest paused the camera stream. Reacquire your body before the next set."
        : `Tracking paused because the camera ${reason}. Keep one clear body visible to resume.`,
    );
    clearSubjectLockAnalysisBuffers();
  }, [bumpNativeStreamGeneration, clearSubjectLockAnalysisBuffers]);

  const handleCameraContinuityChange = useCallback(
    (active: boolean) => {
      cameraContinuityActiveRef.current = active;
      if (active) return;
      invalidateSubjectLock("stream paused");
      pauseAutoFinishTiming();
      setPoseStatusOverride(
        "Camera stream paused. Reacquire your body before counting resumes.",
      );
    },
    [invalidateSubjectLock, pauseAutoFinishTiming],
  );

  const setCameraRuntime = useCallback(
    (nextState: WorkoutCameraRuntimeState) => {
      cameraRuntimeStateRef.current = nextState;
      if (nextState !== "tracking") {
        resetAutoFinishTiming();
      }
      if (nextState === "rest") {
        invalidateSubjectLock("rest");
      }
      setCameraRuntimeState(nextState);
    },
    [invalidateSubjectLock, resetAutoFinishTiming],
  );

  useEffect(() => {
    if (!isWebPoseRuntime || typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleCameraContinuityChange(false);
      } else {
        handleCameraContinuityChange(true);
      }
    };
    const handleWindowBlur = () => handleCameraContinuityChange(false);
    const handleWindowFocus = () => handleCameraContinuityChange(true);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [handleCameraContinuityChange, isWebPoseRuntime]);

  const setSubjectLockState = (
    locked: boolean,
    confidence: number | null,
    source: "auto" | "gesture" | "manual" | "reset",
    fingerprintKeypoints?: PoseKeypointRecord[] | null,
  ) => {
    if (!locked || source === "reset") {
      invalidateSubjectLock(source === "reset" ? "state reset" : "stopped");
      return;
    }
    const candidate = latestRawSubjectCandidateRef.current;
    const transition = manuallyLockSubject(subjectLockStateRef.current, {
      capturedAtMs: candidate?.capturedAtMs ?? Date.now(),
      keypoints: fingerprintKeypoints ?? candidate?.keypoints ?? null,
      nowMs: Date.now(),
      profile: activeHandShapeProfile,
    });
    if (transition.nextState.locked) {
      syncSubjectLockTransition(transition, source === "gesture" ? "gesture" : "manual");
      if (confidence !== null) {
        subjectLockConfidenceRef.current = confidence;
        setSubjectLockConfidence(confidence);
      }
    }
  };

  const handleToggleSubjectLock = () => {
    const candidate = latestRawSubjectCandidateRef.current;
    if (subjectLockStateRef.current.locked) {
      const transition = manuallyUnlockSubject(subjectLockStateRef.current, {
        capturedAtMs: candidate?.capturedAtMs,
        keypoints: candidate?.keypoints ?? null,
        nowMs: Date.now(),
        profile: activeHandShapeProfile,
      });
      subjectLockEpochRef.current += 1;
      syncSubjectLockTransition(transition, "reset");
      pauseAutoFinishTiming();
      resetRepEngineForSubjectLockWait();
      clearSubjectLockAnalysisBuffers();
      showMessage(
        "Subject tracking paused. Counting will resume when one clear body is visible.",
      );
      return;
    }

    const transition = manuallyLockSubject(subjectLockStateRef.current, {
      capturedAtMs: candidate?.capturedAtMs,
      keypoints: candidate?.keypoints ?? null,
      nowMs: Date.now(),
      profile: activeHandShapeProfile,
    });
    if (!transition.nextState.locked) {
      const status =
        "Subject tracking needs a fresh visible body rig. Keep shoulders, hips, and one arm chain in frame.";
      setSubjectLockStatusText(status);
      showMessage(status);
      return;
    }
    syncSubjectLockTransition(transition, "manual");
    showMessage("Subject tracking selected.");
  };

  const reportPoseDecision = (
    reason: string | null,
    evidence?: PoseRepEngineEvidence,
    previousState?: PoseRepEngineState,
    timestamp = Date.now(),
  ) => {
    poseDiagnosticsRef.current({
      reason, evidence, previousState, timestamp,
      state: repEngineStateRef.current,
      contract: movementContractRef.current,
      rig: activeRigRef.current,
      context: {
        exerciseId: cameraTarget?.exerciseId,
        setNumber: cameraTarget?.setNumber,
        runtimeState: cameraRuntimeStateRef.current,
        recording: isRecordingRef.current,
        subjectTracking: subjectTrackingEnabledRef.current,
        subjectCanCount: subjectLockDecisionRef.current?.canCount,
        streamActive: cameraContinuityActiveRef.current,
      },
    });
  };

  const resetRepEngineForSubjectLockWait = (
    reason = "tracking_paused",
    frame?: PoseSequenceFrameRecord & { frameWidth?: number; frameHeight?: number },
  ) => {
    reportPoseDecision(reason, frame ? {
      keypoints: frame.keypoints,
      spatialKeypoints: frame.spatialKeypoints,
      coordinateDimensions: getPoseCoordinateDimensions(frame.frameWidth, frame.frameHeight),
    } : undefined, repEngineStateRef.current, frame?.capturedAtMs ?? Date.now());
    const previousState = repEngineStateRef.current;
    poseFrameBufferRef.current = [];
    framesSinceAnalyzeRef.current = 0;
    poseSignalCacheRef.current.reset();

    repEngineStateRef.current = {
      ...createPoseRepEngineState(),
      rawAngleData: previousState.rawAngleData,
      repCount: previousState.repCount,
    };
    holdProgressSecondsRef.current = 0;
    setHoldProgressSeconds(0);
    setHoldValid(false);
    setCurrentPhase("primed");
    setRepPathUnblocked(false);
    setTrackedReps(previousState.repCount);
  };

  const canCountLockedSubject = (
    keypoints: PoseKeypointRecord[],
    capturedAtMs: number,
    candidates?: readonly PoseSubjectCandidate[] | null,
    generation?: number,
    streamId?: number,
  ) => {
    const decision = subjectLockDecisionRef.current;
    if (decision?.capturedAtMs === capturedAtMs) {
      if (!decision.canCount) {
        pauseAutoFinishTiming();
      }
      return decision.canCount;
    }

    const trackerResult = advancePoseSubjectTracker(
      subjectTrackerStateRef.current,
      {
        candidates:
          candidates && candidates.length > 0
            ? candidates
            : [{ keypoints }],
        capturedAtMs,
        generation,
        mode: subjectTrackingEnabledRef.current ? "on" : "off",
        nowMs: Date.now(),
        streamId,
      },
    );
    subjectTrackerStateRef.current = trackerResult.nextState;
    selectedSubjectKeypointsRef.current =
      trackerResult.candidate?.keypoints ?? null;
    const retained = trackerResult.nextState.selected !== null;
    subjectLockedRef.current = trackerResult.canCount;
    subjectLockConfidenceRef.current = trackerResult.candidate
      ? trackerResult.candidate.keypoints.reduce(
          (sum, point) => sum + point.visibility,
          0,
        ) / Math.max(1, trackerResult.candidate.keypoints.length)
      : null;
    setSubjectLocked(trackerResult.canCount);
    setSubjectLockRetained(retained);
    setSubjectLockConfidence(subjectLockConfidenceRef.current);
    setSubjectLockReady(
      trackerResult.candidateFresh && trackerResult.candidate !== null,
    );
    setSubjectLockStatusText(
      trackerResult.status === "tracking"
        ? subjectTrackingEnabledRef.current
          ? "Subject tracking is following the selected body."
          : "Ready. One fresh body is used for rep counting."
        : trackerResult.status === "lost"
          ? "Tracking paused after a long subject loss. Toggle Subject tracking off and on to reacquire."
          : trackerResult.status === "paused"
            ? "Tracking paused. Recenter and wait for a fresh, unambiguous body."
            : subjectTrackingEnabledRef.current
              ? "Ready. Hold one body steady for a moment to start tracking."
              : "Ready. Keep one fresh body fully visible to start counting.",
    );
    subjectLockDecisionRef.current = {
      canCount: trackerResult.canCount,
      capturedAtMs,
      candidateFresh: trackerResult.candidateFresh,
    };
    return trackerResult.canCount;
  };

  const resetSubjectLockGesture = useCallback(() => {
    const nextState = {
      ...subjectLockStateRef.current,
      gestureProgress: 0,
      gestureStartMs: null,
    };
    subjectLockStateRef.current = nextState;
    subjectLockDecisionRef.current = null;
    setSubjectLockGestureProgress(0);
  }, []);

  const handleToggleCameraFacing = () => {
    if (isRecording || countdownValue !== null || isCameraSwitching) {
      showMessage("Pause tracking before switching cameras.");
      return;
    }

    resetAutoFinishTiming();

    const nextFacing: CameraType = cameraFacing === "back" ? "front" : "back";
    const nextStreamId = cameraRemountKey + 1;
    nativeStreamIdRef.current = nextStreamId;
    if (!cameraActive) {
      cameraContinuityActiveRef.current = false;
      invalidateSubjectLock("camera switch");
      setCameraFacing(nextFacing);
      setCameraFrameSize(null);
      setCameraRemountKey(nextStreamId);
      showMessage(
        `Switched to ${nextFacing === "front" ? "front" : "back"} camera.`,
      );
      return;
    }

    if (cameraSwitchTimerRef.current) {
      clearTimeout(cameraSwitchTimerRef.current);
      cameraSwitchTimerRef.current = null;
    }

    cameraContinuityActiveRef.current = false;
    setIsCameraSwitching(true);
    setCameraActive(false);
    cameraRef.current = null;
    setCameraFrameSize(null);
    setCameraFacing(nextFacing);
    setCameraRemountKey(nextStreamId);
    resetPoseTrackingBuffers();
    invalidateSubjectLock("camera switch");
    setPoseStatusOverride(
      `Switching to ${nextFacing === "front" ? "front" : "back"} camera...`,
    );
    cameraSwitchTimerRef.current = setTimeout(() => {
      cameraContinuityActiveRef.current = true;
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
    keypoints: PoseKeypointRecord[] | null,
    capturedAtMs: number,
  ) => {
    latestRawSubjectCandidateRef.current = keypoints
      ? { capturedAtMs, keypoints }
      : null;
    // Automatic subject tracking owns acquisition for the live counting path.
    // Keep the legacy gesture observer inert so it cannot re-lock, release,
    // or invalidate a candidate selected by the bounded tracker.
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
    refetch: refetchExercises,
  } = useQuery({
    ...fitnessExercisesQueryOptions(mobileApiClient, { limit: 100, page: 1 }),
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const {
    data: cameraTargetExercise = null,
    isPending: cameraTargetExerciseLoading,
    isError: cameraTargetExerciseError,
    refetch: refetchCameraTargetExercise,
  } = useQuery(
    fitnessExerciseQueryOptions(mobileApiClient, cameraTarget?.exerciseId),
  );
  const resolvedExercises = useMemo(() => {
    return mergeLatestWorkoutExercise(
      exercisesResponse.data,
      cameraTargetExercise,
    );
  }, [cameraTargetExercise, exercisesResponse.data]);

  const refreshWorkoutExerciseContracts = async () => {
    return refreshLatestWorkoutExercises({
      exerciseId: cameraTarget?.exerciseId,
      fallbackExercises: exercisesResponse.data,
      refetchCatalog: async () => (await refetchExercises({ throwOnError: true })).data?.data,
      refetchExercise: async () =>
        (await refetchCameraTargetExercise({ throwOnError: true })).data,
    });
  };
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
      plansResponse.data.find((plan) => plan.id === cameraTarget?.planId) ??
      plansResponse.data.find((plan) => plan.isActive) ??
      plansResponse.data[0] ??
      null,
    [cameraTarget?.planId, plansResponse.data],
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
  const currentPlanExercise = useMemo(() => {
    if (cameraTarget) {
      const catalogExercise = resolvedExercises.find(
        (exercise) => exercise.id === cameraTarget.exerciseId,
      );
      return {
        exerciseId: cameraTarget.exerciseId,
        exerciseName: cameraTarget.exerciseName,
        muscleGroup: catalogExercise?.muscleGroup ?? "General",
        notes: null,
        reps: cameraTarget.targetReps,
        sets: cameraTarget.totalSets,
      };
    }
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
  }, [cameraTarget, planDetail, resolvedExercises]);

  const selectedExercise = useMemo(
    () => toSelectedExercise(currentPlanExercise, resolvedExercises),
    [currentPlanExercise, resolvedExercises],
  );
  const liveExerciseReferences = useMemo(
    () => toExerciseReferences(resolvedExercises),
    [resolvedExercises],
  );
  const exerciseReferences = useMemo(
    () => mergeExerciseReferences(liveExerciseReferences),
    [liveExerciseReferences],
  );
  const savedExerciseOptions = useMemo(
    () => toSavedExerciseOptions(exerciseReferences),
    [exerciseReferences],
  );
  const trackingExerciseLabel = cameraTarget
    ? cameraTarget.exerciseName
    : confirmedExerciseLabel ??
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
  const poseEquipmentContext = declaredExerciseEquipmentContext;
  const poseEquipmentSource = toEquipmentSource(
    confirmedExerciseLabel !== null,
    declaredExerciseEquipmentContext,
  );
  const poseEquipmentConfidence = declaredExerciseEquipmentContext
    ? 0.7
    : undefined;
  const poseEquipmentConflicts: string[] = [];
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
  const trackingExerciseReference = useMemo(
    () =>
      findExerciseReferenceByName(exerciseReferences, trackingExerciseLabel),
    [exerciseReferences, trackingExerciseLabel],
  );
  const trackingStructuredExercise = useMemo(
    () => {
      const resolved = resolveWorkoutExerciseContract({
        exerciseId: cameraTarget?.exerciseId,
        exercises: resolvedExercises,
        label: trackingExerciseLabel,
      })?.exercise;
      return resolved
        ? toSelectedExercise(
            {
              exerciseId: resolved.id,
              exerciseName: resolved.name,
              muscleGroup: resolved.muscleGroup,
              notes: resolved.instructions,
              reps: null,
              sets: 1,
            },
            resolvedExercises,
          )
        : selectedExercise;
    }, [cameraTarget?.exerciseId, resolvedExercises, selectedExercise, trackingExerciseLabel],
  );
  const activeHandShapeProfile = useMemo(() => {
    const rawProfile = activeSetSnapshot ? activeSetSnapshot.handShapeProfile : trackingStructuredExercise?.handShapeProfile;
    return rawProfile ? normalizeExerciseHandShapeProfile(rawProfile) : null;
  }, [activeSetSnapshot, trackingStructuredExercise?.handShapeProfile]);
  activeHandShapeProfileRef.current = activeHandShapeProfile;
  const activeMovementProfile =
    activeSetSnapshot?.movementProfile ?? trackingStructuredExercise?.movementProfile ?? null;
  const activeRigRef = useRef(activeMovementProfile?.rig ?? null);
  activeRigRef.current = activeMovementProfile?.rig ?? null;
  const activeMovementIdentity =
    activeSetSnapshot?.identity ?? trackingStructuredExercise?.movementContractIdentity ?? null;
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
    if (activeSetSnapshot) return null;
    if (cameraTarget) {
      if (cameraTargetExerciseLoading) return "Loading tracking settings…";
      if (cameraTargetExerciseError) return "Unable to load tracking settings. Retry starting this set.";
      const tracking = resolveExerciseTracking(cameraTargetExercise);
      return tracking.status === "ready" ? null : tracking.reason;
    }
    if (exercisesLoading) return null;
    if (
      cameraTarget &&
      cameraTargetExercise?.trackingMode === "manual"
    ) {
      return "Camera tracking is not available for this exercise. Use manual set logging.";
    }
    if (exerciseReferences.length > 0) return null;
    return "The live exercise catalog is empty on this stack. Seed the workout catalog before starting tracked sets and EXP sync.";
  }, [activeSetSnapshot, cameraTarget, cameraTargetExercise, cameraTargetExerciseError, cameraTargetExerciseLoading, exerciseReferences.length, exercisesLoading]);
  countdownValueRef.current = countdownValue;
  isExerciseConfirmationVisibleRef.current = isExerciseConfirmationVisible;
  useEffect(() => {
    const targetKey = getCameraTargetKey(cameraTarget);
    if (activeSetSnapshotRef.current && !matchesPlannedTrackingSnapshot(activeSetSnapshotRef.current, cameraTarget)) {
      isRecordingRef.current = false;
      setIsRecording(false);
      stopFrameLoop();
      activeSetSnapshotRef.current = null;
      setActiveSetSnapshot(null);
      poseSessionIdRef.current = null;
      setPoseSessionId(null);
      resetPoseRuntimeState(true);
    }
    resetAutoFinishTiming();
    if (!targetKey) {
      completionLatchRef.current = null;
      return;
    }
    if (completionLatchRef.current?.key === targetKey) return;
    completionLatchRef.current = { key: targetKey, status: "idle" };
    autoCompletionKeyRef.current = null;
    setCameraRuntime("ready");
  }, [
    cameraTarget,
    cameraTarget?.planExerciseId,
    cameraTarget?.sessionId,
    cameraTarget?.setNumber,
    resetAutoFinishTiming,
    setCameraRuntime,
  ]);
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
    if (!isRecording) {
      resetAutoFinishTiming();
    }
  }, [isRecording, resetAutoFinishTiming]);

  useEffect(() => {
    isCameraSwitchingRef.current = isCameraSwitching;
    if (isCameraSwitching) {
      pauseAutoFinishTiming();
    }
  }, [isCameraSwitching, pauseAutoFinishTiming]);

  useEffect(() => {
    if (
      !cameraActive ||
      !permissionGranted ||
      !isRecording ||
      cameraRuntimeState !== "tracking" ||
      isCameraSwitching ||
      isExerciseConfirmationVisible
    ) {
      resetAutoFinishTiming();
    }
  }, [
    cameraActive,
    cameraRuntimeState,
    isCameraSwitching,
    isExerciseConfirmationVisible,
    isRecording,
    permissionGranted,
    resetAutoFinishTiming,
  ]);

  const resetPoseTrackingBuffers = useCallback(() => {
    bumpNativeStreamGeneration();
    poseFrameBufferRef.current = [];
    framesSinceAnalyzeRef.current = 0;
    trackingReliabilityNotifiedRef.current = false;
    subjectLockEpochRef.current += 1;
    poseSignalCacheRef.current.reset();
    lastVisualPoseAtMsRef.current = 0;
    latestNativeFrameCapturedAtMsRef.current = 0;
    latestBrowserFrameCapturedAtMsRef.current = 0;
    poseRuntimeErrorNotifiedRef.current = false;
    stableNativePoseFrameRef.current = null;
    subjectLockDecisionRef.current = null;
    subjectTrackerStateRef.current = resetPoseSubjectTrackerState(
      subjectTrackerStateRef.current,
      subjectTrackingEnabledRef.current ? "on" : "off",
      nativeStreamGenerationRef.current,
      nativeStreamIdRef.current,
    );
    selectedSubjectKeypointsRef.current = null;
    setNativeLandmarksActive(false);
    resetSubjectLockGesture();
  }, [bumpNativeStreamGeneration, resetSubjectLockGesture]);

  const resetPoseRuntimeState = useCallback((clearReps: boolean) => {
    movementContractRef.current = null;
    movementContractIdentityRef.current = null;
    repEngineStateRef.current = createPoseRepEngineState();
    holdProgressSecondsRef.current = 0;
    averageConfidenceRef.current = null;
    setNativeLandmarksActive(false);
    setMovementContract(null);
    setCurrentAngle(null);
    setCurrentKeypoints(null);
    setCurrentPhase("primed");
    setRepPathUnblocked(false);
    setHoldProgressSeconds(0);
    setHoldValid(false);
    setLowConfidenceLandmarks([]);
    if (clearReps) {
      liveRepCountRef.current = 0;
      setReps(0);
    }
  }, []);

  const resolveCameraMovementContract = (
    contract: PoseMovementContractRecord | null,
  ) => {
    if (!contract) return null;
    if (matchesPlannedTrackingSnapshot(activeSetSnapshotRef.current, cameraTarget)) {
      return activeSetSnapshotRef.current!.movementProfile.movementContract;
    }
    const targetDuration = cameraTarget?.targetDurationSeconds;
    if (
      contract.repModel === "static_hold" &&
      typeof targetDuration === "number" &&
      targetDuration > 0
    ) {
      return { ...contract, holdDurationSeconds: targetDuration };
    }
    return contract;
  };

  const updateStaticHoldFromFrame = ({
    contract,
    currentAngle: frameAngle,
    capturedAtMs,
    keypoints,
    keypointFrames,
    signals,
    statusPrefix,
    coordinateDimensions,
    spatialKeypoints,
  }: {
    capturedAtMs: number;
    contract: PoseMovementContractRecord;
    currentAngle: number | null;
    keypointFrames: PoseKeypointRecord[][];
    keypoints: PoseKeypointRecord[];
    signals: PoseSequenceSignalsRecord;
    statusPrefix: string;
    coordinateDimensions?: PoseCoordinateDimensions;
    spatialKeypoints?: PoseKeypointRecord[];
  }) => {
    const holdStep = stepPoseStaticHold(
      repEngineStateRef.current,
      contract,
      frameAngle,
      capturedAtMs,
      {
        exerciseDeclared: !!cameraTarget,
        rig: activeRigRef.current,
        spatialKeypoints,
        equipmentContext: poseEquipmentContext,
        equipmentSource: poseEquipmentSource,
        handShapeProfile: activeHandShapeProfileRef.current,
        keypointFrames,
        keypoints,
        lowConfidenceLandmarks: signals.visibility.lowConfidenceLandmarks,
        signals,
        coordinateDimensions,
      },
    );
    repEngineStateRef.current = holdStep.nextState;
    reportPoseDecision(holdStep.noCountReason, { keypoints, spatialKeypoints, coordinateDimensions }, undefined, capturedAtMs);
    holdProgressSecondsRef.current = holdStep.holdSeconds;
    setHoldProgressSeconds(holdStep.holdSeconds);
    setHoldValid(holdStep.holdValid);
    setCurrentPhase(holdStep.nextState.phase);
    setRepPathUnblocked(!holdStep.noCountReason);
    setTrackedReps(holdStep.nextState.repCount);
    const targetSeconds = contract.holdDurationSeconds ?? 30;
    const guidanceTips = summarizeMovementGuidance(
      contract,
      keypoints,
      holdStep.nextState.phase,
      signals.visibility.lowConfidenceLandmarks,
    );
    setPoseFeedback(
      holdStep.noCountReason
        ? [
            "Hold paused: correct your form to resume valid time.",
            "A sustained form break resets the hold timer.",
            ...guidanceTips,
          ].slice(0, 3)
        : guidanceTips.length > 0
          ? guidanceTips.slice(0, 3)
          : ["Hold position steady while the timer counts valid form."],
    );
    setPoseStatusOverride(
      holdStep.noCountReason
        ? `${statusPrefix} ${buildPoseNoCountStatusText(holdStep.noCountReason)}`
        : `${statusPrefix} Valid hold ${holdStep.holdSeconds.toFixed(1)} / ${targetSeconds}s.`,
    );
    if (holdStep.holdCompleted) {
      autoFinalizeSetRef.current?.();
    }
  };

  const armFallbackMovementContract = (
    exerciseLabel: string | null | undefined,
    frameKeypoints: PoseKeypointRecord[] | null,
    statusText: string,
    coordinateDimensions?: PoseCoordinateDimensions,
  ) => {
    const configuredContract = activeMovementProfile?.movementContract ?? null;
    if (configuredContract && !isValidPoseMovementContract(configuredContract)) {
      // Never turn an incomplete or incompatible profile into an automatic
      // counter.  The workout remains usable through manual set logging.
      return null;
    }
    const fallbackContract = resolveCameraMovementContract(
      normalizeExerciseMovementProfile(
        configuredContract ? { movementContract: configuredContract } : null,
        { movementContract: buildFallbackPoseMovementContract(exerciseLabel) },
      )?.movementContract ?? buildFallbackPoseMovementContract(exerciseLabel),
    );
    if (!fallbackContract || !isValidPoseMovementContract(fallbackContract)) {
      return null;
    }

    const effectiveProfile: ExerciseMovementProfileRecord = {
      movementContract: fallbackContract,
      rig: activeMovementProfile?.rig ?? null,
      schemaVersion: "exercise_movement_profile_v1",
      warnings: activeMovementProfile?.warnings ?? [],
    };
    const nextIdentityKey = movementContractIdentityKey(
      activeMovementIdentity,
      effectiveProfile,
    );
    if (
      hasMovementContractIdentityChanged(
        movementContractIdentityRef.current,
        activeMovementIdentity,
        effectiveProfile,
      )
    ) {
      const previousState = repEngineStateRef.current;
      repEngineStateRef.current = {
        ...createPoseRepEngineState(),
        rawAngleData: previousState.rawAngleData,
        repCount: previousState.repCount,
      };
      poseFrameBufferRef.current = [];
      framesSinceAnalyzeRef.current = 0;
      poseSignalCacheRef.current.reset();
      movementContractIdentityRef.current = nextIdentityKey;
    }
    movementContractRef.current = fallbackContract;
    holdProgressSecondsRef.current = 0;
    setHoldProgressSeconds(0);
    setHoldValid(false);
    setMovementContract(fallbackContract);
    setCurrentPhase("primed");
    setRepPathUnblocked(false);
    setCurrentAngle(
      frameKeypoints
        ? getPoseMovementContractAngle(
            fallbackContract,
            frameKeypoints,
            coordinateDimensions,
          )
        : null,
    );
    setPoseFeedback([
      `Local ${toDisplayExerciseName(fallbackContract.exercise)} counting is active.`,
      "Keep shoulders, hips, knees, and ankles visible to the camera.",
      fallbackContract.repModel === "static_hold"
        ? `Hold valid form for ${fallbackContract.holdDurationSeconds ?? 30} seconds; a sustained form break resets the timer.`
        : fallbackContract.partialRepPolicy === "review_only"
          ? "This exercise is review-only; log reps manually."
          : getPoseRepAcceptancePolicy(fallbackContract).countAt === "peak"
            ? "Reps count at the target; return to the start before the next rep."
            : "Reps count after the full start-to-target-to-return cycle.",
    ]);
    setPoseStatusOverride(statusText);
    framesSinceAnalyzeRef.current = 0;
    analyzeErrorMessageRef.current = null;
    return fallbackContract;
  };

  const armPlannedMovementContract = (
    frameKeypoints: PoseKeypointRecord[] | null,
    statusText: string,
    exerciseCatalog: readonly LiveExerciseRecord[] = resolvedExercises,
    coordinateDimensions?: PoseCoordinateDimensions,
  ) => {
    if (!cameraTarget) return null;
    const snapshot = matchesPlannedTrackingSnapshot(activeSetSnapshotRef.current, cameraTarget)
      ? activeSetSnapshotRef.current : null;
    const plannedExercise = resolveWorkoutExerciseContract({
      exerciseId: cameraTarget.exerciseId,
      exercises: exerciseCatalog,
      label: cameraTarget.exerciseName,
    });
    const configuredContract =
      snapshot?.movementProfile.movementContract ?? plannedExercise?.exercise.movementProfile?.movementContract ?? null;
    if (!configuredContract || (!snapshot && !plannedExercise)) return null;
    const plannedIdentity = snapshot?.identity ?? plannedExercise!.identity;

    const plannedContract = resolveCameraMovementContract(configuredContract);
    if (!plannedContract || !isValidPoseMovementContract(plannedContract)) {
      return null;
    }
    const effectiveProfile: ExerciseMovementProfileRecord = {
      ...(snapshot?.movementProfile ?? plannedExercise?.exercise.movementProfile ?? {
        movementContract: plannedContract,
        rig: null,
        schemaVersion: "exercise_movement_profile_v1",
        warnings: [],
      }),
      movementContract: plannedContract,
    };
    const plannedMovementKey = `${cameraTarget.planExerciseId}:${cameraTarget.setNumber}:${movementContractIdentityKey(plannedIdentity, effectiveProfile) ?? cameraTarget.exerciseId}:${cameraTarget.targetDurationSeconds ?? 0}`;
    if (
      plannedMovementKeyRef.current === plannedMovementKey &&
      movementContractRef.current
    ) {
      // Reassert the plan-owned identity without rebuilding the contract on
      // every native/web frame.
      confirmedExerciseLabelRef.current = cameraTarget.exerciseName;
      setConfirmedExerciseLabel(cameraTarget.exerciseName);
      setDetectedExerciseName(cameraTarget.exerciseName);
      setIsExerciseConfirmationVisible(false);
      return movementContractRef.current;
    }

    const previousState = repEngineStateRef.current;
    repEngineStateRef.current = {
      ...createPoseRepEngineState(),
      rawAngleData: previousState.rawAngleData,
      repCount: previousState.repCount,
    };
    poseFrameBufferRef.current = [];
    framesSinceAnalyzeRef.current = 0;
    poseSignalCacheRef.current.reset();
    movementContractRef.current = plannedContract;
    movementContractIdentityRef.current = movementContractIdentityKey(
      plannedIdentity,
      effectiveProfile,
    );
    plannedMovementKeyRef.current = plannedMovementKey;
    confirmedExerciseLabelRef.current = cameraTarget.exerciseName;
    holdProgressSecondsRef.current = 0;
    setConfirmedExerciseLabel(cameraTarget.exerciseName);
    setDetectedExerciseName(cameraTarget.exerciseName);
    setExerciseConfirmationCandidates([]);
    setIsExerciseConfirmationVisible(false);
    setHoldProgressSeconds(0);
    setHoldValid(false);
    setMovementContract(plannedContract);
    setCurrentPhase("primed");
    setRepPathUnblocked(false);
    setCurrentAngle(
      frameKeypoints
        ? getPoseMovementContractAngle(
            plannedContract,
            frameKeypoints,
            coordinateDimensions,
          )
        : null,
    );
    setPoseFeedback([
      `${toDisplayExerciseName(cameraTarget.exerciseName)} is ready. Get in frame to start automatic counting.`,
      "FitTrack is using the exercise from your workout plan.",
      plannedContract.repModel === "static_hold"
        ? `Hold valid form for ${plannedContract.holdDurationSeconds ?? 30} seconds; a sustained form break pauses the timer.`
        : "Move through the full range of motion; your target is a goal and reps continue above it.",
    ]);
    setPoseStatusOverride(statusText);
    framesSinceAnalyzeRef.current = 0;
    analyzeErrorMessageRef.current = null;
    return plannedContract;
  };

  const rejectPlannedMovementContract = (exerciseName: string) => {
    pauseAutoFinishTiming();
    movementContractRef.current = null;
    movementContractIdentityRef.current = null;
    plannedMovementKeyRef.current = null;
    setMovementContract(null);
    setCurrentAngle(null);
    setCurrentPhase("primed");
    setRepPathUnblocked(false);
    setIsExerciseConfirmationVisible(false);
    poseFrameBufferRef.current = [];
    framesSinceAnalyzeRef.current = 0;
    poseSignalCacheRef.current.reset();
    resetRepEngineForSubjectLockWait("invalid_movement_contract");
    setPoseStatusOverride(
      `Planned ${toDisplayExerciseName(exerciseName)} has no valid tracking contract. Rep counting is paused.`,
    );
    setPoseFeedback([
      "The planned exercise contract is unavailable or invalid.",
      "Choose a supported camera exercise or log this set manually.",
    ]);
  };

  const resetRepEngineForMovementContractChange = (
    nextIdentityKey: string | null,
  ) => {
    if (movementContractIdentityRef.current === nextIdentityKey) return;
    const previousState = repEngineStateRef.current;
    repEngineStateRef.current = {
      ...createPoseRepEngineState(),
      rawAngleData: previousState.rawAngleData,
      repCount: previousState.repCount,
    };
    poseFrameBufferRef.current = [];
    framesSinceAnalyzeRef.current = 0;
    poseSignalCacheRef.current.reset();
    movementContractIdentityRef.current = nextIdentityKey;
  };

  useEffect(() => {
    if (!cameraTarget) {
      plannedMovementKeyRef.current = null;
      return;
    }
    const plannedExercise = resolveWorkoutExerciseContract({
      exerciseId: cameraTarget.exerciseId,
      exercises: resolvedExercises,
      label: cameraTarget.exerciseName,
    });
    if (!plannedExercise && !matchesPlannedTrackingSnapshot(activeSetSnapshotRef.current, cameraTarget)) {
      rejectPlannedMovementContract(cameraTarget.exerciseName);
      return;
    }
    const plannedContract = armPlannedMovementContract(
      null,
      `Ready for ${toDisplayExerciseName(cameraTarget.exerciseName)}. Get in frame to begin.`,
    );
    if (!plannedContract) {
      rejectPlannedMovementContract(cameraTarget.exerciseName);
    }
    // The helper is guarded by the plan/set key so this effect only arms the
    // contract when the target changes or a runtime reset cleared it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cameraTarget?.exerciseName,
    cameraTarget?.exerciseId,
    cameraTarget?.planExerciseId,
    cameraTarget?.setNumber,
    cameraTarget?.targetDurationSeconds,
    cameraTargetExercise?.movementContractIdentity.revision,
    cameraTargetExercise?.movementProfile,
    cameraTargetExercise?.trackingMode,
  ]);

  const disposePoseAnalyzer = () => {
    poseAnalyzerGenerationRef.current += 1;
    poseAnalyzerRef.current?.dispose();
    poseAnalyzerRef.current = null;
    poseAnalyzerPromiseRef.current = null;
    setIsPoseModelLoading(false);
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
      const analyzerGeneration = poseAnalyzerGenerationRef.current;
      setIsPoseModelLoading(true);
      setPoseStatusOverride("Loading the browser pose model...");
      const pendingAnalyzer = createBrowserPoseAnalyzer({
        subjectTrackingMode: subjectTrackingEnabledRef.current
          ? "on"
          : "off",
      });
      poseAnalyzerPromiseRef.current = pendingAnalyzer;
      void pendingAnalyzer
        .then((analyzer) => {
          if (
            poseAnalyzerGenerationRef.current !== analyzerGeneration ||
            poseAnalyzerPromiseRef.current !== pendingAnalyzer
          ) {
            analyzer.dispose();
            return;
          }
          poseAnalyzerRef.current = analyzer;
        })
        .catch(() => undefined)
        .finally(() => {
          if (
            poseAnalyzerGenerationRef.current === analyzerGeneration &&
            poseAnalyzerPromiseRef.current === pendingAnalyzer
          ) {
            setIsPoseModelLoading(false);
          }
        });
    }

    const analyzerGeneration = poseAnalyzerGenerationRef.current;
    const pendingAnalyzer = poseAnalyzerPromiseRef.current;
    if (!pendingAnalyzer) return null;
    try {
      const analyzer = await pendingAnalyzer;
      if (
        poseAnalyzerGenerationRef.current !== analyzerGeneration ||
        poseAnalyzerPromiseRef.current !== pendingAnalyzer
      ) {
        return null;
      }
      setPoseStatusOverride(null);
      return analyzer;
    } catch (error) {
      if (
        poseAnalyzerGenerationRef.current === analyzerGeneration &&
        poseAnalyzerPromiseRef.current === pendingAnalyzer
      ) {
        poseAnalyzerPromiseRef.current = null;
        poseAnalyzerRef.current = null;
        setIsPoseModelLoading(false);
        setPoseStatusOverride(
          "The browser pose model failed to load on this session.",
        );
      }
      throw error;
    }
  };

  const handleNativeMultiPoseAvailabilityChange = (available: boolean) => {
    setNativeMultiPoseAvailable(available);
    if (!available) {
      setNativeMultiPoseStatus("unavailable");
      setNativeMultiPoseError(null);
      return;
    }
    setNativeMultiPoseStatus((current) =>
      current === "unavailable" ? "off" : current,
    );
  };

  const handleNativeMultiPoseStatusChange = (
    status: FitTrackMultiPoseSessionStatus,
    error: FitTrackMultiPoseError | null = null,
  ) => {
    setNativeMultiPoseStatus(status);
    setNativeMultiPoseError(error);
    if (!error || isWebPoseRuntime || !subjectTrackingEnabledRef.current) {
      return;
    }
    const capabilityMissing =
      error.code === "module_unavailable" ||
      error.code === "plugin_unavailable" ||
      error.code === "native_bridge_unavailable";
    setNativeMultiPoseAvailable(!capabilityMissing);
    pauseAutoFinishTiming();
    resetRepEngineForSubjectLockWait();
    if (poseRuntimeErrorNotifiedRef.current) return;
    poseRuntimeErrorNotifiedRef.current = true;
    setPoseFeedback([
      "Subject tracking paused because its multi-person detector failed.",
      `${error.message} Turn Subject tracking off, then on to retry.`,
      "Your set remains active; a detector error cannot finish it.",
    ]);
    setPoseStatusOverride(
      "Subject tracking paused. Turn it off and on to retry.",
    );
  };

  const handleNativePoseFrame = async (observation: NativePoseObservation) => {
    if (isWebPoseRuntime) {
      return;
    }

    const frame = observation.frame;
    if (
      !isCurrentSubjectLockObservation(
        observation,
        {
          generation: nativeStreamGenerationRef.current,
          streamId: nativeStreamIdRef.current,
        },
        frame?.capturedAtMs,
      )
    ) {
      return;
    }

    if (!cameraContinuityActiveRef.current || isCameraSwitchingRef.current) {
      return;
    }

    if (typeof observation.error === "object") {
      handleNativeMultiPoseStatusChange("error", observation.error);
      return;
    }

    if (observation.error) {
      pauseAutoFinishTiming();
      resetRepEngineForSubjectLockWait("detector_error");
      if (!poseRuntimeErrorNotifiedRef.current) {
        poseRuntimeErrorNotifiedRef.current = true;
        setPoseFeedback([
          "Pose tracking paused while the camera recovers.",
          "Keep the preview open and stay visible while FitTrack retries.",
          "Your set remains active; a detector error cannot finish it.",
        ]);
        setPoseStatusOverride(
          "Pose tracking paused. Keep the camera open while FitTrack retries.",
        );
      }
      return;
    }

    if (!frame) {
      resetRepEngineForSubjectLockWait("no_pose");
      updateSubjectLockGesture(null, observation.capturedAtMs);
      pauseAutoFinishTiming();
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
          "Wait for a fresh landmark frame before expecting saved reps.",
        ]);
      }
      return;
    }

    if (frame.keypoints.length !== 33) {
      updateSubjectLockGesture(null, frame.capturedAtMs);
      return;
    }
    if (frame.capturedAtMs <= latestNativeFrameCapturedAtMsRef.current) {
      return;
    }
    latestNativeFrameCapturedAtMsRef.current = frame.capturedAtMs;
    poseRuntimeErrorNotifiedRef.current = false;

    const frameEpoch = subjectLockEpochRef.current;
    // Subject identity is evaluated on the raw observation before any
    // smoothing or temporal buffering can replay stale points.
    updateSubjectLockGesture(frame.keypoints, frame.capturedAtMs);
    canCountLockedSubject(
      frame.keypoints,
      frame.capturedAtMs,
      frame.candidates,
      frame.generation,
      frame.streamId,
    );
    if (frameEpoch !== subjectLockEpochRef.current) return;

    const selectedRawKeypoints =
      selectedSubjectKeypointsRef.current ?? frame.keypoints;
    const selectedRawFrame: NativePoseFrame = {
      ...frame,
      keypoints: selectedRawKeypoints,
      spatialKeypoints: frame.candidates?.find(candidate => candidate.keypoints === selectedRawKeypoints)?.spatialKeypoints ?? frame.spatialKeypoints,
    };

    const stableResult = stabilizeNativePoseFramePure(
      selectedRawFrame,
      stableNativePoseFrameRef.current,
    );
    const stableFrame: NativePoseFrame = {
      cameraFacing: frame.cameraFacing,
      capturedAtMs: stableResult.frame.capturedAtMs,
      candidates: frame.candidates,
      frameHeight: frame.frameHeight,
      frameWidth: frame.frameWidth,
      generation: frame.generation,
      keypoints: stableResult.frame.keypoints,
      spatialKeypoints: selectedRawFrame.spatialKeypoints,
      mirrorX: frame.mirrorX,
      orientation: frame.orientation,
      rotation: frame.rotation,
      source: frame.source,
      streamId: frame.streamId,
    };
    stableNativePoseFrameRef.current = stableFrame;
    const coordinateDimensions = getPoseCoordinateDimensions(
      frame.frameWidth,
      frame.frameHeight,
    );
    const overlayRotation: CameraRotation =
      frame.source === "vision_camera_mlkit" ? 0 : frame.rotation;

    setCameraFrameSize((current) => {
      const next = {
        height: frame.frameHeight,
        mirrorX: frame.mirrorX,
        rotation: overlayRotation,
        width: frame.frameWidth,
      };
      return current &&
        current.width === next.width &&
        current.height === next.height &&
        current.mirrorX === next.mirrorX &&
        current.rotation === next.rotation
        ? current
        : next;
    });

    setNativeLandmarksActive(true);
    publishPoseVisual(stableFrame.keypoints, stableFrame.capturedAtMs);

    const instantSignals = poseSignalCacheRef.current.getInstant(
      selectedRawFrame,
      coordinateDimensions,
    );
    const lowConfidenceLandmarks =
      instantSignals.visibility.lowConfidenceLandmarks;
    const reliability = getNativeFrameReliability(selectedRawFrame.keypoints);
    setLowConfidenceLandmarks(lowConfidenceLandmarks);

    if (subjectLockedRef.current) {
      const nextConfidence = Math.max(
        subjectLockConfidenceRef.current ?? 0,
        reliability.averageVisibility,
      );
      subjectLockConfidenceRef.current = nextConfidence;
      setSubjectLockConfidence(nextConfidence);
    }

    if (
      !isRecordingRef.current ||
      !poseSessionIdRef.current ||
      isExerciseConfirmationVisibleRef.current
    ) {
      reportPoseDecision("counting_not_started", { keypoints: selectedRawFrame.keypoints, spatialKeypoints: selectedRawFrame.spatialKeypoints, coordinateDimensions });
      resetAutoFinishTiming();
      setPoseStatusOverride(
        reliability.isReliable
          ? cameraTarget
            ? `Body tracked. Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} is ready when you start the set.`
            : "Native landmarks are live. Start recording to arm auto detection and rep counting."
          : "Native camera is live. Keep your full body visible to lock clean landmarks.",
      );
      return;
    }

    if (countdownValueRef.current !== null) {
      resetAutoFinishTiming();
      return;
    }

    if (cameraRuntimeStateRef.current !== "tracking") {
      reportPoseDecision("counting_not_started", {
        keypoints: selectedRawFrame.keypoints,
        spatialKeypoints: selectedRawFrame.spatialKeypoints,
        coordinateDimensions,
      }, undefined, selectedRawFrame.capturedAtMs);
      resetAutoFinishTiming();
      setPoseStatusOverride(
        cameraRuntimeStateRef.current === "saving"
          ? "Saving this set. Keep the camera steady while FitTrack finalizes it."
          : cameraRuntimeStateRef.current === "rest"
            ? "Rest timer active. Native analysis and rep counting are paused."
            : "Native camera is ready. Start the next planned set when you are positioned.",
      );
      return;
    }

    if (stableResult.held) {
      pauseAutoFinishTiming();
      poseFrameBufferRef.current = [];
      framesSinceAnalyzeRef.current = 0;
      poseSignalCacheRef.current.reset();
      if (movementContractRef.current) {
        resetRepEngineForSubjectLockWait("held_native_frame", selectedRawFrame);
      }
      setRepPathUnblocked(false);
      setPoseStatusOverride(
        "Live landmarks changed too quickly. Counting is paused until a fresh body frame is stable.",
      );
      return;
    }

    if (!subjectLockDecisionRef.current?.candidateFresh) {
      pauseAutoFinishTiming();
      poseFrameBufferRef.current = [];
      framesSinceAnalyzeRef.current = 0;
      poseSignalCacheRef.current.reset();
      resetRepEngineForSubjectLockWait("subject_frame_not_fresh", selectedRawFrame);
      setRepPathUnblocked(false);
      setPoseStatusOverride(
        "Waiting for a fresh landmark observation before counting can resume.",
      );
      return;
    }

    if (cameraTarget && !movementContractRef.current) {
      const plannedContract = armPlannedMovementContract(
        stableFrame.keypoints,
        `Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} tracking is ready.`,
        undefined,
        coordinateDimensions,
      );
      if (!plannedContract) {
        rejectPlannedMovementContract(cameraTarget.exerciseName);
        return;
      }
    }

    if (
      !cameraTarget &&
      !movementContractRef.current &&
      confirmedExerciseLabelRef.current
    ) {
      armFallbackMovementContract(
        confirmedExerciseLabelRef.current,
        stableFrame.keypoints,
        `Native landmark rep counting is armed for ${toDisplayExerciseName(
          confirmedExerciseLabelRef.current,
        )}.`,
        coordinateDimensions,
      );
    }

    const activeContract = movementContractRef.current;
    const movementAssessment = activeContract
      ? getPoseMovementFrameAssessment(
          activeContract,
          stableFrame.keypoints,
          coordinateDimensions,
        )
      : null;
    const effectiveReliability = movementAssessment
      ? {
          ...reliability,
          isReliable: movementAssessment.isReliable,
          visibleLandmarks: movementAssessment.reliableLandmarkCount,
        }
      : reliability;
    setLowConfidenceLandmarks(
      movementAssessment?.lowConfidenceLandmarks ?? lowConfidenceLandmarks,
    );

    if (!effectiveReliability.isReliable) {
      resetRepEngineForSubjectLockWait(movementAssessment?.reason ?? "required_landmarks_unreliable", selectedRawFrame);
      pauseAutoFinishTiming();
      poseFrameBufferRef.current = [];
      framesSinceAnalyzeRef.current = 0;
      if (activeContract) {
        setCurrentAngle(
          getPoseMovementContractAngle(
            activeContract,
            stableFrame.keypoints,
            coordinateDimensions,
          ),
        );
      } else {
        setCurrentAngle(null);
      }
      setPoseStatusOverride(TRACKING_UNRELIABLE_MESSAGE);
      setPoseFeedback([
        movementAssessment?.reason
          ? buildPoseNoCountStatusText(movementAssessment.reason)
          : TRACKING_UNRELIABLE_MESSAGE,
        `Only ${effectiveReliability.visibleLandmarks} reliable landmarks are visible right now.`,
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
    const bufferedSignals = getBufferedPoseSignals(
      bufferedFrames,
      stableFrame.capturedAtMs,
      coordinateDimensions,
    );
    const signals = bufferedSignals ?? instantSignals;
    setLowConfidenceLandmarks(movementAssessment?.lowConfidenceLandmarks ?? signals.visibility.lowConfidenceLandmarks);
    averageConfidenceRef.current = signals.visibility.averageVisibility;

    if (cameraRuntimeStateRef.current !== "tracking") {
      return;
    }

    if (movementContractRef.current) {
      const liveAngle = getPoseFrameContractAngle(
        movementContractRef.current,
        stableFrame,
        coordinateDimensions,
      );
      setCurrentAngle(liveAngle);
      if (!canCountLockedSubject(frame.keypoints, frame.capturedAtMs)) {
        pauseAutoFinishTiming();
        setRepPathUnblocked(false);
        resetRepEngineForSubjectLockWait("subject_tracking_wait", selectedRawFrame);
        setPoseFeedback(
          cameraTarget
            ? [
                "Body lost — get back in frame. Reacquiring automatically.",
                "Your counted reps are preserved while tracking pauses.",
              ]
              : [
                subjectLockedRef.current
                  ? "Tracking lost the selected body. Recenter and wait for tracking to resume."
                  : "Keep one clear body visible before rep counting starts.",
                "This prevents background pose jitter from creating phantom reps.",
                "Keep shoulders, hips, and one arm chain visible for tracking.",
              ],
        );
        setPoseStatusOverride(
          cameraTarget
            ? "Body lost — get back in frame. Reacquiring automatically."
            : subjectLockedRef.current
              ? "Tracking is unstable. Counting is paused until the body is visible again."
              : "Subject tracking is required before rep counting. The overlay can move, but reps stay paused.",
        );
        return;
      }

      if (movementContractRef.current.repModel === "static_hold") {
        updateStaticHoldFromFrame({
          capturedAtMs: stableFrame.capturedAtMs,
          contract: movementContractRef.current,
          currentAngle: liveAngle,
          keypointFrames: bufferedFrames.map(
            (bufferedFrame) => bufferedFrame.keypoints,
          ),
          keypoints: stableFrame.keypoints,
          spatialKeypoints: stableFrame.spatialKeypoints,
          signals,
          statusPrefix: "Native hold tracking is live.",
          coordinateDimensions,
        });
        return;
      }

      const repStep = stepPoseRepEngine(
        repEngineStateRef.current,
        movementContractRef.current,
        liveAngle,
        stableFrame.capturedAtMs,
        {
          exerciseDeclared: !!cameraTarget,
          rig: activeRigRef.current,
          spatialKeypoints: stableFrame.spatialKeypoints,
          equipmentContext: poseEquipmentContext,
          equipmentSource: poseEquipmentSource,
          handShapeProfile: activeHandShapeProfileRef.current,
          keypointFrames: bufferedFrames.map(
            (bufferedFrame) => bufferedFrame.keypoints,
          ),
          keypoints: stableFrame.keypoints,
          lowConfidenceLandmarks: signals.visibility.lowConfidenceLandmarks,
          signals,
          coordinateDimensions,
        },
      );
      repEngineStateRef.current = repStep.nextState;
      reportPoseDecision(repStep.noCountReason, {
        keypoints: stableFrame.keypoints,
        spatialKeypoints: stableFrame.spatialKeypoints,
        coordinateDimensions,
      }, undefined, stableFrame.capturedAtMs);
      setCurrentPhase(repStep.nextState.phase);
      setRepPathUnblocked(!repStep.noCountReason);
      setTrackedReps(repStep.nextState.repCount);
      if (repStep.repCompleted) {
        beginAutoFinishTiming(
          repStep.nextState.lastRepCompletedAtMs ?? stableFrame.capturedAtMs,
        );
      } else if (repStep.nextState.phase !== "primed") {
        pauseAutoFinishTiming();
      } else if (
        autoFinishPausedRef.current &&
        liveRepCountRef.current >= (activeSetSnapshotRef.current?.targetReps ?? cameraTarget?.targetReps ?? 0)
      ) {
        beginAutoFinishTiming(stableFrame.capturedAtMs);
      }

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
          ? `Native landmarks are live. ${buildPoseNoCountStatusText(repStep.noCountReason)}`
          : cameraTarget
            ? buildPlannedRepPhaseStatusText(
                movementContractRef.current,
                repStep.nextState.phase,
                repStep.repCompleted,
              )
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

    const analysisRequestId = ++poseAnalysisRequestIdRef.current;
    frameInFlightRef.current = true;
    try {
      const analysis = await analyzePoseSessionMutation.mutateAsync({
        poseSessionId: activePoseSessionId,
        input: {
          cameraFacingMode: cameraFacing === "front" ? "user" : "environment",
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

      if (
        frameEpoch !== subjectLockEpochRef.current ||
        activePoseSessionId !== poseSessionIdRef.current ||
        !isRecordingRef.current ||
        cameraRuntimeStateRef.current !== "tracking"
      ) {
        return;
      }

      framesSinceAnalyzeRef.current = 0;
      analyzeErrorMessageRef.current = null;
      averageConfidenceRef.current = analysis.confidence;
      if (subjectLockedRef.current && analysis.subjectLockConfidence !== null) {
        subjectLockConfidenceRef.current = analysis.subjectLockConfidence;
        setSubjectLockConfidence(analysis.subjectLockConfidence);
      }
      setExerciseConfirmationCandidates(analysis.candidateExercises);

      if (!cameraTarget && analysis.exerciseClass) {
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
        if (cameraTarget) {
          const plannedContract = armPlannedMovementContract(
            stableFrame.keypoints,
            `Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} tracking is ready.`,
            undefined,
            coordinateDimensions,
          );
          if (plannedContract) return;
          rejectPlannedMovementContract(cameraTarget.exerciseName);
          return;
        }
        movementContractRef.current = null;
        setMovementContract(null);
        setCurrentAngle(null);
        setCurrentPhase("primed");
        setRepPathUnblocked(false);
        setIsExerciseConfirmationVisible(true);
        setPoseStatusOverride(
          "Confirm the native exercise label to resume live rep counting.",
        );
        return;
      }

      if (cameraTarget) {
        const plannedContract = armPlannedMovementContract(
          stableFrame.keypoints,
          `Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} tracking is ready.`,
          undefined,
          coordinateDimensions,
        );
        if (plannedContract) return;
        rejectPlannedMovementContract(cameraTarget.exerciseName);
        return;
      }

      const detectedCatalogExercise = findExerciseByDetectedName(
        resolvedExercises,
        analysis.exerciseClass,
      );
      const detectedConfiguredContract =
        detectedCatalogExercise?.movementProfile?.movementContract ?? null;
      const nextMovementContract = resolveCameraMovementContract(
        detectedConfiguredContract ??
          (analysis.movementContract &&
          isValidPoseMovementContract(analysis.movementContract)
            ? analysis.movementContract
            : null),
      );
      if (nextMovementContract) {
        const detectedIdentity =
          detectedCatalogExercise?.movementContractIdentity ??
          analysis.movementContractIdentity;
        const detectedProfile: ExerciseMovementProfileRecord = {
          ...(detectedCatalogExercise?.movementProfile ?? {
            movementContract: nextMovementContract,
            rig: null,
            schemaVersion: "exercise_movement_profile_v1",
            warnings: [],
          }),
          movementContract: nextMovementContract,
        };
        resetRepEngineForMovementContractChange(
          movementContractIdentityKey(detectedIdentity, detectedProfile),
        );
        movementContractRef.current = nextMovementContract;
        setMovementContract(nextMovementContract);
        setCurrentPhase("primed");
        setRepPathUnblocked(false);
        const liveAngle = getPoseMovementContractAngle(
          nextMovementContract,
          stableFrame.keypoints,
          coordinateDimensions,
        );
        setCurrentAngle(liveAngle);
        const guidanceTips = summarizeMovementGuidance(
          nextMovementContract,
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
      if (
        frameEpoch !== subjectLockEpochRef.current ||
        activePoseSessionId !== poseSessionIdRef.current ||
        !isRecordingRef.current ||
        cameraRuntimeStateRef.current !== "tracking"
      ) {
        return;
      }
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Native landmark analysis could not process the latest batch.";
      const fallbackContract = cameraTarget
        ? armPlannedMovementContract(
            stableFrame.keypoints,
            `Using the planned ${toDisplayExerciseName(cameraTarget.exerciseName)} counter while native analysis reconnects.`,
            undefined,
            coordinateDimensions,
          )
        : confirmedExerciseLabelRef.current
          ? armFallbackMovementContract(
            confirmedExerciseLabelRef.current,
            stableFrame.keypoints,
            `Using local native rep counting for ${toDisplayExerciseName(
              confirmedExerciseLabelRef.current,
            )} while auto detection reconnects.`,
            coordinateDimensions,
          )
          : null;
      if (analyzeErrorMessageRef.current !== message) {
        analyzeErrorMessageRef.current = message;
        console.error("Native pose batch analyze failed");
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
      if (poseAnalysisRequestIdRef.current === analysisRequestId) {
        frameInFlightRef.current = false;
      }
    }
  };

  const handleToggleSubjectTracking = () => {
    const nextEnabled = !subjectTrackingEnabledRef.current;
    if (
      !isWebPoseRuntime &&
      nextEnabled &&
      nativeMultiPoseAvailable === false
    ) {
      showMessage("Subject tracking requires a new mobile build.");
      return;
    }
    bumpNativeStreamGeneration();
    pauseAutoFinishTiming();
    subjectTrackingEnabledRef.current = nextEnabled;
    setSubjectTrackingEnabled(nextEnabled);
    poseRuntimeErrorNotifiedRef.current = false;
    setNativeMultiPoseError(null);
    setNativeMultiPoseStatus(
      nextEnabled ? (isWebPoseRuntime ? "ready" : "starting") : "off",
    );
    subjectLockEpochRef.current += 1;
    subjectTrackerStateRef.current = createPoseSubjectTrackerState(
      nextEnabled ? "on" : "off",
      nativeStreamGenerationRef.current,
      nativeStreamIdRef.current,
    );
    selectedSubjectKeypointsRef.current = null;
    subjectLockDecisionRef.current = null;
    subjectLockedRef.current = false;
    setSubjectLocked(false);
    setSubjectLockRetained(false);
    setSubjectLockReady(false);
    setSubjectLockConfidence(null);
    resetRepEngineForSubjectLockWait();
    clearSubjectLockAnalysisBuffers();
    if (isWebPoseRuntime) {
      disposePoseAnalyzer();
    }
    setPoseStatusOverride(
      nextEnabled
        ? "Subject tracking is on. FitTrack will hold the same body when others enter the frame."
        : "Subject tracking is off. Keep one fresh body visible for counting.",
    );
  };

  const captureAndAnalyzeFrame = async (activePoseSessionId: string) => {
    if (
      !cameraContinuityActiveRef.current ||
      (typeof document !== "undefined" &&
        document.visibilityState === "hidden") ||
      poseReadInFlightRef.current ||
      countdownValueRef.current !== null ||
      isExerciseConfirmationVisibleRef.current
    ) {
      reportPoseDecision(!cameraContinuityActiveRef.current ? "camera_stream_paused"
        : poseReadInFlightRef.current ? "detector_busy"
        : countdownValueRef.current !== null ? "countdown"
        : isExerciseConfirmationVisibleRef.current ? "exercise_confirmation_pending" : "page_hidden");
      if (isExerciseConfirmationVisibleRef.current) {
        pauseAutoFinishTiming();
      }
      return;
    }

    if (!isWebPoseRuntime) {
      return;
    }

    const frameEpoch = subjectLockEpochRef.current;

    const analyzer = poseAnalyzerRef.current;
    if (!analyzer) {
      resetAutoFinishTiming();
      void ensurePoseAnalyzerReady().catch(() => undefined);
      return;
    }

    poseReadInFlightRef.current = true;
    let frame: Awaited<ReturnType<BrowserPoseAnalyzer["readFrame"]>>;
    try {
      frame = await analyzer.readFrame();
    } catch {
      if (
        frameEpoch !== subjectLockEpochRef.current ||
        activePoseSessionId !== poseSessionIdRef.current ||
        !isRecordingRef.current ||
        cameraRuntimeStateRef.current !== "tracking"
      ) {
        return;
      }
      pauseAutoFinishTiming();
      resetRepEngineForSubjectLockWait("detector_error");
      if (!poseRuntimeErrorNotifiedRef.current) {
        poseRuntimeErrorNotifiedRef.current = true;
        setPoseFeedback([
          "Pose tracking paused while the camera recovers.",
          "Keep the preview open and stay visible while FitTrack retries.",
          "Your set remains active; a detector error cannot finish it.",
        ]);
        setPoseStatusOverride(
          "Pose tracking paused. Keep the camera open while FitTrack retries.",
        );
      }
      return;
    } finally {
      poseReadInFlightRef.current = false;
    }
    if (
      frameEpoch !== subjectLockEpochRef.current ||
      activePoseSessionId !== poseSessionIdRef.current ||
      !isRecordingRef.current ||
      cameraRuntimeStateRef.current !== "tracking"
    ) {
      return;
    }
    if (!frame) {
      // A decoded frame may span several timer ticks; wait without adding
      // evidence. A sustained stall or an actual lost body invalidates the cycle.
      if (frame === undefined && Date.now() - latestBrowserFrameCapturedAtMsRef.current <= POSE_REP_MAX_FRAME_GAP_MS) return;
      resetRepEngineForSubjectLockWait(frame === undefined ? "camera_frame_stalled" : "no_pose");
      updateSubjectLockGesture(null, Date.now());
      pauseAutoFinishTiming();
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
          "Wait for a fresh landmark frame before expecting saved reps.",
        ]);
      }
      return;
    }
    if (frame.capturedAtMs <= latestBrowserFrameCapturedAtMsRef.current) {
      return;
    }
    latestBrowserFrameCapturedAtMsRef.current = frame.capturedAtMs;
    poseRuntimeErrorNotifiedRef.current = false;

    updateSubjectLockGesture(frame.keypoints, frame.capturedAtMs);
    canCountLockedSubject(
      frame.keypoints,
      frame.capturedAtMs,
      frame.candidates,
      subjectLockEpochRef.current,
      cameraRemountKey,
    );
    const selectedFrame = {
      ...frame,
      keypoints: selectedSubjectKeypointsRef.current ?? frame.keypoints,
      spatialKeypoints: frame.candidates.find(candidate => candidate.keypoints === selectedSubjectKeypointsRef.current)?.spatialKeypoints ?? frame.spatialKeypoints,
    };

    const coordinateDimensions = getPoseCoordinateDimensions(
      frame.frameWidth,
      frame.frameHeight,
    );
    publishPoseVisual(selectedFrame.keypoints, selectedFrame.capturedAtMs);
    if (frameEpoch !== subjectLockEpochRef.current) {
      return;
    }
    if (!subjectLockDecisionRef.current?.candidateFresh) {
      pauseAutoFinishTiming();
      poseFrameBufferRef.current = [];
      framesSinceAnalyzeRef.current = 0;
      poseSignalCacheRef.current.reset();
      resetRepEngineForSubjectLockWait("subject_frame_not_fresh", selectedFrame);
      setRepPathUnblocked(false);
      setPoseStatusOverride(
        "Waiting for a fresh landmark observation before counting can resume.",
      );
      return;
    }
    const instantSignals = poseSignalCacheRef.current.getInstant(
      selectedFrame,
      coordinateDimensions,
    );
    setLowConfidenceLandmarks(instantSignals.visibility.lowConfidenceLandmarks);

    if (cameraTarget && !movementContractRef.current) {
      const plannedContract = armPlannedMovementContract(
        selectedFrame.keypoints,
        `Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} tracking is ready.`,
        undefined,
        coordinateDimensions,
      );
      if (!plannedContract) {
        rejectPlannedMovementContract(cameraTarget.exerciseName);
        return;
      }
    }

    if (
      !cameraTarget &&
      !movementContractRef.current &&
      confirmedExerciseLabelRef.current
    ) {
      armFallbackMovementContract(
        confirmedExerciseLabelRef.current,
        selectedFrame.keypoints,
        `Local rep counting is armed for ${toDisplayExerciseName(
          confirmedExerciseLabelRef.current,
        )}.`,
        coordinateDimensions,
      );
    }

    const activeContract = movementContractRef.current;
    const movementAssessment = activeContract
      ? getPoseMovementFrameAssessment(
          activeContract,
          selectedFrame.keypoints,
          coordinateDimensions,
        )
      : null;
    const effectiveReliability = movementAssessment
      ? {
          isReliable: movementAssessment.isReliable,
        }
      : {
          isReliable: frame.isReliable,
        };
    setLowConfidenceLandmarks(
      movementAssessment?.lowConfidenceLandmarks ??
        instantSignals.visibility.lowConfidenceLandmarks,
    );

    if (!effectiveReliability.isReliable) {
      resetRepEngineForSubjectLockWait(movementAssessment?.reason ?? "required_landmarks_unreliable", selectedFrame);
      pauseAutoFinishTiming();
      poseFrameBufferRef.current = [];
      framesSinceAnalyzeRef.current = 0;
      if (activeContract) {
        setCurrentAngle(
          getPoseMovementContractAngle(
            activeContract,
            selectedFrame.keypoints,
            coordinateDimensions,
          ),
        );
      } else {
        setCurrentAngle(null);
      }
      setPoseStatusOverride(
        movementAssessment?.reason
          ? buildPoseNoCountStatusText(movementAssessment.reason)
          : TRACKING_UNRELIABLE_MESSAGE,
      );
      setPoseFeedback([
        movementAssessment?.reason
          ? buildPoseNoCountStatusText(movementAssessment.reason)
          : TRACKING_UNRELIABLE_MESSAGE,
        "Keep shoulders, hips, and at least one leg chain visible for live counting.",
        "The overlay stays live while the counter waits for a reliable full-body window.",
      ]);
      return;
    }

    trackingReliabilityNotifiedRef.current = false;
    poseFrameBufferRef.current = [...poseFrameBufferRef.current, selectedFrame].slice(
      -POSE_FRAME_WINDOW_SIZE,
    );
    framesSinceAnalyzeRef.current += 1;
    const bufferedFrames = poseFrameBufferRef.current.slice(
      -POSE_FRAME_WINDOW_SIZE,
    );
    const bufferedSignals = getBufferedPoseSignals(
      bufferedFrames,
      selectedFrame.capturedAtMs,
      coordinateDimensions,
    );
    const signals = bufferedSignals ?? instantSignals;
    setLowConfidenceLandmarks(movementAssessment?.lowConfidenceLandmarks ?? signals.visibility.lowConfidenceLandmarks);

    if (cameraRuntimeStateRef.current !== "tracking") {
      resetAutoFinishTiming();
      setPoseStatusOverride(
        cameraRuntimeStateRef.current === "saving"
          ? "Saving this set. Rep and analysis updates are paused."
          : cameraRuntimeStateRef.current === "rest"
            ? "Rest timer active. Local analysis is paused until the next set."
            : "Camera ready. Start the next planned set when you are positioned.",
      );
      reportPoseDecision("counting_not_started", {
        keypoints: selectedFrame.keypoints,
        spatialKeypoints: selectedFrame.spatialKeypoints,
        coordinateDimensions,
      }, undefined, selectedFrame.capturedAtMs);
      return;
    }

    setCameraFrameSize((current) => {
      const next = {
        height: frame.frameHeight,
        mirrorX: cameraFacing === "front",
        rotation: 0 as CameraRotation,
        width: frame.frameWidth,
      };
      return current &&
        current.width === next.width &&
        current.height === next.height &&
        current.mirrorX === next.mirrorX &&
        current.rotation === next.rotation
        ? current
        : next;
    });

    if (movementContractRef.current) {
      const liveAngle = getPoseFrameContractAngle(
        movementContractRef.current,
        selectedFrame,
        coordinateDimensions,
      );
      setCurrentAngle(liveAngle);
      if (!canCountLockedSubject(selectedFrame.keypoints, selectedFrame.capturedAtMs)) {
        pauseAutoFinishTiming();
        setRepPathUnblocked(false);
        resetRepEngineForSubjectLockWait("subject_tracking_wait", selectedFrame);
        setPoseFeedback(
          cameraTarget
            ? [
                "Body lost — get back in frame. Reacquiring automatically.",
                "Your counted reps are preserved while tracking pauses.",
              ]
              : [
                subjectLockedRef.current
                  ? "Tracking lost the selected body. Recenter and wait for tracking to resume."
                  : "Keep one clear body visible before rep counting starts.",
                "This prevents background pose jitter from creating phantom reps.",
                "Keep shoulders, hips, and one arm chain visible for tracking.",
              ],
        );
        setPoseStatusOverride(
          cameraTarget
            ? "Body lost — get back in frame. Reacquiring automatically."
            : subjectLockedRef.current
              ? "Tracking is unstable. Counting is paused until the body is visible again."
              : "Subject tracking is required before rep counting. The overlay can move, but reps stay paused.",
        );
        return;
      }

      if (movementContractRef.current.repModel === "static_hold") {
        updateStaticHoldFromFrame({
          capturedAtMs: selectedFrame.capturedAtMs,
          contract: movementContractRef.current,
          currentAngle: liveAngle,
          keypointFrames: bufferedFrames.map(
            (bufferedFrame) => bufferedFrame.keypoints,
          ),
          keypoints: selectedFrame.keypoints,
          spatialKeypoints: selectedFrame.spatialKeypoints,
          signals,
          statusPrefix: "Local hold tracking is live.",
          coordinateDimensions,
        });
        return;
      }

      const repStep = stepPoseRepEngine(
        repEngineStateRef.current,
        movementContractRef.current,
        liveAngle,
        selectedFrame.capturedAtMs,
        {
          exerciseDeclared: !!cameraTarget,
          rig: activeRigRef.current,
          spatialKeypoints: selectedFrame.spatialKeypoints,
          equipmentContext: poseEquipmentContext,
          equipmentSource: poseEquipmentSource,
          handShapeProfile: activeHandShapeProfileRef.current,
          keypointFrames: bufferedFrames.map(
            (bufferedFrame) => bufferedFrame.keypoints,
          ),
          keypoints: selectedFrame.keypoints,
          lowConfidenceLandmarks: signals.visibility.lowConfidenceLandmarks,
          signals,
          coordinateDimensions,
        },
      );
      repEngineStateRef.current = repStep.nextState;
      reportPoseDecision(repStep.noCountReason, {
        keypoints: selectedFrame.keypoints,
        spatialKeypoints: selectedFrame.spatialKeypoints,
        coordinateDimensions,
      }, undefined, selectedFrame.capturedAtMs);
      setCurrentPhase(repStep.nextState.phase);
      setRepPathUnblocked(!repStep.noCountReason);
      setTrackedReps(repStep.nextState.repCount);
      if (repStep.repCompleted) {
        beginAutoFinishTiming(
          repStep.nextState.lastRepCompletedAtMs ?? selectedFrame.capturedAtMs,
        );
      } else if (repStep.nextState.phase !== "primed") {
        pauseAutoFinishTiming();
      } else if (
        autoFinishPausedRef.current &&
        liveRepCountRef.current >= (activeSetSnapshotRef.current?.targetReps ?? cameraTarget?.targetReps ?? 0)
      ) {
        beginAutoFinishTiming(selectedFrame.capturedAtMs);
      }

      const guidanceTips = summarizeMovementGuidance(
        movementContractRef.current,
        selectedFrame.keypoints,
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
          ? buildPoseNoCountStatusText(repStep.noCountReason)
          : cameraTarget
            ? buildPlannedRepPhaseStatusText(
                movementContractRef.current,
                repStep.nextState.phase,
                repStep.repCompleted,
              )
            : `Local rep counting is live for ${toDisplayExerciseName(
                movementContractRef.current.exercise,
              )} at ${acceptedFps ?? 0} fps.`,
      );
      return;
    }

    if (
      bufferedFrames.length < POSE_MIN_ANALYZE_FRAMES ||
      framesSinceAnalyzeRef.current < POSE_FRAME_BATCH_TRIGGER ||
      frameInFlightRef.current
    ) {
      setPoseStatusOverride(
        `Collecting a ${POSE_MIN_ANALYZE_FRAMES}-frame movement window before live rep counting starts.`,
      );
      return;
    }

    const analysisRequestId = ++poseAnalysisRequestIdRef.current;
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

      if (
        frameEpoch !== subjectLockEpochRef.current ||
        activePoseSessionId !== poseSessionIdRef.current ||
        !isRecordingRef.current ||
        cameraRuntimeStateRef.current !== "tracking"
      ) {
        return;
      }

      framesSinceAnalyzeRef.current = 0;
      analyzeErrorMessageRef.current = null;
      averageConfidenceRef.current = analysis.confidence;
      if (subjectLockedRef.current && analysis.subjectLockConfidence !== null) {
        subjectLockConfidenceRef.current = analysis.subjectLockConfidence;
        setSubjectLockConfidence(analysis.subjectLockConfidence);
      }
      setExerciseConfirmationCandidates(analysis.candidateExercises);

      if (!cameraTarget && analysis.exerciseClass) {
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
        if (cameraTarget) {
          const plannedContract = armPlannedMovementContract(
            frame.keypoints,
            `Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} tracking is ready.`,
            undefined,
            coordinateDimensions,
          );
          if (plannedContract) return;
          rejectPlannedMovementContract(cameraTarget.exerciseName);
          return;
        }
        movementContractRef.current = null;
        setMovementContract(null);
        setCurrentAngle(null);
        setCurrentPhase("primed");
        setRepPathUnblocked(false);
        setIsExerciseConfirmationVisible(true);
        setPoseStatusOverride(
          "Confirm the live exercise label to resume auto rep counting.",
        );
        return;
      }

      if (cameraTarget) {
        const plannedContract = armPlannedMovementContract(
          frame.keypoints,
          `Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} tracking is ready.`,
          undefined,
          coordinateDimensions,
        );
        if (plannedContract) return;
        rejectPlannedMovementContract(cameraTarget.exerciseName);
        return;
      }

      const detectedCatalogExercise = findExerciseByDetectedName(
        resolvedExercises,
        analysis.exerciseClass,
      );
      const detectedConfiguredContract =
        detectedCatalogExercise?.movementProfile?.movementContract ?? null;
      const nextMovementContract = resolveCameraMovementContract(
        detectedConfiguredContract ??
          (analysis.movementContract &&
          isValidPoseMovementContract(analysis.movementContract)
            ? analysis.movementContract
            : null),
      );
      if (nextMovementContract) {
        const detectedIdentity =
          detectedCatalogExercise?.movementContractIdentity ??
          analysis.movementContractIdentity;
        const detectedProfile: ExerciseMovementProfileRecord = {
          ...(detectedCatalogExercise?.movementProfile ?? {
            movementContract: nextMovementContract,
            rig: null,
            schemaVersion: "exercise_movement_profile_v1",
            warnings: [],
          }),
          movementContract: nextMovementContract,
        };
        resetRepEngineForMovementContractChange(
          movementContractIdentityKey(detectedIdentity, detectedProfile),
        );
        movementContractRef.current = nextMovementContract;
        setMovementContract(nextMovementContract);
        setCurrentPhase("primed");
        setRepPathUnblocked(false);
        const liveAngle = getPoseMovementContractAngle(
          nextMovementContract,
          frame.keypoints,
          coordinateDimensions,
        );
        setCurrentAngle(liveAngle);
        const guidanceTips = summarizeMovementGuidance(
          nextMovementContract,
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
      if (
        frameEpoch !== subjectLockEpochRef.current ||
        activePoseSessionId !== poseSessionIdRef.current ||
        !isRecordingRef.current ||
        cameraRuntimeStateRef.current !== "tracking"
      ) {
        return;
      }
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Pose tracking could not analyze the latest keypoint batch.";
      const fallbackContract = cameraTarget
        ? armPlannedMovementContract(
            frame.keypoints,
            `Using the planned ${toDisplayExerciseName(cameraTarget.exerciseName)} counter while pose analysis reconnects.`,
            undefined,
            coordinateDimensions,
          )
        : confirmedExerciseLabelRef.current
          ? armFallbackMovementContract(
            confirmedExerciseLabelRef.current,
            frame.keypoints,
            `Using local rep counting for ${toDisplayExerciseName(
              confirmedExerciseLabelRef.current,
            )} while live pose analysis reconnects.`,
            coordinateDimensions,
          )
          : null;
      if (analyzeErrorMessageRef.current !== message) {
        analyzeErrorMessageRef.current = message;
        console.error("Pose analyze batch failed");
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
      if (poseAnalysisRequestIdRef.current === analysisRequestId) {
        frameInFlightRef.current = false;
      }
    }
  };

  const startFrameLoop = (activePoseSessionId: string | null) => {
    stopFrameLoop();
    if (!activePoseSessionId) return;
    if (!isWebPoseRuntime) {
      setPoseStatusOverride(
        cameraTarget
          ? `Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} is armed. Get in frame, then start the set.`
          : "Native landmark stream is armed. Move through 2-3 clean reps so auto detection can lock the exercise.",
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
    resetAutoFinishTiming();
    if (cameraTarget) {
      armPlannedMovementContract(
        currentKeypoints,
        `Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} tracking is ready.`,
        undefined,
        getPoseCoordinateDimensions(
          cameraFrameSize?.width,
          cameraFrameSize?.height,
        ),
      );
      return;
    }
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
    setCustomExerciseLabel("");
    setIsExerciseConfirmationVisible(false);
    if (!isWebPoseRuntime) {
      analyzeErrorMessageRef.current = null;
      const fallbackContract = armFallbackMovementContract(
        nextLabel,
        currentKeypoints,
        `Native landmark rep counting is armed for ${toDisplayExerciseName(nextLabel)}.`,
        getPoseCoordinateDimensions(
          cameraFrameSize?.width,
          cameraFrameSize?.height,
        ),
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
      getPoseCoordinateDimensions(
        cameraFrameSize?.width,
        cameraFrameSize?.height,
      ),
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
    resetAutoFinishTiming();
    if (cameraTarget) {
      armPlannedMovementContract(
        currentKeypoints,
        `Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} tracking is ready.`,
        undefined,
        getPoseCoordinateDimensions(
          cameraFrameSize?.width,
          cameraFrameSize?.height,
        ),
      );
      setIsExerciseModalOpen(false);
      return;
    }
    confirmedExerciseLabelRef.current = null;
    setConfirmedExerciseLabel(null);
    setDetectedExerciseName(null);
    resetWorkoutLoadInput();
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
    pauseAutoFinishTiming();
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

    cameraContinuityActiveRef.current = true;

    try {
      await ensurePoseAnalyzerReady();
      showMessage(
        isWebPoseRuntime
          ? "Camera and pose model are ready for live workout tracking."
          : "Camera is ready. Native landmarks should appear before or during recording.",
      );
    } catch {
      // Keep the preview mounted so a transient model/runtime failure can be
      // retried without closing the live workout screen. Frame processing is
      // paused by the status above until the next initialization/start.
      showMessage(
        "Camera opened, but the browser pose model could not load. Retry when ready.",
      );
    }
  };

  const ensureLiveWorkout = async () => {
    const requestTargetKey = getCameraTargetKey(cameraTarget);
    let requestedSessionId =
      cameraTarget?.sessionId ??
      workoutSessionId ??
      liveActiveSession?.id ??
      null;
    if (!requestedSessionId) {
      const startedSession = await startWorkoutSessionMutation.mutateAsync({
        input: {
          ...(preferredPlan?.id ? { planId: preferredPlan.id } : {}),
        },
        userId: user?.id,
      });
      setWorkoutSessionId(startedSession.id);
      requestedSessionId = startedSession.id;
    } else if (workoutSessionId !== requestedSessionId) {
      setWorkoutSessionId(requestedSessionId);
    }

    let nextPoseSessionId = poseSessionIdRef.current;
    if (nextPoseSessionId && cameraTarget && !matchesPlannedTrackingSnapshot(activeSetSnapshotRef.current, cameraTarget)) {
      throw new Error("The active pose session belongs to another set.");
    }
    if (!nextPoseSessionId && cameraActive && permissionGranted) {
      const startedPose = await startPoseSessionMutation.mutateAsync({
        input: {
          ...(cameraTarget ? {
            exerciseId: cameraTarget.exerciseId,
            workoutSessionId: requestedSessionId!,
            planExerciseId: cameraTarget.planExerciseId,
            setNumber: cameraTarget.setNumber,
            runtime: Platform.OS === "web" ? "web" as const : Platform.OS === "ios" ? "ios_native" as const : "android_native" as const,
          } : {}),
          ...(suggestedExerciseHint
            ? { exerciseHint: suggestedExerciseHint }
            : {}),
        },
      });
      if (currentTargetKeyRef.current !== requestTargetKey) throw new Error("The workout target changed while starting.");
      if (cameraTarget) {
        if (!matchesPlannedTrackingSnapshot(startedPose.trackingSnapshot, cameraTarget)) {
          throw new Error("The server did not return this set's tracking definition. Retry starting the set.");
        }
        activeSetSnapshotRef.current = startedPose.trackingSnapshot!;
        activeHandShapeProfileRef.current = startedPose.trackingSnapshot!.handShapeProfile;
        setActiveSetSnapshot(startedPose.trackingSnapshot!);
      }
      nextPoseSessionId = startedPose.poseSessionId;
      poseSessionIdRef.current = startedPose.poseSessionId;
      setPoseSessionId(startedPose.poseSessionId);
      setAcceptedFps(startedPose.acceptedFps);
    }

    return nextPoseSessionId;
  };

  const handleStartRecord = async () => {
    if (isFrozen || countdownValue !== null || startingSetRef.current) return;
    if (poseSessionIdRef.current) { await handleResumeRecord(); return; }
    if (!cameraActive || !permissionGranted) {
      showMessage("Initialize the camera before starting live tracking.");
      return;
    }

    startingSetRef.current = true;
    const requestTargetKey = getCameraTargetKey(cameraTarget);
    try {
      const latestExercises = await refreshWorkoutExerciseContracts();
      if (currentTargetKeyRef.current !== requestTargetKey) return;
      if (
        cameraTarget &&
        !resolveWorkoutExerciseContract({
          exerciseId: cameraTarget.exerciseId,
          exercises: latestExercises,
          label: cameraTarget.exerciseName,
        })
      ) {
        showMessage("Camera tracking is not available for this exercise. Use manual set logging.");
        return;
      }
      if (!cameraTarget && latestExercises.length === 0) {
        showMessage("The live exercise catalog is empty on this stack. Seed the workout catalog before starting tracked sets and EXP sync.");
        return;
      }
      await ensurePoseAnalyzerReady();
      const livePoseSessionId = await ensureLiveWorkout();
      if (!livePoseSessionId || currentTargetKeyRef.current !== requestTargetKey) return;
      resetAutoFinishTiming();
      resetPoseTrackingBuffers();
      resetPoseRuntimeState(true);
      if (cameraTarget) {
        const plannedContract = armPlannedMovementContract(
          null,
          `Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} tracking is armed. Get in frame to begin.`,
          latestExercises,
        );
        if (!plannedContract) {
          showMessage("This planned exercise is not supported for camera tracking. Use manual set logging.");
          return;
        }
      }
      setPoseFeedback([]);
      isRecordingRef.current = true;
      setIsRecording(true);
      setCameraRuntime("tracking");
      setIsExerciseConfirmationVisible(false);
      start();
      startFrameLoop(livePoseSessionId);
      showMessage("Live workout started.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Failed to start live workout. Retry.");
    } finally {
      startingSetRef.current = false;
    }
  };

  const handleResumeRecord = async () => {
    if (isFrozen || countdownValue !== null || startingSetRef.current) return;
    if (!cameraActive || !permissionGranted) {
      showMessage("Initialize the camera before resuming live tracking.");
      return;
    }

    startingSetRef.current = true;
    const requestTargetKey = getCameraTargetKey(cameraTarget);
    try {
      const hasSnapshot = matchesPlannedTrackingSnapshot(activeSetSnapshotRef.current, cameraTarget);
      const latestExercises = hasSnapshot ? resolvedExercises : await refreshWorkoutExerciseContracts();
      if (currentTargetKeyRef.current !== requestTargetKey) return;
      if (
        cameraTarget && !hasSnapshot &&
        !resolveWorkoutExerciseContract({
          exerciseId: cameraTarget.exerciseId,
          exercises: latestExercises,
          label: cameraTarget.exerciseName,
        })
      ) {
        showMessage("Camera tracking is not available for this exercise. Use manual set logging.");
        return;
      }
      if (!cameraTarget && latestExercises.length === 0) {
        showMessage("The live exercise catalog is empty on this stack. Seed the workout catalog before starting tracked sets and EXP sync.");
        return;
      }
      await ensurePoseAnalyzerReady();
      const livePoseSessionId = await ensureLiveWorkout();
      if (!livePoseSessionId || currentTargetKeyRef.current !== requestTargetKey) return;
      resetAutoFinishTiming();
      resetPoseTrackingBuffers();
      resetRepEngineForSubjectLockWait();
      if (cameraTarget) {
        armPlannedMovementContract(
          null,
          `Planned ${toDisplayExerciseName(cameraTarget.exerciseName)} tracking is armed. Get in frame to resume.`,
          latestExercises,
        );
      }
      isRecordingRef.current = true;
      setIsRecording(true);
      setCameraRuntime("tracking");
      resume();
      startFrameLoop(livePoseSessionId);
      showMessage("Workout resumed.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Failed to resume workout. Retry.");
    } finally {
      startingSetRef.current = false;
    }
  };

  const handlePause = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setCameraRuntime("ready");
    resetAutoFinishTiming();
    stopFrameLoop();
    resetPoseTrackingBuffers();
    resetRepEngineForSubjectLockWait();
    pause();
  };

  const handleExitCamera = () => {
    cameraContinuityActiveRef.current = false;
    invalidateSubjectLock("stopped");
    handlePause();
    cleanupCamera();
  };

  const handleStopRecord = () => {
    if (cameraTarget && !poseSessionIdRef.current) {
      showMessage("Start the set before finishing it.");
      return;
    }
    handlePause();
    setFinishVisible(true);
  };

  const handleFinishConfirm = async () => {
    if (isFinishing || isFinishingRef.current) return;
    if (cameraTarget && !poseSessionIdRef.current) {
      setFinishVisible(false);
      showMessage("Start the set before saving it.");
      return;
    }
    const targetKey = getCameraTargetKey(cameraTarget);
    if (targetKey) {
      const latch = completionLatchRef.current;
      if (latch?.key === targetKey && latch.status !== "idle") return;
      completionLatchRef.current = { key: targetKey, status: "saving" };
    }
    isFinishingRef.current = true;
    pauseAutoFinishTiming();
    setIsFinishing(true);
    setCameraRuntime("saving");
    stopFrameLoop();
    resetPoseTrackingBuffers();

    try {
      let finalizedReps = liveRepCountRef.current;
      const isStaticHoldTarget =
        movementContractRef.current?.repModel === "static_hold";
      const finalizedHoldSeconds = Math.max(
        0,
        Math.round(holdProgressSecondsRef.current),
      );
      let finalizedLoadInputKg: number | null = null;
      let finalizedDetectedExerciseName =
        cameraTarget?.exerciseName ??
        detectedExerciseName ??
        confirmedExerciseLabelRef.current ??
        null;
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
        const finalizedPose = await finalizePoseSessionMutation.mutateAsync({
          poseSessionId,
          input: {
            averageConfidence: averageConfidenceRef.current,
            detectedExerciseName: activeSetSnapshotRef.current?.movementProfile.movementContract?.exercise ?? finalizedDetectedExerciseName,
            endedReason: "session_completed",
            equipmentConfidence: finalizedDeclaredEquipmentContext
              ? 0.7
              : undefined,
            equipmentConflicts: [],
            equipmentContext: finalizedDeclaredEquipmentContext,
            equipmentSource: toEquipmentSource(
              confirmedExerciseLabelRef.current !== null,
              finalizedDeclaredEquipmentContext,
            ),
            finalRepCount: isStaticHoldTarget
              ? 0
              : isWebPoseRuntime
              ? repEngineStateRef.current.repCount
              : liveRepCountRef.current,
            formFeedback: poseFeedback,
            movementContract: movementContractRef.current,
            rawAngleData: repEngineStateRef.current.rawAngleData,
            weightInputKg: finalizedLoadInputKg,
          },
        });
        finalizedReps = isStaticHoldTarget ? 0 : finalizedPose.repCountAi;
        setTrackedReps(finalizedPose.repCountAi);
        finalizedDetectedExerciseName = cameraTarget?.exerciseName ??
          finalizedPose.detectedExerciseName ??
          detectedExerciseName ??
          confirmedExerciseLabelRef.current ??
          null;
        if (finalizedPose.detectedExerciseName && !cameraTarget) {
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

      const activeWorkoutId =
        cameraTarget?.sessionId ??
        workoutSessionId ??
        liveActiveSession?.id ??
        null;
      const finalizedTrackingLabel = cameraTarget?.exerciseName ??
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
      const loggedExercise = cameraTarget
        ? {
            exerciseId: cameraTarget.exerciseId,
            label: cameraTarget.exerciseName,
          }
        : detectedExerciseMatch ?? selectedExercise;
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
            durationSeconds: isStaticHoldTarget
              ? finalizedHoldSeconds
              : secondsRef.current,
            exerciseId: loggedExercise.exerciseId,
            ...(cameraTarget?.planExerciseId
              ? { planExerciseId: cameraTarget.planExerciseId }
              : {}),
            ...(poseSessionId ? { poseSessionId } : {}),
            ...(finalizedReps > 0 ? { repsCompleted: finalizedReps } : {}),
            ...(loggedWeightKg !== null ? { weightKg: loggedWeightKg } : {}),
            setNumber: cameraTarget?.setNumber ?? 1,
          },
        });
      }

      if (activeWorkoutId && cameraTarget?.completeWorkoutAfterSet) {
        await completeWorkoutSessionMutation.mutateAsync({
          planId: cameraTarget?.planId ?? preferredPlan?.id,
          sessionId: activeWorkoutId,
          userId: user?.id,
        });
      }

      const nextTarget = cameraTarget?.nextTarget ?? null;
      const keepCameraMounted =
        !!cameraTarget &&
        !cameraTarget.completeWorkoutAfterSet &&
        !!nextTarget;
      if (targetKey) {
        completionLatchRef.current = { key: targetKey, status: "saved" };
      }
      await refetchSessions();
      setFinishVisible(false);
      setIsRecording(false);
      setPoseSessionId(null);
      poseSessionIdRef.current = null;
      activeSetSnapshotRef.current = null;
      setActiveSetSnapshot(null);
      setAcceptedFps(null);
      setCustomExerciseLabel("");
      setExerciseConfirmationCandidates([]);
      setIsExerciseConfirmationVisible(false);
      resetPoseRuntimeState(true);
      resetPoseTrackingBuffers();
      if (keepCameraMounted && nextTarget) {
        pause();
        const exerciseChanged =
          nextTarget.exerciseId !== cameraTarget?.exerciseId;
        if (exerciseChanged) {
          setDetectedExerciseName(null);
          setConfirmedExerciseLabel(null);
          confirmedExerciseLabelRef.current = null;
          resetWorkoutLoadInput();
          setCameraRuntime(
            cameraTarget.restSeconds > 0 ? "rest" : "ready",
          );
          setPoseStatusOverride(
            cameraTarget.restSeconds > 0
              ? `Set saved. Rest ${cameraTarget.restSeconds}s before ${toDisplayExerciseName(nextTarget.exerciseName)}.`
              : `Ready for ${toDisplayExerciseName(nextTarget.exerciseName)}. Reposition, then start the next exercise.`,
          );
        } else {
          setCameraRuntime(
            cameraTarget.restSeconds > 0 ? "rest" : "ready",
          );
          setPoseStatusOverride(
            cameraTarget.restSeconds > 0
              ? `Set saved. Rest ${cameraTarget.restSeconds}s before set ${nextTarget.setNumber}.`
              : `Set saved. Start set ${nextTarget.setNumber} when ready.`,
          );
        }
      } else {
        cleanupCamera();
        cleanupTimer();
        reset();
        setWorkoutSessionId(null);
        setDetectedExerciseName(null);
        setConfirmedExerciseLabel(null);
        resetWorkoutLoadInput();
        confirmedExerciseLabelRef.current = null;
        setPoseStatusOverride(null);
        setSubjectLockState(false, null, "reset");
        setCameraRuntime("complete");
        disposePoseAnalyzer();
      }
      showMessage(
        loggedExercise
          ? cameraTarget
            ? keepCameraMounted
              ? `Set ${cameraTarget.setNumber} completed. ${
                  nextTarget && nextTarget.exerciseId === cameraTarget.exerciseId
                    ? `Rest ${cameraTarget.restSeconds}s before the next set.`
                    : `Ready for ${nextTarget?.exerciseName ?? "the next exercise"}.`
                }`
              : `Set ${cameraTarget.setNumber} completed.`
            : "Workout saved to the live fitness stack."
          : "The pose session ended, but no exercise reference was available for set logging.",
      );
      if (cameraTarget) {
        onCameraSetCompleted?.(cameraTarget);
      }
    } catch {
      if (targetKey) {
        completionLatchRef.current = { key: targetKey, status: "idle" };
      }
      autoCompletionKeyRef.current = null;
      setCameraRuntime("ready");
      showMessage("Failed to finish live workout.");
    } finally {
      isFinishingRef.current = false;
      setIsFinishing(false);
    }
  };

  autoFinalizeSetRef.current = () => {
    if (!cameraTarget || isFinishing || isFinishingRef.current) return;
    const isStaticHoldTarget =
      movementContractRef.current?.repModel === "static_hold";
    const isNormalRepTarget =
      !isStaticHoldTarget &&
      cameraTarget.targetReps > 0 &&
      liveRepCountRef.current >= cameraTarget.targetReps;
    if (!isStaticHoldTarget && !isNormalRepTarget) return;
    const completionKey = getCameraTargetKey(cameraTarget)!;
    if (autoCompletionKeyRef.current === completionKey) return;
    const latch = completionLatchRef.current;
    if (latch?.key === completionKey && latch.status !== "idle") return;
    autoCompletionKeyRef.current = completionKey;
    resetAutoFinishTiming();
    isRecordingRef.current = false;
    setIsRecording(false);
    stopFrameLoop();
    pause();
    showMessage(
      isStaticHoldTarget
        ? `${cameraTarget.targetDurationSeconds}s hold reached. Saving set ${cameraTarget.setNumber}...`
        : `Target reached. Saving set ${cameraTarget.setNumber}...`,
    );
    void handleFinishConfirm();
  };

  useEffect(() => {
    autoCompletionKeyRef.current = null;
  }, [
    cameraTarget?.planExerciseId,
    cameraTarget?.sessionId,
    cameraTarget?.setNumber,
  ]);

  const handleFinishCancel = () => {
    if (isFinishing) return;
    setFinishVisible(false);
    void handleResumeRecord();
  };

  useEffect(() => {
    return () => {
      cameraContinuityActiveRef.current = false;
      if (cameraSwitchTimerRef.current) {
        clearTimeout(cameraSwitchTimerRef.current);
        cameraSwitchTimerRef.current = null;
      }
      resetAutoFinishTiming();
      stopFrameLoop();
      invalidateSubjectLock("stopped");
      resetPoseTrackingBuffers();
      resetPoseRuntimeState(true);
      disposePoseAnalyzer();
      cleanupTimer();
      cleanupCamera();
    };
  }, [
    cleanupCamera,
    cleanupTimer,
    invalidateSubjectLock,
    resetAutoFinishTiming,
    resetPoseRuntimeState,
    resetPoseTrackingBuffers,
  ]);

  return {
    base,
    cameraTarget,
    cameraActive,
    cameraRuntimeState,
    autoFinishWarningSeconds,
    cameraFacing,
    cameraFrameSize,
    cameraRemountKey,
    nativeStreamGeneration,
    cameraRef,
    calories,
    colors: colors as IThemeContext["colors"],
    countdownValue,
    currentAngle,
    currentKeypoints,
    currentPhase,
    repPathUnblocked,
    currentPlanExerciseLabel: currentPlanExercise?.exerciseName ?? null,
    customExerciseLabel,
    exerciseConfirmationCandidates,
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
    feedbackItems:
      poseFeedback.length > 0
        ? poseFeedback
        : isWebPoseRuntime
          ? DEFAULT_POSE_FEEDBACK
          : NATIVE_POSE_FEEDBACK,
    finishVisible,
    hasStartedSet: poseSessionId !== null,
    holdProgressSeconds,
    holdValid,
    isExerciseConfirmationVisible,
    isExerciseModalOpen,
    isFinishing,
    isFrozen,
    isCameraSwitching,
    isPoseModelLoading,
    isRecording,
    message,
    movementContract: movementContract ? getRigMovementContract(movementContract, activeRigRef.current) : null,
    lowConfidenceLandmarks,
    onChangeCustomExerciseLabel: setCustomExerciseLabel,
    onCloseExerciseConfirmation: handleCloseExerciseConfirmation,
    onCloseExerciseModal: () => setIsExerciseModalOpen(false),
    onConfirmExerciseLabel: handleConfirmExerciseLabel,
    onFinishCancel: handleFinishCancel,
    onFinishConfirm: handleFinishConfirm,
    onInitCamera: handleInitCamera,
    onCameraContinuityChange: handleCameraContinuityChange,
    onMultiPoseAvailabilityChange: handleNativeMultiPoseAvailabilityChange,
    onMultiPoseStatusChange: handleNativeMultiPoseStatusChange,
    onExitCamera: handleExitCamera,
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
    onPause: handlePause,
    onResumeRecord: handleResumeRecord,
    onSelectExerciseReference: handleSelectExerciseReference,
    onStartRecord: handleStartRecord,
    onStopRecord: handleStopRecord,
    onToggleCameraFacing: handleToggleCameraFacing,
    onToggleSubjectTracking: handleToggleSubjectTracking,
    onToggleSubjectLock: handleToggleSubjectLock,
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
    subjectLockReady,
    subjectLockRetained,
    subjectLockStatusText,
    subjectLocked,
    subjectTrackingAvailable: isWebPoseRuntime ? true : nativeMultiPoseAvailable,
    subjectTrackingError: isWebPoseRuntime ? null : nativeMultiPoseError,
    subjectTrackingEnabled,
    subjectTrackingStatus: isWebPoseRuntime ? "ready" : nativeMultiPoseStatus,
    trackingOverlayLabel: trackingExerciseLabel,
    trackingDisabledReason,
    translateY,
  };
}
