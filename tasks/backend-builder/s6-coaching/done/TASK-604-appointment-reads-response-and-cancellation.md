# TASK-604 - Appointment Reads Response And Cancellation
**Task ID:** TASK-604
**Domain:** S6 - Coaching
**Status:** done
**Branch:** feat/TASK-604-appointment-reads-response-and-cancellation
**Created:** 2026-03-25
**Completed:** 2026-03-25
**Priority:** P1
**Depends On:** TASK-603
**Blocks:** TASK-605, TASK-606, TASK-607, TASK-608, TASK-609
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** none
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add appointment reads, coach accept/reject behavior, free-session confirmation, and cancellation rules.

## Why
These endpoints complete the core appointment lifecycle before payment-specific paths are layered on.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `GET /v1/coaching/appointments/my` returns the caller's appointment history with date filtering
- [x] `PATCH /v1/coaching/appointments/:id/respond` lets the owning coach accept or reject pending requests
- [x] Free accepted appointments move directly to `confirmed`
- [x] Paid accepted appointments move to `pending_payment`
- [x] `PATCH /v1/coaching/appointments/:id/cancel` enforces documented cancellation ownership and no-refund rules
- [x] Build passes (`npm.cmd run build`)
- [x] Relevant tests pass
- [x] Lint check passes (`npm.cmd run lint:check`)
- [ ] No avoidable `any` types used
- [ ] No secret fields in responses (password, credential_hash, token_hash)
- [ ] Swagger decorators applied where the module already follows Swagger
- [ ] Runtime API verification completed when required

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
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
- Extend the existing S6 `appointment/` slice instead of creating a new lifecycle module so the request, response, and cancellation rules stay in one repository/service boundary.
- Reuse `DateRangeDTO` and the shared base-repository pagination helpers for `GET /v1/coaching/appointments/my` to keep response envelopes aligned with the rest of the repo.
- Mirror the booking domain split of responsibilities: controller-level auth and Swagger, service-owned appointment state rules, and repository-owned Prisma access.
- Treat coach rejection as the same cancelled appointment terminal state, persisted through `cancellation_reason`, so later notification and audit work has one cancellation shape to consume.
MCPs used: none

---

## CODER OUTPUT
- Added `GET /v1/coaching/appointments/my`, `PATCH /v1/coaching/appointments/:id/respond`, and `PATCH /v1/coaching/appointments/:id/cancel` to the appointment controller with JWT and coach-role guards where required.
- Extended the appointment service and repository with paginated member appointment reads, coach accept/reject transitions, free-session direct confirmation, paid-session `pending_payment` transitions, and cancellation ownership checks for members, owning coaches, and staff/admin users.
- Expanded the appointment DTO/response contract to include response and cancellation payloads plus lifecycle fields such as payment timestamps, completion timestamps, and cancellation metadata.
- Emitted S6 appointment cancellation audit events for both coach rejection and explicit cancellation flows.
MCPs used: none

---

## TESTER REPORT
- `npm.cmd run build` passed.
- `npm.cmd test -- --runInBand src/coaching/appointment/appointment.controller.spec.ts src/coaching/appointment/appointment.service.spec.ts src/coaching/appointment/appointment.repository.spec.ts src/coaching/appointment/dto/appointment.dto.spec.ts` passed with 4 suites and 24 tests.
- `npm.cmd run lint:check` passed.
- `npm.cmd run test:e2e -- --runInBand` was not run because this task only changed the focused S6 appointment slice and already added targeted unit/spec coverage for the new routes and lifecycle rules.
MCPs used: none
