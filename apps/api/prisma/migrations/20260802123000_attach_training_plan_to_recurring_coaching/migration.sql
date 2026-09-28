-- Attach an optional coach-authored workout plan to the recurring coaching contract.
-- This is additive and preserves existing plans and appointments.
ALTER TABLE "recurring_coaching_plans"
  ADD COLUMN "training_plan_id" UUID;

CREATE INDEX "recurring_coaching_plans_training_plan_id_idx"
  ON "recurring_coaching_plans"("training_plan_id");

ALTER TABLE "recurring_coaching_plans"
  ADD CONSTRAINT "recurring_coaching_plans_training_plan_id_fkey"
  FOREIGN KEY ("training_plan_id") REFERENCES "training_plans"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
