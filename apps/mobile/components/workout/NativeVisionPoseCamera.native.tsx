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
import { Worklets } from "react-native-worklets-core";
import { detectPose } from "vision-camera-pose-detector";

import type {
  NativePoseFrame,
  NativePoseKeypoint,
  NativePoseLandmark,
  NativeVisionPoseCameraProps,
} from "@/components/workout/NativeVisionPoseCamera.types";

const TARGET_POSE_FPS = 20;
const EQUIPMENT_SNAPSHOT_INTERVAL_MS = 1800;
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
  mirrorX: boolean,
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
      x: clampUnit(mirrorX ? 1 - rawX : rawX),
      y: clampUnit(rawY),
      z:
        typeof landmark.z === "number" && Number.isFinite(landmark.z)
          ? landmark.z
          : 0,
    });
  }

  return keypoints.length === 33 ? keypoints : null;
}

function toFileUri(path: string) {
  return path.startsWith("file://") ? path : `file://${path}`;
}

export function NativeVisionPoseCamera({
  cameraFacing,
  equipmentSnapshotActive = false,
  isActive,
  onEquipmentSnapshot,
  onPoseFrame,
  style,
}: NativeVisionPoseCameraProps) {
  const cameraRef = useRef<Camera>(null);
  const equipmentSnapshotInFlightRef = useRef(false);
  const equipmentSnapshotCaptureWarningShownRef = useRef(false);
  const equipmentSnapshotDeliveryWarningShownRef = useRef(false);
  const onEquipmentSnapshotRef = useRef(onEquipmentSnapshot);
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice(cameraFacing);
  const hasEquipmentSnapshotHandler = !!onEquipmentSnapshot;
  const cameraShouldRun = isActive && isFocused && appState === "active";

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    onEquipmentSnapshotRef.current = onEquipmentSnapshot;
  }, [onEquipmentSnapshot]);

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (
      !equipmentSnapshotActive ||
      !cameraShouldRun ||
      !hasEquipmentSnapshotHandler
    ) {
      return undefined;
    }

    let cancelled = false;
    const captureEquipmentSnapshot = async () => {
      if (equipmentSnapshotInFlightRef.current || !cameraRef.current) {
        return;
      }

      equipmentSnapshotInFlightRef.current = true;
      try {
        let snapshot: Awaited<ReturnType<Camera["takeSnapshot"]>>;
        try {
          snapshot = await cameraRef.current.takeSnapshot({ quality: 60 });
        } catch (error) {
          if (!equipmentSnapshotCaptureWarningShownRef.current) {
            equipmentSnapshotCaptureWarningShownRef.current = true;
            console.warn("Native equipment snapshot capture failed", error);
          }
          return;
        }

        const frameUri = toFileUri(snapshot.path);
        if (cancelled || !frameUri) return;

        try {
          await onEquipmentSnapshotRef.current?.({
            cameraFacing,
            capturedAtMs: Date.now(),
            frameHeight: snapshot.height,
            frameUri,
            frameWidth: snapshot.width,
            source: "vision_camera_snapshot",
          });
        } catch (error) {
          if (!equipmentSnapshotDeliveryWarningShownRef.current) {
            equipmentSnapshotDeliveryWarningShownRef.current = true;
            console.warn("Native equipment snapshot delivery failed", error);
          }
        }
      } catch (error) {
        // Snapshot capture is best-effort and should never stop live pose tracking.
        if (!equipmentSnapshotCaptureWarningShownRef.current) {
          equipmentSnapshotCaptureWarningShownRef.current = true;
          console.warn("Native equipment snapshot loop failed", error);
        }
      } finally {
        equipmentSnapshotInFlightRef.current = false;
      }
    };

    void captureEquipmentSnapshot();
    const interval = setInterval(
      () => void captureEquipmentSnapshot(),
      EQUIPMENT_SNAPSHOT_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      equipmentSnapshotCaptureWarningShownRef.current = false;
      equipmentSnapshotDeliveryWarningShownRef.current = false;
      clearInterval(interval);
    };
  }, [
    cameraFacing,
    equipmentSnapshotActive,
    hasEquipmentSnapshotHandler,
    cameraShouldRun,
  ]);

  const emitPoseFrame = useMemo(
    () =>
      Worklets.createRunOnJS((frame: NativePoseFrame) => {
        void onPoseFrame(frame);
      }),
    [onPoseFrame],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      if (!cameraShouldRun) return;

      runAtTargetFps(TARGET_POSE_FPS, () => {
        "worklet";
        const pose = detectPose(frame);
        if (!pose) return;

        const keypoints = normalizePoseLandmarks(
          pose as unknown as Record<string, NativePoseLandmark | undefined>,
          frame.width,
          frame.height,
          cameraFacing === "front" || frame.isMirrored,
        );
        if (!keypoints) return;

        void emitPoseFrame({
          cameraFacing,
          capturedAtMs: Date.now(),
          frameHeight: frame.height,
          frameWidth: frame.width,
          keypoints,
          source: "vision_camera_mlkit",
        });
      });
    },
    [cameraFacing, cameraShouldRun, emitPoseFrame],
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
      pixelFormat="yuv"
      preview
      resizeMode="cover"
      style={style}
      video={equipmentSnapshotActive}
    />
  );
}
