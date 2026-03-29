import type { VenueBookingRecord } from "@fittrack/api-client";
import type { Booking, VenueRecord } from "@fittrack/types";

export function normalizeBookingStatus(status?: string, fallback = "pending") {
  return (status ?? fallback).toLowerCase();
}

export function toDateTimeRange(startIso: string, durationMinutes: number, explicitEnd?: string) {
  const start = new Date(startIso);
  const end = explicitEnd ? new Date(explicitEnd) : new Date(start.getTime() + durationMinutes * 60_000);
  const startLabel = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const endLabel = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    date: start.toISOString().slice(0, 10),
    endLabel,
    startLabel
  };
}

export function toVenueBookingStatus(status?: string): Booking["status"] {
  const normalized = normalizeBookingStatus(status);
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "pending") return "waitlisted";
  return "confirmed";
}

export function mapVenueBookingRecord(record: VenueBookingRecord, venue?: VenueRecord): Booking {
  const { date, endLabel, startLabel } = toDateTimeRange(record.startTime, record.durationHours * 60, record.endTime);
  const hourlyRate = venue?.hourlyRate ?? 0;

  return {
    id: record.id,
    resourceId: String(record.venueId),
    resourceName: venue?.name ?? "[MOVED/DELETED]",
    resourceType: "venue",
    date,
    time: `${startLabel} - ${endLabel}`,
    startTime: startLabel,
    endTime: endLabel,
    status: toVenueBookingStatus(record.status),
    price: hourlyRate * record.durationHours
  };
}

export function mapVenueBookingRecords(records: VenueBookingRecord[], venues: VenueRecord[]) {
  const venueMap = new Map(venues.map((venue) => [venue.id, venue]));
  return records.map((record) => mapVenueBookingRecord(record, venueMap.get(record.venueId)));
}
