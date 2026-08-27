import { isDeepStrictEqual } from 'node:util';
import {
  AppointmentStatus,
  BookingStatus,
  ExerciseCategory,
  ExerciseAliasKind,
  ExerciseTrackingMode,
  FitnessGoal,
  IntegrityCaseStatus,
  IntegrityRiskLevel,
  MilestoneCategory,
  MilestoneDefinitionStatus,
  MilestoneEvidenceRequirement,
  MilestoneEvidenceSubmissionStatus,
  MilestoneEvidenceType,
  MilestoneProgressStatus,
  MilestoneTriggerType,
  MilestoneVerificationPolicy,
  ModerationActionType,
  PlanSource,
  PoseProfileKind,
  Prisma,
  ProgressionIconKind,
  ProgressionGrantStatus,
  ProgressionGrantType,
  ProgressionSourceStatus,
  ProgressionSourceType,
  RankingGovernanceStatus,
  RankingVisibility,
  SeasonStatus,
  SessionStatus,
} from '@prisma/client';
import { seedExternalId, seedId } from '../ids';
import { daysFrom } from '../time';
import type {
  DynamicSeedContext,
  MemberEngagement,
  SeedAccount,
} from '../types';
import {
  activityDateFor,
  isRecurringCoachingMember,
  memberAccessWindow,
  memberVolumeCount,
} from '../volumes';
import { createSeedRowsInBatches } from '../batch';
import {
  calculateWorkoutProgressionDelta,
  DEFAULT_MILESTONE_ICON_KEY,
  DEFAULT_MUSCLE_ICON_KEY,
  evaluateExpRank,
} from '../../../src/fitness/gamification/gamification.constants';
import {
  CANONICAL_EXERCISE_CATALOG,
  CANONICAL_LEGACY_POSE_EXERCISE_KEYS,
  CANONICAL_MUSCLE_DEFINITIONS,
  CANONICAL_POSE_EXERCISE_KEYS,
} from '../../../../../packages/utils/fitness-catalog';
import {
  buildFallbackPoseMovementContract,
  getPoseAutoRepCapability,
  isValidPoseMovementContract,
} from '../../../../../packages/utils/pose';
import {
  normalizeExerciseAlias,
  REVIEWED_AUTO_REP_FAMILIES,
} from '../../../../../packages/utils/exercise-movement-contract';
import { normalizeExerciseMovementProfile } from '../../../../../packages/utils/exercise-editor';

export const POSE_PROFILE_EXERCISE_KEYS = CANONICAL_POSE_EXERCISE_KEYS;

export const LEGACY_POSE_PROFILE_EXERCISE_KEYS =
  CANONICAL_LEGACY_POSE_EXERCISE_KEYS;

export function shouldRestoreMovementFamilyDefaults(
  mode: DynamicSeedContext['config']['mode'],
  _existingRevision: number | null,
) {
  return mode === 'reset';
}

export function shouldRepairReviewedMovementFamilyDefault(
  familyKey: string,
  value: unknown,
) {
  if (!REVIEWED_AUTO_REP_FAMILIES.some((key) => key === familyKey)) return false;
  if (value == null) return true;
  const current = normalizeExerciseMovementProfile(value);
  const canonicalContract = buildFallbackPoseMovementContract(familyKey);
  if (
    !current ||
    current.rig !== null ||
    current.warnings.length > 0 ||
    !canonicalContract
  ) {
    return false;
  }
  const retiredThresholds: Record<
    string,
    Array<{
      down: { angle: number; tolerance: number };
      up: { angle: number; tolerance: number };
    }>
  > = {
    bench_press: [{
      down: { angle: 100, tolerance: 12 },
      up: { angle: 155, tolerance: 12 },
    }],
    bicep_curl: [
      {
        down: { angle: 145, tolerance: 10 },
        up: { angle: 95, tolerance: 10 },
      },
      {
        down: { angle: 155, tolerance: 12 },
        up: { angle: 90, tolerance: 15 },
      },
    ],
    dip: [{
      down: { angle: 112, tolerance: 12 },
      up: { angle: 150, tolerance: 12 },
    }],
    pull_up: [
      {
        down: { angle: 145, tolerance: 10 },
        up: { angle: 100, tolerance: 10 },
      },
      {
        down: { angle: 155, tolerance: 12 },
        up: { angle: 90, tolerance: 15 },
      },
    ],
    push_up: [{
      down: { angle: 120, tolerance: 15 },
      up: { angle: 157, tolerance: 12 },
    }],
    seated_cable_row: [{
      down: { angle: 140, tolerance: 10 },
      up: { angle: 95, tolerance: 10 },
    }],
    shoulder_press: [
      {
        down: { angle: 105, tolerance: 12 },
        up: { angle: 150, tolerance: 12 },
      },
      {
        down: { angle: 90, tolerance: 15 },
        up: { angle: 150, tolerance: 12 },
      },
    ],
    squat: [{
      down: { angle: 105, tolerance: 12 },
      up: { angle: 155, tolerance: 12 },
    }],
  };
  const retired = retiredThresholds[familyKey];
  if (!retired) return false;
  return retired.some((repThresholds) =>
    isDeepStrictEqual(current.movementContract, {
      ...canonicalContract,
      repThresholds,
    }),
  );
}

export function hasCalibratedLegacyMovementContract(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  return (
    'movementContract' in value ||
    'movement_contract' in value ||
    ('repThresholds' in value && 'dominantJoint' in value)
  );
}

export function shouldLinkMovementFamilyMember(
  mode: DynamicSeedContext['config']['mode'],
  currentFamilyId: string | null,
  trackingMode: ExerciseTrackingMode = ExerciseTrackingMode.manual,
  movementProfile: unknown = null,
) {
  if (mode === 'reset') return true;
  if (currentFamilyId !== null) return false;
  return !(
    trackingMode === ExerciseTrackingMode.manual &&
    hasCalibratedLegacyMovementContract(movementProfile)
  );
}

export function filterPresentSeedHistoryMembers(
  memberKeys: readonly string[],
  userIdsByKey: Readonly<Record<string, string>>,
  presentUserIds: ReadonlySet<string>,
) {
  return memberKeys.flatMap((memberKey) => {
    const userId = userIdsByKey[memberKey];
    return userId && presentUserIds.has(userId) ? [{ memberKey, userId }] : [];
  });
}

export function getLegacySeedPoseProfileRetirementWhere() {
  return {
    id: {
      in: LEGACY_POSE_PROFILE_EXERCISE_KEYS.map((key) =>
        seedId(`pose-profile:${key}`),
      ),
    },
    profile_kind: PoseProfileKind.seed,
  };
}

const DYNAMIC_MILESTONES = [
  {
    key: 'dynamic-premium-first-block',
    category: MilestoneCategory.training,
    description: 'Complete a seeded premium training block.',
    iconKey: 'flame',
    metric: 'completed_workout_sessions',
    target: 1,
    title: 'Premium First Block',
    trigger: MilestoneTriggerType.summary_threshold,
  },
  {
    key: 'dynamic-booking-regular',
    category: MilestoneCategory.booking,
    description: 'Complete seeded amenity bookings without no-shows.',
    iconKey: 'target',
    metric: 'completed_venue_bookings',
    target: 3,
    title: 'Booking Regular',
    trigger: MilestoneTriggerType.summary_threshold,
  },
  {
    key: 'dynamic-coach-accountability',
    category: MilestoneCategory.coaching,
    description: 'Complete coaching sessions and keep feedback visible.',
    iconKey: 'medal',
    metric: 'completed_coach_appointments',
    target: 2,
    title: 'Coach Accountability',
    trigger: MilestoneTriggerType.source_event,
  },
  {
    key: 'dynamic-exp-achiever',
    category: MilestoneCategory.training,
    description: 'Reach the seeded lifetime EXP achievement threshold.',
    iconKey: DEFAULT_MILESTONE_ICON_KEY,
    metric: 'total_xp',
    target: 1_000,
    title: 'EXP Achiever',
    trigger: MilestoneTriggerType.summary_threshold,
  },
] as const;

async function seedExerciseBackbone(ctx: DynamicSeedContext) {
  for (const muscle of CANONICAL_MUSCLE_DEFINITIONS) {
    const { key, name, bodyRegion, aliases, sortOrder } = muscle;
    await ctx.prisma.muscleDefinition.upsert({
      where: { key },
      update: {
        aliases: [...aliases, key],
        body_region: bodyRegion,
        icon_asset_key: null,
        icon_key: DEFAULT_MUSCLE_ICON_KEY,
        icon_kind: ProgressionIconKind.library,
        is_active: true,
        is_system: true,
        name,
        sort_order: sortOrder,
      },
      create: {
        id: seedId(`muscle-definition:${key}`),
        aliases: [...aliases, key],
        body_region: bodyRegion,
        icon_asset_key: null,
        icon_key: DEFAULT_MUSCLE_ICON_KEY,
        icon_kind: ProgressionIconKind.library,
        is_active: true,
        is_system: true,
        key,
        name,
        sort_order: sortOrder,
      },
    });
  }

  for (const exercise of CANONICAL_EXERCISE_CATALOG) {
    const exerciseId = seedId(`exercise:${exercise.key}`);
    ctx.state.exerciseIds[exercise.key] = exerciseId;
    await ctx.prisma.exerciseCatalog.upsert({
      where: { id: exerciseId },
      update: {
        category: exercise.category as ExerciseCategory,
        description: exercise.description,
        hand_shape_profile: {
          grip: exercise.key === 'run' ? 'none' : 'neutral',
        },
        image_url: null,
        instructions:
          'Warm up, keep control through the full range, and stop if pain changes the movement.',
        is_active: true,
        // Additive seeding deliberately leaves movement_profile untouched.
        // Existing installations may still read it for migration compatibility.
        muscle_group: exercise.muscleGroup,
        muscle_targets: [exercise.muscleGroup],
        name: exercise.name,
        video_url: null,
      },
      create: {
        id: exerciseId,
        category: exercise.category as ExerciseCategory,
        description: exercise.description,
        hand_shape_profile: {
          grip: exercise.key === 'run' ? 'none' : 'neutral',
        },
        image_url: null,
        instructions:
          'Warm up, keep control through the full range, and stop if pain changes the movement.',
        is_active: true,
        movement_profile: {
          pattern:
            exercise.category === ExerciseCategory.cardio
              ? 'cyclic'
              : exercise.category === ExerciseCategory.flexibility
                ? 'flow'
                : 'strength_reps',
        },
        muscle_group: exercise.muscleGroup,
        muscle_targets: [exercise.muscleGroup],
        name: exercise.name,
        video_url: null,
      },
    });
  }

  const movementFamilies = [
    {
      id: '81000000-0000-4000-8000-000000000001',
      key: 'squat',
      displayName: 'Squat',
      canonicalExerciseKey: 'squat',
      memberKeys: ['squat'],
      aliases: ['Squat', 'Back Squat', 'Barbell Squat', 'Barbell Back Squat'],
    },
    {
      id: '81000000-0000-4000-8000-000000000002',
      key: 'bench_press',
      displayName: 'Bench Press',
      canonicalExerciseKey: 'barbell-bench',
      memberKeys: ['barbell-bench', 'bench'],
      aliases: ['Barbell Bench Press'],
    },
    {
      id: '81000000-0000-4000-8000-000000000003',
      key: 'bicep_curl',
      displayName: 'Bicep Curl',
      canonicalExerciseKey: 'biceps-curl',
      memberKeys: ['biceps-curl', 'hammer-curl'],
      aliases: [
        'Bicep Curl',
        'Biceps Curl',
        'Dumbbell Curl',
        'Dumbbell Bicep Curl',
        'Dumbbell Biceps Curl',
        'Curl',
        'bicep_curl',
      ],
    },
    {
      id: '81000000-0000-4000-8000-000000000004',
      key: 'dip',
      displayName: 'Dip',
      canonicalExerciseKey: 'dip',
      memberKeys: ['dip'],
      aliases: ['Parallel Bar Dip'],
    },
    {
      id: '81000000-0000-4000-8000-000000000005',
      key: 'plank',
      displayName: 'Plank',
      canonicalExerciseKey: 'plank',
      memberKeys: ['plank'],
      aliases: ['Forearm Plank'],
    },
    {
      id: '81000000-0000-4000-8000-000000000006',
      key: 'pull_up',
      displayName: 'Pull Up',
      canonicalExerciseKey: 'pull-up',
      memberKeys: ['pull-up'],
      aliases: ['Pull Up', 'Pull-Up', 'Pullup', 'pull_up'],
    },
    {
      id: '81000000-0000-4000-8000-000000000007',
      key: 'push_up',
      displayName: 'Push Up',
      canonicalExerciseKey: 'push-up',
      memberKeys: ['push-up'],
      aliases: ['Push Up', 'Push-Up', 'Pushup', 'push_up'],
    },
    {
      id: '81000000-0000-4000-8000-000000000008',
      key: 'shoulder_press',
      displayName: 'Shoulder Press',
      canonicalExerciseKey: 'shoulder-press',
      memberKeys: ['shoulder-press'],
      aliases: ['Seated Dumbbell Shoulder Press'],
    },
    {
      id: '81000000-0000-4000-8000-000000000009',
      key: 'seated_cable_row',
      displayName: 'Seated Cable Row',
      canonicalExerciseKey: 'row',
      memberKeys: ['row'],
      aliases: [
        'Seated Cable Row',
        'Cable Row',
        'Seated Row',
        'seated_cable_row',
      ],
    },
  ] as const;

  for (const family of movementFamilies) {
    const canonicalExerciseId =
      ctx.state.exerciseIds[family.canonicalExerciseKey];
    const contract = buildFallbackPoseMovementContract(family.key);
    if (
      !canonicalExerciseId ||
      !contract ||
      !isValidPoseMovementContract(contract)
    ) {
      throw new Error(
        `Missing reviewed movement family seed for "${family.key}".`,
      );
    }
    const baseMovementProfile = {
      movementContract: contract,
      rig: null,
      schemaVersion: 'exercise_movement_profile_v1',
      warnings: [],
    };
    const existing = await ctx.prisma.exerciseMovementFamily.findUnique({
      where: { key: family.key },
      select: { base_movement_profile: true, contract_revision: true },
    });
    const mayRestoreDefaults = shouldRestoreMovementFamilyDefaults(
      ctx.config.mode,
      existing?.contract_revision ?? null,
    );
    const mayRepairReviewedDefault =
      ctx.config.mode === 'additive' &&
      shouldRepairReviewedMovementFamilyDefault(
        family.key,
        existing?.base_movement_profile ?? null,
      );
    await ctx.prisma.exerciseMovementFamily.upsert({
      where: { key: family.key },
      create: {
        id: family.id,
        key: family.key,
        display_name: family.displayName,
        canonical_exercise_id: canonicalExerciseId,
        base_movement_profile: baseMovementProfile,
        base_hand_shape_profile: Prisma.JsonNull,
        contract_revision: 1,
        is_active: true,
      },
      update: {
        display_name: family.displayName,
        canonical_exercise_id: canonicalExerciseId,
        is_active: true,
        ...(mayRestoreDefaults || mayRepairReviewedDefault
          ? {
              base_movement_profile: baseMovementProfile,
              ...(ctx.config.mode === 'reset'
                ? { contract_revision: 1 }
                : mayRepairReviewedDefault
                  ? { contract_revision: { increment: 1 } }
                  : {}),
            }
          : {}),
      },
    });

    for (const memberKey of family.memberKeys) {
      const exerciseId = ctx.state.exerciseIds[memberKey];
      if (!exerciseId) continue;
      const current = await ctx.prisma.exerciseCatalog.findUnique({
        where: { id: exerciseId },
        select: {
          movement_family_id: true,
          movement_profile: true,
          tracking_mode: true,
        },
      });
      if (
        shouldLinkMovementFamilyMember(
          ctx.config.mode,
          current?.movement_family_id ?? null,
          current?.tracking_mode ?? ExerciseTrackingMode.manual,
          current?.movement_profile ?? null,
        )
      ) {
        await ctx.prisma.exerciseCatalog.update({
          where: { id: exerciseId },
          data: {
            movement_family_id: family.id,
            tracking_mode: ExerciseTrackingMode.inherit,
            movement_profile_override: Prisma.JsonNull,
          },
        });
      }
    }

    const aliasesByNormalized = new Map<string, string>(
      family.aliases.map((label): [string, string] => [
        normalizeExerciseAlias(label),
        label,
      ]),
    );
    for (const [normalizedLabel, label] of aliasesByNormalized) {
      const existingAlias = await ctx.prisma.exerciseAlias.findUnique({
        where: { normalized_label: normalizedLabel },
      });
      if (!existingAlias) {
        await ctx.prisma.exerciseAlias.create({
          data: {
            id: seedId(`exercise-alias:${normalizedLabel}`),
            exercise_id: canonicalExerciseId,
            kind: ExerciseAliasKind.synonym,
            label,
            normalized_label: normalizedLabel,
          },
        });
      } else if (ctx.config.mode === 'reset') {
        await ctx.prisma.exerciseAlias.update({
          where: { normalized_label: normalizedLabel },
          data: {
            exercise_id: canonicalExerciseId,
            label,
          },
        });
      }
    }
  }

  const poseProfileExercises = POSE_PROFILE_EXERCISE_KEYS.map((key) => {
    const exercise = CANONICAL_EXERCISE_CATALOG.find(
      (candidate) => candidate.key === key,
    );
    if (!exercise) {
      throw new Error(`Missing seeded pose exercise "${key}".`);
    }
    return exercise;
  });

  for (const exercise of poseProfileExercises) {
    const capability = getPoseAutoRepCapability(exercise.key);
    const contract = capability
      ? buildFallbackPoseMovementContract(capability.contractExercise)
      : null;
    if (!capability || !contract || !isValidPoseMovementContract(contract)) {
      throw new Error(
        `Missing compatible canonical pose movement contract for "${exercise.key}".`,
      );
    }
    const trackingRequirements = contract.trackingRequirements;
    const thresholdTolerance =
      (contract.repThresholds.down.tolerance +
        contract.repThresholds.up.tolerance) /
      2;
    const poseProfile = {
      id: seedId(`pose-profile:${exercise.key}`),
      angle_signature: {
        contract_version: contract.contractVersion,
        dominant_joint: contract.dominantJoint,
        down: contract.repThresholds.down,
        up: contract.repThresholds.up,
      },
      canonical_name: contract.exercise,
      confidence_threshold: new Prisma.Decimal(
        (trackingRequirements?.minConfidence ?? 0.6).toFixed(3),
      ),
      dominant_joint: contract.dominantJoint,
      exercise_id: ctx.state.exerciseIds[exercise.key],
      landmark_signature: {
        anchors: contract.primaryJoints ?? [],
        required_landmarks: trackingRequirements?.requiredLandmarks ?? [],
        source: 'dynamic-seed',
      },
      movement_pattern: {
        no_count_conditions: contract.noCountConditions ?? [],
        oscillating_landmarks: contract.oscillatingJoints,
        phase_order: contract.phaseOrder ?? [],
        rep_model: contract.repModel,
        tracked_joint: contract.primaryJoints ?? [contract.dominantJoint],
      },
      orientation_signature: {
        body_orientation: contract.bodyOrientation ?? 'any',
        contract_version: contract.contractVersion,
      },
      profile_kind: PoseProfileKind.seed,
      rep_rules: {
        count:
          contract.repModel === 'static_hold'
            ? 'static_hold'
            : 'phase_crossing',
        contract_version: contract.contractVersion,
        hold_duration_seconds: contract.holdDurationSeconds ?? null,
        minimum_visibility: trackingRequirements?.minConfidence ?? 0.6,
        primary_joints: contract.primaryJoints ?? [],
        required_sides: contract.requiredSides,
        phase_order: contract.phaseOrder ?? [],
        rep_model: contract.repModel,
        secondary_check: contract.secondaryCheck,
        secondary_joints: contract.secondaryJoints ?? [],
        spatial_requirements: contract.spatialRequirements ?? null,
        tracking_requirements: trackingRequirements ?? null,
      },
      rep_thresholds: {
        down: contract.repThresholds.down,
        up: contract.repThresholds.up,
      },
      sample_count: 15,
      tolerance: new Prisma.Decimal(thresholdTolerance.toFixed(2)),
      visibility_pattern: {
        min_visibility: trackingRequirements?.minConfidence ?? 0.6,
        min_reliable_frame_landmarks:
          trackingRequirements?.minReliableFrameLandmarks ?? 12,
        required_landmarks: trackingRequirements?.requiredLandmarks ?? [],
      },
    };

    const { id: poseProfileId, ...poseProfileUpdate } = poseProfile;
    await ctx.prisma.poseExerciseProfile.upsert({
      where: { id: poseProfileId },
      update: { ...poseProfileUpdate, is_active: true },
      create: poseProfile,
    });
  }

  // Keep this audit-preserving retirement hook for future invalid seed profiles.
  // The current canonical registry owns bench, deadlift, and row with explicit
  // contracts, so the legacy list is intentionally empty and this is a no-op.
  await ctx.prisma.poseExerciseProfile.updateMany({
    where: getLegacySeedPoseProfileRetirementWhere(),
    data: { is_active: false },
  });
}

