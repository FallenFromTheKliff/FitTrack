import type {
  ExerciseMuscleTargetRecord,
  PoseBodyOrientation,
  PoseJointName,
  PoseRepModel,
  PoseRequiredSides,
} from "@fittrack/types";
import { normalizeExerciseAlias } from "./exercise-movement-contract";

/**
 * Fixed reference data shared by the seeders, exercise editor, and pose
 * consumers.  Keep these records provider/domain neutral: Prisma adapters
 * should map the string enum values at the boundary.
 */

export type CanonicalMuscleDefinition = {
  aliases: readonly string[];
  bodyRegion: string;
  key: string;
  name: string;
  sortOrder: number;
};

export const CANONICAL_MUSCLE_DEFINITIONS = [
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
  {
    aliases: ["conditioning"],
    bodyRegion: "conditioning",
    key: "cardio",
    name: "Cardio",
    sortOrder: 70,
  },
  {
    aliases: ["recovery"],
    bodyRegion: "recovery",
    key: "mobility",
    name: "Mobility",
    sortOrder: 71,
  },
] as const satisfies readonly CanonicalMuscleDefinition[];

export type CanonicalExerciseCategory =
  | "strength"
  | "cardio"
  | "flexibility"
  | "balance";

export type CanonicalExerciseDefinition = {
  category: CanonicalExerciseCategory;
  description: string;
  key: string;
  muscleGroup: string;
  name: string;
};

