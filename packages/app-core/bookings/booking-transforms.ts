import type { VenueBookingRecord } from "@fittrack/api-client";
import type { Booking, VenueRecord } from "@fittrack/types";

export function normalizeBookingStatus(status?: string, fallback = "pending") {
  return (status ?? fallback).toLowerCase();
}

export function toDateTimeRange(
  startIso: string,
  durationMinutes: number,
  explicitEnd?: string,
) {
  const start = new Date(startIso);
  const end = explicitEnd
    ? new Date(explicitEnd)
    : new Date(start.getTime() + durationMinutes * 60_000);
  const startLabel = start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endLabel = end.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    date: start.toISOString().slice(0, 10),
    endLabel,
    startLabel,
  };
}

export function toVenueBookingStatus(status?: string): Booking["status"] {
  const normalized = normalizeBookingStatus(status);
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "no_show") return "no_show";
  if (normalized === "pending") return "pending";
  if (normalized === "completed") return "completed";
  if (normalized === "confirmed") return "confirmed";
  return "cancelled";
}

function getStandaloneCoachName(
  coach?: { displayName?: string | null } | null,
) {
  const displayName = coach?.displayName?.trim();
  return displayName && !displayName.includes("@") ? displayName : undefined;
}

export function mapVenueBookingRecord(
  record: VenueBookingRecord,
  venue?: VenueRecord,
): Booking {
  const { date, endLabel, startLabel } = toDateTimeRange(
    record.startTime,
    record.durationHours * 60,
    record.endTime,
  );
  const hourlyRate = venue?.hourlyRate ?? 0;
  const coachName = getStandaloneCoachName(record.coach);

  return {
    totalAmount: record.totalAmount ?? undefined,
    id: record.id,
    resourceId: String(record.venueId),
    resourceName: venue?.name ?? "[MOVED/DELETED]",
    resourceType: "venue",
    date,
    time: `${startLabel} - ${endLabel}`,
    startTime: startLabel,
    endTime: endLabel,
    description: record.purpose ?? undefined,
    status: toVenueBookingStatus(record.status),
    price: hourlyRate * record.durationHours,
    trainerId: record.coach?.id ?? record.coachId ?? undefined,
    trainerName: coachName,
  };
}

export function mapVenueBookingRecords(
  records: VenueBookingRecord[],
  venues: VenueRecord[],
) {
  const venueMap = new Map(venues.map((venue) => [venue.id, venue]));
  return records.map((record) =>
    mapVenueBookingRecord(record, venueMap.get(record.venueId)),
  );
}
