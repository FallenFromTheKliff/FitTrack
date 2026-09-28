import { useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Minus, Plus, Trash2 } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isWorkoutRestDay } from "@fittrack/app-core";
import type { FitnessGoal, TrainingPlanDetailRecord } from "@fittrack/types";
import {
  assignFitnessPlanMutationOptions,
  createFitnessPlanMutationOptions,
  fitnessClientPlansQueryOptions,
  fitnessExercisesQueryOptions,
  fitnessPlanDetailQueryOptions,
  updateFitnessPlanMutationOptions,
} from "@fittrack/query";

import { FitButton, FitText } from "@/components/fit";
import { ConfirmModal } from "@/components/modals";
import ExerciseRestTimerModal from "@/components/workout/ExerciseRestTimerModal";
import { DAY_NAMES, type DraftExercise } from "@/components/workout/workoutPlanDraft";
import {
  canCreateClientWorkoutProgram,
  isEligibleOneTimeCoachAppointment,
  createCoachWorkoutPlanTransition,
  createSingleSubmitGate,
  type CoachOneTimeWorkoutAppointment,
  type CoachWorkoutPlanTransition,
} from "@/components/bookings/coachClientWorkoutPublish";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import {
  getRemainingPaidWorkoutWeeks,
  findEmptyWorkoutDay,
  materializeRepeatedWorkoutWeeks,
  MAX_WORKOUT_RECURRENCE_WEEKS,
  setWorkoutDayKind,
  type WorkoutDraftDay,
  type WorkoutDraftWeeks,
} from "./workoutRecurrence";

const MAX_PLAN_WEEKS = MAX_WORKOUT_RECURRENCE_WEEKS;
const MONTHLY_PLAN_WEEKS = 5;
const DEFAULT_PLAN_WEEKS = 1;
type DraftWeeks = WorkoutDraftWeeks;
type WorkoutRecurrenceMode = "remaining_paid_period" | "monthly_plan" | "this_week";
type ClientProgramEditorDraft = {
  activeDay: number;
  activeWeek: number;
  error: string;
  exerciseSearch: string;
  mode: "create" | "edit";
  planId: string | null;
  recurrenceMode: WorkoutRecurrenceMode;
  restEditorExerciseId: string | null;
  title: string;
  weeks: DraftWeeks;
  durationWeeks: number;
};

function createEmptyDay(dayOfWeek: number): WorkoutDraftDay {
  return {
    exercises: [],
    focusLabel: `${DAY_NAMES[dayOfWeek]} training`,
    isRestDay: false,
  };
}

function createInitialDraftWeeks(): DraftWeeks {
  const dayOfWeek = new Date().getDay();
  return { 1: { [dayOfWeek]: createEmptyDay(dayOfWeek) } };
}

function createNewEditorDraft(
  activeDay = new Date().getDay(),
  title = "Client weekly split",
): ClientProgramEditorDraft {
  return {
    activeDay,
    activeWeek: 1,
    durationWeeks: DEFAULT_PLAN_WEEKS,
    error: "",
    exerciseSearch: "",
    mode: "create",
    planId: null,
    recurrenceMode: "this_week",
    restEditorExerciseId: null,
    title,
    weeks: { 1: { [activeDay]: createEmptyDay(activeDay) } },
  };
}

function cloneWorkoutDraftDay(day: WorkoutDraftDay): WorkoutDraftDay {
  return {
    ...day,
    exercises: day.exercises.map((exercise) => ({
      ...exercise,
      restSecondsBySet: exercise.restSecondsBySet
        ? [...exercise.restSecondsBySet]
        : null,
    })),
  };
}

function cloneWorkoutWeek(week: Record<number, WorkoutDraftDay>) {
  return Object.fromEntries(
    Object.entries(week).map(([dayOfWeek, day]) => [
      Number(dayOfWeek),
      cloneWorkoutDraftDay(day),
    ]),
  );
}

function getMonthlyPlanWeekCount(weekCount: number) {
  return Math.max(
    1,
    Math.min(MONTHLY_PLAN_WEEKS, Math.max(1, Math.round(weekCount))),
  );
}

function materializeMonthlyWorkoutWeeks(
  currentWeeks: DraftWeeks,
  baseWeek: Record<number, WorkoutDraftDay>,
  weekCount: number,
) {
  const boundedWeekCount = getMonthlyPlanWeekCount(weekCount);

  return Object.fromEntries(
    Array.from({ length: boundedWeekCount }, (_, index) => {
      const weekNumber = index + 1;
      const sourceWeek =
        currentWeeks[weekNumber] ?? (weekNumber === 1 ? baseWeek : {});
      return [weekNumber, cloneWorkoutWeek(sourceWeek)];
    }),
  );
}

function createExistingEditorDraft(
  detail: TrainingPlanDetailRecord,
  canRepeatThroughPaidPeriod: boolean,
  oneTimeMode = false,
): ClientProgramEditorDraft {
  const weeks = detailToDraftWeeks(detail);
  const activeWeek = Math.min(...Object.keys(weeks).map(Number));
  const activeDay = Math.min(...Object.keys(weeks[activeWeek] ?? {}).map(Number));
  return {
    activeDay: Number.isFinite(activeDay) ? activeDay : new Date().getDay(),
    activeWeek: Number.isFinite(activeWeek) ? activeWeek : 1,
    durationWeeks: oneTimeMode
      ? 1
      : Math.max(1, Math.min(MAX_PLAN_WEEKS, detail.durationWeeks)),
    error: "",
    exerciseSearch: "",
    mode: "edit",
    planId: detail.id,
    recurrenceMode:
      !oneTimeMode && canRepeatThroughPaidPeriod && detail.durationWeeks > 1
        ? "remaining_paid_period"
        : "this_week",
    restEditorExerciseId: null,
    title: detail.title,
    weeks,
  };
}

