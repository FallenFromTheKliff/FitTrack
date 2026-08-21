import type { RecurringCoachingScheduleItemRecord } from "@fittrack/api-client";

export type RecurringScheduleDraftRow = {
  date: string;
  durationMinutes: number;
  time: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toTimeInputValue(value: Date) {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function addCalendarMonths(value: Date, months: number) {
  const result = new Date(value);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/**
 * Copies an actual monthly schedule into the next future month while keeping
 * each session's local time and duration. The caller can still edit every row
 * before a new plan is submitted for fresh conflict checks and payment.
 */
export function repeatMonthlyScheduleDraft(
  items: readonly Pick<
    RecurringCoachingScheduleItemRecord,
    "durationMinutes" | "scheduledAt" | "sequenceIndex"
  >[],
  minimumDate = new Date(),
): RecurringScheduleDraftRow[] {
  const sourceItems = items
    .map((item) => ({ item, date: new Date(item.scheduledAt) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort(
      (left, right) =>
        left.item.sequenceIndex - right.item.sequenceIndex ||
        left.date.getTime() - right.date.getTime(),
    );

  if (sourceItems.length === 0) return [];

  let monthOffset = 1;
  while (addCalendarMonths(sourceItems[0].date, monthOffset) <= minimumDate) {
    monthOffset += 1;
    if (monthOffset > 120) break;
  }

  return sourceItems.map(({ item, date }) => {
    const repeatedDate = addCalendarMonths(date, monthOffset);
    return {
      date: toDateInputValue(repeatedDate),
      durationMinutes: item.durationMinutes,
      time: toTimeInputValue(repeatedDate),
    };
  });
}
