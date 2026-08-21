-- The exercise-candidate workflow was retired in favor of admin-authored
-- Exercise Lab catalog entries. Remove its records before narrowing the
-- moderation enum so existing local/demo data cannot block the migration.
DELETE FROM "moderation_action_records"
WHERE "action_type" IN (
  'approve_creator',
  'suspend_creator',
  'revoke_creator'
);

BEGIN;
CREATE TYPE "ModerationActionType_new" AS ENUM (
  'manual_exp_grant',
  'void_progression_grant',
  'restore_progression_grant',
  'hide_from_rankings',
  'disqualify_active_season',
  'resolve_integrity_case_valid',
  'resolve_integrity_case_invalid'
);
ALTER TABLE "moderation_action_records"
  ALTER COLUMN "action_type" TYPE "ModerationActionType_new"
  USING ("action_type"::text::"ModerationActionType_new");
ALTER TYPE "ModerationActionType" RENAME TO "ModerationActionType_old";
ALTER TYPE "ModerationActionType_new" RENAME TO "ModerationActionType";
DROP TYPE "ModerationActionType_old";
COMMIT;

DROP TABLE "exercise_review_submissions";
DROP TABLE "creator_profiles";
DROP TYPE "ExerciseReviewSubmissionStatus";
DROP TYPE "CreatorState";
