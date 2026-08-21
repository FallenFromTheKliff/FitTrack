CREATE TYPE "NutritionIconKind" AS ENUM ('library', 'custom');

ALTER TABLE "nutrition_logs"
  ADD COLUMN "icon_kind" "NutritionIconKind",
  ADD COLUMN "icon_key" VARCHAR(100),
  ADD COLUMN "icon_asset_key" VARCHAR(500);

ALTER TABLE "nutrition_logs"
  ADD CONSTRAINT "nutrition_logs_icon_descriptor_check"
  CHECK (
    ("icon_kind" IS NULL AND "icon_key" IS NULL AND "icon_asset_key" IS NULL)
    OR ("icon_kind" = 'library' AND "icon_key" IS NOT NULL AND "icon_asset_key" IS NULL)
    OR ("icon_kind" = 'custom' AND "icon_key" IS NULL AND "icon_asset_key" IS NOT NULL)
  );
