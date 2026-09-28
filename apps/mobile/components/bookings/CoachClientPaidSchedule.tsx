import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { CalendarDays, CheckCircle2, CircleOff } from "lucide-react-native";
import type { RecurringCoachingPlanRecord } from "@fittrack/api-client";
import { FitText } from "@/components/fit";
import type { DetailBooking } from "@/components/modals";
import { useTheme } from "@/contexts/ThemeContext";
import { formatBookingDate } from "@fittrack/utils";
import {
  canRescheduleCoachClientSession,
  formatCoachClientSessionTime,
  getCoachClientSessionPresentation,
} from "./coachClientScheduleFlow";
import { MonthlyCoachingScheduleSetup } from "./MonthlyCoachingScheduleSetup";

function sessionDateTimeValue(session: DetailBooking) {
  const localTime = session.startTime?.trim() || session.time?.trim() || "";
  return `${session.date} ${localTime}`.trim();
}

function compareSessionDateTime(left: DetailBooking, right: DetailBooking) {
  return sessionDateTimeValue(left).localeCompare(sessionDateTimeValue(right));
}

function isUpcomingSession(session: DetailBooking) {
  if (["completed", "cancelled", "no_show"].includes(session.status)) {
    return false;
  }

  const [year, month, day] = session.date.split("-").map(Number);
  const displayTime = (session.startTime || session.time || "").split(" - ")[0];
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(displayTime.trim());
  if (!match || !year || !month || !day) {
    return session.date >= new Date().toISOString().slice(0, 10);
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (match[3].toUpperCase() === "AM" && hours === 12) {
    hours = 0;
  } else if (match[3].toUpperCase() === "PM" && hours !== 12) {
    hours += 12;
  }

  const timestamp =
    Date.UTC(year, month - 1, day, hours, minutes) - 8 * 60 * 60 * 1000;
  return timestamp >= Date.now();
}

function resolveSessionSubtitle(session: DetailBooking) {
  return session.sessionNotes || session.description || "Session scheduled.";
}

function resolveSessionStatusColor(
  colors: ReturnType<typeof useTheme>["colors"],
  status: string,
) {
  if (status === "completed") {
    return colors.success;
  }
  if (status === "confirmed") {
    return colors.warning;
  }
  if (status === "cancelled" || status === "no_show") {
    return colors.danger;
  }
  return colors.textMuted;
}

function SessionChip({
  backgroundColor,
  color,
  label,
}: {
  backgroundColor: string;
  color: string;
  label: string;
}) {
  return (
    <View
      style={{
        backgroundColor,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <FitText style={{ color, fontSize: 9, fontWeight: "800", letterSpacing: 0.4 }}>
        {label}
      </FitText>
    </View>
  );
}

function SessionCard({
  colors,
  isHistory,
  onOpenSessionReport,
  onRescheduleSession,
  session,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  isHistory: boolean;
  onOpenSessionReport: (sessionId: string) => void;
  onRescheduleSession: (session: DetailBooking) => void;
  session: DetailBooking;
}) {
  const presentation = getCoachClientSessionPresentation(session);
  const isMonthlyCoaching = presentation.isMonthlyCoaching;
  const statusColor = resolveSessionStatusColor(colors, session.status);
  const canReschedule = !isHistory && canRescheduleCoachClientSession(session);
  const isReportable = isHistory && session.status === "completed";
  const CardContainer = isReportable ? Pressable : View;
  const containerProps = isReportable
    ? {
        accessibilityRole: "button" as const,
        onPress: () => onOpenSessionReport(session.id),
      }
    : {};

  return (
    <CardContainer
      {...containerProps}
      style={{
        backgroundColor: isMonthlyCoaching
          ? `${colors.brand}12`
          : colors.surfaceRaised,
        borderColor: isMonthlyCoaching ? `${colors.brand}a0` : colors.border,
        borderRadius: 14,
        borderWidth: 1,
        elevation: isMonthlyCoaching ? 2 : 0,
        gap: 10,
        padding: 12,
        shadowColor: isMonthlyCoaching ? colors.brand : "transparent",
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: isMonthlyCoaching ? 0.14 : 0,
        shadowRadius: isMonthlyCoaching ? 7 : 0,
        width: "100%",
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10, minWidth: 0 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: isMonthlyCoaching ? `${colors.brand}20` : colors.surface,
            borderRadius: 10,
            height: 38,
            justifyContent: "center",
            width: 38,
          }}
        >
          {session.status === "completed" ? (
            <CheckCircle2 color={colors.success} size={19} />
          ) : session.status === "cancelled" || session.status === "no_show" ? (
            <CircleOff color={colors.danger} size={19} />
          ) : (
            <CalendarDays color={isMonthlyCoaching ? colors.brand : colors.textSecondary} size={19} />
          )}
        </View>
        <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
          <FitText style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "800" }}>
            {formatBookingDate(session.date)}
          </FitText>
          <FitText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700" }}>
            {formatCoachClientSessionTime(session)}
          </FitText>
          {resolveSessionSubtitle(session) ? (
            <FitText style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}>
              {resolveSessionSubtitle(session)}
            </FitText>
          ) : null}
        </View>
      </View>

      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {isMonthlyCoaching ? (
          <SessionChip
            backgroundColor={`${colors.brand}22`}
            color={colors.brand}
            label="MONTHLY COACHING"
          />
        ) : null}
        <SessionChip
          backgroundColor={`${statusColor}1a`}
          color={statusColor}
          label={presentation.statusLabel}
        />
        {canReschedule ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onRescheduleSession(session)}
            style={{
              borderColor: colors.border,
              borderRadius: 999,
              borderWidth: 1,
              marginLeft: "auto",
              paddingHorizontal: 9,
              paddingVertical: 4,
            }}
          >
            <FitText style={{ color: colors.textPrimary, fontSize: 9, fontWeight: "800" }}>
              RESCHEDULE
            </FitText>
          </Pressable>
        ) : isReportable ? (
          <FitText style={{ color: colors.brand, fontSize: 9, fontWeight: "800", marginLeft: "auto" }}>
            VIEW REPORT
          </FitText>
        ) : null}
      </View>
    </CardContainer>
  );
}

