# TASK-805 - S8 Runtime API Verification
**Task ID:** TASK-805
**Domain:** S8 - Gamification
**Status:** done
**Branch:** feat/TASK-805-s8-runtime-api-verification
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P2
**Depends On:** TASK-804
**Blocks:** none
**Auto-Eligible:** no
**Decision Flags:** none
**Stop If:** stop if build, tests, lint, or live backend startup fail before Swagger verification can begin
**Escalation Notes:** stop if the live OpenAPI surface disagrees with the implemented S8 contract in a way that needs product or contract-shape approval
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** serena | swagger | prismaLocal

---

## What
Run the final live Swagger verification pass for the S8 gamification HTTP surface.

## Why
S8 adds new REST endpoints, and the queue should only be considered complete once the running backend exposes the documented mastery and leaderboard contracts.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `tasks/api-verification-driver.md` is used for the final S8 runtime verification pass
- [x] The running backend exposes `GET /v1/fitness/mastery` and `GET /v1/fitness/leaderboard`
- [ ] Protected route auth and documented success schemas match the implemented contract
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
- `context/s8-gamification.md`
- `tasks/s8-gamification/README.md`
- `tasks/s8-gamification/execution.md`
- `tasks/s8-gamification/decisions.md`

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
- `Read tasks/api-verification-driver.md and follow it.`

---

## PLANNER OUTPUT
Review reserved this as the final S8 task because the domain adds new HTTP routes and the shared driver expects live Swagger verification only after build, tests, and lint are green.

Implementation plan:
- finish all code-level S8 slices first
- run the API verification driver against the live backend
- fix only confirmed contract mismatches that surface during runtime verification
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
- No application code changes were made in this run.
- This task stayed in the findings-only verification lane while the live S8 contract was checked against the current controller and DTO surface.
MCPs used: none

---

## TESTER REPORT
- Code-level verification was already green before this runtime pass:
  - `npm.cmd run build`
  - `npm.cmd test -- --runInBand`
  - `npm.cmd run test:e2e -- --runInBand`
  - `npm.cmd run lint:check`
- `prismaLocal migrate status` reports `7 migrations found in prisma/migrations` and `Database schema is up to date!`.
- `http://localhost:3000/v1/docs-json` was reachable during this run, so the live Swagger verification could proceed without another backend startup retry.
- The running backend exposes both targeted S8 routes:
  - `GET /v1/fitness/mastery`
  - `GET /v1/fitness/leaderboard`
- Live auth verification confirms both routes are still protected and return `401` without a bearer token.
- The served OpenAPI document matches the intended S8 surface for:
  - mastery query parameters `muscle_group` and `rank`
  - leaderboard pagination query parameters `page` and `limit`
  - shared bearer auth via the `access-token` security scheme
  - success envelopes that publish `data` arrays for both routes and `meta` pagination fields for the leaderboard
- Live OpenAPI findings from this verification pass:
  - `MuscleMasteryResponseDTO.last_ranked_at` is published as `type: object, nullable: true` even though the implementation returns an ISO timestamp string or `null`.
  - `LeaderboardEntryResponseDTO.avatar_url` is published as `type: object, nullable: true` even though the implementation returns a URL string or `null`.
- No secret-field leak or missing S8 endpoint was surfaced in this pass.
- The remaining work is a narrow Swagger contract-alignment follow-up queued as `TASK-806`.
MCPs used: serena, swagger, prismaLocal