type SeedPlanExerciseDescriptor = {
  dayOfWeek: number;
  durationSeconds: number | null;
  exerciseId: string;
  exerciseKey: string;
  planExerciseId: string;
  weekNumber: number;
  reps: number | null;
  scheduleDayId: string;
  sets: number;
  weightKg: number | null;
};

type SeedTrainingFocus =
  | 'conditioning'
  | 'full_body'
  | 'legs'
  | 'lower'
  | 'pull'
  | 'push'
  | 'recovery'
  | 'upper';

type SeedSplitTemplate = {
  daysPerWeek: number;
  durationWeeks: number;
  focusByDay: readonly SeedTrainingFocus[];
  key: string;
  title: string;
};

const SEED_SPLIT_TEMPLATES: readonly SeedSplitTemplate[] = [
  {
    daysPerWeek: 6,
    durationWeeks: 8,
    focusByDay: ['push', 'pull', 'legs', 'recovery', 'push', 'pull', 'legs'],
    key: 'ppl-rest',
    title: 'Push Pull Legs + Recovery',
  },
  {
    daysPerWeek: 4,
    durationWeeks: 8,
    focusByDay: [
      'upper',
      'lower',
      'recovery',
      'upper',
      'lower',
      'recovery',
      'recovery',
    ],
    key: 'upper-lower',
    title: 'Upper / Lower Strength Builder',
  },
  {
    daysPerWeek: 3,
    durationWeeks: 8,
    focusByDay: [
      'full_body',
      'recovery',
      'full_body',
      'recovery',
      'conditioning',
      'recovery',
      'recovery',
    ],
    key: 'full-body-conditioning',
    title: 'Full Body + Conditioning',
  },
];

const SEED_EXERCISES_BY_FOCUS: Record<
  Exclude<SeedTrainingFocus, 'recovery'>,
  readonly string[]
> = {
  push: [
    'barbell-bench',
    'incline-dumbbell-press',
    'shoulder-press',
    'cable-fly',
    'triceps-pushdown',
    'lateral-raise',
  ],
  pull: [
    'lat-pulldown',
    'barbell-row',
    'row',
    'rope-face-pull',
    'biceps-curl',
    'hammer-curl',
  ],
  legs: [
    'squat',
    'leg-press',
    'deadlift',
    'seated-leg-curl',
    'hip-thrust',
    'calf-raise',
  ],
  upper: [
    'barbell-bench',
    'lat-pulldown',
    'shoulder-press',
    'barbell-row',
    'biceps-curl',
    'triceps-pushdown',
  ],
  lower: [
    'squat',
    'leg-press',
    'deadlift',
    'seated-leg-curl',
    'hip-thrust',
    'calf-raise',
  ],
  full_body: [
    'squat',
    'barbell-bench',
    'lat-pulldown',
    'hip-thrust',
    'cable-crunch',
  ],
  conditioning: ['run', 'plank', 'mobility-flow'],
};

const BODYWEIGHT_OR_DURATION_EXERCISES = new Set([
  'dip',
  'mobility-flow',
  'plank',
  'pull-up',
  'push-up',
  'run',
]);

const COMPOUND_EXERCISES = new Set([
  'barbell-bench',
  'barbell-row',
  'deadlift',
  'hip-thrust',
  'lat-pulldown',
  'leg-press',
  'row',
  'shoulder-press',
  'squat',
]);

const EXTERNAL_WEIGHT_RATIOS: Record<string, number> = {
  'barbell-bench': 0.55,
  'barbell-row': 0.5,
  bench: 0.45,
  'biceps-curl': 0.2,
  'cable-crunch': 0.2,
  'cable-fly': 0.2,
  'calf-raise': 0.6,
  deadlift: 0.9,
  'hammer-curl': 0.22,
  'hip-thrust': 0.8,
  'incline-dumbbell-press': 0.38,
  'lateral-raise': 0.1,
  'lat-pulldown': 0.55,
  'leg-extension': 0.35,
  'leg-press': 1.2,
  'rope-face-pull': 0.18,
  row: 0.45,
  'seated-leg-curl': 0.4,
  'shoulder-press': 0.3,
  'split-squat': 0.3,
  squat: 0.85,
  'triceps-pushdown': 0.2,
};

function stableSeedFraction(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_296;
}

function memberEngagementFor(account: SeedAccount): MemberEngagement {
  return (
    account.memberEngagement ?? account.scenario?.memberEngagement ?? 'regular'
  );
}

function memberTrainingMultiplier(engagement: MemberEngagement) {
  switch (engagement) {
    case 'gym_rat':
      return 1.12;
    case 'frequent':
      return 1.04;
    case 'regular':
      return 0.94;
    case 'casual':
      return 0.82;
    case 'lazy':
      return 0.7;
    case 'zero_use':
      return 0.6;
  }
}

