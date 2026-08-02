"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  CircleOff,
  Dumbbell,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fitnessPlanDetailQueryOptions, fitnessSessionsQueryOptions } from "@fittrack/query";
import {
  buildCoachPlanCalendarWeek,
  toCoachPlanDateKey,
  type CoachPlanDayState,
} from "@fittrack/app-core";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import { FitModal } from "@/components/modals";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  planId: string | null;
  planTitle?: string;
  userId?: string;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function getWeekRange() {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    endDate: toCoachPlanDateKey(end),
    startDate: toCoachPlanDateKey(start),
  };
}

function getDayTone(
  state: CoachPlanDayState,
  colors: ReturnType<typeof useTheme>["colors"],
) {
  if (state === "completed") return colors.success;
  if (state === "scheduled") return colors.warning;
  if (state === "skipped") return colors.danger;
  return colors.textMuted;
}

function getDayLabel(state: CoachPlanDayState) {
  if (state === "completed") return "COMPLETED";
  if (state === "skipped") return "SKIPPED";
  if (state === "scheduled") return "SCHEDULED · NOT COMPLETED";
  return "NO WORKOUT PLANNED";
}

function getDayShortLabel(state: CoachPlanDayState) {
  if (state === "completed") return "DONE";
  if (state === "skipped") return "SKIP";
  if (state === "scheduled") return "PLAN";
  return "REST";
}

function formatExerciseTarget(exercise: {
  durationSeconds: number | null;
  reps: number | null;
  restSeconds: number;
  sets: number;
  weightKgTarget: number | null;
}) {
  return [
    `${exercise.sets} sets`,
    exercise.reps ? `${exercise.reps} reps` : null,
    exercise.durationSeconds ? `${exercise.durationSeconds}s` : null,
    exercise.weightKgTarget ? `${exercise.weightKgTarget} kg` : null,
    `${exercise.restSeconds}s rest`,
  ].filter(Boolean).join(" · ");
}

