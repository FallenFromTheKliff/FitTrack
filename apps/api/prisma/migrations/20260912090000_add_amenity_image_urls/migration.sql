ALTER TABLE "amenities"
  ADD COLUMN IF NOT EXISTS "image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "amenities"
SET "image_urls" = ARRAY[btrim("image_url")]::TEXT[]
WHERE btrim(COALESCE("image_url", '')) <> ''
  AND COALESCE(cardinality("image_urls"), 0) = 0;
