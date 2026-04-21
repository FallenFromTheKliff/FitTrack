import type {
  AnalyzePoseSequenceInput,
  CreateFitnessExerciseInput,
  ExerciseReviewSubmissionRecord,
  ExerciseReviewSubmissionStatus,
  FitnessExerciseCategory,
  ExerciseLogRecord,
  FinalizePoseSessionInput,
  FitnessExerciseListParams,
  FitnessExerciseReviewSubmissionListParams,
  FitnessExerciseRecord,
  FitnessLeaderboardEntryRecord,
  FitnessLeaderboardListParams,
  FitnessMasteryListParams,
  FitnessMasteryRank,
  FitnessPaginatedResult,
  LogWorkoutSetInput,
  MuscleMasteryRecord,
  PoseClassificationSource,
  PoseFrameAnalysisRecord,
  PoseSessionRecord,
  StartPoseSessionInput,
  StartedPoseSessionRecord,
  StartWorkoutSessionInput,
  TrainingPlanDetailRecord,
  TrainingPlanListParams,
  TrainingPlanSummaryRecord,
  UpdateExerciseReviewSubmissionInput,
  UpdateFitnessExerciseInput,
  WorkoutSessionDetailRecord,
  WorkoutSessionListParams,
  WorkoutSessionSummaryRecord,
} from "@fittrack/types";
import { unwrapPaginatedResponse, unwrapResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type {
  AnalyzePoseSequenceInput,
  CreateFitnessExerciseInput,
  ExerciseReviewSubmissionRecord,
  ExerciseReviewSubmissionStatus,
  FitnessExerciseCategory,
  ExerciseLogRecord,
  FinalizePoseSessionInput,
  FitnessExerciseListParams,
  FitnessExerciseReviewSubmissionListParams,
  FitnessExerciseRecord,
  FitnessLeaderboardEntryRecord,
  FitnessLeaderboardListParams,
  FitnessMasteryListParams,
  FitnessMasteryRank,
  FitnessPaginatedResult,
  LogWorkoutSetInput,
  MuscleMasteryRecord,
  PoseFrameAnalysisRecord,
  PoseSessionRecord,
  StartPoseSessionInput,
  StartedPoseSessionRecord,
  StartWorkoutSessionInput,
  TrainingPlanDetailRecord,
  TrainingPlanListParams,
  TrainingPlanSummaryRecord,
  UpdateExerciseReviewSubmissionInput,
  UpdateFitnessExerciseInput,
  WorkoutSessionDetailRecord,
  WorkoutSessionListParams,
  WorkoutSessionSummaryRecord,
} from "@fittrack/types";

type FitnessExerciseApiRecord = {
  category: FitnessExerciseRecord["category"];
  created_at: string;
  description: string | null;
  id: string;
  image_url: string | null;
  instructions: string | null;
  is_active: boolean;
  muscle_group: string;
  name: string;
  updated_at: string;
  video_url: string | null;
};

type ExerciseReviewSubmissionApiRecord = {
  category: ExerciseReviewSubmissionRecord["category"];
  created_at: string;
  description: string | null;
  evidence_bars: number[] | null;
  id: string;
  instructions: string | null;
  match_hint: string | null;
  muscle_group: string;
  origin_label: string;
  pose_session_id: string | null;
  proposed_name: string;
  published_exercise_id: string | null;
  queue_tag: string;
  review_notes: string | null;
  reviewed_at: string | null;
  source_label: string;
  status: ExerciseReviewSubmissionStatus;
  summary: string;
  title: string;
  trigger_label: string;
  updated_at: string;
  user_id: string;
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
  sets: number;
  weight_kg_target: string | null;
};

type TrainingPlanScheduleDayApiRecord = {
  day_of_week: number;
  exercises: TrainingPlanExerciseApiRecord[];
  focus_label: string | null;
  id: string;
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
  matched_profile_id?: string | null;
  movement_contract?: {
    dominant_joint: "elbow" | "shoulder" | "hip" | "knee";
    exercise: string;
    oscillating_joints: string[];
    rep_thresholds: {
      down: { angle: number; tolerance: number };
      up: { angle: number; tolerance: number };
    };
    secondary_check: string;
  } | null;
  needs_confirmation?: boolean;
  pose_session_id: string;
  subject_lock_confidence?: number;
  subject_locked?: boolean;
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
    id: record.id,
    imageUrl: record.image_url,
    instructions: record.instructions,
    isActive: record.is_active,
    muscleGroup: record.muscle_group,
    name: record.name,
    updatedAt: record.updated_at,
    videoUrl: record.video_url,
  };
}

function mapExerciseReviewSubmission(
  record: ExerciseReviewSubmissionApiRecord,
): ExerciseReviewSubmissionRecord {
  return {
    category: record.category,
    createdAt: record.created_at,
    description: record.description,
    evidenceBars: record.evidence_bars,
    id: record.id,
    instructions: record.instructions,
    matchHint: record.match_hint,
    muscleGroup: record.muscle_group,
    originLabel: record.origin_label,
    poseSessionId: record.pose_session_id,
    proposedName: record.proposed_name,
    publishedExerciseId: record.published_exercise_id,
    queueTag: record.queue_tag,
    reviewNotes: record.review_notes,
    reviewedAt: record.reviewed_at,
    sourceLabel: record.source_label,
    status: record.status,
    summary: record.summary,
    title: record.title,
    triggerLabel: record.trigger_label,
    updatedAt: record.updated_at,
    userId: record.user_id,
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
        sets: exercise.sets,
        weightKgTarget: toNullableNumber(exercise.weight_kg_target),
      })),
      focusLabel: day.focus_label,
      id: day.id,
      notes: day.notes,
      weekNumber: day.week_number,
    })),
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
    exerciseClass: record.exercise_class,
    formFeedback: record.form_feedback ?? [],
    matchedProfileId: record.matched_profile_id ?? null,
    movementContract: record.movement_contract
      ? {
          dominantJoint: record.movement_contract.dominant_joint,
          exercise: record.movement_contract.exercise,
          oscillatingJoints: record.movement_contract.oscillating_joints,
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
          secondaryCheck: record.movement_contract.secondary_check,
        }
      : null,
    needsConfirmation: record.needs_confirmation ?? false,
    poseSessionId: record.pose_session_id,
    subjectLockConfidence: record.subject_lock_confidence ?? null,
    subjectLocked: record.subject_locked ?? null,
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
    totalXp: record.total_xp,
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

