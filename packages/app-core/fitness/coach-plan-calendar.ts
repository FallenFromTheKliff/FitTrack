import type {
  TrainingPlanDetailRecord,
  TrainingPlanScheduleDayRecord,
  TrainingPlanSummaryRecord,
  WorkoutSessionSummaryRecord,
} from "@fittrack/types";

export type CoachPlanDayState = "completed" | "scheduled" | "skipped" | "empty";

export type CoachPlanCalendarDay = {
  date: Date;
  dateKey: string;
  dayOfWeek: number;
  exercises: TrainingPlanScheduleDayRecord["exercises"];
  focusLabels: string[];
  scheduleDays: TrainingPlanScheduleDayRecord[];
  session: WorkoutSessionSummaryRecord | null;
  state: CoachPlanDayState;
};

const GYM_TIME_ZONE = "Asia/Manila";

/**
 * A coach assignment is canonical when the plan source says so. The coach id
 * remains a backwards-compatible fallback for already-issued records.
 */
export function isCoachManagedTrainingPlan(
  plan:
    | Pick<TrainingPlanSummaryRecord, "coachId" | "source">
    | null
    | undefined,
) {
  return Boolean(plan && (plan.source === "coach_assigned" || plan.coachId));
}

function getDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: GYM_TIME_ZONE,
    year: "numeric",
  }).formatToParts(value);

  return {
    day: Number(parts.find((part) => part.type === "day")?.value ?? 1),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 1),
    year: Number(parts.find((part) => part.type === "year")?.value ?? 1970),
  };
}

export function toCoachPlanDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = getDateParts(date);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function cloneAtNoon(value: Date) {
  const clone = new Date(value);
  clone.setHours(12, 0, 0, 0);
  return clone;
}

function addDays(value: Date, days: number) {
  const clone = cloneAtNoon(value);
  clone.setDate(clone.getDate() + days);
  return clone;
}

function getWeekStart(value: Date) {
  const clone = cloneAtNoon(value);
  clone.setDate(clone.getDate() - clone.getDay());
  return clone;
}

function getScheduleWeekNumbers(plan: TrainingPlanDetailRecord) {
  return plan.scheduleDays
    .map((day) => day.weekNumber)
    .filter((weekNumber, index, values) => values.indexOf(weekNumber) === index)
    .sort((a, b) => a - b);
}

function getScheduleWeekNumber(
  plan: TrainingPlanDetailRecord,
  referenceDate: Date,
) {
  const weekNumbers = getScheduleWeekNumbers(plan);
  const monthStart = cloneAtNoon(referenceDate);
  monthStart.setDate(1);
  const monthGridStart = getWeekStart(monthStart);
  const referenceWeekStart = getWeekStart(referenceDate);
  const weekIndex = Math.max(
    0,
    Math.round(
      (referenceWeekStart.getTime() - monthGridStart.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    ),
  );

  return weekNumbers[Math.min(weekIndex, weekNumbers.length - 1)] ?? 1;
}

function isCompletedSession(session: WorkoutSessionSummaryRecord) {
  return session.status === "completed" || Boolean(session.completedAt);
}

function isSkippedSession(session: WorkoutSessionSummaryRecord) {
  return session.status === "cancelled" || Boolean(session.cancelledAt);
}

export function buildCoachPlanCalendarWeek(
  plan: TrainingPlanDetailRecord,
  sessions: WorkoutSessionSummaryRecord[] = [],
  referenceDate = new Date(),
  scheduleWeekNumber?: number,
): CoachPlanCalendarDay[] {
  const weekNumber =
    scheduleWeekNumber ?? getScheduleWeekNumber(plan, referenceDate);
  const weekStart = getWeekStart(referenceDate);
  const planSessions = sessions.filter((session) => session.planId === plan.id);

  return Array.from({ length: 7 }, (_, dayIndex) => {
    const date = addDays(weekStart, dayIndex);
    const dateKey = toCoachPlanDateKey(date);
    const scheduleDays = plan.scheduleDays.filter(
      (day) => day.weekNumber === weekNumber && day.dayOfWeek === dayIndex,
    );
    const daySessions = planSessions.filter(
      (candidate) => toCoachPlanDateKey(candidate.startedAt) === dateKey,
    );
    const session =
      daySessions.find(isCompletedSession) ??
      daySessions.find(isSkippedSession) ??
      daySessions[0] ??
      null;
    const exercises = scheduleDays
      .flatMap((day) => day.exercises)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const focusLabels = scheduleDays
      .map((day) => day.focusLabel?.trim())
      .filter((label): label is string => Boolean(label));
    const hasPlannedWorkout = exercises.length > 0;

    return {
      date,
      dateKey,
      dayOfWeek: dayIndex,
      exercises,
      focusLabels,
      scheduleDays,
      session,
      state: !hasPlannedWorkout
        ? "empty"
        : session && isCompletedSession(session)
          ? "completed"
          : session && isSkippedSession(session)
            ? "skipped"
            : "scheduled",
    };
  });
}

export function buildCoachPlanCalendarMonth(
  plan: TrainingPlanDetailRecord,
  sessions: WorkoutSessionSummaryRecord[] = [],
  referenceDate = new Date(),
): CoachPlanCalendarDay[] {
  const monthStart = cloneAtNoon(referenceDate);
  monthStart.setDate(1);
  const monthEnd = cloneAtNoon(referenceDate);
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0);

  const gridStart = getWeekStart(monthStart);
  const lastWeekStart = getWeekStart(monthEnd);
  const weekCount =
    Math.round(
      (lastWeekStart.getTime() - gridStart.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    ) + 1;
  const scheduleWeekNumbers = getScheduleWeekNumbers(plan);

  return Array.from({ length: weekCount }, (_, weekIndex) => {
    const scheduleWeekNumber =
      scheduleWeekNumbers[
        Math.min(weekIndex, scheduleWeekNumbers.length - 1)
      ] ?? 1;
    return buildCoachPlanCalendarWeek(
      plan,
      sessions,
      addDays(gridStart, weekIndex * 7),
      scheduleWeekNumber,
    );
  }).flat();
}
