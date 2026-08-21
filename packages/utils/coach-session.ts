export type CoachUpcomingSessionInput = {
  date?: string | null;
  scheduledAt?: string | null;
  startTime?: string | null;
  status?: string | null;
  time?: string | null;
};

const UPCOMING_COACH_SESSION_STATUSES = new Set([
  "pending_coach",
  "pending_payment",
  "confirmed",
]);

export function isUpcomingCoachSession(
  session: CoachUpcomingSessionInput,
  now = Date.now(),
) {
  const time = session.startTime ?? session.time ?? "00:00";
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  const scheduledValue =
    session.scheduledAt ??
    (session.date ? `${session.date}T${normalizedTime}` : null);
  const scheduledTime = scheduledValue
    ? new Date(scheduledValue).getTime()
    : Number.NaN;

  return (
    Number.isFinite(scheduledTime) &&
    scheduledTime >= now &&
    UPCOMING_COACH_SESSION_STATUSES.has(session.status ?? "")
  );
}
