import { EquipmentStatus } from '@prisma/client';

import {
  getAmenityBookingBlockReason,
  isAmenityBookable,
} from './amenity-reservability';

const bookableAmenity = {
  is_active: true,
  is_mapped: true,
  is_reservable: true,
  status: EquipmentStatus.available,
};

describe('amenity reservability', () => {
  it('requires an active, published, explicitly reservable, available venue', () => {
    expect(isAmenityBookable(bookableAmenity)).toBe(true);
    expect(
      isAmenityBookable({
        ...bookableAmenity,
        status: EquipmentStatus.maintenance,
      }),
    ).toBe(false);
    expect(
      getAmenityBookingBlockReason({
        ...bookableAmenity,
        status: EquipmentStatus.maintenance,
      }),
    ).toContain('under maintenance');
  });

  it.each([
    [{ ...bookableAmenity, is_active: false }, 'inactive'],
    [{ ...bookableAmenity, is_mapped: false }, 'not published'],
    [{ ...bookableAmenity, is_reservable: false }, 'not enabled'],
    [{ ...bookableAmenity, is_reservable: null }, 'not enabled'],
  ] as const)(
    'rejects a venue that is not fully bookable',
    (amenity, reason) => {
      expect(isAmenityBookable(amenity)).toBe(false);
      expect(getAmenityBookingBlockReason(amenity)).toContain(reason);
    },
  );
});
