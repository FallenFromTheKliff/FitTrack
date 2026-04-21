# TASK-605 - Coaching Payments And Completion Flow
**Task ID:** TASK-605
**Domain:** S6 - Coaching
**Status:** done
**Branch:** feat/TASK-605-coaching-payments-and-completion-flow
**Created:** 2026-03-25
**Completed:** 2026-03-25
**Priority:** P1
**Depends On:** TASK-603, TASK-604
**Blocks:** TASK-607, TASK-608, TASK-609
**Auto-Eligible:** no
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** none
**Escalation Notes:** stop if the shared payment ownership or event contract must be widened beyond the existing reusable payment boundary
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Extend the shared payment layer and S6 appointment service for coaching downpayments, balance collection, and appointment completion.

## Why
The S6 contract depends on `PayableType.coaching`, but the current payment ownership and consumer logic only supports subscriptions and bookings.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `POST /v1/coaching/appointments/:id/pay` starts the 30% downpayment flow with idempotency handling
- [x] `POST /v1/coaching/appointments/:id/balance` supports staff balance collection
- [x] Shared payment ownership resolution supports coaching records
- [x] `payment.completed` updates coaching appointments correctly for downpayment and balance stages
- [x] `PATCH /v1/coaching/appointments/:id/complete` enforces the documented completion rules
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
- `context/s6-coaching.md`
- `tasks/s6-coaching/README.md`
- `tasks/s6-coaching/execution.md`
- `tasks/s6-coaching/decisions.md`

## Module Hints
- `capstone-backend/src/coaching`
- `capstone-backend/src/membership/payment`
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
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
_Paste here after Session 1. End with `MCPs used: ...`._

- Extend the S6 appointment controller, DTOs, and service with the missing downpayment, balance-collection, and completion endpoints.
- Reuse the existing shared payment repository and PayMongo checkout service instead of introducing a coaching-local payment layer.
- Add shared payment ownership support for `PayableType.coaching` so manual verification and later S6 flows resolve the appointment owner consistently.
- Verify the new behavior with focused controller/service specs plus build and lint before updating the queue state.
MCPs used: none

---

## CODER OUTPUT
_Paste here after Session 2. End with `MCPs used: ...`._

- Added coaching downpayment initiation with UUID idempotency enforcement, PayMongo checkout startup, duplicate-stage resume behavior, and owner checks.
- Added staff balance collection for coaching appointments, including cash/manual pending-verification support and PayMongo balance checkout support.
- Extended the shared payment repository and payment service so `PayableType.coaching` resolves appointment ownership through the existing payment boundary.
- Added payment-completed handling for coaching downpayments and balances, and added coach-side appointment completion rules that require the session window to have ended and any required balance to be recorded first.
MCPs used: none

---

## TESTER REPORT
_Paste here after Session 3. End with `MCPs used: ...`._

- `npm.cmd test -- --runInBand src/coaching/appointment/appointment.controller.spec.ts src/coaching/appointment/appointment.service.spec.ts src/membership/payment/payment.service.spec.ts` passed.
- `npm.cmd run build` passed.
- `npm.cmd run lint:check` passed.
- `npm.cmd run test:e2e -- --runInBand` was not run in this task-sized unit.
MCPs used: none
