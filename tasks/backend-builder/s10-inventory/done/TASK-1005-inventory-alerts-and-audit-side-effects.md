# TASK-1005 - Inventory Alerts And Audit Side Effects
**Task ID:** TASK-1005
**Domain:** S10 - Inventory
**Status:** done
**Branch:** feat/TASK-1005-inventory-alerts-and-audit-side-effects
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P2
**Depends On:** TASK-1002, TASK-1003, TASK-1004
**Blocks:** TASK-1006, TASK-1007
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the low-stock dedup window or the audit payload shape needs a product decision beyond the current S10 context
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Wire the finished inventory core flows into low-stock alerts, queue-backed admin mail delivery, and audit/event emission.

## Why
The repo already has queue and audit infrastructure, and S10 should reuse those cross-cutting seams after its core write paths are stable instead of baking side effects into early CRUD work.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Low-stock checks update `last_low_stock_alert_at` and avoid duplicate alerts inside the intended cooldown window
- [x] Completed sales trigger the low-stock alert path only after stock changes are committed
- [x] Equipment write-offs emit the inventory audit/event side effect using the existing audit seam
- [x] Product restocks emit the intended audit/event side effect using the existing audit seam
- [x] Admin alert delivery reuses the existing queue/mail infrastructure instead of a new direct-send pattern
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
- `capstone-backend/src/audit`
- `capstone-backend/src/mail`
- `capstone-backend/src/queue`
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
This slice intentionally waits until both equipment and sale flows exist so side effects can be attached to stable business transitions instead of placeholder endpoints. The repo already has audit constants and queue-backed mail patterns that should be reused directly.

Implementation plan:
- implement one inventory-owned alert/event seam for low-stock signals and connect it to existing queue-backed mail delivery
- emit S10 audit events from restock and write-off mutations after the underlying state commits
- keep side effects post-commit and out of controllers to stay aligned with the repo’s transaction-and-side-effect rules
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S10 side-effect slice by adding an inventory lifecycle layer that owns low-stock cooldown stamping and queued admin alerts after stock-changing sale commits. Cash sales and completed PayMongo sales now emit `inventory.product.stock-changed`, equipment write-offs emit `inventory.equipment.write-off`, and restocks/write-offs emit inventory audit events through the existing `audit.log` seam.

Code changes:
- added `inventory-lifecycle.repository.ts` and `inventory-lifecycle.service.ts`
- added `events/product-stock-changed.event.ts` and `events/equipment-write-off.event.ts`
- wired `RetailProductService.restockProduct()` to emit `PRODUCT_RESTOCKED`
- wired `EquipmentService.writeOffEquipment()` to emit `EQUIPMENT_WRITEOFF` plus the inventory write-off event
- wired `SalesService` to emit post-commit stock-change events for cash sales and completed PayMongo sales
- reused `QUEUE_MAIL` with generic mail jobs for admin alerts and the existing `last_low_stock_alert_at` field for dedup

Files touched:
- `capstone-backend/src/inventory/inventory.module.ts`
- `capstone-backend/src/inventory/inventory-lifecycle.repository.ts`
- `capstone-backend/src/inventory/inventory-lifecycle.service.ts`
- `capstone-backend/src/inventory/events/product-stock-changed.event.ts`
- `capstone-backend/src/inventory/events/equipment-write-off.event.ts`
- `capstone-backend/src/inventory/retail-product/retail-product.controller.ts`
- `capstone-backend/src/inventory/retail-product/retail-product.repository.ts`
- `capstone-backend/src/inventory/retail-product/retail-product.service.ts`
- `capstone-backend/src/inventory/equipment/equipment.repository.ts`
- `capstone-backend/src/inventory/equipment/equipment.service.ts`
- `capstone-backend/src/inventory/sales/sales.service.ts`
- `tasks/s10-inventory/decisions.md`

MCPs used: prismaLocal

---

## TESTER REPORT
Verification passed for the inventory slice after wiring the lifecycle side effects.

Passed:
- `npm.cmd run build`
- `npm.cmd test -- --runInBand inventory`
- `npm.cmd run lint:check`

Focused coverage added or updated:
- `capstone-backend/src/inventory/inventory-lifecycle.service.spec.ts`
- `capstone-backend/src/inventory/retail-product/retail-product.controller.spec.ts`
- `capstone-backend/src/inventory/retail-product/retail-product.service.spec.ts`
- `capstone-backend/src/inventory/equipment/equipment.repository.spec.ts`
- `capstone-backend/src/inventory/equipment/equipment.service.spec.ts`
- `capstone-backend/src/inventory/sales/sales.service.spec.ts`

Not run in this task:
- `npm.cmd run test:e2e -- --runInBand`
- full repo unit suite outside the `inventory` matcher

MCPs used: prismaLocal
