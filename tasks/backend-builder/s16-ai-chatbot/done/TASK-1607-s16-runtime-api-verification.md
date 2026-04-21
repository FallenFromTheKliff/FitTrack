# TASK-1607 - S16 Runtime API Verification
**Task ID:** TASK-1607
**Domain:** S16 - AI Chatbot
**Status:** done
**Branch:** feat/TASK-1607-s16-runtime-api-verification
**Created:** 2026-03-29
**Completed:** 2026-03-30
**Priority:** P2
**Depends On:** TASK-1606
**Blocks:** none
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** none
**Stop If:** stop if live auth, route shape, or grounded reply semantics reveal a product or contract ambiguity instead of a straightforward implementation mismatch
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** yes
**Preferred MCPs:** prismaLocal | swagger

---

## What
Run the separate runtime API verification driver for the completed S16 `gym-chat` HTTP surface and resolve any live contract mismatch it exposes.

## Why
S16 adds new authenticated member and admin routes plus a live Python chat boundary, so the final confidence pass needs real OpenAPI and runtime behavior instead of static checks alone.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `tasks/api-verification-driver.md` is run against the completed S16 `gym-chat` scope after build, relevant tests, and lint pass
- [x] Live member and admin `gym-chat` routes match the documented contract
- [x] Auth and role requirements match the intended live behavior
- [x] Any fixable contract mismatch is routed back into the relevant S16 implementation slice before retrying
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
- `context/python/s16-ai-chatbot.md`
- `tasks/s16-ai-chatbot/README.md`
- `tasks/s16-ai-chatbot/execution.md`
- `tasks/s16-ai-chatbot/decisions.md`
- `tasks/api-verification-driver.md`

## Module Hints
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
Implementation plan for `TASK-1607`:

1. Rewrite the shared API verification driver from the stale S15 pose scope to the active S16 gym-chat scope before attempting any live Swagger pass.
   - update `tasks/api-verification-driver.md` so its session variables point to:
     - `DOMAIN_FOLDER: tasks/s16-ai-chatbot`
     - `DOMAIN_CODE: S16`
     - `DOMAIN_NAME: AI Chatbot`
     - `DOMAIN_CONTEXT_FILE: context/python/s16-ai-chatbot.md`
     - `CURRENT_TASK_FILE: tasks/s16-ai-chatbot/active/TASK-1607-s16-runtime-api-verification.md`
     - local Nest `APP_BASE_URL` and `OPENAPI_URL`
     - `BACKEND_WORKDIR: capstone-backend`
     - `BACKEND_START_COMMAND: npm.cmd run start`
     - `BACKEND_FALLBACK_START_COMMAND: npm.cmd run start:dev`
     - `AUTO_START_BACKEND: yes`
     - `STARTUP_WAIT_SECONDS: 25`
     - an `API_VERIFICATION_SCOPE` that names the completed S16 member and admin routes:
       - `POST /v1/gym-chat/messages`
       - `GET /v1/gym-chat/sessions`
       - `GET /v1/gym-chat/sessions/{id}/messages`
       - `DELETE /v1/gym-chat/sessions/{id}`
       - `GET/PUT /v1/gym-chat/knowledge/hours`
       - `GET/POST /v1/gym-chat/knowledge/special-schedules`
       - `GET/POST /v1/gym-chat/knowledge/promotions`
       - `GET/POST /v1/gym-chat/knowledge/faqs`

2. Replace the driver precondition block with the real S16 green-check baseline that already exists.
   - update `REQUIRED_CHECKS_PASSED` in `tasks/api-verification-driver.md` to reflect the S16 checks that are already green before the live pass:
     - `uv run pytest tests/test_gym_chat_api.py tests/test_pose_api.py`
     - `npm.cmd test -- --runInBand src/ai/gym-chat.controller.spec.ts src/ai/gym-chat.service.spec.ts src/ai/gym-chat-session.repository.spec.ts src/ai/gym-chat-message.repository.spec.ts src/ai/gym-chat-interaction-log.repository.spec.ts src/ai/ai-python-client.service.spec.ts`
     - `npm.cmd run test:e2e -- --runInBand test/gym-chat.e2e-spec.ts`
     - `npm.cmd test -- --runInBand src/ai/ai-python-client.integration.spec.ts`
     - `npm.cmd test -- --runInBand src/ai/gym-knowledge.controller.spec.ts src/ai/gym-knowledge.service.spec.ts src/ai/gym-knowledge.repository.spec.ts`
     - `npm.cmd run test:e2e -- --runInBand test/gym-knowledge.e2e-spec.ts`
     - `npm.cmd run build`
     - `npm.cmd run lint:check`
   - replace the stale pose module hints with the S16 runtime owners:
     - `capstone-backend/src/ai`
     - `capstone-backend/src/app.module.ts`
     - `capstone-backend/test`
     - `ai-microservice`

