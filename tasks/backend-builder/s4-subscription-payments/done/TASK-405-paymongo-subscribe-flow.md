# TASK-405 - PayMongo Subscribe Flow
**Domain:** S4 - Subscription & Payments
**Status:** done
**Branch:** feat/TASK-405-paymongo-subscribe-flow
**Created:** 2026-03-22
**Completed:** 2026-03-24
**Auto-Eligible:** no
**Stop If:** provider flow details, idempotency contract, or subscribe semantics need product confirmation
**Escalation Notes:** requires explicit user input for non-binary or high-impact provider decisions before implementation

---

## What
Implement member subscription initiation with PayMongo checkout-link creation and idempotency handling.

## Why
This is the main paid subscription entry point and unlocks the full S4 purchase path used by members.

## Acceptance Criteria
- [x] Implement `POST /v1/membership/subscribe` with `CreateSubscriptionDTO`.
- [x] Require and validate the `Idempotency-Key` header for this endpoint.
- [x] Prevent duplicate active or pending subscriptions before creating a new pending subscription.
- [x] Create linked `Subscription` and `Payment` records for PayMongo checkout initiation.
- [x] Create and return a PayMongo checkout URL and persist `provider_ref`.
- [x] Move the payment to `processing` when checkout creation succeeds.
- [x] Reuse the shared payment model and do not duplicate manual-payment logic.
- [x] Add unit tests for idempotency handling and duplicate-subscription rejection paths.
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
- This task should assume `TASK-401`, `TASK-403`, and `TASK-404` are already merged.
- Keep the PayMongo client integration behind a service boundary so webhook handling can share provider helpers later.
- Activation after successful payment should be event-driven where possible, not embedded directly in subscribe response logic.

---

## CODER OUTPUT
- Added `POST /v1/membership/subscribe` with `CreateSubscriptionDTO`, `Idempotency-Key` header handling, and Swagger metadata in the subscription controller.
- Added transactional subscription initiation that creates the pending `Subscription` and linked pending `Payment` together before starting gateway checkout.
- Added `PaymongoCheckoutService` as the payment-provider boundary and wired PayMongo config via `ConfigModule`.
- Persisted the checkout session id to `payments.provider_ref`, cached checkout metadata in `payments.gateway_metadata`, and resumed idempotent retries from the existing payment record.
- Added an event-driven subscription activation handler on `payment.completed` so approved manual payments and future gateway webhooks converge on the same activation path.

---

## TESTER REPORT
- `npm.cmd run build` passed.
- `npm.cmd run lint` passed.
- `npm.cmd test -- subscription --runInBand` passed.
- `npm.cmd test -- payment --runInBand` passed.
- `npm.cmd test -- paymongo-checkout --runInBand` passed.
- Verified focused coverage for duplicate-subscription rejection, idempotency-key validation, retry reuse of an existing checkout URL, and provider boundary behavior.
