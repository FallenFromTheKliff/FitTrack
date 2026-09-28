import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CoachAvailabilityResponse,
  RecurringCoachingPlanInput,
  RecurringCoachingPlanPreviewResult,
  RecurringCoachingPlanRecord,
} from "@fittrack/api-client";
import {
  coachAvailabilityQueryOptions,
  createRecurringCoachingPlanMutationOptions,
  fitnessClientPlansQueryOptions,
  invalidateCoachScheduleQueries,
  previewRecurringCoachingPlanMutationOptions,
  queryKeys,
} from "@fittrack/query";
import { FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import {
  getMonthlyCoachingTimeOptions,
  getMonthlyCoachingSetupActionLabel,
  isSelectableMonthlyPreviewSession,
  normalizeMonthlyPreferredTime,
} from "./monthlyCoachingFlow";

type MonthlyCoachingScheduleSetupProps = {
  activeMonthlyPlan: RecurringCoachingPlanRecord;
  coachProfile?: { monthlySessionDurationMinutes?: number | null } | null;
  coachUserId: string;
  memberId: string;
  monthlyPurchasedCount: number;
  monthlyScheduledCount: number;
  monthlySetupRequired: boolean;
  onScheduleUpdated?: () => Promise<void> | void;
};

function formatCandidateDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

function buildPreviewInput(
  activeMonthlyPlan: RecurringCoachingPlanRecord,
  memberId: string,
  trainingPlanId: string,
  durationMinutes: number,
  preferredTime: string,
  selectedCandidateIndexes?: number[],
): RecurringCoachingPlanInput {
  const preferredDays = activeMonthlyPlan.preferredDays?.length
    ? activeMonthlyPlan.preferredDays
    : [new Date(`${activeMonthlyPlan.startDate}T12:00:00`).getDay()];
  const quotedAmount = Number(activeMonthlyPlan.quotedAmount);

  return {
    coachId: activeMonthlyPlan.coachId,
    durationMinutes,
    durationMonths: 1,
    frequency: "monthly",
    memberId,
    preferredDays,
    preferredTime,
    ...(Number.isFinite(quotedAmount) && quotedAmount > 0
      ? { quotedAmount }
      : {}),
    ...(selectedCandidateIndexes?.length
      ? { selectedCandidateIndexes }
      : {}),
    startDate: activeMonthlyPlan.startDate,
    trainingPlanId,
  };
}

export function MonthlyCoachingScheduleSetup({
  activeMonthlyPlan,
  coachProfile,
  coachUserId,
  memberId,
  monthlyPurchasedCount,
  monthlyScheduledCount,
  monthlySetupRequired,
  onScheduleUpdated,
}: MonthlyCoachingScheduleSetupProps) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [selectedTrainingPlanId, setSelectedTrainingPlanId] = useState("");
  const [selectedPreferredTime, setSelectedPreferredTime] = useState("");
  const [preview, setPreview] =
    useState<RecurringCoachingPlanPreviewResult | null>(null);
  const [selectedCandidateIndexes, setSelectedCandidateIndexes] = useState<
    number[]
  >([]);
  const [message, setMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);

  const trainingPlansQuery = useQuery({
    ...fitnessClientPlansQueryOptions(mobileApiClient, coachUserId, memberId, {
      limit: 50,
      page: 1,
    }),
    enabled: Boolean(coachUserId && memberId),
    staleTime: 30_000,
  });

  const coachAvailabilityQuery = useQuery({
    ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(
      mobileApiClient,
      activeMonthlyPlan.coachId,
    ),
    enabled: Boolean(activeMonthlyPlan.coachId),
    staleTime: 30_000,
  });

  const coachAssignedPlans = useMemo(
    () =>
      (trainingPlansQuery.data?.data ?? [])
        .filter(
          (plan) =>
            plan.coachId === coachUserId &&
            plan.userId === memberId &&
            plan.isTemplate === false &&
            plan.source === "coach_assigned",
        )
        .sort((left, right) => {
          if (left.isActive && !right.isActive) {
            return -1;
          }
          if (right.isActive && !left.isActive) {
            return 1;
          }
          return left.title.localeCompare(right.title);
        }),
    [coachUserId, memberId, trainingPlansQuery.data?.data],
  );

  const durationMinutes =
    activeMonthlyPlan.scheduleItems?.[0]?.durationMinutes ??
    coachProfile?.monthlySessionDurationMinutes ??
    60;
  const preferredTimeOptions = useMemo(
    () =>
      getMonthlyCoachingTimeOptions(
        coachAvailabilityQuery.data?.availability ?? [],
        durationMinutes,
      ),
    [coachAvailabilityQuery.data?.availability, durationMinutes],
  );
  const paidPlanPreferredTime = normalizeMonthlyPreferredTime(
    activeMonthlyPlan.preferredTime,
  );
  const selectedIndexes = useMemo(
    () => new Set(selectedCandidateIndexes),
    [selectedCandidateIndexes],
  );
  const selectedPreviewSessions = useMemo(
    () =>
      preview?.sessions.filter((session) =>
        selectedIndexes.has(session.candidateIndex),
      ) ?? [],
    [preview, selectedIndexes],
  );
  const canConfirm =
    Boolean(preview) &&
    Boolean(selectedTrainingPlanId) &&
    Boolean(selectedPreferredTime) &&
    selectedCandidateIndexes.length === monthlyPurchasedCount &&
    selectedPreviewSessions.length === monthlyPurchasedCount &&
    selectedPreviewSessions.every(isSelectableMonthlyPreviewSession);
  const setupActionLabel = getMonthlyCoachingSetupActionLabel(
    monthlyScheduledCount,
  );

  const previewMutation = useMutation(
    previewRecurringCoachingPlanMutationOptions(mobileApiClient),
  );
  const createMutation = useMutation(
    createRecurringCoachingPlanMutationOptions(mobileApiClient, queryClient),
  );

  useEffect(() => {
    const preferredPlan =
      coachAssignedPlans.find(
        (plan) => plan.id === activeMonthlyPlan.trainingPlanId,
      ) ?? coachAssignedPlans[0];
    setSelectedTrainingPlanId(preferredPlan?.id ?? "");
  }, [activeMonthlyPlan.trainingPlanId, coachAssignedPlans]);

  useEffect(() => {
    const preferredTime =
      paidPlanPreferredTime && preferredTimeOptions.includes(paidPlanPreferredTime)
        ? paidPlanPreferredTime
        : preferredTimeOptions[0] ?? "";
    setSelectedPreferredTime(preferredTime);
  }, [paidPlanPreferredTime, preferredTimeOptions]);

  useEffect(() => {
    setPreview(null);
    setSelectedCandidateIndexes([]);
    setMessage(null);
  }, [selectedPreferredTime, selectedTrainingPlanId]);

  const buildInput = (candidateIndexes?: number[]) =>
    buildPreviewInput(
      activeMonthlyPlan,
      memberId,
      selectedTrainingPlanId,
      durationMinutes,
      selectedPreferredTime,
      candidateIndexes,
    );

  const handlePreview = async () => {
    if (!selectedTrainingPlanId || !selectedPreferredTime) {
      setMessage({
        text: "Choose a workout plan and a real coach availability time before previewing.",
        tone: "error",
      });
      return;
    }

    setMessage(null);
    try {
      const nextPreview = await previewMutation.mutateAsync(buildInput());
      const firstConflictFree = nextPreview.sessions
        .filter(isSelectableMonthlyPreviewSession)
        .slice(0, monthlyPurchasedCount)
        .map((session) => session.candidateIndex);
      setPreview(nextPreview);
      setSelectedCandidateIndexes(firstConflictFree);
      setMessage({
        text:
          firstConflictFree.length === monthlyPurchasedCount
            ? "Conflict-free sessions are preselected."
            : `Only ${firstConflictFree.length} conflict-free session(s) are available; choose another time or resolve conflicts.`,
        tone:
          firstConflictFree.length === monthlyPurchasedCount ? "success" : "error",
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Unable to preview this monthly schedule.",
        tone: "error",
      });
    }
  };

  const toggleCandidate = (candidateIndex: number) => {
    setSelectedCandidateIndexes((current) => {
      if (current.includes(candidateIndex)) {
        return current.filter((index) => index !== candidateIndex);
      }
      if (current.length >= monthlyPurchasedCount) {
        return current;
      }
      return [...current, candidateIndex];
    });
  };

  const handleConfirm = async () => {
    if (!canConfirm) {
      setMessage({
        text: `Select exactly ${monthlyPurchasedCount} conflict-free session(s) before confirming.`,
        tone: "error",
      });
      return;
    }

    setMessage(null);
    try {
      await createMutation.mutateAsync(buildInput(selectedCandidateIndexes));
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.recurringCoachingPlans(),
        }),
        invalidateCoachScheduleQueries(queryClient, coachUserId),
        queryClient.invalidateQueries({ queryKey: queryKeys.coachClients() }),
      ]);
      await onScheduleUpdated?.();
      setPreview(null);
      setSelectedCandidateIndexes([]);
      setMessage({
        text: `${monthlyPurchasedCount} monthly coaching session(s) are now scheduled on the paid plan.`,
        tone: "success",
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Unable to schedule this monthly coaching plan.",
        tone: "error",
      });
    }
  };

  return (
    <View
      style={{
        backgroundColor: `${colors.brand}0c`,
        borderColor: `${colors.brand}55`,
        borderRadius: 14,
        borderWidth: 1,
        gap: 8,
        padding: 12,
      }}
    >
      <FitText
        style={{
          color: colors.brand,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 1.1,
        }}
      >
        MONTHLY COACHING
      </FitText>
      <FitText
        style={{
          color: monthlySetupRequired ? colors.warning : colors.success,
          fontSize: 14,
          fontWeight: "800",
        }}
      >
        {monthlySetupRequired ? "SETUP REQUIRED" : "ACTIVE"}
      </FitText>
      <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>
        {monthlyScheduledCount} / {monthlyPurchasedCount} sessions scheduled
      </FitText>

      {monthlySetupRequired ? (
        <>
          {coachAssignedPlans.length === 0 ? (
            <FitText style={{ color: colors.warning, fontSize: 12, lineHeight: 18 }}>
              Create or assign a workout plan in Workout before scheduling this monthly coaching plan.
            </FitText>
          ) : (
            <>
              <FitText
                style={{ color: colors.textSecondary, fontSize: 10, fontWeight: "800" }}
              >
                COACH-ASSIGNED WORKOUT PLAN
              </FitText>
              <View style={{ gap: 6 }}>
                {coachAssignedPlans.map((plan) => {
                  const selected = plan.id === selectedTrainingPlanId;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={plan.id}
                      onPress={() => setSelectedTrainingPlanId(plan.id)}
                      style={{
                        backgroundColor: selected ? `${colors.brand}18` : colors.surfaceRaised,
                        borderColor: selected ? colors.brand : colors.border,
                        borderRadius: 9,
                        borderWidth: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 9,
                      }}
                    >
                      <FitText
                        style={{
                          color: selected ? colors.brand : colors.textPrimary,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {plan.title}
                      </FitText>
                    </Pressable>
                  );
                })}
              </View>

              <FitText
                style={{ color: colors.textSecondary, fontSize: 10, fontWeight: "800" }}
              >
                COACH AVAILABILITY
              </FitText>
              {coachAvailabilityQuery.isPending ? (
                <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                  Loading coach availability...
                </FitText>
              ) : preferredTimeOptions.length === 0 ? (
                <FitText style={{ color: colors.warning, fontSize: 11, lineHeight: 17 }}>
                  No conflict-free coach availability can fit the purchased session duration.
                </FitText>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {preferredTimeOptions.map((time) => {
                    const selected = time === selectedPreferredTime;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={time}
                        onPress={() => setSelectedPreferredTime(time)}
                        style={{
                          backgroundColor: selected ? colors.brand : colors.surfaceRaised,
                          borderColor: selected ? colors.brand : colors.border,
                          borderRadius: 8,
                          borderWidth: 1,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      >
                        <FitText
                          style={{
                            color: selected ? colors.onBrand : colors.textPrimary,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {time}
                        </FitText>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={
                  previewMutation.isPending ||
                  createMutation.isPending ||
                  coachAvailabilityQuery.isPending ||
                  !selectedTrainingPlanId ||
                  !selectedPreferredTime
                }
                onPress={() => void handlePreview()}
                style={{
                  alignItems: "center",
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.brand,
                  borderRadius: 9,
                  borderWidth: 1,
                  opacity:
                    previewMutation.isPending ||
                    createMutation.isPending ||
                    !selectedTrainingPlanId ||
                    !selectedPreferredTime
                      ? 0.55
                      : 1,
                  paddingVertical: 10,
                }}
              >
                <FitText style={{ color: colors.brand, fontSize: 11, fontWeight: "800" }}>
                  {previewMutation.isPending ? "PREVIEWING..." : setupActionLabel}
                </FitText>
              </Pressable>

              {preview ? (
                <View style={{ gap: 7 }}>
                  <FitText style={{ color: colors.textMuted, fontSize: 10, fontWeight: "800" }}>
                    SELECT EXACTLY {monthlyPurchasedCount} SESSIONS ({selectedCandidateIndexes.length} SELECTED)
                  </FitText>
                  <View style={{ gap: 6 }}>
                    {preview.sessions.map((session) => {
                      const selected = selectedIndexes.has(session.candidateIndex);
                      const selectable = isSelectableMonthlyPreviewSession(session);
                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ disabled: !selectable, selected }}
                          disabled={
                            !selectable ||
                            (!selected && selectedCandidateIndexes.length >= monthlyPurchasedCount)
                          }
                          key={session.candidateIndex}
                          onPress={() => toggleCandidate(session.candidateIndex)}
                          style={{
                            backgroundColor: selected
                              ? `${colors.brand}18`
                              : colors.surfaceRaised,
                            borderColor: selected
                              ? colors.brand
                              : selectable
                                ? colors.border
                                : `${colors.danger}55`,
                            borderRadius: 9,
                            borderWidth: 1,
                            opacity: selectable ? 1 : 0.62,
                            padding: 9,
                          }}
                        >
                          <FitText style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "700" }}>
                            {formatCandidateDate(session.date)} · {session.time}
                          </FitText>
                          <FitText style={{ color: colors.textSecondary, fontSize: 10 }}>
                            Workout: {session.workout?.label ?? "Assigned workout plan"}
                          </FitText>
                          <FitText
                            style={{
                              color: selectable ? colors.success : colors.danger,
                              fontSize: 10,
                              fontWeight: "700",
                            }}
                          >
                            {selectable ? "DAY AVAILABLE" : "CONFLICT"}
                          </FitText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!canConfirm || createMutation.isPending}
                    onPress={() => void handleConfirm()}
                    style={{
                      alignItems: "center",
                      backgroundColor: colors.brand,
                      borderRadius: 9,
                      opacity: canConfirm && !createMutation.isPending ? 1 : 0.5,
                      paddingVertical: 11,
                    }}
                  >
                    <FitText style={{ color: colors.onBrand, fontSize: 11, fontWeight: "800" }}>
                      {createMutation.isPending
                        ? "SAVING..."
                        : "CONFIRM MONTHLY SCHEDULE"}
                    </FitText>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
          {message ? (
            <FitText
              style={{
                color: message.tone === "error" ? colors.danger : colors.success,
                fontSize: 11,
                lineHeight: 17,
              }}
            >
              {message.text}
            </FitText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
