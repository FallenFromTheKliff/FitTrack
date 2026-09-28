CREATE TYPE "ProgressionIconKind" AS ENUM ('library', 'custom');

ALTER TABLE "muscle_definitions"
  ADD COLUMN "icon_kind" "ProgressionIconKind",
  ADD COLUMN "icon_key" VARCHAR(100),
  ADD COLUMN "icon_asset_key" VARCHAR(500);

ALTER TABLE "muscle_definitions"
  ADD CONSTRAINT "muscle_definitions_icon_descriptor_check"
  CHECK (
    ("icon_kind" IS NULL AND "icon_key" IS NULL AND "icon_asset_key" IS NULL)
    OR ("icon_kind" = 'library' AND "icon_key" IS NOT NULL AND "icon_asset_key" IS NULL)
    OR ("icon_kind" = 'custom' AND "icon_key" IS NULL AND "icon_asset_key" IS NOT NULL)
  );

ALTER TABLE "milestone_definitions"
  ADD COLUMN "icon_kind" "ProgressionIconKind",
  ADD COLUMN "icon_key" VARCHAR(100),
  ADD COLUMN "icon_asset_key" VARCHAR(500);

ALTER TABLE "milestone_definitions"
  ADD CONSTRAINT "milestone_definitions_icon_descriptor_check"
  CHECK (
    ("icon_kind" IS NULL AND "icon_key" IS NULL AND "icon_asset_key" IS NULL)
    OR ("icon_kind" = 'library' AND "icon_key" IS NOT NULL AND "icon_asset_key" IS NULL)
    OR ("icon_kind" = 'custom' AND "icon_key" IS NULL AND "icon_asset_key" IS NOT NULL)
  );

ALTER TABLE "user_progression_profiles"
  ADD COLUMN "progression_rules_version" VARCHAR(50) NOT NULL DEFAULT 'exp-v1';

ALTER TABLE "user_milestone_progress"
  ADD COLUMN "reward_granted_at" TIMESTAMPTZ(6);

ALTER TABLE "notifications"
  ADD COLUMN "dedupe_key" VARCHAR(255);

CREATE UNIQUE INDEX "notifications_dedupe_key_key"
  ON "notifications"("dedupe_key");
