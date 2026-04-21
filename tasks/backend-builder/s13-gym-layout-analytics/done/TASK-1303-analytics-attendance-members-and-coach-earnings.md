# TASK-1303 - Analytics Attendance Members And Coach Earnings
**Task ID:** TASK-1303
**Domain:** S13 - Gym Layout & Analytics
**Status:** done
**Branch:** feat/TASK-1303-analytics-attendance-members-and-coach-earnings
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P2
**Depends On:** TASK-1302
**Blocks:** TASK-1305, TASK-1306
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the definition of `active member counts` or per-coach earnings output needs a product decision beyond the current S13 context
**Escalation Notes:** metric-definition ambiguity may require confirmation before coding
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Implement the remaining analytics endpoints for attendance trends, member counts, and per-coach earnings breakdown.

## Why
These are the more nuanced S13 aggregates and build naturally on the analytics module and query contract introduced in `TASK-1302`.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `GET /v1/analytics/attendance` is implemented for admin users with grouped trend output by requested period
- [x] `GET /v1/analytics/members` returns new and active member counts for the requested range
- [x] `GET /v1/analytics/coaches` returns per-coach billed totals, gym cut, and coach payout breakdowns
- [x] Repository aggregation logic is encapsulated behind S13 analytics repository methods
- [x] Any metric-definition assumptions are logged in `tasks/s13-gym-layout-analytics/decisions.md`
- [x] Response DTOs and Swagger metadata exist for the new endpoints
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
- `capstone-backend/src/analytics`
- `capstone-backend/src/user`
- `capstone-backend/src/coaching`
- `capstone-backend/src/membership`
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
Review shows the underlying data exists for attendance, users, and coaching earnings, but the `members` endpoint is the first S13 area where the product metric itself can still be interpreted multiple ways. To keep the queue honest, this task is marked not auto-eligible and should log whatever definition is used for “active member” and coach-level rollups.

Implementation plan:
- extend the S13 analytics repository with attendance, member, and coach aggregation methods
- reuse the query DTO and response-envelope patterns from `TASK-1302`
- keep active-member logic explicit and logged if it needs a safe default
- add controller/service tests around grouped time-series output and coach earnings shaping

Expected files to touch:
- `capstone-backend/src/analytics/`
- focused analytics tests
- `tasks/s13-gym-layout-analytics/decisions.md` if a reusable metric assumption is made

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Extended the S13 analytics module with the remaining data endpoints for attendance trends, member counts, and coach earnings, while keeping the metric definitions explicit.

Key outcomes:
- added admin-only `GET /v1/analytics/attendance`
- added admin-only `GET /v1/analytics/members`
- added admin-only `GET /v1/analytics/coaches`
- extended the analytics repository with attendance, member, and coach aggregate queries
- kept the output contract aligned with the S13 design by exposing grouped attendance buckets, new/active member counts, and per-coach totals for billed amount, gym cut, and coach payout

Implementation notes:
- active-member counting is defined for this slice as members whose started subscription window overlaps the requested range; pending-payment records are excluded
- coach earnings output uses completed appointments in range and joins coach/user profile names without exposing unrelated user fields

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed with task-scoped checks:
- `npm.cmd test -- --runInBand src/analytics`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- analytics unit tests passed: 4 suites, 23 tests
- Nest build passed
- lint check passed after one mechanical cleanup pass
- runtime API verification was not required for this task

MCPs used: serena, prismaLocal