function detailToDraftWeeks(plan: TrainingPlanDetailRecord): DraftWeeks {
  const weeks: DraftWeeks = {};
  for (const day of plan.scheduleDays) {
    const week = day.weekNumber || 1;
    weeks[week] ??= {};
    weeks[week][day.dayOfWeek] = {
      exercises: day.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        reps: exercise.reps ?? 10,
        restSeconds: exercise.restSeconds,
        restSecondsBySet: exercise.restSecondsBySet
          ? [...exercise.restSecondsBySet]
          : null,
        sets: exercise.sets,
      })),
      focusLabel: day.focusLabel ?? `${DAY_NAMES[day.dayOfWeek]} training`,
      isRestDay: isWorkoutRestDay(day),
    };
  }
  return Object.keys(weeks).length ? weeks : createInitialDraftWeeks();
}

function toCoachPlanInput(title: string, goal: FitnessGoal, durationWeeks: number, draftWeeks: DraftWeeks) {
  const schedule = Object.entries(draftWeeks)
    .flatMap(([weekNumber, days]) => Object.entries(days).map(([dayOfWeek, day]) => ({
      dayOfWeek: Number(dayOfWeek),
      exercises: day.exercises.map((exercise, orderIndex) => ({
        exerciseId: exercise.exerciseId,
        orderIndex,
        reps: exercise.reps,
        restSeconds: exercise.restSeconds,
        restSecondsBySet: exercise.restSecondsBySet ?? undefined,
        sets: exercise.sets,
      })),
      focusLabel: day.focusLabel.trim() || `${DAY_NAMES[Number(dayOfWeek)]} training`,
      isRestDay: day.isRestDay,
      weekNumber: Number(weekNumber),
    })))
    .sort((left, right) => left.weekNumber - right.weekNumber || left.dayOfWeek - right.dayOfWeek);
  const daysPerWeek = Math.max(0, ...Object.values(draftWeeks).map((days) => Object.keys(days).length));
  return { daysPerWeek, durationWeeks: Math.max(1, Math.min(MAX_PLAN_WEEKS, durationWeeks)), goal, schedule, title: title.trim() };
}

