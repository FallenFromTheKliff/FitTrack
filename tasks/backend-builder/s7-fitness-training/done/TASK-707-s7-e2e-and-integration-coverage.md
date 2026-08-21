# TASK-707 - S7 E2E And Integration Coverage
**Task ID:** TASK-707
**Domain:** S7 - Fitness Training
**Status:** done
**Branch:** feat/TASK-707-s7-e2e-and-integration-coverage
**Created:** 2026-03-26
**Completed:** 2026-03-27
**Priority:** P2
**Depends On:** TASK-701, TASK-702, TASK-703, TASK-704, TASK-705, TASK-706
**Blocks:** TASK-708
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** none
**Escalation Notes:** stop if coverage gaps expose an earlier S7 slice that needs to be split or revisited before live verification
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add the broad S7 verification coverage needed before live API inspection.

## Why
The runtime verification driver should run only after the code-level checks are green and the main fitness flows already have stable automated coverage.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] Relevant unit, integration, and e2e coverage exists for the exercise, plan, session, and AI plan HTTP flows
- [ ] Coverage exists for the most important ownership, validation, and invalid-state paths
- [ ] Build passes (`npm.cmd run build`)
- [ ] Relevant tests pass
- [ ] E2E tests pass (`npm.cmd run test:e2e -- --runInBand`)
- [ ] Lint check passes (`npm.cmd run lint:check`)
- [ ] No avoidable `any` types used
- [ ] No secret fields in responses (password, credential_hash, token_hash)
- [ ] Swagger decorators applied where the module already follows Swagger
- [ ] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s7-fitness-training.md`
- `tasks/s7-fitness-training/README.md`
- `tasks/s7-fitness-training/execution.md`
- `tasks/s7-fitness-training/decisions.md`

## Module Hints
- `capstone-backend/src/fitness`
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
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
Review found that S7 had no end-to-end coverage in `capstone-backend/test/` even though the feature slices themselves were implemented and unit-tested. The existing domain e2e pattern in the repo uses controller-level Nest apps with mocked services, real validation, guards, interceptors, and filters, so the fastest stable coverage path was to mirror that harness for fitness instead of jumping straight to live runtime verification.

Implementation plan:
- add a focused `fitness.e2e-spec.ts` that covers the main exercise, training-plan, workout-session, and AI plan HTTP flows
- include high-signal ownership, validation, and invalid-state assertions rather than exhaustive permutations
- keep the harness aligned with existing S5/S6 controller e2e files so the final live runtime pass remains isolated to `TASK-708`
- rerun build, lint, full Jest, and full e2e before closing the queue
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S7 pre-runtime e2e slice in `capstone-backend/test/fitness.e2e-spec.ts`.

Delivered behavior:
- controller-level e2e coverage for exercise, training-plan, workout-session, and AI generate-plan routes
- assertions for the most important ownership, validation, and invalid-state paths before runtime verification

Implementation notes:
- reused the repo’s established Nest e2e harness pattern with mocked services plus real `ValidationPipe`, `ResponseInterceptor`, `HttpExceptionFilter`, and `RolesGuard`
- added authenticated exercise list plus admin-write restriction coverage
- added training-plan create and coach-assignment coverage with DTO trimming and ownership routing checks
- added workout-session start, invalid set validation, and `422` invalid-state completion coverage
- added AI generate-plan success plus preserved `422` profile-context failure coverage
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed successfully.

Commands:
- `npm.cmd run build`
- `npm.cmd run lint:check`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`

Results:
- build passed
- lint passed
- full repo suite passed: 65 suites, 346 tests
- e2e suite passed: 4 suites, 33 tests
- runtime API verification not required for this task
MCPs used: serena, prismaLocal
