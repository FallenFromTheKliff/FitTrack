ALTER TABLE "season_definitions"
ADD COLUMN "auto_start_next" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "activated_at" TIMESTAMPTZ(6);

CREATE TABLE "seasonal_muscle_standings" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "muscle_group" VARCHAR(100) NOT NULL,
    "muscle_points" INTEGER NOT NULL DEFAULT 0,
    "rank_position" INTEGER,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "is_disqualified" BOOLEAN NOT NULL DEFAULT false,
    "last_earned_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "seasonal_muscle_standings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seasonal_muscle_standings_season_id_user_id_muscle_group_key"
ON "seasonal_muscle_standings"("season_id", "user_id", "muscle_group");

CREATE INDEX "seasonal_muscle_standings_season_id_muscle_group_muscle_points_idx"
ON "seasonal_muscle_standings"("season_id", "muscle_group", "muscle_points");

CREATE INDEX "seasonal_muscle_standings_user_id_season_id_idx"
ON "seasonal_muscle_standings"("user_id", "season_id");

CREATE UNIQUE INDEX "season_definitions_single_active_idx"
ON "season_definitions" ("status")
WHERE "status" = 'active';

ALTER TABLE "seasonal_muscle_standings"
ADD CONSTRAINT "seasonal_muscle_standings_season_id_fkey"
FOREIGN KEY ("season_id") REFERENCES "season_definitions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seasonal_muscle_standings"
ADD CONSTRAINT "seasonal_muscle_standings_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
