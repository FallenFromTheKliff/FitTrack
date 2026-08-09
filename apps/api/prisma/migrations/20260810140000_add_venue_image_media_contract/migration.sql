ALTER TABLE "amenities"
  ADD COLUMN IF NOT EXISTS "image_fit" VARCHAR(10) NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS "image_focal_x" DECIMAL(4, 3) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "image_focal_y" DECIMAL(4, 3) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "image_crop_zoom" DECIMAL(4, 2) NOT NULL DEFAULT 1;

UPDATE "amenities"
SET
  "image_fit" = 'cover',
  "image_focal_x" = 0.5,
  "image_focal_y" = 0.5,
  "image_crop_zoom" = 1
WHERE
  "image_fit" NOT IN ('cover', 'contain')
  OR "image_focal_x" NOT BETWEEN 0 AND 1
  OR "image_focal_y" NOT BETWEEN 0 AND 1
  OR "image_crop_zoom" NOT BETWEEN 1 AND 4;

ALTER TABLE "amenities"
  ADD CONSTRAINT "amenities_image_fit_check"
    CHECK ("image_fit" IN ('cover', 'contain')),
  ADD CONSTRAINT "amenities_image_focal_x_check"
    CHECK ("image_focal_x" BETWEEN 0 AND 1),
  ADD CONSTRAINT "amenities_image_focal_y_check"
    CHECK ("image_focal_y" BETWEEN 0 AND 1),
  ADD CONSTRAINT "amenities_image_crop_zoom_check"
    CHECK ("image_crop_zoom" BETWEEN 1 AND 4);
