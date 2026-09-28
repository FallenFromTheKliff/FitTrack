-- Preserve the workout-day origin of derived monthly coaching candidates
-- while pending schedule items wait for payment activation.
ALTER TABLE "recurring_coaching_schedule_items"
ADD COLUMN "training_schedule_day_id" UUID;

CREATE INDEX "recurring_coaching_schedule_items_training_schedule_day_id_idx"
ON "recurring_coaching_schedule_items"("training_schedule_day_id");

ALTER TABLE "recurring_coaching_schedule_items"
ADD CONSTRAINT "recurring_coaching_schedule_items_training_schedule_day_id_fkey"
FOREIGN KEY ("training_schedule_day_id") REFERENCES "training_schedule_days"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
