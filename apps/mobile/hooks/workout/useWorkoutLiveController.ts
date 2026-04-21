import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraView } from "expo-camera";
import { ApiClientError } from "@fittrack/api-client";

import type {
  IThemeContext,
  PoseKeypointRecord,
  PoseMovementContractRecord,
} from "@fittrack/types";
import { EXERCISE_REFERENCES, type ExerciseReference } from "@/data/exercises";
import {
  buildFallbackPoseMovementContract,
  computePoseSignals,
  getPoseJointAngle,
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
  fitnessExercisesQueryOptions,
  fitnessPlanDetailQueryOptions,
  fitnessPlansQueryOptions,
  fitnessSessionsQueryOptions,
  finalizePoseSessionMutationOptions,
  logWorkoutSetMutationOptions,
  startPoseSessionMutationOptions,
  startWorkoutSessionMutationOptions
} from "@fittrack/query";
import { useTimedMessage } from "@fittrack/hooks";
import { makeScreenStyles, makeWorkoutStyles } from "@/styles/shared/ScreenStyles";
import { mobileApiClient } from "@/lib/api-client";
import {
  createBrowserPoseAnalyzer,
  type BrowserPoseAnalyzer
} from "@/lib/workout/browserPoseAnalyzer";
import {
  createPoseRepEngineState,
  stepPoseRepEngine,
} from "@/lib/workout/poseRepEngine";

type SelectedExercise = {
  exerciseId: string;
  label: string;
  muscleGroup: string;
  recommendation: string;
};

type LiveExerciseRecord = {
  category: string;
  description: string | null;
  id: string;
  instructions: string | null;
  muscleGroup: string;
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
  "Perform exercises with full range of motion"
];
const POSE_FRAME_WINDOW_SIZE = 20;
const POSE_FRAME_BATCH_TRIGGER = 4;
const POSE_MIN_ANALYZE_FRAMES = 20;
const WEB_ONLY_TRACKING_MESSAGE =
  "Live pose tracking currently runs on Expo web only while the on-device MediaPipe runtime is still pending.";
const TRACKING_UNRELIABLE_MESSAGE =
  "Pose tracking is waiting for a reliable movement window. Keep shoulders, hips, knees, and ankles visible to resume live counting.";
const EXERCISE_NAME_ALIAS_GROUPS = [
  ["barbell back squat", "back squat", "squat"],
  ["dumbbell bench press", "bench press", "dumbbell bench"],
  ["push up", "push-up", "pushup"],
  ["incline push up", "incline push-up", "incline pushup"],
  ["seated cable row", "cable row"],
  ["jump rope", "jump-rope", "jump rope"],
] as const;
const NORMALIZED_EXERCISE_ALIAS_GROUPS = EXERCISE_NAME_ALIAS_GROUPS.map((group) =>
  group.map((value) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
  )
);

