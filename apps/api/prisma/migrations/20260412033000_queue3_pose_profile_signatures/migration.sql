ALTER TABLE "pose_exercise_profiles"
ADD COLUMN IF NOT EXISTS "orientation_signature" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "movement_pattern" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "visibility_pattern" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "pose_exercise_profiles"
ALTER COLUMN "orientation_signature" DROP DEFAULT,
ALTER COLUMN "movement_pattern" DROP DEFAULT,
ALTER COLUMN "visibility_pattern" DROP DEFAULT;
