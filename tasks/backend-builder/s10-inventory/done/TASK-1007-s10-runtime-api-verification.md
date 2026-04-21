# TASK-1007 - S10 Runtime API Verification
**Task ID:** TASK-1007
**Domain:** S10 - Inventory
**Status:** done
**Branch:** feat/TASK-1007-s10-runtime-api-verification
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P2
**Depends On:** TASK-1006
**Blocks:** none
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** none
**Stop If:** stop if build, relevant tests, or lint are not green before live verification starts
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** serena | swagger

---

## What
Run the live S10 runtime and Swagger verification pass after the inventory module work and tests are green.

## Why
S10 adds a new authenticated HTTP surface, so the final domain slice should validate the live contract instead of stopping at code-level checks alone.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `tasks/api-verification-driver.md` is used for the live S10 verification pass
- [x] The live OpenAPI document reflects the implemented `/v1/inventory/*` routes and auth requirements
- [x] Any runtime-only contract mismatches are documented and either fixed or converted into a focused follow-up task
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
- `capstone-backend/src/inventory`
- `capstone-backend/src/common`
- `capstone-backend/src/membership`

## Task Size
- [x] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
The S10 context defines a fully HTTP-facing inventory surface, so the final domain slice should be a dedicated runtime verification pass rather than bundling live OpenAPI inspection into earlier implementation work. This keeps code fixes and contract verification separate, which matches the existing domain-driver pattern.

Implementation plan:
- run build, relevant tests, and lint first
- use the API verification driver for live backend startup and Swagger inspection
- convert any runtime-only contract mismatch into either an immediate focused fix or a tightly scoped follow-up task, depending on the finding
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
The runtime verification pass did not require application-code changes. I updated the shared [api-verification-driver.md](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/tasks/api-verification-driver.md) session variables to the active S10 task so the live pass ran against the correct inventory scope and current queue state.
MCPs used: swagger

---

## TESTER REPORT
Live verification passed against the running backend at `http://localhost:3000`.

Checked:
- OpenAPI JSON reachable at `/v1/docs-json`
- all expected S10 routes are present:
  - `GET/POST /v1/inventory/products`
  - `GET/PATCH /v1/inventory/products/{id}`
  - `POST /v1/inventory/products/{id}/restock`
  - `GET/POST /v1/inventory/equipment`
  - `GET/PATCH /v1/inventory/equipment/{id}`
  - `GET /v1/inventory/equipment/{id}/writeoffs`
  - `POST /v1/inventory/equipment/{id}/writeoff`
  - `GET/POST /v1/inventory/sales`
  - `GET /v1/inventory/sales/{id}`
- bearer auth scheme is published in Swagger for the inventory surface
- `POST /v1/inventory/sales` advertises the required `Idempotency-Key` header and `CreateSaleDTO`
- unauthenticated live requests to inventory routes return `401` with the RFC-7807 JSON body shape

No runtime-only contract mismatches were found in this pass.
MCPs used: swagger
