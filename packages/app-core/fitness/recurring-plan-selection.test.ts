import assert from "node:assert/strict";
import test from "node:test";
import type { RecurringCoachingPlanPreviewResult } from "@fittrack/api-client";

import {
  getRecurringPlanSelectionIssue,
  summarizeRecurringPlanSelection,
} from "./recurring-plan-selection";

function makePreview(
  overrides: Partial<RecurringCoachingPlanPreviewResult> = {},
): RecurringCoachingPlanPreviewResult {
  return {
    candidateCount: 3,
    canConfirm: true,
    conflictCount: 0,
    eligibleSessionCount: 3,
    purchasedSessionCount: 2,
    selectedSessionCount: 2,
    sessions: [0, 1, 2].map((candidateIndex) => ({
      candidateIndex,
      coachId: "coach",
      conflict: candidateIndex === 2,
      conflictReasons: candidateIndex === 2 ? ["coach_busy"] : [],
      date: `2026-09-0${candidateIndex + 1}`,
      durationMinutes: 60,
      endsAt: `2026-09-0${candidateIndex + 1}T10:00:00.000Z`,
      originalScheduledAt: null,
      recurringState: "generated",
      selected: candidateIndex < 2,
      scheduledAt: `2026-09-0${candidateIndex + 1}T09:00:00.000Z`,
      status: "confirmed",
      time: "09:00",
      workout: null,
    })),
    totalSessions: 2,
    venueConflictsChecked: false,
    venueConflictsNote: "deferred",
    ...overrides,
  };
}

test("requires exactly the purchased count when more candidates are eligible", () => {
  const summary = summarizeRecurringPlanSelection(makePreview(), [0]);

  assert.equal(summary.requiredSessionCount, 2);
  assert.equal(summary.selectedSessionCount, 1);
  assert.equal(summary.canConfirm, false);
  assert.match(
    getRecurringPlanSelectionIssue(makePreview(), [0]) ?? "",
    /Select exactly 2/,
  );
});

test("ignores conflicts on unselected candidates and accepts a valid selection", () => {
  const summary = summarizeRecurringPlanSelection(makePreview(), [0, 1]);

  assert.equal(summary.conflictCount, 0);
  assert.equal(summary.canConfirm, true);
  assert.equal(getRecurringPlanSelectionIssue(makePreview(), [0, 1]), null);
});

test("requires a fresh preview after a selection change", () => {
  assert.match(
    getRecurringPlanSelectionIssue(makePreview(), [0, 1], true) ?? "",
    /Preview again/,
  );
});
