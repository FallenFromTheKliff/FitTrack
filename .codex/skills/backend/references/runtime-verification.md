# Runtime Verification

Use this reference after backend implementation or refactor work.

## Verification order

1. targeted lint or type-safety checks if the change is broad enough to justify them
2. focused unit or integration tests near the touched domain
3. direct API checks for the changed endpoints or flows
4. Swagger confirmation when the live contract changed or needs proof

## Script sources

Root repo commands:

- `pnpm --filter @fittrack/api run lint:check`
- `pnpm --filter @fittrack/api test -- --runInBand`
- `pnpm --filter @fittrack/api run test:e2e -- --runInBand`

Swagger defaults:

- UI: `/v1/docs`
- OpenAPI JSON: `/v1/docs-json`

## What to confirm

- guard and role behavior match the intended actors
- response bodies still follow the repo success and error envelopes
- DTO validation and Swagger metadata match the real runtime behavior
- seeded data assumptions are still true for the runtime path you verified

## Failure bar

- a passing unit test is not enough when the HTTP contract changed
- a working controller path is not enough if Swagger is stale
- a green Swagger surface is not enough if role denial or seed truth is still wrong
