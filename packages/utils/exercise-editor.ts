import type {
  ExerciseGripProfileRecord,
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  ExerciseMuscleTargetRole,
  ExerciseRigRecord,
  MuscleDefinitionRecord,
  ExerciseSubjectLockGestureProfileRecord,
  PoseMovementContractRecord,
} from "@fittrack/types";

export const DEFAULT_MUSCLE_DEFINITIONS = [
  {
    aliases: ["pecs", "pectorals"],
    bodyRegion: "upper_body_push",
    key: "chest",
    name: "Chest",
    sortOrder: 10,
  },
  {
    aliases: ["upper chest"],
    bodyRegion: "upper_body_push",
    key: "upper_chest",
    name: "Upper Chest",
    sortOrder: 11,
  },
  {
    aliases: ["latissimus dorsi"],
    bodyRegion: "upper_body_pull",
    key: "lats",
    name: "Lats",
    sortOrder: 20,
  },
  {
    aliases: ["mid back", "rhomboids"],
    bodyRegion: "upper_body_pull",
    key: "upper_back",
    name: "Upper Back",
    sortOrder: 21,
  },
  {
    aliases: ["trapezius"],
    bodyRegion: "upper_body_pull",
    key: "traps",
    name: "Traps",
    sortOrder: 22,
  },
  {
    aliases: ["delts", "deltoids"],
    bodyRegion: "shoulders",
    key: "shoulders",
    name: "Shoulders",
    sortOrder: 30,
  },
  {
    aliases: ["anterior delts"],
    bodyRegion: "shoulders",
    key: "front_delts",
    name: "Front Delts",
    sortOrder: 31,
  },
  {
    aliases: ["lateral delts"],
    bodyRegion: "shoulders",
    key: "side_delts",
    name: "Side Delts",
    sortOrder: 32,
  },
  {
    aliases: ["posterior delts"],
    bodyRegion: "shoulders",
    key: "rear_delts",
    name: "Rear Delts",
    sortOrder: 33,
  },
  {
    aliases: ["bis"],
    bodyRegion: "arms",
    key: "biceps",
    name: "Biceps",
    sortOrder: 40,
  },
  {
    aliases: ["tris"],
    bodyRegion: "arms",
    key: "triceps",
    name: "Triceps",
    sortOrder: 41,
  },
  {
    aliases: ["grip"],
    bodyRegion: "arms",
    key: "forearms",
    name: "Forearms",
    sortOrder: 42,
  },
  {
    aliases: ["abdominals"],
    bodyRegion: "core",
    key: "abs",
    name: "Abs",
    sortOrder: 50,
  },
  {
    aliases: ["side abs"],
    bodyRegion: "core",
    key: "obliques",
    name: "Obliques",
    sortOrder: 51,
  },
  {
    aliases: ["trunk"],
    bodyRegion: "core",
    key: "core",
    name: "Core",
    sortOrder: 52,
  },
  {
    aliases: ["spinal erectors", "erectors"],
    bodyRegion: "core",
    key: "lower_back",
    name: "Lower Back",
    sortOrder: 53,
  },
  {
    aliases: ["butt", "gluteals"],
    bodyRegion: "lower_body",
    key: "glutes",
    name: "Glutes",
    sortOrder: 60,
  },
  {
    aliases: ["quadriceps"],
    bodyRegion: "lower_body",
    key: "quads",
    name: "Quads",
    sortOrder: 61,
  },
  {
    aliases: ["hams"],
    bodyRegion: "lower_body",
    key: "hamstrings",
    name: "Hamstrings",
    sortOrder: 62,
  },
  {
    aliases: ["gastroc", "soleus"],
    bodyRegion: "lower_body",
    key: "calves",
    name: "Calves",
    sortOrder: 63,
  },
  {
    aliases: ["inner thighs"],
    bodyRegion: "lower_body",
    key: "adductors",
    name: "Adductors",
    sortOrder: 64,
  },
  {
    aliases: ["outer hips"],
    bodyRegion: "lower_body",
    key: "abductors",
    name: "Abductors",
    sortOrder: 65,
  },
  {
    aliases: ["iliopsoas"],
    bodyRegion: "lower_body",
    key: "hip_flexors",
    name: "Hip Flexors",
    sortOrder: 66,
  },
] as const;

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
  return normalizeMuscleKey(primary?.muscleGroup) || normalizeMuscleKey(fallback);
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
          clamp(toNumber(record.allocationPercent ?? record.allocation_percent, 0), 0, 100),
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
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    maxOpenFrames: Math.round(
      clamp(
        toNumber(record.maxOpenFrames, DEFAULT_EXERCISE_GRIP_PROFILE.maxOpenFrames),
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
        toNumber(record.minUsableFrames, DEFAULT_EXERCISE_GRIP_PROFILE.minUsableFrames),
        1,
        10,
      ),
    ),
    recentFrameLimit: Math.round(
      clamp(
        toNumber(record.recentFrameLimit, DEFAULT_EXERCISE_GRIP_PROFILE.recentFrameLimit),
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
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const defaults = DEFAULT_EXERCISE_SUBJECT_LOCK_GESTURE_PROFILE;
  return {
    enabled: normalizeBoolean(record.enabled, defaults.enabled),
    gesture: "rock_sign",
    handAboveShoulderOffset: clamp(
      toNumber(record.handAboveShoulderOffset, defaults.handAboveShoulderOffset),
      0,
      0.2,
    ),
    handRaisedFromElbowOffset: clamp(
      toNumber(record.handRaisedFromElbowOffset, defaults.handRaisedFromElbowOffset),
      0,
      0.2,
    ),
    holdMs: Math.round(clamp(toNumber(record.holdMs, defaults.holdMs), 400, 6000)),
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
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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
  const points = rawPoints
    .slice(0, 21)
    .map((point) => {
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

export function normalizeExerciseMovementProfile(
  value: unknown,
  fallback?: {
    movementContract?: PoseMovementContractRecord | null;
    rig?: ExerciseRigRecord | null;
  },
): ExerciseMovementProfileRecord | null {
  if (!value && !fallback?.movementContract && !fallback?.rig) return null;
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const movementContract = (record.movementContract ??
    record.movement_contract ??
    fallback?.movementContract ??
    null) as PoseMovementContractRecord | null;
  return createExerciseMovementProfile({
    movementContract: movementContract
      ? {
          ...movementContract,
          partialRepPolicy:
            movementContract.partialRepPolicy ?? "count_half_reps",
        }
      : null,
    rig: (record.rig ?? fallback?.rig ?? null) as ExerciseRigRecord | null,
    warnings: normalizeWarnings(record.warnings),
  });
}

export function validateExerciseEditorContract(input: {
  handShapeProfile?: ExerciseHandShapeProfileRecord | null;
  muscleDefinitions?: Array<Pick<MuscleDefinitionRecord, "isActive" | "key">> | null;
  movementProfile?: ExerciseMovementProfileRecord | null;
  muscleGroup?: string | null;
  muscleTargets?: ExerciseMuscleTargetRecord[] | null;
}) {
  const errors: string[] = [];
  const muscleTargets = normalizeExerciseMuscleTargets(
    input.muscleTargets ?? [],
    input.muscleGroup,
  );
  const primaryTargets = muscleTargets.filter((target) => target.role === "primary");
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
    errors.push("Add a movement contract before saving.");
  } else {
    const repModel = movementContract.repModel ?? "unknown";
    const requiredSides = movementContract.requiredSides ?? "either";
    const isStaticHold = repModel === "static_hold";
    if (repModel === "unknown") {
      errors.push("Choose a movement model before saving.");
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
    if (!isStaticHold) {
      const downAngle = movementContract.repThresholds.down.angle;
      const upAngle = movementContract.repThresholds.up.angle;
      const travel = Math.abs(upAngle - downAngle);
      if (travel < 10) {
        errors.push("Dynamic rep thresholds need at least 10 degrees of travel.");
      }
      if (
        movementContract.repThresholds.down.tolerance < 0 ||
        movementContract.repThresholds.up.tolerance < 0
      ) {
        errors.push("Rep threshold tolerances cannot be negative.");
      }
    }
    if (isStaticHold && movementContract.partialRepPolicy === "count_half_reps") {
      errors.push("Static holds cannot use half-rep counting.");
    }
  }

  if (!rig || rig.keyframes.length < 2) {
    errors.push("Movement rig needs at least start and peak keyframes.");
  } else if (movementContract?.repModel === "bilateral") {
    const requiredIndexes = [11, 12, 13, 14, 15, 16];
    const hasBothSideFrames = rig.keyframes.every((frame) =>
      requiredIndexes.every((index) => (frame.keypoints[index]?.visibility ?? 0) > 0.1),
    );
    if (!hasBothSideFrames) {
      errors.push("Bilateral rigs need visible left and right shoulder-elbow-wrist chains.");
    }
  }

  return {
    errors,
    normalized: {
      handShapeProfile: normalizeExerciseHandShapeProfile(input.handShapeProfile),
      movementProfile: normalizeExerciseMovementProfile(input.movementProfile),
      muscleGroup: getPrimaryExerciseMuscleGroup(
        muscleTargets,
        input.muscleGroup ?? "",
      ),
      muscleTargets,
    },
  };
}
