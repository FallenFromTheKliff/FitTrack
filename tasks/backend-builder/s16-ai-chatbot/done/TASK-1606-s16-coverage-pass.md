# TASK-1606 - S16 Coverage Pass
**Task ID:** TASK-1606
**Domain:** S16 - AI Chatbot
**Status:** done
**Branch:** feat/TASK-1606-s16-coverage-pass
**Created:** 2026-03-29
**Completed:** 2026-03-30
**Priority:** P2
**Depends On:** TASK-1605
**Blocks:** TASK-1607
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** stop if the missing coverage exposes a larger contract gap that belongs in an earlier implementation task instead of a focused test slice
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** prismaLocal

---

## What
Add the focused Nest and Python coverage needed to lock in the completed S16 `gym-chat` contract before live runtime verification.

## Why
The S16 grounded flow crosses auth, validation, persistence, and Python boundaries, so a dedicated coverage pass reduces regression risk before the live API check.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Nest tests cover the critical S16 auth, validation, grounding, and persistence edges
- [x] Python tests cover the critical `/chat/gym` contract edges, including out-of-scope behavior
- [x] The coverage slice stays focused on missing tests rather than broad feature changes
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
- `capstone-backend/test`
- `ai-microservice/tests`

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
Implementation plan for `TASK-1606`:

1. Extend the member `gym-chat` route harness only where the current HTTP contract is still unpinned.
   - add focused e2e cases in `capstone-backend/test/gym-chat.e2e-spec.ts` for:
     - unauthenticated access returning `401`
     - invalid `session_id` validation on `POST /v1/gym-chat/messages`
     - overlong `message` validation on `POST /v1/gym-chat/messages`
     - archived-session `410` passthrough from `GymChatService`
   - keep the route-harness scope on the member `gym-chat` surface; do not broaden this task into duplicate admin knowledge coverage because that surface is already pinned elsewhere

2. Add the missing service-level persistence coverage for the out-of-scope reply path.
   - extend `capstone-backend/src/ai/gym-chat.service.spec.ts` with one focused case where the Python boundary returns `out_of_scope=true`
   - assert that the assistant message is persisted with the returned `groundedSources` and `outOfScope` values
   - assert that the interaction log records `outOfScope: true` and preserves the response payload fields that matter to the S16 contract, especially `follow_up_suggestions`
   - keep this slice test-first and avoid changing service behavior unless a test exposes a direct contract mismatch that is small enough to fix inside the same task

3. Strengthen the FastAPI contract tests around strict nested validation.
   - extend `ai-microservice/tests/test_gym_chat_api.py` with one or two focused validation cases that prove the strict Pydantic request shape is enforced
   - prefer nested invalid-shape coverage that matches the current model risks, such as an invalid `session_history.role` value or forbidden extra fields in the request payload
   - keep the deterministic `GymChatService` behavior unchanged unless the new contract tests reveal a real mismatch

4. Keep the coverage pass narrowly scoped to missing tests rather than broad feature work.
   - do not add new routes, DTOs, repositories, or Prisma changes in this task unless a failing focused test reveals a direct low-risk contract bug
   - do not widen the slice into live OpenRouter work, admin-knowledge retesting, or runtime API verification; those belong to other S16 tasks
   - prefer updating the existing focused suites instead of creating a second overlapping test harness for the same behavior

5. Verify the finished coverage slice with the repo-standard focused checks.
   - run the focused Nest unit specs that exercise `gym-chat` and the Python client path
   - run the dedicated `gym-chat` e2e harness
   - run the focused Python gym-chat and pose regression suite
   - rerun `npm.cmd run build` and `npm.cmd run lint:check`

Expected files to touch:
- `capstone-backend/test/gym-chat.e2e-spec.ts`
- `capstone-backend/src/ai/gym-chat.service.spec.ts`
- `ai-microservice/tests/test_gym_chat_api.py`
- optionally `capstone-backend/src/ai/gym-chat.controller.spec.ts` only if a narrow assertion is needed to keep route-contract expectations aligned

Implementation constraints:
- keep `TASK-1606` coverage-only and avoid reopening already-finished feature slices
- treat the existing member `gym-chat` route harness and Python contract suite as the primary homes for the missing assertions
- reserve live runtime API verification for `TASK-1607`
- do not change Prisma schema or migrations in this task

