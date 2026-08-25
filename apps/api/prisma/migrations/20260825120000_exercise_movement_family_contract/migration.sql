-- Production-safe movement-contract ownership migration.
-- Historical exercise rows are never deleted. Exact duplicate label rows are
-- archived with an explicit replacement mapping while their historical FKs stay intact.

DO $$ BEGIN
  CREATE TYPE "ExerciseTrackingMode" AS ENUM ('manual', 'inherit', 'override');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExerciseAliasKind" AS ENUM ('spelling', 'synonym');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "exercise_movement_families" (
  "id" UUID NOT NULL,
  "key" VARCHAR(64) NOT NULL,
  "display_name" VARCHAR(120) NOT NULL,
  "canonical_exercise_id" UUID,
  "base_movement_profile" JSONB NOT NULL,
  "base_hand_shape_profile" JSONB,
  "contract_revision" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exercise_movement_families_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "exercise_movement_families_key_key"
  ON "exercise_movement_families"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "exercise_movement_families_canonical_exercise_id_key"
  ON "exercise_movement_families"("canonical_exercise_id");
CREATE INDEX IF NOT EXISTS "exercise_movement_families_is_active_key_idx"
  ON "exercise_movement_families"("is_active", "key");

ALTER TABLE "exercise_catalog"
  ADD COLUMN IF NOT EXISTS "movement_family_id" UUID,
  ADD COLUMN IF NOT EXISTS "tracking_mode" "ExerciseTrackingMode" NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "movement_profile_override" JSONB;
CREATE INDEX IF NOT EXISTS "exercise_catalog_movement_family_id_tracking_mode_idx"
  ON "exercise_catalog"("movement_family_id", "tracking_mode");

