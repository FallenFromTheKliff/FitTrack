export const WORKOUT_SESSION_COMPLETED_EVENT =
  'fitness.workout-session.completed';

export interface WorkoutSessionCompletedEvent {
  sessionId: string;
  userId: string;
  planId: string | null;
  completedAt: string;
  durationSeconds: number;
  totalVolumeKg: string;
  exerciseLogCount: number;
}
