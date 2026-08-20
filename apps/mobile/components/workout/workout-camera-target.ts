export type WorkoutCameraTarget = {
  completeWorkoutAfterSet: boolean;
  exerciseId: string;
  exerciseName: string;
  planExerciseId: string;
  planId: string;
  planTitle: string;
  restSeconds: number;
  sessionId: string;
  setNumber: number;
  targetReps: number;
  targetWeightKg: number | null;
  totalSets: number;
  targetDurationSeconds: number | null;
  /** The next deterministic plan target, used without re-querying the camera route. */
  nextTarget?: WorkoutCameraTarget | null;
};
