# TASK-1302 - Analytics Module Overview And Revenue Surface
**Task ID:** TASK-1302
**Domain:** S13 - Gym Layout & Analytics
**Status:** done
**Branch:** feat/TASK-1302-analytics-module-overview-and-revenue-surface
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P1
**Depends On:** none
**Blocks:** TASK-1303, TASK-1305, TASK-1306
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** stop if the overview or revenue KPI shape needs a product decision beyond the current S13 context
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Create the S13 analytics module and implement the initial admin-only overview and revenue endpoints using the existing payments, attendance, and coaching data.

## Why
This establishes the analytics module root and the highest-value aggregate surface while reusing the repo’s existing date-range helpers and raw-SQL repository seam reserved for S13.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] A dedicated `src/analytics/` module exists and is wired into `AppModule`
- [x] `GET /v1/analytics/overview` is implemented for admin users with validated query params
- [x] `GET /v1/analytics/revenue` is implemented for admin users with validated query params
- [x] A local analytics query DTO supports `start_date`, `end_date`, and `period`
- [x] Revenue and overview aggregations reuse repo-safe repository patterns and the existing raw-SQL helper where needed
- [x] Response DTOs and Swagger metadata exist for both endpoints
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
- `context/s13-gym-layout-analytics.md`
- `tasks/s13-gym-layout-analytics/README.md`
- `tasks/s13-gym-layout-analytics/execution.md`
- `tasks/s13-gym-layout-analytics/decisions.md`

## Module Hints
- `capstone-backend/src/membership`
- `capstone-backend/src/user`
- `capstone-backend/src/coaching`
- `capstone-backend/src/common`
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Review found no existing analytics Nest module or endpoints, but the repo already has the key data sources for a first aggregate slice: payments, attendance logs, and coaching appointment revenue fields. The `BaseRepository.queryRaw()` helper is explicitly annotated for S13 analytics, and existing `DateRangeDTO` validation can be mirrored for the new query DTO.

Implementation plan:
- add `src/analytics/` with controller, service, repository, and DTO layers
- implement a shared analytics query DTO with date range validation plus `period`
- add overview aggregation for top-line KPIs
- add revenue aggregation broken down by payable source and reporting period
- keep this slice focused on overview/revenue so the more ambiguous member and coach metrics can land in a later task

Expected files to touch:
- `capstone-backend/src/app.module.ts`
- `capstone-backend/src/analytics/`
- focused tests under `capstone-backend/src/analytics/`

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the first S13 analytics delivery slice by adding a dedicated `src/analytics/` module with controller, service, repository, DTOs, and focused unit coverage.

Key outcomes:
- added admin-only `GET /v1/analytics/overview`
- added admin-only `GET /v1/analytics/revenue`
- introduced a shared analytics query DTO with `start_date`, `end_date`, and `period`
- used the S13 raw-query repository seam for payment, attendance, member, and coaching aggregates
- kept the KPI surface intentionally scoped to overview and revenue so attendance/member/coach-detail endpoints can land cleanly in the next task

Implementation notes:
- overview exposes gym-facing revenue totals plus check-ins, new members, and completed coaching sessions
- revenue separates `coaching_payments_collected` from `coaching_gym_revenue` so `total_revenue` reflects the gym cut rather than the full coaching payment amount
- omitted the more ambiguous `active member` and per-coach breakdown definitions from this slice on purpose

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed with task-scoped checks:
- `npm.cmd test -- --runInBand src/analytics`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- analytics unit tests passed: 4 suites, 11 tests
- Nest build passed
- lint check passed after one mechanical cleanup pass
- runtime API verification was not required for this task

MCPs used: serena, prismaLocal
