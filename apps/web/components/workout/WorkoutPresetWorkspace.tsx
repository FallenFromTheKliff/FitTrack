"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Plus, Trash2 } from "lucide-react";
import type {
  CreateTrainingPlanInput,
  FitnessExerciseRecord,
  FitnessGoal,
  LogWorkoutSetInput,
  TrainingPlanDetailRecord,
  WorkoutSessionDetailRecord,
} from "@fittrack/types";

import FitButton from "@/components/fit/FitButton";
import { FitSelect, FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";

type DraftExercise = {
  exerciseId: string;
  reps: number;
  restSeconds: number;
  sets: number;
};

type DraftDay = {
  dayOfWeek: number;
  exercises: DraftExercise[];
  focusLabel: string;
};

const DAY_OPTIONS = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

const GOAL_OPTIONS: Array<{ label: string; value: FitnessGoal }> = [
  { label: "Build muscle", value: "bulking" },
  { label: "Lose fat", value: "cutting" },
  { label: "Maintain fitness", value: "maintenance" },
  { label: "Sport performance", value: "sport_specific" },
];

function numberValue(value: string, fallback: number, minimum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.round(parsed)) : fallback;
}

export function WorkoutPresetBuilder({
  exercises,
  isCreating,
  isCreatingCustomExercise,
  onCreate,
  onCreateCustomExercise,
}: {
  exercises: FitnessExerciseRecord[];
  isCreating: boolean;
  isCreatingCustomExercise: boolean;
  onCreate: (input: CreateTrainingPlanInput) => Promise<void>;
  onCreateCustomExercise: (name: string) => Promise<string>;
}) {
  const { colors } = useTheme();
  const firstExerciseId = exercises[0]?.id ?? "";
  const [title, setTitle] = useState("My weekly split");
  const [goal, setGoal] = useState<FitnessGoal>("maintenance");
  const [customExerciseName, setCustomExerciseName] = useState("");
  const [days, setDays] = useState<DraftDay[]>([
    {
      dayOfWeek: new Date().getDay(),
      exercises: [{ exerciseId: firstExerciseId, reps: 10, restSeconds: 60, sets: 3 }],
      focusLabel: "Training day",
    },
  ]);

  useEffect(() => {
    if (!firstExerciseId) return;
    setDays((current) =>
      current.map((day) => ({
        ...day,
        exercises: day.exercises.map((exercise) =>
          exercise.exerciseId ? exercise : { ...exercise, exerciseId: firstExerciseId },
        ),
      })),
    );
  }, [firstExerciseId]);

  const fieldStyle = {
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    color: colors.textPrimary,
    minHeight: 40,
    padding: "8px 10px",
    width: "100%",
  };

  const updateDay = (index: number, patch: Partial<DraftDay>) => {
    setDays((current) =>
      current.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day)),
    );
  };

  const updateExercise = (
    dayIndex: number,
    exerciseIndex: number,
    patch: Partial<DraftExercise>,
  ) => {
    setDays((current) =>
      current.map((day, currentDayIndex) =>
        currentDayIndex === dayIndex
          ? {
              ...day,
              exercises: day.exercises.map((exercise, currentExerciseIndex) =>
                currentExerciseIndex === exerciseIndex
                  ? { ...exercise, ...patch }
                  : exercise,
              ),
            }
          : day,
      ),
    );
  };

  const submit = async () => {
    const validDays = days.filter(
      (day) => day.exercises.length > 0 && day.exercises.every((item) => item.exerciseId),
    );
    if (!title.trim() || validDays.length === 0) return;
    await onCreate({
      daysPerWeek: validDays.length,
      durationWeeks: 12,
      goal,
      schedule: validDays.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        exercises: day.exercises.map((exercise, orderIndex) => ({
          exerciseId: exercise.exerciseId,
          orderIndex,
          reps: exercise.reps,
          restSeconds: exercise.restSeconds,
          sets: exercise.sets,
        })),
        focusLabel: day.focusLabel.trim() || "Training day",
        weekNumber: 1,
      })),
      title: title.trim(),
    });
  };

  return (
    <div data-ui="workout-preset-builder" style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 11 }}>
            PRESET NAME
          </FitText>
          <input
            aria-label="Preset name"
            onChange={(event) => setTitle(event.target.value)}
            style={fieldStyle}
            value={title}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 11 }}>
            GOAL
          </FitText>
          <FitSelect
            fullWidth
            onChange={(event) => setGoal(event.target.value as FitnessGoal)}
            options={GOAL_OPTIONS}
            value={goal}
          />
        </label>
      </div>

      <div
        style={{
          alignItems: "end",
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 11 }}>
            CUSTOM EXERCISE (OPTIONAL)
          </FitText>
          <input
            aria-label="Custom exercise name"
            onChange={(event) => setCustomExerciseName(event.target.value)}
            placeholder="e.g. Kettlebell pistol squat"
            style={fieldStyle}
            value={customExerciseName}
          />
        </label>
        <FitButton
          disabled={isCreatingCustomExercise || !customExerciseName.trim()}
          label={isCreatingCustomExercise ? "Adding Exercise" : "Add to Library"}
          onClick={async () => {
            const exerciseId = await onCreateCustomExercise(customExerciseName.trim());
            setDays((current) =>
              current.map((day, dayIndex) =>
                dayIndex === 0
                  ? {
                      ...day,
                      exercises: day.exercises.map((exercise, exerciseIndex) =>
                        exerciseIndex === 0
                          ? { ...exercise, exerciseId }
                          : exercise,
                      ),
                    }
                  : day,
              ),
            );
            setCustomExerciseName("");
          }}
          variant="ghost"
        />
      </div>

      {days.map((day, dayIndex) => (
        <div
          key={`${day.dayOfWeek}-${dayIndex}`}
          style={{
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            display: "grid",
            gap: 10,
            padding: 12,
          }}
        >
          <div
            style={{
              alignItems: "end",
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            }}
          >
            <FitSelect
              fullWidth
              onChange={(event) =>
                updateDay(dayIndex, { dayOfWeek: Number(event.target.value) })
              }
              options={DAY_OPTIONS}
              value={String(day.dayOfWeek)}
            />
            <input
              aria-label={`Focus for ${DAY_OPTIONS[day.dayOfWeek]?.label ?? "day"}`}
              onChange={(event) => updateDay(dayIndex, { focusLabel: event.target.value })}
              placeholder="Push, pull, legs..."
              style={fieldStyle}
              value={day.focusLabel}
            />
            <FitButton
              aria-label={`Remove ${DAY_OPTIONS[day.dayOfWeek]?.label ?? "day"}`}
              disabled={days.length === 1}
              icon={Trash2}
              iconOnly
              onClick={() =>
                setDays((current) => current.filter((_, index) => index !== dayIndex))
              }
              variant="ghost"
            />
          </div>

          {day.exercises.map((exercise, exerciseIndex) => (
            <div
              key={`${dayIndex}-${exerciseIndex}`}
              style={{
                alignItems: "center",
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fit, minmax(76px, 1fr))",
              }}
            >
              <div style={{ gridColumn: "span 2", minWidth: 0 }}>
                <FitSelect
                  aria-label={`Exercise ${exerciseIndex + 1}`}
                  fullWidth
                  onChange={(event) =>
                    updateExercise(dayIndex, exerciseIndex, {
                      exerciseId: event.target.value,
                    })
                  }
                  options={exercises.map((item) => ({ label: item.name, value: item.id }))}
                  value={exercise.exerciseId}
                />
              </div>
              <input
                aria-label="Sets"
                min={1}
                onChange={(event) =>
                  updateExercise(dayIndex, exerciseIndex, {
                    sets: numberValue(event.target.value, 3, 1),
                  })
                }
                style={fieldStyle}
                type="number"
                value={exercise.sets}
              />
              <input
                aria-label="Reps"
                min={1}
                onChange={(event) =>
                  updateExercise(dayIndex, exerciseIndex, {
                    reps: numberValue(event.target.value, 10, 1),
                  })
                }
                style={fieldStyle}
                type="number"
                value={exercise.reps}
              />
              <input
                aria-label="Rest seconds"
                min={0}
                onChange={(event) =>
                  updateExercise(dayIndex, exerciseIndex, {
                    restSeconds: numberValue(event.target.value, 60, 0),
                  })
                }
                style={fieldStyle}
                type="number"
                value={exercise.restSeconds}
              />
              <FitButton
                aria-label="Remove exercise"
                disabled={day.exercises.length === 1}
                icon={Trash2}
                iconOnly
                onClick={() =>
                  updateDay(dayIndex, {
                    exercises: day.exercises.filter(
                      (_, currentIndex) => currentIndex !== exerciseIndex,
                    ),
                  })
                }
                variant="ghost"
              />
            </div>
          ))}

          <FitButton
            icon={Plus}
            label="Add Exercise"
            onClick={() =>
              updateDay(dayIndex, {
                exercises: [
                  ...day.exercises,
                  { exerciseId: firstExerciseId, reps: 10, restSeconds: 60, sets: 3 },
                ],
              })
            }
            variant="ghost"
          />
        </div>
      ))}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <FitButton
          icon={Plus}
          label="Add Training Day"
          onClick={() =>
            setDays((current) => [
              ...current,
              {
                dayOfWeek: (current[current.length - 1].dayOfWeek + 1) % 7,
                exercises: [
                  { exerciseId: firstExerciseId, reps: 10, restSeconds: 60, sets: 3 },
                ],
                focusLabel: "Training day",
              },
            ])
          }
          variant="ghost"
        />
        <FitButton
          disabled={isCreating || !firstExerciseId}
          label={isCreating ? "Saving Preset" : "Save Preset"}
          onClick={() => void submit()}
        />
      </div>
    </div>
  );
}

