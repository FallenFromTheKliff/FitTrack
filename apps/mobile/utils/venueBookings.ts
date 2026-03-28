import type { Booking, FacilityFloorId, FloorVenueRecord, VenueRecord } from "@fittrack/types";

import { AMENITIES } from "@/data/bookings";
import { normalizeVenueIconKey, type VenueIconKey } from "@/utils/venueMap";
export type { VenueRecord } from "@fittrack/types";

export type VenueBookingRecord = {
  id: string;
  venueId: number;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  durationHours: number;
};

export type VenuePresentation = {
  id: string;
  mapId?: string;
  floorId?: FacilityFloorId;
  sourceVenueId?: number;
  name: string;
  iconKey: VenueIconKey;
  emoji: string;
  maxSlots: number;
  price: number;
  unit: string;
  description?: string | null;
  isReservable: boolean;
  gridColumn: number;
  gridRow: number;
  gridWidth: number;
  gridHeight: number;
};

function findVenueMeta(venue: VenueRecord) {
  return AMENITIES.find((item) => item.id === venue.slug || item.name === venue.name);
}

export function getVenuePresentation(venue: VenueRecord): VenuePresentation {
  const match = findVenueMeta(venue);
  const floorVenue = venue as Partial<FloorVenueRecord>;
  const price = venue.hourlyRate ?? match?.price ?? 0;
  const unit = venue.hourlyRate != null ? "hr" : match?.unit ?? "session";
  return {
    id: venue.slug ?? match?.id ?? `venue-${venue.id}`,
    mapId: floorVenue.mapId,
    floorId: floorVenue.floorId,
    sourceVenueId: floorVenue.sourceVenueId,
    name: venue.name,
    iconKey: normalizeVenueIconKey(venue.iconKey ?? match?.iconKey),
    emoji: venue.name.slice(0, 1),
    maxSlots: venue.capacity ?? match?.maxSlots ?? 0,
    price,
    unit,
    description: venue.description,
    isReservable: venue.isReservable ?? match?.isReservable ?? true,
    gridColumn: venue.gridColumn ?? 1,
    gridRow: venue.gridRow ?? 1,
    gridWidth: venue.gridWidth ?? 2,
    gridHeight: venue.gridHeight ?? 2
  };
}

function toBookingStatus(status: VenueBookingRecord["status"]): Booking["status"] {
  if (status === "cancelled") return "cancelled";
  if (status === "pending") return "waitlisted";
  return "confirmed";
}

export function toMobileBooking(record: VenueBookingRecord, venue?: VenueRecord): Booking {
  const start = new Date(record.startTime);
  const end = new Date(record.endTime);
  const startLabel = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const endLabel = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const presentation = venue ? getVenuePresentation(venue) : null;
  const hourlyRate = venue?.hourlyRate ?? presentation?.price ?? 0;

  return {
    id: record.id,
    resourceId: String(record.venueId),
    resourceName: venue?.name ?? "[MOVED/DELETED]",
    resourceType: "venue",
    date: start.toISOString().slice(0, 10),
    time: `${startLabel} - ${endLabel}`,
    startTime: startLabel,
    endTime: endLabel,
    status: toBookingStatus(record.status),
    price: hourlyRate * record.durationHours
  };
}

export function toMobileBookings(records: VenueBookingRecord[], venues: VenueRecord[]): Booking[] {
  const venueMap = new Map(venues.map((venue) => [venue.id, venue]));
  return records.map((record) => toMobileBooking(record, venueMap.get(record.venueId)));
}