function roundSeedNumber(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clampSeedNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function exercisePrescriptionFor(
  account: SeedAccount,
  exerciseKey: string,
  weekNumber: number,
) {
  const engagement = memberEngagementFor(account);
  const experience = memberTrainingMultiplier(engagement);
  const progression = 1 + Math.min(0.16, Math.max(0, weekNumber - 1) * 0.02);
  const isDurationExercise =
    exerciseKey === 'run' || exerciseKey === 'mobility-flow';
  const isStaticHold = exerciseKey === 'plank';
  const isBodyweight = BODYWEIGHT_OR_DURATION_EXERCISES.has(exerciseKey);
  const canonicalExercise = CANONICAL_EXERCISE_CATALOG.find(
    (exercise) => exercise.key === exerciseKey,
  );
  if (!canonicalExercise) {
    throw new Error(
      `Missing canonical exercise prescription for "${exerciseKey}".`,
    );
  }

  if (isDurationExercise || isStaticHold) {
    return {
      durationSeconds:
        exerciseKey === 'run'
          ? 600 + Math.min(360, (weekNumber - 1) * 30)
          : exerciseKey === 'mobility-flow'
            ? 480 + Math.min(240, (weekNumber - 1) * 20)
            : 30 + Math.min(30, (weekNumber - 1) * 3),
      reps: null,
      restSeconds: exerciseKey === 'run' ? 90 : 30,
      sets: exerciseKey === 'run' ? 1 : 3,
      weightKg: null,
    };
  }

  const baselineWeightKg = clampSeedNumber(
    account.physicalBaseline?.weightKg ?? account.weightKg ?? 70,
    45,
    140,
  );
  const ratio = EXTERNAL_WEIGHT_RATIOS[exerciseKey] ?? 0.25;
  const jitter =
    stableSeedFraction(`${account.key}:${exerciseKey}`) * 0.12 - 0.06;
  const weightKg = isBodyweight
    ? null
    : roundSeedNumber(
        clampSeedNumber(
          baselineWeightKg * ratio * experience * progression * (1 + jitter),
          COMPOUND_EXERCISES.has(exerciseKey) ? 10 : 2.5,
          180,
        ),
        1,
      );
  const compound = COMPOUND_EXERCISES.has(exerciseKey);
  const reps = clampSeedNumber(
    (compound ? 6 : 8) +
      (engagement === 'gym_rat' || engagement === 'frequent' ? 1 : 0) +
      Math.floor((weekNumber - 1) / 3),
    compound ? 5 : 8,
    compound ? 12 : 16,
  );
  return {
    durationSeconds: null,
    reps,
    restSeconds: compound ? 105 : 75,
    sets: compound ? 4 : 3,
    weightKg,
  };
}

function exerciseKeysForFocus(focus: SeedTrainingFocus) {
  return focus === 'recovery' ? [] : SEED_EXERCISES_BY_FOCUS[focus].slice(0, 3);
}

function requiredExerciseLogCount(
  exercises: readonly Pick<SeedPlanExerciseDescriptor, 'sets'>[],
) {
  return exercises.reduce((total, exercise) => total + exercise.sets, 0);
}

export function getRepresentativeLifetimeXp(
  account: Pick<SeedAccount, 'role'>,
  memberIndex: number,
) {
  if (account.role !== 'member') {
    return 0;
  }

  const tier = Math.max(0, memberIndex) % 7;
  return 600 + tier * 1_600;
}

export function getRepresentativeMuscleXp(
  memberIndex: number,
  muscleIndex: number,
) {
  const tier = Math.max(0, memberIndex + muscleIndex) % 7;
  return 600 + tier * 1_500 + muscleIndex * 100;
}

export function getSeedRankingVisibility(
  account: Pick<SeedAccount, 'memberPersona'>,
) {
  if (account.memberPersona === 'archived') {
    return RankingVisibility.private;
  }

  if (
    account.memberPersona === 'frozen' ||
    account.memberPersona === 'pending'
  ) {
    return RankingVisibility.anonymous;
  }

  return RankingVisibility.public;
}

async function seedTrainingAndWorkouts(ctx: DynamicSeedContext) {
  const memberKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
  ];
  const accountByKey = new Map(
    ctx.state.accounts.map((account) => [account.key, account]),
  );
  const coachKeys = ctx.state.coachAccountKeys;
  const [coachingPlans, coachProfiles, coachingAppointments] =
    await Promise.all([
      ctx.prisma.recurringCoachingPlan.findMany({
        select: { coach_id: true, member_id: true },
      }),
      ctx.prisma.coachProfile.findMany({
        select: { id: true, user_id: true },
      }),
      ctx.prisma.coachAppointment.findMany({
        select: {
          completed_at: true,
          id: true,
          recurring_plan_id: true,
          scheduled_at: true,
          status: true,
          user_id: true,
        },
      }),
    ]);
  const coachUserIdByProfileId = new Map(
    coachProfiles.map((profile) => [profile.id, profile.user_id]),
  );
  const coachingCoachByMemberId = new Map(
    coachingPlans.map((plan) => [
      plan.member_id,
      coachUserIdByProfileId.get(plan.coach_id),
    ]),
  );
  const completedRecurringAppointmentsByMember = new Map<
    string,
    Array<{
      completed_at: Date | null;
      id: string;
      scheduled_at: Date;
    }>
  >();
  for (const appointment of coachingAppointments) {
    if (
      appointment.recurring_plan_id === null ||
      appointment.status !== AppointmentStatus.completed
    ) {
      continue;
    }
    const rows =
      completedRecurringAppointmentsByMember.get(appointment.user_id) ?? [];
    rows.push({
      completed_at: appointment.completed_at,
      id: appointment.id,
      scheduled_at: appointment.scheduled_at,
    });
    completedRecurringAppointmentsByMember.set(appointment.user_id, rows);
  }
  const coachedMemberKeys = new Set(
    memberKeys.filter((memberKey) => isRecurringCoachingMember(ctx, memberKey)),
  );
  const scheduleRows: Prisma.TrainingScheduleDayCreateManyInput[] = [];
  const trainingPlanRows: Prisma.TrainingPlanCreateManyInput[] = [];
  const planExerciseRows: Prisma.PlanExerciseCreateManyInput[] = [];
  const sessionRows: Prisma.WorkoutSessionCreateManyInput[] = [];
  const exerciseLogRows: Prisma.ExerciseLogCreateManyInput[] = [];
  const poseRows: Prisma.PoseSessionCreateManyInput[] = [];
  const activePlanExercisesByMember = new Map<
    string,
    SeedPlanExerciseDescriptor[]
  >();
  const poseProfileKeyByExerciseId = new Map<string, string>(
    POSE_PROFILE_EXERCISE_KEYS.flatMap((exerciseKey) => {
      const exerciseId = ctx.state.exerciseIds[exerciseKey];
      return exerciseId ? ([[exerciseId, exerciseKey]] as const) : [];
    }),
  );
  const presetsPerMember = ctx.config.splitPresetsPerMember;

  for (const [memberIndex, memberKey] of memberKeys.entries()) {
    const userId = ctx.state.userIds[memberKey];
    const account = accountByKey.get(memberKey);
    if (!account || !userId) {
      continue;
    }
    // Luca is the demo member used in the member portal walkthrough. Keep this
    // explicit so her active PPL plan is always a real Seed Coach assignment,
    // rather than an AI draft that happens to share the same title.
    const isLucaDemoMember = memberKey === 'member-premium';
    const isQaOneTimeMember = memberKey === 'member-active';
    const coachingCoachUserId = coachingCoachByMemberId.get(userId);
    const coachingCoachKey = coachKeys.find(
      (coachKey) => ctx.state.userIds[coachKey] === coachingCoachUserId,
    );
    const coachKey =
      isLucaDemoMember || isQaOneTimeMember
        ? 'coach'
        : (coachingCoachKey ?? coachKeys[memberIndex % coachKeys.length]);
    const activePlanId = seedId(`training-plan:${memberKey}`);
    const accessWindow = memberAccessWindow(ctx, memberKey);
    const proposedPlanCreatedAt = daysFrom(
      accessWindow.startsAt ?? ctx.config.anchorDate,
      -7,
      8,
    );
    const planCreatedAt = new Date(
      Math.max(
        proposedPlanCreatedAt.getTime(),
        account.lifecycle?.registeredAt?.getTime() ??
          proposedPlanCreatedAt.getTime(),
      ),
    );

    for (
      let presetIndex = 0;
      presetIndex < presetsPerMember;
      presetIndex += 1
    ) {
      const template =
        SEED_SPLIT_TEMPLATES[presetIndex] ??
        SEED_SPLIT_TEMPLATES[SEED_SPLIT_TEMPLATES.length - 1];
      const durationWeeks =
        presetIndex === 0 && isQaOneTimeMember ? 1 : template.durationWeeks;
      const planId =
        presetIndex === 0
          ? activePlanId
          : seedId(`training-plan:${memberKey}:preset:${presetIndex}`);
      const hasCoachingRelationship =
        isLucaDemoMember ||
        isQaOneTimeMember ||
        coachedMemberKeys.has(memberKey);
      const source =
        presetIndex === 0 && hasCoachingRelationship
          ? PlanSource.coach_assigned
          : presetIndex === 2
            ? PlanSource.ai_generated
            : PlanSource.self_created;
      const trainingPlanRow: Prisma.TrainingPlanCreateManyInput = {
        id: planId,
        ai_generation_prompt: {
          memberKey,
          presetIndex,
          source: 'dynamic-seed',
          style: template.key,
        },
        coach_id:
          source === PlanSource.coach_assigned
            ? ctx.state.userIds[coachKey]
            : null,
        days_per_week: template.daysPerWeek,
        duration_weeks: durationWeeks,
        goal:
          memberIndex % 3 === 0
            ? FitnessGoal.bulking
            : memberIndex % 3 === 1
              ? FitnessGoal.cutting
              : FitnessGoal.maintenance,
        is_active:
          presetIndex === 0 &&
          !ctx.state.historicalMemberKeys.includes(memberKey),
        is_template: false,
        source,
        title:
          presetIndex === 0 && isLucaDemoMember
            ? 'Active PPL Rest Split'
            : template.title,
        created_at: planCreatedAt,
        user_id: userId,
      };
      trainingPlanRows.push(trainingPlanRow);
      if (ctx.config.mode !== 'reset') {
        await ctx.prisma.trainingPlan.upsert({
          where: { id: planId },
          update: {
            ai_generation_prompt: {
              memberKey,
              presetIndex,
              source: 'dynamic-seed',
              style: template.key,
            },
            coach_id:
              source === PlanSource.coach_assigned
                ? ctx.state.userIds[coachKey]
                : null,
            days_per_week: template.daysPerWeek,
            duration_weeks: durationWeeks,
            goal:
              memberIndex % 3 === 0
                ? FitnessGoal.bulking
                : memberIndex % 3 === 1
                  ? FitnessGoal.cutting
                  : FitnessGoal.maintenance,
            is_active:
              presetIndex === 0 &&
              !ctx.state.historicalMemberKeys.includes(memberKey),
            is_template: false,
            source,
            title:
              presetIndex === 0 && isLucaDemoMember
                ? 'Active PPL Rest Split'
                : template.title,
            created_at: planCreatedAt,
          },
          create: {
            id: planId,
            ai_generation_prompt: {
              memberKey,
              presetIndex,
              source: 'dynamic-seed',
              style: template.key,
            },
            coach_id:
              source === PlanSource.coach_assigned
                ? ctx.state.userIds[coachKey]
                : null,
            days_per_week: template.daysPerWeek,
            duration_weeks: durationWeeks,
            goal:
              memberIndex % 3 === 0
                ? FitnessGoal.bulking
                : memberIndex % 3 === 1
                  ? FitnessGoal.cutting
                  : FitnessGoal.maintenance,
            is_active:
              presetIndex === 0 &&
              !ctx.state.historicalMemberKeys.includes(memberKey),
            is_template: false,
            source,
            title:
              presetIndex === 0 && isLucaDemoMember
                ? 'Active PPL Rest Split'
                : template.title,
            created_at: planCreatedAt,
            user_id: userId,
          },
        });
      }

      for (let weekNumber = 1; weekNumber <= durationWeeks; weekNumber += 1) {
        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
          const focus = template.focusByDay[dayIndex] ?? 'recovery';
          const isRestDay = focus === 'recovery';
          const weekSuffix = weekNumber === 1 ? '' : `:week:${weekNumber}`;
          const scheduleDayId = seedId(
            `schedule-day:${memberKey}:${presetIndex}:${dayIndex}${weekSuffix}`,
          );
          scheduleRows.push({
            id: scheduleDayId,
            day_of_week: dayIndex,
            focus_label: isRestDay
              ? 'Recovery'
              : focus === 'full_body'
                ? 'Full Body'
                : focus === 'conditioning'
                  ? 'Conditioning'
                  : focus[0].toUpperCase() + focus.slice(1),
            notes: isRestDay
              ? 'Recovery day with no exercises in the recurring weekly split.'
              : `Seeded ${focus.replace('_', ' ')} training day.`,
            is_rest_day: isRestDay,
            plan_id: planId,
            created_at: planCreatedAt,
            week_number: weekNumber,
          });

          if (isRestDay) {
            continue;
          }

          for (const [orderIndex, exerciseKey] of exerciseKeysForFocus(
            focus,
          ).entries()) {
            const exerciseId = ctx.state.exerciseIds[exerciseKey];
            if (!exerciseId) {
              throw new Error(
                `Missing seeded exercise id for "${exerciseKey}".`,
              );
            }
            const prescription = exercisePrescriptionFor(
              account,
              exerciseKey,
              weekNumber,
            );
            const planExerciseId = seedId(
              `plan-exercise:${memberKey}:${presetIndex}:${dayIndex}:${orderIndex}${weekSuffix}`,
            );
            planExerciseRows.push({
              id: planExerciseId,
              duration_seconds: prescription.durationSeconds,
              exercise_id: exerciseId,
              notes: 'Plan exercise with realistic set prescription.',
              order_index: orderIndex,
              reps: prescription.reps,
              rest_seconds: prescription.restSeconds,
              schedule_day_id: scheduleDayId,
              sets: prescription.sets,
              weight_kg_target:
                prescription.weightKg == null
                  ? null
                  : new Prisma.Decimal(prescription.weightKg),
              created_at: planCreatedAt,
            });

            if (presetIndex === 0) {
              const activePlanExercises =
                activePlanExercisesByMember.get(memberKey) ?? [];
              activePlanExercises.push({
                dayOfWeek: dayIndex,
                durationSeconds: prescription.durationSeconds,
                exerciseId,
                exerciseKey,
                planExerciseId,
                reps: prescription.reps,
                scheduleDayId,
                sets: prescription.sets,
                weekNumber,
                weightKg: prescription.weightKg,
              });
              activePlanExercisesByMember.set(memberKey, activePlanExercises);
            }
          }
        }
      }
    }

    const activePlanExercises =
      activePlanExercisesByMember.get(memberKey) ?? [];
    const activePlanDaysByWeek = new Map<
      number,
      SeedPlanExerciseDescriptor[][]
    >();
    for (const exercise of activePlanExercises) {
      const weekDays = activePlanDaysByWeek.get(exercise.weekNumber) ?? [];
      const dayExercises = weekDays.find(
        (candidate) => candidate[0]?.scheduleDayId === exercise.scheduleDayId,
      );
      if (dayExercises) {
        dayExercises.push(exercise);
      } else {
        weekDays.push([exercise]);
      }
      activePlanDaysByWeek.set(exercise.weekNumber, weekDays);
    }
    const activePlanDays = [...activePlanDaysByWeek.values()].flat();
    const weekOnePlanDays = activePlanDaysByWeek.get(1) ?? [];
    const completedAppointments =
      completedRecurringAppointmentsByMember.get(userId) ?? [];
    const coachingFallbackDays = completedAppointments.map(
      (_appointment, index) =>
        weekOnePlanDays[index % Math.max(1, weekOnePlanDays.length)] ?? [],
    );
    const coachingLogRequirement = coachingFallbackDays.reduce(
      (total, day) => total + requiredExerciseLogCount(day),
      0,
    );
    const sessionsForMember = memberVolumeCount(
      ctx,
      memberKey,
      'workouts',
      ctx.config.workoutDensity,
    );
    const exerciseLogBudget = memberVolumeCount(
      ctx,
      memberKey,
      'exerciseLogs',
      ctx.config.workoutDensity,
    );
    const normalExerciseLogBudget = Math.max(
      0,
      exerciseLogBudget - coachingLogRequirement,
    );
    let normalExerciseLogsCreated = 0;

    for (
      let sessionIndex = 0;
      sessionIndex < sessionsForMember;
      sessionIndex += 1
    ) {
      if (activePlanDays.length === 0) {
        break;
      }
      const activeDurationWeeks = isQaOneTimeMember
        ? 1
        : SEED_SPLIT_TEMPLATES[0].durationWeeks;
      const sessionWeek = Math.min(
        activeDurationWeeks,
        1 + Math.floor(sessionIndex / SEED_SPLIT_TEMPLATES[0].daysPerWeek),
      );
      const weekPlanDays =
        activePlanDaysByWeek.get(sessionWeek) ?? weekOnePlanDays;
      const selectedExercises =
        weekPlanDays[sessionIndex % Math.max(1, weekPlanDays.length)] ?? [];
      const requiredLogs = requiredExerciseLogCount(selectedExercises);
      if (
        selectedExercises.length === 0 ||
        requiredLogs === 0 ||
        normalExerciseLogsCreated + requiredLogs > normalExerciseLogBudget
      ) {
        break;
      }
      const sessionId = seedId(`workout-session:${memberKey}:${sessionIndex}`);
      const startedAt = activityDateFor(
        ctx,
        memberKey,
        sessionIndex,
        sessionsForMember,
        ctx.rng.int(7, 19),
      );
      if (!startedAt) {
        continue;
      }
      const requestedDurationSeconds =
        2_400 +
        Math.floor(
          stableSeedFraction(
            `${ctx.config.seed}:${memberKey}:session:${sessionIndex}`,
          ) * 2_101,
        );
      const activityEnd = memberAccessWindow(ctx, memberKey).activityEnd;
      const availableDurationSeconds = activityEnd
        ? Math.floor((activityEnd.getTime() - startedAt.getTime()) / 1_000)
        : requestedDurationSeconds;
      const durationSeconds = Math.min(
        requestedDurationSeconds,
        availableDurationSeconds,
      );
      if (durationSeconds < 60) {
        continue;
      }
      const completedAt = new Date(
        startedAt.getTime() + durationSeconds * 1_000,
      );
      let totalVolumeKg = 0;
      const firstLogIdByExercise = new Map<string, string>();
      const poseExercise = selectedExercises.find((exercise) =>
        poseProfileKeyByExerciseId.has(exercise.exerciseId),
      );
      const profileKey = poseExercise
        ? poseProfileKeyByExerciseId.get(poseExercise.exerciseId)
        : undefined;
      const poseCapability = profileKey
        ? getPoseAutoRepCapability(profileKey)
        : null;
      const poseContract = poseCapability
        ? buildFallbackPoseMovementContract(poseCapability.contractExercise)
        : null;
      const poseCountedReps =
        poseContract && poseContract.repModel !== 'static_hold'
          ? (poseExercise?.reps ??
            8 +
              Math.floor(
                stableSeedFraction(
                  `${ctx.config.seed}:${memberKey}:pose-reps:${sessionIndex}`,
                ) * 8,
              ))
          : null;

      for (const [exerciseIndex, exercise] of selectedExercises.entries()) {
        const performanceDelta =
          stableSeedFraction(
            `${ctx.config.seed}:${memberKey}:${sessionIndex}:${exercise.exerciseKey}:reps`,
          ) > 0.6
            ? 1
            : 0;
        const completedReps =
          exercise.reps == null
            ? null
            : clampSeedNumber(exercise.reps + performanceDelta, 1, 30);
        const completedWeightKg =
          exercise.weightKg == null
            ? null
            : roundSeedNumber(
                clampSeedNumber(
                  exercise.weightKg +
                    (stableSeedFraction(
                      `${ctx.config.seed}:${memberKey}:${sessionIndex}:${exercise.exerciseKey}:weight`,
                    ) > 0.65
                      ? 1
                      : 0),
                  1,
                  180,
                ),
                1,
              );

        for (let setIndex = 0; setIndex < exercise.sets; setIndex += 1) {
          const exerciseLogId = seedId(
            `exercise-log:${memberKey}:${sessionIndex}:${exercise.planExerciseId}:${setIndex}`,
          );
          firstLogIdByExercise.set(
            exercise.exerciseId,
            firstLogIdByExercise.get(exercise.exerciseId) ?? exerciseLogId,
          );
          const isPoseCountedLog =
            poseExercise?.exerciseId === exercise.exerciseId &&
            setIndex === 0 &&
            poseContract !== null;
          exerciseLogRows.push({
            id: exerciseLogId,
            created_at: new Date(
              Math.min(
                completedAt.getTime() - 1_000,
                startedAt.getTime() +
                  (10 + exerciseIndex * 12 + setIndex * 3) * 60_000,
              ),
            ),
            duration_seconds:
              completedReps == null ? exercise.durationSeconds : null,
            exercise_id: exercise.exerciseId,
            plan_exercise_id: exercise.planExerciseId,
            reps_ai_counted:
              isPoseCountedLog && poseContract?.repModel !== 'static_hold'
                ? poseCountedReps
                : null,
            reps_completed: completedReps,
            reps_target: exercise.reps,
            session_id: sessionId,
            set_number: setIndex + 1,
            user_id: userId,
            weight_kg:
              completedWeightKg == null
                ? null
                : new Prisma.Decimal(completedWeightKg),
          });
          normalExerciseLogsCreated += 1;

          if (completedWeightKg != null && completedReps != null) {
            totalVolumeKg += completedWeightKg * completedReps;
          }
        }
      }

      sessionRows.push({
        id: sessionId,
        completed_at: completedAt,
        created_at: startedAt,
        duration_seconds: durationSeconds,
        last_activity_at: completedAt,
        plan_id: activePlanId,
        started_at: startedAt,
        status: SessionStatus.completed,
        total_volume_kg: new Prisma.Decimal(totalVolumeKg),
        user_id: userId,
      });

      const poseExerciseLogId = poseExercise
        ? firstLogIdByExercise.get(poseExercise.exerciseId)
        : undefined;

      if (poseExercise && profileKey && poseExerciseLogId && poseContract) {
        const poseSessionId = seedId(
          `pose-session:${memberKey}:${sessionIndex}`,
        );
        const countedReps =
          poseContract.repModel === 'static_hold' ? 0 : (poseCountedReps ?? 0);
        const holdSeconds =
          poseContract.repModel === 'static_hold'
            ? (poseExercise.durationSeconds ??
              poseContract.holdDurationSeconds ??
              30)
            : null;
        poseRows.push({
          id: poseSessionId,
          analysis_summary: {
            countedReps,
            holdSeconds,
            issues:
              stableSeedFraction(
                `${ctx.config.seed}:${memberKey}:pose-issues`,
              ) > 0.8
                ? ['depth variance']
                : [],
            source: 'dynamic-seed',
          },
          classification_confidence: new Prisma.Decimal('0.810'),
          confidence_avg: new Prisma.Decimal('0.840'),
          detected_exercise_name: poseContract.exercise,
          detected_profile_id: seedId(`pose-profile:${profileKey}`),
          ended_at: completedAt,
          exercise_hint: poseContract.exercise,
          exercise_log_id: poseExerciseLogId,
          rep_count_ai: countedReps,
          started_at: startedAt,
          subject_lock_confidence: new Prisma.Decimal('0.780'),
          user_id: userId,
        });
      }
    }

    // Reconciliation links completed recurring appointments to completed
    // assignments. Ensure every such appointment has a real completed session
    // even when a low/zero workout-history density would otherwise leave the
    // normal history generator short.
    const existingSessionCount = sessionRows.filter(
      (session) => session.user_id === userId,
    ).length;
    const missingSessionCount = Math.max(
      0,
      completedAppointments.length - existingSessionCount,
    );
    for (
      let fallbackIndex = 0;
      fallbackIndex < missingSessionCount;
      fallbackIndex += 1
    ) {
      const appointment =
        completedAppointments[existingSessionCount + fallbackIndex];
      if (!appointment) continue;
      const fallbackStartedAt = appointment.scheduled_at;
      const fallbackCompletedAt =
        appointment.completed_at ??
        new Date(fallbackStartedAt.getTime() + 3_600_000);
      const fallbackSessionId = seedId(
        `workout-session:${memberKey}:coaching:${appointment.id}`,
      );
      const fallbackExercises =
        coachingFallbackDays[existingSessionCount + fallbackIndex] ?? [];
      const fallbackDurationSeconds = Math.max(
        60,
        Math.floor(
          (fallbackCompletedAt.getTime() - fallbackStartedAt.getTime()) / 1_000,
        ),
      );
      let fallbackTotalVolumeKg = 0;
      sessionRows.push({
        id: fallbackSessionId,
        completed_at: fallbackCompletedAt,
        created_at: fallbackStartedAt,
        duration_seconds: fallbackDurationSeconds,
        last_activity_at: fallbackCompletedAt,
        plan_id: activePlanId,
        started_at: fallbackStartedAt,
        status: SessionStatus.completed,
        total_volume_kg: new Prisma.Decimal(0),
        user_id: userId,
      });
      for (const fallbackExercise of fallbackExercises) {
        for (
          let setIndex = 0;
          setIndex < fallbackExercise.sets;
          setIndex += 1
        ) {
          const completedReps = fallbackExercise.reps;
          const completedWeightKg = fallbackExercise.weightKg;
          exerciseLogRows.push({
            id: seedId(
              `exercise-log:${memberKey}:coaching:${appointment.id}:${fallbackExercise.planExerciseId}:${setIndex}`,
            ),
            created_at: new Date(
              Math.min(
                fallbackCompletedAt.getTime() - 1_000,
                fallbackStartedAt.getTime() + (10 + setIndex * 3) * 60_000,
              ),
            ),
            duration_seconds:
              completedReps == null ? fallbackExercise.durationSeconds : null,
            exercise_id: fallbackExercise.exerciseId,
            plan_exercise_id: fallbackExercise.planExerciseId,
            reps_ai_counted: null,
            reps_completed: completedReps,
            reps_target: fallbackExercise.reps,
            session_id: fallbackSessionId,
            set_number: setIndex + 1,
            user_id: userId,
            weight_kg:
              completedWeightKg == null
                ? null
                : new Prisma.Decimal(completedWeightKg),
          });
          if (completedWeightKg != null && completedReps != null) {
            fallbackTotalVolumeKg += completedWeightKg * completedReps;
          }
        }
      }
      const fallbackSessionRow = sessionRows.at(-1);
      if (fallbackSessionRow) {
        fallbackSessionRow.total_volume_kg = new Prisma.Decimal(
          fallbackTotalVolumeKg,
        );
      }
    }
  }

  if (ctx.config.mode === 'reset') {
    await createSeedRowsInBatches(ctx.prisma.trainingPlan, trainingPlanRows);
  }
  await ctx.prisma.trainingScheduleDay.createMany({
    data: scheduleRows,
    skipDuplicates: true,
  });
  await ctx.prisma.planExercise.createMany({
    data: planExerciseRows,
    skipDuplicates: true,
  });
  await ctx.prisma.workoutSession.createMany({
    data: sessionRows,
    skipDuplicates: true,
  });
  await ctx.prisma.exerciseLog.createMany({
    data: exerciseLogRows,
    skipDuplicates: true,
  });
  await ctx.prisma.poseSession.createMany({
    data: poseRows,
    skipDuplicates: true,
  });
}