export function CoachClientPaidSchedule({
  activeMonthlyPlan,
  coachProfile,
  coachUserId,
  memberId,
  monthlyPurchasedCount = 0,
  monthlyScheduledCount = 0,
  monthlySetupRequired = false,
  onMonthlyScheduleUpdated,
  onOpenSessionReport,
  onRescheduleSession,
  relationshipLabel,
  sessions,
}: {
  activeMonthlyPlan?: RecurringCoachingPlanRecord | null;
  coachProfile?: { monthlySessionDurationMinutes?: number | null } | null;
  coachUserId?: string;
  memberId?: string;
  monthlyPurchasedCount?: number;
  monthlyScheduledCount?: number;
  monthlySetupRequired?: boolean;
  onMonthlyScheduleUpdated?: () => Promise<void> | void;
  onOpenSessionReport: (sessionId: string) => void;
  onRescheduleSession: (session: DetailBooking) => void;
  relationshipLabel: string;
  sessions: DetailBooking[];
}) {
  const { colors } = useTheme();
  const orderedSessions = useMemo(
    () => [...sessions].sort(compareSessionDateTime),
    [sessions],
  );
  const upcomingSessions = orderedSessions.filter(isUpcomingSession);
  const sessionHistory = orderedSessions
    .filter((session) => !isUpcomingSession(session))
    .reverse();

  return (
    <View style={{ gap: 12, width: "100%" }}>
      <View style={{ gap: 3 }}>
        <FitText style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "800" }}>
          CLIENT PAID SESSIONS
        </FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
          {relationshipLabel}
        </FitText>
      </View>

      {activeMonthlyPlan && coachUserId && memberId ? (
        <MonthlyCoachingScheduleSetup
          activeMonthlyPlan={activeMonthlyPlan}
          coachProfile={coachProfile}
          coachUserId={coachUserId}
          memberId={memberId}
          monthlyPurchasedCount={monthlyPurchasedCount}
          monthlyScheduledCount={monthlyScheduledCount}
          monthlySetupRequired={monthlySetupRequired}
          onScheduleUpdated={onMonthlyScheduleUpdated}
        />
      ) : null}

      <View style={{ gap: 8 }}>
        <FitText style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "800" }}>
          UPCOMING SESSIONS
        </FitText>
        {upcomingSessions.length === 0 ? (
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            No upcoming paid sessions.
          </FitText>
        ) : (
          upcomingSessions.map((session) => (
            <SessionCard
              colors={colors}
              isHistory={false}
              key={session.id}
              onOpenSessionReport={onOpenSessionReport}
              onRescheduleSession={onRescheduleSession}
              session={session}
            />
          ))
        )}
      </View>

      <View style={{ gap: 8 }}>
        <FitText style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "800" }}>
          SESSION HISTORY
        </FitText>
        {sessionHistory.length === 0 ? (
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            No session history yet.
          </FitText>
        ) : (
          sessionHistory.map((session) => (
            <SessionCard
              colors={colors}
              isHistory
              key={session.id}
              onOpenSessionReport={onOpenSessionReport}
              onRescheduleSession={onRescheduleSession}
              session={session}
            />
          ))
        )}
      </View>
    </View>
  );
}
