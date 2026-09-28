import type {
  ExerciseGripProfileRecord,
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  ExerciseMuscleTargetRole,
  ExerciseRigKeyframeKind,
  ExerciseRigKeyframeRecord,
  ExerciseRigRecord,
  MuscleDefinitionRecord,
  ExerciseSubjectLockGestureProfileRecord,
  PoseKeypointRecord,
  PoseMovementContractRecord,
  PoseSpatialRequirementsRecord,
} from "@fittrack/types";
import {
  getPoseBodyLineScope,
  getPoseMovementContractAngle,
  getPoseMovementContractSideAngles,
  getPoseShoulderLineReference,
  getPoseMovementRequiredLandmarks,
  getPoseMovementFrameAssessment,
  getPoseRequiredLandmarkCount,
  normalizePoseMovementContract,
  validatePoseMovementContract,
} from "./pose";
import {
  getPoseRepAcceptancePolicy,
  POSE_REP_NOISE_FLOOR_DEGREES,
} from "./pose-rep-policy";
import { CANONICAL_MUSCLE_DEFINITIONS } from "./fitness-catalog";
import { getRigMovementContract, getRigUpperArmReference } from "./pose-rig";

/** Backward-compatible editor export backed by the shared fixed catalog. */
export const DEFAULT_MUSCLE_DEFINITIONS = CANONICAL_MUSCLE_DEFINITIONS;

export const EXERCISE_MUSCLE_GROUP_OPTIONS = DEFAULT_MUSCLE_DEFINITIONS.map(
  (definition) => definition.key,
);

export const EXERCISE_MUSCLE_TARGET_ROLE_OPTIONS: ExerciseMuscleTargetRole[] = [
  "primary",
  "secondary",
  "stabilizer",
];

export const MUSCLE_TARGET_ROLE_XP_MODIFIERS: Record<
  ExerciseMuscleTargetRole,
  number
> = {
  primary: 1,
  secondary: 0.7,
  stabilizer: 0.4,
};

export const DEFAULT_EXERCISE_GRIP_PROFILE: ExerciseGripProfileRecord = {
  maxOpenFrames: 0,
  maxOpenRatio: 0.18,
  minUsableFrames: 2,
  recentFrameLimit: 6,
  reliablePointMinVisibility: 0.36,
  required: false,
};

export const DEFAULT_EXERCISE_SUBJECT_LOCK_GESTURE_PROFILE: ExerciseSubjectLockGestureProfileRecord =
  {
    enabled: true,
    gesture: "rock_sign",
    handAboveShoulderOffset: 0.018,
    handRaisedFromElbowOffset: 0.018,
    holdMs: 3000,
    hornThumbLeadOffset: 0.025,
    maxHornLiftDelta: 0.08,
    minFingerDistance: 0.045,
    minFingerLift: 0.035,
    minFingerSpreadX: 0.025,
    minThumbOffset: 0.012,
    minThumbSeparation: 0.025,
  };

export const DEFAULT_EXERCISE_HAND_SHAPE_PROFILE: ExerciseHandShapeProfileRecord =
  {
    grip: DEFAULT_EXERCISE_GRIP_PROFILE,
    handPosePreview: null,
    schemaVersion: "exercise_hand_shape_v1",
    subjectLockGesture: DEFAULT_EXERCISE_SUBJECT_LOCK_GESTURE_PROFILE,
    warnings: [],
  };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLabel(value: unknown) {
  return typeof value === "string"
    ? value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
    : "";
}

