import type {
  AdminMilestoneDefinitionListParams,
  AdminMilestoneDefinitionRecord,
  AdminMilestoneEvidenceListParams,
  AnalyzePoseSequenceInput,
  CreateFitnessExerciseInput,
  CreateTrainingPlanInput,
  CreateMuscleDefinitionInput,
  DetectPoseEquipmentInput,
  FitnessAchievementReviewRecord,
  ExerciseLogRecord,
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  ExerciseMuscleTargetRole,
  ExerciseRigKeyframeKind,
  FinalizePoseSessionInput,
  PoseEquipmentContext,
  PoseEquipmentDetectionBoxRecord,
  PoseEquipmentDetectionRecord,
  PoseEquipmentSource,
  PoseProgressionDisposition,
  PoseSessionQualityState,
  FitnessExerciseListParams,
  FitnessExerciseRecord,
  FitnessIntegritySummaryRecord,
  FitnessLeaderboardEntryRecord,
  FitnessLeaderboardListParams,
  FitnessMuscleLeaderboardEntryRecord,
  FitnessMuscleLeaderboardListParams,
  FitnessMilestoneListParams,
  FitnessMilestoneEvidenceSubmissionRecord,
  FitnessMilestoneProgressRecord,
  FitnessMasteryListParams,
  FitnessMasteryRank,
  FitnessPaginatedResult,
  FitnessProgressionProfileRecord,
  FitnessProgressionSourceListParams,
  FitnessProgressionSourceRecord,
  FitnessRankingGovernanceStatus,
  FitnessRankingProfileRecord,
  FitnessRankingVisibility,
  FitnessSeasonStandingRecord,
  FitnessSeasonHistoryListParams,
  FitnessSeasonHistoryRecord,
  LogWorkoutSetInput,
  MuscleDefinitionListParams,
  MuscleDefinitionRecord,
  MuscleMasteryRecord,
  PoseClassificationSource,
  PoseFrameAnalysisRecord,
  PoseKeypointRecord,
  PoseSessionRecord,
  ReviewFitnessMilestoneEvidenceInput,
  StartPoseSessionInput,
  StartedPoseSessionRecord,
  StartWorkoutSessionInput,
  SubmitFitnessMilestoneEvidenceInput,
  TrainingPlanDetailRecord,
  TrainingPlanListParams,
  TrainingPlanSummaryRecord,
  TrainingProgressionSuggestionRecord,
  UpdateFitnessRankingProfileInput,
  UpsertAdminMilestoneDefinitionInput,
  UpdateFitnessExerciseInput,
  UpdateMuscleDefinitionInput,
  WorkoutSessionDetailRecord,
  WorkoutSessionListParams,
  WorkoutSessionSummaryRecord,
} from "@fittrack/types";
import { getFitnessExpProgressionState } from "@fittrack/types";
import { unwrapPaginatedResponse, unwrapResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type {
  AdminMilestoneDefinitionListParams,
  AdminMilestoneDefinitionRecord,
  AdminMilestoneEvidenceListParams,
  AnalyzePoseSequenceInput,
  CreateFitnessExerciseInput,
  CreateTrainingPlanInput,
  CreateMuscleDefinitionInput,
  DetectPoseEquipmentInput,
  ExerciseHandShapeProfileRecord,
  FitnessAchievementReviewRecord,
  FitnessExerciseCategory,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  ExerciseMuscleTargetRole,
  ExerciseRigKeyframeKind,
  ExerciseLogRecord,
  FinalizePoseSessionInput,
  FitnessExerciseListParams,
  FitnessExerciseRecord,
  FitnessIntegritySummaryRecord,
  FitnessLeaderboardEntryRecord,
  FitnessLeaderboardListParams,
  FitnessMuscleLeaderboardEntryRecord,
  FitnessMuscleLeaderboardListParams,
  FitnessMilestoneListParams,
  FitnessMilestoneEvidenceSubmissionRecord,
  FitnessMilestoneProgressRecord,
  FitnessMasteryListParams,
  FitnessMasteryRank,
  FitnessPaginatedResult,
  FitnessProgressionProfileRecord,
  FitnessProgressionSourceListParams,
  FitnessProgressionSourceRecord,
  FitnessRankingGovernanceStatus,
  FitnessRankingProfileRecord,
  FitnessRankingVisibility,
  FitnessSeasonStandingRecord,
  FitnessSeasonHistoryListParams,
  FitnessSeasonHistoryRecord,
  MuscleDefinitionListParams,
  MuscleDefinitionRecord,
  LogWorkoutSetInput,
  MuscleMasteryRecord,
  PoseEquipmentContext,
  PoseEquipmentDetectionRecord,
  PoseEquipmentSource,
  PoseFrameAnalysisRecord,
  PoseKeypointRecord,
  PoseProgressionDisposition,
  PoseSessionRecord,
  PoseSessionQualityState,
  ReviewFitnessMilestoneEvidenceInput,
  StartPoseSessionInput,
  StartedPoseSessionRecord,
  StartWorkoutSessionInput,
  SubmitFitnessMilestoneEvidenceInput,
  TrainingPlanDetailRecord,
  TrainingPlanListParams,
  TrainingPlanSummaryRecord,
  TrainingProgressionSuggestionRecord,
  UpdateFitnessRankingProfileInput,
  UpsertAdminMilestoneDefinitionInput,
  UpdateFitnessExerciseInput,
  UpdateMuscleDefinitionInput,
  WorkoutSessionDetailRecord,
  WorkoutSessionListParams,
  WorkoutSessionSummaryRecord,
} from "@fittrack/types";

type FitnessExerciseApiRecord = {
  category: FitnessExerciseRecord["category"];
  created_at: string;
  description: string | null;
  hand_shape_profile?: ExerciseHandShapeProfileRecord | null;
  id: string;
  image_url: string | null;
  instructions: string | null;
  is_active: boolean;
  movement_profile?: ExerciseMovementProfileRecord | null;
  muscle_group: string;
  muscle_targets?: ExerciseMuscleTargetRecord[] | null;
  name: string;
  updated_at: string;
  video_url: string | null;
};

type MuscleDefinitionApiRecord = {
  aliases: string[] | null;
  body_region: string;
  created_at: string;
  icon_asset_key?: string | null;
  icon_key?: string | null;
  icon_kind?: MuscleDefinitionRecord["iconKind"];
  id: string;
  is_active: boolean;
  is_system: boolean;
  key: string;
  name: string;
  sort_order: number;
  updated_at: string;
};


type TrainingPlanExerciseApiRecord = {
  category: TrainingPlanDetailRecord["scheduleDays"][number]["exercises"][number]["category"];
  duration_seconds: number | null;
  exercise_id: string;
  exercise_name: string;
  id: string;
  muscle_group: string;
  notes: string | null;
  order_index: number;
  reps: number | null;
  rest_seconds: number;
  rest_seconds_by_set: number[] | null;
  sets: number;
  weight_kg_target: string | null;
};

type TrainingPlanScheduleDayApiRecord = {
  day_of_week: number;
  exercises: TrainingPlanExerciseApiRecord[];
  focus_label: string | null;
  id: string;
  is_rest_day?: boolean | null;
  notes: string | null;
  week_number: number;
};

type TrainingPlanSummaryApiRecord = {
  coach_id: string | null;
  created_at: string;
  days_per_week: number;
  duration_weeks: number;
  goal: TrainingPlanSummaryRecord["goal"];
  id: string;
  is_active: boolean;
  is_template: boolean;
  source: TrainingPlanSummaryRecord["source"];
  title: string;
  updated_at: string;
  user_id: string;
};

type TrainingPlanDetailApiRecord = TrainingPlanSummaryApiRecord & {
  schedule_days: TrainingPlanScheduleDayApiRecord[];
};

type TrainingProgressionSuggestionApiRecord = {
  action: TrainingProgressionSuggestionRecord["action"];
  confidence: TrainingProgressionSuggestionRecord["confidence"];
  exercise_id: string;
  exercise_name: string;
  plan_exercise_id: string;
  rationale: string;
  source_revision: TrainingProgressionSuggestionRecord["sourceRevision"];
  suggested_reps: number | null;
  suggested_weight_kg: number | null;
};

type WorkoutSessionPlanSummaryApiRecord = {
  goal: NonNullable<WorkoutSessionSummaryRecord["plan"]>["goal"];
  id: string;
  source: NonNullable<WorkoutSessionSummaryRecord["plan"]>["source"];
  title: string;
};

type ExerciseLogPoseSessionApiRecord = {
  confidence_avg: string | null;
  ended_at: string | null;
  id: string;
  rep_count_ai: number;
  started_at: string;
};

type ExerciseLogApiRecord = {
  created_at: string;
  duration_seconds: number | null;
  exercise_id: string;
  exercise_name: string;
  id: string;
  plan_exercise_id: string | null;
  pose_session: ExerciseLogPoseSessionApiRecord | null;
  reps_ai_counted: number | null;
  reps_completed: number | null;
  session_id: string;
  set_number: number;
  updated_at: string;
  user_id: string;
  weight_kg: string | null;
};

type WorkoutSessionSummaryApiRecord = {
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  duration_seconds: number | null;
  exercise_log_count: number;
  id: string;
  last_activity_at: string;
  plan: WorkoutSessionPlanSummaryApiRecord | null;
  plan_id: string | null;
  started_at: string;
  status: WorkoutSessionSummaryRecord["status"];
  total_volume_kg: string | null;
  updated_at: string;
  user_id: string;
};

type WorkoutSessionDetailApiRecord = WorkoutSessionSummaryApiRecord & {
  exercise_logs: ExerciseLogApiRecord[];
};

type PoseSessionApiRecord = {
  analysis_summary: Record<string, unknown> | null;
  classification_confidence: string | null;
  confidence_avg: string | null;
  created_at: string;
  detected_exercise_name: string | null;
  detected_profile_id: string | null;
  ended_at: string | null;
  exercise_hint: string | null;
  exercise_log_id: string | null;
  id: string;
  rep_count_ai: number;
  started_at: string;
  subject_lock_confidence: string | null;
  updated_at: string;
  user_id: string;
};

type StartedPoseSessionApiRecord = {
  accepted_fps: number;
  pose_session_id: string;
};

type PoseFrameAnalysisApiRecord = {
  candidate_exercises?: string[];
  classification_source?: PoseClassificationSource;
  confidence: number;
  exercise_class: string | null;
  form_feedback?: string[];
  equipment_confidence?: number | null;
  equipment_conflicts?: string[];
  equipment_context?: PoseEquipmentContext | null;
  equipment_source?: PoseEquipmentSource | null;
  integrity_reason_codes?: string[];
  keypoints?: Array<{
    visibility: number;
    x: number;
    y: number;
    z: number;
  }> | null;
  matched_profile_id?: string | null;
  movement_contract?: {
    body_orientation?: "upright" | "horizontal" | "inclined" | "floor" | "any";
    contract_version?: string;
    degraded_conditions?: string[];
    dominant_joint: "elbow" | "shoulder" | "hip" | "knee";
    exercise: string;
    no_count_conditions?: string[];
    oscillating_joints: string[];
    partial_rep_policy?: "strict_full_rep" | "count_half_reps" | "review_only";
    phase_order?: string[];
    primary_joints?: string[];
    hold_duration_seconds?: number | null;
    rep_model?:
      | "bilateral"
      | "unilateral_left"
      | "unilateral_right"
      | "alternating"
      | "static_hold"
      | "unknown";
    rep_thresholds: {
      down: { angle: number; tolerance: number };
      up: { angle: number; tolerance: number };
    };
    required_sides?: "both" | "left" | "right" | "either" | "alternating";
    secondary_check: string;
    secondary_joints?: string[];
    spatial_requirements?: {
      body_line_tolerance?: number | null;
      body_x_drift_max?: number | null;
      body_y_travel_min?: number | null;
      hip_y_travel_min?: number | null;
      shoulder_hip_travel_min?: number | null;
      shoulder_y_travel_min?: number | null;
      torso_slope_max_deg?: number | null;
      torso_slope_min_deg?: number | null;
      wrist_anchor_drift_max?: number | null;
      left_right_symmetry_tolerance?: number | null;
      phase_sync_tolerance_ms?: number | null;
    } | null;
    tracking_requirements?: {
      min_confidence?: number;
      min_reliable_frame_landmarks?: number;
      required_landmarks?: string[];
      required_sides?: "both" | "left" | "right" | "either" | "alternating";
    } | null;
  } | null;
  needs_confirmation?: boolean;
  phase?: string | null;
  processing_mode?: "legacy_frame" | "sequence";
  pose_session_id: string;
  progression_disposition?: PoseProgressionDisposition;
  reliable_frame_ratio?: number | null;
  rep_count_delta?: number;
  rep_event?: boolean;
  review_recommended?: boolean;
  session_quality_reasons?: string[];
  session_quality_state?: PoseSessionQualityState;
  subject_lock_confidence?: number;
  subject_locked?: boolean;
};

type PoseEquipmentDetectionApiRecord = {
  equipment_confidence?: number | null;
  equipment_conflicts?: string[];
  equipment_context?: PoseEquipmentContext | null;
  equipment_detections?: Array<{
    confidence?: number | null;
    height?: number | null;
    label?: string | null;
    width?: number | null;
    x?: number | null;
    y?: number | null;
  }>;
  equipment_source?: PoseEquipmentSource | null;
  provider_enabled?: boolean;
};

type MuscleMasteryApiRecord = {
  created_at: string;
  id: string;
  last_ranked_at: string | null;
  muscle_group: string;
  rank: FitnessMasteryRank;
  rank_display: string;
  total_volume_kg: string;
  updated_at: string;
  user_id: string;
  xp_points: number;
};

type LeaderboardEntryApiRecord = {
  avatar_url: string | null;
  display_name: string;
  rank_position: number;
  total_xp: number;
  user_id: string;
};

type MuscleLeaderboardApiRecord = {
  avatar_url?: string | null;
  display_name: string;
  icon_asset_key?: string | null;
  icon_key?: string | null;
  icon_kind?: FitnessMuscleLeaderboardEntryRecord["iconKind"];
  is_current_user?: boolean;
  last_earned_at: string | null;
  muscle_key: string;
  rank_position: number;
  scope: FitnessMuscleLeaderboardEntryRecord["scope"];
  season_id: string | null;
  season_title: string | null;
  user_id: string;
  xp_points: number;
};

type SeasonHistoryApiRecord = {
  closed_at: string | null;
  ends_at: string;
  season_id: string;
  starts_at: string;
  title: string;
  top_performers: {
    display_name: string;
    rank_position: number;
    season_points: number;
    user_id: string;
  }[];
};

type ProgressionActiveSeasonApiRecord = {
  ends_at: string;
  id: string;
  starts_at: string;
  status: NonNullable<
    FitnessProgressionProfileRecord["activeSeason"]
  >["status"];
  title: string;
};

type ProgressionProfileApiRecord = {
  active_season: ProgressionActiveSeasonApiRecord | null;
  created_at: string | null;
  current_season_points: number;
  current_streak: number;
  integrity_risk_level: FitnessIntegritySummaryRecord["riskLevel"];
  last_progressed_at: string | null;
  longest_streak: number;
  ranking_governance_status: FitnessRankingGovernanceStatus;
  ranking_visibility: FitnessRankingVisibility;
  total_xp: number;
  updated_at: string | null;
  user_id: string;
};

type ProgressionSourceApiRecord = {
  created_at: string;
  eligibility_state: string | null;
  exercise_log_ids: string[];
  id: string;
  integrity_state: string | null;
  linked_source_ids: string[];
  occurred_at: string | null;
  pose_session_id: string | null;
  pose_session_ids: string[];
  processed_at: string | null;
  producer_runtime: string | null;
  recorded_at: string | null;
  session_id: string | null;
  source_id: string;
  source_quality_notes: string[];
  source_status: FitnessProgressionSourceRecord["sourceStatus"];
  source_type: FitnessProgressionSourceRecord["sourceType"];
  terminal_state: string | null;
  updated_at: string;
  validation_state: string | null;
};

type RankingProfileApiRecord = {
  display_alias: string | null;
  governance_status: FitnessRankingGovernanceStatus;
  updated_at: string;
  user_id: string;
  visibility: FitnessRankingVisibility;
};

type SeasonStandingApiRecord = {
  is_disqualified: boolean;
  is_hidden: boolean;
  last_earned_at: string | null;
  rank_position: number | null;
  season: ProgressionActiveSeasonApiRecord | null;
  season_points: number;
  user_id: string;
};

type MilestoneProgressApiRecord = {
  category: FitnessMilestoneProgressRecord["category"];
  claimed_at: string | null;
  condition_payload?: Record<string, unknown> | null;
  description: string | null;
  evidence_requirement?: FitnessMilestoneProgressRecord["evidenceRequirement"];
  icon_asset_key?: string | null;
  icon_key?: string | null;
  icon_kind?: FitnessMilestoneProgressRecord["iconKind"];
  is_hidden: boolean;
  latest_evidence_submission?: MilestoneEvidenceSubmissionApiRecord | null;
  key: string;
  milestone_definition_id: string;
  progress_percent: number;
  progress_value: number;
  reward_payload: Record<string, unknown> | null;
  status: FitnessMilestoneProgressRecord["status"];
  target_value: number;
  title: string;
  trigger_type: FitnessMilestoneProgressRecord["triggerType"];
  unlocked_at: string | null;
  updated_at: string | null;
  verification_policy?: FitnessMilestoneProgressRecord["verificationPolicy"];
};

type AdminMilestoneDefinitionApiRecord = {
  archived_at: string | null;
  archived_by_user_id: string | null;
  category: AdminMilestoneDefinitionRecord["category"];
  condition_payload: Record<string, unknown> | null;
  created_at: string;
  created_by_user_id: string | null;
  description: string | null;
  ends_at: string | null;
  evidence_requirement: AdminMilestoneDefinitionRecord["evidenceRequirement"];
  id: string;
  icon_asset_key?: string | null;
  icon_key?: string | null;
  icon_kind?: AdminMilestoneDefinitionRecord["iconKind"];
  is_active: boolean;
  is_hidden: boolean;
  key: string;
  pending_review_count: number;
  progress_count: number;
  reward_payload: Record<string, unknown> | null;
  sort_order: number;
  starts_at: string | null;
  status: AdminMilestoneDefinitionRecord["status"];
  title: string;
  trigger_type: AdminMilestoneDefinitionRecord["triggerType"];
  unlocked_count: number;
  updated_at: string;
  updated_by_user_id: string | null;
  verification_policy: AdminMilestoneDefinitionRecord["verificationPolicy"];
};

type MilestoneEvidenceSubmissionApiRecord = {
  caption: string | null;
  created_at: string;
  evidence_type: FitnessMilestoneEvidenceSubmissionRecord["evidenceType"];
  file_key: string | null;
  file_url: string;
  id: string;
  member_email?: string | null;
  member_initials?: string | null;
  member_name?: string | null;
  milestone_definition_id: string;
  milestone_key?: string;
  milestone_title?: string;
  mime_type: string;
  original_filename: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  size_bytes: number;
  status: FitnessMilestoneEvidenceSubmissionRecord["status"];
  updated_at: string;
  user_id: string;
};

type AchievementReviewApiRecord = {
  badge_label: string;
  id: string;
  member_email: string;
  member_id: string;
  member_initials: string;
  member_name: string;
  proof_caption: string;
  proof_image_url: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  status: FitnessAchievementReviewRecord["status"];
  submitted_at: string;
};

type IntegrityCaseSummaryApiRecord = {
  id: string;
  opened_at: string;
  resolved_at: string | null;
  status: FitnessIntegritySummaryRecord["recentCases"][number]["status"];
  summary: string | null;
};

type IntegritySummaryApiRecord = {
  last_flagged_at: string | null;
  last_resolved_at: string | null;
  open_case_count: number;
  recent_cases: IntegrityCaseSummaryApiRecord[];
  risk_level: FitnessIntegritySummaryRecord["riskLevel"];
  user_id: string;
};

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRoundedDecimal(value: number | null | undefined, decimals = 6) {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (!Number.isFinite(value)) {
    return value;
  }

  return Number(value.toFixed(decimals));
}

function roundNumericRecord(record: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      toRoundedDecimal(value) ?? 0,
    ]),
  );
}

