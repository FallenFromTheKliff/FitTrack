import type { FacilityOperatingHourSnapshot } from "@fittrack/types";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function formatTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = match[2];
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function formatFacilityOperatingHour(
  hour: FacilityOperatingHourSnapshot,
) {
  const day = DAY_LABELS[hour.dayOfWeek] ?? `Day ${hour.dayOfWeek}`;
  const range = hour.isClosed
    ? "Closed"
    : `${formatTime(hour.opensAt)} – ${formatTime(hour.closesAt)}`;
  return { day, range };
}

export function sortFacilityOperatingHours(
  hours: FacilityOperatingHourSnapshot[],
) {
  return [...hours].sort((left, right) => left.dayOfWeek - right.dayOfWeek);
}
