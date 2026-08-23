import assert from "node:assert/strict";
import test from "node:test";

import {
  getCurrentTrainingPlanWeek,
  getGymCalendarDayOfWeek,
} from "./training-plan-week";

const scheduleDays = [1, 2, 3, 4].map((weekNumber) => ({
  dayOfWeek: 1,
  exercises: [],
  focusLabel: null,
  id: `day-${weekNumber}`,
  notes: null,
  weekNumber,
}));

test("resolves plan week from Asia/Manila calendar dates", () => {
  const plan = {
    createdAt: "2026-08-03T00:30:00.000Z",
    durationWeeks: 4,
    scheduleDays,
  };

  assert.equal(
    getCurrentTrainingPlanWeek(plan, new Date("2026-08-17T00:00:00.000Z")),
    3,
  );
  assert.equal(
    getGymCalendarDayOfWeek(new Date("2026-08-16T16:30:00.000Z")),
    1,
  );
});

test("clamps before creation, after duration, and to available schedule weeks", () => {
  const plan = {
    createdAt: "2026-08-03T00:30:00.000Z",
    durationWeeks: 8,
    scheduleDays: scheduleDays.filter((day) => day.weekNumber <= 3),
  };

  assert.equal(
    getCurrentTrainingPlanWeek(plan, new Date("2026-07-01T00:00:00.000Z")),
    1,
  );
  assert.equal(
    getCurrentTrainingPlanWeek(plan, new Date("2027-01-01T00:00:00.000Z")),
    3,
  );
});
