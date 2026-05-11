-- DropForeignKey
ALTER TABLE "coach_profiles" DROP CONSTRAINT "coach_profiles_user_id_fkey";

-- AlterTable
ALTER TABLE "muscle_definitions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "recurring_coaching_billing_cycles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "recurring_coaching_billing_cycles_recurring_plan_id_cycle_start" RENAME TO "recurring_coaching_billing_cycles_recurring_plan_id_cycle_s_key";
