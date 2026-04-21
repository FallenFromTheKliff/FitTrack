# TASK-507 - S5 E2E And Integration Coverage
**Task ID:** TASK-507
**Domain:** S5 - Facility Bookings
**Status:** done
**Branch:** feat/TASK-507-s5-e2e-and-integration-coverage
**Created:** 2026-03-24
**Completed:** 2026-03-24
**Priority:** P1
**Depends On:** TASK-501, TASK-502, TASK-503, TASK-504, TASK-505, TASK-506
**Blocks:** TASK-508
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** realistic coverage would require live external-provider behavior that cannot be isolated behind current test seams
**Escalation Notes:** ask only if the remaining confidence gaps need a product decision or non-local dependency to proceed
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena, prismaLocal

---

## What
Add integration and end-to-end coverage for the completed S5 facility-booking flows.

## Why
S5 spans bookings, payments, subscription gates, lifecycle queues, and notifications, so code-level confidence needs more than isolated unit tests.

## Acceptance Criteria
- [x] Add e2e coverage for amenity catalog reads and admin amenity management.
- [x] Add coverage for availability, booking creation, booking history, and cancellation.
- [x] Add integration coverage for booking confirmation/completion via shared `payment.completed` events.
- [x] Add practical coverage for lifecycle job outcomes that can be simulated locally.
- [x] Document any remaining gaps that still require runtime or provider-level verification.
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
- `capstone-backend/src/membership/payment`
- `capstone-backend/test`

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
- Follow the S4 confidence strategy: use real HTTP/e2e tests for controller contracts and targeted integration tests for event-driven booking completion.
- Prefer a few realistic path-covering scenarios over shallow mocks across every endpoint.
- Keep the final live-route verification separate in `TASK-508`.
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
- Added a dedicated S5 controller e2e suite in `capstone-backend/test/bookings.e2e-spec.ts` covering public amenity catalog reads, JWT/admin/staff guard boundaries, amenity admin CRUD, availability, booking creation, member booking history, cancellation, and balance collection.
- Added `booking-payment.integration.spec.ts` to exercise booking confirmation and booking completion through the shared `payment.completed` event bus instead of direct service calls.
- Added `booking-lifecycle.integration.spec.ts` to exercise `booking.confirmed` and `booking.cancelled` event listeners against the real Nest event bus and queued lifecycle/notification side effects.
- Fixed a real route-order bug by registering `BookingController` before `AmenityController` in `src/bookings/bookings.module.ts`, so `/v1/bookings/amenities/availability` is no longer shadowed by the dynamic `/v1/bookings/amenities/:id` route.
- Remaining runtime/provider gaps intentionally deferred to `TASK-508`: live Swagger/runtime contract verification, real PayMongo/provider behavior, and environment-backed queue/Redis interactions.
MCPs used: serena, prismaLocal

---

## TESTER REPORT
- Verification passed for the TASK-507 slice.
- Confirmed S5 now has real HTTP/e2e coverage for amenity and booking routes plus event-bus integration coverage for booking payment completion and lifecycle listeners.
- Confirmed the availability route collision found during e2e execution is fixed in the runtime module wiring.
- Checks run:
  - `npm.cmd run build`
  - `npm.cmd test -- --runInBand`
  - `npm.cmd run test:e2e -- --runInBand`
  - `npm.cmd run lint:check`
- Runtime API verification was not run in this task because `Needs Runtime API Verification: no`; the remaining live-route verification work is queued in `TASK-508`.
MCPs used: serena, prismaLocal
