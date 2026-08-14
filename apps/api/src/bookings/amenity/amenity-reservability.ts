import { EquipmentStatus } from '@prisma/client';

export type AmenityReservabilityInput = {
  is_active?: boolean | null;
  is_mapped?: boolean | null;
  is_reservable?: boolean | null;
  status?: EquipmentStatus | null;
};

export function getAmenityBookingBlockReason(
  amenity: AmenityReservabilityInput,
): string | null {
  if (amenity.is_active === false) return 'This venue is inactive.';
  if (amenity.is_mapped === false) {
    return 'This venue is not published to booking surfaces.';
  }
  if (amenity.is_reservable === false || amenity.is_reservable === null) {
    return 'This venue is not enabled for reservations.';
  }
  if (amenity.status === EquipmentStatus.maintenance) {
    return 'This venue is under maintenance and cannot be booked.';
  }
  if (
    amenity.status !== null &&
    amenity.status !== undefined &&
    amenity.status !== EquipmentStatus.available
  ) {
    return `This venue is ${amenity.status} and cannot be booked.`;
  }
  return null;
}

export function isAmenityBookable(amenity: AmenityReservabilityInput): boolean {
  return getAmenityBookingBlockReason(amenity) === null;
}
