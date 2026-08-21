import { useMemo } from "react";
import { View } from "react-native";
import { CalendarDays, CheckCircle2, CircleOff } from "lucide-react-native";

import { FitCard, FitText } from "@/components/fit";
import type { DetailBooking } from "@/components/modals";
import { useTheme } from "@/contexts/ThemeContext";
import { formatBookingDate } from "@fittrack/utils";

function sessionDateTimeValue(session: DetailBooking) {
  const localTime = session.startTime?.trim() || session.time?.trim() || "";
  return `${session.date} ${localTime}`.trim();
}

function compareSessionDateTime(
  left: DetailBooking,
  right: DetailBooking,
) {
  return sessionDateTimeValue(left).localeCompare(sessionDateTimeValue(right));
}

function isUpcomingSession(session: DetailBooking) {
  if (
    session.status === "completed" ||
    session.status === "cancelled" ||
    session.status === "no_show"
  ) {
    return false;
  }

  const [year, month, day] = session.date.split("-").map(Number);
  const time =
    session.startTime?.trim() || session.time?.split(" - ")[0]?.trim() || "";
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!year || !month || !day || !match) return false;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  if (match[3].toUpperCase() === "AM" && hour === 12) hour = 0;
  if (match[3].toUpperCase() === "PM" && hour !== 12) hour += 12;

  // DetailBooking stores the display date/time in gym time (UTC+8).
  const gymTimestamp =
    Date.UTC(year, month - 1, day, hour, minute) - 8 * 60 * 60 * 1000;
  return Number.isFinite(gymTimestamp) && gymTimestamp >= Date.now();
}

function formatSessionStatus(status: string) {
  switch (status) {
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    case "confirmed":
      return "Confirmed";
    case "no_show":
      return "No show";
    default:
      return "Unavailable";
  }
}

function resolveSessionSubtitle(session: DetailBooking) {
  return session.sessionNotes || session.description || "Session scheduled.";
}

function resolveSessionStatusColor(
  colors: ReturnType<typeof useTheme>["colors"],
  status: string,
) {
  if (status === "completed") return colors.success;
  if (status === "confirmed") return colors.warning;
  if (status === "cancelled" || status === "no_show") return colors.danger;

  return colors.textMuted;
}

export function CoachClientPaidSchedule({
  sessions,
  relationshipLabel,
  onOpenSessionReport,
}: {
  sessions: DetailBooking[];
  relationshipLabel: string;
  onOpenSessionReport: (sessionId: string) => void;
}) {
  const { colors } = useTheme();
  const orderedSessions = useMemo(
    () => [...sessions].sort(compareSessionDateTime),
    [sessions],
  );
  const upcomingSessions = useMemo(
    () => orderedSessions.filter(isUpcomingSession),
    [orderedSessions],
  );
  const sessionHistory = useMemo(
    () => orderedSessions.filter((session) => !isUpcomingSession(session)).reverse(),
    [orderedSessions],
  );

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <FitText
          style={{ color: colors.brand, fontSize: 13, fontWeight: "900" }}
        >
          CLIENT PAID SESSIONS
        </FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
          {relationshipLabel}
        </FitText>
      </View>

      <View style={{ gap: 8 }}>
        <FitText
          style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "900" }}
        >
          UPCOMING SESSIONS
        </FitText>
        {upcomingSessions.length === 0 ? (
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            No upcoming paid sessions found.
          </FitText>
        ) : null}
        <View style={{ gap: 7 }}>
          {upcomingSessions.map((session) => {
            const title = `${formatBookingDate(session.date)}${
              session.time ? ` · ${session.time}` : ""
            }`;
            const statusIcon =
              session.status === "completed"
                ? CheckCircle2
                : session.status === "cancelled" || session.status === "no_show"
                  ? CircleOff
                  : CalendarDays;
            return (
              <FitCard
                key={session.id}
                label={title}
                icon={statusIcon}
                subtitle={resolveSessionSubtitle(session)}
                trailingLabel={session.time ? session.time : "No time set"}
                trailingLabelColor={resolveSessionStatusColor(
                  colors,
                  session.status,
                )}
                hasBorder={
                  upcomingSessions.indexOf(session) <
                  upcomingSessions.length - 1
                }
                noChevron
              />
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <FitText
          style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "900" }}
        >
          SESSION HISTORY
        </FitText>
        {sessionHistory.length === 0 ? (
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            No session history found.
          </FitText>
        ) : null}
        <View style={{ gap: 7 }}>
          {sessionHistory.map((session) => {
            const isCompleted = session.status === "completed";
            const title = `${formatBookingDate(session.date)}${
              session.time ? ` · ${session.time}` : ""
            }`;
            const statusIcon =
              session.status === "completed"
                ? CheckCircle2
                : session.status === "cancelled" || session.status === "no_show"
                  ? CircleOff
                  : CalendarDays;
            return (
              <FitCard
                key={session.id}
                label={title}
                icon={statusIcon}
                subtitle={`${formatSessionStatus(session.status)} · ${resolveSessionSubtitle(session)}`}
                trailingLabel={formatSessionStatus(session.status)}
                trailingLabelColor={resolveSessionStatusColor(
                  colors,
                  session.status,
                )}
                onPress={
                  isCompleted
                    ? () => onOpenSessionReport(session.id)
                    : undefined
                }
                hasBorder={
                  sessionHistory.indexOf(session) <
                  sessionHistory.length - 1
                }
                noChevron={!isCompleted}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}
