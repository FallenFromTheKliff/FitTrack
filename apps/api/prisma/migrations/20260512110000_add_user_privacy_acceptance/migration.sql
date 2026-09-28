ALTER TABLE "users"
  ADD COLUMN "has_accepted_privacy" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "privacy_accepted_at" TIMESTAMPTZ(6);

UPDATE "users"
SET "privacy_accepted_at" = COALESCE("created_at", NOW())
WHERE "has_accepted_privacy" = true
  AND "privacy_accepted_at" IS NULL;

ALTER TABLE "users"
  ALTER COLUMN "has_accepted_privacy" SET DEFAULT false;
