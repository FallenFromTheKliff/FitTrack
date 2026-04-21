# TASK-503 - Booking Creation And PayMongo Confirmation
**Task ID:** TASK-503
**Domain:** S5 - Facility Bookings
**Status:** done
**Branch:** feat/TASK-503-booking-creation-and-paymongo-confirmation
**Created:** 2026-03-24
**Completed:** 2026-03-24
**Priority:** P1
**Depends On:** TASK-501, TASK-502
**Blocks:** TASK-504, TASK-505
**Auto-Eligible:** no
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** supporting `provider=cash` would require a public contract change or a second write flow outside the current S5 design
**Escalation Notes:** ask only if the booking-create API cannot safely ship with `free + paymongo` first while `cash` completes in a later S5 slice
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena, prismaLocal

---

## What
Implement booking creation, Redis slot locking, free-booking confirmation, PayMongo downpayment initiation, and booking confirmation on shared payment completion.

## Why
This is the first end-to-end reservation slice that turns S5 from catalog/availability into a real payable booking flow.

## Acceptance Criteria
- [x] Implement `POST /v1/bookings/amenity` with `Idempotency-Key` handling.
- [x] Enforce active-subscription access when an amenity requires subscription.
- [x] Compute `total_amount`, `downpayment_amount`, and `balance_amount` from the booking duration and hourly rate.
- [x] Use Redis slot locks plus database overlap/capacity checks to prevent double booking.
- [x] Confirm zero-cost bookings immediately with zeroed payment amounts.
- [x] For PayMongo bookings, create or resume the booking downpayment payment and return checkout details.
- [x] Add a booking payment-completion handler that moves qualifying bookings to `confirmed` and sets `downpayment_paid_at`.
- [x] Add tests for subscription-required denial, lock/conflict behavior, free-booking shortcut, and PayMongo initiation/idempotency.
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
- `capstone-backend/src/membership/subscription`
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
- Keep this slice scoped to `free + paymongo` booking initiation. The current shared payment service still rejects booking manual payments, so `provider=cash` should remain a planned follow-up in `TASK-505` unless the user explicitly wants to broaden scope now.
- Extend `src/bookings/booking/` with `CreateBookingDTO`, a checkout response DTO, controller wiring for `POST /v1/bookings/amenity`, and service methods for idempotency validation, amount calculation, slot-key generation, Redis lock acquire/release, and payment-completion handling.
- Reuse `SubscriptionService.hasSubscriptionAccess()` for subscription-gated amenities and mirror the existing subscription idempotency pattern: validate `Idempotency-Key`, check `PaymentRepository.findPaymentByIdempotencyKey()`, resume only matching booking PayMongo attempts, and reject cross-owner/provider collisions with 409s.
- Add repository methods for a transactional booking-initiation path: lock-safe overlap/capacity recheck, pending booking insert, free-booking immediate confirmation, and pending booking + payment creation for PayMongo downpayments. Reuse the current active-capacity booking statuses and do not duplicate Prisma logic in controllers or ad hoc services.
- Reuse `PaymongoCheckoutService.createCheckoutSession()` and `PaymentRepository.updatePayment()` to persist provider refs and checkout metadata, using booking-specific metadata keys (`payment_id`, `booking_id`) so webhook completion can map back cleanly.
- Add a `@OnEvent(PAYMENT_COMPLETED_EVENT)` consumer in the bookings layer that ignores non-booking payments, confirms only pending booking downpayments, and sets `downpayment_paid_at` without duplicating subscription behavior.
- Tests should cover: unsupported subscription-gated booking attempts, invalid/missing idempotency key, Redis lock conflict with lock release on failure, DB overlap/capacity conflict after lock acquisition, free-booking shortcut, PayMongo checkout creation/resume, and booking confirmation on shared payment completion.
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the first end-to-end S5 booking-create flow with the scoped `free + paymongo` boundary from planning.

- Added `CreateBookingDTO` plus a unified booking checkout response DTO.
- Implemented JWT-protected `POST /v1/bookings/amenity` with `Idempotency-Key` handling.
- Reused `SubscriptionService.hasSubscriptionAccess()` for subscription-gated amenities.
- Added Redis slot locking, transactional overlap/capacity checks, amount calculation, free-booking immediate confirmation, and PayMongo checkout initiation/resume.
- Added a shared `payment.completed` booking consumer that confirms pending booking downpayments and stamps `downpayment_paid_at`.
- Reused exported membership payment infrastructure instead of adding a second booking-specific checkout stack.

Focused checks run during implementation:
- `npm.cmd test -- bookings --runInBand` - passed (`9` suites, `43` tests)
- `npm.cmd run build` - passed
- `npm.cmd run lint:check` - passed
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification passed for the TASK-503 booking creation slice.

Coverage now includes:
- subscription-required denial
- invalid idempotency key rejection
- Redis lock conflict with partial lock cleanup
- DB overlap/capacity conflict cleanup path
- free-booking immediate confirmation
- PayMongo checkout initiation
- idempotent PayMongo checkout resume
- booking confirmation on shared payment completion

Checks run in this verification session:
- `npm.cmd test -- bookings --runInBand` - passed (`9` suites, `43` tests)
- `npm.cmd run build` - passed
- `npm.cmd run lint:check` - passed

Notes:
- `provider=cash` for paid booking initiation remains intentionally deferred to `TASK-505`.
- `npm.cmd run test:e2e -- --runInBand` was not run because this task does not require runtime API verification and the task scope is covered by focused unit/spec checks.
MCPs used: serena, prismaLocal
