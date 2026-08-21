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
export type ProgressionIconKind = "library" | "custom";

export const FITNESS_MASTERY_EXP_THRESHOLDS: Record<
  FitnessMasteryRank,
  number
> = {
  adamantite: 10000,
  bronze: 0,
  gold: 2000,
  platinum: 5000,
  silver: 500,
};

export const FITNESS_PROGRESSION_LIBRARY_ICON_KEYS = [
  "badge",
  "dumbbell",
  "flame",
  "medal",
  "star",
  "target",
  "trophy",
] as const;

export type ProgressionIconRecord = {
  iconAssetKey: string | null;
  iconKey: string | null;
  iconKind: ProgressionIconKind;
};

export type FitnessExpProgressionRecord = {
  currentExp: number;
  isUncapped: boolean;
  level: FitnessMasteryRank;
  nextLevelExp: number | null;
  progressPercent: number;
  remainingExp: number | null;
};

function normalizeFitnessExp(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function getFitnessExpProgressionState(
  value: number,
): FitnessExpProgressionRecord {
  const currentExp = normalizeFitnessExp(value);
  const ranks: FitnessMasteryRank[] = [
    "adamantite",
    "platinum",
    "gold",
    "silver",
    "bronze",
  ];
  const level =
    ranks.find(
      (rank) => currentExp >= FITNESS_MASTERY_EXP_THRESHOLDS[rank],
    ) ?? "bronze";
  const currentLevelExp = FITNESS_MASTERY_EXP_THRESHOLDS[level];
  const nextLevel =
    level === "adamantite"
      ? null
      : (ranks[ranks.indexOf(level) - 1] ?? "adamantite");
  const nextLevelExp = nextLevel
    ? FITNESS_MASTERY_EXP_THRESHOLDS[nextLevel]
    : null;
  const levelSpan = nextLevelExp === null ? 0 : nextLevelExp - currentLevelExp;
  const progressPercent =
    nextLevelExp === null || levelSpan <= 0
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(((currentExp - currentLevelExp) / levelSpan) * 100),
          ),
        );

  return {
    currentExp,
    isUncapped: nextLevelExp === null,
    level,
    nextLevelExp,
    progressPercent,
    remainingExp:
      nextLevelExp === null ? null : Math.max(0, nextLevelExp - currentExp),
  };
}

export function getFitnessTargetExpDelta(
  currentExp: number,
  targetLevel: FitnessMasteryRank,
) {
  return Math.max(
    0,
    FITNESS_MASTERY_EXP_THRESHOLDS[targetLevel] - normalizeFitnessExp(currentExp),
  );
}
export type WorkoutSessionStatus = "cancelled" | "completed" | "in_progress";
export type PoseSessionEndReason =
  | "client_disconnect"
  | "manual_stop"
  | "session_completed";
export type FitnessSeasonStatus = "draft" | "active" | "closed" | "archived";
export type FitnessMilestoneCategory =
  | "training"
  | "consistency"
  | "season"
  | "creator"
  | "governance"
  | "nutrition"
  | "coaching"
  | "booking"
  | "ai"
  | "weighted_lifting"
  | "attendance";
export type FitnessMilestoneTriggerType =
  | "source_event"
  | "summary_threshold"
  | "streak"
  | "manual"
  | "composite";
export type FitnessMilestoneProgressStatus =
  | "in_progress"
  | "pending_review"
  | "rejected"
  | "unlocked"
  | "claimed";
export type FitnessMilestoneDefinitionStatus = "draft" | "active" | "archived";
export type FitnessMilestoneVerificationPolicy =
  | "auto"
  | "manual_required"
  | "auto_then_review"
  | "staff_attested";
export type FitnessMilestoneEvidenceRequirement =
  | "none"
  | "image"
  | "video"
  | "image_or_video";
export type FitnessMilestoneEvidenceType = "image" | "video";
export type FitnessMilestoneEvidenceSubmissionStatus =
  | "pending"
  | "approved"
  | "rejected";
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
  | "workout_session_invalidated"
  | "pose_session_finalized"
  | "pose_session_flagged"
  | "rep_log_accepted"
  | "rep_log_rejected"
  | "weighted_exercise_logged"
  | "nutrition_log_created"
  | "nutrition_log_updated"
  | "nutrition_log_deleted"
  | "coaching_appointment_completed"
  | "coaching_appointment_no_show"
  | "venue_booking_completed"
  | "venue_booking_no_show"
  | "ai_chat_message_sent"
  | "ai_action_completed"
  | "gym_chat_message_sent"
  | "milestone_evidence_submitted"
  | "milestone_evidence_approved"
  | "milestone_evidence_rejected"
  | "moderation_action";
