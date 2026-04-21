# TASK-803 - Rank-Up Event And Notification Delivery
**Task ID:** TASK-803
**Domain:** S8 - Gamification
**Status:** done
**Branch:** feat/TASK-803-rank-up-event-and-notification-delivery
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P2
**Depends On:** TASK-802
**Blocks:** TASK-804, TASK-805
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if rank-up notification copy or delivery-channel behavior requires a product decision beyond the current S8 context
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Emit a dedicated S8 rank-up event and deliver rank-up email notifications through the existing queue when the user preference allows it.

## Why
The S8 design includes rank-up side effects, and reusing the existing user preference plus queued mail path keeps notification behavior aligned with the rest of the app.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] S8 emits a dedicated rank-up event only when a user's mastery rank actually changes
- [x] Rank-up notification handling respects the user's `rank_up_email` preference
- [x] Notification delivery uses the existing mail queue path rather than direct controller or listener email sends
- [x] Failures in notification delivery do not break workout completion or mastery persistence
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
- `context/s8-gamification.md`
- `tasks/s8-gamification/README.md`
- `tasks/s8-gamification/execution.md`
- `tasks/s8-gamification/decisions.md`

## Module Hints
- `capstone-backend/src/fitness`
- `capstone-backend/src/user`
- `capstone-backend/src/queue`
- `capstone-backend/src/mail`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Review found that the user domain already exposes `rank_up_email` and the generic mail queue is already live, so S8 does not need a new notification transport. This task should stay focused on S8-owned event emission and safe delivery orchestration after mastery changes are already working.

Implementation plan:
- define a rank-up event contract owned by the S8 module
- emit that event only when rank evaluation actually promotes the user
- consume it through a queued email path that reuses existing user aggregate and mail queue infrastructure
- add focused listener/service tests for preference handling and failure isolation
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Added the S8 rank-up side-effect path with a dedicated event contract in `src/fitness/gamification/events/`, emission from `GamificationService` only after a real promotion, and a new `GamificationLifecycleService` that consumes the event through the existing mail queue. The lifecycle service resolves recipient data through a narrow new `UserService.getGamificationNotificationTarget()` seam instead of reaching into user persistence directly, and it catches notification failures so workout completion and mastery persistence remain intact.

I also updated the gamification module wiring to import the queue module, added focused tests for event emission plus lifecycle preference handling and failure isolation, and extended the user service tests for the new notification-target mapping.
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification passed on the final implementation.

- `npm.cmd test -- --runInBand src/fitness/gamification/gamification.service.spec.ts src/fitness/gamification/gamification-lifecycle.service.spec.ts src/user/user.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`

All checks passed. Full repo test suite result: `69` suites passed, `369` tests passed.
MCPs used: serena, prismaLocal
