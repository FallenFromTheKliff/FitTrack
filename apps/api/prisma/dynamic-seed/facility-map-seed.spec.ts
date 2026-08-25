import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EquipmentStatus } from '@prisma/client';

import { CANONICAL_AMENITIES } from '../../../../packages/utils/fitness-catalog';
import {
  buildGymEquipmentSeedUpdate,
  buildAdditiveFloorMapUpdate,
  buildFacilityFloorMapSeedUpdate,
  FACILITY_FLOOR_MAP_SEEDS,
  shouldApplyCanonicalAmenityUpdate,
} from '../../../../packages/utils/facility-map-seed';
import { getAmenityBookingBlockReason } from '../../src/bookings/amenity/amenity-reservability';
import { GYM_EQUIPMENT } from './domains/ai-gym-analytics';

const key = (cell: { column: number; row: number }) =>
  `${cell.column}:${cell.row}`;

const expandRectangleToCells = (rectangle: {
  gridColumn: number;
  gridRow: number;
  gridWidth: number;
  gridHeight: number;
}) =>
  Array.from({ length: rectangle.gridHeight }, (_, row) =>
    Array.from({ length: rectangle.gridWidth }, (_, column) => ({
      column: rectangle.gridColumn + column,
      row: rectangle.gridRow + row,
    })),
  ).flat();

void test('facility seed maps keep regions and navigation valid', () => {
  const occupiedByFloor = new Map<string, Set<string>>();
  for (const amenity of CANONICAL_AMENITIES) {
    const map = FACILITY_FLOOR_MAP_SEEDS[amenity.floorId];
    const footprint = new Set(map.footprint.map(key));
    const occupied = occupiedByFloor.get(amenity.floorId) ?? new Set<string>();
    const [gridColumn, gridRow, gridWidth, gridHeight] = amenity.grid;
    for (const cell of expandRectangleToCells({
      gridColumn,
      gridRow,
      gridWidth,
      gridHeight,
    })) {
      assert(
        footprint.has(key(cell)),
        `${amenity.name} must remain inside footprint`,
      );
      assert(
        !occupied.has(key(cell)),
        `${amenity.name} must not overlap another region`,
      );
      assert(
        !map.paths.some((path) => key(path) === key(cell)),
        `${amenity.name} must not overlap a published path`,
      );
      occupied.add(key(cell));
    }
    occupiedByFloor.set(amenity.floorId, occupied);
  }

  for (const [floorId, map] of Object.entries(FACILITY_FLOOR_MAP_SEEDS)) {
    const footprint = new Set(map.footprint.map(key));
    const paths = new Set(map.paths.map(key));
    for (const cell of [...map.paths, ...map.entries, ...map.exits]) {
      assert(
        footprint.has(key(cell)),
        `${floorId} navigation must remain inside footprint`,
      );
    }
    for (const cell of [...map.entries, ...map.exits]) {
      assert(
        paths.has(key(cell)),
        `${floorId} entries/exits must connect to the path`,
      );
    }
  }
});

void test('additive floor seed preserves every already-published cell set', () => {
  const published = [{ column: 4, row: 4 }];
  const update = buildAdditiveFloorMapUpdate(
    {
      footprint_cells: published,
      path_cells: [],
      entry_cells: [],
      exit_cells: [],
    },
    FACILITY_FLOOR_MAP_SEEDS['floor-1'],
  );
  assert(!('footprint_cells' in update));
  assert(!('path_cells' in update));
  assert(!('entry_cells' in update));
  assert(!('exit_cells' in update));
});

void test('additive canonical facility seed preserves calibrated amenity and equipment placement', () => {
  assert.equal(
    shouldApplyCanonicalAmenityUpdate('additive', 'amenity-1', 'amenity-1'),
    false,
  );
  assert.equal(
    shouldApplyCanonicalAmenityUpdate('reset', 'amenity-1', 'amenity-1'),
    true,
  );

  const seededEquipment = {
    floor_id: 'floor-1',
    grid_column: 8,
    grid_row: 6,
    grid_width: 1,
    grid_height: 1,
    position_x: 53,
    position_y: 55,
    venue_id: 'venue-calibrated',
    name: 'Power Rack 1',
    status: 'available',
  };
  const additiveUpdate = buildGymEquipmentSeedUpdate('additive', seededEquipment);
  assert.equal('grid_column' in additiveUpdate, false);
  assert.equal('grid_row' in additiveUpdate, false);
  assert.equal('venue_id' in additiveUpdate, false);
  assert.equal(additiveUpdate.name, seededEquipment.name);
  assert.equal(
    buildGymEquipmentSeedUpdate('reset', seededEquipment).grid_column,
    seededEquipment.grid_column,
  );
});

