# TASK-403 - Subscription Uniqueness Migration
**Domain:** S4 - Subscription & Payments
**Status:** done
**Branch:** feat/TASK-403-subscription-uniqueness-migration
**Created:** 2026-03-22
**Completed:** 2026-03-23

---

## What
Add and verify the raw SQL partial unique index that enforces one active or pending subscription per user.

## Why
This is the core database guard that prevents duplicate active subscription state and backs up application-level checks.

## Acceptance Criteria
- [x] Add a raw SQL migration that creates `subscriptions_one_active_per_user`.
- [x] Scope the index to statuses `active`, `past_due`, and `pending_payment` exactly as described in the context docs.
- [x] Verify the migration does not remove or alter unrelated schema objects.
- [x] Document any implications for subscribe and renewal error handling.
- [x] Add a narrow repository or service test if the repo already has a suitable DB-backed migration test pattern; otherwise document verification steps.
- [x] Unit tests pass (`npm run test src/[module]`)
- [ ] Lint passes (`npm run lint`)
- [x] No `any` types used
- [x] No secret fields in responses (password, credential_hash, token_hash)
- [ ] Swagger decorators applied

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s4-subscription-payments.md`

## Task Size
- [ ] XS (< 30 lines changed)
- [x] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [ ] L  - STOP, split into 2 tasks first

---

## PLANNER OUTPUT
- This task is intentionally small and data-integrity focused.
- It is safe to do right before or right after `TASK-401`, but should land before subscribe flows.
- Because guardrails prohibit running Prisma migrations casually, implementation should add the migration artifact without broad schema churn.

---

## CODER OUTPUT
- Added a new raw SQL migration artifact at `capstone-backend/prisma/migrations/20260323090000_subscription_uniqueness_guard/migration.sql`.
- The migration adds only `subscriptions_one_active_per_user` and does not alter unrelated schema objects.
- Implication for later S4 flows: subscribe and renewal logic should expect duplicate active or pending subscription attempts to fail at the database layer even if application-level checks miss them.
- There is no existing DB-backed migration-test pattern in the repo, so this task documents verification steps instead of adding a database execution test.

---

## TESTER REPORT
- `Get-Content capstone-backend/prisma/migrations/20260323090000_subscription_uniqueness_guard/migration.sql` - confirmed the exact partial unique index SQL
- `npm.cmd run build` - passed
- `npm.cmd test -- membership --runInBand` - passed
- `npm.cmd run lint` - not run for task completion because repo-wide lint baseline is still failing on many unrelated files outside this migration task
