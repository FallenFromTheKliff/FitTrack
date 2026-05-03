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
  if (normalized === "balance_pending") return "pending_full_payment";
  if (normalized === "pending_downpayment") return "pending_downpayment";
  if (normalized === "pending_payment") return "pending_payment";
  if (normalized === "pending_full_payment") return "pending_full_payment";
  if (normalized === "pending") return "pending";
  if (normalized === "completed") return "completed";
  return "confirmed";
}

function toVenueBookingDisplayStatus(record: VenueBookingRecord): Booking["status"] {
  const normalized = normalizeBookingStatus(record.status);
  const totalAmount = Number(record.totalAmount ?? 0);
  const remainingBalance = Number(record.remainingBalance ?? 0);
  const hasOutstandingBalance = remainingBalance > 0 && !record.balancePaidAt;

  if (normalized === "cancelled") {
    return "cancelled";
  }
  if (normalized === "no_show") return "no_show";
  if (normalized === "completed") return "completed";
  if (normalized === "balance_pending") return "pending_full_payment";
  if (normalized === "confirmed" && hasOutstandingBalance) {
    return "pending_full_payment";
  }
  if (normalized === "pending") {
    if (record.paymentPlan === "downpayment" || hasOutstandingBalance) {
      return "pending_downpayment";
    }
    if (record.paymentPlan === "full" || totalAmount > 0) {
      return "pending_full_payment";
    }
    return "pending";
  }
  return toVenueBookingStatus(record.status);
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
    amountDueNow: record.amountDueNow ?? undefined,
    remainingBalance: record.remainingBalance ?? undefined,
    nextPaymentDate: record.nextPaymentDate ?? undefined,
    paymentPlan: record.paymentPlan ?? undefined,
    id: record.id,
    resourceId: String(record.venueId),
    resourceName: venue?.name ?? "[MOVED/DELETED]",
    resourceType: "venue",
    date,
    time: `${startLabel} - ${endLabel}`,
    startTime: startLabel,
    endTime: endLabel,
    description: record.purpose ?? undefined,
    status: toVenueBookingDisplayStatus(record),
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
