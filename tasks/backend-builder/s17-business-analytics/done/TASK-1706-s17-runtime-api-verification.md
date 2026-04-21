# TASK-1706 - S17 Runtime API Verification
**Task ID:** TASK-1706
**Domain:** S17 - Business Analytics
**Status:** done
**Branch:** feat/TASK-1706-s17-runtime-api-verification
**Created:** 2026-03-30
**Completed:** 2026-03-30
**Priority:** P1
**Depends On:** TASK-1705
**Blocks:** none
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if live auth, route shape, or insight payload semantics reveal a product or contract ambiguity instead of a straightforward implementation mismatch
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** prismaLocal | swagger

---

## What
Run the separate live runtime API verification pass over the completed S17 `business-analytics` HTTP surface.

## Why
S17 changes authenticated HTTP routes and a Nest-to-Python integration boundary, so the domain should close with a real Swagger-backed runtime check instead of compile-time confidence only.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] The API verification driver runs against the completed S17 surface
- [x] Swagger exposes the final S17 `business-analytics` routes with the expected auth and request/response shape
- [x] Live requests confirm the generate, history, and detail endpoints behave as implemented
- [x] Any runtime mismatch is either fixed in-domain or recorded as a blocker before closeout
- [x] Relevant tests pass
- [x] Build passes (`npm.cmd run build`)
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
- `context/python/s17-business-analytics.md`
- `tasks/s17-business-analytics/README.md`
- `tasks/s17-business-analytics/execution.md`
- `tasks/s17-business-analytics/decisions.md`
- `tasks/api-verification-driver.md`

## Module Hints
- `capstone-backend/src/analytics`
- `capstone-backend/src/ai`
- `capstone-backend/prisma`
- `ai-microservice/app`

## Task Size
- [ ] XS (< 30 lines changed)
- [x] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd run lint:check`
- `Read tasks/api-verification-driver.md and follow it.`

---

## PLANNER OUTPUT
Implementation plan for `TASK-1706`:

1. Rewrite the shared API verification driver from the stale S16 gym-chat scope to the active S17 business-analytics scope before attempting any live pass.
   - update `tasks/api-verification-driver.md` so its session variables point to:
     - `DOMAIN_FOLDER: tasks/s17-business-analytics`
     - `DOMAIN_CODE: S17`
     - `DOMAIN_NAME: Business Analytics`
     - `DOMAIN_CONTEXT_FILE: context/python/s17-business-analytics.md`
     - `CURRENT_TASK_FILE: tasks/s17-business-analytics/active/TASK-1706-s17-runtime-api-verification.md`
     - local Nest `APP_BASE_URL` and `OPENAPI_URL`
     - `BACKEND_WORKDIR: capstone-backend`
     - `BACKEND_START_COMMAND: npm.cmd run start`
     - `BACKEND_FALLBACK_START_COMMAND: npm.cmd run start:dev`
     - `AUTO_START_BACKEND: yes`
     - `STARTUP_WAIT_SECONDS: 25`
     - an `API_VERIFICATION_SCOPE` naming the completed S17 admin routes:
       - `POST /v1/business-analytics/insights`
       - `GET /v1/business-analytics/insights`
       - `GET /v1/business-analytics/insights/{id}`

2. Replace the driver precondition block with the real S17 green-check baseline that already exists.
   - update `REQUIRED_CHECKS_PASSED` in `tasks/api-verification-driver.md` to reflect the S17 checks that are already green before the live pass:
     - `npm.cmd test -- --runInBand src/analytics/business-analytics.controller.spec.ts src/analytics/business-analytics-insight.service.spec.ts src/analytics/business-insight-run.repository.spec.ts src/analytics/dto/business-analytics-insight.dto.spec.ts src/analytics/analytics.service.spec.ts src/ai/ai-python-client.service.spec.ts`
     - `uv run pytest tests/test_business_insights_api.py tests/test_business_insights_service.py`
     - `npm.cmd run build`
     - `npm.cmd run lint:check`
   - update the driver module hints to the S17 runtime owners:
     - `capstone-backend/src/analytics`
     - `capstone-backend/src/app.module.ts`
     - `capstone-backend/test`
     - `ai-microservice/app`

3. Prepare a deterministic local runtime baseline instead of depending on seeded accounts or external OpenRouter access.
   - because `prismaLocal migrate_status` still shows only the checked-in `20260330110000_s17_business_insight_contract_alignment` migration as unapplied and this task uses the `business_insight_runs` table live, apply that checked-in migration with `npx.cmd prisma migrate deploy` before the Swagger pass
   - create one temporary active admin `User` row with a fixed runtime UUID so the persisted `requested_by` foreign key succeeds during `POST /v1/business-analytics/insights`
   - mint a local admin Bearer token using the repo `JWT_SECRET` and the confirmed `JwtPayload` shape
   - mint one non-admin active token for the `403` role-gate check; this token does not need a persisted user row because the request should stop at `RolesGuard`

4. Keep the Python provider dependency deterministic during the live generate-insight verification.
   - start a temporary local OpenAI-compatible stub server that serves `POST /chat/completions` with a fixed valid S17 insight payload, `model`, and `usage.total_tokens`
   - start the local FastAPI app on `127.0.0.1:8000` with:
     - `OPENROUTER_API_KEY` set to a dummy value
     - `OPENROUTER_INSIGHT_MODEL` set to a fixed local test model name
     - `OPENROUTER_BASE_URL` pointed at the temporary stub server
   - start the local Nest backend on `127.0.0.1:3000` with `AI_API_BASE_URL=http://127.0.0.1:8000`
   - this keeps the live pass fully local while still exercising the real Nest -> Python -> provider-adapter -> response-validation chain

