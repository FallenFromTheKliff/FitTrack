BEGIN;

ALTER TABLE "facility_floor_plan_media"
  ADD COLUMN IF NOT EXISTS "footprint_cells" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "path_cells" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "entry_cells" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "exit_cells" JSONB NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO "facility_floor_plan_media" (
  "floor_id", "grid_width", "grid_height", "footprint_cells"
)
SELECT floor_id, 14, 10, (
  SELECT jsonb_agg(
    jsonb_build_object('column', grid_column, 'row', grid_row)
    ORDER BY grid_row, grid_column
  )
  FROM generate_series(1, 10) AS grid_row
  CROSS JOIN generate_series(1, 14) AS grid_column
)
FROM (VALUES ('floor-1'), ('floor-2'), ('floor-3')) AS supported(floor_id)
ON CONFLICT ("floor_id") DO NOTHING;

-- Normalize footprints to unique in-bounds integer cells. Empty or malformed
-- footprints receive the safe full-grid compatibility fallback.
UPDATE "facility_floor_plan_media" AS media
SET "grid_width" = 14,
    "grid_height" = 10,
    "footprint_cells" = COALESCE(NULLIF((
      SELECT jsonb_agg(cell ORDER BY (cell->>'row')::int, (cell->>'column')::int)
      FROM (
        SELECT DISTINCT jsonb_build_object(
          'column', (raw_cell->>'column')::int,
          'row', (raw_cell->>'row')::int
        ) AS cell
        FROM jsonb_array_elements(CASE
          WHEN jsonb_typeof(media."footprint_cells") = 'array'
            THEN media."footprint_cells"
          ELSE '[]'::jsonb
        END) AS raw_cell
        WHERE jsonb_typeof(raw_cell) = 'object'
          AND jsonb_typeof(raw_cell->'column') = 'number'
          AND jsonb_typeof(raw_cell->'row') = 'number'
          AND raw_cell->>'column' ~ '^[0-9]+$'
          AND raw_cell->>'row' ~ '^[0-9]+$'
          AND (raw_cell->>'column')::int BETWEEN 1 AND 14
          AND (raw_cell->>'row')::int BETWEEN 1 AND 10
      ) AS normalized
    ), '[]'::jsonb), (
      SELECT jsonb_agg(
        jsonb_build_object('column', grid_column, 'row', grid_row)
        ORDER BY grid_row, grid_column
      )
      FROM generate_series(1, 10) AS grid_row
      CROSS JOIN generate_series(1, 14) AS grid_column
    ));

-- Keep only pre-existing path cells that remain within the footprint and clear
-- of mapped venue/support rectangles.
UPDATE "facility_floor_plan_media" AS media
SET "path_cells" = COALESCE((
  SELECT jsonb_agg(cell ORDER BY (cell->>'row')::int, (cell->>'column')::int)
  FROM (
    SELECT DISTINCT jsonb_build_object(
      'column', (raw_cell->>'column')::int,
      'row', (raw_cell->>'row')::int
    ) AS cell
    FROM jsonb_array_elements(CASE
      WHEN jsonb_typeof(media."path_cells") = 'array'
        THEN media."path_cells"
      ELSE '[]'::jsonb
    END) AS raw_cell
    WHERE jsonb_typeof(raw_cell) = 'object'
      AND jsonb_typeof(raw_cell->'column') = 'number'
      AND jsonb_typeof(raw_cell->'row') = 'number'
      AND raw_cell->>'column' ~ '^[0-9]+$'
      AND raw_cell->>'row' ~ '^[0-9]+$'
      AND (raw_cell->>'column')::int BETWEEN 1 AND 14
      AND (raw_cell->>'row')::int BETWEEN 1 AND 10
      AND media."footprint_cells" @> jsonb_build_array(jsonb_build_object(
        'column', (raw_cell->>'column')::int,
        'row', (raw_cell->>'row')::int
      ))
      AND NOT EXISTS (
        SELECT 1 FROM "amenities" AS region
        WHERE region."floor_id" = media."floor_id"
          AND region."is_active" = true
          AND region."is_mapped" = true
          AND lower(trim(region."name")) <> 'path / walkway'
          AND (raw_cell->>'column')::int BETWEEN region."grid_column"
            AND region."grid_column" + region."grid_width" - 1
          AND (raw_cell->>'row')::int BETWEEN region."grid_row"
            AND region."grid_row" + region."grid_height" - 1
      )
  ) AS normalized
), '[]'::jsonb);