export default function CoachPlanWeeklyViewer({
  isOpen,
  onClose,
  planId,
  planTitle,
  userId,
}: Props) {
  const { colors } = useTheme();
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const range = useMemo(getWeekRange, [isOpen]);
  const planQuery = useQuery({
    ...fitnessPlanDetailQueryOptions(webApiClient, planId ?? undefined),
    enabled: isOpen && Boolean(planId) && Boolean(userId),
  });
  const sessionsQuery = useQuery({
    ...fitnessSessionsQueryOptions(webApiClient, userId, {
      endDate: range.endDate,
      limit: 100,
      page: 1,
      startDate: range.startDate,
    }),
    enabled: isOpen && Boolean(planId) && Boolean(userId),
  });
  const week = useMemo(
    () => planQuery.data
      ? buildCoachPlanCalendarWeek(planQuery.data, sessionsQuery.data?.data ?? [])
      : [],
    [planQuery.data, sessionsQuery.data?.data],
  );
  const selectedDay = week.find((day) => day.dateKey === selectedDateKey) ?? null;

  useEffect(() => {
    if (!isOpen) setSelectedDateKey(null);
  }, [isOpen, planId]);

  const retry = () => {
    void planQuery.refetch();
    void sessionsQuery.refetch();
  };

  return (
    <FitModal
      contentStyle={{ display: "grid", gap: 16, maxHeight: "calc(100vh - 190px)", overflowY: "auto", padding: 20 }}
      containerStyle={{ width: "min(820px, calc(100vw - 32px))", maxHeight: "calc(100vh - 32px)" }}
      footer={<FitButton label="Close" onClick={onClose} variant="ghost" />}
      hideFooterDivider
      hideHeaderDivider
      icon={Dumbbell}
      isOpen={isOpen}
      maxWidth={820}
      onClose={onClose}
      subtitle="Your coach controls the plan. This viewer never changes it."
      title={selectedDay ? `${DAY_NAMES[selectedDay.dayOfWeek]} exercise details` : planTitle ?? planQuery.data?.title ?? "Coach workout plan"}
    >
      {planQuery.isPending ? (
        <div style={{ display: "grid", minHeight: 220, placeItems: "center" }}>
          <FitText excludeGlobalScale style={{ color: colors.textMuted }}>Loading coach plan…</FitText>
        </div>
      ) : planQuery.isError || !planQuery.data ? (
        <div style={{ alignItems: "center", display: "grid", gap: 10, minHeight: 220, placeItems: "center", textAlign: "center" }}>
          <CircleAlert color={colors.danger} size={26} />
          <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontWeight: 800 }}>This coach plan is unavailable.</FitText>
          <FitText excludeGlobalScale style={{ color: colors.textMuted }}>It may have been withdrawn or the request failed.</FitText>
          <FitButton label="Retry" onClick={retry} variant="ghost" />
        </div>
      ) : selectedDay ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
            <FitButton aria-label="Back to coach plan week" icon={ArrowLeft} iconOnly label="" onClick={() => setSelectedDateKey(null)} variant="ghost" />
            <div style={{ display: "grid", gap: 3 }}>
              <FitText as="h3" excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 850 }}>
                {selectedDay.date.toLocaleDateString(undefined, { day: "numeric", month: "long", weekday: "long" })}
              </FitText>
              <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 12 }}>
                {selectedDay.focusLabels.join(" · ") || "Rest day"}
              </FitText>
            </div>
          </div>
          {selectedDay.state === "empty" ? (
            <div style={{ backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 14 }}>
              <FitText excludeGlobalScale style={{ color: colors.textMuted }}>No workout planned for this day.</FitText>
            </div>
          ) : (
            <>
              <div style={{ alignItems: "center", backgroundColor: `${getDayTone(selectedDay.state, colors)}14`, border: `1px solid ${getDayTone(selectedDay.state, colors)}55`, borderRadius: 10, display: "flex", gap: 8, padding: 11 }}>
                {selectedDay.state === "skipped" ? (
                  <CircleOff color={getDayTone(selectedDay.state, colors)} size={17} />
                ) : (
                  <CheckCircle2 color={getDayTone(selectedDay.state, colors)} size={17} />
                )}
                <FitText excludeGlobalScale style={{ color: getDayTone(selectedDay.state, colors), fontSize: 11, fontWeight: 900 }}>
                  {getDayLabel(selectedDay.state)}
                </FitText>
              </div>
              {selectedDay.exercises.map((exercise, index) => (
                <div key={exercise.id} style={{ backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 10, display: "grid", gap: 5, padding: 12 }}>
                  <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                    <Dumbbell color={colors.brand} size={16} />
                    <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 850 }}>
                      {index + 1}. {exercise.exerciseName}
                    </FitText>
                  </div>
                  <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 12 }}>
                    {formatExerciseTarget(exercise)}
                  </FitText>
                  {exercise.notes ? <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 11 }}>{exercise.notes}</FitText> : null}
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <FitText as="h3" excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 850 }}>This week</FitText>
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 12 }}>Select a day to see the coach&apos;s exercise details.</FitText>
          </div>
          {sessionsQuery.isError ? (
            <div style={{ backgroundColor: `${colors.warning}12`, border: `1px solid ${colors.warning}55`, borderRadius: 9, padding: 10 }}>
              <FitText excludeGlobalScale style={{ color: colors.warning, fontSize: 12 }}>Completion history could not load. Planned days are still shown.</FitText>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {week.map((day) => {
              const tone = getDayTone(day.state, colors);
              return (
                <button
                  aria-label={`${DAY_NAMES[day.dayOfWeek]} ${getDayLabel(day.state).toLowerCase()}`}
                  key={day.dateKey}
                  onClick={() => setSelectedDateKey(day.dateKey)}
                  style={{ alignItems: "center", backgroundColor: `${tone}12`, border: `1px solid ${tone}70`, borderRadius: 9, color: colors.textPrimary, cursor: "pointer", display: "grid", gap: 4, minHeight: 84, minWidth: 0, padding: "8px 3px", textAlign: "center" }}
                  type="button"
                >
                  <span style={{ color: colors.textMuted, fontSize: 10, fontWeight: 800 }}>{DAY_NAMES[day.dayOfWeek]}</span>
                  <span style={{ fontSize: 16, fontWeight: 900 }}>{day.date.getDate()}</span>
                  <span aria-hidden="true" style={{ backgroundColor: tone, borderRadius: 5, display: "block", height: 9, justifySelf: "center", width: 9 }} />
                  <span style={{ color: tone, fontSize: 8, fontWeight: 900 }}>{getDayShortLabel(day.state)}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {[
              [colors.success, "Completed"],
              [colors.warning, "Scheduled / not completed"],
              [colors.danger, "Skipped"],
              [colors.textMuted, "No workout planned"],
            ].map(([tone, label]) => (
              <div key={label} style={{ alignItems: "center", display: "flex", gap: 5 }}>
                <span aria-hidden="true" style={{ backgroundColor: tone, borderRadius: 5, height: 8, width: 8 }} />
                <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 11 }}>{label}</FitText>
              </div>
            ))}
          </div>
        </div>
      )}
    </FitModal>
  );
}
