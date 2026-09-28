import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  isValid,
  parse,
  parseISO
} from "date-fns";

function parseIsoOrYmd(value: string): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? parsed : null;
  }
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export const formatDate = (iso: string, pat = "MMM d, yyyy") => {
  const parsed = parseIsoOrYmd(iso);
  return parsed ? format(parsed, pat) : "--";
};

export const formatDateTime = (iso: string) => formatDate(iso, "MMM d, yyyy 'at' h:mm a");

export function formatTodayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export function parseYMD(value: string) {
  const [year = 0, month = 0, day = 0] = (value || "").split("-").map(Number);
  return { year, month, day };
}

export function parseDateYMD(value?: string, fallback = new Date()) {
  if (!value) return fallback;
  const parsed = parse(value, "yyyy-MM-dd", fallback);
  return isValid(parsed) ? parsed : fallback;
}

export function formatDateYMD(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function toYmd(date: Date): string {
  return formatDateYMD(date);
}

export function nextDate(value: string): string {
  if (!value) return "";
  const parsed = parseDateYMD(value);
  parsed.setDate(parsed.getDate() + 1);
  return formatDateYMD(parsed);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function formatBookingDate(dateStr: string): string {
  if (!dateStr) return "Select a date";
  const date = parseIsoOrYmd(dateStr);
  if (!date) return "Select a date";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatScheduleDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatShortDate(iso: string): string {
  return formatDate(iso, "MMM d");
}

export function formatLongDate(iso: string): string {
  return formatDate(iso, "MMMM d, yyyy");
}

export function formatMonthYear(iso: string): string {
  return formatDate(iso, "MMM yyyy");
}

export function formatGroupLabel(dateStr: string): string {
  const date = parseIsoOrYmd(dateStr);
  if (!date) return "--";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() === today.getTime() ? "Today" : format(date, "MMM d, yyyy");
}

export function formatRelativeDateLabel(dateStr: string): string {
  const date = parseIsoOrYmd(dateStr);
  if (!date) return "--";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = differenceInCalendarDays(today, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return format(date, "MMM d, yyyy");
}

export function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const year = start.getFullYear();
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "MMM d")}-${end.getDate()}, ${year}`;
  }
  return `${format(start, "MMM d")} - ${format(end, "MMM d")}, ${year}`;
}

export const timeAgo = (iso: string) => {
  const parsed = parseIsoOrYmd(iso);
  return parsed ? formatDistanceToNow(parsed, { addSuffix: true }) : "--";
};

export function to12HourLabel(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function to24HourValue(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3].toUpperCase();
  if (suffix === "AM" && hour === 12) hour = 0;
  if (suffix === "PM" && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function getDurationMinutes(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if (!Number.isFinite(startHour) || !Number.isFinite(startMinute) || !Number.isFinite(endHour) || !Number.isFinite(endMinute)) {
    return 60;
  }
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const duration = end - start;
  return duration > 0 ? duration : 60;
}

export type CoachAvailabilityWindow = {
  dayOfWeek: number | string;
  endTime: string;
  isAvailable?: boolean;
  startTime: string;
};

export type CoachGeneratedSlot = CoachAvailabilityWindow & {
  durationMinutes: number;
};

function toMinuteValue(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function toTimeValue(minutes: number) {
  const normalized = Math.max(0, minutes);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function expandCoachAvailabilitySlots(
  slots: CoachAvailabilityWindow[],
  scheduleType: "full_time" | "part_time" = "part_time",
  slotMinutes = 60,
): CoachGeneratedSlot[] {
  return slots.flatMap((slot) => {
    const durationMinutes = getDurationMinutes(slot.startTime, slot.endTime);
    if (scheduleType !== "full_time") {
      return [{ ...slot, durationMinutes }];
    }

    const startMinutes = toMinuteValue(slot.startTime);
    const endMinutes = toMinuteValue(slot.endTime);
    if (
      startMinutes == null ||
      endMinutes == null ||
      endMinutes <= startMinutes ||
      slotMinutes <= 0
    ) {
      return [{ ...slot, durationMinutes }];
    }

    const generated: CoachGeneratedSlot[] = [];
    for (
      let cursor = startMinutes;
      cursor + slotMinutes <= endMinutes;
      cursor += slotMinutes
    ) {
      generated.push({
        ...slot,
        durationMinutes: slotMinutes,
        endTime: toTimeValue(cursor + slotMinutes),
        startTime: toTimeValue(cursor),
      });
    }

    return generated.length > 0 ? generated : [{ ...slot, durationMinutes }];
  });
}
