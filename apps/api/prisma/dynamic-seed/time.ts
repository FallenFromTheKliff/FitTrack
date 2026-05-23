export function daysFrom(anchor: Date, days: number, hour = 9, minute = 0) {
  const target = new Date(anchor);
  target.setDate(target.getDate() + days);
  target.setHours(hour, minute, 0, 0);
  return target;
}

export function dateOnly(anchor: Date, days: number) {
  const target = daysFrom(anchor, days, 0, 0);
  target.setHours(0, 0, 0, 0);
  return target;
}

export function yearsAgo(anchor: Date, years: number) {
  const target = new Date(anchor);
  target.setFullYear(target.getFullYear() - years);
  target.setHours(0, 0, 0, 0);
  return target;
}

export function fixedTime(value: string) {
  return new Date(`1970-01-01T${value}.000Z`);
}
