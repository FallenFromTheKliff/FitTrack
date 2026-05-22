import { Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  AuthProvider,
  BookingStatus,
  CreatorState,
  ExerciseReviewSubmissionStatus,
  IntegrityCaseStatus,
  IntegrityRiskLevel,
  MasteryRank,
  MilestoneCategory,
  MilestoneDefinitionStatus,
  MilestoneEvidenceRequirement,
  MilestoneEvidenceSubmissionStatus,
  MilestoneEvidenceType,
  MilestoneProgressStatus,
  MilestoneTriggerType,
  MilestoneVerificationPolicy,
  ModerationActionType,
  ProgressionGrantStatus,
  ProgressionGrantType,
  ProgressionSourceStatus,
  ProgressionSourceType,
  RankingGovernanceStatus,
  RankingVisibility,
  SeasonStatus,
  type MuscleMasteryProgress,
  Prisma,
} from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ProgressionSourceIntegrityState,
  ProgressionSourceValidationState,
} from '../progression-source.types';
import { type MasteryFilterDTO } from './dto/gamification.dto';
import {
  evaluateMasteryRank,
  isHigherMasteryRank,
} from './gamification.constants';

export interface LeaderboardTotalRecord {
  user_id: string;
  total_xp: number;
}

export interface WorkoutCompletionLogRecord {
  reps_completed: number | null;
  reps_ai_counted: number | null;
  weight_kg: Prisma.Decimal | null;
  exercise: {
    muscle_group: string;
  };
}

export interface WorkoutProgressionDeltaRecord {
  muscleGroup: string;
  volumeKgDelta: Prisma.Decimal;
  xpDelta: number;
}

export interface WorkoutProgressionRankUpdateRecord {
  muscleGroup: string;
  newRank: MasteryRank;
  oldRank: MasteryRank;
  rankedAt: Date;
  userId: string;
}

export interface WorkoutProgressionApplicationResult {
  alreadyProcessed: boolean;
  integrityEventId?: string | null;
  rankUpdates: WorkoutProgressionRankUpdateRecord[];
  seasonPointsGranted: number;
  sourceStatus: ProgressionSourceStatus;
  totalXpGranted: number;
}

export interface PoseSourceRecordingResult {
  alreadyProcessed: boolean;
  integrityEventId: string | null;
  sourceStatus: ProgressionSourceStatus;
}

export type ProgressionSourceEventRecord =
  Prisma.ProgressionSourceEventGetPayload<object>;

export interface WorkoutSourceReconciliationResult {
  integrityEventId: string | null;
  sourceStatus: ProgressionSourceStatus | null;
  updated: boolean;
}

export type ProgressionProfileRecord = Prisma.UserProgressionProfileGetPayload<{
  include: {
    active_season: true;
    user: {
      include: {
        integrity_profile: true;
        ranking_profile: true;
      };
    };
  };
}>;

export interface RankingProfileRecord {
  display_alias: string | null;
  governance_status: RankingGovernanceStatus;
  updated_at: Date;
  user_id: string;
  visibility: RankingVisibility;
}

export type ActiveSeasonStandingRecord = Prisma.SeasonalStandingGetPayload<{
  include: {
    season: true;
  };
}>;

export type MilestoneProgressRecord = Prisma.MilestoneDefinitionGetPayload<{
  include: {
    user_progress: true;
  };
}>;

export type AchievementReviewRecord = Prisma.UserMilestoneProgressGetPayload<{
  include: {
    milestone_definition: true;
    user: {
      include: {
        auth_identities: true;
        profile: true;
      };
    };
  };
}>;

export type AdminMilestoneDefinitionRecord =
  Prisma.MilestoneDefinitionGetPayload<{
    include: {
      _count: {
        select: {
          evidence_submissions: true;
          user_progress: true;
        };
      };
    };
  }> & {
    pending_review_count: number;
    unlocked_count: number;
  };

export type MilestoneEvidenceSubmissionRecord =
  Prisma.MilestoneEvidenceSubmissionGetPayload<{
    include: {
      milestone_definition: true;
      user: {
        include: {
          auth_identities: true;
          profile: true;
        };
      };
    };
  }>;

export type IntegrityCaseRecord = Prisma.IntegrityCaseGetPayload<object>;

export interface IntegritySummaryRecord {
  profile: Prisma.IntegrityProfileGetPayload<object> | null;
  recentCases: IntegrityCaseRecord[];
}

export type ProgressionGrantRecord = Prisma.ProgressionGrantLedgerGetPayload<{
  include: {
    source_event: true;
  };
}>;

export type RankingOverrideRecord = Prisma.RankingProfileGetPayload<object>;

export interface GrantModerationResult {
  currentSeasonPoints: number;
  grantId: string;
  grantStatus: ProgressionGrantStatus;
  moderationActionId: string;
  totalXp: number;
  userId: string;
}

export interface RankingOverrideResult {
  adminNote: string | null;
  displayAlias: string | null;
  governanceStatus: RankingGovernanceStatus;
  moderationActionId: string;
  seasonIsDisqualified: boolean;
  seasonIsHidden: boolean;
  userId: string;
  visibility: RankingVisibility;
}

export interface IntegrityCaseMutationResult {
  caseId: string;
  moderationActionId: string | null;
  openCaseCount: number;
  riskLevel: IntegrityRiskLevel;
  status: IntegrityCaseStatus;
  summary: string | null;
  userId: string;
}

interface NamedUserRecord {
  profile: {
    first_name: string;
    last_name: string;
  } | null;
}

export interface AdminOverviewSeasonRecord {
  archived_at: Date | null;
  closed_at: Date | null;
  ends_at: Date;
  id: string;
  standings: {
    is_disqualified: boolean;
    is_hidden: boolean;
    user_id: string;
  }[];
  starts_at: Date;
  status: SeasonStatus;
  title: string;
}

export interface AdminOverviewIntegrityCaseRecord {
  id: string;
  integrity_events: {
    risk_level: IntegrityRiskLevel;
  }[];
  opened_at: Date;
  status: IntegrityCaseStatus;
  summary: string | null;
  user: NamedUserRecord;
  user_id: string;
}

export interface AdminOverviewRankingProfileRecord {
  admin_note: string | null;
  display_alias: string | null;
  governance_status: RankingGovernanceStatus;
  updated_at: Date;
  user: NamedUserRecord;
  user_id: string;
  visibility: RankingVisibility;
}

export interface AdminOverviewCreatorProfileRecord {
  admin_notes: string | null;
  last_state_changed_at: Date | null;
  state: CreatorState;
  user: NamedUserRecord & {
    exercise_review_submissions: {
      status: ExerciseReviewSubmissionStatus;
    }[];
  };
  user_id: string;
}

export interface AdminOverviewModerationActionRecord {
  action_type: ModerationActionType;
  created_at: Date;
  id: string;
  integrity_case_id: string | null;
  progression_grant_id: string | null;
  rationale: string | null;
  season_id: string | null;
  target_user: NamedUserRecord;
  target_user_id: string;
}

export interface AdminGamificationOverviewRecord {
  activeSeason: AdminOverviewSeasonRecord | null;
  creatorCounts: Record<CreatorState, number>;
  creatorProfiles: AdminOverviewCreatorProfileRecord[];
  escalatedCaseCount: number;
  governedRankingCount: number;
  highRiskProfileCount: number;
  hiddenRankingCount: number;
  integrityCases: AdminOverviewIntegrityCaseRecord[];
  openCaseCount: number;
  disqualifiedRankingCount: number;
  rankingProfiles: AdminOverviewRankingProfileRecord[];
  recentCorrectionCount: number;
  recentModerationActions: AdminOverviewModerationActionRecord[];
}

export type AdminSeasonListRecord = Prisma.SeasonDefinitionGetPayload<{
  include: {
    standings: {
      select: {
        is_disqualified: true;
        is_hidden: true;
      };
    };
  };
}>;

export type AdminSeasonStandingRecord = Prisma.SeasonalStandingGetPayload<{
  include: {
    season: true;
    user: {
      include: {
        profile: {
          select: {
            first_name: true;
            last_name: true;
          };
        };
        ranking_profile: true;
        progression_profile: true;
        muscle_mastery: true;
        milestone_progress: true;
      };
    };
  };
}>;

export interface SeasonStatusUpdateResult {
  archivedAt: Date | null;
  closedAt: Date | null;
  seasonId: string;
  status: SeasonStatus;
  title: string;
}

export interface CreatorStateUpdateResult {
  adminNotes: string | null;
  lastStateChangedAt: Date | null;
  moderationActionId: string | null;
  state: CreatorState;
  userId: string;
  userName: string;
}

interface DerivedStreakState {
  currentStreak: number;
  lastProgressedAt: Date | null;
  longestStreak: number;
}

interface MilestoneEvaluationSnapshot {
  aiActionCount: number;
  aiChatMessageCount: number;
  bookingNoShowCount: number;
  completedCoachAppointments: number;
  completedVenueBookings: number;
  completedWorkoutSessions: number;
  currentSeasonPoints: number;
  currentStreak: number;
  gymChatMessageCount: number;
  longestStreak: number;
  maxWeightKg: number;
  noShowCoachAppointments: number;
  nutritionLogCount: number;
  totalXp: number;
  trackedMuscleGroups: number;
  weightedExerciseLogs: number;
}

const DAY_IN_MS = 86_400_000;

const INTEGRITY_RISK_PRIORITY: Record<IntegrityRiskLevel, number> = {
  [IntegrityRiskLevel.low]: 1,
  [IntegrityRiskLevel.medium]: 2,
  [IntegrityRiskLevel.high]: 3,
};

function maxIntegrityRiskLevel(
  left: IntegrityRiskLevel,
  right: IntegrityRiskLevel,
): IntegrityRiskLevel {
  return INTEGRITY_RISK_PRIORITY[left] >= INTEGRITY_RISK_PRIORITY[right]
    ? left
    : right;
}

function formatUserName(user: NamedUserRecord): string {
  const firstName = user.profile?.first_name?.trim() ?? '';
  const lastName = user.profile?.last_name?.trim() ?? '';
  return [firstName, lastName].filter(Boolean).join(' ') || 'FitTrack member';
}

function toUtcDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      DAY_IN_MS,
  );
}

function deriveStreakState(input: {
  completedAt: Date;
  currentStreak: number;
  lastProgressedAt: Date | null;
  longestStreak: number;
}): DerivedStreakState {
  if (!input.lastProgressedAt) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(input.longestStreak, 1),
      lastProgressedAt: input.completedAt,
    };
  }

  const completedDay = toUtcDayNumber(input.completedAt);
  const lastProgressedDay = toUtcDayNumber(input.lastProgressedAt);

  if (completedDay <= lastProgressedDay) {
    return {
      currentStreak: input.currentStreak,
      longestStreak: input.longestStreak,
      lastProgressedAt: input.lastProgressedAt,
    };
  }

  const dayDelta = completedDay - lastProgressedDay;
  const currentStreak =
    dayDelta === 1 ? Math.max(input.currentStreak, 1) + 1 : 1;

  return {
    currentStreak,
    longestStreak: Math.max(input.longestStreak, currentStreak),
    lastProgressedAt: input.completedAt,
  };
}

function toJsonObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readMilestoneTargetValue(value: Prisma.JsonValue | null): number {
  const payload = toJsonObject(value);
  const rawTarget = payload?.target;

  if (typeof rawTarget !== 'number' || !Number.isFinite(rawTarget)) {
    return 1;
  }

  return Math.max(1, Math.floor(rawTarget));
}

function mergeJsonObject(
  current: Prisma.JsonValue | null,
  patch: Record<string, unknown>,
): Prisma.JsonObject {
  return {
    ...(toJsonObject(current) ?? {}),
    ...patch,
  } as Prisma.JsonObject;
}

function readMilestoneMetric(
  triggerType: MilestoneTriggerType,
  value: Prisma.JsonValue | null,
): string {
  const payload = toJsonObject(value);
  const metric = typeof payload?.metric === 'string' ? payload.metric : null;

  if (metric) {
    return metric;
  }

  switch (triggerType) {
    case MilestoneTriggerType.source_event:
      return 'completed_workout_sessions';
    case MilestoneTriggerType.streak:
      return 'current_streak';
    case MilestoneTriggerType.summary_threshold:
      return 'total_xp';
    case MilestoneTriggerType.composite:
      return 'total_xp';
    default:
      return '';
  }
}

