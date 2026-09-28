CREATE TYPE "CoachScheduleType" AS ENUM ('full_time', 'part_time');

ALTER TABLE "coach_profiles"
  ADD COLUMN "schedule_type" "CoachScheduleType" NOT NULL DEFAULT 'part_time';

ALTER TABLE "coach_appointments"
  ADD COLUMN "coach_feedback" TEXT,
  ADD COLUMN "assessment_report" TEXT;