export const CANONICAL_EXERCISE_CATALOG = [
  {
    key: "squat",
    category: "strength",
    description:
      "Compound lower-body lift for quads, glutes, and trunk control.",
    muscleGroup: "quads",
    name: "Barbell Back Squat",
  },
  {
    key: "bench",
    category: "strength",
    description: "Horizontal press pattern for chest, shoulders, and triceps.",
    muscleGroup: "chest",
    name: "Dumbbell Bench Press",
  },
  {
    key: "barbell-bench",
    category: "strength",
    description:
      "Classic horizontal barbell press for chest and triceps strength.",
    muscleGroup: "chest",
    name: "Barbell Bench Press",
  },
  {
    key: "incline-dumbbell-press",
    category: "strength",
    description: "Incline chest press emphasizing upper chest and front delts.",
    muscleGroup: "upper_chest",
    name: "Incline Dumbbell Press",
  },
  {
    key: "cable-fly",
    category: "strength",
    description: "Cable chest isolation movement with constant tension.",
    muscleGroup: "chest",
    name: "Cable Fly",
  },
  {
    key: "shoulder-press",
    category: "strength",
    description:
      "Vertical press pattern for shoulders, triceps, and trunk stability.",
    muscleGroup: "shoulders",
    name: "Seated Dumbbell Shoulder Press",
  },
  {
    key: "lateral-raise",
    category: "strength",
    description: "Shoulder isolation movement for side-delt development.",
    muscleGroup: "side_delts",
    name: "Dumbbell Lateral Raise",
  },
  {
    key: "lat-pulldown",
    category: "strength",
    description: "Vertical pull pattern for lats and upper-back strength.",
    muscleGroup: "lats",
    name: "Lat Pulldown",
  },
  {
    key: "barbell-row",
    category: "strength",
    description: "Free-weight horizontal pull for back thickness and bracing.",
    muscleGroup: "upper_back",
    name: "Barbell Row",
  },
  {
    key: "leg-press",
    category: "strength",
    description: "Machine lower-body press for quad and glute volume.",
    muscleGroup: "quads",
    name: "Leg Press",
  },
  {
    key: "leg-extension",
    category: "strength",
    description: "Machine knee-extension isolation for quad hypertrophy.",
    muscleGroup: "quads",
    name: "Leg Extension",
  },
  {
    key: "seated-leg-curl",
    category: "strength",
    description: "Machine hamstring curl for posterior-chain accessory work.",
    muscleGroup: "hamstrings",
    name: "Seated Leg Curl",
  },
  {
    key: "calf-raise",
    category: "strength",
    description: "Calf isolation movement for lower-leg strength and volume.",
    muscleGroup: "calves",
    name: "Standing Calf Raise",
  },
  {
    key: "biceps-curl",
    category: "strength",
    description: "Elbow-flexion accessory for biceps development.",
    muscleGroup: "biceps",
    name: "Dumbbell Biceps Curl",
  },
  {
    key: "hammer-curl",
    category: "strength",
    description: "Neutral-grip curl emphasizing brachialis and forearms.",
    muscleGroup: "biceps",
    name: "Hammer Curl",
  },
  {
    key: "triceps-pushdown",
    category: "strength",
    description: "Cable elbow-extension accessory for triceps volume.",
    muscleGroup: "triceps",
    name: "Cable Triceps Pushdown",
  },
  {
    key: "rope-face-pull",
    category: "strength",
    description: "Cable upper-back and rear-delt movement for shoulder health.",
    muscleGroup: "rear_delts",
    name: "Rope Face Pull",
  },
  {
    key: "hip-thrust",
    category: "strength",
    description:
      "Glute-dominant hip extension movement for lower-body strength.",
    muscleGroup: "glutes",
    name: "Barbell Hip Thrust",
  },
  {
    key: "split-squat",
    category: "strength",
    description: "Unilateral leg movement for quads, glutes, and balance.",
    muscleGroup: "quads",
    name: "Bulgarian Split Squat",
  },
  {
    key: "cable-crunch",
    category: "strength",
    description: "Loaded trunk-flexion accessory for abdominal strength.",
    muscleGroup: "core",
    name: "Cable Crunch",
  },
  {
    key: "deadlift",
    category: "strength",
    description: "Posterior-chain hinge pattern for strength blocks.",
    muscleGroup: "hamstrings",
    name: "Romanian Deadlift",
  },
  {
    key: "row",
    category: "strength",
    description: "Upper-body pull for lats and upper-back development.",
    muscleGroup: "lats",
    name: "Seated Cable Row",
  },
  {
    key: "push-up",
    category: "strength",
    description: "Bodyweight press with core stiffness and shoulder control.",
    muscleGroup: "chest",
    name: "Push Up",
  },
  {
    key: "dip",
    category: "strength",
    description: "Bodyweight press for triceps, chest, and shoulder control.",
    muscleGroup: "triceps",
    name: "Parallel Bar Dip",
  },
  {
    key: "pull-up",
    category: "strength",
    description: "Vertical bodyweight pull for lats and upper-back strength.",
    muscleGroup: "lats",
    name: "Pull Up",
  },
  {
    key: "run",
    category: "cardio",
    description: "Steady-state conditioning for aerobic base work.",
    muscleGroup: "cardio",
    name: "Treadmill Run",
  },
  {
    key: "plank",
    category: "balance",
    description: "Anti-extension core endurance and trunk control.",
    muscleGroup: "core",
    name: "Forearm Plank",
  },
  {
    key: "mobility-flow",
    category: "flexibility",
    description:
      "Recovery sequence for hips, shoulders, and thoracic rotation.",
    muscleGroup: "mobility",
    name: "Mobility Flow",
  },
] as const satisfies readonly CanonicalExerciseDefinition[];

export type CanonicalAmenityDefinition = {
  capacity: number;
  description: string;
  displayOrder: number;
  floorId: string;
  grid: readonly [number, number, number, number];
  hourlyRate: string;
  iconKey: string;
  isReservable?: boolean;
  key: string;
  minimumHours: number;
  name: string;
  requiresSubscription: boolean;
  status?: "available" | "maintenance";
  type: "basketball_court" | "boxing_ring" | "other";
};

