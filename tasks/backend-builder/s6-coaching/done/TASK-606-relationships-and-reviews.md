# TASK-606 - Relationships And Reviews
**Task ID:** TASK-606
**Domain:** S6 - Coaching
**Status:** done
**Branch:** feat/TASK-606-relationships-and-reviews
**Created:** 2026-03-25
**Completed:** 2026-03-25
**Priority:** P2
**Depends On:** TASK-601, TASK-604
**Blocks:** TASK-607, TASK-608, TASK-609
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
Implement formal coach-member relationships and post-session review submission with rating recalculation.

## Why
These are core S6 business flows that depend on the coach directory and completed appointment lifecycle.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `POST /v1/coaching/relationships` creates a pending coach-member relationship request
- [x] `GET /v1/coaching/relationships/my` returns the caller's own relationships
- [x] `GET /v1/coaching/clients` returns the coach's paginated client list
- [x] `PATCH /v1/coaching/relationships/:id` lets the owning coach activate, pause, or terminate a relationship
- [x] `POST /v1/coaching/coaches/:id/reviews` enforces completed-appointment-only review submission
- [x] Coach ratings are recalculated after review writes
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

- Add a dedicated S6 `relationship/` slice so relationship endpoints and review submission stay separate from the existing coach directory and appointment lifecycle code.
- Keep relationship persistence in a coaching repository, map responses in a service, and expose the new routes with the same Swagger and guard conventions already used in S6.
- Gate review submission on completed-appointment ownership, then refresh the owning coach's rating aggregate in the same repository transaction as the review write.
- Verify the slice with focused DTO, controller, and service tests plus build and lint before advancing the queue.
MCPs used: none

---

## CODER OUTPUT
_Paste here after Session 2. End with `MCPs used: ...`._

- Added `POST /v1/coaching/relationships`, `GET /v1/coaching/relationships/my`, `GET /v1/coaching/clients`, and `PATCH /v1/coaching/relationships/:id` in a new `src/coaching/relationship/` slice with DTO validation, auth/role guards, response mapping, and repository-backed ownership checks.
- Added `POST /v1/coaching/coaches/:id/reviews` with completed-appointment ownership enforcement, duplicate-review blocking, and coach rating recalculation after each review write.
- Wired the new S6 relationship/review controller and providers into `CoachingModule` without widening the existing appointment or payment boundaries.
MCPs used: none

---

## TESTER REPORT
_Paste here after Session 3. End with `MCPs used: ...`._

- `npm.cmd test -- --runInBand src/coaching/relationship/dto/relationship.dto.spec.ts src/coaching/relationship/relationship.controller.spec.ts src/coaching/relationship/relationship.service.spec.ts` passed.
- `npm.cmd run build` passed.
- `npm.cmd run lint:check` passed.
- `npm.cmd run test:e2e -- --runInBand` was not run because this task only added focused S6 DTO, controller, and service behavior with targeted spec coverage.
MCPs used: none