function resolveMilestoneObservedValue(
  triggerType: MilestoneTriggerType,
  metric: string,
  snapshot: MilestoneEvaluationSnapshot,
): number | null {
  switch (metric) {
    case 'ai_action_count':
    case 'brodigy_ai_actions':
      return snapshot.aiActionCount;
    case 'ai_chat_messages':
    case 'brodigy_ai_messages':
      return snapshot.aiChatMessageCount;
    case 'booking_no_shows':
      return snapshot.bookingNoShowCount;
    case 'coaching_appointments_completed':
    case 'completed_coach_appointments':
      return snapshot.completedCoachAppointments;
    case 'venue_bookings_completed':
    case 'completed_venue_bookings':
      return snapshot.completedVenueBookings;
    case 'completed_workout_sessions':
      return snapshot.completedWorkoutSessions;
    case 'current_season_points':
    case 'season_points':
      return snapshot.currentSeasonPoints;
    case 'current_streak':
      return snapshot.currentStreak;
    case 'gym_chat_messages':
      return snapshot.gymChatMessageCount;
    case 'longest_streak':
      return snapshot.longestStreak;
    case 'max_weight_kg':
      return snapshot.maxWeightKg;
    case 'coaching_no_shows':
    case 'no_show_coach_appointments':
      return snapshot.noShowCoachAppointments;
    case 'nutrition_logs':
    case 'nutrition_log_count':
      return snapshot.nutritionLogCount;
    case 'total_xp':
      return snapshot.totalXp;
    case 'tracked_muscle_groups':
      return snapshot.trackedMuscleGroups;
    case 'weighted_exercise_logs':
    case 'weighted_lift_count':
      return snapshot.weightedExerciseLogs;
    default:
      return triggerType === MilestoneTriggerType.manual ? null : null;
  }
}

type MilestoneEvaluationResult = {
  metric: string;
  observedValue: number | null;
  targetValue: number;
  unlocked: boolean;
};

function compareMilestoneValue(input: {
  observedValue: number;
  operator: string;
  payload: Record<string, unknown>;
  targetValue: number;
}): boolean {
  switch (input.operator) {
    case 'eq':
      return input.observedValue === input.targetValue;
    case 'gt':
      return input.observedValue > input.targetValue;
    case 'lt':
      return input.observedValue < input.targetValue;
    case 'lte':
      return input.observedValue <= input.targetValue;
    case 'between': {
      const min =
        typeof input.payload.min === 'number'
          ? input.payload.min
          : input.targetValue;
      const max =
        typeof input.payload.max === 'number'
          ? input.payload.max
          : input.targetValue;
      return input.observedValue >= min && input.observedValue <= max;
    }
    case 'gte':
    default:
      return input.observedValue >= input.targetValue;
  }
}

function evaluateMilestoneCondition(
  triggerType: MilestoneTriggerType,
  conditionPayload: Prisma.JsonValue | null,
  snapshot: MilestoneEvaluationSnapshot,
): MilestoneEvaluationResult {
  const payload = toJsonObject(conditionPayload) ?? {};
  const allConditions = Array.isArray(payload.all) ? payload.all : null;
  const anyConditions = Array.isArray(payload.any) ? payload.any : null;

  if (allConditions?.length) {
    const results = allConditions.map((condition) =>
      evaluateMilestoneCondition(
        triggerType,
        condition as Prisma.JsonValue,
        snapshot,
      ),
    );
    const primary = results[0] ?? {
      metric: '',
      observedValue: null,
      targetValue: 1,
      unlocked: false,
    };
    return {
      ...primary,
      unlocked: results.every((result) => result.unlocked),
    };
  }

  if (anyConditions?.length) {
    const results = anyConditions.map((condition) =>
      evaluateMilestoneCondition(
        triggerType,
        condition as Prisma.JsonValue,
        snapshot,
      ),
    );
    const primary = results.find((result) => result.unlocked) ??
      results[0] ?? {
        metric: '',
        observedValue: null,
        targetValue: 1,
        unlocked: false,
      };
    return {
      ...primary,
      unlocked: results.some((result) => result.unlocked),
    };
  }

  const metric = readMilestoneMetric(triggerType, conditionPayload);
  const targetValue = readMilestoneTargetValue(conditionPayload);
  const observedValue = resolveMilestoneObservedValue(
    triggerType,
    metric,
    snapshot,
  );

  if (observedValue === null) {
    return {
      metric,
      observedValue,
      targetValue,
      unlocked: false,
    };
  }

  const operator =
    typeof payload.operator === 'string' ? payload.operator : 'gte';

  return {
    metric,
    observedValue,
    targetValue,
    unlocked: compareMilestoneValue({
      observedValue,
      operator,
      payload,
      targetValue,
    }),
  };
}

async function buildMilestoneSnapshot(
  tx: Prisma.TransactionClient,
  input: {
    currentSeasonPoints: number;
    currentStreak: number;
    longestStreak: number;
    totalXp: number;
    userId: string;
  },
): Promise<MilestoneEvaluationSnapshot> {
  const [
    trackedMuscleGroups,
    completedWorkoutSessions,
    weightedExerciseAggregate,
    nutritionLogCount,
    completedCoachAppointments,
    noShowCoachAppointments,
    completedVenueBookings,
    bookingNoShowCount,
    aiChatMessageCount,
    aiActionCount,
    gymChatMessageCount,
  ] = await Promise.all([
    tx.muscleMasteryProgress.count({
      where: { user_id: input.userId },
    }),
    tx.progressionSourceEvent.count({
      where: {
        user_id: input.userId,
        source_type: ProgressionSourceType.workout_session_completed,
        source_status: ProgressionSourceStatus.applied,
      },
    }),
    tx.exerciseLog.aggregate({
      where: {
        user_id: input.userId,
        weight_kg: {
          gt: 0,
        },
      },
      _count: {
        _all: true,
      },
      _max: {
        weight_kg: true,
      },
    }),
    tx.nutritionLog.count({
      where: { user_id: input.userId },
    }),
    tx.coachAppointment.count({
      where: {
        user_id: input.userId,
        status: AppointmentStatus.completed,
      },
    }),
    tx.coachAppointment.count({
      where: {
        user_id: input.userId,
        status: AppointmentStatus.no_show,
      },
    }),
    tx.amenityBooking.count({
      where: {
        user_id: input.userId,
        status: BookingStatus.completed,
      },
    }),
    tx.amenityBooking.count({
      where: {
        user_id: input.userId,
        status: BookingStatus.no_show,
      },
    }),
    tx.aiChatMessage.count({
      where: {
        session: {
          user_id: input.userId,
        },
      },
    }),
    tx.aiChatMessage.count({
      where: {
        action_triggered: {
          not: null,
        },
        session: {
          user_id: input.userId,
        },
      },
    }),
    tx.gymChatMessage.count({
      where: {
        session: {
          user_id: input.userId,
        },
      },
    }),
  ]);

  return {
    aiActionCount,
    aiChatMessageCount,
    bookingNoShowCount,
    completedCoachAppointments,
    completedVenueBookings,
    completedWorkoutSessions,
    currentSeasonPoints: input.currentSeasonPoints,
    currentStreak: input.currentStreak,
    gymChatMessageCount,
    longestStreak: input.longestStreak,
    maxWeightKg: Number(weightedExerciseAggregate._max.weight_kg ?? 0),
    noShowCoachAppointments,
    nutritionLogCount,
    totalXp: input.totalXp,
    trackedMuscleGroups,
    weightedExerciseLogs: weightedExerciseAggregate._count._all,
  };
}

async function syncMilestoneProgress(
  tx: Prisma.TransactionClient,
  input: {
    evaluatedAt: Date;
    snapshot: MilestoneEvaluationSnapshot;
    sourceEventId?: string | null;
    sourceType: ProgressionSourceType;
    userId: string;
  },
): Promise<void> {
  const milestoneRecords = await tx.milestoneDefinition.findMany({
    where: {
      is_active: true,
      retired_at: null,
      status: MilestoneDefinitionStatus.active,
    },
    include: {
      user_progress: {
        where: {
          user_id: input.userId,
        },
        take: 1,
      },
    },
  });

  for (const milestone of milestoneRecords) {
    const evaluation = evaluateMilestoneCondition(
      milestone.trigger_type,
      milestone.condition_payload,
      input.snapshot,
    );

    if (evaluation.observedValue === null) {
      continue;
    }

    const existingProgress = milestone.user_progress[0] ?? null;
    const isAlreadyUnlocked =
      existingProgress?.status === MilestoneProgressStatus.unlocked ||
      existingProgress?.status === MilestoneProgressStatus.claimed;
    const nextProgressValue = isAlreadyUnlocked
      ? Math.max(existingProgress?.progress_value ?? 0, evaluation.targetValue)
      : Math.max(0, evaluation.observedValue);
    const hasUnlocked = isAlreadyUnlocked || evaluation.unlocked;
    const nextStatus =
      existingProgress?.status === MilestoneProgressStatus.claimed
        ? MilestoneProgressStatus.claimed
        : existingProgress?.status === MilestoneProgressStatus.rejected
          ? MilestoneProgressStatus.rejected
        : hasUnlocked
          ? milestone.verification_policy === MilestoneVerificationPolicy.auto
            ? MilestoneProgressStatus.unlocked
            : MilestoneProgressStatus.pending_review
          : MilestoneProgressStatus.in_progress;
    const nextUnlockedAt =
      existingProgress?.unlocked_at ??
      (nextStatus === MilestoneProgressStatus.unlocked
        ? input.evaluatedAt
        : null);

    if (!existingProgress && nextProgressValue <= 0) {
      continue;
    }

    const progressPayload = {
      last_observed_value: evaluation.observedValue,
      metric: evaluation.metric,
      source_event_id: input.sourceEventId ?? null,
      source_type: input.sourceType,
      target: evaluation.targetValue,
    } satisfies Prisma.JsonObject;

    if (!existingProgress) {
      await tx.userMilestoneProgress.create({
        data: {
          user_id: input.userId,
          milestone_definition_id: milestone.id,
          status: nextStatus,
          progress_value: nextProgressValue,
          progress_payload: progressPayload,
          unlocked_at: nextUnlockedAt,
        },
      });
      continue;
    }

    const shouldUpdate =
      existingProgress.progress_value !== nextProgressValue ||
      existingProgress.status !== nextStatus ||
      (existingProgress.unlocked_at?.toISOString() ?? null) !==
        (nextUnlockedAt?.toISOString() ?? null);

    if (!shouldUpdate) {
      continue;
    }

    await tx.userMilestoneProgress.update({
      where: { id: existingProgress.id },
      data: {
        status: nextStatus,
        progress_value: nextProgressValue,
        progress_payload: progressPayload,
        unlocked_at: nextUnlockedAt,
      },
    });
  }
}

