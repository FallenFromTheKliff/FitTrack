import type { PaginationMeta } from "./membership";

export type FitnessGoal =
  | "bulking"
  | "cutting"
  | "maintenance"
  | "sport_specific";
export type FitnessExerciseCategory =
  | "balance"
  | "cardio"
  | "flexibility"
  | "strength";
export type FitnessPlanSource =
  | "ai_generated"
  | "coach_assigned"
  | "self_created";
export type FitnessMasteryRank =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "adamantite";
export type WorkoutSessionStatus = "cancelled" | "completed" | "in_progress";
export type PoseSessionEndReason =
  | "client_disconnect"
  | "manual_stop"
  | "session_completed";
export type ExerciseReviewSubmissionStatus =
  | "left_private"
  | "pending"
  | "published"
  | "rejected";

export type FitnessExerciseListParams = {
  category?: FitnessExerciseCategory;
  includeInactive?: boolean;
  limit?: number;
  muscleGroup?: string;
  page?: number;
  search?: string;
};

export type FitnessExerciseReviewSubmissionListParams = {
  limit?: number;
  page?: number;
  status?: ExerciseReviewSubmissionStatus;
};

export type CreateFitnessExerciseInput = {
  category: FitnessExerciseCategory;
  description?: string;
  imageUrl?: string;
  instructions?: string;
  muscleGroup: string;
  name: string;
  videoUrl?: string;
};

export type UpdateFitnessExerciseInput = Partial<CreateFitnessExerciseInput> & {
  isActive?: boolean;
};

export type UpdateExerciseReviewSubmissionInput = {
  publishedExerciseId?: string;
  reviewNotes?: string;
  status?: ExerciseReviewSubmissionStatus;
};

export type TrainingPlanListParams = {
  limit?: number;
  page?: number;
};

export type FitnessMasteryListParams = {
  muscleGroup?: string;
  rank?: FitnessMasteryRank;
};

export type FitnessLeaderboardListParams = {
  limit?: number;
  page?: number;
};

export type WorkoutSessionListParams = {
  endDate?: string;
  limit?: number;
  page?: number;
  startDate?: string;
};

export type FitnessExerciseRecord = {
  category: FitnessExerciseCategory;
  createdAt: string;
  description: string | null;
  id: string;
  imageUrl: string | null;
  instructions: string | null;
  isActive: boolean;
  muscleGroup: string;
  name: string;
  updatedAt: string;
  videoUrl: string | null;
};

export type ExerciseReviewSubmissionRecord = {
  category: FitnessExerciseCategory;
  createdAt: string;
  description: string | null;
  evidenceBars: number[] | null;
  id: string;
  instructions: string | null;
  matchHint: string | null;
  muscleGroup: string;
  originLabel: string;
  poseSessionId: string | null;
  proposedName: string;
  publishedExerciseId: string | null;
  queueTag: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  sourceLabel: string;
  status: ExerciseReviewSubmissionStatus;
  summary: string;
  title: string;
  triggerLabel: string;
  updatedAt: string;
  userId: string;
};

export type TrainingPlanExerciseRecord = {
  category: FitnessExerciseCategory;
  durationSeconds: number | null;
  exerciseId: string;
  exerciseName: string;
  id: string;
  muscleGroup: string;
  notes: string | null;
  orderIndex: number;
  reps: number | null;
  restSeconds: number;
  sets: number;
  weightKgTarget: number | null;
};

export type TrainingPlanScheduleDayRecord = {
  dayOfWeek: number;
  exercises: TrainingPlanExerciseRecord[];
  focusLabel: string | null;
  id: string;
  notes: string | null;
  weekNumber: number;
};

export type TrainingPlanSummaryRecord = {
  coachId: string | null;
  createdAt: string;
  daysPerWeek: number;
  durationWeeks: number;
  goal: FitnessGoal;
  id: string;
  isActive: boolean;
  isTemplate: boolean;
  source: FitnessPlanSource;
  title: string;
  updatedAt: string;
  userId: string;
};

export type TrainingPlanDetailRecord = TrainingPlanSummaryRecord & {
  scheduleDays: TrainingPlanScheduleDayRecord[];
};

export type WorkoutSessionPlanSummaryRecord = {
  goal: FitnessGoal;
  id: string;
  source: FitnessPlanSource;
  title: string;
};

export type ExerciseLogPoseSessionRecord = {
  confidenceAvg: number | null;
  endedAt: string | null;
  id: string;
  repCountAi: number;
  startedAt: string;
};

export type ExerciseLogRecord = {
  createdAt: string;
  durationSeconds: number | null;
  exerciseId: string;
  exerciseName: string;
  id: string;
  planExerciseId: string | null;
  poseSession: ExerciseLogPoseSessionRecord | null;
  repsAiCounted: number | null;
  repsCompleted: number | null;
  sessionId: string;
  setNumber: number;
  updatedAt: string;
  userId: string;
  weightKg: number | null;
};

