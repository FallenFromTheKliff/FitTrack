import { useMemo, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Minus, Plus, Trash2 } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FitnessGoal } from "@fittrack/types";
import {
  assignFitnessPlanMutationOptions,
  activateFitnessPlanMutationOptions,
  createFitnessPlanMutationOptions,
  fitnessExercisesQueryOptions,
  fitnessClientPlansQueryOptions,
  fitnessPlansQueryOptions,
} from "@fittrack/query";

import { FitButton, FitText } from "@/components/fit";
import ExerciseRestTimerModal from "@/components/workout/ExerciseRestTimerModal";
import {
  DAY_NAMES,
  toPlanInput,
  type DraftDays,
  type DraftExercise,
} from "@/components/workout/workoutPlanDraft";
import {
  createCoachWorkoutPlanDraft,
  createCoachWorkoutPlanTransition,
  createSingleSubmitGate,
  resolvePublishedCoachPlanId,
  type CoachWorkoutPlanTransition,
} from "@/components/bookings/coachClientWorkoutPublish";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";

export function CoachClientWorkoutPlan({
  coachUserId,
  memberId,
  onPublished,
}: {
  coachUserId: string;
  memberId: string;
  onPublished?: (transition: CoachWorkoutPlanTransition) => boolean | void;
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const saveInFlightRef = useRef(createSingleSubmitGate());
  const createdPlanIdRef = useRef<string | null>(null);
  const publishedPlanIdRef = useRef<string | null>(null);
  const [title, setTitle] = useState("Client weekly split");
  const goal: FitnessGoal = "maintenance";
  const initialDay = new Date().getDay();
  const [draftDays, setDraftDays] = useState<DraftDays>({
    [initialDay]: {
      exercises: [],
      focusLabel: `${DAY_NAMES[initialDay]} training`,
    },
  });
  const [activeDraftDay, setActiveDraftDay] = useState(initialDay);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [message, setMessage] = useState("");
  const [builderError, setBuilderError] = useState("");
  const [restEditorExerciseId, setRestEditorExerciseId] = useState<
    string | null
  >(null);

  const plansQuery = useQuery({
    ...fitnessPlansQueryOptions(mobileApiClient, coachUserId, { limit: 50, page: 1 }),
    enabled: !!coachUserId,
  });
  const exercisesQuery = useQuery({
    ...fitnessExercisesQueryOptions(mobileApiClient, { limit: 100, page: 1 }),
    enabled: !!coachUserId,
  });
  const clientPlansQuery = useQuery({
    ...fitnessClientPlansQueryOptions(
      mobileApiClient,
      coachUserId,
      memberId,
      { limit: 50, page: 1 },
    ),
    enabled: !!coachUserId && !!memberId,
  });
  const createMutation = useMutation(
    createFitnessPlanMutationOptions(mobileApiClient, queryClient),
  );
  const assignMutation = useMutation(
    assignFitnessPlanMutationOptions(mobileApiClient, queryClient),
  );
  const activateMutation = useMutation(
    activateFitnessPlanMutationOptions(mobileApiClient, queryClient),
  );

  const exercises = useMemo(
    () => exercisesQuery.data?.data ?? [],
    [exercisesQuery.data?.data],
  );
  const coachPresets = plansQuery.data?.data ?? [];
  const pendingAiDrafts = (clientPlansQuery.data?.data ?? []).filter(
    (plan) =>
      plan.source === "ai_generated" &&
      plan.coachId === coachUserId &&
      !plan.isActive,
  );
  const activeDay = draftDays[activeDraftDay];
  const restEditorExercise = activeDay?.exercises.find(
    (exercise) => exercise.exerciseId === restEditorExerciseId,
  );
  const inputStyle = {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 42,
    paddingHorizontal: 12,
  } as const;
  const isPublishing = createMutation.isPending || assignMutation.isPending;

  const toggleDay = (dayOfWeek: number) => {
    setBuilderError("");
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
    patch: Partial<
      Pick<DraftExercise, "reps" | "restSeconds" | "restSecondsBySet" | "sets">
    >,
  ) => {
    setBuilderError("");
    setDraftDays((current) => ({
      ...current,
      [activeDraftDay]: {
        ...current[activeDraftDay],
        exercises: current[activeDraftDay].exercises.map((exercise) => {
          if (exercise.exerciseId !== exerciseId) return exercise;
          const next = { ...exercise, ...patch };
          if (next.restSecondsBySet) {
            next.restSecondsBySet = Array.from(
              { length: next.sets },
              (_, index) => next.restSecondsBySet?.[index] ?? next.restSeconds,
            );
          }
          return next;
        }),
      },
    }));
  };

  const removeExercise = (exerciseId: string) => {
    setBuilderError("");
    setDraftDays((current) => ({
      ...current,
      [activeDraftDay]: {
        ...current[activeDraftDay],
        exercises: current[activeDraftDay].exercises.filter(
          (exercise) => exercise.exerciseId !== exerciseId,
        ),
      },
    }));
  };

  const addExercise = (exercise: (typeof exercises)[number]) => {
    setBuilderError("");
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
            restSeconds: 75,
            restSecondsBySet: null,
            sets: 3,
          },
        ],
      },
    }));
  };

  const resetBuilderDraft = () => {
    const reset = createCoachWorkoutPlanDraft();
    setTitle(reset.title);
    setDraftDays(reset.draftDays);
    setActiveDraftDay(reset.activeDraftDay);
    setExerciseSearch(reset.exerciseSearch);
    setMessage(reset.message);
    setBuilderError(reset.builderError);
    setRestEditorExerciseId(null);
  };

  const createAndAssign = async () => {
    if (publishedPlanIdRef.current) {
      setMessage(
        "This plan is already published. Open Create monthly plan to continue without creating a duplicate.",
      );
      return;
    }

    if (!saveInFlightRef.current.tryAcquire()) return;

    setMessage("");
    setBuilderError("");
    try {
      let planId = createdPlanIdRef.current;
      if (!planId) {
        const input = toPlanInput(title, goal, draftDays);

        if (!input.title) {
          setBuilderError("Give this plan a clear name.");
          return;
        }
        const emptyDay = input.schedule.find(
          (day) => day.exercises.length === 0,
        );
        if (input.schedule.length === 0 || emptyDay) {
          if (emptyDay) setActiveDraftDay(emptyDay.dayOfWeek);
          setBuilderError(
            emptyDay
              ? `Add at least one exercise to ${DAY_NAMES[emptyDay.dayOfWeek]}.`
              : "Select at least one training day.",
          );
          return;
        }

        const created = await createMutation.mutateAsync({
          input,
          userId: coachUserId,
        });
        planId = created.id;
        createdPlanIdRef.current = planId;
      }

      const assignedPlan = await assignMutation.mutateAsync({
        memberId,
        planId,
        userId: coachUserId,
      });
      const publishedPlanId = resolvePublishedCoachPlanId(
        assignedPlan,
        memberId,
        coachUserId,
      );

      publishedPlanIdRef.current = publishedPlanId;
      resetBuilderDraft();
      setMessage("Coach plan published and set as the client's active plan.");

      try {
        const didTransition = onPublished?.(
          createCoachWorkoutPlanTransition(memberId, publishedPlanId),
        );
        if (didTransition === false) {
          setMessage(
            "Plan published. Monthly plan setup could not open; switch to Overview and open Create monthly plan. No duplicate was created.",
          );
        }
      } catch {
        setMessage(
          "Plan published. Monthly plan setup could not open; switch to Overview and open Create monthly plan. No duplicate was created.",
        );
      }
    } catch (error) {
      setBuilderError(
        createdPlanIdRef.current
          ? "Plan was created but could not be assigned. Press Create and Publish again to retry without creating another plan."
          : error instanceof Error
            ? error.message
            : "Unable to publish plan.",
      );
    } finally {
      saveInFlightRef.current.release();
    }
  };

  const sortedExercises = useMemo(
    () => [...exercises].sort((a, b) => a.name.localeCompare(b.name)),
    [exercises],
  );
  const visibleExercises = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    const filtered = query
      ? sortedExercises.filter((exercise) =>
          `${exercise.name} ${exercise.muscleGroup ?? ""}`
            .toLowerCase()
            .includes(query),
        )
      : sortedExercises;

    return filtered.slice(0, 24);
  }, [exerciseSearch, sortedExercises]);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <FitText style={{ color: colors.brand, fontSize: 13, fontWeight: "900" }}>
          CLIENT WORKOUT PLAN
        </FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
          Build a multi-day split with per-exercise sets, reps, rest, and focus labels.
        </FitText>
      </View>

      <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>
        PLAN NAME
      </FitText>
      <TextInput
        accessibilityLabel="Workout preset name"
        onChangeText={setTitle}
        placeholder="Preset name"
        placeholderTextColor={colors.textMuted}
        style={inputStyle}
        value={title}
      />

      <View style={{ gap: 7 }}>
        <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>
          TRAINING DAYS
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
      <View style={{ gap: 10 }}>
        <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>
          EXERCISES
        </FitText>
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
          style={inputStyle}
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
                  accessibilityRole="button"
                  onPress={() => removeExercise(exercise.exerciseId)}
                >
                  <Trash2 size={16} color={colors.danger} />
                </Pressable>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
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
                      flexBasis: 72,
                      flex: 1,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      minWidth: 72,
                      paddingHorizontal: 5,
                      paddingVertical: 7,
                    }}
                  >
                    <Pressable
                      accessibilityLabel={`Decrease ${control.label}`}
                      accessibilityRole="button"
                      onPress={() =>
                        patchExercise(exercise.exerciseId, {
                          [control.key]: Math.max(
                            control.min,
                            control.value - 1,
                          ),
                        })
                      }
                    >
                      <Minus size={14} color={colors.textMuted} />
                    </Pressable>
                    <FitText
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                      numberOfLines={1}
                      style={{
                        color: colors.textPrimary,
                        fontSize: 9.5,
                        flex: 1,
                        fontWeight: "800",
                        minWidth: 0,
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
                          [control.key]: Math.min(
                            control.max,
                            control.value + 1,
                          ),
                        })
                      }
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
                    flexBasis: 72,
                    flex: 1,
                    flexDirection: "row",
                    justifyContent: "center",
                    minWidth: 72,
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
                      fontSize: 9.5,
                      flex: 1,
                      fontWeight: "800",
                      minWidth: 0,
                      textAlign: "center",
                    }}
                  >
                    {exercise.restSecondsBySet
                      ? "Set times"
                      : `Rest ${exercise.restSeconds}s`}
                  </FitText>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <TextInput
          accessibilityLabel="Search exercise catalog"
          onChangeText={setExerciseSearch}
          placeholder="Search exercises"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
          value={exerciseSearch}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {visibleExercises.map((exercise) => {
            const selected = activeDay.exercises.some(
              (item) => item.exerciseId === exercise.id,
            );
            return (
              <Pressable
                disabled={selected}
                accessibilityRole="button"
                key={exercise.id}
                onPress={() => addExercise(exercise)}
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
        {!exercisesQuery.isLoading && visibleExercises.length === 0 ? (
          <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
            No exercises match this search.
          </FitText>
        ) : null}
        <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
          {activeDay.exercises.length} exercise
          {activeDay.exercises.length === 1 ? "" : "s"} on {DAY_NAMES[activeDraftDay]}.
        </FitText>
      </View>
      ) : null}

      <FitButton
        disabled={isPublishing}
        label={
          isPublishing ? "PUBLISHING PLAN" : "CREATE AND PUBLISH"
        }
        loading={isPublishing}
        loadingLabel="PUBLISHING"
        onPress={() => void createAndAssign()}
        style={{ minHeight: 48, paddingHorizontal: 12, paddingVertical: 12 }}
        textStyle={{
          flexShrink: 1,
          fontSize: 14,
          fontWeight: "800",
          textAlign: "center",
        }}
      />

      {builderError ? (
        <FitText
          accessibilityLiveRegion="polite"
          style={{ color: colors.danger, fontSize: 12, fontWeight: "700" }}
        >
          {builderError}
        </FitText>
      ) : null}

      {pendingAiDrafts.length ? (
        <View style={{ gap: 8 }}>
          <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>
            AI DRAFTS WAITING FOR REVIEW
          </FitText>
          {pendingAiDrafts.map((plan) => (
            <View
              key={plan.id}
              style={{
                alignItems: "center",
                borderColor: colors.warning,
                borderRadius: 9,
                borderWidth: 1,
                flexDirection: "row",
                gap: 10,
                justifyContent: "space-between",
                padding: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <FitText
                  style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "800" }}
                >
                  {plan.title}
                </FitText>
                <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
                  Review the generated split before approval.
                </FitText>
              </View>
              <FitButton
                disabled={activateMutation.isPending}
                label="Approve"
                onPress={() =>
                  void activateMutation
                    .mutateAsync({
                      planId: plan.id,
                      userId: coachUserId,
                    })
                    .then(() => {
                      setMessage("AI draft approved and activated for this client.");
                      return clientPlansQuery.refetch();
                    })
                    .catch((error: unknown) =>
                      setMessage(
                        error instanceof Error ? error.message : "Unable to approve draft.",
                      ),
                    )
                }
              />
            </View>
          ))}
        </View>
      ) : null}

      {coachPresets.length ? (
        <View style={{ gap: 8 }}>
          <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>
            EXISTING PRESETS
          </FitText>
          {coachPresets.map((plan) => (
            <View
              key={plan.id}
              style={{
                alignItems: "center",
                borderColor: colors.border,
                borderRadius: 9,
                borderWidth: 1,
                flexDirection: "row",
                gap: 10,
                justifyContent: "space-between",
                padding: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <FitText
                  style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "800" }}
                >
                  {plan.title}
                </FitText>
                <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
                  {plan.daysPerWeek} day split
                </FitText>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {message ? (
        <FitText
          accessibilityLiveRegion="polite"
          style={{
            color: message.includes("published") || message.includes("approved")
              ? colors.success
              : colors.danger,
            fontSize: 12,
          }}
        >
        {message}
        </FitText>
      ) : null}

      <ExerciseRestTimerModal
        exerciseName={restEditorExercise?.exerciseName ?? "Exercise"}
        isVisible={Boolean(restEditorExercise)}
        onClose={() => setRestEditorExerciseId(null)}
        onSave={({ restSeconds, restSecondsBySet }) => {
          if (!restEditorExercise) return;
          patchExercise(restEditorExercise.exerciseId, {
            restSeconds,
            restSecondsBySet,
          });
          setRestEditorExerciseId(null);
        }}
        restSeconds={restEditorExercise?.restSeconds ?? 75}
        restSecondsBySet={restEditorExercise?.restSecondsBySet ?? null}
        sets={restEditorExercise?.sets ?? 1}
      />
    </View>
  );
}