@Injectable()
export class GamificationRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async getAdminOverview(): Promise<AdminGamificationOverviewRecord> {
    const now = new Date();
    const [
      activeSeason,
      openCaseCount,
      escalatedCaseCount,
      highRiskProfileCount,
      integrityCases,
      governedRankingCount,
      hiddenRankingCount,
      disqualifiedRankingCount,
      rankingProfiles,
      creatorProfiles,
      creatorStateRows,
      recentCorrectionCount,
      recentModerationActions,
    ] = await Promise.all([
      this.prisma.seasonDefinition.findFirst({
        where: {
          status: SeasonStatus.active,
          starts_at: { lte: now },
          ends_at: { gte: now },
        },
        orderBy: [{ starts_at: 'desc' }, { updated_at: 'desc' }],
        include: {
          standings: {
            select: {
              is_disqualified: true,
              is_hidden: true,
              user_id: true,
            },
          },
        },
      }),
      this.prisma.integrityCase.count({
        where: {
          status: {
            in: [
              IntegrityCaseStatus.open,
              IntegrityCaseStatus.under_review,
              IntegrityCaseStatus.escalated,
            ],
          },
        },
      }),
      this.prisma.integrityCase.count({
        where: { status: IntegrityCaseStatus.escalated },
      }),
      this.prisma.integrityProfile.count({
        where: {
          open_case_count: { gt: 0 },
          risk_level: IntegrityRiskLevel.high,
        },
      }),
      this.prisma.integrityCase.findMany({
        where: {
          status: {
            in: [
              IntegrityCaseStatus.open,
              IntegrityCaseStatus.under_review,
              IntegrityCaseStatus.escalated,
            ],
          },
        },
        orderBy: [{ opened_at: 'desc' }],
        take: 8,
        include: {
          user: {
            select: {
              profile: {
                select: {
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
          integrity_events: {
            orderBy: [{ created_at: 'desc' }],
            select: {
              risk_level: true,
            },
          },
        },
      }),
      this.prisma.rankingProfile.count({
        where: {
          governance_status: { not: RankingGovernanceStatus.normal },
        },
      }),
      this.prisma.rankingProfile.count({
        where: {
          governance_status: RankingGovernanceStatus.hidden_by_admin,
        },
      }),
      this.prisma.rankingProfile.count({
        where: {
          governance_status: RankingGovernanceStatus.disqualified,
        },
      }),
      this.prisma.rankingProfile.findMany({
        where: {
          governance_status: { not: RankingGovernanceStatus.normal },
        },
        orderBy: [{ updated_at: 'desc' }],
        take: 8,
        include: {
          user: {
            select: {
              profile: {
                select: {
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.creatorProfile.findMany({
        where: {
          state: { not: CreatorState.none },
        },
        orderBy: [{ last_state_changed_at: 'desc' }, { updated_at: 'desc' }],
        take: 8,
        include: {
          user: {
            select: {
              profile: {
                select: {
                  first_name: true,
                  last_name: true,
                },
              },
              exercise_review_submissions: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.creatorProfile.groupBy({
        by: ['state'],
        _count: { _all: true },
      }),
      this.prisma.moderationActionRecord.count(),
      this.prisma.moderationActionRecord.findMany({
        orderBy: [{ created_at: 'desc' }],
        take: 8,
        include: {
          target_user: {
            select: {
              profile: {
                select: {
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const creatorCounts = {
      [CreatorState.none]: 0,
      [CreatorState.candidate]: 0,
      [CreatorState.pending_review]: 0,
      [CreatorState.approved]: 0,
      [CreatorState.suspended]: 0,
      [CreatorState.revoked]: 0,
    } satisfies Record<CreatorState, number>;

    for (const row of creatorStateRows) {
      creatorCounts[row.state] = row._count._all;
    }

    return {
      activeSeason,
      creatorCounts,
      creatorProfiles,
      disqualifiedRankingCount,
      escalatedCaseCount,
      governedRankingCount,
      hiddenRankingCount,
      highRiskProfileCount,
      integrityCases,
      openCaseCount,
      rankingProfiles,
      recentCorrectionCount,
      recentModerationActions,
    };
  }

  async getSeasonById(
    seasonId: string,
  ): Promise<Prisma.SeasonDefinitionGetPayload<object> | null> {
    return this.prisma.seasonDefinition.findUnique({
      where: { id: seasonId },
    });
  }

  listAdminSeasons(input?: {
    includeArchived?: boolean;
  }): Promise<AdminSeasonListRecord[]> {
    return this.prisma.seasonDefinition.findMany({
      where: input?.includeArchived
        ? {}
        : { status: { not: SeasonStatus.archived } },
      include: {
        standings: {
          select: {
            is_disqualified: true,
            is_hidden: true,
          },
        },
      },
      orderBy: [{ starts_at: 'desc' }, { updated_at: 'desc' }],
    });
  }

  async listAdminSeasonStandings(input: {
    governanceStatus?: RankingGovernanceStatus;
    includeArchived?: boolean;
    limit?: number;
    muscleKey?: string;
    page?: number;
    search?: string;
    seasonId?: string;
    visibility?: RankingVisibility;
  }): Promise<PaginatedResult<AdminSeasonStandingRecord>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const trimmedSearch = input.search?.trim();
    const trimmedMuscleKey = input.muscleKey?.trim();
    const userWhere: Prisma.UserWhereInput = {};

    if (trimmedMuscleKey) {
      userWhere.muscle_mastery = {
        some: {
          muscle_group: {
            contains: trimmedMuscleKey,
            mode: 'insensitive',
          },
        },
      };
    }

    if (input.visibility || input.governanceStatus) {
      userWhere.ranking_profile = {
        is: {
          ...(input.visibility ? { visibility: input.visibility } : {}),
          ...(input.governanceStatus
            ? { governance_status: input.governanceStatus }
            : {}),
        },
      };
    }

    const where: Prisma.SeasonalStandingWhereInput = {
      ...(input.seasonId ? { season_id: input.seasonId } : {}),
      season: input.includeArchived
        ? {}
        : {
            status: { not: SeasonStatus.archived },
          },
      ...(Object.keys(userWhere).length ? { user: userWhere } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              {
                user: {
                  profile: {
                    is: {
                      first_name: {
                        contains: trimmedSearch,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              },
              {
                user: {
                  profile: {
                    is: {
                      last_name: {
                        contains: trimmedSearch,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              },
              {
                user: {
                  ranking_profile: {
                    is: {
                      display_alias: {
                        contains: trimmedSearch,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.seasonalStanding.findMany({
        where,
        include: {
          season: true,
          user: {
            include: {
              profile: {
                select: {
                  first_name: true,
                  last_name: true,
                },
              },
              ranking_profile: true,
              progression_profile: true,
              muscle_mastery: true,
              milestone_progress: true,
            },
          },
        },
        orderBy: [
          { season: { starts_at: 'desc' } },
          { season_points: 'desc' },
          { updated_at: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.seasonalStanding.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async updateSeasonStatus(input: {
    actorUserId: string;
    rationale: string;
    seasonId: string;
    status: SeasonStatus;
  }): Promise<SeasonStatusUpdateResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.seasonDefinition.findUniqueOrThrow({
        where: { id: input.seasonId },
      });
      const updatedSeason = await tx.seasonDefinition.update({
        where: { id: input.seasonId },
        data: {
          status: input.status,
          ...(input.status === SeasonStatus.closed ? { closed_at: now } : {}),
          ...(input.status === SeasonStatus.archived
            ? { archived_at: now }
            : {}),
        },
      });

      return {
        archivedAt: updatedSeason.archived_at,
        closedAt: updatedSeason.closed_at,
        seasonId: updatedSeason.id,
        status: updatedSeason.status,
        title: updatedSeason.title,
      };
    });
  }

  async updateCreatorState(input: {
    actorUserId: string;
    adminNotes: string | null;
    rationale: string;
    state: CreatorState;
    targetUserId: string;
  }): Promise<CreatorStateUpdateResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const targetUser = await tx.user.findUniqueOrThrow({
        where: { id: input.targetUserId },
        select: {
          profile: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
      });
      const existingProfile = await tx.creatorProfile.findUnique({
        where: { user_id: input.targetUserId },
      });
      const stateChanged = existingProfile?.state !== input.state;
      const profile = await tx.creatorProfile.upsert({
        where: { user_id: input.targetUserId },
        create: {
          user_id: input.targetUserId,
          state: input.state,
          last_state_changed_at: now,
          admin_notes: input.adminNotes,
        },
        update: {
          state: input.state,
          ...(stateChanged ? { last_state_changed_at: now } : {}),
          admin_notes: input.adminNotes,
        },
      });

      const moderationActionType =
        input.state === CreatorState.approved
          ? ModerationActionType.approve_creator
          : input.state === CreatorState.suspended
            ? ModerationActionType.suspend_creator
            : input.state === CreatorState.revoked
              ? ModerationActionType.revoke_creator
              : null;
      const moderationAction =
        moderationActionType && stateChanged
          ? await tx.moderationActionRecord.create({
              data: {
                actor_user_id: input.actorUserId,
                target_user_id: input.targetUserId,
                action_type: moderationActionType,
                rationale: input.rationale,
                before_state: {
                  creator_state: existingProfile?.state ?? CreatorState.none,
                } satisfies Prisma.JsonObject,
                after_state: {
                  creator_state: profile.state,
                } satisfies Prisma.JsonObject,
              },
            })
          : null;

      return {
        adminNotes: profile.admin_notes ?? null,
        lastStateChangedAt: profile.last_state_changed_at,
        moderationActionId: moderationAction?.id ?? null,
        state: profile.state,
        userId: profile.user_id,
        userName: formatUserName(targetUser),
      };
    });
  }

  listMuscleMastery(
    userId: string,
    dto: MasteryFilterDTO,
  ): Promise<MuscleMasteryProgress[]> {
    const where: Prisma.MuscleMasteryProgressWhereInput = {
      user_id: userId,
    };

    if (dto.muscle_group) {
      where.muscle_group = {
        contains: dto.muscle_group.trim(),
        mode: 'insensitive',
      };
    }

    if (dto.rank) {
      where.rank = dto.rank;
    }

    return this.prisma.muscleMasteryProgress.findMany({
      where,
      orderBy: [
        { xp_points: 'desc' },
        { total_volume_kg: 'desc' },
        { muscle_group: 'asc' },
      ],
    });
  }

  async listLeaderboardTotals(): Promise<LeaderboardTotalRecord[]> {
    const rows = await this.prisma.muscleMasteryProgress.groupBy({
      by: ['user_id'],
      _sum: { xp_points: true },
    });

    return rows.map((row) => ({
      user_id: row.user_id,
      total_xp: row._sum.xp_points ?? 0,
    }));
  }

  listWorkoutCompletionLogs(
    sessionId: string,
    userId: string,
  ): Promise<WorkoutCompletionLogRecord[]> {
    return this.prisma.exerciseLog.findMany({
      where: {
        session_id: sessionId,
        user_id: userId,
        OR: [
          { reps_completed: { not: null } },
          { reps_ai_counted: { not: null } },
        ],
      },
      select: {
        reps_completed: true,
        reps_ai_counted: true,
        weight_kg: true,
        exercise: {
          select: {
            muscle_group: true,
          },
        },
      },
    });
  }

  upsertMuscleMasteryProgress(input: {
    userId: string;
    muscleGroup: string;
    xpDelta: number;
    volumeKgDelta: Prisma.Decimal;
  }): Promise<MuscleMasteryProgress> {
    return this.prisma.muscleMasteryProgress.upsert({
      where: {
        user_id_muscle_group: {
          user_id: input.userId,
          muscle_group: input.muscleGroup,
        },
      },
      create: {
        user_id: input.userId,
        muscle_group: input.muscleGroup,
        xp_points: input.xpDelta,
        total_volume_kg: input.volumeKgDelta,
        rank: MasteryRank.bronze,
      },
      update: {
        xp_points: {
          increment: input.xpDelta,
        },
        total_volume_kg: {
          increment: input.volumeKgDelta,
        },
      },
    });
  }

  updateMuscleMasteryRank(input: {
    masteryId: string;
    rank: MasteryRank;
    rankedAt: Date;
  }): Promise<MuscleMasteryProgress> {
    return this.prisma.muscleMasteryProgress.update({
      where: { id: input.masteryId },
      data: {
        rank: input.rank,
        last_ranked_at: input.rankedAt,
      },
    });
  }

  getProgressionProfile(
    userId: string,
  ): Promise<ProgressionProfileRecord | null> {
    return this.prisma.userProgressionProfile.findUnique({
      where: { user_id: userId },
      include: {
        active_season: true,
        user: {
          include: {
            ranking_profile: true,
            integrity_profile: true,
          },
        },
      },
    });
  }

  listRankingProfiles(userIds: string[]): Promise<RankingProfileRecord[]> {
    if (!userIds.length) {
      return Promise.resolve([]);
    }

    return this.prisma.rankingProfile.findMany({
      where: {
        user_id: {
          in: userIds,
        },
      },
      select: {
        user_id: true,
        visibility: true,
        governance_status: true,
        display_alias: true,
        updated_at: true,
      },
    });
  }

  async listProgressionSources(input: {
    limit?: number;
    page?: number;
    sourceStatus?: ProgressionSourceStatus;
    sourceType?: ProgressionSourceType;
    userId: string;
  }): Promise<PaginatedResult<ProgressionSourceEventRecord>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const where: Prisma.ProgressionSourceEventWhereInput = {
      user_id: input.userId,
      ...(input.sourceType ? { source_type: input.sourceType } : {}),
      ...(input.sourceStatus ? { source_status: input.sourceStatus } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.progressionSourceEvent.findMany({
        where,
        orderBy: [{ processed_at: 'desc' }, { created_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.progressionSourceEvent.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  getRankingProfile(userId: string): Promise<RankingProfileRecord | null> {
    return this.prisma.rankingProfile.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        visibility: true,
        governance_status: true,
        display_alias: true,
        updated_at: true,
      },
    });
  }

  upsertRankingProfile(input: {
    displayAlias: string | null;
    governanceStatus: RankingGovernanceStatus;
    userId: string;
    visibility: RankingVisibility;
  }): Promise<RankingProfileRecord> {
    return this.prisma.rankingProfile.upsert({
      where: { user_id: input.userId },
      create: {
        user_id: input.userId,
        visibility: input.visibility,
        governance_status: input.governanceStatus,
        display_alias: input.displayAlias,
      },
      update: {
        visibility: input.visibility,
        governance_status: input.governanceStatus,
        display_alias: input.displayAlias,
      },
      select: {
        user_id: true,
        visibility: true,
        governance_status: true,
        display_alias: true,
        updated_at: true,
      },
    });
  }

  async getActiveSeasonStanding(
    userId: string,
  ): Promise<ActiveSeasonStandingRecord | null> {
    const now = new Date();

    return this.prisma.seasonalStanding.findFirst({
      where: {
        user_id: userId,
        season: {
          status: SeasonStatus.active,
          starts_at: { lte: now },
          ends_at: { gte: now },
        },
      },
      include: {
        season: true,
      },
      orderBy: [{ season: { starts_at: 'desc' } }, { updated_at: 'desc' }],
    });
  }

  listMilestoneProgress(userId: string): Promise<MilestoneProgressRecord[]> {
    return this.prisma.milestoneDefinition.findMany({
      where: {
        is_active: true,
        retired_at: null,
        status: MilestoneDefinitionStatus.active,
      },
      include: {
        user_progress: {
          where: {
            user_id: userId,
          },
          take: 1,
          orderBy: {
            created_at: 'desc',
          },
        },
      },
      orderBy: [{ is_hidden: 'asc' }, { created_at: 'asc' }],
    });
  }

  listAchievementReviews(): Promise<AchievementReviewRecord[]> {
    return this.prisma.userMilestoneProgress.findMany({
      where: {
        status: {
          in: [
            MilestoneProgressStatus.unlocked,
            MilestoneProgressStatus.claimed,
          ],
        },
        milestone_definition: {
          is_active: true,
          retired_at: null,
          status: MilestoneDefinitionStatus.active,
        },
        user: {
          deletedAt: null,
        },
      },
      include: {
        milestone_definition: true,
        user: {
          include: {
            auth_identities: {
              where: {
                provider: AuthProvider.email,
              },
              orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
            },
            profile: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { unlocked_at: 'desc' },
        { updated_at: 'desc' },
      ],
      take: 50,
    });
  }

  getMilestoneProgressById(
    userId: string,
    milestoneDefinitionId: string,
  ): Promise<MilestoneProgressRecord | null> {
    return this.prisma.milestoneDefinition.findFirst({
      where: {
        id: milestoneDefinitionId,
        is_active: true,
        retired_at: null,
        status: MilestoneDefinitionStatus.active,
      },
      include: {
        user_progress: {
          where: {
            user_id: userId,
          },
          take: 1,
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });
  }

  async claimMilestoneProgress(
    userId: string,
    milestoneDefinitionId: string,
  ): Promise<MilestoneProgressRecord> {
    const now = new Date();
    await this.prisma.userMilestoneProgress.update({
      where: {
        user_id_milestone_definition_id: {
          user_id: userId,
          milestone_definition_id: milestoneDefinitionId,
        },
      },
      data: {
        status: MilestoneProgressStatus.claimed,
        claimed_at: now,
      },
    });

    return this.prisma.milestoneDefinition.findUniqueOrThrow({
      where: { id: milestoneDefinitionId },
      include: {
        user_progress: {
          where: {
            user_id: userId,
          },
          take: 1,
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });
  }

  async syncMilestoneProgressForUser(input: {
    sourceEventId?: string | null;
    sourceType?: ProgressionSourceType;
    userId: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.userProgressionProfile.findUnique({
        where: { user_id: input.userId },
      });
      const snapshot = await buildMilestoneSnapshot(tx, {
        currentSeasonPoints: profile?.current_season_points ?? 0,
        currentStreak: profile?.current_streak ?? 0,
        longestStreak: profile?.longest_streak ?? 0,
        totalXp: profile?.total_xp ?? 0,
        userId: input.userId,
      });

      await syncMilestoneProgress(tx, {
        evaluatedAt: new Date(),
        snapshot,
        sourceEventId: input.sourceEventId ?? null,
        sourceType: input.sourceType ?? ProgressionSourceType.moderation_action,
        userId: input.userId,
      });
    });
  }

  async listAdminMilestoneDefinitions(input: {
    category?: MilestoneCategory;
    evidenceRequirement?: MilestoneEvidenceRequirement;
    includeArchived?: boolean;
    limit?: number;
    page?: number;
    search?: string;
    sort?: 'created_at' | 'updated_at' | 'title' | 'sort_order';
    status?: MilestoneDefinitionStatus;
    triggerType?: MilestoneTriggerType;
    verificationPolicy?: MilestoneVerificationPolicy;
  }): Promise<PaginatedResult<AdminMilestoneDefinitionRecord>> {
    const search = input.search?.trim();
    const where: Prisma.MilestoneDefinitionWhereInput = {
      ...(input.includeArchived
        ? {}
        : {
            status: { not: MilestoneDefinitionStatus.archived },
            retired_at: null,
          }),
      ...(input.status ? { status: input.status } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.triggerType ? { trigger_type: input.triggerType } : {}),
      ...(input.verificationPolicy
        ? { verification_policy: input.verificationPolicy }
        : {}),
      ...(input.evidenceRequirement
        ? { evidence_requirement: input.evidenceRequirement }
        : {}),
      ...(search
        ? {
            OR: [
              { key: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.MilestoneDefinitionOrderByWithRelationInput[] =
      input.sort === 'title'
        ? [{ title: 'asc' }]
        : input.sort === 'sort_order'
          ? [{ sort_order: 'asc' }, { title: 'asc' }]
          : input.sort === 'created_at'
            ? [{ created_at: 'desc' }]
            : [{ updated_at: 'desc' }];

    const result = await this.paginate<
      Prisma.MilestoneDefinitionGetPayload<{
        include: {
          _count: {
            select: {
              evidence_submissions: true;
              user_progress: true;
            };
          };
        };
      }>
    >(
      this.prisma.milestoneDefinition,
      {
        where,
        orderBy,
        include: {
          _count: {
            select: {
              evidence_submissions: true,
              user_progress: true,
            },
          },
        },
      },
      { limit: input.limit, page: input.page },
    );

    return {
      ...result,
      data: await this.withAdminMilestoneCounts(result.data),
    };
  }

  async getAdminMilestoneDefinition(
    milestoneDefinitionId: string,
  ): Promise<AdminMilestoneDefinitionRecord | null> {
    const record = await this.prisma.milestoneDefinition.findUnique({
      where: { id: milestoneDefinitionId },
      include: {
        _count: {
          select: {
            evidence_submissions: true,
            user_progress: true,
          },
        },
      },
    });

    if (!record) return null;
    return (await this.withAdminMilestoneCounts([record]))[0] ?? null;
  }

  async createAdminMilestoneDefinition(input: {
    actorUserId: string;
    category: MilestoneCategory;
    conditionPayload?: Record<string, unknown> | null;
    description?: string | null;
    endsAt?: Date | null;
    evidenceRequirement?: MilestoneEvidenceRequirement;
    isHidden?: boolean;
    key: string;
    rewardPayload?: Record<string, unknown> | null;
    sortOrder?: number;
    startsAt?: Date | null;
    status?: MilestoneDefinitionStatus;
    title: string;
    triggerType: MilestoneTriggerType;
    verificationPolicy?: MilestoneVerificationPolicy;
  }): Promise<AdminMilestoneDefinitionRecord> {
    const status = input.status ?? MilestoneDefinitionStatus.active;
    const now = new Date();
    const record = await this.prisma.milestoneDefinition.create({
      data: {
        key: input.key,
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        trigger_type: input.triggerType,
        condition_payload:
          input.conditionPayload === undefined
            ? Prisma.JsonNull
            : (input.conditionPayload as Prisma.InputJsonValue),
        reward_payload:
          input.rewardPayload === undefined
            ? Prisma.JsonNull
            : (input.rewardPayload as Prisma.InputJsonValue),
        status,
        verification_policy:
          input.verificationPolicy ?? MilestoneVerificationPolicy.auto,
        evidence_requirement:
          input.evidenceRequirement ?? MilestoneEvidenceRequirement.none,
        is_active: status === MilestoneDefinitionStatus.active,
        is_hidden: input.isHidden ?? false,
        sort_order: input.sortOrder ?? 0,
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
        retired_at:
          status === MilestoneDefinitionStatus.archived ? now : null,
        archived_at:
          status === MilestoneDefinitionStatus.archived ? now : null,
        archived_by_user_id:
          status === MilestoneDefinitionStatus.archived
            ? input.actorUserId
            : null,
        created_by_user_id: input.actorUserId,
        updated_by_user_id: input.actorUserId,
      },
      include: {
        _count: {
          select: {
            evidence_submissions: true,
            user_progress: true,
          },
        },
      },
    });

    return (await this.withAdminMilestoneCounts([record]))[0];
  }

  async updateAdminMilestoneDefinition(input: {
    actorUserId: string;
    category: MilestoneCategory;
    conditionPayload?: Record<string, unknown> | null;
    description?: string | null;
    endsAt?: Date | null;
    evidenceRequirement?: MilestoneEvidenceRequirement;
    id: string;
    isHidden?: boolean;
    key: string;
    rewardPayload?: Record<string, unknown> | null;
    sortOrder?: number;
    startsAt?: Date | null;
    status?: MilestoneDefinitionStatus;
    title: string;
    triggerType: MilestoneTriggerType;
    verificationPolicy?: MilestoneVerificationPolicy;
  }): Promise<AdminMilestoneDefinitionRecord> {
    const status = input.status ?? MilestoneDefinitionStatus.active;
    const now = new Date();
    const record = await this.prisma.milestoneDefinition.update({
      where: { id: input.id },
      data: {
        key: input.key,
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        trigger_type: input.triggerType,
        condition_payload:
          input.conditionPayload === undefined
            ? Prisma.JsonNull
            : (input.conditionPayload as Prisma.InputJsonValue),
        reward_payload:
          input.rewardPayload === undefined
            ? Prisma.JsonNull
            : (input.rewardPayload as Prisma.InputJsonValue),
        status,
        verification_policy:
          input.verificationPolicy ?? MilestoneVerificationPolicy.auto,
        evidence_requirement:
          input.evidenceRequirement ?? MilestoneEvidenceRequirement.none,
        is_active: status === MilestoneDefinitionStatus.active,
        is_hidden: input.isHidden ?? false,
        sort_order: input.sortOrder ?? 0,
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
        retired_at:
          status === MilestoneDefinitionStatus.archived ? now : null,
        archived_at:
          status === MilestoneDefinitionStatus.archived ? now : null,
        archived_by_user_id:
          status === MilestoneDefinitionStatus.archived
            ? input.actorUserId
            : null,
        updated_by_user_id: input.actorUserId,
      },
      include: {
        _count: {
          select: {
            evidence_submissions: true,
            user_progress: true,
          },
        },
      },
    });

    return (await this.withAdminMilestoneCounts([record]))[0];
  }

  async archiveAdminMilestoneDefinition(input: {
    actorUserId: string;
    id: string;
  }): Promise<AdminMilestoneDefinitionRecord> {
    const now = new Date();
    const record = await this.prisma.milestoneDefinition.update({
      where: { id: input.id },
      data: {
        archived_at: now,
        archived_by_user_id: input.actorUserId,
        is_active: false,
        retired_at: now,
        status: MilestoneDefinitionStatus.archived,
        updated_by_user_id: input.actorUserId,
      },
      include: {
        _count: {
          select: {
            evidence_submissions: true,
            user_progress: true,
          },
        },
      },
    });

    return (await this.withAdminMilestoneCounts([record]))[0];
  }

  async restoreAdminMilestoneDefinition(input: {
    actorUserId: string;
    id: string;
  }): Promise<AdminMilestoneDefinitionRecord> {
    const record = await this.prisma.milestoneDefinition.update({
      where: { id: input.id },
      data: {
        archived_at: null,
        archived_by_user_id: null,
        is_active: true,
        retired_at: null,
        status: MilestoneDefinitionStatus.active,
        updated_by_user_id: input.actorUserId,
      },
      include: {
        _count: {
          select: {
            evidence_submissions: true,
            user_progress: true,
          },
        },
      },
    });

    return (await this.withAdminMilestoneCounts([record]))[0];
  }

  async listMilestoneEvidenceSubmissions(input: {
    limit?: number;
    page?: number;
    search?: string;
    status?: MilestoneEvidenceSubmissionStatus;
  }): Promise<PaginatedResult<MilestoneEvidenceSubmissionRecord>> {
    const search = input.search?.trim();
    const where: Prisma.MilestoneEvidenceSubmissionWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(search
        ? {
            OR: [
              {
                milestone_definition: {
                  title: { contains: search, mode: 'insensitive' },
                },
              },
              {
                milestone_definition: {
                  key: { contains: search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  auth_identities: {
                    some: {
                      identifier: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              },
              {
                user: {
                  profile: {
                    first_name: { contains: search, mode: 'insensitive' },
                  },
                },
              },
              {
                user: {
                  profile: {
                    last_name: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    return this.paginate<MilestoneEvidenceSubmissionRecord>(
      this.prisma.milestoneEvidenceSubmission,
      {
        where,
        orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
        include: {
          milestone_definition: true,
          user: {
            include: {
              auth_identities: {
                where: { provider: AuthProvider.email },
                orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
              },
              profile: true,
            },
          },
        },
      },
      { limit: input.limit, page: input.page },
    );
  }

  async submitMilestoneEvidence(input: {
    caption?: string | null;
    evidenceType: MilestoneEvidenceType;
    fileKey?: string | null;
    fileUrl: string;
    milestoneDefinitionId: string;
    mimeType: string;
    originalFilename?: string | null;
    sizeBytes: number;
    userId: string;
  }): Promise<MilestoneEvidenceSubmissionRecord> {
    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.milestoneDefinition.findFirstOrThrow({
        where: {
          id: input.milestoneDefinitionId,
          is_active: true,
          retired_at: null,
          status: MilestoneDefinitionStatus.active,
        },
      });
      const existingProgress = await tx.userMilestoneProgress.findUnique({
        where: {
          user_id_milestone_definition_id: {
            user_id: input.userId,
            milestone_definition_id: definition.id,
          },
        },
      });
      const now = new Date();
      const nextStatus =
        existingProgress?.status === MilestoneProgressStatus.claimed ||
        existingProgress?.status === MilestoneProgressStatus.unlocked
          ? existingProgress.status
          : MilestoneProgressStatus.pending_review;
      const progress = existingProgress
        ? await tx.userMilestoneProgress.update({
            where: { id: existingProgress.id },
            data: {
              status: nextStatus,
              progress_payload: mergeJsonObject(
                existingProgress.progress_payload,
                {
                  latest_evidence_submitted_at: now.toISOString(),
                },
              ),
            },
          })
        : await tx.userMilestoneProgress.create({
            data: {
              user_id: input.userId,
              milestone_definition_id: definition.id,
              status: nextStatus,
              progress_value: 0,
              progress_payload: {
                latest_evidence_submitted_at: now.toISOString(),
              },
            },
          });

      const evidence = await tx.milestoneEvidenceSubmission.create({
        data: {
          user_id: input.userId,
          milestone_definition_id: definition.id,
          milestone_progress_id: progress.id,
          status: MilestoneEvidenceSubmissionStatus.pending,
          evidence_type: input.evidenceType,
          file_url: input.fileUrl,
          file_key: input.fileKey ?? null,
          mime_type: input.mimeType,
          size_bytes: input.sizeBytes,
          original_filename: input.originalFilename ?? null,
          caption: input.caption ?? null,
        },
      });

      await tx.progressionSourceEvent.upsert({
        where: {
          source_type_source_id: {
            source_type: ProgressionSourceType.milestone_evidence_submitted,
            source_id: evidence.id,
          },
        },
        create: {
          user_id: input.userId,
          source_type: ProgressionSourceType.milestone_evidence_submitted,
          source_id: evidence.id,
          source_status: ProgressionSourceStatus.applied,
          source_context: {
            evidence_submission_id: evidence.id,
            milestone_definition_id: definition.id,
          },
          processed_at: now,
        },
        update: {
          source_status: ProgressionSourceStatus.applied,
          processed_at: now,
        },
      });

      return tx.milestoneEvidenceSubmission.findUniqueOrThrow({
        where: { id: evidence.id },
        include: {
          milestone_definition: true,
          user: {
            include: {
              auth_identities: {
                where: { provider: AuthProvider.email },
                orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
              },
              profile: true,
            },
          },
        },
      });
    });
  }

  async reviewMilestoneEvidence(input: {
    evidenceSubmissionId: string;
    reviewerNotes?: string | null;
    reviewerUserId: string;
    status: Extract<
      MilestoneEvidenceSubmissionStatus,
      'approved' | 'rejected'
    >;
  }): Promise<MilestoneEvidenceSubmissionRecord> {
    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.milestoneEvidenceSubmission.findUniqueOrThrow({
        where: { id: input.evidenceSubmissionId },
      });
      const now = new Date();
      const nextProgressStatus =
        input.status === MilestoneEvidenceSubmissionStatus.approved
          ? MilestoneProgressStatus.unlocked
          : MilestoneProgressStatus.rejected;

      await tx.milestoneEvidenceSubmission.update({
        where: { id: evidence.id },
        data: {
          status: input.status,
          reviewed_at: now,
          reviewed_by_user_id: input.reviewerUserId,
          reviewer_notes: input.reviewerNotes ?? null,
        },
      });

      const progress = evidence.milestone_progress_id
        ? await tx.userMilestoneProgress.findUnique({
            where: { id: evidence.milestone_progress_id },
          })
        : await tx.userMilestoneProgress.findUnique({
            where: {
              user_id_milestone_definition_id: {
                user_id: evidence.user_id,
                milestone_definition_id: evidence.milestone_definition_id,
              },
            },
          });

      if (progress) {
        await tx.userMilestoneProgress.update({
          where: { id: progress.id },
          data: {
            status:
              progress.status === MilestoneProgressStatus.claimed
                ? progress.status
                : nextProgressStatus,
            progress_payload: mergeJsonObject(progress.progress_payload, {
              latest_evidence_review_id: evidence.id,
              latest_evidence_reviewed_at: now.toISOString(),
              latest_evidence_status: input.status,
            }),
            unlocked_at:
              input.status === MilestoneEvidenceSubmissionStatus.approved
                ? (progress.unlocked_at ?? now)
                : progress.unlocked_at,
          },
        });
      }

      await tx.progressionSourceEvent.upsert({
        where: {
          source_type_source_id: {
            source_type:
              input.status === MilestoneEvidenceSubmissionStatus.approved
                ? ProgressionSourceType.milestone_evidence_approved
                : ProgressionSourceType.milestone_evidence_rejected,
            source_id: evidence.id,
          },
        },
        create: {
          user_id: evidence.user_id,
          source_type:
            input.status === MilestoneEvidenceSubmissionStatus.approved
              ? ProgressionSourceType.milestone_evidence_approved
              : ProgressionSourceType.milestone_evidence_rejected,
          source_id: evidence.id,
          source_status: ProgressionSourceStatus.applied,
          source_context: {
            evidence_submission_id: evidence.id,
            milestone_definition_id: evidence.milestone_definition_id,
            reviewer_user_id: input.reviewerUserId,
          },
          processed_at: now,
        },
        update: {
          source_status: ProgressionSourceStatus.applied,
          processed_at: now,
        },
      });

      return tx.milestoneEvidenceSubmission.findUniqueOrThrow({
        where: { id: evidence.id },
        include: {
          milestone_definition: true,
          user: {
            include: {
              auth_identities: {
                where: { provider: AuthProvider.email },
                orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
              },
              profile: true,
            },
          },
        },
      });
    });
  }

  private async withAdminMilestoneCounts(
    records: Prisma.MilestoneDefinitionGetPayload<{
      include: {
        _count: {
          select: {
            evidence_submissions: true;
            user_progress: true;
          };
        };
      };
    }>[],
  ): Promise<AdminMilestoneDefinitionRecord[]> {
    const ids = records.map((record) => record.id);
    if (!ids.length) return [];

    const [unlockedCounts, pendingReviewCounts] = await Promise.all([
      this.prisma.userMilestoneProgress.groupBy({
        by: ['milestone_definition_id'],
        where: {
          milestone_definition_id: { in: ids },
          status: {
            in: [
              MilestoneProgressStatus.unlocked,
              MilestoneProgressStatus.claimed,
            ],
          },
        },
        _count: { _all: true },
      }),
      this.prisma.milestoneEvidenceSubmission.groupBy({
        by: ['milestone_definition_id'],
        where: {
          milestone_definition_id: { in: ids },
          status: MilestoneEvidenceSubmissionStatus.pending,
        },
        _count: { _all: true },
      }),
    ]);
    const unlockedById = new Map(
      unlockedCounts.map((count) => [
        count.milestone_definition_id,
        count._count._all,
      ]),
    );
    const pendingById = new Map(
      pendingReviewCounts.map((count) => [
        count.milestone_definition_id,
        count._count._all,
      ]),
    );

    return records.map((record) => ({
      ...record,
      pending_review_count: pendingById.get(record.id) ?? 0,
      unlocked_count: unlockedById.get(record.id) ?? 0,
    }));
  }

  async getIntegritySummary(userId: string): Promise<IntegritySummaryRecord> {
    const [profile, recentCases] = await Promise.all([
      this.prisma.integrityProfile.findUnique({
        where: { user_id: userId },
      }),
      this.prisma.integrityCase.findMany({
        where: { user_id: userId },
        orderBy: [{ opened_at: 'desc' }, { created_at: 'desc' }],
        take: 5,
      }),
    ]);

    return {
      profile,
      recentCases,
    };
  }

  getProgressionGrantById(
    grantId: string,
  ): Promise<ProgressionGrantRecord | null> {
    return this.prisma.progressionGrantLedger.findUnique({
      where: { id: grantId },
      include: {
        source_event: true,
      },
    });
  }

  getIntegrityCaseById(caseId: string): Promise<IntegrityCaseRecord | null> {
    return this.prisma.integrityCase.findUnique({
      where: { id: caseId },
    });
  }

  async voidProgressionGrant(input: {
    actorUserId: string;
    grantId: string;
    rationale: string;
  }): Promise<GrantModerationResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const grant = await tx.progressionGrantLedger.findUniqueOrThrow({
        where: { id: input.grantId },
        include: {
          source_event: true,
        },
      });
      const profile = await tx.userProgressionProfile.findUnique({
        where: { user_id: grant.user_id },
      });

      const beforeState = {
        current_season_points: profile?.current_season_points ?? 0,
        grant_status: grant.grant_status,
        total_xp: profile?.total_xp ?? 0,
      } satisfies Prisma.JsonObject;

      const voidedGrant = await tx.progressionGrantLedger.update({
        where: { id: grant.id },
        data: {
          grant_status: ProgressionGrantStatus.voided,
          voided_at: now,
          metadata: mergeJsonObject(grant.metadata, {
            last_void_reason: input.rationale,
            last_voided_at: now.toISOString(),
          }),
        },
      });

      const counterGrant = await tx.progressionGrantLedger.create({
        data: {
          user_id: grant.user_id,
          source_event_id: grant.source_event_id,
          season_id: grant.season_id,
          grant_type: grant.grant_type,
          grant_status: ProgressionGrantStatus.applied,
          amount: grant.amount * -1,
          muscle_group: grant.muscle_group,
          reason: `moderation_void:${grant.id}`,
          metadata: {
            counter_entry_for_grant_id: grant.id,
            moderation_action: ModerationActionType.void_progression_grant,
          } satisfies Prisma.JsonObject,
        },
      });

      await tx.progressionGrantLedger.update({
        where: { id: grant.id },
        data: {
          metadata: mergeJsonObject(voidedGrant.metadata, {
            last_counter_grant_id: counterGrant.id,
          }),
        },
      });

      let nextTotalXp = profile?.total_xp ?? 0;
      let nextCurrentSeasonPoints = profile?.current_season_points ?? 0;

      if (grant.grant_type === ProgressionGrantType.xp) {
        nextTotalXp = Math.max(0, nextTotalXp - grant.amount);

        if (grant.muscle_group) {
          const mastery = await tx.muscleMasteryProgress.findUnique({
            where: {
              user_id_muscle_group: {
                user_id: grant.user_id,
                muscle_group: grant.muscle_group,
              },
            },
          });

          if (mastery) {
            const nextXp = Math.max(0, mastery.xp_points - grant.amount);
            const nextRank = evaluateMasteryRank(
              nextXp,
              mastery.total_volume_kg,
            );

            await tx.muscleMasteryProgress.update({
              where: { id: mastery.id },
              data: {
                xp_points: nextXp,
                rank: nextRank,
                last_ranked_at:
                  nextRank !== mastery.rank ? now : mastery.last_ranked_at,
              },
            });
          }
        }
      }

      if (
        grant.grant_type === ProgressionGrantType.season_points &&
        grant.season_id
      ) {
        await tx.seasonalStanding.updateMany({
          where: {
            season_id: grant.season_id,
            user_id: grant.user_id,
          },
          data: {
            season_points: {
              decrement: grant.amount,
            },
          },
        });

        if (profile?.active_season_id === grant.season_id) {
          nextCurrentSeasonPoints = Math.max(
            0,
            nextCurrentSeasonPoints - grant.amount,
          );
        }
      }

      if (profile) {
        await tx.userProgressionProfile.update({
          where: { user_id: grant.user_id },
          data: {
            total_xp: nextTotalXp,
            current_season_points: nextCurrentSeasonPoints,
          },
        });
      }

      const activeGrantCountForSource = grant.source_event_id
        ? await tx.progressionGrantLedger.count({
            where: {
              source_event_id: grant.source_event_id,
              grant_status: ProgressionGrantStatus.applied,
              amount: {
                gt: 0,
              },
            },
          })
        : 0;

      if (grant.source_event_id && activeGrantCountForSource === 0) {
        await tx.progressionSourceEvent.update({
          where: { id: grant.source_event_id },
          data: {
            source_status: ProgressionSourceStatus.voided,
          },
        });
      }

      const milestoneSnapshot = await buildMilestoneSnapshot(tx, {
        userId: grant.user_id,
        totalXp: nextTotalXp,
        currentSeasonPoints: nextCurrentSeasonPoints,
        currentStreak: profile?.current_streak ?? 0,
        longestStreak: profile?.longest_streak ?? 0,
      });

      await syncMilestoneProgress(tx, {
        userId: grant.user_id,
        evaluatedAt: now,
        snapshot: milestoneSnapshot,
        sourceEventId: grant.source_event_id,
        sourceType: ProgressionSourceType.moderation_action,
      });

      const moderationAction = await tx.moderationActionRecord.create({
        data: {
          actor_user_id: input.actorUserId,
          target_user_id: grant.user_id,
          source_event_id: grant.source_event_id,
          progression_grant_id: grant.id,
          season_id: grant.season_id,
          action_type: ModerationActionType.void_progression_grant,
          rationale: input.rationale,
          before_state: beforeState,
          after_state: {
            current_season_points: nextCurrentSeasonPoints,
            grant_status: ProgressionGrantStatus.voided,
            total_xp: nextTotalXp,
          } satisfies Prisma.JsonObject,
        },
      });

      return {
        grantId: grant.id,
        userId: grant.user_id,
        grantStatus: ProgressionGrantStatus.voided,
        moderationActionId: moderationAction.id,
        totalXp: nextTotalXp,
        currentSeasonPoints: nextCurrentSeasonPoints,
      };
    });
  }

  async createManualExpGrant(input: {
    actorUserId: string;
    amount: number;
    appointmentId?: string | null;
    muscleGroup?: string | null;
    rationale: string;
    sourceId: string;
    userId: string;
  }): Promise<GrantModerationResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const activeSeason = await tx.seasonDefinition.findFirst({
        where: {
          status: SeasonStatus.active,
          starts_at: { lte: now },
          ends_at: { gte: now },
        },
        orderBy: [{ starts_at: 'desc' }, { created_at: 'desc' }],
      });
      const existingProfile = await tx.userProgressionProfile.findUnique({
        where: { user_id: input.userId },
        select: {
          active_season_id: true,
          current_season_points: true,
          total_xp: true,
        },
      });
      const sourceEvent = await tx.progressionSourceEvent.create({
        data: {
          user_id: input.userId,
          source_type: ProgressionSourceType.moderation_action,
          source_id: input.sourceId,
          source_status: ProgressionSourceStatus.applied,
          processed_at: now,
          source_context: {
            allocation_type: 'manual_exp_post_session',
            appointment_id: input.appointmentId ?? null,
            rationale: input.rationale,
            muscle_group: input.muscleGroup ?? null,
            amount: input.amount,
          } satisfies Prisma.JsonObject,
        },
      });
      const xpGrant = await tx.progressionGrantLedger.create({
        data: {
          user_id: input.userId,
          source_event_id: sourceEvent.id,
          season_id: activeSeason?.id ?? null,
          grant_type: ProgressionGrantType.xp,
          grant_status: ProgressionGrantStatus.applied,
          amount: input.amount,
          muscle_group: input.muscleGroup ?? null,
          reason: 'manual_exp_post_session',
          metadata: {
            appointment_id: input.appointmentId ?? null,
            rationale: input.rationale,
          } satisfies Prisma.JsonObject,
        },
      });
      const seasonPointsGranted = activeSeason ? input.amount : 0;
      if (seasonPointsGranted > 0 && activeSeason) {
        await tx.progressionGrantLedger.create({
          data: {
            user_id: input.userId,
            source_event_id: sourceEvent.id,
            season_id: activeSeason.id,
            grant_type: ProgressionGrantType.season_points,
            grant_status: ProgressionGrantStatus.applied,
            amount: seasonPointsGranted,
            muscle_group: null,
            reason: 'manual_exp_post_session',
            metadata: {
              grant_basis: 'manual_xp_mirror',
              appointment_id: input.appointmentId ?? null,
            } satisfies Prisma.JsonObject,
          },
        });
      }

      const nextTotalXp = (existingProfile?.total_xp ?? 0) + input.amount;
      const nextCurrentSeasonPoints = activeSeason
        ? existingProfile?.active_season_id === activeSeason.id
          ? (existingProfile?.current_season_points ?? 0) + seasonPointsGranted
          : seasonPointsGranted
        : 0;

      await tx.userProgressionProfile.upsert({
        where: { user_id: input.userId },
        create: {
          user_id: input.userId,
          active_season_id: activeSeason?.id ?? null,
          total_xp: input.amount,
          current_season_points: nextCurrentSeasonPoints,
          last_progressed_at: now,
        },
        update: {
          active_season_id: activeSeason?.id ?? null,
          total_xp: nextTotalXp,
          current_season_points: nextCurrentSeasonPoints,
          last_progressed_at: now,
        },
      });

      if (input.muscleGroup) {
        await tx.muscleMasteryProgress.upsert({
          where: {
            user_id_muscle_group: {
              user_id: input.userId,
              muscle_group: input.muscleGroup,
            },
          },
          create: {
            user_id: input.userId,
            muscle_group: input.muscleGroup,
            xp_points: input.amount,
            rank: MasteryRank.bronze,
          },
          update: {
            xp_points: { increment: input.amount },
          },
        });
      }

      if (activeSeason) {
        await tx.seasonalStanding.upsert({
          where: {
            season_id_user_id: {
              season_id: activeSeason.id,
              user_id: input.userId,
            },
          },
          create: {
            season_id: activeSeason.id,
            user_id: input.userId,
            season_points: seasonPointsGranted,
            last_earned_at: now,
          },
          update: {
            season_points: { increment: seasonPointsGranted },
            last_earned_at: now,
          },
        });
      }

      const moderationAction = await tx.moderationActionRecord.create({
        data: {
          actor_user_id: input.actorUserId,
          target_user_id: input.userId,
          source_event_id: sourceEvent.id,
          progression_grant_id: xpGrant.id,
          season_id: activeSeason?.id ?? null,
          action_type: ModerationActionType.manual_exp_grant,
          rationale: input.rationale,
          after_state: {
            amount: input.amount,
            total_xp: nextTotalXp,
            current_season_points: nextCurrentSeasonPoints,
            appointment_id: input.appointmentId ?? null,
          } satisfies Prisma.JsonObject,
        },
      });

      const milestoneSnapshot = await buildMilestoneSnapshot(tx, {
        userId: input.userId,
        totalXp: nextTotalXp,
        currentSeasonPoints: nextCurrentSeasonPoints,
        currentStreak: 0,
        longestStreak: 0,
      });

      await syncMilestoneProgress(tx, {
        userId: input.userId,
        evaluatedAt: now,
        snapshot: milestoneSnapshot,
        sourceEventId: sourceEvent.id,
        sourceType: ProgressionSourceType.moderation_action,
      });

      return {
        currentSeasonPoints: nextCurrentSeasonPoints,
        grantId: xpGrant.id,
        grantStatus: ProgressionGrantStatus.applied,
        moderationActionId: moderationAction.id,
        totalXp: nextTotalXp,
        userId: input.userId,
      };
    });
  }

  async restoreProgressionGrant(input: {
    actorUserId: string;
    grantId: string;
    rationale: string;
  }): Promise<GrantModerationResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const grant = await tx.progressionGrantLedger.findUniqueOrThrow({
        where: { id: input.grantId },
        include: {
          source_event: true,
        },
      });
      const grantMetadata = toJsonObject(grant.metadata);
      const counterGrantId =
        typeof grantMetadata?.last_counter_grant_id === 'string'
          ? grantMetadata.last_counter_grant_id
          : null;
      const profile = await tx.userProgressionProfile.findUnique({
        where: { user_id: grant.user_id },
      });

      if (counterGrantId) {
        await tx.progressionGrantLedger.update({
          where: { id: counterGrantId },
          data: {
            grant_status: ProgressionGrantStatus.voided,
            voided_at: now,
          },
        });
      }

      await tx.progressionGrantLedger.update({
        where: { id: grant.id },
        data: {
          grant_status: ProgressionGrantStatus.applied,
          voided_at: null,
          metadata: mergeJsonObject(grant.metadata, {
            last_restore_reason: input.rationale,
            last_restored_at: now.toISOString(),
          }),
        },
      });

      let nextTotalXp = profile?.total_xp ?? 0;
      let nextCurrentSeasonPoints = profile?.current_season_points ?? 0;

      if (grant.grant_type === ProgressionGrantType.xp) {
        nextTotalXp += grant.amount;

        if (grant.muscle_group) {
          const mastery = await tx.muscleMasteryProgress.upsert({
            where: {
              user_id_muscle_group: {
                user_id: grant.user_id,
                muscle_group: grant.muscle_group,
              },
            },
            create: {
              user_id: grant.user_id,
              muscle_group: grant.muscle_group,
              xp_points: grant.amount,
              total_volume_kg: new Prisma.Decimal(0),
              rank: MasteryRank.bronze,
            },
            update: {
              xp_points: {
                increment: grant.amount,
              },
            },
          });
          const nextRank = evaluateMasteryRank(
            mastery.xp_points,
            mastery.total_volume_kg,
          );

          await tx.muscleMasteryProgress.update({
            where: { id: mastery.id },
            data: {
              rank: nextRank,
              last_ranked_at:
                nextRank !== mastery.rank ? now : mastery.last_ranked_at,
            },
          });
        }
      }

      if (
        grant.grant_type === ProgressionGrantType.season_points &&
        grant.season_id
      ) {
        await tx.seasonalStanding.upsert({
          where: {
            season_id_user_id: {
              season_id: grant.season_id,
              user_id: grant.user_id,
            },
          },
          create: {
            season_id: grant.season_id,
            user_id: grant.user_id,
            season_points: grant.amount,
            last_earned_at: now,
          },
          update: {
            season_points: {
              increment: grant.amount,
            },
            last_earned_at: now,
          },
        });

        if (profile?.active_season_id === grant.season_id) {
          nextCurrentSeasonPoints += grant.amount;
        }
      }

      if (profile) {
        await tx.userProgressionProfile.update({
          where: { user_id: grant.user_id },
          data: {
            total_xp: nextTotalXp,
            current_season_points: nextCurrentSeasonPoints,
          },
        });
      } else {
        await tx.userProgressionProfile.create({
          data: {
            user_id: grant.user_id,
            total_xp: nextTotalXp,
            current_season_points: nextCurrentSeasonPoints,
          },
        });
      }

      if (grant.source_event_id) {
        await tx.progressionSourceEvent.update({
          where: { id: grant.source_event_id },
          data: {
            source_status: ProgressionSourceStatus.applied,
          },
        });
      }

      const milestoneSnapshot = await buildMilestoneSnapshot(tx, {
        userId: grant.user_id,
        totalXp: nextTotalXp,
        currentSeasonPoints: nextCurrentSeasonPoints,
        currentStreak: profile?.current_streak ?? 0,
        longestStreak: profile?.longest_streak ?? 0,
      });

      await syncMilestoneProgress(tx, {
        userId: grant.user_id,
        evaluatedAt: now,
        snapshot: milestoneSnapshot,
        sourceEventId: grant.source_event_id,
        sourceType: ProgressionSourceType.moderation_action,
      });

      const moderationAction = await tx.moderationActionRecord.create({
        data: {
          actor_user_id: input.actorUserId,
          target_user_id: grant.user_id,
          source_event_id: grant.source_event_id,
          progression_grant_id: grant.id,
          season_id: grant.season_id,
          action_type: ModerationActionType.restore_progression_grant,
          rationale: input.rationale,
          before_state: {
            current_season_points: profile?.current_season_points ?? 0,
            grant_status: grant.grant_status,
            total_xp: profile?.total_xp ?? 0,
          } satisfies Prisma.JsonObject,
          after_state: {
            current_season_points: nextCurrentSeasonPoints,
            grant_status: ProgressionGrantStatus.applied,
            total_xp: nextTotalXp,
          } satisfies Prisma.JsonObject,
        },
      });

      return {
        grantId: grant.id,
        userId: grant.user_id,
        grantStatus: ProgressionGrantStatus.applied,
        moderationActionId: moderationAction.id,
        totalXp: nextTotalXp,
        currentSeasonPoints: nextCurrentSeasonPoints,
      };
    });
  }

  async applyRankingOverride(input: {
    actorUserId: string;
    adminNote: string | null;
    governanceStatus: RankingGovernanceStatus;
    rationale: string | null;
    targetUserId: string;
  }): Promise<RankingOverrideResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const existingProfile = await tx.rankingProfile.findUnique({
        where: { user_id: input.targetUserId },
      });
      const activeStanding = await tx.seasonalStanding.findFirst({
        where: {
          user_id: input.targetUserId,
          season: {
            status: SeasonStatus.active,
            starts_at: { lte: now },
            ends_at: { gte: now },
          },
        },
        orderBy: [{ season: { starts_at: 'desc' } }, { updated_at: 'desc' }],
      });

      const nextIsHidden =
        input.governanceStatus === RankingGovernanceStatus.hidden_by_admin ||
        input.governanceStatus === RankingGovernanceStatus.disqualified;
      const nextIsDisqualified =
        input.governanceStatus === RankingGovernanceStatus.disqualified;
      const profile = await tx.rankingProfile.upsert({
        where: { user_id: input.targetUserId },
        create: {
          user_id: input.targetUserId,
          visibility: RankingVisibility.public,
          governance_status: input.governanceStatus,
          admin_note: input.adminNote,
        },
        update: {
          governance_status: input.governanceStatus,
          admin_note: input.adminNote,
        },
      });

      if (activeStanding) {
        await tx.seasonalStanding.update({
          where: { id: activeStanding.id },
          data: {
            is_hidden: nextIsHidden,
            is_disqualified: nextIsDisqualified,
          },
        });
      }

      const moderationAction = await tx.moderationActionRecord.create({
        data: {
          actor_user_id: input.actorUserId,
          target_user_id: input.targetUserId,
          season_id: activeStanding?.season_id ?? null,
          action_type:
            input.governanceStatus === RankingGovernanceStatus.disqualified
              ? ModerationActionType.disqualify_active_season
              : ModerationActionType.hide_from_rankings,
          rationale: input.rationale,
          before_state: {
            admin_note: existingProfile?.admin_note ?? null,
            governance_status:
              existingProfile?.governance_status ??
              RankingGovernanceStatus.normal,
            is_disqualified: activeStanding?.is_disqualified ?? false,
            is_hidden: activeStanding?.is_hidden ?? false,
          } satisfies Prisma.JsonObject,
          after_state: {
            admin_note: input.adminNote,
            governance_status: input.governanceStatus,
            is_disqualified: nextIsDisqualified,
            is_hidden: nextIsHidden,
          } satisfies Prisma.JsonObject,
        },
      });

      return {
        userId: profile.user_id,
        visibility: profile.visibility,
        governanceStatus: profile.governance_status,
        displayAlias: profile.display_alias,
        adminNote: profile.admin_note ?? null,
        seasonIsHidden: nextIsHidden,
        seasonIsDisqualified: nextIsDisqualified,
        moderationActionId: moderationAction.id,
      };
    });
  }

  async createIntegrityCase(input: {
    details: Record<string, unknown> | null;
    eventType: string;
    reasonCode: string | null;
    riskLevel: IntegrityRiskLevel;
    sourceEventId: string | null;
    summary: string | null;
    userId: string;
  }): Promise<IntegrityCaseMutationResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const profile = await tx.integrityProfile.findUnique({
        where: { user_id: input.userId },
      });
      const nextRiskLevel = maxIntegrityRiskLevel(
        profile?.risk_level ?? IntegrityRiskLevel.low,
        input.riskLevel,
      );
      const integrityCase = await tx.integrityCase.create({
        data: {
          user_id: input.userId,
          status: IntegrityCaseStatus.open,
          summary: input.summary,
          opened_at: now,
        },
      });

      await tx.integrityEvent.create({
        data: {
          user_id: input.userId,
          source_event_id: input.sourceEventId,
          integrity_case_id: integrityCase.id,
          event_type: input.eventType,
          reason_code: input.reasonCode,
          risk_level: input.riskLevel,
          details: input.details
            ? (input.details as Prisma.InputJsonObject)
            : undefined,
        },
      });

      const nextOpenCaseCount = (profile?.open_case_count ?? 0) + 1;
      await tx.integrityProfile.upsert({
        where: { user_id: input.userId },
        create: {
          user_id: input.userId,
          risk_level: input.riskLevel,
          open_case_count: 1,
          last_flagged_at: now,
        },
        update: {
          risk_level: nextRiskLevel,
          open_case_count: nextOpenCaseCount,
          last_flagged_at: now,
        },
      });

      return {
        caseId: integrityCase.id,
        userId: input.userId,
        status: IntegrityCaseStatus.open,
        riskLevel: nextRiskLevel,
        openCaseCount: nextOpenCaseCount,
        summary: integrityCase.summary ?? null,
        moderationActionId: null,
      };
    });
  }

  async resolveIntegrityCase(input: {
    actorUserId: string;
    caseId: string;
    rationale: string;
    status: IntegrityCaseStatus;
  }): Promise<IntegrityCaseMutationResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const integrityCase = await tx.integrityCase.findUniqueOrThrow({
        where: { id: input.caseId },
      });
      const profile = await tx.integrityProfile.findUnique({
        where: { user_id: integrityCase.user_id },
      });
      const nextOpenCaseCount = Math.max(
        0,
        (profile?.open_case_count ?? 0) - 1,
      );
      const nextRiskLevel =
        nextOpenCaseCount === 0
          ? IntegrityRiskLevel.low
          : (profile?.risk_level ?? IntegrityRiskLevel.medium);

      const updatedCase = await tx.integrityCase.update({
        where: { id: integrityCase.id },
        data: {
          status: input.status,
          resolved_at: now,
        },
      });

      await tx.integrityEvent.updateMany({
        where: {
          integrity_case_id: integrityCase.id,
        },
        data: {
          is_resolved: true,
        },
      });

      await tx.integrityProfile.upsert({
        where: { user_id: integrityCase.user_id },
        create: {
          user_id: integrityCase.user_id,
          risk_level: nextRiskLevel,
          open_case_count: nextOpenCaseCount,
          last_resolved_at: now,
        },
        update: {
          risk_level: nextRiskLevel,
          open_case_count: nextOpenCaseCount,
          last_resolved_at: now,
        },
      });

      const moderationAction = await tx.moderationActionRecord.create({
        data: {
          actor_user_id: input.actorUserId,
          target_user_id: integrityCase.user_id,
          integrity_case_id: integrityCase.id,
          action_type:
            input.status === IntegrityCaseStatus.resolved_valid
              ? ModerationActionType.resolve_integrity_case_valid
              : ModerationActionType.resolve_integrity_case_invalid,
          rationale: input.rationale,
          before_state: {
            open_case_count: profile?.open_case_count ?? 0,
            risk_level: profile?.risk_level ?? IntegrityRiskLevel.low,
            status: integrityCase.status,
          } satisfies Prisma.JsonObject,
          after_state: {
            open_case_count: nextOpenCaseCount,
            risk_level: nextRiskLevel,
            status: input.status,
          } satisfies Prisma.JsonObject,
        },
      });

      return {
        caseId: updatedCase.id,
        userId: updatedCase.user_id,
        status: updatedCase.status,
        riskLevel: nextRiskLevel,
        openCaseCount: nextOpenCaseCount,
        summary: updatedCase.summary ?? null,
        moderationActionId: moderationAction.id,
      };
    });
  }

  async recordPoseSessionProgressionSource(input: {
    integrityMarkers: string[];
    integrityRiskLevel: IntegrityRiskLevel;
    integrityState: ProgressionSourceIntegrityState;
    occurredAt: Date;
    poseSessionId: string;
    recordedAt: Date;
    sourceContext: Prisma.InputJsonObject;
    sourceRevision: number;
    sourceStatus: ProgressionSourceStatus;
    userId: string;
  }): Promise<PoseSourceRecordingResult> {
    return this.prisma.$transaction(async (tx) => {
      const existingSource = await tx.progressionSourceEvent.findUnique({
        where: {
          source_type_source_id: {
            source_id: input.poseSessionId,
            source_type: ProgressionSourceType.pose_session_finalized,
          },
        },
      });
      const existingRevision = toJsonObject(
        existingSource?.source_context ?? null,
      )?.source_revision;

      if (
        existingSource?.processed_at &&
        typeof existingRevision === 'number' &&
        existingRevision >= input.sourceRevision
      ) {
        return {
          alreadyProcessed: true,
          integrityEventId: null,
          sourceStatus: existingSource.source_status,
        };
      }

      const sourceContext = {
        ...input.sourceContext,
        backbone_processing: {
          occurred_at: input.occurredAt.toISOString(),
          recorded_at: input.recordedAt.toISOString(),
          source_revision: input.sourceRevision,
        },
      } satisfies Prisma.JsonObject;
      const existingIntegrityProfile = await tx.integrityProfile.findUnique({
        where: { user_id: input.userId },
      });

      const sourceEvent = existingSource
        ? await tx.progressionSourceEvent.update({
            where: { id: existingSource.id },
            data: {
              source_status: input.sourceStatus,
              source_context: sourceContext,
              processed_at: input.recordedAt,
            },
          })
        : await tx.progressionSourceEvent.create({
            data: {
              user_id: input.userId,
              source_type: ProgressionSourceType.pose_session_finalized,
              source_id: input.poseSessionId,
              source_status: input.sourceStatus,
              source_context: sourceContext,
              processed_at: input.recordedAt,
            },
          });

      let integrityEventId: string | null = null;
      await tx.integrityProfile.upsert({
        where: { user_id: input.userId },
        create: {
          user_id: input.userId,
          risk_level:
            input.integrityState === 'suspicious'
              ? input.integrityRiskLevel
              : IntegrityRiskLevel.low,
          last_flagged_at:
            input.integrityState === 'suspicious' ? input.recordedAt : null,
        },
        update:
          input.integrityState === 'suspicious'
            ? {
                risk_level: maxIntegrityRiskLevel(
                  input.integrityRiskLevel,
                  existingIntegrityProfile?.risk_level ??
                    IntegrityRiskLevel.low,
                ),
                last_flagged_at: input.recordedAt,
              }
            : {},
      });

      if (input.integrityState === 'suspicious') {
        const existingIntegrityEvent = await tx.integrityEvent.findFirst({
          where: {
            source_event_id: sourceEvent.id,
            event_type: 'pose_session_review_required',
            is_resolved: false,
          },
          select: { id: true },
        });

        if (existingIntegrityEvent) {
          integrityEventId = existingIntegrityEvent.id;
        } else {
          const createdIntegrityEvent = await tx.integrityEvent.create({
            data: {
              user_id: input.userId,
              source_event_id: sourceEvent.id,
              event_type: 'pose_session_review_required',
              reason_code: input.integrityMarkers[0] ?? 'pose_review_required',
              risk_level: input.integrityRiskLevel,
              details: {
                integrity_markers: input.integrityMarkers,
                source_revision: input.sourceRevision,
              } satisfies Prisma.JsonObject,
            },
            select: { id: true },
          });

          integrityEventId = createdIntegrityEvent.id;
        }
      }

      return {
        alreadyProcessed: false,
        integrityEventId,
        sourceStatus: input.sourceStatus,
      };
    });
  }

  async reconcileWorkoutSourceReviewFromPose(input: {
    poseSessionId: string;
    recordedAt: Date;
    reviewNotes: string[];
    sessionId: string;
    userId: string;
  }): Promise<WorkoutSourceReconciliationResult> {
    return this.prisma.$transaction(async (tx) => {
      const workoutSource = await tx.progressionSourceEvent.findUnique({
        where: {
          source_type_source_id: {
            source_id: input.sessionId,
            source_type: ProgressionSourceType.workout_session_completed,
          },
        },
      });

      if (!workoutSource || input.reviewNotes.length === 0) {
        return {
          updated: false,
          integrityEventId: null,
          sourceStatus: workoutSource?.source_status ?? null,
        };
      }

      const sourceContext = toJsonObject(workoutSource.source_context) ?? {};
      const validationMetadata =
        toJsonObject(sourceContext.validation_metadata as Prisma.JsonValue) ??
        {};
      const correlation =
        toJsonObject(sourceContext.correlation as Prisma.JsonValue) ?? {};
      const nextSourceQualityNotes = Array.from(
        new Set([
          ...readStringArray(validationMetadata.source_quality_notes),
          'flagged_pose_sessions_present',
          ...input.reviewNotes,
        ]),
      );
      const nextPoseSessionIds = Array.from(
        new Set([
          ...readStringArray(correlation.pose_session_ids),
          input.poseSessionId,
        ]),
      );
      const nextLinkedSourceIds = Array.from(
        new Set([
          ...readStringArray(correlation.linked_source_ids),
          `pose_session_finalized:${input.poseSessionId}`,
        ]),
      );
      const nextSourceStatus =
        workoutSource.source_status === ProgressionSourceStatus.applied ||
        workoutSource.source_status === ProgressionSourceStatus.pending
          ? ProgressionSourceStatus.reduced
          : workoutSource.source_status;

      await tx.progressionSourceEvent.update({
        where: { id: workoutSource.id },
        data: {
          source_status: nextSourceStatus,
          processed_at: workoutSource.processed_at ?? input.recordedAt,
          source_context: {
            ...sourceContext,
            validation_state: 'flagged',
            terminal_state: 'flagged',
            eligibility_state: 'review_required',
            integrity_state: 'suspicious',
            correlation: {
              ...correlation,
              session_id:
                typeof correlation.session_id === 'string'
                  ? correlation.session_id
                  : input.sessionId,
              pose_session_id:
                typeof correlation.pose_session_id === 'string'
                  ? correlation.pose_session_id
                  : input.poseSessionId,
              pose_session_ids: nextPoseSessionIds,
              linked_source_ids: nextLinkedSourceIds,
            } satisfies Prisma.JsonObject,
            validation_metadata: {
              ...validationMetadata,
              contains_flagged_sets: true,
              correction_origin: 'pose_session_finalize',
              source_quality_notes: nextSourceQualityNotes,
            } satisfies Prisma.JsonObject,
          } satisfies Prisma.JsonObject,
        },
      });

      const integrityProfile = await tx.integrityProfile.findUnique({
        where: { user_id: input.userId },
      });
      await tx.integrityProfile.upsert({
        where: { user_id: input.userId },
        create: {
          user_id: input.userId,
          risk_level: IntegrityRiskLevel.medium,
          last_flagged_at: input.recordedAt,
        },
        update: {
          risk_level: maxIntegrityRiskLevel(
            IntegrityRiskLevel.medium,
            integrityProfile?.risk_level ?? IntegrityRiskLevel.low,
          ),
          last_flagged_at: input.recordedAt,
        },
      });

      const existingIntegrityEvent = await tx.integrityEvent.findFirst({
        where: {
          source_event_id: workoutSource.id,
          event_type: 'workout_session_review_required',
          is_resolved: false,
        },
        select: { id: true },
      });

      if (existingIntegrityEvent) {
        return {
          updated: true,
          integrityEventId: existingIntegrityEvent.id,
          sourceStatus: nextSourceStatus,
        };
      }

      const createdIntegrityEvent = await tx.integrityEvent.create({
        data: {
          user_id: input.userId,
          source_event_id: workoutSource.id,
          event_type: 'workout_session_review_required',
          reason_code: input.reviewNotes[0] ?? 'workout_review_required',
          risk_level: IntegrityRiskLevel.medium,
          details: {
            pose_session_id: input.poseSessionId,
            source_quality_notes: nextSourceQualityNotes,
          } satisfies Prisma.JsonObject,
        },
        select: { id: true },
      });

      return {
        updated: true,
        integrityEventId: createdIntegrityEvent.id,
        sourceStatus: nextSourceStatus,
      };
    });
  }

  async applyWorkoutCompletionProgression(input: {
    completedAt: Date;
    deltas: WorkoutProgressionDeltaRecord[];
    exerciseLogCount: number;
    integrityState: ProgressionSourceIntegrityState;
    recordedAt: Date;
    sessionId: string;
    sourceContext: Prisma.InputJsonObject;
    sourceQualityNotes: string[];
    totalVolumeKg: Prisma.Decimal;
    userId: string;
    validationState: ProgressionSourceValidationState;
  }): Promise<WorkoutProgressionApplicationResult> {
    return this.prisma.$transaction(async (tx) => {
      const existingSource = await tx.progressionSourceEvent.findUnique({
        where: {
          source_type_source_id: {
            source_id: input.sessionId,
            source_type: ProgressionSourceType.workout_session_completed,
          },
        },
      });

      if (existingSource?.processed_at) {
        return {
          alreadyProcessed: true,
          integrityEventId: null,
          rankUpdates: [],
          seasonPointsGranted: 0,
          sourceStatus: existingSource.source_status,
          totalXpGranted: 0,
        };
      }

      const activeSeason = await tx.seasonDefinition.findFirst({
        where: {
          status: SeasonStatus.active,
          starts_at: { lte: input.completedAt },
          ends_at: { gte: input.completedAt },
        },
        orderBy: [{ starts_at: 'desc' }, { created_at: 'desc' }],
      });

      const totalXpGranted = input.deltas.reduce(
        (total, delta) => total + delta.xpDelta,
        0,
      );
      const requiresReview =
        input.validationState === 'flagged' ||
        input.integrityState === 'suspicious';
      const seasonPointsGranted = activeSeason ? totalXpGranted : 0;
      const existingProfile = await tx.userProgressionProfile.findUnique({
        where: { user_id: input.userId },
        select: {
          active_season_id: true,
          current_season_points: true,
          current_streak: true,
          last_progressed_at: true,
          longest_streak: true,
          total_xp: true,
        },
      });

      const sourceContext = {
        ...input.sourceContext,
        backbone_processing: {
          completed_at: input.completedAt.toISOString(),
          recorded_at: input.recordedAt.toISOString(),
          exercise_log_count: input.exerciseLogCount,
          muscle_groups: input.deltas.map((delta) => delta.muscleGroup),
          season_id: activeSeason?.id ?? null,
          total_volume_kg: input.totalVolumeKg.toFixed(2),
          total_xp_granted: totalXpGranted,
        },
      } satisfies Prisma.JsonObject;

      const sourceEvent = existingSource
        ? await tx.progressionSourceEvent.update({
            where: { id: existingSource.id },
            data: {
              source_context: sourceContext,
              source_status:
                totalXpGranted > 0
                  ? ProgressionSourceStatus.pending
                  : ProgressionSourceStatus.blocked,
            },
          })
        : await tx.progressionSourceEvent.create({
            data: {
              user_id: input.userId,
              source_type: ProgressionSourceType.workout_session_completed,
              source_id: input.sessionId,
              source_status:
                totalXpGranted > 0
                  ? ProgressionSourceStatus.pending
                  : ProgressionSourceStatus.blocked,
              source_context: sourceContext,
            },
          });

      await Promise.all([
        tx.rankingProfile.upsert({
          where: { user_id: input.userId },
          create: {
            user_id: input.userId,
            visibility: RankingVisibility.public,
            governance_status: RankingGovernanceStatus.normal,
          },
          update: {},
        }),
        tx.integrityProfile.upsert({
          where: { user_id: input.userId },
          create: {
            user_id: input.userId,
            risk_level: IntegrityRiskLevel.low,
          },
          update: {},
        }),
        tx.creatorProfile.upsert({
          where: { user_id: input.userId },
          create: {
            user_id: input.userId,
            state: CreatorState.none,
          },
          update: {},
        }),
      ]);

      if (totalXpGranted <= 0) {
        await tx.userProgressionProfile.upsert({
          where: { user_id: input.userId },
          create: {
            user_id: input.userId,
          },
          update: {},
        });

        await tx.progressionSourceEvent.update({
          where: { id: sourceEvent.id },
          data: {
            processed_at: input.completedAt,
            source_status: ProgressionSourceStatus.blocked,
          },
        });

        return {
          alreadyProcessed: false,
          integrityEventId: null,
          rankUpdates: [],
          seasonPointsGranted: 0,
          sourceStatus: ProgressionSourceStatus.blocked,
          totalXpGranted: 0,
        };
      }

      const rankUpdates: WorkoutProgressionRankUpdateRecord[] = [];

      for (const delta of input.deltas) {
        const mastery = await tx.muscleMasteryProgress.upsert({
          where: {
            user_id_muscle_group: {
              user_id: input.userId,
              muscle_group: delta.muscleGroup,
            },
          },
          create: {
            user_id: input.userId,
            muscle_group: delta.muscleGroup,
            xp_points: delta.xpDelta,
            total_volume_kg: delta.volumeKgDelta,
            rank: MasteryRank.bronze,
          },
          update: {
            xp_points: {
              increment: delta.xpDelta,
            },
            total_volume_kg: {
              increment: delta.volumeKgDelta,
            },
          },
        });

        const nextRank = evaluateMasteryRank(
          mastery.xp_points,
          mastery.total_volume_kg,
        );
        if (!isHigherMasteryRank(nextRank, mastery.rank)) {
          continue;
        }

        const rankedAt = input.completedAt;
        await tx.muscleMasteryProgress.update({
          where: { id: mastery.id },
          data: {
            rank: nextRank,
            last_ranked_at: rankedAt,
          },
        });

        rankUpdates.push({
          userId: input.userId,
          muscleGroup: delta.muscleGroup,
          oldRank: mastery.rank,
          newRank: nextRank,
          rankedAt,
        });
      }

      await tx.progressionGrantLedger.createMany({
        data: [
          ...input.deltas.map((delta) => ({
            user_id: input.userId,
            source_event_id: sourceEvent.id,
            season_id: activeSeason?.id ?? null,
            grant_type: ProgressionGrantType.xp,
            grant_status: ProgressionGrantStatus.applied,
            amount: delta.xpDelta,
            muscle_group: delta.muscleGroup,
            reason: ProgressionSourceType.workout_session_completed,
            metadata: {
              total_volume_kg: delta.volumeKgDelta.toFixed(2),
            } satisfies Prisma.JsonObject,
          })),
          ...(seasonPointsGranted > 0 && activeSeason
            ? [
                {
                  user_id: input.userId,
                  source_event_id: sourceEvent.id,
                  season_id: activeSeason.id,
                  grant_type: ProgressionGrantType.season_points,
                  grant_status: ProgressionGrantStatus.applied,
                  amount: seasonPointsGranted,
                  muscle_group: null,
                  reason: ProgressionSourceType.workout_session_completed,
                  metadata: {
                    grant_basis: 'mvp_total_xp_mirror',
                  } satisfies Prisma.JsonObject,
                },
              ]
            : []),
        ],
      });

      const streakState = deriveStreakState({
        completedAt: input.completedAt,
        currentStreak: existingProfile?.current_streak ?? 0,
        lastProgressedAt: existingProfile?.last_progressed_at ?? null,
        longestStreak: existingProfile?.longest_streak ?? 0,
      });
      const nextCurrentSeasonPoints = activeSeason
        ? existingProfile?.active_season_id === activeSeason.id
          ? (existingProfile?.current_season_points ?? 0) + seasonPointsGranted
          : seasonPointsGranted
        : 0;
      const nextTotalXp = (existingProfile?.total_xp ?? 0) + totalXpGranted;

      await tx.userProgressionProfile.upsert({
        where: { user_id: input.userId },
        create: {
          user_id: input.userId,
          active_season_id: activeSeason?.id ?? null,
          total_xp: totalXpGranted,
          current_streak: streakState.currentStreak,
          longest_streak: streakState.longestStreak,
          current_season_points: nextCurrentSeasonPoints,
          last_progressed_at: streakState.lastProgressedAt,
        },
        update: {
          total_xp: nextTotalXp,
          current_streak: streakState.currentStreak,
          longest_streak: streakState.longestStreak,
          active_season_id: activeSeason?.id ?? null,
          current_season_points: nextCurrentSeasonPoints,
          last_progressed_at: streakState.lastProgressedAt,
        },
      });

      if (activeSeason) {
        await tx.seasonalStanding.upsert({
          where: {
            season_id_user_id: {
              season_id: activeSeason.id,
              user_id: input.userId,
            },
          },
          create: {
            season_id: activeSeason.id,
            user_id: input.userId,
            season_points: seasonPointsGranted,
            last_earned_at: input.completedAt,
          },
          update: {
            season_points: {
              increment: seasonPointsGranted,
            },
            last_earned_at: input.completedAt,
          },
        });
      }

      let integrityEventId: string | null = null;
      if (requiresReview) {
        const integrityProfile = await tx.integrityProfile.findUnique({
          where: { user_id: input.userId },
        });
        await tx.integrityProfile.upsert({
          where: { user_id: input.userId },
          create: {
            user_id: input.userId,
            risk_level: IntegrityRiskLevel.medium,
            last_flagged_at: input.completedAt,
          },
          update: {
            risk_level: maxIntegrityRiskLevel(
              IntegrityRiskLevel.medium,
              integrityProfile?.risk_level ?? IntegrityRiskLevel.low,
            ),
            last_flagged_at: input.completedAt,
          },
        });

        const existingIntegrityEvent = await tx.integrityEvent.findFirst({
          where: {
            source_event_id: sourceEvent.id,
            event_type: 'workout_session_review_required',
            is_resolved: false,
          },
          select: { id: true },
        });

        if (existingIntegrityEvent) {
          integrityEventId = existingIntegrityEvent.id;
        } else {
          const createdIntegrityEvent = await tx.integrityEvent.create({
            data: {
              user_id: input.userId,
              source_event_id: sourceEvent.id,
              event_type: 'workout_session_review_required',
              reason_code:
                input.sourceQualityNotes.find(
                  (note) => note !== 'linked_pose_sessions_present',
                ) ?? 'workout_review_required',
              risk_level: IntegrityRiskLevel.medium,
              details: {
                validation_state: input.validationState,
                integrity_state: input.integrityState,
                source_quality_notes: input.sourceQualityNotes,
              } satisfies Prisma.JsonObject,
            },
            select: { id: true },
          });

          integrityEventId = createdIntegrityEvent.id;
        }
      }

      await tx.progressionSourceEvent.update({
        where: { id: sourceEvent.id },
        data: {
          processed_at: input.completedAt,
          source_status: requiresReview
            ? ProgressionSourceStatus.reduced
            : ProgressionSourceStatus.applied,
        },
      });

      const milestoneSnapshot = await buildMilestoneSnapshot(tx, {
        userId: input.userId,
        totalXp: nextTotalXp,
        currentSeasonPoints: nextCurrentSeasonPoints,
        currentStreak: streakState.currentStreak,
        longestStreak: streakState.longestStreak,
      });

      await syncMilestoneProgress(tx, {
        userId: input.userId,
        evaluatedAt: input.completedAt,
        snapshot: milestoneSnapshot,
        sourceEventId: sourceEvent.id,
        sourceType: ProgressionSourceType.workout_session_completed,
      });

      return {
        alreadyProcessed: false,
        integrityEventId,
        rankUpdates,
        seasonPointsGranted,
        sourceStatus: requiresReview
          ? ProgressionSourceStatus.reduced
          : ProgressionSourceStatus.applied,
        totalXpGranted,
      };
    });
  }
}
