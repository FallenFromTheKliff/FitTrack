-- Internal checkout attempts and slot holds are intentionally not product
-- records. A successful webhook consumes one hold and creates one paid/active
-- product record in the same database transaction.
ALTER TYPE "PayableType" ADD VALUE IF NOT EXISTS 'commerce_checkout_hold';

CREATE TYPE "CommerceCheckoutHoldKind" AS ENUM (
  'one_time',
  'monthly',
  'venue',
  'subscription',
  'membership_card'
);
CREATE TYPE "CommerceCheckoutHoldStatus" AS ENUM (
  'held',
  'consumed',
  'released',
  'expired',
  'failed'
);

CREATE TABLE "commerce_checkout_holds" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "coach_id" UUID,
  "amenity_id" UUID,
  "kind" "CommerceCheckoutHoldKind" NOT NULL,
  "status" "CommerceCheckoutHoldStatus" NOT NULL DEFAULT 'held',
  "idempotency_key" VARCHAR(128) NOT NULL,
  "payment_id" UUID,
  "scheduled_at" TIMESTAMPTZ(6),
  "ends_at" TIMESTAMPTZ(6),
  "duration_minutes" SMALLINT,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'PHP',
  "session_count" SMALLINT,
  "start_date" DATE,
  "end_date" DATE,
  "preferred_days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "preferred_time" TIME(0),
  "member_notes" TEXT,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "released_at" TIMESTAMPTZ(6),
  "failure_reason" TEXT,
  "appointment_id" UUID,
  "booking_id" UUID,
  "subscription_id" UUID,
  "membership_card_id" UUID,
  "recurring_plan_id" UUID,
  "membership_plan_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "commerce_checkout_holds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commerce_checkout_holds_idempotency_key_key"
  ON "commerce_checkout_holds"("idempotency_key");
CREATE UNIQUE INDEX "commerce_checkout_holds_payment_id_key"
  ON "commerce_checkout_holds"("payment_id");
CREATE INDEX "commerce_checkout_holds_coach_id_status_expires_at_idx"
  ON "commerce_checkout_holds"("coach_id", "status", "expires_at");
CREATE INDEX "commerce_checkout_holds_amenity_id_status_expires_at_idx"
  ON "commerce_checkout_holds"("amenity_id", "status", "expires_at");
CREATE INDEX "commerce_checkout_holds_user_id_status_idx"
  ON "commerce_checkout_holds"("user_id", "status");
CREATE INDEX "commerce_checkout_holds_expires_at_status_idx"
  ON "commerce_checkout_holds"("expires_at", "status");

ALTER TABLE "commerce_checkout_holds"
  ADD CONSTRAINT "commerce_checkout_holds_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_checkout_holds"
  ADD CONSTRAINT "commerce_checkout_holds_coach_id_fkey"
  FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_checkout_holds"
  ADD CONSTRAINT "commerce_checkout_holds_amenity_id_fkey"
  FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_checkout_holds"
  ADD CONSTRAINT "commerce_checkout_holds_membership_plan_id_fkey"
  FOREIGN KEY ("membership_plan_id") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_checkout_holds"
  ADD CONSTRAINT "commerce_checkout_holds_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Retain terminated relationship history while preventing duplicate live
-- commercial relationships for a coach/member pair.
CREATE UNIQUE INDEX IF NOT EXISTS "coach_client_active_unique"
  ON "coach_client_relationships"("coach_id", "member_id")
  WHERE "status" IN ('pending', 'active', 'paused');
