"use client";

import { useEffect, useMemo, useState } from "react";
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
  invalidateStaffCoachManagementQueries,
  previewRecurringCoachingPlanMutationOptions,
  queryKeys,
} from "@fittrack/query";

import { FitButton, FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";

import {
  MONTHLY_COACHING_SETUP_COPY,
  getMonthlyCoachingTimeOptions,
  normalizeMonthlyPreferredTime,
} from "./monthlyCoachingFlow";

type MonthlyCoachingScheduleSetupProps = {
  activeMonthlyPlan: RecurringCoachingPlanRecord;
  coachProfile: {
    monthlySessionDurationMinutes?: number;
  } | null;
  coachUserId: string;
  memberId: string;
  monthlyPurchasedCount: number;
  monthlyScheduledCount: number;
};

function getMutationError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

function formatPreferredTime(value: string) {
  const [hourValue, minuteValue] = value.split(":");
  const hour = Number(hourValue);
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minuteValue} ${period}`;
}

function isSelectablePreviewSession(
  session: RecurringCoachingPlanPreviewResult["sessions"][number],
) {
  return (
    !session.conflict &&
    session.recurringState !== "skipped" &&
    session.recurringState !== "cancelled"
  );
}

function previewInputFor(
  activeMonthlyPlan: RecurringCoachingPlanRecord,
  memberId: string,
  trainingPlanId: string,
  durationMinutes: number,
  preferredTime: string,
  selectedCandidateIndexes?: number[],
): RecurringCoachingPlanInput {
  const preferredDays = activeMonthlyPlan.preferredDays.length
    ? activeMonthlyPlan.preferredDays
    : [
        new Date(`${activeMonthlyPlan.startDate}T12:00:00`).getDay(),
      ];
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

export default function MonthlyCoachingScheduleSetup({
  activeMonthlyPlan,
  coachProfile,
  coachUserId,
  memberId,
  monthlyPurchasedCount,
  monthlyScheduledCount,
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
    ...fitnessClientPlansQueryOptions(
      webApiClient,
      coachUserId,
      memberId,
      { limit: 50, page: 1 },
    ),
    enabled: Boolean(coachUserId && memberId),
    staleTime: 30_000,
  });
  const previewMutation = useMutation(
    previewRecurringCoachingPlanMutationOptions(webApiClient),
  );
  const createMutation = useMutation(
    createRecurringCoachingPlanMutationOptions(webApiClient, queryClient),
  );

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
        .sort(
          (left, right) =>
            Number(right.isActive) - Number(left.isActive) ||
            right.updatedAt.localeCompare(left.updatedAt),
        ),
    [coachUserId, memberId, trainingPlansQuery.data?.data],
  );
  const selectedTrainingPlan = coachAssignedPlans.find(
    (plan) => plan.id === selectedTrainingPlanId,
  );
  const durationMinutes =
    activeMonthlyPlan.scheduleItems?.[0]?.durationMinutes ??
    coachProfile?.monthlySessionDurationMinutes ??
    60;
  const coachAvailabilityQuery = useQuery({
    ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(
      webApiClient,
      activeMonthlyPlan.coachId,
    ),
    enabled: Boolean(activeMonthlyPlan.coachId),
    staleTime: 30_000,
  });
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
      preview?.sessions.filter((session) => selectedIndexes.has(session.candidateIndex)) ??
      [],
    [preview, selectedIndexes],
  );
  const canConfirm =
    Boolean(preview) &&
    Boolean(selectedTrainingPlanId) &&
    Boolean(selectedPreferredTime) &&
    selectedCandidateIndexes.length === monthlyPurchasedCount &&
    selectedPreviewSessions.length === monthlyPurchasedCount &&
    selectedPreviewSessions.every(isSelectablePreviewSession);

  useEffect(() => {
    const preferredPlan =
      coachAssignedPlans.find(
        (plan) => plan.id === activeMonthlyPlan.trainingPlanId,
      ) ?? coachAssignedPlans[0];
    setSelectedTrainingPlanId(preferredPlan?.id ?? "");
  }, [activeMonthlyPlan.trainingPlanId, coachAssignedPlans]);

  useEffect(() => {
    setSelectedPreferredTime((current) => {
      if (current && preferredTimeOptions.includes(current)) return current;
      if (
        paidPlanPreferredTime &&
        preferredTimeOptions.includes(paidPlanPreferredTime)
      ) {
        return paidPlanPreferredTime;
      }
      return preferredTimeOptions[0] ?? "";
    });
  }, [paidPlanPreferredTime, preferredTimeOptions]);

  useEffect(() => {
    setPreview(null);
    setSelectedCandidateIndexes([]);
    setMessage(null);
  }, [activeMonthlyPlan.id, selectedTrainingPlanId]);

  const buildInput = (candidateIndexes?: number[]) =>
    previewInputFor(
      activeMonthlyPlan,
      memberId,
      selectedTrainingPlanId,
      durationMinutes,
      selectedPreferredTime,
      candidateIndexes,
    );

  const handlePreview = async () => {
    if (!selectedTrainingPlanId) {
      setMessage({
        text: "Create or assign a workout plan in Workout before scheduling this monthly coaching plan.",
        tone: "error",
      });
      return;
    }
    if (!selectedPreferredTime) {
      setMessage({
        text: "Choose a real coach availability time before previewing this monthly schedule.",
        tone: "error",
      });
      return;
    }

    try {
      const nextPreview = await previewMutation.mutateAsync(buildInput());
      const firstConflictFree = nextPreview.sessions
        .filter(isSelectablePreviewSession)
        .slice(0, monthlyPurchasedCount)
        .map((session) => session.candidateIndex);
      setPreview(nextPreview);
      setSelectedCandidateIndexes(firstConflictFree);
      setMessage({
        text:
          firstConflictFree.length === monthlyPurchasedCount
            ? `Preview ready. Select exactly ${monthlyPurchasedCount} conflict-free session(s).`
            : `Only ${firstConflictFree.length} conflict-free session(s) are available for the ${monthlyPurchasedCount}-session plan.`,
        tone:
          firstConflictFree.length === monthlyPurchasedCount
            ? "success"
            : "error",
      });
    } catch (error) {
      setMessage({
        text: getMutationError(error, "Unable to preview the monthly schedule."),
        tone: "error",
      });
    }
  };

  const toggleCandidate = (candidateIndex: number) => {
    const session = preview?.sessions.find(
      (candidate) => candidate.candidateIndex === candidateIndex,
    );
    if (!session || !isSelectablePreviewSession(session)) return;

    setSelectedCandidateIndexes((current) => {
      if (current.includes(candidateIndex)) {
        return current.filter((index) => index !== candidateIndex);
      }
      if (current.length >= monthlyPurchasedCount) return current;
      return [...current, candidateIndex].sort((left, right) => left - right);
    });
    setMessage(null);
  };

  const handleConfirm = async () => {
    if (!canConfirm) {
      setMessage({
        text: `Select exactly ${monthlyPurchasedCount} conflict-free session(s) before confirming.`,
        tone: "error",
      });
      return;
    }

    try {
      const result = await createMutation.mutateAsync(
        buildInput(selectedCandidateIndexes),
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.recurringCoachingPlans(),
        }),
        invalidateCoachScheduleQueries(queryClient, coachUserId),
        invalidateStaffCoachManagementQueries(queryClient, activeMonthlyPlan.coachId),
      ]);
      setPreview(null);
      setSelectedCandidateIndexes([]);
      setMessage({
        text: `${result.sessions.length} monthly coaching session(s) are now scheduled on the paid plan.`,
        tone: "success",
      });
    } catch (error) {
      setMessage({
        text: getMutationError(error, "Unable to activate the monthly schedule."),
        tone: "error",
      });
    }
  };

  return (
    <section
      aria-label="Monthly coaching setup required"
      style={{
        backgroundColor: `${colors.brand}0a`,
        border: `1px solid ${colors.brand}55`,
        borderRadius: 10,
        boxShadow: `0 0 18px ${colors.brand}12`,
        display: "grid",
        gap: 9,
        padding: 12,
      }}
    >
      <div style={{ display: "grid", gap: 3 }}>
        <FitText
          style={{
            color: colors.brand,
            fontSize: 10,
            fontWeight: 850,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {MONTHLY_COACHING_SETUP_COPY.label}
        </FitText>
        <FitText
          style={{
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: 850,
            letterSpacing: "0.02em",
          }}
        >
          {MONTHLY_COACHING_SETUP_COPY.required}
        </FitText>
        <FitText style={{ color: colors.textSecondary, fontSize: 11 }}>
          {monthlyScheduledCount} / {monthlyPurchasedCount} sessions scheduled
        </FitText>
      </div>

      {trainingPlansQuery.isPending ? (
        <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
          Loading coach-assigned workout plans...
        </FitText>
      ) : coachAssignedPlans.length === 0 ? (
        <FitText
          role="alert"
          style={{ color: colors.warning, fontSize: 11, lineHeight: 1.45 }}
        >
          Create or assign a workout plan in Workout before scheduling this monthly coaching plan.
        </FitText>
      ) : (
        <>
          {coachAssignedPlans.length > 1 ? (
            <label style={{ display: "grid", gap: 5 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 10, fontWeight: 750 }}>
                Coach-assigned workout plan
              </FitText>
              <select
                aria-label="Coach-assigned workout plan"
                onChange={(event) => setSelectedTrainingPlanId(event.target.value)}
                style={{
                  backgroundColor: colors.surfaceRaised,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 7,
                  color: colors.textPrimary,
                  minHeight: 38,
                  padding: "7px 9px",
                }}
                value={selectedTrainingPlanId}
              >
                {coachAssignedPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}{plan.isActive ? " · Active" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <FitText style={{ color: colors.textSecondary, fontSize: 11 }}>
              Workout: {selectedTrainingPlan?.title ?? coachAssignedPlans[0]?.title}
            </FitText>
          )}

          {coachAvailabilityQuery.isPending ? (
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              Loading coach availability...
            </FitText>
          ) : preferredTimeOptions.length === 0 ? (
            <FitText
              role="alert"
              style={{ color: colors.warning, fontSize: 11, lineHeight: 1.45 }}
            >
              No active coach availability can fit the purchased session duration.
            </FitText>
          ) : (
            <label style={{ display: "grid", gap: 5 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 10, fontWeight: 750 }}>
                Monthly session time
              </FitText>
              <select
                aria-label="Monthly session time"
                onChange={(event) => setSelectedPreferredTime(event.target.value)}
                style={{
                  backgroundColor: colors.surfaceRaised,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 7,
                  color: colors.textPrimary,
                  minHeight: 38,
                  padding: "7px 9px",
                }}
                value={selectedPreferredTime}
              >
                {preferredTimeOptions.map((time) => (
                  <option key={time} value={time}>
                    {formatPreferredTime(time)}
                  </option>
                ))}
              </select>
              <FitText style={{ color: colors.textMuted, fontSize: 10, lineHeight: 1.4 }}>
                Preview validates this time against coach conflicts for the full paid month.
              </FitText>
            </label>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <FitButton
              disabled={
                previewMutation.isPending ||
                createMutation.isPending ||
                coachAvailabilityQuery.isPending ||
                !selectedPreferredTime
              }
              label={
                previewMutation.isPending
                  ? "PREVIEWING..."
                  : MONTHLY_COACHING_SETUP_COPY.action
              }
              onClick={() => void handlePreview()}
              style={{ minHeight: 36 }}
              textStyle={{ fontSize: 10, fontWeight: 850 }}
              variant="ghost"
            />
            {preview ? (
              <FitButton
                disabled={!canConfirm || createMutation.isPending}
                label={createMutation.isPending ? "SCHEDULING..." : "CONFIRM MONTHLY SCHEDULE"}
                onClick={() => void handleConfirm()}
                style={{ minHeight: 36 }}
                textStyle={{ fontSize: 10, fontWeight: 850 }}
                variant="primary"
              />
            ) : null}
          </div>

          {preview ? (
            <div style={{ display: "grid", gap: 7 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 10, fontWeight: 750 }}>
                Select exactly {monthlyPurchasedCount} sessions ({selectedCandidateIndexes.length} selected)
              </FitText>
              <div style={{ display: "grid", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                {preview.sessions.map((session) => {
                  const selected = selectedIndexes.has(session.candidateIndex);
                  const selectable = isSelectablePreviewSession(session);
                  return (
                    <button
                      aria-pressed={selected}
                      disabled={!selectable || (!selected && selectedCandidateIndexes.length >= monthlyPurchasedCount)}
                      key={session.candidateIndex}
                      onClick={() => toggleCandidate(session.candidateIndex)}
                      style={{
                        alignItems: "center",
                        backgroundColor: selected ? `${colors.brand}12` : colors.surfaceRaised,
                        border: `1px solid ${selected ? colors.brand : selectable ? colors.border : `${colors.danger}45`}`,
                        borderRadius: 7,
                        color: colors.textPrimary,
                        cursor: selectable ? "pointer" : "not-allowed",
                        display: "flex",
                        gap: 8,
                        justifyContent: "space-between",
                        opacity: selectable ? 1 : 0.72,
                        padding: "8px 9px",
                        textAlign: "left",
                      }}
                      type="button"
                    >
                      <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 750 }}>
                          {session.date} · {session.time}
                        </span>
                        <span style={{ color: colors.textMuted, fontSize: 10 }}>
                          {session.workout?.label ?? "Coach session"}
                        </span>
                      </span>
                      <span
                        style={{
                          color: session.conflict ? colors.danger : selected ? colors.brand : colors.textMuted,
                          flexShrink: 0,
                          fontSize: 9,
                          fontWeight: 850,
                          textTransform: "uppercase",
                        }}
                      >
                        {session.conflict ? "Conflict" : selected ? "Selected" : "Available"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}

      {message ? (
        <FitText
          role={message.tone === "error" ? "alert" : "status"}
          style={{
            backgroundColor:
              message.tone === "error"
                ? `${colors.danger}10`
                : `${colors.success}10`,
            border: `1px solid ${message.tone === "error" ? colors.danger : colors.success}35`,
            borderRadius: 7,
            color: message.tone === "error" ? colors.danger : colors.success,
            fontSize: 10.5,
            lineHeight: 1.4,
            padding: "8px 9px",
          }}
        >
          {message.text}
        </FitText>
      ) : null}
    </section>
  );
}
