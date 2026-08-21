import type {
  RecurringCoachingPlanPreviewResult,
  RecurringCoachingPreviewSession,
} from "@fittrack/api-client";

export type RecurringPlanSelectionSummary = {
  conflictCount: number;
  eligibleSessionCount: number;
  requiredSessionCount: number;
  selectedSessionCount: number;
  canConfirm: boolean;
};

function isEligibleSession(session: RecurringCoachingPreviewSession) {
  return (
    session.recurringState !== "skipped" &&
    session.recurringState !== "cancelled"
  );
}

export function summarizeRecurringPlanSelection(
  preview: RecurringCoachingPlanPreviewResult | null,
  selectedCandidateIndexes: readonly number[],
): RecurringPlanSelectionSummary {
  if (!preview) {
    return {
      conflictCount: 0,
      eligibleSessionCount: 0,
      requiredSessionCount: 0,
      selectedSessionCount: 0,
      canConfirm: false,
    };
  }

  const selected = new Set(selectedCandidateIndexes);
  const eligibleSessions = preview.sessions.filter(isEligibleSession);
  const selectedSessions = eligibleSessions.filter((session) =>
    selected.has(session.candidateIndex),
  );
  const requiredSessionCount = Math.min(
    preview.purchasedSessionCount,
    preview.eligibleSessionCount,
  );
  const conflictCount = selectedSessions.filter(
    (session) => session.conflict,
  ).length;

  return {
    conflictCount,
    eligibleSessionCount: preview.eligibleSessionCount,
    requiredSessionCount,
    selectedSessionCount: selectedSessions.length,
    canConfirm:
      requiredSessionCount > 0 &&
      selectedSessions.length === requiredSessionCount &&
      conflictCount === 0,
  };
}

export function getRecurringPlanSelectionIssue(
  preview: RecurringCoachingPlanPreviewResult | null,
  selectedCandidateIndexes: readonly number[],
  previewStale = false,
) {
  if (!preview) return "Generate a schedule preview before confirming.";
  if (previewStale) {
    return "Preview again after changing the selected workout dates.";
  }

  const summary = summarizeRecurringPlanSelection(
    preview,
    selectedCandidateIndexes,
  );
  if (summary.eligibleSessionCount === 0) {
    return "No eligible workout dates were generated. Choose another start date or update the client program.";
  }
  if (summary.selectedSessionCount !== summary.requiredSessionCount) {
    return `Select exactly ${summary.requiredSessionCount} generated session${summary.requiredSessionCount === 1 ? "" : "s"} for this package.`;
  }
  if (summary.conflictCount > 0) {
    return `Resolve ${summary.conflictCount} selected schedule conflict${summary.conflictCount === 1 ? "" : "s"} before confirming.`;
  }

  return null;
}
