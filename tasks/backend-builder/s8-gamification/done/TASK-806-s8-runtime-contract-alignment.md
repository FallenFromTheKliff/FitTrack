# TASK-806 - S8 Runtime Contract Alignment
**Task ID:** TASK-806
**Domain:** S8 - Gamification
**Status:** done
**Branch:** feat/TASK-806-s8-runtime-contract-alignment
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P2
**Depends On:** TASK-805
**Blocks:** none
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** the live S8 Swagger surface still diverges after the focused DTO/decorator fix is running locally
**Escalation Notes:** ask only if the running backend cannot be refreshed locally or if the runtime mismatch turns out to need a broader S8 API redesign
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** swagger | serena

---

## What
Align the S8 gamification Swagger contract with the live runtime findings from `TASK-805`.

## Why
The S8 runtime verification pass confirmed the routes and auth boundaries, but the served OpenAPI document still mis-types the nullable string fields on the mastery and leaderboard response DTOs.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Publish `MuscleMasteryResponseDTO.last_ranked_at` as `string | null` in the live OpenAPI schema instead of `object | null`
- [x] Publish `LeaderboardEntryResponseDTO.avatar_url` as `string | null` in the live OpenAPI schema instead of `object | null`
- [x] Preserve current S8 route behavior outside the documentation/contract alignment scope
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
- `tasks/api-verification-driver.md`

## Module Hints
- `capstone-backend/src/fitness`
- `capstone-backend/test`

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
- Keep this as a narrow S8 follow-up from runtime verification rather than reopening the completed gamification feature work.
- Fix only the confirmed live-contract mismatch from `TASK-805`:
  - make the nullable `last_ranked_at` Swagger property publish as a string field
  - make the nullable `avatar_url` Swagger property publish as a string field
- Re-run the API verification driver after the updated backend process is serving the new S8 OpenAPI document.
MCPs used: swagger

---

## CODER OUTPUT
- Added explicit scalar Swagger metadata to the two nullable S8 response properties so the live OpenAPI contract publishes them as strings instead of generic objects.
- Updated file:
  - `capstone-backend/src/fitness/gamification/dto/gamification.dto.ts`
MCPs used: serena

---

## TESTER REPORT
- Verification passed on the final S8 contract-alignment state.
- Checks run:
  - `npm.cmd run build`
  - `npm.cmd test -- --runInBand`
  - `npm.cmd run test:e2e -- --runInBand`
  - `npm.cmd run lint:check`
- Swagger MCP was rechecked first against `http://localhost:3000/v1/docs-json`, but that host-owned local backend was still serving a stale pre-fix document.
- Final live verification used a fresh inline FitTrack boot on temporary port `43111` and inspected the served `/v1/docs-json` contract for the targeted S8 routes before stopping that process cleanly.
- The live runtime contract now confirms:
  - `MuscleMasteryResponseDTO.last_ranked_at` is published as `type: string, nullable: true`
  - `LeaderboardEntryResponseDTO.avatar_url` is published as `type: string, nullable: true`
  - `GET /v1/fitness/mastery` still publishes `muscle_group` and `rank` query parameters plus bearer auth
  - `GET /v1/fitness/leaderboard` still publishes `page` and `limit` query parameters plus bearer auth
  - both protected S8 routes still return `401` without a bearer token on the fresh runtime instance
- No new S8 route, auth, or secret-field mismatch was surfaced during this follow-up runtime pass.
MCPs used: serena, swagger