function mapExercise(record: FitnessExerciseApiRecord): FitnessExerciseRecord {
  return {
    category: record.category,
    createdAt: record.created_at,
    description: record.description,
    handShapeProfile: record.hand_shape_profile ?? null,
    id: record.id,
    imageUrl: record.image_url,
    instructions: record.instructions,
    isActive: record.is_active,
    movementProfile: record.movement_profile ?? null,
    muscleGroup: record.muscle_group,
    muscleTargets: record.muscle_targets ?? [],
    name: record.name,
    updatedAt: record.updated_at,
    videoUrl: record.video_url,
  };
}

function mapMuscleDefinition(
  record: MuscleDefinitionApiRecord,
): MuscleDefinitionRecord {
  return {
    aliases: Array.isArray(record.aliases) ? record.aliases : [],
    bodyRegion: record.body_region,
    createdAt: record.created_at,
    iconAssetKey: record.icon_asset_key ?? null,
    iconKey: record.icon_key ?? "dumbbell",
    iconKind:
      record.icon_kind ?? (record.icon_asset_key ? "custom" : "library"),
    id: record.id,
    isActive: record.is_active,
    isSystem: record.is_system,
    key: record.key,
    name: record.name,
    sortOrder: record.sort_order,
    updatedAt: record.updated_at,
  };
}

