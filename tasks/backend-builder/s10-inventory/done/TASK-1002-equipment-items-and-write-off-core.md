# TASK-1002 - Equipment Items And Write-Off Core
**Task ID:** TASK-1002
**Domain:** S10 - Inventory
**Status:** done
**Branch:** feat/TASK-1002-equipment-items-and-write-off-core
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P1
**Depends On:** TASK-1001
**Blocks:** TASK-1005, TASK-1006, TASK-1007
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** stop if the equipment detail response shape or write-off history requirements need a product decision beyond the current S10 context
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Implement the equipment-item CRUD and invariant-safe write-off core for the S10 equipment-tracking subdomain.

## Why
This isolates the non-payment half of S10 and unlocks later alert and audit side effects without coupling equipment work to sales behavior.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `GET /v1/inventory/equipment` and `GET /v1/inventory/equipment/:id` are implemented with pagination/history loading
- [x] `POST /v1/inventory/equipment` and `PATCH /v1/inventory/equipment/:id` are admin-only and validated
- [x] `POST /v1/inventory/equipment/:id/writeoff` enforces `quantity_set_to <= quantity_current`
- [x] `GET /v1/inventory/equipment/:id/writeoffs` returns paginated write-off history
- [x] Multi-write write-off behavior preserves `quantity_before`, `quantity_set_to`, and `quantity_lost` correctly
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
This slice keeps the equipment-tracking work independent from sales and payment complexity. It should reuse the same inventory module root from `TASK-1001`, but keep its own submodule, repository, DTOs, and controller paths so the domain structure stays aligned with the repo’s multi-module guidance.

Implementation plan:
- add the equipment submodule under `src/inventory/`
- implement equipment list/detail/admin writes first, then the write-off mutation and history read
- keep audit and admin-email side effects out of this slice so the invariant and persistence work stays isolated
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S10 equipment-tracking slice under `capstone-backend/src/inventory/equipment` and wired it into the shared inventory root. The new controller/service/repository/DTO flow now covers:
- `GET /v1/inventory/equipment`
- `GET /v1/inventory/equipment/:id`
- `POST /v1/inventory/equipment`
- `PATCH /v1/inventory/equipment/:id`
- `POST /v1/inventory/equipment/:id/writeoff`
- `GET /v1/inventory/equipment/:id/writeoffs`

Implementation notes:
- added admin/staff guards for equipment reads and history routes, with admin-only create/update routes
- mapped detail responses to include ordered write-off history with a minimal performer summary only
- enforced write-off invariants in the repository transaction so `quantity_before`, `quantity_set_to`, and `quantity_lost` stay consistent on every write-off
- added a creation guard in service logic so `quantity_current` cannot exceed `quantity_total`
- added focused controller, service, repository, and DTO specs for the new equipment slice

Commands run:
- `npm.cmd run build`
- `npm.cmd test -- --runInBand equipment`
- `npm.cmd run lint:check`

Result:
- all commands above passed
- full repo test and e2e suites were not run in this implement phase
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification pass completed against the equipment slice added in this task. I rechecked the controller, service, repository, DTOs, and focused specs for the `/v1/inventory/equipment*` surface and confirmed the write-off invariant handling still matches the task contract.

Commands run:
- `npm.cmd run build`
- `npm.cmd test -- --runInBand equipment`
- `npm.cmd run lint:check`

Result:
- all commands above passed
- focused equipment test suites passed: 4 suites, 24 tests
- no additional code changes were needed during test phase
- full repo unit suite and e2e suite were not run for this task-close pass
MCPs used: serena, prismaLocal