CREATE TABLE IF NOT EXISTS "exercise_aliases" (
  "id" UUID NOT NULL,
  "exercise_id" UUID NOT NULL,
  "label" VARCHAR(255) NOT NULL,
  "normalized_label" VARCHAR(255) NOT NULL,
  "kind" "ExerciseAliasKind" NOT NULL DEFAULT 'synonym',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exercise_aliases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "exercise_aliases_normalized_label_key"
  ON "exercise_aliases"("normalized_label");
CREATE INDEX IF NOT EXISTS "exercise_aliases_exercise_id_idx"
  ON "exercise_aliases"("exercise_id");

CREATE TABLE IF NOT EXISTS "exercise_movement_backfill_audit" (
  "id" BIGSERIAL PRIMARY KEY,
  "action" VARCHAR(64) NOT NULL,
  "source_exercise_id" UUID,
  "replacement_exercise_id" UUID,
  "normalized_label" VARCHAR(255),
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("action", "source_exercise_id", "replacement_exercise_id", "normalized_label")
);

WITH family_defaults(id, key, display_name, canonical_name) AS (
  VALUES
    ('81000000-0000-4000-8000-000000000001'::uuid, 'squat', 'Squat', 'barbell back squat'),
    ('81000000-0000-4000-8000-000000000002'::uuid, 'bench_press', 'Bench Press', 'barbell bench press'),
    ('81000000-0000-4000-8000-000000000003'::uuid, 'bicep_curl', 'Bicep Curl', 'dumbbell biceps curl'),
    ('81000000-0000-4000-8000-000000000004'::uuid, 'dip', 'Dip', 'parallel bar dip'),
    ('81000000-0000-4000-8000-000000000005'::uuid, 'plank', 'Plank', 'forearm plank'),
    ('81000000-0000-4000-8000-000000000006'::uuid, 'pull_up', 'Pull Up', 'pull up'),
    ('81000000-0000-4000-8000-000000000007'::uuid, 'push_up', 'Push Up', 'push up'),
    ('81000000-0000-4000-8000-000000000008'::uuid, 'shoulder_press', 'Shoulder Press', 'seated dumbbell shoulder press')
), canonical AS (
  SELECT f.*, e.id AS exercise_id, e.movement_profile, e.hand_shape_profile
  FROM family_defaults f
  LEFT JOIN LATERAL (
    SELECT c.* FROM exercise_catalog c
    WHERE lower(regexp_replace(regexp_replace(btrim(c.name), '[_-]+', ' ', 'g'), '\s+', ' ', 'g')) = f.canonical_name
    ORDER BY c.is_active DESC, c.created_at ASC, c.id ASC
    LIMIT 1
  ) e ON true
)
INSERT INTO exercise_movement_families (
  id, key, display_name, canonical_exercise_id, base_movement_profile,
  base_hand_shape_profile, contract_revision, is_active
)
SELECT id, key, display_name, exercise_id, COALESCE(movement_profile, '{}'::jsonb),
  hand_shape_profile, 1, true
FROM canonical
ON CONFLICT (key) DO NOTHING;

ALTER TABLE "exercise_movement_families"
  DROP CONSTRAINT IF EXISTS "exercise_movement_families_canonical_exercise_id_fkey";
ALTER TABLE "exercise_movement_families"
  ADD CONSTRAINT "exercise_movement_families_canonical_exercise_id_fkey"
  FOREIGN KEY ("canonical_exercise_id") REFERENCES "exercise_catalog"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exercise_catalog"
  DROP CONSTRAINT IF EXISTS "exercise_catalog_movement_family_id_fkey";
ALTER TABLE "exercise_catalog"
  ADD CONSTRAINT "exercise_catalog_movement_family_id_fkey"
  FOREIGN KEY ("movement_family_id") REFERENCES "exercise_movement_families"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exercise_aliases"
  DROP CONSTRAINT IF EXISTS "exercise_aliases_exercise_id_fkey";
ALTER TABLE "exercise_aliases"
  ADD CONSTRAINT "exercise_aliases_exercise_id_fkey"
  FOREIGN KEY ("exercise_id") REFERENCES "exercise_catalog"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Canonical rows inherit their own shared family contract. Known safe variants
-- inherit too; explicitly unsafe squat/lunge variants are intentionally absent.
WITH variant_map(family_key, normalized_name) AS (
  VALUES
    ('squat', 'barbell back squat'), ('squat', 'front squat'),
    ('squat', 'goblet squat'), ('squat', 'bodyweight squat'),
    ('bench_press', 'barbell bench press'), ('bench_press', 'dumbbell bench press'),
    ('bicep_curl', 'dumbbell biceps curl'), ('bicep_curl', 'hammer curl'),
    ('bicep_curl', 'cable curl'), ('bicep_curl', 'barbell curl'),
    ('dip', 'parallel bar dip'), ('dip', 'bench dip'), ('dip', 'assisted dip'),
    ('plank', 'forearm plank'),
    ('pull_up', 'pull up'), ('pull_up', 'chin up'), ('pull_up', 'assisted pull up'),
    ('pull_up', 'weighted pull up'),
    ('push_up', 'push up'), ('push_up', 'incline push up'), ('push_up', 'knee push up'),
    ('push_up', 'wall push up'),
    ('shoulder_press', 'seated dumbbell shoulder press')
), mapped AS (
  SELECT c.id, f.id AS family_id
  FROM exercise_catalog c
  JOIN variant_map v ON lower(regexp_replace(regexp_replace(btrim(c.name), '[_-]+', ' ', 'g'), '\s+', ' ', 'g')) = v.normalized_name
  JOIN exercise_movement_families f ON f.key = v.family_key
)
UPDATE exercise_catalog c
SET movement_family_id = mapped.family_id,
    tracking_mode = 'inherit',
    movement_profile_override = NULL
FROM mapped
WHERE c.id = mapped.id AND c.movement_family_id IS NULL;

WITH aliases(family_key, label, normalized_label, kind) AS (
  VALUES
    ('squat', 'Squat', 'squat', 'synonym'::"ExerciseAliasKind"),
    ('squat', 'Back Squat', 'back squat', 'synonym'::"ExerciseAliasKind"),
    ('squat', 'Barbell Squat', 'barbell squat', 'synonym'::"ExerciseAliasKind"),
    ('squat', 'Barbell Back Squat', 'barbell back squat', 'spelling'::"ExerciseAliasKind"),
    ('push_up', 'Push Up', 'push up', 'spelling'::"ExerciseAliasKind"),
    ('push_up', 'Push-Up', 'push up', 'spelling'::"ExerciseAliasKind"),
    ('push_up', 'Pushup', 'pushup', 'spelling'::"ExerciseAliasKind"),
    ('push_up', 'push_up', 'push up', 'spelling'::"ExerciseAliasKind"),
    ('pull_up', 'Pull Up', 'pull up', 'spelling'::"ExerciseAliasKind"),
    ('pull_up', 'Pull-Up', 'pull up', 'spelling'::"ExerciseAliasKind"),
    ('pull_up', 'Pullup', 'pullup', 'spelling'::"ExerciseAliasKind"),
    ('pull_up', 'pull_up', 'pull up', 'spelling'::"ExerciseAliasKind"),
    ('bicep_curl', 'Bicep Curl', 'bicep curl', 'synonym'::"ExerciseAliasKind"),
    ('bicep_curl', 'Biceps Curl', 'biceps curl', 'synonym'::"ExerciseAliasKind"),
    ('bicep_curl', 'Dumbbell Curl', 'dumbbell curl', 'synonym'::"ExerciseAliasKind"),
    ('bicep_curl', 'Dumbbell Bicep Curl', 'dumbbell bicep curl', 'synonym'::"ExerciseAliasKind"),
    ('bicep_curl', 'Dumbbell Biceps Curl', 'dumbbell biceps curl', 'spelling'::"ExerciseAliasKind"),
    ('bicep_curl', 'Curl', 'curl', 'synonym'::"ExerciseAliasKind"),
    ('bicep_curl', 'bicep_curl', 'bicep curl', 'spelling'::"ExerciseAliasKind"),
    ('bench_press', 'Barbell Bench Press', 'barbell bench press', 'spelling'::"ExerciseAliasKind"),
    ('dip', 'Parallel Bar Dip', 'parallel bar dip', 'spelling'::"ExerciseAliasKind"),
    ('plank', 'Forearm Plank', 'forearm plank', 'spelling'::"ExerciseAliasKind"),
    ('shoulder_press', 'Seated Dumbbell Shoulder Press', 'seated dumbbell shoulder press', 'spelling'::"ExerciseAliasKind")
), deduped AS (
  SELECT DISTINCT ON (normalized_label) family_key, label, normalized_label, kind
  FROM aliases ORDER BY normalized_label, label
), owners AS (
  SELECT d.*, f.canonical_exercise_id
  FROM deduped d JOIN exercise_movement_families f ON f.key = d.family_key
  WHERE f.canonical_exercise_id IS NOT NULL
)
INSERT INTO exercise_aliases (id, exercise_id, label, normalized_label, kind)
SELECT (
  substr(md5('fittrack-exercise-alias:' || normalized_label),1,8) || '-' ||
  substr(md5('fittrack-exercise-alias:' || normalized_label),9,4) || '-4' ||
  substr(md5('fittrack-exercise-alias:' || normalized_label),14,3) || '-8' ||
  substr(md5('fittrack-exercise-alias:' || normalized_label),18,3) || '-' ||
  substr(md5('fittrack-exercise-alias:' || normalized_label),21,12)
)::uuid, canonical_exercise_id, label, normalized_label, kind
FROM owners
ON CONFLICT (normalized_label) DO NOTHING;

-- Archive exact-label duplicate rows without changing historical references.
WITH duplicate_rows AS (
  SELECT c.id AS source_id, a.exercise_id AS replacement_id, a.normalized_label
  FROM exercise_catalog c
  JOIN exercise_aliases a
    ON a.normalized_label = lower(regexp_replace(regexp_replace(btrim(c.name), '[_-]+', ' ', 'g'), '\s+', ' ', 'g'))
  WHERE c.id <> a.exercise_id AND c.is_active = true
), audited AS (
  INSERT INTO exercise_movement_backfill_audit (
    action, source_exercise_id, replacement_exercise_id, normalized_label, details
  )
  SELECT 'archived_exact_alias_duplicate', source_id, replacement_id, normalized_label,
    jsonb_build_object('references_preserved', true)
  FROM duplicate_rows
  ON CONFLICT DO NOTHING
  RETURNING source_exercise_id
)
UPDATE exercise_catalog c
SET is_active = false, tracking_mode = 'manual', movement_family_id = NULL,
    movement_profile_override = NULL
WHERE c.id IN (SELECT source_id FROM duplicate_rows);

INSERT INTO exercise_movement_backfill_audit (action, normalized_label, details)
SELECT 'migration_summary', 'movement_family_v1', jsonb_build_object(
  'families', (SELECT count(*) FROM exercise_movement_families),
  'aliases', (SELECT count(*) FROM exercise_aliases),
  'decision', 'historical exact-label duplicates archived; foreign-key history preserved'
)
ON CONFLICT DO NOTHING;
