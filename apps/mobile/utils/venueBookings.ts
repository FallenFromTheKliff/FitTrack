import type { VenueBookingRecord } from "@fittrack/api-client";
import { mapVenueBookingRecord, mapVenueBookingRecords } from "@fittrack/app-core";
import type { Booking, FacilityFloorId, FloorVenueRecord, VenueRecord } from "@fittrack/types";

import { AMENITIES } from "@/data/bookings";
import { normalizeVenueIconKey, type VenueIconKey } from "@/utils/venueMap";
export type { VenueRecord } from "@fittrack/types";

export type VenuePresentation = {
  id: string;
  mapId?: string;
  floorId?: FacilityFloorId;
  sourceVenueId?: string | number;
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

export function toMobileBooking(record: VenueBookingRecord, venue?: VenueRecord): Booking {
  const presentation = venue ? getVenuePresentation(venue) : null;
  const booking = mapVenueBookingRecord(record, venue);
  return {
    ...booking,
    price: (venue?.hourlyRate ?? presentation?.price ?? 0) * record.durationHours
  };
}

export function toMobileBookings(records: VenueBookingRecord[], venues: VenueRecord[]): Booking[] {
  const bookings = mapVenueBookingRecords(records, venues);
  return bookings.map((booking) => {
    const venue = venues.find((entry) => String(entry.id) === booking.resourceId);
    const presentation = venue ? getVenuePresentation(venue) : null;
    const durationHours = records.find((record) => record.id === booking.id)?.durationHours ?? 0;
    const totalAmount = records.find((record) => record.id === booking.id)?.totalAmount;
    return {
      ...booking,
      price: totalAmount ?? (venue?.hourlyRate ?? presentation?.price ?? 0) * durationHours
    };
  });
}
