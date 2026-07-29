import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import {
  ArrowLeft,
  Check,
  Dumbbell,
  Minus,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateTrainingPlanInput,
  FitnessGoal,
  TrainingPlanDetailRecord,
  TrainingPlanSummaryRecord,
} from "@fittrack/types";
import {
  activateFitnessPlanMutationOptions,
  createFitnessPlanMutationOptions,
  deleteFitnessPlanMutationOptions,
  fitnessExercisesQueryOptions,
  fitnessPlansQueryOptions,
  updateFitnessPlanMutationOptions,
} from "@fittrack/query";

import { FitButton, FitText } from "@/components/fit";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const GOALS: Array<{ label: string; value: FitnessGoal }> = [
  { label: "Build muscle", value: "bulking" },
  { label: "Maintain", value: "maintenance" },
  { label: "Cut", value: "cutting" },
  { label: "Sport", value: "sport_specific" },
];

type DraftExercise = {
  exerciseId: string;
  exerciseName: string;
  reps: number;
  restSeconds: number;
  sets: number;
};

type DraftDay = {
  exercises: DraftExercise[];
  focusLabel: string;
};

type DraftDays = Record<number, DraftDay>;

type PlanConfirmation = {
  confirmLabel: string;
  destructive?: boolean;
  message: string;
  onConfirm: () => Promise<void>;
  title: string;
};

function sourceLabel(plan: TrainingPlanSummaryRecord) {
  if (plan.source === "coach_assigned" || plan.coachId) return "Coach assigned";
  if (plan.source === "ai_generated") return "Smart draft";
  return "Personal";
}

function detailToDraft(plan: TrainingPlanDetailRecord): DraftDays {
  return Object.fromEntries(
    plan.scheduleDays
      .filter((day) => day.weekNumber === 1)
      .map((day) => [
        day.dayOfWeek,
        {
          exercises: day.exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            reps: exercise.reps ?? 10,
            restSeconds: exercise.restSeconds,
            sets: exercise.sets,
          })),
          focusLabel: day.focusLabel ?? `${DAY_NAMES[day.dayOfWeek]} training`,
        },
      ]),
  );
}

function toPlanInput(
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
        sets: exercise.sets,
      })),
      focusLabel: day.focusLabel.trim() || `${DAY_NAMES[Number(dayOfWeek)]} training`,
      weekNumber: 1,
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  return {
    daysPerWeek: schedule.length,
    durationWeeks: 12,
    goal,
    schedule,
    title: title.trim(),
  };
}

