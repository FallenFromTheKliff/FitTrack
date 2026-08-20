import type { StyleProp, ViewStyle } from "react-native";
import type { CameraType } from "expo-camera";

import type { PoseKeypointRecord, PoseSequenceFrameRecord } from "@fittrack/types";

export type NativePoseFrame = PoseSequenceFrameRecord & {
  cameraFacing: CameraType;
  frameHeight: number;
  frameWidth: number;
  source: "vision_camera_mlkit";
};

export type NativeEquipmentSnapshot = {
  cameraFacing: CameraType;
  capturedAtMs: number;
  frameBase64?: string;
  frameHeight: number;
  frameUri: string;
  frameWidth: number;
  source: "vision_camera_snapshot";
};

export type NativeVisionPoseCameraProps = {
  cameraFacing: CameraType;
  equipmentSnapshotActive?: boolean;
  isActive: boolean;
  poseProcessingEnabled?: boolean;
  onEquipmentSnapshot?: (snapshot: NativeEquipmentSnapshot) => void | Promise<void>;
  onPoseFrame: (frame: NativePoseFrame) => void | Promise<void>;
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
