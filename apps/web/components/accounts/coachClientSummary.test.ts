import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCoachClientSummary,
  isUpcomingCoachAppointment,
} from "./coachClientSummary";

const NOW = Date.parse("2026-08-12T00:00:00.000Z");

function appointment(
  overrides: Partial<{
    review: null;
    scheduledAt: string;
    status: string;
    userId: string;
  }> = {},
) {
  return {
    review: null,
    scheduledAt: "2026-08-13T09:00:00.000Z",
    status: "confirmed",
    userId: "client-1",
    ...overrides,
  };
}

test("Has Upcoming follows positive row count and No Upcoming excludes it", () => {
  const summaries = buildCoachClientSummary(
    [
      appointment(),
      appointment({
        scheduledAt: "2026-08-01T09:00:00.000Z",
        status: "completed",
      }),
      appointment({
        scheduledAt: "2026-08-01T09:00:00.000Z",
        status: "no_show",
        userId: "client-2",
      }),
    ],
    NOW,
  );
  const withUpcoming = summaries.get("client-1");
  const withoutUpcoming = summaries.get("client-2");

  assert.equal(isUpcomingCoachAppointment(appointment(), NOW), true);
  assert.equal((withUpcoming?.upcoming ?? 0) > 0, true);
  assert.equal((withUpcoming?.upcoming ?? 0) === 0, false);
  assert.equal(withUpcoming?.upcoming, 1);

  assert.equal(withoutUpcoming?.upcoming, 0);
  assert.equal((withoutUpcoming?.upcoming ?? 0) > 0, false);
  assert.equal((withoutUpcoming?.upcoming ?? 0) === 0, true);
});
