import {
  findEmptyDraftDay,
  isDraftRestDay,
  setDraftDayExercises,
  toPlanInput,
} from "./workoutPlanDraft";

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
assertEqual(input.daysPerWeek, 1, "days per week counts workouts only");
assertEqual(input.schedule[0]?.isRestDay, true, "rest state is serialized");
