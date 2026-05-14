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
export type FitnessCreatorState =
  | "none"
  | "candidate"
  | "pending_review"
  | "approved"
  | "suspended"
  | "revoked";
export type FitnessSeasonStatus = "draft" | "active" | "closed" | "archived";
export type FitnessMilestoneCategory =
  | "training"
  | "consistency"
  | "season"
  | "creator"
  | "governance";
export type FitnessMilestoneTriggerType =
  | "source_event"
  | "summary_threshold"
  | "streak"
  | "manual";
export type FitnessMilestoneProgressStatus =
  | "in_progress"
  | "unlocked"
  | "claimed";
export type FitnessAchievementReviewStatus =
  | "Pending"
  | "Approved"
  | "Rejected";
export type FitnessRankingVisibility = "public" | "anonymous" | "private";
export type FitnessRankingGovernanceStatus =
  | "normal"
  | "hidden_by_user"
  | "anonymized_by_user"
  | "hidden_by_admin"
  | "disqualified";
export type FitnessIntegrityRiskLevel = "low" | "medium" | "high";
export type FitnessIntegrityCaseStatus =
  | "open"
  | "under_review"
  | "resolved_valid"
  | "resolved_invalid"
  | "escalated";
export type FitnessProgressionSourceType =
  | "workout_session_completed"
  | "pose_session_finalized";
export type FitnessProgressionSourceStatus =
  | "pending"
  | "applied"
  | "blocked"
  | "reduced"
  | "voided"
  | "invalidated";
export type FitnessModerationActionType =
  | "void_progression_grant"
  | "restore_progression_grant"
  | "hide_from_rankings"
  | "disqualify_active_season"
  | "approve_creator"
  | "suspend_creator"
  | "revoke_creator"
  | "resolve_integrity_case_valid"
  | "resolve_integrity_case_invalid";

export type FitnessExerciseListParams = {
  category?: FitnessExerciseCategory;
  includeInactive?: boolean;
  limit?: number;
  muscleGroup?: string;
  page?: number;
  search?: string;
};

export type MuscleDefinitionListParams = {
  includeArchived?: boolean;
  search?: string;
};

export type MuscleDefinitionRecord = {
  aliases: string[];
  bodyRegion: string;
  createdAt: string;
  id: string;
  isActive: boolean;
  isSystem: boolean;
  key: string;
  name: string;
  sortOrder: number;
  updatedAt: string;
};

export type CreateMuscleDefinitionInput = {
  aliases?: string[];
  bodyRegion: string;
  key?: string;
  name: string;
  sortOrder?: number;
};

export type UpdateMuscleDefinitionInput = Partial<
  CreateMuscleDefinitionInput
> & {
  isActive?: boolean;
};

export type FitnessExerciseReviewSubmissionListParams = {
  category?: FitnessExerciseCategory;
  limit?: number;
  muscleGroup?: string;
  page?: number;
  search?: string;
  status?: ExerciseReviewSubmissionStatus;
};

export type CreateFitnessExerciseInput = {
  category: FitnessExerciseCategory;
  description?: string;
  handShapeProfile?: ExerciseHandShapeProfileRecord | null;
  imageUrl?: string;
  instructions?: string;
  movementProfile?: ExerciseMovementProfileRecord | null;
  muscleGroup: string;
  muscleTargets?: ExerciseMuscleTargetRecord[];
  name: string;
  videoUrl?: string;
};

export type UpdateFitnessExerciseInput = Partial<CreateFitnessExerciseInput> & {
  isActive?: boolean;
};

export type UpdateExerciseReviewSubmissionInput = {
  creatorGovernanceNote?: string;
  creatorState?: FitnessCreatorState;
  publishedExerciseId?: string;
  reviewNotes?: string;
  status?: ExerciseReviewSubmissionStatus;
};

