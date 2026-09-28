import type {
  CreateTrainingPlanInput,
  FitnessGoal,
  TrainingPlanDetailRecord,
} from "@fittrack/types";
import { isWorkoutRestDay } from "@fittrack/app-core";

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type DraftExercise = {
  exerciseId: string;
  exerciseName: string;
  reps: number;
  restSeconds: number;
  restSecondsBySet: number[] | null;
  sets: number;
};

export type DraftDay = {
  exercises: DraftExercise[];
  focusLabel: string;
  isRestDay?: boolean;
};

export type DraftDays = Record<number, DraftDay>;

export function isDraftRestDay(day: DraftDay) {
  if (day.exercises.length > 0) return false;
  if (typeof day.isRestDay === "boolean") return day.isRestDay;
  return isWorkoutRestDay(day);
}

export function isConfiguredWorkoutDay(day: DraftDay) {
  return !isDraftRestDay(day) && day.exercises.length > 0;
}

export function findEmptyDraftDay(draftDays: DraftDays) {
  const entry = Object.entries(draftDays).find(
    ([, day]) => !isDraftRestDay(day) && day.exercises.length === 0,
  );
  return entry ? Number(entry[0]) : null;
}

export function setDraftDayExercises(
  day: DraftDay,
  exercises: DraftExercise[],
): DraftDay {
  return {
    ...day,
    exercises,
    isRestDay: exercises.length === 0,
  };
}

export function detailToDraft(plan: TrainingPlanDetailRecord): DraftDays {
  return Object.fromEntries(
    plan.scheduleDays
      .filter((day) => day.weekNumber === 1)
      .map((day) => [
        day.dayOfWeek,
        (() => {
          const exercises = day.exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            reps: exercise.reps ?? 10,
            restSeconds: exercise.restSeconds,
            restSecondsBySet: exercise.restSecondsBySet,
            sets: exercise.sets,
          }));
          return {
            exercises,
            focusLabel:
              day.focusLabel ?? `${DAY_NAMES[day.dayOfWeek]} training`,
            isRestDay:
              exercises.length === 0
                ? day.isRestDay !== false && isWorkoutRestDay(day)
                : false,
          };
        })(),
      ]),
  );
}

export function toPlanInput(
  title: string,
  goal: FitnessGoal,
  draftDays: DraftDays,
): CreateTrainingPlanInput {
  const schedule = Object.entries(draftDays)
    .map(([dayOfWeek, day]) => ({
      dayOfWeek: Number(dayOfWeek),
      exercises: day.exercises.map((exercise, orderIndex) => ({
        exerciseId: exercise.exerciseId,
        orderIndex,
        reps: exercise.reps,
        restSeconds: exercise.restSeconds,
        restSecondsBySet: exercise.restSecondsBySet ?? undefined,
        sets: exercise.sets,
      })),
      focusLabel:
        day.focusLabel.trim() || `${DAY_NAMES[Number(dayOfWeek)]} training`,
      isRestDay: isDraftRestDay(day),
      weekNumber: 1,
    }))
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek);

  return {
    daysPerWeek: Object.values(draftDays).filter(isConfiguredWorkoutDay).length,
    durationWeeks: 12,
    goal,
    schedule,
    title: title.trim(),
  };
}
