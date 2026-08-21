-- Facilities/Inventory canonical contract.
-- This migration is additive only. Existing rows retain their current values:
-- nullable status buckets and layout links are intentionally not backfilled.

ALTER TYPE "EquipmentStatus" ADD VALUE IF NOT EXISTS 'broken';
ALTER TYPE "EquipmentStatus" ADD VALUE IF NOT EXISTS 'missing';

ALTER TABLE "amenities"
  ADD COLUMN IF NOT EXISTS "status" "EquipmentStatus";

ALTER TABLE "gym_equipment_items"
  ADD COLUMN IF NOT EXISTS "quantity_maintenance" INTEGER,
  ADD COLUMN IF NOT EXISTS "quantity_broken" INTEGER,
  ADD COLUMN IF NOT EXISTS "quantity_missing" INTEGER;

ALTER TABLE "gym_equipment"
  ADD COLUMN IF NOT EXISTS "inventory_item_id" UUID,
  ADD COLUMN IF NOT EXISTS "venue_id" UUID,
  ADD COLUMN IF NOT EXISTS "grid_width" INTEGER,
  ADD COLUMN IF NOT EXISTS "grid_height" INTEGER;

ALTER TABLE "gym_equipment"
  ADD CONSTRAINT "gym_equipment_inventory_item_id_fkey"
    FOREIGN KEY ("inventory_item_id") REFERENCES "gym_equipment_items"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "gym_equipment_venue_id_fkey"
    FOREIGN KEY ("venue_id") REFERENCES "amenities"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "gym_equipment_inventory_item_id_is_active_idx"
  ON "gym_equipment"("inventory_item_id", "is_active");
CREATE INDEX IF NOT EXISTS "gym_equipment_venue_id_is_active_idx"
  ON "gym_equipment"("venue_id", "is_active");
