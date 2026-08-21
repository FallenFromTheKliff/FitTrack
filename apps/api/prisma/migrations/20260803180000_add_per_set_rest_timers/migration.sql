ALTER TABLE "plan_exercises"
ADD COLUMN "rest_seconds_by_set" JSONB;

ALTER TABLE "plan_exercises"
ALTER COLUMN "rest_seconds" SET DEFAULT 75;
