ALTER TABLE "gym_equipment"
ADD COLUMN IF NOT EXISTS "grid_column" INTEGER,
ADD COLUMN IF NOT EXISTS "grid_row" INTEGER;

UPDATE "gym_equipment"
SET
  "grid_column" = LEAST(
    14,
    GREATEST(
      1,
      ROUND(((CAST("position_x" AS double precision) / 100.0) * 14) + 0.5)::integer
    )
  ),
  "grid_row" = LEAST(
    10,
    GREATEST(
      1,
      ROUND(((CAST("position_y" AS double precision) / 100.0) * 10) + 0.5)::integer
    )
  )
WHERE "grid_column" IS NULL
   OR "grid_row" IS NULL;

CREATE INDEX IF NOT EXISTS "gym_equipment_floor_id_grid_column_grid_row_idx"
ON "gym_equipment"("floor_id", "grid_column", "grid_row");
