import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  CircleOff,
  Dumbbell,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import {
  fitnessPlanDetailQueryOptions,
  fitnessSessionsQueryOptions,
} from "@fittrack/query";
import {
  buildCoachPlanCalendarMonth,
  buildCoachPlanCalendarWeek,
  toCoachPlanDateKey,
  type CoachPlanDayState,
} from "@fittrack/app-core";

import { FitButton, FitText } from "@/components/fit";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";

type Props = {
  isVisible: boolean;
  onClose: () => void;
  planId: string | null;
  planTitle?: string;
};

type CalendarView = "week" | "month";

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

function getMonthRange() {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  start.setDate(1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1, 0);
  return {
    endDate: toCoachPlanDateKey(end),
    startDate: toCoachPlanDateKey(start),
  };
}

function stateTone(
  state: CoachPlanDayState,
  colors: ReturnType<typeof useTheme>["colors"],
) {
  if (state === "completed") return colors.success;
  if (state === "scheduled") return colors.warning;
  if (state === "skipped") return colors.danger;
  return colors.textMuted;
}

function stateLabel(state: CoachPlanDayState) {
  if (state === "completed") return "COMPLETED";
  if (state === "skipped") return "SKIPPED";
  if (state === "scheduled") return "SCHEDULED · NOT COMPLETED";
  return "NO WORKOUT PLANNED";
}

