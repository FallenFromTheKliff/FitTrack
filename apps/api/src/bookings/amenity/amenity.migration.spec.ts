import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('venue image media migration', () => {
  const migration = readFileSync(
    join(
      __dirname,
      '../../../prisma/migrations/20260810140000_add_venue_image_media_contract/migration.sql',
    ),
    'utf8',
  );

  it('backfills defaults and protects normalized media ranges', () => {
    expect(migration).toContain('"image_fit" VARCHAR(10) NOT NULL DEFAULT \'cover\'');
    expect(migration).toContain('"image_focal_x" DECIMAL(4, 3) NOT NULL DEFAULT 0.5');
    expect(migration).toContain('CHECK ("image_fit" IN (\'cover\', \'contain\'))');
    expect(migration).toContain('CHECK ("image_crop_zoom" BETWEEN 1 AND 4)');
  });

  it('adds the bounded gallery and backfills legacy primary images', () => {
    const galleryMigration = readFileSync(
      join(
        __dirname,
        '../../../prisma/migrations/20260912090000_add_amenity_image_urls/migration.sql',
      ),
      'utf8',
    );

    expect(galleryMigration).toContain(
      'ADD COLUMN IF NOT EXISTS "image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]',
    );
    expect(galleryMigration).toContain(
      'SET "image_urls" = ARRAY[btrim("image_url")]::TEXT[]',
    );
    expect(galleryMigration).toContain('cardinality("image_urls")');
  });
});