function toExerciseReviewSubmissionListParams(
  params?: FitnessExerciseReviewSubmissionListParams,
) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.status ? { status: params.status } : {}),
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

function toExerciseReviewSubmissionPayload(
  input: UpdateExerciseReviewSubmissionInput,
) {
  return {
    ...(input.status ? { status: input.status } : {}),
    ...(input.publishedExerciseId
      ? { published_exercise_id: input.publishedExerciseId }
      : {}),
    ...(input.reviewNotes?.trim()
      ? { review_notes: input.reviewNotes.trim() }
      : {}),
  };
}

function toMasteryListParams(params?: FitnessMasteryListParams) {
  return {
    ...(params?.muscleGroup ? { muscle_group: params.muscleGroup } : {}),
    ...(params?.rank ? { rank: params.rank } : {}),
  };
}

function toPlanListParams(params?: TrainingPlanListParams) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
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

export function createFitnessApi(transport: ApiTransport) {
  return {
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
    async listExerciseReviewSubmissions(
      params?: FitnessExerciseReviewSubmissionListParams,
    ): Promise<FitnessPaginatedResult<ExerciseReviewSubmissionRecord>> {
      const result =
        await unwrapPaginatedResponse<ExerciseReviewSubmissionApiRecord>(
          transport.get("/fitness/exercise-review-submissions", {
            params: toExerciseReviewSubmissionListParams(params),
          }),
          "Unable to load exercise review submissions.",
        );
      return {
        ...result,
        data: result.data.map(mapExerciseReviewSubmission),
      };
    },
    async updateExerciseReviewSubmission(
      submissionId: string,
      input: UpdateExerciseReviewSubmissionInput,
    ) {
      return mapExerciseReviewSubmission(
        await unwrapResponse<ExerciseReviewSubmissionApiRecord>(
          transport.patch(
            `/fitness/exercise-review-submissions/${submissionId}`,
            toExerciseReviewSubmissionPayload(input),
          ),
          "Unable to update exercise review submission.",
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
    async getPlanById(planId: string) {
      return mapTrainingPlanDetail(
        await unwrapResponse<TrainingPlanDetailApiRecord>(
          transport.get(`/fitness/plans/${planId}`),
          "Unable to load fitness plan.",
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
          params: toPlanListParams(params),
        }),
        "Unable to load mastery leaderboard.",
      );
      return {
        ...result,
        data: result.data.map(mapLeaderboardEntry),
      };
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
      return mapPoseFrameAnalysis(
        await unwrapResponse<PoseFrameAnalysisApiRecord>(
          transport.post(`/pose/sessions/${poseSessionId}/analyze`, {
            ...(input.cameraFacingMode
              ? { camera_facing_mode: input.cameraFacingMode }
              : {}),
            ...(input.exerciseHint !== undefined
              ? { exercise_hint: input.exerciseHint }
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
                shoulder: toRoundedDecimal(entry.shoulder),
              })),
              hip: {
                average_y: toRoundedDecimal(input.signals.hip.averageY) ?? 0,
                range_y: toRoundedDecimal(input.signals.hip.rangeY) ?? 0,
                stable: input.signals.hip.stable,
              },
              orientation: {
                body_orientation: input.signals.orientation.bodyOrientation,
                torso_slope_deg:
                  toRoundedDecimal(input.signals.orientation.torsoSlopeDeg) ??
                  0,
                vector: {
                  x: toRoundedDecimal(input.signals.orientation.vector.x) ?? 0,
                  y: toRoundedDecimal(input.signals.orientation.vector.y) ?? 0,
                },
              },
              temporal: {
                amplitudes: roundNumericRecord(
                  input.signals.temporal.amplitudes,
                ),
                oscillating_joints: input.signals.temporal.oscillatingJoints,
              },
              visibility: {
                average_visibility:
                  toRoundedDecimal(
                    input.signals.visibility.averageVisibility,
                  ) ?? 0,
                feet_visibility:
                  toRoundedDecimal(input.signals.visibility.feetVisibility) ??
                  0,
                low_confidence_landmarks:
                  input.signals.visibility.lowConfidenceLandmarks,
                reliable_frame_count:
                  input.signals.visibility.reliableFrameCount,
                wrist_visibility:
                  toRoundedDecimal(input.signals.visibility.wristVisibility) ??
                  0,
              },
            },
          }),
          "Unable to analyze pose sequence.",
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
            final_rep_count: input?.finalRepCount ?? 0,
            ...(input?.formFeedback
              ? { form_feedback: input.formFeedback }
              : {}),
            ...(input?.movementContract
              ? {
                  movement_contract: {
                    dominant_joint: input.movementContract.dominantJoint,
                    exercise: input.movementContract.exercise,
                    oscillating_joints:
                      input.movementContract.oscillatingJoints,
                    rep_thresholds: {
                      down: input.movementContract.repThresholds.down,
                      up: input.movementContract.repThresholds.up,
                    },
                    secondary_check: input.movementContract.secondaryCheck,
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
