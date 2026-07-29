import {
  CreatorState,
  ExerciseCategory,
  ExerciseReviewSubmissionStatus,
  FitnessGoal,
  IntegrityCaseStatus,
  IntegrityRiskLevel,
  MasteryRank,
  MilestoneCategory,
  MilestoneDefinitionStatus,
  MilestoneEvidenceRequirement,
  MilestoneProgressStatus,
  MilestoneTriggerType,
  MilestoneVerificationPolicy,
  ModerationActionType,
  PlanSource,
  PoseProfileKind,
  Prisma,
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
import { dateInsideRange, daysFrom } from '../time';
import type { DynamicSeedContext } from '../types';

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
    description: 'Classic horizontal barbell press for chest and triceps strength.',
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
    description: 'Vertical press pattern for shoulders, triceps, and trunk stability.',
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
    description: 'Glute-dominant hip extension movement for lower-body strength.',
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
    title: 'Premium First Block',
    trigger: MilestoneTriggerType.summary_threshold,
  },
  {
    key: 'dynamic-booking-regular',
    category: MilestoneCategory.booking,
    description: 'Complete seeded amenity bookings without no-shows.',
    title: 'Booking Regular',
    trigger: MilestoneTriggerType.summary_threshold,
  },
  {
    key: 'dynamic-coach-accountability',
    category: MilestoneCategory.coaching,
    description: 'Complete coaching sessions and keep feedback visible.',
    title: 'Coach Accountability',
    trigger: MilestoneTriggerType.source_event,
  },
] as const;

