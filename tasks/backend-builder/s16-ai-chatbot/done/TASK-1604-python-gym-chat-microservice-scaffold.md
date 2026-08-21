# TASK-1604 - Python Gym Chat Microservice Scaffold
**Task ID:** TASK-1604
**Domain:** S16 - AI Chatbot
**Status:** done
**Branch:** feat/TASK-1604-python-gym-chat-microservice-scaffold
**Created:** 2026-03-29
**Completed:** 2026-03-29
**Priority:** P1
**Depends On:** TASK-1601
**Blocks:** TASK-1605, TASK-1606, TASK-1607
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the OpenRouter adapter or prompt boundary requires product policy beyond the gym-only S16 contract
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** prismaLocal | context7

---

## What
Scaffold the FastAPI S16 `POST /chat/gym` boundary, request and response models, and the Python-side contract coverage for the grounded gym chatbot flow.

## Why
The Nest side cannot complete the new S16 message flow until the Python service exposes the gym-specific request and response contract described in the shared context.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] FastAPI exposes the S16 `POST /chat/gym` route and shared response envelope helpers as needed
- [x] Python request and response models validate the S16 grounded payload, including source output and out-of-scope signaling
- [x] The Python boundary is separated from the old pose routes and does not regress them
- [x] Focused Python contract tests cover the new gym-chat route behavior
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
- `ai-microservice/app/api`
- `ai-microservice/app/models`
- `ai-microservice/app/services`
- `ai-microservice/tests`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `uv run pytest`
- `npm.cmd run build`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Implementation plan for `TASK-1604`:

1. Add the S16 gym-chat Python contract additively beside the existing pose routes.
   - keep `/health` and every `/pose/*` route unchanged in `ai-microservice/app/api/routes.py`
   - add `POST /chat/gym` using the same FastAPI `payload: Model` plus `response_model=` pattern already used by the pose routes
   - reuse the existing RFC7807-style validation and service error handling in `app/main.py` instead of inventing a second error envelope

2. Introduce dedicated Pydantic v2 models for the S16 request and response contract.
   - add a new model module for the gym-chat payload instead of overloading `pose.py`
   - model the nested grounding payload explicitly: operating hours, special schedules, promotions, FAQs, membership plans, session history, and optional user context
   - add request models for `session_id`, `message`, `grounding`, and `policy`
   - add response models for `reply`, `out_of_scope`, `sources`, `follow_up_suggestions`, `model_used`, and `token_count`
   - keep `extra="forbid"` behavior so invalid JSON keys still flow through the existing 422 validation handler

3. Add a bounded service seam for gym-chat scaffolding without broadening this slice into full provider integration.
   - create a `GymChatService` in `ai-microservice/app/services`
   - keep this task scaffold-first: return deterministic structured responses that prove the contract, source fields, and out-of-scope handling
   - if `policy.refuse_out_of_scope` is true and the prompt is clearly outside gym support scope, return a short refusal with `out_of_scope=true`
   - if the prompt is gym-related, return a deterministic grounded reply assembled from the provided payload with `sources` populated from the relevant grounding sections
   - set `model_used` and `token_count` to `null` in this scaffold slice rather than inventing a live OpenRouter client in the current task

4. Keep the implementation isolated from downstream Nest integration and pose behavior.
   - do not mutate the existing pose session service or pose tests except for shared fixture adjustments if they become a direct blocker
   - do not attempt to change the Nest `AiPythonClientService` to `/chat/gym` in this task; reserve that client and message-flow wiring for `TASK-1605`
   - avoid adding new runtime dependencies unless the current Python standard library and installed packages are insufficient for the scaffolded deterministic boundary

5. Cover the new Python surface with focused contract tests.
   - add a dedicated `ai-microservice/tests/test_gym_chat_api.py`
   - cover at least:
     - a successful gym-related request that returns a grounded reply and source list
     - an out-of-scope refusal path with `out_of_scope=true`
     - request validation failures for malformed grounding or policy payloads
   - keep the existing pose suite intact and rerun it as the regression check for route separation