5. Run the API verification driver as the actual implementation step and keep the findings focused on the live S17 contract.
   - inspect the live OpenAPI document with Swagger MCP once the backend is reachable
   - compare the live route shapes, auth requirements, status codes, and response envelopes against:
     - `context/python/s17-business-analytics.md`
     - `context/00-global-contracts.md`
     - `capstone-backend/src/analytics/business-analytics.controller.ts`
     - `capstone-backend/src/analytics/dto/business-analytics-insight.dto.ts`
   - explicitly verify:
     - `401` for unauthenticated history access
     - `403` for non-admin access to the S17 routes
     - `201` plus wrapped detail payload for `POST /v1/business-analytics/insights`
     - `200` paginated envelope for `GET /v1/business-analytics/insights`
     - `200` wrapped detail payload for `GET /v1/business-analytics/insights/{id}`
     - the persisted run returned by history/detail reuses the live generated insight, including `summary`, narrative arrays, `model_used`, `token_count`, `latency_ms`, and safe requester fields only

6. Keep cleanup and scope tight.
   - use the created live insight run from the `POST` call as the fixture for the history and detail checks instead of inserting separate `BusinessInsightRun` rows
   - after the pass, delete the temporary runtime admin user and any created S17 insight rows keyed to that runtime user through a one-off local Prisma script so the local dev DB is not polluted
   - stop the temporary Nest backend, FastAPI service, and local provider-stub process, and remove any temporary runtime log files
   - do not broaden this task into new feature work; if the live pass exposes an implementation mismatch, report it and route back into the S17 task loop instead of fixing it inside the API driver chat

Files expected to be touched:
- `tasks/api-verification-driver.md`
- `tasks/s17-business-analytics/active/TASK-1706-s17-runtime-api-verification.md`
- task-tracking files only if the runtime pass completes or reveals a blocker

Verification target for implementation:
- use the already-green S17 checks recorded above as the runtime-driver precondition baseline
- run `Read tasks/api-verification-driver.md and follow it.` with the rewritten S17 session variables
- inspect the live OpenAPI plus the scoped S17 admin `business-analytics` endpoints

Runtime-task boundary:
- `TASK-1706` is the dedicated live verification slice, so implementation should stay focused on the shared API-driver rewrite plus the real Swagger-backed runtime pass instead of ordinary feature development
- because `AUTO_MODE = off`, if the live pass finds a mismatch the correct outcome is a clear blocker report, not an automatic same-chat fix loop

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Rewrote the shared runtime verification driver from the stale S16 gym-chat scope to the active S17 business-analytics scope.

Driver update completed:
- `tasks/api-verification-driver.md`
  - rewritten to the S17 `business-analytics` runtime scope
  - updated session variables for the active S17 task file, domain context, and local Nest OpenAPI endpoint
  - updated `API_VERIFICATION_SCOPE` to:
    - `POST /v1/business-analytics/insights`
    - `GET /v1/business-analytics/insights`
    - `GET /v1/business-analytics/insights/{id}`
  - replaced the stale S16 green-check list with the already-passing S17 focused Nest and Python checks
  - replaced the module hints with the S17 runtime owners under `src/analytics`, `src/app.module.ts`, `test`, and `ai-microservice/app`

Implementation notes:
- no application code changed in this phase; this pass only prepared the shared runtime driver and task handoff for the live Swagger verification step
- Prisma Local still reports the checked-in local migration `20260330110000_s17_business_insight_contract_alignment` as unapplied; the runtime verification phase should apply it before the live pass if it remains the only pending local migration
- the live Swagger verification itself was intentionally not run here because `CURRENT_PHASE = implement` and the separate API verification driver is the next-phase runtime step for this task

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Completed the live S17 runtime API verification pass through the rewritten `tasks/api-verification-driver.md` flow.

Runtime verification summary:
- Prisma Local first reported the checked-in `20260330110000_s17_business_insight_contract_alignment` migration as the only pending local guard migration, so the pass applied it with `npx.cmd prisma migrate deploy` before live persistence checks.
- Swagger exposed the final admin S17 surface at `http://localhost:3000/v1/docs-json`, including:
  - `POST /v1/business-analytics/insights`
  - `GET /v1/business-analytics/insights`
  - `GET /v1/business-analytics/insights/{id}`
- Live auth and role gates behaved as implemented:
  - unauthenticated `GET /v1/business-analytics/insights` -> `401`
  - non-admin `GET /v1/business-analytics/insights` -> `403`
- The admin happy path passed end to end with a temporary runtime admin user, local JWT, temporary OpenRouter-compatible stub, local FastAPI service, and local Nest backend:
  - `POST /v1/business-analytics/insights` -> `201`
  - `GET /v1/business-analytics/insights?focus=overview&period=custom&page=1&limit=10` -> `200`
  - `GET /v1/business-analytics/insights/{id}` -> `200`
- The created run persisted and returned the expected S17 payload shape across generate, history, and detail, including `summary`, narrative arrays, `model_used`, `token_count`, and `latency_ms`.
- Requester projection stayed safe in live responses: only `id`, `role`, `status`, and `profile` were returned, with no password, credential-hash, or token-hash style fields exposed.
- An initial harness `502` traced to a dead temporary provider stub rather than a product mismatch; after restarting the stub, the final live pass completed green with no remaining runtime blocker.
- The already-green S17 precondition baseline from `TASK-1705` remained the verification basis for focused Nest tests, focused Python tests, `npm.cmd run build`, and `npm.cmd run lint:check`; no application code changed during this runtime-only slice.
- Temporary runtime DB fixtures, temporary processes, runtime logs, and the temporary local provider stub file were cleaned up after verification.

Closeout result:
- runtime API verification completed successfully
- no product or contract blockers remain for S17
- `TASK-1706` has been moved to `done/`

MCPs used: serena, prismaLocal, swagger
