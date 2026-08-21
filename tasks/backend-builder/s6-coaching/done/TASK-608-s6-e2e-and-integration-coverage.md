# TASK-608 - S6 E2E And Integration Coverage
**Task ID:** TASK-608
**Domain:** S6 - Coaching
**Status:** done
**Branch:** feat/TASK-608-s6-e2e-and-integration-coverage
**Created:** 2026-03-25
**Completed:** 2026-03-26
**Priority:** P2
**Depends On:** TASK-601, TASK-603, TASK-604, TASK-605, TASK-606, TASK-607
**Blocks:** TASK-609
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** none
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add the final S6 e2e and integration confidence pass across the completed coaching flows.

## Why
The S6 surface spans guards, DTO validation, repository rules, shared payment events, and queue-driven side effects, so it needs a dedicated confidence slice before live runtime verification.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] High-risk S6 HTTP routes have e2e coverage
- [x] Shared event consumers and lifecycle queue behavior have integration coverage where needed
- [x] The S6 task queue closes with green build, relevant tests, and lint checks
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
- `capstone-backend/src/queue`
- `capstone-backend/test`

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
- Review found strong S6 unit and service coverage already in place, plus queue-focused specs for lifecycle handlers, but no controller-level e2e coverage for the coaching HTTP surface and no event-emitter integration coverage for the shared `payment.completed` consumer path.
- Planned a narrow confidence slice: add one coaching controller e2e suite for the guarded appointment and relationship flows, plus one integration spec that proves shared payment completion advances coaching appointments into the lifecycle queue.
MCPs used: prismaLocal

---

## CODER OUTPUT
- Added `capstone-backend/test/coaching.e2e-spec.ts` to cover coach-only profile updates, appointment creation/respond/pay/balance routes, relationship request/update routes, and review DTO validation through the real controller, guard, pipe, and response envelope stack.
- Added `capstone-backend/src/coaching/appointment/appointment-payment.integration.spec.ts` to verify the shared `payment.completed` event confirms pending coaching appointments, triggers the downstream no-show queue path, and remains idempotent for duplicate completion events.
MCPs used: none

---

## TESTER REPORT
- `npm.cmd run build` passed.
- `npm.cmd test -- --runInBand` passed with 47 suites and 252 tests.
- `npm.cmd run test:e2e -- --runInBand` passed with 3 suites and 28 tests.
- `npm.cmd run lint:check` passed.
- Focused re-runs stayed green for `src/coaching/appointment/appointment-payment.integration.spec.ts` and `test/coaching.e2e-spec.ts`.
- `prisma migrate status` reported two unapplied local guard migrations (`20260323090000_subscription_uniqueness_guard`, `20260325103000_coaching_uniqueness_guards`); this did not block TASK-608 because the task stayed at mocked test boundaries, but TASK-609 should verify local DB state before live runtime API checks.
- Runtime API verification was not required for TASK-608 and remains reserved for TASK-609.
MCPs used: prismaLocal
