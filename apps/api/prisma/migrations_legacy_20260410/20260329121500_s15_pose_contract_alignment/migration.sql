-- CreateEnum
CREATE TYPE "PoseProfileKind" AS ENUM ('seed', 'learned');

-- CreateTable
CREATE TABLE "pose_exercise_profiles" (
    "id" UUID NOT NULL,
    "exercise_id" UUID,
    "canonical_name" VARCHAR(100) NOT NULL,
    "profile_kind" "PoseProfileKind" NOT NULL DEFAULT 'seed',
    "landmark_signature" JSONB NOT NULL,
    "angle_signature" JSONB NOT NULL,
    "rep_rules" JSONB,
    "sample_count" INTEGER NOT NULL DEFAULT 1,
    "confidence_threshold" DECIMAL(4,3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pose_exercise_profiles_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "pose_sessions"
ADD COLUMN "detected_exercise_name" VARCHAR(100),
ADD COLUMN "detected_profile_id" UUID,
ADD COLUMN "classification_confidence" DECIMAL(4,3),
ADD COLUMN "subject_lock_confidence" DECIMAL(4,3),
ADD COLUMN "analysis_summary" JSONB;

-- CreateIndex
CREATE INDEX "pose_exercise_profiles_canonical_name_is_active_idx" ON "pose_exercise_profiles"("canonical_name", "is_active");

-- CreateIndex
CREATE INDEX "pose_exercise_profiles_exercise_id_is_active_idx" ON "pose_exercise_profiles"("exercise_id", "is_active");

-- CreateIndex
CREATE INDEX "pose_sessions_detected_exercise_name_idx" ON "pose_sessions"("detected_exercise_name");

-- CreateIndex
CREATE INDEX "pose_sessions_detected_profile_id_idx" ON "pose_sessions"("detected_profile_id");

-- AddForeignKey
ALTER TABLE "pose_exercise_profiles" ADD CONSTRAINT "pose_exercise_profiles_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pose_sessions" ADD CONSTRAINT "pose_sessions_detected_profile_id_fkey" FOREIGN KEY ("detected_profile_id") REFERENCES "pose_exercise_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
