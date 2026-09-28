import assert from "node:assert/strict";
import test from "node:test";

import {
  getGymDateKey,
  getGymDayOfWeek,
  isGymSlotInPast,
} from "./booking.ts";

test("booking dates and weekdays use the gym calendar instead of the device timezone", () => {
  const beforeMidnightUtc = new Date("2026-09-24T15:59:00.000Z");
  const afterMidnightUtc = new Date("2026-09-24T16:00:00.000Z");

  assert.equal(getGymDateKey(beforeMidnightUtc), "2026-09-24");
  assert.equal(getGymDateKey(afterMidnightUtc), "2026-09-25");
  assert.equal(getGymDayOfWeek("2026-09-24"), 4);
});

test("booking buttons can disable past gym-time slots without hiding them", () => {
  const now = new Date("2026-09-24T04:30:00.000Z");

  assert.equal(isGymSlotInPast("2026-09-24", "12:00", now), true);
  assert.equal(isGymSlotInPast("2026-09-24", "13:00", now), false);
  assert.equal(isGymSlotInPast("2026-09-25", "08:00", now), false);
});