async function seedExerciseBackbone(ctx: DynamicSeedContext) {
  for (const [index, [key, name, bodyRegion]] of MUSCLE_DEFINITIONS.entries()) {
    await ctx.prisma.muscleDefinition.upsert({
      where: { key },
      update: {
        aliases: [name.toLowerCase(), key],
        body_region: bodyRegion,
        is_active: true,
        is_system: true,
        name,
        sort_order: 10 + index,
      },
      create: {
        id: seedId(`muscle-definition:${key}`),
        aliases: [name.toLowerCase(), key],
        body_region: bodyRegion,
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

async function seedTrainingAndWorkouts(ctx: DynamicSeedContext) {
  const memberKeys = ctx.state.premiumMemberKeys.slice(0, 36);
  const coachKeys = ctx.state.coachAccountKeys;
  const exerciseKeys = EXERCISE_SEEDS.map((exercise) => exercise.key);
  const scheduleRows: Prisma.TrainingScheduleDayCreateManyInput[] = [];
  const planExerciseRows: Prisma.PlanExerciseCreateManyInput[] = [];
  const sessionRows: Prisma.WorkoutSessionCreateManyInput[] = [];
  const exerciseLogRows: Prisma.ExerciseLogCreateManyInput[] = [];
  const poseRows: Prisma.PoseSessionCreateManyInput[] = [];
  const reviewRows: Prisma.ExerciseReviewSubmissionCreateManyInput[] = [];
  const sessionsPerMember =
    ctx.config.workoutDensity === 'low'
      ? 2
      : ctx.config.workoutDensity === 'high'
        ? 10
        : 5;
  const presetsPerMember = ctx.config.splitPresetsPerMember;

  for (const [memberIndex, memberKey] of memberKeys.entries()) {
    const userId = ctx.state.userIds[memberKey];
    const coachKey = coachKeys[memberIndex % coachKeys.length];
    const activePlanId = seedId(`training-plan:${memberKey}`);

    for (let presetIndex = 0; presetIndex < presetsPerMember; presetIndex += 1) {
      const planId =
        presetIndex === 0
          ? activePlanId
          : seedId(`training-plan:${memberKey}:preset:${presetIndex}`);
      const source =
        memberIndex % 2 === 0
          ? PlanSource.coach_assigned
          : presetIndex === 0
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
          duration_weeks: 8,
          goal:
            memberIndex % 3 === 0
              ? FitnessGoal.bulking
              : memberIndex % 3 === 1
                ? FitnessGoal.cutting
                : FitnessGoal.maintenance,
          is_active: presetIndex === 0,
          is_template: false,
          source,
          title:
            presetIndex === 0
              ? 'Active PPL Rest Split'
              : presetIndex === 1
                ? 'Upper Lower Backup Split'
                : 'Conditioning Preset',
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
          duration_weeks: 8,
          goal:
            memberIndex % 3 === 0
              ? FitnessGoal.bulking
              : memberIndex % 3 === 1
                ? FitnessGoal.cutting
                : FitnessGoal.maintenance,
          is_active: presetIndex === 0,
          is_template: false,
          source,
          title:
            presetIndex === 0
              ? 'Active PPL Rest Split'
              : presetIndex === 1
                ? 'Upper Lower Backup Split'
                : 'Conditioning Preset',
          user_id: userId,
        },
      });

      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const isRestDay =
          presetIndex === 0 ? dayIndex === 3 : dayIndex % 3 === 2;
        const scheduleDayId = seedId(
          `schedule-day:${memberKey}:${presetIndex}:${dayIndex}`,
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
          week_number: 1,
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
          planExerciseRows.push({
            id: seedId(
              `plan-exercise:${memberKey}:${presetIndex}:${dayIndex}:${orderIndex}`,
            ),
            duration_seconds:
              exerciseKey === 'run' || exerciseKey === 'plank'
                ? 600 + orderIndex * 60
                : null,
            exercise_id: ctx.state.exerciseIds[exerciseKey],
            notes: 'Plan exercise with realistic set prescription.',
            order_index: orderIndex,
            reps: exerciseKey === 'run' ? null : 8 + orderIndex * 2,
            rest_seconds: exerciseKey === 'run' ? 90 : 75,
            schedule_day_id: scheduleDayId,
            sets: exerciseKey === 'run' ? 1 : 3,
            weight_kg_target:
              exerciseKey === 'run' || exerciseKey === 'plank'
                ? null
                : new Prisma.Decimal(25 + memberIndex + orderIndex * 5),
          });
        }
      }
    }

    for (let sessionIndex = 0; sessionIndex < sessionsPerMember; sessionIndex += 1) {
      const sessionId = seedId(`workout-session:${memberKey}:${sessionIndex}`);
      const startedAt = dateInsideRange(
        ctx.config.historyStartDate,
        ctx.config.historyEndDate,
        (memberIndex + sessionIndex + 1) /
          (memberKeys.length + sessionsPerMember + 2),
        17,
      );
      sessionRows.push({
        id: sessionId,
        completed_at: daysFrom(startedAt, 0, startedAt.getHours() + 1, 10),
        duration_seconds: 3600 + memberIndex * 20,
        last_activity_at: daysFrom(startedAt, 0, startedAt.getHours() + 1, 10),
        plan_id: activePlanId,
        started_at: startedAt,
        status: SessionStatus.completed,
        total_volume_kg: new Prisma.Decimal(
          1800 + memberIndex * 42 + sessionIndex * 100,
        ),
        user_id: userId,
      });

      for (let setIndex = 0; setIndex < 3; setIndex += 1) {
        const exerciseKey =
          exerciseKeys[(memberIndex + setIndex + setIndex) % exerciseKeys.length];
        const exerciseLogId = seedId(
          `exercise-log:${memberKey}:${sessionIndex}:${setIndex}`,
        );
        const planExerciseId = seedId(
          `plan-exercise:${memberKey}:0:${setIndex}:${setIndex}`,
        );
        exerciseLogRows.push({
          id: exerciseLogId,
          created_at: daysFrom(
            startedAt,
            0,
            startedAt.getHours(),
            15 + setIndex * 10,
          ),
          duration_seconds: exerciseKey === 'run' ? 900 : null,
          exercise_id: ctx.state.exerciseIds[exerciseKey],
          plan_exercise_id: planExerciseId,
          reps_ai_counted: exerciseKey === 'run' ? null : 8 + setIndex,
          reps_completed: exerciseKey === 'run' ? null : 8 + setIndex,
          reps_target: exerciseKey === 'run' ? null : 10,
          session_id: sessionId,
          set_number: setIndex + 1,
          user_id: userId,
          weight_kg:
            exerciseKey === 'run' || exerciseKey === 'plank'
              ? null
              : new Prisma.Decimal(22.5 + memberIndex + setIndex * 5),
        });

        if (setIndex === 0) {
          const poseSessionId = seedId(
            `pose-session:${memberKey}:${sessionIndex}`,
          );
          const profileKey = POSE_PROFILE_EXERCISE_KEYS.some(
            (profileExerciseKey) => profileExerciseKey === exerciseKey,
          )
            ? exerciseKey
            : 'push-up';
          poseRows.push({
            id: poseSessionId,
            analysis_summary: {
              countedReps: 8 + sessionIndex,
              issues: memberIndex % 5 === 0 ? ['depth variance'] : [],
              source: 'dynamic-seed',
            },
            classification_confidence: new Prisma.Decimal('0.810'),
            confidence_avg: new Prisma.Decimal('0.840'),
            detected_exercise_name: profileKey,
            detected_profile_id: seedId(`pose-profile:${profileKey}`),
            ended_at: daysFrom(startedAt, 0, startedAt.getHours(), 30),
            exercise_hint: exerciseKey,
            exercise_log_id: exerciseLogId,
            rep_count_ai: 8 + sessionIndex,
            started_at: startedAt,
            subject_lock_confidence: new Prisma.Decimal('0.780'),
            user_id: userId,
          });

          if (memberIndex < 8 && sessionIndex === 1) {
            reviewRows.push({
              id: seedId(`exercise-review:${memberKey}`),
              category: ExerciseCategory.strength,
              description:
                'Unknown movement submitted from pose finalization for admin review.',
              evidence_bars: [
                { label: 'visibility', value: 0.82 },
                { label: 'phase', value: 0.77 },
              ],
              hand_shape_profile: { grip: 'neutral' },
              instructions:
                'Review movement, map to existing catalog, or publish as new.',
              match_hint: 'Looks close to push-up pattern.',
              movement_profile: { pattern: 'bodyweight_press' },
              muscle_group: 'chest',
              muscle_targets: ['chest', 'triceps'],
              origin_label: 'client custom',
              pose_session_id: poseSessionId,
              proposed_name: 'Incline Push Pattern',
              published_exercise_id:
                memberIndex % 3 === 0 ? ctx.state.exerciseIds['push-up'] : null,
              queue_tag: 'needs match',
              review_notes:
                memberIndex % 3 === 0
                  ? 'Published to push-up catalog during seeded review.'
                  : null,
              reviewed_at:
                memberIndex % 3 === 0
                  ? daysFrom(ctx.config.anchorDate, -2, 12)
                  : null,
              source_label: 'detected unknown movement',
              status:
                memberIndex % 3 === 0
                  ? ExerciseReviewSubmissionStatus.published
                  : ExerciseReviewSubmissionStatus.pending,
              summary:
                'Unknown bodyweight press pattern with solid visibility.',
              title: 'Review seeded bodyweight press',
              trigger_label: 'unknown after 3 reps',
              user_id: userId,
            });
          }
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
  const activeSeasonId = seedId('season:dynamic-main');
  const previousSeasonId = seedId('season:dynamic-previous');
  const upcomingSeasonId = seedId('season:dynamic-upcoming');
  ctx.state.seasonId = activeSeasonId;
  const memberKeys = ctx.state.memberKeys;
  const activeMemberKeys = ctx.state.activeMemberKeys;
  const adminId = ctx.state.userIds[ctx.state.adminKeys[0]];

  await ctx.prisma.seasonDefinition.updateMany({
    where: {
      id: { not: activeSeasonId },
      status: SeasonStatus.active,
    },
    data: {
      closed_at: daysFrom(ctx.config.anchorDate, -1, 23),
      status: SeasonStatus.closed,
    },
  });

  await ctx.prisma.seasonDefinition.upsert({
    where: { id: activeSeasonId },
    update: {
      activated_at: daysFrom(ctx.config.anchorDate, -25, 0),
      archived_at: null,
      auto_start_next: false,
      closed_at: null,
      description:
        'Dynamic demo season with enough standings to test leaderboards.',
      ends_at: daysFrom(ctx.config.anchorDate, 65, 23, 59),
      rules_version: 'dynamic-v1',
      starts_at: daysFrom(ctx.config.anchorDate, -25, 0),
      status: SeasonStatus.active,
      title: 'FitTrack Performance Season',
    },
    create: {
      id: activeSeasonId,
      activated_at: daysFrom(ctx.config.anchorDate, -25, 0),
      auto_start_next: false,
      description:
        'Dynamic demo season with enough standings to test leaderboards.',
      ends_at: daysFrom(ctx.config.anchorDate, 65, 23, 59),
      rules_version: 'dynamic-v1',
      starts_at: daysFrom(ctx.config.anchorDate, -25, 0),
      status: SeasonStatus.active,
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
      description: 'Completed season retained for historical top-performer review.',
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
      description: 'Completed season retained for historical top-performer review.',
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
      description: 'Scheduled season that starts automatically after the active season.',
      ends_at: daysFrom(ctx.config.anchorDate, 155, 23, 59),
      rules_version: 'dynamic-v1',
      starts_at: daysFrom(ctx.config.anchorDate, 66, 0),
      status: SeasonStatus.draft,
      title: 'FitTrack Strength Season',
    },
    create: {
      id: upcomingSeasonId,
      auto_start_next: true,
      description: 'Scheduled season that starts automatically after the active season.',
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
        condition_payload: { metric: milestone.key, target: 1 },
        created_by_user_id: adminId,
        description: milestone.description,
        evidence_requirement: MilestoneEvidenceRequirement.none,
        is_active: true,
        is_hidden: false,
        reward_payload: {
          badgeTone: index === 0 ? 'gold' : 'green',
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
        condition_payload: { metric: milestone.key, target: 1 },
        created_by_user_id: adminId,
        description: milestone.description,
        evidence_requirement: MilestoneEvidenceRequirement.none,
        is_active: true,
        is_hidden: false,
        key: milestone.key,
        reward_payload: {
          badgeTone: index === 0 ? 'gold' : 'green',
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
    (candidate) => candidate.role === 'member' || candidate.role === 'admin',
  )) {
    const userId = ctx.state.userIds[account.key];
    const points =
      account.role === 'admin'
        ? 0
        : 120 + (memberKeys.indexOf(account.key) % 60) * 12;
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
        total_xp: points * 8,
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
        total_xp: points * 8,
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
        visibility:
          account.memberPersona === 'archived'
            ? RankingVisibility.private
            : RankingVisibility.public,
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
        visibility:
          account.memberPersona === 'archived'
            ? RankingVisibility.private
            : RankingVisibility.public,
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

  await ctx.prisma.seasonalStanding.createMany({
    data: activeMemberKeys.flatMap((memberKey, index) => [
      {
        id: seedId(`season-standing:${memberKey}`),
        is_disqualified: memberKey === 'member-suspended',
        is_hidden: index % 17 === 0,
        last_earned_at: daysFrom(ctx.config.anchorDate, -1 - (index % 12), 19),
        rank_position: index + 1,
        season_id: activeSeasonId,
        season_points: 900 - index * 8,
        user_id: ctx.state.userIds[memberKey],
      },
      {
        id: seedId(`season-standing:previous:${memberKey}`),
        is_disqualified: false,
        is_hidden: false,
        last_earned_at: daysFrom(ctx.config.anchorDate, -28 - (index % 8), 19),
        rank_position: index + 1,
        season_id: previousSeasonId,
        season_points: 840 - index * 7,
        user_id: ctx.state.userIds[memberKey],
      },
    ]),
    skipDuplicates: true,
  });

  await ctx.prisma.muscleMasteryProgress.createMany({
    data: activeMemberKeys.slice(0, 40).flatMap((memberKey, memberIndex) =>
      ['chest', 'quads', 'core'].map((muscle, muscleIndex) => ({
        id: seedId(`mastery:${memberKey}:${muscle}`),
        last_ranked_at: daysFrom(ctx.config.anchorDate, -2 - muscleIndex, 20),
        muscle_group: muscle,
        rank:
          memberIndex % 5 === 0
            ? MasteryRank.gold
            : memberIndex % 3 === 0
              ? MasteryRank.silver
              : MasteryRank.bronze,
        total_volume_kg: new Prisma.Decimal(
          4500 + memberIndex * 125 + muscleIndex * 300,
        ),
        user_id: ctx.state.userIds[memberKey],
        xp_points: 500 + memberIndex * 45 + muscleIndex * 80,
      })),
    ),
    skipDuplicates: true,
  });

  await ctx.prisma.seasonalMuscleStanding.createMany({
    data: activeMemberKeys.slice(0, 40).flatMap((memberKey, memberIndex) =>
      ['chest', 'quads', 'core'].flatMap((muscle, muscleIndex) => [
        {
          id: seedId(`season-muscle:${activeSeasonId}:${memberKey}:${muscle}`),
          is_disqualified: memberKey === 'member-suspended',
          is_hidden: false,
          last_earned_at: daysFrom(ctx.config.anchorDate, -2 - muscleIndex, 20),
          muscle_group: muscle,
          muscle_points: 900 - memberIndex * 9 + muscleIndex * 35,
          rank_position: memberIndex + 1,
          season_id: activeSeasonId,
          user_id: ctx.state.userIds[memberKey],
        },
        {
          id: seedId(`season-muscle:${previousSeasonId}:${memberKey}:${muscle}`),
          is_disqualified: false,
          is_hidden: false,
          last_earned_at: daysFrom(ctx.config.anchorDate, -28 - muscleIndex, 20),
          muscle_group: muscle,
          muscle_points: 820 - memberIndex * 8 + muscleIndex * 30,
          rank_position: memberIndex + 1,
          season_id: previousSeasonId,
          user_id: ctx.state.userIds[memberKey],
        },
      ]),
    ),
    skipDuplicates: true,
  });

  const sourceRows = activeMemberKeys.slice(0, 48).map((memberKey, index) => ({
    id: seedId(`progression-source:${memberKey}:workout`),
    created_at: daysFrom(ctx.config.anchorDate, -7 + (index % 5), 19),
    processed_at: daysFrom(ctx.config.anchorDate, -7 + (index % 5), 19, 5),
    source_context: {
      source: 'dynamic-seed',
      workoutSessionId: seedId(`workout-session:${memberKey}:0`),
    },
    source_id: seedExternalId(`source:workout:${memberKey}`),
    source_status:
      index % 11 === 0
        ? ProgressionSourceStatus.reduced
        : ProgressionSourceStatus.applied,
    source_type: ProgressionSourceType.workout_session_completed,
    user_id: ctx.state.userIds[memberKey],
  }));

  await ctx.prisma.progressionSourceEvent.createMany({
    data: sourceRows,
    skipDuplicates: true,
  });
  await ctx.prisma.progressionGrantLedger.createMany({
    data: sourceRows.flatMap((source, index) => [
      {
        id: seedId(`progression-grant:${source.user_id}:xp`),
        amount: 120 + (index % 8) * 10,
        created_at: source.created_at,
        grant_status: ProgressionGrantStatus.applied,
        grant_type: ProgressionGrantType.xp,
        metadata: { source: 'dynamic-seed' },
        muscle_group: index % 2 === 0 ? 'chest' : 'quads',
        reason: 'Completed workout reward.',
        season_id: activeSeasonId,
        source_event_id: source.id,
        user_id: source.user_id,
      },
      {
        id: seedId(`progression-grant:${source.user_id}:season`),
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
    ]),
    skipDuplicates: true,
  });

  const milestoneKeys = DYNAMIC_MILESTONES.map((milestone) => milestone.key);
  const milestoneProgressRows = activeMemberKeys
    .slice(0, 36)
    .flatMap((memberKey, index) =>
      milestoneKeys.slice(0, 2).map((milestoneKey, milestoneIndex) => ({
        id: seedId(`milestone-progress:${memberKey}:${milestoneKey}`),
        claimed_at:
          milestoneIndex === 0 ? daysFrom(ctx.config.anchorDate, -1, 10) : null,
        milestone_definition_id: seedId(`milestone-definition:${milestoneKey}`),
        progress_payload: { source: 'dynamic-seed', memberKey },
        progress_value: milestoneIndex === 0 ? 1 : index % 2,
        status:
          milestoneIndex === 0
            ? MilestoneProgressStatus.claimed
            : index % 2 === 0
              ? MilestoneProgressStatus.unlocked
              : MilestoneProgressStatus.in_progress,
        unlocked_at:
          milestoneIndex === 0 || index % 2 === 0
            ? daysFrom(ctx.config.anchorDate, -2, 9)
            : null,
        user_id: ctx.state.userIds[memberKey],
      })),
    );

  await ctx.prisma.userMilestoneProgress.createMany({
    data: milestoneProgressRows,
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
      source_event_id: activeMemberKeys.includes(memberKey)
        ? seedId(`progression-source:${memberKey}:workout`)
        : null,
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
      source_event_id: activeMemberKeys.includes(memberKey)
        ? seedId(`progression-source:${memberKey}:workout`)
        : null,
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
      trainingMembers: ctx.state.premiumMemberKeys.slice(0, 36).length,
    },
  };
}
