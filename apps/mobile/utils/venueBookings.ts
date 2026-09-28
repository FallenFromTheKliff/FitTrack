import type { VenueBookingRecord } from "@fittrack/api-client";
import { mapVenueBookingRecord, mapVenueBookingRecords } from "@fittrack/app-core";
import type {
  Booking,
  EquipmentStatus,
  FacilityFloorId,
  FloorVenueRecord,
  VenueRecord
} from "@fittrack/types";

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
  status: EquipmentStatus | null;
  unit: string;
  description?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  isReservable: boolean;
  gridColumn: number;
  gridRow: number;
  gridWidth: number;
  gridHeight: number;
};

type VenuePresentationInput = VenueRecord & {
  mapId?: string;
  floorId?: FacilityFloorId | null;
  sourceVenueId?: string | number;
};

export function getVenuePresentation(venue: VenuePresentationInput): VenuePresentation {
  const floorVenue = venue as Partial<FloorVenueRecord>;
  const price = venue.hourlyRate ?? 0;
  const unit = venue.hourlyRate != null ? "hr" : "session";
  return {
    id: venue.slug ?? `venue-${venue.id}`,
    mapId: floorVenue.mapId,
    floorId: floorVenue.floorId,
    sourceVenueId: floorVenue.sourceVenueId,
    name: venue.name,
    iconKey: normalizeVenueIconKey(venue.iconKey),
    emoji: venue.name.slice(0, 1),
    maxSlots: venue.capacity ?? 0,
    price,
    status: venue.status ?? null,
    unit,
    description: venue.description,
    imageUrl: venue.imageUrl,
    imageUrls: venue.imageUrls ?? (venue.imageUrl ? [venue.imageUrl] : []),
    isReservable: venue.isReservable ?? true,
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
