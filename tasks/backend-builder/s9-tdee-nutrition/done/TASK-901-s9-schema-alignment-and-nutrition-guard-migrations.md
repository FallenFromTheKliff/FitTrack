# TASK-901 - S9 Schema Alignment And Nutrition Guard Migrations
**Task ID:** TASK-901
**Domain:** S9 - TDEE & Nutrition
**Status:** done
**Branch:** feat/TASK-901-s9-schema-alignment-and-nutrition-guard-migrations
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P1
**Depends On:** none
**Blocks:** TASK-902, TASK-903, TASK-904, TASK-905, TASK-906
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the Prisma schema direction or raw SQL guard-migration approach needs approval beyond the current S9 context
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Align the existing S9 Prisma shape to the documented nutrition contracts and add the checked-in raw SQL guard indexes for active TDEE and macro snapshots.

## Why
The current schema already has the S9 tables, but it still drifts from the design on `NutritionLog.unit` and lacks the documented uniqueness guards that later service code relies on.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] The Prisma shape for S9 matches the domain design for nutrition units instead of using a free-form string
- [x] Checked-in migration SQL enforces one active `tdee_profile` per user
- [x] Checked-in migration SQL enforces one active `macro_target` per user
- [x] S9 schema comments and migration artifacts stay aligned
- [x] Build passes (`npm.cmd run build`)
- [x] Relevant tests pass
- [x] Lint check passes (`npm.cmd run lint:check`)
- [x] No avoidable `any` types used
- [x] No secret fields in responses (password, credential_hash, token_hash)
- [x] Swagger decorators applied where the module already follows Swagger
- [x] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s9-tdee-nutrition.md`
- `tasks/s9-tdee-nutrition/README.md`
- `tasks/s9-tdee-nutrition/execution.md`
- `tasks/s9-tdee-nutrition/decisions.md`

## Module Hints
- `capstone-backend/prisma`
- `capstone-backend/src/common`
- `capstone-backend/src/user`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Review confirmed that the S9 tables already exist in Prisma and the base checked-in migration, but the current schema still stores `NutritionLog.unit` as a free-form string and the documented `one_active_tdee` / `one_active_macro` constraints are only comments rather than real migration artifacts. The safest first slice is therefore to align the data model and DB guards before any nutrition module code starts depending on unstable persistence contracts.

Implementation plan:
- update the Prisma schema so nutrition-unit storage matches the S9 design and downstream DTO validation can rely on a closed value set
- add a checked-in raw SQL migration for the `one_active_tdee` and `one_active_macro` partial unique indexes
- keep the task limited to schema and migration artifacts plus any small type fallout required for the app to build cleanly
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Aligned the S9 Prisma contract and added the missing guard-migration artifact without applying it to the local database.

Delivered behavior:
- changed `NutritionLog.unit` from a free-form string to the closed `NutritionUnit` enum in `schema.prisma`
- added a checked-in raw SQL migration that creates the `NutritionUnit` enum type, safely converts existing `nutrition_logs.unit` values, and falls back unknown historical values to `serving`
- added the documented partial unique indexes `one_active_tdee` and `one_active_macro` so later S9 service work can rely on one active snapshot per user
- regenerated Prisma Client so the updated enum contract is available to TypeScript code
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed successfully.

Commands:
- `npx.cmd prisma generate`
- `npm.cmd run build`
- `npm.cmd run lint:check`
- `npm.cmd test -- --runInBand`

Results:
- Prisma Client regenerated successfully
- build passed
- lint passed
- full repo test suite passed: 69 suites, 369 tests
- Prisma Local now reports the new checked-in migration as pending, which is expected because this task intentionally added the artifact without applying it
MCPs used: serena, prismaLocal
