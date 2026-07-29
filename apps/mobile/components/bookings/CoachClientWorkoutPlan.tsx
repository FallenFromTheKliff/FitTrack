import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTrainingPlanInput } from "@fittrack/api-client";
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
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";

const WEEKDAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export function CoachClientWorkoutPlan({
  coachUserId,
  memberId,
}: {
  coachUserId: string;
  memberId: string;
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("Client weekly split");
  const [selectedDays, setSelectedDays] = useState<number[]>([
    new Date().getDay(),
  ]);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [message, setMessage] = useState("");

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
  const inputStyle = {
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 42,
    paddingHorizontal: 12,
  } as const;

  const createAndAssign = async () => {
    setMessage("");
    const parsedSets = Number(sets);
    const parsedReps = Number(reps);

    if (!title.trim()) {
      setMessage("Give this plan a clear name.");
      return;
    }
    if (!selectedDays.length) {
      setMessage("Select at least one training day.");
      return;
    }
    if (!selectedExerciseIds.length) {
      setMessage("Select at least one exercise.");
      return;
    }
    if (!Number.isInteger(parsedSets) || parsedSets < 1 || parsedSets > 20) {
      setMessage("Sets must be a whole number from 1 to 20.");
      return;
    }
    if (!Number.isInteger(parsedReps) || parsedReps < 1 || parsedReps > 100) {
      setMessage("Reps must be a whole number from 1 to 100.");
      return;
    }

    const input: CreateTrainingPlanInput = {
      daysPerWeek: selectedDays.length,
      durationWeeks: 12,
      goal: "maintenance" satisfies FitnessGoal,
      schedule: selectedDays.map((dayOfWeek) => ({
          dayOfWeek,
          exercises: selectedExerciseIds.map((exerciseId, orderIndex) => ({
            exerciseId,
            orderIndex,
            reps: parsedReps,
            restSeconds: 60,
            sets: parsedSets,
          })),
          focusLabel: "Coach programmed training",
          weekNumber: 1,
      })),
      title: title.trim(),
    };

    try {
      const created = await createMutation.mutateAsync({
        input,
        userId: coachUserId,
      });
      await assignMutation.mutateAsync({
        memberId,
        planId: created.id,
        userId: coachUserId,
      });
      setMessage("Coach plan published and set as the client's active plan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish preset.");
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
          Build a weekly split and publish it directly to this client.
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

      <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>
        TRAINING DAYS
      </FitText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {WEEKDAYS.map((day) => {
          const active = selectedDays.includes(day.value);
          return (
            <Pressable
              accessibilityRole="button"
              key={day.value}
              onPress={() =>
                setSelectedDays((current) =>
                  current.includes(day.value)
                    ? current.filter((value) => value !== day.value)
                    : [...current, day.value].sort((a, b) => a - b),
                )
              }
              style={{
                backgroundColor: active ? `${colors.brand}22` : colors.surfaceRaised,
                borderColor: active ? colors.brand : colors.border,
                borderRadius: 8,
                borderWidth: 1,
                minHeight: 38,
                paddingHorizontal: 10,
                justifyContent: "center",
              }}
            >
              <FitText
                style={{
                  color: active ? colors.brand : colors.textPrimary,
                  fontSize: 11,
                  fontWeight: "800",
                }}
              >
                {day.label}
              </FitText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 6 }}>
        <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>
          EXERCISES
        </FitText>
        <TextInput
          accessibilityLabel="Search workout exercises"
          onChangeText={setExerciseSearch}
          placeholder="Search by exercise or muscle group"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
          value={exerciseSearch}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {visibleExercises.map((exercise) => {
            const active = selectedExerciseIds.includes(exercise.id);
            return (
              <Pressable
                accessibilityRole="button"
                key={exercise.id}
                onPress={() =>
                  setSelectedExerciseIds((current) =>
                    current.includes(exercise.id)
                      ? current.filter((id) => id !== exercise.id)
                      : [...current, exercise.id],
                  )
                }
                style={{
                  backgroundColor: active ? `${colors.brand}22` : colors.surfaceRaised,
                  borderColor: active ? colors.brand : colors.border,
                  borderRadius: 8,
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              >
                <FitText
                  style={{
                    color: active ? colors.brand : colors.textPrimary,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {exercise.name}
                </FitText>
              </Pressable>
            );
          })}
        </View>
        {!exercisesQuery.isLoading && visibleExercises.length === 0 ? (
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            No exercises match this search.
          </FitText>
        ) : null}
        <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
          {selectedExerciseIds.length} selected
        </FitText>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>
            SETS
          </FitText>
          <TextInput
            accessibilityLabel="Workout sets"
            keyboardType="number-pad"
            onChangeText={setSets}
            placeholder="1–20"
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
            value={sets}
          />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <FitText style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>
            REPS
          </FitText>
          <TextInput
            accessibilityLabel="Workout reps"
            keyboardType="number-pad"
            onChangeText={setReps}
            placeholder="1–100"
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
            value={reps}
          />
        </View>
      </View>

      <FitButton
        disabled={
          createMutation.isPending ||
          assignMutation.isPending
        }
        label={
          createMutation.isPending || assignMutation.isPending
            ? "Publishing Plan"
            : "Create and Publish"
        }
        onPress={() => void createAndAssign()}
      />

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
              <FitButton
                disabled={assignMutation.isPending}
                label="Assign & activate"
                onPress={() =>
                  void assignMutation
                    .mutateAsync({
                      memberId,
                      planId: plan.id,
                      userId: coachUserId,
                    })
                    .then(() =>
                      setMessage(
                        "Coach plan published and set as the client's active plan.",
                      ),
                    )
                    .catch((error: unknown) =>
                      setMessage(
                        error instanceof Error ? error.message : "Unable to publish preset.",
                      ),
                    )
                }
                variant="ghost"
              />
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
    </View>
  );
}
