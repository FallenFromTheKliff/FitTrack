export type WorkoutDayKind = "workout" | "rest";

export type WorkoutDaySemanticsInput = {
  readonly exercises?: readonly unknown[] | null;
  readonly focusLabel?: string | null;
  /**
   * New records provide an explicit model value. Legacy rows leave it null
   * and fall back to the conservative exact-label check below.
   */
  readonly isRestDay?: boolean | null;
};

const LEGACY_REST_LABELS = new Set([
  "active recovery",
  "off",
  "off day",
  "recovery",
  "recovery day",
  "rest",
  "rest day",
]);

function normalizeLegacyLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Legacy seed/data rows only identify recovery days with a short label. Keep
 * this fallback deliberately narrow so ordinary workout names are never
 * reclassified accidentally.
 */
export function isLegacyRestDayLabel(value: string | null | undefined) {
  return Boolean(value && LEGACY_REST_LABELS.has(normalizeLegacyLabel(value)));
}

export function getWorkoutDayKind(
  day: WorkoutDaySemanticsInput,
): WorkoutDayKind {
  if (typeof day.isRestDay === "boolean") {
    return day.isRestDay ? "rest" : "workout";
  }

  return isLegacyRestDayLabel(day.focusLabel) ? "rest" : "workout";
}

export function isWorkoutRestDay(day: WorkoutDaySemanticsInput) {
  return getWorkoutDayKind(day) === "rest";
}
