import type {
  ProgressionProducerRuntime,
  ProgressionSourceCorrelation,
  ProgressionSourceEligibilityState,
  ProgressionSourceEventType,
  ProgressionSourceIntegrityState,
  ProgressionSourceProducerContext,
  ProgressionSourceTerminalState,
  ProgressionSourceValidationState,
} from '../../progression-source.types';
import { progressionSourceEventType } from '../../progression-source.types';

export const WORKOUT_SESSION_COMPLETED_EVENT =
  'fitness.workout-session.completed';

export interface WorkoutSessionExerciseSummary {
  durationSeconds: number | null;
  exerciseId: string;
  exerciseLogId: string;
  exerciseNameSnapshot: string;
  muscleGroupHint: string;
  poseSessionId: string | null;
  repsAiCounted: number | null;
  repsCompleted: number | null;
  setNumber: number;
  weightKg: string | null;
}

export interface WorkoutSessionCompletedEvent {
  completedAt: string;
  correlation: ProgressionSourceCorrelation;
  durationSeconds: number;
  eligibilityState: ProgressionSourceEligibilityState;
  eventType: ProgressionSourceEventType;
  eventVersion: number;
  exerciseLogCount: number;
  exerciseSummaries: WorkoutSessionExerciseSummary[];
  idempotencyKey: string;
  integrityState: ProgressionSourceIntegrityState;
  occurredAt: string;
  performanceSummary: {
    durationSeconds: number;
    exerciseLogCount: number;
    exerciseSummaries: WorkoutSessionExerciseSummary[];
    totalVolumeKg: string;
  };
  sessionId: string;
  userId: string;
  planId: string | null;
  producerContext: ProgressionSourceProducerContext;
  producerRuntime: ProgressionProducerRuntime;
  producerSystem: string;
  recordedAt: string;
  sourceId: string;
  sourceRevision: number;
  sourceType: 'workout_session_completed';
  terminalState: ProgressionSourceTerminalState;
  totalVolumeKg: string;
  validationMetadata: {
    containsFlaggedSets: boolean;
    correctionOrigin: string | null;
    hasManualWeightInput: boolean;
    hasPoseEvidence: boolean;
    sourceQualityNotes: string[];
  };
  validationState: ProgressionSourceValidationState;
}

export const workoutProgressionSourceEventType = progressionSourceEventType;
