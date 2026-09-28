import type { StyleProp, ViewStyle } from "react-native";
import type { CameraType } from "expo-camera";

import type { PoseKeypointRecord, PoseSequenceFrameRecord } from "@fittrack/types";
import type { PoseSubjectCandidate } from "@fittrack/utils";
import type {
  CameraFrameOrientation,
  CameraRotation,
} from "@fittrack/utils";
import type {
  FitTrackMultiPoseError,
  FitTrackMultiPoseSessionStatus,
} from "@/modules/fittrack-multi-pose/src";

export type NativePoseFrame = PoseSequenceFrameRecord & {
  candidates?: PoseSubjectCandidate[];
  cameraFacing: CameraType;
  frameHeight: number;
  frameWidth: number;
  generation: number;
  mirrorX: boolean;
  orientation: CameraFrameOrientation;
  rotation: CameraRotation;
  source: "vision_camera_mlkit" | "vision_camera_mediapipe";
  streamId: number;
};

/**
 * Every native delivery, including a frame where detection found no body,
 * carries the stream identity and the timestamp captured inside the frame
 * processor.  The controller validates this envelope before touching state.
 */
export type NativePoseObservation = {
  capturedAtMs: number;
  frame: NativePoseFrame | null;
  generation: number;
  streamId: number;
  error?: "pose_detector_error" | FitTrackMultiPoseError;
};

export type NativeVisionPoseCameraProps = {
  cameraFacing: CameraType;
  isActive: boolean;
  onCameraContinuityChange?: (active: boolean) => void;
  onMultiPoseAvailabilityChange?: (available: boolean) => void;
  onMultiPoseStatusChange?: (
    status: FitTrackMultiPoseSessionStatus,
    error?: FitTrackMultiPoseError | null,
  ) => void;
  poseProcessingEnabled?: boolean;
  subjectTrackingEnabled?: boolean;
  streamGeneration: number;
  streamId: number;
  onPoseFrame: (observation: NativePoseObservation) => void | Promise<void>;
  style?: StyleProp<ViewStyle>;
};

export type NativePoseLandmark = {
  confidence?: number;
  visibility?: number;
  x?: number;
  y?: number;
  z?: number;
};

export type NativePoseKeypoint = PoseKeypointRecord;