function mapTrainingPlanSummary(
  record: TrainingPlanSummaryApiRecord,
): TrainingPlanSummaryRecord {
  return {
    coachId: record.coach_id,
    createdAt: record.created_at,
    daysPerWeek: record.days_per_week,
    durationWeeks: record.duration_weeks,
    goal: record.goal,
    id: record.id,
    isActive: record.is_active,
    isTemplate: record.is_template,
    source: record.source,
    title: record.title,
    updatedAt: record.updated_at,
    userId: record.user_id,
  };
}

function mapTrainingPlanDetail(
  record: TrainingPlanDetailApiRecord,
): TrainingPlanDetailRecord {
  return {
    ...mapTrainingPlanSummary(record),
    scheduleDays: record.schedule_days.map((day) => ({
      dayOfWeek: day.day_of_week,
      exercises: day.exercises.map((exercise) => ({
        category: exercise.category,
        durationSeconds: exercise.duration_seconds,
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercise_name,
        id: exercise.id,
        muscleGroup: exercise.muscle_group,
        notes: exercise.notes,
        orderIndex: exercise.order_index,
        reps: exercise.reps,
        restSeconds: exercise.rest_seconds,
        restSecondsBySet: exercise.rest_seconds_by_set,
        sets: exercise.sets,
        weightKgTarget: toNullableNumber(exercise.weight_kg_target),
      })),
      focusLabel: day.focus_label,
      id: day.id,
      isRestDay: day.is_rest_day ?? null,
      notes: day.notes,
      weekNumber: day.week_number,
    })),
  };
}

function mapTrainingProgressionSuggestion(
  record: TrainingProgressionSuggestionApiRecord,
): TrainingProgressionSuggestionRecord {
  return {
    action: record.action,
    confidence: record.confidence,
    exerciseId: record.exercise_id,
    exerciseName: record.exercise_name,
    planExerciseId: record.plan_exercise_id,
    rationale: record.rationale,
    sourceRevision: record.source_revision,
    suggestedReps: record.suggested_reps,
    suggestedWeightKg: record.suggested_weight_kg,
  };
}

function toTrainingPlanMutationPayload(input: CreateTrainingPlanInput) {
  return {
    days_per_week: input.daysPerWeek,
    duration_weeks: input.durationWeeks,
    goal: input.goal,
    schedule: input.schedule.map((day) => ({
      day_of_week: day.dayOfWeek,
      exercises: day.exercises.map((exercise) => ({
        duration_seconds: exercise.durationSeconds,
        exercise_id: exercise.exerciseId,
        order_index: exercise.orderIndex,
        reps: exercise.reps,
        rest_seconds: exercise.restSeconds,
        rest_seconds_by_set: exercise.restSecondsBySet,
        sets: exercise.sets,
        weight_kg_target: exercise.weightKgTarget,
      })),
      focus_label: day.focusLabel,
      is_rest_day: day.isRestDay,
      week_number: day.weekNumber,
    })),
    title: input.title,
  };
}

function mapExerciseLog(record: ExerciseLogApiRecord): ExerciseLogRecord {
  return {
    createdAt: record.created_at,
    durationSeconds: record.duration_seconds,
    exerciseId: record.exercise_id,
    exerciseName: record.exercise_name,
    id: record.id,
    planExerciseId: record.plan_exercise_id,
    poseSession: record.pose_session
      ? {
          confidenceAvg: toNullableNumber(record.pose_session.confidence_avg),
          endedAt: record.pose_session.ended_at,
          id: record.pose_session.id,
          repCountAi: record.pose_session.rep_count_ai,
          startedAt: record.pose_session.started_at,
        }
      : null,
    repsAiCounted: record.reps_ai_counted,
    repsCompleted: record.reps_completed,
    sessionId: record.session_id,
    setNumber: record.set_number,
    updatedAt: record.updated_at,
    userId: record.user_id,
    weightKg: toNullableNumber(record.weight_kg),
  };
}

function mapWorkoutSessionSummary(
  record: WorkoutSessionSummaryApiRecord,
): WorkoutSessionSummaryRecord {
  return {
    cancelledAt: record.cancelled_at,
    completedAt: record.completed_at,
    createdAt: record.created_at,
    durationSeconds: record.duration_seconds,
    exerciseLogCount: record.exercise_log_count,
    id: record.id,
    lastActivityAt: record.last_activity_at,
    plan: record.plan
      ? {
          goal: record.plan.goal,
          id: record.plan.id,
          source: record.plan.source,
          title: record.plan.title,
        }
      : null,
    planId: record.plan_id,
    startedAt: record.started_at,
    status: record.status,
    totalVolumeKg: toNullableNumber(record.total_volume_kg),
    updatedAt: record.updated_at,
    userId: record.user_id,
  };
}

function mapWorkoutSessionDetail(
  record: WorkoutSessionDetailApiRecord,
): WorkoutSessionDetailRecord {
  return {
    ...mapWorkoutSessionSummary(record),
    exerciseLogs: record.exercise_logs.map(mapExerciseLog),
  };
}

function mapPoseSession(record: PoseSessionApiRecord): PoseSessionRecord {
  return {
    analysisSummary: record.analysis_summary,
    classificationConfidence: toNullableNumber(
      record.classification_confidence,
    ),
    confidenceAvg: toNullableNumber(record.confidence_avg),
    createdAt: record.created_at,
    detectedExerciseName: record.detected_exercise_name,
    detectedProfileId: record.detected_profile_id,
    endedAt: record.ended_at,
    exerciseHint: record.exercise_hint,
    exerciseLogId: record.exercise_log_id,
    id: record.id,
    repCountAi: record.rep_count_ai,
    startedAt: record.started_at,
    subjectLockConfidence: toNullableNumber(record.subject_lock_confidence),
    updatedAt: record.updated_at,
    userId: record.user_id,
  };
}

function mapStartedPoseSession(
  record: StartedPoseSessionApiRecord,
): StartedPoseSessionRecord {
  return {
    acceptedFps: record.accepted_fps,
    poseSessionId: record.pose_session_id,
  };
}

