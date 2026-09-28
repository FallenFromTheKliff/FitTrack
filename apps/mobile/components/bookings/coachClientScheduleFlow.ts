export type CoachClientScheduleSessionLike = {
  bookingType?: "recurring" | "single" | "venue_coach";
  date: string;
  recurringPlanId?: string | null;
  startTime?: string | null;
  status: string;
  time?: string | null;
};

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
      return status.replaceAll("_", " ");
  }
}

export function getCoachClientSessionPresentation(
  session: CoachClientScheduleSessionLike,
) {
  const isMonthlyCoaching = Boolean(session.recurringPlanId);
  return {
    isMonthlyCoaching,
    monthlyLabel: isMonthlyCoaching ? "MONTHLY COACHING" : null,
    statusLabel: formatSessionStatus(session.status),
  };
}

function parseDisplayTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (hours < 1 || hours > 12 || minutes > 59) {
    return null;
  }
  if (meridiem === "AM" && hours === 12) {
    hours = 0;
  } else if (meridiem === "PM" && hours !== 12) {
    hours += 12;
  }

  return hours * 60 + minutes;
}

function sessionTimestamp(session: CoachClientScheduleSessionLike) {
  const [year, month, day] = session.date.split("-").map(Number);
  const displayTime = (session.startTime || session.time || "").split(" - ")[0];
  const minutes = parseDisplayTime(displayTime);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    minutes === null
  ) {
    return null;
  }

  return Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60) -
    8 * 60 * 60 * 1000;
}

export function formatCoachClientSessionTime(
  session: CoachClientScheduleSessionLike,
) {
  if (session.startTime && session.time?.includes(" - ")) {
    return session.time;
  }
  if (session.startTime && session.time && session.time === session.startTime) {
    return session.startTime;
  }
  if (session.startTime) {
    return session.time?.includes(" - ") ? session.time : session.startTime;
  }
  return session.time || "Time pending";
}

export function canRescheduleCoachClientSession(
  session: CoachClientScheduleSessionLike,
  now = Date.now(),
) {
  const isRecurring =
    session.bookingType === "recurring" || Boolean(session.recurringPlanId);
  const isSingle = session.bookingType === "single";
  if (
    session.status !== "confirmed" ||
    (!isSingle && !isRecurring) ||
    session.bookingType === "venue_coach"
  ) {
    return false;
  }

  const timestamp = sessionTimestamp(session);
  return timestamp !== null && timestamp > now;
}
