# TASK-1403 - S14 Coverage Pass
**Task ID:** TASK-1403
**Domain:** S14 - Auditing Refinement
**Status:** done
**Branch:** feat/TASK-1403-s14-coverage-pass
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P2
**Depends On:** TASK-1401, TASK-1402
**Blocks:** TASK-1404
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** stop if meaningful S14 behavior still remains unimplemented and this task would turn into a hidden feature slice instead of a verification slice
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add the focused audit module and emitter coverage needed before live runtime verification of the S14 HTTP surface.

## Why
S14 spans an async event listener, admin read endpoints, and cross-domain mutation emitters, so it needs one deliberate coverage pass instead of scattering final confidence work across every earlier slice.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Focused tests exist for the audit listener and read surface
- [x] Focused tests exist for any newly added emitter behavior from S14
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
- `capstone-backend/src/coaching`
- `capstone-backend/test`
- `capstone-backend/prisma`

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

---

## PLANNER OUTPUT
By the time S14 reaches this slice, the audit read endpoints and emitter gaps should already be settled. That makes the safest remaining work a focused verification task covering the listener, controller/service behavior, and any new emitter seams before the final live API pass.

Implementation plan:
- add or extend audit service and controller specs
- add targeted coverage for newly wired audit emitters where practical
- keep this slice verification-oriented rather than reopening product or ownership questions

Expected files to touch:
- `capstone-backend/src/audit/`
- focused specs under `capstone-backend/src/`
- possibly `capstone-backend/test/` if one small S14 e2e seam is the cleanest fit

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Extended the S14 audit coverage where it was still thin: `audit.service.spec.ts` now verifies the async `handleAuditEvent()` listener writes an append-only audit row with the expected normalized payload and also confirms listener failures are logged without rethrowing, preserving the fire-and-forget audit contract. Existing audit controller/service specs already covered the admin read surface, and the coach emitter behavior added in `TASK-1402` remains covered in the coaching service spec.

Checks run:
- `npm.cmd test -- --runInBand src/audit src/coaching/coach`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verified the focused S14 coverage additions and the surrounding audit/coaching seams. The audit listener now has explicit tests for the append-only persistence path and the log-without-rethrow failure path, the audit read surface remains covered by the existing controller/service specs, and the `COACH_COMMISSION_CHANGED` emitter behavior introduced in `TASK-1402` is still exercised by the coaching service spec.

Checks rerun for closeout:
- `npm.cmd test -- --runInBand src/audit src/coaching/coach`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Result: pass. This verification slice is complete and ready to hand off to the final runtime API verification task.

MCPs used: serena, prismaLocal
