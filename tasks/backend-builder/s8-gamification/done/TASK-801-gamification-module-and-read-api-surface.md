# TASK-801 - Gamification Module And Read API Surface
**Task ID:** TASK-801
**Domain:** S8 - Gamification
**Status:** done
**Branch:** feat/TASK-801-gamification-module-and-read-api-surface
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P1
**Depends On:** none
**Blocks:** TASK-802, TASK-804, TASK-805
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the leaderboard response shape or rank-display contract needs a product decision beyond the current S8 context
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Create the S8 gamification module and expose the initial mastery and leaderboard read endpoints under the existing `/v1/fitness` surface.

## Why
This establishes the S8 repo structure, DTO/response contracts, and read path that later XP accrual and notification slices can build on without inventing a second module root.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] A new `src/fitness/gamification/` slice exists with controller, service, repository, DTOs, and module wiring
- [ ] `GET /v1/fitness/mastery` returns the authenticated user's mastery rows with optional filtering by muscle group and rank
- [ ] `GET /v1/fitness/leaderboard` returns paginated gym-wide ranking data ordered by total XP
- [ ] Shared rank-threshold constants/helper logic exists in a reusable location for later rank evaluation
- [ ] Swagger decorators document the new S8 read routes and response envelopes
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
- `context/s8-gamification.md`
- `tasks/s8-gamification/README.md`
- `tasks/s8-gamification/execution.md`
- `tasks/s8-gamification/decisions.md`

## Module Hints
- `capstone-backend/src/fitness`
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
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
Review found that the S8 schema and migration support already exist, but the live Nest app still has no gamification module wiring and no `/v1/fitness/mastery` or `/v1/fitness/leaderboard` routes. The best first slice is therefore to establish `src/fitness/gamification/` under the existing fitness domain root, add the read endpoints, and introduce reusable rank-threshold helpers that later event-driven accrual can reuse.

Implementation plan:
- add a dedicated S8 gamification submodule under `src/fitness/` with controller, service, repository, DTOs, and response mappers
- expose authenticated mastery and leaderboard reads through the existing `/v1/fitness` route family
- reuse Prisma-backed pagination and repository patterns instead of introducing direct controller-to-Prisma access
- add focused controller/service/repository coverage, then run build, lint, and targeted tests before advancing
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the initial S8 read surface under `capstone-backend/src/fitness/gamification/`.

Delivered behavior:
- added a dedicated `GamificationModule`, controller, service, repository, DTOs, and reusable rank-threshold/display helpers
- exposed `GET /v1/fitness/mastery` for the authenticated user's mastery rows with optional `muscle_group` and `rank` filters
- exposed `GET /v1/fitness/leaderboard` as a paginated gym-wide leaderboard ranked by total XP
- reused the user domain through a narrow `UserService.listGamificationParticipants()` seam so leaderboard profile reads stay aligned with the owning domain

Implementation notes:
- kept the S8 slice under `src/fitness/` to preserve the existing `/v1/fitness` route family and `FitnessModule` structure
- returned mastery rows with raw rank data plus `rank_display` derived from the documented Adamantite overflow rule
- included active member and coach participant profiles in the leaderboard, defaulting users without mastery rows to `0` XP so the gym-wide list is not empty before accrual lands
- added focused controller, service, repository, and user-service coverage for the new read seam
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed successfully.

Commands:
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`

Results:
- build passed
- full repo suite passed: 68 suites, 355 tests
- lint passed
- runtime API verification not required for this task
MCPs used: serena, prismaLocal