function mapPoseFrameAnalysis(
  record: PoseFrameAnalysisApiRecord,
): PoseFrameAnalysisRecord {
  return {
    candidateExercises: record.candidate_exercises ?? [],
    classificationSource: record.classification_source ?? "classifier",
    confidence: record.confidence,
    equipmentConfidence: toNullableNumber(record.equipment_confidence),
    equipmentConflicts: record.equipment_conflicts ?? [],
    equipmentContext: record.equipment_context ?? null,
    equipmentSource: record.equipment_source ?? null,
    exerciseClass: record.exercise_class,
    formFeedback: record.form_feedback ?? [],
    integrityReasonCodes: record.integrity_reason_codes ?? [],
    keypoints: Array.isArray(record.keypoints)
      ? record.keypoints.map((keypoint) => ({
          visibility: toRoundedDecimal(keypoint.visibility) ?? 0,
          x: toRoundedDecimal(keypoint.x) ?? 0,
          y: toRoundedDecimal(keypoint.y) ?? 0,
          z: toRoundedDecimal(keypoint.z) ?? 0,
        }))
      : null,
    matchedProfileId: record.matched_profile_id ?? null,
    movementContract: record.movement_contract
      ? {
          bodyOrientation: record.movement_contract.body_orientation,
          contractVersion: record.movement_contract.contract_version,
          dominantJoint: record.movement_contract.dominant_joint,
          degradedConditions:
            record.movement_contract.degraded_conditions ?? [],
          exercise: record.movement_contract.exercise,
          noCountConditions: record.movement_contract.no_count_conditions ?? [],
          oscillatingJoints: record.movement_contract.oscillating_joints,
          partialRepPolicy: record.movement_contract.partial_rep_policy,
          phaseOrder: record.movement_contract.phase_order ?? [],
          primaryJoints: record.movement_contract.primary_joints ?? [],
          holdDurationSeconds:
            toNullableNumber(record.movement_contract.hold_duration_seconds),
          repModel: record.movement_contract.rep_model,
          repThresholds: {
            down: {
              angle: record.movement_contract.rep_thresholds.down.angle,
              tolerance: record.movement_contract.rep_thresholds.down.tolerance,
            },
            up: {
              angle: record.movement_contract.rep_thresholds.up.angle,
              tolerance: record.movement_contract.rep_thresholds.up.tolerance,
            },
          },
          requiredSides: record.movement_contract.required_sides,
          secondaryCheck: record.movement_contract.secondary_check,
          secondaryJoints: record.movement_contract.secondary_joints ?? [],
          spatialRequirements: record.movement_contract.spatial_requirements
            ? {
                bodyLineTolerance: toNullableNumber(
                  record.movement_contract.spatial_requirements
                    .body_line_tolerance,
                ),
                bodyXDriftMax: toNullableNumber(
                  record.movement_contract.spatial_requirements
                    .body_x_drift_max,
                ),
                bodyYTravelMin: toNullableNumber(
                  record.movement_contract.spatial_requirements
                    .body_y_travel_min,
                ),
                hipYTravelMin: toNullableNumber(
                  record.movement_contract.spatial_requirements
                    .hip_y_travel_min,
                ),
                shoulderHipTravelMin: toNullableNumber(
                  record.movement_contract.spatial_requirements
                    .shoulder_hip_travel_min,
                ),
                shoulderYTravelMin: toNullableNumber(
                  record.movement_contract.spatial_requirements
                    .shoulder_y_travel_min,
                ),
                torsoSlopeMaxDeg: toNullableNumber(
                  record.movement_contract.spatial_requirements
                    .torso_slope_max_deg,
                ),
                torsoSlopeMinDeg: toNullableNumber(
                  record.movement_contract.spatial_requirements
                    .torso_slope_min_deg,
                ),
                wristAnchorDriftMax: toNullableNumber(
                  record.movement_contract.spatial_requirements
                    .wrist_anchor_drift_max,
                ),
                leftRightSymmetryTolerance: toNullableNumber(
                  record.movement_contract.spatial_requirements
                    .left_right_symmetry_tolerance,
                ),
                phaseSyncToleranceMs: toNullableNumber(
                  record.movement_contract.spatial_requirements
                    .phase_sync_tolerance_ms,
                ),
              }
            : null,
          trackingRequirements: record.movement_contract.tracking_requirements
            ? {
                minConfidence:
                  record.movement_contract.tracking_requirements
                    .min_confidence ?? 0.6,
                minReliableFrameLandmarks:
                  record.movement_contract.tracking_requirements
                    .min_reliable_frame_landmarks ?? 12,
                requiredLandmarks:
                  record.movement_contract.tracking_requirements
                    .required_landmarks ?? [],
                requiredSides:
                  record.movement_contract.tracking_requirements.required_sides,
              }
            : undefined,
        }
      : null,
    needsConfirmation: record.needs_confirmation ?? false,
    phase: record.phase ?? null,
    processingMode: record.processing_mode ?? "sequence",
    poseSessionId: record.pose_session_id,
    progressionDisposition: record.progression_disposition ?? "normal",
    reliableFrameRatio: toNullableNumber(record.reliable_frame_ratio),
    repCountDelta: record.rep_count_delta ?? 0,
    repEvent: record.rep_event ?? false,
    reviewRecommended: record.review_recommended ?? false,
    sessionQualityReasons: record.session_quality_reasons ?? [],
    sessionQualityState: record.session_quality_state ?? "stable",
    subjectLockConfidence: record.subject_lock_confidence ?? null,
    subjectLocked: record.subject_locked ?? null,
  };
}

function mapPoseEquipmentDetection(
  record: PoseEquipmentDetectionApiRecord,
): PoseEquipmentDetectionRecord {
  const equipmentDetections: PoseEquipmentDetectionBoxRecord[] = Array.isArray(
    record.equipment_detections,
  )
    ? record.equipment_detections.map((detection) => ({
        confidence: toNullableNumber(detection.confidence),
        height: toNullableNumber(detection.height),
        label: detection.label ?? null,
        width: toNullableNumber(detection.width),
        x: toNullableNumber(detection.x),
        y: toNullableNumber(detection.y),
      }))
    : [];

  return {
    equipmentConfidence: toNullableNumber(record.equipment_confidence),
    equipmentConflicts: record.equipment_conflicts ?? [],
    equipmentContext: record.equipment_context ?? null,
    equipmentDetections,
    equipmentSource: record.equipment_source ?? null,
    providerEnabled: record.provider_enabled ?? false,
  };
}

function mapMuscleMastery(record: MuscleMasteryApiRecord): MuscleMasteryRecord {
  return {
    createdAt: record.created_at,
    id: record.id,
    lastRankedAt: record.last_ranked_at,
    muscleGroup: record.muscle_group,
    rank: record.rank,
    rankDisplay: record.rank_display,
    totalVolumeKg: Number(record.total_volume_kg),
    updatedAt: record.updated_at,
    userId: record.user_id,
    xpPoints: record.xp_points,
  };
}

function mapLeaderboardEntry(
  record: LeaderboardEntryApiRecord,
): FitnessLeaderboardEntryRecord {
  return {
    avatarUrl: record.avatar_url,
    displayName: record.display_name,
    rankPosition: record.rank_position,
    progression: getFitnessExpProgressionState(record.total_xp),
    totalXp: record.total_xp,
    userId: record.user_id,
  };
}

function mapMuscleLeaderboardEntry(
  record: MuscleLeaderboardApiRecord,
): FitnessMuscleLeaderboardEntryRecord {
  return {
    avatarUrl: record.avatar_url ?? null,
    displayName: record.display_name,
    iconAssetKey: record.icon_asset_key ?? null,
    iconKey: record.icon_key ?? "dumbbell",
    iconKind: record.icon_kind ?? "library",
    isCurrentUser: record.is_current_user,
    lastEarnedAt: record.last_earned_at,
    muscleKey: record.muscle_key,
    rankPosition: record.rank_position,
    progression: getFitnessExpProgressionState(record.xp_points),
    scope: record.scope,
    seasonId: record.season_id,
    seasonTitle: record.season_title,
    userId: record.user_id,
    xpPoints: record.xp_points,
  };
}

function mapSeasonHistory(
  record: SeasonHistoryApiRecord,
): FitnessSeasonHistoryRecord {
  return {
    closedAt: record.closed_at,
    endsAt: record.ends_at,
    seasonId: record.season_id,
    startsAt: record.starts_at,
    title: record.title,
    topPerformers: record.top_performers.map((performer) => ({
      displayName: performer.display_name,
      rankPosition: performer.rank_position,
      seasonPoints: performer.season_points,
      userId: performer.user_id,
    })),
  };
}

function mapActiveSeason(
  record: ProgressionActiveSeasonApiRecord | null,
): FitnessProgressionProfileRecord["activeSeason"] {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    status: record.status,
    startsAt: record.starts_at,
    endsAt: record.ends_at,
  };
}

function mapProgressionProfile(
  record: ProgressionProfileApiRecord,
): FitnessProgressionProfileRecord {
  return {
    activeSeason: mapActiveSeason(record.active_season),
    createdAt: record.created_at,
    currentSeasonPoints: record.current_season_points,
    currentStreak: record.current_streak,
    integrityRiskLevel: record.integrity_risk_level,
    lastProgressedAt: record.last_progressed_at,
    longestStreak: record.longest_streak,
    lifetimeProgression: getFitnessExpProgressionState(record.total_xp),
    rankingGovernanceStatus: record.ranking_governance_status,
    rankingVisibility: record.ranking_visibility,
    seasonProgression: getFitnessExpProgressionState(record.current_season_points),
    totalXp: record.total_xp,
    updatedAt: record.updated_at,
    userId: record.user_id,
  };
}

function mapProgressionSource(
  record: ProgressionSourceApiRecord,
): FitnessProgressionSourceRecord {
  return {
    createdAt: record.created_at,
    eligibilityState: record.eligibility_state,
    exerciseLogIds: record.exercise_log_ids,
    id: record.id,
    integrityState: record.integrity_state,
    linkedSourceIds: record.linked_source_ids,
    occurredAt: record.occurred_at,
    poseSessionId: record.pose_session_id,
    poseSessionIds: record.pose_session_ids,
    processedAt: record.processed_at,
    producerRuntime: record.producer_runtime,
    recordedAt: record.recorded_at,
    sessionId: record.session_id,
    sourceId: record.source_id,
    sourceQualityNotes: record.source_quality_notes,
    sourceStatus: record.source_status,
    sourceType: record.source_type,
    terminalState: record.terminal_state,
    updatedAt: record.updated_at,
    validationState: record.validation_state,
  };
}

function mapRankingProfile(
  record: RankingProfileApiRecord,
): FitnessRankingProfileRecord {
  return {
    displayAlias: record.display_alias,
    governanceStatus: record.governance_status,
    updatedAt: record.updated_at,
    userId: record.user_id,
    visibility: record.visibility,
  };
}

function mapSeasonStanding(
  record: SeasonStandingApiRecord,
): FitnessSeasonStandingRecord {
  return {
    isDisqualified: record.is_disqualified,
    isHidden: record.is_hidden,
    lastEarnedAt: record.last_earned_at,
    rankPosition: record.rank_position,
    season: mapActiveSeason(record.season),
    seasonPoints: record.season_points,
    userId: record.user_id,
  };
}

function mapMilestoneProgress(
  record: MilestoneProgressApiRecord,
): FitnessMilestoneProgressRecord {
  return {
    category: record.category,
    claimedAt: record.claimed_at,
    conditionPayload: record.condition_payload ?? null,
    description: record.description,
    evidenceRequirement: record.evidence_requirement,
    iconAssetKey: record.icon_asset_key ?? null,
    iconKey: record.icon_key ?? null,
    iconKind: record.icon_kind ?? "library",
    isHidden: record.is_hidden,
    key: record.key,
    latestEvidenceSubmission: record.latest_evidence_submission
      ? mapMilestoneEvidenceSubmission(record.latest_evidence_submission)
      : null,
    milestoneDefinitionId: record.milestone_definition_id,
    progressPercent: record.progress_percent,
    progressValue: record.progress_value,
    rewardPayload: record.reward_payload,
    status: record.status,
    targetValue: record.target_value,
    title: record.title,
    triggerType: record.trigger_type,
    unlockedAt: record.unlocked_at,
    updatedAt: record.updated_at,
    verificationPolicy: record.verification_policy,
  };
}