function defaultPaginated<T>() {
  return {
    data: [] as T[],
    meta: { page: 1, limit: 0, total: 0, total_pages: 0 }
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
  exercises: LiveExerciseRecord[]
): SelectedExercise | null {
  if (currentPlanExercise) {
    return {
      exerciseId: currentPlanExercise.exerciseId,
      label: currentPlanExercise.exerciseName,
      muscleGroup: currentPlanExercise.muscleGroup,
      recommendation:
        currentPlanExercise.notes ??
        `Follow the ${currentPlanExercise.sets} x ${currentPlanExercise.reps ?? "timed"} plan prescription.`
    };
  }

  const firstExercise = exercises[0];
  if (!firstExercise) return null;
  return {
    exerciseId: firstExercise.id,
    label: firstExercise.name,
    muscleGroup: firstExercise.muscleGroup,
    recommendation:
      firstExercise.instructions ??
      firstExercise.description ??
      "Use controlled reps and keep your movement consistent."
  };
}

function toExerciseReferences(exercises: LiveExerciseRecord[]): ExerciseReference[] {
  return exercises.map((exercise) => ({
    id: exercise.id,
    level: toExerciseLevel(exercise.category),
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
    recommendation:
      exercise.instructions ??
      exercise.description ??
      "Use a controlled tempo and keep a consistent setup."
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
  return normalizeExerciseName(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

function mergeExerciseReferences(
  liveReferences: ExerciseReference[],
  fallbackReferences: ExerciseReference[] = EXERCISE_REFERENCES
) {
  const merged = new Map<string, ExerciseReference>();

  for (const reference of liveReferences) {
    merged.set(normalizeExerciseName(reference.name), reference);
  }

  for (const reference of fallbackReferences) {
    const normalizedName = normalizeExerciseName(reference.name);
    if (!normalizedName || merged.has(normalizedName)) continue;
    merged.set(normalizedName, reference);
  }

  return Array.from(merged.values());
}

function findExerciseByDetectedName(
  exercises: LiveExerciseRecord[],
  detectedName: string | null | undefined
): SelectedExercise | null {
  const detectedVariants = getExerciseNameVariants(detectedName);
  if (!detectedVariants.length) return null;

  const matchedExercise = exercises.find((exercise) => {
    const exerciseVariants = getExerciseNameVariants(exercise.name);
    return detectedVariants.some((variant) => exerciseVariants.includes(variant));
  });
  if (!matchedExercise) return null;
  return {
    exerciseId: matchedExercise.id,
    label: matchedExercise.name,
    muscleGroup: matchedExercise.muscleGroup,
    recommendation:
      matchedExercise.instructions ??
      matchedExercise.description ??
      "Use controlled reps and keep your movement consistent."
  };
}

function findExerciseReferenceByName(
  references: ExerciseReference[],
  exerciseName: string | null | undefined
) {
  const detectedVariants = getExerciseNameVariants(exerciseName);
  if (!detectedVariants.length) return null;

  return (
    references.find((reference) => {
      const referenceVariants = getExerciseNameVariants(reference.name);
      return detectedVariants.some((variant) => referenceVariants.includes(variant));
    }) ?? null
  );
}

function toPermissionGranted(permission: { granted?: boolean } | null | undefined) {
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
  const [isExerciseConfirmationVisible, setIsExerciseConfirmationVisible] = useState(false);
  const [exerciseConfirmationCandidates, setExerciseConfirmationCandidates] = useState<string[]>([]);
  const [customExerciseLabel, setCustomExerciseLabel] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [finishVisible, setFinishVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isPoseModelLoading, setIsPoseModelLoading] = useState(false);
  const [reps, setReps] = useState(0);
  const [currentKeypoints, setCurrentKeypoints] = useState<PoseKeypointRecord[] | null>(null);
  const [currentAngle, setCurrentAngle] = useState<number | null>(null);
  const [currentPhase, setCurrentPhase] = useState("primed");
  const [movementContract, setMovementContract] = useState<PoseMovementContractRecord | null>(null);
  const [lowConfidenceLandmarks, setLowConfidenceLandmarks] = useState<string[]>([]);
  const [poseFeedback, setPoseFeedback] = useState<string[]>([]);
  const [workoutSessionId, setWorkoutSessionId] = useState<string | null>(null);
  const [poseSessionId, setPoseSessionId] = useState<string | null>(null);
  const [acceptedFps, setAcceptedFps] = useState<number | null>(null);
  const [detectedExerciseName, setDetectedExerciseName] = useState<string | null>(null);
  const [confirmedExerciseLabel, setConfirmedExerciseLabel] = useState<string | null>(null);
  const [poseStatusOverride, setPoseStatusOverride] = useState<string | null>(null);
  const isFrozen = user?.status === "frozen";
  const isWebPoseRuntime = Platform.OS === "web";

  const cameraRef = useRef<CameraView | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameInFlightRef = useRef(false);
  const poseAnalyzerRef = useRef<BrowserPoseAnalyzer | null>(null);
  const poseAnalyzerPromiseRef = useRef<Promise<BrowserPoseAnalyzer> | null>(null);
  const poseFrameBufferRef = useRef<Array<{ capturedAtMs: number; keypoints: Array<{ visibility: number; x: number; y: number; z: number }> }>>([]);
  const framesSinceAnalyzeRef = useRef(0);
  const trackingReliabilityNotifiedRef = useRef(false);
  const confirmedExerciseLabelRef = useRef<string | null>(null);
  const movementContractRef = useRef<PoseMovementContractRecord | null>(null);
  const repEngineStateRef = useRef(createPoseRepEngineState());
  const averageConfidenceRef = useRef<number | null>(null);
  const analyzeErrorMessageRef = useRef<string | null>(null);

  const { secondsRef, start, resume, pause, reset, cleanup: cleanupTimer } = useWorkoutTimer();
  const {
    cameraActive,
    countdownValue,
    permission,
    initCamera,
    cleanupCamera
  } = useCameraCountdown();

  const {
    data: exercisesResponse = defaultPaginated<LiveExerciseRecord>(),
    isLoading: exercisesLoading
  } = useQuery({
    ...fitnessExercisesQueryOptions(mobileApiClient, { limit: 50, page: 1 }),
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 300_000
  });
  const {
    data: plansResponse = defaultPaginated<LivePlanSummaryRecord>(),
    isLoading: plansLoading
  } = useQuery({
    ...fitnessPlansQueryOptions(mobileApiClient, user?.id, { limit: 20, page: 1 }),
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 300_000
  });
  const preferredPlan = useMemo(
    () => plansResponse.data.find((plan) => plan.isActive) ?? plansResponse.data[0] ?? null,
    [plansResponse.data]
  );
  const { data: planDetail = null } = useQuery({
    ...fitnessPlanDetailQueryOptions(mobileApiClient, preferredPlan?.id),
    enabled: !!preferredPlan?.id,
    staleTime: 60_000,
    gcTime: 300_000
  });
  const {
    data: sessionsResponse = defaultPaginated<LiveWorkoutSessionRecord>(),
    refetch: refetchSessions
  } = useQuery({
    ...fitnessSessionsQueryOptions(mobileApiClient, user?.id, { limit: 10, page: 1 }),
    enabled: !!user?.id,
    staleTime: 30_000,
    gcTime: 300_000
  });

  const startWorkoutSessionMutation = useMutation(
    startWorkoutSessionMutationOptions(mobileApiClient, queryClient)
  );
  const logWorkoutSetMutation = useMutation(
    logWorkoutSetMutationOptions(mobileApiClient, queryClient)
  );
  const completeWorkoutSessionMutation = useMutation(
    completeWorkoutSessionMutationOptions(mobileApiClient, queryClient)
  );
  const startPoseSessionMutation = useMutation(
    startPoseSessionMutationOptions(mobileApiClient, queryClient)
  );
  const analyzePoseSessionMutation = useMutation(
    analyzePoseSessionMutationOptions(mobileApiClient)
  );
  const finalizePoseSessionMutation = useMutation(
    finalizePoseSessionMutationOptions(mobileApiClient, queryClient)
  );

  const currentPlanExercise = useMemo(() => {
    if (!planDetail) return null;
    const sortedDays = [...planDetail.scheduleDays].sort((left, right) => {
      if (left.weekNumber !== right.weekNumber) return left.weekNumber - right.weekNumber;
      return left.dayOfWeek - right.dayOfWeek;
    });
    const firstDay = sortedDays[0];
    if (!firstDay) return null;
    return [...firstDay.exercises].sort((left, right) => left.orderIndex - right.orderIndex)[0] ?? null;
  }, [planDetail]);

  const selectedExercise = useMemo(
    () => toSelectedExercise(currentPlanExercise, exercisesResponse.data),
    [currentPlanExercise, exercisesResponse.data]
  );
  const liveExerciseReferences = useMemo(
    () => toExerciseReferences(exercisesResponse.data),
    [exercisesResponse.data]
  );
  const exerciseReferences = useMemo(
    () => mergeExerciseReferences(liveExerciseReferences),
    [liveExerciseReferences]
  );
  const savedExerciseOptions = useMemo(
    () => toSavedExerciseOptions(exerciseReferences),
    [exerciseReferences]
  );
  const trackingExerciseLabel =
    confirmedExerciseLabel ?? movementContract?.exercise ?? detectedExerciseName ?? null;
  const trackingExerciseReference = useMemo(
    () => findExerciseReferenceByName(exerciseReferences, trackingExerciseLabel),
    [exerciseReferences, trackingExerciseLabel]
  );
  const planExerciseReference = useMemo(
    () => findExerciseReferenceByName(exerciseReferences, currentPlanExercise?.exerciseName ?? selectedExercise?.label),
    [currentPlanExercise?.exerciseName, exerciseReferences, selectedExercise?.label]
  );
  const trackingDisabledReason = useMemo(() => {
    if (!isWebPoseRuntime) return WEB_ONLY_TRACKING_MESSAGE;
    if (exercisesLoading) return null;
    if (exerciseReferences.length > 0) return null;
    return "The live exercise catalog is empty on this stack. Seed the workout catalog before starting tracked sets and EXP sync.";
  }, [exerciseReferences.length, exercisesLoading, isWebPoseRuntime]);
  const liveActiveSession = useMemo(
    () => sessionsResponse.data.find((session) => session.status === "in_progress") ?? null,
    [sessionsResponse.data]
  );
  const seconds = secondsRef.current;
  const calories = useMemo(
    () => Math.round((seconds / 60) * 6 + reps * 0.4),
    [reps, seconds]
  );
  const permissionGranted = toPermissionGranted(permission);

  useEffect(() => {
    if (liveActiveSession?.id && !workoutSessionId) {
      setWorkoutSessionId(liveActiveSession.id);
    }
  }, [liveActiveSession, workoutSessionId]);

  const resetPoseTrackingBuffers = () => {
    poseFrameBufferRef.current = [];
    framesSinceAnalyzeRef.current = 0;
    trackingReliabilityNotifiedRef.current = false;
    frameInFlightRef.current = false;
  };

  const resetPoseRuntimeState = (clearReps: boolean) => {
    movementContractRef.current = null;
    repEngineStateRef.current = createPoseRepEngineState();
    averageConfidenceRef.current = null;
    setMovementContract(null);
    setCurrentAngle(null);
    setCurrentKeypoints(null);
    setCurrentPhase("primed");
    setLowConfidenceLandmarks([]);
    if (clearReps) {
      setReps(0);
    }
  };

  const armFallbackMovementContract = (
    exerciseLabel: string | null | undefined,
    frameKeypoints: PoseKeypointRecord[] | null,
    statusText: string
  ) => {
    const fallbackContract = buildFallbackPoseMovementContract(exerciseLabel);
    if (!fallbackContract) {
      return null;
    }

    const previousState = repEngineStateRef.current;
    repEngineStateRef.current = {
      ...createPoseRepEngineState(),
      rawAngleData: previousState.rawAngleData,
      repCount: previousState.repCount
    };
    movementContractRef.current = fallbackContract;
    setMovementContract(fallbackContract);
    setCurrentPhase("primed");
    setCurrentAngle(
      frameKeypoints
        ? getPoseJointAngle(frameKeypoints, fallbackContract.dominantJoint)
        : null
    );
    setPoseFeedback([
      `Local ${toDisplayExerciseName(fallbackContract.exercise)} counting is active.`,
      "Keep shoulders, hips, knees, and ankles visible to the camera.",
      "Controlled half reps can still count once the joint angle cycles through the range."
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
      throw new Error(WEB_ONLY_TRACKING_MESSAGE);
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
      setPoseStatusOverride("The browser pose model failed to load on this session.");
      throw error;
    }
  };

  const captureAndAnalyzeFrame = useEffectEvent(async (activePoseSessionId: string) => {
    if (frameInFlightRef.current || countdownValue !== null || isExerciseConfirmationVisible) {
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
          "Wait for the live counter to resume before expecting saved reps."
        ]);
      }
      return;
    }

    setCurrentKeypoints(frame.keypoints);
    const instantSignals = computePoseSignals([frame]);
    setLowConfidenceLandmarks(instantSignals.visibility.lowConfidenceLandmarks);

    if (!frame.isReliable) {
      poseFrameBufferRef.current = [];
      framesSinceAnalyzeRef.current = 0;
      if (movementContractRef.current) {
        setCurrentAngle(
          getPoseJointAngle(frame.keypoints, movementContractRef.current.dominantJoint)
        );
      } else {
        setCurrentAngle(null);
      }
      setPoseStatusOverride(TRACKING_UNRELIABLE_MESSAGE);
      setPoseFeedback([
        TRACKING_UNRELIABLE_MESSAGE,
        "Keep shoulders, hips, and at least one leg chain visible for live counting.",
        "The overlay stays live while the counter waits for a reliable full-body window."
      ]);
      return;
    }

    trackingReliabilityNotifiedRef.current = false;
    poseFrameBufferRef.current = [...poseFrameBufferRef.current, frame].slice(-POSE_FRAME_WINDOW_SIZE);
    framesSinceAnalyzeRef.current += 1;
    const bufferedFrames = poseFrameBufferRef.current.slice(-POSE_FRAME_WINDOW_SIZE);
    const signals = computePoseSignals(bufferedFrames);
    setLowConfidenceLandmarks(signals.visibility.lowConfidenceLandmarks);

    if (movementContractRef.current) {
      const liveAngle = getPoseJointAngle(
        frame.keypoints,
        movementContractRef.current.dominantJoint
      );
      setCurrentAngle(liveAngle);
      const repStep = stepPoseRepEngine(
        repEngineStateRef.current,
        movementContractRef.current,
        liveAngle,
        frame.capturedAtMs
      );
      repEngineStateRef.current = repStep.nextState;
      setCurrentPhase(repStep.nextState.phase);
      setReps(repStep.nextState.repCount);

      const guidanceTips = summarizeMovementGuidance(
        movementContractRef.current,
        frame.keypoints,
        repStep.nextState.phase,
        signals.visibility.lowConfidenceLandmarks
      );
      setPoseFeedback(
        guidanceTips.length > 0
          ? guidanceTips.slice(0, 3)
          : DEFAULT_POSE_FEEDBACK
      );
      setPoseStatusOverride(
        `Local rep counting is live for ${toDisplayExerciseName(
          movementContractRef.current.exercise
        )} at ${acceptedFps ?? 0} fps.`
      );
      return;
    }

    if (
      bufferedFrames.length < POSE_MIN_ANALYZE_FRAMES ||
      framesSinceAnalyzeRef.current < POSE_FRAME_BATCH_TRIGGER
    ) {
      setPoseStatusOverride(
        `Collecting a ${POSE_MIN_ANALYZE_FRAMES}-frame movement window before live rep counting starts.`
      );
      return;
    }

    frameInFlightRef.current = true;
    try {
      const exerciseHint =
        confirmedExerciseLabelRef.current ?? null;
      const analysis = await analyzePoseSessionMutation.mutateAsync({
        poseSessionId: activePoseSessionId,
        input: {
          cameraFacingMode: analyzer.getFacingMode(),
          exerciseHint,
          frames: bufferedFrames,
          landmarkSchema: "mediapipe_pose_v1",
          signals
        }
      });

      framesSinceAnalyzeRef.current = 0;
      analyzeErrorMessageRef.current = null;
      averageConfidenceRef.current = analysis.confidence;
      setExerciseConfirmationCandidates(analysis.candidateExercises);

      if (analysis.exerciseClass) {
        setDetectedExerciseName(analysis.exerciseClass);
      }

      if (analysis.formFeedback.length > 0) {
        setPoseFeedback(analysis.formFeedback.slice(0, 3));
      }

      if (analysis.needsConfirmation) {
        movementContractRef.current = null;
        setMovementContract(null);
        setCurrentAngle(null);
        setCurrentPhase("primed");
        setIsExerciseConfirmationVisible(true);
        setPoseStatusOverride("Confirm the live exercise label to resume auto rep counting.");
        return;
      }

      if (analysis.movementContract) {
        movementContractRef.current = analysis.movementContract;
        setMovementContract(analysis.movementContract);
        setCurrentPhase("primed");
        const liveAngle = getPoseJointAngle(
          frame.keypoints,
          analysis.movementContract.dominantJoint
        );
        setCurrentAngle(liveAngle);
        const guidanceTips = summarizeMovementGuidance(
          analysis.movementContract,
          frame.keypoints,
          "primed",
          signals.visibility.lowConfidenceLandmarks
        );
        setPoseFeedback(
          guidanceTips.length > 0
            ? guidanceTips.slice(0, 3)
            : analysis.formFeedback.slice(0, 3)
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
          : `Pose contract ready. Local rep counting is armed at ${acceptedFps ?? 0} fps.`
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
              confirmedExerciseLabelRef.current
            )} while live pose analysis reconnects.`
          )
        : null;
      if (analyzeErrorMessageRef.current !== message) {
        analyzeErrorMessageRef.current = message;
        console.error("Pose analyze batch failed", error);
        showMessage(
          fallbackContract
            ? `Switched ${toDisplayExerciseName(fallbackContract.exercise)} to the local counter.`
            : "Pose analysis paused. Confirm the exercise to continue local counting."
        );
      }
      if (!fallbackContract) {
        setPoseFeedback([
          "Pose analysis is temporarily unavailable.",
          "Confirm the exercise to keep local rep counting active.",
          "Choose Push-Up to keep conventional push-ups counting locally."
        ]);
        setPoseStatusOverride(
          "Pose analysis paused. Confirm the exercise to continue local rep counting."
        );
        setIsExerciseConfirmationVisible(true);
      }
    } finally {
      frameInFlightRef.current = false;
    }
  });

  const startFrameLoop = (activePoseSessionId: string | null) => {
    stopFrameLoop();
    if (!activePoseSessionId) return;
    const intervalMs = Math.max(120, Math.round(1000 / Math.max(acceptedFps ?? 8, 1)));
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

    confirmedExerciseLabelRef.current = nextLabel;
    setConfirmedExerciseLabel(nextLabel);
    setDetectedExerciseName(nextLabel);
    setCustomExerciseLabel("");
    setIsExerciseConfirmationVisible(false);
    const fallbackContract = armFallbackMovementContract(
      nextLabel,
      currentKeypoints,
      `Local rep counting is armed for ${toDisplayExerciseName(nextLabel)} at ${acceptedFps ?? 0} fps.`
    );
    if (!fallbackContract) {
      movementContractRef.current = null;
      setMovementContract(null);
      setCurrentAngle(null);
      setCurrentPhase("primed");
      framesSinceAnalyzeRef.current = POSE_FRAME_BATCH_TRIGGER;
      setPoseStatusOverride(`Tracking ${toDisplayExerciseName(nextLabel)} on the next live batch.`);
    }
    showMessage(`Exercise confirmed: ${toDisplayExerciseName(nextLabel)}.`);
  };

  const handleSelectExerciseReference = (label: string) => {
    handleConfirmExerciseLabel(label);
    setIsExerciseModalOpen(false);
  };

  const handleUseAutoDetection = () => {
    confirmedExerciseLabelRef.current = null;
    setConfirmedExerciseLabel(null);
    setDetectedExerciseName(null);
    setCustomExerciseLabel("");
    movementContractRef.current = null;
    setMovementContract(null);
    setCurrentAngle(null);
    setCurrentPhase("primed");
    analyzeErrorMessageRef.current = null;
    framesSinceAnalyzeRef.current = POSE_FRAME_BATCH_TRIGGER;
    setPoseStatusOverride("Auto detection will choose the next visible movement batch.");
    setPoseFeedback([
      "Auto detection is active again.",
      "If the exercise label drifts, tap Exercise References and lock the preset manually.",
      "Choose Push-Up manually anytime if you want the counter pinned to push-ups."
    ]);
    setIsExerciseModalOpen(false);
    showMessage("Auto detection resumed.");
  };

  const handleCloseExerciseConfirmation = () => {
    setIsExerciseConfirmationVisible(false);
    setPoseStatusOverride("Rep tracking stays paused until the exercise is confirmed.");
    showMessage("Rep tracking is paused until the exercise is confirmed.");
  };

  const handleInitCamera = async () => {
    if (!isWebPoseRuntime) {
      showMessage(WEB_ONLY_TRACKING_MESSAGE);
      return;
    }

    const initialized = await initCamera(isFrozen);
    if (!isFrozen && !initialized) {
      showMessage("Camera permission is required before live tracking can start.");
      return;
    }

    if (!initialized) return;

    try {
      await ensurePoseAnalyzerReady();
      showMessage("Camera and pose model are ready for live workout tracking.");
    } catch {
      cleanupCamera();
      showMessage("Camera opened, but the browser pose model could not load.");
    }
  };

  const ensureLiveWorkout = async () => {
    let nextWorkoutSessionId = workoutSessionId ?? liveActiveSession?.id ?? null;
    if (!nextWorkoutSessionId) {
      const startedSession = await startWorkoutSessionMutation.mutateAsync({
        input: {
          ...(preferredPlan?.id ? { planId: preferredPlan.id } : {})
        },
        userId: user?.id
      });
      nextWorkoutSessionId = startedSession.id;
      setWorkoutSessionId(startedSession.id);
    }

    let nextPoseSessionId = poseSessionId;
    if (!nextPoseSessionId && cameraActive && permissionGranted) {
      const startedPose = await startPoseSessionMutation.mutateAsync({
        input: {
          ...(confirmedExerciseLabelRef.current
            ? { exerciseHint: confirmedExerciseLabelRef.current }
            : {})
        }
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
      let finalizedDetectedExerciseName =
        detectedExerciseName ?? confirmedExerciseLabelRef.current ?? null;
      if (poseSessionId) {
        const finalizedPose = await finalizePoseSessionMutation.mutateAsync({
          poseSessionId,
          input: {
            averageConfidence: averageConfidenceRef.current,
            detectedExerciseName: finalizedDetectedExerciseName,
            endedReason: "session_completed",
            finalRepCount: repEngineStateRef.current.repCount,
            formFeedback: poseFeedback,
            movementContract: movementContractRef.current,
            rawAngleData: repEngineStateRef.current.rawAngleData,
          }
        });
        finalizedReps = finalizedPose.repCountAi;
        setReps(finalizedPose.repCountAi);
        finalizedDetectedExerciseName =
          finalizedPose.detectedExerciseName ??
          detectedExerciseName ??
          confirmedExerciseLabelRef.current ??
          null;
        if (finalizedPose.detectedExerciseName) {
          setDetectedExerciseName(finalizedPose.detectedExerciseName);
        }
        const feedback = Array.isArray(finalizedPose.analysisSummary?.form_feedback)
          ? finalizedPose.analysisSummary.form_feedback.filter(
              (entry): entry is string => typeof entry === "string"
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
        findExerciseByDetectedName(exercisesResponse.data, finalizedTrackingLabel) ??
        findExerciseByDetectedName(exercisesResponse.data, finalizedDetectedExerciseName) ??
        findExerciseByDetectedName(exercisesResponse.data, confirmedExerciseLabelRef.current);
      const loggedExercise = detectedExerciseMatch ?? selectedExercise;
      if (activeWorkoutId && loggedExercise) {
        await logWorkoutSetMutation.mutateAsync({
          sessionId: activeWorkoutId,
          userId: user?.id,
          input: {
            durationSeconds: secondsRef.current,
            exerciseId: loggedExercise.exerciseId,
            ...(poseSessionId ? { poseSessionId } : {}),
            ...(finalizedReps > 0 ? { repsCompleted: finalizedReps } : {}),
            setNumber: 1
          }
        });
      }

      if (activeWorkoutId) {
        await completeWorkoutSessionMutation.mutateAsync({
          sessionId: activeWorkoutId,
          userId: user?.id
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
      confirmedExerciseLabelRef.current = null;
      setCustomExerciseLabel("");
      setExerciseConfirmationCandidates([]);
      setIsExerciseConfirmationVisible(false);
      setPoseStatusOverride(null);
      resetPoseRuntimeState(true);
      disposePoseAnalyzer();
      showMessage(
        loggedExercise
          ? "Workout saved to the live fitness stack."
          : "Workout session closed, but no exercise reference was available for set logging."
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
    exerciseFocusText: trackingExerciseLabel
      ? `Tracking: ${toDisplayExerciseName(trackingExerciseLabel)}${trackingExerciseReference ? ` - ${trackingExerciseReference.muscleGroup}` : ""}`
      : currentPlanExercise?.exerciseName
        ? `Plan suggests: ${toDisplayExerciseName(currentPlanExercise.exerciseName)}${planExerciseReference ? ` - ${planExerciseReference.muscleGroup}` : ""}`
      : exercisesLoading
        ? "Loading live exercise library..."
        : "Auto detection is active. Lock a preset if you want to force a specific exercise.",
    exerciseModalEmptyMessage: selectedExercise || exercisesLoading
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
    feedbackItems: poseFeedback.length > 0 ? poseFeedback : DEFAULT_POSE_FEEDBACK,
    finishVisible,
    isExerciseConfirmationVisible,
    isExerciseModalOpen,
    isFinishing,
    isFrozen,
    isPoseModelLoading,
    isRecording,
    message,
    movementContract,
    lowConfidenceLandmarks,
    onChangeCustomExerciseLabel: setCustomExerciseLabel,
    onCloseExerciseConfirmation: handleCloseExerciseConfirmation,
    onCloseExerciseModal: () => setIsExerciseModalOpen(false),
    onConfirmExerciseLabel: handleConfirmExerciseLabel,
    onFinishCancel: handleFinishCancel,
    onFinishConfirm: handleFinishConfirm,
    onInitCamera: handleInitCamera,
    onOpenExerciseModal: () => setIsExerciseModalOpen(true),
    onPause: handlePause,
    onResumeRecord: handleResumeRecord,
    onSelectExerciseReference: handleSelectExerciseReference,
    onStartRecord: handleStartRecord,
    onStopRecord: handleStopRecord,
    onUseAutoDetection: handleUseAutoDetection,
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
    poseStatusText: poseStatusOverride
      ? poseStatusOverride
      : poseSessionId
        ? movementContract
          ? `Local rep counting is active for ${toDisplayExerciseName(movementContract.exercise)} at ${acceptedFps ?? 0} fps.`
          : confirmedExerciseLabel
            ? `Pose tracking is live for ${toDisplayExerciseName(confirmedExerciseLabel)} at ${acceptedFps ?? 0} fps.`
            : `Pose tracking is live at ${acceptedFps ?? 0} fps.`
        : trackingDisabledReason
          ? trackingDisabledReason
          : !permissionGranted
            ? "Camera permission is required for pose tracking."
            : cameraActive
              ? "Pose session will start with the next recording pass."
              : "Initialize the camera to unlock the live pose path.",
    reps,
    s,
    savedExerciseOptions,
    seconds,
    sessionStatusText:
      liveActiveSession || workoutSessionId
        ? `Workout session ${workoutSessionId ?? liveActiveSession?.id ?? ""} is ready.`
        : "No in-progress workout session yet.",
    trackingOverlayLabel: trackingExerciseLabel,
    trackingDisabledReason,
    translateY
  };
}
