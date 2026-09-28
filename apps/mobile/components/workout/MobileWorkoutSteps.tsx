import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Camera, Check, Clock3, Plus } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateFitnessPlanMutationOptions,
  completeWorkoutSessionMutationOptions,
  createFitnessPlanMutationOptions,
  fitnessExercisesQueryOptions,
  fitnessPlanDetailQueryOptions,
  fitnessPlansQueryOptions,
  fitnessSessionDetailQueryOptions,
  fitnessSessionsQueryOptions,
  logWorkoutSetMutationOptions,
  startWorkoutSessionMutationOptions,
} from "@fittrack/query";

import { FitButton, FitText } from "@/components/fit";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";

export function MobileWorkoutSteps({
  onShowCamera,
}: {
  onShowCamera: () => void;
}) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [quickPresetOpen, setQuickPresetOpen] = useState(false);
  const [quickPresetTitle, setQuickPresetTitle] = useState("My training day");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [restRemaining, setRestRemaining] = useState(0);

  const plansQuery = useQuery({
    ...fitnessPlansQueryOptions(mobileApiClient, user?.id, {
      limit: 50,
      page: 1,
    }),
    enabled: !!user?.id,
  });
  const sessionsQuery = useQuery({
    ...fitnessSessionsQueryOptions(mobileApiClient, user?.id, {
      limit: 20,
      page: 1,
    }),
    enabled: !!user?.id,
  });
  const plans = plansQuery.data?.data ?? [];
  const activeSession =
    (sessionsQuery.data?.data ?? []).find(
      (session) => session.status === "in_progress",
    ) ?? null;
  const effectivePlan =
    plans.find((plan) => plan.id === selectedPlanId) ??
    plans.find((plan) => plan.isActive) ??
    plans[0] ??
    null;
  const planDetailQuery = useQuery({
    ...fitnessPlanDetailQueryOptions(mobileApiClient, effectivePlan?.id),
    enabled: !!effectivePlan?.id,
  });
  const sessionDetailQuery = useQuery({
    ...fitnessSessionDetailQueryOptions(mobileApiClient, activeSession?.id),
    enabled: !!activeSession?.id,
  });
  const exercisesQuery = useQuery({
    ...fitnessExercisesQueryOptions(mobileApiClient, { limit: 100, page: 1 }),
    enabled: !!user?.id,
  });

  const activateMutation = useMutation(
    activateFitnessPlanMutationOptions(mobileApiClient, queryClient),
  );
  const createMutation = useMutation(
    createFitnessPlanMutationOptions(mobileApiClient, queryClient),
  );
  const startMutation = useMutation(
    startWorkoutSessionMutationOptions(mobileApiClient, queryClient),
  );
  const logMutation = useMutation(
    logWorkoutSetMutationOptions(mobileApiClient, queryClient),
  );
  const completeMutation = useMutation(
    completeWorkoutSessionMutationOptions(mobileApiClient, queryClient),
  );

  const plan = planDetailQuery.data ?? null;
  const session = sessionDetailQuery.data ?? null;
  const today = new Date().getDay();
  const day = plan?.scheduleDays.find(
    (candidate) => candidate.weekNumber === 1 && candidate.dayOfWeek === today,
  );
  const completed = useMemo(
    () =>
      new Set(
        (session?.exerciseLogs ?? [])
          .filter((log) => log.planExerciseId)
          .map((log) => `${log.planExerciseId}:${log.setNumber}`),
      ),
    [session?.exerciseLogs],
  );
  const requiredSets =
    day?.exercises.reduce((total, exercise) => total + exercise.sets, 0) ?? 0;

  useEffect(() => {
    if (restRemaining <= 0) return;
    const timer = setInterval(
      () => setRestRemaining((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [restRemaining]);

  const fieldStyle = {
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 42,
    paddingHorizontal: 12,
  } as const;

  return (
    <View style={{ gap: 14, marginBottom: 16 }}>
      <View style={{ gap: 4 }}>
        <FitText
          style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "900" }}
        >
          Today&apos;s workout
        </FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
          Follow the steps manually. Camera rep counting is optional.
        </FitText>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {plans.map((item) => {
          const selected = item.id === effectivePlan?.id;
          return (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => {
                setSelectedPlanId(item.id);
                if (user?.id) {
                  void activateMutation.mutateAsync({
                    planId: item.id,
                    userId: user.id,
                  });
                }
              }}
              style={{
                backgroundColor: selected
                  ? `${colors.brand}22`
                  : colors.surfaceRaised,
                borderColor: selected ? colors.brand : colors.border,
                borderRadius: 9,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 9,
              }}
            >
              <FitText
                style={{
                  color: selected ? colors.brand : colors.textPrimary,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {item.title}
              </FitText>
            </Pressable>
          );
        })}
      </View>

      <FitButton
        icon={Plus}
        label={quickPresetOpen ? "Close Quick Preset" : "Create Quick Preset"}
        onPress={() => setQuickPresetOpen((current) => !current)}
        variant="ghost"
      />

      {quickPresetOpen ? (
        <View
          style={{
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderRadius: 10,
            borderWidth: 1,
            gap: 10,
            padding: 12,
          }}
        >
          <TextInput
            accessibilityLabel="Quick preset name"
            onChangeText={setQuickPresetTitle}
            placeholder="Preset name"
            placeholderTextColor={colors.textMuted}
            style={fieldStyle}
            value={quickPresetTitle}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {(exercisesQuery.data?.data ?? []).slice(0, 12).map((exercise) => {
              const selected =
                exercise.id ===
                (selectedExerciseId || exercisesQuery.data?.data[0]?.id);
              return (
                <Pressable
                  accessibilityRole="button"
                  key={exercise.id}
                  onPress={() => setSelectedExerciseId(exercise.id)}
                  style={{
                    backgroundColor: selected
                      ? `${colors.brand}22`
                      : colors.surface,
                    borderColor: selected ? colors.brand : colors.border,
                    borderRadius: 8,
                    borderWidth: 1,
                    paddingHorizontal: 9,
                    paddingVertical: 7,
                  }}
                >
                  <FitText
                    style={{
                      color: selected ? colors.brand : colors.textPrimary,
                      fontSize: 10.5,
                      fontWeight: "700",
                    }}
                  >
                    {exercise.name}
                  </FitText>
                </Pressable>
              );
            })}
          </View>
          <FitButton
            disabled={
              createMutation.isPending ||
              !(selectedExerciseId || exercisesQuery.data?.data[0]?.id)
            }
            label={
              createMutation.isPending ? "Saving Preset" : "Save Today Preset"
            }
            onPress={async () => {
              const exerciseId =
                selectedExerciseId || exercisesQuery.data?.data[0]?.id;
              if (!user?.id || !exerciseId || !quickPresetTitle.trim()) return;
              const created = await createMutation.mutateAsync({
                input: {
                  daysPerWeek: 1,
                  durationWeeks: 12,
                  goal: "maintenance",
                  schedule: [
                    {
                      dayOfWeek: today,
                      exercises: [
                        {
                          exerciseId,
                          orderIndex: 0,
                          reps: 10,
                          restSeconds: 75,
                          sets: 3,
                        },
                      ],
                      focusLabel: "Training day",
                      weekNumber: 1,
                    },
                  ],
                  title: quickPresetTitle.trim(),
                },
                userId: user.id,
              });
              await activateMutation.mutateAsync({
                planId: created.id,
                userId: user.id,
              });
              setSelectedPlanId(created.id);
              setQuickPresetOpen(false);
            }}
          />
        </View>
      ) : null}

      {!activeSession ? (
        <FitButton
          disabled={!effectivePlan || startMutation.isPending}
          label={
            startMutation.isPending
              ? "Starting Workout"
              : "Start Today’s Workout"
          }
          onPress={() => {
            if (!user?.id || !effectivePlan) return;
            void startMutation.mutateAsync({
              input: { planId: effectivePlan.id },
              userId: user.id,
            });
          }}
        />
      ) : null}

      {restRemaining > 0 ? (
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${colors.brand}16`,
            borderColor: `${colors.brand}55`,
            borderRadius: 9,
            borderWidth: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            padding: 10,
          }}
        >
          <FitText
            style={{
              color: colors.textPrimary,
              fontSize: 12,
              fontWeight: "800",
            }}
          >
            <Clock3 size={15} /> Rest {restRemaining}s
          </FitText>
          <FitButton
            label="Skip"
            onPress={() => setRestRemaining(0)}
            variant="ghost"
          />
        </View>
      ) : null}

      {day ? (
        day.exercises.map((exercise, exerciseIndex) => (
          <View
            key={exercise.id}
            style={{
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              borderRadius: 10,
              borderWidth: 1,
              gap: 9,
              padding: 12,
            }}
          >
            <View>
              <FitText
                style={{
                  color: colors.textPrimary,
                  fontSize: 14,
                  fontWeight: "900",
                }}
              >
                {exerciseIndex + 1}. {exercise.exerciseName}
              </FitText>
              <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                {exercise.sets} sets × {exercise.reps ?? "timed"} reps
              </FitText>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {Array.from({ length: exercise.sets }, (_, setIndex) => {
                const setNumber = setIndex + 1;
                const done = completed.has(`${exercise.id}:${setNumber}`);
                return (
                  <FitButton
                    key={setNumber}
                    disabled={done || !activeSession || logMutation.isPending}
                    icon={done ? Check : undefined}
                    label={
                      done
                        ? `Set ${setNumber} Done`
                        : `Complete Set ${setNumber}`
                    }
                    onPress={async () => {
                      if (!user?.id || !activeSession) return;
                      await logMutation.mutateAsync({
                        input: {
                          exerciseId: exercise.exerciseId,
                          repsCompleted: exercise.reps ?? undefined,
                          setNumber,
                          weightKg: exercise.weightKgTarget ?? undefined,
                        },
                        sessionId: activeSession.id,
                        userId: user.id,
                      });
                      setRestRemaining(
                        exercise.restSecondsBySet?.[setNumber - 1] ??
                          exercise.restSeconds,
                      );
                    }}
                    variant={done ? "ghost" : "primary"}
                  />
                );
              })}
            </View>
          </View>
        ))
      ) : (
        <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
          {effectivePlan
            ? "Today is a rest day in this preset."
            : "Create or select a preset."}
        </FitText>
      )}

      {activeSession ? (
        <FitButton
          disabled={
            completeMutation.isPending ||
            requiredSets === 0 ||
            completed.size < requiredSets
          }
          label={
            completed.size >= requiredSets && requiredSets > 0
              ? "Finish Workout"
              : `${completed.size}/${requiredSets} Sets Complete`
          }
          onPress={() => {
            if (!user?.id) return;
            void completeMutation.mutateAsync({
              planId: effectivePlan?.id,
              sessionId: activeSession.id,
              userId: user.id,
            });
          }}
          variant="danger"
        />
      ) : null}

      <FitButton
        icon={Camera}
        label="Use Camera Rep Counter (Optional)"
        onPress={onShowCamera}
        variant="ghost"
      />
    </View>
  );
}