3. Prepare a deterministic local runtime strategy for auth and data instead of depending on unknown seeded credentials.
   - use the repo `JWT_SECRET` to mint local member and admin Bearer tokens with the expected `JwtPayload` shape
   - create the smallest temporary local fixtures needed for live verification:
     - one active member user and one active admin user
     - one member-owned active `GymChatSession`
     - message rows for the session-history route
     - knowledge rows for hours, schedules, promotions, and FAQs where the live admin reads or writes need stable data
   - keep fixture prep minimal and local to the runtime pass, then clean it up afterward

4. Keep the FastAPI dependency explicit during the live `POST /v1/gym-chat/messages` verification.
   - start the local Python app alongside the Nest backend because the live send-message route depends on `/chat/gym`
   - use the existing local `AI_API_BASE_URL` convention so the live Nest backend points to the temporary FastAPI process during the pass
   - do not change application code in this task unless the live pass exposes a real contract mismatch

5. Run the API verification driver as the actual implementation step and keep the pass findings-first.
   - inspect the live OpenAPI document with Swagger MCP once the backend is reachable
   - compare the live S16 member and admin route shapes, auth requirements, status codes, and response envelopes against:
     - `context/python/s16-ai-chatbot.md`
     - `context/00-global-contracts.md`
     - `capstone-backend/src/ai/gym-chat.controller.ts`
     - `capstone-backend/src/ai/gym-knowledge.controller.ts`
   - explicitly verify:
     - member JWT protection and member-owned session behavior
     - admin-only knowledge-route access
     - response-envelope shape
     - expected `200` vs `201` status codes
     - the live grounded send-message contract while the FastAPI service is reachable

6. Scope guard for implementation.
   - expected code edits in this task should stay limited to `tasks/api-verification-driver.md` and task-tracking files unless the live runtime pass reveals a real S16 contract mismatch
   - if a live mismatch is fixable and local to S16, route back into the same domain task flow and retry the driver after the fix
   - do not broaden this task into new feature work beyond the runtime verification findings

Files expected to be touched:
- `tasks/api-verification-driver.md`
- `tasks/s16-ai-chatbot/active/TASK-1607-s16-runtime-api-verification.md`
- task-tracking files only if the runtime pass completes or reveals a blocker

Verification target for implementation:
- rerun the already-green S16 checks only if the live pass changes application code
- run `Read tasks/api-verification-driver.md and follow it.` with the rewritten S16 session variables
- inspect the live OpenAPI plus the scoped S16 member and admin `gym-chat` endpoints

Runtime-task boundary:
- `TASK-1607` is the dedicated live verification slice, so implementation should stay focused on the shared API driver rewrite plus the real Swagger-backed runtime pass instead of regular feature development

MCPs used: prismaLocal

---

## CODER OUTPUT
Rewrote the shared runtime verification driver and completed the live S16 `gym-chat` verification pass against a real local Nest backend plus the local FastAPI gym-chat service.

Driver update completed:
- `tasks/api-verification-driver.md`
  - rewritten from the stale S15 pose scope to the S16 `gym-chat` scope
  - updated required checks, module hints, and endpoint scope for:
    - `POST /v1/gym-chat/messages`
    - `GET /v1/gym-chat/sessions`
    - `GET /v1/gym-chat/sessions/{id}/messages`
    - `DELETE /v1/gym-chat/sessions/{id}`
    - `GET/PUT /v1/gym-chat/knowledge/hours`
    - `GET/POST /v1/gym-chat/knowledge/special-schedules`
    - `GET/POST /v1/gym-chat/knowledge/promotions`
    - `GET/POST /v1/gym-chat/knowledge/faqs`

Runtime setup completed:
- started the local FastAPI service on `127.0.0.1:8000`
- started the local Nest backend on `127.0.0.1:3000` with `AI_API_BASE_URL=http://127.0.0.1:8000`
- created temporary local member and admin runtime users plus signed JWTs using the repo `JWT_SECRET`
- used API writes for temporary knowledge fixtures and member chat-session creation instead of permanent seeded data