Expected files to touch:
- `ai-microservice/app/api/routes.py`
- `ai-microservice/app/models/gym_chat.py`
- `ai-microservice/app/models/__init__.py` only if the new module should be re-exported
- `ai-microservice/app/services/gym_chat.py`
- `ai-microservice/app/services/__init__.py` only if the new service should be re-exported
- `ai-microservice/tests/test_gym_chat_api.py`
- `ai-microservice/tests/conftest.py` only if shared fixtures need a narrow additive update

Implementation constraints:
- keep the task scaffold-only and additive; do not broaden into live OpenRouter calls, prompt templating policy work, or Nest client changes
- preserve the current pose contract and RFC7807 error format
- keep the new route deterministic enough for stable Python contract tests
- do not add speculative public routes beyond `POST /chat/gym`

Verification target for implementation:
- `uv run pytest ai-microservice/tests/test_gym_chat_api.py ai-microservice/tests/test_pose_api.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: prismaLocal, context7

---

## TESTER REPORT
Verified `TASK-1604` against the current local S16 workspace and closed the task.

Verification outcomes:
- rechecked the new `/chat/gym` route, the strict Pydantic request and response models, the deterministic gym-chat service seam, and the dedicated Python contract tests to confirm the slice stayed additive beside the pose routes
- confirmed with Prisma Local that the local backend schema is still up to date and there is no migration blocker before closing the task
- reran the focused Python gym-chat and pose suites plus the shared backend build and lint checks from the task-close test boundary

Checks run during test:
- Prisma Local `migrate_status`
- `uv run pytest tests/test_gym_chat_api.py tests/test_pose_api.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- Prisma Local status: database schema is up to date
- focused Python contract and pose regression tests passed (`13` total tests)
- build passed
- lint passed

Task closeout notes:
- no runtime API verification was needed in this phase because `TASK-1604` is a Python scaffold slice, not the final S16 HTTP verification task
- the task stop condition was not hit; the slice stayed scaffold-only and did not require a live OpenRouter policy decision

MCPs used: prismaLocal, context7

---

## CODER OUTPUT
Implemented the additive Python S16 gym-chat scaffold without disturbing the existing pose routes or the current Nest client flow.

Key outcomes:
- added strict nested Pydantic request and response models for the S16 `/chat/gym` contract in `ai-microservice/app/models/gym_chat.py`
- added a bounded deterministic `GymChatService` in `ai-microservice/app/services/gym_chat.py` that returns structured grounded replies, out-of-scope refusals, source lists, and follow-up suggestions without introducing live provider integration
- added `POST /chat/gym` to `ai-microservice/app/api/routes.py` using the same FastAPI request-body and `response_model` pattern already used by the pose routes
- kept the existing RFC7807-style validation behavior from `app/main.py` intact by relying on strict Pydantic validation and the shared `RequestValidationError` handler
- added focused Python contract coverage in `ai-microservice/tests/test_gym_chat_api.py` for a grounded success path, an out-of-scope refusal path, and a policy-validation failure
- reran the existing pose API suite alongside the new gym-chat tests to confirm the additive route did not regress the current pose contract

Files changed for this slice:
- `ai-microservice/app/models/gym_chat.py`
- `ai-microservice/app/services/gym_chat.py`
- `ai-microservice/app/api/routes.py`
- `ai-microservice/tests/test_gym_chat_api.py`

Checks run during implementation:
- `uv run pytest tests/test_gym_chat_api.py tests/test_pose_api.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused Python API tests passed (`13` tests total across gym-chat and pose suites)
- build passed
- lint passed

Scope notes:
- this task stayed scaffold-only and deterministic; it does not add live OpenRouter calls or prompt-template policy work yet
- the Nest `AiPythonClientService` still targets the legacy `/chat` boundary and remains reserved for downstream integration work in `TASK-1605`
- the existing pose routes and tests were preserved without route-contract changes

MCPs used: prismaLocal, context7
