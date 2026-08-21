-- CreateEnum
CREATE TYPE "MilestoneDefinitionStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "MilestoneVerificationPolicy" AS ENUM ('auto', 'manual_required', 'auto_then_review', 'staff_attested');

-- CreateEnum
CREATE TYPE "MilestoneEvidenceRequirement" AS ENUM ('none', 'image', 'video', 'image_or_video');

-- CreateEnum
CREATE TYPE "MilestoneEvidenceType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "MilestoneEvidenceSubmissionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MilestoneCategory" ADD VALUE 'nutrition';
ALTER TYPE "MilestoneCategory" ADD VALUE 'coaching';
ALTER TYPE "MilestoneCategory" ADD VALUE 'booking';
ALTER TYPE "MilestoneCategory" ADD VALUE 'ai';
ALTER TYPE "MilestoneCategory" ADD VALUE 'weighted_lifting';
ALTER TYPE "MilestoneCategory" ADD VALUE 'attendance';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MilestoneProgressStatus" ADD VALUE 'pending_review';
ALTER TYPE "MilestoneProgressStatus" ADD VALUE 'rejected';

-- AlterEnum
ALTER TYPE "MilestoneTriggerType" ADD VALUE 'composite';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProgressionSourceType" ADD VALUE 'weighted_exercise_logged';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'nutrition_log_created';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'nutrition_log_updated';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'nutrition_log_deleted';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'coaching_appointment_completed';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'coaching_appointment_no_show';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'venue_booking_completed';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'venue_booking_no_show';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'ai_chat_message_sent';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'ai_action_completed';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'gym_chat_message_sent';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'milestone_evidence_submitted';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'milestone_evidence_approved';
ALTER TYPE "ProgressionSourceType" ADD VALUE 'milestone_evidence_rejected';

-- DropIndex
DROP INDEX "milestone_definitions_category_is_active_idx";

-- AlterTable
ALTER TABLE "milestone_definitions" ADD COLUMN     "archived_at" TIMESTAMPTZ(6),
ADD COLUMN     "archived_by_user_id" UUID,
ADD COLUMN     "created_by_user_id" UUID,
ADD COLUMN     "ends_at" TIMESTAMPTZ(6),
ADD COLUMN     "evidence_requirement" "MilestoneEvidenceRequirement" NOT NULL DEFAULT 'none',
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "starts_at" TIMESTAMPTZ(6),
ADD COLUMN     "status" "MilestoneDefinitionStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "updated_by_user_id" UUID,
ADD COLUMN     "verification_policy" "MilestoneVerificationPolicy" NOT NULL DEFAULT 'auto';

-- CreateTable
CREATE TABLE "milestone_evidence_submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "milestone_definition_id" UUID NOT NULL,
    "milestone_progress_id" UUID,
    "status" "MilestoneEvidenceSubmissionStatus" NOT NULL DEFAULT 'pending',
    "evidence_type" "MilestoneEvidenceType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_key" VARCHAR(500),
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "original_filename" VARCHAR(255),
    "caption" TEXT,
    "reviewer_notes" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "milestone_evidence_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestone_evidence_submissions_user_id_created_at_idx" ON "milestone_evidence_submissions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "milestone_evidence_submissions_milestone_definition_id_stat_idx" ON "milestone_evidence_submissions"("milestone_definition_id", "status");

-- CreateIndex
CREATE INDEX "milestone_evidence_submissions_status_created_at_idx" ON "milestone_evidence_submissions"("status", "created_at");

-- CreateIndex
CREATE INDEX "milestone_definitions_category_status_idx" ON "milestone_definitions"("category", "status");

-- CreateIndex
CREATE INDEX "milestone_definitions_is_active_retired_at_idx" ON "milestone_definitions"("is_active", "retired_at");

-- CreateIndex
CREATE INDEX "milestone_definitions_verification_policy_evidence_requirem_idx" ON "milestone_definitions"("verification_policy", "evidence_requirement");

-- AddForeignKey
ALTER TABLE "milestone_definitions" ADD CONSTRAINT "milestone_definitions_archived_by_user_id_fkey" FOREIGN KEY ("archived_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_definitions" ADD CONSTRAINT "milestone_definitions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_definitions" ADD CONSTRAINT "milestone_definitions_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_evidence_submissions" ADD CONSTRAINT "milestone_evidence_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_evidence_submissions" ADD CONSTRAINT "milestone_evidence_submissions_milestone_definition_id_fkey" FOREIGN KEY ("milestone_definition_id") REFERENCES "milestone_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_evidence_submissions" ADD CONSTRAINT "milestone_evidence_submissions_milestone_progress_id_fkey" FOREIGN KEY ("milestone_progress_id") REFERENCES "user_milestone_progress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_evidence_submissions" ADD CONSTRAINT "milestone_evidence_submissions_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
