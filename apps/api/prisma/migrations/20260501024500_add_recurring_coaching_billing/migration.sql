-- Add monthly billing-cycle support for recurring coaching plans.

ALTER TYPE "PayableType" ADD VALUE IF NOT EXISTS 'recurring_coaching';

CREATE TYPE "RecurringCoachingBillingCycleStatus" AS ENUM (
  'due',
  'processing',
  'awaiting_verification',
  'paid',
  'overdue',
  'cancelled'
);

CREATE TABLE "recurring_coaching_billing_cycles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recurring_plan_id" UUID NOT NULL,
  "cycle_start_date" DATE NOT NULL,
  "cycle_end_date" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "grace_period_ends_at" TIMESTAMPTZ(6) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "RecurringCoachingBillingCycleStatus" NOT NULL DEFAULT 'due',
  "payment_id" UUID,
  "paid_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recurring_coaching_billing_cycles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recurring_coaching_billing_cycles_recurring_plan_id_cycle_start_date_key"
  ON "recurring_coaching_billing_cycles"("recurring_plan_id", "cycle_start_date");

CREATE UNIQUE INDEX "recurring_coaching_billing_cycles_payment_id_key"
  ON "recurring_coaching_billing_cycles"("payment_id");

CREATE INDEX "recurring_coaching_billing_cycles_status_due_date_idx"
  ON "recurring_coaching_billing_cycles"("status", "due_date");

CREATE INDEX "recurring_coaching_billing_cycles_payment_id_idx"
  ON "recurring_coaching_billing_cycles"("payment_id");

ALTER TABLE "recurring_coaching_billing_cycles"
  ADD CONSTRAINT "recurring_coaching_billing_cycles_recurring_plan_id_fkey"
  FOREIGN KEY ("recurring_plan_id")
  REFERENCES "recurring_coaching_plans"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
