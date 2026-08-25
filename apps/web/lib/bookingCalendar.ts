export type BookingCalendarTone = "available" | "full" | "unavailable";

type CalendarSlot = { available?: boolean | null; status?: string | null };

/**
 * Keep the member calendar's state colors aligned with the mobile booking
 * calendar: a date with an open slot is available, a date whose known slots
 * are all occupied is full, and a missing/empty response is unavailable.
 */
export function getBookingCalendarTone(
  slots: readonly CalendarSlot[] | null | undefined,
): BookingCalendarTone {
  if (!slots || slots.length === 0) return "unavailable";
  const hasAvailableSlot = slots.some(
    (slot) => slot.status === "available" || slot.available === true,
  );
  if (hasAvailableSlot) return "available";

  if (slots.some((slot) => slot.available === false)) return "full";

  // Mobile treats an explicit unavailable response as a blocked date, not a
  // fully-booked date. A full/red date requires at least one concrete
  // occupied slot in the response; unknown-only rows remain unavailable.
  const hasConcreteSlot = slots.some(
    (slot) => slot.status != null && slot.status.trim().length > 0,
  );
  if (!hasConcreteSlot) return "unavailable";
  const hasUnavailableSlot = slots.some(
    (slot) => slot.status?.toLowerCase() === "unavailable",
  );
  return hasUnavailableSlot && slots.every(
    (slot) => slot.status?.toLowerCase() === "unavailable",
  )
    ? "unavailable"
    : "full";
}

export function getUpcomingBookingDateKeys(
  startDate: string,
  count = 90,
): string[] {
  const cursor = new Date(`${startDate}T00:00:00`);
  if (!startDate || Number.isNaN(cursor.getTime()) || count <= 0) return [];
  return Array.from({ length: count }, (_, index) => {
    const nextDate = new Date(cursor);
    nextDate.setDate(cursor.getDate() + index);
    return [nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate()]
      .map((value, part) => (part === 0 ? String(value) : String(value).padStart(2, "0")))
      .join("-");
  });
}
