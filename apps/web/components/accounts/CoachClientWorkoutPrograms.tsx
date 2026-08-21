"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateTrainingPlanInput,
  FitnessExerciseRecord,
  FitnessGoal,
  TrainingPlanDetailRecord,
} from "@fittrack/types";
import { isWorkoutRestDay } from "@fittrack/app-core";
import {
  assignFitnessPlanMutationOptions,
  activateFitnessPlanMutationOptions,
  createFitnessPlanMutationOptions,
  deleteFitnessPlanMutationOptions,
  fitnessClientPlansQueryOptions,
  fitnessExercisesQueryOptions,
  fitnessPlanDetailQueryOptions,
  updateFitnessPlanMutationOptions,
} from "@fittrack/query";

import { FitButton, FitSelect, FitText } from "@/components/fit";
import FitModal from "@/components/modals/FitModal";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";

import {
  getRemainingPaidWorkoutWeeks,
  materializeRepeatedWorkoutWeeks,
  MAX_WORKOUT_RECURRENCE_WEEKS,
  findEmptyWorkoutDay,
  countConfiguredWorkoutDaysPerWeek,
  setWorkoutDayExercises,
  setWorkoutDayKind,
  type WorkoutDraftDay,
  type WorkoutDraftExercise,
  type WorkoutDraftWeeks,
} from "./workoutRecurrence";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MAX_PLAN_WEEKS = MAX_WORKOUT_RECURRENCE_WEEKS;
const GOAL_OPTIONS: Array<{ label: string; value: FitnessGoal }> = [
  { label: "Bulking", value: "bulking" },
  { label: "Cutting", value: "cutting" },
  { label: "Maintenance", value: "maintenance" },
  { label: "Sport-specific", value: "sport_specific" },
];

const GOAL_LABELS: Record<FitnessGoal, string> = {
  bulking: "Bulking",
  cutting: "Cutting",
  maintenance: "Maintenance",
  sport_specific: "Sport-specific",
};

type ProgramConfirmation =
  | {
      kind: "create" | "update";
      title: string;
      goal: FitnessGoal;
      weeks: number;
      workoutDays: number;
      restDays: number;
    }
  | { kind: "delete"; planId: string; title: string }
  | { kind: "activate"; planId: string; title: string }
  | null;

type DraftExercise = WorkoutDraftExercise;
type DraftDay = WorkoutDraftDay;
type DraftWeeks = WorkoutDraftWeeks;
type WorkoutRecurrenceMode = "remaining_paid_period" | "this_week";

function createEmptyDay(): DraftDay {
  return {
    exercises: [],
    focusLabel: "Rest",
    isRestDay: true,
  };
}

function createInitialDraftWeeks(): DraftWeeks {
  const dayOfWeek = new Date().getDay();
  return { 1: { [dayOfWeek]: createEmptyDay() } };
}

function detailToDraftWeeks(plan: TrainingPlanDetailRecord): DraftWeeks {
  const weeks: DraftWeeks = {};

  for (const day of plan.scheduleDays) {
    const week = day.weekNumber || 1;
    weeks[week] ??= {};
    const exercises = day.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      reps: exercise.reps ?? 10,
      restSeconds: exercise.restSeconds,
      sets: exercise.sets,
    }));
    weeks[week][day.dayOfWeek] = {
      exercises,
      focusLabel: day.focusLabel ?? `${DAY_NAMES[day.dayOfWeek]} training`,
      isRestDay:
        exercises.length === 0
          ? day.isRestDay !== false && isWorkoutRestDay(day)
          : false,
    };
  }

  return Object.keys(weeks).length > 0 ? weeks : createInitialDraftWeeks();
}

function toPlanInput(
  title: string,
  durationWeeks: number,
  draftWeeks: DraftWeeks,
  goal: FitnessGoal,
): CreateTrainingPlanInput {
  const schedule = Object.entries(draftWeeks)
    .flatMap(([weekNumber, days]) =>
      Object.entries(days).map(([dayOfWeek, day]) => ({
        dayOfWeek: Number(dayOfWeek),
        exercises: day.exercises.map((exercise, orderIndex) => ({
          exerciseId: exercise.exerciseId,
          orderIndex,
          reps: exercise.reps,
          restSeconds: exercise.restSeconds,
          sets: exercise.sets,
        })),
        focusLabel:
          day.focusLabel.trim() || `${DAY_NAMES[Number(dayOfWeek)]} training`,
        isRestDay: day.isRestDay,
        weekNumber: Number(weekNumber),
      })),
    )
    .sort(
      (left, right) =>
        left.weekNumber - right.weekNumber || left.dayOfWeek - right.dayOfWeek,
    );

  return {
    daysPerWeek: countConfiguredWorkoutDaysPerWeek(draftWeeks),
    durationWeeks: Math.max(1, Math.min(MAX_PLAN_WEEKS, durationWeeks)),
    goal,
    schedule,
    title: title.trim(),
  };
}

