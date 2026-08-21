# TASK-506 - Booking Lifecycle Jobs And Notifications
**Task ID:** TASK-506
**Domain:** S5 - Facility Bookings
**Status:** done
**Branch:** feat/TASK-506-booking-lifecycle-jobs-and-notifications
**Created:** 2026-03-24
**Completed:** 2026-03-24
**Priority:** P1
**Depends On:** TASK-503, TASK-504, TASK-505
**Blocks:** TASK-507
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** booking notification content or timing requires a new product decision beyond the S5 context
**Escalation Notes:** ask only if lifecycle transitions need behavior that conflicts with the current queue or notification infrastructure
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena, prismaLocal

---

## What
Implement the S5 lifecycle queue, automated booking cleanup jobs, and booking notifications using the existing generic mail and SMS processors.

## Why
Confirmed and pending bookings need automated follow-through so operational state stays accurate without manual cleanup.

## Acceptance Criteria
- [x] Register a dedicated bookings lifecycle queue and processor using current Bull patterns.
- [x] Queue a no-show check when a booking becomes confirmed.
- [x] Implement pending-booking cleanup and completion cron handlers using the supported S5 status transitions.
- [x] Mark eligible bookings as `no_show`, `cancelled`, or `completed` only when the current state and timestamps allow it.
- [x] Queue booking confirmation and cancellation notifications through the generic mail and SMS queues.
- [x] Respect booking notification preference fields where they already exist in the user domain.
- [x] Add tests for queue scheduling, cron execution, and lifecycle side effects.
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
- `capstone-backend/src/queue`
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
- Mirror the successful subscription lifecycle pattern, but keep the S5 queue and processor domain-owned inside `src/bookings/`.
- Reuse the existing `send-generic` mail and SMS processors instead of inventing a booking-specific delivery stack.
- Keep runtime API verification out of this task; focus on code-level queue behavior and tests only.
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
- Added a domain-owned booking lifecycle queue, processor, constants, and lifecycle service under `src/bookings/booking/` using the existing Bull and generic mail/SMS patterns.
- Introduced a `booking.confirmed` domain event and emitted it from both free-booking confirmation and downpayment confirmation so lifecycle scheduling and notifications share one confirmation seam.
- Extended the booking repository with notification-context reads plus guarded lifecycle writes for stale pending cleanup, no-show transitions, and past free-booking completion.
- Wired booking confirmation and cancellation notifications through the shared `mail` and `sms` queues, reusing existing booking notification preference fields where available.
- Added booking lifecycle service specs and expanded booking service/repository specs for confirmation events and lifecycle status filters.
- Checks run:
  - `npm.cmd test -- booking --runInBand`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
MCPs used: serena, prismaLocal

---

## TESTER REPORT
- Verification passed for the TASK-506 slice.
- Confirmed repeatable cleanup and completion job registration, delayed no-show scheduling, booking confirmation/cancellation notification queueing, and lifecycle cron side effects.
- Confirmed booking confirmation events now fire from both free and paid confirmation paths so lifecycle automation receives the same trigger regardless of payment path.
- Checks run:
  - `npm.cmd test -- booking --runInBand`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
- `npm.cmd run test:e2e -- --runInBand` was not run for this task.
MCPs used: serena, prismaLocal