/** Canonical facility references. Rates intentionally follow the realistic dynamic seed. */
export const CANONICAL_AMENITIES = [
  {
    key: "reception",
    capacity: 6,
    description: "Arrival, check-in, and member support desk.",
    displayOrder: 1,
    floorId: "floor-1",
    grid: [1, 1, 3, 2],
    hourlyRate: "0",
    iconKey: "reception",
    isReservable: false,
    minimumHours: 1,
    name: "Reception",
    requiresSubscription: false,
    type: "other",
  },
  {
    key: "general-floor",
    capacity: 20,
    description: "Shared open training area with mapped strength equipment.",
    displayOrder: 2,
    floorId: "floor-1",
    grid: [4, 1, 4, 4],
    hourlyRate: "0",
    iconKey: "gym-area",
    isReservable: false,
    minimumHours: 1,
    name: "General Floor",
    requiresSubscription: false,
    type: "other",
  },
  {
    key: "boxing-ring",
    capacity: 4,
    description:
      "Professional boxing ring for sparring, pad work, and coached conditioning blocks.",
    displayOrder: 1,
    floorId: "floor-2",
    grid: [3, 3, 5, 4],
    hourlyRate: "450",
    iconKey: "boxing",
    status: "maintenance",
    minimumHours: 1,
    name: "Boxing Ring",
    requiresSubscription: false,
    type: "boxing_ring",
  },
  {
    key: "basketball-court",
    capacity: 10,
    description:
      "Full-sized indoor basketball court for group training and weekend reservations.",
    displayOrder: 2,
    floorId: "floor-1",
    grid: [9, 1, 6, 4],
    hourlyRate: "900",
    iconKey: "basketball",
    minimumHours: 1,
    name: "Basketball Court",
    requiresSubscription: false,
    type: "basketball_court",
  },
  {
    key: "mobility-studio",
    capacity: 16,
    description:
      "Flexible studio for mobility, yoga, small-group training, and recovery classes.",
    displayOrder: 3,
    floorId: "floor-3",
    grid: [4, 2, 8, 6],
    hourlyRate: "650",
    iconKey: "yoga",
    minimumHours: 1,
    name: "Mobility Studio",
    requiresSubscription: true,
    type: "other",
  },
] as const satisfies readonly CanonicalAmenityDefinition[];

export type CanonicalPoseCapability = {
  aliases: readonly string[];
  contractExercise: string;
  exerciseKey: string;
  poseExercise: string;
  requiredBodyOrientation: PoseBodyOrientation;
  dominantJoint: PoseJointName;
  repModel: PoseRepModel;
  requiredSides: PoseRequiredSides;
};

