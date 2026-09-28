-- Prisma supplies @default(uuid()) values for client writes, but this trigger
-- writes directly in PostgreSQL and therefore must generate the UUID itself.
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

    INSERT INTO "coach_specialties" (
      "id",
      "normalized_label",
      "display_label",
      "created_at",
      "updated_at"
    )
    VALUES (
      gen_random_uuid(),
      normalized_label_value,
      display_label,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("normalized_label") DO NOTHING;

    SELECT "id"
    INTO resolved_specialty_id
    FROM "coach_specialties"
    WHERE "normalized_label" = normalized_label_value;

    INSERT INTO "coach_profile_specialties" (
      "coach_profile_id",
      "specialty_id",
      "created_at"
    )
    VALUES (NEW."id", resolved_specialty_id, CURRENT_TIMESTAMP)
    ON CONFLICT ("coach_profile_id", "specialty_id") DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;
