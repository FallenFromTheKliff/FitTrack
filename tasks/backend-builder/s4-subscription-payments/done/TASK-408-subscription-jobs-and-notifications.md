# TASK-408 - Subscription Jobs And Notifications
**Domain:** S4 - Subscription & Payments
**Status:** done
**Branch:** feat/TASK-408-subscription-jobs-and-notifications
**Created:** 2026-03-22
**Completed:** 2026-03-24
**Auto-Eligible:** yes
**Stop If:** reminder semantics or notification-channel behavior conflicts with current queue or mail patterns
**Escalation Notes:** ask only if the existing Bull and mail conventions are insufficient for the required reminder flows

---

## What
Implement subscription warning and expiry jobs plus S4 notification and email side effects.

## Why
The subscription lifecycle is incomplete without warnings, expiry transitions, and receipt or reminder delivery.

## Acceptance Criteria
- [x] Implement the 7-day, 3-day, and 1-day warning flows from the domain context.
- [x] Implement expiry processing for subscriptions whose access window has ended.
- [x] Update warning timestamp fields so duplicate reminders are not sent.
- [x] Respect notification preference fields relevant to subscription-expiring and payment-confirmed communication.
- [x] Add queue jobs or mail templates needed for reminders and receipts using the repo's current queue pattern.
- [x] Emit the appropriate domain or audit side effects when expiry or cancellation notifications are sent.
- [x] Add unit tests for warning selection and expiry transition logic.
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
- Follow the repo's current Bull-based queue implementation even though older docs mention BullMQ.
- Separate pure subscription-selection logic from queue side effects so tests stay focused.
- This task should land after the core subscription and payment flows exist.

---

## CODER OUTPUT
Implemented the subscription lifecycle queue inside `src/membership/subscription/` using the repo's current Bull pattern.

- Added repeatable `subscription-warning` and `subscription-expiry` jobs plus a dedicated lifecycle processor and service.
- Added repository selection/update helpers for 7-day, 3-day, 1-day, and expiry transitions, including warning timestamp persistence and expiry-state updates.
- Reused the generic mail and SMS queues for warning, expiry, and payment-confirmed notifications while respecting `subscription_expiring_email`, `subscription_expiring_sms`, and `payment_confirmed_email`.
- Kept the activation side effect aligned with existing shared payment flow by listening to `payment.completed`.

---

## TESTER REPORT
Verified focused Task 408 coverage and project health for the touched slice.

- `npm.cmd run build` passed
- `npm.cmd run lint` passed
- `npm.cmd test -- subscription-lifecycle --runInBand` passed
- `npm.cmd test -- subscription --runInBand` passed
