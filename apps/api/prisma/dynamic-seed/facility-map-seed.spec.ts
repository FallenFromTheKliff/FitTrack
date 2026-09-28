import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EquipmentStatus } from '@prisma/client';

import { CANONICAL_AMENITIES } from '../../../../packages/utils/fitness-catalog';
import {
  buildGymEquipmentSeedUpdate,
  buildAdditiveFloorMapUpdate,
  buildFacilityFloorMapSeedUpdate,
  calculateFacilityMapRebase,
  FACILITY_FLOOR_MAP_SEEDS,
  isExactCenteredFacilityFloorMap,
  isExactLegacyFacilityFloorMap,
  LEGACY_FACILITY_FLOOR_MAP_SEEDS,
  translateFacilityGridPlacement,
  shouldApplyCanonicalAmenityUpdate,
  shouldRepairCanonicalAmenityReservability,
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

void test('custom off-center sparse maps and placements share one origin translation', () => {
  const existing = {
    footprint_cells: [
      { column: 10, row: 20 },
      { column: 12, row: 22 },
    ],
    path_cells: [{ column: 11, row: 21 }],
    entry_cells: [{ column: 10, row: 21 }],
    exit_cells: [{ column: 12, row: 21 }],
  };
  const rebase = calculateFacilityMapRebase(existing);
  assert(rebase);
  assert.deepEqual(rebase.translation, { column: 489, row: 479 });
  assert.deepEqual(rebase.update.footprint_cells, [
    { column: 499, row: 499 },
    { column: 501, row: 501 },
  ]);
  assert.deepEqual(rebase.update.path_cells, [{ column: 500, row: 500 }]);

  const translated = translateFacilityGridPlacement(
    {
      floor_id: 'floor-1',
      grid_column: 10,
      grid_row: 20,
      grid_width: 2,
      grid_height: 2,
    },
    rebase.translation,
  );
  assert.deepEqual(translated, { grid_column: 499, grid_row: 499 });
});

void test('already centered sparse map is a deterministic no-op', () => {
  const map = {
    footprint_cells: [
      { column: 499, row: 499 },
      { column: 501, row: 501 },
    ],
    path_cells: [{ column: 500, row: 500 }],
    entry_cells: null,
    exit_cells: null,
  };
  const rebase = calculateFacilityMapRebase(map);
  assert(rebase);
  assert.deepEqual(rebase.translation, { column: 0, row: 0 });
  assert.deepEqual(rebase.update, {});
  assert.deepEqual(calculateFacilityMapRebase(map), rebase);
});

void test('only exact small legacy map shape qualifies for origin migration', () => {
  const legacy = LEGACY_FACILITY_FLOOR_MAP_SEEDS['floor-1'];
  const persisted = {
    grid_width: 14,
    grid_height: 10,
    footprint_cells: [...legacy.footprint],
    path_cells: [...legacy.paths],
    entry_cells: [...legacy.entries],
    exit_cells: [...legacy.exits],
  };
  assert.equal(isExactLegacyFacilityFloorMap(persisted, 'floor-1'), true);
  assert.equal(isExactCenteredFacilityFloorMap(persisted, 'floor-1'), false);
  assert.equal(
    isExactLegacyFacilityFloorMap(
      {
        ...persisted,
        footprint_cells: [...persisted.footprint_cells, { column: 15, row: 1 }],
      },
      'floor-1',
    ),
    false,
  );
  assert.equal(
    isExactLegacyFacilityFloorMap(
      {
        ...persisted,
        path_cells: persisted.path_cells.map((cell, index) =>
          index === 0 ? { ...cell, column: 0 } : cell,
        ),
      },
      'floor-1',
    ),
    false,
  );
});

void test('invalid source or translated placement fails closed', () => {
  assert.equal(
    translateFacilityGridPlacement(
      {
        grid_column: 0,
        grid_row: 10,
        grid_width: 1,
        grid_height: 1,
      },
      { column: 10, row: 10 },
    ),
    null,
  );
  assert.equal(
    translateFacilityGridPlacement(
      {
        grid_column: 999,
        grid_row: 999,
        grid_width: 2,
        grid_height: 2,
      },
      { column: 1, row: 1 },
    ),
    null,
  );
  assert.equal(
    calculateFacilityMapRebase({
      footprint_cells: [{ column: 1, row: 1 }],
      path_cells: [{ column: 1001, row: 1 }],
    }),
    null,
  );
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
  const additiveUpdate = buildGymEquipmentSeedUpdate(
    'additive',
    seededEquipment,
  );
  assert.equal('grid_column' in additiveUpdate, false);
  assert.equal('grid_row' in additiveUpdate, false);
  assert.equal('venue_id' in additiveUpdate, false);
  assert.equal(additiveUpdate.name, seededEquipment.name);
  assert.equal(
    buildGymEquipmentSeedUpdate('reset', seededEquipment).grid_column,
    seededEquipment.grid_column,
  );
});

void test('canonical non-reservable venues repair only the retired zero-rate seed state', () => {
  const reception = CANONICAL_AMENITIES.find(
    (amenity) => amenity.key === 'reception',
  );
  const generalFloor = CANONICAL_AMENITIES.find(
    (amenity) => amenity.key === 'general-floor',
  );
  assert.equal(reception?.isReservable, false);
  assert.equal(generalFloor?.isReservable, false);

  assert.equal(
    shouldRepairCanonicalAmenityReservability('additive', false, true, 0),
    true,
  );
  assert.equal(
    shouldRepairCanonicalAmenityReservability('additive', false, true, null),
    true,
  );
  assert.equal(
    shouldRepairCanonicalAmenityReservability('additive', false, true, 250),
    false,
  );
  assert.equal(
    shouldRepairCanonicalAmenityReservability('reset', false, true, 0),
    false,
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

void test('empty floor metadata is repaired as an uninitialized seed row', () => {
  const seed = FACILITY_FLOOR_MAP_SEEDS['floor-1'];
  const update = buildAdditiveFloorMapUpdate(
    {
      footprint_cells: [],
      path_cells: [],
      entry_cells: [],
      exit_cells: [],
    },
    seed,
  );
  assert.deepEqual(update.footprint_cells, seed.footprint);
  assert(!('path_cells' in update));
  assert(!('entry_cells' in update));
  assert(!('exit_cells' in update));
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