async function seedGamification(ctx: DynamicSeedContext) {
  const dynamicSeasonId = seedId('season:dynamic-main');
  const previousSeasonId = seedId('season:dynamic-previous');
  const upcomingSeasonId = seedId('season:dynamic-upcoming');
  const memberKeys = ctx.state.memberKeys;
  const activeMemberKeys = ctx.state.activeMemberKeys;
  const historyMemberKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
  ];
  const canRewriteSeedOwned = (
    existingId: string | null | undefined,
    expectedId: string,
    legacyIds: readonly string[] = [],
  ) =>
    ctx.config.mode === 'reset' ||
    !existingId ||
    existingId === expectedId ||
    legacyIds.includes(existingId);
  const seedOwnedWorkoutIds = new Set(
    historyMemberKeys.flatMap((memberKey) => {
      const sessionCount = memberVolumeCount(
        ctx,
        memberKey,
        'workouts',
        ctx.config.workoutDensity,
      );
      return Array.from({ length: sessionCount }, (_, index) =>
        seedId(`workout-session:${memberKey}:${index}`),
      );
    }),
  );
  const activeMuscles = await ctx.prisma.muscleDefinition.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: 'asc' }, { key: 'asc' }],
    select: { key: true },
  });
  const adminId = ctx.state.userIds[ctx.state.adminKeys[0]];
  const existingActiveSeason = await ctx.prisma.seasonDefinition.findFirst({
    where: { status: SeasonStatus.active },
    select: { id: true },
  });
  const useDynamicActiveSeason =
    ctx.config.mode === 'reset' ||
    !existingActiveSeason ||
    existingActiveSeason.id === dynamicSeasonId;
  const activeSeasonId = useDynamicActiveSeason
    ? dynamicSeasonId
    : existingActiveSeason.id;
  ctx.state.seasonId = activeSeasonId;

  if (useDynamicActiveSeason) {
    await ctx.prisma.seasonDefinition.updateMany({
      where: {
        id: { not: dynamicSeasonId },
        status: SeasonStatus.active,
      },
      data: {
        closed_at: daysFrom(ctx.config.anchorDate, -1, 23),
        status: SeasonStatus.closed,
      },
    });
  }

  await ctx.prisma.seasonDefinition.upsert({
    where: { id: dynamicSeasonId },
    update: {
      activated_at: useDynamicActiveSeason
        ? daysFrom(ctx.config.anchorDate, -25, 0)
        : null,
      archived_at: null,
      auto_start_next: useDynamicActiveSeason ? false : true,
      closed_at: null,
      description:
        'Dynamic demo season with enough standings to test leaderboards.',
      ends_at: daysFrom(ctx.config.anchorDate, 65, 23, 59),
      rules_version: 'dynamic-v1',
      starts_at: daysFrom(ctx.config.anchorDate, -25, 0),
      status: useDynamicActiveSeason ? SeasonStatus.active : SeasonStatus.draft,
      title: 'FitTrack Performance Season',
    },
    create: {
      id: dynamicSeasonId,
      activated_at: useDynamicActiveSeason
        ? daysFrom(ctx.config.anchorDate, -25, 0)
        : null,
      auto_start_next: useDynamicActiveSeason ? false : true,
      description:
        'Dynamic demo season with enough standings to test leaderboards.',
      ends_at: daysFrom(ctx.config.anchorDate, 65, 23, 59),
      rules_version: 'dynamic-v1',
      starts_at: daysFrom(ctx.config.anchorDate, -25, 0),
      status: useDynamicActiveSeason ? SeasonStatus.active : SeasonStatus.draft,
      title: 'FitTrack Performance Season',
    },
  });
  await ctx.prisma.seasonDefinition.upsert({
    where: { id: previousSeasonId },
    update: {
      activated_at: daysFrom(ctx.config.anchorDate, -115, 0),
      archived_at: null,
      auto_start_next: false,
      closed_at: daysFrom(ctx.config.anchorDate, -26, 23, 59),
      description:
        'Completed season retained for historical top-performer review.',
      ends_at: daysFrom(ctx.config.anchorDate, -26, 23, 59),
      rules_version: 'dynamic-v1',
      starts_at: daysFrom(ctx.config.anchorDate, -115, 0),
      status: SeasonStatus.closed,
      title: 'FitTrack Foundation Season',
    },
    create: {
      id: previousSeasonId,
      activated_at: daysFrom(ctx.config.anchorDate, -115, 0),
      auto_start_next: false,
      closed_at: daysFrom(ctx.config.anchorDate, -26, 23, 59),
      description:
        'Completed season retained for historical top-performer review.',
      ends_at: daysFrom(ctx.config.anchorDate, -26, 23, 59),
      rules_version: 'dynamic-v1',
      starts_at: daysFrom(ctx.config.anchorDate, -115, 0),
      status: SeasonStatus.closed,
      title: 'FitTrack Foundation Season',
    },
  });
  await ctx.prisma.seasonDefinition.upsert({
    where: { id: upcomingSeasonId },
    update: {
      activated_at: null,
      archived_at: null,
      auto_start_next: true,
      closed_at: null,
      description:
        'Scheduled season that starts automatically after the active season.',
      ends_at: daysFrom(ctx.config.anchorDate, 155, 23, 59),
      rules_version: 'dynamic-v1',
      starts_at: daysFrom(ctx.config.anchorDate, 66, 0),
      status: SeasonStatus.draft,
      title: 'FitTrack Strength Season',
    },
    create: {
      id: upcomingSeasonId,
      auto_start_next: true,
      description:
        'Scheduled season that starts automatically after the active season.',
      ends_at: daysFrom(ctx.config.anchorDate, 155, 23, 59),
      rules_version: 'dynamic-v1',
      starts_at: daysFrom(ctx.config.anchorDate, 66, 0),
      status: SeasonStatus.draft,
      title: 'FitTrack Strength Season',
    },
  });

  for (const [index, milestone] of DYNAMIC_MILESTONES.entries()) {
    await ctx.prisma.milestoneDefinition.upsert({
      where: { key: milestone.key },
      update: {
        category: milestone.category,
        condition_payload: {
          metric: milestone.metric,
          target: milestone.target,
        },
        created_by_user_id: adminId,
        description: milestone.description,
        evidence_requirement: MilestoneEvidenceRequirement.none,
        icon_asset_key: null,
        icon_key: milestone.iconKey,
        icon_kind: ProgressionIconKind.library,
        is_active: true,
        is_hidden: false,
        reward_payload: {
          badgeTone: index === 0 ? 'gold' : 'green',
          icon: milestone.iconKey,
          xp: 150 + index * 50,
        },
        sort_order: 200 + index,
        status: MilestoneDefinitionStatus.active,
        title: milestone.title,
        trigger_type: milestone.trigger,
        updated_by_user_id: adminId,
        verification_policy: MilestoneVerificationPolicy.auto,
      },
      create: {
        id: seedId(`milestone-definition:${milestone.key}`),
        category: milestone.category,
        condition_payload: {
          metric: milestone.metric,
          target: milestone.target,
        },
        created_by_user_id: adminId,
        description: milestone.description,
        evidence_requirement: MilestoneEvidenceRequirement.none,
        icon_asset_key: null,
        icon_key: milestone.iconKey,
        icon_kind: ProgressionIconKind.library,
        is_active: true,
        is_hidden: false,
        key: milestone.key,
        reward_payload: {
          badgeTone: index === 0 ? 'gold' : 'green',
          icon: milestone.iconKey,
          xp: 150 + index * 50,
        },
        sort_order: 200 + index,
        status: MilestoneDefinitionStatus.active,
        title: milestone.title,
        trigger_type: milestone.trigger,
        updated_by_user_id: adminId,
        verification_policy: MilestoneVerificationPolicy.auto,
      },
    });
  }

  const progressionProfileRows: Prisma.UserProgressionProfileCreateManyInput[] =
    [];
  const rankingProfileRows: Prisma.RankingProfileCreateManyInput[] = [];
  const integrityProfileRows: Prisma.IntegrityProfileCreateManyInput[] = [];
  for (const account of ctx.state.accounts.filter(
    (candidate) =>
      candidate.role === 'admin' || historyMemberKeys.includes(candidate.key),
  )) {
    const userId = ctx.state.userIds[account.key];
    const memberIndex = memberKeys.indexOf(account.key);
    const points = account.role === 'admin' ? 0 : 150 + (memberIndex % 12) * 65;
    const totalXp = getRepresentativeLifetimeXp(account, memberIndex);
    const progressionProfileId = seedId(`progression-profile:${account.key}`);
    const currentStreak =
      account.memberPersona === 'premium' ? 7 : 1 + (points % 5);
    const longestStreak =
      account.memberPersona === 'premium' ? 12 : 3 + (points % 8);
    const lastProgressedAt = daysFrom(
      ctx.config.anchorDate,
      -1 - (points % 9),
      19,
    );
    const progressionProfileRow: Prisma.UserProgressionProfileCreateManyInput =
      {
        id: progressionProfileId,
        active_season_id: activeSeasonId,
        current_season_points: points,
        current_streak: currentStreak,
        last_progressed_at: lastProgressedAt,
        longest_streak: longestStreak,
        total_xp: totalXp,
        user_id: userId,
      };
    if (ctx.config.mode === 'reset') {
      progressionProfileRows.push(progressionProfileRow);
    } else {
      const existingProgressionProfile =
        await ctx.prisma.userProgressionProfile.findUnique({
          where: { user_id: userId },
          select: { id: true },
        });
      if (
        canRewriteSeedOwned(
          existingProgressionProfile?.id,
          progressionProfileId,
        )
      ) {
        await ctx.prisma.userProgressionProfile.upsert({
          where: { user_id: userId },
          update: {
            active_season_id: activeSeasonId,
            current_season_points: points,
            current_streak: currentStreak,
            last_progressed_at: lastProgressedAt,
            longest_streak: longestStreak,
            total_xp: totalXp,
          },
          create: progressionProfileRow,
        });
      }
    }

    const rankingProfileId = seedId(`ranking-profile:${account.key}`);
    const rankingProfileRow: Prisma.RankingProfileCreateManyInput = {
      id: rankingProfileId,
      display_alias:
        account.role === 'admin'
          ? 'Admin Review'
          : `${account.firstName} ${account.lastName.charAt(0)}.`,
      governance_status:
        account.memberPersona === 'suspended'
          ? RankingGovernanceStatus.hidden_by_admin
          : RankingGovernanceStatus.normal,
      user_id: userId,
      visibility: getSeedRankingVisibility(account),
    };
    if (ctx.config.mode === 'reset') {
      rankingProfileRows.push(rankingProfileRow);
    } else {
      const existingRankingProfile = await ctx.prisma.rankingProfile.findUnique(
        {
          where: { user_id: userId },
          select: { id: true },
        },
      );
      if (canRewriteSeedOwned(existingRankingProfile?.id, rankingProfileId)) {
        await ctx.prisma.rankingProfile.upsert({
          where: { user_id: userId },
          update: {
            display_alias: rankingProfileRow.display_alias,
            governance_status: rankingProfileRow.governance_status,
            visibility: rankingProfileRow.visibility,
          },
          create: rankingProfileRow,
        });
      }
    }

    const integrityProfileId = seedId(`integrity-profile:${account.key}`);
    const integrityProfileRow: Prisma.IntegrityProfileCreateManyInput = {
      id: integrityProfileId,
      last_flagged_at:
        account.memberPersona === 'suspended'
          ? daysFrom(ctx.config.anchorDate, -6, 9)
          : null,
      open_case_count: account.memberPersona === 'suspended' ? 1 : 0,
      risk_level:
        account.memberPersona === 'suspended'
          ? IntegrityRiskLevel.high
          : account.memberPersona === 'frozen'
            ? IntegrityRiskLevel.medium
            : IntegrityRiskLevel.low,
      user_id: userId,
    };
    if (ctx.config.mode === 'reset') {
      integrityProfileRows.push(integrityProfileRow);
    } else {
      const existingIntegrityProfile =
        await ctx.prisma.integrityProfile.findUnique({
          where: { user_id: userId },
          select: { id: true },
        });
      if (
        canRewriteSeedOwned(existingIntegrityProfile?.id, integrityProfileId)
      ) {
        await ctx.prisma.integrityProfile.upsert({
          where: { user_id: userId },
          update: {
            last_flagged_at: integrityProfileRow.last_flagged_at,
            open_case_count: integrityProfileRow.open_case_count,
            risk_level: integrityProfileRow.risk_level,
          },
          create: integrityProfileRow,
        });
      }
    }
  }
  if (ctx.config.mode === 'reset') {
    await createSeedRowsInBatches(
      ctx.prisma.userProgressionProfile,
      progressionProfileRows,
    );
    await createSeedRowsInBatches(
      ctx.prisma.rankingProfile,
      rankingProfileRows,
    );
    await createSeedRowsInBatches(
      ctx.prisma.integrityProfile,
      integrityProfileRows,
    );
  }

  const seasonalStandingRows: Prisma.SeasonalStandingCreateManyInput[] = [];
  for (const [index, memberKey] of activeMemberKeys.entries()) {
    const userId = ctx.state.userIds[memberKey];
    const standings = [
      {
        id: seedId(`season-standing:${activeSeasonId}:${memberKey}`),
        is_disqualified: memberKey === 'member-suspended',
        is_hidden: index % 17 === 0,
        last_earned_at: daysFrom(ctx.config.anchorDate, -1 - (index % 12), 19),
        rank_position: index + 1,
        season_id: activeSeasonId,
        season_points: 900 - index * 8,
      },
      {
        id: seedId(`season-standing:${previousSeasonId}:${memberKey}`),
        is_disqualified: false,
        is_hidden: false,
        last_earned_at: daysFrom(ctx.config.anchorDate, -28 - (index % 8), 19),
        rank_position: index + 1,
        season_id: previousSeasonId,
        season_points: 840 - index * 7,
      },
    ];

    for (const standing of standings) {
      const legacyIds =
        standing.season_id === previousSeasonId
          ? [seedId(`season-standing:previous:${memberKey}`)]
          : [];
      const row: Prisma.SeasonalStandingCreateManyInput = {
        ...standing,
        user_id: userId,
      };
      if (ctx.config.mode === 'reset') {
        seasonalStandingRows.push(row);
        continue;
      }
      const existingStanding = await ctx.prisma.seasonalStanding.findUnique({
        where: {
          season_id_user_id: {
            season_id: standing.season_id,
            user_id: userId,
          },
        },
        select: { id: true },
      });
      if (!canRewriteSeedOwned(existingStanding?.id, standing.id, legacyIds)) {
        continue;
      }
      await ctx.prisma.seasonalStanding.upsert({
        where: {
          season_id_user_id: {
            season_id: standing.season_id,
            user_id: userId,
          },
        },
        update: {
          is_disqualified: standing.is_disqualified,
          is_hidden: standing.is_hidden,
          last_earned_at: standing.last_earned_at,
          rank_position: standing.rank_position,
          season_points: standing.season_points,
        },
        create: row,
      });
    }
  }
  if (ctx.config.mode === 'reset') {
    await createSeedRowsInBatches(
      ctx.prisma.seasonalStanding,
      seasonalStandingRows,
    );
  }

  const muscleMasteryRows: Prisma.MuscleMasteryProgressCreateManyInput[] = [];
  for (const [memberIndex, memberKey] of historyMemberKeys.entries()) {
    for (const [muscleIndex, { key: muscle }] of activeMuscles.entries()) {
      const xpPoints = getRepresentativeMuscleXp(memberIndex, muscleIndex);
      const totalVolumeKg = new Prisma.Decimal(
        4_500 + memberIndex * 125 + muscleIndex * 300,
      );
      const masteryId = seedId(`mastery:${memberKey}:${muscle}`);
      const masteryRow: Prisma.MuscleMasteryProgressCreateManyInput = {
        id: masteryId,
        last_ranked_at: daysFrom(ctx.config.anchorDate, -2 - muscleIndex, 20),
        muscle_group: muscle,
        rank: evaluateExpRank(xpPoints),
        total_volume_kg: totalVolumeKg,
        user_id: ctx.state.userIds[memberKey],
        xp_points: xpPoints,
      };
      if (ctx.config.mode === 'reset') {
        muscleMasteryRows.push(masteryRow);
        continue;
      }
      const existingMastery = await ctx.prisma.muscleMasteryProgress.findUnique(
        {
          where: {
            user_id_muscle_group: {
              muscle_group: muscle,
              user_id: ctx.state.userIds[memberKey],
            },
          },
          select: { id: true },
        },
      );
      if (!canRewriteSeedOwned(existingMastery?.id, masteryId)) continue;
      await ctx.prisma.muscleMasteryProgress.upsert({
        where: {
          user_id_muscle_group: {
            muscle_group: muscle,
            user_id: ctx.state.userIds[memberKey],
          },
        },
        update: {
          last_ranked_at: daysFrom(ctx.config.anchorDate, -2 - muscleIndex, 20),
          rank: evaluateExpRank(xpPoints),
          total_volume_kg: totalVolumeKg,
          xp_points: xpPoints,
        },
        create: {
          ...masteryRow,
        },
      });
    }
  }
  if (ctx.config.mode === 'reset') {
    await createSeedRowsInBatches(
      ctx.prisma.muscleMasteryProgress,
      muscleMasteryRows,
    );
  }

  const seasonalMuscleStandingRows: Prisma.SeasonalMuscleStandingCreateManyInput[] =
    [];
  for (const [memberIndex, memberKey] of activeMemberKeys.entries()) {
    for (const [muscleIndex, { key: muscle }] of activeMuscles.entries()) {
      const rows = [
        {
          id: seedId(`season-muscle:${activeSeasonId}:${memberKey}:${muscle}`),
          is_disqualified: memberKey === 'member-suspended',
          is_hidden: false,
          last_earned_at: daysFrom(ctx.config.anchorDate, -2 - muscleIndex, 20),
          muscle_group: muscle,
          muscle_points: 900 - memberIndex * 9 + muscleIndex * 35,
          rank_position: memberIndex + 1,
          season_id: activeSeasonId,
        },
        {
          id: seedId(
            `season-muscle:${previousSeasonId}:${memberKey}:${muscle}`,
          ),
          is_disqualified: false,
          is_hidden: false,
          last_earned_at: daysFrom(
            ctx.config.anchorDate,
            -28 - muscleIndex,
            20,
          ),
          muscle_group: muscle,
          muscle_points: 820 - memberIndex * 8 + muscleIndex * 30,
          rank_position: memberIndex + 1,
          season_id: previousSeasonId,
        },
      ];

      for (const row of rows) {
        const createRow: Prisma.SeasonalMuscleStandingCreateManyInput = {
          ...row,
          user_id: ctx.state.userIds[memberKey],
        };
        if (ctx.config.mode === 'reset') {
          seasonalMuscleStandingRows.push(createRow);
          continue;
        }
        const existingStanding =
          await ctx.prisma.seasonalMuscleStanding.findUnique({
            where: {
              season_id_user_id_muscle_group: {
                muscle_group: row.muscle_group,
                season_id: row.season_id,
                user_id: ctx.state.userIds[memberKey],
              },
            },
            select: { id: true },
          });
        if (!canRewriteSeedOwned(existingStanding?.id, row.id)) continue;
        await ctx.prisma.seasonalMuscleStanding.upsert({
          where: {
            season_id_user_id_muscle_group: {
              muscle_group: row.muscle_group,
              season_id: row.season_id,
              user_id: ctx.state.userIds[memberKey],
            },
          },
          update: {
            is_disqualified: row.is_disqualified,
            is_hidden: row.is_hidden,
            last_earned_at: row.last_earned_at,
            muscle_points: row.muscle_points,
            rank_position: row.rank_position,
          },
          create: {
            ...createRow,
          },
        });
      }
    }
  }

  if (ctx.config.mode === 'reset') {
    await createSeedRowsInBatches(
      ctx.prisma.seasonalMuscleStanding,
      seasonalMuscleStandingRows,
    );
  }

  const completedWorkouts = await ctx.prisma.workoutSession.findMany({
    where: {
      id: { in: [...seedOwnedWorkoutIds] },
      status: SessionStatus.completed,
      user_id: {
        in: historyMemberKeys.map((memberKey) => ctx.state.userIds[memberKey]),
      },
    },
    orderBy: [{ user_id: 'asc' }, { completed_at: 'asc' }],
    select: {
      completed_at: true,
      id: true,
      started_at: true,
      total_volume_kg: true,
      user_id: true,
    },
  });
  const sourceCounts = new Map<string, number>();
  const sourceRows = completedWorkouts.flatMap((workout) => {
    const sourceCount = sourceCounts.get(workout.user_id) ?? 0;
    if (sourceCount >= 60) {
      return [];
    }
    sourceCounts.set(workout.user_id, sourceCount + 1);
    return [
      {
        id: seedId(`progression-source:workout:${workout.id}`),
        created_at: workout.completed_at ?? workout.started_at,
        processed_at: workout.completed_at ?? workout.started_at,
        source_context: {
          source: 'dynamic-seed',
          workoutSessionId: workout.id,
        },
        source_id: seedExternalId(`source:workout:${workout.id}`),
        source_status: ProgressionSourceStatus.applied,
        source_type: ProgressionSourceType.workout_session_completed,
        user_id: workout.user_id,
        workoutId: workout.id,
        volume: Number(workout.total_volume_kg ?? 0),
      },
    ];
  });
  const sourceEventIdByUser = new Map<string, string>();
  for (const source of sourceRows) {
    if (!sourceEventIdByUser.has(source.user_id)) {
      sourceEventIdByUser.set(source.user_id, source.id);
    }
  }

  for (const [index, source] of sourceRows.entries()) {
    const { workoutId, volume, ...sourceRecord } = source;
    if (ctx.config.mode !== 'reset') {
      await ctx.prisma.progressionSourceEvent.upsert({
        where: { id: source.id },
        update: {
          created_at: source.created_at,
          processed_at: source.processed_at,
          source_context: sourceRecord.source_context,
          source_id: sourceRecord.source_id,
          source_status: sourceRecord.source_status,
          source_type: sourceRecord.source_type,
          user_id: sourceRecord.user_id,
        },
        create: sourceRecord,
      });
    }

    const grants = [
      {
        id: seedId(`progression-grant:${workoutId}:xp`),
        amount: Math.max(80, Math.min(260, 80 + Math.round(volume / 18))),
        created_at: source.created_at,
        grant_status: ProgressionGrantStatus.applied,
        grant_type: ProgressionGrantType.xp,
        metadata: { source: 'dynamic-seed' },
        muscle_group:
          activeMuscles[index % Math.max(1, activeMuscles.length)]?.key ?? null,
        reason: 'Completed workout reward.',
        season_id: activeSeasonId,
        source_event_id: source.id,
        user_id: source.user_id,
      },
      {
        id: seedId(`progression-grant:${workoutId}:season`),
        amount: 45 + (index % 5) * 5,
        created_at: source.created_at,
        grant_status: ProgressionGrantStatus.applied,
        grant_type: ProgressionGrantType.season_points,
        metadata: { source: 'dynamic-seed' },
        muscle_group: null,
        reason: 'Season standing reward.',
        season_id: activeSeasonId,
        source_event_id: source.id,
        user_id: source.user_id,
      },
    ];

    for (const grant of grants) {
      if (ctx.config.mode !== 'reset') {
        await ctx.prisma.progressionGrantLedger.upsert({
          where: { id: grant.id },
          update: {
            amount: grant.amount,
            created_at: grant.created_at,
            grant_status: grant.grant_status,
            grant_type: grant.grant_type,
            metadata: grant.metadata,
            muscle_group: grant.muscle_group,
            reason: grant.reason,
            season_id: grant.season_id,
            source_event_id: grant.source_event_id,
            user_id: grant.user_id,
          },
          create: grant,
        });
      }
    }
  }

  const seededGrants = sourceRows.length
    ? await ctx.prisma.progressionGrantLedger.findMany({
        where: {
          source_event_id: { in: sourceRows.map((source) => source.id) },
        },
        select: {
          amount: true,
          created_at: true,
          grant_type: true,
          muscle_group: true,
          season_id: true,
          user_id: true,
        },
      })
    : [];
  const totalXpByUser = new Map<string, number>();
  const seasonPointsByUser = new Map<string, number>();
  const muscleXpByUser = new Map<string, Map<string, number>>();
  const lastProgressedAtByUser = new Map<string, Date>();
  const volumeByUser = new Map<string, number>();
  for (const workout of completedWorkouts) {
    volumeByUser.set(
      workout.user_id,
      (volumeByUser.get(workout.user_id) ?? 0) +
        Number(workout.total_volume_kg ?? 0),
    );
  }
  for (const source of sourceRows) {
    const previous = lastProgressedAtByUser.get(source.user_id);
    if (!previous || source.created_at > previous) {
      lastProgressedAtByUser.set(source.user_id, source.created_at);
    }
  }
  for (const grant of seededGrants) {
    const amount = Number(grant.amount);
    if (grant.grant_type === ProgressionGrantType.xp) {
      totalXpByUser.set(
        grant.user_id,
        (totalXpByUser.get(grant.user_id) ?? 0) + amount,
      );
      if (grant.muscle_group) {
        const muscleTotals =
          muscleXpByUser.get(grant.user_id) ?? new Map<string, number>();
        muscleTotals.set(
          grant.muscle_group,
          (muscleTotals.get(grant.muscle_group) ?? 0) + amount,
        );
        muscleXpByUser.set(grant.user_id, muscleTotals);
      }
    }
    if (
      grant.grant_type === ProgressionGrantType.season_points &&
      grant.season_id === activeSeasonId
    ) {
      seasonPointsByUser.set(
        grant.user_id,
        (seasonPointsByUser.get(grant.user_id) ?? 0) + amount,
      );
    }
  }

  if (ctx.config.mode === 'reset') {
    for (const memberKey of historyMemberKeys) {
      const userId = ctx.state.userIds[memberKey];
      const totalXp = totalXpByUser.get(userId) ?? 0;
      const seasonPoints = seasonPointsByUser.get(userId) ?? 0;
      const lastProgressedAt =
        lastProgressedAtByUser.get(userId) ??
        activityDateFor(ctx, memberKey, 0, 1, 19) ??
        daysFrom(ctx.config.anchorDate, -1, 19);
      await ctx.prisma.userProgressionProfile.update({
        where: { user_id: userId },
        data: {
          current_season_points: seasonPoints,
          last_progressed_at: lastProgressedAt,
          total_xp: totalXp,
        },
      });

      const muscleTotals =
        muscleXpByUser.get(userId) ?? new Map<string, number>();
      for (const { key: muscle } of activeMuscles) {
        const xpPoints = muscleTotals.get(muscle) ?? 0;
        await ctx.prisma.muscleMasteryProgress.upsert({
          where: {
            user_id_muscle_group: { muscle_group: muscle, user_id: userId },
          },
          update: {
            last_ranked_at: lastProgressedAt,
            rank: evaluateExpRank(xpPoints),
            total_volume_kg: new Prisma.Decimal(
              (volumeByUser.get(userId) ?? 0).toFixed(2),
            ),
            xp_points: xpPoints,
          },
          create: {
            id: seedId(`mastery:${memberKey}:${muscle}`),
            last_ranked_at: lastProgressedAt,
            muscle_group: muscle,
            rank: evaluateExpRank(xpPoints),
            total_volume_kg: new Prisma.Decimal(
              (volumeByUser.get(userId) ?? 0).toFixed(2),
            ),
            user_id: userId,
            xp_points: xpPoints,
          },
        });
      }
    }
    for (const [memberIndex, memberKey] of activeMemberKeys.entries()) {
      const userId = ctx.state.userIds[memberKey];
      const seasonPoints = seasonPointsByUser.get(userId) ?? 0;
      const muscleTotals =
        muscleXpByUser.get(userId) ?? new Map<string, number>();
      await ctx.prisma.seasonalStanding.updateMany({
        where: { season_id: activeSeasonId, user_id: userId },
        data: {
          last_earned_at:
            lastProgressedAtByUser.get(userId) ??
            daysFrom(ctx.config.anchorDate, -1, 19),
          rank_position: memberIndex + 1,
          season_points: seasonPoints,
        },
      });
      for (const { key: muscle } of activeMuscles) {
        await ctx.prisma.seasonalMuscleStanding.updateMany({
          where: {
            muscle_group: muscle,
            season_id: activeSeasonId,
            user_id: userId,
          },
          data: {
            last_earned_at:
              lastProgressedAtByUser.get(userId) ??
              daysFrom(ctx.config.anchorDate, -1, 19),
            muscle_points: muscleTotals.get(muscle) ?? 0,
            rank_position: memberIndex + 1,
          },
        });
      }
    }
  }

  const milestoneKeys = DYNAMIC_MILESTONES.map((milestone) => milestone.key);
  const completedWorkoutCountByUser = new Map<string, number>();
  for (const workout of completedWorkouts) {
    completedWorkoutCountByUser.set(
      workout.user_id,
      (completedWorkoutCountByUser.get(workout.user_id) ?? 0) + 1,
    );
  }
  const milestoneProgressRows = historyMemberKeys.flatMap((memberKey, index) =>
    milestoneKeys.map((milestoneKey, milestoneIndex) => {
      const milestone = DYNAMIC_MILESTONES[milestoneIndex];
      const isLifetimeXpMilestone = milestone.metric === 'total_xp';
      const lifetimeXp = totalXpByUser.get(ctx.state.userIds[memberKey]) ?? 0;
      const progressValue =
        milestone.metric === 'completed_workout_sessions'
          ? (completedWorkoutCountByUser.get(ctx.state.userIds[memberKey]) ?? 0)
          : isLifetimeXpMilestone
            ? lifetimeXp
            : milestoneIndex === 1
              ? Math.min(milestone.target, index % 5)
              : index % 2;
      const automaticallyUnlocked = progressValue >= milestone.target;
      const isClaimed =
        milestoneIndex === 0 || (automaticallyUnlocked && index % 3 === 0);

      return {
        id: seedId(`milestone-progress:${memberKey}:${milestoneKey}`),
        claimed_at: isClaimed ? daysFrom(ctx.config.anchorDate, -1, 10) : null,
        milestone_definition_id: seedId(`milestone-definition:${milestoneKey}`),
        progress_payload: {
          memberKey,
          source: 'dynamic-seed',
        },
        progress_value: progressValue,
        reward_granted_at: isClaimed
          ? daysFrom(ctx.config.anchorDate, -1, 10)
          : null,
        status: isClaimed
          ? MilestoneProgressStatus.claimed
          : automaticallyUnlocked || index % 2 === 0
            ? MilestoneProgressStatus.unlocked
            : MilestoneProgressStatus.in_progress,
        unlocked_at:
          isClaimed || automaticallyUnlocked || index % 2 === 0
            ? daysFrom(ctx.config.anchorDate, -2, 9)
            : null,
        user_id: ctx.state.userIds[memberKey],
      };
    }),
  );

  if (ctx.config.mode === 'reset') {
    await createSeedRowsInBatches(
      ctx.prisma.userMilestoneProgress,
      milestoneProgressRows,
    );
  } else {
    for (const progress of milestoneProgressRows) {
      const existingProgress =
        await ctx.prisma.userMilestoneProgress.findUnique({
          where: {
            user_id_milestone_definition_id: {
              milestone_definition_id: progress.milestone_definition_id,
              user_id: progress.user_id,
            },
          },
          select: { id: true },
        });
      if (!canRewriteSeedOwned(existingProgress?.id, progress.id)) continue;
      await ctx.prisma.userMilestoneProgress.upsert({
        where: {
          user_id_milestone_definition_id: {
            milestone_definition_id: progress.milestone_definition_id,
            user_id: progress.user_id,
          },
        },
        update: {
          claimed_at: progress.claimed_at,
          progress_payload: progress.progress_payload,
          progress_value: progress.progress_value,
          reward_granted_at: progress.reward_granted_at,
          status: progress.status,
          unlocked_at: progress.unlocked_at,
        },
        create: progress,
      });
    }
  }

  const evidenceMemberKeys = activeMemberKeys.slice(0, 3);
  await ctx.prisma.milestoneEvidenceSubmission.createMany({
    data: evidenceMemberKeys.map((memberKey, index) => {
      const milestoneKey =
        DYNAMIC_MILESTONES[index % DYNAMIC_MILESTONES.length].key;
      const status =
        index === 0
          ? MilestoneEvidenceSubmissionStatus.approved
          : index === 1
            ? MilestoneEvidenceSubmissionStatus.rejected
            : MilestoneEvidenceSubmissionStatus.pending;
      return {
        id: seedId(`milestone-evidence:${memberKey}:${index}`),
        caption: 'Seeded evidence fixture for milestone review filters.',
        evidence_type:
          index % 2 === 0
            ? MilestoneEvidenceType.image
            : MilestoneEvidenceType.video,
        file_url: `/seed-fixtures/milestones/${memberKey}-${index}.bin`,
        mime_type: index % 2 === 0 ? 'image/jpeg' : 'video/mp4',
        milestone_definition_id: seedId(`milestone-definition:${milestoneKey}`),
        milestone_progress_id: seedId(
          `milestone-progress:${memberKey}:${milestoneKey}`,
        ),
        original_filename: `${memberKey}-milestone-${index}.bin`,
        reviewed_at:
          status === MilestoneEvidenceSubmissionStatus.pending
            ? null
            : daysFrom(ctx.config.anchorDate, -2 + index, 11),
        reviewed_by_user_id:
          status === MilestoneEvidenceSubmissionStatus.pending ? null : adminId,
        reviewer_notes:
          status === MilestoneEvidenceSubmissionStatus.pending
            ? null
            : status === MilestoneEvidenceSubmissionStatus.approved
              ? 'Evidence accepted for the seeded demo flow.'
              : 'Evidence retained as a rejected review example.',
        size_bytes: 24_000 + index * 1_000,
        status,
        user_id: ctx.state.userIds[memberKey],
      };
    }),
    skipDuplicates: true,
  });

  const riskyMembers = [
    'member-suspended',
    'member-frozen',
    ...activeMemberKeys.slice(0, 4),
  ];
  await ctx.prisma.integrityCase.createMany({
    data: riskyMembers.map((memberKey, index) => ({
      id: seedId(`integrity-case:${memberKey}`),
      created_at: daysFrom(ctx.config.anchorDate, -6 + index, 9),
      opened_at: daysFrom(ctx.config.anchorDate, -6 + index, 9),
      resolved_at:
        index > 1 ? daysFrom(ctx.config.anchorDate, -2 + index, 13) : null,
      status:
        index === 0
          ? IntegrityCaseStatus.open
          : index === 1
            ? IntegrityCaseStatus.under_review
            : IntegrityCaseStatus.resolved_valid,
      summary: 'Progression anomaly for moderation review.',
      user_id: ctx.state.userIds[memberKey],
    })),
    skipDuplicates: true,
  });
  await ctx.prisma.integrityEvent.createMany({
    data: riskyMembers.map((memberKey, index) => ({
      id: seedId(`integrity-event:${memberKey}`),
      created_at: daysFrom(ctx.config.anchorDate, -6 + index, 10),
      details: { source: 'dynamic-seed', variance: index + 1 },
      event_type: 'progression_variance',
      integrity_case_id: seedId(`integrity-case:${memberKey}`),
      is_resolved: index > 1,
      reason_code: index === 0 ? 'suspicious_spike' : 'manual_review',
      risk_level:
        index === 0 ? IntegrityRiskLevel.high : IntegrityRiskLevel.medium,
      source_event_id:
        ctx.config.mode === 'reset'
          ? null
          : (sourceEventIdByUser.get(ctx.state.userIds[memberKey]) ?? null),
      user_id: ctx.state.userIds[memberKey],
    })),
    skipDuplicates: true,
  });
  await ctx.prisma.moderationActionRecord.createMany({
    data: riskyMembers.map((memberKey, index) => ({
      id: seedId(`moderation-action:${memberKey}`),
      action_type:
        index === 0
          ? ModerationActionType.hide_from_rankings
          : ModerationActionType.resolve_integrity_case_valid,
      actor_user_id: adminId,
      after_state: { status: index === 0 ? 'hidden' : 'resolved' },
      before_state: { status: 'open' },
      created_at: daysFrom(ctx.config.anchorDate, -3 + index, 15),
      integrity_case_id: seedId(`integrity-case:${memberKey}`),
      rationale: 'Moderation action for governance audit.',
      season_id: activeSeasonId,
      source_event_id:
        ctx.config.mode === 'reset'
          ? null
          : (sourceEventIdByUser.get(ctx.state.userIds[memberKey]) ?? null),
      target_user_id: ctx.state.userIds[memberKey],
    })),
    skipDuplicates: true,
  });
}