function stateShortLabel(state: CoachPlanDayState) {
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
  const target = [
    `${exercise.sets} sets`,
    exercise.reps ? `${exercise.reps} reps` : null,
    exercise.durationSeconds ? `${exercise.durationSeconds}s` : null,
    exercise.weightKgTarget ? `${exercise.weightKgTarget} kg` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `${target || "Coach-defined target"} · ${exercise.restSeconds}s rest`;
}

export default function CoachPlanWeeklyViewerModal({
  isVisible,
  onClose,
  planId,
  planTitle,
}: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const isCompactViewport = viewportWidth < 600;
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const referenceDate = useMemo(() => new Date(), []);
  const range = useMemo(
    () => (calendarView === "month" ? getMonthRange() : getWeekRange()),
    [calendarView],
  );
  const planQuery = useQuery({
    ...fitnessPlanDetailQueryOptions(mobileApiClient, planId ?? undefined),
    enabled: isVisible && Boolean(planId),
  });
  const sessionsQuery = useQuery({
    ...fitnessSessionsQueryOptions(mobileApiClient, user?.id, {
      endDate: range.endDate,
      limit: 100,
      page: 1,
      startDate: range.startDate,
    }),
    enabled: isVisible && Boolean(planId) && Boolean(user?.id),
  });
  const week = useMemo(
    () =>
      planQuery.data
        ? buildCoachPlanCalendarWeek(
            planQuery.data,
            sessionsQuery.data?.data ?? [],
          )
        : [],
    [planQuery.data, sessionsQuery.data?.data],
  );
  const month = useMemo(
    () =>
      planQuery.data
        ? buildCoachPlanCalendarMonth(
            planQuery.data,
            sessionsQuery.data?.data ?? [],
            referenceDate,
          )
        : [],
    [planQuery.data, referenceDate, sessionsQuery.data?.data],
  );
  const visibleDays = calendarView === "month" ? month : week;
  const selectedDay =
    visibleDays.find((day) => day.dateKey === selectedDateKey) ?? null;
  const monthLabel = referenceDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    if (!isVisible) {
      setCalendarView("week");
      setSelectedDateKey(null);
    }
  }, [isVisible, planId]);

  const selectCalendarView = (nextView: CalendarView) => {
    setSelectedDateKey(null);
    setCalendarView(nextView);
  };

  const retry = () => {
    void planQuery.refetch();
    void sessionsQuery.refetch();
  };

  const renderDayButton = (day: (typeof week)[number], compact: boolean) => {
    const tone = stateTone(day.state, colors);
    return (
      <Pressable
        accessibilityLabel={`${DAY_NAMES[day.dayOfWeek]} ${stateLabel(day.state).toLowerCase()}`}
        accessibilityRole="button"
        key={day.dateKey}
        onPress={() => setSelectedDateKey(day.dateKey)}
        style={{
          alignItems: "center",
          backgroundColor: `${tone}12`,
          borderColor: `${tone}70`,
          borderRadius: 9,
          borderWidth: 1,
          flex: compact ? undefined : 1,
          gap: 4,
          justifyContent: "center",
          minHeight: 76,
          paddingHorizontal: 6,
          paddingVertical: 7,
          width: compact ? 82 : undefined,
        }}
      >
        <FitText
          style={{ color: colors.textMuted, fontSize: 9, fontWeight: "800" }}
        >
          {DAY_NAMES[day.dayOfWeek]}
        </FitText>
        <FitText
          style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "900" }}
        >
          {day.date.getDate()}
        </FitText>
        <View
          style={{
            backgroundColor: tone,
            borderRadius: 5,
            height: 9,
            width: 9,
          }}
        />
        <FitText
          style={{
            color: tone,
            fontSize: 7.5,
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          {stateShortLabel(day.state)}
        </FitText>
      </Pressable>
    );
  };

  const renderMonthDayButton = (day: (typeof month)[number]) => {
    const belongsToMonth =
      day.date.getMonth() === referenceDate.getMonth() &&
      day.date.getFullYear() === referenceDate.getFullYear();
    const tone = belongsToMonth
      ? stateTone(day.state, colors)
      : colors.textMuted;

    return (
      <View key={day.dateKey} style={{ padding: 2, width: "14.2857%" }}>
        <Pressable
          accessibilityLabel={`${day.date.toLocaleDateString(undefined, {
            day: "numeric",
            month: "long",
          })} ${stateLabel(day.state).toLowerCase()}`}
          accessibilityRole="button"
          disabled={!belongsToMonth}
          onPress={() => setSelectedDateKey(day.dateKey)}
          testID={`coach-plan-month-day-${day.dateKey}`}
          style={{
            alignItems: "center",
            backgroundColor: `${tone}${belongsToMonth ? "12" : "08"}`,
            borderColor: `${tone}${belongsToMonth ? "70" : "30"}`,
            borderRadius: 8,
            borderWidth: 1,
            gap: 5,
            justifyContent: "center",
            minHeight: isCompactViewport ? 52 : 62,
            opacity: belongsToMonth ? 1 : 0.35,
            paddingVertical: 6,
          }}
        >
          <FitText
            style={{
              color: belongsToMonth ? colors.textPrimary : colors.textMuted,
              fontSize: isCompactViewport ? 11 : 12,
              fontWeight: "900",
            }}
          >
            {day.date.getDate()}
          </FitText>
          <View
            style={{
              backgroundColor: tone,
              borderRadius: 5,
              height: 8,
              width: 8,
            }}
          />
        </Pressable>
      </View>
    );
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={isVisible}
    >
      <View
        style={{
          backgroundColor: "rgba(0,0,0,0.72)",
          flex: 1,
          justifyContent: "center",
          padding: 14,
        }}
      >
        <View
          testID="coach-plan-weekly-viewer"
          style={{
            alignSelf: "center",
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: 14,
            borderWidth: 1,
            height: isCompactViewport && selectedDay ? "86%" : undefined,
            maxHeight: "86%",
            maxWidth: 920,
            overflow: "hidden",
            width: "100%",
          }}
        >
          <View
            style={{
              alignItems: "center",
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
              flexDirection: "row",
              gap: 10,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            {selectedDay ? (
              <Pressable
                accessibilityLabel="Back to coach plan week"
                accessibilityRole="button"
                onPress={() => setSelectedDateKey(null)}
                style={{ padding: 4 }}
              >
                <ArrowLeft color={colors.textPrimary} size={19} />
              </Pressable>
            ) : null}
            <View style={{ flex: 1, gap: 2 }}>
              <FitText
                style={{
                  color: colors.brand,
                  fontSize: 10,
                  fontWeight: "900",
                  letterSpacing: 0.8,
                }}
              >
                READ-ONLY COACH PLAN
              </FitText>
              <FitText
                style={{
                  color: colors.textPrimary,
                  fontSize: 17,
                  fontWeight: "900",
                }}
              >
                {selectedDay
                  ? `${DAY_NAMES[selectedDay.dayOfWeek]} exercises`
                  : (planTitle ??
                    planQuery.data?.title ??
                    "Coach workout plan")}
              </FitText>
            </View>
            <Pressable
              accessibilityLabel="Close coach plan viewer"
              accessibilityRole="button"
              onPress={onClose}
              style={{ padding: 4 }}
            >
              <FitText
                style={{
                  color: colors.textMuted,
                  fontSize: 18,
                  fontWeight: "900",
                }}
              >
                ×
              </FitText>
            </Pressable>
          </View>

          <FitModalScrollView
            contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 24 }}
            resetKey={selectedDateKey ?? "week"}
            showsVerticalScrollIndicator={isCompactViewport}
            testID="coach-plan-viewer-scroll"
          >
            {planQuery.isPending ? (
              <View style={{ minHeight: 220, justifyContent: "center" }}>
                <FitText
                  style={{ color: colors.textMuted, textAlign: "center" }}
                >
                  Loading coach plan…
                </FitText>
              </View>
            ) : planQuery.isError || !planQuery.data ? (
              <View
                style={{
                  alignItems: "center",
                  gap: 10,
                  minHeight: 220,
                  justifyContent: "center",
                }}
              >
                <CircleAlert color={colors.danger} size={24} />
                <FitText
                  style={{
                    color: colors.textPrimary,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  This coach plan is unavailable.
                </FitText>
                <FitText
                  style={{ color: colors.textMuted, textAlign: "center" }}
                >
                  It may have been withdrawn or the network request failed.
                </FitText>
                <FitButton label="Retry" onPress={retry} variant="ghost" />
              </View>
            ) : selectedDay ? (
              <View style={{ gap: 12 }}>
                <View style={{ gap: 3 }}>
                  <FitText
                    style={{
                      color: colors.textPrimary,
                      fontSize: 16,
                      fontWeight: "900",
                    }}
                  >
                    {selectedDay.date.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "long",
                      weekday: "long",
                    })}
                  </FitText>
                  <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                    {selectedDay.focusLabels.join(" · ") || "Rest day"}
                  </FitText>
                </View>
                {selectedDay.state === "empty" ? (
                  <View
                    style={{
                      backgroundColor: colors.surfaceRaised,
                      borderColor: colors.border,
                      borderRadius: 10,
                      borderWidth: 1,
                      padding: 14,
                    }}
                  >
                    <FitText style={{ color: colors.textMuted }}>
                      No workout planned for this day.
                    </FitText>
                  </View>
                ) : (
                  <>
                    <View
                      style={{
                        alignItems: "center",
                        backgroundColor: `${stateTone(selectedDay.state, colors)}14`,
                        borderColor: `${stateTone(selectedDay.state, colors)}55`,
                        borderRadius: 10,
                        borderWidth: 1,
                        flexDirection: "row",
                        gap: 8,
                        padding: 11,
                      }}
                    >
                      {selectedDay.state === "skipped" ? (
                        <CircleOff
                          color={stateTone(selectedDay.state, colors)}
                          size={17}
                        />
                      ) : (
                        <CheckCircle2
                          color={stateTone(selectedDay.state, colors)}
                          size={17}
                        />
                      )}
                      <FitText
                        style={{
                          color: stateTone(selectedDay.state, colors),
                          fontSize: 11,
                          fontWeight: "900",
                        }}
                      >
                        {stateLabel(selectedDay.state)}
                      </FitText>
                    </View>
                    {selectedDay.exercises.map((exercise, index) => (
                      <View
                        key={exercise.id}
                        style={{
                          backgroundColor: colors.surfaceRaised,
                          borderColor: colors.border,
                          borderRadius: 10,
                          borderWidth: 1,
                          gap: 5,
                          padding: 12,
                        }}
                      >
                        <View
                          style={{
                            alignItems: "center",
                            flexDirection: "row",
                            gap: 8,
                          }}
                        >
                          <Dumbbell color={colors.brand} size={16} />
                          <FitText
                            style={{
                              color: colors.textPrimary,
                              flex: 1,
                              fontSize: 13,
                              fontWeight: "900",
                            }}
                          >
                            {index + 1}. {exercise.exerciseName}
                          </FitText>
                        </View>
                        <FitText
                          style={{ color: colors.textMuted, fontSize: 11 }}
                        >
                          {formatExerciseTarget(exercise)}
                        </FitText>
                        {exercise.notes ? (
                          <FitText
                            style={{ color: colors.textMuted, fontSize: 10 }}
                          >
                            {exercise.notes}
                          </FitText>
                        ) : null}
                      </View>
                    ))}
                  </>
                )}
              </View>
            ) : (
              <View style={{ gap: 14 }}>
                <View style={{ gap: 7 }}>
                  <View
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {(["week", "month"] as const).map((view) => {
                        const selected = calendarView === view;
                        return (
                          <Pressable
                            accessibilityLabel={
                              view === "week"
                                ? "Show this week"
                                : "Show this month"
                            }
                            accessibilityRole="button"
                            key={view}
                            onPress={() => selectCalendarView(view)}
                            style={{
                              backgroundColor: selected
                                ? `${colors.brand}20`
                                : colors.surfaceRaised,
                              borderColor: selected
                                ? colors.brand
                                : colors.border,
                              borderRadius: 7,
                              borderWidth: 1,
                              paddingHorizontal: 9,
                              paddingVertical: 6,
                            }}
                          >
                            <FitText
                              style={{
                                color: selected
                                  ? colors.brand
                                  : colors.textMuted,
                                fontSize: 10,
                                fontWeight: "900",
                              }}
                            >
                              {view === "week" ? "This Week" : "This Month"}
                            </FitText>
                          </Pressable>
                        );
                      })}
                    </View>
                    <FitText
                      style={{
                        color: colors.textMuted,
                        fontSize: 10,
                        fontWeight: "800",
                      }}
                    >
                      {monthLabel}
                    </FitText>
                  </View>
                  <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                    Select a day to see the coach&apos;s exercise details.
                  </FitText>
                </View>
                {sessionsQuery.isError ? (
                  <View
                    style={{
                      backgroundColor: `${colors.warning}12`,
                      borderColor: `${colors.warning}55`,
                      borderRadius: 9,
                      borderWidth: 1,
                      padding: 10,
                    }}
                  >
                    <FitText style={{ color: colors.warning, fontSize: 11 }}>
                      Completion history could not load. Planned days are still
                      shown.
                    </FitText>
                  </View>
                ) : null}
                {calendarView === "month" ? (
                  <View testID="coach-plan-month-grid">
                    <View style={{ flexDirection: "row" }}>
                      {DAY_NAMES.map((day) => (
                        <View
                          key={day}
                          style={{ alignItems: "center", width: "14.2857%" }}
                        >
                          <FitText
                            style={{
                              color: colors.textMuted,
                              fontSize: 8,
                              fontWeight: "900",
                              paddingBottom: 4,
                            }}
                          >
                            {day.slice(0, 1)}
                          </FitText>
                        </View>
                      ))}
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      {month.map(renderMonthDayButton)}
                    </View>
                  </View>
                ) : isCompactViewport ? (
                  <ScrollView
                    contentContainerStyle={{ gap: 8, paddingRight: 2 }}
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    testID="coach-plan-week-strip"
                  >
                    {week.map((day) => renderDayButton(day, true))}
                  </ScrollView>
                ) : (
                  <View
                    style={{ flexDirection: "row", gap: 4 }}
                    testID="coach-plan-week-grid"
                  >
                    {week.map((day) => renderDayButton(day, false))}
                  </View>
                )}
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
                >
                  {[
                    [colors.success, "Completed"],
                    [colors.warning, "Scheduled / not completed"],
                    [colors.danger, "Skipped"],
                    [colors.textMuted, "No workout planned"],
                  ].map(([tone, label]) => (
                    <View
                      key={label}
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        gap: 5,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: tone,
                          borderRadius: 5,
                          height: 8,
                          width: 8,
                        }}
                      />
                      <FitText style={{ color: colors.textMuted, fontSize: 9 }}>
                        {label}
                      </FitText>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </FitModalScrollView>
        </View>
      </View>
    </Modal>
  );
}
