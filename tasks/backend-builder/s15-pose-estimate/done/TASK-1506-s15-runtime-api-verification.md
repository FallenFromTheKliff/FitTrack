# TASK-1506 - S15 Runtime API Verification
**Task ID:** TASK-1506
**Domain:** S15 - Pose Estimate
**Status:** done
**Branch:** feat/TASK-1506-s15-runtime-api-verification
**Created:** 2026-03-29
**Completed:** 2026-03-29
**Priority:** P2
**Depends On:** TASK-1505
**Blocks:** none
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** none
**Stop If:** stop if live auth, route shape, or finalize semantics reveal a product or contract ambiguity instead of a straightforward implementation mismatch
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** serena | prismaLocal | swagger

---

## What
Run the separate runtime API verification driver for the completed S15 pose HTTP surface and resolve any live contract mismatch it exposes.

## Why
S15 adds new authenticated pose endpoints and depends on a live Python service boundary, so the final confidence pass needs real OpenAPI and runtime behavior instead of static build and test checks alone.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `tasks/api-verification-driver.md` is run against the S15 pose HTTP surface after build, relevant tests, and lint pass
- [x] Live pose session finalize, session read, and profile-list routes match the documented contract
- [x] Auth and role requirements match the intended live behavior
- [x] Any fixable contract mismatch is routed back into the relevant S15 implementation slice before retrying
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
- `context/python/00-python-microservice-contracts.md`
- `context/python/s15-pose-estimate.md`
- `tasks/s15-pose-estimate/README.md`
- `tasks/s15-pose-estimate/execution.md`
- `tasks/s15-pose-estimate/decisions.md`
- `tasks/api-verification-driver.md`

## Module Hints
- `capstone-backend/src/fitness/pose`
- `capstone-backend/src/ai`
- `capstone-backend/src/app.module.ts`
- `capstone-backend/test`
- `ai-microservice`

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
Implementation plan for `TASK-1506`:

1. Rewrite the shared API verification driver session variables from the stale S14 audit scope to the S15 pose runtime scope before running any live verification.
   - Update `tasks/api-verification-driver.md` so its session variables point to:
     - `DOMAIN_FOLDER: tasks/s15-pose-estimate`
     - `DOMAIN_CODE: S15`
     - `DOMAIN_NAME: Pose Estimate`
     - `DOMAIN_CONTEXT_FILE: context/python/s15-pose-estimate.md`
     - `CURRENT_TASK_FILE: tasks/s15-pose-estimate/active/TASK-1506-s15-runtime-api-verification.md`
     - `APP_BASE_URL` / `OPENAPI_URL` for the local Nest backend
     - `BACKEND_WORKDIR: capstone-backend`
     - `BACKEND_START_COMMAND: npm.cmd run start`
     - `BACKEND_FALLBACK_START_COMMAND: npm.cmd run start:dev`
     - `AUTO_START_BACKEND: yes`
     - `STARTUP_WAIT_SECONDS: 25`
     - `API_VERIFICATION_SCOPE: S15 pose routes: /v1/pose/sessions/{id}, /v1/pose/sessions/{id}/finalize, /v1/pose/profiles`
   - Replace the old required-check list with the checks already completed for S15:
     - `uv run pytest`
     - `npm.cmd test -- --runInBand test/pose.integration.spec.ts src/ai/ai-python-client.integration.spec.ts src/ai/ai-python-client.service.spec.ts`
     - `npm.cmd run build`
     - `npm.cmd run lint:check`

2. Prepare the runtime dependencies needed for a meaningful live pose verification pass.
   - Confirm the Nest backend can load its local `.env` and expose `OPENAPI_URL`.
   - Confirm `AI_API_BASE_URL` is configured for the backend runtime and keep the FastAPI pose app running during the pass, because manual finalize on an open pose session calls the Python finalize contract.
   - Do not change application code in this step; this is runtime setup only.

3. Use a controlled local auth strategy for live verification instead of depending on unknown seeded login credentials.
   - Generate local member and admin Bearer JWTs using the repo’s configured `JWT_SECRET`, because the runtime guards validate JWT payloads plus Redis blacklist state and do not require a login-only session primitive.
   - Use `prismaLocal` only as needed to discover or create compatible live fixture rows for an active member-owned `PoseSession` and any optional pose-profile data used in the route checks.
   - Keep fixture prep minimal and local to the runtime pass.

4. Establish the smallest live dataset needed to verify the three pose routes.
   - Ensure one member-owned `PoseSession` exists for:
     - `GET /v1/pose/sessions/{id}` success with the matching member token
     - `POST /v1/pose/sessions/{id}/finalize` success on an open session while the FastAPI service is reachable
   - Exercise `GET /v1/pose/profiles` with:
     - admin token -> expected `200` paginated envelope
     - member token -> expected `403`
   - Also verify the unauthorized path with no Bearer token where that adds value.

5. Run the S15 runtime API verification driver and keep the pass findings-first.
   - Use Swagger MCP against `OPENAPI_URL` to inspect the live OpenAPI surface for the three scoped pose endpoints.
   - Compare the live route shapes, auth requirements, and response envelopes against:
     - `context/python/s15-pose-estimate.md`
     - `context/00-global-contracts.md`
     - `capstone-backend/src/fitness/pose/pose.controller.ts`
     - `capstone-backend/src/fitness/pose/dto/pose.dto.ts`
   - Record any mismatch as either:
     - runtime-driver/configuration work to fix in this task, or
     - a follow-up implementation defect to route back into the same domain task loop before retrying.

