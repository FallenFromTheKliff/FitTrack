import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import {
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  ListChecks,
  Sparkles,
  X,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeWorkoutSessionMutationOptions,
  fitnessPlanDetailQueryOptions,
  fitnessPlanProgressionQueryOptions,
  fitnessPlansQueryOptions,
  fitnessSessionDetailQueryOptions,
  fitnessSessionsQueryOptions,
  logWorkoutSetMutationOptions,
  startWorkoutSessionMutationOptions,
} from "@fittrack/query";
import {
  isCoachManagedTrainingPlan,
  resolveWorkoutPlanSelection,
} from "@fittrack/app-core";
import type { TrainingPlanSummaryRecord } from "@fittrack/types";
import { getPoseAutoRepCapabilityForLabel } from "@fittrack/utils";

import { FitButton, FitText } from "@/components/fit";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import type { WorkoutCameraTarget } from "@/components/workout/workout-camera-target";
import { MobileWorkoutSessionHistory } from "@/components/workout/MobileWorkoutSessionHistory";

type MobileWorkoutTodayProps = {
  cameraCompletion?: WorkoutCameraTarget | null;
  onManagePlans: () => void;
  onShowCamera: (target: WorkoutCameraTarget) => void;
};

import { getCurrentTrainingPlanWeek, getGymCalendarDayOfWeek } from "@fittrack/app-core";
import { buildWorkoutCameraTargetChain } from "@/components/workout/workout-camera-target";

function formatSourceLabel(
  plan: Pick<TrainingPlanSummaryRecord, "coachId" | "source">,
) {
  if (isCoachManagedTrainingPlan(plan)) return "Coach plan";
  if (plan.source === "ai_generated") return "Smart draft";
  return "Personal plan";
}

function formatWeightTarget(weightKg?: number | null) {
  return weightKg == null ? "Bodyweight" : `${weightKg} kg`;
}

