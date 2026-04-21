# TASK-607 - Coaching Lifecycle Jobs And Notifications
**Task ID:** TASK-607
**Domain:** S6 - Coaching
**Status:** done
**Branch:** feat/TASK-607-coaching-lifecycle-jobs-and-notifications
**Created:** 2026-03-25
**Completed:** 2026-03-26
**Priority:** P2
**Depends On:** TASK-604, TASK-605, TASK-606
**Blocks:** TASK-608, TASK-609
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
Add S6 queue wiring, no-show handling, and appointment/relationship notification side effects.

## Why
The domain contract includes asynchronous lifecycle work that should follow the existing queue and event patterns instead of living inline in controllers or services.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] S6 registers a domain lifecycle queue and processor
- [x] confirmed appointments enqueue a delayed no-show check
- [x] no-show and completion jobs update appointments safely
- [x] appointment confirmation and cancellation notifications respect the existing user notification preferences
- [x] relationship state changes emit the expected events and notification side effects
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
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
_Paste here after Session 1. End with `MCPs used: ...`._

- Mirror the existing S5 and subscription lifecycle pattern by keeping the queue domain-owned in S6 and reusing the shared generic mail and SMS processors.
- Emit explicit coaching appointment and relationship events from the existing services so scheduling and notifications stay outside the controller and business-flow paths.
- Limit repository additions to guarded lifecycle writes and notification-context reads, then verify the task with coaching-focused tests before broad build, lint, and e2e checks.
MCPs used: none

---

## CODER OUTPUT
_Paste here after Session 2. End with `MCPs used: ...`._

- Added a coaching lifecycle queue, constants, processor, and lifecycle service under `src/coaching/appointment/` for delayed no-show checks and hourly cleanup of ended free sessions.
- Emitted `coaching.appointment.*` and `coaching.relationship.*` events from the existing appointment and relationship services instead of keeping notification work inline.
- Extended coaching repositories with notification-context reads plus guarded no-show and free-session completion helpers, then added lifecycle mail and SMS delivery that reuses existing appointment preference flags and the shared `send-generic` queue processors.
- Added relationship lifecycle mail handling for coach request notifications and member status-change notifications without widening the Prisma schema.
MCPs used: none

---

## TESTER REPORT
_Paste here after Session 3. End with `MCPs used: ...`._

- `npm.cmd test -- coaching --runInBand` passed.
- `npm.cmd run build` passed.
- `npm.cmd run lint:check` passed.
- `npm.cmd test -- --runInBand` passed.
- `npm.cmd run test:e2e -- --runInBand` passed.
MCPs used: none