6. Scope guard for implementation.
   - Expected code edits in this task should stay limited to `tasks/api-verification-driver.md` and task-tracking files unless the live runtime pass reveals a real backend mismatch.
   - Do not broaden this task into new feature work; if runtime verification exposes a contract bug, stop and report or route back according to the driver rules.

Files expected to be touched:
- `tasks/api-verification-driver.md`
- `tasks/s15-pose-estimate/active/TASK-1506-s15-runtime-api-verification.md`
- task-tracking files only if the runtime pass completes or reveals a blocker

Verification target for implementation:
- rerun the already-green S15 checks only if the runtime pass changes app code
- run `Read tasks/api-verification-driver.md and follow it.` with the S15 session variables
- inspect live OpenAPI plus the scoped pose endpoints

Non-auto-eligible boundary:
- `TASK-1506` is marked `Auto-Eligible: no`, so stop after planning and wait for explicit confirmation before running the live runtime verification implementation step.

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Rewrote the shared runtime verification driver and executed the live S15 pose verification pass against a real local backend plus FastAPI pose service.

Runtime setup completed:
- `tasks/api-verification-driver.md`
  - rewritten from the stale S14 audit scope to the S15 pose scope
  - updated required checks, module hints, and endpoint scope for:
    - `GET /v1/pose/sessions/{id}`
    - `POST /v1/pose/sessions/{id}/finalize`
    - `GET /v1/pose/profiles`
- Started the local FastAPI pose service on `127.0.0.1:8000`
- Started the local Nest backend on `127.0.0.1:3000` with `AI_API_BASE_URL` pointed at the FastAPI service for the duration of the pass
- Created temporary local runtime fixtures:
  - active member/admin users in the dev DB
  - one active pose profile
  - one open member-owned pose session
  - matching local JWTs signed with the repo `JWT_SECRET`
  - a matching bootstrapped/analyzed Python pose session under the same `pose_session_id`

Live checks completed successfully:
- `GET /v1/pose/sessions/{id}` with the owning member token -> `200`
- `GET /v1/pose/sessions/{id}` with an admin token for someone else’s session -> `403`
- `GET /v1/pose/profiles` with an admin token -> `200`
- `GET /v1/pose/profiles` with a member token -> `403`
- `GET /v1/pose/profiles` without a token -> `401`
- filtered `GET /v1/pose/profiles?profile_kind=seed&canonical_name=squat&page=1&limit=20` with an admin token -> `200`
- `GET /v1/pose/sessions/{id}` after finalize -> `200` with the persisted S15 summary fields

Blocking runtime mismatch found:
- `POST /v1/pose/sessions/{id}/finalize` is documented and coded as a normal success response, but the live route currently returns `201 Created` instead of `200 OK`.
- This is a real contract mismatch because the OpenAPI entry and task/context expectations are `200`, while Nest defaults bare `POST` handlers to `201` unless `@HttpCode(200)` is applied.
- The runtime pass should stop here and route back to a small backend fix before retrying `TASK-1506`.

Cleanup completed:
- removed the temporary pose-session/profile/user fixtures from the local dev database
- stopped the temporary backend and FastAPI processes
- removed temporary runtime log files

Follow-up implementation after the first runtime pass:
- `capstone-backend/src/fitness/pose/pose.controller.ts`
  - added `@HttpCode(200)` to `finalizeSession(...)` so the live POST finalize route returns the documented status code instead of Nest's default `201`

Code checks rerun after the fix:
- `npm.cmd test -- --runInBand test/pose.integration.spec.ts src/fitness/pose/pose.controller.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: serena, prismaLocal, swagger

---

## TESTER REPORT
The S15 runtime API verification rerun passed after the finalize-route status fix.

What was verified:
- `tasks/api-verification-driver.md` now points at the S15 pose scope and was used as the live verification source of truth.
- The live Swagger surface still exposes:
  - `GET /v1/pose/sessions/{id}`
  - `POST /v1/pose/sessions/{id}/finalize`
  - `GET /v1/pose/profiles`
- Live auth and ownership behavior matches the intended contract:
  - owner session read -> `200`
  - non-owner admin session read/finalize -> `403`
  - admin profile list -> `200`
  - member profile list -> `403`
  - unauthenticated profile list -> `401`
- The live finalize route now returns `200 OK` and persists the expected S15 summary fields after the Python finalize pass.

Checks run:
- `npm.cmd test -- --runInBand test/pose.integration.spec.ts src/fitness/pose/pose.controller.spec.ts`: passed (`1` suite, `5` tests)
- `npm.cmd run build`: passed
- `npm.cmd run lint:check`: passed
- live Swagger/OpenAPI verification against `http://localhost:3000/v1/docs-json`: passed for the scoped S15 pose endpoints
- `prismaLocal migrate_status`: database schema up to date with `12` migrations

Runtime endpoints checked successfully:
- `GET /v1/pose/sessions/{id}`
- `POST /v1/pose/sessions/{id}/finalize`
- `GET /v1/pose/profiles`

Cleanup completed:
- removed temporary runtime fixtures from the dev database
- stopped the temporary backend and FastAPI processes
- removed temporary runtime log files

Outcome:
- `TASK-1506` is complete and can be moved to `done/`.
- The S15 domain queue is complete.

MCPs used: serena, prismaLocal, swagger