export type WorkoutSessionSummaryRecord = {
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  durationSeconds: number | null;
  exerciseLogCount: number;
  id: string;
  lastActivityAt: string;
  plan: WorkoutSessionPlanSummaryRecord | null;
  planId: string | null;
  startedAt: string;
  status: WorkoutSessionStatus;
  totalVolumeKg: number | null;
  updatedAt: string;
  userId: string;
};

export type WorkoutSessionDetailRecord = WorkoutSessionSummaryRecord & {
  exerciseLogs: ExerciseLogRecord[];
};

export type StartWorkoutSessionInput = {
  planId?: string;
};

export type LogWorkoutSetInput = {
  durationSeconds?: number;
  exerciseId: string;
  poseSessionId?: string;
  repsCompleted?: number;
  setNumber: number;
  weightKg?: number;
};

export type PoseSessionRecord = {
  analysisSummary: Record<string, unknown> | null;
  classificationConfidence: number | null;
  confidenceAvg: number | null;
  createdAt: string;
  detectedExerciseName: string | null;
  detectedProfileId: string | null;
  endedAt: string | null;
  exerciseHint: string | null;
  exerciseLogId: string | null;
  id: string;
  repCountAi: number;
  startedAt: string;
  subjectLockConfidence: number | null;
  updatedAt: string;
  userId: string;
};

export type StartPoseSessionInput = {
  exerciseHint?: string;
};

export type StartedPoseSessionRecord = {
  acceptedFps: number;
  poseSessionId: string;
};

export type PoseLandmarkSchema = "mediapipe_pose_v1";

export type PoseCameraFacingMode = "user" | "environment";

export type PoseClassificationSource =
  | "preset"
  | "classifier"
  | "user_confirmed";

export type PoseJointName = "elbow" | "shoulder" | "hip" | "knee";

export type PoseKeypointRecord = {
  visibility: number;
  x: number;
  y: number;
  z: number;
};

export type PoseSequenceFrameRecord = {
  capturedAtMs: number;
  keypoints: PoseKeypointRecord[];
};

export type PoseAngleFrameSignalRecord = {
  capturedAtMs: number;
  elbow: number | null;
  hip: number | null;
  knee: number | null;
  shoulder: number | null;
};

export type PoseOrientationSignalRecord = {
  bodyOrientation: string;
  torsoSlopeDeg: number;
  vector: {
    x: number;
    y: number;
  };
};

export type PoseVisibilitySignalRecord = {
  averageVisibility: number;
  feetVisibility: number;
  lowConfidenceLandmarks: string[];
  reliableFrameCount: number;
  wristVisibility: number;
};

export type PoseHipSignalRecord = {
  averageY: number;
  rangeY: number;
  stable: boolean;
};

export type PoseTemporalMovementSignalRecord = {
  amplitudes: Record<string, number>;
  oscillatingJoints: string[];
};

export type PoseSequenceSignalsRecord = {
  angles: PoseAngleFrameSignalRecord[];
  hip: PoseHipSignalRecord;
  orientation: PoseOrientationSignalRecord;
  temporal: PoseTemporalMovementSignalRecord;
  visibility: PoseVisibilitySignalRecord;
};

export type PoseRepThresholdRecord = {
  angle: number;
  tolerance: number;
};

export type PoseMovementContractRecord = {
  dominantJoint: PoseJointName;
  exercise: string;
  oscillatingJoints: string[];
  repThresholds: {
    down: PoseRepThresholdRecord;
    up: PoseRepThresholdRecord;
  };
  secondaryCheck: string;
};

export type PoseRepAngleDataRecord = {
  dominantJoint: PoseJointName;
  highAngle: number;
  lowAngle: number;
  repNumber: number;
  timestamp: number;
};

export type AnalyzePoseSequenceInput = {
  cameraFacingMode?: PoseCameraFacingMode;
  exerciseHint?: string | null;
  frames: PoseSequenceFrameRecord[];
  landmarkSchema: PoseLandmarkSchema;
  signals: PoseSequenceSignalsRecord;
};

export type PoseFrameAnalysisRecord = {
  candidateExercises: string[];
  classificationSource: PoseClassificationSource;
  confidence: number;
  exerciseClass: string | null;
  formFeedback: string[];
  matchedProfileId: string | null;
  movementContract: PoseMovementContractRecord | null;
  needsConfirmation: boolean;
  poseSessionId: string;
  subjectLockConfidence: number | null;
  subjectLocked: boolean | null;
};

export type FinalizePoseSessionInput = {
  averageConfidence?: number | null;
  detectedExerciseName?: string | null;
  endedReason?: PoseSessionEndReason;
  finalRepCount: number;
  formFeedback?: string[];
  movementContract?: PoseMovementContractRecord | null;
  rawAngleData: PoseRepAngleDataRecord[];
};

export type MuscleMasteryRecord = {
  createdAt: string;
  id: string;
  lastRankedAt: string | null;
  muscleGroup: string;
  rank: FitnessMasteryRank;
  rankDisplay: string;
  totalVolumeKg: number;
  updatedAt: string;
  userId: string;
  xpPoints: number;
};

export type FitnessLeaderboardEntryRecord = {
  avatarUrl: string | null;
  displayName: string;
  rankPosition: number;
  totalXp: number;
  userId: string;
};

export type FitnessPaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};
