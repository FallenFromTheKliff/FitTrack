# TASK-1003 - Cash POS Sales And Sale Reads
**Task ID:** TASK-1003
**Domain:** S10 - Inventory
**Status:** done
**Branch:** feat/TASK-1003-cash-pos-sales-and-sale-reads
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P1
**Depends On:** TASK-1001
**Blocks:** TASK-1004, TASK-1005, TASK-1006, TASK-1007
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the insufficient-stock rule cannot be resolved safely from the current S10 context because the flow text says both `throw 422` and that the sale is still allowed
**Escalation Notes:** likely needs a product decision if cash sales should reject or merely warn on low stock
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Implement the cash sale transaction flow plus the admin/staff sale list and detail reads.

## Why
This creates the core point-of-sale transaction model and stock-decrement behavior that the later PayMongo completion path should reuse rather than duplicate.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `POST /v1/inventory/sales` supports the cash path for staff users
- [x] `GET /v1/inventory/sales` and `GET /v1/inventory/sales/:id` are implemented for admin/staff
- [x] Sale creation snapshots unit prices, subtotals, and total amount correctly
- [x] Stock mutations and sale-item writes are transactional
- [x] The insufficient-stock business rule is implemented consistently and documented in the task output
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
This slice should build the reusable sale transaction backbone before PayMongo checkout work starts. The main planning risk is the contradictory insufficient-stock note in the S10 context, so the task is intentionally marked not auto-eligible and should stop if the repo context does not clearly support a safe default.

Implementation plan:
- add sale DTOs, repository methods, and controller/service routes for cash sales plus sale reads
- keep the sale write path transactional around stock decrement, sale creation, and sale-item snapshot writes
- defer PayMongo checkout creation and `payment.completed` handling to `TASK-1004`
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S10 cash-sale slice under `capstone-backend/src/inventory/sales` and wired it into the inventory module. The new controller/service/repository/DTO flow now covers:
- `POST /v1/inventory/sales`
- `GET /v1/inventory/sales`
- `GET /v1/inventory/sales/:id`

Implementation notes:
- added a dedicated sales submodule with thin controller routes, response DTOs, and repository-owned transaction handling
- restricted sale creation to staff users and sale reads to admin/staff users
- implemented cash-only sale creation for this slice and returns `422` when `payment_method = paymongo` because checkout support is deferred to `TASK-1004`
- enforced the approved stock rule: requested quantity above current stock returns `422` and creates no sale
- snapshots `unit_price`, `subtotal`, and `total_amount` at sale time and decrements stock in the same transaction
- deferred shared payment/idempotency wiring for product sales because the current shared `payments.user_id` contract does not cleanly fit walk-in product sales
- added focused DTO, controller, service, and repository specs for the new sales surface

Commands run:
- `npm.cmd run build`
- `npm.cmd test -- --runInBand sales`
- `npm.cmd run lint:check`

Result:
- all commands above passed
- full repo unit suite and e2e suite were not run in this implement phase
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification pass completed against the sales slice added in this task. I rechecked the new `/v1/inventory/sales*` controller, DTOs, service mapping, repository transaction behavior, and focused specs.

Commands run:
- `npm.cmd run build`
- `npm.cmd test -- --runInBand sales`
- `npm.cmd run lint:check`

Result:
- all commands above passed
- focused sales test suites passed: 4 suites, 17 tests
- no additional code changes were needed during test phase beyond style/type cleanup in the new files
- full repo unit suite and e2e suite were not run for this task-close pass
MCPs used: serena, prismaLocal