void test('reset floor seed restores canonical map cells while additive preserves them', () => {
  const seed = FACILITY_FLOOR_MAP_SEEDS['floor-1'];
  const existing = {
    footprint_cells: [{ column: 14, row: 10 }],
    path_cells: [{ column: 14, row: 10 }],
    entry_cells: [],
    exit_cells: [],
  };
  const additiveUpdate = buildFacilityFloorMapSeedUpdate(
    'additive',
    existing,
    seed,
  );
  assert(!('footprint_cells' in additiveUpdate));
  assert(!('path_cells' in additiveUpdate));
  const resetUpdate = buildFacilityFloorMapSeedUpdate('reset', existing, seed);
  assert.deepEqual(resetUpdate.footprint_cells, seed.footprint);
  assert.deepEqual(resetUpdate.path_cells, seed.paths);
  assert.deepEqual(resetUpdate.entry_cells, seed.entries);
  assert.deepEqual(resetUpdate.exit_cells, seed.exits);
});

void test('legacy null or absent metadata receives canonical defaults', () => {
  const seed = FACILITY_FLOOR_MAP_SEEDS['floor-1'];
  const nullUpdate = buildAdditiveFloorMapUpdate(
    {
      footprint_cells: null,
      path_cells: null,
      entry_cells: null,
      exit_cells: null,
    },
    seed,
  );
  assert.deepEqual(nullUpdate.footprint_cells, seed.footprint);
  assert.deepEqual(nullUpdate.path_cells, seed.paths);
  assert.deepEqual(nullUpdate.entry_cells, seed.entries);
  assert.deepEqual(nullUpdate.exit_cells, seed.exits);

  const absentUpdate = buildAdditiveFloorMapUpdate({}, seed);
  assert.deepEqual(absentUpdate.footprint_cells, seed.footprint);
  assert.deepEqual(absentUpdate.path_cells, seed.paths);
  assert.deepEqual(absentUpdate.entry_cells, seed.entries);
  assert.deepEqual(absentUpdate.exit_cells, seed.exits);
});

void test('retained custom footprints never receive canonical navigation fallback', () => {
  const customFootprint = [{ column: 14, row: 10 }];
  const update = buildAdditiveFloorMapUpdate(
    {
      footprint_cells: customFootprint,
      path_cells: null,
    },
    FACILITY_FLOOR_MAP_SEEDS['floor-1'],
  );
  assert(!('footprint_cells' in update));
  assert.deepEqual(update.path_cells, []);
  assert.deepEqual(update.entry_cells, []);
  assert.deepEqual(update.exit_cells, []);
  assert(
    [...update.path_cells, ...update.entry_cells, ...update.exit_cells].every(
      (cell) =>
        customFootprint.some((candidate) => key(candidate) === key(cell)),
    ),
    'fallback navigation must not escape the retained footprint',
  );
});

void test('facility equipment seed is unique, linked, and contained', () => {
  const names = new Set<string>();
  const cells = new Set<string>();
  for (const equipment of GYM_EQUIPMENT) {
    const [, name, , floorId, column, row, , , , inventoryKey, venueKey] =
      equipment;
    assert(!names.has(name), `${name} must be unique`);
    names.add(name);
    assert(inventoryKey.length > 0, `${name} must link inventory`);
    const venue = CANONICAL_AMENITIES.find(
      (candidate) => candidate.key === venueKey,
    );
    assert(venue, `${name} must link a canonical venue`);
    const [gridColumn, gridRow, gridWidth, gridHeight] = venue.grid;
    assert(floorId === venue.floorId, `${name} must share its venue floor`);
    assert(
      column >= gridColumn && column < gridColumn + gridWidth,
      `${name} column must remain inside its venue`,
    );
    assert(
      row >= gridRow && row < gridRow + gridHeight,
      `${name} row must remain inside its venue`,
    );
    const cell = `${floorId}:${column}:${row}`;
    assert(!cells.has(cell), `${name} must occupy a unique map cell`);
    cells.add(cell);
  }
});

void test('maintenance venue stays visible but fails the booking rule', () => {
  const boxing = CANONICAL_AMENITIES.find(
    (amenity) => amenity.key === 'boxing-ring',
  );
  assert(boxing && 'status' in boxing && boxing.status === 'maintenance');
  assert.notEqual(
    getAmenityBookingBlockReason({
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      status: EquipmentStatus.maintenance,
    }),
    null,
  );
});
