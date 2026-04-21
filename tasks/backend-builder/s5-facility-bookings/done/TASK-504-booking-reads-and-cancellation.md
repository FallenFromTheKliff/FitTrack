# TASK-504 - Booking Reads And Cancellation
**Task ID:** TASK-504
**Domain:** S5 - Facility Bookings
**Status:** done
**Branch:** feat/TASK-504-booking-reads-and-cancellation
**Created:** 2026-03-24
**Completed:** 2026-03-24
**Priority:** P1
**Depends On:** TASK-503
**Blocks:** TASK-505, TASK-506
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** cancellation rules diverge from the S5 no-refund contract
**Escalation Notes:** ask only if cancellation behavior needs refund or grace-period logic that is not present in the S5 context
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena, prismaLocal

---

## What
Implement member/admin booking reads and the no-refund booking cancellation flow.

## Why
Once bookings can be created, users and staff need visibility into them and members need the supported cancellation path.

## Acceptance Criteria
- [x] Implement `GET /v1/bookings/amenity/my` with date-range filtering and pagination.
- [x] Implement `GET /v1/bookings/amenity` for admin/staff booking visibility.
- [x] Implement `PATCH /v1/bookings/amenity/:id/cancel` with ownership and state validation.
- [x] Allow cancellation only for bookings in the supported `pending` or `confirmed` states.
- [x] Record `cancelled_at` and keep the no-refund rule explicit in behavior and tests.
- [x] Emit the S5 booking cancellation audit/event seam needed by later notification work.
- [x] Add tests for ownership, forbidden admin/member access, invalid state transitions, and successful cancellation.
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
- `context/s5-facility-bookings.md`
- `tasks/s5-facility-bookings/README.md`
- `tasks/s5-facility-bookings/execution.md`
- `tasks/s5-facility-bookings/decisions.md`

## Module Hints
- `capstone-backend/src/bookings`
- `capstone-backend/src/audit`
- `capstone-backend/src/user`
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
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes`

---

## PLANNER OUTPUT
- Keep this task focused on read models and supported cancellation rules, not the on-arrival balance flow.
- Reuse shared `DateRangeDTO` patterns from the user and payment modules where practical.
- Emit stable cancellation signals here so later notification jobs do not have to rediscover booking state logic.
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S5 booking read and cancellation slice on top of the existing booking-create flow.

- Added member booking history and admin/staff booking list endpoints using shared `DateRangeDTO` pagination patterns.
- Added the member cancellation endpoint with ownership checks, supported-state validation, and an explicit non-refundable response contract.
- Extended the booking repository with paginated read helpers and a cancellation update path that records `cancelled_at`.
- Emitted both the audit seam (`BOOKING_CANCELLED`) and a dedicated `booking.cancelled` event for later notification/lifecycle work.

Focused checks run during implementation:
- `npm.cmd test -- bookings --runInBand` - passed (`9` suites, `55` tests)
- `npm.cmd run build` - passed
- `npm.cmd run lint:check` - passed
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification passed for the TASK-504 booking reads and cancellation slice.

Coverage now includes:
- member booking history and admin/staff booking list delegation
- controller guard and role metadata for member/admin routes
- repository pagination and cancellation update contracts
- invalid cancellation state rejection
- successful cancellation with audit and `booking.cancelled` event emission

Checks run in this verification session:
- `npm.cmd test -- bookings --runInBand` - passed (`9` suites, `55` tests)
- `npm.cmd run build` - passed
- `npm.cmd run lint:check` - passed

Notes:
- `npm.cmd run test:e2e -- --runInBand` was not run because this task does not require runtime API verification and the task scope is covered by focused unit/spec checks.
MCPs used: serena, prismaLocal
