# TASK-404 - Payments Core Manual Flow
**Domain:** S4 - Subscription & Payments
**Status:** done
**Branch:** feat/TASK-404-payments-core-manual-flow
**Created:** 2026-03-22
**Completed:** 2026-03-23
**Auto-Eligible:** yes
**Stop If:** payment provider choice or file-upload contract becomes required during this task
**Escalation Notes:** ask only if manual-payment flow can no longer stay gateway-agnostic or if screenshot handling requires a new product or API decision

---

## What
Implement the shared payments module slice for querying payments, submitting manual payments, and verifying manual payments.

## Why
This creates the reusable payment backbone for S4 and later domains before gateway-specific work is added.

## Acceptance Criteria
- [x] Implement `GET /v1/payments/my` for authenticated users with date-range filtering.
- [x] Implement `GET /v1/payments/:id` with ownership and role-aware access rules.
- [x] Implement `GET /v1/payments` for admin/staff with `PaymentFilterDTO`.
- [x] Implement `POST /v1/payments/manual` with `ManualPaymentDTO`.
- [x] Implement `PATCH /v1/payments/:id/verify` with approve and reject paths.
- [x] Verification updates `status`, `verified_by`, `verified_at`, and `rejection_reason` correctly.
- [x] Emit `PAYMENT_VERIFIED` audit events and a payment-completed domain event on approval.
- [x] Add DTO and service tests for manual payment submission and verification rules.
- [x] Unit tests pass (`npm run test src/[module]`)
- [x] Lint passes (`npm run lint`)
- [x] No `any` types used
- [x] No secret fields in responses (password, credential_hash, token_hash)
- [x] Swagger decorators applied

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s4-subscription-payments.md`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - STOP, split into 2 tasks first

---

## PLANNER OUTPUT
- Keep this task gateway-agnostic. Manual payments and general payment reads come first.
- Define clear internal events now so `TASK-405` and `TASK-406` can reuse the same payment-completed subscription activation path.
- Coordinate carefully with `TASK-407` so screenshot URLs are accepted here even if file upload is implemented separately.

---

## CODER OUTPUT
Implemented the gateway-agnostic payments slice inside `src/membership/`:
- added `payments.controller.ts`, `payments.service.ts`, and `payments.repository.ts`
- added `dto/payments.dto.ts` and `events/payment-completed.event.ts`
- wired the payments providers/controllers into `membership.module.ts`
- documented the Payments Swagger tag in `main.ts`

Behavior included:
- member payment history via `GET /v1/payments/my`
- ownership-aware single payment reads via `GET /v1/payments/:id`
- admin/staff payment queue reads via `GET /v1/payments`
- manual cash payment submission via `POST /v1/payments/manual`
- manual approval/rejection via `PATCH /v1/payments/:id/verify`

Notable implementation details:
- manual payments stay gateway-agnostic and reuse screenshot URLs from the future shared files endpoint
- manual subscription payments resolve the payment owner from the target subscription
- members can submit manual payments only for their own subscription records; admin/staff can submit on behalf of members
- approval emits both `PAYMENT_VERIFIED` audit events and the shared `payment.completed` domain event for later subscription activation work

---

## TESTER REPORT
Verification completed on 2026-03-23.

Checks run:
- `npm.cmd run build` - passed
- `npm.cmd test -- payments --runInBand` - passed (`3` suites, `11` tests)
- `npm.cmd run lint` - passed with pre-existing warnings outside S4 only

Notes:
- repo lint warnings remain in `src/auth/auth.controller.spec.ts` and `src/common/base-repository/base-repository.spec.ts`
- no new TASK-404 lint errors remained after the payments slice cleanup
