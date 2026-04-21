# TASK-902 - Nutrition Module And TDEE Read Surface
**Task ID:** TASK-902
**Domain:** S9 - TDEE & Nutrition
**Status:** done
**Branch:** feat/TASK-902-nutrition-module-and-tdee-read-surface
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P1
**Depends On:** TASK-901
**Blocks:** TASK-903, TASK-904, TASK-905, TASK-906
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the S9 read response shape or nutrition module root needs a product decision beyond the current context
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Create the S9 nutrition module and expose the initial authenticated read endpoints for active TDEE/macros and TDEE history.

## Why
This establishes the S9 repo structure, DTO/response contracts, and read path that later recalculation and nutrition-log slices can build on without inventing a second module root.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] A new `src/nutrition/` slice exists with controller, service, repository, DTOs, and module wiring
- [x] `GET /v1/nutrition/tdee` returns the authenticated user's active TDEE profile plus active macro target
- [x] `GET /v1/nutrition/tdee/history` returns paginated historical TDEE snapshots for the authenticated user
- [x] Controllers stay thin and use JWT auth plus Swagger metadata consistent with the repo
- [x] Missing active-profile states are handled through explicit repository/service contracts instead of raw Prisma failures
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
- `capstone-backend/src/user`
- `capstone-backend/src/common`
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Review found no nutrition module in `src/`, but the repo already has the user aggregate/profile seam, base-repository pagination helpers, and Prisma models needed for a first read slice. This task should establish `src/nutrition/` as the owning module root and expose the active/history TDEE reads before the write-heavy recalculation flow lands.

Implementation plan:
- add a nutrition module with controller, service, repository, DTOs, and response mappers
- expose authenticated active and historical TDEE reads under `/v1/nutrition`
- reuse repository-layer null-safe contracts and pagination helpers instead of direct controller-to-Prisma access
- add focused coverage for repository/service/controller behavior so later S9 tasks can extend stable read seams
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the initial S9 nutrition read surface under `capstone-backend/src/nutrition/`.

Delivered behavior:
- added a dedicated `NutritionModule`, controller, service, repository, DTOs, and response mappers
- exposed `GET /v1/nutrition/tdee` for the authenticated user's active TDEE profile plus active macro target
- exposed `GET /v1/nutrition/tdee/history` as a paginated authenticated history read ordered by `calculated_at`
- wired the new domain into `AppModule` so the nutrition HTTP surface is live in the main app module graph

Implementation notes:
- kept controllers thin and pushed the active-profile read contract into a repository method that explicitly throws when the active TDEE or matching active macro target is missing
- reused shared pagination behavior from `BaseRepository` instead of adding nutrition-local paging logic
- returned decimal nutrition values as fixed-point strings to stay consistent with existing decimal response patterns in the repo
- added focused controller, service, and repository specs for the new read seam
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed successfully.

Commands:
- `npm.cmd run build`
- `npm.cmd test -- --runInBand src/nutrition/nutrition.controller.spec.ts src/nutrition/nutrition.service.spec.ts src/nutrition/nutrition.repository.spec.ts`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`

Results:
- build passed
- focused nutrition specs passed: 3 suites, 8 tests
- full repo suite passed: 72 suites, 377 tests
- lint passed
- runtime API verification is not required for this task
MCPs used: serena, prismaLocal
