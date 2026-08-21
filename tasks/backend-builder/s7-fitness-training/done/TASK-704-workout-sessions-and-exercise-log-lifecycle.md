# TASK-704 - Workout Sessions And Exercise Log Lifecycle
**Task ID:** TASK-704
**Domain:** S7 - Fitness Training
**Status:** done
**Branch:** feat/TASK-704-workout-sessions-and-exercise-log-lifecycle
**Created:** 2026-03-26
**Completed:** 2026-03-26
**Priority:** P1
**Depends On:** TASK-702, TASK-703
**Blocks:** TASK-706, TASK-707, TASK-708
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** none
**Escalation Notes:** stop if session ownership or completion math rules conflict with the documented flow and cannot be resolved from repo context
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Implement the workout session lifecycle, exercise set logging, and stale-session cleanup flow.

## Why
This is the core workout execution slice and it also establishes the event contract that later gamification work will consume.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] `POST /v1/fitness/sessions/start` creates an in-progress session for the caller
- [ ] `POST /v1/fitness/sessions/:id/sets` logs one owned set and rejects duplicate `(session, exercise, set_number)` inputs cleanly
- [ ] `POST /v1/fitness/sessions/:id/complete` computes duration and total volume, then emits a stable workout-completed event
- [ ] `POST /v1/fitness/sessions/:id/cancel` marks only an owned in-progress session as cancelled
- [ ] `GET /v1/fitness/sessions` and `GET /v1/fitness/sessions/:id` return owned history and detail reads
- [ ] Session writes update `last_activity_at` correctly
- [ ] An hourly cleanup processor marks abandoned in-progress sessions as cancelled without breaking normal session flows
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
- `context/s7-fitness-training.md`
- `tasks/s7-fitness-training/README.md`
- `tasks/s7-fitness-training/execution.md`
- `tasks/s7-fitness-training/decisions.md`

## Module Hints
- `capstone-backend/src/fitness`
- `capstone-backend/src/queue`
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
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
Design-vs-code gap for `TASK-704` was the missing workout-session slice under `src/fitness/`, plus the missing Bull cleanup queue and stable workout-completed event contract documented in S7.

Implementation plan:
- add a dedicated `src/fitness/session/` module with controller, DTOs, service, repository, event, and lifecycle queue wiring
- reuse existing Nest patterns from `training-plan`, `booking`, and `appointment` for Swagger envelopes, repository boundaries, and repeat-job registration
- persist session start, set logging, completion, cancellation, and history reads against the existing Prisma S7 models without schema changes
- translate duplicate `(session, exercise, set_number)` writes into a clean 409 path and keep `last_activity_at` current on session writes
- verify with focused session specs first, then run build, full tests, and lint before closing the task
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the workout-session lifecycle under `capstone-backend/src/fitness/session/`.

Delivered behavior:
- `POST /v1/fitness/sessions/start`
- `POST /v1/fitness/sessions/:id/sets`
- `POST /v1/fitness/sessions/:id/complete`
- `POST /v1/fitness/sessions/:id/cancel`
- `GET /v1/fitness/sessions`
- `GET /v1/fitness/sessions/:id`

Implementation notes:
- added DTO validation and Swagger response metadata for session start, set logging, history, and detail reads
- added repository-backed session ownership checks, optional owned-plan linkage on start, active-exercise validation, pose-session attachment checks, and duplicate-set conflict translation
- session completion computes `duration_seconds` and `total_volume_kg`, then emits `fitness.workout-session.completed`
- added an hourly Bull cleanup job that cancels abandoned in-progress sessions after the documented two-hour inactivity window
- wired `WorkoutSessionModule` into `FitnessModule`
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed successfully.

Commands:
- `npm.cmd test -- --runInBand src/fitness/session/session.controller.spec.ts src/fitness/session/session.service.spec.ts src/fitness/session/session.repository.spec.ts src/fitness/session/session.lifecycle.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`
- `npm.cmd test -- --runInBand`

Results:
- focused session suite passed: 4 suites, 28 tests
- full repo suite passed: 59 suites, 322 tests
- build passed
- lint passed
- runtime API verification not required for this task
MCPs used: serena, prismaLocal
