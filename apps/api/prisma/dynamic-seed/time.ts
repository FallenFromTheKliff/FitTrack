export function daysFrom(anchor: Date, days: number, hour = 9, minute = 0) {
  const target = new Date(anchor);
  target.setUTCDate(target.getUTCDate() + days);
  target.setUTCHours(hour, minute, 0, 0);
  return target;
}

export function dateOnly(anchor: Date, days: number) {
  const target = daysFrom(anchor, days, 0, 0);
  target.setUTCHours(0, 0, 0, 0);
  return target;
}

export function yearsAgo(anchor: Date, years: number) {
  const target = new Date(anchor);
  target.setUTCFullYear(target.getUTCFullYear() - years);
  target.setUTCHours(0, 0, 0, 0);
  return target;
}

export function fixedTime(value: string) {
  return new Date(`1970-01-01T${value}.000Z`);
}

export function daysBetween(start: Date, end: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / dayMs));
}

export function dateInsideRange(
  start: Date,
  end: Date,
  fraction: number,
  hour = 9,
  minute = 0,
) {
  const clampedFraction = Math.min(1, Math.max(0, fraction));
  const timestamp =
    start.getTime() + (end.getTime() - start.getTime()) * clampedFraction;
  const target = new Date(timestamp);
  target.setUTCHours(hour, minute, 0, 0);
  return target;
}
