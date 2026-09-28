import type {
  PoseAngleFrameSignalRecord,
  PoseBodyOrientation,
  PoseJointName,
  PoseKeypointRecord,
  PoseMovementContractRecord,
  PoseRepAngleDataRecord,
  PoseSequenceFrameRecord,
  PoseSequenceSignalsRecord,
  PoseTrackingRequirementsRecord,
} from "@fittrack/types";
import {
  CANONICAL_POSE_CAPABILITIES,
  CANONICAL_POSE_EXERCISE_KEYS,
  getCanonicalPoseCapabilityByLabel,
} from "./fitness-catalog";
import { validatePoseRepAcceptancePolicy } from "./pose-rep-policy";

export type PoseCoordinateDimensions = {
  /** Set only for landmarks with X/Y/Z in a common coordinate space. */
  depthScale?: number;
  width: number;
  height: number;
};

type JointIndexes = {
  a: number;
  b: number;
  c: number;
};

const LANDMARK_NAMES = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
] as const;

type PoseLandmarkName = (typeof LANDMARK_NAMES)[number];
type PoseSideJointName =
  | "left_elbow"
  | "right_elbow"
  | "left_ankle"
  | "right_ankle"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_shoulder"
  | "right_shoulder";

const JOINT_MAP: Record<PoseJointName, JointIndexes[]> = {
  ankle: [
    { a: 25, b: 27, c: 31 },
    { a: 26, b: 28, c: 32 },
  ],
  elbow: [
    { a: 11, b: 13, c: 15 },
    { a: 12, b: 14, c: 16 },
  ],
  hip: [
    { a: 11, b: 23, c: 25 },
    { a: 12, b: 24, c: 26 },
  ],
  knee: [
    { a: 23, b: 25, c: 27 },
    { a: 24, b: 26, c: 28 },
  ],
  shoulder: [
    { a: 13, b: 11, c: 23 },
    { a: 14, b: 12, c: 24 },
  ],
};
const SIDE_JOINT_MAP: Record<PoseSideJointName, JointIndexes> = {
  left_ankle: { a: 25, b: 27, c: 31 },
  right_ankle: { a: 26, b: 28, c: 32 },
  left_elbow: { a: 11, b: 13, c: 15 },
  right_elbow: { a: 12, b: 14, c: 16 },
  left_hip: { a: 11, b: 23, c: 25 },
  right_hip: { a: 12, b: 24, c: 26 },
  left_knee: { a: 23, b: 25, c: 27 },
  right_knee: { a: 24, b: 26, c: 28 },
  left_shoulder: { a: 13, b: 11, c: 23 },
  right_shoulder: { a: 14, b: 12, c: 24 },
};

const MIN_CONFIDENCE = 0.5;
const PUSH_UP_SYMMETRY_TOLERANCE = 85;
const PULL_UP_SYMMETRY_TOLERANCE = 60;
const MIN_RELIABLE_FRAME_LANDMARKS = 12;
export const POSE_MOVEMENT_CONTRACT_VERSION = "pose_movement_contract_v2";

export const POSE_AUTO_REP_EXERCISE_KEYS = CANONICAL_POSE_EXERCISE_KEYS;
export const POSE_AUTO_REP_CAPABILITIES = CANONICAL_POSE_CAPABILITIES;

export type PoseAutoRepExerciseKey =
  (typeof POSE_AUTO_REP_EXERCISE_KEYS)[number];

export function getPoseAutoRepCapability(exerciseKey: string) {
  return (
    POSE_AUTO_REP_CAPABILITIES.find(
      (capability) => capability.exerciseKey === exerciseKey,
    ) ?? null
  );
}

export function getPoseAutoRepCapabilityForLabel(
  exerciseLabel: string | null | undefined,
) {
  const catalogCapability = getCanonicalPoseCapabilityByLabel(exerciseLabel);
  if (catalogCapability) {
    return catalogCapability;
  }

  const canonical = toCanonicalPoseExerciseLabel(exerciseLabel);
  return (
    POSE_AUTO_REP_CAPABILITIES.find(
      (capability) => capability.poseExercise === canonical,
    ) ?? null
  );
}

const POSE_BODY_ORIENTATION_BY_EXERCISE: Record<string, PoseBodyOrientation> = {
  bench_press: "horizontal",
  bicep_curl: "upright",
  dip: "upright",
  plank: "horizontal",
  pull_up: "upright",
  push_up: "horizontal",
  seated_cable_row: "upright",
  shoulder_press: "upright",
  squat: "upright",
};

const POSE_TRACKING_REQUIREMENTS_BY_EXERCISE: Record<
  string,
  PoseTrackingRequirementsRecord
> = {
  bench_press: {
    minConfidence: 0.6,
    minReliableFrameLandmarks: 12,
    requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
  },
  bicep_curl: {
    minConfidence: 0.6,
    minReliableFrameLandmarks: 12,
    requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
  },
  dip: {
    minConfidence: 0.6,
    minReliableFrameLandmarks: 12,
    requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
  },
  plank: {
    minConfidence: 0.6,
    minReliableFrameLandmarks: 12,
    requiredLandmarks: ["shoulders", "hips", "ankles"],
  },
  pull_up: {
    minConfidence: 0.55,
    minReliableFrameLandmarks: 10,
    requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
  },
  push_up: {
    minConfidence: 0.6,
    minReliableFrameLandmarks: 12,
    requiredLandmarks: ["shoulders", "elbows", "wrists", "hips", "ankles"],
  },
  seated_cable_row: {
    minConfidence: 0.6,
    minReliableFrameLandmarks: 12,
    requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
  },
  shoulder_press: {
    minConfidence: 0.6,
    minReliableFrameLandmarks: 12,
    requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
  },
  squat: {
    minConfidence: 0.6,
    minReliableFrameLandmarks: 12,
    requiredLandmarks: ["shoulders", "hips", "knees", "ankles"],
  },
};
const FALLBACK_POSE_MOVEMENT_CONTRACTS: Record<
  string,
  PoseMovementContractRecord
