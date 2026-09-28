import {
  findEmptyDraftDay,
  isDraftRestDay,
  setDraftDayExercises,
  toPlanInput,
} from "./workoutPlanDraft";

import type { TrainingPlanExerciseRecord, FitnessExerciseRecord } from "@fittrack/types";
import { buildFallbackPoseMovementContract, createExerciseMovementProfile } from "@fittrack/utils";
import { buildWorkoutCameraTargetChain } from "./workout-camera-target";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

const exercise = {
  exerciseId: "exercise-1",
  exerciseName: "Squat",
  reps: 8,
  restSeconds: 90,
  restSecondsBySet: null,
  sets: 3,
};

const restDay = { exercises: [], focusLabel: "Rest", isRestDay: true };
const workoutDay = setDraftDayExercises(restDay, [exercise]);

assertEqual(isDraftRestDay(restDay), true, "new empty days are rest days");
assertEqual(
  workoutDay.isRestDay,
  false,
  "adding the first exercise promotes the day to a workout day",
);
assertEqual(
  setDraftDayExercises(workoutDay, []).isRestDay,
  true,
  "removing the final exercise returns the day to rest",
);
assertEqual(
  findEmptyDraftDay({ 1: restDay }),
  null,
  "rest days do not fail empty-workout validation",
);
assertEqual(
  findEmptyDraftDay({
    1: { exercises: [], focusLabel: "Workout", isRestDay: false },
  }),
  1,
  "explicit empty workout days still fail validation",
);

const input = toPlanInput("Weekly split", "maintenance", {
  1: restDay,
  2: workoutDay,
});

function makeCameraExercise(
  id: string,
  exerciseName: string,
): TrainingPlanExerciseRecord {
  return {
    category: "strength",
    durationSeconds: null,
    exerciseId: `catalog-${id}`,
    exerciseName,
    id,
    muscleGroup: "chest",
    notes: null,
    orderIndex: 0,
    reps: 12,
    restSeconds: 60,
    restSecondsBySet: null,
    sets: 1,
    weightKgTarget: null,
  };
}

function buildCameraChain(exercises: TrainingPlanExerciseRecord[]) {
  return buildWorkoutCameraTargetChain({
    exerciseDefinitions: new Map(exercises.map(slot => [slot.exerciseId, {
      id: slot.exerciseId, isActive: true, trackingMode: slot.id === "cable-fly" ? "manual" : "inherit",
      movementProfile: createExerciseMovementProfile({movementContract: buildFallbackPoseMovementContract(slot.id === "squat" ? "squat" : "push_up")}),
      movementContractIdentity: {exerciseId:slot.exerciseId,familyKey:slot.id === "squat" ? "squat" : "push_up",revision:1,trackingMode:"inherit",source:"family"},
    } as FitnessExerciseRecord])),
    completedSetKeys: new Set(),
    currentExercise: exercises[0],
    currentSetNumber: 1,
    orderedExercises: exercises,
    planId: "plan-1",
    planTitle: "Plan",
    sessionId: "session-1",
  });
}

const supportedChain = buildCameraChain([
  makeCameraExercise("push-up", "Push Up"),
  makeCameraExercise("squat", "Barbell Back Squat"),
]);
assertEqual(
  supportedChain?.nextTarget?.exerciseName,
  "Barbell Back Squat",
  "supported sets remain in the same camera chain",
);
assertEqual(
  supportedChain?.completeWorkoutAfterSet,
  false,
  "a following workout set keeps the workout active",
);

const manualBoundary = buildCameraChain([
  makeCameraExercise("push-up", "Push Up"),
  makeCameraExercise("cable-fly", "Cable Fly"),
  makeCameraExercise("squat", "Barbell Back Squat"),
]);
assertEqual(
  manualBoundary?.nextTarget,
  null,
  "camera chaining stops at the first manual-only exercise",
);
assertEqual(
  manualBoundary?.completeWorkoutAfterSet,
  false,
  "a manual-only next set does not complete the workout",
);

const finalCameraSet = buildCameraChain([
  makeCameraExercise("push-up", "Push Up"),
]);
assertEqual(
  finalCameraSet?.completeWorkoutAfterSet,
  true,
  "only the final workout set completes the workout",
);
assertEqual(input.daysPerWeek, 1, "days per week counts workouts only");
assertEqual(input.schedule[0]?.isRestDay, true, "rest state is serialized");
