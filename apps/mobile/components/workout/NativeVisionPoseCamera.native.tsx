import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from "react-native-vision-camera";
import { useSharedValue, Worklets } from "react-native-worklets-core";
import { detectPose } from "vision-camera-pose-detector";
import { cameraRotationFromOrientation } from "@fittrack/utils";
import {
  createFitTrackMultiPoseSession,
  detectFitTrackMultiPose,
  isFitTrackMultiPoseSupported,
  releaseFitTrackMultiPoseSession,
} from "@/modules/fittrack-multi-pose/src";
import type {
  FitTrackMultiPoseSession,
} from "@/modules/fittrack-multi-pose/src";

import type {
  NativePoseFrame,
  NativePoseKeypoint,
  NativePoseLandmark,
  NativePoseObservation,
  NativeVisionPoseCameraProps,
} from "@/components/workout/NativeVisionPoseCamera.types";

const TARGET_POSE_FPS = 20;
const LANDMARK_KEY_ALIASES = [
  ["nose"],
  ["leftEyeInner"],
  ["leftEye"],
  ["leftEyeOuter"],
  ["rightEyeInner"],
  ["rightEye"],
  ["rightEyeOuter"],
  ["leftEar"],
  ["rightEar"],
  ["mouthLeft", "leftMouth"],
  ["mouthRight", "rightMouth"],
  ["leftShoulder"],
  ["rightShoulder"],
  ["leftElbow"],
  ["rightElbow"],
  ["leftWrist"],
  ["rightWrist"],
  ["leftPinkyFinger", "leftPinky"],
  ["rightPinkyFinger", "rightPinky"],
  ["leftIndexFinger", "leftIndex"],
  ["rightIndexFinger", "rightIndex"],
  ["leftThumb"],
  ["rightThumb"],
  ["leftHip"],
  ["rightHip"],
  ["leftKnee"],
  ["rightKnee"],
  ["leftAnkle"],
  ["rightAnkle"],
  ["leftHeel"],
  ["rightHeel"],
  ["leftFootIndex"],
  ["rightFootIndex"],
] as const;

function clampUnit(value: number) {
  "worklet";
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeCoordinate(value: number | undefined, frameSize: number) {
  "worklet";
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value >= 0 && value <= 1) return value;
  if (frameSize <= 0) return 0;
  return value / frameSize;
}

function readLandmark(
  landmarks: Record<string, NativePoseLandmark | undefined>,
  aliases: readonly string[],
) {
  "worklet";
  for (let index = 0; index < aliases.length; index += 1) {
    const landmark = landmarks[aliases[index]];
    if (landmark) return landmark;
  }
  return null;
}

function normalizePoseLandmarks(
  landmarks: Record<string, NativePoseLandmark | undefined>,
  frameWidth: number,
  frameHeight: number,
): NativePoseKeypoint[] | null {
  "worklet";
  const keypoints: NativePoseKeypoint[] = [];

  for (let index = 0; index < LANDMARK_KEY_ALIASES.length; index += 1) {
    const landmark = readLandmark(landmarks, LANDMARK_KEY_ALIASES[index]);
    if (!landmark) {
      keypoints.push({ visibility: 0, x: 0, y: 0, z: 0 });
      continue;
    }

    const rawX = normalizeCoordinate(landmark.x, frameWidth);
    const rawY = normalizeCoordinate(landmark.y, frameHeight);
    const visibility =
      typeof landmark.confidence === "number"
        ? landmark.confidence
        : typeof landmark.visibility === "number"
          ? landmark.visibility
          : 0;

    keypoints.push({
      visibility: clampUnit(visibility),
      x: clampUnit(rawX),
      y: clampUnit(rawY),
      z:
        typeof landmark.z === "number" && Number.isFinite(landmark.z)
          ? landmark.z
          : 0,
    });
  }

  return keypoints.length === 33 ? keypoints : null;
}

