# TASK-1605 - Grounded Gym Chat Message Flow And Session Lifecycle
**Task ID:** TASK-1605
**Domain:** S16 - AI Chatbot
**Status:** done
**Branch:** feat/TASK-1605-grounded-gym-chat-message-flow-and-session-lifecycle
**Created:** 2026-03-29
**Completed:** 2026-03-30
**Priority:** P1
**Depends On:** TASK-1602, TASK-1603, TASK-1604
**Blocks:** TASK-1606, TASK-1607
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the grounded source selection, follow-up suggestion behavior, or out-of-scope refusal policy needs product clarification beyond the S16 context
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** prismaLocal | context7

---

## What
Wire the grounded S16 chat message flow across Nest and Python, including context assembly, reply persistence, grounded sources, follow-up suggestions, and session lifecycle behavior.

## Why
The domain is not complete until the new `gym-chat` routes can gather trusted gym knowledge, call the Python service, persist the result, and manage session reuse and archival safely.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Member message routes under `/v1/gym-chat/messages` call the S16 Python contract and persist both user and assistant messages
- [x] Grounding payload assembly includes the intended structured gym knowledge and relevant session history
- [x] Persisted responses store grounded sources, out-of-scope state, and follow-up suggestions needed by the S16 contract
- [x] Session lifecycle behavior follows the intended reuse and lazy archival rules without breaking the legacy AI flow
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

## Module Hints
- `capstone-backend/src/ai`
- `capstone-backend/src/membership`
- `capstone-backend/src/bookings`
- `capstone-backend/src/coaching`
- `ai-microservice`
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `uv run pytest`
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Implementation plan for `TASK-1605`:

1. Add the member write route for the S16 message flow without disturbing the finished read or admin surfaces.
   - extend `GymChatController` with `POST /v1/gym-chat/messages`
   - add a dedicated `SendGymChatMessageDTO` with optional `session_id` and bounded `message` validation from the S16 contract
   - add Swagger metadata for the send-message response so the new route stays aligned with the documented `gym-chat` surface

2. Add the write-side repository seams needed for the new S16 persistence lifecycle.
   - extend `GymChatSessionRepository` with create and active-session lookup helpers modeled after the legacy S11 chat session repository
   - extend `GymChatMessageRepository` with create helpers and a recent-history reader for grounding payload assembly
   - add a dedicated `GymChatInteractionLogRepository` for request, grounding, response, latency, model, token, and error logging against `gym_chat_interaction_logs`
   - keep all Prisma work additive against the existing S16 schema; do not mutate the legacy `AiChat*` tables or widen the Prisma contract in this task

3. Implement the grounded send-message lifecycle in `GymChatService`.
   - resolve the target session by owned `session_id` when supplied, or reuse the most recent active owned session when it is still within the accepted 14-day inactivity window from `decisions.md`
   - lazily archive inactive sessions and create a fresh active session when needed, mirroring the established S11 inactivity behavior without crossing into the legacy `/v1/ai/*` surface
   - seed a new session title from the opening user message when the session has no title yet
   - persist the user message and assistant reply as `GymChatMessage` rows, update `last_activity_at`, and keep the public response scoped to the current send-message contract

4. Build the S16 grounding payload inside Nest from the finished knowledge and membership seams.
   - assemble `operating_hours`, `special_schedules`, `promotions`, and `faqs` from `GymKnowledgeRepository`
   - assemble `membership_plans` from the existing `MembershipPlan` listing seam instead of introducing a new knowledge table
   - assemble bounded `session_history` from recent persisted `GymChatMessage` rows for the resolved session, excluding the just-created assistant reply
   - include minimal `user_context` only from safe member fields already available through repo-standard profile access patterns

5. Add an explicit S16 Python client boundary without mutating the legacy chat method.
   - extend `AiPythonClientService` with new `GymChat` request and response types plus a dedicated `/chat/gym` call path
   - preserve the existing legacy `/chat` method for S11 and keep the new `gym-chat` call separate
   - treat the current deterministic Python scaffold from `TASK-1604` as the integration target for this slice; do not broaden this task into live OpenRouter provider work unless the existing scaffold blocks contract completion