Verification target for implementation:
- `npm.cmd test -- --runInBand src/ai/gym-chat.controller.spec.ts src/ai/gym-chat.service.spec.ts src/ai/gym-chat-session.repository.spec.ts src/ai/gym-chat-message.repository.spec.ts src/ai/gym-chat-interaction-log.repository.spec.ts src/ai/ai-python-client.service.spec.ts`
- `npm.cmd run test:e2e -- --runInBand test/gym-chat.e2e-spec.ts`
- `uv run pytest tests/test_gym_chat_api.py tests/test_pose_api.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: prismaLocal

---

## TESTER REPORT
Verified `TASK-1606` against the current local S16 workspace on 2026-03-30 and closed the task.

Verification outcomes:
- rechecked the focused member `gym-chat` route harness, the out-of-scope service persistence coverage, and the strict Python `/chat/gym` validation cases to confirm the slice stayed coverage-only and did not widen into feature work
- confirmed with Prisma Local that the local backend schema is still up to date and there is no migration blocker before task close
- reran the focused Nest unit, `gym-chat` e2e, Python contract regression, build, and lint checks from the test boundary

Checks run during test:
- Prisma Local `migrate_status`
- `npm.cmd test -- --runInBand src/ai/gym-chat.controller.spec.ts src/ai/gym-chat.service.spec.ts src/ai/gym-chat-session.repository.spec.ts src/ai/gym-chat-message.repository.spec.ts src/ai/gym-chat-interaction-log.repository.spec.ts src/ai/ai-python-client.service.spec.ts`
- `npm.cmd run test:e2e -- --runInBand test/gym-chat.e2e-spec.ts`
- `uv run pytest tests/test_gym_chat_api.py tests/test_pose_api.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- Prisma Local status: database schema is up to date
- focused Nest unit coverage passed (`6` suites, `42` tests)
- dedicated `gym-chat` e2e route harness passed (`1` suite, `4` tests)
- focused Python gym-chat and pose contract coverage passed (`15` tests)
- build passed
- lint passed

Task closeout notes:
- no runtime API verification was needed in this phase because `TASK-1607` remains the dedicated live verification slice
- the task stop condition was not hit; the missing coverage was satisfied without exposing a broader implementation gap

MCPs used: prismaLocal

---

## CODER OUTPUT
Implemented the focused S16 coverage pass without widening the feature scope or changing the Prisma or HTTP contract.

Key outcomes:
- extended the member `gym-chat` e2e harness in `capstone-backend/test/gym-chat.e2e-spec.ts` to cover:
  - unauthenticated `401` rejection
  - archived-session `410` passthrough for `POST /v1/gym-chat/messages`
  - invalid `session_id` validation
  - overlong `message` validation
- extended `capstone-backend/src/ai/gym-chat.service.spec.ts` with an out-of-scope reply path that proves assistant-message persistence and interaction-log metadata for `out_of_scope=true`
- extended `ai-microservice/tests/test_gym_chat_api.py` with strict nested validation coverage for:
  - invalid `session_history.role`
  - forbidden extra nested request fields

Files changed for this slice:
- `capstone-backend/test/gym-chat.e2e-spec.ts`
- `capstone-backend/src/ai/gym-chat.service.spec.ts`
- `ai-microservice/tests/test_gym_chat_api.py`

Checks run during implementation:
- `npm.cmd test -- --runInBand src/ai/gym-chat.controller.spec.ts src/ai/gym-chat.service.spec.ts src/ai/gym-chat-session.repository.spec.ts src/ai/gym-chat-message.repository.spec.ts src/ai/gym-chat-interaction-log.repository.spec.ts src/ai/ai-python-client.service.spec.ts`
- `npm.cmd run test:e2e -- --runInBand test/gym-chat.e2e-spec.ts`
- `uv run pytest tests/test_gym_chat_api.py tests/test_pose_api.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused Nest unit coverage passed (`6` suites, `42` tests)
- dedicated `gym-chat` e2e route harness passed (`1` suite, `4` tests)
- focused Python gym-chat and pose contract coverage passed (`15` tests)
- build passed
- lint passed

Scope notes:
- this remained a coverage-only slice; no production Nest or FastAPI behavior changed
- runtime API verification is still reserved for `TASK-1607`

MCPs used: none
