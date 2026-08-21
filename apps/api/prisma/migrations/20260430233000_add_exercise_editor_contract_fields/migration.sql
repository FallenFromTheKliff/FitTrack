-- Additive exercise-editor contract fields for multi-muscle targets,
-- pose rig previews, movement contracts, grip checks, and subject-lock gestures.
ALTER TABLE "exercise_catalog"
  ADD COLUMN "muscle_targets" JSONB,
  ADD COLUMN "movement_profile" JSONB,
  ADD COLUMN "hand_shape_profile" JSONB;

ALTER TABLE "exercise_review_submissions"
  ADD COLUMN "muscle_targets" JSONB,
  ADD COLUMN "movement_profile" JSONB,
  ADD COLUMN "hand_shape_profile" JSONB;
