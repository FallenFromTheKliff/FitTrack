# TASK-1701 - S17 Prisma Business Insight Contract Alignment
**Task ID:** TASK-1701
**Domain:** S17 - Business Analytics
**Status:** done
**Branch:** feat/TASK-1701-s17-prisma-business-insight-contract-alignment
**Created:** 2026-03-30
**Completed:** 2026-03-30
**Priority:** P1
**Depends On:** none
**Blocks:** TASK-1702, TASK-1703, TASK-1704, TASK-1705, TASK-1706
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the S17 contract requires mutating or replacing the current S13 analytics endpoints instead of adding a separate insight-run persistence layer
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** prismaLocal

---

## What
Add the additive Prisma persistence contract for S17 so business insight requests and responses can be stored safely before the HTTP and Python integration slices are wired.

## Why
Every downstream S17 slice depends on stable enums, a persisted `BusinessInsightRun` record, and a clear relation back to the requesting admin.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Prisma includes `InsightFocus`, `InsightPeriod`, and `BusinessInsightRun` with the fields and indexes described in the S17 context
- [x] The `requested_by` relation is wired additively to `User` without breaking existing domains
- [x] A checked-in Prisma migration exists for the additive S17 schema change
- [x] Existing S13 analytics and S16 AI schema surfaces remain intact
- [x] Relevant tests pass
- [x] Build passes (`npm.cmd run build`)
- [x] Lint check passes (`npm.cmd run lint:check`)
- [x] No avoidable `any` types used
- [x] No secret fields in responses (password, credential_hash, token_hash)
- [x] Swagger decorators applied where the module already follows Swagger
- [x] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/python/00-python-microservice-contracts.md`
- `context/python/s17-business-analytics.md`
- `tasks/s17-business-analytics/README.md`
- `tasks/s17-business-analytics/execution.md`
- `tasks/s17-business-analytics/decisions.md`

## Module Hints
- `capstone-backend/prisma`
- `capstone-backend/src/analytics`
- `capstone-backend/src/ai`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npx.cmd prisma generate`
- `npm.cmd test -- --runInBand src/analytics/analytics.repository.spec.ts src/analytics/analytics.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Scope guard for this task:
- keep `TASK-1701` schema-first and additive
- add only the missing S17 persistence contract and related generated Prisma surface
- do not broaden this task into Nest controllers, DTOs, Python routes, or live insight generation

Concrete implementation plan:
1. Extend `capstone-backend/prisma/schema.prisma` with the additive S17 persistence contract only.
   - add `InsightFocus` and `InsightPeriod`
   - add `BusinessInsightRun`
   - add the missing reverse relation on `User` for requested business insight runs
   - keep the new S17 model isolated from the existing S13 analytics read model instead of overloading current KPI DTOs or tables
2. Keep the schema tightly aligned to the S17 context without inventing extra persistence that belongs in later tasks.
   - store `request_payload` and `insight_payload` as `Json`
   - keep `model_used`, `token_count`, and `latency_ms` nullable so downstream integration can fill them when available
   - preserve the optional `requested_by` relation with `onDelete: SetNull`
   - add the `created_at` and `(requested_by, created_at)` indexes from the context
3. Add the checked-in Prisma migration manually for the new enums, table, relation, and indexes.
   - create a new migration folder under `capstone-backend/prisma/migrations/<timestamp>_s17_business_insight_contract_alignment/`
   - write `migration.sql` by hand for the additive schema changes
   - do not use `prisma migrate dev` in this task flow
   - do not apply the migration locally here unless the later test phase explicitly needs checked-in guard migration application
4. Regenerate Prisma client artifacts after the schema edit so TypeScript sees the new generated model surface.
   - run `npx.cmd prisma generate`
   - keep application-code edits out of scope unless Prisma generation reveals a narrow compile-time adjustment required to preserve the current repo
5. Use focused regression checks to prove the additive S17 schema change did not break the existing analytics seams.
   - run the current analytics service and repository specs
   - run `npm.cmd run build`
   - run `npm.cmd run lint:check`
   - reserve the S17 HTTP, Python, and history-flow work for downstream tasks

Expected files to touch:
- `capstone-backend/prisma/schema.prisma`
- `capstone-backend/prisma/migrations/<new_migration>/migration.sql`
- `capstone-backend/src/analytics/analytics.repository.spec.ts` only if generated type expectations need a narrow additive update
- `capstone-backend/src/analytics/analytics.service.spec.ts` only if generated type expectations need a narrow additive update

Implementation constraints:
- do not replace or rename the existing S13 analytics routes or DTOs
- do not add the Nest `business-analytics` controller or service flow in this task
- do not invent extra S17 tables for precomputed KPI snapshots that the context does not define
- keep the task additive so `TASK-1702` through `TASK-1704` can layer on top cleanly

Verification target for implementation:
- `npx.cmd prisma generate`
- `npm.cmd test -- --runInBand src/analytics/analytics.repository.spec.ts src/analytics/analytics.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: prismaLocal

---

## CODER OUTPUT
Implemented the additive S17 Prisma contract slice without broadening into Nest HTTP, DTO, or Python route work.

Key outcomes:
- added `InsightFocus` and `InsightPeriod` to `prisma/schema.prisma`
- added `BusinessInsightRun` with the requested `request_payload`, `insight_payload`, model metadata, and date-window fields
- added the reverse `User` relation for requested business insight runs
- kept the existing S13 analytics read surface and S16 AI tables intact
- added the checked-in migration at `prisma/migrations/20260330110000_s17_business_insight_contract_alignment/migration.sql`
- regenerated Prisma Client so the local TypeScript build uses the new generated model surface

Files changed for this slice:
- `capstone-backend/prisma/schema.prisma`
- `capstone-backend/prisma/migrations/20260330110000_s17_business_insight_contract_alignment/migration.sql`

Checks run during implementation:
- `npx.cmd prisma generate`
- `npm.cmd test -- --runInBand src/analytics/analytics.repository.spec.ts src/analytics/analytics.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused analytics specs passed (`2` suites, `10` tests)
- build passed
- lint passed

Task closeout notes:
- no extra e2e run was needed for this additive Prisma slice because it did not introduce public HTTP surface changes
- the task stop condition was not hit; the current S13 analytics routes remained untouched

MCPs used: prismaLocal

---

## TESTER REPORT
Verified `TASK-1701` against the aligned local Prisma state and closed the task.

Verification outcomes:
- Prisma Local reported the local database schema was already up to date before implementation
- Prisma Client regeneration succeeded against the updated S17 schema
- the additive `BusinessInsightRun` contract did not break the existing analytics unit surface

Checks run during test:
- Prisma Local `migrate_status`
- `npx.cmd prisma generate`
- `npm.cmd test -- --runInBand src/analytics/analytics.repository.spec.ts src/analytics/analytics.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- Prisma Local status: database schema is up to date
- focused analytics specs passed (`2` suites, `10` tests)
- build passed
- lint passed

MCPs used: prismaLocal
