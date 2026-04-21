# TASK-603 - Availability And Appointment Request Core
**Task ID:** TASK-603
**Domain:** S6 - Coaching
**Status:** done
**Branch:** feat/TASK-603-availability-and-appointment-request-core
**Created:** 2026-03-25
**Completed:** 2026-03-25
**Priority:** P1
**Depends On:** TASK-601
**Blocks:** TASK-604, TASK-605, TASK-607, TASK-608, TASK-609
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
Implement coach availability replacement and appointment request creation.

## Why
This is the core S6 scheduling layer that every later appointment, payment, and lifecycle feature depends on.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] `POST /v1/coaching/coaches/availability` replaces weekly active slots transactionally
- [ ] Availability validation rejects overlapping or inverted time windows
- [ ] `POST /v1/coaching/appointments` creates `pending_coach` appointments only when a slot covers the request and no conflicting appointment exists
- [ ] Appointment creation computes total, gym revenue, coach earnings, downpayment, and balance amounts
- [ ] Membership plans with `includes_coaching` mark the appointment as a free session when allowed
- [ ] Build passes (`npm.cmd run build`)
- [ ] Relevant tests pass
- [ ] Lint check passes (`npm.cmd run lint:check`)
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
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
- Add a dedicated `appointment/` slice under `src/coaching/` so availability replacement and appointment creation stay separate from the existing coach directory surface.
- Reuse the shared membership service boundary for `includes_coaching` eligibility instead of reading subscription records directly from coaching.
- Validate weekly slot windows in the coaching service, then keep slot replacement and appointment conflict checks inside the repository transaction layer.
- Cover the slice with focused DTO, controller, service, repository, and shared subscription-access tests before promoting the next task.
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
- Added the S6 `appointment/` slice with DTOs, controller routes, service orchestration, and repository transactions for `POST /v1/coaching/coaches/availability` and `POST /v1/coaching/appointments`.
- Implemented weekly availability replacement with overlap and inverted-window validation, plus appointment request creation with slot coverage checks, overlap protection, revenue math, and free-session handling.
- Extended the shared membership subscription boundary with `hasCoachingAccess(...)` so coaching can detect plans where `includes_coaching = true` without duplicating subscription query rules.
MCPs used: serena, prismaLocal

---

## TESTER REPORT
- `npm.cmd run build` passed.
- `npm.cmd test -- --runInBand src/coaching/appointment/appointment.controller.spec.ts src/coaching/appointment/appointment.service.spec.ts src/coaching/appointment/appointment.repository.spec.ts src/coaching/appointment/dto/appointment.dto.spec.ts src/membership/subscription/subscription.service.spec.ts src/membership/subscription/subscription.repository.spec.ts` passed with 6 suites and 28 tests.
- `npm.cmd run lint:check` passed.
- `npm.cmd run test:e2e -- --runInBand` was not run because this task only added focused unit/spec coverage for the new S6 appointment core.
MCPs used: serena, prismaLocal
