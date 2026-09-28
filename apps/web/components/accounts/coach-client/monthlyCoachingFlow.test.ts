import assert from "node:assert/strict";
import test from "node:test";

import {
  MONTHLY_COACHING_SETUP_COPY,
  deriveMonthlyCoachingSchedule,
  getMonthlyCoachingTimeOptions,
  isPaidCoachingScheduleAppointment,
  isRecurringCoachingSession,
  normalizeMonthlyPreferredTime,
} from "./monthlyCoachingFlow";

test("an active paid monthly plan with zero sessions requires setup", () => {
  const progress = deriveMonthlyCoachingSchedule(
    { id: "monthly-plan-1", totalSessions: 4 },
    [],
  );

  assert.equal(progress.monthlyScheduledCount, 0);
  assert.equal(progress.monthlyPurchasedCount, 4);
  assert.equal(progress.monthlySetupRequired, true);
  assert.equal(MONTHLY_COACHING_SETUP_COPY.required, "SETUP REQUIRED");
  assert.equal(MONTHLY_COACHING_SETUP_COPY.action, "SET MONTHLY SCHEDULE");
});

test("all materialized appointments tied to the paid monthly plan count toward setup", () => {
  const progress = deriveMonthlyCoachingSchedule(
    { id: "monthly-plan-1", totalSessions: 5 },
    [
      { id: "session-1", recurringPlanId: "monthly-plan-1", status: "confirmed" },
      { id: "session-2", recurringPlanId: "other-plan", status: "confirmed" },
      { id: "session-3", recurringPlanId: "monthly-plan-1", status: "cancelled" },
      { id: "session-4", recurringPlanId: "monthly-plan-1", status: "completed" },
      { id: "session-5", recurringPlanId: "monthly-plan-1", status: "no_show" },
      { id: "session-6", recurringPlanId: "monthly-plan-1", status: "skipped" },
    ],
  );

  assert.deepEqual(
    progress.monthlySessions.map((session) => session.id),
    ["session-1", "session-3"],
  );
  assert.equal(progress.monthlyScheduledCount, 5);
  assert.equal(progress.monthlySetupRequired, false);

  const complete = deriveMonthlyCoachingSchedule(
    { id: "monthly-plan-1", totalSessions: 1 },
    [{ id: "session-1", recurringPlanId: "monthly-plan-1", status: "confirmed" }],
  );
  assert.equal(complete.monthlySetupRequired, false);
});

test("monthly setup treats midnight as unset and offers canonical active times", () => {
  assert.equal(normalizeMonthlyPreferredTime("00:00"), "");
  assert.equal(normalizeMonthlyPreferredTime("09:30"), "09:30");
  assert.deepEqual(
    getMonthlyCoachingTimeOptions(
      [
        { isAvailable: true, startTime: "08:15", endTime: "11:00" },
        { isAvailable: false, startTime: "13:00", endTime: "17:00" },
      ],
      60,
    ),
    ["08:30", "09:00", "09:30", "10:00"],
  );
});

test("recurring sessions are paid and highlighted even without appointment payment status", () => {
  const recurring = {
    activePaymentStatus: null,
    recurringPlanId: "monthly-plan-1",
    status: "confirmed",
  };
  const oneTime = {
    activePaymentStatus: null,
    recurringPlanId: null,
    status: "confirmed",
  };

  assert.equal(isRecurringCoachingSession(recurring), true);
  assert.equal(isPaidCoachingScheduleAppointment(recurring), true);
  assert.equal(isRecurringCoachingSession(oneTime), false);
  assert.equal(isPaidCoachingScheduleAppointment(oneTime), false);
});
