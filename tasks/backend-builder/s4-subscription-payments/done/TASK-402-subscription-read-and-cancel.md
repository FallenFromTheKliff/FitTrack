# TASK-402 - Subscription Read And Cancel
**Domain:** S4 - Subscription & Payments
**Status:** done
**Branch:** feat/TASK-402-subscription-read-and-cancel
**Created:** 2026-03-22
**Completed:** 2026-03-23
**Auto-Eligible:** yes
**Stop If:** access rules or cancellation semantics conflict with the S4 context or require a new contract
**Escalation Notes:** ask only if active-access status rules cannot be derived safely from the current S4 design and implemented code

---

## What
Implement subscription read and cancellation flows for the authenticated member.

## Why
This gives S4 ownership over the current subscription lifecycle and reduces leakage of subscription logic into other modules.

## Acceptance Criteria
- [x] Implement `GET /v1/membership/my-subscription` for the authenticated user.
- [x] Implement `POST /v1/membership/cancel` with `CancelSubscriptionDTO`.
- [x] Cancel flow updates `status`, `cancelled_at`, and `cancellation_reason` according to the design doc.
- [x] Emit the S4 audit event for subscription cancellation using the existing audit event pattern.
- [x] Expose repository/service methods that other domains can use for active-subscription reads instead of duplicating direct Prisma checks.
- [x] Update the attendance subscription-check path to consume S4-owned read logic if that can be done without broadening the task too far.
- [x] Add unit tests for cancellation and current-subscription retrieval rules.
- [x] Unit tests pass (`npm run test src/[module]`)
- [x] Lint passes (`npm run lint`)
- [x] No `any` types used
- [x] No secret fields in responses (password, credential_hash, token_hash)
- [x] Swagger decorators applied

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s4-subscription-payments.md`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - STOP, split into 2 tasks first

---

## PLANNER OUTPUT
- Keep this task read/cancel focused. Do not activate subscriptions here; activation belongs to payment completion tasks.
- Treat `active`, `past_due`, and `cancelled with future expires_at` carefully when shaping shared "has access" read logic.
- If refactoring attendance is too large, provide a narrow adapter method first and defer full cross-module cleanup.

---

## CODER OUTPUT
Implemented the member-facing subscription read/cancel slice inside `src/membership/`:
- added `CancelSubscriptionDTO`
- added `GET /v1/membership/my-subscription`
- added `POST /v1/membership/cancel`
- added repository helpers for current subscription reads, cancellable subscription lookup, subscription updates, and shared access checks

Cross-module integration:
- exported the shared access rule as `MembershipService.hasSubscriptionAccess()`
- updated `AttendanceService` to use the membership-owned access check instead of a direct subscription query inside `user.repository`
- imported `MembershipModule` into `UserModule` to keep the dependency on the owning S4 service rather than duplicating rules

Cancellation behavior:
- only `active` and `past_due` subscriptions are cancellable
- cancelling sets `status=cancelled`, `cancelled_at`, and `cancellation_reason`
- cancellation emits the existing `SUBSCRIPTION_CANCELLED` audit event

---

## TESTER REPORT
Verification completed on 2026-03-23.

Checks run:
- `npm.cmd run build` - passed
- `npm.cmd test -- membership --runInBand` - passed (`6` suites, `23` tests)
- `npm.cmd test -- user.service --runInBand` - passed (`1` suite, `5` tests)
- `npm.cmd run lint` - passed with pre-existing warnings outside S4 only

Notes:
- repo lint warnings remain in `src/auth/auth.controller.spec.ts` and `src/common/base-repository/base-repository.spec.ts`
- no new TASK-402 lint or test failures remained after the attendance integration change
