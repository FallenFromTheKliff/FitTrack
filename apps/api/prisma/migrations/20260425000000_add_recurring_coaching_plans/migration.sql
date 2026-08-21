-- CreateEnum
CREATE TYPE "RecurringCoachingFrequency" AS ENUM ('weekly', 'biweekly');

-- CreateEnum
CREATE TYPE "RecurringCoachingPlanStatus" AS ENUM ('active', 'paused', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "RecurringCoachingSessionState" AS ENUM ('generated', 'skipped', 'individually_rescheduled', 'cancelled', 'completed');

-- CreateTable
CREATE TABLE "recurring_coaching_plans" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "coach_id" UUID NOT NULL,
    "created_by" UUID,
    "frequency" "RecurringCoachingFrequency" NOT NULL,
    "preferred_days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "preferred_time" TIME(0) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "status" "RecurringCoachingPlanStatus" NOT NULL DEFAULT 'active',
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "completed_sessions" INTEGER NOT NULL DEFAULT 0,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recurring_coaching_plans_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "coach_appointments"
ADD COLUMN "recurring_plan_id" UUID,
ADD COLUMN "recurring_state" "RecurringCoachingSessionState",
ADD COLUMN "original_scheduled_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "recurring_coaching_plans_member_id_status_idx" ON "recurring_coaching_plans"("member_id", "status");

-- CreateIndex
CREATE INDEX "recurring_coaching_plans_coach_id_status_idx" ON "recurring_coaching_plans"("coach_id", "status");

-- CreateIndex
CREATE INDEX "recurring_coaching_plans_status_start_date_end_date_idx" ON "recurring_coaching_plans"("status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "coach_appointments_recurring_plan_id_scheduled_at_idx" ON "coach_appointments"("recurring_plan_id", "scheduled_at");

-- AddForeignKey
ALTER TABLE "recurring_coaching_plans" ADD CONSTRAINT "recurring_coaching_plans_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_coaching_plans" ADD CONSTRAINT "recurring_coaching_plans_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_appointments" ADD CONSTRAINT "coach_appointments_recurring_plan_id_fkey" FOREIGN KEY ("recurring_plan_id") REFERENCES "recurring_coaching_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
