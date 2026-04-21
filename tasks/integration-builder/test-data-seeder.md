# Test Data Seeder

Use the dedicated dev-only seeder when you want realistic records for manual filtering, fetching, and chart verification without touching the normal bootstrap seed.

## Commands

- `pnpm db:seed:test`
  - clears only seed-owned fixtures, reapplies the deterministic test scenario, and rewrites the manifest
- `pnpm db:seed:test:additive`
  - keeps existing local data, upserts the deterministic scenario, and rewrites the manifest
- `pnpm db:seed:test:report`
  - prints the latest manifest in a readable summary form

## Output

Every seed run rewrites:

- `.artifacts/test-data-manifest.json`

The manifest includes:

- login credentials for each seeded account
- seeded counts grouped by area
- notable IDs for high-signal fixtures
- suggested manual test paths for web and Expo-web mobile flows

## Recommended Use

1. Start the local infra and app surfaces you want to test.
2. Run `pnpm db:seed:test`.
3. Open `.artifacts/test-data-manifest.json` or run `pnpm db:seed:test:report`.
4. Log in with one of the listed credentials and work through the suggested paths.

## Safety Rules

- `reset` mode deletes only deterministic seed-owned fixtures identified by fixed IDs.
- normal bootstrap data remains separate, so `pnpm db:seed` stays safe for minimal defaults.
- PayMongo remains treated as disabled during seeded manual testing; the scenario favors cash and manual-review records.
