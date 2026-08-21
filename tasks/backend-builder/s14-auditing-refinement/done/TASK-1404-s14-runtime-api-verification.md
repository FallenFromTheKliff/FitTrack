# TASK-1404 - S14 Runtime API Verification
**Task ID:** TASK-1404
**Domain:** S14 - Auditing Refinement
**Status:** done
**Branch:** feat/TASK-1404-s14-runtime-api-verification
**Created:** 2026-03-28
**Completed:** 2026-03-28
**Priority:** P2
**Depends On:** TASK-1403
**Blocks:** none
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** none
**Stop If:** stop if live OpenAPI or auth behavior reveals a product, role, or contract ambiguity instead of a straightforward implementation mismatch
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** serena | prismaLocal | swagger

---

## What
Run the separate runtime API verification driver for the completed S14 audit HTTP surface and resolve any live contract mismatches it exposes.

## Why
S14 adds new admin endpoints, so the final confidence check should happen against the live backend and OpenAPI output rather than stopping at static build and test results.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `tasks/api-verification-driver.md` is run against the S14 HTTP surface after build, relevant tests, and lint pass
- [x] Live `/v1/audit` and `/v1/audit/:id` routes match the documented contract
- [x] Auth and role requirements match the intended live behavior
- [x] Any fixable contract mismatch is routed back into the relevant S14 implementation slice before retrying
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
- `context/s14-auditing.md`
- `tasks/s14-auditing-refinement/README.md`
- `tasks/s14-auditing-refinement/execution.md`
- `tasks/s14-auditing-refinement/decisions.md`
- `tasks/api-verification-driver.md`

## Module Hints
- `capstone-backend/src/audit`
- `capstone-backend/src/app.module.ts`
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
S14 is an HTTP-facing domain once the audit read endpoints land, so the final task is reserved for the separate runtime verification driver after the implementation and coverage slices are green. This keeps live Swagger and route verification explicit instead of burying it inside a normal test task.

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Ran the separate runtime API verification flow using `tasks/api-verification-driver.md` against the live S14 audit surface at `http://localhost:3000/v1/docs-json`. The backend was already reachable, so no startup or fallback command was needed. Live Swagger shows both `GET /v1/audit` and `GET /v1/audit/{id}` with the expected summaries, bearer security, and query/path parameters.

For live route verification, I generated local HS256 JWTs that match the repo's `JwtPayload` contract, then checked the audit routes directly:
- no token -> `401 UNAUTHORIZED`
- member token -> `403 FORBIDDEN`
- admin token -> `200 OK`

The dev DB initially had no audit rows, so I inserted one temporary local verification row to exercise the `200` detail path on `/v1/audit/{id}`, validated both live `200` responses against the Swagger schema, confirmed the detail route returns `404` for a missing UUID, and then deleted the temporary verification row so the local DB was restored to its original empty-audit state.

MCPs used: serena, prismaLocal, swagger

---

## TESTER REPORT
Runtime verification passed. Live Swagger lists:
- `GET /v1/audit`
- `GET /v1/audit/{id}`

Live behavior matched the intended contract:
- `GET /v1/audit` returns the documented envelope with `data` and `meta`
- `GET /v1/audit/{id}` returns the documented single-item envelope and `404` on a missing UUID
- both routes require bearer auth and enforce admin-only access in live execution (`401` without a token, `403` with a member token, `200` with an admin token)
- the returned audit actor shape excludes secret fields; the live payload contains only the documented safe audit fields

Checks relied on for this pass:
- `npm.cmd run build`
- `npm.cmd test -- --runInBand src/audit src/coaching/coach`
- `npm.cmd run lint:check`

No implementation mismatch was found, so no follow-up fix task was needed.

MCPs used: serena, prismaLocal, swagger
