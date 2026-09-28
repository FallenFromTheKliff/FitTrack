ALTER TYPE "AppointmentStatus"
  ADD VALUE IF NOT EXISTS 'coach_unavailable';

ALTER TABLE "coach_appointments"
  ADD COLUMN IF NOT EXISTS "free_rebook_issued_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "free_rebook_available_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "free_rebook_consumed_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "coach_appointments_free_rebook_available_idx"
  ON "coach_appointments"("user_id", "free_rebook_available_at");
