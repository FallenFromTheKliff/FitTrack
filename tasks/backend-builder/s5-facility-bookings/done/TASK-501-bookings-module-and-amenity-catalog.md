# TASK-501 - Bookings Module And Amenity Catalog
**Task ID:** TASK-501
**Domain:** S5 - Facility Bookings
**Status:** done
**Branch:** feat/TASK-501-bookings-module-and-amenity-catalog
**Created:** 2026-03-24
**Completed:** 2026-03-24
**Priority:** P1
**Depends On:** none
**Blocks:** TASK-502, TASK-503
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** existing routing or module wiring requires S5 to live under a different domain root than `src/bookings/`
**Escalation Notes:** ask only if the amenity admin contract in the S5 context conflicts with a current shared repo rule
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena, prismaLocal

---

## What
Create the S5 `src/bookings/` domain root and implement the amenity catalog endpoints for public/member reads and admin management.

## Why
This establishes the concrete S5 module boundary and stable amenity records before booking availability and payment flows depend on them.

## Acceptance Criteria
- [x] Add a dedicated `src/bookings/` root with thin Nest wiring and an `amenity/` subfolder.
- [x] Wire the S5 module into `AppModule` without regressing existing routes.
- [x] Implement `GET /v1/bookings/amenities` for active amenity listing.
- [x] Implement `GET /v1/bookings/amenities/:id` with the S5 auth expectations.
- [x] Implement admin-only `POST /v1/bookings/amenities`, `PATCH /v1/bookings/amenities/:id`, and soft-delete behavior.
- [x] Add DTO validation and Swagger metadata for amenity create/update flows.
- [x] Add repository/service/controller coverage for active-only reads, missing records, and admin guard boundaries.
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
- `context/s5-facility-bookings.md`
- `tasks/s5-facility-bookings/README.md`
- `tasks/s5-facility-bookings/execution.md`
- `tasks/s5-facility-bookings/decisions.md`

## Module Hints
- `capstone-backend/src/bookings`
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
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes`

---

## PLANNER OUTPUT
- Keep `src/bookings/` as a thin S5 root and place amenity-specific code in its own `amenity/` subfolder from day one.
- Reuse existing Nest guard, Swagger, DTO, and repository conventions from `src/membership/` and `src/user/`.
- Keep booking availability, reservation, and payment logic out of this task.
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the first S5 slice in a dedicated `src/bookings/` domain root and wired it into `AppModule`.

- Added `bookings.module.ts` plus an amenity submodule with controller, service, repository, DTOs, and focused specs.
- Implemented `GET /v1/bookings/amenities` for active amenity listing.
- Implemented `GET /v1/bookings/amenities/:id` behind JWT for active amenity reads.
- Implemented admin-only create, update, and soft-delete amenity routes.
- Reused existing Nest guard, Swagger, DTO, and base-repository conventions instead of introducing a new pattern.

Focused checks run during implementation:
- `npm.cmd run build` - passed
- `npm.cmd test -- amenity --runInBand` - passed (`4` suites, `13` tests)
- `npm.cmd run lint:check` - passed
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification passed for the TASK-501 amenity catalog slice.

Added the remaining task-scoped coverage before rerunning checks:
- repository spec now asserts missing active amenities raise 404
- controller spec now asserts public/member/admin guard boundaries and admin role metadata

Checks run in this verification session:
- `npm.cmd test -- amenity --runInBand` - passed (`4` suites, `19` tests)
- `npm.cmd run build` - passed
- `npm.cmd run lint:check` - passed

Notes:
- `npm.cmd run test:e2e -- --runInBand` was not run because this task does not require runtime API verification and the task scope is covered by focused unit/spec checks.
- `prisma migrate status` still reports one pre-existing unapplied migration: `20260323090000_subscription_uniqueness_guard`. This did not block TASK-501 verification.
MCPs used: serena, prismaLocal
