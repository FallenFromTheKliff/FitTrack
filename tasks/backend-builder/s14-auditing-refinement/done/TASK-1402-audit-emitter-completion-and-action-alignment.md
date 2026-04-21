# TASK-1402 - Audit Emitter Completion And Action Alignment
**Task ID:** TASK-1402
**Domain:** S14 - Auditing Refinement
**Status:** done
**Branch:** feat/TASK-1402-audit-emitter-completion-and-action-alignment
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P1
**Depends On:** TASK-1401
**Blocks:** TASK-1403, TASK-1404
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if aligning audit actions would require inventing refund or suspension behavior that belongs to another domain instead of wiring an existing mutation
**Escalation Notes:** this task may need an explicit decision if the current action catalog and the documented S14 action table should diverge or if unresolved actions must be deferred formally
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Complete the missing S14 audit emitters for existing business flows and align the action catalog with the current repo reality without inventing cross-domain features.

## Why
The audit store is already useful only if high-value mutations are consistently logged, and S14 review found that the existing admin coach commission update flow still lacks `COACH_COMMISSION_CHANGED` while some context-listed actions have no owning-domain implementation yet.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] The existing admin coach commission update path emits `COACH_COMMISSION_CHANGED`
- [x] Any low-risk action-name or payload-alignment decision is logged in `tasks/s14-auditing-refinement/decisions.md`
- [x] Context-listed actions with no owning-domain business flow are explicitly deferred instead of being silently treated as complete
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
- `capstone-backend/src/membership`
- `capstone-backend/src/auth`
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
S14 review showed that most major audit emitters already exist, which keeps this task narrowly scoped. The missing work is one real emitter gap on the current coach admin update path plus a small amount of action-catalog alignment so unresolved refund and suspension actions are handled intentionally instead of drifting.

Implementation plan:
- wire `COACH_COMMISSION_CHANGED` into the existing admin coach update mutation
- preserve the current append-only audit event pattern used in other domains
- document any reusable decision about unresolved context-only actions in `decisions.md`
- stop instead of inventing unrelated refund or suspension features if the owning mutation does not exist yet

Expected files to touch:
- `capstone-backend/src/coaching/coach/`
- `capstone-backend/src/audit/` if shared audit constants or helpers need adjustment
- `tasks/s14-auditing-refinement/decisions.md`

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the missing S14 coach commission audit emitter by threading the authenticated admin ID through the existing admin coach update route and into `CoachService`. The service now loads the pre-update coach record only when `gym_commission_pct` is part of the admin mutation, updates the coach, and emits `audit.log` with `AuditAction.COACH_COMMISSION_CHANGED` only when the stored commission value actually changes. The audit entity is `CoachProfile`, and the before/after payload is intentionally limited to the commission snapshot.

Added focused coaching coverage so the service now verifies both the positive emission path and the non-commission admin update path, and updated the controller spec for the new actor-aware call signature. Logged the S14 alignment decisions in `decisions.md`: `COACH_COMMISSION_CHANGED` uses a narrow commission-only payload, and the context-listed `PAYMENT_REFUNDED` / `SUBSCRIPTION_SUSPENDED` actions remain explicitly deferred until their owning membership mutations exist in code.

Checks run:
- `npm.cmd test -- --runInBand src/coaching/coach`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verified the `TASK-1402` implementation against the active acceptance criteria. The admin coach update path now records `COACH_COMMISSION_CHANGED` with the acting admin ID and a commission-only before/after snapshot, and the S14 decision log explicitly documents both the narrow coach payload choice and the formal deferral of `PAYMENT_REFUNDED` / `SUBSCRIPTION_SUSPENDED` until their owning membership flows exist.

Checks rerun for closeout:
- `npm.cmd test -- --runInBand src/coaching/coach`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Result: pass. No additional task-scoped failures were observed, and the task is ready to move to `done/`.

MCPs used: serena, prismaLocal