export function CoachClientWorkoutPrograms({
  coachUserId,
  memberId,
  canManage,
  paidPeriodEndDate,
  oneTimeAppointments = [],
  onPublished,
}: {
  coachUserId: string;
  memberId: string;
  canManage: boolean;
  paidPeriodEndDate?: string | null;
  oneTimeAppointments?: CoachOneTimeWorkoutAppointment[];
  onPublished?: (transition: CoachWorkoutPlanTransition) => boolean | void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const smallViewport = viewportWidth < 360;
  const queryClient = useQueryClient();
  const saveInFlightRef = useRef(createSingleSubmitGate());
  const [editor, setEditor] = useState<ClientProgramEditorDraft | null>(null);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const goal: FitnessGoal = "maintenance";
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const clientPlansQuery = useQuery({
    ...fitnessClientPlansQueryOptions(mobileApiClient, coachUserId, memberId, { limit: 50, page: 1 }),
    enabled: !!coachUserId && !!memberId,
  });
  const exercisesQuery = useQuery({
    ...fitnessExercisesQueryOptions(mobileApiClient, { limit: 100, page: 1 }),
    enabled: !!coachUserId,
  });
  const createMutation = useMutation(createFitnessPlanMutationOptions(mobileApiClient, queryClient));
  const updateMutation = useMutation(updateFitnessPlanMutationOptions(mobileApiClient, queryClient));
  const assignMutation = useMutation(assignFitnessPlanMutationOptions(mobileApiClient, queryClient));

  const oneTimeMode = Boolean(selectedAppointmentId) || (!paidPeriodEndDate && oneTimeAppointments.length > 0);
  const sessionPlanIds = useMemo(
    () => new Set(oneTimeAppointments.map((appointment) => appointment.workoutAssignment?.trainingPlanId).filter(Boolean)),
    [oneTimeAppointments],
  );
  const clientPrograms = useMemo(
    () => (clientPlansQuery.data?.data ?? [])
      .filter((plan) => !sessionPlanIds.has(plan.id))
      .filter((plan) => plan.coachId === coachUserId && plan.userId === memberId && plan.isTemplate === false && plan.source === "coach_assigned")
      .sort((left, right) => Number(right.isActive) - Number(left.isActive) || right.updatedAt.localeCompare(left.updatedAt)),
    [clientPlansQuery.data?.data, coachUserId, memberId, sessionPlanIds],
  );
  const exercises = useMemo(() => exercisesQuery.data?.data ?? [], [exercisesQuery.data?.data]);
  const selectedPlanId = editor?.planId ?? null;
  const title = editor?.title ?? "";
  const durationWeeks = editor?.durationWeeks ?? DEFAULT_PLAN_WEEKS;
  const recurrenceMode = editor?.recurrenceMode ?? "this_week";
  const draftWeeks = editor?.weeks ?? {};
  const activeWeek = editor?.activeWeek ?? 1;
  const activeDraftDay = editor?.activeDay ?? new Date().getDay();
  const exerciseSearch = editor?.exerciseSearch ?? "";
  const builderError = editor?.error ?? "";
  const restEditorExerciseId = editor?.restEditorExerciseId ?? null;
  const isSaving = createMutation.isPending || updateMutation.isPending || assignMutation.isPending;
  const inputStyle = { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 9, borderWidth: 1, color: colors.textPrimary, minHeight: 42, paddingHorizontal: 12 } as const;
  const weekNumbers = Array.from({ length: durationWeeks }, (_, index) => index + 1);
  const paidPeriodWeekCount = getRemainingPaidWorkoutWeeks(paidPeriodEndDate);
  const canRepeatThroughPaidPeriod = Boolean(paidPeriodEndDate);
  const selectedOneTimeAppointment = oneTimeAppointments.find(
    (appointment) => appointment.id === selectedAppointmentId,
  ) ?? null;
  const canCreateProgram = oneTimeMode
    ? oneTimeAppointments.some(
        (appointment) =>
          isEligibleOneTimeCoachAppointment(appointment) &&
          !appointment.workoutAssignment,
      )
    : canCreateClientWorkoutProgram({
        existingProgramCount: clientPrograms.length,
        hasMonthlyEntitlement: canRepeatThroughPaidPeriod,
        hasPaidEntitlement: canManage,
      });
  const recurrenceOptions: Array<{ label: string; mode: WorkoutRecurrenceMode }> = canRepeatThroughPaidPeriod
    ? [
        { label: "This week only", mode: "this_week" },
        {
          label: "Monthly split",
          mode: "monthly_plan",
        },
      ]
    : oneTimeMode
      ? [{ label: "This session", mode: "this_week" }]
      : [{ label: "This week only", mode: "this_week" }];
  const isWeeklyRepeatEnabled = canRepeatThroughPaidPeriod
    ? recurrenceMode === "remaining_paid_period"
    : false;
  const selectedWeek = isWeeklyRepeatEnabled ? 1 : activeWeek;
  const shouldShowWeekTabs = !oneTimeMode && !isWeeklyRepeatEnabled && durationWeeks > 1;
  const activeDays = draftWeeks[selectedWeek] ?? {};
  const activeDay = activeDays[activeDraftDay];
  const restEditorExercise = activeDay?.exercises.find((exercise) => exercise.exerciseId === restEditorExerciseId);
  const syncWeeksAcrossPaidPeriod = (weeks: DraftWeeks, sourceWeek: number) => {
    if (!isWeeklyRepeatEnabled) return weeks;
    const source = weeks[sourceWeek] ?? weeks[1] ?? {};
    return materializeRepeatedWorkoutWeeks(source, durationWeeks);
  };
  const generatedDayCount = Object.values(draftWeeks).reduce(
    (total, days) => total + Object.keys(days).length,
    0,
  );
  const generatedExerciseCount = Object.values(draftWeeks).reduce(
    (total, days) =>
      total + Object.values(days).reduce((dayTotal, day) => dayTotal + day.exercises.length, 0),
    0,
  );
  const visibleExercises = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    return [...exercises].sort((left, right) => left.name.localeCompare(right.name)).filter((exercise) => query ? `${exercise.name} ${exercise.muscleGroup ?? ""}`.toLowerCase().includes(query) : true).slice(0, 16);
  }, [exerciseSearch, exercises]);

  const patchEditor = (patch: Partial<ClientProgramEditorDraft>) => {
    setEditor((current) => (current ? { ...current, ...patch } : current));
  };
  const setBuilderError = (error: string) => patchEditor({ error });
  const setTitle = (nextTitle: string) => patchEditor({ title: nextTitle });
  const setExerciseSearch = (query: string) =>
    patchEditor({ exerciseSearch: query });
  const setActiveWeek = (week: number) => patchEditor({ activeWeek: week });
  const setActiveDraftDay = (day: number) => patchEditor({ activeDay: day });
  const setRestEditorExerciseId = (exerciseId: string | null) =>
    patchEditor({ restEditorExerciseId: exerciseId });
  const setDraftWeeks = (
    update: DraftWeeks | ((current: DraftWeeks) => DraftWeeks),
  ) => {
    setEditor((current) => {
      if (!current) return current;
      const nextWeeks = typeof update === "function"
        ? update(current.weeks)
        : update;
      const sourceWeek = current.recurrenceMode === "remaining_paid_period" ? 1 : current.activeWeek;
      return {
        ...current,
        weeks: syncWeeksAcrossPaidPeriod(nextWeeks, sourceWeek),
      };
    });
  };

  const openNew = (appointment?: CoachOneTimeWorkoutAppointment) => {
    if (!canCreateProgram) return;
    const selected = appointment ?? oneTimeAppointments.find((candidate) => !candidate.workoutAssignment);
    setSelectedAppointmentId(selected?.id ?? null);
    const activeDay = selected
      ? ((new Date(new Date(selected.scheduledAt).getTime() + 8 * 60 * 60 * 1000).getUTCDay()))
      : new Date().getDay();
    setEditor(createNewEditorDraft(activeDay, selected ? "Session Workout" : "Client weekly split"));
    setMessage("");
    setMessageIsError(false);
  };
  const openExisting = async (planId: string, appointmentId?: string) => {
    if (!canManage || loadingPlanId) return;
    setLoadingPlanId(planId);
    setSelectedAppointmentId(appointmentId ?? null);
    setMessage("");
    setMessageIsError(false);
    try {
      const detail = await queryClient.fetchQuery(
        fitnessPlanDetailQueryOptions(mobileApiClient, planId),
      );
      if (!detail) throw new Error("This client program is no longer available.");
      setEditor(
        createExistingEditorDraft(detail, canRepeatThroughPaidPeriod, Boolean(appointmentId)),
      );
    } catch (error) {
      setMessageIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load this client program.",
      );
    } finally {
      setLoadingPlanId(null);
    }
  };
  const resetAfterSuccess = () => {
    setEditor(null);
  };
  const toggleDay = (dayOfWeek: number) => {
    setBuilderError("");
    setDraftWeeks((current) => {
      const editingWeek = isWeeklyRepeatEnabled ? 1 : activeWeek;
      const currentDays = current[editingWeek] ?? {};
      if (currentDays[dayOfWeek]) {
        const nextDays = { ...currentDays };
        delete nextDays[dayOfWeek];
        const remaining = Object.keys(nextDays).map(Number);
        if (activeDraftDay === dayOfWeek && remaining.length > 0) setActiveDraftDay(remaining[0]);
        return { ...current, [editingWeek]: nextDays };
      }
      setActiveDraftDay(dayOfWeek);
      return { ...current, [editingWeek]: { ...currentDays, [dayOfWeek]: createEmptyDay(dayOfWeek) } };
    });
  };
  const patchExercise = (exerciseId: string, patch: Partial<Pick<DraftExercise, "reps" | "restSeconds" | "restSecondsBySet" | "sets">>) => {
    setBuilderError("");
    setDraftWeeks((current) => {
      const editingWeek = isWeeklyRepeatEnabled ? 1 : activeWeek;
      const days = current[editingWeek] ?? {};
      const day = days[activeDraftDay];
      if (!day) return current;
      return { ...current, [editingWeek]: { ...days, [activeDraftDay]: { ...day, exercises: day.exercises.map((exercise) => {
        if (exercise.exerciseId !== exerciseId) return exercise;
        const next = { ...exercise, ...patch };
        if (next.restSecondsBySet) next.restSecondsBySet = Array.from({ length: next.sets }, (_, index) => next.restSecondsBySet?.[index] ?? next.restSeconds);
        return next;
      }) } } };
    });
  };
  const removeExercise = (exerciseId: string) => {
    setBuilderError("");
    setDraftWeeks((current) => {
      const editingWeek = isWeeklyRepeatEnabled ? 1 : activeWeek;
      const days = current[editingWeek] ?? {};
      const day = days[activeDraftDay];
      if (!day) return current;
      return { ...current, [editingWeek]: { ...days, [activeDraftDay]: { ...day, exercises: day.exercises.filter((exercise) => exercise.exerciseId !== exerciseId) } } };
    });
  };
  const addExercise = (exercise: (typeof exercises)[number]) => {
    setBuilderError("");
    setDraftWeeks((current) => {
      const editingWeek = isWeeklyRepeatEnabled ? 1 : activeWeek;
      const days = current[editingWeek] ?? {};
      const day = days[activeDraftDay];
      if (day?.isRestDay || !day || day.exercises.some((item) => item.exerciseId === exercise.id)) return current;
      return { ...current, [editingWeek]: { ...days, [activeDraftDay]: { ...day, exercises: [...day.exercises, { exerciseId: exercise.id, exerciseName: exercise.name, reps: 10, restSeconds: 75, restSecondsBySet: null, sets: 3 }] } } };
    });
  };

  const setActiveWeekAndDay = (week: number) => {
    if (isWeeklyRepeatEnabled) return;
    setActiveWeek(week);
    const firstDay = Object.keys(draftWeeks[week] ?? {})[0];
    setActiveDraftDay(firstDay === undefined ? new Date().getDay() : Number(firstDay));
  };

  const setWorkoutRecurrence = (nextMode: WorkoutRecurrenceMode) => {
    setBuilderError("");
    const sourceWeek = draftWeeks[selectedWeek] ?? draftWeeks[1] ?? {};
    const nextWeekCount =
      nextMode === "remaining_paid_period" && canRepeatThroughPaidPeriod
        ? paidPeriodWeekCount
        : nextMode === "monthly_plan" && canRepeatThroughPaidPeriod
          ? getMonthlyPlanWeekCount(paidPeriodWeekCount)
        : 1;
    const nextWeeks =
      nextMode === "monthly_plan"
        ? materializeMonthlyWorkoutWeeks(draftWeeks, sourceWeek, nextWeekCount)
        : materializeRepeatedWorkoutWeeks(sourceWeek, nextWeekCount);
    const firstDay = Math.min(...Object.keys(nextWeeks[1] ?? {}).map(Number));

    patchEditor({
      activeDay: Number.isFinite(firstDay) ? firstDay : new Date().getDay(),
      activeWeek: 1,
      durationWeeks: nextWeekCount,
      recurrenceMode: nextMode,
      weeks: nextWeeks,
    });
  };

  const setActiveDayKind = (kind: "workout" | "rest") => {
    setBuilderError("");
    setDraftWeeks((current) => {
      const editingWeek = isWeeklyRepeatEnabled ? 1 : activeWeek;
      const days = current[editingWeek] ?? {};
      const day = days[activeDraftDay];
      if (!day) return current;

      return {
        ...current,
        [editingWeek]: {
          ...days,
          [activeDraftDay]: setWorkoutDayKind(
            day,
            kind,
            `${DAY_NAMES[activeDraftDay]} training`,
          ),
        },
      };
    });
  };

  const validateProgramDraft = () => {
    if (!canManage) {
      setBuilderError(
        "This client does not have a fully paid coaching entitlement for program assignment.",
      );
      return false;
    }
    const input = toCoachPlanInput(title, goal, durationWeeks, draftWeeks);
    if (oneTimeMode && input.schedule.length !== 1) {
      setBuilderError("A session workout must contain exactly one configured workout day.");
      return false;
    }
    if (!input.title) {
      setBuilderError("Give this program a clear name.");
      return false;
    }
    if (input.schedule.length === 0) {
      setBuilderError("Select at least one training day.");
      return false;
    }
    const emptyDay = findEmptyWorkoutDay(draftWeeks);
    if (emptyDay) {
      setActiveWeek(emptyDay.weekNumber);
      setActiveDraftDay(emptyDay.dayOfWeek);
      setBuilderError(
        `Add at least one exercise to week ${emptyDay.weekNumber} ${DAY_NAMES[emptyDay.dayOfWeek]}.`,
      );
      return false;
    }
    return true;
  };

  const requestSaveConfirmation = () => {
    setBuilderError("");
    if (!validateProgramDraft()) return;
    setSaveConfirmationOpen(true);
  };

  const saveProgram = async () => {
    if (!saveInFlightRef.current.tryAcquire()) return;
    setSaveConfirmationOpen(false);
    setBuilderError("");
    setMessage("");
    try {
      const input = toCoachPlanInput(title, goal, durationWeeks, draftWeeks);
      let planId = selectedPlanId;
      if (planId) {
        await updateMutation.mutateAsync({ input, planId, userId: coachUserId });
      } else {
        const created = await createMutation.mutateAsync({ input, userId: coachUserId });
        planId = created.id;
        const assignedPlan = await assignMutation.mutateAsync({
          appointmentId: selectedOneTimeAppointment?.id,
          memberId,
          planId,
          userId: coachUserId,
        });
        if (!assignedPlan?.id) throw new Error("The client program assignment did not complete.");
        onPublished?.(createCoachWorkoutPlanTransition(memberId, assignedPlan.id));
      }
      await clientPlansQuery.refetch();
      setMessageIsError(false);
      setMessage(
        selectedPlanId
          ? oneTimeMode
            ? "Session workout changes saved."
            : "Client program changes saved."
          : oneTimeMode
            ? "Session workout saved and assigned."
            : "Client program saved and assigned.",
      );
      resetAfterSuccess();
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Unable to save this client program. Your draft is still here; try again.");
    } finally {
      saveInFlightRef.current.release();
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <FitText style={{ color: colors.brand, fontSize: 13, fontWeight: "900" }}>{oneTimeMode ? "SESSION WORKOUTS" : "CLIENT WORKOUT PROGRAMS"}</FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 12 }}>{oneTimeMode ? "Each paid coaching appointment has its own date-scoped workout." : "Client-specific programs stay separate from personal plans and can be edited without changing paid sessions."}</FitText>
      </View>
      {oneTimeMode ? <View style={{ gap: 8 }}>{oneTimeAppointments.map((appointment) => <Pressable accessibilityRole="button" key={appointment.id} onPress={() => appointment.workoutAssignment ? void openExisting(appointment.workoutAssignment.trainingPlanId, appointment.id) : openNew(appointment)} style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.brand, borderRadius: 10, borderWidth: 1, gap: 4, padding: 12 }}><FitText style={{ color: colors.brand, fontSize: 10, fontWeight: "900" }}>SESSION WORKOUT</FitText><FitText style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "900" }}>{new Date(appointment.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</FitText><FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>{appointment.workoutAssignment ? "VIEW / EDIT SESSION WORKOUT" : "CREATE SESSION WORKOUT"}</FitText></Pressable>)}</View> : null}
      {clientPrograms.length ? <View style={{ gap: 8 }}>{clientPrograms.map((plan) => <Pressable accessibilityLabel={`Edit ${plan.title}`} accessibilityRole="button" disabled={!canManage || Boolean(loadingPlanId)} key={plan.id} onPress={() => void openExisting(plan.id)} style={{ backgroundColor: colors.surfaceRaised, borderColor: plan.isActive ? colors.brand : colors.border, borderRadius: 10, borderWidth: 1, gap: 4, opacity: canManage ? 1 : 0.7, padding: 12 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}><FitText style={{ color: colors.textPrimary, flex: 1, fontSize: 13, fontWeight: "900" }}>{plan.title}</FitText><FitText style={{ color: plan.isActive ? colors.success : colors.textMuted, fontSize: 10, fontWeight: "900" }}>{plan.isActive ? "ACTIVE" : "INACTIVE"}</FitText></View>
        <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>{plan.daysPerWeek} day split · {plan.durationWeeks} weeks · Tap to edit</FitText>
      </Pressable>)}</View> : <View style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 10, borderWidth: 1, gap: 4, padding: 12 }}><FitText style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "800" }}>No client-specific programs yet.</FitText><FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>Create a one-session/week program or repeat it through an active paid monthly period.</FitText></View>}
      {canCreateProgram ? <FitButton disabled={Boolean(loadingPlanId)} label={loadingPlanId ? "LOADING PROGRAM" : oneTimeMode ? "CREATE SESSION WORKOUT" : "CREATE PROGRAM"} onPress={() => openNew()} style={{ minHeight: 46 }} textStyle={{ fontSize: 13, fontWeight: "900" }} variant="ghost" /> : null}
      {canManage && !canCreateProgram ? <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>This one-session entitlement already has its workout program. Open it above to edit.</FitText> : null}
      {!canManage ? <FitText accessibilityRole="alert" style={{ color: colors.danger, fontSize: 10.5 }}>A fully paid one-session booking or active paid monthly plan is required before a coach can create or edit this client's program.</FitText> : null}
      {message ? <FitText accessibilityLiveRegion="polite" style={{ color: messageIsError ? colors.danger : colors.success, fontSize: 12 }}>{message}</FitText> : null}
      <Modal animationType="slide" onRequestClose={() => setEditor(null)} transparent visible={Boolean(editor)}>
        <View style={{ backgroundColor: "rgba(0,0,0,0.56)", flex: 1, justifyContent: "flex-end" }}><View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, flexShrink: 1, height: "92%", maxHeight: "92%", minHeight: 0, paddingBottom: insets.bottom + 8, paddingTop: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between", paddingBottom: 10, paddingHorizontal: 16 }}><View style={{ flex: 1, gap: 2, minWidth: smallViewport ? 0 : undefined }}><FitText style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "900" }}>{selectedPlanId ? (oneTimeMode ? "Edit session workout" : "Edit client program") : oneTimeMode ? "Create session workout" : "Create client program"}</FitText><FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>{oneTimeMode ? "This session - exact sets, reps, and rest" : "Multi-week days - exact sets, reps, and rest"}</FitText></View><Pressable accessibilityLabel="Back from workout program editor" accessibilityRole="button" disabled={isSaving} onPress={() => setEditor(null)} style={smallViewport ? { alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44 } : { padding: 6 }}><FitText style={{ color: colors.textMuted, fontSize: 13, fontWeight: "900" }}>BACK</FitText></Pressable></View>
          <ScrollView contentContainerStyle={{ gap: 12, padding: 16, paddingTop: 4 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flex: 1, flexShrink: 1, minHeight: 0 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 10.5, fontWeight: "900" }}>PROGRAM NAME</FitText>
            <TextInput accessibilityLabel="Client workout program name" onChangeText={(value) => { setTitle(value); setBuilderError(""); }} placeholder="Strength foundation" placeholderTextColor={colors.textMuted} style={inputStyle} value={title} />
            {builderError === "Give this program a clear name." ? <FitText accessibilityRole="alert" style={{ color: colors.danger, fontSize: 10.5 }}>{builderError}</FitText> : null}
            <View style={{ gap: 7 }}>
                <FitText style={{ color: colors.textMuted, fontSize: 10.5, fontWeight: "900" }}>{oneTimeMode ? "SESSION WORKOUT" : "WORKOUT RECURRENCE"}</FitText>
              <View style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 4, padding: 4 }}>
                {recurrenceOptions.map((option) => {
                  const selected =
                    option.mode === "this_week"
                      ? recurrenceMode === "this_week" || recurrenceMode === "remaining_paid_period"
                      : recurrenceMode === option.mode;
                  return (
                    <Pressable
                      accessibilityLabel={option.label}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={option.mode}
                      onPress={() => setWorkoutRecurrence(option.mode)}
                      style={{ alignItems: "center", backgroundColor: selected ? `${colors.brand}22` : "transparent", borderColor: selected ? colors.brand : "transparent", borderRadius: 7, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: smallViewport ? 44 : 42, minWidth: smallViewport ? 0 : undefined, paddingHorizontal: 5, paddingVertical: 6 }}
                    >
                      <FitText adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={2} style={{ color: selected ? colors.brand : colors.textMuted, flexShrink: smallViewport ? 1 : undefined, fontSize: smallViewport ? 10.5 : 9.5, fontWeight: "900", minWidth: smallViewport ? 0 : undefined, textAlign: "center" }}>{option.label}</FitText>
                    </Pressable>
                  );
                })}
              </View>
              {canRepeatThroughPaidPeriod && recurrenceMode !== "monthly_plan" ? (
                <Pressable
                  accessibilityLabel={`Repeat this week through paid period ${isWeeklyRepeatEnabled ? "enabled" : "disabled"}`}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isWeeklyRepeatEnabled }}
                  onPress={() => {
                    setWorkoutRecurrence(isWeeklyRepeatEnabled ? "this_week" : "remaining_paid_period");
                  }}
                  style={{
                    alignItems: "center",
                    backgroundColor: isWeeklyRepeatEnabled ? `${colors.brand}18` : colors.surfaceRaised,
                    borderColor: isWeeklyRepeatEnabled ? colors.brand : colors.border,
                    borderRadius: 9,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 8,
                    justifyContent: "space-between",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <FitText style={{ color: colors.textPrimary, fontSize: 10.5, fontWeight: "900" }}>
                      Repeat this week through paid period
                    </FitText>
                    <FitText style={{ color: colors.textMuted, fontSize: 9.5 }}>
                      {isWeeklyRepeatEnabled
                        ? "Enabled: same week gets copied to each active paid week."
                        : "Disabled: only this week stays in the plan."}
                    </FitText>
                  </View>
                  <FitText
                    style={{
                      color: isWeeklyRepeatEnabled ? colors.brand : colors.textMuted,
                      fontSize: 10,
                      fontWeight: "900",
                    }}
                  >
                    {isWeeklyRepeatEnabled ? "ON" : "OFF"}
                  </FitText>
                </Pressable>
              ) : null}
              <FitText style={{ color: colors.textMuted, fontSize: 10, lineHeight: 14 }}>
                {canRepeatThroughPaidPeriod
                  ? recurrenceMode === "monthly_plan"
                    ? `Monthly split creates up to ${Math.min(MONTHLY_PLAN_WEEKS, paidPeriodWeekCount)} independent week tabs to plan variable training by week for a single paid period. Workout assignments only - no appointments, payments, holds, memberships, or entitlement.`
                    : isWeeklyRepeatEnabled
                      ? `Repeat copies the selected week through the active paid period (${paidPeriodWeekCount} generated week${paidPeriodWeekCount === 1 ? "" : "s"}). Workout assignments only - no appointments, payments, holds, memberships, or entitlement.`
                      : "Single-week plan for this week only. Workout assignments only - no appointments, payments, holds, memberships, or entitlement."
                  : "This one-session client gets this session/week only. Workout assignments do not create appointments, payments, holds, memberships, or entitlement."}
              </FitText>
              <FitText style={{ color: colors.textPrimary, fontSize: 10.5, fontWeight: "800" }}>
                {durationWeeks} generated week{durationWeeks === 1 ? "" : "s"} - {generatedDayCount} workout day{generatedDayCount === 1 ? "" : "s"}, {generatedExerciseCount} exercise{generatedExerciseCount === 1 ? "" : "s"}
              </FitText>
            </View>
            {shouldShowWeekTabs ? (
              <View style={{ gap: 7 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <FitText style={{ color: colors.textMuted, fontSize: 10.5, fontWeight: "900" }}>WEEKS</FitText>
                <FitText style={{ color: colors.textMuted, fontSize: 10 }}>{durationWeeks} generated</FitText>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {weekNumbers.map((week) => {
                  const weekDays = draftWeeks[week] ?? {};
                  const hasPlan = Object.keys(weekDays).length > 0;
                  const isActiveWeek = activeWeek === week;
                  return (
                    <Pressable
                      accessibilityLabel={`Week ${week}${isActiveWeek ? " selected" : hasPlan ? " with plan" : ""}`}
                      accessibilityRole="button"
                      key={week}
                      onPress={() => setActiveWeekAndDay(week)}
                      style={{
                        backgroundColor: isActiveWeek
                          ? `${colors.brand}22`
                          : hasPlan
                            ? `${colors.brand}12`
                            : colors.surfaceRaised,
                        borderColor: isActiveWeek || hasPlan ? colors.brand : colors.border,
                        borderRadius: 8,
                        borderWidth: 1,
                        minHeight: smallViewport ? 44 : undefined,
                        minWidth: smallViewport ? 44 : 48,
                        paddingHorizontal: 9,
                        paddingVertical: 7,
                      }}
                    >
                      <FitText style={{ color: isActiveWeek || hasPlan ? colors.brand : colors.textMuted, fontSize: 10, fontWeight: "900", textAlign: "center" }}>
                        W{week}
                      </FitText>
                    </Pressable>
                  );
                })}
              </View>
              </View>
            ) : null}
            <View style={{ gap: 7 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 10.5, fontWeight: "900" }}>
                {shouldShowWeekTabs ? `WEEK ${selectedWeek} TRAINING DAYS` : "TRAINING DAYS"}
              </FitText>
              <View style={{ flexDirection: "row", flexWrap: smallViewport ? "wrap" : undefined, gap: 5 }}>
                {DAY_NAMES.map((day, dayOfWeek) => {
                  const selected = Boolean(activeDays[dayOfWeek]);
                  const active = activeDraftDay === dayOfWeek;
                  return (
                    <Pressable
                      accessibilityLabel={`${shouldShowWeekTabs ? `Week ${selectedWeek} ` : ""}${day} ${selected ? "selected" : "not selected"}`}
                      accessibilityRole="button"
                      key={day}
                      onLongPress={() => toggleDay(dayOfWeek)}
                      onPress={() => {
                        if (selected) {
                          setActiveDraftDay(dayOfWeek);
                          setBuilderError("");
                          return;
                        }
                        toggleDay(dayOfWeek);
                      }}
                      style={{
                        alignItems: "center",
                        backgroundColor: active
                          ? `${colors.brand}24`
                          : selected
                            ? `${colors.brand}12`
                            : colors.surfaceRaised,
                        borderColor: selected ? colors.brand : colors.border,
                        borderRadius: 8,
                        borderWidth: 1,
                        flex: smallViewport ? 0 : 1,
                        minHeight: smallViewport ? 44 : 36,
                        minWidth: smallViewport ? 44 : undefined,
                        justifyContent: "center",
                        width: smallViewport ? 60 : undefined,
                      }}
                    >
                      <FitText style={{ color: selected ? colors.brand : colors.textMuted, fontSize: 9.5, fontWeight: "900" }}>
                        {day}
                      </FitText>
                    </Pressable>
                  );
                })}
              </View>
              <FitText style={{ color: colors.textMuted, fontSize: 9.5 }}>Tap a day to edit it. Long-press a selected day to remove it.</FitText>
            </View>
            {activeDay ? <View style={{ gap: 7 }}><FitText style={{ color: colors.textMuted, fontSize: 10.5, fontWeight: "900" }}>DAY TYPE</FitText><View style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 4, padding: 4 }}>{[{ label: "Workout day", value: "workout" as const }, { label: "Rest / recovery day", value: "rest" as const }].map((option) => { const selected = (option.value === "rest") === activeDay.isRestDay; return <Pressable accessibilityLabel={`${DAY_NAMES[activeDraftDay]} ${option.label}`} accessibilityRole="radio" accessibilityState={{ selected }} key={option.value} onPress={() => setActiveDayKind(option.value)} style={{ alignItems: "center", backgroundColor: selected ? `${colors.brand}22` : "transparent", borderColor: selected ? colors.brand : "transparent", borderRadius: 7, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: smallViewport ? 44 : 38, minWidth: smallViewport ? 0 : undefined, paddingHorizontal: 5 }}><FitText adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={2} style={{ color: selected ? colors.brand : colors.textMuted, flexShrink: smallViewport ? 1 : undefined, fontSize: smallViewport ? 10.5 : 9.5, fontWeight: "900", minWidth: smallViewport ? 0 : undefined, textAlign: "center" }}>{option.label}</FitText></Pressable>; })}</View></View> : null}
            {activeDay ? <View style={{ gap: 10 }}><FitText style={{ color: colors.textMuted, fontSize: 10.5, fontWeight: "900" }}>WORKOUT</FitText><TextInput accessibilityLabel={`${shouldShowWeekTabs ? `Week ${selectedWeek} ` : ""}${DAY_NAMES[activeDraftDay]} workout label`} onChangeText={(focusLabel) => setDraftWeeks((current) => ({ ...current, [selectedWeek]: { ...(current[selectedWeek] ?? {}), [activeDraftDay]: { ...activeDay, focusLabel } } }))} placeholder="Lower body strength" placeholderTextColor={colors.textMuted} style={inputStyle} value={activeDay.focusLabel} />
             {activeDay.exercises.map((exercise) => (
               <View
                 key={exercise.exerciseId}
                 style={{
                   backgroundColor: colors.surfaceRaised,
                   borderColor: colors.border,
                   borderRadius: 9,
                   borderWidth: 1,
                   gap: 9,
                   padding: 11,
                 }}
               >
                 <View
                   style={{
                     alignItems: "center",
                     flexDirection: "row",
                     gap: 8,
                     justifyContent: "space-between",
                   }}
                 >
                   <FitText
                     style={{
                       color: colors.textPrimary,
                        flex: 1,
                        flexShrink: smallViewport ? 1 : undefined,
                        fontSize: 12,
                        fontWeight: "900",
                        minWidth: smallViewport ? 0 : undefined,
                     }}
                   >
                     {exercise.exerciseName}
                   </FitText>
                   <Pressable
                     accessibilityLabel={`Remove ${exercise.exerciseName}`}
                     accessibilityRole="button"
                     onPress={() => removeExercise(exercise.exerciseId)}
                      style={smallViewport ? {
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 44,
                        minWidth: 44,
                      } : { padding: 3 }}
                   >
                     <Trash2 size={16} color={colors.danger} />
                   </Pressable>
                 </View>
                 <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                   {[
                     { key: "sets" as const, label: "Sets", max: 20, min: 1, value: exercise.sets },
                     { key: "reps" as const, label: "Reps", max: 100, min: 1, value: exercise.reps },
                   ].map((control) => (
                     <View
                       key={control.key}
                       style={{
                         alignItems: "center",
                         backgroundColor: colors.surface,
                         borderColor: colors.border,
                         borderRadius: 8,
                         borderWidth: 1,
                          flex: smallViewport ? undefined : 1,
                          flexDirection: "row",
                          flexBasis: smallViewport ? 150 : undefined,
                          flexGrow: smallViewport ? 1 : undefined,
                          flexShrink: smallViewport ? 1 : undefined,
                          justifyContent: "space-between",
                          minHeight: smallViewport ? 44 : undefined,
                          minWidth: smallViewport ? 150 : 92,
                         paddingHorizontal: 5,
                         paddingVertical: 7,
                       }}
                     >
                       <Pressable
                         accessibilityLabel={`Decrease ${control.label}`}
                         accessibilityRole="button"
                         onPress={() =>
                           patchExercise(exercise.exerciseId, {
                             [control.key]: Math.max(control.min, control.value - 1),
                           })
                         }
                          style={smallViewport ? {
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 44,
                            minWidth: 44,
                          } : { padding: 2 }}
                       >
                         <Minus size={14} color={colors.textMuted} />
                       </Pressable>
                       <FitText
                         adjustsFontSizeToFit
                         minimumFontScale={0.82}
                         numberOfLines={1}
                         style={{
                           color: colors.textPrimary,
                           flex: 1,
                            flexShrink: smallViewport ? 1 : undefined,
                            fontSize: smallViewport ? 12 : 9.5,
                            fontWeight: "800",
                            minWidth: smallViewport ? 0 : 0,
                            textAlign: "center",
                         }}
                       >
                         {control.value} {control.label}
                       </FitText>
                       <Pressable
                         accessibilityLabel={`Increase ${control.label}`}
                         accessibilityRole="button"
                         onPress={() =>
                           patchExercise(exercise.exerciseId, {
                             [control.key]: Math.min(control.max, control.value + 1),
                           })
                         }
                          style={smallViewport ? {
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 44,
                            minWidth: 44,
                          } : { padding: 2 }}
                       >
                         <Plus size={14} color={colors.brand} />
                       </Pressable>
                     </View>
                   ))}
                   <Pressable
                     accessibilityLabel={`Edit ${exercise.exerciseName} rest timer`}
                     accessibilityRole="button"
                     onPress={() => setRestEditorExerciseId(exercise.exerciseId)}
                     style={{
                       alignItems: "center",
                       backgroundColor: colors.surface,
                       borderColor: colors.border,
                       borderRadius: 8,
                       borderWidth: 1,
                      flex: smallViewport ? undefined : 1,
                      flexBasis: smallViewport ? 150 : undefined,
                      flexGrow: smallViewport ? 1 : undefined,
                      flexShrink: smallViewport ? 1 : undefined,
                      justifyContent: "center",
                      minHeight: smallViewport ? 44 : undefined,
                      minWidth: smallViewport ? 150 : 92,
                       paddingHorizontal: 5,
                       paddingVertical: 7,
                     }}
                   >
                     <FitText
                       adjustsFontSizeToFit
                       minimumFontScale={0.82}
                       numberOfLines={1}
                       style={{
                         color: colors.textPrimary,
                        flexShrink: smallViewport ? 1 : undefined,
                        fontSize: smallViewport ? 10.5 : 9.5,
                        fontWeight: "800",
                        minWidth: smallViewport ? 0 : undefined,
                       }}
                     >
                       {exercise.restSecondsBySet ? "SET REST" : `REST ${exercise.restSeconds}s`}
                     </FitText>
                   </Pressable>
                 </View>
               </View>
             ))}
               <TextInput accessibilityLabel="Search exercise catalog" onChangeText={setExerciseSearch} placeholder="Search exercises" placeholderTextColor={colors.textMuted} style={inputStyle} value={exerciseSearch} />
               <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                 {visibleExercises.map((exercise) => {
                   const selected = activeDay.exercises.some((item) => item.exerciseId === exercise.id);
                   return (
                     <Pressable
                       accessibilityLabel={`${selected ? "Added" : "Add"} ${exercise.name}`}
                       accessibilityRole="button"
                       disabled={selected}
                       key={exercise.id}
                       onPress={() => addExercise(exercise)}
                       style={{
                         backgroundColor: selected ? `${colors.success}12` : colors.surfaceRaised,
                         borderColor: selected ? colors.success : colors.border,
                         borderRadius: 8,
                         borderWidth: 1,
                          maxWidth: smallViewport ? "100%" : undefined,
                          minHeight: smallViewport ? 44 : undefined,
                         opacity: selected ? 0.65 : 1,
                         paddingHorizontal: 9,
                          paddingVertical: smallViewport ? 8 : 7,
                       }}
                     >
                       <FitText
                         style={{
                           color: selected ? colors.success : colors.textPrimary,
                            flexShrink: smallViewport ? 1 : undefined,
                            fontSize: smallViewport ? 10.5 : 9.5,
                            fontWeight: "800",
                            minWidth: smallViewport ? 0 : undefined,
                         }}
                       >
                         {selected ? "Added · " : "+ "}{exercise.name}
                       </FitText>
                     </Pressable>
                   );
                 })}
               </View>
               {!exercisesQuery.isLoading && visibleExercises.length === 0 ? <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>No exercises match this search.</FitText> : null}
               <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>{activeDay.exercises.length} exercise{activeDay.exercises.length === 1 ? "" : "s"} on {DAY_NAMES[activeDraftDay]}.</FitText>
            </View> : <FitText style={{ color: colors.textMuted, fontSize: 11 }}>Select a training day to add its workout.</FitText>}
            {builderError && builderError !== "Give this program a clear name." ? <FitText accessibilityLiveRegion="polite" style={{ color: colors.danger, fontSize: 12, fontWeight: "700" }}>{builderError}</FitText> : null}
          </ScrollView>
          <View style={{ borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 10 }}>
            <FitButton disabled={isSaving} flex={1} label="BACK" onPress={() => setEditor(null)} style={{ minHeight: 46 }} textStyle={{ fontSize: 12, fontWeight: "900" }} variant="ghost" />
            <FitButton disabled={!canManage || isSaving || !editor} flex={1} label={isSaving ? "SAVING" : "SAVE PROGRAM"} loading={isSaving} loadingLabel="SAVING" onPress={requestSaveConfirmation} style={{ minHeight: 46 }} textStyle={{ fontSize: 12, fontWeight: "900" }} />
          </View>
        </View></View>
      </Modal>
      <ConfirmModal
        isVisible={saveConfirmationOpen}
        title={selectedPlanId ? "Save program changes?" : "Create client program?"}
        message={selectedPlanId
          ? `Update ${title.trim()} for this client? The existing assignment stays attached and paid appointments are not changed.`
          : `Create and assign ${title.trim()} to this client? Paid appointments and their dates remain unchanged.`}
        yesLabel={selectedPlanId ? "SAVE CHANGES" : "CREATE PROGRAM"}
        noLabel="CANCEL"
        isLoading={isSaving}
        loadingLabel="SAVING"
        onNo={() => setSaveConfirmationOpen(false)}
        onYes={() => void saveProgram()}
      />
      <ExerciseRestTimerModal exerciseName={restEditorExercise?.exerciseName ?? "Exercise"} isVisible={Boolean(restEditorExercise)} onClose={() => setRestEditorExerciseId(null)} onSave={({ restSeconds, restSecondsBySet }) => { if (!restEditorExercise) return; patchExercise(restEditorExercise.exerciseId, { restSeconds, restSecondsBySet }); setRestEditorExerciseId(null); }} restSeconds={restEditorExercise?.restSeconds ?? 75} restSecondsBySet={restEditorExercise?.restSecondsBySet ?? null} sets={restEditorExercise?.sets ?? 1} />
    </View>
  );
}
