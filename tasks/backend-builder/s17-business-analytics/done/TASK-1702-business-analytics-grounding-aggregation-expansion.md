# TASK-1702 - Business Analytics Grounding Aggregation Expansion
**Task ID:** TASK-1702
**Domain:** S17 - Business Analytics
**Status:** done
**Branch:** feat/TASK-1702-business-analytics-grounding-aggregation-expansion
**Created:** 2026-03-30
**Completed:** 2026-03-30
**Priority:** P1
**Depends On:** TASK-1701
**Blocks:** TASK-1703, TASK-1704, TASK-1705, TASK-1706
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the S17 KPI definitions for focus windows, peak hours, top plans, or product rollups conflict with the existing analytics source-of-truth rules
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Expand the existing Nest analytics aggregation seam so it can assemble the full S17 grounding payload that will later be sent to Python for insight generation.

## Why
The S17 Python route should receive one stable, backend-owned KPI payload rather than duplicating SQL, aggregation, or business rules inside the microservice.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] The Nest analytics layer can build a grounding payload with `window`, `overview`, `revenue`, `attendance`, `membership`, `coaching`, and optional `inventory` sections
- [x] `focus` and `custom` window handling match the S17 context without changing the current S13 public KPI routes
- [x] Attendance grounding includes both the time series and `peak_hours`
- [x] Membership grounding includes `new_members`, `active_members`, and `top_plans`
- [x] Inventory grounding is returned only when the selected focus or available data requires it
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
- `capstone-backend/src/analytics`
- `capstone-backend/src/membership`
- `capstone-backend/src/inventory/sales`
- `capstone-backend/src/coaching`
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd test -- --runInBand src/analytics/analytics.repository.spec.ts src/analytics/analytics.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Implementation plan for `TASK-1702`:

1. Add a dedicated internal S17 grounding contract under `capstone-backend/src/analytics` instead of expanding the current public Swagger DTO file.
   - create an internal type file such as `analytics.types.ts`
   - define the S17 grounding payload sections there: `window`, `overview`, `revenue`, `attendance`, `membership`, `coaching`, and optional `inventory`
   - use generated Prisma enums `InsightFocus` and `InsightPeriod` for the internal planning and implementation surface rather than duplicating new string unions
   - keep `dto/analytics.dto.ts` unchanged so the current S13 public KPI endpoints do not silently broaden

2. Extend `AnalyticsRepository` additively with the S17-only aggregate helpers while preserving the current S13 query methods.
   - keep `getOverviewMetrics`, `getRevenueMetrics`, `getAttendanceMetrics`, `getMemberMetrics`, and `getCoachEarningsMetrics` intact for the public controller flow
   - add new repo helpers for:
     - attendance peak-hour rollups from `attendance_logs`
     - membership top-plan ranking from completed subscription payments joined to `subscriptions` and `membership_plans`
     - inventory top-product ranking from completed `sale_transactions` joined to `sale_transaction_items` and `retail_products`
   - cap ranked lists to a small deterministic set such as top 5 and break ties consistently
   - treat S17 `custom` windows as daily bucket queries for attendance and revenue series instead of inventing a second bucket model

3. Expand `AnalyticsService` with an internal grounding-builder seam that downstream S17 tasks can call directly.
   - add a public internal method such as `buildBusinessInsightGroundingPayload(input)` on `AnalyticsService`
   - keep the current public `getOverview`, `getRevenue`, `getAttendance`, `getMembers`, and `getCoaches` methods working exactly as they do today
   - add a dedicated S17 window resolver that accepts `focus`, `period`, and optional date bounds, normalizes the window to inclusive UTC dates, and supports `custom`
   - reuse the existing money/count mapping helpers so the grounding payload stays string-safe for currency fields and number-safe for counts

4. Keep the S17 grounding behavior aligned to the current repo’s analytics ownership boundary and avoid broadening this slice into HTTP or Python work.
   - implement the new aggregate SQL inside `AnalyticsRepository`, because that module already owns the cross-domain analytics rollups in the current repo
   - do not add controllers, DTOs, Python client methods, or `business-analytics` routes in this task
   - make `inventory` optional by omitting it unless the focus is `overview` or `inventory`
   - keep the future `TASK-1704` Nest insight flow as the first caller of the new grounding builder instead of wiring any request path here