export type FitnessProgressionSourceStatus =
  | "pending"
  | "applied"
  | "blocked"
  | "reduced"
  | "voided"
  | "invalidated";
export type FitnessProgressionGrantStatus = "applied" | "voided";
export type FitnessModerationActionType =
  | "manual_exp_grant"
  | "void_progression_grant"
  | "restore_progression_grant"
  | "hide_from_rankings"
  | "disqualify_active_season"
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
  iconAssetKey?: string | null;
  iconKey?: string | null;
  iconKind?: ProgressionIconKind;
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
  iconAssetKey?: string | null;
  iconKey?: string | null;
  iconKind?: ProgressionIconKind;
  key?: string;
  name: string;
  sortOrder?: number;
};

export type UpdateMuscleDefinitionInput =
  Partial<CreateMuscleDefinitionInput> & {
    isActive?: boolean;
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


export type TrainingPlanListParams = {
  limit?: number;
  page?: number;
};

export type FitnessMasteryListParams = {
  muscleGroup?: string;
  rank?: FitnessMasteryRank;
};

export type FitnessLeaderboardListParams = {
  cursor?: string;
  limit?: number;
  page?: number;
  snapshot?: string;
};

export type FitnessMuscleLeaderboardListParams = {
  cursor?: string;
  limit?: number;
  muscleKey: string;
  page?: number;
  scope: "lifetime" | "season";
  seasonId?: string;
  snapshot?: string;
};

export type AdminGamificationMuscleLeaderboardListParams =
  FitnessMuscleLeaderboardListParams & {
    includeHidden?: boolean;
    search?: string;
  };

export type FitnessSeasonHistoryListParams = {
  limit?: 3 | 10;
};

export type FitnessMilestoneListParams = {
  includeLocked?: boolean;
};

export type AdminMilestoneDefinitionListParams = {
  category?: FitnessMilestoneCategory | "all";
  evidenceRequirement?: FitnessMilestoneEvidenceRequirement | "all";
  includeArchived?: boolean;
  limit?: number;
  page?: number;
  search?: string;
  sort?: "created_at" | "updated_at" | "title" | "sort_order";
  status?: FitnessMilestoneDefinitionStatus | "all";
  triggerType?: FitnessMilestoneTriggerType | "all";
  verificationPolicy?: FitnessMilestoneVerificationPolicy | "all";
};

export type AdminMilestoneEvidenceListParams = {
  limit?: number;
  page?: number;
  search?: string;
  status?: FitnessMilestoneEvidenceSubmissionStatus | "all";
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

export type AdminGamificationSeasonCreateInput = {
  autoStartNext?: boolean;
  description?: string | null;
  endsAt: string;
  rulesVersion?: string;
  startsAt: string;
  title: string;
};

export type AdminGamificationSeasonUpdateInput =
  Partial<AdminGamificationSeasonCreateInput>;


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

export type AdminManualExpAllocationInput = {
  amount: number;
  muscleGroup: string;
};

export type AdminManualExpGrantInput = {
  allocations: AdminManualExpAllocationInput[];
  rationale: string;
  userId: string;
};

export type AdminGamificationSeasonStandingListParams = {
  cursor?: string;
  governanceStatus?: FitnessRankingGovernanceStatus;
  includeArchived?: boolean;
  limit?: number;
  muscleKey?: string;
  page?: number;
  search?: string;
  seasonId?: string;
  snapshot?: string;
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
  restSecondsBySet: number[] | null;
  sets: number;
  weightKgTarget: number | null;
};

export type TrainingPlanScheduleDayRecord = {
  dayOfWeek: number;
  exercises: TrainingPlanExerciseRecord[];
  focusLabel: string | null;
  id: string;
  isRestDay?: boolean | null;
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

export type CreateTrainingPlanExerciseInput = {
  durationSeconds?: number;
  exerciseId: string;
  orderIndex?: number;
  reps?: number;
  restSeconds?: number;
  restSecondsBySet?: number[];
  sets: number;
  weightKgTarget?: number;
};

export type CreateTrainingPlanScheduleDayInput = {
  dayOfWeek: number;
  exercises: CreateTrainingPlanExerciseInput[];
  focusLabel?: string;
  isRestDay?: boolean;
  weekNumber: number;
};

export type CreateTrainingPlanInput = {
  daysPerWeek: number;
  durationWeeks: number;
  goal: FitnessGoal;
  schedule: CreateTrainingPlanScheduleDayInput[];
  title: string;
};

export type TrainingProgressionAction =
  | "increase_load"
  | "increase_reps"
  | "maintain";

export type TrainingProgressionSuggestionRecord = {
  action: TrainingProgressionAction;
  confidence: "high" | "medium" | "low";
  exerciseId: string;
  exerciseName: string;
  planExerciseId: string;
  rationale: string;
  sourceRevision: "history-rule-v2";
  suggestedReps: number | null;
  suggestedWeightKg: number | null;
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
  planExerciseId?: string;
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

export type PoseBodyOrientation =
  | "upright"
  | "horizontal"
  | "inclined"
  | "floor"
  | "any";

export type PoseTrackingRequirementsRecord = {
  minConfidence: number;
  minReliableFrameLandmarks: number;
  requiredLandmarks: string[];
  requiredSides?: PoseRequiredSides;
};

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
  bodyOrientation?: PoseBodyOrientation;
  contractVersion?: string;
  dominantJoint: PoseJointName;
  degradedConditions?: string[];
  exercise: string;
  noCountConditions?: string[];
  oscillatingJoints: string[];
  partialRepPolicy?: PosePartialRepPolicy;
  phaseOrder?: string[];
  primaryJoints?: string[];
  repModel?: PoseRepModel;
  holdDurationSeconds?: number | null;
  repThresholds: {
    down: PoseRepThresholdRecord;
    up: PoseRepThresholdRecord;
  };
  requiredSides?: PoseRequiredSides;
  secondaryCheck: string;
  secondaryJoints?: string[];
  spatialRequirements?: PoseSpatialRequirementsRecord | null;
  trackingRequirements?: PoseTrackingRequirementsRecord;
};

export type PoseRepAngleDataRecord = {
  dominantJoint: PoseJointName;
  highAngle: number;
  lowAngle: number;
  repNumber: number;
  timestamp: number;
};

export type ExerciseMuscleTargetRole = "primary" | "secondary" | "stabilizer";

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
  progression?: FitnessExpProgressionRecord;
  totalXp: number;
  userId: string;
};

export type FitnessMuscleLeaderboardEntryRecord = {
  avatarUrl?: string | null;
  displayName: string;
  iconAssetKey?: string | null;
  iconKey?: string | null;
  iconKind?: ProgressionIconKind;
  isCurrentUser?: boolean;
  lastEarnedAt: string | null;
  muscleKey: string;
  rankPosition: number;
  progression?: FitnessExpProgressionRecord;
  scope: "lifetime" | "season";
  seasonId: string | null;
  seasonTitle: string | null;
  userId: string;
  xpPoints: number;
};

export type FitnessSeasonTopPerformerRecord = {
  displayName: string;
  rankPosition: number;
  seasonPoints: number;
  userId: string;
};

export type FitnessSeasonHistoryRecord = {
  closedAt: string | null;
  endsAt: string;
  seasonId: string;
  startsAt: string;
  title: string;
  topPerformers: FitnessSeasonTopPerformerRecord[];
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
  lifetimeProgression?: FitnessExpProgressionRecord;
  seasonProgression?: FitnessExpProgressionRecord;
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
  conditionPayload?: Record<string, unknown> | null;
  description: string | null;
  evidenceRequirement?: FitnessMilestoneEvidenceRequirement;
  isHidden: boolean;
  iconAssetKey?: string | null;
  iconKey?: string | null;
  iconKind?: ProgressionIconKind;
  key: string;
  latestEvidenceSubmission?: FitnessMilestoneEvidenceSubmissionRecord | null;
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
  verificationPolicy?: FitnessMilestoneVerificationPolicy;
};

export type AdminMilestoneDefinitionRecord = {
  archivedAt: string | null;
  archivedByUserId: string | null;
  category: FitnessMilestoneCategory;
  conditionPayload: Record<string, unknown> | null;
  createdAt: string;
  createdByUserId: string | null;
  description: string | null;
  endsAt: string | null;
  evidenceRequirement: FitnessMilestoneEvidenceRequirement;
  id: string;
  iconAssetKey?: string | null;
  iconKey?: string | null;
  iconKind?: ProgressionIconKind;
  isActive: boolean;
  isHidden: boolean;
  key: string;
  pendingReviewCount: number;
  progressCount: number;
  rewardPayload: Record<string, unknown> | null;
  sortOrder: number;
  startsAt: string | null;
  status: FitnessMilestoneDefinitionStatus;
  title: string;
  triggerType: FitnessMilestoneTriggerType;
  unlockedCount: number;
  updatedAt: string;
  updatedByUserId: string | null;
  verificationPolicy: FitnessMilestoneVerificationPolicy;
};

export type UpsertAdminMilestoneDefinitionInput = {
  category: FitnessMilestoneCategory;
  conditionPayload?: Record<string, unknown> | null;
  description?: string | null;
  endsAt?: string | null;
  evidenceRequirement?: FitnessMilestoneEvidenceRequirement;
  isHidden?: boolean;
  iconAssetKey?: string | null;
  iconKey?: string | null;
  iconKind?: ProgressionIconKind;
  key: string;
  rewardPayload?: Record<string, unknown> | null;
  sortOrder?: number;
  startsAt?: string | null;
  status?: FitnessMilestoneDefinitionStatus;
  title: string;
  triggerType: FitnessMilestoneTriggerType;
  verificationPolicy?: FitnessMilestoneVerificationPolicy;
};

export type FitnessMilestoneEvidenceSubmissionRecord = {
  caption: string | null;
  createdAt: string;
  evidenceType: FitnessMilestoneEvidenceType;
  fileKey: string | null;
  fileUrl: string;
  id: string;
  memberEmail?: string | null;
  memberInitials?: string | null;
  memberName?: string | null;
  milestoneDefinitionId: string;
  milestoneKey?: string;
  milestoneTitle?: string;
  mimeType: string;
  originalFilename: string | null;
  reviewerNotes: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  sizeBytes: number;
  status: FitnessMilestoneEvidenceSubmissionStatus;
  updatedAt: string;
  userId: string;
};

export type SubmitFitnessMilestoneEvidenceInput = {
  caption?: string | null;
  evidenceType: FitnessMilestoneEvidenceType;
  fileKey?: string | null;
  fileUrl: string;
  mimeType: string;
  originalFilename?: string | null;
  sizeBytes: number;
};

export type ReviewFitnessMilestoneEvidenceInput = {
  reviewerNotes?: string | null;
  status: Extract<
    FitnessMilestoneEvidenceSubmissionStatus,
    "approved" | "rejected"
  >;
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
  activatedAt: string | null;
  archivedAt: string | null;
  autoStartNext: boolean;
  closedAt: string | null;
  disqualifiedCount: number;
  endsAt: string;
  hiddenCount: number;
  id: string;
  rulesVersion: string;
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
  lifetimeProgression?: FitnessExpProgressionRecord;
  lastEarnedAt: string | null;
  memberName: string;
  milestoneClaimedCount: number;
  milestoneUnlockedCount: number;
  rankPosition: number;
  seasonId: string;
  seasonPoints: number;
  seasonProgression?: FitnessExpProgressionRecord;
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
  generatedAt: string;
  integrity: AdminGamificationIntegritySectionRecord;
  rankings: AdminGamificationRankingSectionRecord;
};

export type AdminGamificationSeasonGovernanceRecord = {
  activatedAt: string | null;
  archivedAt: string | null;
  autoStartNext: boolean;
  closedAt: string | null;
  seasonId: string;
  status: FitnessSeasonStatus;
  title: string;
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

export type AdminProgressionGrantRecord = {
  currentSeasonPoints: number;
  grantId: string;
  grantStatus: FitnessProgressionGrantStatus;
  moderationActionId: string;
  moderationActionType: FitnessModerationActionType;
  totalXp: number;
  userId: string;
};

export type FitnessPaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};
