# TASK-703 - S7 Training Guard Migration Artifacts
**Task ID:** TASK-703
**Domain:** S7 - Fitness Training
**Status:** done
**Branch:** feat/TASK-703-s7-training-guard-migration-artifacts
**Created:** 2026-03-26
**Completed:** 2026-03-26
**Priority:** P1
**Depends On:** TASK-702
**Blocks:** TASK-704, TASK-705, TASK-707, TASK-708
**Auto-Eligible:** no
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** none
**Escalation Notes:** migration direction needs approval if the guard indexes cannot be added as checked-in SQL artifacts without touching existing migration history
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add the raw SQL migration artifacts for the S7 partial unique invariants already documented in the Prisma schema comments.

## Why
The schema describes the training invariants, but the checked-in migrations do not enforce them at the database level yet.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] A checked-in migration artifact adds `one_active_plan_per_user`
- [x] A checked-in migration artifact adds `exercise_log_set_unique`
- [x] The task does not run destructive Prisma commands
- [x] Build passes (`npm.cmd run build`)
- [x] Lint check passes (`npm.cmd run lint:check`)
- [x] No avoidable `any` types used
- [x] No secret fields in responses (password, credential_hash, token_hash)
- [x] Swagger decorators applied where the module already follows Swagger
- [x] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s7-fitness-training.md`
- `tasks/s7-fitness-training/README.md`
- `tasks/s7-fitness-training/execution.md`
- `tasks/s7-fitness-training/decisions.md`

## Module Hints
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [x] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd run lint:check`
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
Scoped `TASK-703` to a standalone raw SQL migration artifact that matches the existing subscription and coaching guard-migration pattern, without rewriting migration history or mutating the local database.
Planned to verify with Prisma migration status plus build and lint only, leaving local application of the checked-in guard migration to the shared auto-apply path before the next DB-backed S7 worker continues.
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
- Added `capstone-backend/prisma/migrations/20260326110000_s7_training_uniqueness_guards/migration.sql` with the `one_active_plan_per_user` partial unique guard and the `exercise_log_set_unique` composite unique guard.
- Kept the task to checked-in SQL only: no migration-history rewrite, no destructive Prisma commands, and no unrelated application-code changes.
MCPs used: serena, prismaLocal

---

## TESTER REPORT
- `prisma migrate status` now reports 7 migrations found with `20260326110000_s7_training_uniqueness_guards` pending locally, which is the expected post-check-in state before `prisma migrate deploy`.
- `npm.cmd run build` passed.
- `npm.cmd run lint:check` passed.
MCPs used: serena, prismaLocal
