# TASK-410 - S4 Runtime Contract Alignment
**Task ID:** TASK-410
**Domain:** S4 - Subscription & Payments
**Status:** done
**Branch:** feat/TASK-410-s4-runtime-contract-alignment
**Created:** 2026-03-25
**Completed:** 2026-03-25
**Priority:** P2
**Depends On:** TASK-409
**Blocks:** none
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** runtime Swagger mismatches require broader API contract redesign outside the S4 surface
**Escalation Notes:** ask only if the running backend cannot be restarted or if the live Swagger surface still diverges after the code-level fixes are deployed
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** serena, swagger

---

## What
Align the S4 controller runtime contract with the live Swagger findings from API verification.

## Why
The S4 API verification pass found a real status-code mismatch and missing success-response documentation on the running subscription and payment routes.

## Acceptance Criteria
- [x] `POST /v1/membership/cancel` returns HTTP 200 instead of Nest's default 201.
- [x] Add explicit Swagger success-response schemas for the flagged S4 subscription and payment read endpoints.
- [x] Preserve existing S4 route behavior outside the contract/documentation fix scope.
- [x] Build passes (`npm.cmd run build`)
- [x] Relevant tests pass
- [x] Lint check passes (`npm.cmd run lint:check`)
- [x] No avoidable `any` types used
- [x] No secret fields in responses (password, credential_hash, token_hash)
- [x] Swagger decorators applied where the module already follows Swagger
- [ ] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s4-subscription-payments.md`
- `tasks/s4-subscription-payments/README.md`
- `tasks/s4-subscription-payments/execution.md`
- `tasks/s4-subscription-payments/decisions.md`
- `tasks/api-verification-driver.md`

## Module Hints
- `capstone-backend/src/membership`
- `capstone-backend/src/files`
- `capstone-backend/test`

## Task Size
- [ ] XS (< 30 lines changed)
- [x] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes`

---

## PLANNER OUTPUT
- Keep this as a narrow S4 follow-up from runtime verification rather than reopening the completed S4 queue broadly.
- Fix the real runtime mismatch first (`POST /membership/cancel` status code), then add explicit success-response Swagger schemas only for the read endpoints the live contract underdocumented.
- Re-run the API verification driver after the updated backend process is serving the new code.
MCPs used: serena

---

## CODER OUTPUT
- Added explicit Swagger response DTOs for S4 membership-plan, current-subscription, payment-history, and payment-detail reads.
- Added envelope-shaped Swagger response schemas to the flagged S4 read endpoints in `subscription.controller.ts` and `payment.controller.ts`.
- Added `@HttpCode(200)` to `POST /v1/membership/cancel` so the runtime response matches the documented contract.
- Updated the S4 e2e suite to assert the corrected `200` status for subscription cancellation.
MCPs used: serena

---

## TESTER REPORT
- Code-level verification passed for the TASK-410 slice.
- Checks run:
  - `npm.cmd run build`
  - `npm.cmd test -- --runInBand`
  - `npm.cmd run test:e2e -- --runInBand --testPathPatterns=app.e2e-spec.ts`
  - `npm.cmd run lint:check`
- A live Swagger spot-check was attempted, but the currently running backend still appeared to serve the pre-fix OpenAPI document. Restart the backend and rerun the API verification driver to confirm the live contract update.
MCPs used: serena, swagger
