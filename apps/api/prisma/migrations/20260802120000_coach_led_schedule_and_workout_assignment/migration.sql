-- Coach-led recurring schedules stay as non-booking draft rows until payment.
-- Coach workout assignments preserve occurrence order and rolling progression state.

CREATE TYPE "CoachWorkoutAssignmentSource" AS ENUM ('automatic', 'coach_override');

CREATE TYPE "CoachWorkoutAssignmentState" AS ENUM ('assigned', 'held', 'completed', 'skipped');

CREATE TYPE "RecurringCoachingScheduleItemStatus" AS ENUM ('pending_payment', 'activated', 'cancelled');

ALTER TYPE "RecurringCoachingFrequency" ADD VALUE 'monthly';

ALTER TYPE "RecurringCoachingPlanStatus" ADD VALUE 'draft';
ALTER TYPE "RecurringCoachingPlanStatus" ADD VALUE 'awaiting_payment';

ALTER TABLE "coach_appointments"
ADD COLUMN "recurring_schedule_item_id" UUID;

ALTER TABLE "recurring_coaching_plans"
ADD COLUMN "coach_approved_at" TIMESTAMPTZ(6),
ADD COLUMN "quoted_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "recurring_coaching_schedule_items" (
    "id" UUID NOT NULL,
    "recurring_plan_id" UUID NOT NULL,
    "sequence_index" SMALLINT NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "RecurringCoachingScheduleItemStatus" NOT NULL DEFAULT 'pending_payment',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recurring_coaching_schedule_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coach_workout_assignments" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "training_plan_id" UUID NOT NULL,
    "training_schedule_day_id" UUID NOT NULL,
    "workout_session_id" UUID,
    "sequence_index" SMALLINT NOT NULL,
    "source" "CoachWorkoutAssignmentSource" NOT NULL DEFAULT 'automatic',
    "state" "CoachWorkoutAssignmentState" NOT NULL DEFAULT 'assigned',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "held_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "override_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "coach_workout_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recurring_coaching_schedule_items_recurring_plan_id_status__idx"
ON "recurring_coaching_schedule_items"("recurring_plan_id", "status", "scheduled_at");

CREATE UNIQUE INDEX "recurring_coaching_schedule_items_recurring_plan_id_sequenc_key"
ON "recurring_coaching_schedule_items"("recurring_plan_id", "sequence_index");

CREATE UNIQUE INDEX "recurring_coaching_schedule_items_recurring_plan_id_schedul_key"
ON "recurring_coaching_schedule_items"("recurring_plan_id", "scheduled_at");

CREATE UNIQUE INDEX "coach_workout_assignments_appointment_id_key"
ON "coach_workout_assignments"("appointment_id");

CREATE UNIQUE INDEX "coach_workout_assignments_workout_session_id_key"
ON "coach_workout_assignments"("workout_session_id");

CREATE INDEX "coach_workout_assignments_training_plan_id_sequence_index_s_idx"
ON "coach_workout_assignments"("training_plan_id", "sequence_index", "state");

CREATE INDEX "coach_workout_assignments_training_schedule_day_id_state_idx"
ON "coach_workout_assignments"("training_schedule_day_id", "state");

CREATE UNIQUE INDEX "coach_appointments_recurring_schedule_item_id_key"
ON "coach_appointments"("recurring_schedule_item_id");

ALTER TABLE "coach_appointments"
ADD CONSTRAINT "coach_appointments_recurring_schedule_item_id_fkey"
FOREIGN KEY ("recurring_schedule_item_id") REFERENCES "recurring_coaching_schedule_items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recurring_coaching_schedule_items"
ADD CONSTRAINT "recurring_coaching_schedule_items_recurring_plan_id_fkey"
FOREIGN KEY ("recurring_plan_id") REFERENCES "recurring_coaching_plans"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coach_workout_assignments"
ADD CONSTRAINT "coach_workout_assignments_appointment_id_fkey"
FOREIGN KEY ("appointment_id") REFERENCES "coach_appointments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coach_workout_assignments"
ADD CONSTRAINT "coach_workout_assignments_training_plan_id_fkey"
FOREIGN KEY ("training_plan_id") REFERENCES "training_plans"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coach_workout_assignments"
ADD CONSTRAINT "coach_workout_assignments_training_schedule_day_id_fkey"
FOREIGN KEY ("training_schedule_day_id") REFERENCES "training_schedule_days"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coach_workout_assignments"
ADD CONSTRAINT "coach_workout_assignments_workout_session_id_fkey"
FOREIGN KEY ("workout_session_id") REFERENCES "workout_sessions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