function mapAdminMilestoneDefinition(
  record: AdminMilestoneDefinitionApiRecord,
): AdminMilestoneDefinitionRecord {
  return {
    archivedAt: record.archived_at,
    archivedByUserId: record.archived_by_user_id,
    category: record.category,
    conditionPayload: record.condition_payload,
    createdAt: record.created_at,
    createdByUserId: record.created_by_user_id,
    description: record.description,
    endsAt: record.ends_at,
    evidenceRequirement: record.evidence_requirement,
    id: record.id,
    iconAssetKey: record.icon_asset_key ?? null,
    iconKey: record.icon_key ?? null,
    iconKind: record.icon_kind ?? "library",
    isActive: record.is_active,
    isHidden: record.is_hidden,
    key: record.key,
    pendingReviewCount: record.pending_review_count,
    progressCount: record.progress_count,
    rewardPayload: record.reward_payload,
    sortOrder: record.sort_order,
    startsAt: record.starts_at,
    status: record.status,
    title: record.title,
    triggerType: record.trigger_type,
    unlockedCount: record.unlocked_count,
    updatedAt: record.updated_at,
    updatedByUserId: record.updated_by_user_id,
    verificationPolicy: record.verification_policy,
  };
}

function mapMilestoneEvidenceSubmission(
  record: MilestoneEvidenceSubmissionApiRecord,
): FitnessMilestoneEvidenceSubmissionRecord {
  return {
    caption: record.caption,
    createdAt: record.created_at,
    evidenceType: record.evidence_type,
    fileKey: record.file_key,
    fileUrl: record.file_url,
    id: record.id,
    memberEmail: record.member_email,
    memberInitials: record.member_initials,
    memberName: record.member_name,
    milestoneDefinitionId: record.milestone_definition_id,
    milestoneKey: record.milestone_key,
    milestoneTitle: record.milestone_title,
    mimeType: record.mime_type,
    originalFilename: record.original_filename,
    reviewerNotes: record.reviewer_notes,
    reviewedAt: record.reviewed_at,
    reviewedByUserId: record.reviewed_by_user_id,
    sizeBytes: record.size_bytes,
    status: record.status,
    updatedAt: record.updated_at,
    userId: record.user_id,
  };
}

function mapAchievementReview(
  record: AchievementReviewApiRecord,
): FitnessAchievementReviewRecord {
  return {
    badgeLabel: record.badge_label,
    id: record.id,
    memberEmail: record.member_email,
    memberId: record.member_id,
    memberInitials: record.member_initials,
    memberName: record.member_name,
    proofCaption: record.proof_caption,
    proofImageUrl: record.proof_image_url,
    reviewedAt: record.reviewed_at,
    reviewerNotes: record.reviewer_notes,
    status: record.status,
    submittedAt: record.submitted_at,
  };
}

function mapIntegritySummary(
  record: IntegritySummaryApiRecord,
): FitnessIntegritySummaryRecord {
  return {
    lastFlaggedAt: record.last_flagged_at,
    lastResolvedAt: record.last_resolved_at,
    openCaseCount: record.open_case_count,
    recentCases: record.recent_cases.map((entry) => ({
      id: entry.id,
      openedAt: entry.opened_at,
      resolvedAt: entry.resolved_at,
      status: entry.status,
      summary: entry.summary,
    })),
    riskLevel: record.risk_level,
    userId: record.user_id,
  };
}

function toExerciseListParams(params?: FitnessExerciseListParams) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.search ? { search: params.search } : {}),
    ...(params?.muscleGroup ? { muscle_group: params.muscleGroup } : {}),
    ...(params?.category ? { category: params.category } : {}),
    ...(params?.includeInactive ? { include_inactive: true } : {}),
  };
}


function toMuscleDefinitionListParams(params?: MuscleDefinitionListParams) {
  return {
    ...(params?.search ? { search: params.search } : {}),
    ...(params?.includeArchived ? { include_archived: true } : {}),
  };
}

function toMuscleDefinitionPayload(
  input: CreateMuscleDefinitionInput | UpdateMuscleDefinitionInput,
) {
  return {
    ...(input.key?.trim() ? { key: input.key.trim() } : {}),
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    ...(input.bodyRegion?.trim()
      ? { body_region: input.bodyRegion.trim() }
      : {}),
    ...(input.iconAssetKey !== undefined
      ? { icon_asset_key: input.iconAssetKey }
      : {}),
    ...(input.iconKey !== undefined ? { icon_key: input.iconKey } : {}),
    ...(input.iconKind !== undefined ? { icon_kind: input.iconKind } : {}),
    ...("aliases" in input && input.aliases !== undefined
      ? { aliases: input.aliases }
      : {}),
    ...("sortOrder" in input && input.sortOrder !== undefined
      ? { sort_order: input.sortOrder }
      : {}),
    ...("isActive" in input && input.isActive !== undefined
      ? { is_active: input.isActive }
      : {}),
  };
}

function toExerciseMutationPayload(
  input: CreateFitnessExerciseInput | UpdateFitnessExerciseInput,
) {
  return {
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    ...(input.muscleGroup?.trim()
      ? { muscle_group: input.muscleGroup.trim() }
      : {}),
    ...("muscleTargets" in input && input.muscleTargets !== undefined
      ? { muscle_targets: input.muscleTargets }
      : {}),
    ...("movementProfile" in input && input.movementProfile !== undefined
      ? { movement_profile: input.movementProfile }
      : {}),
    ...("handShapeProfile" in input && input.handShapeProfile !== undefined
      ? { hand_shape_profile: input.handShapeProfile }
      : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.description?.trim()
      ? { description: input.description.trim() }
      : {}),
    ...(input.instructions?.trim()
      ? { instructions: input.instructions.trim() }
      : {}),
    ...(input.videoUrl?.trim() ? { video_url: input.videoUrl.trim() } : {}),
    ...(input.imageUrl?.trim() ? { image_url: input.imageUrl.trim() } : {}),
    ...("isActive" in input && input.isActive !== undefined
      ? { is_active: input.isActive }
      : {}),
  };
}



function toMasteryListParams(params?: FitnessMasteryListParams) {
  return {
    ...(params?.muscleGroup ? { muscle_group: params.muscleGroup } : {}),
    ...(params?.rank ? { rank: params.rank } : {}),
  };
}

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeMuscleLeaderboardSeasonId(value?: string) {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  if (!CANONICAL_UUID_PATTERN.test(candidate)) {
    throw new Error("season_id must be a valid UUID");
  }
  return candidate;
}

function toMuscleLeaderboardParams(params: FitnessMuscleLeaderboardListParams) {
  const seasonId = normalizeMuscleLeaderboardSeasonId(params.seasonId);

  return {
    scope: params.scope,
    muscle_key: params.muscleKey,
    ...(params.cursor ? { cursor: params.cursor } : {}),
    ...(params.page !== undefined ? { page: params.page } : {}),
    ...(params.limit !== undefined ? { limit: params.limit } : {}),
    ...(seasonId ? { season_id: seasonId } : {}),
    ...(params.snapshot ? { snapshot: params.snapshot } : {}),
  };
}

function toLeaderboardListParams(params?: FitnessLeaderboardListParams) {
  return {
    ...(params?.cursor ? { cursor: params.cursor } : {}),
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.snapshot ? { snapshot: params.snapshot } : {}),
  };
}

function toPlanListParams(params?: TrainingPlanListParams) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
  };
}

function toProgressionSourceListParams(
  params?: FitnessProgressionSourceListParams,
) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.sourceType ? { source_type: params.sourceType } : {}),
    ...(params?.sourceStatus ? { source_status: params.sourceStatus } : {}),
  };
}

function toSessionListParams(params?: WorkoutSessionListParams) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.startDate ? { start_date: params.startDate } : {}),
    ...(params?.endDate ? { end_date: params.endDate } : {}),
  };
}

function toMilestoneListParams(params?: FitnessMilestoneListParams) {
  return {
    ...(params?.includeLocked ? { include_locked: true } : {}),
  };
}

function toAdminMilestoneDefinitionParams(
  params?: AdminMilestoneDefinitionListParams,
) {
  return {
    ...(params?.category && params.category !== "all"
      ? { category: params.category }
      : {}),
    ...(params?.evidenceRequirement && params.evidenceRequirement !== "all"
      ? { evidence_requirement: params.evidenceRequirement }
      : {}),
    ...(params?.includeArchived !== undefined
      ? { include_archived: params.includeArchived }
      : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.search ? { search: params.search } : {}),
    ...(params?.sort ? { sort: params.sort } : {}),
    ...(params?.status && params.status !== "all"
      ? { status: params.status }
      : {}),
    ...(params?.triggerType && params.triggerType !== "all"
      ? { trigger_type: params.triggerType }
      : {}),
    ...(params?.verificationPolicy && params.verificationPolicy !== "all"
      ? { verification_policy: params.verificationPolicy }
      : {}),
  };
}

function toAdminMilestoneEvidenceParams(
  params?: AdminMilestoneEvidenceListParams,
) {
  return {
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.search ? { search: params.search } : {}),
    ...(params?.status && params.status !== "all"
      ? { status: params.status }
      : {}),
  };
}

function toAdminMilestoneDefinitionPayload(
  input: UpsertAdminMilestoneDefinitionInput,
) {
  return {
    category: input.category,
    condition_payload: input.conditionPayload,
    description: input.description,
    ends_at: input.endsAt,
    evidence_requirement: input.evidenceRequirement,
    ...(input.iconAssetKey !== undefined
      ? { icon_asset_key: input.iconAssetKey }
      : {}),
    ...(input.iconKey !== undefined ? { icon_key: input.iconKey } : {}),
    ...(input.iconKind !== undefined ? { icon_kind: input.iconKind } : {}),
    is_hidden: input.isHidden,
    key: input.key,
    reward_payload: input.rewardPayload,
    sort_order: input.sortOrder,
    starts_at: input.startsAt,
    status: input.status,
    title: input.title,
    trigger_type: input.triggerType,
    verification_policy: input.verificationPolicy,
  };
}

function toSubmitMilestoneEvidencePayload(
  input: SubmitFitnessMilestoneEvidenceInput,
) {
  return {
    caption: input.caption,
    evidence_type: input.evidenceType,
    file_key: input.fileKey,
    file_url: input.fileUrl,
    mime_type: input.mimeType,
    original_filename: input.originalFilename,
    size_bytes: input.sizeBytes,
  };
}

function toReviewMilestoneEvidencePayload(
  input: ReviewFitnessMilestoneEvidenceInput,
) {
  return {
    reviewer_notes: input.reviewerNotes,
    status: input.status,
  };
}