export type CreateExerciseReviewSubmissionInput = {
  category: FitnessExerciseCategory;
  description?: string;
  evidenceBars?: ExerciseReviewEvidenceRecord | null;
  handShapeProfile?: ExerciseHandShapeProfileRecord | null;
  instructions?: string;
  matchHint?: string;
  movementProfile?: ExerciseMovementProfileRecord | null;
  muscleGroup: string;
  muscleTargets?: ExerciseMuscleTargetRecord[];
  originLabel?: string;
  poseSessionId?: string | null;
  proposedName: string;
  queueTag?: string;
  sourceLabel?: string;
  summary: string;
  title?: string;
  triggerLabel?: string;
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

export type FitnessMilestoneListParams = {
  includeLocked?: boolean;
};

export type FitnessProgressionSourceListParams = {
  limit?: number;
  page?: number;
  sourceStatus?: FitnessProgressionSourceStatus;
  sourceType?: FitnessProgressionSourceType;
};

export type UpdateFitnessRankingProfileInput = {
  displayAlias?: string | null;
  visibility: FitnessRankingVisibility;
};

export type AdminGamificationSeasonStatusInput = {
  rationale: string;
  status: FitnessSeasonStatus;
};

export type AdminGamificationCreatorStateInput = {
  adminNotes?: string | null;
  rationale: string;
  state: FitnessCreatorState;
};

export type AdminGamificationRankingOverrideInput = {
  adminNote?: string | null;
  governanceStatus: Extract<
    FitnessRankingGovernanceStatus,
    "normal" | "hidden_by_admin" | "disqualified"
  >;
  rationale?: string | null;
};

export type AdminGamificationIntegrityResolutionInput = {
  rationale: string;
  status: Extract<
    FitnessIntegrityCaseStatus,
    "resolved_valid" | "resolved_invalid"
  >;
};

export type AdminGamificationSeasonStandingListParams = {
  governanceStatus?: FitnessRankingGovernanceStatus;
  includeArchived?: boolean;
  limit?: number;
  muscleKey?: string;
  page?: number;
  search?: string;
  seasonId?: string;
  visibility?: FitnessRankingVisibility;
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
  handShapeProfile: ExerciseHandShapeProfileRecord | null;
  id: string;
  imageUrl: string | null;
  instructions: string | null;
  isActive: boolean;
  movementProfile: ExerciseMovementProfileRecord | null;
  muscleGroup: string;
  muscleTargets: ExerciseMuscleTargetRecord[];
  name: string;
  updatedAt: string;
  videoUrl: string | null;
};

export type ExerciseReviewSubmissionRecord = {
  category: FitnessExerciseCategory;
  creatorCandidateScore: number;
  creatorDisplayName: string | null;
  creatorEmail: string | null;
  creatorGovernanceNote: string | null;
  creatorLastStateChangedAt: string | null;
  creatorProfileUpdatedAt: string | null;
  creatorPublishedCount: number;
  creatorRejectedCount: number;
  creatorState: FitnessCreatorState;
  creatorStateLabel: string;
  creatorSubmissionCount: number;
  createdAt: string;
  description: string | null;
  evidenceBars: ExerciseReviewEvidenceRecord | null;
  handShapeProfile: ExerciseHandShapeProfileRecord | null;
  id: string;
  instructions: string | null;
  matchHint: string | null;
  movementProfile: ExerciseMovementProfileRecord | null;
  muscleGroup: string;
  muscleTargets: ExerciseMuscleTargetRecord[];
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

export type PoseEquipmentContext =
  | "bodyweight"
  | "dumbbell"
  | "barbell"
  | "cable"
  | "machine"
  | "kettlebell"
  | "band"
  | "bench"
  | "mixed"
  | "unknown";

export type PoseEquipmentSource =
  | "catalog"
  | "plan"
  | "member"
  | "inferred"
  | "provider_api"
  | "resolved_hybrid";

export type PoseSessionQualityState = "stable" | "degraded" | "invalid";

export type PoseProgressionDisposition =
  | "normal"
  | "cautionary"
  | "hold_for_review";

export type PoseJointName = "elbow" | "shoulder" | "hip" | "knee";

export type PoseRepModel =
  | "bilateral"
  | "unilateral_left"
  | "unilateral_right"
  | "alternating"
  | "static_hold"
  | "unknown";

export type PoseRequiredSides =
  | "both"
  | "left"
  | "right"
  | "either"
  | "alternating";

export type PosePartialRepPolicy =
  | "strict_full_rep"
  | "count_half_reps"
  | "review_only";

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
  leftElbow?: number | null;
  leftHip?: number | null;
  leftKnee?: number | null;
  leftShoulder?: number | null;
  rightElbow?: number | null;
  rightHip?: number | null;
  rightKnee?: number | null;
  rightShoulder?: number | null;
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
  leftArmVisibility?: number | null;
  lowConfidenceLandmarks: string[];
  reliableFrameCount: number;
  rightArmVisibility?: number | null;
  wristVisibility: number;
};

export type PoseHipSignalRecord = {
  averageY: number;
  rangeX?: number | null;
  rangeY: number;
  stable: boolean;
};

export type PosePointTravelSignalRecord = {
  averageY: number;
  rangeX: number;
  rangeY: number;
};

export type PoseTemporalMovementSignalRecord = {
  amplitudes: Record<string, number>;
  oscillatingJoints: string[];
  phaseSyncMs?: number | null;
};

export type PoseSpatialRequirementsRecord = {
  bodyLineTolerance?: number | null;
  bodyXDriftMax?: number | null;
  bodyYTravelMin?: number | null;
  hipYTravelMin?: number | null;
  leftRightSymmetryTolerance?: number | null;
  phaseSyncToleranceMs?: number | null;
  shoulderHipTravelMin?: number | null;
  shoulderYTravelMin?: number | null;
  torsoSlopeMaxDeg?: number | null;
  torsoSlopeMinDeg?: number | null;
  wristAnchorDriftMax?: number | null;
};

export type PoseSequenceSignalsRecord = {
  angles: PoseAngleFrameSignalRecord[];
  hip: PoseHipSignalRecord;
  orientation: PoseOrientationSignalRecord;
  shoulder?: PosePointTravelSignalRecord | null;
  temporal: PoseTemporalMovementSignalRecord;
  visibility: PoseVisibilitySignalRecord;
  wrist?: {
    leftRangeX: number;
    rightRangeX: number;
    maxRangeX: number;
  } | null;
};

export type PoseRepThresholdRecord = {
  angle: number;
  tolerance: number;
};

export type PoseMovementContractRecord = {
  dominantJoint: PoseJointName;
  degradedConditions?: string[];
  exercise: string;
  noCountConditions?: string[];
  oscillatingJoints: string[];
  partialRepPolicy?: PosePartialRepPolicy;
  phaseOrder?: string[];
  primaryJoints?: string[];
  repModel?: PoseRepModel;
  repThresholds: {
    down: PoseRepThresholdRecord;
    up: PoseRepThresholdRecord;
  };
  requiredSides?: PoseRequiredSides;
  secondaryCheck: string;
  secondaryJoints?: string[];
  spatialRequirements?: PoseSpatialRequirementsRecord | null;
};

export type PoseRepAngleDataRecord = {
  dominantJoint: PoseJointName;
  highAngle: number;
  lowAngle: number;
  repNumber: number;
  timestamp: number;
};

export type ExerciseMuscleTargetRole =
  | "primary"
  | "secondary"
  | "stabilizer";

export type ExerciseMuscleTargetRecord = {
  allocationPercent: number;
  muscleGroup: string;
  role: ExerciseMuscleTargetRole;
};

export type ExerciseRigKeyframeKind = "start" | "peak" | "end";

export type ExerciseRigSource =
  | "pose_session"
  | "generated_contract"
  | "ai_draft";

export type ExerciseRigKeyframeRecord = {
  angle: number | null;
  capturedAtMs: number;
  confidence: number;
  keypoints: PoseKeypointRecord[];
  kind: ExerciseRigKeyframeKind;
  label: string;
};

export type ExerciseRigRecord = {
  angleSummary: {
    dominantJoint: PoseJointName;
    maxAngle: number;
    minAngle: number;
    repCount: number;
    travel: number;
  } | null;
  capturedFromSession: string | null;
  exerciseLabel: string | null;
  keyframes: ExerciseRigKeyframeRecord[];
  landmarkSchema: PoseLandmarkSchema;
  repIndex: number | null;
  schemaVersion: "exercise_rig_v1";
  source: ExerciseRigSource;
  warnings: string[];
};

export type ExerciseMovementProfileRecord = {
  movementContract: PoseMovementContractRecord | null;
  rig: ExerciseRigRecord | null;
  schemaVersion: "exercise_movement_profile_v1";
  warnings: string[];
};

export type ExerciseGripProfileRecord = {
  maxOpenFrames: number;
  maxOpenRatio: number;
  minUsableFrames: number;
  recentFrameLimit: number;
  reliablePointMinVisibility: number;
  required: boolean;
};

export type ExerciseSubjectLockGestureProfileRecord = {
  enabled: boolean;
  gesture: "rock_sign";
  handAboveShoulderOffset: number;
  handRaisedFromElbowOffset: number;
  holdMs: number;
  hornThumbLeadOffset: number;
  maxHornLiftDelta: number;
  minFingerDistance: number;
  minFingerLift: number;
  minFingerSpreadX: number;
  minThumbOffset: number;
  minThumbSeparation: number;
};

export type ExerciseHandPosePreset =
  | "open_palm"
  | "closed_grip"
  | "rock_sign"
  | "neutral"
  | "thumbs_up"
  | "custom";

export type ExerciseHandPosePreviewPointRecord = {
  x: number;
  y: number;
};

export type ExerciseHandPosePreviewRecord = {
  points: ExerciseHandPosePreviewPointRecord[];
  preset: ExerciseHandPosePreset;
};

export type ExerciseHandShapeProfileRecord = {
  grip: ExerciseGripProfileRecord;
  handPosePreview?: ExerciseHandPosePreviewRecord | null;
  schemaVersion: "exercise_hand_shape_v1";
  subjectLockGesture: ExerciseSubjectLockGestureProfileRecord;
  warnings: string[];
};

export type ExerciseAiDraftEvidenceRecord = {
  confidence: number | null;
  integrityNotes: string[];
  movementContract: PoseMovementContractRecord | null;
  promptContractVersion: "exercise_creation_v1";
  repCount: number;
  rig: ExerciseRigRecord | null;
  schemaVersion: "exercise_ai_draft_v1";
  source: "mobile_pose_session";
};

export type ExerciseReviewEvidenceRecord =
  | number[]
  | ExerciseAiDraftEvidenceRecord;

export type ExerciseDraftProposalSource =
  | "ai"
  | "deterministic_fallback";

export type CreateExerciseDraftProposalInput = {
  category?: FitnessExerciseCategory;
  description?: string;
  evidence?: ExerciseAiDraftEvidenceRecord | null;
  handShapeProfile?: ExerciseHandShapeProfileRecord | null;
  instructions?: string;
  movementProfile?: ExerciseMovementProfileRecord | null;
  muscleGroup?: string;
  muscleTargets?: ExerciseMuscleTargetRecord[];
  poseSessionId?: string | null;
  proposedName?: string;
  summary?: string;
};

export type ExerciseDraftProposalRecord = {
  category: FitnessExerciseCategory;
  confidence: number;
  description: string;
  evidence: ExerciseAiDraftEvidenceRecord;
  handShapeProfile: ExerciseHandShapeProfileRecord;
  instructions: string;
  movementProfile: ExerciseMovementProfileRecord;
  muscleGroup: string;
  muscleTargets: ExerciseMuscleTargetRecord[];
  proposalSource: ExerciseDraftProposalSource;
  proposedName: string;
  reviewWarnings: string[];
  summary: string;
};

export type PoseAnalyzeProcessingMode = "legacy_frame" | "sequence";

type AnalyzePoseInputBase = {
  cameraFacingMode?: PoseCameraFacingMode;
  equipmentConfidence?: number | null;
  equipmentConflicts?: string[];
  equipmentContext?: PoseEquipmentContext | null;
  equipmentSource?: PoseEquipmentSource | null;
  exerciseHint?: string | null;
  subjectLockConfidence?: number | null;
  subjectLocked?: boolean | null;
};

export type AnalyzePoseSequenceInput =
  | (AnalyzePoseInputBase & {
      frameBase64: string;
      frames?: never;
      landmarkSchema?: never;
      signals?: never;
    })
  | (AnalyzePoseInputBase & {
      frameBase64?: never;
      frames: PoseSequenceFrameRecord[];
      landmarkSchema: PoseLandmarkSchema;
      signals: PoseSequenceSignalsRecord;
    });

export type DetectPoseEquipmentInput = {
  cameraFacingMode?: PoseCameraFacingMode;
  exerciseHint?: string | null;
} & (
  | {
      frameBase64: string;
      frameUri?: never;
    }
  | {
      frameBase64?: never;
      frameUri: string;
    }
);

export type PoseEquipmentDetectionBoxRecord = {
  confidence: number | null;
  height: number | null;
  label: string | null;
  width: number | null;
  x: number | null;
  y: number | null;
};

export type PoseEquipmentDetectionRecord = {
  equipmentConfidence: number | null;
  equipmentConflicts: string[];
  equipmentContext: PoseEquipmentContext | null;
  equipmentDetections: PoseEquipmentDetectionBoxRecord[];
  equipmentSource: PoseEquipmentSource | null;
  providerEnabled: boolean;
};

export type PoseFrameAnalysisRecord = {
  candidateExercises: string[];
  classificationSource: PoseClassificationSource;
  confidence: number;
  exerciseClass: string | null;
  formFeedback: string[];
  equipmentConfidence: number | null;
  equipmentConflicts: string[];
  equipmentContext: PoseEquipmentContext | null;
  equipmentSource: PoseEquipmentSource | null;
  integrityReasonCodes: string[];
  keypoints: PoseKeypointRecord[] | null;
  matchedProfileId: string | null;
  movementContract: PoseMovementContractRecord | null;
  needsConfirmation: boolean;
  phase: string | null;
  processingMode: PoseAnalyzeProcessingMode;
  poseSessionId: string;
  progressionDisposition: PoseProgressionDisposition;
  reliableFrameRatio: number | null;
  repCountDelta: number;
  repEvent: boolean;
  reviewRecommended: boolean;
  sessionQualityReasons: string[];
  sessionQualityState: PoseSessionQualityState;
  subjectLockConfidence: number | null;
  subjectLocked: boolean | null;
};

export type FinalizePoseSessionInput = {
  averageConfidence?: number | null;
  detectedExerciseName?: string | null;
  endedReason?: PoseSessionEndReason;
  equipmentConfidence?: number | null;
  equipmentConflicts?: string[];
  equipmentContext?: PoseEquipmentContext | null;
  equipmentSource?: PoseEquipmentSource | null;
  finalRepCount: number;
  formFeedback?: string[];
  movementContract?: PoseMovementContractRecord | null;
  rawAngleData: PoseRepAngleDataRecord[];
  weightInputKg?: number | null;
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

export type FitnessProgressionActiveSeasonRecord = {
  endsAt: string;
  id: string;
  startsAt: string;
  status: FitnessSeasonStatus;
  title: string;
};

export type FitnessProgressionProfileRecord = {
  activeSeason: FitnessProgressionActiveSeasonRecord | null;
  createdAt: string | null;
  currentSeasonPoints: number;
  currentStreak: number;
  integrityRiskLevel: FitnessIntegrityRiskLevel;
  lastProgressedAt: string | null;
  longestStreak: number;
  rankingGovernanceStatus: FitnessRankingGovernanceStatus;
  rankingVisibility: FitnessRankingVisibility;
  totalXp: number;
  updatedAt: string | null;
  userId: string;
};

export type FitnessProgressionSourceRecord = {
  createdAt: string;
  eligibilityState: string | null;
  exerciseLogIds: string[];
  id: string;
  integrityState: string | null;
  linkedSourceIds: string[];
  occurredAt: string | null;
  poseSessionId: string | null;
  poseSessionIds: string[];
  processedAt: string | null;
  producerRuntime: string | null;
  recordedAt: string | null;
  sessionId: string | null;
  sourceId: string;
  sourceQualityNotes: string[];
  sourceStatus: FitnessProgressionSourceStatus;
  sourceType: FitnessProgressionSourceType;
  terminalState: string | null;
  updatedAt: string;
  validationState: string | null;
};

export type FitnessRankingProfileRecord = {
  displayAlias: string | null;
  governanceStatus: FitnessRankingGovernanceStatus;
  updatedAt: string;
  userId: string;
  visibility: FitnessRankingVisibility;
};

export type FitnessSeasonStandingRecord = {
  isDisqualified: boolean;
  isHidden: boolean;
  lastEarnedAt: string | null;
  rankPosition: number | null;
  season: FitnessProgressionActiveSeasonRecord | null;
  seasonPoints: number;
  userId: string;
};

export type FitnessMilestoneProgressRecord = {
  category: FitnessMilestoneCategory;
  claimedAt: string | null;
  description: string | null;
  isHidden: boolean;
  key: string;
  milestoneDefinitionId: string;
  progressPercent: number;
  progressValue: number;
  rewardPayload: Record<string, unknown> | null;
  status: FitnessMilestoneProgressStatus;
  targetValue: number;
  title: string;
  triggerType: FitnessMilestoneTriggerType;
  unlockedAt: string | null;
  updatedAt: string | null;
};

export type FitnessAchievementReviewRecord = {
  badgeLabel: string;
  id: string;
  memberEmail: string;
  memberId: string;
  memberInitials: string;
  memberName: string;
  proofCaption: string;
  proofImageUrl: string;
  reviewedAt?: string;
  reviewerNotes?: string;
  status: FitnessAchievementReviewStatus;
  submittedAt: string;
};

export type FitnessIntegrityCaseSummaryRecord = {
  id: string;
  openedAt: string;
  resolvedAt: string | null;
  status: FitnessIntegrityCaseStatus;
  summary: string | null;
};

export type FitnessIntegritySummaryRecord = {
  lastFlaggedAt: string | null;
  lastResolvedAt: string | null;
  openCaseCount: number;
  recentCases: FitnessIntegrityCaseSummaryRecord[];
  riskLevel: FitnessIntegrityRiskLevel;
  userId: string;
};

export type AdminGamificationSeasonSummaryRecord = {
  archivedAt: string | null;
  closedAt: string | null;
  disqualifiedCount: number;
  endsAt: string;
  hiddenCount: number;
  id: string;
  standingCount: number;
  startsAt: string;
  status: FitnessSeasonStatus;
  title: string;
};

export type AdminGamificationSeasonStandingRecord = {
  displayAlias: string | null;
  governanceStatus: FitnessRankingGovernanceStatus;
  isDisqualified: boolean;
  isHidden: boolean;
  lastEarnedAt: string | null;
  memberName: string;
  milestoneClaimedCount: number;
  milestoneUnlockedCount: number;
  rankPosition: number | null;
  seasonId: string;
  seasonPoints: number;
  seasonStatus: FitnessSeasonStatus;
  seasonTitle: string;
  topMuscle: string | null;
  topMuscleXp: number;
  totalXp: number;
  userId: string;
  visibility: FitnessRankingVisibility;
};

export type AdminGamificationIntegrityCaseRecord = {
  caseId: string;
  evidenceEventCount: number;
  memberName: string;
  openedAt: string;
  riskLevel: FitnessIntegrityRiskLevel;
  status: FitnessIntegrityCaseStatus;
  summary: string | null;
  userId: string;
};

export type AdminGamificationIntegritySectionRecord = {
  cases: AdminGamificationIntegrityCaseRecord[];
  escalatedCaseCount: number;
  highRiskProfileCount: number;
  openCaseCount: number;
};

export type AdminGamificationRankingProfileRecord = {
  adminNote: string | null;
  displayAlias: string | null;
  governanceStatus: FitnessRankingGovernanceStatus;
  memberName: string;
  seasonIsDisqualified: boolean;
  seasonIsHidden: boolean;
  updatedAt: string;
  userId: string;
  visibility: FitnessRankingVisibility;
};

export type AdminGamificationRankingSectionRecord = {
  disqualifiedProfileCount: number;
  governedProfileCount: number;
  hiddenProfileCount: number;
  profiles: AdminGamificationRankingProfileRecord[];
};

export type AdminGamificationCreatorProfileRecord = {
  adminNotes: string | null;
  lastStateChangedAt: string | null;
  memberName: string;
  publishedSubmissionCount: number;
  state: FitnessCreatorState;
  stateLabel: string;
  submissionCount: number;
  userId: string;
};

export type AdminGamificationCreatorSectionRecord = {
  approvedCount: number;
  candidateCount: number;
  pendingReviewCount: number;
  profiles: AdminGamificationCreatorProfileRecord[];
  revokedCount: number;
  suspendedCount: number;
};

export type AdminGamificationAuditActionRecord = {
  actionType: FitnessModerationActionType;
  createdAt: string;
  id: string;
  integrityCaseId: string | null;
  progressionGrantId: string | null;
  rationale: string | null;
  seasonId: string | null;
  targetName: string;
  targetUserId: string;
};

export type AdminGamificationAuditSectionRecord = {
  recentActions: AdminGamificationAuditActionRecord[];
  recentCorrectionCount: number;
};

export type AdminGamificationOverviewRecord = {
  activeSeason: AdminGamificationSeasonSummaryRecord | null;
  audit: AdminGamificationAuditSectionRecord;
  creators: AdminGamificationCreatorSectionRecord;
  generatedAt: string;
  integrity: AdminGamificationIntegritySectionRecord;
  rankings: AdminGamificationRankingSectionRecord;
};

export type AdminGamificationSeasonGovernanceRecord = {
  archivedAt: string | null;
  closedAt: string | null;
  seasonId: string;
  status: FitnessSeasonStatus;
  title: string;
};

export type AdminGamificationCreatorStateRecord = {
  adminNotes: string | null;
  lastStateChangedAt: string | null;
  memberName: string;
  moderationActionId: string | null;
  state: FitnessCreatorState;
  stateLabel: string;
  userId: string;
};

export type AdminGamificationRankingOverrideRecord = {
  adminNote: string | null;
  displayAlias: string | null;
  governanceStatus: FitnessRankingGovernanceStatus;
  moderationActionId: string;
  seasonIsDisqualified: boolean;
  seasonIsHidden: boolean;
  userId: string;
  visibility: FitnessRankingVisibility;
};

export type AdminGamificationIntegrityCaseMutationRecord = {
  caseId: string;
  moderationActionId: string | null;
  openCaseCount: number;
  riskLevel: FitnessIntegrityRiskLevel;
  status: FitnessIntegrityCaseStatus;
  summary: string | null;
  userId: string;
};

export type FitnessPaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};
