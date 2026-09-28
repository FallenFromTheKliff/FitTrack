import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EquipmentStatus } from '@prisma/client';

import { selectAmenityBookingCandidates } from './domains/facilities-coaching';

const amenities = [
  {
    id: 'reception',
    capacity: 6,
    hourlyRate: 0,
    isActive: true,
    isMapped: true,
    isReservable: false,
    requiresSubscription: false,
    status: null,
  },
  {
    id: 'general-floor',
    capacity: 20,
    hourlyRate: 0,
    isActive: true,
    isMapped: true,
    isReservable: false,
    requiresSubscription: false,
    status: null,
  },
  {
    id: 'zero-rate-reservable',
    capacity: 2,
    hourlyRate: 0,
    isActive: true,
    isMapped: true,
    isReservable: true,
    requiresSubscription: false,
    status: null,
  },
  {
    id: 'basketball-court',
    capacity: 4,
    hourlyRate: 900,
    isActive: true,
    isMapped: true,
    isReservable: true,
    requiresSubscription: false,
    status: EquipmentStatus.available,
  },
  {
    id: 'mobility-studio',
    capacity: 2,
    hourlyRate: 650,
    isActive: true,
    isMapped: true,
    isReservable: true,
    requiresSubscription: true,
    status: null,
  },
] as const;

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

void test('booking candidates exclude retired zones and preserve future subscription eligibility', () => {
  assert.deepEqual(ids(selectAmenityBookingCandidates(amenities, true)), [
    'basketball-court',
    'mobility-studio',
  ]);
  assert(
    selectAmenityBookingCandidates(amenities, true).every(
      (amenity) => amenity.hourlyRate > 0,
    ),
  );

  assert.deepEqual(
    ids(
      selectAmenityBookingCandidates(amenities, false, {
        memberPersona: 'active',
        coachingProfile: 'one_time',
      }),
    ),
    ['basketball-court'],
  );
  assert.deepEqual(
    ids(
      selectAmenityBookingCandidates(amenities, false, {
        memberPersona: 'premium',
        coachingProfile: 'one_time',
      }),
    ),
    ['basketball-court', 'mobility-studio'],
  );
  assert.deepEqual(
    ids(
      selectAmenityBookingCandidates(amenities, false, {
        memberPersona: 'active',
        coachingProfile: 'recurring_active',
      }),
    ),
    ['basketball-court', 'mobility-studio'],
  );
});
