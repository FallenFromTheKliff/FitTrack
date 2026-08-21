# TASK-502 - Availability And Reservation Core
**Task ID:** TASK-502
**Domain:** S5 - Facility Bookings
**Status:** done
**Branch:** feat/TASK-502-availability-and-reservation-core
**Created:** 2026-03-24
**Completed:** 2026-03-24
**Priority:** P1
**Depends On:** TASK-501
**Blocks:** TASK-503
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** slot granularity or overlap rules differ from the S5 context's 30-minute model
**Escalation Notes:** ask only if availability rules cannot be implemented with the current amenity capacity and booking status model
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena, prismaLocal

---

## What
Implement the booking repository and service core for availability calculations, overlap checks, and capacity-aware reservation queries.

## Why
Availability and conflict detection are the foundation for every create, cancel, lifecycle, and payment flow in S5.

## Acceptance Criteria
- [x] Add a `booking/` subfolder under `src/bookings/` with repository and service scaffolding.
- [x] Implement `GET /v1/bookings/amenities/availability` using the S5 query contract.
- [x] Return 30-minute slots for the requested date with `available=true/false` based on booking overlap and amenity capacity.
- [x] Add repository helpers for overlap detection, capacity counts, and ownership-safe booking lookups.
- [x] Exclude cancelled, completed, and no-show bookings from active-capacity checks where appropriate.
- [x] Add tests for fully booked, partially available, invalid date, and inactive/missing amenity cases.
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
- Keep this task focused on booking read-side calculations and repository contracts.
- Reuse base-repository patterns for ownership-safe record access instead of putting Prisma logic in controllers or ad hoc services.
- Leave payment initiation and Redis locking for the next slice.
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S5 availability core in a dedicated `booking/` subfolder without pulling in payment or Redis concerns from later slices.

- Added `booking.controller.ts`, `booking.service.ts`, `booking.repository.ts`, and `dto/availability.dto.ts`.
- Implemented JWT-protected `GET /v1/bookings/amenities/availability`.
- Added repository helpers for overlapping active booking reads, capacity counts, and ownership-safe booking lookups.
- Kept active-capacity logic scoped to `pending`, `confirmed`, and `balance_pending`, so cancelled, completed, and no-show bookings do not block slots.
- Generated 48 half-hour availability slots per requested date and reused the existing active amenity lookup for missing/inactive amenity handling.

Focused checks run during implementation:
- `npm.cmd test -- bookings --runInBand` - passed (`8` suites, `31` tests)
- `npm.cmd run build` - passed
- `npm.cmd run lint:check` - passed
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification passed for the TASK-502 availability core.

Coverage now includes:
- fully booked slot windows
- partially available slot windows when capacity remains
- invalid calendar dates
- inactive or missing amenity lookups
- controller JWT guard wiring
- repository overlap/count helper contracts

Checks run in this verification session:
- `npm.cmd test -- bookings --runInBand` - passed (`8` suites, `31` tests)
- `npm.cmd run build` - passed
- `npm.cmd run lint:check` - passed

Notes:
- `npm.cmd run test:e2e -- --runInBand` was not run because this task does not require runtime API verification and the task scope is covered by focused unit/spec checks.
MCPs used: serena, prismaLocal
