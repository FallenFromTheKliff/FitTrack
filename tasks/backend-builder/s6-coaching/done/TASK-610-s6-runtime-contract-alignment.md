# TASK-610 - S6 Runtime Contract Alignment
**Task ID:** TASK-610
**Domain:** S6 - Coaching
**Status:** done
**Branch:** feat/TASK-610-s6-runtime-contract-alignment
**Created:** 2026-03-26
**Completed:** 2026-03-26
**Priority:** P2
**Depends On:** TASK-609
**Blocks:** none
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** the live S6 Swagger surface still diverges after the focused contract/doc fixes are running locally
**Escalation Notes:** ask only if the running backend cannot be refreshed locally or if the runtime mismatch turns out to need a broader S6 API redesign
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** swagger | serena

---

## What
Align the S6 coaching controller contract with the live Swagger findings from `TASK-609`.

## Why
The final S6 runtime pass reached the live OpenAPI surface and found documentation mismatches that should be fixed in a narrow follow-up instead of reopening the broader coaching implementation.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Add the required `Idempotency-Key` Swagger header to `POST /v1/coaching/appointments/:id/pay`.
- [x] Stop exposing `gym_commission_pct` on the coach self-update request contract while preserving the admin update contract for that field.
- [x] Add explicit success-response schemas for the S6 routes whose live docs currently omit the shared response envelope.
- [x] Preserve current S6 route behavior outside the contract/documentation alignment scope.
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
- `context/s6-coaching.md`
- `tasks/s6-coaching/README.md`
- `tasks/s6-coaching/execution.md`
- `tasks/s6-coaching/decisions.md`
- `tasks/api-verification-driver.md`

## Module Hints
- `capstone-backend/src/coaching`
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
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
- Keep this as a narrow S6 follow-up from runtime verification rather than reopening the completed coaching feature work.
- Fix the concrete live-contract gaps from `TASK-609` only:
  - add `@ApiHeader` for the required `Idempotency-Key` on the downpayment route
  - split or narrow the coach self-update request schema so `gym_commission_pct` stays admin-only in Swagger as well as in service logic
  - add explicit success-response envelope schemas for the mutating routes the live docs underdocumented
- Re-run the API verification driver after the updated backend is serving the new S6 OpenAPI document.
MCPs used: swagger

---

## CODER OUTPUT
- Updated the coaching Swagger contract in place without reopening the broader S6 behavior:
  - added `@ApiHeader` for `Idempotency-Key` on `POST /v1/coaching/appointments/:id/pay`
  - narrowed `PATCH /v1/coaching/coaches/me` to a Swagger-only `CoachSelfUpdateProfileDTO` so `gym_commission_pct` stays admin-only in the published request schema while the existing service guard remains intact
  - added explicit success-envelope schemas for coach availability replacement and appointment cancellation; availability now returns `null` so the served success envelope is explicit and matches the documented contract
- Touched files:
  - `capstone-backend/src/coaching/appointment/appointment.controller.ts`
  - `capstone-backend/src/coaching/coach/coach.controller.ts`
  - `capstone-backend/src/coaching/coach/dto/coach.dto.ts`
MCPs used: none

---

## TESTER REPORT
- Code-level verification passed:
  - `npm.cmd run build`
  - `npm.cmd test -- --runInBand`
  - `npm.cmd run test:e2e -- --runInBand`
  - `npm.cmd run lint:check`
- Swagger MCP was used first against `http://localhost:3000/v1/docs-json`, but that host process was serving a stale pre-fix document and could not be replaced from the sandbox.
- Final live verification used fresh inline FitTrack boot attempts on temporary local ports and inspected the served `/v1/docs-json` contract for the targeted S6 routes.
- The live runtime contract now confirms:
  - `POST /v1/coaching/appointments/{id}/pay` publishes the required `Idempotency-Key` header
  - `PATCH /v1/coaching/coaches/me` uses `CoachSelfUpdateProfileDTO` in the served request schema
  - the `CoachSelfUpdateProfileDTO` schema omits `gym_commission_pct`
  - `POST /v1/coaching/coaches/availability` publishes an explicit success envelope
  - `PATCH /v1/coaching/appointments/{id}/cancel` publishes an explicit success envelope with the non-refundable downpayment message
- No new S6 route, auth, or secret-field mismatch was surfaced during this follow-up runtime pass.
MCPs used: swagger
