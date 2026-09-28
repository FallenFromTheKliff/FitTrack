"use client";

import {
  Camera,
  CheckCircle2,
  CircleStop,
  Info,
  Play,
  RotateCcw,
  VideoOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  PoseKeypointRecord,
} from "@fittrack/api-client";
import type {
  PoseEquipmentContext,
  PoseEquipmentSource,
} from "@fittrack/types";
import {
  advancePoseSubjectTracker,
  createPoseSignalCache,
  createPoseDiagnostics,
  createPoseSubjectTrackerState,
  getPoseMovementFrameAssessment,
  getPoseMovementContractAngle,
  getPoseFrameContractAngle,
  getPoseFrameGeometry,
  POSE_SUBJECT_TRACKER_FRESHNESS_MS,
  resetPoseSubjectTrackerState,
  type PoseCoordinateDimensions,
  type PoseSubjectTrackerState,
} from "@fittrack/utils";
import {
  createPoseRepEngineState,
  getPoseRepProgressText,
  stepPoseRepEngine,
  stepPoseStaticHold,
  type PoseRepEngineEvidence,
  type PoseRepEngineState,
} from "@fittrack/utils/pose-rep-engine";

import { FitButton, FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";

import { RIG_BONES, clamp } from "./ExerciseContractEditorShared";
import {
  createExerciseCameraPoseAnalyzer,
  type ExerciseCameraPoseAnalyzer,
  type ExerciseCameraPoseFrame,
} from "./exerciseCameraPoseAnalyzer";
import {
  classifyExerciseCameraError,
  exerciseCameraModelError,
  formatExerciseCameraErrorLabel,
  type ExerciseCameraErrorKind,
} from "./exerciseCameraErrors";

type CameraState = "idle" | "requesting" | "live" | "denied" | "unavailable";

const CAMERA_IDLE_MESSAGE =
  "Camera access is optional and never blocks publishing.";

// Match the working mobile single-person path; crowd locking is optional work.
const PREVIEW_SUBJECT_TRACKING_MODE = "off" as const;

const CAMERA_EQUIPMENT_OPTIONS: Array<{
  label: string;
  value: PoseEquipmentContext;
}> = [
  { label: "Unknown", value: "unknown" },
  { label: "Bodyweight", value: "bodyweight" },
  { label: "Dumbbell", value: "dumbbell" },
  { label: "Barbell", value: "barbell" },
  { label: "Cable", value: "cable" },
  { label: "Machine", value: "machine" },
  { label: "Kettlebell", value: "kettlebell" },
  { label: "Band", value: "band" },
  { label: "Bench", value: "bench" },
  { label: "Mixed", value: "mixed" },
];

type ExerciseLabLiveCameraValidationProps = {
  exerciseName: string;
  handShapeProfile: ExerciseHandShapeProfileRecord | null;
  movementProfile: ExerciseMovementProfileRecord | null;
  onAdjust?: (target: "movement" | "hand" | "tracking") => void;
  summaryTarget?: HTMLElement | null;
};

function getKeypointPosition(point: PoseKeypointRecord | undefined) {
  if (!point || point.visibility < 0.1) return null;
  return {
    x: clamp(point.x, -0.2, 1.2) * 100,
    y: clamp(point.y, -0.2, 1.2) * 100,
  };
}

function interpolatePoint(
  start: PoseKeypointRecord | undefined,
  end: PoseKeypointRecord | undefined,
  progress: number,
) {
  if (!start && !end) return undefined;
  if (!start) return end;
  if (!end) return start;
  return {
    visibility:
      start.visibility + (end.visibility - start.visibility) * progress,
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
    z: start.z + (end.z - start.z) * progress,
  };
}

function interpolateKeypoints(
  start: PoseKeypointRecord[],
  end: PoseKeypointRecord[],
  progress: number,
) {
  const length = Math.max(start.length, end.length);
  return Array.from({ length }, (_, index) =>
    interpolatePoint(start[index], end[index], progress),
  );
}

function getPreviewKeypoints(
  keyframes: NonNullable<ExerciseMovementProfileRecord["rig"]>["keyframes"],
  progress: number,
) {
  const start = keyframes.find((frame) => frame.kind === "start") ?? keyframes[0];
  const peak =
    keyframes.find((frame) => frame.kind === "peak") ??
    keyframes[Math.min(1, keyframes.length - 1)] ??
    start;
  const end =
    keyframes.find((frame) => frame.kind === "end") ??
    keyframes[keyframes.length - 1] ??
    peak;
  if (!start || !peak || !end) return [];
  if (progress <= 0.5) {
    return interpolateKeypoints(
      start.keypoints,
      peak.keypoints,
      progress * 2,
    );
  }
  return interpolateKeypoints(
    peak.keypoints,
    end.keypoints,
    (progress - 0.5) * 2,
  );
}

function getPhaseLabel(
  keyframes: NonNullable<ExerciseMovementProfileRecord["rig"]>["keyframes"],
  progress: number,
) {
  const start = keyframes.find((frame) => frame.kind === "start");
  const peak = keyframes.find((frame) => frame.kind === "peak");
  const end = keyframes.find((frame) => frame.kind === "end");
  if (progress < 0.12) return start?.label || "Start";
  if (progress < 0.52) return peak?.label || "Peak";
  return end?.label || "Return";
}

function formatCameraState(state: CameraState) {
  switch (state) {
    case "requesting":
      return "requesting";
    case "live":
      return "live";
    case "denied":
      return "denied";
    case "unavailable":
      return "unavailable";
    default:
      return "idle";
  }
}

function formatNoCountReason(reason: string | null) {
  switch (reason) {
    case "movement_contract_incomplete":
      return "Movement contract is incomplete; no reps are counted.";
    case "unavailable_primary_angle":
      return "The primary movement angle is unavailable.";
    case "tracking_confidence_below_contract":
      return "Landmark confidence is below this draft contract.";
    case "required_landmarks_unreliable":
      return "Required landmarks are not reliable enough for this draft.";
    case "tracking_landmark_count_below_contract":
      return "Too few reliable landmarks are visible for this draft.";
    case "pose_keypoints_missing":
      return "Pose landmarks are unavailable for this draft.";
    case "tracking_requirements_invalid":
      return "Tracking requirements are invalid; no reps are counted.";
    case "invalid_contract":
      return "Movement contract is invalid; no reps are counted.";
    case "phase_acceptance_bands_overlap":
    case "phase_acceptance_bands_too_close":
      return "Rep threshold bands must stay separated.";
    case "phase_order_unsupported":
    case "phase_order_invalid":
      return "The configured phase order is unsupported.";
    case "evidence_insufficient":
      return "Movement evidence is insufficient for this contract.";
    case "static_hold_angle_out_of_range":
      return "Hold paused: the live angle is outside the configured range.";
    case "body_orientation_mismatch":
      return "Body orientation does not match the draft contract.";
    case "body_orientation_evidence_unavailable":
    case "body_line_evidence_unavailable":
      return "Keep the landmarks selected in Body alignment visible, or correct that safeguard in Movement Builder.";
    case "body_line_over_tolerance":
      return "Body alignment exceeds the configured tolerance. Check Body alignment and Body line tolerance in Safeguards.";
    case "torso_slope_below_min":
    case "torso_slope_above_max":
      return "Torso slope is outside the configured limits. Check the slope limits in Safeguards.";
    case "rep_target_not_reached":
      return "Returned before reaching the target angle. Move farther, or adjust the peak/down target for the intended range.";
    case "rep_target_not_held":
      return "Target was seen too briefly. Reach it in at least two frames spanning 60 ms before returning.";
    case "rep_travel_below_contract":
      return "The movement did not cover the configured range; small jitters are not reps.";
    case "cycle_duration_below_minimum":
      return "The cycle was faster than 400 ms. Move with control; a brief twitch does not count.";
    case "side_symmetry_over_tolerance":
      return "The required sides differ beyond the symmetry tolerance. Move them together, or correct Required sides and Symmetry in the builder.";
    case "body_y_travel_below_min":
    case "hip_y_travel_below_min":
    case "shoulder_y_travel_below_min":
    case "shoulder_hip_travel_below_min":
      return `Rep not counted: ${reason.replace(/_/g, " ")}. Check the corresponding travel minimum in Safeguards.`;
    case "pinned_side_unavailable":
      return "The side that started this rep is no longer visible. Keep that same side in frame.";
    case "rep_cooldown_active":
      return "Rep cooldown is active; keep moving through the full range.";
    case "equipment_required":
      return "Choose the equipment used in this preview; camera does not detect equipment.";
    case "curl_grip_unconfirmed":
      return "Keep both hands visible so the configured curl grip can be confirmed.";
    case "bilateral_arm_motion_unconfirmed":
      return "Both arms need clear, synchronized motion for this curl contract.";
    case "left_right_phase_desync":
      return "The left and right arm phases are out of sync; move both sides together.";
    case "curl_torso_not_upright":
      return "Keep the torso upright so the curl signal is not confused with body sway.";
    default:
      return reason
        ? `Rep not counted: ${reason.replace(/_/g, " ")}.`
        : null;
  }
}

function resetRepCycleState(state: PoseRepEngineState) {
  const nextState = createPoseRepEngineState();
  nextState.lastRepCompletedAtMs = state.lastRepCompletedAtMs;
  nextState.rawAngleData = state.rawAngleData;
  nextState.repCount = state.repCount;
  return nextState;
}

function summarizeSelectedPose(keypoints: PoseKeypointRecord[]) {
  const visibleLandmarkCount = keypoints.filter(
    (keypoint) => keypoint.visibility >= 0.45,
  ).length;
  const coreVisible = [11, 12, 23, 24].every(
    (index) => (keypoints[index]?.visibility ?? 0) >= 0.35,
  );
  const visibleSegments = [
    [13, 15],
    [14, 16],
    [25, 27],
    [26, 28],
    [27, 31],
    [28, 32],
  ].filter(
    ([start, end]) =>
      (keypoints[start]?.visibility ?? 0) >= 0.3 &&
      (keypoints[end]?.visibility ?? 0) >= 0.3,
  ).length;
  return {
    isReliable:
      visibleLandmarkCount >= 16 && coreVisible && visibleSegments >= 2,
    visibleLandmarkCount,
  };
}

export function ExerciseLabLiveCameraValidation({
  exerciseName,
  handShapeProfile,
  movementProfile,
  onAdjust,
  summaryTarget = null,
}: ExerciseLabLiveCameraValidationProps) {
  const { colors, settings } = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const cameraStateRef = useRef<CameraState>("idle");
  const cameraRequestRef = useRef(0);
  const poseAnalyzerRef = useRef<ExerciseCameraPoseAnalyzer | null>(null);
  const poseAnalyzerPromiseRef = useRef<Promise<ExerciseCameraPoseAnalyzer> | null>(null);
  const poseReadInFlightRef = useRef(false);
  const poseFrameBufferRef = useRef<ExerciseCameraPoseFrame[]>([]);
  const poseSignalCacheRef = useRef<ReturnType<typeof createPoseSignalCache> | null>(null);
  const subjectTrackerStateRef = useRef<PoseSubjectTrackerState>(
    createPoseSubjectTrackerState(PREVIEW_SUBJECT_TRACKING_MODE),
  );
  const repEngineStateRef = useRef<PoseRepEngineState>(createPoseRepEngineState());
  const poseDiagnosticsRef = useRef(createPoseDiagnostics("exercise-lab"));
  const attemptedCycleRef = useRef(false);
  const rejectedCycleCountedRef = useRef(false);
  const lastPoseFrameRef = useRef<ExerciseCameraPoseFrame | null>(null);
  const lastPoseFrameGenerationRef = useRef(0);
  const lastFreshFrameWallMsRef = useRef(0);
  const staleFrameHandledRef = useRef(false);
  const draftGenerationRef = useRef(0);
  const movementContractRef = useRef(movementProfile?.movementContract ?? null);
  const rigRef = useRef(movementProfile?.rig ?? null);
  const handShapeProfileRef = useRef(handShapeProfile);
  const previewModeRef = useRef(false);
  const lastNoCountReasonRef = useRef<string | null>(null);
  const repFlowDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraErrorKind, setCameraErrorKind] =
    useState<ExerciseCameraErrorKind | null>(null);
  const [poseModelState, setPoseModelState] = useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");
  const [cameraMessage, setCameraMessage] = useState(CAMERA_IDLE_MESSAGE);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewReps, setPreviewReps] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [trackingRunning, setTrackingRunning] = useState(false);
  const [trackingPaused, setTrackingPaused] = useState(false);
  const [subjectSeen, setSubjectSeen] = useState(false);
  const [subjectLocked, setSubjectLocked] = useState(false);
  const [trackingPhase, setTrackingPhase] = useState("Ready");
  const [trackingAngle, setTrackingAngle] = useState<number | null>(null);
  const [trackingConfidence, setTrackingConfidence] = useState(0);
  const [validReps, setValidReps] = useState(0);
  const [rejectedReps, setRejectedReps] = useState(0);
  const [holdMs, setHoldMs] = useState(0);
  const [minimumConfidence, setMinimumConfidence] = useState<number | null>(null);
  const [missingLandmark, setMissingLandmark] = useState(false);
  const [lastReject, setLastReject] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [repPulse, setRepPulse] = useState(false);
  const [trackingRun, setTrackingRun] = useState(0);
  const [liveKeypoints, setLiveKeypoints] = useState<PoseKeypointRecord[] | null>(null);
  const [cameraFrameSize, setCameraFrameSize] = useState({ height: 1, width: 1 });
  const [equipmentContext, setEquipmentContext] =
    useState<PoseEquipmentContext>("unknown");
  const trackingFrameRef = useRef<number | null>(null);
  const subjectSeenRef = useRef(false);
  const subjectLockedRef = useRef(false);
  const trackingRunRef = useRef(0);
  const equipmentContextRef = useRef<PoseEquipmentContext>("unknown");

  const rigKeyframes = movementProfile?.rig?.keyframes ?? [];
  const movementContract = movementProfile?.movementContract ?? null;
  const draftSignature = JSON.stringify({
    movementContract,
    rig: movementProfile?.rig ?? null,
    handShapeProfile,
  });
  const hasPreview = rigKeyframes.length > 0;
  const isStaticHold = movementContract?.repModel === "static_hold";
  const isBicepCurl = movementContract?.exercise === "bicep_curl";
  const motionAllowed = settings.animationLevel !== "none" && !reducedMotion;
  const phaseLabel = hasPreview
    ? getPhaseLabel(rigKeyframes, previewProgress)
    : "Movement preview";
  const previewKeypoints = hasPreview
    ? getPreviewKeypoints(rigKeyframes, previewProgress)
    : [];
  const targetAngles = movementContract?.repThresholds;
  const effectivePreviewReps = isStaticHold ? 0 : previewReps;
  const downAngle = targetAngles?.down.angle ?? 90;
  const upAngle = targetAngles?.up.angle ?? 170;
  const holdDurationSeconds =
    movementContract?.holdDurationSeconds && movementContract.holdDurationSeconds > 0
      ? movementContract.holdDurationSeconds
      : 30;
  movementContractRef.current = movementContract;
  rigRef.current = movementProfile?.rig ?? null;
  handShapeProfileRef.current = handShapeProfile;
  equipmentContextRef.current = equipmentContext;
  cameraStateRef.current = cameraState;
  previewModeRef.current = previewMode;
  if (!poseSignalCacheRef.current) {
    poseSignalCacheRef.current = createPoseSignalCache(240, 2);
  }

  const trackingReady =
    cameraState === "live" &&
    !previewMode &&
    poseModelState === "ready" &&
    subjectLocked &&
    (isStaticHold
      ? holdMs >= holdDurationSeconds * 1000
      : validReps > 0);
  const hasObservedPose = subjectSeen && liveKeypoints !== null;

  const clearMovementEvidence = useCallback(() => {
    poseFrameBufferRef.current = [];
    poseSignalCacheRef.current?.reset();
  }, []);

  const clearPoseHistory = useCallback(() => {
    clearMovementEvidence();
    lastPoseFrameRef.current = null;
    lastPoseFrameGenerationRef.current = 0;
    lastFreshFrameWallMsRef.current = 0;
    staleFrameHandledRef.current = false;
    setLiveKeypoints(null);
    setCameraFrameSize({ height: 1, width: 1 });
  }, [clearMovementEvidence]);

  const resetTracking = useCallback(() => {
    subjectSeenRef.current = false;
    subjectLockedRef.current = false;
    subjectTrackerStateRef.current = resetPoseSubjectTrackerState(
      subjectTrackerStateRef.current,
      PREVIEW_SUBJECT_TRACKING_MODE,
      draftGenerationRef.current,
      cameraRequestRef.current,
    );
    repEngineStateRef.current = createPoseRepEngineState();
    attemptedCycleRef.current = false;
    rejectedCycleCountedRef.current = false;
    clearPoseHistory();
    lastNoCountReasonRef.current = null;
    setTrackingPaused(false);
    setSubjectSeen(false);
    setSubjectLocked(false);
    setTrackingPhase("Ready");
    setTrackingAngle(null);
    setTrackingConfidence(0);
    setValidReps(0);
    setRejectedReps(0);
    setHoldMs(0);
    setMinimumConfidence(null);
    setMissingLandmark(false);
    setLastReject(null);
    setWarnings([]);
    setRepPulse(false);
    equipmentContextRef.current = "unknown";
    setEquipmentContext("unknown");
  }, [clearPoseHistory]);

  const pushTrackingWarning = useCallback((warning: string) => {
    setWarnings((current) =>
      current.includes(warning) ? current : [warning, ...current].slice(0, 4),
    );
  }, []);

  const startTracking = useCallback(() => {
    const nextRun = trackingRunRef.current + 1;
    trackingRunRef.current = nextRun;
    if (mountedRef.current) setTrackingRun(nextRun);
    resetTracking();
    setTrackingRunning(true);
    setTrackingPaused(false);
  }, [resetTracking]);

  const stopTracking = useCallback(() => {
    const nextRun = trackingRunRef.current + 1;
    trackingRunRef.current = nextRun;
    if (mountedRef.current) setTrackingRun(nextRun);
    setTrackingRunning(false);
    setTrackingPaused(false);
    if (trackingFrameRef.current !== null) {
      window.cancelAnimationFrame(trackingFrameRef.current);
      trackingFrameRef.current = null;
    }
    resetTracking();
  }, [resetTracking]);

  const invalidateActiveTracking = useCallback(
    (nextPhase: string) => {
      const nextRun = trackingRunRef.current + 1;
      trackingRunRef.current = nextRun;
      if (mountedRef.current) setTrackingRun(nextRun);

      // Keep the completed total for the session, but discard the in-flight
      // cycle, subject association, and every frame-derived buffer. The next
      // run must observe a fresh body before counting again.
      const preservedState = resetRepCycleState(repEngineStateRef.current);
      repEngineStateRef.current = preservedState;
      subjectTrackerStateRef.current = resetPoseSubjectTrackerState(
        subjectTrackerStateRef.current,
        PREVIEW_SUBJECT_TRACKING_MODE,
        draftGenerationRef.current,
        cameraRequestRef.current,
      );
      attemptedCycleRef.current = false;
      rejectedCycleCountedRef.current = false;
      clearPoseHistory();
      lastNoCountReasonRef.current = null;
      subjectSeenRef.current = false;
      subjectLockedRef.current = false;
      setSubjectSeen(false);
      setSubjectLocked(false);
      setTrackingPhase(nextPhase);
      setTrackingAngle(null);
      setTrackingConfidence(0);
      setValidReps(preservedState.repCount);
      setHoldMs(0);
      setMinimumConfidence(null);
      setMissingLandmark(false);
      setLastReject(null);
      setWarnings([]);
      setRepPulse(false);
      if (trackingFrameRef.current !== null) {
        window.cancelAnimationFrame(trackingFrameRef.current);
        trackingFrameRef.current = null;
      }
    },
    [clearPoseHistory],
  );

  const pauseTracking = useCallback(() => {
    if (!trackingRunning || trackingPaused) return;
    invalidateActiveTracking("Paused — resume tracking when ready");
    setTrackingPaused(true);
  }, [invalidateActiveTracking, trackingPaused, trackingRunning]);

  const resumeTracking = useCallback(() => {
    if (!trackingRunning || !trackingPaused) return;
    invalidateActiveTracking("Waiting for a fresh subject");
    setTrackingPaused(false);
  }, [invalidateActiveTracking, trackingPaused, trackingRunning]);

  const updateEquipmentContext = useCallback(
    (nextContext: PoseEquipmentContext) => {
      if (!isBicepCurl || nextContext === equipmentContextRef.current) return;
      equipmentContextRef.current = nextContext;
      setEquipmentContext(nextContext);
      invalidateActiveTracking("Equipment context changed — subject tracking paused");
      setCameraMessage(
        "Camera does not detect equipment. This explicit choice applies only to the current preview.",
      );
    },
    [invalidateActiveTracking, isBicepCurl],
  );

  const disposePoseAnalyzer = useCallback(() => {
    poseAnalyzerRef.current?.dispose();
    poseAnalyzerRef.current = null;
    poseAnalyzerPromiseRef.current = null;
  }, []);

  const stopCamera = useCallback(
    (nextState: CameraState = "idle") => {
      cameraRequestRef.current += 1;
      disposePoseAnalyzer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      stopTracking();
      cameraStateRef.current = nextState;
      setCameraState(nextState);
      setPoseModelState("idle");
      setCameraErrorKind(null);
      if (nextState === "idle") setCameraMessage(CAMERA_IDLE_MESSAGE);
    },
    [disposePoseAnalyzer, stopTracking],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!hasPreview || !previewPlaying || !motionAllowed) {
      setPreviewProgress(0);
      setPreviewReps(0);
      return undefined;
    }

    const cycleMs = isStaticHold ? 3200 : 2200;
    const startedAt = performance.now();
    let lastCycle = 0;
    let frameId = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const cycle = Math.floor(elapsed / cycleMs);
      setPreviewProgress((elapsed % cycleMs) / cycleMs);
      if (cycle !== lastCycle) {
        lastCycle = cycle;
        setPreviewReps(Math.min(cycle, 99));
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [hasPreview, isStaticHold, motionAllowed, previewPlaying]);

  useEffect(() => {
    draftGenerationRef.current += 1;
    if (
      cameraStateRef.current === "live" ||
      cameraStateRef.current === "requesting"
    ) {
      stopCamera("idle");
      setCameraMessage("Draft changed. Start the camera to preview the updated contract.");
    }
    subjectTrackerStateRef.current = resetPoseSubjectTrackerState(
      subjectTrackerStateRef.current,
      PREVIEW_SUBJECT_TRACKING_MODE,
      draftGenerationRef.current,
      cameraRequestRef.current,
    );
    repEngineStateRef.current = createPoseRepEngineState();
    attemptedCycleRef.current = false;
    rejectedCycleCountedRef.current = false;
    clearPoseHistory();
    resetTracking();
  }, [clearPoseHistory, draftSignature, resetTracking, stopCamera]);

  const ensurePoseAnalyzer = useCallback(
    async (
      video: HTMLVideoElement,
      requestId: number,
      generation: number,
    ) => {
      const isCurrentRequest = () =>
        mountedRef.current &&
        requestId === cameraRequestRef.current &&
        generation === draftGenerationRef.current &&
        cameraStateRef.current === "live";

      if (poseAnalyzerRef.current) {
        if (!isCurrentRequest()) return null;
        setPoseModelState("ready");
        return poseAnalyzerRef.current;
      }

      if (isCurrentRequest()) setPoseModelState("loading");
      if (!poseAnalyzerPromiseRef.current) {
        poseAnalyzerPromiseRef.current = createExerciseCameraPoseAnalyzer(video, {
          subjectTrackingMode: PREVIEW_SUBJECT_TRACKING_MODE,
        });
      }
      const analyzerPromise = poseAnalyzerPromiseRef.current;

      try {
        const analyzer = await analyzerPromise;
        if (!isCurrentRequest()) {
          analyzer.dispose();
          if (poseAnalyzerPromiseRef.current === analyzerPromise) {
            poseAnalyzerPromiseRef.current = null;
          }
          return null;
        }
        if (poseAnalyzerPromiseRef.current !== analyzerPromise) {
          analyzer.dispose();
          return poseAnalyzerRef.current;
        }
        poseAnalyzerPromiseRef.current = null;
        poseAnalyzerRef.current = analyzer;
        setPoseModelState("ready");
        return analyzer;
      } catch (error) {
        if (poseAnalyzerPromiseRef.current === analyzerPromise) {
          poseAnalyzerPromiseRef.current = null;
        }
        if (isCurrentRequest()) setPoseModelState("unavailable");
        else return null;
        throw error;
      }
    },
    [],
  );

  const startCamera = useCallback(async () => {
    if (cameraState === "requesting" || cameraState === "live") return;
    setPreviewMode(false);
    previewModeRef.current = false;
    setPreviewPlaying(false);
    setCameraErrorKind(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraStateRef.current = "unavailable";
      setCameraState("unavailable");
      setCameraErrorKind("unsupported");
      setCameraMessage(
        "Camera access requires a secure browser origin with getUserMedia support.",
      );
      return;
    }

    stopCamera("requesting");
    const requestId = cameraRequestRef.current;
    setCameraMessage("Requesting camera access. Your browser may show a permission prompt.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      });
    } catch (error) {
      const info = classifyExerciseCameraError(error);
      stopCamera(info.kind === "permission" ? "denied" : "unavailable");
      setCameraErrorKind(info.kind);
      setCameraMessage(info.message);
      return;
    }

    if (!mountedRef.current || requestId !== cameraRequestRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((track) => track.stop());
      stopCamera("unavailable");
      setCameraErrorKind("unavailable");
      setCameraMessage("The camera preview element is unavailable. Retry when ready.");
      return;
    }
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => undefined);
    if (requestId !== cameraRequestRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    cameraStateRef.current = "live";
    setCameraState("live");
    setPoseModelState("loading");
    setCameraMessage("Camera is live. Loading the on-device pose model…");
    const generation = draftGenerationRef.current;
    let analyzer: ExerciseCameraPoseAnalyzer | null;
    try {
      analyzer = await ensurePoseAnalyzer(video, requestId, generation);
    } catch {
      if (
        requestId === cameraRequestRef.current &&
        generation === draftGenerationRef.current
      ) {
        const info = exerciseCameraModelError();
        setPoseModelState("unavailable");
        setCameraErrorKind(info.kind);
        setCameraMessage(info.message);
      }
      return;
    }
    if (
      !analyzer ||
      requestId !== cameraRequestRef.current ||
      generation !== draftGenerationRef.current
    ) {
      return;
    }
    setCameraErrorKind(null);
    setCameraMessage(
      "Camera preview is live. Step into frame; tracking will select one clear subject automatically.",
    );
    startTracking();
  }, [cameraState, ensurePoseAnalyzer, startTracking, stopCamera]);

  const retryPoseModel = useCallback(async () => {
    const video = videoRef.current;
    if (!video || cameraStateRef.current !== "live") return;
    const requestId = cameraRequestRef.current;
    const generation = draftGenerationRef.current;
    setCameraMessage("Retrying the on-device pose model…");
    try {
      const analyzer = await ensurePoseAnalyzer(video, requestId, generation);
      if (
        !analyzer ||
        requestId !== cameraRequestRef.current ||
        generation !== draftGenerationRef.current
      ) {
        return;
      }
      setCameraErrorKind(null);
      setCameraMessage(
        "Camera preview is live. Step into frame; tracking will select one clear subject automatically.",
      );
      startTracking();
    } catch {
      const info = exerciseCameraModelError();
      setPoseModelState("unavailable");
      setCameraErrorKind(info.kind);
      setCameraMessage(info.message);
    }
  }, [ensurePoseAnalyzer, startTracking]);

  const startTrackingPreview = useCallback(() => {
    stopCamera("idle");
    setPreviewMode(true);
    previewModeRef.current = true;
    repFlowDetailsRef.current?.setAttribute("open", "");
    setPreviewPlaying(true);
    setCameraMessage(
      "Draft animation only. It shows the configured rig and never validates the camera or counts reps.",
    );
  }, [stopCamera]);

  const reportPoseDecision = (reason: string | null, evidence?: PoseRepEngineEvidence, previousState?: PoseRepEngineState) => {
    const frame = lastPoseFrameRef.current;
    poseDiagnosticsRef.current({
      reason, previousState, timestamp: frame?.capturedAtMs ?? Date.now(),
      contract: movementContractRef.current, rig: rigRef.current,
      state: repEngineStateRef.current,
      evidence: evidence ?? (frame ? { keypoints: frame.keypoints, spatialKeypoints: frame.spatialKeypoints,
        coordinateDimensions: { width: frame.frameWidth, height: frame.frameHeight } } : undefined),
      context: { exerciseName, trackingRunning, trackingPaused, subjectCanCount: subjectLockedRef.current },
    });
  };

  useEffect(() => {
    if (
      !trackingRunning ||
      trackingPaused ||
      cameraState !== "live" ||
      previewMode ||
      poseModelState !== "ready"
    ) {
      return undefined;
    }

    const runId = trackingRunRef.current;
    const draftGeneration = draftGenerationRef.current;
    let cancelled = false;
    let lastReadAt = Number.NEGATIVE_INFINITY;

    const markRepAttempt = (state: PoseRepEngineState) => {
      const active = isStaticHold
        ? !state.holdCompleted &&
          (state.holdStartedAtMs !== null || state.holdValidMs > 0)
        : state.phase === "down" ||
          state.phase === "up" ||
          state.peakContractionPending;
      if (active) attemptedCycleRef.current = true;
    };

    const recordRejectedAttempt = () => {
      if (!attemptedCycleRef.current || rejectedCycleCountedRef.current) return;
      rejectedCycleCountedRef.current = true;
      setRejectedReps((current) => current + 1);
    };

    const clearRepAttempt = () => {
      attemptedCycleRef.current = false;
      rejectedCycleCountedRef.current = false;
    };

    const resetPartialCycle = (preserveFreshCandidate = false) => {
      markRepAttempt(repEngineStateRef.current);
      recordRejectedAttempt();
      const nextState = resetRepCycleState(repEngineStateRef.current);
      repEngineStateRef.current = nextState;
      clearRepAttempt();
      if (preserveFreshCandidate) {
        clearMovementEvidence();
      } else {
        clearPoseHistory();
      }
      setValidReps(nextState.repCount);
      setHoldMs(0);
      setTrackingAngle(null);
      setTrackingPhase("Waiting for a reliable subject");
    };

    const publishNoCount = (reason: string | null, missing: string[] = []) => {
      if (reason) reportPoseDecision(reason);
      const message = missing.length
        ? `${formatNoCountReason(reason)} Check: ${missing.map((name) => name.replace(/_/g, " ")).join(", ")}.`
        : formatNoCountReason(reason);
      setLastReject(message);
      if (reason && lastNoCountReasonRef.current !== reason) {
        lastNoCountReasonRef.current = reason;
        if (message) pushTrackingWarning(message);
      }
      if (!reason) lastNoCountReasonRef.current = null;
    };

    const processFrame = async () => {
      if (
        cancelled ||
        runId !== trackingRunRef.current ||
        draftGeneration !== draftGenerationRef.current ||
        !mountedRef.current
      ) {
        return;
      }
      const analyzer = poseAnalyzerRef.current;
      if (!analyzer) return;
      poseReadInFlightRef.current = true;
      try {
        const frame = await analyzer.readFrame();
        if (
          cancelled ||
          runId !== trackingRunRef.current ||
          draftGeneration !== draftGenerationRef.current ||
          cameraStateRef.current !== "live"
        ) {
          return;
        }

        const nowMs = Date.now();
        if (frame?.isDuplicate) {
          const staleForMs =
            lastFreshFrameWallMsRef.current > 0
              ? nowMs - lastFreshFrameWallMsRef.current
              : 0;
          // Duplicate media timestamps are ignored. Once the clock has been
          // frozen for long enough, treat the input as a body-loss signal so
          // the tracker can pause without advancing the rep engine.
          if (
            staleForMs <= POSE_SUBJECT_TRACKER_FRESHNESS_MS * 3 ||
            staleFrameHandledRef.current
          ) {
            return;
          }

          staleFrameHandledRef.current = true;
          const staleTransition = advancePoseSubjectTracker(
            subjectTrackerStateRef.current,
            {
              candidates: [],
              capturedAtMs: nowMs,
              generation: draftGeneration,
              mode: PREVIEW_SUBJECT_TRACKING_MODE,
              nowMs,
              streamId: cameraRequestRef.current,
            },
          );
          subjectTrackerStateRef.current = staleTransition.nextState;
          subjectSeenRef.current = false;
          subjectLockedRef.current = false;
          setSubjectSeen(false);
          setSubjectLocked(false);
          setLiveKeypoints(null);
          setTrackingConfidence(0);
          setTrackingAngle(null);
          setMissingLandmark(false);
          resetPartialCycle();
          publishNoCount(null);
          reportPoseDecision("camera_frame_stalled");
          setTrackingPhase(
            staleTransition.status === "lost"
              ? "Pose lost — move required joints into frame"
              : "Tracking paused — waiting for a fresh frame",
          );
          return;
        }
        lastFreshFrameWallMsRef.current = nowMs;
        staleFrameHandledRef.current = false;

        const capturedAtMs = frame?.capturedAtMs ?? nowMs;
        const candidates =
          frame?.candidates ??
          (frame?.keypoints ? [{ keypoints: frame.keypoints }] : []);
        const transition = advancePoseSubjectTracker(
          subjectTrackerStateRef.current,
          {
            candidates,
            capturedAtMs,
            generation: draftGeneration,
            mode: PREVIEW_SUBJECT_TRACKING_MODE,
            nowMs,
            streamId: cameraRequestRef.current,
          },
        );
        subjectTrackerStateRef.current = transition.nextState;
        const selectedKeypoints = transition.candidate?.keypoints ?? null;
        const hasCandidate = candidates.length > 0;
        const displayLocked = transition.canCount && selectedKeypoints !== null;
        const bodyVisible =
          hasCandidate ||
          (transition.nextState.selected !== null &&
            transition.status !== "lost");
        subjectSeenRef.current = bodyVisible;
        subjectLockedRef.current = displayLocked;
        setSubjectSeen(bodyVisible);
        setSubjectLocked(displayLocked);

        if (!frame || !selectedKeypoints) {
          lastPoseFrameRef.current = null;
          lastPoseFrameGenerationRef.current = draftGeneration;
          setLiveKeypoints(null);
          setTrackingConfidence(0);
          setTrackingAngle(null);
          setMissingLandmark(false);
          resetPartialCycle();
          publishNoCount(null);
          reportPoseDecision("no_selected_subject");
          setTrackingPhase(
            transition.status === "lost"
              ? "Pose lost — move required joints into frame"
              : bodyVisible
                ? "Tracking paused — waiting for a fresh pose"
                : "No subject detected",
          );
          return;
        }

        const selectedReliability = summarizeSelectedPose(selectedKeypoints);
        const coordinateDimensions: PoseCoordinateDimensions | undefined =
          frame.frameWidth > 0 && frame.frameHeight > 0
            ? { height: frame.frameHeight, width: frame.frameWidth }
            : undefined;
        const contract = movementContractRef.current;
        const movementAssessment = contract
          ? getPoseMovementFrameAssessment(
              contract,
              selectedKeypoints,
              coordinateDimensions,
            )
          : null;
        const selectedFrame: ExerciseCameraPoseFrame = {
          ...frame,
          spatialKeypoints: transition.candidate?.spatialKeypoints,
          isReliable:
            movementAssessment?.isReliable ?? selectedReliability.isReliable,
          keypoints: selectedKeypoints,
          visibleLandmarkCount:
            movementAssessment?.reliableLandmarkCount ??
            selectedReliability.visibleLandmarkCount,
        };
        lastPoseFrameRef.current = selectedFrame;
        lastPoseFrameGenerationRef.current = draftGeneration;
        setLiveKeypoints(selectedKeypoints);
        setCameraFrameSize((current) =>
          current.height === frame.frameHeight &&
          current.width === frame.frameWidth
            ? current
            : { height: frame.frameHeight, width: frame.frameWidth },
        );
        const instantSignals = poseSignalCacheRef.current!.getInstant(
          selectedFrame,
          coordinateDimensions,
        );
        const actualConfidence =
          movementAssessment?.confidence ??
          instantSignals.visibility.averageVisibility;
        setTrackingConfidence(actualConfidence);
        setMinimumConfidence((current) =>
          current === null ? actualConfidence : Math.min(current, actualConfidence),
        );

        if (!selectedFrame.isReliable) {
          // A fresh detected pose can still be drawn when one required joint
          // is unreliable. Clear the unfinished rep, not the overlay or the
          // frame needed to report exactly which joint failed validation.
          resetPartialCycle(true);
          setTrackingPhase(
            bodyVisible
              ? "Waiting for reliable landmarks"
              : "No subject detected",
          );
          setTrackingAngle(null);
          setMissingLandmark(
            (movementAssessment?.lowConfidenceLandmarks.length ?? 0) > 0,
          );
          publishNoCount(
            movementAssessment?.reason ?? "tracking_confidence_below_contract",
            movementAssessment?.lowConfidenceLandmarks,
          );
          return;
        }

        if (!transition.canCount || !displayLocked) {
          resetPartialCycle(true);
          setTrackingPhase(
            transition.status === "lost"
              ? "Pose lost — move required joints into frame"
              : transition.status === "paused"
                ? "Tracking paused — waiting for a fresh pose"
                : hasCandidate
                  ? "Selecting a subject automatically"
                  : "No subject detected",
          );
          setTrackingAngle(null);
          setMissingLandmark(false);
          publishNoCount(null);
          reportPoseDecision("subject_tracking_wait");
          return;
        }

        const frameBuffer = [
          ...poseFrameBufferRef.current,
          selectedFrame,
        ].slice(-32);
        poseFrameBufferRef.current = frameBuffer;
        const bufferedSignals = poseSignalCacheRef.current!.getBuffered(
          frameBuffer,
          frame.capturedAtMs,
          coordinateDimensions,
        );
        const signals = bufferedSignals ?? instantSignals;
        if (!contract) {
          resetPartialCycle();
          setTrackingPhase("Movement contract unavailable");
          publishNoCount("movement_contract_incomplete");
          return;
        }

        const currentAngle = getPoseFrameContractAngle(
          contract,
          selectedFrame,
          coordinateDimensions,
        );
        setTrackingAngle(
          typeof currentAngle === "number" ? Math.round(currentAngle) : null,
        );
        const lowConfidenceLandmarks =
          movementAssessment?.lowConfidenceLandmarks ??
          signals.visibility.lowConfidenceLandmarks;
        setMissingLandmark(lowConfidenceLandmarks.length > 0);
        const equipmentSource: PoseEquipmentSource | null =
          isBicepCurl && equipmentContextRef.current !== "unknown"
            ? "member"
            : null;
        const evidence = {
          rig: rigRef.current,
          spatialKeypoints: selectedFrame.spatialKeypoints,
          exerciseDeclared: true,
          equipmentContext: isBicepCurl ? equipmentContextRef.current : null,
          equipmentSource,
          handShapeProfile: handShapeProfileRef.current,
          keypointFrames: frameBuffer.map((bufferedFrame) => bufferedFrame.keypoints),
          keypoints: selectedFrame.keypoints,
          lowConfidenceLandmarks,
          signals,
          coordinateDimensions,
        };

        if (contract.repModel === "static_hold") {
          const previousState = repEngineStateRef.current;
          markRepAttempt(previousState);
          const holdStep = stepPoseStaticHold(
            repEngineStateRef.current,
            contract,
            currentAngle,
            selectedFrame.capturedAtMs,
            evidence,
          );
          repEngineStateRef.current = holdStep.nextState;
          reportPoseDecision(holdStep.noCountReason, evidence, previousState);
          if (holdStep.holdCompleted) {
            clearRepAttempt();
          } else if (
            (previousState.holdStartedAtMs !== null ||
              previousState.holdValidMs > 0) &&
            holdStep.nextState.holdStartedAtMs === null &&
            holdStep.nextState.holdValidMs === 0
          ) {
            recordRejectedAttempt();
            clearRepAttempt();
          }
          setHoldMs(Math.round(holdStep.holdSeconds * 1000));
          setValidReps(0);
          setTrackingPhase(
            holdStep.holdValid
              ? holdStep.holdCompleted
                ? "Hold complete"
                : "Hold in range"
              : formatNoCountReason(holdStep.noCountReason) ?? "Hold paused",
          );
          publishNoCount(holdStep.noCountReason);
          return;
        }

        const previousState = repEngineStateRef.current;
        markRepAttempt(previousState);
        const repStep = stepPoseRepEngine(
          repEngineStateRef.current,
          contract,
          currentAngle,
          selectedFrame.capturedAtMs,
          evidence,
        );
        repEngineStateRef.current = repStep.nextState;
        reportPoseDecision(repStep.noCountReason, evidence, previousState);
        if (repStep.repCompleted) {
          clearRepAttempt();
        } else if (
          repStep.noCountReason &&
          previousState.phase !== "primed" &&
          repStep.nextState.phase === "primed"
        ) {
          recordRejectedAttempt();
          clearRepAttempt();
        } else {
          markRepAttempt(repStep.nextState);
        }
        setValidReps(repStep.nextState.repCount);
        setHoldMs(0);
        const geometry = getPoseFrameGeometry(selectedFrame, coordinateDimensions);
        setTrackingPhase(
          repStep.repCompleted
            ? "Rep completed"
            : repStep.noCountReason
              ? formatNoCountReason(repStep.noCountReason) ?? "Waiting for movement"
              : getPoseRepProgressText(repStep.nextState, contract, geometry.keypoints, geometry.dimensions),
        );
        publishNoCount(repStep.noCountReason);
        if (repStep.repCompleted && !reducedMotion) {
          setRepPulse(true);
          window.setTimeout(() => setRepPulse(false), 500);
        }
      } catch {
        if (
          !cancelled &&
          runId === trackingRunRef.current &&
          draftGeneration === draftGenerationRef.current
        ) {
          reportPoseDecision("detector_error");
          setPoseModelState("unavailable");
          setCameraMessage(
            "The on-device pose model stopped responding. Camera footage remains local; retry the model when ready.",
          );
          stopTracking();
        }
      } finally {
        poseReadInFlightRef.current = false;
      }
    };

    const tick = (now: number) => {
      if (cancelled || runId !== trackingRunRef.current) return;
      if (now - lastReadAt >= 90 && !poseReadInFlightRef.current) {
        lastReadAt = now;
        void processFrame();
      }
      trackingFrameRef.current = window.requestAnimationFrame(tick);
    };

    trackingFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (trackingFrameRef.current !== null) {
        window.cancelAnimationFrame(trackingFrameRef.current);
        trackingFrameRef.current = null;
      }
    };
  }, [
    cameraState,
    clearMovementEvidence,
    clearPoseHistory,
    handShapeProfile,
    isBicepCurl,
    isStaticHold,
    movementContract,
    poseModelState,
    previewMode,
    pushTrackingWarning,
    reducedMotion,
    stopTracking,
    trackingPaused,
    trackingRun,
    trackingRunning,
  ]);

  const restartPreview = () => {
    if (cameraLive) stopCamera("idle");
    setPreviewMode(true);
    previewModeRef.current = true;
    setPreviewReps(0);
    setPreviewProgress(0);
    setPreviewPlaying(true);
    repFlowDetailsRef.current?.setAttribute("open", "");
    setCameraMessage(
      "Draft animation only. It shows the configured rig and never validates the camera or counts reps.",
    );
  };

  const restartTracking = () => {
    if (cameraLive) startTracking();
  };

  const resetTest = () => {
    stopTracking();
    setCameraMessage(
      previewMode
        ? "Draft animation only. It never validates the camera or counts reps."
        : "Camera preview is live. Use it to confirm that the exercise can be framed clearly.",
    );
  };

  const statusLabel = formatCameraState(cameraState);
  const cameraLive = cameraState === "live";
  const trackingResult = previewMode
    ? "Draft animation only"
    : cameraState === "denied" || cameraState === "unavailable"
      ? formatExerciseCameraErrorLabel(cameraErrorKind)
      : poseModelState === "unavailable"
        ? "Pose model unavailable"
          : trackingReady
          ? "Preview signal ready"
          : trackingRunning && !subjectLocked
            ? subjectSeen
              ? "Selecting subject"
              : "No subject detected"
        : trackingRunning && lastReject
          ? "Needs adjustment"
          : trackingRunning
            ? "Observing"
            : "Not tested";
  const panelStyle = {
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
  } as const;
  const cameraButtonStyle = {
    fontSize: 13,
    fontWeight: 600,
    minHeight: 36,
    padding: "0 12px",
  } as const;
  const cameraButtonTextStyle = {
    fontSize: 13,
    fontWeight: 600,
  } as const;
  const readoutStyle = {
    backgroundColor: `${colors.fieldBg}99`,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: 12,
  } as const;
  const hasCameraEvidence = trackingRunning || trackingReady;
  const cameraTestSummary = (
    <section
      aria-label="Camera test summary"
      data-testid="exercise-lab-camera-test-summary"
      style={
        summaryTarget
          ? { display: "grid", gap: 10 }
          : { ...panelStyle, display: "grid", gap: 10, padding: 12 }
      }
    >
      {!summaryTarget ? (
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <FitText
            excludeGlobalScale
            style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 700 }}
          >
            Camera test summary
          </FitText>
          <FitText
            excludeGlobalScale
            style={{
              color: trackingReady ? colors.success : colors.textSecondary,
              fontSize: 11.5,
              fontWeight: 600,
            }}
          >
            {hasCameraEvidence ? trackingResult : "Not tested"}
          </FitText>
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        <CameraSummaryMetric
          label={isStaticHold ? "Hold complete" : "Valid reps"}
          value={
            hasCameraEvidence
              ? isStaticHold
                ? `${(holdMs / 1000).toFixed(1)}s`
                : `${validReps}`
              : "—"
          }
          colors={colors}
          tone={trackingReady ? "success" : undefined}
        />
        <CameraSummaryMetric
          label="Rejected"
          value={hasCameraEvidence ? `${rejectedReps}` : "—"}
          colors={colors}
          tone={rejectedReps ? "warning" : undefined}
        />
        <CameraSummaryMetric
          label="Min confidence"
          value={
            !hasCameraEvidence || minimumConfidence === null
              ? "—"
              : `${Math.round(minimumConfidence * 100)}%`
          }
          colors={colors}
          tone={
            minimumConfidence !== null && minimumConfidence < 0.6
              ? "danger"
              : undefined
          }
        />
        <CameraSummaryMetric
          label="Landmark warnings"
          value={
            hasCameraEvidence && (missingLandmark || warnings.length)
              ? "Detected"
              : "None"
          }
          colors={colors}
          tone={missingLandmark || warnings.length ? "warning" : undefined}
        />
        <div style={{ gridColumn: "1 / -1" }}>
          <CameraSummaryMetric
            label="Preview signal"
            value={hasCameraEvidence ? (trackingReady ? "Ready" : "Observing") : "Not tested"}
            colors={colors}
            tone={trackingReady ? "success" : hasCameraEvidence ? "warning" : undefined}
          />
        </div>
      </div>
      {onAdjust && hasCameraEvidence && !trackingReady ? (
        <div
          style={{
            alignItems: "center",
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            paddingTop: 10,
          }}
        >
          <FitText
            excludeGlobalScale
            style={{ color: colors.textMuted, fontSize: 11.5 }}
          >
            Adjust the contract if tracking needs work:
          </FitText>
          <FitButton
            label="Tracking Choice"
            onClick={() => onAdjust("tracking")}
            variant="ghost"
            style={cameraButtonStyle}
            textStyle={cameraButtonTextStyle}
          />
          <FitButton
            label="Movement Builder"
            onClick={() => onAdjust("movement")}
            variant="ghost"
            style={cameraButtonStyle}
            textStyle={cameraButtonTextStyle}
          />
          <FitButton
            label="Hand Setup"
            onClick={() => onAdjust("hand")}
            variant="ghost"
            style={cameraButtonStyle}
            textStyle={cameraButtonTextStyle}
          />
        </div>
      ) : null}
    </section>
  );

  return (
    <section
      aria-label="Camera validation"
      className="exercise-lab-camera-validation"
      data-camera-live={cameraLive ? "true" : "false"}
      data-camera-state={statusLabel}
      data-camera-preview-mode={previewMode ? "draft-animation" : "device"}
      data-camera-error={cameraErrorKind ?? "none"}
      data-rejected-reps={rejectedReps}
      data-rep-pulse={repPulse ? "true" : "false"}
      data-subject-locked={subjectLocked ? "true" : "false"}
      data-valid-reps={validReps}
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        display: "grid",
        gap: 16,
        minWidth: 0,
        padding: 16,
      }}
    >
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 700 }}>
            Camera validation
          </FitText>
          <FitText excludeGlobalScale as="p" style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
            Check framing for <strong>{exerciseName || "this exercise"}</strong> before publishing.
            Camera access is opt-in.
          </FitText>
        </div>
        <span
          aria-label={`Camera ${statusLabel}`}
          data-tracking-result={trackingResult}
          style={{
            alignItems: "center",
            backgroundColor:
              trackingReady
                ? `${colors.success}20`
                : cameraState === "denied" || cameraState === "unavailable"
                  ? `${colors.danger}20`
                  : trackingResult === "Not tested" || previewMode
                    ? colors.fieldBg
                    : `${colors.warning}20`,
            border: `1px solid ${trackingReady ? `${colors.success}66` : cameraState === "denied" || cameraState === "unavailable" ? `${colors.danger}66` : colors.border}`,
            borderRadius: 6,
            color:
              trackingReady
                ? colors.success
                : cameraState === "denied" || cameraState === "unavailable"
                  ? colors.danger
                  : trackingResult === "Not tested" || previewMode
                    ? colors.textMuted
                    : colors.warning,
            display: "inline-flex",
            fontSize: 10.5,
            fontWeight: 700,
            padding: "4px 8px",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {trackingResult}
        </span>
      </div>

      <div
        className="exercise-lab-camera-grid"
        style={{
          display: "grid",
          alignItems: "start",
          gap: 16,
          gridTemplateColumns: "minmax(0, 1fr) minmax(200px, 220px)",
          minWidth: 0,
        }}
      >
        <div
          className={`exercise-lab-camera-feed${cameraLive ? " exercise-lab-camera-feed--live" : " exercise-lab-camera-feed--idle"}`}
          style={{
            alignSelf: "start",
            aspectRatio: "1 / 1",
            backgroundColor: "#000",
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            overflow: "hidden",
            position: "relative",
            justifySelf: "center",
            maxWidth: 560,
            width: "100%",
          }}
        >
          <video
            aria-label="Live camera preview"
            autoPlay
            muted
            playsInline
            ref={videoRef}
            style={{
              backgroundColor: "#000",
              display: cameraLive ? "block" : "none",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
              width: "100%",
            }}
          />
          {cameraLive && previewMode ? (
            <div
              aria-hidden="true"
              style={{
                background: `radial-gradient(circle at 50% 38%, ${colors.surfaceRaised}, ${colors.base} 68%)`,
                inset: 0,
                position: "absolute",
              }}
            />
          ) : null}
          {cameraLive && trackingRunning && subjectLocked && liveKeypoints ? (
            <CameraPoseOverlay
              colors={colors}
              frameHeight={cameraFrameSize.height}
              frameWidth={cameraFrameSize.width}
              keypoints={liveKeypoints}
              missingLandmark={missingLandmark}
              reducedMotion={reducedMotion}
              angle={trackingAngle}
            />
          ) : null}
          {cameraLive && !previewMode && poseModelState !== "ready" ? (
            <div
              style={{
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,.58)",
                borderRadius: 10,
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                inset: "50% auto auto 50%",
                maxWidth: "calc(100% - 32px)",
                padding: "12px 14px",
                position: "absolute",
                textAlign: "center",
                transform: "translate(-50%, -50%)",
                width: 280,
                zIndex: 2,
              }}
            >
              <FitText excludeGlobalScale style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                {poseModelState === "loading"
                  ? "Loading the on-device pose model…"
                  : "The on-device pose model is unavailable."}
              </FitText>
              <FitText excludeGlobalScale as="p" style={{ color: "#d6d6d6", fontSize: 11.5, lineHeight: 1.4, margin: 0 }}>
                {poseModelState === "loading"
                  ? "Camera footage stays on this device while the model initializes."
                  : "Camera access remains optional; retry when the model can load."}
              </FitText>
              {poseModelState === "unavailable" ? (
                <FitButton
                  label="Retry pose model"
                  onClick={() => void retryPoseModel()}
                  style={cameraButtonStyle}
                  textStyle={cameraButtonTextStyle}
                  variant="ghost"
                />
              ) : null}
            </div>
          ) : null}
          {!cameraLive ? (
            <div
              className="exercise-lab-camera-idle-overlay"
              style={{
                alignItems: "center",
                color: colors.textSecondary,
                display: "flex",
                flexDirection: "column",
                gap: 9,
                inset: 0,
                justifyContent: "center",
                padding: 20,
                position: "absolute",
                textAlign: "center",
              }}
            >
              {cameraState === "requesting" ? (
                <span
                  aria-hidden="true"
                  style={{
                    border: `2px solid ${colors.textMuted}55`,
                    borderRadius: "50%",
                    borderTopColor: colors.brand,
                    height: 32,
                    width: 32,
                  }}
                />
              ) : cameraState === "denied" || cameraState === "unavailable" ? (
                <VideoOff color={colors.textMuted} size={32} />
              ) : (
                <Camera color={colors.brand} size={32} />
              )}
              <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>
                {cameraState === "requesting"
                  ? "Requesting camera access…"
                  : cameraState === "denied"
                    ? "Camera permission denied"
                    : cameraState === "unavailable"
                      ? "No camera device available"
                      : "Start the camera to physically verify FitTrack recognizes this exercise."}
              </FitText>
              {cameraState !== "idle" || cameraMessage !== CAMERA_IDLE_MESSAGE ? (
                <FitText excludeGlobalScale as="p" style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.45, margin: 0, maxWidth: 360 }}>
                  {cameraMessage}
                </FitText>
              ) : null}
              <FitText excludeGlobalScale as="p" style={{ color: colors.textMuted, fontSize: 11, lineHeight: 1.35, margin: 0, maxWidth: 360 }}>
                Live footage is processed on-device and never uploaded or recorded.
              </FitText>
              {cameraState !== "requesting" ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 2 }}>
                  <FitButton
                    icon={cameraState === "idle" ? Camera : RotateCcw}
                    label={cameraState === "idle" ? "Start camera" : "Retry"}
                    onClick={() => void startCamera()}
                    style={cameraButtonStyle}
                    textStyle={cameraButtonTextStyle}
                  />
                  <FitButton
                    label="Draft animation only"
                    onClick={startTrackingPreview}
                    variant="ghost"
                    style={cameraButtonStyle}
                    textStyle={cameraButtonTextStyle}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {cameraLive ? (
            <div style={{ inset: 0, pointerEvents: "none", position: "absolute" }}>
              <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 8, inset: "0 0 auto", padding: 12, position: "absolute", zIndex: 1 }}>
                <span
                  aria-label={`Tracking result: ${trackingResult}`}
                  style={{
                    backgroundColor: trackingReady ? `${colors.success}20` : `${colors.base}aa`,
                    border: `1px solid ${trackingReady ? `${colors.success}66` : `${colors.border}aa`}`,
                    borderRadius: 6,
                    color: trackingReady ? colors.success : colors.textSecondary,
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "4px 8px",
                    textTransform: "uppercase",
                  }}
                >
                  {trackingResult}
                </span>
                <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                  {previewMode ? (
                    <span style={{ backgroundColor: `${colors.base}aa`, borderRadius: 6, color: colors.textMuted, fontSize: 10, fontWeight: 600, padding: "4px 8px" }}>
                      Draft animation only
                    </span>
                  ) : null}
                  <span style={{ alignItems: "center", backgroundColor: `${colors.base}aa`, borderRadius: 6, color: subjectLocked ? colors.success : subjectSeen ? colors.warning : colors.textMuted, display: "inline-flex", fontSize: 10.5, fontWeight: 600, gap: 6, padding: "4px 8px" }}>
                    <span style={{ backgroundColor: subjectLocked ? colors.success : subjectSeen ? colors.warning : colors.textMuted, borderRadius: "50%", height: 6, width: 6 }} />
                    {subjectLocked ? "Tracking" : subjectSeen ? "Subject detected" : "Searching…"}
                  </span>
                </div>
              </div>
              {trackingRunning && subjectLocked ? (
                <div style={{ alignItems: "flex-end", background: "linear-gradient(to top, rgba(0,0,0,.8), transparent)", bottom: 0, color: "#fff", display: "flex", justifyContent: "space-between", gap: 12, insetInline: 0, padding: 12, position: "absolute" }}>
                  <div style={{ minWidth: 0 }}>
                    <FitText excludeGlobalScale style={{ color: "#aaa", display: "block", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Movement phase
                    </FitText>
                    <FitText excludeGlobalScale style={{ color: "#fff", display: "block", fontSize: 15, fontWeight: 700, lineHeight: 1.2, marginTop: 2 }}>
                      {trackingPhase}
                    </FitText>
                    <FitText excludeGlobalScale style={{ color: "#aaa", display: "block", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                      {isStaticHold
                        ? `hold ${(holdMs / 1000).toFixed(1)}s / ${holdDurationSeconds}s`
                        : `${trackingAngle === null ? "—" : `${trackingAngle}°`} · target ${downAngle}°/${upAngle}°`}
                    </FitText>
                  </div>
                  <div style={{ backgroundColor: "rgba(0,0,0,.55)", borderRadius: 10, minWidth: 68, padding: "8px 10px", textAlign: "center" }}>
                    <FitText excludeGlobalScale style={{ color: "#fff", display: "block", fontFamily: "monospace", fontSize: isStaticHold ? 22 : 26, fontWeight: 700, lineHeight: 1 }}>
                      {isStaticHold ? `${Math.round((holdMs / Math.max(1, holdDurationSeconds * 1000)) * 100)}%` : validReps}
                    </FitText>
                    <FitText excludeGlobalScale style={{ color: "#aaa", display: "block", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {isStaticHold ? "hold" : "valid reps"}
                    </FitText>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {cameraLive ? (
          <div
            aria-label="Tracking controls"
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gridColumn: "1",
              gridRow: "2",
              justifySelf: "center",
              maxWidth: 560,
              width: "100%",
            }}
          >
            <FitButton
              icon={VideoOff}
              label="Stop camera"
              onClick={() => stopCamera("idle")}
              style={cameraButtonStyle}
              textStyle={cameraButtonTextStyle}
              variant="ghost"
            />
            <FitButton
              disabled={!trackingRunning}
              icon={trackingPaused ? Play : CircleStop}
              label={trackingPaused ? "Resume tracking" : "Pause tracking"}
              onClick={trackingPaused ? resumeTracking : pauseTracking}
              variant="ghost"
              style={cameraButtonStyle}
              textStyle={cameraButtonTextStyle}
            />
            <FitButton
              icon={RotateCcw}
              label="Restart tracking"
              onClick={restartTracking}
              variant="ghost"
              style={cameraButtonStyle}
              textStyle={cameraButtonTextStyle}
            />
            <FitButton
              label="Reset test"
              onClick={resetTest}
              variant="ghost"
              style={cameraButtonStyle}
              textStyle={cameraButtonTextStyle}
            />
          </div>
        ) : null}

        <div
          style={{
            alignContent: "start",
            display: "grid",
            gap: 10,
            gridColumn: "2",
            gridRow: "1 / span 2",
            minWidth: 0,
          }}
        >
          {isBicepCurl ? (
            <div
              data-camera-equipment-context={equipmentContext}
              style={{ ...readoutStyle, display: "grid", gap: 8 }}
            >
              <label
                htmlFor="exercise-lab-camera-equipment"
                style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600 }}
              >
                Equipment used in this preview
              </label>
              <select
                aria-label="Equipment used in this preview"
                id="exercise-lab-camera-equipment"
                onChange={(event) =>
                  updateEquipmentContext(event.target.value as PoseEquipmentContext)
                }
                style={{
                  backgroundColor: colors.fieldBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  color: colors.textPrimary,
                  fontFamily: "inherit",
                  fontSize: 12,
                  minHeight: 36,
                  padding: "0 10px",
                  width: "100%",
                }}
                value={equipmentContext}
              >
                {CAMERA_EQUIPMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FitText excludeGlobalScale as="p" style={{ color: colors.textMuted, fontSize: 11.5, lineHeight: 1.35, margin: 0 }}>
                Camera does not detect equipment. Nothing here is saved to the exercise.
              </FitText>
            </div>
          ) : null}
          <div
            aria-label="Rep counters"
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            <div
              data-camera-counter="valid"
              style={{
                ...panelStyle,
                backgroundColor: `${colors.fieldBg}99`,
                display: "grid",
                gap: 3,
                padding: 10,
                textAlign: "center",
              }}
            >
              <FitText
                excludeGlobalScale
                style={{
                  color: colors.success,
                  display: "block",
                  fontFamily: "monospace",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {isStaticHold ? `${(holdMs / 1000).toFixed(1)}s` : validReps}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  color: colors.textMuted,
                  display: "block",
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Valid
              </FitText>
            </div>
            <div
              data-camera-counter="rejected"
              style={{
                ...panelStyle,
                backgroundColor: `${colors.fieldBg}99`,
                display: "grid",
                gap: 3,
                padding: 10,
                textAlign: "center",
              }}
            >
              <FitText
                excludeGlobalScale
                style={{
                  color: rejectedReps ? colors.warning : colors.textMuted,
                  display: "block",
                  fontFamily: "monospace",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {rejectedReps}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  color: colors.textMuted,
                  display: "block",
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Rejected
              </FitText>
            </div>
          </div>
          <div
            aria-label="Tracking confidence"
            data-tracking-readouts
            style={{ ...readoutStyle, display: "grid", gap: 8 }}
          >
            <FitText excludeGlobalScale style={{ color: colors.textMuted, display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 2, textTransform: "uppercase" }}>
                Tracking confidence
            </FitText>
            <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
              <div style={{ backgroundColor: colors.border, borderRadius: 999, flex: 1, height: 6, overflow: "hidden" }}>
                <div style={{ backgroundColor: trackingConfidence >= 0.6 ? colors.success : colors.danger, borderRadius: 999, height: "100%", transition: motionAllowed ? "width 120ms linear" : "none", width: `${trackingConfidence * 100}%` }} />
              </div>
              <FitText excludeGlobalScale style={{ color: trackingConfidence >= 0.6 ? colors.textPrimary : colors.danger, fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>
                {Math.round(trackingConfidence * 100)}%
              </FitText>
            </div>
          </div>

          <div style={{ ...readoutStyle, display: "grid", gap: 6 }}>
            <FitText excludeGlobalScale style={{ color: colors.textMuted, display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 2, textTransform: "uppercase" }}>
              Dominant joint
            </FitText>
            <div style={{ alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between" }}>
              <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 12.5 }}>
                {movementContract?.dominantJoint ?? "—"}
              </FitText>
              <FitText excludeGlobalScale style={{ color: colors.brand, fontFamily: "monospace", fontSize: 12 }}>
                {trackingAngle === null ? "—" : `${trackingAngle}°`}
              </FitText>
            </div>
          </div>

          <div style={{ ...readoutStyle, display: "grid", gap: 6 }}>
            <FitText excludeGlobalScale style={{ color: colors.textMuted, display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 2, textTransform: "uppercase" }}>
              Required landmarks
            </FitText>
            <FitText excludeGlobalScale style={{ color: missingLandmark ? colors.warning : !hasObservedPose ? colors.textMuted : colors.success, fontSize: 12, fontWeight: 600 }}>
              {missingLandmark
                ? "Configured landmark obscured"
                : !hasObservedPose
                  ? "Awaiting pose"
                  : movementContract?.trackingRequirements?.requiredLandmarks?.length
                  ? "Configured landmarks visible"
                  : "Not configured"}
            </FitText>
          </div>

          <div style={{ ...readoutStyle, display: "grid", gap: 8 }}>
            <FitText excludeGlobalScale style={{ color: colors.textMuted, display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 2, textTransform: "uppercase" }}>
              Subject &amp; phase
            </FitText>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div>
                <FitText excludeGlobalScale style={{ color: colors.textMuted, display: "block", fontSize: 10, textTransform: "uppercase" }}>Subject tracking</FitText>
                <FitText excludeGlobalScale style={{ color: subjectLocked ? colors.success : colors.textSecondary, display: "block", fontSize: 12, fontWeight: 600, marginTop: 3 }}>{subjectLocked ? "Tracking" : subjectSeen ? "Detected" : "Waiting"}</FitText>
              </div>
              <div>
                <FitText excludeGlobalScale style={{ color: colors.textMuted, display: "block", fontSize: 10, textTransform: "uppercase" }}>Phase</FitText>
                <FitText excludeGlobalScale style={{ color: colors.textPrimary, display: "block", fontSize: 12, fontWeight: 600, marginTop: 3 }}>{trackingRunning ? trackingPhase : "Not tested"}</FitText>
              </div>
            </div>
          </div>

          <details
            aria-label="Additional rep-flow preview"
            ref={repFlowDetailsRef}
            style={{ ...panelStyle, display: "block", padding: 10 }}
          >
            <summary
              style={{
                alignItems: "center",
                cursor: "pointer",
                display: "flex",
                gap: 8,
                justifyContent: "space-between",
                listStyle: "none",
              }}
            >
              <span style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 700 }}>
                Rep-flow preview
              </span>
              <span style={{ color: colors.textMuted, fontSize: 10.5 }}>
                {hasPreview
                  ? `${effectivePreviewReps} draft reps · animation only`
                  : "No movement rig"}
              </span>
            </summary>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 8,
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              <FitText
                excludeGlobalScale
                style={{ color: colors.textMuted, fontSize: 10.5 }}
              >
                Draft animation only
              </FitText>
              <FitButton
                aria-label={
                  previewPlaying
                    ? "Pause movement preview"
                    : "Play movement preview"
                }
                icon={previewPlaying ? Play : RotateCcw}
                iconOnly
                label={previewPlaying ? "Pause preview" : "Play preview"}
                onClick={() => {
                  if (previewPlaying) setPreviewPlaying(false);
                  else restartPreview();
                }}
                style={cameraButtonStyle}
                textStyle={cameraButtonTextStyle}
                variant="ghost"
              />
            </div>
            <div
              aria-label="Contract-driven rep-flow preview"
              data-preview-reps={effectivePreviewReps}
              data-preview-phase={phaseLabel}
              style={{ display: "grid", gap: 8, marginTop: 10 }}
            >
              <FitText
                excludeGlobalScale
                style={{ color: colors.textMuted, fontSize: 10.5, lineHeight: 1.3 }}
              >
                Draft animation only · never used for camera validation counts.
              </FitText>
              <div
                style={{
                  alignItems: "center",
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "86px minmax(0, 1fr)",
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    backgroundColor: colors.base,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "center",
                    minHeight: 86,
                    overflow: "hidden",
                    padding: 6,
                  }}
                >
                  {hasPreview ? (
                    <svg
                      aria-label={`Animated ${phaseLabel} movement rig`}
                      data-testid="exercise-lab-rep-flow-rig"
                      role="img"
                      viewBox="0 0 100 100"
                      style={{ height: 86, width: 86 }}
                    >
                      {RIG_BONES.map(([from, to]) => {
                        const start = getKeypointPosition(previewKeypoints[from]);
                        const end = getKeypointPosition(previewKeypoints[to]);
                        if (!start || !end) return null;
                        return (
                          <line
                            key={`${from}-${to}`}
                            stroke={`${colors.textSecondary}b8`}
                            strokeLinecap="round"
                            strokeWidth={1.7}
                            x1={start.x}
                            x2={end.x}
                            y1={start.y}
                            y2={end.y}
                          />
                        );
                      })}
                      {previewKeypoints.map((point, index) => {
                        const position = getKeypointPosition(point);
                        if (!position) return null;
                        return (
                          <circle
                            data-preview-landmark={index}
                            fill={index === 0 ? colors.brand : colors.success}
                            key={index}
                            r={index === 0 ? 2.7 : 1.9}
                            stroke={colors.base}
                            strokeWidth={0.7}
                            cx={position.x}
                            cy={position.y}
                          />
                        );
                      })}
                    </svg>
                  ) : (
                    <FitText
                      excludeGlobalScale
                      style={{ color: colors.textMuted, fontSize: 10, textAlign: "center" }}
                    >
                      No rig
                    </FitText>
                  )}
                </div>
                <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                  <div style={{ alignItems: "center", display: "flex", gap: 6, justifyContent: "space-between" }}>
                    <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5 }}>
                      Phase
                    </FitText>
                    <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 11, fontWeight: 700 }}>
                      {phaseLabel}
                    </FitText>
                  </div>
                  <div aria-label="Movement phase progress" style={{ display: "grid", gap: 5 }}>
                    <div style={{ backgroundColor: colors.border, borderRadius: 999, height: 5, overflow: "hidden" }}>
                      <div
                        style={{
                          backgroundColor: colors.brand,
                          borderRadius: 999,
                          height: "100%",
                          transition: motionAllowed ? "width 80ms linear" : "none",
                          width: `${hasPreview ? Math.max(4, previewProgress * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 4, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                    <div>
                      <FitText excludeGlobalScale style={{ color: colors.textMuted, display: "block", fontSize: 9.5, textTransform: "uppercase" }}>
                        Mode
                      </FitText>
                      <FitText excludeGlobalScale style={{ color: colors.textPrimary, display: "block", fontSize: 10.5, fontWeight: 700, marginTop: 2 }}>
                        {isStaticHold ? "Hold" : "Dynamic"}
                      </FitText>
                    </div>
                    <div>
                      <FitText excludeGlobalScale style={{ color: colors.textMuted, display: "block", fontSize: 9.5, textTransform: "uppercase" }}>
                        Target
                      </FitText>
                      <FitText excludeGlobalScale style={{ color: colors.textPrimary, display: "block", fontSize: 10.5, fontWeight: 700, marginTop: 2 }}>
                        {targetAngles ? `${targetAngles.down.angle}° / ${targetAngles.up.angle}°` : "—"}
                      </FitText>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </details>

        </div>
      </div>

      {summaryTarget ? createPortal(cameraTestSummary, summaryTarget) : cameraTestSummary}
      {trackingRunning && subjectLocked ? (
        <div
          role={trackingReady ? "status" : "alert"}
          style={{
            alignItems: "flex-start",
            backgroundColor: trackingReady ? `${colors.success}12` : lastReject ? `${colors.warning}12` : `${colors.brand}10`,
            border: `1px solid ${trackingReady ? `${colors.success}66` : lastReject ? `${colors.warning}66` : `${colors.brand}44`}`,
            borderRadius: 8,
            color: trackingReady ? colors.success : lastReject ? colors.warning : colors.textSecondary,
            display: "flex",
            gap: 8,
            padding: "9px 11px",
          }}
        >
          {trackingReady ? <CheckCircle2 size={15} /> : <Info size={15} />}
          <FitText excludeGlobalScale style={{ color: "inherit", fontSize: 12, lineHeight: 1.4 }}>
            {trackingReady
              ? "The current draft contract has observed a usable live signal; publishing remains independent."
              : lastReject ?? `Tracking — ${trackingPhase}.`}
          </FitText>
        </div>
      ) : null}

      {warnings.length > 0 && !trackingReady ? (
        <div aria-label="Tracking warnings" style={{ display: "grid", gap: 6 }}>
          {warnings.map((warning, index) => (
            <div
              key={`${warning}-${index}`}
              style={{ alignItems: "flex-start", backgroundColor: `${colors.warning}10`, border: `1px solid ${colors.warning}44`, borderRadius: 8, color: colors.warning, display: "flex", gap: 8, padding: "8px 10px" }}
            >
              <Info size={14} />
              <FitText excludeGlobalScale style={{ color: "inherit", fontSize: 11.5, lineHeight: 1.4 }}>{warning}</FitText>
            </div>
          ))}
        </div>
      ) : null}


      <style>{`
        .exercise-lab-camera-validation strong {
          color: inherit;
          font-weight: 900;
        }

        @media (max-width: 920px) {
          .exercise-lab-camera-validation {
            padding: 16px !important;
          }

          .exercise-lab-camera-grid,
          .exercise-lab-rep-preview-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .exercise-lab-camera-grid > [aria-label="Tracking controls"],
          .exercise-lab-camera-grid > div {
            grid-column: 1 !important;
            grid-row: auto !important;
          }

          .exercise-lab-camera-feed {
            aspect-ratio: 1 / 1 !important;
            justify-self: stretch !important;
            max-width: 560px !important;
            width: 100% !important;
          }

        }

        @media (max-width: 640px) {
          .exercise-lab-camera-feed--idle {
            aspect-ratio: auto !important;
            overflow: visible !important;
          }

          .exercise-lab-camera-feed--idle .exercise-lab-camera-idle-overlay {
            inset: auto !important;
            min-height: 0 !important;
            padding: 16px 14px !important;
            position: relative !important;
          }
        }

        @media (min-width: 921px) {
          .exercise-lab-camera-validation {
            padding: 20px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .exercise-lab-camera-validation * {
            scroll-behavior: auto !important;
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}

type CameraColors = ReturnType<typeof useTheme>["colors"];

function CameraSummaryMetric({
  colors,
  label,
  tone,
  value,
}: {
  colors: CameraColors;
  label: string;
  tone?: "danger" | "success" | "warning";
  value: string;
}) {
  const valueColor =
    tone === "danger"
      ? colors.danger
      : tone === "success"
        ? colors.success
        : tone === "warning"
          ? colors.warning
          : colors.textPrimary;
  return (
    <div style={{ backgroundColor: colors.base, border: `1px solid ${colors.border}`, borderRadius: 8, minWidth: 0, padding: "8px 9px" }}>
      <FitText excludeGlobalScale style={{ color: colors.textMuted, display: "block", fontSize: 10, letterSpacing: "0.04em", lineHeight: 1.2, textTransform: "uppercase" }}>
        {label}
      </FitText>
      <FitText excludeGlobalScale style={{ color: valueColor, display: "block", fontFamily: "monospace", fontSize: 13, fontWeight: 600, marginTop: 4 }}>
        {value}
      </FitText>
    </div>
  );
}

function CameraPoseOverlay({
  angle,
  colors,
  frameHeight,
  frameWidth,
  keypoints,
  missingLandmark,
  reducedMotion,
}: {
  angle: number | null;
  colors: CameraColors;
  frameHeight: number;
  frameWidth: number;
  keypoints: PoseKeypointRecord[];
  missingLandmark: boolean;
  reducedMotion: boolean;
}) {
  const width = Math.max(1, frameWidth);
  const height = Math.max(1, frameHeight);
  const getPosition = (point: PoseKeypointRecord | undefined) => {
    if (!point || point.visibility < 0.1) return null;
    return {
      x: clamp(point.x, 0, 1) * width,
      y: clamp(point.y, 0, 1) * height,
    };
  };
  return (
    <svg
      aria-label="Live tracking skeleton overlay"
      data-pose-overlay-source="on-device-pose-landmarker"
      data-testid="exercise-lab-camera-rig-overlay"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        height: "100%",
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        transform: "scaleX(-1)",
        transformOrigin: "center",
        width: "100%",
      }}
    >
      {RIG_BONES.map(([from, to], index) => {
        const start = getPosition(keypoints[from]);
        const end = getPosition(keypoints[to]);
        if (!start || !end) return null;
        return (
          <line
            key={index}
            className={reducedMotion ? undefined : "exercise-lab-camera-bone"}
            stroke={colors.brand}
            strokeLinecap="round"
            strokeOpacity={0.72}
            strokeWidth={Math.max(2, width * 0.004)}
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
          />
        );
      })}
      {keypoints.map((point, index) => {
        const position = getPosition(point);
        if (!position) return null;
        return (
          <circle
            cx={position.x}
            cy={position.y}
            fill={colors.textPrimary}
            key={index}
            opacity={Math.min(1, Math.max(0.24, point.visibility))}
            r={Math.max(3, width * 0.006)}
            stroke={colors.base}
            strokeWidth={Math.max(1, width * 0.0015)}
          />
        );
      })}
      {angle !== null ? (
        <text fill={colors.brand} fontFamily="monospace" fontSize={Math.max(12, width * 0.02)} fontWeight="700" x={width * 0.04} y={height * 0.08}>
          {angle}°
        </text>
      ) : null}
      {missingLandmark ? (
        <rect
          fill="none"
          height={height - 4}
          rx={Math.max(4, width * 0.01)}
          stroke={colors.warning}
          strokeDasharray={`${Math.max(4, width * 0.01)} ${Math.max(3, width * 0.008)}`}
          strokeWidth={Math.max(2, width * 0.002)}
          width={width - 4}
          x={2}
          y={2}
        />
      ) : null}
    </svg>
  );
}
