# TASK-601 - Coaching Module And Coach Directory
**Task ID:** TASK-601
**Domain:** S6 - Coaching
**Status:** active
**Branch:** feat/TASK-601-coaching-module-and-coach-directory
**Created:** 2026-03-25
**Completed:** -
**Priority:** P1
**Depends On:** none
**Blocks:** TASK-602, TASK-603, TASK-604, TASK-605, TASK-606, TASK-607, TASK-608, TASK-609
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
Create the initial `src/coaching/` domain root and deliver the coach browse, coach detail, and coach profile update endpoints.

## Why
This establishes the S6 module boundary and the first usable coaching HTTP surface that later appointment, payment, and relationship tasks will build on.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] `src/coaching/` exists with a thin domain root and a dedicated `coach/` submodule
- [ ] `GET /v1/coaching/coaches` supports the documented filter and pagination contract
- [ ] `GET /v1/coaching/coaches/:id` returns a single coach profile plus active availability
- [ ] `PATCH /v1/coaching/coaches/me` lets a coach update their own allowed profile fields
- [ ] `PATCH /v1/coaching/coaches/:id` lets admin update coach profile fields including commission
- [ ] The service uses repository contracts instead of Prisma in controllers
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
- `capstone-backend/src/auth`
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
- Create `CoachingModule` and a `coach/` submodule that mirrors the repo's existing controller -> service -> repository pattern.
- Reuse the existing `CoachProfile` records seeded by auth and join them to `User` plus active availability slot data for list/detail reads.
- Keep DTOs local to the coach submodule and reuse existing pagination/date validation conventions instead of inventing new shared DTOs.
- Wire coach self-update and admin update as separate service entry points so commission updates stay admin-only.
- Cover the slice with DTO, repository, service, and controller tests before promoting the next task.
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
- Implemented `src/coaching/` with a thin `CoachingModule` and a `coach/` slice for browse, detail, coach self-update, and admin update routes.
- Added repository-backed reads and updates, DTO validation, response DTOs, Swagger envelope schemas, and `AppModule` wiring.
- Added controller, service, repository, and DTO specs for the new coaching slice.
MCPs used: serena, prismaLocal

---

## TESTER REPORT
- `npm.cmd run build` passed.
- `npm.cmd test -- --runInBand src/coaching/coach/coach.controller.spec.ts src/coaching/coach/coach.service.spec.ts src/coaching/coach/coach.repository.spec.ts src/coaching/coach/dto/coach.dto.spec.ts` passed with 4 suites and 17 tests.
- `npm.cmd run lint:check` passed after formatting fixes.
MCPs used: serena, prismaLocal
