# TASK-903 - TDEE Recalculation Via AI Client
**Task ID:** TASK-903
**Domain:** S9 - TDEE & Nutrition
**Status:** done
**Branch:** feat/TASK-903-tdee-recalculation-via-ai-client
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P1
**Depends On:** TASK-901, TASK-902
**Blocks:** TASK-905, TASK-906
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the AI request contract or post-recalculation side-effect boundary needs a product or architecture decision beyond the current S9 context
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Extend the shared Python AI seam for TDEE calculation and implement the transactional S9 recalculation flow that rotates active TDEE and macro snapshots.

## Why
The core S9 value is the recalculation pipeline, and the repo already has an AI client plus profile-aggregate seam that should be reused instead of inventing a second external-integration pattern.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `POST /v1/nutrition/tdee/recalculate` exists and is JWT-protected
- [x] The recalculation flow merges optional DTO inputs over the existing user profile and rejects missing required final values with a 422 contract
- [x] The shared AI client can call the TDEE-calculation endpoint without duplicating fetch/config logic
- [x] Active TDEE and macro snapshots rotate transactionally so only one active record remains for each per user
- [x] The flow emits a bounded S9 domain event after a successful commit instead of broadening into S12 persistence work
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
- `context/s9-tdee-nutrition.md`
- `tasks/s9-tdee-nutrition/README.md`
- `tasks/s9-tdee-nutrition/execution.md`
- `tasks/s9-tdee-nutrition/decisions.md`

## Module Hints
- `capstone-backend/src/ai`
- `capstone-backend/src/user`
- `capstone-backend/src/common`
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [x] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Review showed that the repo already has a shared Python AI client and user-profile aggregate path, but neither currently supports S9’s TDEE calculation or snapshot-rotation transaction. This task should extend the existing AI seam, reuse the profile aggregate contract, and keep the post-commit side effect limited to a nutrition-domain event so S9 does not silently expand into S12.

Implementation plan:
- add a TDEE-calculation operation to the shared AI client using the existing config and fetch patterns
- add S9 recalculation DTO/service/repository logic that merges overrides over the stored profile, computes age, and enforces required final fields
- perform the active-snapshot rotation inside one transaction, then emit a post-commit event for later notification integration
- cover invalid-profile, AI-failure, and successful-rotation paths with focused tests
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S9 recalculation slice across the shared AI seam and the nutrition module.

Delivered behavior:
- added `POST /v1/nutrition/tdee/recalculate` under the authenticated nutrition controller with Swagger metadata and DTO validation
- extended the shared `AiPythonClientService` with a typed `/calculate-tdee` request path and upstream payload validation
- merged optional recalculation overrides over the stored profile, derived age from DOB, and returned a 422 contract when the final TDEE snapshot is incomplete
- rotated active `TdeeProfile` and `MacroTarget` records in one repository transaction, then emitted a bounded `nutrition.tdee-recalculated` domain event after commit
- added focused controller, service, repository, and AI-client coverage for the new flow
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed successfully.

Commands:
- `npm.cmd test -- --runInBand src/nutrition/nutrition.controller.spec.ts src/nutrition/nutrition.service.spec.ts src/nutrition/nutrition.repository.spec.ts src/ai/ai-python-client.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`

Results:
- focused nutrition plus AI-client specs passed: 4 suites, 18 tests
- build passed
- full repo suite passed: 72 suites, 383 tests
- lint passed
- runtime API verification is not required for this task
MCPs used: serena, prismaLocal
