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
} from "@fittrack/types";
import {
  isValidPoseMovementContract,
  normalizePoseMovementContract,
  toCanonicalPoseExerciseLabel,
} from "./pose";
import { CANONICAL_MUSCLE_DEFINITIONS } from "./fitness-catalog";

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
      rotationDirection: -1,
      triple: [23, 11, 13],
    },
    right: {
      descendants: [16, 18, 20, 22],
      rotationDirection: 1,
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
) {
  const config = GENERATED_DOMINANT_CHAINS[dominantJoint][side];
  const [proximalIndex, jointIndex, distalIndex] = config.triple;
  const proximal = keypoints[proximalIndex];
  const joint = keypoints[jointIndex];
  const distal = keypoints[distalIndex];
  if (!proximal || !joint || !distal) return;

  const proximalDirection = Math.atan2(
    proximal.y - joint.y,
    proximal.x - joint.x,
  );
  const targetDirection =
    proximalDirection +
    config.rotationDirection *
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
  const translation = {
    x: nextDistal.x - distal.x,
    y: nextDistal.y - distal.y,
  };
  keypoints[distalIndex] = nextDistal;
  config.descendants.forEach((index) => {
    if (index === distalIndex) return;
    const point = keypoints[index];
    if (!point) return;
    keypoints[index] = {
      ...point,
      visibility: Math.max(point.visibility, 0.82),
      x: point.x + translation.x,
      y: point.y + translation.y,
    };
  });
}

/** Redraw only the dominant chains while preserving all unrelated rig landmarks. */
export function applyGeneratedRigDominantAngle(
  keypoints: PoseKeypointRecord[],
  dominantJoint: PoseMovementContractRecord["dominantJoint"],
  angle: number,
): PoseKeypointRecord[] {
  const next = keypoints.map((point) => ({ ...point }));
  (["left", "right"] as const).forEach((side) =>
    rotateGeneratedDominantChain(next, dominantJoint, angle, side),
  );
  return next;
}