5. Add focused analytics tests only where this task changes behavior.
   - extend `analytics.repository.spec.ts` to cover:
     - the new peak-hours query
     - the new top-plans query
     - the new top-products query
     - `custom` period mapping to daily bucket SQL
   - extend `analytics.service.spec.ts` to cover:
     - the assembled S17 grounding payload shape
     - focus-aware inventory omission
     - the resolved custom-window behavior
   - do not add controller tests because this slice should not change the public S13 controller surface

6. Verify with the smallest useful task-sized command set.
   - `npm.cmd test -- --runInBand src/analytics/analytics.repository.spec.ts src/analytics/analytics.service.spec.ts`
   - `npm.cmd run build`
   - `npm.cmd run lint:check`
   - do not run `prisma migrate dev`; Prisma Local currently reports one unapplied checked-in migration from `TASK-1701`, and it should be handled later with `prisma migrate deploy` only if a DB-backed verification step is actually blocked on it

Expected files to touch:
- `capstone-backend/src/analytics/analytics.service.ts`
- `capstone-backend/src/analytics/analytics.repository.ts`
- `capstone-backend/src/analytics/analytics.service.spec.ts`
- `capstone-backend/src/analytics/analytics.repository.spec.ts`
- `capstone-backend/src/analytics/analytics.types.ts` or equivalent new internal type file

Implementation constraints:
- do not mutate the existing S13 controller routes or public analytics DTOs
- do not turn this task into the S17 Nest HTTP surface; that belongs to `TASK-1704`
- do not add Python route or OpenRouter work here; that belongs to `TASK-1703`
- do not rely on an unapplied local migration for correctness in this slice when focused unit tests and build checks can verify it without a DB round-trip

MCP notes:
- Serena was attempted first again but timed out in this session, so planning relied on local file inspection plus Prisma Local
- Prisma Local confirms the checked-in `TASK-1701` migration exists locally but is not yet applied to the dev DB

MCPs used: prismaLocal

---
## CODER OUTPUT
Implemented the S17 grounding aggregation seam inside `capstone-backend/src/analytics` without broadening into new Nest routes, public Swagger DTOs, or Python integration work.

Key outcomes:
- added the internal grounding contract at `capstone-backend/src/analytics/analytics.types.ts`
- expanded `AnalyticsRepository` with S17-only helpers for attendance peak hours, top membership plans, top inventory products, and `custom -> daily` series bucketing
- added `AnalyticsService.buildBusinessInsightGroundingPayload(...)` with focus-aware window resolution and optional inventory inclusion
- refactored the revenue and attendance mapping logic so the new S17 builder and the existing S13 endpoints reuse the same money and count formatting behavior
- kept the existing `/v1/analytics/*` controller surface and `dto/analytics.dto.ts` unchanged

Files changed for this slice:
- `capstone-backend/src/analytics/analytics.types.ts`
- `capstone-backend/src/analytics/analytics.repository.ts`
- `capstone-backend/src/analytics/analytics.service.ts`
- `capstone-backend/src/analytics/analytics.repository.spec.ts`
- `capstone-backend/src/analytics/analytics.service.spec.ts`

Checks run during implementation:
- `npm.cmd test -- --runInBand src/analytics/analytics.repository.spec.ts src/analytics/analytics.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused analytics specs passed (`2` suites, `16` tests)
- build passed
- lint passed

Task closeout notes:
- Serena was attempted first again but timed out in this session, so implementation used local file inspection plus Prisma Local for migration-state confirmation
- the checked-in `TASK-1701` migration remains unapplied locally and did not block this unit-test-driven aggregation slice

MCPs used: prismaLocal

---

## TESTER REPORT
Verified the S17 analytics grounding slice against the focused Nest analytics test surface and task-sized code checks.

Verification outcomes:
- the new internal grounding builder produces the expected S17 payload shape, including `custom` windows, peak-hour rankings, plan rankings, and focus-aware inventory omission
- repository coverage now confirms `custom` periods resolve to daily SQL buckets and the new ranking queries point at the intended source tables
- the existing S13 analytics response methods still compile and pass after the shared mapping refactor

Checks run during test:
- Prisma Local `migrate_status`
- `npm.cmd test -- --runInBand src/analytics/analytics.repository.spec.ts src/analytics/analytics.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- Prisma Local status still reports one unapplied checked-in migration from `TASK-1701` and no new migration need for this slice
- focused analytics specs passed (`2` suites, `16` tests)
- build passed
- lint passed

MCPs used: prismaLocal