/** Explicit, reviewed auto-rep allowlist. Do not derive this by catalog order or muscle. */
const ALL_CANONICAL_POSE_CAPABILITIES = [
  {
    aliases: ["squat", "back squat", "barbell squat", "barbell back squat"],
    exerciseKey: "squat",
    poseExercise: "squat",
    contractExercise: "squat",
    requiredBodyOrientation: "upright",
    dominantJoint: "knee",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: [
      "dumbbell bench press",
      "dumbbell bench",
      "bench dumbbell",
      "dumbbell_bench_press",
    ],
    exerciseKey: "bench",
    poseExercise: "dumbbell_bench_press",
    contractExercise: "dumbbell_bench_press",
    requiredBodyOrientation: "horizontal",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: [
      "bench press",
      "barbell bench",
      "barbell bench press",
      "bench_press",
      "barbell-bench",
      "barbell_bench",
    ],
    exerciseKey: "barbell-bench",
    poseExercise: "bench_press",
    contractExercise: "bench_press",
    requiredBodyOrientation: "horizontal",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: [
      "incline dumbbell press",
      "incline dumbbell",
      "incline press",
      "incline_dumbbell_press",
    ],
    exerciseKey: "incline-dumbbell-press",
    poseExercise: "incline_dumbbell_press",
    contractExercise: "incline_dumbbell_press",
    requiredBodyOrientation: "inclined",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["cable fly", "cable flyes", "cable_fly"],
    exerciseKey: "cable-fly",
    poseExercise: "cable_fly",
    contractExercise: "cable_fly",
    requiredBodyOrientation: "upright",
    dominantJoint: "shoulder",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: [
      "bicep curl",
      "biceps curl",
      "dumbbell curl",
      "dumbbell bicep curl",
      "dumbbell biceps curl",
      "curl",
      "bicep_curl",
    ],
    exerciseKey: "biceps-curl",
    poseExercise: "bicep_curl",
    contractExercise: "bicep_curl",
    requiredBodyOrientation: "upright",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: [
      "lateral raise",
      "dumbbell lateral raise",
      "side lateral raise",
      "lateral_raise",
    ],
    exerciseKey: "lateral-raise",
    poseExercise: "lateral_raise",
    contractExercise: "lateral_raise",
    requiredBodyOrientation: "upright",
    dominantJoint: "shoulder",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["lat pulldown", "lat pull down", "lat_pulldown"],
    exerciseKey: "lat-pulldown",
    poseExercise: "lat_pulldown",
    contractExercise: "lat_pulldown",
    requiredBodyOrientation: "upright",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["barbell row", "barbell_row"],
    exerciseKey: "barbell-row",
    poseExercise: "barbell_row",
    contractExercise: "barbell_row",
    requiredBodyOrientation: "inclined",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["leg press", "machine leg press", "leg_press"],
    exerciseKey: "leg-press",
    poseExercise: "leg_press",
    contractExercise: "leg_press",
    requiredBodyOrientation: "inclined",
    dominantJoint: "knee",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["leg extension", "leg extensions", "leg_extension"],
    exerciseKey: "leg-extension",
    poseExercise: "leg_extension",
    contractExercise: "leg_extension",
    requiredBodyOrientation: "upright",
    dominantJoint: "knee",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["seated leg curl", "leg curl", "seated_leg_curl"],
    exerciseKey: "seated-leg-curl",
    poseExercise: "seated_leg_curl",
    contractExercise: "seated_leg_curl",
    requiredBodyOrientation: "upright",
    dominantJoint: "knee",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: [
      "calf raise",
      "standing calf raise",
      "standing calf raises",
      "calf_raise",
    ],
    exerciseKey: "calf-raise",
    poseExercise: "calf_raise",
    contractExercise: "calf_raise",
    requiredBodyOrientation: "upright",
    dominantJoint: "ankle",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["dip", "tricep dip", "parallel bar dip"],
    exerciseKey: "dip",
    poseExercise: "dip",
    contractExercise: "dip",
    requiredBodyOrientation: "upright",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["hammer curl", "hammer curls", "hammer_curl"],
    exerciseKey: "hammer-curl",
    poseExercise: "hammer_curl",
    contractExercise: "hammer_curl",
    requiredBodyOrientation: "upright",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: [
      "triceps pushdown",
      "tricep pushdown",
      "cable triceps pushdown",
      "triceps_pushdown",
    ],
    exerciseKey: "triceps-pushdown",
    poseExercise: "triceps_pushdown",
    contractExercise: "triceps_pushdown",
    requiredBodyOrientation: "upright",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["rope face pull", "face pull", "rope_face_pull"],
    exerciseKey: "rope-face-pull",
    poseExercise: "rope_face_pull",
    contractExercise: "rope_face_pull",
    requiredBodyOrientation: "upright",
    dominantJoint: "shoulder",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["hip thrust", "barbell hip thrust", "hip_thrust"],
    exerciseKey: "hip-thrust",
    poseExercise: "hip_thrust",
    contractExercise: "hip_thrust",
    requiredBodyOrientation: "horizontal",
    dominantJoint: "hip",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: [
      "split squat",
      "bulgarian split squat",
      "bulgarian squat",
      "split_squat",
    ],
    exerciseKey: "split-squat",
    poseExercise: "split_squat",
    contractExercise: "split_squat",
    requiredBodyOrientation: "upright",
    dominantJoint: "knee",
    repModel: "alternating",
    requiredSides: "alternating",
  },
  {
    aliases: ["cable crunch", "cable crunches", "cable_crunch"],
    exerciseKey: "cable-crunch",
    poseExercise: "cable_crunch",
    contractExercise: "cable_crunch",
    requiredBodyOrientation: "upright",
    dominantJoint: "hip",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["romanian deadlift", "rdl", "deadlift", "romanian_deadlift"],
    exerciseKey: "deadlift",
    poseExercise: "romanian_deadlift",
    contractExercise: "romanian_deadlift",
    requiredBodyOrientation: "inclined",
    dominantJoint: "hip",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: [
      "seated cable row",
      "cable row",
      "seated row",
      "seated_cable_row",
    ],
    exerciseKey: "row",
    poseExercise: "seated_cable_row",
    contractExercise: "seated_cable_row",
    requiredBodyOrientation: "upright",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: ["plank", "forearm plank"],
    exerciseKey: "plank",
    poseExercise: "plank",
    contractExercise: "plank",
    requiredBodyOrientation: "horizontal",
    dominantJoint: "hip",
    repModel: "static_hold",
    requiredSides: "both",
  },
  {
    aliases: [
      "pull up",
      "pull-up",
      "pullup",
      "pull_up",
      "chin up",
      "chin-up",
      "chinup",
    ],
    exerciseKey: "pull-up",
    poseExercise: "pull_up",
    contractExercise: "pull_up",
    requiredBodyOrientation: "upright",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "either",
  },
  {
    aliases: ["push up", "push-up", "pushup", "push_up"],
    exerciseKey: "push-up",
    poseExercise: "push_up",
    contractExercise: "push_up",
    requiredBodyOrientation: "horizontal",
    dominantJoint: "elbow",
    repModel: "bilateral",
    requiredSides: "both",
  },
  {
    aliases: [
      "shoulder press",
      "shoulder_press",
      "dumbbell shoulder press",
      "seated dumbbell shoulder press",
    ],
    exerciseKey: "shoulder-press",
    poseExercise: "shoulder_press",
    contractExercise: "shoulder_press",
    requiredBodyOrientation: "upright",
    dominantJoint: "shoulder",
    repModel: "bilateral",
    requiredSides: "both",
  },
] as const satisfies readonly CanonicalPoseCapability[];

