-- Membership Access + Gym Membership lifecycle contract.
-- This migration is intentionally additive and safe to re-run while local
-- databases are being reconciled from the older baseline.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "free_day_pass_redeemed_at" TIMESTAMPTZ(6);

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "plan_name_snapshot" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "plan_description_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "plan_price_snapshot" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "plan_currency_snapshot" VARCHAR(3),
  ADD COLUMN IF NOT EXISTS "duration_days_snapshot" INTEGER,
  ADD COLUMN IF NOT EXISTS "access_consumed_at" TIMESTAMPTZ(6);

ALTER TABLE "commerce_checkout_holds"
  ADD COLUMN IF NOT EXISTS "membership_plan_name_snapshot" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "membership_plan_description_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "membership_plan_price_snapshot" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "membership_plan_currency_snapshot" VARCHAR(3),
  ADD COLUMN IF NOT EXISTS "membership_duration_days_snapshot" INTEGER;

DO $$
BEGIN
  CREATE TYPE "AttendanceAccessSource" AS ENUM (
    'gym_membership',
    'paid_one_day_pass',
    'free_one_day_pass'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AttendanceCheckInMethod" AS ENUM ('qr', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "gym_day" DATE,
  ADD COLUMN IF NOT EXISTS "access_source" "AttendanceAccessSource",
  ADD COLUMN IF NOT EXISTS "check_in_method" "AttendanceCheckInMethod",
  ADD COLUMN IF NOT EXISTS "subscription_id" UUID;

ALTER TABLE "attendance_logs"
  ALTER COLUMN "access_source" DROP DEFAULT,
  ALTER COLUMN "access_source" DROP NOT NULL,
  ALTER COLUMN "check_in_method" DROP DEFAULT,
  ALTER COLUMN "check_in_method" DROP NOT NULL;

-- Preserve one deterministic historical row per member/Manila day. Duplicate
-- legacy rows intentionally keep gym_day NULL so the new uniqueness contract
-- does not rewrite historical attendance semantics.
WITH existing_days AS (
  SELECT user_id, gym_day
  FROM "attendance_logs"
  WHERE gym_day IS NOT NULL
  GROUP BY user_id, gym_day
), ranked AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, (check_in_at AT TIME ZONE 'Asia/Manila')::date
      ORDER BY check_in_at ASC, id ASC
    ) AS occurrence,
    (check_in_at AT TIME ZONE 'Asia/Manila')::date AS local_day
  FROM "attendance_logs"
  WHERE gym_day IS NULL
), candidates AS (
  SELECT ranked.*
  FROM ranked
  LEFT JOIN existing_days
    ON existing_days.user_id = ranked.user_id
   AND existing_days.gym_day = ranked.local_day
  WHERE existing_days.user_id IS NULL
)
UPDATE "attendance_logs" AS attendance
SET gym_day = candidates.local_day
FROM candidates
WHERE attendance.id = candidates.id
  AND candidates.occurrence = 1;

-- Existing subscription rows retain the terms that were actually purchased.
UPDATE "subscriptions" AS subscription
SET
  plan_name_snapshot = COALESCE(subscription.plan_name_snapshot, plan.name),
  plan_description_snapshot = COALESCE(subscription.plan_description_snapshot, plan.description),
  plan_price_snapshot = COALESCE(subscription.plan_price_snapshot, plan.price),
  plan_currency_snapshot = COALESCE(subscription.plan_currency_snapshot, plan.currency),
  duration_days_snapshot = COALESCE(subscription.duration_days_snapshot, plan.duration_days)
FROM "membership_plans" AS plan
WHERE subscription.plan_id = plan.id;

-- Preserve immutable terms for online gym-plan holds while the catalog row
-- still exists. Holds without a membership_plan_id remain intentionally
-- unmodified because their ownership cannot be inferred safely.
UPDATE "commerce_checkout_holds" AS hold
SET
  membership_plan_name_snapshot = COALESCE(hold.membership_plan_name_snapshot, plan.name),
  membership_plan_description_snapshot = COALESCE(hold.membership_plan_description_snapshot, plan.description),
  membership_plan_price_snapshot = COALESCE(hold.membership_plan_price_snapshot, plan.price),
  membership_plan_currency_snapshot = COALESCE(hold.membership_plan_currency_snapshot, plan.currency),
  membership_duration_days_snapshot = COALESCE(hold.membership_duration_days_snapshot, plan.duration_days)
FROM "membership_plans" AS plan
WHERE hold.membership_plan_id = plan.id;

CREATE INDEX IF NOT EXISTS "attendance_logs_subscription_id_idx"
  ON "attendance_logs"("subscription_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_logs_subscription_id_fkey'
  ) THEN
    ALTER TABLE "attendance_logs"
      ADD CONSTRAINT "attendance_logs_subscription_id_fkey"
      FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_logs_user_id_gym_day_key"
  ON "attendance_logs"("user_id", "gym_day")
  WHERE "gym_day" IS NOT NULL;

-- Release only rows proven stale by their recorded expiry. Any remaining true
-- live duplicate is intentionally surfaced by the unique index below rather
-- than silently cancelling an entitlement.
UPDATE "subscriptions"
SET status = 'expired'
WHERE status IN ('active', 'past_due')
  AND expires_at IS NOT NULL
  AND expires_at <= NOW();

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_one_active_per_user"
  ON "subscriptions"("user_id")
  WHERE "status" IN ('active', 'past_due', 'pending_payment');
