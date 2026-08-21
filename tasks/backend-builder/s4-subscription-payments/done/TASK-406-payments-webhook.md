# TASK-406 - Payments Webhook
**Domain:** S4 - Subscription & Payments
**Status:** done
**Branch:** feat/TASK-406-payments-webhook
**Created:** 2026-03-22
**Completed:** 2026-03-24
**Auto-Eligible:** no
**Stop If:** webhook signature, raw-body handling, or event semantics are ambiguous
**Escalation Notes:** requires explicit user input for provider-specific webhook behavior that is not already decision-complete

---

## What
Implement the public PayMongo webhook endpoint, signature verification, deduplication, and payment-completed handling.

## Why
This is the asynchronous confirmation path that actually marks gateway payments complete and activates subscriptions.

## Acceptance Criteria
- [x] Implement `POST /v1/payments/webhook`.
- [x] Verify webhook authenticity using the configured provider signature mechanism before processing events.
- [x] Deduplicate events using `gateway_event_id`.
- [x] Update the matching payment to `completed` and persist gateway metadata on successful payment events.
- [x] Emit or handle the payment-completed event that activates the pending subscription and fills `starts_at`, `expires_at`, and `payment_id`.
- [x] Return success for already-processed events without duplicating side effects.
- [x] Add unit tests for signature failure, duplicate events, and successful completion.
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
- This task depends on shared payment core and PayMongo subscribe scaffolding existing first.
- Treat raw request body handling as an explicit requirement if provider signature verification needs the unparsed payload.
- Keep webhook responses idempotent and side effects single-fired.

---

## CODER OUTPUT
- Added a public `POST /v1/payments/webhook` controller that accepts `Paymongo-Signature`, reads the raw request body, and acknowledges successful deliveries with a JSON success payload.
- Enabled Nest raw-body capture in bootstrap and extended PayMongo config with webhook-secret and signature-tolerance settings.
- Added `PaymongoWebhookService` to parse the signed header, validate the timestamp window, verify the HMAC digest, and parse the event payload.
- Updated `PaymentService` and `PaymentRepository` to deduplicate on `gateway_event_id`, resolve the payment by the checkout-session `provider_ref`, persist webhook metadata, mark the payment completed, and reuse the existing `payment.completed` event path.

---

## TESTER REPORT
- `npm.cmd run build` passed.
- `npm.cmd run lint` passed.
- `npm.cmd test -- payment --runInBand` passed.
- `npm.cmd test -- paymongo-webhook --runInBand` passed.
- `npm.cmd test -- subscription --runInBand` passed.
- `npm.cmd test -- paymongo-checkout --runInBand` passed.
- Verified signature failure, duplicate-event acknowledgement, and successful payment-completion handling.
