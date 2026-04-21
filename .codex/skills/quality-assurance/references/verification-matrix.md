# Verification Matrix

Use this reference to choose the smallest honest QA command set for the touched area.

## Default package-level commands

Web:

- `pnpm --filter @fittrack/web run lint`
- `pnpm --filter @fittrack/web run typecheck`

Mobile:

- `pnpm --filter @fittrack/mobile run lint`
- `pnpm --filter @fittrack/mobile run typecheck`

Backend:

- `pnpm --filter @fittrack/api run lint:check`
- `pnpm --filter @fittrack/api test -- --runInBand`
- `pnpm --filter @fittrack/api run test:e2e -- --runInBand`

Repo-wide last resort:

- `pnpm lint`
- `pnpm typecheck`

## Verification by change type

### Web-only UI change

- web lint and typecheck
- targeted web behavior checks
- direct API checks only if the UI change depends on new backend behavior
- Playwright web verification for the touched flow

### Mobile-only UI change

- mobile lint and typecheck
- targeted mobile behavior checks
- direct API checks only if the UI change depends on new backend behavior
- Playwright Expo-web verification for the touched flow

### Backend-only contract change

- backend lint and targeted tests
- direct API checks for touched endpoints
- Swagger confirmation when the live contract changed
- Playwright only if a browser surface depends on the changed endpoint

### Shared package or integration change

- run the affected package checks plus the consuming app checks
- direct API checks when backend behavior matters
- Swagger when the contract changed
- Playwright for every required touched browser surface

## Direct API before Swagger

- confirm real endpoint behavior with direct API checks first
- use Swagger afterward to confirm the live documented contract
- do not treat Swagger alone as proof that the endpoint behaves correctly

## Playwright rules

- use `.playwright-mcp.json` for browser runtime defaults
- use `.playwright-fittrack-flow.json` for web and Expo-web role and route expectations
- capture visible post-action state, not only successful requests

## Report structure

- commands run
- findings
- edge cases covered
- use cases covered
- blockers or skips
- artifact paths
