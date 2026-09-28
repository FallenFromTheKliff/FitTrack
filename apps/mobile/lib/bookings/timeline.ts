export type BookingTimelineRecord = {
  date: string;
  id: string;
  startTime?: string | null;
  time?: string | null;
};

function normalizePositiveInteger(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

export function getBookingTimelineStartMinute(
  booking: Pick<BookingTimelineRecord, "startTime" | "time">,
) {
  const value = (booking.startTime || booking.time?.split(" - ")[0]?.trim() || "").trim();
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;
  return hour * 60 + minute;
}

/**
 * Returns a new array ordered for the member schedule: current/future dates
 * first in ascending order, then historical dates in descending order.
 */
export function sortBookingTimeline<T extends BookingTimelineRecord>(
  items: readonly T[],
  gymToday: string,
) {
  const sorted = [...items];
  sorted.sort((left, right) => {
    const leftUpcoming = left.date >= gymToday;
    const rightUpcoming = right.date >= gymToday;

    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;

    const byDate = leftUpcoming
      ? left.date.localeCompare(right.date)
      : right.date.localeCompare(left.date);
    if (byDate !== 0) return byDate;

    const byStartMinute = leftUpcoming
      ? getBookingTimelineStartMinute(left) -
        getBookingTimelineStartMinute(right)
      : getBookingTimelineStartMinute(right) -
        getBookingTimelineStartMinute(left);
    if (byStartMinute !== 0) return byStartMinute;

    return String(left.id).localeCompare(String(right.id));
  });
  return sorted;
}

export function getBookingTimelineTotalPages(
  totalItems: number,
  pageSize: number,
) {
  const safePageSize = normalizePositiveInteger(pageSize, 1);
  const safeTotalItems = Number.isFinite(totalItems)
    ? Math.max(0, Math.floor(totalItems))
    : 0;
  return Math.max(1, Math.ceil(safeTotalItems / safePageSize));
}

export function clampBookingTimelinePage(page: number, totalPages: number) {
  const safeTotalPages = normalizePositiveInteger(totalPages, 1);
  const safePage = normalizePositiveInteger(page, 1);
  return Math.min(safePage, safeTotalPages);
}

export function paginateBookingTimeline<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
) {
  const safePageSize = normalizePositiveInteger(pageSize, 1);
  const totalPages = getBookingTimelineTotalPages(items.length, safePageSize);
  const safePage = clampBookingTimelinePage(page, totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    items: items.slice(start, start + safePageSize),
    page: safePage,
    totalPages,
  };
}

/** Groups rows in the order their already-sorted input first introduces each date. */
export function groupBookingTimelineByDate<T extends Pick<BookingTimelineRecord, "date">>(
  items: readonly T[],
) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const current = groups.get(item.date);
    if (current) {
      current.push(item);
    } else {
      groups.set(item.date, [item]);
    }
  });
  return Array.from(groups.entries());
}
