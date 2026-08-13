import {
  CreatorState,
  ExerciseCategory,
  ExerciseReviewSubmissionStatus,
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
import type { DynamicSeedContext, SeedAccount } from '../types';
import {
  activityDateFor,
  isMonthlyCoachingMember,
  memberAccessWindow,
  memberVolumeCount,
} from '../volumes';
import {
  DEFAULT_MILESTONE_ICON_KEY,
  DEFAULT_MUSCLE_ICON_KEY,
  evaluateExpRank,
} from '../../../src/fitness/gamification/gamification.constants';

const EXERCISE_SEEDS = [
  {
    key: 'squat',
    category: ExerciseCategory.strength,
    description:
      'Compound lower-body lift for quads, glutes, and trunk control.',
    muscleGroup: 'quads',
    name: 'Barbell Back Squat',
  },
  {
    key: 'bench',
    category: ExerciseCategory.strength,
    description: 'Horizontal press pattern for chest, shoulders, and triceps.',
    muscleGroup: 'chest',
    name: 'Dumbbell Bench Press',
  },
  {
    key: 'barbell-bench',
    category: ExerciseCategory.strength,
    description:
      'Classic horizontal barbell press for chest and triceps strength.',
    muscleGroup: 'chest',
    name: 'Barbell Bench Press',
  },
  {
    key: 'incline-dumbbell-press',
    category: ExerciseCategory.strength,
    description: 'Incline chest press emphasizing upper chest and front delts.',
    muscleGroup: 'upper chest',
    name: 'Incline Dumbbell Press',
  },
  {
    key: 'cable-fly',
    category: ExerciseCategory.strength,
    description: 'Cable chest isolation movement with constant tension.',
    muscleGroup: 'chest',
    name: 'Cable Fly',
  },
  {
    key: 'shoulder-press',
    category: ExerciseCategory.strength,
    description:
      'Vertical press pattern for shoulders, triceps, and trunk stability.',
    muscleGroup: 'shoulders',
    name: 'Seated Dumbbell Shoulder Press',
  },
  {
    key: 'lateral-raise',
    category: ExerciseCategory.strength,
    description: 'Shoulder isolation movement for side-delt development.',
    muscleGroup: 'shoulders',
    name: 'Dumbbell Lateral Raise',
  },
  {
    key: 'lat-pulldown',
    category: ExerciseCategory.strength,
    description: 'Vertical pull pattern for lats and upper-back strength.',
    muscleGroup: 'lats',
    name: 'Lat Pulldown',
  },
  {
    key: 'barbell-row',
    category: ExerciseCategory.strength,
    description: 'Free-weight horizontal pull for back thickness and bracing.',
    muscleGroup: 'upper back',
    name: 'Barbell Row',
  },
  {
    key: 'leg-press',
    category: ExerciseCategory.strength,
    description: 'Machine lower-body press for quad and glute volume.',
    muscleGroup: 'quads',
    name: 'Leg Press',
  },
  {
    key: 'leg-extension',
    category: ExerciseCategory.strength,
    description: 'Machine knee-extension isolation for quad hypertrophy.',
    muscleGroup: 'quads',
    name: 'Leg Extension',
  },
  {
    key: 'seated-leg-curl',
    category: ExerciseCategory.strength,
    description: 'Machine hamstring curl for posterior-chain accessory work.',
    muscleGroup: 'hamstrings',
    name: 'Seated Leg Curl',
  },
  {
    key: 'calf-raise',
    category: ExerciseCategory.strength,
    description: 'Calf isolation movement for lower-leg strength and volume.',
    muscleGroup: 'calves',
    name: 'Standing Calf Raise',
  },
  {
    key: 'biceps-curl',
    category: ExerciseCategory.strength,
    description: 'Elbow-flexion accessory for biceps development.',
    muscleGroup: 'biceps',
    name: 'Dumbbell Biceps Curl',
  },
  {
    key: 'hammer-curl',
    category: ExerciseCategory.strength,
    description: 'Neutral-grip curl emphasizing brachialis and forearms.',
    muscleGroup: 'biceps',
    name: 'Hammer Curl',
  },
  {
    key: 'triceps-pushdown',
    category: ExerciseCategory.strength,
    description: 'Cable elbow-extension accessory for triceps volume.',
    muscleGroup: 'triceps',
    name: 'Cable Triceps Pushdown',
  },
  {
    key: 'rope-face-pull',
    category: ExerciseCategory.strength,
    description: 'Cable upper-back and rear-delt movement for shoulder health.',
    muscleGroup: 'rear delts',
    name: 'Rope Face Pull',
  },
  {
    key: 'hip-thrust',
    category: ExerciseCategory.strength,
    description:
      'Glute-dominant hip extension movement for lower-body strength.',
    muscleGroup: 'glutes',
    name: 'Barbell Hip Thrust',
  },
  {
    key: 'split-squat',
    category: ExerciseCategory.strength,
    description: 'Unilateral leg movement for quads, glutes, and balance.',
    muscleGroup: 'quads',
    name: 'Bulgarian Split Squat',
  },
  {
    key: 'cable-crunch',
    category: ExerciseCategory.strength,
    description: 'Loaded trunk-flexion accessory for abdominal strength.',
    muscleGroup: 'core',
    name: 'Cable Crunch',
  },
  {
    key: 'deadlift',
    category: ExerciseCategory.strength,
    description: 'Posterior-chain hinge pattern for strength blocks.',
    muscleGroup: 'hamstrings',
    name: 'Romanian Deadlift',
  },
  {
    key: 'row',
    category: ExerciseCategory.strength,
    description: 'Upper-body pull for lats and upper-back development.',
    muscleGroup: 'lats',
    name: 'Seated Cable Row',
  },
  {
    key: 'push-up',
    category: ExerciseCategory.strength,
    description: 'Bodyweight press with core stiffness and shoulder control.',
    muscleGroup: 'chest',
    name: 'Push Up',
  },
  {
    key: 'run',
    category: ExerciseCategory.cardio,
    description: 'Steady-state conditioning for aerobic base work.',
    muscleGroup: 'cardio',
    name: 'Treadmill Run',
  },
  {
    key: 'plank',
    category: ExerciseCategory.balance,
    description: 'Anti-extension core endurance and trunk control.',
    muscleGroup: 'core',
    name: 'Forearm Plank',
  },
  {
    key: 'mobility-flow',
    category: ExerciseCategory.flexibility,
    description:
      'Recovery sequence for hips, shoulders, and thoracic rotation.',
    muscleGroup: 'mobility',
    name: 'Mobility Flow',
  },
] as const;

const POSE_PROFILE_EXERCISE_KEYS = [
  'squat',
  'bench',
  'barbell-bench',
  'deadlift',
  'row',
  'push-up',
] as const;

const MUSCLE_DEFINITIONS = [
  ['chest', 'Chest', 'upper_body_push'],
  ['quads', 'Quads', 'lower_body'],
  ['hamstrings', 'Hamstrings', 'lower_body'],
  ['glutes', 'Glutes', 'lower_body'],
  ['lats', 'Lats', 'upper_body_pull'],
  ['core', 'Core', 'core'],
  ['shoulders', 'Shoulders', 'shoulders'],
  ['cardio', 'Cardio', 'conditioning'],
  ['mobility', 'Mobility', 'recovery'],
] as const;

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
  for (const [index, [key, name, bodyRegion]] of MUSCLE_DEFINITIONS.entries()) {
    await ctx.prisma.muscleDefinition.upsert({
      where: { key },
      update: {
        aliases: [name.toLowerCase(), key],
        body_region: bodyRegion,
        icon_asset_key: null,
        icon_key: DEFAULT_MUSCLE_ICON_KEY,
        icon_kind: ProgressionIconKind.library,
        is_active: true,
        is_system: true,
        name,
        sort_order: 10 + index,
      },
      create: {
        id: seedId(`muscle-definition:${key}`),
        aliases: [name.toLowerCase(), key],
        body_region: bodyRegion,
        icon_asset_key: null,
        icon_key: DEFAULT_MUSCLE_ICON_KEY,
        icon_kind: ProgressionIconKind.library,
        is_active: true,
        is_system: true,
        key,
        name,
        sort_order: 10 + index,
      },
    });
  }

  for (const exercise of EXERCISE_SEEDS) {
    const exerciseId = seedId(`exercise:${exercise.key}`);
    ctx.state.exerciseIds[exercise.key] = exerciseId;
    await ctx.prisma.exerciseCatalog.upsert({
      where: { id: exerciseId },
      update: {
        category: exercise.category,
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
        category: exercise.category,
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
    const exercise = EXERCISE_SEEDS.find((candidate) => candidate.key === key);
    if (!exercise) {
      throw new Error(`Missing seeded pose exercise "${key}".`);
    }
    return exercise;
  });

  await ctx.prisma.poseExerciseProfile.createMany({
    data: poseProfileExercises.map((exercise, index) => ({
      id: seedId(`pose-profile:${exercise.key}`),
      angle_signature: {
        bottom: { elbow: [70, 110], hip: [70, 110], knee: [70, 110] },
        top: { elbow: [145, 180], hip: [145, 180], knee: [145, 180] },
      },
      canonical_name: exercise.name.toLowerCase(),
      confidence_threshold: new Prisma.Decimal('0.720'),
      dominant_joint: index % 2 === 0 ? 'knee' : 'elbow',
      exercise_id: ctx.state.exerciseIds[exercise.key],
      landmark_signature: {
        anchors: ['shoulder', 'hip', 'knee', 'ankle'],
        source: 'dynamic-seed',
      },
      movement_pattern: {
        oscillating_landmarks: ['left_knee', 'right_knee'],
        tracked_joint:
          index % 2 === 0 ? 'hip_knee_ankle' : 'shoulder_elbow_wrist',
      },
      orientation_signature: {
        body_orientation: index % 2 === 0 ? 'upright' : 'horizontal',
      },
      profile_kind: PoseProfileKind.seed,
      rep_rules: { count: 'phase_crossing', minimum_visibility: 0.45 },
      rep_thresholds: { down: 0.32, up: 0.78 },
      sample_count: 15 + index,
      tolerance: new Prisma.Decimal('8.50'),
      visibility_pattern: {
        min_visibility: 0.45,
        required_landmarks: ['left_shoulder', 'right_shoulder'],
      },
    })),
    skipDuplicates: true,
  });
}

type SeedPlanExerciseDescriptor = {
  dayOfWeek: number;
  durationSeconds: number | null;
  exerciseId: string;
  exerciseKey: string;
  planExerciseId: string;
  reps: number | null;
  scheduleDayId: string;
  sets: number;
  weightKg: number | null;
};

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
  const coachKeys = ctx.state.coachAccountKeys;
  const coachedMemberKeys = new Set(
    memberKeys.filter((memberKey) => isMonthlyCoachingMember(ctx, memberKey)),
  );
  const exerciseKeys = EXERCISE_SEEDS.map((exercise) => exercise.key);
  const scheduleRows: Prisma.TrainingScheduleDayCreateManyInput[] = [];
  const planExerciseRows: Prisma.PlanExerciseCreateManyInput[] = [];
  const sessionRows: Prisma.WorkoutSessionCreateManyInput[] = [];
  const exerciseLogRows: Prisma.ExerciseLogCreateManyInput[] = [];
  const poseRows: Prisma.PoseSessionCreateManyInput[] = [];
  const reviewRows: Prisma.ExerciseReviewSubmissionCreateManyInput[] = [];
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
    // Luca is the demo member used in the member portal walkthrough. Keep this
    // explicit so her active PPL plan is always a real Seed Coach assignment,
    // rather than an AI draft that happens to share the same title.
    const isLucaDemoMember = memberKey === 'member-premium';
    const isQaOneTimeMember = memberKey === 'member-active';
    const coachKey = isLucaDemoMember || isQaOneTimeMember
      ? 'coach'
      : coachKeys[memberIndex % coachKeys.length];
    const activePlanId = seedId(`training-plan:${memberKey}`);
    const planCreatedAt = daysFrom(
      memberAccessWindow(ctx, memberKey).startsAt ?? ctx.config.anchorDate,
      -7,
      8,
    );

    for (
      let presetIndex = 0;
      presetIndex < presetsPerMember;
      presetIndex += 1
    ) {
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
            style:
              presetIndex === 0
                ? 'ppl-rest-ppl'
                : presetIndex === 1
                  ? 'upper-lower'
                  : 'conditioning',
          },
          coach_id:
            source === PlanSource.coach_assigned
              ? ctx.state.userIds[coachKey]
              : null,
          days_per_week: presetIndex === 2 ? 4 : 3,
          duration_weeks:
            presetIndex === 0 && isQaOneTimeMember ? 1 : 8,
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
            presetIndex === 0
              ? 'Active PPL Rest Split'
              : presetIndex === 1
                ? 'Upper Lower Backup Split'
                : 'Conditioning Preset',
          created_at: planCreatedAt,
        },
        create: {
          id: planId,
          ai_generation_prompt: {
            memberKey,
            presetIndex,
            source: 'dynamic-seed',
            style:
              presetIndex === 0
                ? 'ppl-rest-ppl'
                : presetIndex === 1
                  ? 'upper-lower'
                  : 'conditioning',
          },
          coach_id:
            source === PlanSource.coach_assigned
              ? ctx.state.userIds[coachKey]
              : null,
          days_per_week: presetIndex === 2 ? 4 : 3,
          duration_weeks:
            presetIndex === 0 && isQaOneTimeMember ? 1 : 8,
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
            presetIndex === 0
              ? 'Active PPL Rest Split'
              : presetIndex === 1
                ? 'Upper Lower Backup Split'
                : 'Conditioning Preset',
          created_at: planCreatedAt,
          user_id: userId,
        },
      });

      const populatedWeeks = isLucaDemoMember
        ? 8
        : isQaOneTimeMember
          ? 1
          : 1;
      for (let weekNumber = 1; weekNumber <= populatedWeeks; weekNumber += 1) {
        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
          const isRestDay =
            presetIndex === 0 ? dayIndex === 3 : dayIndex % 3 === 2;
          const weekSuffix = weekNumber === 1 ? '' : `:week:${weekNumber}`;
          const scheduleDayId = seedId(
            `schedule-day:${memberKey}:${presetIndex}:${dayIndex}${weekSuffix}`,
          );
          scheduleRows.push({
            id: scheduleDayId,
            day_of_week: dayIndex,
            focus_label: isRestDay
              ? 'Rest'
              : presetIndex === 0
                ? ['Push', 'Pull', 'Legs', 'Rest', 'Push', 'Pull', 'Legs'][
                    dayIndex
                  ]
                : dayIndex % 2 === 0
                  ? 'Upper'
                  : 'Lower',
            notes: isRestDay
              ? 'Rest day in the recurring weekly split.'
              : 'Training day prepared for plan detail review.',
            plan_id: planId,
            created_at: planCreatedAt,
            week_number: weekNumber,
          });

          if (isRestDay) {
            continue;
          }

          for (let orderIndex = 0; orderIndex < 3; orderIndex += 1) {
            const exerciseKey =
              exerciseKeys[
                (memberIndex + presetIndex + dayIndex + orderIndex) %
                  exerciseKeys.length
              ];
            const planExerciseId = seedId(
              `plan-exercise:${memberKey}:${presetIndex}:${dayIndex}:${orderIndex}${weekSuffix}`,
            );
            const reps = exerciseKey === 'run' ? null : 8 + orderIndex * 2;
            const sets = exerciseKey === 'run' ? 1 : 3;
            const durationSeconds =
              exerciseKey === 'run' || exerciseKey === 'plank'
                ? 600 + orderIndex * 60
                : null;
            const weightKg =
              exerciseKey === 'run' || exerciseKey === 'plank'
                ? null
                : 25 + memberIndex + orderIndex * 5;
            planExerciseRows.push({
              id: planExerciseId,
              duration_seconds: durationSeconds,
              exercise_id: ctx.state.exerciseIds[exerciseKey],
              notes: 'Plan exercise with realistic set prescription.',
              order_index: orderIndex,
              reps,
              rest_seconds: exerciseKey === 'run' ? 90 : 75,
              schedule_day_id: scheduleDayId,
              sets,
              weight_kg_target:
                weightKg == null ? null : new Prisma.Decimal(weightKg),
              created_at: planCreatedAt,
            });

            if (presetIndex === 0) {
              const activePlanExercises =
                activePlanExercisesByMember.get(memberKey) ?? [];
              activePlanExercises.push({
                dayOfWeek: dayIndex,
                durationSeconds,
                exerciseId: ctx.state.exerciseIds[exerciseKey],
                exerciseKey,
                planExerciseId,
                reps,
                scheduleDayId,
                sets,
                weightKg,
              });
              activePlanExercisesByMember.set(memberKey, activePlanExercises);
            }
          }
        }
      }
    }

    const activePlanExercises =
      activePlanExercisesByMember.get(memberKey) ?? [];
    const activePlanDays = [
      ...activePlanExercises.reduce<Map<string, SeedPlanExerciseDescriptor[]>>(
        (days, exercise) => {
          const dayExercises = days.get(exercise.scheduleDayId) ?? [];
          dayExercises.push(exercise);
          days.set(exercise.scheduleDayId, dayExercises);
          return days;
        },
        new Map(),
      ),
    ].map(([, dayExercises]) => dayExercises);
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
    let exerciseLogsCreated = 0;

    for (
      let sessionIndex = 0;
      sessionIndex < sessionsForMember;
      sessionIndex += 1
    ) {
      const selectedExercises = isLucaDemoMember
        ? activePlanDays[sessionIndex % activePlanDays.length]
        : ctx.rng.pick(activePlanDays);
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
      const durationSeconds = ctx.rng.int(2_400, 4_500);
      const completedAt = new Date(
        startedAt.getTime() + durationSeconds * 1_000,
      );
      let totalVolumeKg = 0;
      const firstLogIdByExercise = new Map<string, string>();

      for (const [exerciseIndex, exercise] of selectedExercises.entries()) {
        const performanceDelta = isLucaDemoMember
          ? 2
          : ctx.rng.pick([-1, 0, 0, 1, 1, 2]);
        const completedReps =
          exercise.reps == null
            ? null
            : Math.max(1, exercise.reps + performanceDelta);
        const completedWeightKg =
          exercise.weightKg == null
            ? null
            : Math.max(
                1,
                exercise.weightKg +
                  (isLucaDemoMember ? 0 : ctx.rng.pick([-1, 0, 0, 1])),
              );

        for (let setIndex = 0; setIndex < exercise.sets; setIndex += 1) {
          if (exerciseLogsCreated >= exerciseLogBudget) {
            continue;
          }
          const exerciseLogId = seedId(
            `exercise-log:${memberKey}:${sessionIndex}:${exercise.planExerciseId}:${setIndex}`,
          );
          firstLogIdByExercise.set(
            exercise.exerciseId,
            firstLogIdByExercise.get(exercise.exerciseId) ?? exerciseLogId,
          );
          exerciseLogRows.push({
            id: exerciseLogId,
            created_at: new Date(
              startedAt.getTime() +
                (10 + exerciseIndex * 12 + setIndex * 3) * 60_000,
            ),
            duration_seconds:
              completedReps == null ? exercise.durationSeconds : null,
            exercise_id: exercise.exerciseId,
            plan_exercise_id: exercise.planExerciseId,
            reps_ai_counted: completedReps,
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
          exerciseLogsCreated += 1;

          if (completedWeightKg != null && completedReps != null) {
            totalVolumeKg += completedWeightKg * completedReps;
          }
        }
      }

      sessionRows.push({
        id: sessionId,
        completed_at: completedAt,
        created_at: daysFrom(startedAt, -1, 9),
        duration_seconds: durationSeconds,
        last_activity_at: completedAt,
        plan_id: activePlanId,
        started_at: startedAt,
        status: SessionStatus.completed,
        total_volume_kg: new Prisma.Decimal(totalVolumeKg),
        user_id: userId,
      });

      const poseExercise = selectedExercises.find((exercise) =>
        poseProfileKeyByExerciseId.has(exercise.exerciseId),
      );
      const profileKey = poseExercise
        ? poseProfileKeyByExerciseId.get(poseExercise.exerciseId)
        : undefined;
      const poseExerciseLogId = poseExercise
        ? firstLogIdByExercise.get(poseExercise.exerciseId)
        : undefined;

      if (poseExercise && profileKey && poseExerciseLogId) {
        const poseSessionId = seedId(
          `pose-session:${memberKey}:${sessionIndex}`,
        );
        const countedReps = poseExercise.reps ?? ctx.rng.int(8, 15);
        poseRows.push({
          id: poseSessionId,
          analysis_summary: {
            countedReps,
            issues: memberIndex % 5 === 0 ? ['depth variance'] : [],
            source: 'dynamic-seed',
          },
          classification_confidence: new Prisma.Decimal('0.810'),
          confidence_avg: new Prisma.Decimal('0.840'),
          detected_exercise_name: profileKey,
          detected_profile_id: seedId(`pose-profile:${profileKey}`),
          ended_at: completedAt,
          exercise_hint: poseExercise.exerciseKey,
          exercise_log_id: poseExerciseLogId,
          rep_count_ai: countedReps,
          started_at: startedAt,
          subject_lock_confidence: new Prisma.Decimal('0.780'),
          user_id: userId,
        });

        if (memberIndex < 8 && sessionIndex === 1) {
          reviewRows.push({
            id: seedId(`exercise-review:${memberKey}`),
            category: ExerciseCategory.strength,
            description:
              'Movement submitted from pose finalization for admin review.',
            evidence_bars: [
              { label: 'visibility', value: 0.82 },
              { label: 'phase', value: 0.77 },
            ],
            hand_shape_profile: { grip: 'neutral' },
            instructions:
              'Review movement and map it to the current exercise catalog.',
            match_hint: `Looks close to the seeded ${profileKey} profile.`,
            movement_profile: { pattern: 'seeded_history_movement' },
            muscle_group: 'general',
            muscle_targets: ['primary'],
            origin_label: 'client custom',
            pose_session_id: poseSessionId,
            proposed_name: `Review ${profileKey}`,
            published_exercise_id:
              memberIndex % 3 === 0 ? poseExercise.exerciseId : null,
            queue_tag: 'needs match',
            review_notes:
              memberIndex % 3 === 0
                ? 'Mapped to an exercise selected from the current catalog.'
                : null,
            reviewed_at:
              memberIndex % 3 === 0
                ? daysFrom(ctx.config.anchorDate, -2, 12)
                : null,
            source_label: 'detected workout movement',
            status:
              memberIndex % 3 === 0
                ? ExerciseReviewSubmissionStatus.published
                : ExerciseReviewSubmissionStatus.pending,
            summary: 'Seeded movement review backed by workout history.',
            title: 'Review seeded workout movement',
            trigger_label: 'history fixture review',
            user_id: userId,
          });
        }
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
  await ctx.prisma.exerciseReviewSubmission.createMany({
    data: reviewRows,
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
    await ctx.prisma.creatorProfile.upsert({
      where: { user_id: userId },
      update: {
        admin_notes:
          account.memberPersona === 'premium'
            ? 'Premium member candidate for creator review.'
            : null,
        last_state_changed_at:
          account.memberPersona === 'premium'
            ? daysFrom(ctx.config.anchorDate, -3, 10)
            : null,
        state:
          account.memberPersona === 'premium'
            ? CreatorState.candidate
            : CreatorState.none,
      },
      create: {
        id: seedId(`creator-profile:${account.key}`),
        admin_notes:
          account.memberPersona === 'premium'
            ? 'Premium member candidate for creator review.'
            : null,
        last_state_changed_at:
          account.memberPersona === 'premium'
            ? daysFrom(ctx.config.anchorDate, -3, 10)
            : null,
        state:
          account.memberPersona === 'premium'
            ? CreatorState.candidate
            : CreatorState.none,
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
      user_id: { in: historyMemberKeys.map((memberKey) => ctx.state.userIds[memberKey]) },
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
    return [{
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
    }];
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
        id: seedId(`progression-grant:${source.workoutId}:xp`),
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
        id: seedId(`progression-grant:${source.workoutId}:season`),
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
        where: { source_event_id: { in: sourceRows.map((source) => source.id) } },
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

    const muscleTotals = muscleXpByUser.get(userId) ?? new Map<string, number>();
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
    const muscleTotals = muscleXpByUser.get(userId) ?? new Map<string, number>();
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
  const milestoneProgressRows = historyMemberKeys
    .flatMap((memberKey, index) =>
      milestoneKeys.map((milestoneKey, milestoneIndex) => {
        const milestone = DYNAMIC_MILESTONES[milestoneIndex];
        const isLifetimeXpMilestone = milestone.metric === 'total_xp';
        const lifetimeXp =
          totalXpByUser.get(ctx.state.userIds[memberKey]) ?? 0;
        const progressValue =
          milestone.metric === 'completed_workout_sessions'
            ? completedWorkoutCountByUser.get(ctx.state.userIds[memberKey]) ?? 0
            : isLifetimeXpMilestone
              ? lifetimeXp
              : milestoneIndex === 1
                ? Math.min(milestone.target, index % 5)
                : index % 2;
        const automaticallyUnlocked =
          progressValue >= milestone.target;
        const isClaimed =
          milestoneIndex === 0 || (automaticallyUnlocked && index % 3 === 0);

        return {
          id: seedId(`milestone-progress:${memberKey}:${milestoneKey}`),
          claimed_at: isClaimed
            ? daysFrom(ctx.config.anchorDate, -1, 10)
            : null,
          milestone_definition_id: seedId(
            `milestone-definition:${milestoneKey}`,
          ),
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
      source_event_id: sourceEventIdByUser.get(ctx.state.userIds[memberKey]) ?? null,
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
      source_event_id: sourceEventIdByUser.get(ctx.state.userIds[memberKey]) ?? null,
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
      exercises: EXERCISE_SEEDS.length,
      trainingMembers: [
        ...ctx.state.activeMemberKeys,
        ...ctx.state.historicalMemberKeys,
      ].length,
    },
  };
}
