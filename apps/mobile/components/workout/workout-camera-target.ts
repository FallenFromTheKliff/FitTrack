import type { FitnessExerciseRecord, TrainingPlanExerciseRecord, PlannedPoseTrackingSnapshot } from "@fittrack/types";
import { hasExerciseTrackingTarget, resolveExerciseTracking } from "@fittrack/utils";
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
  exerciseDefinitions: ReadonlyMap<string, FitnessExerciseRecord>;
  completedSetKeys: ReadonlySet<string>;
  currentExercise: TrainingPlanExerciseRecord;
  currentSetNumber: number;
  orderedExercises: TrainingPlanExerciseRecord[];
  planId: string;
  planTitle: string;
  sessionId: string;
};

/** The server's set snapshot also owns the target if settings changed before Start. */
export function applyPlannedTrackingSnapshotToTarget(target: WorkoutCameraTarget | null, snapshot: PlannedPoseTrackingSnapshot | null) {
  if (!target || !snapshot || target.exerciseId !== snapshot.exerciseId ||
      target.sessionId !== snapshot.workoutSessionId || target.planExerciseId !== snapshot.planExerciseId ||
      target.setNumber !== snapshot.setNumber) return target;
  const contract = snapshot.movementProfile.movementContract;
  const hold = contract?.repModel === "static_hold";
  return { ...target, exerciseName: snapshot.exerciseName,
    targetReps: hold ? 0 : snapshot.targetReps ?? target.targetReps,
    targetDurationSeconds: hold ? snapshot.targetDurationSeconds ?? contract?.holdDurationSeconds ?? null : null };
}

function supportsCamera(exercise: TrainingPlanExerciseRecord, definitions: ReadonlyMap<string, FitnessExerciseRecord>) {
  const resolved = resolveExerciseTracking(definitions.get(exercise.exerciseId));
  return resolved.status === "ready" && hasExerciseTrackingTarget(resolved.contract, exercise);
}

/**
 * Builds only the uninterrupted camera-capable portion of the workout queue.
 * The first unfinished manual-only set stops camera chaining but does not mark
 * the workout complete or skip ahead to a later supported exercise.
 */
export function buildWorkoutCameraTargetChain({
  exerciseDefinitions,
  completedSetKeys,
  currentExercise,
  currentSetNumber,
  orderedExercises,
  planId,
  planTitle,
  sessionId,
}: WorkoutCameraTargetChainInput): WorkoutCameraTarget | null {
  if (!supportsCamera(currentExercise, exerciseDefinitions)) return null;

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
      followingSet && supportsCamera(followingSet.exercise, exerciseDefinitions)
        ? buildTarget(followingSet.exercise, followingSet.setNumber)
        : null;

    const resolved = resolveExerciseTracking(exerciseDefinitions.get(exercise.exerciseId));
    const isHold = resolved.contract?.repModel === "static_hold";
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
      targetReps: isHold ? 0 : exercise.reps ?? 0,
      targetDurationSeconds:
        isHold
          ? exercise.durationSeconds ?? resolved.contract?.holdDurationSeconds ?? null
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