export function NativeVisionPoseCamera({
  cameraFacing,
  isActive,
  onCameraContinuityChange,
  onMultiPoseAvailabilityChange,
  onMultiPoseStatusChange,
  poseProcessingEnabled = true,
  onPoseFrame,
  streamGeneration,
  streamId,
  subjectTrackingEnabled = false,
  style,
}: NativeVisionPoseCameraProps) {
  const cameraRef = useRef<Camera>(null);
  const onCameraContinuityChangeRef = useRef(onCameraContinuityChange);
  const onPoseFrameRef = useRef(onPoseFrame);
  const onMultiPoseAvailabilityChangeRef = useRef(
    onMultiPoseAvailabilityChange,
  );
  const onMultiPoseStatusChangeRef = useRef(onMultiPoseStatusChange);
  const multiPoseSessionRef = useRef<FitTrackMultiPoseSession | null>(null);
  const activeMultiPoseSessionKeyRef = useRef<string | null>(null);
  const multiPoseFaultKeyRef = useRef<string | null>(null);
  const multiPoseFaultKey = useSharedValue("");
  const [multiPoseSession, setMultiPoseSession] =
    useState<FitTrackMultiPoseSession | null>(null);
  const pendingPoseObservationRef = useRef<NativePoseObservation | null>(null);
  const poseDispatchScheduledRef = useRef(false);
  const poseDispatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice(cameraFacing);
  const cameraShouldRun =
    isActive && isFocused && appState === "active" && !!device;
  const multiPoseStreamKey = `${streamGeneration}:${streamId}`;

  useEffect(() => {
    onCameraContinuityChangeRef.current = onCameraContinuityChange;
  }, [onCameraContinuityChange]);

  useEffect(() => {
    onPoseFrameRef.current = onPoseFrame;
  }, [onPoseFrame]);

  useEffect(() => {
    onMultiPoseAvailabilityChangeRef.current = onMultiPoseAvailabilityChange;
  }, [onMultiPoseAvailabilityChange]);

  useEffect(() => {
    onMultiPoseStatusChangeRef.current = onMultiPoseStatusChange;
  }, [onMultiPoseStatusChange]);

  useEffect(() => {
    try {
      onMultiPoseAvailabilityChangeRef.current?.(
        isFitTrackMultiPoseSupported(),
      );
    } catch {
      onMultiPoseAvailabilityChangeRef.current?.(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const releaseCurrentSession = () => {
      const current = multiPoseSessionRef.current;
      multiPoseSessionRef.current = null;
      activeMultiPoseSessionKeyRef.current = null;
      multiPoseFaultKeyRef.current = null;
      multiPoseFaultKey.value = "";
      setMultiPoseSession(null);
      if (current) {
        void releaseFitTrackMultiPoseSession(current);
      }
    };

    if (!subjectTrackingEnabled || !cameraShouldRun || !poseProcessingEnabled) {
      releaseCurrentSession();
      onMultiPoseStatusChangeRef.current?.("off", null);
      return () => {
        cancelled = true;
      };
    }

    releaseCurrentSession();
    onMultiPoseStatusChangeRef.current?.("starting", null);
    void createFitTrackMultiPoseSession().then((result) => {
      if (cancelled) {
        if (result.session) {
          void releaseFitTrackMultiPoseSession(result.session);
        }
        return;
      }
      if (result.error) {
        const unavailable =
          result.error.code === "module_unavailable" ||
          result.error.code === "plugin_unavailable" ||
          result.error.code === "native_bridge_unavailable";
        onMultiPoseAvailabilityChangeRef.current?.(!unavailable);
        onMultiPoseStatusChangeRef.current?.(
          unavailable ? "unavailable" : "error",
          result.error,
        );
        return;
      }
      multiPoseSessionRef.current = result.session;
      activeMultiPoseSessionKeyRef.current = multiPoseStreamKey;
      multiPoseFaultKeyRef.current = null;
      multiPoseFaultKey.value = "";
      setMultiPoseSession(result.session);
      onMultiPoseAvailabilityChangeRef.current?.(true);
      onMultiPoseStatusChangeRef.current?.("ready", null);
    });

    return () => {
      cancelled = true;
      releaseCurrentSession();
      onMultiPoseStatusChangeRef.current?.("off", null);
    };
  }, [
    cameraFacing,
    cameraShouldRun,
    poseProcessingEnabled,
    streamGeneration,
    streamId,
    subjectTrackingEnabled,
    multiPoseStreamKey,
  ]);

  useEffect(
    () => () => {
      if (poseDispatchTimerRef.current) {
        clearTimeout(poseDispatchTimerRef.current);
        poseDispatchTimerRef.current = null;
      }
      poseDispatchScheduledRef.current = false;
      pendingPoseObservationRef.current = null;
    },
    [],
  );

  useEffect(() => {
    onCameraContinuityChangeRef.current?.(cameraShouldRun);
  }, [cameraShouldRun]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const emitPoseFrame = useMemo(
    () =>
      Worklets.createRunOnJS((observation: NativePoseObservation) => {
        if (observation.error && typeof observation.error === "object") {
          const observationKey = `${observation.generation}:${observation.streamId}`;
          if (multiPoseFaultKeyRef.current !== observationKey) {
            multiPoseFaultKeyRef.current = observationKey;
            if (activeMultiPoseSessionKeyRef.current === observationKey) {
              const currentSession = multiPoseSessionRef.current;
              multiPoseSessionRef.current = null;
              activeMultiPoseSessionKeyRef.current = null;
              setMultiPoseSession(null);
              if (currentSession) {
                void releaseFitTrackMultiPoseSession(currentSession);
              }
            }
          }
        }
        // Frame processors run faster than the JS controller can safely render
        // on low-end devices. Keep only the newest observation and deliver at
        // most one callback per JS turn.
        pendingPoseObservationRef.current = observation;
        if (poseDispatchScheduledRef.current) return;
        poseDispatchScheduledRef.current = true;
        poseDispatchTimerRef.current = setTimeout(() => {
          poseDispatchTimerRef.current = null;
          poseDispatchScheduledRef.current = false;
          const nextObservation = pendingPoseObservationRef.current;
          pendingPoseObservationRef.current = null;
          if (!nextObservation) return;
          try {
            void Promise.resolve(onPoseFrameRef.current(nextObservation)).catch(
              () => undefined,
            );
          } catch {
            // A controller callback must never escape the frame dispatch turn
            // and take down the mounted camera surface.
          }
        }, 0);
      }),
    [],
  );
  const multiPosePlugin = multiPoseSession?.plugin ?? null;
  const multiPoseSessionId = multiPoseSession?.sessionId ?? "";

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      if (!cameraShouldRun || !poseProcessingEnabled) return;

      runAtTargetFps(subjectTrackingEnabled ? 12 : TARGET_POSE_FPS, () => {
        "worklet";
        const capturedAtMs = Date.now();
        if (subjectTrackingEnabled) {
          if (multiPoseFaultKey.value === multiPoseStreamKey) return;
          if (!multiPosePlugin || !multiPoseSessionId) return;
          const detection = detectFitTrackMultiPose(
            frame,
            multiPosePlugin,
            multiPoseSessionId,
          );
          if (detection.status === "error") {
            multiPoseFaultKey.value = multiPoseStreamKey;
            void emitPoseFrame({
              capturedAtMs,
              error: detection.error,
              frame: null,
              generation: streamGeneration,
              streamId,
            });
            return;
          }
          const candidates = detection.candidates;
          const firstCandidate = candidates[0];
          if (!firstCandidate) {
            void emitPoseFrame({
              capturedAtMs,
              frame: null,
              generation: streamGeneration,
              streamId,
            });
            return;
          }
          const nativeFrame: NativePoseFrame = {
            cameraFacing,
            capturedAtMs,
            candidates,
            frameHeight: frame.height,
            frameWidth: frame.width,
            generation: streamGeneration,
            keypoints: firstCandidate.keypoints,
            spatialKeypoints: firstCandidate.spatialKeypoints,
            mirrorX: cameraFacing === "front" || frame.isMirrored,
            orientation: frame.orientation,
            rotation: cameraRotationFromOrientation(frame.orientation),
            source: "vision_camera_mediapipe",
            streamId,
          };
          void emitPoseFrame({
            capturedAtMs,
            frame: nativeFrame,
            generation: streamGeneration,
            streamId,
          });
          return;
        }
        let pose: ReturnType<typeof detectPose> | undefined;
        try {
          pose = detectPose(frame);
        } catch {
          void emitPoseFrame({
            capturedAtMs,
            error: "pose_detector_error",
            frame: null,
            generation: streamGeneration,
            streamId,
          });
          return;
        }
        if (!pose) {
          void emitPoseFrame({
            capturedAtMs,
            frame: null,
            generation: streamGeneration,
            streamId,
          });
          return;
        }

        const keypoints = normalizePoseLandmarks(
          pose as unknown as Record<string, NativePoseLandmark | undefined>,
          frame.width,
          frame.height,
        );
        if (!keypoints) {
          void emitPoseFrame({
            capturedAtMs,
            frame: null,
            generation: streamGeneration,
            streamId,
          });
          return;
        }

        const nativeFrame: NativePoseFrame = {
          cameraFacing,
          capturedAtMs,
          frameHeight: frame.height,
          frameWidth: frame.width,
          generation: streamGeneration,
          candidates: [{ keypoints }],
          keypoints,
          mirrorX: cameraFacing === "front" || frame.isMirrored,
          orientation: frame.orientation,
          rotation: cameraRotationFromOrientation(frame.orientation),
          source: "vision_camera_mlkit",
          streamId,
        };
        void emitPoseFrame({
          capturedAtMs,
          frame: nativeFrame,
          generation: streamGeneration,
          streamId,
        });
      });
    },
    [
      cameraFacing,
      cameraShouldRun,
      emitPoseFrame,
      multiPosePlugin,
      multiPoseSessionId,
      multiPoseFaultKey,
      multiPoseStreamKey,
      poseProcessingEnabled,
      streamGeneration,
      streamId,
      subjectTrackingEnabled,
    ],
  );

  if (!hasPermission || !device) {
    return <View style={style} />;
  }

  return (
    <Camera
      ref={cameraRef}
      device={device}
      enableFpsGraph={false}
      frameProcessor={frameProcessor}
      isActive={cameraShouldRun}
      pixelFormat={subjectTrackingEnabled ? "rgb" : "yuv"}
      preview
      resizeMode="cover"
      style={style}
    />
  );
}