function isSameLocalDay(value: string | null, reference: Date) {
  if (!value) return false;
  const date = new Date(value);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export function MobileWorkoutToday({
  cameraCompletion = null,
  onManagePlans,
  onShowCamera,
}: MobileWorkoutTodayProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [restRemaining, setRestRemaining] = useState(0);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [actualReps, setActualReps] = useState("");
  const [actualWeightKg, setActualWeightKg] = useState("");
  const [manualEntryError, setManualEntryError] = useState("");
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);

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
  const sessions = sessionsQuery.data?.data ?? [];
  const { activeSession, effectivePlan } = resolveWorkoutPlanSelection(
    plans,
    sessions,
  );
  const completedTodaySession = effectivePlan
    ? (sessions.find(
        (session) =>
          session.planId === effectivePlan.id &&
          session.status === "completed" &&
          isSameLocalDay(session.completedAt ?? session.startedAt, new Date()),
      ) ?? null)
    : null;
  const displayedSession = activeSession ?? completedTodaySession;

  const planDetailQuery = useQuery({
    ...fitnessPlanDetailQueryOptions(mobileApiClient, effectivePlan?.id),
    enabled: !!effectivePlan?.id,
  });
  const progressionQuery = useQuery({
    ...fitnessPlanProgressionQueryOptions(mobileApiClient, effectivePlan?.id),
    enabled: !!effectivePlan?.id && suggestionsVisible,
  });
  const sessionDetailQuery = useQuery({
    ...fitnessSessionDetailQueryOptions(mobileApiClient, displayedSession?.id),
    enabled: !!displayedSession?.id,
  });
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
  const today = getGymCalendarDayOfWeek();
const currentPlanWeek = plan ? getCurrentTrainingPlanWeek(plan) : 1;
  const day = plan?.scheduleDays.find(
    (candidate) =>
      candidate.weekNumber === currentPlanWeek &&
      candidate.dayOfWeek === today,
  );
  const suggestions = useMemo(
    () =>
      new Map(
        (progressionQuery.data ?? []).map((suggestion) => [
          suggestion.planExerciseId,
          suggestion,
        ]),
      ),
    [progressionQuery.data],
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
  const completedSets = [...completed].filter((key) =>
    day?.exercises.some((exercise) => key.startsWith(`${exercise.id}:`)),
  ).length;
  const orderedExercises = useMemo(
    () =>
      [...(day?.exercises ?? [])].sort(
        (left, right) => left.orderIndex - right.orderIndex,
      ),
    [day?.exercises],
  );
  const nextTarget = useMemo(() => {
    if (!activeSession || !effectivePlan) return null;
    for (const exercise of orderedExercises) {
      for (let setNumber = 1; setNumber <= exercise.sets; setNumber += 1) {
        if (!completed.has(`${exercise.id}:${setNumber}`)) {
          return {
            exercise,
            setNumber,
          };
        }
      }
    }
    return null;
  }, [activeSession, completed, effectivePlan, orderedExercises]);
  useEffect(() => {
    if (restRemaining <= 0) return;
    const timer = setInterval(
      () => setRestRemaining((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [restRemaining]);

  useEffect(() => {
    if (!cameraCompletion) return;
    setRestRemaining(cameraCompletion.restSeconds);
  }, [cameraCompletion]);

  useEffect(() => {
    if (activeSession) return;
    setRestRemaining(0);
    setManualEntryOpen(false);
  }, [activeSession]);

  useEffect(() => {
    setSuggestionsVisible(false);
  }, [effectivePlan?.id]);

  const currentExercise = nextTarget?.exercise ?? null;
  const currentSuggestion = currentExercise
    ? suggestions.get(currentExercise.id)
    : null;
  const progressPercent =
    requiredSets > 0 ? Math.min(100, (completedSets / requiredSets) * 100) : 0;
  const isLoading =
    plansQuery.isLoading ||
    (Boolean(effectivePlan?.id) && planDetailQuery.isLoading) ||
    (Boolean(displayedSession?.id) && sessionDetailQuery.isLoading);
  const hasError =
    plansQuery.isError ||
    planDetailQuery.isError ||
    sessionsQuery.isError ||
    sessionDetailQuery.isError;

  const openCameraForCurrentSet = () => {
    if (!activeSession || !effectivePlan || !nextTarget) return;
    const cameraTarget = buildWorkoutCameraTargetChain({
      completedSetKeys: completed,
      currentExercise: nextTarget.exercise,
      currentSetNumber: nextTarget.setNumber,
      orderedExercises,
      planId: effectivePlan.id,
      planTitle: effectivePlan.title,
      sessionId: activeSession.id,
    });
    if (cameraTarget) onShowCamera(cameraTarget);
  };
  const openManualEntry = () => {
    if (!currentExercise || !nextTarget) return;
    setActualReps(String(currentExercise.reps ?? 0));
    setActualWeightKg(
      currentExercise.weightKgTarget == null &&
        currentSuggestion?.suggestedWeightKg == null
        ? ""
        : String(
            currentExercise.weightKgTarget ??
              currentSuggestion?.suggestedWeightKg,
          ),
    );
    setManualEntryError("");
    setManualEntryOpen(true);
  };
  const submitManualEntry = async () => {
    if (!user?.id || !activeSession || !currentExercise || !nextTarget) return;
    const parsedReps = Number(actualReps);
    const parsedWeight =
      actualWeightKg.trim() === "" ? undefined : Number(actualWeightKg);

    if (!Number.isInteger(parsedReps) || parsedReps < 1 || parsedReps > 1000) {
      setManualEntryError("Actual reps must be a whole number from 1 to 1000.");
      return;
    }
    if (
      parsedWeight !== undefined &&
      (!Number.isFinite(parsedWeight) ||
        parsedWeight < 0 ||
        parsedWeight > 1000)
    ) {
      setManualEntryError("Weight must be between 0 and 1000 kg.");
      return;
    }

    setManualEntryError("");
    try {
      await logMutation.mutateAsync({
        input: {
          exerciseId: currentExercise.exerciseId,
          planExerciseId: currentExercise.id,
          repsCompleted: parsedReps,
          setNumber: nextTarget.setNumber,
          weightKg: parsedWeight,
        },
        sessionId: activeSession.id,
        userId: user.id,
      });
      setManualEntryOpen(false);
      setRestRemaining(
        currentExercise.restSecondsBySet?.[nextTarget.setNumber - 1] ??
          currentExercise.restSeconds,
      );
    } catch (error) {
      setManualEntryError(
        error instanceof Error ? error.message : "Unable to save this set.",
      );
    }
  };

  return (
    <View style={{ gap: 12, marginBottom: 18 }}>
      <View
        style={{
          alignItems: "flex-start",
          flexDirection: "row",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <FitText
            style={{
              color: colors.textPrimary,
              fontSize: 20,
              fontWeight: "900",
            }}
          >
            Today&apos;s workout
          </FitText>
          <FitText
            style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}
          >
            Your plan owns the workout. Camera tracking only counts the current
            set.
          </FitText>
        </View>
        <Pressable
          accessibilityLabel="Manage workout plans"
          accessibilityRole="button"
          onPress={onManagePlans}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderRadius: 7,
            borderWidth: 1,
            flexDirection: "row",
            gap: 4,
            opacity: pressed ? 0.72 : 1,
            paddingHorizontal: 10,
            paddingVertical: 8,
          })}
        >
          <FitText
            style={{
              color: colors.textPrimary,
              fontSize: 11,
              fontWeight: "800",
            }}
          >
            Plans
          </FitText>
          <ChevronRight size={14} color={colors.brand} />
        </Pressable>
      </View>

      {isLoading ? (
        <View
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: 8,
            gap: 5,
            padding: 14,
          }}
        >
          <FitText
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: "800",
            }}
          >
            Preparing today&apos;s workout...
          </FitText>
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            Loading your active plan and set progress.
          </FitText>
        </View>
      ) : null}

      {hasError ? (
        <View
          style={{
            backgroundColor: `${colors.danger}10`,
            borderColor: `${colors.danger}45`,
            borderRadius: 8,
            borderWidth: 1,
            gap: 5,
            padding: 14,
          }}
        >
          <FitText
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: "900",
            }}
          >
            Workout data is unavailable
          </FitText>
          <FitText
            style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}
          >
            Your progress was not changed. Refresh this page or continue from
            Plans.
          </FitText>
        </View>
      ) : null}

      {!isLoading && !hasError && effectivePlan && day ? (
        <View
          style={{
            gap: 7,
            paddingVertical: 2,
          }}
        >
          <View
            style={{
              alignItems: "flex-end",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <FitText
                style={{
                  color: colors.textPrimary,
                  fontSize: 14,
                  fontWeight: "900",
                }}
              >
                {day?.focusLabel || effectivePlan.title}
              </FitText>
              <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                {effectivePlan.title} · {formatSourceLabel(effectivePlan)}
              </FitText>
            </View>
            <FitText
              style={{ color: colors.brand, fontSize: 10, fontWeight: "900" }}
            >
              {completedSets}/{requiredSets} SETS
            </FitText>
          </View>
          <View
            accessibilityLabel={`${completedSets} of ${requiredSets} sets complete`}
            style={{
              backgroundColor: colors.surfaceRaised,
              borderRadius: 999,
              height: 5,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                backgroundColor: colors.brand,
                borderRadius: 999,
                height: "100%",
                width: `${progressPercent}%`,
              }}
            />
          </View>
        </View>
      ) : null}

      {!isLoading && !hasError && !effectivePlan ? (
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.surfaceRaised,
            borderRadius: 8,
            gap: 10,
            padding: 22,
          }}
        >
          <Dumbbell size={24} color={colors.brand} />
          <FitText
            style={{
              color: colors.textPrimary,
              fontSize: 15,
              fontWeight: "900",
            }}
          >
            Build your first weekly plan
          </FitText>
          <FitText
            style={{
              color: colors.textMuted,
              fontSize: 12,
              lineHeight: 18,
              textAlign: "center",
            }}
          >
            Choose training days and exercises once, then FitTrack prepares each
            day automatically.
          </FitText>
          <FitButton label="Create Workout Plan" onPress={onManagePlans} />
        </View>
      ) : null}

      {!isLoading && !hasError && effectivePlan && !day ? (
        <View
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: 8,
            gap: 5,
            padding: 16,
          }}
        >
          <FitText
            style={{
              color: colors.textPrimary,
              fontSize: 15,
              fontWeight: "900",
            }}
          >
            Recovery day
          </FitText>
          <FitText
            style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}
          >
            Nothing is scheduled today. Recover, review your next training day,
            or switch presets from Plans.
          </FitText>
        </View>
      ) : null}

      {!isLoading &&
      !hasError &&
      day &&
      !activeSession &&
      !completedTodaySession ? (
        <FitButton
          disabled={startMutation.isPending}
          label={
            startMutation.isPending
              ? "Starting Workout"
              : "Start Today's Workout"
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

      {!isLoading &&
      !hasError &&
      day &&
      !activeSession &&
      completedTodaySession ? (
        <View
          accessibilityLabel="Today's workout is complete"
          style={{
            alignItems: "center",
            backgroundColor: `${colors.success}12`,
            borderColor: `${colors.success}55`,
            borderRadius: 8,
            borderWidth: 1,
            flexDirection: "row",
            gap: 9,
            padding: 12,
          }}
        >
          <Check color={colors.success} size={18} />
          <View style={{ flex: 1, gap: 2 }}>
            <FitText
              style={{
                color: colors.textPrimary,
                fontSize: 13,
                fontWeight: "900",
              }}
            >
              Today&apos;s workout is complete
            </FitText>
            <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
              Your sets are saved in Session history. Come back on your next
              planned day.
            </FitText>
          </View>
        </View>
      ) : null}

      {restRemaining > 0 ? (
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${colors.brand}16`,
            borderColor: `${colors.brand}55`,
            borderRadius: 10,
            borderWidth: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            padding: 10,
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
            <Clock3 size={16} color={colors.brand} />
            <FitText
              style={{
                color: colors.textPrimary,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              Rest {restRemaining}s
            </FitText>
          </View>
          <Pressable
            accessibilityLabel="End rest timer"
            accessibilityRole="button"
            onPress={() => setRestRemaining(0)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.65 : 1,
              paddingHorizontal: 8,
              paddingVertical: 6,
            })}
          >
            <FitText
              style={{ color: colors.brand, fontSize: 11, fontWeight: "900" }}
            >
              End rest
            </FitText>
          </Pressable>
        </View>
      ) : null}

      {currentExercise
        ? [currentExercise].map((exercise) => {
            const exerciseIndex = orderedExercises.findIndex(
              (candidate) => candidate.id === exercise.id,
            );
            const suggestion = currentSuggestion;
            return (
              <View
                key={exercise.id}
                style={{
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                  borderRadius: 8,
                  borderWidth: 0,
                  gap: 13,
                  padding: 16,
                }}
              >
                <View
                  style={{
                    alignItems: "flex-start",
                    flexDirection: "row",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: `${colors.brand}18`,
                      borderRadius: 6,
                      height: 32,
                      justifyContent: "center",
                      width: 32,
                    }}
                  >
                    <FitText
                      style={{
                        color: colors.brand,
                        fontSize: 11,
                        fontWeight: "900",
                      }}
                    >
                      {exerciseIndex + 1}
                    </FitText>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <FitText
                      style={{
                        color: colors.textPrimary,
                        fontSize: 18,
                        fontWeight: "900",
                      }}
                    >
                      {exercise.exerciseName}
                    </FitText>
                    <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                      Set {nextTarget?.setNumber ?? 1} of {exercise.sets} ·{" "}
                      {exercise.reps ?? "timed"} reps
                      {exercise.weightKgTarget != null
                        ? ` · ${exercise.weightKgTarget} kg`
                        : ""}
                    </FitText>
                  </View>
                </View>

                {!suggestionsVisible ? (
                  <FitButton
                    variant="ghost"
                    icon={Sparkles}
                    label="View progression suggestion"
                    onPress={() => setSuggestionsVisible(true)}
                    style={{ minHeight: 40 }}
                    textStyle={{ fontSize: 11, fontWeight: "800" }}
                  />
                ) : progressionQuery.isLoading ? (
                  <View
                    style={{
                      borderColor: colors.border,
                      borderRadius: 8,
                      borderWidth: 1,
                      padding: 10,
                    }}
                  >
                    <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                      Reviewing your completed workout history...
                    </FitText>
                  </View>
                ) : suggestion ? (
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: 8,
                      borderWidth: 1,
                      flexDirection: "row",
                      gap: 8,
                      padding: 9,
                    }}
                  >
                    <Sparkles size={15} color={colors.brand} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <FitText
                        style={{
                          color: colors.textPrimary,
                          fontSize: 11,
                          fontWeight: "800",
                        }}
                      >
                        Suggested next target:{" "}
                        {suggestion.suggestedReps ?? "timed"} reps
                        {suggestion.suggestedWeightKg != null
                          ? ` at ${suggestion.suggestedWeightKg} kg`
                          : ""}
                      </FitText>
                      <FitText
                        style={{
                          color: colors.textMuted,
                          fontSize: 10,
                          lineHeight: 15,
                        }}
                      >
                        {suggestion.rationale}
                      </FitText>
                    </View>
                    <Pressable
                      accessibilityLabel="Hide progression suggestion"
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setSuggestionsVisible(false)}
                    >
                      <X size={15} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <View
                    style={{
                      borderColor: colors.border,
                      borderRadius: 8,
                      borderWidth: 1,
                      flexDirection: "row",
                      gap: 8,
                      justifyContent: "space-between",
                      padding: 10,
                    }}
                  >
                    <FitText
                      style={{ color: colors.textMuted, flex: 1, fontSize: 11 }}
                    >
                      No history-based progression suggestion is available for
                      this exercise yet.
                    </FitText>
                    <Pressable
                      accessibilityLabel="Hide progression suggestion"
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setSuggestionsVisible(false)}
                    >
                      <X size={15} color={colors.textMuted} />
                    </Pressable>
                  </View>
                )}

                <View style={{ gap: 7 }}>
                  {Array.from({ length: exercise.sets }, (_, setIndex) => {
                    const setNumber = setIndex + 1;
                    const done = completed.has(`${exercise.id}:${setNumber}`);
                    return (
                      <Pressable
                        accessibilityLabel={
                          done
                            ? `${exercise.exerciseName} set ${setNumber} complete`
                            : `Complete ${exercise.exerciseName} set ${setNumber}`
                        }
                        accessibilityRole="button"
                        disabled={
                          done ||
                          !activeSession ||
                          logMutation.isPending ||
                          setNumber !== nextTarget?.setNumber ||
                          restRemaining > 0
                        }
                        key={setNumber}
                        onPress={openManualEntry}
                        style={({ pressed }) => ({
                          alignItems: "center",
                          backgroundColor: done
                            ? `${colors.success}12`
                            : activeSession
                              ? `${colors.brand}14`
                              : colors.surface,
                          borderColor: done
                            ? `${colors.success}55`
                            : activeSession
                              ? `${colors.brand}55`
                              : colors.border,
                          borderRadius: 6,
                          borderWidth: 1,
                          flexDirection: "row",
                          justifyContent: "space-between",
                          opacity: pressed
                            ? 0.7
                            : activeSession || done
                              ? 1
                              : 0.55,
                          paddingHorizontal: 11,
                          paddingVertical: 10,
                        })}
                      >
                        <FitText
                          style={{
                            color: done ? colors.success : colors.textPrimary,
                            fontSize: 12,
                            fontWeight: "800",
                          }}
                        >
                          Set {setNumber}
                        </FitText>
                        <View
                          style={{
                            alignItems: "center",
                            flexDirection: "row",
                            gap: 6,
                          }}
                        >
                          <FitText
                            style={{
                              color: done ? colors.success : colors.brand,
                              fontSize: 11,
                              fontWeight: "800",
                            }}
                          >
                            {done
                              ? "Completed"
                              : activeSession
                                ? setNumber === nextTarget?.setNumber
                                  ? "Mark complete"
                                  : "Upcoming"
                                : "Ready"}
                          </FitText>
                          {done ? (
                            <Check size={15} color={colors.success} />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {activeSession ? (
                  (() => {
                    const hasRepOrDurationTarget =
                      exercise.reps != null ||
                      (exercise.durationSeconds ?? 0) > 0;
                    const hasPoseCapability =
                      getPoseAutoRepCapabilityForLabel(exercise.exerciseName) !==
                      null;
                    const canTrackWithCamera =
                      hasPoseCapability && hasRepOrDurationTarget;
                    return (
                      canTrackWithCamera ? (
                        <FitButton
                          icon={Camera}
                          disabled={restRemaining > 0}
                          label="Track This Set With Camera"
                          onPress={openCameraForCurrentSet}
                          variant="ghost"
                        />
                      ) : (
                        <FitText
                          style={{
                            color: colors.textMuted,
                            fontSize: 11,
                            textAlign: "center",
                          }}
                        >
                          Manual tracking
                        </FitText>
                      )
                    );
                  })()
                ) : null}
              </View>
            );
          })
        : null}

      {day && orderedExercises.length > 0 ? (
        <View style={{ gap: 7 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
            <ListChecks size={14} color={colors.brand} />
            <FitText
              style={{
                color: colors.textMuted,
                fontSize: 10,
                fontWeight: "900",
                letterSpacing: 0.8,
              }}
            >
              WORKOUT QUEUE
            </FitText>
          </View>
          <FitText style={{ color: colors.textMuted, fontSize: 10 }}>
            {orderedExercises.length} exercises · {requiredSets} total sets
          </FitText>
          {orderedExercises.map((exercise, exerciseIndex) => (
            <View
              key={exercise.id}
              style={{
                alignItems: "center",
                backgroundColor: colors.surfaceRaised,
                borderRadius: 6,
                flexDirection: "row",
                gap: 10,
                justifyContent: "space-between",
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <FitText
                numberOfLines={1}
                style={{
                  color: colors.textPrimary,
                  flex: 1,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                {exercise.exerciseName}
              </FitText>
              <FitText style={{ color: colors.textMuted, fontSize: 10 }}>
                {exercise.sets} × {exercise.reps ?? "timed"}
              </FitText>
              <FitText
                style={{
                  color:
                    nextTarget?.exercise.id === exercise.id
                      ? colors.brand
                      : colors.textMuted,
                  fontSize: 9.5,
                  fontWeight: "800",
                }}
              >
                {Array.from(
                  { length: exercise.sets },
                  (_, setIndex) => setIndex + 1,
                ).filter((setNumber) =>
                  completed.has(`${exercise.id}:${setNumber}`),
                ).length >= exercise.sets
                  ? `Complete · ${formatWeightTarget(
                      exercise.weightKgTarget ??
                        suggestions.get(exercise.id)?.suggestedWeightKg,
                    )}`
                  : nextTarget?.exercise.id === exercise.id
                    ? `Current · Set ${nextTarget.setNumber} · ${formatWeightTarget(
                        exercise.weightKgTarget ??
                          suggestions.get(exercise.id)?.suggestedWeightKg,
                      )}`
                    : `Queued · ${exerciseIndex + 1} · ${formatWeightTarget(
                        exercise.weightKgTarget ??
                          suggestions.get(exercise.id)?.suggestedWeightKg,
                      )}`}
              </FitText>
            </View>
          ))}
        </View>
      ) : null}

      {activeSession && requiredSets > 0 && completedSets >= requiredSets ? (
        <FitButton
          disabled={completeMutation.isPending}
          label={
            completeMutation.isPending ? "Finishing Workout" : "Finish Workout"
          }
          onPress={() => {
            if (!user?.id) return;
            void completeMutation.mutateAsync({
              sessionId: activeSession.id,
              userId: user.id,
            });
          }}
        />
      ) : null}

      <MobileWorkoutSessionHistory
        isError={sessionsQuery.isError}
        isLoading={sessionsQuery.isLoading}
        onRetry={() => void sessionsQuery.refetch()}
        sessions={sessions}
      />

      <Modal
        animationType="fade"
        onRequestClose={() => setManualEntryOpen(false)}
        transparent
        visible={manualEntryOpen}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.72)",
            flex: 1,
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              borderRadius: 10,
              borderWidth: 1,
              gap: 14,
              maxWidth: 420,
              padding: 16,
              width: "100%",
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
                    fontSize: 17,
                    fontWeight: "900",
                  }}
                >
                  Log completed set
                </FitText>
                <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                  {currentExercise?.exerciseName} · Set{" "}
                  {nextTarget?.setNumber ?? 1}
                </FitText>
              </View>
              <Pressable
                accessibilityLabel="Close manual set entry"
                accessibilityRole="button"
                onPress={() => setManualEntryOpen(false)}
                style={{ padding: 4 }}
              >
                <X size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <FitText
                  style={{
                    color: colors.textMuted,
                    fontSize: 10.5,
                    fontWeight: "800",
                  }}
                >
                  ACTUAL REPS
                </FitText>
                <TextInput
                  accessibilityLabel="Actual reps completed"
                  keyboardType="number-pad"
                  onChangeText={setActualReps}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    borderColor: colors.border,
                    borderRadius: 7,
                    borderWidth: 1,
                    color: colors.textPrimary,
                    minHeight: 44,
                    paddingHorizontal: 12,
                  }}
                  value={actualReps}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <FitText
                  style={{
                    color: colors.textMuted,
                    fontSize: 10.5,
                    fontWeight: "800",
                  }}
                >
                  WEIGHT (KG)
                </FitText>
                <TextInput
                  accessibilityLabel="Actual weight in kilograms"
                  keyboardType="decimal-pad"
                  onChangeText={setActualWeightKg}
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    borderColor: colors.border,
                    borderRadius: 7,
                    borderWidth: 1,
                    color: colors.textPrimary,
                    minHeight: 44,
                    paddingHorizontal: 12,
                  }}
                  value={actualWeightKg}
                />
              </View>
            </View>

            <FitText
              style={{
                color: colors.textMuted,
                fontSize: 10.5,
                lineHeight: 15,
              }}
            >
              Save what you actually completed. FitTrack uses this history for
              future progression suggestions.
            </FitText>
            {manualEntryError ? (
              <FitText
                accessibilityLiveRegion="polite"
                style={{ color: colors.danger, fontSize: 11 }}
              >
                {manualEntryError}
              </FitText>
            ) : null}
            <FitButton
              disabled={logMutation.isPending}
              label={
                logMutation.isPending ? "Saving Set" : "Save Completed Set"
              }
              onPress={() => void submitManualEntry()}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
