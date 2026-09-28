ALTER TABLE "facility_floor_plan_media"
  ADD COLUMN IF NOT EXISTS "grid_width" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "grid_height" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "facility_floor_plan_media"
  ADD CONSTRAINT "facility_floor_plan_media_grid_width_check"
    CHECK ("grid_width" BETWEEN 8 AND 30),
  ADD CONSTRAINT "facility_floor_plan_media_grid_height_check"
    CHECK ("grid_height" BETWEEN 6 AND 20);
