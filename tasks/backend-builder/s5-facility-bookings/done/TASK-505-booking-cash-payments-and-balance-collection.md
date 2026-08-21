# TASK-505 - Booking Cash Payments And Balance Collection
**Task ID:** TASK-505
**Domain:** S5 - Facility Bookings
**Status:** done
**Branch:** feat/TASK-505-booking-cash-payments-and-balance-collection
**Created:** 2026-03-24
**Completed:** 2026-03-24
**Priority:** P1
**Depends On:** TASK-503, TASK-504
**Blocks:** TASK-506, TASK-507
**Auto-Eligible:** no
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** cash receipt capture or staff counter workflow cannot be represented safely with the current shared payment and S5 DTO contracts
**Escalation Notes:** ask only if the existing payment APIs and DTO contracts cannot support the required booking cash flow without a product-level contract change
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena, prismaLocal

---

## What
Extend the shared payment layer for booking cash/manual payments and implement the on-arrival balance collection flow.

## Why
S5 is not complete until booking downpayments and remaining balances can be collected across both PayMongo and cash/manual paths.

## Acceptance Criteria
- [x] Extend payment ownership/context resolution so booking payments can be submitted and verified safely.
- [x] Preserve existing subscription payment behavior while adding booking payment support.
- [x] Implement `POST /v1/bookings/amenity/:id/balance` for staff balance collection.
- [x] Enforce timing and state rules before a balance payment can be started.
- [x] Create booking balance payments for PayMongo or cash/manual collection as allowed by the S5 contract.
- [x] Complete bookings on shared `payment.completed` events and set `balance_paid_at` correctly.
- [x] Add tests for unsupported states, ownership/role boundaries, and successful booking completion.
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
- Reuse the existing generic `payment.completed` event path so booking balance completion follows the same finalization pattern as booking downpayment confirmation instead of adding a booking-only payment completion channel.
- Keep the shared `payment.completed` payload stable; determine whether a completed booking payment is `downpayment` or `balance` by loading the payment record from `paymentId` inside the booking consumer instead of widening the event contract.
- Extend `PaymentService.resolvePaymentOwnerId()` and related repository lookups to accept `PayableType.booking` safely by resolving the owning user from the booking record while leaving subscription behavior unchanged.
- Reuse the exported `PaymentService` from `MembershipModule` for booking cash/manual payment creation where possible so ownership checks, verification flow, audit emission, and subscription behavior stay centralized.
- Add a booking-owned balance initiation path under `src/bookings` for `POST /v1/bookings/amenity/:id/balance`, with staff-only access, explicit booking state checks, and provider handling limited to the current S5 contract (`paymongo` or `cash`).
- Reuse `BookingCheckoutResponseDTO` for the balance endpoint so both downpayment initiation and balance initiation return the same `{ booking_id, status, checkout_url }` shape, with `checkout_url: null` for cash/manual cases.
- Treat this task as booking-specific orchestration on top of the existing shared payment module: create or resume booking balance payments, set `payment_stage` for balance collection, and avoid widening the shared payment API unless the current DTO contracts truly cannot represent the booking flow.
- Treat the current `ManualPaymentDTO` as sufficient for booking cash collection because it already captures `payable_type`, `payable_id`, `payment_stage`, `amount`, `screenshot_url`, and `reference_no`; do not add a second booking-specific cash DTO unless implementation exposes a real gap.
- Update booking payment-completion handling so a completed balance payment moves the booking from `balance_pending` to `completed` and stamps `balance_paid_at`, while downpayment completion behavior from `TASK-503` remains intact.
- Add tests around unsupported booking states, staff/member boundaries, booking manual-payment ownership resolution, and successful booking completion for both verification and webhook-complete paths.
- Stop and ask before implementation only if the existing payment DTOs cannot safely express the cashier flow without a product-level API contract change.
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
- Extended the shared payment repository and service so booking manual payments resolve ownership correctly without changing subscription behavior.
- Added `POST /v1/bookings/amenity/:id/balance` with a booking-specific balance DTO, admin/staff guard coverage, booking balance state checks, and unified checkout/manual response handling.
- Added booking repository and service support for creating balance payments, resuming in-flight attempts, and completing bookings when a balance payment finishes.
- Kept the shared `payment.completed` event payload stable by resolving booking payment stage from `paymentId` inside the booking consumer.
- Updated focused DTO, controller, repository, service, and payment specs to cover booking manual-payment support, balance initiation, and balance completion.
- Checks run:
  - `npm.cmd test -- booking --runInBand`
  - `npm.cmd test -- payment.service --runInBand`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
MCPs used: serena, prismaLocal

---

## TESTER REPORT
- Verification passed for the TASK-505 slice.
- Confirmed booking balance initiation coverage for PayMongo and cash/manual flows, plus balance completion on shared payment events.
- Confirmed booking manual-payment ownership resolution now supports `PayableType.booking` while existing subscription tests still pass.
- Checks run:
  - `npm.cmd test -- booking --runInBand`
  - `npm.cmd test -- payment.service --runInBand`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`
- `npm.cmd run test:e2e -- --runInBand` was not run for this task.
MCPs used: serena, prismaLocal
