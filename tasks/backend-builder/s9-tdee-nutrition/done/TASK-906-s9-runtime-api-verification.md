# TASK-906 - S9 Runtime API Verification
**Task ID:** TASK-906
**Domain:** S9 - TDEE & Nutrition
**Status:** done
**Branch:** feat/TASK-906-s9-runtime-api-verification
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P2
**Depends On:** TASK-905
**Blocks:** none
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** none
**Stop If:** stop if build, relevant tests, or lint are not green before live verification starts
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** serena | swagger

---

## What
Run the live S9 runtime and Swagger verification pass after the nutrition module work and tests are green.

## Why
S9 adds a new authenticated HTTP surface, so the final domain slice should validate the live contract instead of stopping at code-level checks alone.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `tasks/api-verification-driver.md` is used for the live S9 verification pass
- [x] The live OpenAPI document reflects the implemented `/v1/nutrition/*` routes and auth requirements
- [x] Any runtime-only contract mismatches are documented and either fixed or converted into a focused follow-up task
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
- `capstone-backend/src/nutrition`
- `capstone-backend/src/user`
- `capstone-backend/src/common`

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
The S9 context defines a fully HTTP-facing nutrition surface, so the final domain slice should be a dedicated runtime verification pass rather than bundling live OpenAPI inspection into earlier implementation work. This keeps code fixes and contract verification separate, which matches the existing domain-driver pattern.

Implementation plan:
- run build, relevant tests, and lint first
- use the API verification driver for live backend startup and Swagger inspection
- convert any runtime-only contract mismatch into either an immediate focused fix or a tightly scoped follow-up task, depending on the finding
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
No application code changed in this task. I used `tasks/api-verification-driver.md` for a live S9 verification pass against the running backend at `http://localhost:3000`, confirmed the pending checked-in S9 migration baseline, and applied `20260327123000_s9_nutrition_guards_and_units` with `npx.cmd prisma migrate deploy` before the Swagger pass so the local runtime matched the checked-in schema state.

Live OpenAPI verification confirmed all eight nutrition endpoints are present under `/v1/nutrition/*`, each route advertises the `access-token` bearer scheme, and the documented success envelopes match the controller contract:
- object envelopes for `GET /tdee`, `POST /tdee/recalculate`, `POST /logs`, and `GET /daily-summary`
- paginated `data + meta` envelopes for `GET /tdee/history` and `GET /logs`

No runtime-only contract mismatches were found, so no follow-up task was created.
MCPs used: serena, prismaLocal, swagger

---

## TESTER REPORT
Runtime verification passed.

Checks confirmed before and during the live pass:
- local Prisma status: up to date after `npx.cmd prisma migrate deploy`
- `http://localhost:3000/v1/docs-json` reachable
- Swagger/OpenAPI contains:
  - `GET /v1/nutrition/tdee`
  - `GET /v1/nutrition/tdee/history`
  - `POST /v1/nutrition/tdee/recalculate`
  - `POST /v1/nutrition/logs`
  - `GET /v1/nutrition/logs`
  - `PATCH /v1/nutrition/logs/{id}`
  - `DELETE /v1/nutrition/logs/{id}`
  - `GET /v1/nutrition/daily-summary`
- each nutrition route exposes bearer auth via `access-token`
- unauthenticated live request to `GET /v1/nutrition/tdee` returned `401` with the expected JSON body:
  - `type: UNAUTHORIZED`
  - `title: Unauthorized`
  - `status: 401`
  - `detail: Invalid or missing authentication token.`

No mismatches were found between the live OpenAPI surface, the S9 task/context contract, and the current nutrition controller annotations.
MCPs used: serena, prismaLocal, swagger
