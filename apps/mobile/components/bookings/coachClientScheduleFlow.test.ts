// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  canRescheduleCoachClientSession,
  formatCoachClientSessionTime,
  getCoachClientSessionPresentation,
} from "./coachClientScheduleFlow.ts";

const now = Date.UTC(2026, 0, 1, 0, 0, 0);

test("future confirmed one-time and monthly sessions can be rescheduled", () => {
  assert.equal(
    canRescheduleCoachClientSession(
      {
        bookingType: "single",
        date: "2026-01-02",
        startTime: "8:00 AM",
        status: "confirmed",
      },
      now,
    ),
    true,
  );
  assert.equal(
    canRescheduleCoachClientSession(
      {
        bookingType: "recurring",
        date: "2026-01-02",
        startTime: "8:00 AM",
        recurringPlanId: "plan-1",
        status: "confirmed",
      },
      now,
    ),
    true,
  );
});

test("terminal, venue-coach, and past sessions stay non-reschedulable", () => {
  assert.equal(
    canRescheduleCoachClientSession(
      {
        bookingType: "single",
        date: "2026-01-02",
        startTime: "8:00 AM",
        status: "completed",
      },
      now,
    ),
    false,
  );
  assert.equal(
    canRescheduleCoachClientSession(
      {
        bookingType: "venue_coach",
        date: "2026-01-02",
        startTime: "8:00 AM",
        status: "confirmed",
      },
      now,
    ),
    false,
  );
  assert.equal(
    canRescheduleCoachClientSession(
      {
        bookingType: "single",
        date: "2025-12-31",
        startTime: "8:00 AM",
        status: "confirmed",
      },
      now,
    ),
    false,
  );
});

test("session cards render one canonical time string", () => {
  assert.equal(
    formatCoachClientSessionTime({
      date: "2026-01-02",
      startTime: "8:00 AM",
      status: "confirmed",
      time: "8:00 AM - 9:00 AM",
    }),
    "8:00 AM - 9:00 AM",
  );
});

test("recurring sessions are highlighted while one-time sessions stay neutral", () => {
  assert.deepEqual(
    getCoachClientSessionPresentation({
      bookingType: "recurring",
      date: "2026-01-02",
      recurringPlanId: "plan-1",
      status: "confirmed",
    }),
    {
      isMonthlyCoaching: true,
      monthlyLabel: "MONTHLY COACHING",
      statusLabel: "Confirmed",
    },
  );
  assert.deepEqual(
    getCoachClientSessionPresentation({
      bookingType: "single",
      date: "2026-01-02",
      status: "confirmed",
    }),
    {
      isMonthlyCoaching: false,
      monthlyLabel: null,
      statusLabel: "Confirmed",
    },
  );
});
