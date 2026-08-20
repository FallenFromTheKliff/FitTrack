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
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_shoulder"
  | "right_shoulder";

const JOINT_MAP: Record<PoseJointName, JointIndexes[]> = {
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
const PUSH_UP_SIDE_ANGLE_CONFIDENCE = 0.2;
const PUSH_UP_SYMMETRY_TOLERANCE = 85;
const PULL_UP_SIDE_ANGLE_CONFIDENCE = 0.3;
const PULL_UP_SYMMETRY_TOLERANCE = 60;
const MIN_RELIABLE_FRAME_LANDMARKS = 12;
const POSE_EXERCISE_ALIAS_GROUPS = [
  {
    canonical: "push_up",
    aliases: ["push up", "push-up", "pushup", "push_up"],
  },
  {
    canonical: "pull_up",
    aliases: [
      "pull up",
      "pull-up",
      "pullup",
      "pull_up",
      "chin up",
      "chin-up",
      "chinup",
    ],
  },
  { canonical: "squat", aliases: ["squat", "back squat"] },
  {
    canonical: "bicep_curl",
    aliases: [
      "dumbbell bicep curl",
      "dumbbell biceps curl",
      "dumbbell curl",
      "bicep curl",
      "biceps curl",
      "curl",
      "bicep_curl",
    ],
  },
  {
    canonical: "dip",
    aliases: [
      "dip",
      "tricep dip",
      "bench dip",
      "assisted dip",
      "parallel bar dip",
    ],
  },
  {
    canonical: "shoulder_press",
    aliases: ["shoulder press", "shoulder_press"],
  },
  { canonical: "plank", aliases: ["plank"] },
  { canonical: "bench_press", aliases: ["bench press", "bench_press"] },
] as const;

export const POSE_MOVEMENT_CONTRACT_VERSION = "pose_movement_contract_v2";

const POSE_BODY_ORIENTATION_BY_EXERCISE: Record<string, PoseBodyOrientation> = {
  bench_press: "horizontal",
  bicep_curl: "upright",
  dip: "upright",
  plank: "horizontal",
  pull_up: "upright",
  push_up: "horizontal",
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
      down: { angle: 78, tolerance: 12 },
      up: { angle: 166, tolerance: 12 },
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
    primaryJoints: ["left_elbow", "right_elbow"],
    repThresholds: {
      down: { angle: 150, tolerance: 12 },
      up: { angle: 100, tolerance: 22 },
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
      down: { angle: 118, tolerance: 12 },
      up: { angle: 150, tolerance: 14 },
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
      down: { angle: 140, tolerance: 15 },
      up: { angle: 154, tolerance: 12 },
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
      down: { angle: 138, tolerance: 24 },
      up: { angle: 105, tolerance: 34 },
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
      down: { angle: 72, tolerance: 12 },
      up: { angle: 164, tolerance: 12 },
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
      down: { angle: 92, tolerance: 12 },
      up: { angle: 168, tolerance: 12 },
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
  return {
    visibility: average([left.visibility, right.visibility]),
    x: average([left.x, right.x]),
    y: average([left.y, right.y]),
    z: average([left.z, right.z]),
  };
}

function angleAtPoint(
  pointA: PoseKeypointRecord,
  pointB: PoseKeypointRecord,
  pointC: PoseKeypointRecord,
) {
  const abX = pointA.x - pointB.x;
  const abY = pointA.y - pointB.y;
  const cbX = pointC.x - pointB.x;
  const cbY = pointC.y - pointB.y;
  const abMag = Math.sqrt(abX ** 2 + abY ** 2);
  const cbMag = Math.sqrt(cbX ** 2 + cbY ** 2);
  if (!abMag || !cbMag) return null;
  const cosine = Math.max(
    -1,
    Math.min(1, (abX * cbX + abY * cbY) / (abMag * cbMag)),
  );
  return (Math.acos(cosine) * 180) / Math.PI;
}

function averageJointAngle(
  keypoints: PoseKeypointRecord[],
  indexes: JointIndexes[],
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
        pointA.visibility < MIN_CONFIDENCE ||
        pointB.visibility < MIN_CONFIDENCE ||
        pointC.visibility < MIN_CONFIDENCE
      ) {
        return null;
      }
      return angleAtPoint(pointA, pointB, pointC);
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
): number | null {
  return sideJointAngleWithConfidence(keypoints, indexes, MIN_CONFIDENCE);
}

function sideJointAngleWithConfidence(
  keypoints: PoseKeypointRecord[],
  indexes: JointIndexes,
  minConfidence: number,
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

  const angle = angleAtPoint(pointA, pointB, pointC);
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

function isPullUpContract(
  contract: Pick<PoseMovementContractRecord, "exercise">,
) {
  return toCanonicalPoseExerciseLabel(contract.exercise) === "pull_up";
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

  let bestMatch: { aliasLength: number; canonical: string } | null = null;
  for (const group of POSE_EXERCISE_ALIAS_GROUPS) {
    for (const alias of group.aliases) {
      if (
        normalized.includes(alias) &&
        (!bestMatch || alias.length > bestMatch.aliasLength)
      ) {
        bestMatch = { aliasLength: alias.length, canonical: group.canonical };
      }
    }
  }

  return bestMatch?.canonical ?? null;
}

function cloneTrackingRequirements(
  requirements: PoseTrackingRequirementsRecord | null | undefined,
  requiredSides: PoseMovementContractRecord["requiredSides"],
) {
  if (!requirements) return undefined;
  return {
    minConfidence: Math.max(0, Math.min(1, requirements.minConfidence)),
    minReliableFrameLandmarks: Math.max(
      1,
      Math.round(requirements.minReliableFrameLandmarks),
    ),
    requiredLandmarks: [...requirements.requiredLandmarks],
    ...(requirements.requiredSides ?? requiredSides
      ? { requiredSides: requirements.requiredSides ?? requiredSides }
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
  const normalized = {
    ...(fallbackDefaults ?? {}),
    ...record,
    exercise,
    contractVersion:
      record.contractVersion ??
      fallbackDefaults?.contractVersion ??
      POSE_MOVEMENT_CONTRACT_VERSION,
    bodyOrientation:
      record.bodyOrientation ??
      fallbackDefaults?.bodyOrientation ??
      (canonical ? POSE_BODY_ORIENTATION_BY_EXERCISE[canonical] : "any"),
    trackingRequirements: cloneTrackingRequirements(
      record.trackingRequirements ??
        fallbackDefaults?.trackingRequirements ??
        (canonical ? POSE_TRACKING_REQUIREMENTS_BY_EXERCISE[canonical] : undefined),
      record.requiredSides ?? fallback?.requiredSides,
    ),
    partialRepPolicy:
      record.partialRepPolicy ??
      fallbackDefaults?.partialRepPolicy ??
      "strict_full_rep",
    holdDurationSeconds:
      (record.repModel ?? fallbackDefaults?.repModel) === "static_hold"
        ? Math.max(
            1,
            Math.min(
              3600,
              Number(
                record.holdDurationSeconds ??
                  fallbackDefaults?.holdDurationSeconds ??
                  30,
              ) || 30,
            ),
          )
        : record.holdDurationSeconds ?? fallbackDefaults?.holdDurationSeconds ?? null,
    oscillatingJoints: [
      ...(record.oscillatingJoints ?? fallbackDefaults?.oscillatingJoints ?? []),
    ],
    ...(record.degradedConditions ?? fallbackDefaults?.degradedConditions
      ? {
          degradedConditions: [
            ...(record.degradedConditions ??
              fallbackDefaults?.degradedConditions ??
              []),
          ],
        }
      : {}),
    ...(record.noCountConditions ?? fallbackDefaults?.noCountConditions
      ? {
          noCountConditions: [
            ...(record.noCountConditions ??
              fallbackDefaults?.noCountConditions ??
              []),
          ],
        }
      : {}),
    ...(record.phaseOrder ?? fallbackDefaults?.phaseOrder
      ? {
          phaseOrder: [
            ...(record.phaseOrder ?? fallbackDefaults?.phaseOrder ?? []),
          ],
        }
      : {}),
    ...(record.primaryJoints ?? fallbackDefaults?.primaryJoints
      ? {
          primaryJoints: [
            ...(record.primaryJoints ?? fallbackDefaults?.primaryJoints ?? []),
          ],
        }
      : {}),
    ...(record.secondaryJoints ?? fallbackDefaults?.secondaryJoints
      ? {
          secondaryJoints: [
            ...(record.secondaryJoints ?? fallbackDefaults?.secondaryJoints ??
              []),
          ],
        }
      : {}),
    ...(record.spatialRequirements ?? fallbackDefaults?.spatialRequirements
      ? {
          spatialRequirements: {
            ...(fallbackDefaults?.spatialRequirements ?? {}),
            ...(record.spatialRequirements ?? {}),
          },
        }
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

  return normalized;
}

export function buildFallbackPoseMovementContract(
  exerciseLabel: string | null | undefined,
): PoseMovementContractRecord | null {
  const canonical = toCanonicalPoseExerciseLabel(exerciseLabel);
  if (!canonical) {
    return null;
  }

  const contract = FALLBACK_POSE_MOVEMENT_CONTRACTS[canonical];
  return contract ? normalizePoseMovementContract(contract, canonical) : null;
}

export function getPoseJointAngle(
  keypoints: PoseKeypointRecord[],
  joint: PoseJointName,
) {
  const indexes = JOINT_MAP[joint];
  return indexes ? averageJointAngle(keypoints, indexes) : null;
}

export function getPoseSideJointAngle(
  keypoints: PoseKeypointRecord[],
  joint: PoseSideJointName,
) {
  const indexes = SIDE_JOINT_MAP[joint];
  return indexes ? sideJointAngle(keypoints, indexes) : null;
}

export function getPoseMovementContractAngle(
  contract: PoseMovementContractRecord,
  keypoints: PoseKeypointRecord[],
) {
  const primaryJoints = contract.primaryJoints ?? [];
  if (isPushUpContract(contract) && contract.requiredSides === "both") {
    const pushUpSideAngles = primaryJoints
      .filter(isPoseSideJointName)
      .map((joint) =>
        sideJointAngleWithConfidence(
          keypoints,
          SIDE_JOINT_MAP[joint],
          PUSH_UP_SIDE_ANGLE_CONFIDENCE,
        ),
      );
    const usable = pushUpSideAngles.filter(
      (angle): angle is number =>
        typeof angle === "number" && Number.isFinite(angle),
    );
    if (!usable.length) {
      return null;
    }
    if (usable.length >= 2) {
      const symmetryTolerance = Math.max(
        contract.spatialRequirements?.leftRightSymmetryTolerance ?? 0,
        PUSH_UP_SYMMETRY_TOLERANCE,
      );
      if (Math.max(...usable) - Math.min(...usable) > symmetryTolerance) {
        return null;
      }
    }
    return Number(average(usable).toFixed(3));
  }

  if (isPullUpContract(contract)) {
    const pullUpSideAngles = primaryJoints
      .filter(isPoseSideJointName)
      .map((joint) =>
        sideJointAngleWithConfidence(
          keypoints,
          SIDE_JOINT_MAP[joint],
          PULL_UP_SIDE_ANGLE_CONFIDENCE,
        ),
      );
    const usable = pullUpSideAngles.filter(
      (angle): angle is number =>
        typeof angle === "number" && Number.isFinite(angle),
    );
    if (!usable.length) {
      return null;
    }
    if (usable.length >= 2) {
      const symmetryTolerance = Math.max(
        contract.spatialRequirements?.leftRightSymmetryTolerance ?? 0,
        PULL_UP_SYMMETRY_TOLERANCE,
      );
      if (Math.max(...usable) - Math.min(...usable) > symmetryTolerance) {
        return null;
      }
    }
    return Number(average(usable).toFixed(3));
  }

  const sideAngles = primaryJoints
    .filter(isPoseSideJointName)
    .map((joint) => getPoseSideJointAngle(keypoints, joint));

  if (contract.requiredSides === "both" && sideAngles.length >= 2) {
    if (sideAngles.some((angle) => angle === null)) {
      return null;
    }
    const usable = sideAngles.filter(
      (angle): angle is number => typeof angle === "number",
    );
    const symmetryTolerance =
      contract.spatialRequirements?.leftRightSymmetryTolerance ?? 30;
    if (Math.max(...usable) - Math.min(...usable) > symmetryTolerance) {
      return null;
    }
    return Number(average(usable).toFixed(3));
  }

  const sideJoint =
    contract.requiredSides === "left"
      ? primaryJoints.find((joint) => joint.startsWith("left_"))
      : contract.requiredSides === "right"
        ? primaryJoints.find((joint) => joint.startsWith("right_"))
        : null;

  if (sideJoint && isPoseSideJointName(sideJoint)) {
    return getPoseSideJointAngle(keypoints, sideJoint);
  }

  return getPoseJointAngle(keypoints, contract.dominantJoint);
}

export function computePoseAngleSignals(
  frames: PoseSequenceFrameRecord[],
): PoseAngleFrameSignalRecord[] {
  return frames.map((frame) => ({
    capturedAtMs: frame.capturedAtMs,
    elbow: getPoseJointAngle(frame.keypoints, "elbow"),
    hip: getPoseJointAngle(frame.keypoints, "hip"),
    knee: getPoseJointAngle(frame.keypoints, "knee"),
    leftElbow: getPoseSideJointAngle(frame.keypoints, "left_elbow"),
    leftHip: getPoseSideJointAngle(frame.keypoints, "left_hip"),
    leftKnee: getPoseSideJointAngle(frame.keypoints, "left_knee"),
    leftShoulder: getPoseSideJointAngle(frame.keypoints, "left_shoulder"),
    rightElbow: getPoseSideJointAngle(frame.keypoints, "right_elbow"),
    rightHip: getPoseSideJointAngle(frame.keypoints, "right_hip"),
    rightKnee: getPoseSideJointAngle(frame.keypoints, "right_knee"),
    rightShoulder: getPoseSideJointAngle(frame.keypoints, "right_shoulder"),
    shoulder: getPoseJointAngle(frame.keypoints, "shoulder"),
  }));
}

export function computePoseSignals(
  frames: PoseSequenceFrameRecord[],
): PoseSequenceSignalsRecord {
  const angles = computePoseAngleSignals(frames);
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
          .filter(Boolean)
          .map((point) => point.y),
      ),
    )
    .filter((value) => Number.isFinite(value));
  const hipXValues = frames
    .map((frame) =>
      average(
        [frame.keypoints[23], frame.keypoints[24]]
          .filter(Boolean)
          .map((point) => point.x),
      ),
    )
    .filter((value) => Number.isFinite(value));
  const shoulderYValues = frames
    .map((frame) =>
      average(
        [frame.keypoints[11], frame.keypoints[12]]
          .filter(Boolean)
          .map((point) => point.y),
      ),
    )
    .filter((value) => Number.isFinite(value));
  const shoulderXValues = frames
    .map((frame) =>
      average(
        [frame.keypoints[11], frame.keypoints[12]]
          .filter(Boolean)
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
              Math.abs(hipCenter.y - shoulderCenter.y),
              Math.abs(hipCenter.x - shoulderCenter.x) + 1e-6,
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