type SeedWorkoutMuscleDelta = {
  xp: number;
  volumeKg: Prisma.Decimal;
};

type SeedWorkoutDelta = {
  byMuscle: Map<string, SeedWorkoutMuscleDelta>;
  totalXp: number;
  totalVolumeKg: Prisma.Decimal;
};

type SeedProgressionGrant = {
  amount: number;
  created_at: Date;
  grant_status: ProgressionGrantStatus;
  grant_type: ProgressionGrantType;
  id: string;
  metadata: Prisma.InputJsonObject;
  muscle_group: string | null;
  reason: string;
  season_id: string | null;
  source_event_id: string;
  user_id: string;
};

export async function reconcileSeedGamification(ctx: DynamicSeedContext) {
  const candidateHistoryMemberKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
  ];
  const candidateHistoryUserIds = candidateHistoryMemberKeys
    .map((key) => ctx.state.userIds[key])
    .filter((id): id is string => Boolean(id));
  if (candidateHistoryUserIds.length === 0) return;
  const presentHistoryUsers = await ctx.prisma.user.findMany({
    where: { id: { in: candidateHistoryUserIds } },
    select: { id: true },
  });
  const historyMembers = filterPresentSeedHistoryMembers(
    candidateHistoryMemberKeys,
    ctx.state.userIds,
    new Set(presentHistoryUsers.map(({ id }) => id)),
  );
  const historyMemberKeys = historyMembers.map(({ memberKey }) => memberKey);
  const historyUserIds = historyMembers.map(({ userId }) => userId);
  if (historyUserIds.length === 0) return;

  const expectedWorkoutIds = historyMemberKeys.flatMap((memberKey) => {
    const sessionCount = memberVolumeCount(
      ctx,
      memberKey,
      'workouts',
      ctx.config.workoutDensity,
    );
    return Array.from({ length: sessionCount }, (_, index) =>
      seedId(`workout-session:${memberKey}:${index}`),
    );
  });
  const coachingAssignments = await ctx.prisma.coachWorkoutAssignment.findMany({
    where: {
      appointment: { user_id: { in: historyUserIds } },
      workout_session_id: { not: null },
    },
    select: { workout_session_id: true },
  });
  const workoutIds = [
    ...new Set([
      ...expectedWorkoutIds,
      ...coachingAssignments.flatMap((row) =>
        row.workout_session_id ? [row.workout_session_id] : [],
      ),
    ]),
  ];
  if (workoutIds.length === 0) return;

  const [activeMuscles, seasons, workouts, logs] = await Promise.all([
    ctx.prisma.muscleDefinition.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { key: 'asc' }],
      select: { key: true },
    }),
    ctx.prisma.seasonDefinition.findMany({
      where: { status: { in: [SeasonStatus.active, SeasonStatus.closed] } },
      orderBy: [{ starts_at: 'desc' }, { created_at: 'desc' }],
      select: { ends_at: true, id: true, starts_at: true, status: true },
    }),
    ctx.prisma.workoutSession.findMany({
      where: {
        id: { in: workoutIds },
        status: SessionStatus.completed,
        user_id: { in: historyUserIds },
      },
      orderBy: [{ completed_at: 'asc' }, { started_at: 'asc' }, { id: 'asc' }],
      select: { completed_at: true, id: true, started_at: true, user_id: true },
    }),
    ctx.prisma.exerciseLog.findMany({
      where: {
        session_id: { in: workoutIds },
        user_id: { in: historyUserIds },
      },
      select: {
        exercise_id: true,
        reps_ai_counted: true,
        reps_completed: true,
        session_id: true,
        weight_kg: true,
      },
    }),
  ]);
  const muscleKeys = [
    ...new Set(activeMuscles.map(({ key }) => key.trim().toLowerCase())),
  ];
  const muscleSet = new Set(muscleKeys);
  const exerciseIds = [...new Set(logs.map((log) => log.exercise_id))];
  const exercises = exerciseIds.length
    ? await ctx.prisma.exerciseCatalog.findMany({
        where: { id: { in: exerciseIds } },
        select: { id: true, muscle_group: true, muscle_targets: true },
      })
    : [];
  const exerciseById = new Map(
    exercises.map((exercise) => [exercise.id, exercise]),
  );
  const logsBySession = new Map<string, typeof logs>();
  for (const log of logs) {
    const rows = logsBySession.get(log.session_id) ?? [];
    rows.push(log);
    logsBySession.set(log.session_id, rows);
  }

  const deltasByWorkout = new Map<string, SeedWorkoutDelta>();
  const deltasByUser = new Map<string, Map<string, SeedWorkoutMuscleDelta>>();
  const completedDatesByUser = new Map<string, Date[]>();
  for (const workout of workouts) {
    const byMuscle = new Map<string, SeedWorkoutMuscleDelta>();
    let totalXp = 0;
    let totalVolumeKg = new Prisma.Decimal(0);
    for (const log of logsBySession.get(workout.id) ?? []) {
      const exercise = exerciseById.get(log.exercise_id);
      if (!exercise) continue;
      const explicitTargets = (
        Array.isArray(exercise.muscle_targets) ? exercise.muscle_targets : []
      )
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
        .filter(
          (value, index, values) =>
            muscleSet.has(value) && values.indexOf(value) === index,
        );
      const fallbackTarget = exercise.muscle_group.trim().toLowerCase();
      const targets = explicitTargets.length
        ? explicitTargets
        : muscleSet.has(fallbackTarget)
          ? [fallbackTarget]
          : [];
      const delta = calculateWorkoutProgressionDelta({
        repsAiCounted: log.reps_ai_counted,
        repsCompleted: log.reps_completed,
        weightKg: log.weight_kg,
      });
      if (targets.length === 0 || delta.xp <= 0) continue;
      totalXp += delta.xp;
      totalVolumeKg = totalVolumeKg.plus(delta.volumeKg);
      const baseXp = Math.floor(delta.xp / targets.length);
      const remainder = delta.xp % targets.length;
      const volumeShare = delta.volumeKg.dividedBy(targets.length);
      targets.forEach((muscle, index) => {
        const current = byMuscle.get(muscle) ?? {
          xp: 0,
          volumeKg: new Prisma.Decimal(0),
        };
        byMuscle.set(muscle, {
          xp: current.xp + baseXp + (index < remainder ? 1 : 0),
          volumeKg: current.volumeKg.plus(volumeShare),
        });
      });
    }
    const occurredAt = workout.completed_at ?? workout.started_at;
    deltasByWorkout.set(workout.id, { byMuscle, totalXp, totalVolumeKg });
    if (totalXp <= 0) continue;
    const dates = completedDatesByUser.get(workout.user_id) ?? [];
    dates.push(occurredAt);
    completedDatesByUser.set(workout.user_id, dates);
    const userMuscles =
      deltasByUser.get(workout.user_id) ??
      new Map<string, SeedWorkoutMuscleDelta>();
    for (const [muscle, delta] of byMuscle) {
      const current = userMuscles.get(muscle) ?? {
        xp: 0,
        volumeKg: new Prisma.Decimal(0),
      };
      userMuscles.set(muscle, {
        xp: current.xp + delta.xp,
        volumeKg: current.volumeKg.plus(delta.volumeKg),
      });
    }
    deltasByUser.set(workout.user_id, userMuscles);
  }

  const activeSeason =
    seasons.find(
      (season) =>
        season.status === SeasonStatus.active &&
        season.starts_at <= ctx.config.anchorDate &&
        season.ends_at >= ctx.config.anchorDate,
    ) ??
    seasons.find((season) => season.id === ctx.state.seasonId) ??
    null;
  const activeSeasonId = activeSeason?.id ?? ctx.state.seasonId ?? null;
  const seasonFor = (date: Date) =>
    seasons.find(
      (season) => season.starts_at <= date && season.ends_at >= date,
    ) ?? null;
  const sourceIds = workouts.map((workout) =>
    seedId(`progression-source:workout:${workout.id}`),
  );
  const canonicalGrantIds: string[] = [];
  const totalXpByUser = new Map<string, number>();
  const seasonPointsByUser = new Map<string, number>();
  const seasonPointsBySeason = new Map<
    string,
    Map<string, { points: number; lastEarnedAt: Date | null }>
  >();
  const seasonMusclePoints = new Map<
    string,
    Map<string, Map<string, { points: number; lastEarnedAt: Date | null }>>
  >();
  const sourceRowsForReset: Prisma.ProgressionSourceEventCreateManyInput[] = [];
  const grantRowsForReset: Prisma.ProgressionGrantLedgerCreateManyInput[] = [];

  for (const workout of workouts) {
    const delta = deltasByWorkout.get(workout.id);
    if (!delta) continue;
    const occurredAt = workout.completed_at ?? workout.started_at;
    const sourceEventId = seedId(`progression-source:workout:${workout.id}`);
    const sourceData = {
      created_at: occurredAt,
      processed_at: occurredAt,
      source_context: {
        exercise_log_count: logsBySession.get(workout.id)?.length ?? 0,
        muscle_groups: [...delta.byMuscle.keys()],
        source: 'dynamic-seed',
        source_rule: 'workout-log-muscle-targets-v1',
        total_volume_kg: delta.totalVolumeKg.toFixed(2),
        total_xp_granted: delta.totalXp,
        workout_session_id: workout.id,
      },
      source_id: workout.id,
      source_status:
        delta.totalXp > 0
          ? ProgressionSourceStatus.applied
          : ProgressionSourceStatus.blocked,
      source_type: ProgressionSourceType.workout_session_completed,
      user_id: workout.user_id,
    };
    if (ctx.config.mode === 'reset') {
      sourceRowsForReset.push({ id: sourceEventId, ...sourceData });
    } else {
      await ctx.prisma.progressionSourceEvent.upsert({
        where: { id: sourceEventId },
        update: sourceData,
        create: { id: sourceEventId, ...sourceData },
      });
    }

    const progressionSeason = seasonFor(occurredAt);
    const grants: SeedProgressionGrant[] = [...delta.byMuscle.entries()]
      .filter(([, muscle]) => muscle.xp > 0)
      .map(([muscle, muscleDelta], index) => ({
        amount: muscleDelta.xp,
        created_at: occurredAt,
        grant_status: ProgressionGrantStatus.applied,
        grant_type: ProgressionGrantType.xp,
        id:
          index === 0
            ? seedId(`progression-grant:${workout.id}:xp`)
            : seedId(`progression-grant:${workout.id}:xp:${muscle}`),
        metadata: {
          muscle_group: muscle,
          source: 'dynamic-seed',
          total_volume_kg: muscleDelta.volumeKg.toFixed(2),
        },
        muscle_group: muscle,
        reason: ProgressionSourceType.workout_session_completed,
        season_id: progressionSeason?.id ?? null,
        source_event_id: sourceEventId,
        user_id: workout.user_id,
      }));
    if (progressionSeason && delta.totalXp > 0) {
      grants.push({
        amount: delta.totalXp,
        created_at: occurredAt,
        grant_status: ProgressionGrantStatus.applied,
        grant_type: ProgressionGrantType.season_points,
        id: seedId(`progression-grant:${workout.id}:season`),
        metadata: {
          grant_basis: 'mvp_total_xp_mirror',
          source: 'dynamic-seed',
        },
        muscle_group: null,
        reason: ProgressionSourceType.workout_session_completed,
        season_id: progressionSeason.id,
        source_event_id: sourceEventId,
        user_id: workout.user_id,
      });
    }
    for (const grant of grants) {
      canonicalGrantIds.push(grant.id);
      if (ctx.config.mode === 'reset') {
        grantRowsForReset.push(grant);
      } else {
        await ctx.prisma.progressionGrantLedger.upsert({
          where: { id: grant.id },
          update: {
            amount: grant.amount,
            created_at: grant.created_at,
            grant_status: grant.grant_status,
            grant_type: grant.grant_type,
            metadata: grant.metadata,
            muscle_group: grant.muscle_group,
            reason: grant.reason,
            season_id: grant.season_id,
            source_event_id: grant.source_event_id,
            user_id: grant.user_id,
            voided_at: null,
          },
          create: grant,
        });
      }
      if (grant.grant_type === ProgressionGrantType.xp) {
        totalXpByUser.set(
          grant.user_id,
          (totalXpByUser.get(grant.user_id) ?? 0) + grant.amount,
        );
        if (grant.season_id && grant.muscle_group) {
          const seasonRows =
            seasonMusclePoints.get(grant.season_id) ??
            new Map<
              string,
              Map<string, { points: number; lastEarnedAt: Date | null }>
            >();
          const userRows =
            seasonRows.get(grant.user_id) ??
            new Map<string, { points: number; lastEarnedAt: Date | null }>();
          const current = userRows.get(grant.muscle_group) ?? {
            points: 0,
            lastEarnedAt: null,
          };
          userRows.set(grant.muscle_group, {
            points: current.points + grant.amount,
            lastEarnedAt:
              !current.lastEarnedAt || grant.created_at > current.lastEarnedAt
                ? grant.created_at
                : current.lastEarnedAt,
          });
          seasonRows.set(grant.user_id, userRows);
          seasonMusclePoints.set(grant.season_id, seasonRows);
        }
      }
      if (
        grant.grant_type === ProgressionGrantType.season_points &&
        grant.season_id
      ) {
        if (grant.season_id === activeSeasonId) {
          seasonPointsByUser.set(
            grant.user_id,
            (seasonPointsByUser.get(grant.user_id) ?? 0) + grant.amount,
          );
        }
        const rows =
          seasonPointsBySeason.get(grant.season_id) ??
          new Map<string, { points: number; lastEarnedAt: Date | null }>();
        const current = rows.get(grant.user_id) ?? {
          points: 0,
          lastEarnedAt: null,
        };
        rows.set(grant.user_id, {
          points: current.points + grant.amount,
          lastEarnedAt:
            !current.lastEarnedAt || grant.created_at > current.lastEarnedAt
              ? grant.created_at
              : current.lastEarnedAt,
        });
        seasonPointsBySeason.set(grant.season_id, rows);
      }
    }
  }
  if (ctx.config.mode === 'reset') {
    await createSeedRowsInBatches(
      ctx.prisma.progressionSourceEvent,
      sourceRowsForReset,
    );
    await createSeedRowsInBatches(
      ctx.prisma.progressionGrantLedger,
      grantRowsForReset,
    );
  }

  const canonicalSourceIdSet = new Set(sourceIds);
  const existingSeedSources = await ctx.prisma.progressionSourceEvent.findMany({
    where: {
      source_type: ProgressionSourceType.workout_session_completed,
      user_id: { in: historyUserIds },
    },
    select: { id: true, source_context: true },
  });
  const staleSeedSourceIds = existingSeedSources
    .filter((source) => {
      const context =
        source.source_context &&
        typeof source.source_context === 'object' &&
        !Array.isArray(source.source_context)
          ? (source.source_context as Record<string, unknown>)
          : null;
      return (
        context?.source === 'dynamic-seed' &&
        !canonicalSourceIdSet.has(source.id)
      );
    })
    .map((source) => source.id);
  for (const source of existingSeedSources) {
    if (!staleSeedSourceIds.includes(source.id)) continue;
    const context =
      source.source_context &&
      typeof source.source_context === 'object' &&
      !Array.isArray(source.source_context)
        ? (source.source_context as Record<string, unknown>)
        : {};
    await ctx.prisma.progressionSourceEvent.update({
      where: { id: source.id },
      data: {
        source_context: {
          ...context,
          reconciliation: 'stale-dynamic-seed',
        },
        source_status: ProgressionSourceStatus.blocked,
      },
    });
  }
  const seedSourceIds = [...new Set([...sourceIds, ...staleSeedSourceIds])];
  if (seedSourceIds.length) {
    const staleGrants = await ctx.prisma.progressionGrantLedger.findMany({
      where: {
        source_event_id: { in: seedSourceIds },
        grant_status: ProgressionGrantStatus.applied,
        id: { notIn: canonicalGrantIds },
      },
      select: { id: true, metadata: true },
    });
    for (const grant of staleGrants) {
      const metadata =
        grant.metadata &&
        typeof grant.metadata === 'object' &&
        !Array.isArray(grant.metadata)
          ? (grant.metadata as Record<string, unknown>)
          : null;
      if (ctx.config.mode === 'reset' || metadata?.source === 'dynamic-seed') {
        await ctx.prisma.progressionGrantLedger.update({
          where: { id: grant.id },
          data: {
            grant_status: ProgressionGrantStatus.voided,
            reason: 'Reconciled stale dynamic-seed grant.',
            voided_at: ctx.config.anchorDate,
          },
        });
      }
    }
  }

  const canRewrite = (
    existingId: string | null | undefined,
    expectedId: string,
    legacyIds: readonly string[] = [],
  ) =>
    ctx.config.mode === 'reset' ||
    !existingId ||
    existingId === expectedId ||
    legacyIds.includes(existingId);
  const accountByKey = new Map(
    ctx.state.accounts.map((account) => [account.key, account]),
  );
  const memberKeyFor = (userId: string) =>
    historyMemberKeys.find((key) => ctx.state.userIds[key] === userId) ??
    userId;
  const rankingState = (userId: string) => {
    const account = accountByKey.get(memberKeyFor(userId));
    const visibility = account
      ? getSeedRankingVisibility(account)
      : RankingVisibility.public;
    return {
      hidden:
        visibility !== RankingVisibility.public ||
        account?.memberPersona === 'suspended',
      disqualified: account?.memberPersona === 'suspended',
    };
  };
  const daySpan = (dates: Date[]) => {
    const days = [
      ...new Set(
        dates
          .sort((left, right) => left.getTime() - right.getTime())
          .map((date) => date.toISOString().slice(0, 10)),
      ),
    ];
    let run = 0;
    let longest = 0;
    let previous = 0;
    for (const day of days) {
      const current = Date.parse(`${day}T00:00:00.000Z`);
      run = previous && current - previous === 86_400_000 ? run + 1 : 1;
      longest = Math.max(longest, run);
      previous = current;
    }
    return { current: days.length ? run : 0, longest };
  };

  for (const memberKey of historyMemberKeys) {
    const userId = ctx.state.userIds[memberKey];
    if (!userId) continue;
    const profileId = seedId(`progression-profile:${memberKey}`);
    const existingProfile = await ctx.prisma.userProgressionProfile.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });
    if (canRewrite(existingProfile?.id, profileId)) {
      const dates = completedDatesByUser.get(userId) ?? [];
      const streak = daySpan([...dates]);
      await ctx.prisma.userProgressionProfile.upsert({
        where: { user_id: userId },
        update: {
          active_season_id: activeSeasonId,
          current_season_points: seasonPointsByUser.get(userId) ?? 0,
          current_streak: streak.current,
          last_progressed_at: dates.at(-1) ?? null,
          longest_streak: streak.longest,
          total_xp: totalXpByUser.get(userId) ?? 0,
        },
        create: {
          active_season_id: activeSeasonId,
          current_season_points: seasonPointsByUser.get(userId) ?? 0,
          current_streak: streak.current,
          id: profileId,
          last_progressed_at: dates.at(-1) ?? null,
          longest_streak: streak.longest,
          total_xp: totalXpByUser.get(userId) ?? 0,
          user_id: userId,
        },
      });
    }

    const muscleRows =
      deltasByUser.get(userId) ?? new Map<string, SeedWorkoutMuscleDelta>();
    for (const muscle of muscleKeys) {
      const muscleDelta = muscleRows.get(muscle) ?? {
        xp: 0,
        volumeKg: new Prisma.Decimal(0),
      };
      const masteryId = seedId(`mastery:${memberKey}:${muscle}`);
      const existingMastery = await ctx.prisma.muscleMasteryProgress.findUnique(
        {
          where: {
            user_id_muscle_group: { muscle_group: muscle, user_id: userId },
          },
          select: { id: true },
        },
      );
      if (!canRewrite(existingMastery?.id, masteryId)) continue;
      await ctx.prisma.muscleMasteryProgress.upsert({
        where: {
          user_id_muscle_group: { muscle_group: muscle, user_id: userId },
        },
        update: {
          last_ranked_at:
            muscleDelta.xp > 0
              ? (completedDatesByUser.get(userId)?.at(-1) ?? null)
              : null,
          rank: evaluateExpRank(muscleDelta.xp),
          total_volume_kg: new Prisma.Decimal(muscleDelta.volumeKg.toFixed(2)),
          xp_points: muscleDelta.xp,
        },
        create: {
          id: masteryId,
          last_ranked_at:
            muscleDelta.xp > 0
              ? (completedDatesByUser.get(userId)?.at(-1) ?? null)
              : null,
          muscle_group: muscle,
          rank: evaluateExpRank(muscleDelta.xp),
          total_volume_kg: new Prisma.Decimal(muscleDelta.volumeKg.toFixed(2)),
          user_id: userId,
          xp_points: muscleDelta.xp,
        },
      });
    }
  }

  const rankRows = (
    rows: Array<{
      disqualified: boolean;
      hidden: boolean;
      lastEarnedAt: Date | null;
      muscleGroup?: string;
      points: number;
      userId: string;
    }>,
  ) => {
    const sorted = [...rows].sort((left, right) => {
      if (right.points !== left.points) return right.points - left.points;
      const rightTime = right.lastEarnedAt?.getTime() ?? 0;
      const leftTime = left.lastEarnedAt?.getTime() ?? 0;
      if (rightTime !== leftTime) return rightTime - leftTime;
      return left.userId.localeCompare(right.userId);
    });
    let previousPoints: number | null = null;
    let previousRank = 0;
    let visibleIndex = 0;
    return sorted.map((row) => {
      const rank =
        row.hidden || row.disqualified
          ? null
          : row.points === previousPoints
            ? previousRank
            : visibleIndex + 1;
      if (rank !== null) {
        visibleIndex += 1;
        previousPoints = row.points;
        previousRank = rank;
      }
      return { ...row, rank };
    });
  };
  const touchedSeasonIds = [
    ...new Set([
      ...(activeSeasonId ? [activeSeasonId] : []),
      seedId('season:dynamic-previous'),
      ...seasonPointsBySeason.keys(),
    ]),
  ];
  for (const seasonId of touchedSeasonIds) {
    const seasonRows =
      seasonPointsBySeason.get(seasonId) ??
      new Map<string, { points: number; lastEarnedAt: Date | null }>();
    const rows = historyUserIds.map((userId) => {
      const current = seasonRows.get(userId) ?? {
        points: 0,
        lastEarnedAt: null,
      };
      const state = rankingState(userId);
      return {
        disqualified: state.disqualified,
        hidden: state.hidden,
        lastEarnedAt: current.lastEarnedAt,
        points: current.points,
        userId,
      };
    });
    for (const row of rankRows(rows)) {
      const standingId = seedId(
        `season-standing:${seasonId}:${memberKeyFor(row.userId)}`,
      );
      const existingStanding = await ctx.prisma.seasonalStanding.findUnique({
        where: {
          season_id_user_id: { season_id: seasonId, user_id: row.userId },
        },
        select: { id: true },
      });
      const legacyStandingId =
        seasonId === seedId('season:dynamic-previous')
          ? seedId(`season-standing:previous:${memberKeyFor(row.userId)}`)
          : null;
      if (
        !canRewrite(
          existingStanding?.id,
          standingId,
          legacyStandingId ? [legacyStandingId] : [],
        )
      ) {
        continue;
      }
      await ctx.prisma.seasonalStanding.upsert({
        where: {
          season_id_user_id: { season_id: seasonId, user_id: row.userId },
        },
        update: {
          is_disqualified: row.disqualified,
          is_hidden: row.hidden,
          last_earned_at: row.lastEarnedAt,
          rank_position: row.rank,
          season_points: row.points,
        },
        create: {
          id: standingId,
          is_disqualified: row.disqualified,
          is_hidden: row.hidden,
          last_earned_at: row.lastEarnedAt,
          rank_position: row.rank,
          season_id: seasonId,
          season_points: row.points,
          user_id: row.userId,
        },
      });
    }
  }

  const seasonMuscleStandingRows = new Map<
    string,
    Array<{
      disqualified: boolean;
      hidden: boolean;
      lastEarnedAt: Date | null;
      muscleGroup: string;
      points: number;
      userId: string;
    }>
  >();
  for (const [seasonId, userRows] of seasonMusclePoints) {
    for (const [userId, muscleRows] of userRows) {
      const state = rankingState(userId);
      for (const [muscle, value] of muscleRows) {
        const key = `${seasonId}:${muscle}`;
        const rows = seasonMuscleStandingRows.get(key) ?? [];
        rows.push({
          disqualified: state.disqualified,
          hidden: state.hidden,
          lastEarnedAt: value.lastEarnedAt,
          muscleGroup: muscle,
          points: value.points,
          userId,
        });
        seasonMuscleStandingRows.set(key, rows);
      }
    }
  }
  for (const [key, rows] of seasonMuscleStandingRows) {
    const separator = key.indexOf(':');
    const seasonId = key.slice(0, separator);
    const muscleGroup = key.slice(separator + 1);
    for (const row of rankRows(rows)) {
      const standingId = seedId(
        `season-muscle:${seasonId}:${memberKeyFor(row.userId)}:${muscleGroup}`,
      );
      const existingStanding =
        await ctx.prisma.seasonalMuscleStanding.findUnique({
          where: {
            season_id_user_id_muscle_group: {
              muscle_group: muscleGroup,
              season_id: seasonId,
              user_id: row.userId,
            },
          },
          select: { id: true },
        });
      if (!canRewrite(existingStanding?.id, standingId)) continue;
      await ctx.prisma.seasonalMuscleStanding.upsert({
        where: {
          season_id_user_id_muscle_group: {
            muscle_group: muscleGroup,
            season_id: seasonId,
            user_id: row.userId,
          },
        },
        update: {
          is_disqualified: row.disqualified,
          is_hidden: row.hidden,
          last_earned_at: row.lastEarnedAt,
          muscle_points: row.points,
          rank_position: row.rank,
        },
        create: {
          id: standingId,
          is_disqualified: row.disqualified,
          is_hidden: row.hidden,
          last_earned_at: row.lastEarnedAt,
          muscle_group: muscleGroup,
          muscle_points: row.points,
          rank_position: row.rank,
          season_id: seasonId,
          user_id: row.userId,
        },
      });
    }
  }
  if (ctx.config.mode === 'reset' || ctx.config.mode === 'additive') {
    for (const seasonId of touchedSeasonIds) {
      for (const muscleGroup of muscleKeys) {
        const rankedRows = rankRows(
          historyUserIds.map((userId) => {
            const value = seasonMusclePoints
              .get(seasonId)
              ?.get(userId)
              ?.get(muscleGroup);
            const state = rankingState(userId);
            return {
              disqualified: state.disqualified,
              hidden: state.hidden,
              lastEarnedAt: value?.lastEarnedAt ?? null,
              muscleGroup,
              points: value?.points ?? 0,
              userId,
            };
          }),
        );
        for (const row of rankedRows) {
          const userId = row.userId;
          const standingId = seedId(
            `season-muscle:${seasonId}:${memberKeyFor(userId)}:${muscleGroup}`,
          );
          const existingStanding =
            await ctx.prisma.seasonalMuscleStanding.findUnique({
              where: {
                season_id_user_id_muscle_group: {
                  muscle_group: muscleGroup,
                  season_id: seasonId,
                  user_id: userId,
                },
              },
              select: { id: true },
            });
          if (!canRewrite(existingStanding?.id, standingId)) continue;
          await ctx.prisma.seasonalMuscleStanding.upsert({
            where: {
              season_id_user_id_muscle_group: {
                muscle_group: muscleGroup,
                season_id: seasonId,
                user_id: userId,
              },
            },
            update: {
              is_disqualified: row.disqualified,
              is_hidden: row.hidden,
              last_earned_at: row.lastEarnedAt,
              muscle_points: row.points,
              rank_position: row.rank,
            },
            create: {
              id: standingId,
              is_disqualified: row.disqualified,
              is_hidden: row.hidden,
              last_earned_at: row.lastEarnedAt,
              muscle_group: muscleGroup,
              muscle_points: row.points,
              rank_position: row.rank,
              season_id: seasonId,
              user_id: userId,
            },
          });
        }
      }
    }
  }

  const [completedBookings, completedCoaching, milestoneDefinitions] =
    await Promise.all([
      ctx.prisma.amenityBooking.findMany({
        where: {
          status: BookingStatus.completed,
          user_id: { in: historyUserIds },
        },
        orderBy: [{ completed_at: 'asc' }, { id: 'asc' }],
        select: { completed_at: true, id: true, user_id: true },
      }),
      ctx.prisma.coachAppointment.findMany({
        where: {
          status: AppointmentStatus.completed,
          user_id: { in: historyUserIds },
        },
        orderBy: [
          { completed_at: 'asc' },
          { scheduled_at: 'asc' },
          { id: 'asc' },
        ],
        select: {
          completed_at: true,
          id: true,
          scheduled_at: true,
          user_id: true,
        },
      }),
      ctx.prisma.milestoneDefinition.findMany({
        where: {
          key: { in: DYNAMIC_MILESTONES.map((milestone) => milestone.key) },
        },
        select: { id: true, key: true },
      }),
    ]);
  const milestoneIdByKey = new Map(
    milestoneDefinitions.map((definition) => [definition.key, definition.id]),
  );
  const bookingsByUser = new Map<string, typeof completedBookings>();
  const coachingByUser = new Map<string, typeof completedCoaching>();
  for (const booking of completedBookings) {
    const rows = bookingsByUser.get(booking.user_id) ?? [];
    rows.push(booking);
    bookingsByUser.set(booking.user_id, rows);
  }
  for (const appointment of completedCoaching) {
    const rows = coachingByUser.get(appointment.user_id) ?? [];
    rows.push(appointment);
    coachingByUser.set(appointment.user_id, rows);
  }
  const metricSource = (
    userId: string,
    metric: string,
    target: number,
  ): {
    ids: string[];
    observed: number;
    unlockedAt: Date | null;
    sourceType: string;
  } => {
    if (metric === 'completed_venue_bookings') {
      const rows = bookingsByUser.get(userId) ?? [];
      return {
        ids: rows.map((row) => row.id),
        observed: rows.length,
        unlockedAt: rows[target - 1]?.completed_at ?? null,
        sourceType: ProgressionSourceType.venue_booking_completed,
      };
    }
    if (metric === 'completed_coach_appointments') {
      const rows = coachingByUser.get(userId) ?? [];
      return {
        ids: rows.map((row) => row.id),
        observed: rows.length,
        unlockedAt:
          rows[target - 1]?.completed_at ??
          rows[target - 1]?.scheduled_at ??
          null,
        sourceType: ProgressionSourceType.coaching_appointment_completed,
      };
    }
    const rows = workouts
      .filter((workout) => workout.user_id === userId)
      .map((workout) => ({
        date: workout.completed_at ?? workout.started_at,
        id: workout.id,
        xp: deltasByWorkout.get(workout.id)?.totalXp ?? 0,
      }));
    if (metric === 'completed_workout_sessions') {
      return {
        ids: rows.map((row) => row.id),
        observed: rows.length,
        unlockedAt: rows[target - 1]?.date ?? null,
        sourceType: ProgressionSourceType.workout_session_completed,
      };
    }
    let observed = 0;
    let unlockedAt: Date | null = null;
    for (const row of rows) {
      observed += row.xp;
      if (!unlockedAt && observed >= target) unlockedAt = row.date;
    }
    return {
      ids: rows.map((row) => row.id),
      observed,
      unlockedAt,
      sourceType: ProgressionSourceType.workout_session_completed,
    };
  };
  for (const memberKey of historyMemberKeys) {
    const userId = ctx.state.userIds[memberKey];
    if (!userId) continue;
    for (const milestone of DYNAMIC_MILESTONES) {
      const milestoneId = milestoneIdByKey.get(milestone.key);
      if (!milestoneId) continue;
      const source = metricSource(userId, milestone.metric, milestone.target);
      const progressId = seedId(
        `milestone-progress:${memberKey}:${milestone.key}`,
      );
      const existing = await ctx.prisma.userMilestoneProgress.findUnique({
        where: {
          user_id_milestone_definition_id: {
            milestone_definition_id: milestoneId,
            user_id: userId,
          },
        },
        select: { id: true, status: true },
      });
      if (!canRewrite(existing?.id, progressId)) continue;
      const unlocked =
        source.observed >= milestone.target && source.unlockedAt !== null;
      await ctx.prisma.userMilestoneProgress.upsert({
        where: {
          user_id_milestone_definition_id: {
            milestone_definition_id: milestoneId,
            user_id: userId,
          },
        },
        update: {
          claimed_at: null,
          progress_payload: {
            actual_source_ids: source.ids,
            metric: milestone.metric,
            observed: source.observed,
            source: 'dynamic-seed',
            source_type: source.sourceType,
            target: milestone.target,
          },
          progress_value: source.observed,
          reward_granted_at: null,
          status: unlocked
            ? MilestoneProgressStatus.unlocked
            : MilestoneProgressStatus.in_progress,
          unlocked_at: unlocked ? source.unlockedAt : null,
        },
        create: {
          id: progressId,
          milestone_definition_id: milestoneId,
          progress_payload: {
            actual_source_ids: source.ids,
            metric: milestone.metric,
            observed: source.observed,
            source: 'dynamic-seed',
            source_type: source.sourceType,
            target: milestone.target,
          },
          progress_value: source.observed,
          status: unlocked
            ? MilestoneProgressStatus.unlocked
            : MilestoneProgressStatus.in_progress,
          unlocked_at: unlocked ? source.unlockedAt : null,
          user_id: userId,
        },
      });
    }
  }

  const evidenceMemberKeys = ctx.state.activeMemberKeys.slice(0, 3);
  for (const [index, memberKey] of evidenceMemberKeys.entries()) {
    const milestoneKey =
      DYNAMIC_MILESTONES[index % DYNAMIC_MILESTONES.length].key;
    const evidenceId = seedId(`milestone-evidence:${memberKey}:${index}`);
    const existingEvidence =
      await ctx.prisma.milestoneEvidenceSubmission.findUnique({
        where: { id: evidenceId },
        select: { id: true, created_at: true, status: true },
      });
    if (!existingEvidence || !canRewrite(existingEvidence.id, evidenceId))
      continue;
    const progressId = seedId(
      `milestone-progress:${memberKey}:${milestoneKey}`,
    );
    const progress = await ctx.prisma.userMilestoneProgress.findUnique({
      where: { id: progressId },
      select: { progress_value: true, status: true, unlocked_at: true },
    });
    const target =
      DYNAMIC_MILESTONES.find((milestone) => milestone.key === milestoneKey)
        ?.target ?? 0;
    const unlocked =
      (progress?.progress_value ?? 0) >= target &&
      (progress?.status === MilestoneProgressStatus.unlocked ||
        progress?.status === MilestoneProgressStatus.claimed);
    const nextStatus =
      unlocked &&
      existingEvidence.status === MilestoneEvidenceSubmissionStatus.approved
        ? MilestoneEvidenceSubmissionStatus.approved
        : existingEvidence.status === MilestoneEvidenceSubmissionStatus.rejected
          ? MilestoneEvidenceSubmissionStatus.rejected
          : MilestoneEvidenceSubmissionStatus.pending;
    await ctx.prisma.milestoneEvidenceSubmission.update({
      where: { id: evidenceId },
      data: {
        milestone_progress_id: progressId,
        reviewed_at:
          nextStatus === MilestoneEvidenceSubmissionStatus.pending
            ? null
            : (progress?.unlocked_at ?? existingEvidence.created_at),
        reviewed_by_user_id:
          nextStatus === MilestoneEvidenceSubmissionStatus.pending
            ? null
            : (ctx.state.userIds[ctx.state.adminKeys[0]] ?? null),
        status: nextStatus,
      },
    });
  }
}

export async function seedFitnessGamification(ctx: DynamicSeedContext) {
  await seedExerciseBackbone(ctx);
  await seedTrainingAndWorkouts(ctx);
  await seedGamification(ctx);
  await reconcileSeedGamification(ctx);

  ctx.notableIds.dynamicSeasonId =
    ctx.state.seasonId ?? seedId('season:dynamic-main');
  ctx.notableIds.demoPremiumTrainingPlanId = seedId(
    'training-plan:member-premium',
  );
  ctx.notableIds.demoPremiumWorkoutSessionId = seedId(
    'workout-session:member-premium:0',
  );

  return {
    counts: {
      exercises: CANONICAL_EXERCISE_CATALOG.length,
      trainingMembers: [
        ...ctx.state.activeMemberKeys,
        ...ctx.state.historicalMemberKeys,
      ].length,
    },
  };
}
