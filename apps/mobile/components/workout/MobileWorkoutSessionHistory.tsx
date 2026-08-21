import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  X,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { fitnessSessionDetailQueryOptions } from "@fittrack/query";
import type {
  ExerciseLogRecord,
  WorkoutSessionStatus,
  WorkoutSessionSummaryRecord,
} from "@fittrack/types";

import { FitButton, FitText } from "@/components/fit";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";

type MobileWorkoutSessionHistoryProps = {
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  sessions: WorkoutSessionSummaryRecord[];
};

function formatSessionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "Duration unavailable";
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function formatStatus(status: WorkoutSessionStatus) {
  if (status === "in_progress") return "In progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function groupLogs(logs: ExerciseLogRecord[]) {
  const groups = new Map<string, ExerciseLogRecord[]>();
  logs.forEach((log) => {
    const current = groups.get(log.exerciseName) ?? [];
    current.push(log);
    groups.set(log.exerciseName, current);
  });
  return [...groups.entries()];
}

export function MobileWorkoutSessionHistory({
  isError,
  isLoading,
  onRetry,
  sessions,
}: MobileWorkoutSessionHistoryProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const selectedSession = sessions.find(
    (session) => session.id === selectedSessionId,
  );
  const detailQuery = useQuery({
    ...fitnessSessionDetailQueryOptions(
      mobileApiClient,
      selectedSessionId ?? undefined,
    ),
    enabled: visible && Boolean(selectedSessionId),
  });
  const groupedLogs = useMemo(
    () => groupLogs(detailQuery.data?.exerciseLogs ?? []),
    [detailQuery.data?.exerciseLogs],
  );

  const close = () => {
    setSelectedSessionId(null);
    setVisible(false);
  };

  return (
    <>
      <FitButton
        accessibilityLabel="Open workout session history"
        icon={History}
        label="Session history"
        onPress={() => setVisible(true)}
        style={{ minHeight: 38, opacity: 0.76 }}
        textStyle={{ fontSize: 11, fontWeight: "800" }}
        variant="ghost"
      />

      <Modal
        animationType="fade"
        onRequestClose={close}
        transparent
        visible={visible}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.76)",
            flex: 1,
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            accessibilityLabel="Workout session history"
            style={{
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              borderRadius: 12,
              borderWidth: 1,
              maxHeight: "86%",
              maxWidth: 480,
              minHeight: 260,
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
                minHeight: 58,
                paddingHorizontal: 14,
              }}
            >
              {selectedSessionId ? (
                <Pressable
                  accessibilityLabel="Back to session history"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setSelectedSessionId(null)}
                  style={{ padding: 4 }}
                >
                  <ChevronLeft color={colors.textPrimary} size={19} />
                </Pressable>
              ) : (
                <History color={colors.brand} size={18} />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <FitText
                  style={{
                    color: colors.textPrimary,
                    fontSize: 16,
                    fontWeight: "900",
                  }}
                >
                  {selectedSessionId ? "Session details" : "Session history"}
                </FitText>
                <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
                  {selectedSessionId
                    ? selectedSession?.plan?.title ?? "Workout session"
                    : "Your latest saved workouts"}
                </FitText>
              </View>
              <Pressable
                accessibilityLabel="Close workout session history"
                accessibilityRole="button"
                hitSlop={8}
                onPress={close}
                style={{ padding: 4 }}
              >
                <X color={colors.textMuted} size={18} />
              </Pressable>
            </View>

            <FitModalScrollView
              contentContainerStyle={{ gap: 9, padding: 14 }}
              resetKey={selectedSessionId ?? "history-list"}
            >
              {selectedSessionId ? (
                detailQuery.isLoading ? (
                  <View
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 180,
                    }}
                  >
                    <ActivityIndicator color={colors.brand} />
                    <FitText
                      style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}
                    >
                      Loading saved sets...
                    </FitText>
                  </View>
                ) : detailQuery.isError ? (
                  <View style={{ gap: 10, paddingVertical: 24 }}>
                    <FitText
                      style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "800" }}
                    >
                      Could not load this session
                    </FitText>
                    <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                      Your saved workout was not changed. Try loading it again.
                    </FitText>
                    <FitButton
                      label="Retry"
                      onPress={() => void detailQuery.refetch()}
                      variant="ghost"
                    />
                  </View>
                ) : detailQuery.data ? (
                  <>
                    <View
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: 8,
                        borderWidth: 1,
                        gap: 5,
                        padding: 12,
                      }}
                    >
                      <View
                        style={{
                          alignItems: "center",
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <FitText
                          style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "900" }}
                        >
                          {formatStatus(detailQuery.data.status)}
                        </FitText>
                        <FitText style={{ color: colors.textMuted, fontSize: 10 }}>
                          {formatDuration(detailQuery.data.durationSeconds)}
                        </FitText>
                      </View>
                      <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
                        {formatSessionDate(
                          detailQuery.data.completedAt ?? detailQuery.data.startedAt,
                        )}
                      </FitText>
                      <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
                        {detailQuery.data.exerciseLogs.length} saved sets · {detailQuery.data.totalVolumeKg ?? 0} kg volume
                      </FitText>
                    </View>

                    {groupedLogs.length > 0 ? (
                      groupedLogs.map(([exerciseName, logs]) => (
                        <View
                          key={exerciseName}
                          style={{
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            borderRadius: 8,
                            borderWidth: 1,
                            gap: 8,
                            padding: 12,
                          }}
                        >
                          <FitText
                            style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: "900" }}
                          >
                            {exerciseName}
                          </FitText>
                          {logs.map((log) => (
                            <View
                              key={log.id}
                              style={{
                                alignItems: "center",
                                flexDirection: "row",
                                justifyContent: "space-between",
                              }}
                            >
                              <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
                                Set {log.setNumber}
                              </FitText>
                              <FitText
                                style={{ color: colors.textPrimary, fontSize: 10.5, fontWeight: "800" }}
                              >
                                {log.repsCompleted ?? log.repsAiCounted ?? "—"} reps
                                {log.weightKg != null ? ` · ${log.weightKg} kg` : ""}
                              </FitText>
                            </View>
                          ))}
                        </View>
                      ))
                    ) : (
                      <View style={{ gap: 5, paddingVertical: 20 }}>
                        <FitText
                          style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "800" }}
                        >
                          No sets were saved
                        </FitText>
                        <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                          This session ended without logged exercise sets.
                        </FitText>
                      </View>
                    )}
                  </>
                ) : null
              ) : isLoading ? (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 180,
                  }}
                >
                  <ActivityIndicator color={colors.brand} />
                  <FitText
                    style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}
                  >
                    Loading session history...
                  </FitText>
                </View>
              ) : isError ? (
                <View style={{ gap: 10, paddingVertical: 24 }}>
                  <FitText
                    style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "800" }}
                  >
                    Session history is unavailable
                  </FitText>
                  <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                    Try again without leaving your workout.
                  </FitText>
                  <FitButton label="Retry" onPress={onRetry} variant="ghost" />
                </View>
              ) : sessions.length === 0 ? (
                <View
                  style={{
                    alignItems: "center",
                    gap: 7,
                    justifyContent: "center",
                    minHeight: 180,
                  }}
                >
                  <Clock3 color={colors.textMuted} size={22} />
                  <FitText
                    style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "800" }}
                  >
                    No workout sessions yet
                  </FitText>
                  <FitText
                    style={{ color: colors.textMuted, fontSize: 11, textAlign: "center" }}
                  >
                    Finished and cancelled workouts will appear here.
                  </FitText>
                </View>
              ) : (
                sessions.map((session) => {
                  const statusColor =
                    session.status === "completed"
                      ? colors.success
                      : session.status === "cancelled"
                        ? colors.danger
                        : colors.brand;
                  return (
                    <Pressable
                      accessibilityLabel={`View ${session.plan?.title ?? "workout"} session from ${formatSessionDate(session.startedAt)}`}
                      accessibilityRole="button"
                      key={session.id}
                      onPress={() => setSelectedSessionId(session.id)}
                      style={({ pressed }) => ({
                        alignItems: "center",
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: 8,
                        borderWidth: 1,
                        flexDirection: "row",
                        gap: 10,
                        opacity: pressed ? 0.7 : 1,
                        padding: 12,
                      })}
                    >
                      <View style={{ flex: 1, gap: 4 }}>
                        <View
                          style={{
                            alignItems: "center",
                            flexDirection: "row",
                            gap: 7,
                          }}
                        >
                          {session.status === "completed" ? (
                            <Check color={statusColor} size={14} />
                          ) : (
                            <Clock3 color={statusColor} size={14} />
                          )}
                          <FitText
                            numberOfLines={1}
                            style={{
                              color: colors.textPrimary,
                              flex: 1,
                              fontSize: 12.5,
                              fontWeight: "900",
                            }}
                          >
                            {session.plan?.title ?? "Workout session"}
                          </FitText>
                        </View>
                        <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
                          {formatSessionDate(session.completedAt ?? session.startedAt)}
                        </FitText>
                        <FitText style={{ color: statusColor, fontSize: 10, fontWeight: "800" }}>
                          {formatStatus(session.status)} · {session.exerciseLogCount} sets · {formatDuration(session.durationSeconds)}
                        </FitText>
                      </View>
                      <ChevronRight color={colors.textMuted} size={17} />
                    </Pressable>
                  );
                })
              )}
            </FitModalScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
