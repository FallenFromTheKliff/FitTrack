/*
  Warnings:

  - The values [promo] on the enum `GymFaqCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `exercise_movement_backfill_audit` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "GymFaqCategory_new" AS ENUM ('general', 'hours', 'rates', 'membership', 'amenities', 'coaching', 'training', 'nutrition', 'rules');
ALTER TABLE "gym_faq_entries" ALTER COLUMN "category" TYPE "GymFaqCategory_new" USING ("category"::text::"GymFaqCategory_new");
ALTER TYPE "GymFaqCategory" RENAME TO "GymFaqCategory_old";
ALTER TYPE "GymFaqCategory_new" RENAME TO "GymFaqCategory";
DROP TYPE "public"."GymFaqCategory_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "commerce_checkout_holds" DROP CONSTRAINT "commerce_checkout_holds_amenity_id_fkey";

-- DropForeignKey
ALTER TABLE "commerce_checkout_holds" DROP CONSTRAINT "commerce_checkout_holds_coach_id_fkey";

-- DropForeignKey
ALTER TABLE "commerce_checkout_holds" DROP CONSTRAINT "commerce_checkout_holds_membership_plan_id_fkey";

-- DropIndex
DROP INDEX "coach_appointments_free_rebook_available_idx";

-- AlterTable
ALTER TABLE "coach_specialties" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "commerce_checkout_holds" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exercise_aliases" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exercise_movement_families" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "gym_equipment_items" ALTER COLUMN "quantity_maintenance" DROP DEFAULT,
ALTER COLUMN "quantity_broken" DROP DEFAULT,
ALTER COLUMN "quantity_missing" DROP DEFAULT;

-- DropTable
DROP TABLE "exercise_movement_backfill_audit";

-- AddForeignKey
ALTER TABLE "commerce_checkout_holds" ADD CONSTRAINT "commerce_checkout_holds_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_checkout_holds" ADD CONSTRAINT "commerce_checkout_holds_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_checkout_holds" ADD CONSTRAINT "commerce_checkout_holds_membership_plan_id_fkey" FOREIGN KEY ("membership_plan_id") REFERENCES "membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "seasonal_muscle_standings_season_id_muscle_group_muscle_points_" RENAME TO "seasonal_muscle_standings_season_id_muscle_group_muscle_poi_idx";
