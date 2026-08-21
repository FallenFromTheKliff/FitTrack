-- Store the single active monthly coaching package advertised by each coach.
-- This is additive and preserves existing hourly and recurring-plan records.
ALTER TABLE "coach_profiles"
  ADD COLUMN "monthly_rate" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "monthly_session_count" SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN "monthly_session_duration_minutes" SMALLINT NOT NULL DEFAULT 60,
  ADD COLUMN "monthly_offer_description" VARCHAR(500),
  ADD COLUMN "monthly_offer_active" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "coach_profiles"
  ADD CONSTRAINT "coach_profiles_monthly_rate_nonnegative"
    CHECK ("monthly_rate" >= 0),
  ADD CONSTRAINT "coach_profiles_monthly_session_count_range"
    CHECK ("monthly_session_count" >= 0 AND "monthly_session_count" <= 31),
  ADD CONSTRAINT "coach_profiles_monthly_session_duration_range"
    CHECK (
      "monthly_session_duration_minutes" >= 30
      AND "monthly_session_duration_minutes" <= 240
    ),
  ADD CONSTRAINT "coach_profiles_active_monthly_offer_complete"
    CHECK (
      NOT "monthly_offer_active"
      OR (
        "monthly_rate" > 0
        AND "monthly_session_count" > 0
      )
    );
