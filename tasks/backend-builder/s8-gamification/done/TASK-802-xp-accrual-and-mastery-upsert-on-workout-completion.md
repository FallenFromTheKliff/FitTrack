# TASK-802 - XP Accrual And Mastery Upsert On Workout Completion
**Task ID:** TASK-802
**Domain:** S8 - Gamification
**Status:** done
**Branch:** feat/TASK-802-xp-accrual-and-mastery-upsert-on-workout-completion
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P1
**Depends On:** TASK-801
**Blocks:** TASK-803, TASK-804, TASK-805
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the XP formula, bodyweight handling, or rank-threshold interpretation proves ambiguous against the current S8 context
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Wire S8 mastery progression to the existing workout-completed event and persist XP plus total volume per muscle group.

## Why
The read endpoints are only meaningful once S8 can populate and update `muscle_mastery_progress` from real workout data emitted by S7.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] S8 listens to `fitness.workout-session.completed` through a dedicated event handler that never throws into the caller flow
- [x] XP and volume deltas are computed per muscle group using the documented S8 formulas
- [x] Mastery rows are upserted on `(user_id, muscle_group)` and increment existing totals correctly
- [x] Rank evaluation promotes to the highest tier crossed by either XP or total volume
- [x] `last_ranked_at` updates only when the rank changes
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
- `capstone-backend/src/common`
- `capstone-backend/prisma`

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
Review confirmed that S7 already emits `fitness.workout-session.completed`, the session repository already includes linked exercise data, and the shared `BaseRepository` has an upsert helper shape suitable for `MuscleMasteryProgress`. This task should therefore focus on the event-driven write path and rank evaluation logic rather than revisiting the existing S7 emit contract.

Implementation plan:
- add a gamification listener/service method for `WORKOUT_SESSION_COMPLETED_EVENT`
- compute per-muscle-group deltas from logged sets and linked exercise muscle groups
- persist totals and rank changes through repository helpers backed by Prisma upserts
- cover XP math, rank evaluation, and no-throw listener behavior with focused tests
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the event-driven S8 mastery write path inside the existing gamification module. `GamificationService` now listens to `fitness.workout-session.completed`, computes per-muscle-group XP and volume deltas from completed exercise logs, upserts `muscle_mastery_progress`, and updates `rank` plus `last_ranked_at` only when the newly evaluated rank is higher than the stored one. The listener catches and logs failures so workout completion never breaks.

Repository support was added for workout-completion log reads, mastery upserts, and post-promotion rank updates. Shared rank helpers now cover both display formatting and rank evaluation. Focused specs were expanded to cover delta math, rank evaluation, no-op rank cases, listener no-throw behavior, workout completion grouping, and the new repository queries and upsert/update helpers.
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification passed on the final implementation.

- `npm.cmd test -- --runInBand src/fitness/gamification/gamification.service.spec.ts src/fitness/gamification/gamification.repository.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`
- `npm.cmd test -- --runInBand`

All checks passed. Full repo test suite result: `68` suites passed, `364` tests passed.
MCPs used: serena, prismaLocal
