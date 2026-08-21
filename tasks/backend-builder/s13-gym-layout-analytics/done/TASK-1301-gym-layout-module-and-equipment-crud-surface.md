# TASK-1301 - Gym Layout Module And Equipment CRUD Surface
**Task ID:** TASK-1301
**Domain:** S13 - Gym Layout & Analytics
**Status:** done
**Branch:** feat/TASK-1301-gym-layout-module-and-equipment-crud-surface
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P1
**Depends On:** none
**Blocks:** TASK-1304, TASK-1305, TASK-1306
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** stop if the existing `GymEquipment` schema cannot support the documented map CRUD contract without broader schema redesign
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Create the dedicated S13 gym-layout module and implement the authenticated/admin equipment CRUD REST surface on top of the existing `GymEquipment` table.

## Why
The S13 schema and migrations already include `GymEquipment`, so this is the safest first slice to turn design-only map persistence into a real HTTP contract without taking on the unresolved realtime transport decision yet.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] A dedicated `src/gym-layout/` module exists and is wired into `AppModule`
- [x] `GET /v1/gym-layout/equipment` returns active equipment records with positions for authenticated users
- [x] `POST /v1/gym-layout/equipment`, `PATCH /v1/gym-layout/equipment/:id`, and `DELETE /v1/gym-layout/equipment/:id` are admin-only and use validated DTOs
- [x] Delete behavior is soft-delete via `is_active = false`, not a hard database delete
- [x] DTO validation and Swagger metadata exist for the new HTTP surface
- [x] This slice does not yet require Redis pub/sub or WebSocket broadcasting
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
- `context/s13-gym-layout-analytics.md`
- `tasks/s13-gym-layout-analytics/README.md`
- `tasks/s13-gym-layout-analytics/execution.md`
- `tasks/s13-gym-layout-analytics/decisions.md`

## Module Hints
- `capstone-backend/src/common`
- `capstone-backend/src/inventory`
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

---

## PLANNER OUTPUT
S13 review confirmed that the `GymEquipment` Prisma model and checked-in migration already exist, but there is still no `src/gym-layout/` module, no `/v1/gym-layout/*` controller surface, and no S13 tests. The realtime Redis/WebSocket design is the only high-impact ambiguity right now, so the safest first implementation slice is to stand up the CRUD and read contract over the existing table without introducing pub/sub yet.

Implementation plan:
- add a dedicated `src/gym-layout/` module and wire it into `AppModule`
- create repository, service, controller, and DTO layers for `GymEquipment`
- expose:
  - `GET /v1/gym-layout/equipment`
  - `POST /v1/gym-layout/equipment`
  - `PATCH /v1/gym-layout/equipment/:id`
  - `DELETE /v1/gym-layout/equipment/:id`
- make reads JWT-protected and writes admin-only
- implement soft delete through `is_active`
- defer Redis status caching and the `/gym-layout` WebSocket gateway to `TASK-1304`

Expected files to touch:
- `capstone-backend/src/app.module.ts`
- `capstone-backend/src/gym-layout/`
- focused tests under `capstone-backend/src/gym-layout/`

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the first S13 delivery slice by adding a dedicated `src/gym-layout/` module with repository, service, controller, DTOs, and focused unit coverage over the existing `GymEquipment` Prisma model.

Key outcomes:
- added authenticated `GET /v1/gym-layout/equipment`
- added admin-only `POST`, `PATCH`, and `DELETE` handlers under `/v1/gym-layout/equipment`
- mapped decimal map positions to numeric response fields
- enforced soft delete through `is_active = false`
- wired `GymLayoutModule` into `AppModule`
- deferred Redis/WebSocket behavior to the later realtime-specific task exactly as planned

Implementation notes:
- response DTOs expose only map-safe fields from `GymEquipment`
- create requests default `status` to `available`
- update requests support partial field updates, including `status` and `is_active`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed with task-scoped checks:
- `npm.cmd test -- --runInBand src/gym-layout`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- gym-layout unit tests passed: 4 suites, 18 tests
- Nest build passed
- lint check passed after one formatting-only cleanup pass
- runtime API verification was not required for this task

MCPs used: serena, prismaLocal