function toRankingProfilePayload(input: UpdateFitnessRankingProfileInput) {
  return {
    visibility: input.visibility,
    ...(input.displayAlias !== undefined
      ? { display_alias: input.displayAlias }
      : {}),
  };
}

export function createFitnessApi(transport: ApiTransport) {
  return {
    async listMuscleDefinitions(
      params?: MuscleDefinitionListParams,
    ): Promise<MuscleDefinitionRecord[]> {
      const result = await unwrapResponse<
        MuscleDefinitionApiRecord[] | { data?: MuscleDefinitionApiRecord[] }
      >(
        transport.get("/fitness/muscle-definitions", {
          params: toMuscleDefinitionListParams(params),
        }),
        "Unable to load muscle definitions.",
      );
      const records = Array.isArray(result) ? result : (result.data ?? []);
      return records.map(mapMuscleDefinition);
    },
    async listMemberMuscleDefinitions(): Promise<MuscleDefinitionRecord[]> {
      const result = await unwrapResponse<
        MuscleDefinitionApiRecord[] | { data?: MuscleDefinitionApiRecord[] }
      >(
        transport.get("/fitness/member/muscle-definitions"),
        "Unable to load active muscle definitions.",
      );
      const records = Array.isArray(result) ? result : (result.data ?? []);
      return records.map(mapMuscleDefinition);
    },
    async createMuscleDefinition(input: CreateMuscleDefinitionInput) {
      return mapMuscleDefinition(
        await unwrapResponse<MuscleDefinitionApiRecord>(
          transport.post(
            "/fitness/muscle-definitions",
            toMuscleDefinitionPayload(input),
          ),
          "Unable to create muscle definition.",
        ),
      );
    },
    async updateMuscleDefinition(
      muscleDefinitionId: string,
      input: UpdateMuscleDefinitionInput,
    ) {
      return mapMuscleDefinition(
        await unwrapResponse<MuscleDefinitionApiRecord>(
          transport.patch(
            `/fitness/muscle-definitions/${muscleDefinitionId}`,
            toMuscleDefinitionPayload(input),
          ),
          "Unable to update muscle definition.",
        ),
      );
    },
    async archiveMuscleDefinition(muscleDefinitionId: string) {
      return mapMuscleDefinition(
        await unwrapResponse<MuscleDefinitionApiRecord>(
          transport.patch(
            `/fitness/muscle-definitions/${muscleDefinitionId}/archive`,
            {},
          ),
          "Unable to archive muscle definition.",
        ),
      );
    },
    async listExercises(
      params?: FitnessExerciseListParams,
    ): Promise<FitnessPaginatedResult<FitnessExerciseRecord>> {
      const result = await unwrapPaginatedResponse<FitnessExerciseApiRecord>(
        transport.get("/fitness/exercises", {
          params: toExerciseListParams(params),
        }),
        "Unable to load fitness exercises.",
      );
      return {
        ...result,
        data: result.data.map(mapExercise),
      };
    },
    async createExercise(input: CreateFitnessExerciseInput) {
      return mapExercise(
        await unwrapResponse<FitnessExerciseApiRecord>(
          transport.post(
            "/fitness/exercises",
            toExerciseMutationPayload(input),
          ),
          "Unable to create fitness exercise.",
        ),
      );
    },
    async updateExercise(
      exerciseId: string,
      input: UpdateFitnessExerciseInput,
    ) {
      return mapExercise(
        await unwrapResponse<FitnessExerciseApiRecord>(
          transport.patch(
            `/fitness/exercises/${exerciseId}`,
            toExerciseMutationPayload(input),
          ),
          "Unable to update fitness exercise.",
        ),
      );
    },
    async listPlans(
      params?: TrainingPlanListParams,
    ): Promise<FitnessPaginatedResult<TrainingPlanSummaryRecord>> {
      const result =
        await unwrapPaginatedResponse<TrainingPlanSummaryApiRecord>(
          transport.get("/fitness/plans", { params: toPlanListParams(params) }),
          "Unable to load fitness plans.",
        );
      return {
        ...result,
        data: result.data.map(mapTrainingPlanSummary),
      };
    },
    async listClientPlans(
      memberId: string,
      params?: TrainingPlanListParams,
    ): Promise<FitnessPaginatedResult<TrainingPlanSummaryRecord>> {
      const result =
        await unwrapPaginatedResponse<TrainingPlanSummaryApiRecord>(
          transport.get(`/fitness/plans/client/${memberId}`, {
            params: toPlanListParams(params),
          }),
          "Unable to load client fitness plans.",
        );
      return {
        ...result,
        data: result.data.map(mapTrainingPlanSummary),
      };
    },
    async getPlanById(planId: string) {
      return mapTrainingPlanDetail(
        await unwrapResponse<TrainingPlanDetailApiRecord>(
          transport.get(`/fitness/plans/${planId}`),
          "Unable to load fitness plan.",
        ),
      );
    },
    async createCustomExercise(input: CreateFitnessExerciseInput) {
      return mapExercise(
        await unwrapResponse<FitnessExerciseApiRecord>(
          transport.post(
            "/fitness/exercises/custom",
            toExerciseMutationPayload(input),
          ),
          "Unable to create custom fitness exercise.",
        ),
      );
    },
    async createPlan(input: CreateTrainingPlanInput) {
      return mapTrainingPlanDetail(
        await unwrapResponse<TrainingPlanDetailApiRecord>(
          transport.post(
            "/fitness/plans",
            toTrainingPlanMutationPayload(input),
          ),
          "Unable to create fitness plan.",
        ),
      );
    },
    async updatePlan(planId: string, input: CreateTrainingPlanInput) {
      return mapTrainingPlanDetail(
        await unwrapResponse<TrainingPlanDetailApiRecord>(
          transport.put(
            `/fitness/plans/${planId}`,
            toTrainingPlanMutationPayload(input),
          ),
          "Unable to update fitness plan.",
        ),
      );
    },
    async getPlanProgressionSuggestions(planId: string) {
      return (
        await unwrapResponse<TrainingProgressionSuggestionApiRecord[]>(
          transport.get(`/fitness/plans/${planId}/progression-suggestions`),
          "Unable to load workout progression suggestions.",
        )
      ).map(mapTrainingProgressionSuggestion);
    },
    async deletePlan(planId: string) {
      await unwrapResponse<{ message: string }>(
        transport.delete(`/fitness/plans/${planId}`),
        "Unable to delete fitness plan.",
      );
    },
    async activatePlan(planId: string) {
      return mapTrainingPlanDetail(
        await unwrapResponse<TrainingPlanDetailApiRecord>(
          transport.post(`/fitness/plans/${planId}/activate`),
          "Unable to activate fitness plan.",
        ),
      );
    },
    async assignPlan(planId: string, memberId: string) {
      return mapTrainingPlanDetail(
        await unwrapResponse<TrainingPlanDetailApiRecord>(
          transport.post(`/fitness/plans/${planId}/assign`, {
            member_id: memberId,
          }),
          "Unable to assign fitness plan.",
        ),
      );
    },
    async listSessions(
      params?: WorkoutSessionListParams,
    ): Promise<FitnessPaginatedResult<WorkoutSessionSummaryRecord>> {
      const result =
        await unwrapPaginatedResponse<WorkoutSessionSummaryApiRecord>(
          transport.get("/fitness/sessions", {
            params: toSessionListParams(params),
          }),
          "Unable to load workout sessions.",
        );
      return {
        ...result,
        data: result.data.map(mapWorkoutSessionSummary),
      };
    },
    async listMastery(params?: FitnessMasteryListParams) {
      return (
        await unwrapResponse<MuscleMasteryApiRecord[]>(
          transport.get("/fitness/mastery", {
            params: toMasteryListParams(params),
          }),
          "Unable to load muscle mastery progress.",
        )
      ).map(mapMuscleMastery);
    },
    async listLeaderboard(
      params?: FitnessLeaderboardListParams,
    ): Promise<FitnessPaginatedResult<FitnessLeaderboardEntryRecord>> {
      const result = await unwrapPaginatedResponse<LeaderboardEntryApiRecord>(
        transport.get("/fitness/leaderboard", {
          params: toLeaderboardListParams(params),
        }),
        "Unable to load mastery leaderboard.",
      );
      return {
        ...result,
        data: result.data.map(mapLeaderboardEntry),
      };
    },
    async listMuscleLeaderboard(
      params: FitnessMuscleLeaderboardListParams,
    ): Promise<FitnessPaginatedResult<FitnessMuscleLeaderboardEntryRecord>> {
      const result = await unwrapPaginatedResponse<MuscleLeaderboardApiRecord>(
        transport.get("/fitness/muscle-leaderboard", {
          params: toMuscleLeaderboardParams(params),
        }),
        "Unable to load muscle leaderboard.",
      );
      return {
        ...result,
        data: result.data.map(mapMuscleLeaderboardEntry),
      };
    },
    async listSeasonHistory(params?: FitnessSeasonHistoryListParams) {
      return (
        await unwrapResponse<SeasonHistoryApiRecord[]>(
          transport.get("/fitness/season-history", {
            params: params?.limit ? { limit: params.limit } : undefined,
          }),
          "Unable to load season history.",
        )
      ).map(mapSeasonHistory);
    },
    async getProgressionProfile() {
      return mapProgressionProfile(
        await unwrapResponse<ProgressionProfileApiRecord>(
          transport.get("/fitness/progression-profile"),
          "Unable to load progression profile.",
        ),
      );
    },
    async listProgressionSources(
      params?: FitnessProgressionSourceListParams,
    ): Promise<FitnessPaginatedResult<FitnessProgressionSourceRecord>> {
      const result = await unwrapPaginatedResponse<ProgressionSourceApiRecord>(
        transport.get("/fitness/progression-sources", {
          params: toProgressionSourceListParams(params),
        }),
        "Unable to load progression sources.",
      );
      return {
        ...result,
        data: result.data.map(mapProgressionSource),
      };
    },
    async getRankingProfile() {
      return mapRankingProfile(
        await unwrapResponse<RankingProfileApiRecord>(
          transport.get("/fitness/ranking-profile"),
          "Unable to load ranking profile.",
        ),
      );
    },
    async updateRankingProfile(input: UpdateFitnessRankingProfileInput) {
      return mapRankingProfile(
        await unwrapResponse<RankingProfileApiRecord>(
          transport.patch(
            "/fitness/ranking-profile",
            toRankingProfilePayload(input),
          ),
          "Unable to update ranking profile.",
        ),
      );
    },
    async getSeasonStanding() {
      return mapSeasonStanding(
        await unwrapResponse<SeasonStandingApiRecord>(
          transport.get("/fitness/season-standing"),
          "Unable to load active season standing.",
        ),
      );
    },
    async listMilestones(params?: FitnessMilestoneListParams) {
      return (
        await unwrapResponse<MilestoneProgressApiRecord[]>(
          transport.get("/fitness/milestones", {
            params: toMilestoneListParams(params),
          }),
          "Unable to load milestone progress.",
        )
      ).map(mapMilestoneProgress);
    },
    async listAdminMilestones(
      params?: AdminMilestoneDefinitionListParams,
    ): Promise<FitnessPaginatedResult<AdminMilestoneDefinitionRecord>> {
      const result =
        await unwrapPaginatedResponse<AdminMilestoneDefinitionApiRecord>(
          transport.get("/admin/gamification/milestones", {
            params: toAdminMilestoneDefinitionParams(params),
          }),
          "Unable to load milestone definitions.",
        );

      return {
        ...result,
        data: result.data.map(mapAdminMilestoneDefinition),
      };
    },
    async getAdminMilestone(milestoneDefinitionId: string) {
      return mapAdminMilestoneDefinition(
        await unwrapResponse<AdminMilestoneDefinitionApiRecord>(
          transport.get(
            `/admin/gamification/milestones/${milestoneDefinitionId}`,
          ),
          "Unable to load milestone definition.",
        ),
      );
    },
    async createAdminMilestone(input: UpsertAdminMilestoneDefinitionInput) {
      return mapAdminMilestoneDefinition(
        await unwrapResponse<AdminMilestoneDefinitionApiRecord>(
          transport.post(
            "/admin/gamification/milestones",
            toAdminMilestoneDefinitionPayload(input),
          ),
          "Unable to create milestone definition.",
        ),
      );
    },
    async updateAdminMilestone(
      milestoneDefinitionId: string,
      input: UpsertAdminMilestoneDefinitionInput,
    ) {
      return mapAdminMilestoneDefinition(
        await unwrapResponse<AdminMilestoneDefinitionApiRecord>(
          transport.patch(
            `/admin/gamification/milestones/${milestoneDefinitionId}`,
            toAdminMilestoneDefinitionPayload(input),
          ),
          "Unable to update milestone definition.",
        ),
      );
    },
    async archiveAdminMilestone(milestoneDefinitionId: string) {
      return mapAdminMilestoneDefinition(
        await unwrapResponse<AdminMilestoneDefinitionApiRecord>(
          transport.patch(
            `/admin/gamification/milestones/${milestoneDefinitionId}/archive`,
            {},
          ),
          "Unable to archive milestone definition.",
        ),
      );
    },
    async restoreAdminMilestone(milestoneDefinitionId: string) {
      return mapAdminMilestoneDefinition(
        await unwrapResponse<AdminMilestoneDefinitionApiRecord>(
          transport.patch(
            `/admin/gamification/milestones/${milestoneDefinitionId}/restore`,
            {},
          ),
          "Unable to restore milestone definition.",
        ),
      );
    },
    async listAchievementReviews() {
      return (
        await unwrapResponse<AchievementReviewApiRecord[]>(
          transport.get("/fitness/milestone-reviews"),
          "Unable to load milestone review records.",
        )
      ).map(mapAchievementReview);
    },
    async listMilestoneEvidence(
      params?: AdminMilestoneEvidenceListParams,
    ): Promise<
      FitnessPaginatedResult<FitnessMilestoneEvidenceSubmissionRecord>
    > {
      const result =
        await unwrapPaginatedResponse<MilestoneEvidenceSubmissionApiRecord>(
          transport.get("/fitness/milestone-evidence", {
            params: toAdminMilestoneEvidenceParams(params),
          }),
          "Unable to load milestone evidence.",
        );

      return {
        ...result,
        data: result.data.map(mapMilestoneEvidenceSubmission),
      };
    },
    async submitMilestoneEvidence(
      milestoneDefinitionId: string,
      input: SubmitFitnessMilestoneEvidenceInput,
    ) {
      return mapMilestoneEvidenceSubmission(
        await unwrapResponse<MilestoneEvidenceSubmissionApiRecord>(
          transport.post(
            `/fitness/milestones/${milestoneDefinitionId}/evidence`,
            toSubmitMilestoneEvidencePayload(input),
          ),
          "Unable to submit milestone evidence.",
        ),
      );
    },
    async reviewMilestoneEvidence(
      evidenceSubmissionId: string,
      input: ReviewFitnessMilestoneEvidenceInput,
    ) {
      return mapMilestoneEvidenceSubmission(
        await unwrapResponse<MilestoneEvidenceSubmissionApiRecord>(
          transport.patch(
            `/fitness/milestone-evidence/${evidenceSubmissionId}/review`,
            toReviewMilestoneEvidencePayload(input),
          ),
          "Unable to review milestone evidence.",
        ),
      );
    },
    async claimMilestone(milestoneDefinitionId: string) {
      return mapMilestoneProgress(
        await unwrapResponse<MilestoneProgressApiRecord>(
          transport.post(
            `/fitness/milestones/${milestoneDefinitionId}/claim`,
            {},
          ),
          "Unable to claim milestone.",
        ),
      );
    },
    async getIntegritySummary() {
      return mapIntegritySummary(
        await unwrapResponse<IntegritySummaryApiRecord>(
          transport.get("/fitness/integrity-summary"),
          "Unable to load integrity summary.",
        ),
      );
    },
    async getSessionById(sessionId: string) {
      return mapWorkoutSessionDetail(
        await unwrapResponse<WorkoutSessionDetailApiRecord>(
          transport.get(`/fitness/sessions/${sessionId}`),
          "Unable to load workout session.",
        ),
      );
    },
    async startSession(input: StartWorkoutSessionInput) {
      return mapWorkoutSessionDetail(
        await unwrapResponse<WorkoutSessionDetailApiRecord>(
          transport.post("/fitness/sessions/start", {
            ...(input.planId ? { plan_id: input.planId } : {}),
          }),
          "Unable to start workout session.",
        ),
      );
    },
    async logSet(sessionId: string, input: LogWorkoutSetInput) {
      return mapExerciseLog(
        await unwrapResponse<ExerciseLogApiRecord>(
          transport.post(`/fitness/sessions/${sessionId}/sets`, {
            exercise_id: input.exerciseId,
            set_number: input.setNumber,
            ...(input.planExerciseId
              ? { plan_exercise_id: input.planExerciseId }
              : {}),
            ...(input.repsCompleted !== undefined
              ? { reps_completed: input.repsCompleted }
              : {}),
            ...(input.weightKg !== undefined
              ? { weight_kg: input.weightKg }
              : {}),
            ...(input.durationSeconds !== undefined
              ? { duration_seconds: input.durationSeconds }
              : {}),
            ...(input.poseSessionId
              ? { pose_session_id: input.poseSessionId }
              : {}),
          }),
          "Unable to log workout set.",
        ),
      );
    },
    async completeSession(sessionId: string) {
      return mapWorkoutSessionDetail(
        await unwrapResponse<WorkoutSessionDetailApiRecord>(
          transport.post(`/fitness/sessions/${sessionId}/complete`),
          "Unable to complete workout session.",
        ),
      );
    },
    async cancelSession(sessionId: string) {
      return mapWorkoutSessionDetail(
        await unwrapResponse<WorkoutSessionDetailApiRecord>(
          transport.post(`/fitness/sessions/${sessionId}/cancel`),
          "Unable to cancel workout session.",
        ),
      );
    },
    async startPoseSession(input: StartPoseSessionInput) {
      return mapStartedPoseSession(
        await unwrapResponse<StartedPoseSessionApiRecord>(
          transport.post("/pose/sessions/start", {
            ...(input.exerciseHint
              ? { exercise_hint: input.exerciseHint }
              : {}),
          }),
          "Unable to start pose session.",
        ),
      );
    },
    async analyzePoseSession(
      poseSessionId: string,
      input: AnalyzePoseSequenceInput,
    ) {
      const body =
        "frameBase64" in input
          ? {
              ...(input.cameraFacingMode
                ? { camera_facing_mode: input.cameraFacingMode }
                : {}),
              ...(input.equipmentContext !== undefined
                ? { equipment_context: input.equipmentContext }
                : {}),
              ...(input.equipmentSource !== undefined
                ? { equipment_source: input.equipmentSource }
                : {}),
              ...(input.equipmentConfidence !== undefined
                ? { equipment_confidence: input.equipmentConfidence }
                : {}),
              ...(input.equipmentConflicts !== undefined
                ? { equipment_conflicts: input.equipmentConflicts }
                : {}),
              ...(input.exerciseHint !== undefined
                ? { exercise_hint: input.exerciseHint }
                : {}),
              ...(input.subjectLocked !== undefined
                ? { subject_locked: input.subjectLocked }
                : {}),
              ...(input.subjectLockConfidence !== undefined
                ? { subject_lock_confidence: input.subjectLockConfidence }
                : {}),
              frame_b64: input.frameBase64,
            }
          : {
              ...(input.cameraFacingMode
                ? { camera_facing_mode: input.cameraFacingMode }
                : {}),
              ...(input.equipmentContext !== undefined
                ? { equipment_context: input.equipmentContext }
                : {}),
              ...(input.equipmentSource !== undefined
                ? { equipment_source: input.equipmentSource }
                : {}),
              ...(input.equipmentConfidence !== undefined
                ? { equipment_confidence: input.equipmentConfidence }
                : {}),
              ...(input.equipmentConflicts !== undefined
                ? { equipment_conflicts: input.equipmentConflicts }
                : {}),
              ...(input.exerciseHint !== undefined
                ? { exercise_hint: input.exerciseHint }
                : {}),
              ...(input.subjectLocked !== undefined
                ? { subject_locked: input.subjectLocked }
                : {}),
              ...(input.subjectLockConfidence !== undefined
                ? { subject_lock_confidence: input.subjectLockConfidence }
                : {}),
              frames: input.frames.map((frame) => ({
                captured_at_ms: frame.capturedAtMs,
                keypoints: frame.keypoints.map((keypoint) => ({
                  visibility: toRoundedDecimal(keypoint.visibility) ?? 0,
                  x: toRoundedDecimal(keypoint.x) ?? 0,
                  y: toRoundedDecimal(keypoint.y) ?? 0,
                  z: toRoundedDecimal(keypoint.z) ?? 0,
                })),
              })),
              landmark_schema: input.landmarkSchema,
              signals: {
                angles: input.signals.angles.map((entry) => ({
                  captured_at_ms: entry.capturedAtMs,
                  elbow: toRoundedDecimal(entry.elbow),
                  hip: toRoundedDecimal(entry.hip),
                  knee: toRoundedDecimal(entry.knee),
                  left_elbow: toRoundedDecimal(entry.leftElbow),
                  left_hip: toRoundedDecimal(entry.leftHip),
                  left_knee: toRoundedDecimal(entry.leftKnee),
                  left_shoulder: toRoundedDecimal(entry.leftShoulder),
                  right_elbow: toRoundedDecimal(entry.rightElbow),
                  right_hip: toRoundedDecimal(entry.rightHip),
                  right_knee: toRoundedDecimal(entry.rightKnee),
                  right_shoulder: toRoundedDecimal(entry.rightShoulder),
                  shoulder: toRoundedDecimal(entry.shoulder),
                })),
                hip: {
                  average_y: toRoundedDecimal(input.signals.hip.averageY) ?? 0,
                  range_x: toRoundedDecimal(input.signals.hip.rangeX),
                  range_y: toRoundedDecimal(input.signals.hip.rangeY) ?? 0,
                  stable: input.signals.hip.stable,
                },
                orientation: {
                  body_orientation: input.signals.orientation.bodyOrientation,
                  torso_slope_deg:
                    toRoundedDecimal(input.signals.orientation.torsoSlopeDeg) ??
                    0,
                  vector: {
                    x:
                      toRoundedDecimal(input.signals.orientation.vector.x) ?? 0,
                    y:
                      toRoundedDecimal(input.signals.orientation.vector.y) ?? 0,
                  },
                },
                temporal: {
                  amplitudes: roundNumericRecord(
                    input.signals.temporal.amplitudes,
                  ),
                  oscillating_joints: input.signals.temporal.oscillatingJoints,
                  phase_sync_ms: toRoundedDecimal(
                    input.signals.temporal.phaseSyncMs,
                  ),
                },
                visibility: {
                  average_visibility:
                    toRoundedDecimal(
                      input.signals.visibility.averageVisibility,
                    ) ?? 0,
                  feet_visibility:
                    toRoundedDecimal(input.signals.visibility.feetVisibility) ??
                    0,
                  left_arm_visibility: toRoundedDecimal(
                    input.signals.visibility.leftArmVisibility,
                  ),
                  low_confidence_landmarks:
                    input.signals.visibility.lowConfidenceLandmarks,
                  reliable_frame_count:
                    input.signals.visibility.reliableFrameCount,
                  right_arm_visibility: toRoundedDecimal(
                    input.signals.visibility.rightArmVisibility,
                  ),
                  wrist_visibility:
                    toRoundedDecimal(
                      input.signals.visibility.wristVisibility,
                    ) ?? 0,
                },
              },
            };

      return mapPoseFrameAnalysis(
        await unwrapResponse<PoseFrameAnalysisApiRecord>(
          transport.post(`/pose/sessions/${poseSessionId}/analyze`, body),
          "Unable to analyze pose input.",
        ),
      );
    },
    async detectPoseEquipment(input: DetectPoseEquipmentInput) {
      if ("frameUri" in input && input.frameUri) {
        const formData = new FormData();
        formData.append("file", {
          name: "equipment-frame.jpg",
          type: "image/jpeg",
          uri: input.frameUri,
        } as unknown as Blob);
        if (input.cameraFacingMode) {
          formData.append("camera_facing_mode", input.cameraFacingMode);
        }
        if (input.exerciseHint !== undefined && input.exerciseHint !== null) {
          formData.append("exercise_hint", input.exerciseHint);
        }

        return mapPoseEquipmentDetection(
          await unwrapResponse<PoseEquipmentDetectionApiRecord>(
            transport.post("/workout/equipment/detect-file", formData),
            "Unable to detect workout equipment.",
          ),
        );
      }

      return mapPoseEquipmentDetection(
        await unwrapResponse<PoseEquipmentDetectionApiRecord>(
          transport.post("/workout/equipment/detect", {
            ...(input.cameraFacingMode
              ? { camera_facing_mode: input.cameraFacingMode }
              : {}),
            ...(input.exerciseHint !== undefined
              ? { exercise_hint: input.exerciseHint }
              : {}),
            frame_b64: input.frameBase64,
          }),
          "Unable to detect workout equipment.",
        ),
      );
    },
    async getPoseSessionById(poseSessionId: string) {
      return mapPoseSession(
        await unwrapResponse<PoseSessionApiRecord>(
          transport.get(`/pose/sessions/${poseSessionId}`),
          "Unable to load pose session.",
        ),
      );
    },
    async finalizePoseSession(
      poseSessionId: string,
      input?: FinalizePoseSessionInput,
    ) {
      return mapPoseSession(
        await unwrapResponse<PoseSessionApiRecord>(
          transport.post(`/pose/sessions/${poseSessionId}/finalize`, {
            ...(input?.endedReason ? { ended_reason: input.endedReason } : {}),
            ...(input?.averageConfidence !== undefined
              ? { average_confidence: input.averageConfidence }
              : {}),
            ...(input?.detectedExerciseName !== undefined
              ? { detected_exercise_name: input.detectedExerciseName }
              : {}),
            ...(input?.equipmentContext !== undefined
              ? { equipment_context: input.equipmentContext }
              : {}),
            ...(input?.equipmentSource !== undefined
              ? { equipment_source: input.equipmentSource }
              : {}),
            ...(input?.equipmentConfidence !== undefined
              ? { equipment_confidence: input.equipmentConfidence }
              : {}),
            ...(input?.equipmentConflicts !== undefined
              ? { equipment_conflicts: input.equipmentConflicts }
              : {}),
            ...(input?.weightInputKg !== undefined
              ? { weight_input_kg: input.weightInputKg }
              : {}),
            final_rep_count: input?.finalRepCount ?? 0,
            ...(input?.formFeedback
              ? { form_feedback: input.formFeedback }
              : {}),
            ...(input?.movementContract
              ? {
                movement_contract: {
                    body_orientation: input.movementContract.bodyOrientation,
                    contract_version: input.movementContract.contractVersion,
                    dominant_joint: input.movementContract.dominantJoint,
                    degraded_conditions:
                      input.movementContract.degradedConditions,
                    exercise: input.movementContract.exercise,
                    no_count_conditions:
                      input.movementContract.noCountConditions,
                    oscillating_joints:
                      input.movementContract.oscillatingJoints,
                    partial_rep_policy: input.movementContract.partialRepPolicy,
                    phase_order: input.movementContract.phaseOrder,
                    primary_joints: input.movementContract.primaryJoints,
                    hold_duration_seconds:
                      input.movementContract.holdDurationSeconds,
                    rep_model: input.movementContract.repModel,
                    rep_thresholds: {
                      down: input.movementContract.repThresholds.down,
                      up: input.movementContract.repThresholds.up,
                    },
                    required_sides: input.movementContract.requiredSides,
                    secondary_check: input.movementContract.secondaryCheck,
                    secondary_joints: input.movementContract.secondaryJoints,
                    spatial_requirements: input.movementContract
                      .spatialRequirements
                      ? {
                          body_line_tolerance:
                            input.movementContract.spatialRequirements
                              .bodyLineTolerance,
                          body_x_drift_max:
                            input.movementContract.spatialRequirements
                              .bodyXDriftMax,
                          body_y_travel_min:
                            input.movementContract.spatialRequirements
                              .bodyYTravelMin,
                          hip_y_travel_min:
                            input.movementContract.spatialRequirements
                              .hipYTravelMin,
                          shoulder_hip_travel_min:
                            input.movementContract.spatialRequirements
                              .shoulderHipTravelMin,
                          shoulder_y_travel_min:
                            input.movementContract.spatialRequirements
                              .shoulderYTravelMin,
                          torso_slope_max_deg:
                            input.movementContract.spatialRequirements
                              .torsoSlopeMaxDeg,
                          torso_slope_min_deg:
                            input.movementContract.spatialRequirements
                              .torsoSlopeMinDeg,
                          wrist_anchor_drift_max:
                            input.movementContract.spatialRequirements
                              .wristAnchorDriftMax,
                          left_right_symmetry_tolerance:
                            input.movementContract.spatialRequirements
                              .leftRightSymmetryTolerance,
                          phase_sync_tolerance_ms:
                            input.movementContract.spatialRequirements
                              .phaseSyncToleranceMs,
                          }
                        : null,
                    tracking_requirements: input.movementContract
                      .trackingRequirements
                      ? {
                          min_confidence:
                            input.movementContract.trackingRequirements
                              .minConfidence,
                          min_reliable_frame_landmarks:
                            input.movementContract.trackingRequirements
                              .minReliableFrameLandmarks,
                          required_landmarks:
                            input.movementContract.trackingRequirements
                              .requiredLandmarks,
                          required_sides:
                            input.movementContract.trackingRequirements
                              .requiredSides,
                        }
                      : null,
                  },
                }
              : {}),
            raw_angle_data:
              input?.rawAngleData.map((entry) => ({
                dominant_joint: entry.dominantJoint,
                high_angle: entry.highAngle,
                low_angle: entry.lowAngle,
                rep_number: entry.repNumber,
                timestamp: entry.timestamp,
              })) ?? [],
          }),
          "Unable to finalize pose session.",
        ),
      );
    },
  };
}
