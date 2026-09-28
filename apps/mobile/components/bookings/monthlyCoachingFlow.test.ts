// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveMonthlyCoachingSchedule,
  getMonthlyCoachingSetupActionLabel,
  getMonthlyCoachingTimeOptions,
  normalizeMonthlyPreferredTime,
} from "./monthlyCoachingFlow.ts";

test("monthly progress counts every session tied to the paid plan", () => {
  assert.deepEqual(
    deriveMonthlyCoachingSchedule(
      { id: "plan-1", totalSessions: 3 },
      [
        { recurringPlanId: "plan-1" },
        { recurringPlanId: "plan-1" },
        { recurringPlanId: "other-plan" },
      ],
    ),
    {
      monthlyPurchasedCount: 3,
      monthlyScheduledCount: 2,
      monthlySetupRequired: true,
    },
  );
});

test("monthly time choices use real availability and 30-minute increments", () => {
  assert.deepEqual(
    getMonthlyCoachingTimeOptions(
      [{ startTime: "06:00", endTime: "08:00", isAvailable: true }],
      60,
    ),
    ["06:00", "06:30", "07:00"],
  );
  assert.equal(normalizeMonthlyPreferredTime("00:00"), "");
  assert.equal(normalizeMonthlyPreferredTime("14:30:00"), "14:30");
  assert.equal(getMonthlyCoachingSetupActionLabel(0), "SET MONTHLY SCHEDULE");
  assert.equal(
    getMonthlyCoachingSetupActionLabel(2),
    "COMPLETE MONTHLY SCHEDULE",
  );
});