export function WorkoutPlansScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [title, setTitle] = useState("My weekly split");
  const [goal, setGoal] = useState<FitnessGoal>("maintenance");
  const [draftDays, setDraftDays] = useState<DraftDays>({});
  const [activeDraftDay, setActiveDraftDay] = useState<number>(1);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] =
    useState<PlanConfirmation | null>(null);

  const plansQuery = useQuery({
    ...fitnessPlansQueryOptions(mobileApiClient, user?.id, { limit: 50, page: 1 }),
    enabled: !!user?.id,
  });
  const exercisesQuery = useQuery({
    ...fitnessExercisesQueryOptions(mobileApiClient, { limit: 100, page: 1 }),
    enabled: !!user?.id,
  });
  const plans = plansQuery.data?.data ?? [];
  const hasCoachManagedPlan = plans.some(
    (plan) => plan.source === "coach_assigned" && Boolean(plan.coachId),
  );
  const exercises = useMemo(() => {
    const normalized = exerciseSearch.trim().toLowerCase();
    return (exercisesQuery.data?.data ?? [])
      .filter(
        (exercise) =>
          !normalized ||
          `${exercise.name} ${exercise.muscleGroup}`
            .toLowerCase()
            .includes(normalized),
      )
      .slice(0, 24);
  }, [exerciseSearch, exercisesQuery.data?.data]);

  const activateMutation = useMutation(
    activateFitnessPlanMutationOptions(mobileApiClient, queryClient),
  );
  const createMutation = useMutation(
    createFitnessPlanMutationOptions(mobileApiClient, queryClient),
  );
  const updateMutation = useMutation(
    updateFitnessPlanMutationOptions(mobileApiClient, queryClient),
  );
  const deleteMutation = useMutation(
    deleteFitnessPlanMutationOptions(mobileApiClient, queryClient),
  );

  const resetBuilder = () => {
    setBuilderOpen(false);
    setEditingPlanId(null);
    setTitle("My weekly split");
    setGoal("maintenance");
    setDraftDays({});
    setActiveDraftDay(1);
    setExerciseSearch("");
  };

  const openCreate = () => {
    setMessage("");
    setEditingPlanId(null);
    setTitle("My weekly split");
    setGoal("maintenance");
    setDraftDays({
      1: { exercises: [], focusLabel: "Monday training" },
    });
    setActiveDraftDay(1);
    setBuilderOpen(true);
  };

  const openEdit = async (plan: TrainingPlanSummaryRecord) => {
    setMessage("");
    try {
      const detail = await mobileApiClient.fitness.getPlanById(plan.id);
      const nextDraft = detailToDraft(detail);
      const firstDay = Number(Object.keys(nextDraft)[0] ?? 1);
      setEditingPlanId(plan.id);
      setTitle(plan.title);
      setGoal(plan.goal);
      setDraftDays(nextDraft);
      setActiveDraftDay(firstDay);
      setBuilderOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open plan.");
    }
  };

  const toggleDay = (dayOfWeek: number) => {
    setDraftDays((current) => {
      if (current[dayOfWeek]) {
        const next = { ...current };
        delete next[dayOfWeek];
        const remaining = Object.keys(next).map(Number);
        if (activeDraftDay === dayOfWeek && remaining.length > 0) {
          setActiveDraftDay(remaining[0]);
        }
        return next;
      }
      setActiveDraftDay(dayOfWeek);
      return {
        ...current,
        [dayOfWeek]: {
          exercises: [],
          focusLabel: `${DAY_NAMES[dayOfWeek]} training`,
        },
      };
    });
  };

  const patchExercise = (
    exerciseId: string,
    patch: Partial<Pick<DraftExercise, "reps" | "sets">>,
  ) => {
    setDraftDays((current) => ({
      ...current,
      [activeDraftDay]: {
        ...current[activeDraftDay],
        exercises: current[activeDraftDay].exercises.map((exercise) =>
          exercise.exerciseId === exerciseId ? { ...exercise, ...patch } : exercise,
        ),
      },
    }));
  };

  const savePlan = async () => {
    setMessage("");
    const input = toPlanInput(title, goal, draftDays);
    if (!input.title) {
      setMessage("Give this plan a clear name.");
      return;
    }
    if (
      input.schedule.length === 0 ||
      input.schedule.some((day) => day.exercises.length === 0)
    ) {
      setMessage("Every selected training day needs at least one exercise.");
      return;
    }

    try {
      if (editingPlanId) {
        await updateMutation.mutateAsync({
          input,
          planId: editingPlanId,
          userId: user?.id,
        });
        setMessage("Workout plan updated.");
      } else {
        const created = await createMutation.mutateAsync({
          input,
          userId: user?.id,
        });
        const coachPlanIsActive = plans.some(
          (plan) =>
            plan.isActive &&
            (plan.source === "coach_assigned" || Boolean(plan.coachId)),
        );
        if (coachPlanIsActive) {
          setMessage(
            "Personal plan saved. Your coach plan remains active until you choose to switch.",
          );
        } else {
          await activateMutation.mutateAsync({
            planId: created.id,
            userId: user?.id,
          });
          setMessage("Workout plan created and selected.");
        }
      }
      resetBuilder();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save plan.");
    }
  };

  const selectPlan = (plan: TrainingPlanSummaryRecord) => {
    const activate = async () => {
      try {
        await activateMutation.mutateAsync({
          planId: plan.id,
          userId: user?.id,
        });
        setMessage(`${plan.title} is now your active plan.`);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unable to select plan.",
        );
      }
    };

    const replacesCoachDefault =
      plans.some((candidate) => candidate.isActive && candidate.coachId) &&
      !plan.coachId;
    if (replacesCoachDefault) {
      setConfirmation({
        confirmLabel: "Use personal plan",
        message:
          "Your coach plan stays saved, but this personal preset becomes the workout shown each day.",
        onConfirm: activate,
        title: "Switch from coach plan?",
      });
      return;
    }
    void activate();
  };

  const confirmDeletePlan = (plan: TrainingPlanSummaryRecord) => {
    setConfirmation({
      confirmLabel: "Delete",
      destructive: true,
      message:
        "This removes the preset but keeps completed workout history.",
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync({
            planId: plan.id,
            userId: user?.id,
          });
          setMessage("Workout plan deleted.");
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Unable to delete plan.",
          );
        }
      },
      title: "Delete workout plan?",
    });
  };

  const activeDay = draftDays[activeDraftDay];

  return (
    <View style={{ backgroundColor: colors.base, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ gap: 14, padding: 18, paddingBottom: 44 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <Pressable
            accessibilityLabel="Back to today's workout"
            accessibilityRole="button"
            onPress={builderOpen ? resetBuilder : onBack}
            style={{
              alignItems: "center",
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              borderRadius: 9,
              borderWidth: 1,
              height: 38,
              justifyContent: "center",
              width: 38,
            }}
          >
            <ArrowLeft size={18} color={colors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <FitText
              style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "900" }}
            >
              {builderOpen ? (editingPlanId ? "Edit plan" : "Create plan") : "Workout plans"}
            </FitText>
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              {builderOpen
                ? "Configure each training day without crowding today's workout."
                : "Choose the preset FitTrack should schedule automatically."}
            </FitText>
          </View>
        </View>

        {message ? (
          <View
            style={{
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              borderRadius: 8,
              borderWidth: 1,
              padding: 10,
            }}
          >
            <FitText style={{ color: colors.textPrimary, fontSize: 11 }}>
              {message}
            </FitText>
          </View>
        ) : null}

        {!builderOpen ? (
          <>
            {hasCoachManagedPlan ? (
              <View
                style={{
                  backgroundColor: `${colors.brand}12`,
                  borderColor: `${colors.brand}55`,
                  borderRadius: 9,
                  borderWidth: 1,
                  gap: 4,
                  padding: 11,
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    gap: 7,
                  }}
                >
                  <Dumbbell color={colors.brand} size={15} />
                  <FitText
                    style={{
                      color: colors.textPrimary,
                      fontSize: 12,
                      fontWeight: "900",
                    }}
                  >
                    Your coach has shared a plan
                  </FitText>
                </View>
                <FitText
                  style={{ color: colors.textMuted, fontSize: 10.5, lineHeight: 16 }}
                >
                  Coach plans are highlighted below. You can use one or keep
                  training with a personal plan.
                </FitText>
              </View>
            ) : null}
            <FitButton icon={Plus} label="Create Personal Plan" onPress={openCreate} />

            <View style={{ gap: 9 }}>
              {plans.map((plan) => (
                <View
                  key={plan.id}
                  style={{
                    backgroundColor:
                      plan.source === "coach_assigned" || plan.coachId
                        ? `${colors.brand}10`
                        : colors.surfaceRaised,
                    borderColor:
                      plan.source === "coach_assigned" || plan.coachId
                        ? `${colors.brand}85`
                        : plan.isActive
                          ? colors.brand
                          : colors.border,
                    borderRadius: 10,
                    borderWidth: 1,
                    gap: 10,
                    padding: 12,
                  }}
                >
                  <View
                    style={{
                      alignItems: "flex-start",
                      flexDirection: "row",
                      gap: 10,
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1, gap: 3 }}>
                      <FitText
                        style={{
                          color: colors.textPrimary,
                          fontSize: 14,
                          fontWeight: "900",
                        }}
                      >
                        {plan.title}
                      </FitText>
                      <View
                        style={{
                          alignItems: "center",
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor:
                              plan.source === "coach_assigned" || plan.coachId
                                ? `${colors.brand}20`
                                : `${colors.textMuted}12`,
                            borderColor:
                              plan.source === "coach_assigned" || plan.coachId
                                ? `${colors.brand}70`
                                : colors.border,
                            borderRadius: 6,
                            borderWidth: 1,
                            paddingHorizontal: 6,
                            paddingVertical: 3,
                          }}
                        >
                          <FitText
                            style={{
                              color:
                                plan.source === "coach_assigned" || plan.coachId
                                  ? colors.brand
                                  : colors.textMuted,
                              fontSize: 8.5,
                              fontWeight: "900",
                              letterSpacing: 0.4,
                            }}
                          >
                            {sourceLabel(plan).toUpperCase()}
                          </FitText>
                        </View>
                        <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
                          {plan.daysPerWeek} days/week
                        </FitText>
                      </View>
                    </View>
                    {plan.isActive ? (
                      <View
                        style={{
                          alignItems: "center",
                          backgroundColor: `${colors.success}14`,
                          borderRadius: 7,
                          flexDirection: "row",
                          gap: 4,
                          paddingHorizontal: 7,
                          paddingVertical: 5,
                        }}
                      >
                        <Check size={12} color={colors.success} />
                        <FitText
                          style={{
                            color: colors.success,
                            fontSize: 9,
                            fontWeight: "900",
                          }}
                        >
                          ACTIVE
                        </FitText>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {!plan.isActive ? (
                      <FitButton
                        disabled={activateMutation.isPending}
                        label={
                          plan.source === "coach_assigned" || plan.coachId
                            ? "Use Coach Plan"
                            : "Use Personal Plan"
                        }
                        onPress={() => selectPlan(plan)}
                        variant="ghost"
                      />
                    ) : null}
                    {plan.source === "self_created" ? (
                      <FitButton
                        label="Edit"
                        onPress={() => void openEdit(plan)}
                        variant="ghost"
                      />
                    ) : null}
                    {plan.source === "self_created" ? (
                      <FitButton
                        icon={Trash2}
                        label="Delete"
                        onPress={() => confirmDeletePlan(plan)}
                        variant="ghost"
                      />
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={{ gap: 7 }}>
              <FitText
                style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "800" }}
              >
                Plan name
              </FitText>
              <TextInput
                accessibilityLabel="Workout plan name"
                onChangeText={setTitle}
                placeholder="Push Pull Legs"
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                  borderRadius: 9,
                  borderWidth: 1,
                  color: colors.textPrimary,
                  minHeight: 44,
                  paddingHorizontal: 12,
                }}
                value={title}
              />
            </View>

            <View style={{ gap: 7 }}>
              <FitText
                style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "800" }}
              >
                Goal
              </FitText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {GOALS.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    key={item.value}
                    onPress={() => setGoal(item.value)}
                    style={{
                      backgroundColor:
                        goal === item.value
                          ? `${colors.brand}20`
                          : colors.surfaceRaised,
                      borderColor:
                        goal === item.value ? colors.brand : colors.border,
                      borderRadius: 8,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                    }}
                  >
                    <FitText
                      style={{
                        color:
                          goal === item.value ? colors.brand : colors.textPrimary,
                        fontSize: 10.5,
                        fontWeight: "800",
                      }}
                    >
                      {item.label}
                    </FitText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ gap: 7 }}>
              <FitText
                style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "800" }}
              >
                Training days
              </FitText>
              <View style={{ flexDirection: "row", gap: 5 }}>
                {DAY_NAMES.map((day, dayOfWeek) => {
                  const selected = Boolean(draftDays[dayOfWeek]);
                  const active = activeDraftDay === dayOfWeek;
                  return (
                    <Pressable
                      accessibilityLabel={`${day} ${selected ? "selected" : "not selected"}`}
                      accessibilityRole="button"
                      key={day}
                      onLongPress={() => toggleDay(dayOfWeek)}
                      onPress={() =>
                        selected ? setActiveDraftDay(dayOfWeek) : toggleDay(dayOfWeek)
                      }
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
                        flex: 1,
                        minHeight: 38,
                        justifyContent: "center",
                      }}
                    >
                      <FitText
                        style={{
                          color: selected ? colors.brand : colors.textMuted,
                          fontSize: 9.5,
                          fontWeight: "900",
                        }}
                      >
                        {day}
                      </FitText>
                    </Pressable>
                  );
                })}
              </View>
              <FitText style={{ color: colors.textMuted, fontSize: 9.5 }}>
                Tap a selected day to edit it. Long-press to remove it.
              </FitText>
            </View>

            {activeDay ? (
              <>
                <TextInput
                  accessibilityLabel={`${DAY_NAMES[activeDraftDay]} workout label`}
                  onChangeText={(focusLabel) =>
                    setDraftDays((current) => ({
                      ...current,
                      [activeDraftDay]: {
                        ...current[activeDraftDay],
                        focusLabel,
                      },
                    }))
                  }
                  placeholder="Push day"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.border,
                    borderRadius: 9,
                    borderWidth: 1,
                    color: colors.textPrimary,
                    minHeight: 42,
                    paddingHorizontal: 12,
                  }}
                  value={activeDay.focusLabel}
                />

                <View style={{ gap: 8 }}>
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
                            fontSize: 12,
                            fontWeight: "900",
                          }}
                        >
                          {exercise.exerciseName}
                        </FitText>
                        <Pressable
                          accessibilityLabel={`Remove ${exercise.exerciseName}`}
                          onPress={() =>
                            setDraftDays((current) => ({
                              ...current,
                              [activeDraftDay]: {
                                ...current[activeDraftDay],
                                exercises: current[
                                  activeDraftDay
                                ].exercises.filter(
                                  (item) =>
                                    item.exerciseId !== exercise.exerciseId,
                                ),
                              },
                            }))
                          }
                        >
                          <Trash2 size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {[
                          {
                            key: "sets" as const,
                            label: "Sets",
                            max: 20,
                            min: 1,
                            value: exercise.sets,
                          },
                          {
                            key: "reps" as const,
                            label: "Reps",
                            max: 100,
                            min: 1,
                            value: exercise.reps,
                          },
                        ].map((control) => (
                          <View
                            key={control.key}
                            style={{
                              alignItems: "center",
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                              borderRadius: 8,
                              borderWidth: 1,
                              flex: 1,
                              flexDirection: "row",
                              justifyContent: "space-between",
                              padding: 7,
                            }}
                          >
                            <Pressable
                              accessibilityLabel={`Decrease ${control.label}`}
                              onPress={() =>
                                patchExercise(exercise.exerciseId, {
                                  [control.key]: Math.max(
                                    control.min,
                                    control.value - 1,
                                  ),
                                })
                              }
                            >
                              <Minus size={15} color={colors.textMuted} />
                            </Pressable>
                            <FitText
                              style={{
                                color: colors.textPrimary,
                                fontSize: 10.5,
                                fontWeight: "800",
                              }}
                            >
                              {control.value} {control.label}
                            </FitText>
                            <Pressable
                              accessibilityLabel={`Increase ${control.label}`}
                              onPress={() =>
                                patchExercise(exercise.exerciseId, {
                                  [control.key]: Math.min(
                                    control.max,
                                    control.value + 1,
                                  ),
                                })
                              }
                            >
                              <Plus size={15} color={colors.brand} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>

                <TextInput
                  accessibilityLabel="Search exercise catalog"
                  onChangeText={setExerciseSearch}
                  placeholder="Search exercises"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.border,
                    borderRadius: 9,
                    borderWidth: 1,
                    color: colors.textPrimary,
                    minHeight: 42,
                    paddingHorizontal: 12,
                  }}
                  value={exerciseSearch}
                />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {exercises.length === 0 ? (
                    <FitText
                      style={{
                        color: colors.textMuted,
                        fontSize: 10.5,
                        paddingVertical: 6,
                      }}
                    >
                      No exercises match this search.
                    </FitText>
                  ) : null}
                  {exercises.map((exercise) => {
                    const selected = activeDay.exercises.some(
                      (item) => item.exerciseId === exercise.id,
                    );
                    return (
                      <Pressable
                        accessibilityRole="button"
                        disabled={selected}
                        key={exercise.id}
                        onPress={() =>
                          setDraftDays((current) => ({
                            ...current,
                            [activeDraftDay]: {
                              ...current[activeDraftDay],
                              exercises: [
                                ...current[activeDraftDay].exercises,
                                {
                                  exerciseId: exercise.id,
                                  exerciseName: exercise.name,
                                  reps: 10,
                                  restSeconds: 60,
                                  sets: 3,
                                },
                              ],
                            },
                          }))
                        }
                        style={{
                          backgroundColor: selected
                            ? `${colors.success}12`
                            : colors.surfaceRaised,
                          borderColor: selected ? colors.success : colors.border,
                          borderRadius: 8,
                          borderWidth: 1,
                          opacity: selected ? 0.65 : 1,
                          paddingHorizontal: 9,
                          paddingVertical: 7,
                        }}
                      >
                        <FitText
                          style={{
                            color: selected ? colors.success : colors.textPrimary,
                            fontSize: 9.5,
                            fontWeight: "800",
                          }}
                        >
                          {selected ? "Added · " : "+ "}
                          {exercise.name}
                        </FitText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <FitButton label="Cancel" onPress={resetBuilder} variant="ghost" />
              </View>
              <View style={{ flex: 1 }}>
                <FitButton
                  disabled={createMutation.isPending || updateMutation.isPending}
                  label={
                    createMutation.isPending || updateMutation.isPending
                      ? "Saving"
                      : editingPlanId
                        ? "Save Changes"
                        : "Create Plan"
                  }
                  onPress={() => void savePlan()}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <ConfirmModal
        isDestructive={confirmation?.destructive}
        isLoading={activateMutation.isPending || deleteMutation.isPending}
        isVisible={Boolean(confirmation)}
        message={confirmation?.message ?? ""}
        noLabel="Cancel"
        onNo={() => setConfirmation(null)}
        onYes={() => {
          const action = confirmation?.onConfirm;
          setConfirmation(null);
          if (action) void action();
        }}
        title={confirmation?.title ?? ""}
        yesLabel={confirmation?.confirmLabel ?? "Confirm"}
      />
    </View>
  );
}
