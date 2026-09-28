ALTER TABLE "users"
  ADD COLUMN "free_day_pass_granted_at" TIMESTAMPTZ(6),
  ADD COLUMN "free_day_pass_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "free_day_pass_granted_by" UUID,
  ADD COLUMN "free_day_pass_revoked_at" TIMESTAMPTZ(6),
  ADD COLUMN "free_day_pass_revoke_reason" TEXT;

-- A previously redeemed implicit pass is already consumed. Backfill it as a
-- closed lifecycle so the new explicit-grant flow never reopens old access.
UPDATE "users"
SET
  "free_day_pass_granted_at" = COALESCE("free_day_pass_redeemed_at", "created_at"),
  "free_day_pass_expires_at" = COALESCE("free_day_pass_redeemed_at", "created_at"),
  "free_day_pass_redeemed_at" = COALESCE("free_day_pass_redeemed_at", "created_at")
WHERE "free_day_pass_redeemed_at" IS NOT NULL
  AND "free_day_pass_granted_at" IS NULL;
