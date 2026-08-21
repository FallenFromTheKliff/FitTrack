# TASK-1401 - Audit Admin Read Surface
**Task ID:** TASK-1401
**Domain:** S14 - Auditing Refinement
**Status:** done
**Branch:** feat/TASK-1401-audit-admin-read-surface
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P1
**Depends On:** none
**Blocks:** TASK-1403, TASK-1404
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** stop if the audit read response shape needs a product or security decision about which actor and profile fields may be exposed to admins
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add the first S14 HTTP read surface for audit logs with admin-only access, validated query DTOs, Swagger metadata, and safe response shaping over the existing `AuditLog` store.

## Why
The append-only listener and read methods already exist in `AuditService`, but there is currently no `/v1/audit` or `/v1/audit/:id` API contract, which makes the audit domain unusable from the admin application.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] A dedicated admin-only audit controller exists and is wired into `AuditModule`
- [x] `GET /v1/audit` supports validated filter and pagination query params
- [x] `GET /v1/audit/:id` returns one audit entry with safe actor/profile fields only
- [x] DTO validation and Swagger metadata exist for the new HTTP surface
- [x] Response mapping does not expose secret fields such as `credential_hash` or `token_hash`
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
- `context/s14-auditing.md`
- `tasks/s14-auditing-refinement/README.md`
- `tasks/s14-auditing-refinement/execution.md`
- `tasks/s14-auditing-refinement/decisions.md`

## Module Hints
- `capstone-backend/src/audit`
- `capstone-backend/src/common`
- `capstone-backend/src/user`
- `capstone-backend/test`
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
S14 review confirmed that the append-only audit listener, Prisma model, and service-level read methods already exist, but there is still no admin HTTP surface. The safest first slice is to wrap the existing audit store in a normal controller/service/repository-style contract with DTO validation, Swagger metadata, and explicit response mapping before touching the more ambiguous cross-domain action gaps.

Implementation plan:
- keep `AuditModule` as the domain root and add the missing controller plus DTO files
- add admin-only `GET /v1/audit` and `GET /v1/audit/:id`
- reuse the existing `AuditService` read methods or extract a repository seam if that keeps the module aligned with repo patterns
- add explicit response DTOs or mapper helpers so audit reads expose only safe actor/profile fields
- add focused controller/service tests for the new read surface

Expected files to touch:
- `capstone-backend/src/audit/`
- possibly `capstone-backend/src/app.module.ts` only if module wiring needs adjustment
- focused tests under `capstone-backend/src/audit/` and possibly `capstone-backend/test/`

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the first S14 delivery slice by adding a dedicated admin read surface around the existing audit store.

Key outcomes:
- added `GET /v1/audit` and `GET /v1/audit/:id` through a new `AuditController`
- restricted both routes to admin users with JWT plus role guards
- added `AuditFilterDTO` pagination and filter validation for entity, entity id, user id, action, and date range inputs
- added explicit audit response DTOs so admin reads expose only safe actor fields instead of raw nested Prisma user records
- updated `AuditService` to map paginated and single-record reads into the new response contract
- wired the controller into `AuditModule`
- added focused controller and service specs for the new audit read surface

Implementation notes:
- actor responses now expose only `id`, `role`, `status`, and profile `first_name` / `last_name`
- raw user fields such as `qr_code_token` never leave the service mapping layer
- this slice intentionally leaves runtime API verification for `TASK-1404`

Checks run:
- `npm.cmd test -- --runInBand src/audit`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed with task-scoped checks:
- `npm.cmd test -- --runInBand src/audit`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- audit unit tests passed: 2 suites, 6 tests
- Nest build passed
- lint check passed
- runtime API verification was not required for this task because it is reserved for `TASK-1404`

MCPs used: serena, prismaLocal
