# Test Data Seeder

Use the dedicated dev-only seeder when you want realistic records for manual filtering, fetching, and chart verification without touching the normal bootstrap seed.

## Commands

- Canonical local realistic seed:
  - `pnpm.cmd seed:realistic --target=local --mode=reset --users=100 --exercise-history=100`
- Canonical Railway realistic reset:
  - `pnpm.cmd seed:realistic --target=railway --mode=reset --users=100 --exercise-history=100 --allow-remote-reset --confirm=RESET_REMOTE_DYNAMIC_SEED`
- `pnpm test:seed:dynamic`
  - runs the bounded no-database seed contract checks
- `pnpm db:seed:dynamic`
  - resets the local Docker Postgres database and seeds the modular realistic scenario with 100 users
- `pnpm db:seed:dynamic:additive`
  - upserts/appends the modular realistic scenario without clearing local data
- `pnpm db:seed:dynamic:railway`
  - runs the modular realistic scenario through `railway run` in additive mode so Railway injects the service `DATABASE_URL`
- `pnpm db:seed:test`
  - clears only seed-owned fixtures, reapplies the deterministic test scenario, and rewrites the manifest
- `pnpm db:seed:test:additive`
  - keeps existing local data, upserts the deterministic scenario, and rewrites the manifest
- `pnpm db:seed:test:report`
  - prints the latest manifest in a readable summary form

## Output

Every seed run rewrites:

- `.artifacts/test-data-manifest.json`
- `.artifacts/dynamic-seed-manifest.json` for `db:seed:dynamic*`

The manifest includes:

- login credentials for each seeded account
- seeded counts grouped by area
- notable IDs for high-signal fixtures
- suggested manual test paths for web and Expo-web mobile flows

## Recommended Use

1. Start the local infra and app surfaces you want to test.
2. Run one of the canonical realistic commands above for broad demo data, or `pnpm db:seed:test` for the narrower deterministic manual-test pack.
3. Open `.artifacts/dynamic-seed-manifest.json`, `.artifacts/test-data-manifest.json`, or run `pnpm db:seed:test:report`.
4. Log in with one of the listed credentials and work through the suggested paths.

## Dynamic Demo Credentials

- `seed.admin@fittrack.com` / `SeedMember!2026`
- `seed.staff@fittrack.com` / `SeedMember!2026`
- `seed.coach@fittrack.com` / `SeedMember!2026`
- `seed.member.active@fittrack.com` / `SeedMember!2026`
- `seed.member.premium@fittrack.com` / `SeedMember!2026`
- `seed.member.frozen@fittrack.com` / `SeedMember!2026`
- `seed.member.pending@fittrack.com` / `SeedMember!2026`
- `seed.member.expired@fittrack.com` / `SeedMember!2026`
- `seed.member.unverified@fittrack.com` / `SeedMember!2026`
- `seed.member.archived@fittrack.com` / `SeedMember!2026`
- `seed.member.suspended@fittrack.com` / `SeedMember!2026`

## Safety Rules

- `reset` mode deletes only deterministic seed-owned fixtures identified by fixed IDs.
- normal bootstrap data remains separate, so `pnpm db:seed` stays safe for minimal defaults.
- PayMongo remains treated as disabled during seeded manual testing; the scenario favors cash and manual-review records.
- Dynamic reset refuses non-local databases unless `--target=railway --allow-remote-reset --confirm=RESET_REMOTE_DYNAMIC_SEED` is passed intentionally.
