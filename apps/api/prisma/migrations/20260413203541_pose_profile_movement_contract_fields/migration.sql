-- AlterTable
ALTER TABLE "pose_exercise_profiles" ADD COLUMN     "dominant_joint" VARCHAR(32),
ADD COLUMN     "rep_thresholds" JSONB,
ADD COLUMN     "tolerance" DECIMAL(5,2);
