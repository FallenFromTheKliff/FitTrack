-- DropIndex
DROP INDEX "one_active_ai_session_per_context";

-- DropIndex
DROP INDEX "coach_slot_unique";

-- DropIndex
DROP INDEX "coach_client_active_unique";

-- DropIndex
DROP INDEX "exercise_log_set_unique";

-- DropIndex
DROP INDEX "one_active_macro";

-- DropIndex
DROP INDEX "subscriptions_one_active_per_user";

-- DropIndex
DROP INDEX "one_active_tdee";

-- DropIndex
DROP INDEX "one_active_plan_per_user";

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "ai_session_archived_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "appointment_cancelled_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "appointment_completed_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "booking_cancelled_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "booking_no_show_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "payment_failed_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "subscription_expired_email" BOOLEAN NOT NULL DEFAULT true;
