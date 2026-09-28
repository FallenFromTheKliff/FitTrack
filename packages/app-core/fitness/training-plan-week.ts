import type { TrainingPlanDetailRecord } from "@fittrack/types";

const GYM_TIME_ZONE = "Asia/Manila";
const DAY_MS = 24 * 60 * 60 * 1000;

function getGymDateParts(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: GYM_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);

  return {
    day: Number(parts.find((part) => part.type === "day")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    year: Number(parts.find((part) => part.type === "year")?.value),
  };
}

function toGymDateOrdinal(value: Date | string) {
  const parts = getGymDateParts(value);
  return parts
    ? Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS)
    : null;
}

export function getGymCalendarDayOfWeek(referenceDate = new Date()) {
  const parts = getGymDateParts(referenceDate);
  return parts
    ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
    : referenceDate.getDay();
}

/**
 * Resolves the active schedule week from the plan's own lifecycle using
 * Asia/Manila calendar dates. The result is bounded by both the declared plan
 * duration and the schedule weeks that actually exist on the plan.
 */
export function getCurrentTrainingPlanWeek(
  plan: Pick<
    TrainingPlanDetailRecord,
    "createdAt" | "durationWeeks" | "scheduleDays"
  >,
  referenceDate = new Date(),
) {
  const createdOrdinal = toGymDateOrdinal(plan.createdAt);
  const referenceOrdinal = toGymDateOrdinal(referenceDate);
  const durationWeeks = Math.max(1, Math.floor(plan.durationWeeks));
  const elapsedDays =
    createdOrdinal === null || referenceOrdinal === null
      ? 0
      : Math.max(0, referenceOrdinal - createdOrdinal);
  const lifecycleWeek = Math.min(
    durationWeeks,
    Math.max(1, Math.floor(elapsedDays / 7) + 1),
  );
  const availableWeeks = plan.scheduleDays
    .map((day) => day.weekNumber)
    .filter(
      (weekNumber, index, values) =>
        Number.isInteger(weekNumber) &&
        weekNumber >= 1 &&
        weekNumber <= durationWeeks &&
        values.indexOf(weekNumber) === index,
    )
    .sort((left, right) => left - right);

  if (availableWeeks.length === 0) return lifecycleWeek;

  return (
    [...availableWeeks]
      .reverse()
      .find((weekNumber) => weekNumber <= lifecycleWeek) ?? availableWeeks[0]
  );
}