function createGeneratedRigKeypoints(
  dominantJoint: PoseMovementContractRecord["dominantJoint"],
  angle: number,
): PoseKeypointRecord[] {
  return applyGeneratedRigDominantAngle(
    createFullBodyRigKeypoints(),
    dominantJoint,
    angle,
  );
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

  return {
    angleSummary: {
      dominantJoint: contract.dominantJoint,
      maxAngle,
      minAngle,
      repCount: 0,
      travel: maxAngle - minAngle,
    },
    capturedFromSession: null,
    exerciseLabel: label,
    keyframes: [
      createGeneratedRigKeyframe(
        "start",
        upAngle,
        0,
        createGeneratedRigKeypoints(contract.dominantJoint, upAngle),
      ),
      createGeneratedRigKeyframe(
        "peak",
        downAngle,
        650,
        createGeneratedRigKeypoints(contract.dominantJoint, downAngle),
      ),
      createGeneratedRigKeyframe(
        "end",
        upAngle,
        1300,
        createGeneratedRigKeypoints(contract.dominantJoint, upAngle),
      ),
    ],
    landmarkSchema: "mediapipe_pose_v1",
    repIndex: null,
    schemaVersion: "exercise_rig_v1",
    source: "generated_contract",
    warnings: [
      "Generated from the movement contract; verify joint positions before publishing.",
    ],
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
  return createExerciseMovementProfile({
    movementContract: movementContract
      ? normalizePoseMovementContract(movementContract)
      : null,
    rig: (record.rig ?? fallback?.rig ?? null) as ExerciseRigRecord | null,
    warnings: normalizeWarnings(record.warnings),
  });
}

export function validateExerciseEditorContract(input: {
  handShapeProfile?: ExerciseHandShapeProfileRecord | null;
  muscleDefinitions?: Array<
    Pick<MuscleDefinitionRecord, "isActive" | "key">
  > | null;
  movementProfile?: ExerciseMovementProfileRecord | null;
  muscleGroup?: string | null;
  muscleTargets?: ExerciseMuscleTargetRecord[] | null;
}) {
  const errors: string[] = [];
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
    errors.push("Add at least one muscle target.");
  }
  if (primaryTargets.length !== 1) {
    errors.push("Choose exactly one primary muscle target.");
  }
  if (totalAllocation !== 100) {
    errors.push("Muscle Effort XP must total exactly 100%.");
  }
  const unknownMuscle = muscleTargets.find(
    (target) => !activeMuscleKeys.has(normalizeMuscleKey(target.muscleGroup)),
  );
  if (unknownMuscle) {
    errors.push(
      `Muscle target "${normalizeLabel(unknownMuscle.muscleGroup)}" is not in the active Muscle Library.`,
    );
  }

  const grip = input.handShapeProfile?.grip;
  if (grip?.required && grip.minUsableFrames > grip.recentFrameLimit) {
    errors.push("Grip usable frames cannot exceed the recent frame window.");
  }

  const rig = input.movementProfile?.rig;
  const movementContract = input.movementProfile?.movementContract;
  if (!movementContract) {
    if (rig) {
      errors.push(
        "Movement rigs need a movement contract; keep unsupported exercises manual-only.",
      );
    }
  } else {
    const contractRecord = movementContract as unknown as Record<
      string,
      unknown
    >;
    if (!isValidPoseMovementContract(movementContract)) {
      errors.push(
        "This movement contract does not match the reviewed pose runtime; keep the exercise manual-only.",
      );
    }
    if (!toCanonicalPoseExerciseLabel(movementContract.exercise)) {
      errors.push(
        "This exercise is not supported for auto tracking; keep it manual-only.",
      );
    }
    const thresholds = movementContract.repThresholds;
    const hasValidThreshold = (value: unknown) =>
      value &&
      typeof value === "object" &&
      typeof (value as { angle?: unknown }).angle === "number" &&
      Number.isFinite((value as { angle: number }).angle) &&
      typeof (value as { tolerance?: unknown }).tolerance === "number" &&
      Number.isFinite((value as { tolerance: number }).tolerance);
    if (
      typeof movementContract.exercise !== "string" ||
      !movementContract.exercise.trim() ||
      typeof movementContract.dominantJoint !== "string" ||
      typeof movementContract.secondaryCheck !== "string" ||
      !Array.isArray(movementContract.oscillatingJoints) ||
      !movementContract.oscillatingJoints.length ||
      !movementContract.oscillatingJoints.every(
        (joint) => typeof joint === "string" && joint.trim().length > 0,
      ) ||
      !hasValidThreshold(thresholds?.down) ||
      !hasValidThreshold(thresholds?.up)
    ) {
      errors.push(
        "Auto-track movement contracts need exercise, joints, secondary checks, and valid up/down thresholds.",
      );
    }
    if (
      contractRecord.contractVersion !== undefined &&
      typeof contractRecord.contractVersion !== "string"
    ) {
      errors.push("Movement contract version must be a string.");
    }
    if (
      contractRecord.bodyOrientation !== undefined &&
      !["upright", "horizontal", "inclined", "floor", "any"].includes(
        String(contractRecord.bodyOrientation),
      )
    ) {
      errors.push("Movement contract body orientation is not supported.");
    }
    const repModel = movementContract.repModel ?? "unknown";
    const requiredSides = movementContract.requiredSides ?? "either";
    const isStaticHold = repModel === "static_hold";
    if (
      ![
        "bilateral",
        "unilateral_left",
        "unilateral_right",
        "alternating",
        "static_hold",
        "unknown",
      ].includes(repModel)
    ) {
      errors.push("Choose a supported movement model before saving.");
    } else if (repModel === "unknown") {
      errors.push("Choose a movement model before saving.");
    }
    if (
      !["both", "left", "right", "either", "alternating"].includes(
        requiredSides,
      )
    ) {
      errors.push("Choose supported required sides before saving.");
    }
    if (repModel === "bilateral" && requiredSides !== "both") {
      errors.push("Bilateral exercises must require both sides.");
    }
    if (repModel === "alternating" && requiredSides !== "alternating") {
      errors.push("Alternating exercises must use alternating required sides.");
    }
    if (repModel === "unilateral_left" && requiredSides !== "left") {
      errors.push("Left unilateral exercises must require the left side.");
    }
    if (repModel === "unilateral_right" && requiredSides !== "right") {
      errors.push("Right unilateral exercises must require the right side.");
    }
    if (repModel === "bilateral") {
      const symmetryTolerance =
        movementContract.spatialRequirements?.leftRightSymmetryTolerance;
      if (
        typeof symmetryTolerance !== "number" ||
        !Number.isFinite(symmetryTolerance) ||
        symmetryTolerance <= 0
      ) {
        errors.push("Bilateral exercises need a symmetry tolerance.");
      }
    }
    if (
      !isStaticHold &&
      hasValidThreshold(thresholds?.down) &&
      hasValidThreshold(thresholds?.up)
    ) {
      const downAngle = movementContract.repThresholds.down.angle;
      const upAngle = movementContract.repThresholds.up.angle;
      const travel = Math.abs(upAngle - downAngle);
      if (travel < 10) {
        errors.push(
          "Dynamic rep thresholds need at least 10 degrees of travel.",
        );
      }
      if (
        movementContract.repThresholds.down.tolerance < 0 ||
        movementContract.repThresholds.up.tolerance < 0
      ) {
        errors.push("Rep threshold tolerances cannot be negative.");
      }
    }
    if (
      isStaticHold &&
      movementContract.partialRepPolicy === "count_half_reps"
    ) {
      errors.push("Static holds cannot use half-rep counting.");
    }
    if (
      isStaticHold &&
      (!Number.isFinite(movementContract.holdDurationSeconds) ||
        (movementContract.holdDurationSeconds ?? 0) <= 0)
    ) {
      errors.push("Static holds need a positive duration target in seconds.");
    }
    if (
      movementContract.trackingRequirements &&
      (!Number.isFinite(movementContract.trackingRequirements.minConfidence) ||
        movementContract.trackingRequirements.minConfidence < 0 ||
        movementContract.trackingRequirements.minConfidence > 1 ||
        !Number.isInteger(
          movementContract.trackingRequirements.minReliableFrameLandmarks,
        ) ||
        movementContract.trackingRequirements.minReliableFrameLandmarks < 1 ||
        !Array.isArray(
          movementContract.trackingRequirements.requiredLandmarks,
        ) ||
        !movementContract.trackingRequirements.requiredLandmarks.length ||
        !movementContract.trackingRequirements.requiredLandmarks.every(
          (landmark) =>
            typeof landmark === "string" && landmark.trim().length > 0,
        ))
    ) {
      errors.push(
        "Tracking requirements need a confidence threshold, landmark count, and landmark list.",
      );
    }
  }

  if (
    movementContract &&
    (!rig || !Array.isArray(rig.keyframes) || rig.keyframes.length < 3)
  ) {
    errors.push(
      "Auto-track movement rigs need distinct start, peak, and end keyframes.",
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
      errors.push("Auto-track rig keyframes need complete 33-landmark frames.");
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
      errors.push("Auto-track rigs must label start, peak, and end frames.");
    } else {
      if (
        frameDistance(start, peak) < 0.01 ||
        frameDistance(peak, end) < 0.01
      ) {
        errors.push(
          "Auto-track rig keyframes must show distinct movement; identical frames are invalid.",
        );
      }
      if (
        typeof start.angle !== "number" ||
        typeof peak.angle !== "number" ||
        typeof end.angle !== "number" ||
        Math.abs(start.angle - peak.angle) < 10 ||
        Math.abs(peak.angle - end.angle) < 10
      ) {
        errors.push(
          "Auto-track rig keyframes need measurable start-to-peak-to-end angle travel.",
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
        errors.push(
          "Auto-track rig keyframes must be ordered start, peak, then end.",
        );
      }
    }
  }

  if (
    movementContract &&
    rig &&
    Array.isArray(rig.keyframes) &&
    movementContract.repModel === "bilateral"
  ) {
    const landmarkIndexes: Record<string, number[]> = {
      shoulders: [11, 12],
      elbows: [13, 14],
      wrists: [15, 16],
      hips: [23, 24],
      knees: [25, 26],
      ankles: [27, 28],
    };
    const requiredIndexes = [
      ...new Set(
        (
          movementContract.trackingRequirements?.requiredLandmarks ?? []
        ).flatMap((landmark) => landmarkIndexes[landmark] ?? []),
      ),
    ];
    const hasBothSideFrames = rig.keyframes.every(
      (frame) =>
        Array.isArray(frame.keypoints) &&
        requiredIndexes.every(
          (index) => (frame.keypoints[index]?.visibility ?? 0) > 0.1,
        ),
    );
    if (!hasBothSideFrames) {
      errors.push(
        "The movement angle preview must show every landmark required by this tracking contract.",
      );
    }
  }

  return {
    errors,
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
