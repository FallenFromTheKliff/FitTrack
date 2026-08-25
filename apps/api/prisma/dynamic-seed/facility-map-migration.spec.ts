import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const sql = readFileSync(
  resolve(
    __dirname,
    '..',
    'migrations',
    '20260825173000_facility_floor_cell_map',
    'migration.sql',
  ),
  'utf8',
);

void test('facility map migration creates missing media and is rerunnable', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "footprint_cells"/);
  assert.match(
    sql,
    /FROM \(VALUES \('floor-1'\), \('floor-2'\), \('floor-3'\)\)/,
  );
  assert.match(sql, /ON CONFLICT \("floor_id"\) DO NOTHING/);
  assert.match(
    sql,
    /CREATE TEMP TABLE "_facility_legacy_path_copy" ON COMMIT DROP/,
  );
});

void test('legacy path copy validates bounds, footprint, and region conflicts', () => {
  assert.match(sql, /legacy\."grid_column" \+ legacy\."grid_width" - 1 <= 14/);
  assert.match(sql, /legacy\."grid_row" \+ legacy\."grid_height" - 1 <= 10/);
  assert.match(sql, /media\."footprint_cells" @> jsonb_build_array/);
  assert.match(sql, /lower\(trim\(region\."name"\)\) <> 'path \/ walkway'/);
});

void test('pre-existing valid paths are merged and only copied paths are unpublished', () => {
  assert.match(sql, /media_row\."path_cells" \|\| copied\.cells/);
  assert.match(sql, /WHERE legacy\."id" = copied\."id"/);
  assert.match(
    sql,
    /WHERE NOT \(media\."path_cells" @> jsonb_build_array\(copied_cell\)\)/,
  );
  assert.doesNotMatch(
    sql,
    /UPDATE "amenities"\s+SET "is_mapped" = false[\s\S]*WHERE lower\(trim\("?name"?\)\) = 'path \/ walkway'/,
  );
});
