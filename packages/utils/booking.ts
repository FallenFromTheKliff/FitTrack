export function slotLabel(booked: number, capacity: number): string {
  if (booked >= capacity) return "Full";
  if (booked >= capacity * 0.8) return "Almost Full";
  return `${capacity - booked} left`;
}

const GYM_UTC_OFFSET_MINUTES = 8 * 60;

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { day, month, year };
}

function getGymClock(now: Date) {
  const timestamp = now.getTime();
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + GYM_UTC_OFFSET_MINUTES * 60 * 1000);
}

export function getGymDateKey(now: Date = new Date()) {
  const gymNow = getGymClock(now);
  if (!gymNow) return "";
  return `${gymNow.getUTCFullYear()}-${String(gymNow.getUTCMonth() + 1).padStart(2, "0")}-${String(gymNow.getUTCDate()).padStart(2, "0")}`;
}

export function getGymCurrentMinutes(now: Date = new Date()) {
  const gymNow = getGymClock(now);
  if (!gymNow) return Number.NaN;
  return gymNow.getUTCHours() * 60 + gymNow.getUTCMinutes();
}

export function getGymDayOfWeek(dateKey: string) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
}

export function isGymSlotInPast(
  dateKey: string,
  startTime: string,
  now: Date = new Date(),
) {
  const today = getGymDateKey(now);
  if (!today || !dateKey) return false;
  if (dateKey < today) return true;
  if (dateKey > today) return false;

  const match = /^(\d{1,2}):(\d{2})$/.exec(startTime);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return false;

  return hours * 60 + minutes <= getGymCurrentMinutes(now);
}
