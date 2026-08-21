# TASK-702 - Training Plan CRUD And Coach Assignment
**Task ID:** TASK-702
**Domain:** S7 - Fitness Training
**Status:** done
**Branch:** feat/TASK-702-training-plan-crud-and-coach-assignment
**Created:** 2026-03-26
**Completed:** 2026-03-26
**Priority:** P1
**Depends On:** TASK-701
**Blocks:** TASK-703, TASK-704, TASK-705, TASK-706, TASK-707, TASK-708
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** none
**Escalation Notes:** stop if coach assignment ownership or template-vs-member copy rules are not discoverable from the repo and context
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Implement the core training plan HTTP surface for members and coaches.

## Why
Plan creation and ownership rules need to be stable before session logging, AI generation, or pose work can build on top of them.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `GET /v1/fitness/plans` returns the caller's plans with pagination
- [x] `GET /v1/fitness/plans/:id` returns a full owned plan with schedule days and exercises
- [x] `POST /v1/fitness/plans` creates a manual plan with nested schedule persistence
- [x] `DELETE /v1/fitness/plans/:id` deletes only an owned plan
- [x] `POST /v1/fitness/plans/:id/assign` lets a coach create a member copy without mutating the source plan in place
- [x] Plan reads and writes enforce ownership and role checks cleanly
- [x] Multi-write plan persistence is transactional
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
- `context/s7-fitness-training.md`
- `tasks/s7-fitness-training/README.md`
- `tasks/s7-fitness-training/execution.md`
- `tasks/s7-fitness-training/decisions.md`

## Module Hints
- `capstone-backend/src/fitness`
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
- `npm.cmd run lint:check`
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
Scoped `TASK-702` to a dedicated `training-plan/` submodule under `src/fitness/` plus a narrow `RelationshipService.assertActiveClientRelationship()` helper so coach assignment reuses S6 ownership rules instead of duplicating them in S7.
Planned to keep plan writes transactional, to enforce owned-plan access before detail/delete/assign actions, and to defer dedicated template semantics until a later S7 task exposes that surface explicitly.
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
- Added `capstone-backend/src/fitness/training-plan/` with DTO validation, controller/service/repository wiring, summary/detail response mapping, and transactional nested schedule persistence for list/detail/create/delete/assign flows.
- Reused `CoachingModule` through `RelationshipService.assertActiveClientRelationship()` so coach assignment only targets actively related members and keeps cross-domain ownership checks inside the coaching service boundary.
- Expanded focused test coverage for the new training-plan slice plus the new cross-domain relationship guard behavior.
MCPs used: serena, prismaLocal

---

## TESTER REPORT
- `npm.cmd test -- --runInBand src/fitness/training-plan/dto/training-plan.dto.spec.ts src/fitness/training-plan/training-plan.controller.spec.ts src/fitness/training-plan/training-plan.service.spec.ts src/fitness/training-plan/training-plan.repository.spec.ts src/coaching/relationship/relationship.service.spec.ts` passed.
- `npm.cmd run build` passed.
- `npm.cmd run lint:check` passed.
- `npm.cmd test -- --runInBand` passed with 55 suites and 294 tests green.
MCPs used: serena, prismaLocal