-- Stage complete legacy rectangles only when every cell is valid, lies in the
-- footprint, and is clear of mapped venue/support regions.
CREATE TEMP TABLE "_facility_legacy_path_copy" ON COMMIT DROP AS
WITH legacy_cells AS (
  SELECT legacy."id", legacy."floor_id",
    generated_column.value AS column_value,
    generated_row.value AS row_value
  FROM "amenities" AS legacy
  CROSS JOIN LATERAL generate_series(
    legacy."grid_column", legacy."grid_column" + legacy."grid_width" - 1
  ) AS generated_column(value)
  CROSS JOIN LATERAL generate_series(
    legacy."grid_row", legacy."grid_row" + legacy."grid_height" - 1
  ) AS generated_row(value)
  WHERE lower(trim(legacy."name")) = 'path / walkway'
    AND legacy."is_active" = true
    AND legacy."is_mapped" = true
    AND legacy."floor_id" IN ('floor-1', 'floor-2', 'floor-3')
    AND legacy."grid_column" IS NOT NULL
    AND legacy."grid_row" IS NOT NULL
    AND legacy."grid_width" > 0
    AND legacy."grid_height" > 0
), valid_legacy AS (
  SELECT legacy."id", legacy."floor_id"
  FROM "amenities" AS legacy
  JOIN "facility_floor_plan_media" AS media
    ON media."floor_id" = legacy."floor_id"
  WHERE lower(trim(legacy."name")) = 'path / walkway'
    AND legacy."is_active" = true
    AND legacy."is_mapped" = true
    AND legacy."floor_id" IN ('floor-1', 'floor-2', 'floor-3')
    AND legacy."grid_column" BETWEEN 1 AND 14
    AND legacy."grid_row" BETWEEN 1 AND 10
    AND legacy."grid_width" > 0
    AND legacy."grid_height" > 0
    AND legacy."grid_column" + legacy."grid_width" - 1 <= 14
    AND legacy."grid_row" + legacy."grid_height" - 1 <= 10
    AND NOT EXISTS (
      SELECT 1 FROM legacy_cells AS cell
      WHERE cell."id" = legacy."id"
        AND NOT (media."footprint_cells" @> jsonb_build_array(
          jsonb_build_object('column', cell.column_value, 'row', cell.row_value)
        ))
    )
    AND NOT EXISTS (
      SELECT 1 FROM legacy_cells AS cell
      JOIN "amenities" AS region
        ON region."floor_id" = legacy."floor_id"
       AND region."id" <> legacy."id"
       AND region."is_active" = true
       AND region."is_mapped" = true
       AND lower(trim(region."name")) <> 'path / walkway'
       AND cell.column_value BETWEEN region."grid_column"
         AND region."grid_column" + region."grid_width" - 1
       AND cell.row_value BETWEEN region."grid_row"
         AND region."grid_row" + region."grid_height" - 1
      WHERE cell."id" = legacy."id"
    )
)
SELECT valid_legacy."id", valid_legacy."floor_id",
  jsonb_agg(DISTINCT jsonb_build_object(
    'column', legacy_cells.column_value,
    'row', legacy_cells.row_value
  )) AS cells
FROM valid_legacy
JOIN legacy_cells ON legacy_cells."id" = valid_legacy."id"
GROUP BY valid_legacy."id", valid_legacy."floor_id";

-- Merge valid legacy cells with valid pre-existing paths; never replace them.
UPDATE "facility_floor_plan_media" AS media
SET "path_cells" = merged.cells
FROM (
  SELECT media_row."floor_id", jsonb_agg(DISTINCT jsonb_build_object(
    'column', (raw_cell->>'column')::int,
    'row', (raw_cell->>'row')::int
  )) AS cells
  FROM "facility_floor_plan_media" AS media_row
  JOIN "_facility_legacy_path_copy" AS copied
    ON copied."floor_id" = media_row."floor_id"
  CROSS JOIN LATERAL jsonb_array_elements(
    media_row."path_cells" || copied.cells
  ) AS raw_cell
  GROUP BY media_row."floor_id"
) AS merged
WHERE media."floor_id" = merged."floor_id";

-- Unpublish only after every staged cell is proven present in the destination.
UPDATE "amenities" AS legacy
SET "is_mapped" = false, "updated_at" = CURRENT_TIMESTAMP
FROM "_facility_legacy_path_copy" AS copied
JOIN "facility_floor_plan_media" AS media
  ON media."floor_id" = copied."floor_id"
WHERE legacy."id" = copied."id"
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(copied.cells) AS copied_cell
    WHERE NOT (media."path_cells" @> jsonb_build_array(copied_cell))
  );

ALTER TABLE "facility_floor_plan_media"
  ALTER COLUMN "grid_width" SET DEFAULT 14,
  ALTER COLUMN "grid_height" SET DEFAULT 10;

COMMIT;