Live Swagger and endpoint checks passed:
- Swagger/OpenAPI at `http://127.0.0.1:3000/v1/docs-json` exposes the full scoped S16 surface
- `GET /v1/gym-chat/sessions` without a token -> `401`
- `GET /v1/gym-chat/sessions` with a member token -> `200`
- `GET /v1/gym-chat/knowledge/hours` with a member token -> `403`
- `GET /v1/gym-chat/knowledge/hours` with an admin token -> `200`
- `PUT /v1/gym-chat/knowledge/hours` with an admin token -> `200`
- `POST /v1/gym-chat/knowledge/special-schedules` with an admin token -> `201`
- `POST /v1/gym-chat/knowledge/promotions` with an admin token -> `201`
- `POST /v1/gym-chat/knowledge/faqs` with an admin token -> `201`
- `GET` list reads for special schedules, promotions, and FAQs with an admin token -> `200` paginated envelopes
- `POST /v1/gym-chat/messages` with a member token -> `200` grounded reply envelope
- `GET /v1/gym-chat/sessions/{id}/messages` with the owning member token -> `200`
- `DELETE /v1/gym-chat/sessions/{id}` with the owning member token -> `200`
- `POST /v1/gym-chat/messages` back into the archived session -> `410`

Live behavior matched the documented S16 contract:
- member auth and admin-role gates behaved as intended
- the public response envelope matched `context/00-global-contracts.md`
- `POST /v1/gym-chat/messages` returned `200`, not `201`
- knowledge-create routes returned `201`
- grounded assistant messages persisted `grounded_sources` and `out_of_scope` through the live read surface

No S16 implementation mismatch was found during the live pass, so no follow-up repair slice was needed.

Cleanup completed:
- restored the operating-hours surface to its original empty active state
- removed the temporary special schedule, promotion, FAQ, gym-chat session, interaction-log, and runtime user fixtures from the local dev database
- stopped the temporary backend and FastAPI processes
- removed temporary runtime log files

MCPs used: prismaLocal, swagger

---

## TESTER REPORT
The S16 runtime API verification passed cleanly after the shared driver rewrite.

What was verified:
- `tasks/api-verification-driver.md` now points at the S16 `gym-chat` scope and was used as the live verification source of truth.
- The live Swagger surface exposes the full scoped S16 member and admin routes:
  - `POST /v1/gym-chat/messages`
  - `GET /v1/gym-chat/sessions`
  - `GET /v1/gym-chat/sessions/{id}/messages`
  - `DELETE /v1/gym-chat/sessions/{id}`
  - `GET/PUT /v1/gym-chat/knowledge/hours`
  - `GET/POST /v1/gym-chat/knowledge/special-schedules`
  - `GET/POST /v1/gym-chat/knowledge/promotions`
  - `GET/POST /v1/gym-chat/knowledge/faqs`
- Live auth and role behavior matches the intended contract:
  - unauthenticated member-session read -> `401`
  - member session list and message flow -> `200`
  - member access to admin knowledge routes -> `403`
  - admin knowledge reads/writes -> `200` or `201` as documented
  - archived-session send-message retry -> `410`
- The live grounded message flow returns the expected wrapped payload, persists assistant grounded sources, and surfaces them through the session-history read route.

Checks run:
- `npm.cmd run build`: passed
- `npm.cmd run lint:check`: passed
- `npm.cmd run test:e2e -- --runInBand test/gym-chat.e2e-spec.ts test/gym-knowledge.e2e-spec.ts`: passed (`2` suites, `7` tests)
- `uv run pytest tests/test_gym_chat_api.py tests/test_pose_api.py`: passed (`15` tests)
- live Swagger/OpenAPI verification against `http://localhost:3000/v1/docs-json`: passed for the scoped S16 `gym-chat` endpoints
- `prismaLocal migrate_status`: database schema up to date with `13` migrations

Cleanup verified:
- no active temporary operating hours remain
- temporary special-schedule, promotion, FAQ, runtime session, and runtime user fixtures are gone
- temporary backend and FastAPI processes were stopped
- temporary runtime log files were removed

Outcome:
- `TASK-1607` is complete and can be moved to `done/`
- the S16 domain queue is complete

MCPs used: prismaLocal, swagger
