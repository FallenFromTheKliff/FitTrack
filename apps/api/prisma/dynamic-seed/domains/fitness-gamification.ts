import {
  AppointmentStatus,
  ExerciseCategory,
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
import {
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

export const POSE_PROFILE_EXERCISE_KEYS = CANONICAL_POSE_EXERCISE_KEYS;

export const LEGACY_POSE_PROFILE_EXERCISE_KEYS =
  CANONICAL_LEGACY_POSE_EXERCISE_KEYS;

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

  // Bench, deadlift, and row were previously seeded with guessed alternating
  // schemas. Retire only those deterministic seed rows; user-created profiles
  // remain untouched and existing sessions keep their foreign-key history.
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

  for (const account of ctx.state.accounts.filter(
    (candidate) =>
      candidate.role === 'admin' || historyMemberKeys.includes(candidate.key),
  )) {
    const userId = ctx.state.userIds[account.key];
    const memberIndex = memberKeys.indexOf(account.key);
    const points = account.role === 'admin' ? 0 : 150 + (memberIndex % 12) * 65;
    const totalXp = getRepresentativeLifetimeXp(account, memberIndex);
    await ctx.prisma.userProgressionProfile.upsert({
      where: { user_id: userId },
      update: {
        active_season_id: activeSeasonId,
        current_season_points: points,
        current_streak:
          account.memberPersona === 'premium' ? 7 : 1 + (points % 5),
        last_progressed_at: daysFrom(
          ctx.config.anchorDate,
          -1 - (points % 9),
          19,
        ),
        longest_streak:
          account.memberPersona === 'premium' ? 12 : 3 + (points % 8),
        total_xp: totalXp,
      },
      create: {
        id: seedId(`progression-profile:${account.key}`),
        active_season_id: activeSeasonId,
        current_season_points: points,
        current_streak:
          account.memberPersona === 'premium' ? 7 : 1 + (points % 5),
        last_progressed_at: daysFrom(
          ctx.config.anchorDate,
          -1 - (points % 9),
          19,
        ),
        longest_streak:
          account.memberPersona === 'premium' ? 12 : 3 + (points % 8),
        total_xp: totalXp,
        user_id: userId,
      },
    });
    await ctx.prisma.rankingProfile.upsert({
      where: { user_id: userId },
      update: {
        display_alias:
          account.role === 'admin'
            ? 'Admin Review'
            : `${account.firstName} ${account.lastName.charAt(0)}.`,
        governance_status:
          account.memberPersona === 'suspended'
            ? RankingGovernanceStatus.hidden_by_admin
            : RankingGovernanceStatus.normal,
        visibility: getSeedRankingVisibility(account),
      },
      create: {
        id: seedId(`ranking-profile:${account.key}`),
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
      },
    });
    await ctx.prisma.integrityProfile.upsert({
      where: { user_id: userId },
      update: {
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
      },
      create: {
        id: seedId(`integrity-profile:${account.key}`),
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
      },
    });
  }

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
        id: seedId(`season-standing:previous:${memberKey}`),
        is_disqualified: false,
        is_hidden: false,
        last_earned_at: daysFrom(ctx.config.anchorDate, -28 - (index % 8), 19),
        rank_position: index + 1,
        season_id: previousSeasonId,
        season_points: 840 - index * 7,
      },
    ];

    for (const standing of standings) {
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
        create: {
          ...standing,
          user_id: userId,
        },
      });
    }
  }

  for (const [memberIndex, memberKey] of historyMemberKeys.entries()) {
    for (const [muscleIndex, { key: muscle }] of activeMuscles.entries()) {
      const xpPoints = getRepresentativeMuscleXp(memberIndex, muscleIndex);
      const totalVolumeKg = new Prisma.Decimal(
        4_500 + memberIndex * 125 + muscleIndex * 300,
      );
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
          id: seedId(`mastery:${memberKey}:${muscle}`),
          last_ranked_at: daysFrom(ctx.config.anchorDate, -2 - muscleIndex, 20),
          muscle_group: muscle,
          rank: evaluateExpRank(xpPoints),
          total_volume_kg: totalVolumeKg,
          user_id: ctx.state.userIds[memberKey],
          xp_points: xpPoints,
        },
      });
    }
  }

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
            ...row,
            user_id: ctx.state.userIds[memberKey],
          },
        });
      }
    }
  }

  const completedWorkouts = await ctx.prisma.workoutSession.findMany({
    where: {
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
        const muscleTotals = muscleXpByUser.get(grant.user_id) ?? new Map();
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

  for (const progress of milestoneProgressRows) {
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
        sourceEventIdByUser.get(ctx.state.userIds[memberKey]) ?? null,
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
        sourceEventIdByUser.get(ctx.state.userIds[memberKey]) ?? null,
      target_user_id: ctx.state.userIds[memberKey],
    })),
    skipDuplicates: true,
  });
}

export async function seedFitnessGamification(ctx: DynamicSeedContext) {
  await seedExerciseBackbone(ctx);
  await seedTrainingAndWorkouts(ctx);
  await seedGamification(ctx);

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
