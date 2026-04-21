# TASK-602 - Coaching Uniqueness Migration Guards
**Task ID:** TASK-602
**Domain:** S6 - Coaching
**Status:** backlog
**Branch:** feat/TASK-602-coaching-uniqueness-migration-guards
**Created:** 2026-03-25
**Completed:** -
**Priority:** P1
**Depends On:** TASK-601
**Blocks:** TASK-606
**Auto-Eligible:** no
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** none
**Escalation Notes:** migration direction needs approval if a new SQL artifact cannot be expressed cleanly without touching existing history
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add the raw SQL migration artifacts for S6's documented partial unique indexes.

## Why
The schema comments already declare the invariants, but the checked-in migrations do not yet enforce them at the database level.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] A checked-in migration artifact adds `coach_slot_unique`
- [ ] A checked-in migration artifact adds `coach_client_active_unique`
- [ ] The task does not run destructive Prisma commands
- [ ] Build passes (`npm.cmd run build`)
- [ ] Relevant tests pass
- [ ] Lint check passes (`npm.cmd run lint:check`)
- [ ] No avoidable `any` types used
- [ ] No secret fields in responses (password, credential_hash, token_hash)
- [ ] Swagger decorators applied where the module already follows Swagger
- [ ] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s6-coaching.md`
- `tasks/s6-coaching/README.md`
- `tasks/s6-coaching/execution.md`
- `tasks/s6-coaching/decisions.md`

## Module Hints
- `capstone-backend/prisma`

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
_Paste here after Session 1. End with `MCPs used: ...`._

---

## CODER OUTPUT
- Added `capstone-backend/prisma/migrations/20260325103000_coaching_uniqueness_guards/migration.sql` with the missing `coach_slot_unique` and `coach_client_active_unique` partial unique indexes.
- Kept the task non-destructive by checking in the SQL artifact only and not running Prisma migration commands.
MCPs used: serena, prismaLocal

---

## TESTER REPORT
- `npm.cmd run build` passed.
- `npm.cmd run lint:check` passed.
- No task-specific Jest suite was needed because this slice only added a checked-in SQL migration artifact.
MCPs used: serena, prismaLocal
