-- Backfill the additive condition buckets without changing the legacy available quantity.
-- Legacy rows represented unavailable units as quantity_total - quantity_current.
UPDATE "gym_equipment_items"
SET
  "quantity_maintenance" = COALESCE("quantity_maintenance", 0),
  "quantity_broken" = COALESCE("quantity_broken", 0),
  "quantity_missing" = CASE
    WHEN "quantity_maintenance" IS NULL
      AND "quantity_broken" IS NULL
      AND "quantity_missing" IS NULL
      THEN GREATEST("quantity_total" - "quantity_current", 0)
    ELSE COALESCE("quantity_missing", 0)
  END
WHERE "quantity_maintenance" IS NULL
   OR "quantity_broken" IS NULL
   OR "quantity_missing" IS NULL;

ALTER TABLE "gym_equipment_items"
  ALTER COLUMN "quantity_maintenance" SET DEFAULT 0,
  ALTER COLUMN "quantity_broken" SET DEFAULT 0,
  ALTER COLUMN "quantity_missing" SET DEFAULT 0;
