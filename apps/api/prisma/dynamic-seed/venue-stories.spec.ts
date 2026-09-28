import assert from 'node:assert/strict';
import { AMENITY_SEEDS } from './domains/facilities-coaching';
import { BOOKING_PROFILE_BASE_COUNTS } from './volumes';
import { FACILITY_FLOOR_MAP_SEEDS } from '../../../../packages/utils/facility-map-seed';

function cells(rectangle: readonly [number, number, number, number]) {
  const [column, row, width, height] = rectangle;
  return Array.from({ length: width * height }, (_, index) => ({
    column: column + (index % width),
    row: row + Math.floor(index / width),
  }));
}

function cellKey(cell: { column: number; row: number }) {
  return `${cell.column}:${cell.row}`;
}

type SeedAmenity = {
  name: string;
  capacity: number;
  hourlyRate: string;
  floorId: string;
  isReservable?: boolean;
  status?: string;
  grid: readonly [number, number, number, number];
};

const amenitiesByKey = new Map(AMENITY_SEEDS.map((amenity) => [amenity.key, amenity]));
type AmenityKey = (typeof AMENITY_SEEDS)[number]['key'];

function getAmenity(key: AmenityKey): SeedAmenity {
  const amenity = amenitiesByKey.get(key);
  assert.ok(amenity, `${key} seed is missing`);
  return amenity as SeedAmenity;
}

const floor = FACILITY_FLOOR_MAP_SEEDS['floor-1'];
const footprint = new Set(floor.footprint.map(cellKey));
const paths = new Set(floor.paths.map(cellKey));

assert.equal(getAmenity('reception').isReservable, false);
assert.equal(getAmenity('general-floor').isReservable, false);
assert.equal(getAmenity('mobility-studio').name, 'Yoga Room');
assert.equal(getAmenity('boxing-ring').isReservable, true);
assert.equal(getAmenity('boxing-ring').status, 'available');

for (const [key, expected] of [
  ['volleyball-court', { name: 'Volleyball Court', capacity: 12, hourlyRate: '800' }],
  ['octagon-ring', { name: 'Octagon Ring', capacity: 4, hourlyRate: '600' }],
] as const) {
  const amenity = getAmenity(key);
  assert.equal(amenity.name, expected.name);
  assert.equal(amenity.capacity, expected.capacity);
  assert.equal(amenity.hourlyRate, expected.hourlyRate);
  assert.equal(amenity.floorId, 'floor-1');
  assert.equal(amenity.isReservable, true);
  for (const cell of cells(amenity.grid)) {
    assert.equal(footprint.has(cellKey(cell)), true, `${key} leaves the floor footprint`);
    assert.equal(paths.has(cellKey(cell)), false, `${key} overlaps a path`);
  }
}

const volleyballCells = new Set(cells(getAmenity('volleyball-court').grid).map(cellKey));
for (const cell of cells(getAmenity('octagon-ring').grid)) {
  assert.equal(volleyballCells.has(cellKey(cell)), false, 'new venue rectangles overlap');
}

assert.deepEqual(BOOKING_PROFILE_BASE_COUNTS, {
  none: 0,
  occasional: 4,
  regular: 12,
  heavy: 24,
});

console.log('venue-stories.spec passed');