export function TodayWorkoutSteps({
  isLogging,
  onLogSet,
  plan,
  session,
}: {
  isLogging: boolean;
  onLogSet: (input: LogWorkoutSetInput) => Promise<void>;
  plan: TrainingPlanDetailRecord | null;
  session: WorkoutSessionDetailRecord | null;
}) {
  const { colors } = useTheme();
  const [restRemaining, setRestRemaining] = useState(0);
  const today = new Date().getDay();
  const day = plan?.scheduleDays.find(
    (candidate) => candidate.weekNumber === 1 && candidate.dayOfWeek === today,
  );

  useEffect(() => {
    if (restRemaining <= 0) return;
    const timer = window.setInterval(
      () => setRestRemaining((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [restRemaining]);

  const completed = useMemo(
    () =>
      new Set(
        (session?.exerciseLogs ?? [])
          .filter((log) => log.planExerciseId)
          .map((log) => `${log.planExerciseId}:${log.setNumber}`),
      ),
    [session?.exerciseLogs],
  );

  if (!plan) {
    return (
      <FitText excludeGlobalScale style={{ color: colors.textMuted }}>
        Select or create a workout preset to load today&apos;s steps.
      </FitText>
    );
  }

  if (!day) {
    return (
      <FitText excludeGlobalScale style={{ color: colors.textMuted }}>
        Today is a rest day in {plan.title}. Choose another preset if you want to train.
      </FitText>
    );
  }

  return (
    <div data-ui="today-workout-steps" style={{ display: "grid", gap: 12 }}>
      <div>
        <FitText
          as="h3"
          excludeGlobalScale
          style={{ color: colors.textPrimary, fontSize: 17, fontWeight: 800 }}
        >
          {day.focusLabel || DAY_OPTIONS[today].label}
        </FitText>
        <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 12 }}>
          Complete each set in order. Camera tracking is optional.
        </FitText>
      </div>

      {restRemaining > 0 ? (
        <div
          role="status"
          style={{
            alignItems: "center",
            backgroundColor: `${colors.brand}12`,
            border: `1px solid ${colors.brand}40`,
            borderRadius: 8,
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
            padding: "10px 12px",
          }}
        >
          <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontWeight: 700 }}>
            <Clock3 size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Rest {restRemaining}s
          </FitText>
          <FitButton label="Skip Rest" onClick={() => setRestRemaining(0)} variant="ghost" />
        </div>
      ) : null}

      {day.exercises.map((exercise, exerciseIndex) => (
        <div
          key={exercise.id}
          style={{
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            display: "grid",
            gap: 10,
            padding: 12,
          }}
        >
          <div>
            <FitText
              excludeGlobalScale
              style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 800 }}
            >
              {exerciseIndex + 1}. {exercise.exerciseName}
            </FitText>
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 11.5 }}>
              {exercise.sets} sets × {exercise.reps ?? "timed"} reps · {exercise.restSeconds}s rest
            </FitText>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Array.from({ length: exercise.sets }, (_, setIndex) => {
              const setNumber = setIndex + 1;
              const isDone = completed.has(`${exercise.id}:${setNumber}`);
              return (
                <FitButton
                  key={setNumber}
                  disabled={isDone || isLogging || !session}
                  icon={isDone ? Check : undefined}
                  label={isDone ? `Set ${setNumber} Done` : `Complete Set ${setNumber}`}
                  onClick={async () => {
                    await onLogSet({
                      exerciseId: exercise.exerciseId,
                      repsCompleted: exercise.reps ?? undefined,
                      setNumber,
                      weightKg: exercise.weightKgTarget ?? undefined,
                    });
                    setRestRemaining(exercise.restSeconds);
                  }}
                  variant={isDone ? "ghost" : "primary"}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
