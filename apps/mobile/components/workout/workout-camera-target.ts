import type { TrainingPlanExerciseRecord } from "@fittrack/types";
import { getPoseAutoRepCapabilityForLabel } from "@fittrack/utils";
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


type WorkoutCameraTargetChainInput = {
  completedSetKeys: ReadonlySet<string>;
  currentExercise: TrainingPlanExerciseRecord;
  currentSetNumber: number;
  orderedExercises: TrainingPlanExerciseRecord[];
  planId: string;
  planTitle: string;
  sessionId: string;
};

function supportsCamera(exercise: TrainingPlanExerciseRecord) {
  return (
    getPoseAutoRepCapabilityForLabel(exercise.exerciseName) !== null &&
    (exercise.reps != null || (exercise.durationSeconds ?? 0) > 0)
  );
}

/**
 * Builds only the uninterrupted camera-capable portion of the workout queue.
 * The first unfinished manual-only set stops camera chaining but does not mark
 * the workout complete or skip ahead to a later supported exercise.
 */
export function buildWorkoutCameraTargetChain({
  completedSetKeys,
  currentExercise,
  currentSetNumber,
  orderedExercises,
  planId,
  planTitle,
  sessionId,
}: WorkoutCameraTargetChainInput): WorkoutCameraTarget | null {
  if (!supportsCamera(currentExercise)) return null;

  const findNextUnfinishedSet = (
    exercise: TrainingPlanExerciseRecord,
    setNumber: number,
  ) => {
    const currentExerciseIndex = orderedExercises.findIndex(
      (candidate) => candidate.id === exercise.id,
    );

    for (
      let exerciseIndex = currentExerciseIndex;
      exerciseIndex < orderedExercises.length;
      exerciseIndex += 1
    ) {
      const candidate = orderedExercises[exerciseIndex];
      const firstSet =
        exerciseIndex === currentExerciseIndex ? setNumber + 1 : 1;
      for (
        let candidateSetNumber = firstSet;
        candidateSetNumber <= candidate.sets;
        candidateSetNumber += 1
      ) {
        if (!completedSetKeys.has(`${candidate.id}:${candidateSetNumber}`)) {
          return { exercise: candidate, setNumber: candidateSetNumber };
        }
      }
    }

    return null;
  };

  const buildTarget = (
    exercise: TrainingPlanExerciseRecord,
    setNumber: number,
  ): WorkoutCameraTarget => {
    const followingSet = findNextUnfinishedSet(exercise, setNumber);
    const nextTarget =
      followingSet && supportsCamera(followingSet.exercise)
        ? buildTarget(followingSet.exercise, followingSet.setNumber)
        : null;

    return {
      completeWorkoutAfterSet: followingSet === null,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      nextTarget,
      planExerciseId: exercise.id,
      planId,
      planTitle,
      restSeconds:
        exercise.restSecondsBySet?.[setNumber - 1] ?? exercise.restSeconds,
      sessionId,
      setNumber,
      targetReps: exercise.reps ?? 0,
      targetDurationSeconds:
        exercise.durationSeconds != null && exercise.durationSeconds > 0
          ? exercise.durationSeconds
          : null,
      targetWeightKg: exercise.weightKgTarget ?? null,
      totalSets: exercise.sets,
    };
  };

  return buildTarget(currentExercise, currentSetNumber);
}

export function shouldAutoResumeWorkoutCamera(
  currentTarget: WorkoutCameraTarget | null,
  nextTarget: WorkoutCameraTarget | null | undefined,
) {
  return !!nextTarget && currentTarget?.exerciseId === nextTarget.exerciseId;
}

export function getWorkoutCameraRestLabel(restRemaining: number) {
  const safeRemaining = Math.max(0, Math.floor(restRemaining));
  if (safeRemaining > 0 && safeRemaining <= 5) {
    return `GET READY ${safeRemaining}s`;
  }
  return safeRemaining > 0 ? `REST ${safeRemaining}s` : "REST COMPLETE";
}