> = {
  bench_press: {
    dominantJoint: "elbow",
    degradedConditions: [
      "left_arm_occluded",
      "right_arm_occluded",
      "asymmetry_over_tolerance",
    ],
    exercise: "bench_press",
    noCountConditions: [
      "one_arm_only",
      "left_right_phase_desync",
      "bar_path_unavailable",
    ],
    oscillatingJoints: ["elbow", "shoulder"],
    phaseOrder: ["setup", "down", "up"],
    primaryJoints: ["left_elbow", "right_elbow"],
    repModel: "bilateral",
    repThresholds: {
      // A normal camera-visible press arc: a controlled bend and lockout,
      // without requiring the forearm to disappear under the bar path.
      down: { angle: 90, tolerance: 15 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "bar_path",
    secondaryJoints: ["left_shoulder", "right_shoulder"],
    spatialRequirements: {
      bodyLineTolerance: 40,
      bodyXDriftMax: 0.08,
      bodyYTravelMin: 0,
      leftRightSymmetryTolerance: 28,
      phaseSyncToleranceMs: 350,
    },
  },
  bicep_curl: {
    dominantJoint: "elbow",
    exercise: "bicep_curl",
    noCountConditions: [
      "equipment_required",
      "insufficient_elbow_rom",
      "bilateral_arm_motion_unconfirmed",
      "curl_grip_unconfirmed",
      "curl_torso_not_upright",
      "hip_swing_over_tolerance",
    ],
    oscillatingJoints: ["elbow"],
    phaseOrder: ["setup", "down", "up"],
    primaryJoints: ["left_elbow", "right_elbow"],
    repThresholds: {
      // Require a recognisable extension-to-curl arc without requiring a
      // fully locked elbow or unnaturally tight curl.
      down: { angle: 90, tolerance: 15 },
      up: { angle: 155, tolerance: 12 },
    },
    repModel: "bilateral",
    requiredSides: "both",
    secondaryCheck: "hip_stability",
    secondaryJoints: ["hip", "shoulder"],
    spatialRequirements: {
      bodyLineTolerance: 45,
      bodyXDriftMax: 0.08,
      bodyYTravelMin: 0,
      leftRightSymmetryTolerance: 60,
      phaseSyncToleranceMs: 950,
    },
  },
  dumbbell_bench_press: {
    bodyOrientation: "horizontal",
    dominantJoint: "elbow",
    exercise: "dumbbell_bench_press",
    noCountConditions: [
      "one_arm_only",
      "phase_desync",
      "press_path_unavailable",
    ],
    oscillatingJoints: ["elbow", "shoulder"],
    phaseOrder: ["setup", "down", "up"],
    primaryJoints: ["left_elbow", "right_elbow"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 100, tolerance: 12 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "dumbbell_press_path",
    secondaryJoints: ["left_shoulder", "right_shoulder"],
    spatialRequirements: {
      bodyLineTolerance: 40,
      bodyXDriftMax: 0.08,
      leftRightSymmetryTolerance: 30,
      phaseSyncToleranceMs: 450,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
    },
  },
  incline_dumbbell_press: {
    bodyOrientation: "inclined",
    dominantJoint: "elbow",
    exercise: "incline_dumbbell_press",
    noCountConditions: [
      "one_arm_only",
      "phase_desync",
      "press_path_unavailable",
    ],
    oscillatingJoints: ["elbow", "shoulder"],
    phaseOrder: ["setup", "down", "up"],
    primaryJoints: ["left_elbow", "right_elbow"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 105, tolerance: 12 },
      up: { angle: 150, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "inclined_press_path",
    secondaryJoints: ["left_shoulder", "right_shoulder"],
    spatialRequirements: {
      bodyLineTolerance: 45,
      bodyXDriftMax: 0.1,
      leftRightSymmetryTolerance: 32,
      phaseSyncToleranceMs: 500,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
    },
  },
  cable_fly: {
    bodyOrientation: "upright",
    dominantJoint: "shoulder",
    exercise: "cable_fly",
    noCountConditions: [
      "one_arm_only",
      "phase_desync",
      "cable_path_unavailable",
    ],
    oscillatingJoints: ["shoulder", "elbow"],
    phaseOrder: ["setup", "down", "up"],
    primaryJoints: ["left_shoulder", "right_shoulder"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 100, tolerance: 12 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "cable_fly_arc",
    secondaryJoints: ["left_elbow", "right_elbow"],
    spatialRequirements: {
      bodyLineTolerance: 40,
      bodyXDriftMax: 0.12,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 550,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
    },
  },
  lateral_raise: {
    bodyOrientation: "upright",
    dominantJoint: "shoulder",
    exercise: "lateral_raise",
    noCountConditions: [
      "one_arm_only",
      "phase_desync",
      "shoulder_arc_unavailable",
    ],
    oscillatingJoints: ["shoulder", "elbow"],
    phaseOrder: ["setup", "down", "up"],
    primaryJoints: ["left_shoulder", "right_shoulder"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 100, tolerance: 12 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "lateral_raise_arc",
    secondaryJoints: ["left_elbow", "right_elbow"],
    spatialRequirements: {
      bodyLineTolerance: 38,
      bodyXDriftMax: 0.12,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 500,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
    },
  },
  lat_pulldown: {
    bodyOrientation: "any",
    dominantJoint: "shoulder",
    shoulderReference: "shoulder_line",
    exercise: "lat_pulldown",
    noCountConditions: ["one_arm_only", "phase_desync"],
    oscillatingJoints: ["shoulder", "elbow"],
    phaseOrder: ["setup", "pull", "release"],
    primaryJoints: ["left_shoulder", "right_shoulder"],
    repModel: "bilateral",
    repThresholds: {
      // Measure arm height against the shoulder line: overhead -> lower arms.
      // A curl that only bends the elbows cannot complete this movement.
      down: { angle: 90, tolerance: 15 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "lat_vertical_pull",
    secondaryJoints: ["left_elbow", "right_elbow"],
    spatialRequirements: {
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 650,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 4,
      requiredLandmarks: ["left_shoulder", "right_shoulder", "elbows"],
    },
  },
  barbell_row: {
    bodyOrientation: "inclined",
    dominantJoint: "elbow",
    exercise: "barbell_row",
    noCountConditions: ["one_arm_only", "phase_desync", "torso_brace_failure"],
    oscillatingJoints: ["elbow", "shoulder", "hip"],
    phaseOrder: ["setup", "pull", "return"],
    primaryJoints: ["left_elbow", "right_elbow"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 140, tolerance: 10 },
      up: { angle: 95, tolerance: 10 },
    },
    requiredSides: "both",
    secondaryCheck: "barbell_row_brace",
    secondaryJoints: ["left_shoulder", "right_shoulder", "hip"],
    spatialRequirements: {
      bodyLineTolerance: 36,
      bodyXDriftMax: 0.1,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 550,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
    },
  },
  leg_press: {
    bodyOrientation: "inclined",
    dominantJoint: "knee",
    exercise: "leg_press",
    noCountConditions: [
      "one_leg_only",
      "phase_desync",
      "knee_path_unavailable",
    ],
    oscillatingJoints: ["knee", "hip"],
    phaseOrder: ["setup", "down", "press"],
    primaryJoints: ["left_knee", "right_knee"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 100, tolerance: 12 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "leg_press_depth",
    secondaryJoints: ["left_hip", "right_hip"],
    spatialRequirements: {
      bodyLineTolerance: 45,
      bodyXDriftMax: 0.1,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 500,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "hips", "knees", "ankles"],
    },
  },
  leg_extension: {
    bodyOrientation: "upright",
    dominantJoint: "knee",
    exercise: "leg_extension",
    noCountConditions: [
      "one_leg_only",
      "phase_desync",
      "knee_path_unavailable",
    ],
    oscillatingJoints: ["knee", "hip"],
    phaseOrder: ["setup", "down", "extend"],
    primaryJoints: ["left_knee", "right_knee"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 100, tolerance: 12 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "knee_extension_control",
    secondaryJoints: ["left_hip", "right_hip"],
    spatialRequirements: {
      bodyLineTolerance: 42,
      bodyXDriftMax: 0.1,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 500,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "hips", "knees", "ankles"],
    },
  },
  seated_leg_curl: {
    bodyOrientation: "upright",
    dominantJoint: "knee",
    exercise: "seated_leg_curl",
    noCountConditions: [
      "one_leg_only",
      "phase_desync",
      "knee_path_unavailable",
    ],
    oscillatingJoints: ["knee", "hip"],
    phaseOrder: ["setup", "curl", "return"],
    primaryJoints: ["left_knee", "right_knee"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 145, tolerance: 10 },
      up: { angle: 95, tolerance: 10 },
    },
    requiredSides: "both",
    secondaryCheck: "hamstring_curl_control",
    secondaryJoints: ["left_hip", "right_hip"],
    spatialRequirements: {
      bodyLineTolerance: 42,
      bodyXDriftMax: 0.1,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 500,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "hips", "knees", "ankles"],
    },
  },
  calf_raise: {
    bodyOrientation: "upright",
    dominantJoint: "ankle",
    exercise: "calf_raise",
    noCountConditions: [
      "one_leg_only",
      "phase_desync",
      "ankle_motion_unavailable",
    ],
    oscillatingJoints: ["ankle", "knee", "hip"],
    phaseOrder: ["setup", "raise", "lower"],
    primaryJoints: ["left_ankle", "right_ankle"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 80, tolerance: 10 },
      up: { angle: 115, tolerance: 10 },
    },
    requiredSides: "both",
    secondaryCheck: "calf_raise_vertical_control",
    secondaryJoints: ["left_knee", "right_knee", "left_hip", "right_hip"],
    spatialRequirements: {
      bodyLineTolerance: 30,
      bodyXDriftMax: 0.08,
      leftRightSymmetryTolerance: 28,
      phaseSyncToleranceMs: 450,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 10,
      requiredLandmarks: ["hips", "knees", "ankles"],
    },
  },
  hammer_curl: {
    bodyOrientation: "upright",
    dominantJoint: "elbow",
    exercise: "hammer_curl",
    noCountConditions: [
      "one_arm_only",
      "phase_desync",
      "torso_swing_over_tolerance",
    ],
    oscillatingJoints: ["elbow", "shoulder"],
    phaseOrder: ["setup", "curl", "return"],
    primaryJoints: ["left_elbow", "right_elbow"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 145, tolerance: 10 },
      up: { angle: 95, tolerance: 10 },
    },
    requiredSides: "both",
    secondaryCheck: "hammer_curl_stability",
    secondaryJoints: ["left_shoulder", "right_shoulder", "hip"],
    spatialRequirements: {
      bodyLineTolerance: 45,
      bodyXDriftMax: 0.08,
      leftRightSymmetryTolerance: 60,
      phaseSyncToleranceMs: 950,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
    },
  },
  triceps_pushdown: {
    bodyOrientation: "upright",
    dominantJoint: "elbow",
    exercise: "triceps_pushdown",
    noCountConditions: [
      "one_arm_only",
      "phase_desync",
      "shoulder_swing_over_tolerance",
    ],
    oscillatingJoints: ["elbow", "shoulder"],
    phaseOrder: ["setup", "press", "return"],
    primaryJoints: ["left_elbow", "right_elbow"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 100, tolerance: 12 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "triceps_pushdown_control",
    secondaryJoints: ["left_shoulder", "right_shoulder"],
    spatialRequirements: {
      bodyLineTolerance: 40,
      bodyXDriftMax: 0.1,
      leftRightSymmetryTolerance: 50,
      phaseSyncToleranceMs: 600,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
    },
  },
  rope_face_pull: {
    bodyOrientation: "upright",
    dominantJoint: "shoulder",
    exercise: "rope_face_pull",
    noCountConditions: [
      "one_arm_only",
      "phase_desync",
      "shoulder_path_unavailable",
    ],
    oscillatingJoints: ["shoulder", "elbow"],
    phaseOrder: ["setup", "pull", "return"],
    primaryJoints: ["left_shoulder", "right_shoulder"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 90, tolerance: 12 },
      up: { angle: 145, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "face_pull_rotation_control",
    secondaryJoints: ["left_elbow", "right_elbow"],
    spatialRequirements: {
      bodyLineTolerance: 40,
      bodyXDriftMax: 0.1,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 550,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
    },
  },
  hip_thrust: {
    bodyOrientation: "horizontal",
    dominantJoint: "hip",
    exercise: "hip_thrust",
    noCountConditions: [
      "one_leg_only",
      "phase_desync",
      "hip_extension_unavailable",
    ],
    oscillatingJoints: ["hip", "knee"],
    phaseOrder: ["setup", "extend", "lower"],
    primaryJoints: ["left_hip", "right_hip"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 100, tolerance: 12 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "hip_extension_control",
    secondaryJoints: [
      "left_knee",
      "right_knee",
      "left_shoulder",
      "right_shoulder",
    ],
    spatialRequirements: {
      bodyLineTolerance: 35,
      bodyXDriftMax: 0.1,
      bodyYTravelMin: 0.015,
      hipYTravelMin: 0.01,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 500,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "hips", "knees", "ankles"],
    },
  },
  split_squat: {
    bodyOrientation: "upright",
    dominantJoint: "knee",
    exercise: "split_squat",
    noCountConditions: [
      "phase_desync",
      "leg_travel_unavailable",
      "unstable_torso",
    ],
    oscillatingJoints: ["knee", "hip"],
    phaseOrder: ["setup", "down", "up"],
    primaryJoints: ["left_knee", "right_knee"],
    repModel: "alternating",
    repThresholds: {
      down: { angle: 105, tolerance: 12 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "alternating",
    secondaryCheck: "split_squat_balance",
    secondaryJoints: ["left_hip", "right_hip", "left_ankle", "right_ankle"],
    spatialRequirements: {
      bodyLineTolerance: 45,
      bodyXDriftMax: 0.12,
      bodyYTravelMin: 0.018,
      leftRightSymmetryTolerance: 45,
      phaseSyncToleranceMs: 500,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "hips", "knees", "ankles"],
    },
  },
  cable_crunch: {
    bodyOrientation: "upright",
    dominantJoint: "hip",
    exercise: "cable_crunch",
    noCountConditions: [
      "phase_desync",
      "hip_flexion_unavailable",
      "unstable_base",
    ],
    oscillatingJoints: ["hip", "shoulder"],
    phaseOrder: ["setup", "crunch", "return"],
    primaryJoints: ["left_hip", "right_hip"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 150, tolerance: 12 },
      up: { angle: 105, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "cable_crunch_control",
    secondaryJoints: [
      "left_shoulder",
      "right_shoulder",
      "left_knee",
      "right_knee",
    ],
    spatialRequirements: {
      bodyLineTolerance: 35,
      bodyXDriftMax: 0.1,
      bodyYTravelMin: 0.015,
      hipYTravelMin: 0.01,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 500,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "hips", "knees"],
    },
  },
  romanian_deadlift: {
    bodyOrientation: "inclined",
    dominantJoint: "hip",
    exercise: "romanian_deadlift",
    noCountConditions: [
      "phase_desync",
      "hip_hinge_unavailable",
      "unstable_torso",
    ],
    oscillatingJoints: ["hip", "knee"],
    phaseOrder: ["setup", "hinge", "stand"],
    primaryJoints: ["left_hip", "right_hip"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 110, tolerance: 12 },
      up: { angle: 160, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "romanian_deadlift_brace",
    secondaryJoints: [
      "left_knee",
      "right_knee",
      "left_shoulder",
      "right_shoulder",
    ],
    spatialRequirements: {
      bodyLineTolerance: 32,
      bodyXDriftMax: 0.1,
      bodyYTravelMin: 0.02,
      hipYTravelMin: 0.015,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 550,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "hips", "knees", "ankles"],
    },
  },
  seated_cable_row: {
    bodyOrientation: "upright",
    dominantJoint: "elbow",
    exercise: "seated_cable_row",
    noCountConditions: [
      "one_arm_only",
      "phase_desync",
      "torso_swing_over_tolerance",
    ],
    oscillatingJoints: ["elbow", "shoulder"],
    phaseOrder: ["setup", "pull", "return"],
    primaryJoints: ["left_elbow", "right_elbow"],
    repModel: "bilateral",
    repThresholds: {
      // Use the same phase convention as the rig editor: `down` is the
      // contraction/depth gate and `up` is the return/extension gate.
      down: { angle: 90, tolerance: 15 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "seated_row_brace",
    secondaryJoints: ["left_shoulder", "right_shoulder", "hip"],
    spatialRequirements: {
      bodyLineTolerance: 40,
      bodyXDriftMax: 0.1,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 550,
    },
    trackingRequirements: {
      minConfidence: 0.6,
      minReliableFrameLandmarks: 12,
      requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
    },
  },
  dip: {
    dominantJoint: "elbow",
    degradedConditions: [
      "left_arm_occluded",
      "right_arm_occluded",
      "phase_desync",
    ],
    exercise: "dip",
    noCountConditions: [
      "bilateral_arm_motion_unconfirmed",
      "body_y_travel_below_min",
      "left_right_phase_desync",
    ],
    oscillatingJoints: ["elbow", "shoulder"],
    phaseOrder: ["setup", "down", "up"],
    primaryJoints: ["left_elbow", "right_elbow"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 90, tolerance: 15 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "vertical_body_travel",
    secondaryJoints: ["left_shoulder", "right_shoulder", "hip"],
    spatialRequirements: {
      bodyLineTolerance: 38,
      bodyXDriftMax: 0.08,
      bodyYTravelMin: 0.014,
      leftRightSymmetryTolerance: 38,
      phaseSyncToleranceMs: 650,
    },
  },
  plank: {
    dominantJoint: "hip",
    exercise: "plank",
    holdDurationSeconds: 30,
    oscillatingJoints: ["hip", "shoulder"],
    phaseOrder: ["setup", "hold", "release"],
    primaryJoints: ["left_hip", "right_hip"],
    repThresholds: {
      down: { angle: 165, tolerance: 8 },
      up: { angle: 178, tolerance: 8 },
    },
    repModel: "static_hold",
    requiredSides: "both",
    secondaryCheck: "core_alignment",
    spatialRequirements: {
      bodyLineTolerance: 22,
      bodyXDriftMax: 0.06,
      bodyYTravelMin: 0,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 500,
    },
  },
  push_up: {
    dominantJoint: "elbow",
    degradedConditions: [
      "left_arm_occluded",
      "right_arm_occluded",
      "body_line_failure",
      "phase_desync",
    ],
    exercise: "push_up",
    noCountConditions: [
      "bilateral_arm_motion_unconfirmed",
      "push_up_body_not_horizontal",
      "body_line_failure",
      "left_right_phase_desync",
    ],
    oscillatingJoints: ["elbow", "shoulder"],
    phaseOrder: ["setup", "down", "up"],
    primaryJoints: ["left_elbow", "right_elbow"],
    repModel: "bilateral",
    repThresholds: {
      // A right-angle bottom gate plus a separate extension gate requires a
      // complete press cycle; bilateral, body-line, travel, and phase guards
      // still reject shallow jitter and random arm movement.
      down: { angle: 90, tolerance: 15 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "body_line",
    secondaryJoints: ["left_shoulder", "right_shoulder", "hip"],
    spatialRequirements: {
      bodyLineTolerance: 86,
      bodyXDriftMax: 0.22,
      bodyYTravelMin: 0.012,
      hipYTravelMin: 0.01,
      leftRightSymmetryTolerance: PUSH_UP_SYMMETRY_TOLERANCE,
      phaseSyncToleranceMs: 650,
      shoulderHipTravelMin: 0.01,
      shoulderYTravelMin: 0.008,
      torsoSlopeMaxDeg: 92,
      torsoSlopeMinDeg: 0,
      wristAnchorDriftMax: 0.18,
    },
  },
  pull_up: {
    dominantJoint: "elbow",
    degradedConditions: [
      "left_arm_occluded",
      "right_arm_occluded",
      "bar_unavailable",
    ],
    exercise: "pull_up",
    noCountConditions: ["insufficient_elbow_rom", "body_swing_over_tolerance"],
    oscillatingJoints: ["elbow", "shoulder"],
    phaseOrder: ["setup", "pull", "lower"],
    primaryJoints: ["left_elbow", "right_elbow"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 90, tolerance: 15 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "either",
    secondaryCheck: "vertical_pull",
    secondaryJoints: ["left_shoulder", "right_shoulder", "hip"],
    spatialRequirements: {
      bodyLineTolerance: 45,
      bodyXDriftMax: 0.16,
      bodyYTravelMin: 0,
      leftRightSymmetryTolerance: PULL_UP_SYMMETRY_TOLERANCE,
      phaseSyncToleranceMs: 700,
    },
  },
  shoulder_press: {
    dominantJoint: "shoulder",
    degradedConditions: [
      "left_arm_occluded",
      "right_arm_occluded",
      "asymmetry_over_tolerance",
    ],
    exercise: "shoulder_press",
    noCountConditions: [
      "one_arm_only",
      "left_right_phase_desync",
      "lockout_control_failure",
    ],
    oscillatingJoints: ["shoulder", "elbow"],
    phaseOrder: ["setup", "down", "up"],
    primaryJoints: ["left_shoulder", "right_shoulder"],
    repModel: "bilateral",
    repThresholds: {
      // Shoulder abduction starts around a right angle and finishes overhead;
      // this is intentionally not treated as elbow flexion.
      down: { angle: 90, tolerance: 15 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "lockout_control",
    secondaryJoints: ["left_elbow", "right_elbow"],
    spatialRequirements: {
      bodyLineTolerance: 32,
      bodyXDriftMax: 0.08,
      bodyYTravelMin: 0,
      leftRightSymmetryTolerance: 28,
      phaseSyncToleranceMs: 350,
    },
  },
  squat: {
    dominantJoint: "knee",
    exercise: "squat",
    oscillatingJoints: ["hip", "knee"],
    phaseOrder: ["setup", "down", "up"],
    primaryJoints: ["left_knee", "right_knee"],
    repModel: "bilateral",
    repThresholds: {
      down: { angle: 90, tolerance: 15 },
      up: { angle: 155, tolerance: 12 },
    },
    requiredSides: "both",
    secondaryCheck: "hip_depth",
    secondaryJoints: ["left_hip", "right_hip"],
    spatialRequirements: {
      bodyLineTolerance: 45,
      bodyXDriftMax: 0.1,
      bodyYTravelMin: 0.02,
      leftRightSymmetryTolerance: 35,
      phaseSyncToleranceMs: 450,
    },
  },
};

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averagePoint(
  keypoints: PoseKeypointRecord[],
  leftIndex: number,
  rightIndex: number,
) {
  const left = keypoints[leftIndex];
  const right = keypoints[rightIndex];
  const visiblePoints = [left, right].filter(
    (point): point is PoseKeypointRecord =>
      !!point &&
      point.visibility >= MIN_CONFIDENCE &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y),
  );
  const points = visiblePoints.length > 0 ? visiblePoints : [left, right];
  return {
    visibility: average([left?.visibility ?? 0, right?.visibility ?? 0]),
    x: average(points.map((point) => point?.x ?? 0)),
    y: average(points.map((point) => point?.y ?? 0)),
    z: average(points.map((point) => point?.z ?? 0)),
  };
}

function resolvePoseCoordinateDimensions(
  dimensions: PoseCoordinateDimensions | undefined,
): PoseCoordinateDimensions {
  if (
    !dimensions ||
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height) ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    return { width: 1, height: 1 };
  }

  return dimensions;
}

export function angleAtPoint(
  pointA: PoseKeypointRecord,
  pointB: PoseKeypointRecord,
  pointC: PoseKeypointRecord,
  coordinateDimensions?: PoseCoordinateDimensions,
) {
  const { height, width, depthScale = 0 } = resolvePoseCoordinateDimensions(
    coordinateDimensions,
  );
  const abX = (pointA.x - pointB.x) * width;
  const abY = (pointA.y - pointB.y) * height;
  const cbX = (pointC.x - pointB.x) * width;
  const cbY = (pointC.y - pointB.y) * height;
  const abZ = depthScale ? (pointA.z - pointB.z) * depthScale : 0;
  const cbZ = depthScale ? (pointC.z - pointB.z) * depthScale : 0;
  const abMag = Math.hypot(abX, abY, abZ);
  const cbMag = Math.hypot(cbX, cbY, cbZ);
  if (!abMag || !cbMag) return null;
  const cosine = Math.max(
    -1,
    Math.min(1, (abX * cbX + abY * cbY + abZ * cbZ) / (abMag * cbMag)),
  );
  return (Math.acos(cosine) * 180) / Math.PI;
}

/** Downward arm reference perpendicular to the shoulder line; no hip estimate. */
export function getPoseShoulderLineReference(
  keypoints: PoseKeypointRecord[],
  side: "left" | "right",
  coordinateDimensions?: PoseCoordinateDimensions,
  minConfidence = 0.5,
): PoseKeypointRecord | null {
  const left = keypoints[11], right = keypoints[12];
  const { width, height, depthScale = 0 } = resolvePoseCoordinateDimensions(coordinateDimensions);
  if (![left, right].every(point => point && Number.isFinite(point.x) &&
      Number.isFinite(point.y) && (!depthScale || Number.isFinite(point.z)) &&
      Number.isFinite(point.visibility) && point.visibility >= minConfidence)) return null;
  const x = (right!.x - left!.x) * width;
  const y = (right!.y - left!.y) * height;
  const z = depthScale ? (right!.z - left!.z) * depthScale : 0;
  const length = Math.hypot(x, y, z);
  if (length < 1e-6) return null;
  const ux = x / length, uy = y / length, uz = z / length;
  // Project camera-down onto the plane perpendicular to the shoulder line.
  // Unlike an unsigned shoulder-to-shoulder angle, this never folds at 90°.
  const dx = -uy * ux, dy = 1 - uy * uy, dz = -uy * uz;
  const downLength = Math.hypot(dx, dy, dz);
  if (downLength < 1e-6) return null;
  const shoulder = side === "left" ? left! : right!;
  return {
    ...shoulder,
    x: shoulder.x + dx / downLength / width,
    y: shoulder.y + dy / downLength / height,
    z: depthScale ? shoulder.z + dz / downLength / depthScale : shoulder.z,
    visibility: Math.min(left!.visibility, right!.visibility),
  };
}

/** Measured joint plus its real reference points, for editing/highlighting. */
export function getPoseMovementJointTriples(
  contract: Pick<PoseMovementContractRecord, "dominantJoint" | "shoulderReference">,
): { left: readonly [number, number, number]; right: readonly [number, number, number] } {
  if (contract.dominantJoint === "shoulder" && contract.shoulderReference === "shoulder_line") {
    return { left: [12, 11, 13], right: [11, 12, 14] };
  }
  const left = SIDE_JOINT_MAP[`left_${contract.dominantJoint}`];
  const right = SIDE_JOINT_MAP[`right_${contract.dominantJoint}`];
  return { left: [left.a, left.b, left.c], right: [right.a, right.b, right.c] };
}

function averageJointAngle(
  keypoints: PoseKeypointRecord[],
  indexes: JointIndexes[],
  coordinateDimensions?: PoseCoordinateDimensions,
  minConfidence = MIN_CONFIDENCE,
): number | null {
  const values = indexes
    .map(({ a, b, c }) => {
      const pointA = keypoints[a];
      const pointB = keypoints[b];
      const pointC = keypoints[c];
      if (
        !pointA ||
        !pointB ||
        !pointC ||
        pointA.visibility < minConfidence ||
        pointB.visibility < minConfidence ||
        pointC.visibility < minConfidence
      ) {
        return null;
      }
      return angleAtPoint(pointA, pointB, pointC, coordinateDimensions);
    })
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );

  if (!values.length) return null;
  return Number(average(values).toFixed(3));
}

function sideJointAngle(
  keypoints: PoseKeypointRecord[],
  indexes: JointIndexes,
  coordinateDimensions?: PoseCoordinateDimensions,
  minConfidence = MIN_CONFIDENCE,
): number | null {
  return sideJointAngleWithConfidence(
    keypoints,
    indexes,
    minConfidence,
    coordinateDimensions,
  );
}

function sideJointAngleWithConfidence(
  keypoints: PoseKeypointRecord[],
  indexes: JointIndexes,
  minConfidence: number,
  coordinateDimensions?: PoseCoordinateDimensions,
): number | null {
  const pointA = keypoints[indexes.a];
  const pointB = keypoints[indexes.b];
  const pointC = keypoints[indexes.c];
  if (
    !pointA ||
    !pointB ||
    !pointC ||
    pointA.visibility < minConfidence ||
    pointB.visibility < minConfidence ||
    pointC.visibility < minConfidence
  ) {
    return null;
  }

  const angle = angleAtPoint(pointA, pointB, pointC, coordinateDimensions);
  return typeof angle === "number" && Number.isFinite(angle)
    ? Number(angle.toFixed(3))
    : null;
}

function isPoseSideJointName(value: string): value is PoseSideJointName {
  return Object.prototype.hasOwnProperty.call(SIDE_JOINT_MAP, value);
}

function isPushUpContract(
  contract: Pick<PoseMovementContractRecord, "exercise">,
) {
  return toCanonicalPoseExerciseLabel(contract.exercise) === "push_up";
}

function getLatestExtremumTime(
  frames: PoseSequenceFrameRecord[],
  values: Array<number | null | undefined>,
  mode: "min" | "max",
) {
  const candidates = values
    .map((value, index) => ({ frame: frames[index], value }))
    .filter(
      (entry): entry is { frame: PoseSequenceFrameRecord; value: number } =>
        !!entry.frame &&
        typeof entry.value === "number" &&
        Number.isFinite(entry.value),
    );
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((left, right) =>
    mode === "min" ? left.value - right.value : right.value - left.value,
  );
  return sorted[0]?.frame.capturedAtMs ?? null;
}

function averageLandmarkVisibility(
  keypoints: PoseKeypointRecord[],
  indexes: number[],
) {
  return average(indexes.map((index) => keypoints[index]?.visibility ?? 0));
}

function summarizeAmplitude(values: Array<number | null>) {
  const usable = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (!usable.length) return 0;
  return Math.max(...usable) - Math.min(...usable);
}

function normalizePoseExerciseLabel(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function getPoseLandmarkNames() {
  return LANDMARK_NAMES;
}

export function toCanonicalPoseExerciseLabel(
  exerciseLabel: string | null | undefined,
) {
  if (!exerciseLabel) {
    return null;
  }

  const normalized = normalizePoseExerciseLabel(exerciseLabel);
  if (!normalized) {
    return null;
  }

  return getCanonicalPoseCapabilityByLabel(normalized)?.poseExercise ?? null;
}

function cloneTrackingRequirements(
  requirements: PoseTrackingRequirementsRecord | null | undefined,
  requiredSides: PoseMovementContractRecord["requiredSides"],
) {
  if (!requirements) return undefined;
  const requiredLandmarks = Array.isArray(requirements.requiredLandmarks)
    ? requirements.requiredLandmarks.filter(
        (landmark): landmark is string => typeof landmark === "string",
      )
    : [];
  return {
    minConfidence: requirements.minConfidence,
    minReliableFrameLandmarks: requirements.minReliableFrameLandmarks,
    requiredLandmarks,
    ...((requiredSides ?? requirements.requiredSides)
      ? { requiredSides: requiredSides ?? requirements.requiredSides }
      : {}),
  } satisfies PoseTrackingRequirementsRecord;
}

/**
 * Normalize every auto-rep movement through the same contract shape used by
 * the mobile engine, the exercise lab, and deterministic seed data.
 *
 * The fallback table is intentionally the only source of default biomechanics;
 * callers may still provide an explicit contract for a custom movement.
 */
export function normalizePoseMovementContract(
  value: unknown,
  exerciseLabel?: string | null,
): PoseMovementContractRecord | null {
  const record =
    value && typeof value === "object"
      ? (value as Partial<PoseMovementContractRecord>)
      : {};
  const rawExercise =
    typeof record.exercise === "string" && record.exercise.trim()
      ? record.exercise
      : exerciseLabel;
  const canonical = toCanonicalPoseExerciseLabel(rawExercise);
  const fallback = canonical
    ? FALLBACK_POSE_MOVEMENT_CONTRACTS[canonical]
    : undefined;
  if (!fallback && !rawExercise) return null;

  const exercise = canonical ?? String(rawExercise).trim();
  const hasExplicitExercise =
    typeof record.exercise === "string" && record.exercise.trim().length > 0;
  const hasValidThreshold = (threshold: unknown) =>
    !!threshold &&
    typeof threshold === "object" &&
    typeof (threshold as { angle?: unknown }).angle === "number" &&
    Number.isFinite((threshold as { angle: number }).angle) &&
    typeof (threshold as { tolerance?: unknown }).tolerance === "number" &&
    Number.isFinite((threshold as { tolerance: number }).tolerance);
  const hasCompleteCoreContract =
    typeof record.dominantJoint === "string" &&
    typeof record.secondaryCheck === "string" &&
    Array.isArray(record.oscillatingJoints) &&
    hasValidThreshold(record.repThresholds?.down) &&
    hasValidThreshold(record.repThresholds?.up);
  // An explicit but incomplete editor draft must stay incomplete so the
  // editor validator can block it. Hydrate canonical defaults only for an
  // omitted contract or a contract that already contains its required core.
  const fallbackDefaults =
    !hasExplicitExercise || hasCompleteCoreContract ? fallback : undefined;
  const fallbackThresholds = fallbackDefaults?.repThresholds;
  const rawThresholds = record.repThresholds;
  const hasExplicitSpatialRequirements =
    Object.prototype.hasOwnProperty.call(record, "spatialRequirements") &&
    record.spatialRequirements !== undefined;
  const normalized = {
    ...(fallbackDefaults ?? {}),
    ...record,
    exercise,
    contractVersion:
      record.contractVersion ??
      fallbackDefaults?.contractVersion ??
      (fallbackDefaults || !hasExplicitExercise
        ? POSE_MOVEMENT_CONTRACT_VERSION
        : undefined),
    bodyOrientation:
      record.bodyOrientation ??
      fallbackDefaults?.bodyOrientation ??
      (fallbackDefaults || !hasExplicitExercise
        ? canonical
          ? POSE_BODY_ORIENTATION_BY_EXERCISE[canonical]
          : "any"
        : undefined),
    trackingRequirements: cloneTrackingRequirements(
      record.trackingRequirements ??
        fallbackDefaults?.trackingRequirements ??
        (fallbackDefaults || !hasExplicitExercise
          ? canonical
            ? POSE_TRACKING_REQUIREMENTS_BY_EXERCISE[canonical]
            : undefined
          : undefined),
      record.requiredSides ?? fallback?.requiredSides,
    ),
    partialRepPolicy:
      record.partialRepPolicy ??
      fallbackDefaults?.partialRepPolicy ??
      "strict_full_rep",
    holdDurationSeconds:
      (record.repModel ?? fallbackDefaults?.repModel) === "static_hold"
        ? record.holdDurationSeconds ?? fallbackDefaults?.holdDurationSeconds ?? 30
        : (record.holdDurationSeconds ??
          fallbackDefaults?.holdDurationSeconds ??
          null),
    oscillatingJoints: [
      ...(record.oscillatingJoints ??
        fallbackDefaults?.oscillatingJoints ??
        []),
    ],
    ...((record.degradedConditions ?? fallbackDefaults?.degradedConditions)
      ? {
          degradedConditions: [
            ...(record.degradedConditions ??
              fallbackDefaults?.degradedConditions ??
              []),
          ],
        }
      : {}),
    ...((record.noCountConditions ?? fallbackDefaults?.noCountConditions)
      ? {
          noCountConditions: [
            ...(record.noCountConditions ??
              fallbackDefaults?.noCountConditions ??
              []),
          ],
        }
      : {}),
    ...((record.phaseOrder ?? fallbackDefaults?.phaseOrder)
      ? {
          phaseOrder: [
            ...(record.phaseOrder ?? fallbackDefaults?.phaseOrder ?? []),
          ],
        }
      : {}),
    ...((record.primaryJoints ?? fallbackDefaults?.primaryJoints)
      ? {
          primaryJoints: [
            ...(record.primaryJoints ?? fallbackDefaults?.primaryJoints ?? []),
          ],
        }
      : {}),
    ...((record.secondaryJoints ?? fallbackDefaults?.secondaryJoints)
      ? {
          secondaryJoints: [
            ...(record.secondaryJoints ??
              fallbackDefaults?.secondaryJoints ??
              []),
          ],
        }
      : {}),
    ...((hasExplicitSpatialRequirements
      ? record.spatialRequirements
      : fallbackDefaults?.spatialRequirements)
      ? {
          spatialRequirements: {
            ...((hasExplicitSpatialRequirements
              ? record.spatialRequirements
              : fallbackDefaults?.spatialRequirements) ?? {}),
          },
        }
      : hasExplicitSpatialRequirements
        ? { spatialRequirements: record.spatialRequirements }
        : {}),
    repThresholds: {
      ...(fallbackThresholds ?? {}),
      ...(rawThresholds ?? {}),
      down: {
        ...(fallbackThresholds?.down ?? {}),
        ...(rawThresholds?.down ?? {}),
      },
      up: {
        ...(fallbackThresholds?.up ?? {}),
        ...(rawThresholds?.up ?? {}),
      },
    },
  } as PoseMovementContractRecord;

  if (normalized.spatialRequirements?.bodyLineTolerance != null &&
      normalized.spatialRequirements.bodyLineScope === undefined) {
    normalized.spatialRequirements.bodyLineScope = getPoseBodyLineScope(normalized);
  }
  if (normalized.trackingRequirements) {
    normalized.trackingRequirements = {
      ...normalized.trackingRequirements,
      minReliableFrameLandmarks: getPoseRequiredLandmarkCount(normalized),
    };
  }
  return normalized;
}

export function buildFallbackPoseMovementContract(
  exerciseLabel: string | null | undefined,
  options: { forAuthoring?: boolean } = {},
): PoseMovementContractRecord | null {
  const authoringCapability = options.forAuthoring
    ? getCanonicalPoseCapabilityByLabel(exerciseLabel, { forAuthoring: true })
    : null;
  const canonical = authoringCapability?.contractExercise ?? toCanonicalPoseExerciseLabel(exerciseLabel);
  if (!canonical) {
    return null;
  }

  const contract = FALLBACK_POSE_MOVEMENT_CONTRACTS[canonical];
  return contract ? normalizePoseMovementContract(options.forAuthoring ? {
    ...contract,
    contractVersion: contract.contractVersion ?? POSE_MOVEMENT_CONTRACT_VERSION,
    bodyOrientation: contract.bodyOrientation ?? authoringCapability?.requiredBodyOrientation ?? "any",
  } : contract, canonical) : null;
}

export type PoseMovementContractValidation = {
  errors: string[];
  normalized: PoseMovementContractRecord | null;
  valid: boolean;
};

const POSE_JOINT_NAMES = new Set([
  "ankle",
  "elbow",
  "hip",
  "knee",
  "shoulder",
  "left_ankle",
  "right_ankle",
  "left_elbow",
  "right_elbow",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_shoulder",
  "right_shoulder",
]);
const POSE_REQUIRED_LANDMARK_GROUPS = new Set([
  ...LANDMARK_NAMES,
  "shoulders",
  "elbows",
  "wrists",
  "hips",
  "knees",
  "ankles",
  "feet",
  "torso",
]);
const POSE_ORIENTATIONS = new Set([
  "upright",
  "horizontal",
  "inclined",
  "floor",
  "any",
]);

function getJointBaseName(value: string) {
  return value.replace(/^(left|right)_/, "");
}

function validatePoseContractAnatomy(
  contract: PoseMovementContractRecord,
) {
  const errors: string[] = [];
  if (contract.shoulderReference !== undefined &&
      (!["torso", "shoulder_line"].includes(contract.shoulderReference) || contract.dominantJoint !== "shoulder")) {
    errors.push("shoulder_reference_invalid");
  }
  if (!POSE_JOINT_NAMES.has(contract.dominantJoint)) {
    errors.push("dominant_joint_invalid");
  }
  const primaryJoints = contract.primaryJoints ?? [];
  if (
    !primaryJoints.length ||
    primaryJoints.some((joint) => !POSE_JOINT_NAMES.has(joint))
  ) {
    errors.push("primary_joints_invalid");
  } else if (
    !primaryJoints.some(
      (joint) => getJointBaseName(joint) === contract.dominantJoint,
    )
  ) {
    errors.push("primary_joints_dominant_joint_mismatch");
  }
  if (
    (contract.secondaryJoints ?? []).some(
      (joint) => !POSE_JOINT_NAMES.has(joint),
    )
  ) {
    errors.push("secondary_joints_invalid");
  }
  const requiredLandmarks = contract.trackingRequirements?.requiredLandmarks ?? [];
  if (
    requiredLandmarks.some(
      (landmark) => !POSE_REQUIRED_LANDMARK_GROUPS.has(landmark),
    )
  ) {
    errors.push("required_landmarks_invalid");
  }
  if (
    contract.bodyOrientation &&
    !POSE_ORIENTATIONS.has(contract.bodyOrientation)
  ) {
    errors.push("body_orientation_invalid");
  }
  return errors;
}

export function validatePoseMovementFamilyCompatibility(
  value: unknown,
  exerciseLabel?: string | null,
): PoseMovementContractValidation {
  const normalized = normalizePoseMovementContract(value, exerciseLabel);
  if (!normalized) {
    return { errors: ["movement_contract_missing"], normalized: null, valid: false };
  }
  const errors: string[] = [];
  const expectedExercise = toCanonicalPoseExerciseLabel(exerciseLabel);
  if (expectedExercise && normalized.exercise !== expectedExercise) {
    errors.push("exercise_identity_mismatch");
  }
  // Family identity is a constraint only when a family is supplied. Explicit
  // custom definitions use the same anatomy, range and completeness validators;
  // membership in the default auto-enabled catalog is not a counting rule.
  return { errors, normalized, valid: errors.length === 0 };
}

export function validatePoseMovementCalibration(
  value: unknown,
  exerciseLabel?: string | null,
): PoseMovementContractValidation {
  const rawRecord =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const normalized = normalizePoseMovementContract(value, exerciseLabel);
  if (!normalized) {
    return { errors: ["movement_contract_missing"], normalized: null, valid: false };
  }
  const errors: string[] = [];
  const thresholds = [
    normalized.repThresholds?.down,
    normalized.repThresholds?.up,
  ];
  if (
    thresholds.some(
      (entry) =>
        !entry ||
        !Number.isFinite(entry.angle) ||
        entry.angle < 0 ||
        entry.angle > 180,
    )
  )
    errors.push("rep_angle_out_of_range");
  if (
    thresholds.some(
      (entry) =>
        !entry ||
        !Number.isFinite(entry.tolerance) ||
        entry.tolerance < 0 ||
        entry.tolerance > 45,
    )
  )
    errors.push("rep_tolerance_out_of_range");
  const tracking = normalized.trackingRequirements;
  if (
    !tracking ||
    !Number.isFinite(tracking.minConfidence) ||
    tracking.minConfidence < 0 || tracking.minConfidence > 1 ||
    !Number.isInteger(tracking.minReliableFrameLandmarks) ||
    tracking.minReliableFrameLandmarks < 1 || tracking.minReliableFrameLandmarks > 33 ||
    !tracking.requiredLandmarks.length
  ) errors.push("tracking_requirements_invalid");
  const bodyLineScope = normalized.spatialRequirements?.bodyLineScope;
  const slopeMin = normalized.spatialRequirements?.torsoSlopeMinDeg ?? 0;
  const slopeMax = normalized.spatialRequirements?.torsoSlopeMaxDeg ?? 90;
  if (slopeMin > slopeMax || slopeMin > 90) {
    errors.push("torso_slope_conflicts_with_orientation");
  }
  if (bodyLineScope !== undefined && bodyLineScope !== "torso" && bodyLineScope !== "full_body") {
    errors.push("body_line_scope_invalid");
  }
  for (const [key, entry] of Object.entries(normalized.spatialRequirements ?? {})) {
    if (key === "bodyLineScope") continue;
    if (
      entry !== undefined &&
      entry !== null &&
      (typeof entry !== "number" || !Number.isFinite(entry) || entry < 0 || entry > 5000)
    ) {
      errors.push("spatial_requirement_out_of_range");
      break;
    }
  }
  if (normalized.repModel === "static_hold") {
    const duration = normalized.holdDurationSeconds;
    const rawDuration = rawRecord?.holdDurationSeconds;
    if (
      !Number.isFinite(duration) ||
      (duration ?? 0) < 1 ||
      (duration ?? 0) > 3600 ||
      (rawDuration !== undefined &&
        (typeof rawDuration !== "number" ||
          !Number.isFinite(rawDuration) ||
          rawDuration < 1 ||
          rawDuration > 3600))
    )
      errors.push("hold_duration_out_of_range");
  }
  errors.push(
    ...validatePoseRepAcceptancePolicy(normalized),
    ...validatePoseContractAnatomy(normalized),
  );
  return {
    errors: Array.from(new Set(errors)),
    normalized,
    valid: errors.length === 0,
  };
}

/**
 * Validate an explicit profile against the reviewed shared movement contract.
 * Seed/runtime callers use this gate before enabling automatic counting; an
 * invalid or unknown movement therefore remains manual-only.
 */
export function validatePoseMovementContract(
  value: unknown,
  exerciseLabel?: string | null,
): PoseMovementContractValidation {
  const rawRecord =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const normalized = normalizePoseMovementContract(value, exerciseLabel);
  const errors: string[] = [];
  if (!normalized) {
    return {
      errors: ["movement_contract_missing"],
      normalized: null,
      valid: false,
    };
  }

  if (rawRecord?.exercise) {
    const thresholds = rawRecord.repThresholds;
    const thresholdRecord =
      thresholds && typeof thresholds === "object" && !Array.isArray(thresholds)
        ? (thresholds as Record<string, unknown>)
        : null;
    const hasThreshold = (entry: unknown) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return false;
      }
      const record = entry as Record<string, unknown>;
      return (
        typeof record.angle === "number" &&
        Number.isFinite(record.angle) &&
        typeof record.tolerance === "number" &&
        Number.isFinite(record.tolerance)
      );
    };
    const tracking =
      rawRecord.trackingRequirements &&
      typeof rawRecord.trackingRequirements === "object" &&
      !Array.isArray(rawRecord.trackingRequirements)
        ? (rawRecord.trackingRequirements as Record<string, unknown>)
        : null;
    const incomplete =
      typeof rawRecord.dominantJoint !== "string" ||
      typeof rawRecord.secondaryCheck !== "string" ||
      !Array.isArray(rawRecord.oscillatingJoints) ||
      rawRecord.oscillatingJoints.length === 0 ||
      !thresholdRecord ||
      !hasThreshold(thresholdRecord.down) ||
      !hasThreshold(thresholdRecord.up) ||
      typeof rawRecord.repModel !== "string" ||
      typeof rawRecord.requiredSides !== "string" ||
      typeof rawRecord.bodyOrientation !== "string" ||
      typeof rawRecord.contractVersion !== "string" ||
      !Array.isArray(rawRecord.primaryJoints) ||
      !Array.isArray(rawRecord.phaseOrder) ||
      !tracking ||
      typeof tracking.minConfidence !== "number" ||
      typeof tracking.minReliableFrameLandmarks !== "number" ||
      !Array.isArray(tracking.requiredLandmarks) ||
      tracking.requiredLandmarks.length === 0;
    if (incomplete) {
      return {
        errors: ["movement_contract_incomplete"],
        normalized,
        valid: false,
      };
    }
  }

  errors.push(
    ...validatePoseMovementFamilyCompatibility(normalized, exerciseLabel).errors,
    ...validatePoseMovementCalibration(value, exerciseLabel).errors,
    ...validatePoseContractAnatomy(normalized),
  );

  const uniqueErrors = Array.from(new Set(errors));
  return {
    errors: uniqueErrors,
    normalized,
    valid: uniqueErrors.length === 0,
  };
}

export function isValidPoseMovementContract(
  value: unknown,
  exerciseLabel?: string | null,
) {
  return validatePoseMovementContract(value, exerciseLabel).valid;
}

export function getPoseJointAngle(
  keypoints: PoseKeypointRecord[],
  joint: PoseJointName,
  coordinateDimensions?: PoseCoordinateDimensions,
  minConfidence = MIN_CONFIDENCE,
) {
  const indexes = JOINT_MAP[joint];
  return indexes
    ? averageJointAngle(keypoints, indexes, coordinateDimensions, minConfidence)
    : null;
}

export function getPoseSideJointAngle(
  keypoints: PoseKeypointRecord[],
  joint: PoseSideJointName,
  coordinateDimensions?: PoseCoordinateDimensions,
  minConfidence = MIN_CONFIDENCE,
) {
  const indexes = SIDE_JOINT_MAP[joint];
  return indexes
    ? sideJointAngle(keypoints, indexes, coordinateDimensions, minConfidence)
    : null;
}

type PoseSide = "left" | "right";

function getContractSideJoint(
  contract: PoseMovementContractRecord,
  side: PoseSide,
): PoseSideJointName | null {
  const prefix = `${side}_`;
  const primaryJoints = contract.primaryJoints ?? [];
  const explicit = primaryJoints.find(
    (joint) => joint.startsWith(prefix) && isPoseSideJointName(joint),
  );
  if (explicit && isPoseSideJointName(explicit)) return explicit;
  const derived = `${side}_${contract.dominantJoint}`;
  return isPoseSideJointName(derived) ? derived : null;
}

function getContractSideConfidence(
  contract: PoseMovementContractRecord,
  keypoints: PoseKeypointRecord[],
  side: PoseSide,
) {
  const primaryJoints = contract.primaryJoints ?? [];
  const sideJoints = primaryJoints.filter(
    (joint) => joint.startsWith(`${side}_`) && isPoseSideJointName(joint),
  );
  const joint =
    sideJoints[0] ?? getContractSideJoint(contract, side);
  if (!joint || !isPoseSideJointName(joint)) return 0;
  const indexes = contract.dominantJoint === "shoulder" && contract.shoulderReference === "shoulder_line"
    ? { a: 11, b: 12, c: side === "left" ? 13 : 14 }
    : SIDE_JOINT_MAP[joint];
  return average([
    keypoints[indexes.a]?.visibility ?? 0,
    keypoints[indexes.b]?.visibility ?? 0,
    keypoints[indexes.c]?.visibility ?? 0,
  ]);
}

/** Resolve the configured movement joint independently for each side. */
export function getPoseMovementContractSideAngles(
  contract: PoseMovementContractRecord,
  keypoints: PoseKeypointRecord[],
  coordinateDimensions?: PoseCoordinateDimensions,
) {
  const minConfidence =
    contract.trackingRequirements?.minConfidence ?? MIN_CONFIDENCE;
  const resolve = (side: PoseSide) => {
    if (contract.dominantJoint === "shoulder" && contract.shoulderReference === "shoulder_line") {
      const anchor = getPoseShoulderLineReference(keypoints, side, coordinateDimensions, minConfidence);
      const shoulder = keypoints[side === "left" ? 11 : 12];
      const elbow = keypoints[side === "left" ? 13 : 14];
      if (!anchor || !shoulder || !elbow || !Number.isFinite(elbow.visibility) || elbow.visibility < minConfidence) return null;
      const angle = angleAtPoint(anchor, shoulder, elbow, coordinateDimensions);
      return angle != null && Number.isFinite(angle) ? Math.round(angle * 1000) / 1000 : null;
    }
    const joint = getContractSideJoint(contract, side);
    return joint
      ? getPoseSideJointAngle(
          keypoints,
          joint,
          coordinateDimensions,
          minConfidence,
        )
      : null;
  };
  return { left: resolve("left"), right: resolve("right") };
}

export function getPoseMovementContractAngle(
  contract: PoseMovementContractRecord,
  keypoints: PoseKeypointRecord[],
  coordinateDimensions?: PoseCoordinateDimensions,
) {
  const sideAngles = getPoseMovementContractSideAngles(
    contract,
    keypoints,
    coordinateDimensions,
  );
  const requiredSides = contract.requiredSides ?? "either";
  if (requiredSides === "both") {
    if (
      sideAngles.left === null ||
      sideAngles.right === null
    ) {
      return null;
    }
    const symmetryTolerance =
      contract.spatialRequirements?.leftRightSymmetryTolerance;
    if (
      typeof symmetryTolerance === "number" &&
      Math.abs(sideAngles.left - sideAngles.right) > symmetryTolerance
    ) {
      return null;
    }
    return Number(((sideAngles.left + sideAngles.right) / 2).toFixed(3));
  }
  if (requiredSides === "left" || contract.repModel === "unilateral_left") {
    return sideAngles.left;
  }
  if (requiredSides === "right" || contract.repModel === "unilateral_right") {
    return sideAngles.right;
  }
  if (requiredSides === "either" || requiredSides === "alternating") {
    const candidates = [
      { side: "left" as const, angle: sideAngles.left },
      { side: "right" as const, angle: sideAngles.right },
    ].filter(
      (entry): entry is { side: PoseSide; angle: number } =>
        typeof entry.angle === "number" && Number.isFinite(entry.angle),
    );
    if (!candidates.length) return null;
    candidates.sort(
      (left, right) =>
        getContractSideConfidence(contract, keypoints, right.side) -
        getContractSideConfidence(contract, keypoints, left.side),
    );
    return candidates[0].angle;
  }
  return getPoseJointAngle(
    keypoints,
    contract.dominantJoint,
    coordinateDimensions,
    contract.trackingRequirements?.minConfidence ?? MIN_CONFIDENCE,
  );
}

const POSE_LANDMARK_GROUP_INDEXES: Record<string, readonly number[]> = {
  ankles: [27, 28],
  elbows: [13, 14],
  feet: [27, 28, 31, 32],
  hips: [23, 24],
  knees: [25, 26],
  shoulders: [11, 12],
  torso: [11, 12, 23, 24],
  wrists: [15, 16],
};

/** Legacy contracts infer scope from their declared anatomy, never the exercise name. */
export function getPoseBodyLineScope(contract: PoseMovementContractRecord): "torso" | "full_body" {
  if (contract.spatialRequirements?.bodyLineScope) return contract.spatialRequirements.bodyLineScope;
  const labels = contract.trackingRequirements?.requiredLandmarks;
  return Array.isArray(labels) && labels.some((label) => /ankle|feet|foot/.test(label))
    ? "full_body" : "torso";
}

/** Every active rule contributes its dependencies to the same visibility gate. */
export function getPoseMovementRequiredLandmarks(contract: PoseMovementContractRecord): string[] {
  const groups: Record<PoseJointName, string[]> = {
    elbow: ["shoulders", "elbows", "wrists"],
    shoulder: ["elbows", "shoulders", "hips"],
    hip: ["shoulders", "hips", "knees"],
    knee: ["hips", "knees", "ankles"],
    ankle: ["knees", "ankles", "feet"],
  };
  const labels = new Set(contract.trackingRequirements?.requiredLandmarks ?? []);
  const movementLabels = contract.dominantJoint === "shoulder" && contract.shoulderReference === "shoulder_line"
    ? ["left_shoulder", "right_shoulder", "elbows"]
    : groups[contract.dominantJoint] ?? [];
  for (const label of movementLabels) labels.add(label);
  const spatial = contract.spatialRequirements;
  if ((contract.bodyOrientation && contract.bodyOrientation !== "any") ||
      spatial?.bodyLineTolerance != null || spatial?.torsoSlopeMinDeg != null ||
      spatial?.torsoSlopeMaxDeg != null || (spatial?.bodyYTravelMin ?? 0) > 0 ||
      (spatial?.shoulderHipTravelMin ?? 0) > 0) {
    labels.add("shoulders");
    labels.add("hips");
  }
  if (spatial?.bodyLineTolerance != null && getPoseBodyLineScope(contract) === "full_body") labels.add("ankles");
  if (spatial?.bodyXDriftMax != null || (spatial?.hipYTravelMin ?? 0) > 0) labels.add("hips");
  if ((spatial?.shoulderYTravelMin ?? 0) > 0) labels.add("shoulders");
  if (spatial?.wristAnchorDriftMax != null) labels.add("wrists");
  return [...labels];
}

function getLandmarkIndexesForSide(
  label: string,
  side: PoseSide | null,
) {
  const directIndex = LANDMARK_NAMES.indexOf(label as PoseLandmarkName);
  if (directIndex >= 0) return [directIndex];
  const sidePrefix = label.match(/^(left|right)_(.+)$/);
  if (sidePrefix) {
    const index = LANDMARK_NAMES.indexOf(label as PoseLandmarkName);
    return index >= 0 ? [index] : [];
  }
  const group = POSE_LANDMARK_GROUP_INDEXES[label];
  if (!group) return [];
  if (!side) return [...group];
  const sideIndex = side === "left" ? 0 : 1;
  return group.filter((_, index) => index % 2 === sideIndex);
}

function getAssessmentSide(
  keypoints: PoseKeypointRecord[],
  labels: string[],
  requiredSides: string,
): PoseSide | null {
  if (requiredSides !== "either" && requiredSides !== "alternating") {
    return requiredSides === "left" || requiredSides === "right"
      ? requiredSides
      : null;
  }
  const score = (side: PoseSide) => {
    const indexes = labels.flatMap((label) =>
      getLandmarkIndexesForSide(label, side),
    );
    if (!indexes.length) return 0;
    return average(indexes.map((index) => keypoints[index]?.visibility ?? 0));
  };
  return score("right") > score("left") ? "right" : "left";
}

export type PoseMovementFrameAssessment = {
  isReliable: boolean;
  reason: string | null;
  confidence: number;
  reliableLandmarkCount: number;
  lowConfidenceLandmarks: string[];
};

/** A count derived from the actual tracked chains, never unrelated face/leg points. */
export function getPoseRequiredLandmarkCount(contract: PoseMovementContractRecord) {
  const sides = contract.trackingRequirements?.requiredSides ?? contract.requiredSides;
  const side = sides === "both" ? null : sides === "right" ? "right" : "left";
  return new Set(getPoseMovementRequiredLandmarks(contract).flatMap(
    (label) => getLandmarkIndexesForSide(label, side),
  )).size;
}

/**
 * Assess the declared landmarks plus dependencies of active contract rules.
 * Subject identity/tracking guards remain adapter responsibilities.
 */
export function getPoseMovementFrameAssessment(
  contract: PoseMovementContractRecord | null | undefined,
  keypoints: PoseKeypointRecord[] | null | undefined,
  _coordinateDimensions?: PoseCoordinateDimensions,
): PoseMovementFrameAssessment {
  if (!contract) {
    return {
      isReliable: false,
      reason: "movement_contract_missing",
      confidence: 0,
      reliableLandmarkCount: 0,
      lowConfidenceLandmarks: [],
    };
  }
  if (!keypoints?.length) {
    return {
      isReliable: false,
      reason: "pose_keypoints_missing",
      confidence: 0,
      reliableLandmarkCount: 0,
      lowConfidenceLandmarks: [],
    };
  }
  const tracking = contract.trackingRequirements;
  const minConfidence = tracking?.minConfidence ?? MIN_CONFIDENCE;
  const labels = getPoseMovementRequiredLandmarks(contract);
  if (
    !Number.isFinite(minConfidence) ||
    minConfidence < 0 ||
    minConfidence > 1
  ) {
    return {
      isReliable: false,
      reason: "tracking_requirements_invalid",
      confidence: 0,
      reliableLandmarkCount: 0,
      lowConfidenceLandmarks: [],
    };
  }
  const requiredSides =
    tracking?.requiredSides ?? contract.requiredSides ?? "either";
  const assessmentSide = getAssessmentSide(
    keypoints,
    labels,
    requiredSides,
  );
  const selectedIndexes = labels.length
    ? Array.from(
        new Set(
          labels.flatMap((label) =>
            getLandmarkIndexesForSide(label, assessmentSide),
          ),
        ),
      )
    : keypoints.map((_, index) => index);
  const selectedPoints = selectedIndexes.map((index) => keypoints[index]);
  const lowConfidenceLandmarks = Array.from(
    new Set(
      selectedIndexes
        .filter((index) => {
          const point = keypoints[index];
          return (
            !point ||
            !Number.isFinite(point.visibility) ||
            point.visibility < minConfidence ||
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y)
          );
        })
        .map((index) => LANDMARK_NAMES[index] ?? `landmark_${index}`),
    ),
  );
  const requiredConfidence = selectedPoints.map((point) =>
    point && Number.isFinite(point.visibility) ? point.visibility : 0,
  );
  const confidence = requiredConfidence.length
    ? average(requiredConfidence)
    : 0;
  const reliableLandmarkCount = selectedPoints.filter(
    (point) =>
      point &&
      Number.isFinite(point.visibility) &&
      point.visibility >= minConfidence &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y),
  ).length;
  let reason: string | null = null;
  if (!selectedIndexes.length || lowConfidenceLandmarks.length > 0) {
    reason = "required_landmarks_unreliable";
  } else if (confidence < minConfidence) {
    reason = "tracking_confidence_below_contract";
  }
  return {
    isReliable: reason === null,
    reason,
    confidence: Number(confidence.toFixed(4)),
    reliableLandmarkCount,
    lowConfidenceLandmarks,
  };
}

/** Shared by editor reference validation and the web/native rep engine. */
/** The exact camera-plane torso range enforced by the saved posture settings. */
export function getPoseTorsoSlopeRange(contract: PoseMovementContractRecord): {
  min: number; max: number;
  source: "explicit" | "body_line" | "orientation" | "unrestricted";
  minExclusive?: boolean; maxExclusive?: boolean;
} {
  const spatial = contract.spatialRequirements;
  if (spatial?.torsoSlopeMinDeg != null || spatial?.torsoSlopeMaxDeg != null) {
    return { min: spatial.torsoSlopeMinDeg ?? 0, max: spatial.torsoSlopeMaxDeg ?? 90, source: "explicit" };
  }
  const expected = contract.bodyOrientation;
  if (!expected || expected === "any") return { min: 0, max: 90, source: "unrestricted" };
  if (getPoseBodyLineScope(contract) === "torso" && spatial?.bodyLineTolerance != null) {
    const target = expected === "upright" ? 90 : expected === "inclined" ? 45 : 0;
    return { min: Math.max(0, target-spatial.bodyLineTolerance), max: Math.min(90, target+spatial.bodyLineTolerance), source: "body_line" };
  }
  if (expected === "upright") return { min: 55, max: 90, minExclusive: true, source: "orientation" };
  if (expected === "inclined") return { min: 35, max: 55, source: "orientation" };
  return { min: 0, max: 35, maxExclusive: true, source: "orientation" };
}

export function getPoseTorsoSlopeAngles(
  contract: PoseMovementContractRecord,
  keypoints: PoseKeypointRecord[] | null | undefined,
  dimensions?: PoseCoordinateDimensions,
) {
  const { width, height, depthScale = 0 } = resolvePoseCoordinateDimensions(dimensions);
  const minVisibility = contract.trackingRequirements?.minConfidence ?? MIN_CONFIDENCE;
  const angle = (offset: number) => {
    const shoulder = keypoints?.[11+offset], hip = keypoints?.[23+offset];
    if (!shoulder || !hip || ![shoulder.x,shoulder.y,hip.x,hip.y,shoulder.visibility,hip.visibility].every(Number.isFinite) ||
        shoulder.visibility < minVisibility || hip.visibility < minVisibility) return null;
    const dx = (hip.x-shoulder.x)*width, dy = (hip.y-shoulder.y)*height;
    const dz = depthScale ? (hip.z-shoulder.z)*depthScale : 0;
    if (!Number.isFinite(dz)) return null;
    // Elevation above the camera's horizontal X/Z plane. Image X/Y alone
    // confuses perspective foreshortening with an upright torso. MediaPipe's
    // world coordinates supply depth; they are not a gravity calibration.
    return Math.hypot(dx,dy,dz) > 1e-6
      ? Math.atan2(Math.abs(dy),Math.hypot(dx,dz))*180/Math.PI : null;
  };
  return { left: angle(0), right: angle(1) };
}

export function getPoseMovementPostureReason(
  contract: PoseMovementContractRecord,
  keypoints: PoseKeypointRecord[] | null | undefined,
  dimensions?: PoseCoordinateDimensions,
): string | null {
  if (!keypoints?.length) return "pose_keypoints_missing";
  const spatial = contract.spatialRequirements;
  const expected = contract.bodyOrientation;
  const lineScope = getPoseBodyLineScope(contract);
  const range = getPoseTorsoSlopeRange(contract);
  const slopes = getPoseTorsoSlopeAngles(contract, keypoints, dimensions);
  if ((!expected || expected === "any") && spatial?.bodyLineTolerance == null &&
      spatial?.torsoSlopeMinDeg == null && spatial?.torsoSlopeMaxDeg == null) return null;
  const minVisibility = contract.trackingRequirements?.minConfidence ?? MIN_CONFIDENCE;
  const side = getAssessmentSide(keypoints, getPoseMovementRequiredLandmarks(contract),
    contract.trackingRequirements?.requiredSides ?? contract.requiredSides ?? "either");
  const sides: PoseSide[] = side ? [side] : ["left", "right"];
  const {width, height, depthScale = 0} = resolvePoseCoordinateDimensions(dimensions);
  const vector = (from: number, to: number) => {
    const a = keypoints[from], b = keypoints[to];
    if (!a || !b || a.visibility < minVisibility || b.visibility < minVisibility ||
        ![a.x,a.y,b.x,b.y].every(Number.isFinite)) return null;
    const result = {x:(b.x-a.x)*width,y:(b.y-a.y)*height,z:depthScale ? (b.z-a.z)*depthScale : 0};
    return Number.isFinite(result.z) && Math.hypot(result.x,result.y,result.z) > 1e-6 ? result : null;
  };
  for (const currentSide of sides) {
    const offset = currentSide === "left" ? 0 : 1;
    const torso = vector(11+offset,23+offset);
    if (!torso) return "body_line_evidence_unavailable";
    const slope = slopes[currentSide];
    if (slope === null) return "body_line_evidence_unavailable";
    if (range.source === "explicit" && slope < range.min) return "torso_slope_below_min";
    if (range.source === "explicit" && slope > range.max) return "torso_slope_above_max";
    // The numeric torso fields own the range when present. Otherwise the
    // selected orientation remains meaningful, independently of body alignment.
    if (range.source === "body_line" && (slope < range.min-1e-3 || slope > range.max+1e-3)) {
      return "body_line_over_tolerance";
    }
    if (range.source === "orientation" &&
        ((range.minExclusive ? slope <= range.min : slope < range.min) ||
         (range.maxExclusive ? slope >= range.max : slope > range.max))) {
      return "body_orientation_mismatch";
    }
    if (spatial?.bodyLineTolerance == null) continue;
    if (lineScope === "full_body") {
      const leg = vector(23+offset,27+offset);
      if (!leg) return "body_line_evidence_unavailable";
      const cosine = Math.max(-1,Math.min(1,(torso.x*leg.x+torso.y*leg.y+torso.z*leg.z)/
        (Math.hypot(torso.x,torso.y,torso.z)*Math.hypot(leg.x,leg.y,leg.z))));
      const angle = Math.acos(cosine)*180/Math.PI;
      // Shoulder -> hip -> ankle must continue in the same direction. Folding
      // the legs back toward the shoulders is not a straight body line.
      if (angle > spatial.bodyLineTolerance + 1e-3) return "body_line_over_tolerance";
    }
  }
  return null;
}

export function computePoseAngleSignals(
  frames: PoseSequenceFrameRecord[],
  coordinateDimensions?: PoseCoordinateDimensions,
): PoseAngleFrameSignalRecord[] {
  return frames.map((frame) => ({
    capturedAtMs: frame.capturedAtMs,
    ankle: getPoseJointAngle(frame.keypoints, "ankle", coordinateDimensions),
    elbow: getPoseJointAngle(frame.keypoints, "elbow", coordinateDimensions),
    hip: getPoseJointAngle(frame.keypoints, "hip", coordinateDimensions),
    knee: getPoseJointAngle(frame.keypoints, "knee", coordinateDimensions),
    leftElbow: getPoseSideJointAngle(frame.keypoints, "left_elbow", coordinateDimensions),
    leftAnkle: getPoseSideJointAngle(frame.keypoints, "left_ankle", coordinateDimensions),
    leftHip: getPoseSideJointAngle(frame.keypoints, "left_hip", coordinateDimensions),
    leftKnee: getPoseSideJointAngle(frame.keypoints, "left_knee", coordinateDimensions),
    leftShoulder: getPoseSideJointAngle(frame.keypoints, "left_shoulder", coordinateDimensions),
    rightElbow: getPoseSideJointAngle(frame.keypoints, "right_elbow", coordinateDimensions),
    rightAnkle: getPoseSideJointAngle(frame.keypoints, "right_ankle", coordinateDimensions),
    rightHip: getPoseSideJointAngle(frame.keypoints, "right_hip", coordinateDimensions),
    rightKnee: getPoseSideJointAngle(frame.keypoints, "right_knee", coordinateDimensions),
    rightShoulder: getPoseSideJointAngle(frame.keypoints, "right_shoulder", coordinateDimensions),
    shoulder: getPoseJointAngle(frame.keypoints, "shoulder", coordinateDimensions),
  }));
}

export function computePoseSignals(
  frames: PoseSequenceFrameRecord[],
  coordinateDimensions?: PoseCoordinateDimensions,
): PoseSequenceSignalsRecord {
  const angles = computePoseAngleSignals(frames, coordinateDimensions);
  const lastFrame = frames.at(-1);
  const latestKeypoints = lastFrame?.keypoints ?? [];
  const leftWrist = latestKeypoints[15];
  const rightWrist = latestKeypoints[16];
  const leftFoot = latestKeypoints[31];
  const rightFoot = latestKeypoints[32];
  const nose = latestKeypoints[0];
  const hipCenter =
    latestKeypoints.length >= 25 ? averagePoint(latestKeypoints, 23, 24) : null;
  const shoulderCenter =
    latestKeypoints.length >= 13 ? averagePoint(latestKeypoints, 11, 12) : null;

  const hipYValues = frames
    .map((frame) =>
      average(
        [frame.keypoints[23], frame.keypoints[24]]
          .filter(
            (point): point is PoseKeypointRecord =>
              !!point && point.visibility >= MIN_CONFIDENCE,
          )
          .map((point) => point.y),
      ),
    )
    .filter((value) => Number.isFinite(value));
  const hipXValues = frames
    .map((frame) =>
      average(
        [frame.keypoints[23], frame.keypoints[24]]
          .filter(
            (point): point is PoseKeypointRecord =>
              !!point && point.visibility >= MIN_CONFIDENCE,
          )
          .map((point) => point.x),
      ),
    )
    .filter((value) => Number.isFinite(value));
  const shoulderYValues = frames
    .map((frame) =>
      average(
        [frame.keypoints[11], frame.keypoints[12]]
          .filter(
            (point): point is PoseKeypointRecord =>
              !!point && point.visibility >= MIN_CONFIDENCE,
          )
          .map((point) => point.y),
      ),
    )
    .filter((value) => Number.isFinite(value));
  const shoulderXValues = frames
    .map((frame) =>
      average(
        [frame.keypoints[11], frame.keypoints[12]]
          .filter(
            (point): point is PoseKeypointRecord =>
              !!point && point.visibility >= MIN_CONFIDENCE,
          )
          .map((point) => point.x),
      ),
    )
    .filter((value) => Number.isFinite(value));
  const leftWristXValues = frames
    .map((frame) => frame.keypoints[15]?.x)
    .filter((value): value is number => Number.isFinite(value));
  const rightWristXValues = frames
    .map((frame) => frame.keypoints[16]?.x)
    .filter((value): value is number => Number.isFinite(value));

  const averageVisibility = average(
    frames.flatMap((frame) => frame.keypoints.map((point) => point.visibility)),
  );
  const lowConfidenceLandmarks = latestKeypoints
    .map((point, index) =>
      point.visibility < MIN_CONFIDENCE ? LANDMARK_NAMES[index] : null,
    )
    .filter((name): name is PoseLandmarkName => name !== null);

  const elbowSeries = angles.map((entry) => entry.elbow);
  const shoulderSeries = angles.map((entry) => entry.shoulder);
  const hipSeries = angles.map((entry) => entry.hip);
  const kneeSeries = angles.map((entry) => entry.knee);
  const leftElbowSeries = angles.map((entry) => entry.leftElbow ?? null);
  const rightElbowSeries = angles.map((entry) => entry.rightElbow ?? null);
  const leftShoulderSeries = angles.map((entry) => entry.leftShoulder ?? null);
  const rightShoulderSeries = angles.map(
    (entry) => entry.rightShoulder ?? null,
  );
  const leftKneeSeries = angles.map((entry) => entry.leftKnee ?? null);
  const rightKneeSeries = angles.map((entry) => entry.rightKnee ?? null);
  const amplitudes = {
    elbow: Number(summarizeAmplitude(elbowSeries).toFixed(4)),
    hip: Number(summarizeAmplitude(hipSeries).toFixed(4)),
    knee: Number(summarizeAmplitude(kneeSeries).toFixed(4)),
    left_elbow: Number(summarizeAmplitude(leftElbowSeries).toFixed(4)),
    left_knee: Number(summarizeAmplitude(leftKneeSeries).toFixed(4)),
    left_shoulder: Number(summarizeAmplitude(leftShoulderSeries).toFixed(4)),
    right_elbow: Number(summarizeAmplitude(rightElbowSeries).toFixed(4)),
    right_knee: Number(summarizeAmplitude(rightKneeSeries).toFixed(4)),
    right_shoulder: Number(summarizeAmplitude(rightShoulderSeries).toFixed(4)),
    shoulder: Number(summarizeAmplitude(shoulderSeries).toFixed(4)),
  };
  const oscillatingJoints = Object.entries(amplitudes)
    .filter(([, value]) => value >= 10)
    .map(([joint]) => joint);

  const reliableFrameCount = frames.filter((frame) => {
    const visible = frame.keypoints.filter(
      (point) => point.visibility >= MIN_CONFIDENCE,
    );
    return visible.length >= MIN_RELIABLE_FRAME_LANDMARKS;
  }).length;

  const torsoVector =
    nose && hipCenter
      ? {
          x: Number((hipCenter.x - nose.x).toFixed(4)),
          y: Number((hipCenter.y - nose.y).toFixed(4)),
        }
      : { x: 0, y: 0 };
  const torsoSlopeDeg =
    shoulderCenter && hipCenter
      ? Number(
          (
            (Math.atan2(
              Math.abs(hipCenter.y - shoulderCenter.y) *
                resolvePoseCoordinateDimensions(coordinateDimensions).height,
              Math.abs(hipCenter.x - shoulderCenter.x) *
                  resolvePoseCoordinateDimensions(coordinateDimensions).width +
                1e-6,
            ) *
              180) /
            Math.PI
          ).toFixed(3),
        )
      : 0;
  const bodyOrientation =
    torsoSlopeDeg > 55
      ? "upright"
      : torsoSlopeDeg < 35
        ? "horizontal"
        : "inclined";

  const hipRange = hipYValues.length
    ? Math.max(...hipYValues) - Math.min(...hipYValues)
    : 0;
  const hipXRange = hipXValues.length
    ? Math.max(...hipXValues) - Math.min(...hipXValues)
    : 0;
  const shoulderRange = shoulderYValues.length
    ? Math.max(...shoulderYValues) - Math.min(...shoulderYValues)
    : 0;
  const shoulderXRange = shoulderXValues.length
    ? Math.max(...shoulderXValues) - Math.min(...shoulderXValues)
    : 0;
  const leftWristXRange = leftWristXValues.length
    ? Math.max(...leftWristXValues) - Math.min(...leftWristXValues)
    : 0;
  const rightWristXRange = rightWristXValues.length
    ? Math.max(...rightWristXValues) - Math.min(...rightWristXValues)
    : 0;
  const leftElbowBottomMs = getLatestExtremumTime(
    frames,
    leftElbowSeries,
    "min",
  );
  const rightElbowBottomMs = getLatestExtremumTime(
    frames,
    rightElbowSeries,
    "min",
  );
  const phaseSyncMs =
    leftElbowBottomMs !== null && rightElbowBottomMs !== null
      ? Math.abs(leftElbowBottomMs - rightElbowBottomMs)
      : null;

  return {
    angles,
    hip: {
      averageY: Number(average(hipYValues).toFixed(4)),
      rangeX: Number(hipXRange.toFixed(4)),
      rangeY: Number(hipRange.toFixed(4)),
      stable: hipRange < 0.05,
    },
    orientation: {
      bodyOrientation,
      torsoSlopeDeg,
      vector: torsoVector,
    },
    shoulder: {
      averageY: Number(average(shoulderYValues).toFixed(4)),
      rangeX: Number(shoulderXRange.toFixed(4)),
      rangeY: Number(shoulderRange.toFixed(4)),
    },
    temporal: {
      amplitudes,
      oscillatingJoints,
      phaseSyncMs,
    },
    visibility: {
      averageVisibility: Number(averageVisibility.toFixed(4)),
      feetVisibility: Number(
        average([
          leftFoot?.visibility ?? 0,
          rightFoot?.visibility ?? 0,
        ]).toFixed(4),
      ),
      leftArmVisibility: Number(
        averageLandmarkVisibility(latestKeypoints, [11, 13, 15]).toFixed(4),
      ),
      lowConfidenceLandmarks: [...lowConfidenceLandmarks],
      reliableFrameCount,
      rightArmVisibility: Number(
        averageLandmarkVisibility(latestKeypoints, [12, 14, 16]).toFixed(4),
      ),
      wristVisibility: Number(
        average([
          leftWrist?.visibility ?? 0,
          rightWrist?.visibility ?? 0,
        ]).toFixed(4),
      ),
    },
    wrist: {
      leftRangeX: Number(leftWristXRange.toFixed(4)),
      maxRangeX: Number(Math.max(leftWristXRange, rightWristXRange).toFixed(4)),
      rightRangeX: Number(rightWristXRange.toFixed(4)),
    },
  };
}

export function summarizeMovementGuidance(
  contract: PoseMovementContractRecord | null,
  keypoints: PoseKeypointRecord[] | null,
  currentPhase: string,
  lowConfidenceLandmarks: string[],
) {
  const tips: string[] = [];
  if (lowConfidenceLandmarks.length > 0) {
    tips.push("Keep your full body visible for reliable rep tracking.");
  }

  if (!contract || !keypoints) {
    return tips;
  }

  if (
    contract.requiredSides === "both" &&
    contract.primaryJoints?.some((joint) =>
      lowConfidenceLandmarks.includes(joint),
    )
  ) {
    tips.push("Keep both arms visible so bilateral reps count cleanly.");
  }

  const hipCenter = averagePoint(keypoints, 23, 24);
  const shoulderCenter = averagePoint(keypoints, 11, 12);
  const torsoSlopeDeg =
    (Math.atan2(
      Math.abs(hipCenter.y - shoulderCenter.y),
      Math.abs(hipCenter.x - shoulderCenter.x) + 1e-6,
    ) *
      180) /
    Math.PI;

  if (contract.secondaryCheck === "body_line") {
    if (isPushUpContract(contract) && torsoSlopeDeg > 86) {
      tips.push(
        "Set up side-on and horizontal; upright curls will not count as push-ups.",
      );
    } else {
      tips.push("Keep shoulders, hips, and ankles moving as one line.");
    }
  }
  if (contract.secondaryCheck === "hip_depth" && currentPhase === "down") {
    tips.push("Sit deeper and keep your knees tracking over your toes.");
  }
  if (contract.secondaryCheck === "elbow_stack" && currentPhase === "up") {
    tips.push("Keep your elbows stacked under the load.");
  }

  return tips;
}

export function buildRepAngleData(
  repNumber: number,
  dominantJoint: PoseJointName,
  lowAngle: number,
  highAngle: number,
  timestamp: number,
): PoseRepAngleDataRecord {
  return {
    dominantJoint,
    highAngle: Number(highAngle.toFixed(3)),
    lowAngle: Number(lowAngle.toFixed(3)),
    repNumber,
    timestamp,
  };
}
