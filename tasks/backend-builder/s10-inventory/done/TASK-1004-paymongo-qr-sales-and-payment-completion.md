# TASK-1004 - PayMongo QR Sales And Payment Completion
**Task ID:** TASK-1004
**Domain:** S10 - Inventory
**Status:** done
**Branch:** feat/TASK-1004-paymongo-qr-sales-and-payment-completion
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P1
**Depends On:** TASK-1001, TASK-1003
**Blocks:** TASK-1005, TASK-1006, TASK-1007
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the `SaleTransaction.payment_id` contract or the product-sale payment ownership shape needs a schema or product decision beyond the current S10 context
**Escalation Notes:** may require user input if the current polymorphic `payments` model cannot represent the intended sale linkage cleanly
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Extend S10 sales to support the PayMongo QR checkout path and finalize pending sales through the shared `payment.completed` event flow.

## Why
The repo already has a shared payment backbone and checkout helper, so S10 should reuse those seams for product sales instead of creating a second gateway integration pattern.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `POST /v1/inventory/sales` supports the PayMongo path with the required `Idempotency-Key` handling
- [x] Product-sale payment records reuse the shared `payments` backbone instead of inventing a parallel gateway table
- [x] Checkout creation uses the existing PayMongo checkout helper and returns the expected sale/payment response
- [x] Pending product sales transition to completed on the shared `payment.completed` event
- [x] Stock decrement for PayMongo sales happens on successful completion rather than at pending-creation time
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
- `context/s10-inventory.md`
- `tasks/s10-inventory/README.md`
- `tasks/s10-inventory/execution.md`
- `tasks/s10-inventory/decisions.md`

## Module Hints
- `capstone-backend/src/common`
- `capstone-backend/src/membership`
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
The repo already exposes the right shared seams for PayMongo checkout creation, idempotency handling, and `payment.completed` consumers. The main risk is contract alignment between the generic `payments` model and the S10 `SaleTransaction.payment_id` field, so this task should pause if the current context cannot justify one safe mapping.

Implementation plan:
- reuse the shared payment repository/service and PayMongo checkout helper for product sales
- normalize and validate `Idempotency-Key` the same way other payment-initiating domains already do
- route successful completion through the shared `payment.completed` event and let S10 own the sale-finalization logic
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the PayMongo inventory-sale path by extending the S10 sales contract to carry an explicit `customer_user_id` for shared payment ownership. The schema now records that owner on `sale_transactions`, and the new migration `20260327062756_s10_product_sale_customer_owner` adds the nullable foreign key plus index.

Code changes:
- updated `CreateSaleDTO` and sale response DTOs to support `customer_user_id` and a dedicated checkout response payload
- added `Idempotency-Key` Swagger/header handling on `POST /v1/inventory/sales`
- reused `PaymentRepository` and `PaymongoCheckoutService` from the shared membership payment backbone
- added `createPendingPaymongoSale()` and `completePendingPaymongoSale()` so PayMongo sales stay `pending` until `payment.completed`
- added an inventory-side `payment.completed` listener that finalizes product sales and decrements stock only on successful completion
- kept the existing cash path intact while allowing optional `customer_user_id` persistence there too
- corrected the generated Prisma migration so it only adds the intended S10 sale-owner field instead of dropping unrelated raw-SQL guard indexes

Files touched:
- `context/s10-inventory.md`
- `capstone-backend/prisma/schema.prisma`
- `capstone-backend/prisma/migrations/20260327062756_s10_product_sale_customer_owner/migration.sql`
- `capstone-backend/src/inventory/sales/dto/sales.dto.ts`
- `capstone-backend/src/inventory/sales/sales.controller.ts`
- `capstone-backend/src/inventory/sales/sales.module.ts`
- `capstone-backend/src/inventory/sales/sales.repository.ts`
- `capstone-backend/src/inventory/sales/sales.service.ts`
- `tasks/s10-inventory/decisions.md`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed after regenerating the Prisma client for the new sale-owner field, correcting the migration contents, and resetting the local development database to the cleaned migration history.

Passed:
- `npm.cmd run build`
- `npm.cmd test -- --runInBand sales`
- `npm.cmd run lint:check`
- Prisma migrate status check confirms the database schema is up to date after applying `20260327062756_s10_product_sale_customer_owner`
- local dev database reset and replayed all migrations cleanly via Prisma Local after removing unrelated index drops from the new migration

Focused coverage added/updated:
- `capstone-backend/src/inventory/sales/dto/sales.dto.spec.ts`
- `capstone-backend/src/inventory/sales/sales.controller.spec.ts`
- `capstone-backend/src/inventory/sales/sales.repository.spec.ts`
- `capstone-backend/src/inventory/sales/sales.service.spec.ts`

Not run in this task:
- `npm.cmd run test:e2e -- --runInBand`
- full repo unit test suite outside the `sales` matcher

MCPs used: serena, prismaLocal