6. Persist S16 reply metadata and interaction logs in the places the current schema supports.
   - store `grounded_sources` and `out_of_scope` on the assistant `GymChatMessage`
   - return `follow_up_suggestions` in the send-message response and persist them inside `GymChatInteractionLog.response_payload`, following the earlier S16 decision not to invent a dedicated Prisma column for suggestions
   - log both success and failure paths with request, grounding payload, response payload, latency, model, token count, and error string where applicable

7. Keep the implementation and verification focused on the current slice.
   - do not change the existing member session list or message-history routes except where shared DTO or service wiring needs a narrow additive update
   - do not change the admin knowledge endpoints or the legacy `/v1/ai/*` flow in this task
   - add focused controller, service, repository, and integration coverage for:
     - successful grounded send-message flow with persistence
     - owned session reuse and lazy archival behavior
     - validation and auth failures
     - interaction-log writes for reply metadata and failure handling
   - rerun the focused Python gym-chat suite as the regression check for the current `/chat/gym` contract

Expected files to touch:
- `capstone-backend/src/ai/gym-chat.controller.ts`
- `capstone-backend/src/ai/gym-chat.service.ts`
- `capstone-backend/src/ai/gym-chat-session.repository.ts`
- `capstone-backend/src/ai/gym-chat-message.repository.ts`
- `capstone-backend/src/ai/gym-chat-interaction-log.repository.ts`
- `capstone-backend/src/ai/dto/gym-chat-session.dto.ts` or a new dedicated send-message DTO module if that keeps the contract cleaner
- `capstone-backend/src/ai/ai-python-client.service.ts`
- `capstone-backend/src/ai/ai.module.ts`
- focused specs under `capstone-backend/src/ai/`
- a focused route harness under `capstone-backend/test/`

Implementation constraints:
- keep the S16 message flow additive and separate from the legacy S11 chat routes and repositories
- reuse the accepted 14-day lazy archival rule already logged in `decisions.md`
- treat the current Python `/chat/gym` scaffold as the contract boundary for this task instead of folding in live provider work
- persist follow-up suggestions through the interaction-log JSON payload, not a new Prisma column
- do not expose secret fields or broaden public responses beyond the S16 contract