function numberValue(value: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function useSingleSubmitGuard() {
  const inFlightRef = useRef(false);

  return {
    release() {
      inFlightRef.current = false;
    },
    tryAcquire() {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      return true;
    },
  };
}

function fieldStyle(colors: ReturnType<typeof useTheme>["colors"]): CSSProperties {
  return {
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    boxSizing: "border-box",
    color: colors.textPrimary,
    minHeight: 38,
    padding: "8px 10px",
    width: "100%",
  };
}

export function CoachClientWorkoutPrograms({
  coachUserId,
  memberId,
  canManage,
  paidPeriodEndDate,
}: {
  coachUserId: string;
  memberId: string;
  canManage: boolean;
  paidPeriodEndDate?: string | null;
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const submitGuard = useSingleSubmitGuard();
  const hydratedPlanIdRef = useRef<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [title, setTitle] = useState("Client weekly split");
  const [goal, setGoal] = useState<FitnessGoal>("maintenance");
  const [durationWeeks, setDurationWeeks] = useState(1);
  const [recurrenceMode, setRecurrenceMode] =
    useState<WorkoutRecurrenceMode>("this_week");
  const [draftWeeks, setDraftWeeks] = useState<DraftWeeks>(createInitialDraftWeeks);
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeDay, setActiveDay] = useState(new Date().getDay());
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [editorError, setEditorError] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<ProgramConfirmation>(null);

  const plansQuery = useQuery({
    ...fitnessClientPlansQueryOptions(
      webApiClient,
      coachUserId,
      memberId,
      { limit: 50, page: 1 },
    ),
    enabled: Boolean(coachUserId && memberId),
    staleTime: 30_000,
  });
  const exercisesQuery = useQuery({
    ...fitnessExercisesQueryOptions(webApiClient, { limit: 100, page: 1 }),
    enabled: Boolean(coachUserId),
    staleTime: 60_000,
  });
  const detailQuery = useQuery({
    ...fitnessPlanDetailQueryOptions(webApiClient, selectedPlanId ?? undefined),
    enabled: editorOpen && Boolean(selectedPlanId),
  });
  const activateMutation = useMutation(
    activateFitnessPlanMutationOptions(webApiClient, queryClient),
  );
  const createMutation = useMutation(
    createFitnessPlanMutationOptions(webApiClient, queryClient),
  );
  const updateMutation = useMutation(
    updateFitnessPlanMutationOptions(webApiClient, queryClient),
  );
  const assignMutation = useMutation(
    assignFitnessPlanMutationOptions(webApiClient, queryClient),
  );
  const deleteMutation = useMutation(
    deleteFitnessPlanMutationOptions(webApiClient, queryClient),
  );

  const clientPrograms = useMemo(
    () =>
      (plansQuery.data?.data ?? [])
        .filter(
          (plan) =>
            plan.coachId === coachUserId &&
            plan.userId === memberId &&
            plan.isTemplate === false &&
            plan.source === "coach_assigned",
        )
        .sort(
          (left, right) =>
            Number(right.isActive) - Number(left.isActive) ||
            right.updatedAt.localeCompare(left.updatedAt),
        ),
    [coachUserId, memberId, plansQuery.data?.data],
  );
  const exercises = useMemo(
    () => exercisesQuery.data?.data ?? [],
    [exercisesQuery.data?.data],
  );
  const weekNumbers = useMemo(
    () => Array.from({ length: durationWeeks }, (_, index) => index + 1),
    [durationWeeks],
  );
  const activeDays = draftWeeks[activeWeek] ?? {};
  const activeDraftDay = activeDays[activeDay];
  const draftSummary = useMemo(() => {
    const days = Object.values(draftWeeks).flatMap((week) => Object.values(week));
    return {
      restDays: days.filter((day) => day.isRestDay).length,
      workoutDays: days.filter(
        (day) => !day.isRestDay && day.exercises.length > 0,
      ).length,
    };
  }, [draftWeeks]);
  const visibleExercises = useMemo(() => {
    const search = exerciseSearch.trim().toLowerCase();
    return [...exercises]
      .sort((left, right) => left.name.localeCompare(right.name))
      .filter((exercise) => {
        if (!search) return true;
        return `${exercise.name} ${exercise.muscleGroup ?? ""}`
          .toLowerCase()
          .includes(search);
      })
      .slice(0, 18);
  }, [exerciseSearch, exercises]);
  const isSaving =
    activateMutation.isPending ||
    createMutation.isPending ||
    updateMutation.isPending ||
    assignMutation.isPending ||
    deleteMutation.isPending;
  const paidPeriodWeekCount = getRemainingPaidWorkoutWeeks(paidPeriodEndDate);
  const canRepeatThroughPaidPeriod = Boolean(paidPeriodEndDate);

  useEffect(() => {
    if (!selectedPlanId || !detailQuery.data || hydratedPlanIdRef.current === selectedPlanId) {
      return;
    }

    const nextWeeks = detailToDraftWeeks(detailQuery.data);
    const availableWeeks = Object.keys(nextWeeks).map(Number);
    const firstWeek = Math.min(...availableWeeks);
    const firstDay = Math.min(...Object.keys(nextWeeks[firstWeek] ?? {}).map(Number));
    setTitle(detailQuery.data.title);
    setGoal(detailQuery.data.goal);
    setDurationWeeks(Math.max(1, Math.min(MAX_PLAN_WEEKS, detailQuery.data.durationWeeks)));
    setRecurrenceMode(
      canRepeatThroughPaidPeriod && detailQuery.data.durationWeeks > 1
        ? "remaining_paid_period"
        : "this_week",
    );
    setDraftWeeks(nextWeeks);
    setActiveWeek(firstWeek);
    setActiveDay(Number.isFinite(firstDay) ? firstDay : new Date().getDay());
    setExerciseSearch("");
    setEditorError("");
    hydratedPlanIdRef.current = selectedPlanId;
  }, [canRepeatThroughPaidPeriod, detailQuery.data, selectedPlanId]);

  const resetEditor = () => {
    hydratedPlanIdRef.current = null;
    setEditorOpen(false);
    setSelectedPlanId(null);
    setGoal("maintenance");
    setDraftWeeks(createInitialDraftWeeks());
    setDurationWeeks(1);
    setRecurrenceMode("this_week");
    setActiveWeek(1);
    setActiveDay(new Date().getDay());
    setExerciseSearch("");
    setEditorError("");
    setConfirmation(null);
  };

  const openNew = () => {
    if (!canManage) return;
    hydratedPlanIdRef.current = null;
    setSelectedPlanId(null);
    setTitle("Client weekly split");
    setGoal("maintenance");
    setDurationWeeks(1);
    setRecurrenceMode("this_week");
    setDraftWeeks(createInitialDraftWeeks());
    setActiveWeek(1);
    setActiveDay(new Date().getDay());
    setExerciseSearch("");
    setEditorError("");
    setActionError("");
    setMessage("");
    setEditorOpen(true);
  };

  const openExisting = (planId: string) => {
    if (!canManage) return;
    hydratedPlanIdRef.current = null;
    setSelectedPlanId(planId);
    setGoal("maintenance");
    setEditorError("");
    setActionError("");
    setMessage("");
    setEditorOpen(true);
  };

  const toggleDay = (dayOfWeek: number) => {
    setEditorError("");
    setDraftWeeks((current) => {
      const days = current[activeWeek] ?? {};
      if (days[dayOfWeek]) {
        const nextDays = { ...days };
        delete nextDays[dayOfWeek];
        const remaining = Object.keys(nextDays).map(Number);
        if (activeDay === dayOfWeek && remaining.length > 0) {
          setActiveDay(remaining[0]);
        }
        return { ...current, [activeWeek]: nextDays };
      }

      setActiveDay(dayOfWeek);
      return {
        ...current,
        [activeWeek]: { ...days, [dayOfWeek]: createEmptyDay() },
      };
    });
  };

  const setActiveWeekAndDay = (week: number) => {
    setActiveWeek(week);
    const firstDay = Object.keys(draftWeeks[week] ?? {})[0];
    setActiveDay(firstDay === undefined ? new Date().getDay() : Number(firstDay));
  };

  const setWorkoutRecurrence = (nextMode: WorkoutRecurrenceMode) => {
    setEditorError("");
    const sourceWeek = draftWeeks[activeWeek] ?? draftWeeks[1] ?? {};
    const nextWeekCount =
      nextMode === "remaining_paid_period" && canRepeatThroughPaidPeriod
        ? paidPeriodWeekCount
        : 1;
    const nextWeeks = materializeRepeatedWorkoutWeeks(sourceWeek, nextWeekCount);
    const firstDay = Math.min(...Object.keys(nextWeeks[1] ?? {}).map(Number));

    setRecurrenceMode(nextMode);
    setDurationWeeks(nextWeekCount);
    setDraftWeeks(nextWeeks);
    setActiveWeek(1);
    setActiveDay(Number.isFinite(firstDay) ? firstDay : new Date().getDay());
  };

  const addExercise = (exercise: FitnessExerciseRecord) => {
    if (!activeDraftDay) return;
    setEditorError("");
    setDraftWeeks((current) => {
      const days = current[activeWeek] ?? {};
      const day = days[activeDay];
      if (!day || day.exercises.some((item) => item.exerciseId === exercise.id)) {
        return current;
      }

      return {
        ...current,
        [activeWeek]: {
          ...days,
          [activeDay]: setWorkoutDayExercises(day, [
            ...day.exercises,
            {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              reps: 10,
              restSeconds: 75,
              sets: 3,
            },
          ]),
        },
      };
    });
  };

  const patchExercise = (
    exerciseId: string,
    patch: Partial<Pick<DraftExercise, "reps" | "restSeconds" | "sets">>,
  ) => {
    setEditorError("");
    setDraftWeeks((current) => {
      const days = current[activeWeek] ?? {};
      const day = days[activeDay];
      if (!day) return current;

      return {
        ...current,
        [activeWeek]: {
          ...days,
          [activeDay]: {
            ...day,
            exercises: day.exercises.map((exercise) =>
              exercise.exerciseId === exerciseId
                ? { ...exercise, ...patch }
                : exercise,
            ),
          },
        },
      };
    });
  };

  const removeExercise = (exerciseId: string) => {
    setEditorError("");
    setDraftWeeks((current) => {
      const days = current[activeWeek] ?? {};
      const day = days[activeDay];
      if (!day) return current;
      return {
        ...current,
        [activeWeek]: {
          ...days,
          [activeDay]: setWorkoutDayExercises(
            day,
            day.exercises.filter(
              (exercise) => exercise.exerciseId !== exerciseId,
            ),
          ),
        },
      };
    });
  };

  const setActiveDayKind = (kind: "workout" | "rest") => {
    setEditorError("");
    setDraftWeeks((current) => {
      const days = current[activeWeek] ?? {};
      const day = days[activeDay];
      if (!day) return current;

      return {
        ...current,
        [activeWeek]: {
          ...days,
          [activeDay]: setWorkoutDayKind(
            day,
            kind,
            `${DAY_NAMES[activeDay]} training`,
          ),
        },
      };
    });
  };

  const validateProgramDraft = () => {
    setEditorError("");
    const input = toPlanInput(title, durationWeeks, draftWeeks, goal);

    if (!input.title) {
      setEditorError("Give this program a clear name.");
      return null;
    }
    if (input.schedule.length === 0) {
      setEditorError("Select at least one training day.");
      return null;
    }
    const emptyDay = findEmptyWorkoutDay(draftWeeks);
    if (emptyDay) {
      setActiveWeek(emptyDay.weekNumber);
      setActiveDay(emptyDay.dayOfWeek);
      setEditorError(
        `Add at least one exercise to week ${emptyDay.weekNumber} ${DAY_NAMES[emptyDay.dayOfWeek]}.`,
      );
      return null;
    }
    return input;
  };

  const requestSaveProgram = () => {
    const input = validateProgramDraft();
    if (!input) return;
    setConfirmation({
      kind: selectedPlanId ? "update" : "create",
      goal: input.goal,
      restDays: draftSummary.restDays,
      title: input.title,
      weeks: durationWeeks,
      workoutDays: draftSummary.workoutDays,
    });
  };

  const saveProgram = async () => {
    if (!canManage || !submitGuard.tryAcquire()) return;
    const input = validateProgramDraft();
    if (!input) {
      submitGuard.release();
      return;
    }

    try {

      if (selectedPlanId) {
        await updateMutation.mutateAsync({
          input,
          planId: selectedPlanId,
          userId: coachUserId,
        });
      } else {
        const created = await createMutation.mutateAsync({
          input,
          userId: coachUserId,
        });
        const assigned = await assignMutation.mutateAsync({
          memberId,
          planId: created.id,
          userId: coachUserId,
        });
        if (!assigned?.id) {
          throw new Error("The client program assignment did not complete.");
        }
      }

      await plansQuery.refetch();
      setMessage(selectedPlanId ? "Client program updated." : "Client program saved and assigned.");
      setConfirmation(null);
      resetEditor();
    } catch (error) {
      setEditorError(
        error instanceof Error
          ? error.message
          : "Unable to save this client program. Your draft is still here; try again.",
      );
    } finally {
      submitGuard.release();
    }
  };

  const deleteProgram = async (planId: string) => {
    if (!canManage || !submitGuard.tryAcquire()) return;
    setActionError("");
    try {
      await deleteMutation.mutateAsync({ planId, userId: coachUserId });
      await plansQuery.refetch();
      setConfirmation(null);
      setMessage("Client program deleted.");
    } catch (error) {
      setConfirmation(null);
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to delete this client program.",
      );
    } finally {
      submitGuard.release();
    }
  };

  const activateProgram = async (planId: string) => {
    if (!canManage || !submitGuard.tryAcquire()) return;
    setActionError("");
    try {
      await activateMutation.mutateAsync({ planId, userId: coachUserId });
      await plansQuery.refetch();
      setConfirmation(null);
      setMessage("Client program activated.");
    } catch (error) {
      setConfirmation(null);
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to activate this client program.",
      );
    } finally {
      submitGuard.release();
    }
  };

  const input = fieldStyle(colors);
  const isLoading = plansQuery.isLoading || exercisesQuery.isLoading;

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      {!editorOpen ? (
        <>
      <div style={{ display: "grid", gap: 4 }}>
        <FitText
          excludeGlobalScale
          style={{ color: colors.brand, fontSize: 11, fontWeight: 850, letterSpacing: "0.04em", textTransform: "uppercase" }}
        >
          Client workout programs
        </FitText>
        <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 1.45 }}>
          Members choose which personal or coach-assigned plan to activate. Plan changes never move paid coaching appointments.
        </FitText>
      </div>

      {isLoading ? (
        <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 11 }}>
          Loading client programs...
        </FitText>
      ) : clientPrograms.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {clientPrograms.map((plan) => (
            <div
              key={plan.id}
              style={{
                alignItems: "center",
                backgroundColor: colors.surfaceRaised,
                border: `1px solid ${plan.isActive ? colors.brand : colors.border}`,
                borderRadius: 8,
                display: "flex",
                gap: 10,
                justifyContent: "space-between",
                minWidth: 0,
                padding: "10px 11px",
              }}
            >
              <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {plan.title}
                </FitText>
                <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5 }}>
                  {GOAL_LABELS[plan.goal]} - {plan.daysPerWeek} day split - {plan.durationWeeks} weeks - {plan.isActive ? "Active" : "Inactive"}
                </FitText>
              </div>
              {canManage ? (
                <div style={{ display: "flex", flexShrink: 0, gap: 5 }}>
                  {!plan.isActive ? (
                    <FitButton
                      label="SET ACTIVE"
                      onClick={() => {
                        setActionError("");
                        setMessage("");
                        setConfirmation({ kind: "activate", planId: plan.id, title: plan.title });
                      }}
                      style={{ minHeight: 32, paddingInline: 8 }}
                      textStyle={{ fontSize: 9, fontWeight: 850 }}
                      variant="chip"
                    />
                  ) : null}
                  <FitButton
                    aria-label={`Edit ${plan.title}`}
                    icon={Pencil}
                    iconOnly
                    label={`Edit ${plan.title}`}
                    onClick={() => openExisting(plan.id)}
                    style={{ borderRadius: 7, minHeight: 32, minWidth: 32, padding: 6 }}
                    variant="ghost"
                  />
                  <FitButton
                    aria-label={`Delete ${plan.title}`}
                    icon={Trash2}
                    iconOnly
                    label={`Delete ${plan.title}`}
                    onClick={() => {
                      if (plan.isActive) {
                        setMessage("");
                        setActionError("Set another client program active before deleting this one.");
                        return;
                      }
                      setActionError("");
                      setMessage("");
                      setConfirmation({ kind: "delete", planId: plan.id, title: plan.title });
                    }}
                    style={{ borderRadius: 7, color: colors.danger, minHeight: 32, minWidth: 32, padding: 6 }}
                    variant="ghost"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ backgroundColor: colors.surfaceRaised, border: `1px dashed ${colors.border}`, borderRadius: 8, display: "grid", gap: 4, padding: 12 }}>
          <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 11.5, fontWeight: 800 }}>
            No client-specific programs yet.
          </FitText>
          <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5, lineHeight: 1.4 }}>
            Build the first program after this member has an active paid coaching relationship.
          </FitText>
        </div>
      )}

      {canManage ? (
        <FitButton
          icon={Plus}
          label="CREATE PROGRAM"
          onClick={openNew}
          style={{ justifySelf: "start", minHeight: 38, paddingInline: 12 }}
          textStyle={{ fontSize: 10.5, fontWeight: 850 }}
          variant="ghost"
        />
      ) : (
        <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5, lineHeight: 1.4 }}>
          Program editing and assignment unlock after an active paid monthly or one-session relationship.
        </FitText>
      )}
      {message ? (
        <FitText aria-live="polite" excludeGlobalScale style={{ color: colors.success, fontSize: 11, fontWeight: 750 }}>
          {message}
        </FitText>
      ) : null}
      {actionError ? (
        <FitText aria-live="polite" excludeGlobalScale style={{ color: colors.danger, fontSize: 11, fontWeight: 750 }}>
          {actionError}
        </FitText>
      ) : null}
        </>
      ) : null}

      {editorOpen ? (
      <section style={{ display: "grid", gap: 14, minWidth: 0 }}>
        <div style={{ alignItems: "center", borderBottom: `1px solid ${colors.border}`, display: "flex", gap: 10, justifyContent: "space-between", paddingBottom: 12 }}>
          <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 850 }}>
              {selectedPlanId ? "Edit client program" : "Create client program"}
            </FitText>
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5, lineHeight: 1.4 }}>
              Build one week or repeat it through the remaining paid period.
            </FitText>
          </div>
          <FitButton disabled={isSaving} label="BACK" onClick={resetEditor} style={{ minHeight: 34 }} variant="ghost" />
        </div>
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          {detailQuery.isLoading && selectedPlanId ? (
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 11 }}>
              Loading program...
            </FitText>
          ) : null}
          <label style={{ display: "grid", gap: 5 }}>
            <FitText as="span" excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em" }}>
              PROGRAM NAME
            </FitText>
            <input
              aria-label="Client workout program name"
              onChange={(event) => { setTitle(event.target.value); setEditorError(""); }}
              placeholder="Strength foundation"
              style={input}
              value={title}
            />
          </label>

          <label style={{ display: "grid", gap: 5 }}>
            <FitText as="span" excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em" }}>
              PROGRAM GOAL
            </FitText>
            <FitSelect
              aria-label="Program goal"
              compact
              fullWidth
              onChange={(event) => {
                setGoal(event.target.value as FitnessGoal);
                setEditorError("");
              }}
              options={GOAL_OPTIONS}
              value={goal}
            />
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 5 }}>
              <FitText as="span" excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em" }}>
                WORKOUT RECURRENCE
              </FitText>
              <FitSelect
                aria-label="Workout recurrence"
                compact
                fullWidth
                onChange={(event) =>
                  setWorkoutRecurrence(event.target.value as WorkoutRecurrenceMode)
                }
                options={
                  canRepeatThroughPaidPeriod
                    ? [
                        { label: "This week only", value: "this_week" },
                        {
                          label: `Repeat weekly through paid period (${paidPeriodWeekCount} weeks)`,
                          value: "remaining_paid_period",
                        },
                      ]
                    : [{ label: "This week/session", value: "this_week" }]
                }
                value={recurrenceMode}
              />
            </label>
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10, lineHeight: 1.4 }}>
              Repeat copies the selected week through the paid period. Each generated week remains independently editable. This creates workout assignments only, not appointments or payments.
            </FitText>
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em" }}>
              WEEKS
            </FitText>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {weekNumbers.map((week) => {
                const days = Object.values(draftWeeks[week] ?? {});
                const workoutCount = days.filter(
                  (day) => !day.isRestDay && day.exercises.length > 0,
                ).length;
                const restCount = days.filter((day) => day.isRestDay).length;
                const incompleteCount = days.filter(
                  (day) => !day.isRestDay && day.exercises.length === 0,
                ).length;
                const tone = incompleteCount > 0
                  ? colors.warning
                  : workoutCount > 0
                    ? colors.success
                    : colors.border;
                const suffix = workoutCount > 0
                  ? ` (${workoutCount})`
                  : restCount > 0
                    ? " (REST)"
                    : incompleteCount > 0
                      ? " (!)"
                      : "";
                return (
                  <FitButton
                    active={activeWeek === week && workoutCount > 0}
                    aria-label={`Week ${week}: ${workoutCount} configured workouts, ${restCount} rest days, ${incompleteCount} incomplete days`}
                    key={week}
                    label={`WEEK ${week}${suffix}`}
                    onClick={() => setActiveWeekAndDay(week)}
                    style={{
                      backgroundColor: `color-mix(in srgb, ${tone} 10%, transparent)`,
                      borderColor: activeWeek === week
                        ? workoutCount > 0
                          ? colors.brand
                          : colors.textSecondary
                        : tone,
                      boxShadow: activeWeek === week
                        ? `0 0 0 1px ${workoutCount > 0 ? colors.brand : colors.textSecondary}66`
                        : undefined,
                      minHeight: 32,
                      minWidth: 64,
                      padding: "6px 9px",
                    }}
                    textStyle={{ fontSize: 9.5, fontWeight: 850 }}
                    variant="chip"
                  />
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em" }}>
              WEEK {activeWeek} TRAINING DAYS
            </FitText>
            <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
              {DAY_NAMES.map((day, dayOfWeek) => {
                const selected = Boolean(activeDays[dayOfWeek]);
                const active = activeDay === dayOfWeek;
                const draftDay = activeDays[dayOfWeek];
                const state = !draftDay
                  ? "empty"
                  : draftDay.isRestDay
                    ? "rest"
                    : draftDay.exercises.length > 0
                      ? "workout"
                      : "incomplete";
                const tone = state === "workout"
                  ? colors.success
                  : state === "incomplete"
                    ? colors.warning
                    : state === "rest"
                      ? colors.textSecondary
                      : colors.border;
                const suffix = state === "workout"
                  ? ` ${draftDay?.exercises.length ?? 0}`
                  : state === "rest"
                    ? " R"
                    : state === "incomplete"
                      ? " !"
                      : "";
                return (
                  <FitButton
                    active={active && state === "workout"}
                    aria-label={`Week ${activeWeek} ${day}: ${state}`}
                    key={day}
                    label={`${day}${suffix}`}
                    onClick={() => (selected ? setActiveDay(dayOfWeek) : toggleDay(dayOfWeek))}
                    style={{
                      backgroundColor: `color-mix(in srgb, ${tone} 10%, transparent)`,
                      borderColor: active
                        ? state === "workout"
                          ? colors.brand
                          : colors.textSecondary
                        : tone,
                      boxShadow: active
                        ? `0 0 0 1px ${state === "workout" ? colors.brand : colors.textSecondary}66`
                        : undefined,
                      minHeight: 34,
                      minWidth: 0,
                      padding: "6px 3px",
                    }}
                    textStyle={{ fontSize: 9, fontWeight: 850 }}
                    variant="chip"
                  />
                );
              })}
            </div>
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10 }}>
              Select a day to edit it. Add a day by selecting an unselected weekday.
            </FitText>
            <div aria-label="Workout schedule legend" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {[
                { color: colors.success, label: "Workout configured" },
                { color: colors.textSecondary, label: "Rest day" },
                { color: colors.warning, label: "Needs exercises" },
              ].map((item) => (
                <span key={item.label} style={{ alignItems: "center", color: colors.textMuted, display: "inline-flex", fontSize: 9.5, gap: 5 }}>
                  <span aria-hidden style={{ backgroundColor: item.color, borderRadius: 999, height: 7, width: 7 }} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {activeDraftDay ? (
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 5 }}>
                <FitText as="span" excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em" }}>
                  DAY TYPE
                </FitText>
                <FitSelect
                  aria-label={`Week ${activeWeek} ${DAY_NAMES[activeDay]} day type`}
                  compact
                  fullWidth
                  onChange={(event) => setActiveDayKind(event.target.value as "workout" | "rest")}
                  options={[
                    { label: "Workout day", value: "workout" },
                    { label: "Rest / recovery day", value: "rest" },
                  ]}
                  value={activeDraftDay.isRestDay ? "rest" : "workout"}
                />
              </label>
              <label style={{ display: "grid", gap: 5 }}>
                <FitText as="span" excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em" }}>
                  {activeDraftDay.isRestDay ? "DAY LABEL" : "WORKOUT LABEL"}
                </FitText>
                <input
                  aria-label={`Week ${activeWeek} ${DAY_NAMES[activeDay]} day label`}
                  onChange={(event) => setDraftWeeks((current) => ({
                    ...current,
                    [activeWeek]: {
                      ...(current[activeWeek] ?? {}),
                      [activeDay]: { ...activeDraftDay, focusLabel: event.target.value },
                    },
                  }))}
                  placeholder="Lower body strength"
                  style={input}
                  value={activeDraftDay.focusLabel}
                />
              </label>

              {activeDraftDay.isRestDay ? (
                <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5, lineHeight: 1.4 }}>
                  This day is kept as recovery. No exercise is required; switching it back to Workout day restores normal exercise validation.
                </FitText>
              ) : (
                <>
              {activeDraftDay.exercises.map((exercise) => (
                <div key={exercise.exerciseId} style={{ backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 8, display: "grid", gap: 9, minWidth: 0, padding: 11 }}>
                  <div style={{ alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between", minWidth: 0 }}>
                    <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 11.5, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {exercise.exerciseName}
                    </FitText>
                    <FitButton
                      aria-label={`Remove ${exercise.exerciseName}`}
                      icon={Trash2}
                      iconOnly
                      label={`Remove ${exercise.exerciseName}`}
                      onClick={() => removeExercise(exercise.exerciseId)}
                      style={{ borderRadius: 6, minHeight: 28, minWidth: 28, padding: 5 }}
                      variant="ghost"
                    />
                  </div>
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                    {[
                      { key: "sets" as const, label: "SETS", max: 20, min: 1, value: exercise.sets },
                      { key: "reps" as const, label: "REPS", max: 100, min: 1, value: exercise.reps },
                      { key: "restSeconds" as const, label: "REST (SEC)", max: 900, min: 0, value: exercise.restSeconds },
                    ].map((control) => (
                      <label key={control.key} style={{ display: "grid", gap: 4 }}>
                        <FitText as="span" excludeGlobalScale style={{ color: colors.textMuted, fontSize: 9, fontWeight: 850 }}>
                          {control.label}
                        </FitText>
                        <input
                          aria-label={`${exercise.exerciseName} ${control.label.toLowerCase()}`}
                          min={control.min}
                          max={control.max}
                          onChange={(event) => patchExercise(exercise.exerciseId, {
                            [control.key]: numberValue(event.target.value, control.value, control.min, control.max),
                          })}
                          style={{ ...input, minHeight: 34, padding: "6px 8px" }}
                          type="number"
                          value={control.value}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ display: "grid", gap: 7 }}>
                <label style={{ display: "grid", gap: 5 }}>
                  <FitText as="span" excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em" }}>
                    EXERCISE CATALOG
                  </FitText>
                  <input
                    aria-label="Search exercise catalog"
                    onChange={(event) => setExerciseSearch(event.target.value)}
                    placeholder="Search exercises"
                    style={{ ...input, minHeight: 34 }}
                    value={exerciseSearch}
                  />
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {visibleExercises.map((exercise) => {
                    const selected = activeDraftDay.exercises.some((item) => item.exerciseId === exercise.id);
                    return (
                      <FitButton
                        disabled={selected}
                        key={exercise.id}
                        label={selected ? `Added - ${exercise.name}` : `ADD ${exercise.name}`}
                        onClick={() => addExercise(exercise)}
                        style={{ borderRadius: 7, minHeight: 30, maxWidth: "100%", padding: "5px 8px" }}
                        textStyle={{ fontSize: 9.5, fontWeight: 750 }}
                        variant="chip"
                      />
                    );
                  })}
                </div>
                {!exercisesQuery.isLoading && visibleExercises.length === 0 ? (
                  <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5 }}>
                    No exercises match this search.
                  </FitText>
                ) : null}
              </div>
                </>
              )}
            </div>
          ) : (
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 11 }}>
              Select a training day to add its workout.
            </FitText>
          )}

          {editorError ? (
            <FitText aria-live="polite" excludeGlobalScale style={{ color: colors.danger, fontSize: 11, fontWeight: 750, lineHeight: 1.4 }}>
              {editorError}
            </FitText>
          ) : null}
        </div>
        <div style={{ borderTop: `1px solid ${colors.border}`, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", paddingTop: 12 }}>
          <FitButton disabled={isSaving} label="BACK" onClick={resetEditor} variant="ghost" />
          <FitButton
            disabled={isSaving || Boolean(selectedPlanId && !detailQuery.data)}
            label={selectedPlanId ? "REVIEW UPDATE" : "REVIEW CREATE"}
            loading={isSaving}
            loadingLabel="SAVING PROGRAM"
            onClick={requestSaveProgram}
            style={{ minWidth: 138 }}
            variant="primary"
          />
        </div>
      </section>
      ) : null}

      <FitModal
        footer={
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
            <FitButton disabled={isSaving} label="CANCEL" onClick={() => setConfirmation(null)} variant="ghost" />
            <FitButton
              disabled={isSaving}
              label={
                confirmation?.kind === "activate"
                  ? "SET ACTIVE"
                  : confirmation?.kind === "delete"
                    ? "DELETE PROGRAM"
                    : confirmation?.kind === "update"
                      ? "CONFIRM UPDATE"
                      : "CONFIRM CREATE"
              }
              loading={isSaving}
              loadingLabel={
                confirmation?.kind === "activate"
                  ? "ACTIVATING..."
                  : confirmation?.kind === "delete"
                    ? "DELETING..."
                    : "SAVING..."
              }
              onClick={() => {
                if (!confirmation) return;
                if (confirmation.kind === "delete") {
                  void deleteProgram(confirmation.planId);
                  return;
                }
                if (confirmation.kind === "activate") {
                  void activateProgram(confirmation.planId);
                  return;
                }
                void saveProgram();
              }}
              variant={confirmation?.kind === "delete" ? "danger" : "primary"}
            />
          </div>
        }
        iconNode={confirmation?.kind === "delete" ? <Trash2 size={16} /> : <Pencil size={16} />}
        isOpen={Boolean(confirmation)}
        maxWidth={500}
        onClose={() => { if (!isSaving) setConfirmation(null); }}
        subtitle={
          confirmation?.kind === "activate"
            ? "The current active client program will become inactive."
            : confirmation?.kind === "delete"
              ? "This removes the client-specific program only."
              : "Review the workout structure before it is assigned."
        }
        title={
          confirmation?.kind === "activate"
            ? "Set active client program?"
            : confirmation?.kind === "delete"
              ? "Delete client program?"
              : confirmation?.kind === "update"
                ? "Update client program?"
                : "Create client program?"
        }
      >
        {confirmation ? (
          <div style={{ display: "grid", gap: 9 }}>
            <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 850 }}>
              {confirmation.title}
            </FitText>
            {confirmation.kind === "activate" ? (
              <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 1.45 }}>
                Set <strong>{confirmation.title}</strong> as the client&apos;s active program. Their current active plan will become inactive.
              </FitText>
            ) : confirmation.kind === "delete" ? (
              <FitText excludeGlobalScale style={{ color: colors.danger, fontSize: 11, lineHeight: 1.45 }}>
                This cannot be undone. Paid coaching sessions and appointments are not deleted.
              </FitText>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 11 }}>
                  Goal: <strong>{GOAL_LABELS[confirmation.goal]}</strong>
                </FitText>
                <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                  {[
                    { label: "WEEKS", value: confirmation.weeks },
                    { label: "WORKOUT DAYS", value: confirmation.workoutDays },
                    { label: "REST DAYS", value: confirmation.restDays },
                  ].map((item) => (
                    <div key={item.label} style={{ backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 8, display: "grid", gap: 3, padding: 10 }}>
                      <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 9, fontWeight: 850 }}>{item.label}</FitText>
                      <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 900 }}>{item.value}</FitText>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </FitModal>
    </div>
  );
}