const REVIEWED_AUTO_REP_CONTRACTS = new Set([
  "squat",
  "bench_press",
  "bicep_curl",
  "dip",
  "plank",
  "pull_up",
  "push_up",
  "shoulder_press",
]);

export const CANONICAL_POSE_CAPABILITIES = ALL_CANONICAL_POSE_CAPABILITIES.filter(
  (capability) => REVIEWED_AUTO_REP_CONTRACTS.has(capability.contractExercise),
);

export const CANONICAL_POSE_EXERCISE_KEYS = [
  "squat",
  "barbell-bench",
  "biceps-curl",
  "dip",
  "plank",
  "pull-up",
  "push-up",
  "shoulder-press",
] as const;

export const CANONICAL_LEGACY_POSE_EXERCISE_KEYS: readonly string[] = [];

export function getCanonicalExercise(key: string) {
  return (
    CANONICAL_EXERCISE_CATALOG.find((exercise) => exercise.key === key) ?? null
  );
}

/**
 * Resolve a canonical reference without replacing a legitimate same-name row.
 * Deterministic IDs win when they already exist; otherwise an existing name
 * match is reused before a fresh canonical ID is created.
 */
export function resolveCanonicalReferenceId(
  desiredId: string,
  existingById?: { id: string } | null,
  existingByName?: { id: string } | null,
) {
  return existingById?.id ?? existingByName?.id ?? desiredId;
}

export function getCanonicalPoseCapability(exerciseKey: string) {
  return (
    CANONICAL_POSE_CAPABILITIES.find(
      (capability) => capability.exerciseKey === exerciseKey,
    ) ?? null
  );
}

export function getCanonicalPoseCapabilityByLabel(
  label: string | null | undefined,
) {
  if (!label) return null;
  const normalized = normalizeExerciseAlias(label);
  return (
    CANONICAL_POSE_CAPABILITIES.find((capability) =>
      capability.aliases.some(
        (alias) =>
          normalized ===
          normalizeExerciseAlias(alias),
      ),
    ) ?? null
  );
}

export function canonicalMuscleTargets(
  muscleGroup: string,
): ExerciseMuscleTargetRecord[] {
  return [{ allocationPercent: 100, muscleGroup, role: "primary" }];
}
