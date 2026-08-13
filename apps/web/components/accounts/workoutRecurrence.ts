import {
  isLegacyRestDayLabel,
  isWorkoutRestDay,
  type WorkoutDayKind,
} from "@fittrack/app-core";

const DAY_MS = 24 * 60 * 60 * 1_000;

export const MAX_WORKOUT_RECURRENCE_WEEKS = 12;

export type WorkoutDraftExercise = {
  exerciseId: string;
  exerciseName: string;
  reps: number;
  restSeconds: number;
  sets: number;
};

export type WorkoutDraftDay = {
  exercises: WorkoutDraftExercise[];
  focusLabel: string;
  isRestDay: boolean;
};

export type WorkoutDraftWeeks = Record<
  number,
  Record<number, WorkoutDraftDay>
>;

function toGymDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Manila",
    year: "numeric",
  }).formatToParts(value);

  return {
    day: Number(parts.find((part) => part.type === "day")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    year: Number(parts.find((part) => part.type === "year")?.value),
  };
}

export function getRemainingPaidWorkoutWeeks(
  paidPeriodEndDate?: string | null,
  now = new Date(),
) {
  const endDateMatch = paidPeriodEndDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!endDateMatch) return 1;

  const gymDate = toGymDateParts(now);
  const currentDay = Date.UTC(gymDate.year, gymDate.month - 1, gymDate.day);
  const endDay = Date.UTC(
    Number(endDateMatch[1]),
    Number(endDateMatch[2]) - 1,
    Number(endDateMatch[3]),
  );
  const inclusiveDaysRemaining = Math.floor((endDay - currentDay) / DAY_MS) + 1;

  return Math.max(
    1,
    Math.min(
      MAX_WORKOUT_RECURRENCE_WEEKS,
      Math.ceil(inclusiveDaysRemaining / 7),
    ),
  );
}

function cloneWorkoutDay(day: WorkoutDraftDay): WorkoutDraftDay {
  return {
    ...day,
    exercises: day.exercises.map((exercise) => ({ ...exercise })),
  };
}

export function findEmptyWorkoutDay(draftWeeks: WorkoutDraftWeeks) {
  for (const weekNumber of Object.keys(draftWeeks)
    .map(Number)
    .sort((left, right) => left - right)) {
    const days = draftWeeks[weekNumber] ?? {};
    for (const dayOfWeek of Object.keys(days)
      .map(Number)
      .sort((left, right) => left - right)) {
      const day = days[dayOfWeek];
      if (day && !isWorkoutRestDay(day) && day.exercises.length === 0) {
        return { dayOfWeek, weekNumber };
      }
    }
  }

  return null;
}

export function setWorkoutDayKind(
  day: WorkoutDraftDay,
  kind: WorkoutDayKind,
  dayLabel: string,
): WorkoutDraftDay {
  const isRestDay = kind === "rest";
  const nextLabel = isRestDay
    ? isLegacyRestDayLabel(day.focusLabel)
      ? day.focusLabel
      : "Rest"
    : isLegacyRestDayLabel(day.focusLabel)
      ? dayLabel
      : day.focusLabel;

  return {
    ...day,
    exercises: isRestDay ? [] : day.exercises,
    focusLabel: nextLabel,
    isRestDay,
  };
}

export function materializeRepeatedWorkoutWeeks(
  sourceWeek: Record<number, WorkoutDraftDay>,
  weekCount: number,
): WorkoutDraftWeeks {
  const boundedWeekCount = Math.max(
    1,
    Math.min(MAX_WORKOUT_RECURRENCE_WEEKS, Math.round(weekCount)),
  );

  return Object.fromEntries(
    Array.from({ length: boundedWeekCount }, (_, index) => [
      index + 1,
      Object.fromEntries(
        Object.entries(sourceWeek).map(([dayOfWeek, day]) => [
          Number(dayOfWeek),
          cloneWorkoutDay(day),
        ]),
      ),
    ]),
  );
}
