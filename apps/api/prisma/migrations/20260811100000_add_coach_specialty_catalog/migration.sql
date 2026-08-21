-- Normalize coach specialties while retaining coach_profiles.specialization for
-- compatibility with existing clients and seed scripts.
CREATE TABLE "coach_specialties" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "normalized_label" VARCHAR(255) NOT NULL,
  "display_label" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "coach_specialties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coach_specialties_normalized_label_key"
  ON "coach_specialties" ("normalized_label");
CREATE INDEX "coach_specialties_display_label_idx"
  ON "coach_specialties" ("display_label");

CREATE TABLE "coach_profile_specialties" (
  "coach_profile_id" UUID NOT NULL,
  "specialty_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "coach_profile_specialties_pkey"
    PRIMARY KEY ("coach_profile_id", "specialty_id")
);

CREATE INDEX "coach_profile_specialties_specialty_id_idx"
  ON "coach_profile_specialties" ("specialty_id");

ALTER TABLE "coach_profile_specialties"
  ADD CONSTRAINT "coach_profile_specialties_coach_profile_id_fkey"
    FOREIGN KEY ("coach_profile_id") REFERENCES "coach_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "coach_profile_specialties_specialty_id_fkey"
    FOREIGN KEY ("specialty_id") REFERENCES "coach_specialties"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill comma-delimited legacy values without rewriting the legacy column.
-- ON CONFLICT makes the catalog and join data safe to replay in a recovery run.
WITH legacy_labels AS (
  SELECT
    profile."id" AS coach_profile_id,
    btrim(label.value) AS display_label,
    lower(regexp_replace(btrim(label.value), '\\s+', ' ', 'g')) AS normalized_label
  FROM "coach_profiles" AS profile
  CROSS JOIN LATERAL regexp_split_to_table(
    COALESCE(profile."specialization", ''),
    '\\s*,\\s*'
  ) AS label(value)
  WHERE btrim(label.value) <> ''
    AND lower(regexp_replace(btrim(label.value), '\\s+', ' ', 'g'))
      NOT IN ('n/a', 'na')
),
inserted_catalog AS (
  INSERT INTO "coach_specialties" ("normalized_label", "display_label")
  SELECT DISTINCT ON (normalized_label)
    normalized_label,
    display_label
  FROM legacy_labels
  ORDER BY normalized_label, coach_profile_id
  ON CONFLICT ("normalized_label") DO NOTHING
)
INSERT INTO "coach_profile_specialties" ("coach_profile_id", "specialty_id")
SELECT legacy_labels.coach_profile_id, specialty."id"
FROM legacy_labels
JOIN "coach_specialties" AS specialty
  ON specialty."normalized_label" = legacy_labels.normalized_label
ON CONFLICT ("coach_profile_id", "specialty_id") DO NOTHING;

-- Legacy writers (including existing seeds) continue to populate the canonical
-- catalog and join table. A no-op update avoids resetting links on replay.
CREATE OR REPLACE FUNCTION "sync_coach_profile_specialties_from_legacy"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  raw_label TEXT;
  display_label TEXT;
  normalized_label_value TEXT;
  resolved_specialty_id UUID;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."specialization" IS NOT DISTINCT FROM NEW."specialization" THEN
    RETURN NEW;
  END IF;

  DELETE FROM "coach_profile_specialties"
  WHERE "coach_profile_id" = NEW."id";

  IF COALESCE(btrim(NEW."specialization"), '') = '' THEN
    RETURN NEW;
  END IF;

  FOR raw_label IN
    SELECT value
    FROM regexp_split_to_table(NEW."specialization", '\\s*,\\s*') AS value
  LOOP
    display_label := btrim(raw_label);
    normalized_label_value := lower(regexp_replace(display_label, '\\s+', ' ', 'g'));

    IF display_label = '' OR normalized_label_value IN ('n/a', 'na') THEN
      CONTINUE;
    END IF;

    INSERT INTO "coach_specialties" ("normalized_label", "display_label")
    VALUES (normalized_label_value, display_label)
    ON CONFLICT ("normalized_label") DO NOTHING;

    SELECT "id"
    INTO resolved_specialty_id
    FROM "coach_specialties"
    WHERE "normalized_label" = normalized_label_value;

    INSERT INTO "coach_profile_specialties" ("coach_profile_id", "specialty_id")
    VALUES (NEW."id", resolved_specialty_id)
    ON CONFLICT ("coach_profile_id", "specialty_id") DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "coach_profiles_specialization_sync"
AFTER INSERT OR UPDATE OF "specialization" ON "coach_profiles"
FOR EACH ROW
EXECUTE FUNCTION "sync_coach_profile_specialties_from_legacy"();
