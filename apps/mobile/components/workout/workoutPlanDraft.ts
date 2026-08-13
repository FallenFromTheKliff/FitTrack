import type {
  CreateTrainingPlanInput,
  FitnessGoal,
  TrainingPlanDetailRecord,
} from "@fittrack/types";

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
};

export type DraftDays = Record<number, DraftDay>;

export function detailToDraft(plan: TrainingPlanDetailRecord): DraftDays {
  return Object.fromEntries(
    plan.scheduleDays
      .filter((day) => day.weekNumber === 1 && day.exercises.length > 0)
      .map((day) => [
        day.dayOfWeek,
        {
          exercises: day.exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            reps: exercise.reps ?? 10,
            restSeconds: exercise.restSeconds,
            restSecondsBySet: exercise.restSecondsBySet,
            sets: exercise.sets,
          })),
          focusLabel: day.focusLabel ?? `${DAY_NAMES[day.dayOfWeek]} training`,
        },
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
      weekNumber: 1,
    }))
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek);

  return {
    daysPerWeek: schedule.length,
    durationWeeks: 12,
    goal,
    schedule,
    title: title.trim(),
  };
}