Verification target for implementation:
- focused `npm.cmd test -- --runInBand` coverage for the new controller, service, repositories, and Python client path
- focused `npm.cmd run test:e2e -- --runInBand` coverage for `POST /v1/gym-chat/messages`
- `uv run pytest tests/test_gym_chat_api.py tests/test_pose_api.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: prismaLocal

---

## TESTER REPORT
Verified `TASK-1605` against the current local S16 workspace on 2026-03-30 and closed the task.

Verification outcomes:
- rechecked the additive member send-message route, the grounded `GymChatService` lifecycle, the write-side `GymChat*` repositories, the dedicated interaction-log seam, and the Python `/chat/gym` client boundary to confirm the slice stayed separate from the legacy `/v1/ai/*` flow
- confirmed with Prisma Local that the local backend schema is still up to date and there is no migration blocker before task close
- reran the focused Nest unit, route-harness, real FastAPI client integration, Python contract regression, build, and lint checks from the test boundary

Checks run during test:
- Prisma Local `migrate_status`
- `npm.cmd test -- --runInBand src/ai/gym-chat.controller.spec.ts src/ai/gym-chat.service.spec.ts src/ai/gym-chat-session.repository.spec.ts src/ai/gym-chat-message.repository.spec.ts src/ai/gym-chat-interaction-log.repository.spec.ts src/ai/ai-python-client.service.spec.ts`
- `npm.cmd run test:e2e -- --runInBand test/gym-chat.e2e-spec.ts`
- `npm.cmd test -- --runInBand src/ai/ai-python-client.integration.spec.ts`
- `uv run pytest tests/test_gym_chat_api.py tests/test_pose_api.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- Prisma Local status: database schema is up to date
- focused Nest unit coverage passed (`6` suites, `41` tests)
- dedicated `gym-chat` e2e route harness passed (`1` suite, `3` tests)
- real FastAPI `AiPythonClientService` integration coverage passed (`1` suite, `2` tests)
- focused Python gym-chat and pose contract coverage passed (`13` tests)
- build passed
- lint passed

Task closeout notes:
- runtime API verification is still not required at this phase because `TASK-1607` remains the dedicated live verification slice for the completed S16 HTTP surface
- the task stop condition was not hit; grounded-source selection, follow-up suggestions, and the current out-of-scope refusal behavior stayed within the accepted S16 scope

MCPs used: prismaLocal

---

## CODER OUTPUT
Implemented the additive S16 grounded message flow across the Nest `gym-chat` surface and the existing Python `/chat/gym` contract without disturbing the legacy `/v1/ai/*` flow.

Key outcomes:
- added `POST /v1/gym-chat/messages` with the S16 send-message DTO, grounded reply response DTO, Swagger metadata, and explicit `200` status behavior
- extended `GymChatSessionRepository` and `GymChatMessageRepository` with the write-side helpers needed for session creation, latest active-session reuse, recent history reads, and grounded assistant-message persistence
- added `GymChatInteractionLogRepository` for S16 request, grounding, response, latency, model, token, and error logging against `gym_chat_interaction_logs`
- rewired `GymChatService` to resolve or create sessions, apply the accepted 14-day lazy archival rule, seed titles from the opening message, build the grounding payload from gym knowledge, membership plans, user context, and session history, call the Python `/chat/gym` boundary, persist both user and assistant messages, and log success or failure metadata
- extended `AiPythonClientService` with a dedicated `chatGym` boundary and strict response validation for `reply`, `out_of_scope`, `sources`, `follow_up_suggestions`, `model_used`, and `token_count`
- wired `MembershipModule` into `AiModule` so the S16 grounding flow can reuse the existing active membership-plan seam instead of inventing a second knowledge source
- added focused controller, service, repository, route-harness, and Python-client coverage for the new send-message contract

Files changed for this slice:
- `capstone-backend/src/ai/dto/gym-chat-session.dto.ts`
- `capstone-backend/src/ai/gym-chat.controller.ts`
- `capstone-backend/src/ai/gym-chat.service.ts`
- `capstone-backend/src/ai/gym-chat-session.repository.ts`
- `capstone-backend/src/ai/gym-chat-message.repository.ts`
- `capstone-backend/src/ai/gym-chat-interaction-log.repository.ts`
- `capstone-backend/src/ai/ai-python-client.service.ts`
- `capstone-backend/src/ai/ai.module.ts`
- `capstone-backend/src/ai/gym-chat.controller.spec.ts`
- `capstone-backend/src/ai/gym-chat.service.spec.ts`
- `capstone-backend/src/ai/gym-chat-session.repository.spec.ts`
- `capstone-backend/src/ai/gym-chat-message.repository.spec.ts`
- `capstone-backend/src/ai/gym-chat-interaction-log.repository.spec.ts`
- `capstone-backend/src/ai/ai-python-client.service.spec.ts`
- `capstone-backend/src/ai/ai-python-client.integration.spec.ts`
- `capstone-backend/test/gym-chat.e2e-spec.ts`

Checks run during implementation:
- `npm.cmd test -- --runInBand src/ai/gym-chat.controller.spec.ts src/ai/gym-chat.service.spec.ts src/ai/gym-chat-session.repository.spec.ts src/ai/gym-chat-message.repository.spec.ts src/ai/gym-chat-interaction-log.repository.spec.ts src/ai/ai-python-client.service.spec.ts`
- `npm.cmd run test:e2e -- --runInBand test/gym-chat.e2e-spec.ts`
- `npm.cmd test -- --runInBand src/ai/ai-python-client.integration.spec.ts`
- `uv run pytest tests/test_gym_chat_api.py tests/test_pose_api.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused Nest unit coverage passed (`6` suites, `41` tests)
- dedicated `gym-chat` e2e route harness passed (`1` suite, `3` tests)
- real FastAPI `AiPythonClientService` integration coverage passed (`1` suite, `2` tests)
- focused Python gym-chat and pose contract coverage passed (`13` tests)
- build passed
- lint passed

Scope notes:
- `follow_up_suggestions` stay in the send-message response and the interaction-log `response_payload` JSON rather than a new Prisma column, matching the accepted S16 contract decision
- the current deterministic Python `/chat/gym` scaffold remains the integration target for this slice; live OpenRouter provider work is still deferred
- runtime API verification is still reserved for the later dedicated S16 verification task

MCPs used: none
