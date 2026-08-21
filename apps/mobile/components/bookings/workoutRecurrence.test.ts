import {
  findEmptyWorkoutDay,
  getRemainingPaidWorkoutWeeks,
  materializeRepeatedWorkoutWeeks,
} from "./workoutRecurrence";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function runWorkoutRecurrenceRegression() {
  const now = new Date("2026-08-13T01:00:00.000Z");

  assertEqual(
    getRemainingPaidWorkoutWeeks("2026-08-13", now),
    1,
    "same-day paid period produces one workout week",
  );
  assertEqual(
    getRemainingPaidWorkoutWeeks("2026-08-20", now),
    2,
    "remaining paid weeks use the inclusive Manila date",
  );
  assertEqual(
    getRemainingPaidWorkoutWeeks(undefined, now),
    1,
    "missing paid period keeps recurrence to one week",
  );

  const weeks = materializeRepeatedWorkoutWeeks(
    {
      1: {
        focusLabel: "Lower body",
        exercises: [
          {
            exerciseId: "exercise-1",
            exerciseName: "Squat",
            reps: 8,
            restSeconds: 90,
            restSecondsBySet: [90, 75, 60],
            sets: 3,
          },
        ],
        isRestDay: false,
      },
    },
    3,
  );

  weeks[2][1].focusLabel = "Edited week";
  weeks[2][1].exercises[0].sets = 4;
  weeks[2][1].exercises[0].restSecondsBySet?.push(45);

  assertEqual(weeks[1][1].focusLabel, "Lower body", "week labels are independent");
  assertEqual(weeks[1][1].exercises[0].sets, 3, "week exercises are independent");
  assertEqual(
    weeks[1][1].exercises[0].restSecondsBySet?.length,
    3,
    "per-set rest arrays are independent",
  );
  assertEqual(
    weeks[3][1].exercises[0].restSecondsBySet?.[2],
    60,
    "later generated weeks keep the source rest values",
  );

  const restDay = { exercises: [], focusLabel: "Rest", isRestDay: true };
  assertEqual(
    findEmptyWorkoutDay({ 1: { 3: restDay } }),
    null,
    "rest day with zero exercises is valid",
  );
  assertEqual(
    findEmptyWorkoutDay({
      1: { 3: { exercises: [], focusLabel: "Wednesday training", isRestDay: false } },
    })?.dayOfWeek,
    3,
    "empty workout day remains invalid",
  );

  const repeated = materializeRepeatedWorkoutWeeks({ 3: restDay }, 3);
  assertEqual(repeated[1][3].isRestDay, true, "week one keeps rest state");
  assertEqual(repeated[2][3].isRestDay, true, "week two keeps rest state");
  assertEqual(repeated[3][3].isRestDay, true, "week three keeps rest state");
}

runWorkoutRecurrenceRegression();
