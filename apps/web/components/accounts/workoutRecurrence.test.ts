import assert from "node:assert/strict";
import test from "node:test";

import {
  findEmptyWorkoutDay,
  getRemainingPaidWorkoutWeeks,
  materializeRepeatedWorkoutWeeks,
} from "./workoutRecurrence";

test("remaining paid workout weeks use the inclusive Manila gym date", () => {
  const now = new Date("2026-08-13T01:00:00.000Z");

  assert.equal(getRemainingPaidWorkoutWeeks("2026-08-13", now), 1);
  assert.equal(getRemainingPaidWorkoutWeeks("2026-08-20", now), 2);
  assert.equal(getRemainingPaidWorkoutWeeks(undefined, now), 1);
});

test("materialized workout weeks remain independently editable", () => {
  const weeks = materializeRepeatedWorkoutWeeks(
    {
      1: {
        exercises: [
          {
            exerciseId: "exercise-1",
            exerciseName: "Squat",
            reps: 8,
            restSeconds: 90,
            sets: 3,
          },
        ],
        focusLabel: "Lower body",
        isRestDay: false,
      },
    },
    3,
  );

  weeks[2][1].focusLabel = "Edited week";
  weeks[2][1].exercises[0].sets = 4;

  assert.equal(weeks[1][1].focusLabel, "Lower body");
  assert.equal(weeks[1][1].exercises[0].sets, 3);
  assert.equal(weeks[3][1].focusLabel, "Lower body");
  assert.notEqual(weeks[1][1], weeks[2][1]);
  assert.notEqual(weeks[1][1].exercises[0], weeks[2][1].exercises[0]);
});

test("rest days with no exercises pass while empty workout days fail", () => {
  assert.equal(
    findEmptyWorkoutDay({
      1: {
        3: { exercises: [], focusLabel: "Rest", isRestDay: true },
      },
    }),
    null,
  );
  assert.deepEqual(
    findEmptyWorkoutDay({
      1: {
        3: { exercises: [], focusLabel: "Wednesday training", isRestDay: false },
      },
    }),
    { dayOfWeek: 3, weekNumber: 1 },
  );
});

test("recurrence preserves explicit rest-day state", () => {
  const weeks = materializeRepeatedWorkoutWeeks(
    {
      1: {
        exercises: [{ exerciseId: "exercise-1", exerciseName: "Squat", reps: 8, restSeconds: 90, sets: 3 }],
        focusLabel: "Lower body",
        isRestDay: false,
      },
      3: { exercises: [], focusLabel: "Rest", isRestDay: true },
    },
    3,
  );

  assert.equal(weeks[1][3].isRestDay, true);
  assert.equal(weeks[2][3].isRestDay, true);
  assert.equal(weeks[3][3].isRestDay, true);
  assert.equal(weeks[2][3].exercises.length, 0);
});