export function normalizeMuscleKey(value: unknown) {
  return normalizeLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRole(value: unknown): ExerciseMuscleTargetRole {
  return EXERCISE_MUSCLE_TARGET_ROLE_OPTIONS.includes(
    value as ExerciseMuscleTargetRole,
  )
    ? (value as ExerciseMuscleTargetRole)
    : "secondary";
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeWarnings(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => normalizeLabel(entry))
        .filter((entry) => entry.length > 0)
        .slice(0, 8)
    : [];
}

export function createDefaultExerciseMuscleTargets(
  primaryMuscleGroup?: string | null,
  exerciseLabel?: string | null,
): ExerciseMuscleTargetRecord[] {
  const contextTargets = createExerciseMuscleTargetsFromContext(
    primaryMuscleGroup,
    exerciseLabel,
  );
  if (contextTargets.length > 0) return contextTargets;

  const normalized = normalizeMuscleKey(primaryMuscleGroup);
  return normalized
    ? [
        {
          allocationPercent: 100,
          muscleGroup: normalized,
          role: "primary",
        },
      ]
    : [];
}

const CANONICAL_MUSCLE_KEYS = new Set(
  DEFAULT_MUSCLE_DEFINITIONS.map((definition) =>
    normalizeMuscleKey(definition.key),
  ),
);

function muscleTarget(
  muscleGroup: string,
  allocationPercent: number,
  role: ExerciseMuscleTargetRole,
): ExerciseMuscleTargetRecord {
  return {
    allocationPercent,
    muscleGroup,
    role,
  };
}

export function createExerciseMuscleTargetsFromContext(
  primaryMuscleGroup?: string | null,
  exerciseLabel?: string | null,
): ExerciseMuscleTargetRecord[] {
  const group = normalizeMuscleKey(primaryMuscleGroup);
  const label = normalizeLabel(exerciseLabel).toLowerCase();

  if (/\b(curl|bicep|hammer)\b/.test(label)) {
    return [
      muscleTarget("biceps", 80, "primary"),
      muscleTarget("forearms", 20, "secondary"),
    ];
  }

  if (/\b(push[\s-]?up|press|bench)\b/.test(label)) {
    return [
      muscleTarget("chest", 50, "primary"),
      muscleTarget("triceps", 30, "secondary"),
      muscleTarget("front_delts", 20, "stabilizer"),
    ];
  }

  if (/\bdip(s)?\b/.test(label)) {
    return [
      muscleTarget("triceps", 45, "primary"),
      muscleTarget("chest", 35, "secondary"),
      muscleTarget("front_delts", 20, "stabilizer"),
    ];
  }

  if (/\b(pull[\s-]?up|chin[\s-]?up)\b/.test(label)) {
    return [
      muscleTarget("lats", 50, "primary"),
      muscleTarget("biceps", 25, "secondary"),
      muscleTarget("forearms", 15, "secondary"),
      muscleTarget("upper_back", 10, "stabilizer"),
    ];
  }

  if (/\b(row)\b/.test(label)) {
    return [
      muscleTarget("upper_back", 45, "primary"),
      muscleTarget("lats", 30, "secondary"),
      muscleTarget("biceps", 15, "secondary"),
      muscleTarget("forearms", 10, "stabilizer"),
    ];
  }

  if (/\b(squat|lunge)\b/.test(label)) {
    return [
      muscleTarget("quads", 45, "primary"),
      muscleTarget("glutes", 30, "secondary"),
      muscleTarget("hamstrings", 15, "secondary"),
      muscleTarget("core", 10, "stabilizer"),
    ];
  }

  if (/\b(chop|rotation|twist)\b/.test(label)) {
    return [
      muscleTarget("obliques", 45, "primary"),
      muscleTarget("abs", 25, "secondary"),
      muscleTarget("core", 20, "stabilizer"),
      muscleTarget("shoulders", 10, "stabilizer"),
    ];
  }

  if (group === "arms") {
    return [
      muscleTarget("biceps", 70, "primary"),
      muscleTarget("forearms", 30, "secondary"),
    ];
  }

  if (group === "back") {
    return [
      muscleTarget("lats", 60, "primary"),
      muscleTarget("upper_back", 40, "secondary"),
    ];
  }

  if (group === "legs") {
    return [
      muscleTarget("quads", 50, "primary"),
      muscleTarget("glutes", 30, "secondary"),
      muscleTarget("hamstrings", 20, "secondary"),
    ];
  }

  return [];
}

export function getPrimaryExerciseMuscleGroup(
  muscleTargets: ExerciseMuscleTargetRecord[] | null | undefined,
  fallback = "",
) {
  const primary =
    muscleTargets?.find((target) => target.role === "primary") ??
    muscleTargets?.[0] ??
    null;
  return (
    normalizeMuscleKey(primary?.muscleGroup) || normalizeMuscleKey(fallback)
  );
}

export function getCanonicalMuscleDefinitions(
  definitions?: Array<
    Pick<MuscleDefinitionRecord, "key"> &
      Partial<
        Pick<
          MuscleDefinitionRecord,
          "aliases" | "bodyRegion" | "isActive" | "name" | "sortOrder"
        >
      >
  > | null,
) {
  const source =
    definitions && definitions.length > 0
      ? definitions
      : DEFAULT_MUSCLE_DEFINITIONS.map((definition) => ({
          ...definition,
          isActive: true,
        }));
  return source
    .filter((definition) => definition.isActive !== false)
    .map((definition) => ({
      aliases: Array.isArray(definition.aliases) ? definition.aliases : [],
      bodyRegion: normalizeMuscleKey(definition.bodyRegion) || "other",
      isActive: definition.isActive !== false,
      key: normalizeMuscleKey(definition.key || definition.name),
      name: normalizeLabel(definition.name) || normalizeLabel(definition.key),
      sortOrder: Number.isFinite(Number(definition.sortOrder))
        ? Number(definition.sortOrder)
        : 999,
    }))
    .filter((definition) => definition.key && definition.name)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function getMuscleDefinitionLabel(
  muscleKey: string,
  definitions?: Array<Pick<MuscleDefinitionRecord, "key" | "name">> | null,
) {
  const normalizedKey = normalizeMuscleKey(muscleKey);
  const match = (definitions ?? []).find(
    (definition) => normalizeMuscleKey(definition.key) === normalizedKey,
  );
  return match?.name || normalizeLabel(muscleKey);
}

export function normalizeExerciseMuscleTargets(
  value: unknown,
  fallbackPrimary?: string | null,
  exerciseLabel?: string | null,
): ExerciseMuscleTargetRecord[] {
  const rawTargets = Array.isArray(value) ? value : [];
  const normalizedTargets = rawTargets
    .map((target) => {
      if (!target || typeof target !== "object") return null;
      const record = target as Record<string, unknown>;
      const muscleGroup = normalizeMuscleKey(
        record.muscleGroup ?? record.muscle_group,
      );
      if (!muscleGroup) return null;
      return {
        allocationPercent: Math.round(
          clamp(
            toNumber(record.allocationPercent ?? record.allocation_percent, 0),
            0,
            100,
          ),
        ),
        muscleGroup,
        role: normalizeRole(record.role),
      };
    })
    .filter((target): target is ExerciseMuscleTargetRecord => Boolean(target));

  if (!normalizedTargets.length) {
    return createDefaultExerciseMuscleTargets(fallbackPrimary, exerciseLabel);
  }

  if (
    normalizedTargets.length === 1 &&
    !CANONICAL_MUSCLE_KEYS.has(normalizedTargets[0].muscleGroup)
  ) {
    const generatedTargets = createDefaultExerciseMuscleTargets(
      fallbackPrimary ?? normalizedTargets[0].muscleGroup,
      exerciseLabel,
    );
    if (generatedTargets.length > 0) return generatedTargets;
  }

  const seen = new Set<string>();
  const deduped = normalizedTargets.filter((target) => {
    const key = `${target.role}:${target.muscleGroup.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!deduped.some((target) => target.role === "primary")) {
    deduped[0] = { ...deduped[0], role: "primary" };
  }

  return deduped.slice(0, 8);
}

export function getMuscleEffortTotal(
  targets: ExerciseMuscleTargetRecord[] | null | undefined,
) {
  return (targets ?? []).reduce(
    (sum, target) => sum + Math.round(target.allocationPercent),
    0,
  );
}

export function calculateMuscleEffortXpShares(
  targets: ExerciseMuscleTargetRecord[] | null | undefined,
) {
  const normalizedTargets = normalizeExerciseMuscleTargets(targets ?? []);
  const weightedTargets = normalizedTargets.map((target) => {
    const roleModifier = MUSCLE_TARGET_ROLE_XP_MODIFIERS[target.role] ?? 1;
    const weightedShare = target.allocationPercent * roleModifier;
    return {
      ...target,
      roleModifier,
      weightedShare,
    };
  });
  const totalWeightedShare = weightedTargets.reduce(
    (sum, target) => sum + target.weightedShare,
    0,
  );

  return weightedTargets.map((target) => ({
    ...target,
    effectivePercent:
      totalWeightedShare > 0
        ? Math.round((target.weightedShare / totalWeightedShare) * 1000) / 10
        : 0,
  }));
}

export function calculateMuscleXpDistribution({
  baseXp,
  difficultyMultiplier = 1,
  integrityMultiplier = 1,
  personalMultiplier = 1,
  streakMultiplier = 1,
  targets,
  volumeMultiplier = 1,
}: {
  baseXp: number;
  difficultyMultiplier?: number;
  integrityMultiplier?: number;
  personalMultiplier?: number;
  streakMultiplier?: number;
  targets: ExerciseMuscleTargetRecord[] | null | undefined;
  volumeMultiplier?: number;
}) {
  const poolXp =
    baseXp *
    streakMultiplier *
    integrityMultiplier *
    difficultyMultiplier *
    volumeMultiplier *
    personalMultiplier;
  const shares = calculateMuscleEffortXpShares(targets);

  return {
    muscleXp: shares.map((share) => ({
      muscleGroup: share.muscleGroup,
      role: share.role,
      xp: poolXp * (share.effectivePercent / 100),
    })),
    poolXp,
    shares,
    totalXp: poolXp,
  };
}

export function normalizeExerciseGripProfile(
  value: unknown,
): ExerciseGripProfileRecord {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    maxOpenFrames: Math.round(
      clamp(
        toNumber(
          record.maxOpenFrames,
          DEFAULT_EXERCISE_GRIP_PROFILE.maxOpenFrames,
        ),
        0,
        8,
      ),
    ),
    maxOpenRatio: clamp(
      toNumber(record.maxOpenRatio, DEFAULT_EXERCISE_GRIP_PROFILE.maxOpenRatio),
      0,
      1,
    ),
    minUsableFrames: Math.round(
      clamp(
        toNumber(
          record.minUsableFrames,
          DEFAULT_EXERCISE_GRIP_PROFILE.minUsableFrames,
        ),
        1,
        10,
      ),
    ),
    recentFrameLimit: Math.round(
      clamp(
        toNumber(
          record.recentFrameLimit,
          DEFAULT_EXERCISE_GRIP_PROFILE.recentFrameLimit,
        ),
        1,
        18,
      ),
    ),
    reliablePointMinVisibility: clamp(
      toNumber(
        record.reliablePointMinVisibility,
        DEFAULT_EXERCISE_GRIP_PROFILE.reliablePointMinVisibility,
      ),
      0,
      1,
    ),
    required: normalizeBoolean(
      record.required,
      DEFAULT_EXERCISE_GRIP_PROFILE.required,
    ),
  };
}

export function normalizeExerciseSubjectLockGestureProfile(
  value: unknown,
): ExerciseSubjectLockGestureProfileRecord {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const defaults = DEFAULT_EXERCISE_SUBJECT_LOCK_GESTURE_PROFILE;
  return {
    enabled: normalizeBoolean(record.enabled, defaults.enabled),
    gesture: "rock_sign",
    handAboveShoulderOffset: clamp(
      toNumber(
        record.handAboveShoulderOffset,
        defaults.handAboveShoulderOffset,
      ),
      0,
      0.2,
    ),
    handRaisedFromElbowOffset: clamp(
      toNumber(
        record.handRaisedFromElbowOffset,
        defaults.handRaisedFromElbowOffset,
      ),
      0,
      0.2,
    ),
    holdMs: Math.round(
      clamp(toNumber(record.holdMs, defaults.holdMs), 400, 6000),
    ),
    hornThumbLeadOffset: clamp(
      toNumber(record.hornThumbLeadOffset, defaults.hornThumbLeadOffset),
      0,
      0.2,
    ),
    maxHornLiftDelta: clamp(
      toNumber(record.maxHornLiftDelta, defaults.maxHornLiftDelta),
      0,
      0.2,
    ),
    minFingerDistance: clamp(
      toNumber(record.minFingerDistance, defaults.minFingerDistance),
      0,
      0.2,
    ),
    minFingerLift: clamp(
      toNumber(record.minFingerLift, defaults.minFingerLift),
      0,
      0.2,
    ),
    minFingerSpreadX: clamp(
      toNumber(record.minFingerSpreadX, defaults.minFingerSpreadX),
      0,
      0.2,
    ),
    minThumbOffset: clamp(
      toNumber(record.minThumbOffset, defaults.minThumbOffset),
      0,
      0.2,
    ),
    minThumbSeparation: clamp(
      toNumber(record.minThumbSeparation, defaults.minThumbSeparation),
      0,
      0.2,
    ),
  };
}

export function normalizeExerciseHandShapeProfile(
  value: unknown,
): ExerciseHandShapeProfileRecord {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const handPosePreview = normalizeExerciseHandPosePreview(
    record.handPosePreview ?? record.hand_pose_preview,
  );
  return {
    grip: normalizeExerciseGripProfile(record.grip),
    handPosePreview,
    schemaVersion: "exercise_hand_shape_v1",
    subjectLockGesture: normalizeExerciseSubjectLockGestureProfile(
      record.subjectLockGesture ?? record.subject_lock_gesture,
    ),
    warnings: normalizeWarnings(record.warnings),
  };
}

function normalizeExerciseHandPosePreview(
  value: unknown,
): ExerciseHandShapeProfileRecord["handPosePreview"] {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const allowedPresets = new Set([
    "open_palm",
    "closed_grip",
    "rock_sign",
    "neutral",
    "thumbs_up",
    "custom",
  ]);
  const rawPoints = Array.isArray(record.points) ? record.points : [];
  const points = rawPoints.slice(0, 21).map((point) => {
    const current =
      point && typeof point === "object"
        ? (point as Record<string, unknown>)
        : {};
    return {
      x: clamp(toNumber(current.x, 0.5), -0.25, 1.25),
      y: clamp(toNumber(current.y, 0.5), -0.25, 1.25),
    };
  });
  if (!points.length) return null;
  const preset =
    typeof record.preset === "string" && allowedPresets.has(record.preset)
      ? record.preset
      : "neutral";
  return {
    points,
    preset: preset as NonNullable<
      ExerciseHandShapeProfileRecord["handPosePreview"]
    >["preset"],
  };
}

export function createExerciseMovementProfile({
  movementContract,
  rig,
  warnings,
}: {
  movementContract?: PoseMovementContractRecord | null;
  rig?: ExerciseRigRecord | null;
  warnings?: string[];
}): ExerciseMovementProfileRecord {
  return {
    movementContract: movementContract ?? null,
    rig: rig ?? null,
    schemaVersion: "exercise_movement_profile_v1",
    warnings: warnings ?? [],
  };
}

const GENERATED_FULL_BODY_KEYPOINTS: ReadonlyArray<
  readonly [x: number, y: number, visibility?: number]
> = [
  [0.5, 0.09, 0.96],
  [0.47, 0.075, 0.86],
  [0.455, 0.075, 0.86],
  [0.435, 0.08, 0.82],
  [0.53, 0.075, 0.86],
  [0.545, 0.075, 0.86],
  [0.565, 0.08, 0.82],
  [0.415, 0.105, 0.84],
  [0.585, 0.105, 0.84],
  [0.47, 0.135, 0.86],
  [0.53, 0.135, 0.86],
  [0.38, 0.25],
  [0.62, 0.25],
  [0.3, 0.41],
  [0.7, 0.41],
  [0.27, 0.57],
  [0.73, 0.57],
  [0.245, 0.585, 0.86],
  [0.755, 0.585, 0.86],
  [0.255, 0.565, 0.88],
  [0.745, 0.565, 0.88],
  [0.285, 0.555, 0.88],
  [0.715, 0.555, 0.88],
  [0.43, 0.53],
  [0.57, 0.53],
  [0.42, 0.72],
  [0.58, 0.72],
  [0.41, 0.88],
  [0.59, 0.88],
  [0.405, 0.91, 0.9],
  [0.595, 0.91, 0.9],
  [0.455, 0.93, 0.92],
  [0.545, 0.93, 0.92],
];

type GeneratedRigSide = "left" | "right";

/** Rebuild editor-owned requirements after changing posture or safeguards.
 * Runtime normalization preserves explicit saved requirements; authoring must
 * remove requirements left over from a safeguard the user has just cleared.
 * normalizeExerciseMovementProfile adds any anchors required by the saved rig.
 */
export function refreshExerciseTrackingRequirements(
  contract: PoseMovementContractRecord,
): PoseMovementContractRecord {
  const next = {
    ...contract,
    trackingRequirements: {
      ...contract.trackingRequirements,
      minConfidence: contract.trackingRequirements?.minConfidence ?? 0.6,
      minReliableFrameLandmarks: contract.trackingRequirements?.minReliableFrameLandmarks ?? 1,
      requiredLandmarks: [],
    },
  };
  return normalizePoseMovementContract({
    ...next,
    trackingRequirements: {
      ...next.trackingRequirements,
      requiredLandmarks: getPoseMovementRequiredLandmarks(next),
    },
  })!;
}

/** Select the measured joint without replacing the user's drawn positions. */
export function setExerciseMovementJoint(
  profile: ExerciseMovementProfileRecord,
  dominantJoint: PoseMovementContractRecord["dominantJoint"],
  shoulderReference?: PoseMovementContractRecord["shoulderReference"],
): ExerciseMovementProfileRecord {
  const previous = profile.movementContract;
  const reference = dominantJoint === "shoulder" ? shoulderReference ?? "torso" : undefined;
  if (!previous || (previous.dominantJoint === dominantJoint &&
      (previous.shoulderReference ?? (dominantJoint === "shoulder" ? "torso" : undefined)) === reference)) return profile;
  const selected = refreshExerciseTrackingRequirements({
    ...previous,
    dominantJoint,
    shoulderReference: reference,
    oscillatingJoints: [dominantJoint],
    primaryJoints: [`left_${dominantJoint}`, `right_${dominantJoint}`],
    secondaryJoints: [],
  });
  const movementContract = getRigMovementContract(selected, profile.rig);
  const start = movementContract.repThresholds.up.angle;
  const goal = movementContract.repThresholds.down.angle;
  return {
    ...profile,
    movementContract,
    rig: profile.rig ? {
      ...profile.rig,
      angleSummary: {
        dominantJoint,
        minAngle: Math.min(start, goal),
        maxAngle: Math.max(start, goal),
        travel: Math.abs(goal - start),
        repCount: profile.rig.angleSummary?.repCount ?? 0,
      },
      keyframes: profile.rig.keyframes.map(frame => ({
        ...frame,
        angle: getPoseMovementContractAngle(movementContract, frame.keypoints) ?? frame.angle,
      })),
    } : null,
  };
}

export function setExerciseBodyOrientation(
  contract: PoseMovementContractRecord,
  bodyOrientation: PoseMovementContractRecord["bodyOrientation"],
): PoseMovementContractRecord {
  const spatialRequirements = { ...contract.spatialRequirements };
  // A previous explicit slope range must not override the newly chosen posture.
  delete spatialRequirements.torsoSlopeMinDeg;
  delete spatialRequirements.torsoSlopeMaxDeg;
  if (bodyOrientation === "any") delete spatialRequirements.bodyLineTolerance;
  return refreshExerciseTrackingRequirements({
    ...contract,
    bodyOrientation,
    spatialRequirements,
  });
}

export type ExerciseBodyCheckScope = "movement_joints" | "torso" | "full_body";

const BODY_CHECK_FIELDS = [
  "bodyLineTolerance", "bodyXDriftMax", "bodyYTravelMin",
  "shoulderYTravelMin", "hipYTravelMin", "shoulderHipTravelMin",
  "wristAnchorDriftMax", "torsoSlopeMinDeg", "torsoSlopeMaxDeg",
] as const;

export function getExerciseBodyCheckScope(
  contract: PoseMovementContractRecord,
): ExerciseBodyCheckScope {
  const spatial = contract.spatialRequirements;
  const hasBodyCheck = BODY_CHECK_FIELDS.some((field) => {
    const value = spatial?.[field];
    // Zero disables minimum travel, but is a strict limit for tilt or drift.
    return typeof value === "number" &&
      (!field.endsWith("TravelMin") || value > 0);
  });
  // Older definitions can explicitly require hips or feet even without a
  // posture rule. Do not describe those as joint-only until the user selects it.
  const withoutExtraLandmarks = {
    ...contract,
    trackingRequirements: contract.trackingRequirements
      ? { ...contract.trackingRequirements, requiredLandmarks: [] }
      : undefined,
  };
  const hasExtraLandmarks = getPoseRequiredLandmarkCount(contract) >
    getPoseRequiredLandmarkCount(withoutExtraLandmarks);
  return contract.bodyOrientation === "any" && !hasBodyCheck && !hasExtraLandmarks
    ? "movement_joints"
    : getPoseBodyLineScope(contract);
}

export function setExerciseBodyCheckScope(
  contract: PoseMovementContractRecord,
  scope: ExerciseBodyCheckScope,
): PoseMovementContractRecord {
  const spatialRequirements = { ...contract.spatialRequirements };
  if (scope === "movement_joints") {
    // Reuse the existing saved rules: remove optional posture/travel checks,
    // but preserve side synchronization, joint angles, confidence and timing.
    for (const field of BODY_CHECK_FIELDS) delete spatialRequirements[field];
    spatialRequirements.bodyLineScope = "torso";
    return refreshExerciseTrackingRequirements({
      ...contract,
      bodyOrientation: "any",
      secondaryCheck: "angle_side_rules",
      spatialRequirements,
    });
  }
  spatialRequirements.bodyLineScope = scope;
  // Re-enabling the check must require its body points even after joint-only
  // mode removed the previous tolerance. Use the editor's existing default.
  spatialRequirements.bodyLineTolerance ??= 28;
  return refreshExerciseTrackingRequirements({ ...contract, spatialRequirements });
}

/** Editor presets add movement safeguards; bodyOrientation owns the posture rule. */
export function getSpatialRequirementsForPreset(
  preset: "none" | "custom" | "ground_press" | "vertical_pull" | "lat_pulldown" | "squat_hinge",
  contract?: PoseMovementContractRecord | null,
): PoseSpatialRequirementsRecord | null {
  const minimal = contract?.repModel === "bilateral" || contract?.requiredSides === "both"
    ? {leftRightSymmetryTolerance:contract.spatialRequirements?.leftRightSymmetryTolerance ?? 45} : null;
  if (preset === "none") return minimal;
  if (preset === "custom") return contract?.spatialRequirements ?? minimal;
  const bodyLineScope = contract ? getPoseBodyLineScope(contract) : "full_body";
  if (preset === "ground_press") return {
    bodyLineScope, bodyLineTolerance:86, bodyXDriftMax:.22, bodyYTravelMin:.012,
    hipYTravelMin:.01, leftRightSymmetryTolerance:60, phaseSyncToleranceMs:650,
    shoulderHipTravelMin:.01, shoulderYTravelMin:.008, wristAnchorDriftMax:.18,
  };
  if (preset === "vertical_pull") return {
    bodyLineScope, bodyLineTolerance:45, bodyXDriftMax:.16, bodyYTravelMin:0,
    leftRightSymmetryTolerance:45, phaseSyncToleranceMs:700, shoulderYTravelMin:.012,
  };
  if (preset === "lat_pulldown") return {
    leftRightSymmetryTolerance: 35, phaseSyncToleranceMs: 650,
  };
  return {
    bodyLineScope, bodyLineTolerance:45, bodyXDriftMax:.1, bodyYTravelMin:.02,
    hipYTravelMin:.02, leftRightSymmetryTolerance:35, phaseSyncToleranceMs:450,
    shoulderHipTravelMin:.015,
  };
}

const GENERATED_DOMINANT_CHAINS: Record<
  PoseMovementContractRecord["dominantJoint"],
  Record<
    GeneratedRigSide,
    {
      descendants: number[];
      rotationDirection: -1 | 1;
      triple: readonly [number, number, number];
    }
  >
> = {
  ankle: {
    left: {
      descendants: [29, 31],
      rotationDirection: 1,
      triple: [25, 27, 31],
    },
    right: {
      descendants: [30, 32],
      rotationDirection: -1,
      triple: [26, 28, 32],
    },
  },
  elbow: {
    left: {
      descendants: [17, 19, 21],
      rotationDirection: 1,
      triple: [11, 13, 15],
    },
    right: {
      descendants: [18, 20, 22],
      rotationDirection: -1,
      triple: [12, 14, 16],
    },
  },
  hip: {
    left: {
      descendants: [27, 29, 31],
      rotationDirection: -1,
      triple: [11, 23, 25],
    },
    right: {
      descendants: [28, 30, 32],
      rotationDirection: 1,
      triple: [12, 24, 26],
    },
  },
  knee: {
    left: {
      descendants: [29, 31],
      rotationDirection: -1,
      triple: [23, 25, 27],
    },
    right: {
      descendants: [30, 32],
      rotationDirection: 1,
      triple: [24, 26, 28],
    },
  },
  shoulder: {
    left: {
      descendants: [15, 17, 19, 21],
      rotationDirection: 1,
      triple: [23, 11, 13],
    },
    right: {
      descendants: [16, 18, 20, 22],
      rotationDirection: -1,
      triple: [24, 12, 14],
    },
  },
};

function createFullBodyRigKeypoints(): PoseKeypointRecord[] {
  return GENERATED_FULL_BODY_KEYPOINTS.map(([x, y, visibility = 0.94]) => ({
    visibility,
    x,
    y,
    z: 0,
  }));
}

function rotateGeneratedDominantChain(
  keypoints: PoseKeypointRecord[],
  dominantJoint: PoseMovementContractRecord["dominantJoint"],
  angle: number,
  side: GeneratedRigSide,
  shoulderReference?: PoseMovementContractRecord["shoulderReference"],
) {
  const config = GENERATED_DOMINANT_CHAINS[dominantJoint][side];
  const [proximalIndex, jointIndex, distalIndex] = config.triple;
  const proximal = dominantJoint === "shoulder" && shoulderReference === "shoulder_line"
    ? getPoseShoulderLineReference(keypoints, side)
    : keypoints[proximalIndex];
  const joint = keypoints[jointIndex];
  const distal = keypoints[distalIndex];
  if (!proximal || !joint || !distal) return;

  if (dominantJoint === "knee") {
    // Bend the connected leg, keeping the hip/ankle line beneath the torso.
    // Rotating only the ankle creates a sideways leg that fails alignment.
    const shoulder = keypoints[side === "left" ? 11 : 12]!;
    const torsoLength = Math.hypot(proximal.x-shoulder.x,proximal.y-shoulder.y);
    if (torsoLength < 1e-6) return;
    const axis = {x:(proximal.x-shoulder.x)/torsoLength,y:(proximal.y-shoulder.y)/torsoLength};
    const length = (Math.hypot(joint.x-proximal.x,joint.y-proximal.y)+Math.hypot(distal.x-joint.x,distal.y-joint.y))/2;
    const halfAngle = clamp(angle,0,180)*Math.PI/360;
    const along = length*Math.sin(halfAngle), bend = length*Math.cos(halfAngle);
    const direction = side === "left" ? 1 : -1;
    keypoints[jointIndex] = {...joint,
      x:proximal.x+axis.x*along-axis.y*bend*direction,
      y:proximal.y+axis.y*along+axis.x*bend*direction,
    };
    const nextAnkle = {...distal,x:proximal.x+axis.x*along*2,y:proximal.y+axis.y*along*2};
    keypoints[distalIndex] = nextAnkle;
    for (const index of config.descendants) {
      const point = keypoints[index];
      if (point && index !== distalIndex) keypoints[index] = {...point,
        x:point.x+nextAnkle.x-distal.x,y:point.y+nextAnkle.y-distal.y};
    }
    return;
  }

  const proximalDirection = Math.atan2(
    proximal.y - joint.y,
    proximal.x - joint.x,
  );
  const targetDirection =
    proximalDirection +
    (dominantJoint === "elbow"
      ? Math.sign((proximal.x-joint.x)*(distal.y-joint.y) -
          (proximal.y-joint.y)*(distal.x-joint.x)) || config.rotationDirection
      : config.rotationDirection) *
      ((Math.max(0, Math.min(180, angle)) * Math.PI) / 180);
  const length = Math.max(
    0.075,
    Math.hypot(distal.x - joint.x, distal.y - joint.y),
  );
  const nextDistal = {
    ...distal,
    visibility: Math.max(distal.visibility, 0.92),
    x: joint.x + Math.cos(targetDirection) * length,
    y: joint.y + Math.sin(targetDirection) * length,
  };
  const rotation = targetDirection - Math.atan2(distal.y - joint.y, distal.x - joint.x);
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  keypoints[distalIndex] = nextDistal;
  config.descendants.forEach((index) => {
    if (index === distalIndex) return;
    const point = keypoints[index];
    if (!point) return;
    keypoints[index] = {
      ...point,
      visibility: Math.max(point.visibility, 0.82),
      // Move the connected limb as a unit. Translating the wrist when the
      // shoulder turns changes the elbow bend and can flip the forearm.
      x: joint.x + (point.x - joint.x) * cos - (point.y - joint.y) * sin,
      y: joint.y + (point.x - joint.x) * sin + (point.y - joint.y) * cos,
    };
  });
}

/** Redraw only the dominant chains while preserving all unrelated rig landmarks. */
export function applyGeneratedRigDominantAngle(
  keypoints: PoseKeypointRecord[],
  dominantJoint: PoseMovementContractRecord["dominantJoint"],
  angle: number,
  shoulderReference?: PoseMovementContractRecord["shoulderReference"],
): PoseKeypointRecord[] {
  const next = keypoints.map((point) => ({ ...point }));
  (["left", "right"] as const).forEach((side) =>
    rotateGeneratedDominantChain(next, dominantJoint, angle, side, shoulderReference),
  );
  return next;
}

function createGeneratedRigKeypoints(
  contract: PoseMovementContractRecord,
  angle: number,
): PoseKeypointRecord[] {
  const points = createFullBodyRigKeypoints();
  const progress = Math.max(0, Math.min(1, (angle - contract.repThresholds.up.angle) /
    (contract.repThresholds.down.angle - contract.repThresholds.up.angle || 1)));
  const verticalPull = contract.exercise === "pull_up";
  const row = contract.exercise === "seated_cable_row";
  for (const side of ["left", "right"] as const) {
    if (verticalPull || row) {
      rotateGeneratedDominantChain(points, "shoulder", verticalPull ? 170 - progress * 35 : 85 - progress * 50, side);
    }
  }
  const sides = contract.requiredSides;
  for (const side of ["left","right"] as const) {
    const inactive = (sides === "left" && side === "right") ||
      (sides === "right" && side === "left") ||
      ((sides === "alternating" || contract.repModel === "alternating") && side === "right");
    const sideAngle = inactive ? contract.repThresholds.up.angle : angle;
    if (contract.exercise === "bench_press" && contract.dominantJoint === "elbow") {
      // An upright limb diagram of a press: the upper arm moves too. Holding
      // it beside the torso and rotating only the forearm describes a curl.
      const offset = side === "left" ? 0 : 1;
      const shoulder = points[11+offset], elbow = points[13+offset], wrist = points[15+offset];
      const length = Math.hypot(elbow.x-shoulder.x,elbow.y-shoulder.y);
      const half = clamp(sideAngle,0,180)*Math.PI/360;
      const nextWrist = {...wrist,x:shoulder.x,y:shoulder.y-2*length*Math.sin(half)};
      points[13+offset] = {...elbow,
        x:shoulder.x+(side === "left" ? -1 : 1)*length*Math.cos(half),
        y:shoulder.y-length*Math.sin(half),
      };
      points[15+offset] = nextWrist;
      for (const index of [17,19,21]) points[index+offset] = {...points[index+offset],
        x:points[index+offset].x+nextWrist.x-wrist.x,
        y:points[index+offset].y+nextWrist.y-wrist.y,
      };
    } else {
      rotateGeneratedDominantChain(points,contract.dominantJoint,sideAngle,side,contract.shoulderReference);
    }
  }
  // The builder is an anatomical limb reference. Camera posture belongs to
  // Safeguards; changing that posture must never rotate or re-pose this rig.
  const result = points.map(point => ({...point,
    visibility:Math.max(point.visibility,contract.trackingRequirements?.minConfidence ?? .6),
  }));
  if (contract.dominantJoint === "shoulder") {
    for (const side of ["left", "right"] as const) {
      if (contract.exercise === "lat_pulldown" || contract.exercise === "pull_up") {
        // Hands stay above the elbows as the upper arms lower from overhead.
        // The shoulder angle is the measured movement; elbow flexion is the
        // connected reference pose, not a second hidden counting threshold.
        const offset = side === "left" ? 0 : 1;
        const shoulder = result[11 + offset]!, elbow = result[13 + offset]!, wrist = result[15 + offset]!;
        const direction = Math.atan2(shoulder.y - elbow.y, shoulder.x - elbow.x)
          + (side === "left" ? -1 : 1) * (165 - progress * 75) * Math.PI / 180;
        const length = Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y);
        const nextWrist = { ...wrist, x: elbow.x + Math.cos(direction) * length, y: elbow.y + Math.sin(direction) * length };
        result[15 + offset] = nextWrist;
        for (const index of [17, 19, 21]) result[index + offset] = { ...result[index + offset]!,
          x: result[index + offset]!.x + nextWrist.x - wrist.x,
          y: result[index + offset]!.y + nextWrist.y - wrist.y,
        };
      } else {
        rotateGeneratedDominantChain(result, "elbow", 165 - progress * 75, side);
      }
    }
  }
  return result;
}

function createGeneratedRigKeyframe(
  kind: ExerciseRigKeyframeKind,
  angle: number,
  capturedAtMs: number,
  keypoints: PoseKeypointRecord[],
): ExerciseRigKeyframeRecord {
  return {
    angle,
    capturedAtMs,
    confidence: 0.82,
    keypoints,
    kind,
    label:
      kind === "peak"
        ? "Peak contraction"
        : kind === "end"
          ? "Return"
          : "Start position",
  };
}

/** Create the editable starter rig used by the admin exercise contract editor. */
export function createGeneratedExerciseRigFromMovementContract({
  exerciseLabel,
  movementContract,
}: {
  exerciseLabel?: string | null;
  movementContract: PoseMovementContractRecord;
}): ExerciseRigRecord {
  const contract =
    normalizePoseMovementContract(movementContract, exerciseLabel) ??
    movementContract;
  const upAngle = contract.repThresholds.up.angle;
  const downAngle = contract.repThresholds.down.angle;
  const minAngle = Math.min(upAngle, downAngle);
  const maxAngle = Math.max(upAngle, downAngle);
  const label = (exerciseLabel ?? contract.exercise).trim() || null;
  const keyframes = [
    createGeneratedRigKeyframe("start",upAngle,0,createGeneratedRigKeypoints(contract,upAngle)),
    createGeneratedRigKeyframe("peak",downAngle,650,createGeneratedRigKeypoints(contract,downAngle)),
    createGeneratedRigKeyframe("end",upAngle,1300,createGeneratedRigKeypoints(contract,upAngle)),
  ];
  // One uniform transform for the whole sequence preserves measured angles and
  // keeps stationary landmarks stationary across phases.
  const points = keyframes.flatMap(frame => frame.keypoints);
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y)), maxY = Math.max(...points.map(point => point.y));
  const scale = .8/Math.max(maxX-minX,maxY-minY,.1);
  for (const frame of keyframes) frame.keypoints = frame.keypoints.map(point => ({...point,
    x:.5+(point.x-(minX+maxX)/2)*scale,
    y:.5+(point.y-(minY+maxY)/2)*scale,
  }));

  return {
    referenceVersion: 2,
    angleSummary: {
      dominantJoint: contract.dominantJoint,
      maxAngle,
      minAngle,
      repCount: 0,
      travel: maxAngle - minAngle,
    },
    capturedFromSession: null,
    exerciseLabel: label,
    keyframes,
    landmarkSchema: "mediapipe_pose_v1",
    repIndex: null,
    schemaVersion: "exercise_rig_v1",
    source: "generated_contract",
    warnings: [
      "Generated from the movement contract; verify joint positions before publishing.",
    ],
  };
}

/** Undo legacy whole-rig rotation once, preserving every authored limb angle. */
function orientRigForLimbEditing(rig: ExerciseRigRecord): ExerciseRigRecord {
  if (rig.referenceVersion === 2 || !Array.isArray(rig.keyframes) ||
      !rig.keyframes.every(frame => frame && Array.isArray(frame.keypoints) &&
        frame.keypoints.every(point => point && typeof point === "object"))) return rig;
  const start = rig.keyframes.find(frame => frame.kind === "start");
  const points = start?.keypoints;
  if (!points || ![11, 12, 23, 24].every(index => points[index] &&
    Number.isFinite(points[index]!.x) && Number.isFinite(points[index]!.y))) return rig;
  const dx = (points[23]!.x + points[24]!.x - points[11]!.x - points[12]!.x) / 2;
  const dy = (points[23]!.y + points[24]!.y - points[11]!.y - points[12]!.y) / 2;
  if (Math.hypot(dx, dy) < 1e-6) return rig;
  const rotation = Math.PI / 2 - Math.atan2(dy, dx);
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  return {
    ...rig,
    referenceVersion: 2,
    keyframes: rig.keyframes.map(frame => ({
      ...frame,
      keypoints: frame.keypoints.map(point => ({
        ...point,
        x: .5 + (point.x - .5) * cos - (point.y - .5) * sin,
        y: .5 + (point.x - .5) * sin + (point.y - .5) * cos,
      })),
    })),
  };
}

export function normalizeExerciseMovementProfile(
  value: unknown,
  fallback?: {
    movementContract?: PoseMovementContractRecord | null;
    rig?: ExerciseRigRecord | null;
  },
): ExerciseMovementProfileRecord | null {
  if (!value && !fallback?.movementContract && !fallback?.rig) return null;
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const movementContract = (record.movementContract ??
    record.movement_contract ??
    fallback?.movementContract ??
    null) as PoseMovementContractRecord | null;
  let normalizedContract = movementContract ? normalizePoseMovementContract(movementContract) : null;
  const savedRig = (record.rig ?? fallback?.rig ?? null) as ExerciseRigRecord | null;
  const rig = normalizedContract && validatePoseMovementContract(normalizedContract).valid && !savedRig
    ? createGeneratedExerciseRigFromMovementContract({ movementContract: normalizedContract })
    : savedRig ? orientRigForLimbEditing(savedRig) : null;
  if (normalizedContract?.trackingRequirements && getRigUpperArmReference(normalizedContract,rig)) {
    normalizedContract = normalizePoseMovementContract({...normalizedContract,
      trackingRequirements:{...normalizedContract.trackingRequirements,
        requiredLandmarks:[...new Set([...normalizedContract.trackingRequirements.requiredLandmarks,"left_shoulder","right_shoulder"])],
      },
    });
  }
  return createExerciseMovementProfile({
    movementContract: normalizedContract,
    rig,
    warnings: normalizeWarnings(record.warnings),
  });
}

export type ExerciseEditorValidationIssue = {
  code: string;
  message: string;
  path: string;
  suggestion: string;
};

const MOVEMENT_PROFILE_PATH = "movementProfile";
const MOVEMENT_CONTRACT_PATH = `${MOVEMENT_PROFILE_PATH}.movementContract`;
const MOVEMENT_RIG_PATH = `${MOVEMENT_PROFILE_PATH}.rig`;
const DOWN_ANGLE_PATH = `${MOVEMENT_CONTRACT_PATH}.repThresholds.down.angle`;
const DOWN_TOLERANCE_PATH =
  `${MOVEMENT_CONTRACT_PATH}.repThresholds.down.tolerance`;
const UP_ANGLE_PATH = `${MOVEMENT_CONTRACT_PATH}.repThresholds.up.angle`;
const UP_TOLERANCE_PATH =
  `${MOVEMENT_CONTRACT_PATH}.repThresholds.up.tolerance`;

const POSE_MOVEMENT_VALIDATION_MESSAGES: Record<string, string> = {
  movement_contract_missing:
    "Auto-track movement contracts need a movement contract.",
  movement_contract_incomplete:
    "Auto-track movement contracts need exercise, joints, thresholds, phases, and tracking requirements.",
  exercise_not_supported_for_auto_rep:
    "This exercise is not supported for auto tracking; keep it manual-only.",
  phase_order_unsupported:
    "The movement contract phase order is not supported.",
  phase_acceptance_bands_overlap:
    "The starting and goal ranges overlap. Move them farther apart or reduce the allowed differences.",
  phase_acceptance_bands_too_close:
    `The starting and goal ranges need at least ${POSE_REP_NOISE_FLOOR_DEGREES} degrees between them.`,
  exercise_identity_mismatch:
    "The movement contract exercise does not match the selected movement family.",
  primary_joints_dominant_joint_mismatch:
    "The movement contract primary joints must include its dominant joint.",
  primary_joints_invalid: "The movement contract primary joints are invalid.",
  secondary_joints_invalid:
    "The movement contract secondary joints are invalid.",
  required_landmarks_invalid:
    "The movement contract required landmarks are invalid.",
  body_orientation_invalid:
    "The movement contract body orientation is invalid.",
  body_line_scope_invalid:
    "Body alignment must use torso or full body.",
  dominant_joint_invalid: "The movement contract dominant joint is invalid.",
  shoulder_reference_invalid: "Choose a valid arm measurement reference.",
  rep_model_unsupported: "Choose a supported movement model before saving.",
  required_sides_unsupported:
    "Choose supported required sides before saving.",
  partial_rep_policy_unsupported:
    "Choose a supported partial-rep policy before saving.",
  count_at_unsupported: "Choose when a rep should count before saving.",
  unilateral_left_requires_left_side:
    "Left unilateral exercises must require the left or either side.",
  unilateral_right_requires_right_side:
    "Right unilateral exercises must require the right or either side.",
  alternating_requires_alternating_sides:
    "Alternating exercises must use alternating required sides.",
  bilateral_cannot_use_alternating_sides:
    "Bilateral exercises cannot use alternating required sides.",
  static_hold_does_not_support_count_half_reps:
    "Static holds cannot use half-rep counting.",
  rep_thresholds_missing: "Set both the starting angle and goal angle.",
  rep_tolerance_invalid: "Allowed differences must be valid numbers of 0 or more.",
  rep_angle_out_of_range:
    "Starting and goal angles must be between 0 and 180 degrees.",
  rep_tolerance_out_of_range:
    "Allowed differences must be between 0 and 45 degrees.",
  tracking_requirements_invalid:
    "Tracking requirements need a confidence threshold, landmark count, and landmark list.",
  spatial_requirement_out_of_range:
    "Spatial requirements must use supported non-negative values.",
  torso_slope_conflicts_with_orientation:
    "Torso slope minimum must not exceed the maximum or 90 degrees.",
  hold_duration_out_of_range:
    "Static holds need a duration target between 1 and 3600 seconds.",
};

function formatPoseMovementValidationError(error: string) {
  return (
    POSE_MOVEMENT_VALIDATION_MESSAGES[error] ??
    `Movement contract validation failed (${error}).`
  );
}

function formatIssueNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getRawRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getThresholdBandSuggestion(contract: PoseMovementContractRecord | null) {
  const down = contract?.repThresholds?.down;
  const up = contract?.repThresholds?.up;
  if (
    !contract ||
    !down ||
    !up ||
    !isFiniteNumber(down.angle) ||
    !isFiniteNumber(up.angle) ||
    !isFiniteNumber(down.tolerance) ||
    !isFiniteNumber(up.tolerance)
  ) {
    return "Enter valid numbers for both angles and their allowed differences first.";
  }

  const policy = getPoseRepAcceptancePolicy(contract);
  const gap =
    policy.direction === "increase"
      ? policy.targetBand.min - policy.startBand.max
      : policy.startBand.min - policy.targetBand.max;
  const desiredGap = POSE_REP_NOISE_FLOOR_DEGREES;
  const currentToleranceTotal = down.tolerance + up.tolerance;
  const maximumToleranceTotal = Math.max(
    0,
    Math.abs(down.angle - up.angle) - desiredGap,
  );
  const suggestions: string[] = [];

  if (policy.direction === "increase") {
    const minimumDownAngle = up.angle + up.tolerance + desiredGap + down.tolerance;
    const maximumUpAngle = down.angle - down.tolerance - desiredGap - up.tolerance;
    if (minimumDownAngle <= 180) {
      suggestions.push(`set Goal angle to ${formatIssueNumber(minimumDownAngle)}° or higher`);
    }
    if (maximumUpAngle >= 0) {
      suggestions.push(`set Starting angle to ${formatIssueNumber(maximumUpAngle)}° or lower`);
    }
  } else {
    const maximumDownAngle = up.angle - up.tolerance - desiredGap - down.tolerance;
    const minimumUpAngle = down.angle + down.tolerance + desiredGap + up.tolerance;
    if (maximumDownAngle >= 0) {
      suggestions.push(`set Goal angle to ${formatIssueNumber(maximumDownAngle)}° or lower`);
    }
    if (minimumUpAngle <= 180) {
      suggestions.push(`set Starting angle to ${formatIssueNumber(minimumUpAngle)}° or higher`);
    }
  }

  if (maximumToleranceTotal < currentToleranceTotal) {
    suggestions.push(
      `reduce the total allowed difference to ${formatIssueNumber(maximumToleranceTotal)}° or less`,
    );
  }

  const gapDescription = `${formatIssueNumber(gap)}° separates the ranges; at least ${desiredGap}° is needed`;
  return suggestions.length
    ? `${gapDescription}. You can ${suggestions.join("; or ")}.`
    : `${gapDescription}. Move the starting and goal angles farther apart or reduce the allowed differences.`;
}

function getSpatialIssuePaths(
  contract: PoseMovementContractRecord | null,
): string[] {
  const spatial = getRawRecord(contract?.spatialRequirements);
  const invalidEntry = spatial
    ? Object.entries(spatial).find(
        ([key, value]) => key !== "bodyLineScope" &&
          value !== undefined &&
          value !== null &&
          (!isFiniteNumber(value) || value < 0 || value > 5000),
      )
    : null;
  return [
    invalidEntry
      ? `${MOVEMENT_CONTRACT_PATH}.spatialRequirements.${invalidEntry[0]}`
      : `${MOVEMENT_CONTRACT_PATH}.spatialRequirements`,
  ];
}

function getMovementIssuePaths(
  error: string,
  contract: PoseMovementContractRecord | null,
  rawContract: Record<string, unknown> | null,
): string[] {
  switch (error) {
    case "movement_contract_missing":
    case "movement_contract_incomplete":
      return [MOVEMENT_CONTRACT_PATH];
    case "exercise_not_supported_for_auto_rep":
    case "exercise_identity_mismatch":
      return [`${MOVEMENT_CONTRACT_PATH}.exercise`];
    case "phase_order_unsupported":
      return [`${MOVEMENT_CONTRACT_PATH}.phaseOrder`];
    case "phase_acceptance_bands_overlap":
    case "phase_acceptance_bands_too_close":
      return [DOWN_ANGLE_PATH, UP_ANGLE_PATH];
    case "primary_joints_dominant_joint_mismatch":
    case "primary_joints_invalid":
      return [`${MOVEMENT_CONTRACT_PATH}.primaryJoints`];
    case "secondary_joints_invalid":
      return [`${MOVEMENT_CONTRACT_PATH}.secondaryJoints`];
    case "required_landmarks_invalid":
      return [`${MOVEMENT_CONTRACT_PATH}.trackingRequirements.requiredLandmarks`];
    case "body_orientation_invalid":
      return [`${MOVEMENT_CONTRACT_PATH}.bodyOrientation`];
    case "body_line_scope_invalid":
      return [`${MOVEMENT_CONTRACT_PATH}.spatialRequirements.bodyLineScope`];
    case "torso_slope_conflicts_with_orientation":
      return [`${MOVEMENT_CONTRACT_PATH}.spatialRequirements.torsoSlopeMinDeg`,
        `${MOVEMENT_CONTRACT_PATH}.spatialRequirements.torsoSlopeMaxDeg`];
    case "dominant_joint_invalid":
      return [`${MOVEMENT_CONTRACT_PATH}.dominantJoint`];
    case "shoulder_reference_invalid":
      return [`${MOVEMENT_CONTRACT_PATH}.shoulderReference`];
    case "rep_model_unsupported":
      return [`${MOVEMENT_CONTRACT_PATH}.repModel`];
    case "required_sides_unsupported":
    case "unilateral_left_requires_left_side":
    case "unilateral_right_requires_right_side":
    case "alternating_requires_alternating_sides":
    case "bilateral_cannot_use_alternating_sides":
      return [`${MOVEMENT_CONTRACT_PATH}.requiredSides`];
    case "partial_rep_policy_unsupported":
    case "static_hold_does_not_support_count_half_reps":
      return [`${MOVEMENT_CONTRACT_PATH}.partialRepPolicy`];
    case "count_at_unsupported":
      return [`${MOVEMENT_CONTRACT_PATH}.countAt`];
    case "rep_thresholds_missing": {
      const thresholds = getRawRecord(rawContract?.repThresholds);
      const paths: string[] = [];
      if (!getRawRecord(thresholds?.down)) paths.push(DOWN_ANGLE_PATH);
      if (!getRawRecord(thresholds?.up)) paths.push(UP_ANGLE_PATH);
      return paths.length ? paths : [DOWN_ANGLE_PATH, UP_ANGLE_PATH];
    }
    case "rep_tolerance_invalid":
      return [DOWN_TOLERANCE_PATH, UP_TOLERANCE_PATH];
    case "rep_angle_out_of_range": {
      const thresholds = contract?.repThresholds;
      const paths: string[] = [];
      if (!thresholds || !isFiniteNumber(thresholds.down.angle) || thresholds.down.angle < 0 || thresholds.down.angle > 180) {
        paths.push(DOWN_ANGLE_PATH);
      }
      if (!thresholds || !isFiniteNumber(thresholds.up.angle) || thresholds.up.angle < 0 || thresholds.up.angle > 180) {
        paths.push(UP_ANGLE_PATH);
      }
      return paths.length ? paths : [DOWN_ANGLE_PATH, UP_ANGLE_PATH];
    }
    case "rep_tolerance_out_of_range": {
      const thresholds = contract?.repThresholds;
      const paths: string[] = [];
      if (!thresholds || !isFiniteNumber(thresholds.down.tolerance) || thresholds.down.tolerance < 0 || thresholds.down.tolerance > 45) {
        paths.push(DOWN_TOLERANCE_PATH);
      }
      if (!thresholds || !isFiniteNumber(thresholds.up.tolerance) || thresholds.up.tolerance < 0 || thresholds.up.tolerance > 45) {
        paths.push(UP_TOLERANCE_PATH);
      }
      return paths.length ? paths : [DOWN_TOLERANCE_PATH, UP_TOLERANCE_PATH];
    }
    case "tracking_requirements_invalid":
      return [`${MOVEMENT_CONTRACT_PATH}.trackingRequirements`];
    case "spatial_requirement_out_of_range":
      return getSpatialIssuePaths(contract);
    case "hold_duration_out_of_range":
      return [`${MOVEMENT_CONTRACT_PATH}.holdDurationSeconds`];
    default:
      return [MOVEMENT_CONTRACT_PATH];
  }
}

function getMovementIssueSuggestion(
  error: string,
  path: string,
  contract: PoseMovementContractRecord | null,
) {
  switch (error) {
    case "phase_acceptance_bands_overlap":
    case "phase_acceptance_bands_too_close":
      return getThresholdBandSuggestion(contract);
    case "rep_angle_out_of_range":
      return "Enter a value from 0° through 180°.";
    case "rep_tolerance_out_of_range":
    case "rep_tolerance_invalid":
      return "Enter an allowed difference from 0° through 45°.";
    case "rep_thresholds_missing":
      return "Set both down and up angle targets before saving.";
    case "tracking_requirements_invalid":
      return "Set confidence, reliable landmark count, and at least one required landmark.";
    case "spatial_requirement_out_of_range":
      return `Enter a non-negative value for ${path.split(".").at(-1) ?? "this safeguard"}.`;
    case "hold_duration_out_of_range":
      return "Set a static hold duration from 1 through 3600 seconds.";
    case "phase_order_unsupported":
      return "Use a start, target, and return phase in that order.";
    case "exercise_not_supported_for_auto_rep":
      return "Choose a reviewed movement family or keep tracking manual-only.";
    case "exercise_identity_mismatch":
      return "Choose the selected movement family exercise or create an override.";
    case "primary_joints_dominant_joint_mismatch":
      return "Include the dominant joint in the primary joint list.";
    case "primary_joints_invalid":
    case "secondary_joints_invalid":
      return "Choose supported pose joints for this contract.";
    case "required_landmarks_invalid":
      return "Choose supported landmark groups used by the tracker.";
    case "body_orientation_invalid":
      return "Choose a supported body orientation.";
    case "body_line_scope_invalid":
      return "Choose torso alignment or full-body alignment.";
    case "torso_slope_conflicts_with_orientation":
      return "Keep minimum at or below maximum and within 0°–90°. These fields set the allowed camera torso angle: 0° is horizontal and 90° is upright.";
    case "dominant_joint_invalid":
      return "Choose a supported dominant joint.";
    case "shoulder_reference_invalid":
      return "Choose an upper-arm or shoulder measurement under Joint to measure.";
    case "rep_model_unsupported":
      return "Choose bilateral, unilateral, or alternating movement mode.";
    case "required_sides_unsupported":
      return "Choose both, left, right, either, or alternating sides.";
    case "unilateral_left_requires_left_side":
      return "Set required sides to left or either.";
    case "unilateral_right_requires_right_side":
      return "Set required sides to right or either.";
    case "alternating_requires_alternating_sides":
      return "Set required sides to alternating.";
    case "bilateral_cannot_use_alternating_sides":
      return "Set required sides to both, left, right, or either.";
    case "partial_rep_policy_unsupported":
      return "Choose a supported partial-rep policy.";
    case "count_at_unsupported":
      return "Choose Count at Peak or Count at Return in Counting rules.";
    case "static_hold_does_not_support_count_half_reps":
      return "Choose strict full rep or review only for a static hold.";
    case "movement_contract_missing":
      return "Create a movement contract in the Movement Builder before saving.";
    case "movement_contract_incomplete":
      return "Complete the movement type, thresholds, phases, and tracking requirements.";
    default:
      return "Review this movement setting before saving.";
  }
}

function getMovementValidationIssues(
  errors: string[],
  contract: PoseMovementContractRecord | null,
  rawContract: Record<string, unknown> | null,
): ExerciseEditorValidationIssue[] {
  return errors.flatMap((error) =>
    getMovementIssuePaths(error, contract, rawContract).map((path) => ({
      code: error,
      message: formatPoseMovementValidationError(error),
      path,
      suggestion: getMovementIssueSuggestion(error, path, contract),
    })),
  );
}

export function validateExerciseEditorContract(input: {
  handShapeProfile?: ExerciseHandShapeProfileRecord | null;
  muscleDefinitions?: Array<
    Pick<MuscleDefinitionRecord, "isActive" | "key">
  > | null;
  expectedMovementExercise?: string | null;
  movementProfile?: ExerciseMovementProfileRecord | null;
  muscleGroup?: string | null;
  muscleTargets?: ExerciseMuscleTargetRecord[] | null;
}) {
  const errors: string[] = [];
  const issues: ExerciseEditorValidationIssue[] = [];
  const addIssue = (
    code: string,
    message: string,
    path: string,
    suggestion: string,
  ) => {
    errors.push(message);
    issues.push({ code, message, path, suggestion });
  };
  const muscleTargets = normalizeExerciseMuscleTargets(
    input.muscleTargets ?? [],
    input.muscleGroup,
  );
  const primaryTargets = muscleTargets.filter(
    (target) => target.role === "primary",
  );
  const totalAllocation = muscleTargets.reduce(
    (sum, target) => sum + target.allocationPercent,
    0,
  );
  const activeMuscleKeys = new Set(
    getCanonicalMuscleDefinitions(input.muscleDefinitions)
      .filter((definition) => definition.isActive)
      .map((definition) => definition.key),
  );

  if (!muscleTargets.length) {
    addIssue(
      "muscle_targets_missing",
      "Add at least one muscle target.",
      "muscleTargets",
      "Add a primary or supporting muscle target before saving.",
    );
  }
  if (primaryTargets.length !== 1) {
    addIssue(
      "muscle_primary_invalid",
      "Choose exactly one primary muscle target.",
      "muscleTargets",
      "Mark exactly one target as Primary.",
    );
  }
  if (totalAllocation !== 100) {
    addIssue(
      "muscle_allocation_invalid",
      "Muscle Effort XP must total exactly 100%.",
      "muscleTargets",
      `Adjust the allocations until their total is exactly 100% (currently ${totalAllocation}%).`,
    );
  }
  const unknownMuscle = muscleTargets.find(
    (target) => !activeMuscleKeys.has(normalizeMuscleKey(target.muscleGroup)),
  );
  if (unknownMuscle) {
    const message =
      `Muscle target "${normalizeLabel(unknownMuscle.muscleGroup)}" is not in the active Muscle Library.`;
    addIssue(
      "muscle_target_unknown",
      message,
      "muscleTargets",
      "Choose an active muscle from the Muscle Library.",
    );
  }

  const grip = input.handShapeProfile?.grip;
  if (grip?.required && grip.minUsableFrames > grip.recentFrameLimit) {
    addIssue(
      "grip_frames_invalid",
      "Grip usable frames cannot exceed the recent frame window.",
      "handShapeProfile.grip.minUsableFrames",
      `Lower Min usable frames to ${grip.recentFrameLimit} or raise the recent frame window.`,
    );
  }

  const rig = input.movementProfile?.rig;
  const movementContract = input.movementProfile?.movementContract;
  if (!movementContract) {
    if (rig) {
      addIssue(
        "movement_contract_missing",
        "Movement rigs need a movement contract; keep unsupported exercises manual-only.",
        MOVEMENT_CONTRACT_PATH,
        "Create a movement contract before editing or saving this rig.",
      );
    }
  } else {
    const movementValidation = validatePoseMovementContract(
      movementContract,
      input.expectedMovementExercise ?? movementContract.exercise,
    );
    const rawContract = getRawRecord(movementContract);
    for (const error of movementValidation.errors) {
      const message = formatPoseMovementValidationError(error);
      const movementIssues = getMovementValidationIssues(
        [error],
        movementValidation.normalized ?? movementContract,
        rawContract,
      );
      if (movementIssues.length) {
        errors.push(message);
        issues.push(...movementIssues.map((issue) => ({ ...issue, message })));
      } else {
        addIssue(
          error,
          message,
          MOVEMENT_CONTRACT_PATH,
          getMovementIssueSuggestion(error, MOVEMENT_CONTRACT_PATH, movementContract),
        );
      }
    }
  }

  if (
    movementContract &&
    (!rig || !Array.isArray(rig.keyframes) || rig.keyframes.length < 3)
  ) {
    addIssue(
      "rig_keyframes_missing",
      "Auto-track movement rigs need distinct start, peak, and end keyframes.",
      `${MOVEMENT_RIG_PATH}.keyframes`,
      "Use the existing Reset rig to current targets action after the contract thresholds are valid.",
    );
  } else if (
    movementContract &&
    rig &&
    movementContract.repModel !== "static_hold"
  ) {
    const hasValidKeypointFrames = rig.keyframes.every(
      (frame) =>
        !!frame &&
        typeof frame === "object" &&
        Array.isArray(frame.keypoints) &&
        frame.keypoints.length >= 33,
    );
    if (!hasValidKeypointFrames) {
      addIssue(
        "rig_keypoints_incomplete",
        "Auto-track rig keyframes need complete 33-landmark frames.",
        `${MOVEMENT_RIG_PATH}.keyframes`,
        "Reset the rig from the current movement targets to restore all 33 landmarks.",
      );
    }
    const byKind = new Map(
      rig.keyframes
        .filter((frame) => !!frame && typeof frame === "object")
        .map((frame) => [frame.kind, frame]),
    );
    const start = byKind.get("start");
    const peak = byKind.get("peak");
    const end = byKind.get("end");
    const frameDistance = (left: typeof start, right: typeof start) => {
      if (
        !left ||
        !right ||
        !Array.isArray(left.keypoints) ||
        !Array.isArray(right.keypoints)
      ) {
        return 0;
      }
      return left.keypoints.reduce((distance, point, index) => {
        const other = right.keypoints[index];
        if (!other) return distance;
        return (
          distance +
          Math.abs(point.x - other.x) +
          Math.abs(point.y - other.y) +
          Math.abs(point.z - other.z)
        );
      }, 0);
    };
    if (!start || !peak || !end) {
      addIssue(
        "rig_keyframe_labels_invalid",
        "Auto-track rigs must label start, peak, and end frames.",
        `${MOVEMENT_RIG_PATH}.keyframes`,
        "Reset the rig from the current movement targets to restore start, peak, and end frames.",
      );
    } else {
      if (
        frameDistance(start, peak) < 0.01 ||
        frameDistance(peak, end) < 0.01
      ) {
        addIssue(
          "rig_keyframes_identical",
          "Auto-track rig keyframes must show distinct movement; identical frames are invalid.",
          `${MOVEMENT_RIG_PATH}.keyframes`,
          "Drag a dominant chain to create distinct phases, or reset the rig from the current movement targets.",
        );
      }
      if (
        typeof start.angle !== "number" ||
        typeof peak.angle !== "number" ||
        typeof end.angle !== "number" ||
        !Number.isFinite(start.angle) ||
        !Number.isFinite(peak.angle) ||
        !Number.isFinite(end.angle)
      ) {
        addIssue(
          "rig_angle_travel_invalid",
          "Auto-track rig keyframes need measurable start-to-peak-to-end angle travel.",
          `${MOVEMENT_RIG_PATH}.keyframes`,
          "Reset the rig from the current movement targets to restore its phase angles.",
        );
      }
      if (
        !Number.isFinite(start.capturedAtMs) ||
        !Number.isFinite(peak.capturedAtMs) ||
        !Number.isFinite(end.capturedAtMs) ||
        !(
          start.capturedAtMs < peak.capturedAtMs &&
          peak.capturedAtMs < end.capturedAtMs
        )
      ) {
        addIssue(
          "rig_keyframe_order_invalid",
          "Auto-track rig keyframes must be ordered start, peak, then end.",
          `${MOVEMENT_RIG_PATH}.keyframes`,
          "Reset the rig from the current movement targets to restore phase order.",
        );
      }
    }
  }

  if (movementContract && Array.isArray(rig?.keyframes) && validatePoseMovementContract(movementContract).valid) {
    const policy = getPoseRepAcceptancePolicy(movementContract);
    for (const frame of rig.keyframes) {
      if (!frame || !Array.isArray(frame.keypoints) || frame.keypoints.length < 33) continue;
      const assessment = getPoseMovementFrameAssessment(movementContract,frame.keypoints);
      const phase = frame.kind === "start" ? "Start" : frame.kind === "peak" ? "Peak" : "Return";
      if (!assessment.isReliable) {
        addIssue("rig_required_landmarks_missing",`${phase}: the rig fails the contract's landmark requirements.`,
          `${MOVEMENT_RIG_PATH}.keyframes`,
          `Restore ${assessment.lowConfidenceLandmarks.join(", ") || "the minimum reliable landmark count"}, or reset the rig to the current targets.`);
      }
      const angles = getPoseMovementContractSideAngles(movementContract,frame.keypoints);
      const peak = frame.kind === "peak";
      const accepts = (angle: number | null) => {
        if (angle === null) return false;
        if (movementContract.repModel === "static_hold") return angle >= Math.min(policy.startBand.min,policy.targetBand.min)-.01 && angle <= Math.max(policy.startBand.max,policy.targetBand.max)+.01;
        return peak ? (policy.direction === "decrease" ? angle <= policy.targetBand.max+.01 : angle >= policy.targetBand.min-.01)
          : (policy.direction === "decrease" ? angle >= policy.startBand.min-.01 : angle <= policy.startBand.max+.01);
      };
      const sides = movementContract.requiredSides;
      const accepted = sides === "both" ? accepts(angles.left) && accepts(angles.right)
        : sides === "left" ? accepts(angles.left) : sides === "right" ? accepts(angles.right)
          : accepts(angles.left) || accepts(angles.right);
      if (!accepted) addIssue("rig_endpoint_invalid",`${phase}: the measured rig angles do not reach the configured endpoint.`,
        `${MOVEMENT_RIG_PATH}.keyframes`,"Adjust the angle targets or reset the rig to those targets. Each required side must reach its endpoint.");
    }
  }

  return {
    errors,
    issues,
    valid: errors.length === 0,
    normalized: {
      handShapeProfile: normalizeExerciseHandShapeProfile(
        input.handShapeProfile,
      ),
      movementProfile: normalizeExerciseMovementProfile(input.movementProfile),
      muscleGroup: getPrimaryExerciseMuscleGroup(
        muscleTargets,
        input.muscleGroup ?? "",
      ),
      muscleTargets,
    },
  };
}

/** Shared authoring/API checks, excluding unrelated muscle-allocation fields. */
export function validateExerciseTrackingConfiguration(input: {
  movementProfile: ExerciseMovementProfileRecord | null;
  handShapeProfile?: ExerciseHandShapeProfileRecord | null;
  expectedMovementExercise?: string | null;
  requireRig?: boolean;
}) {
  const result = validateExerciseEditorContract(input);
  const issues = result.issues.filter(issue =>
    (issue.path.startsWith("movementProfile") || issue.path.startsWith("handShapeProfile")) &&
    (input.requireRig !== false || issue.code !== "rig_keyframes_missing"),
  );
  if (!input.movementProfile?.movementContract && !issues.some(issue => issue.code === "movement_contract_missing")) {
    issues.push({ code: "movement_contract_missing", path: MOVEMENT_CONTRACT_PATH,
      message: "Camera tracking needs a saved movement definition.",
      suggestion: "Configure the movement in Movement Builder, or choose Manual only." });
  }
  return { valid: issues.length === 0, issues, errors: issues.map(issue => issue.message) };
}
