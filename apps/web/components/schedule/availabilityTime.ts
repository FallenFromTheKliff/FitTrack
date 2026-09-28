export function formatAvailabilityTime(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return "";

  const match = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (!match) return normalized;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return normalized;

  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}
