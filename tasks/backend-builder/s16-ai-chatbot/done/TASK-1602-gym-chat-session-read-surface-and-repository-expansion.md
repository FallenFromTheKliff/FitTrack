# TASK-1602 - Gym Chat Session Read Surface And Repository Expansion
**Task ID:** TASK-1602
**Domain:** S16 - AI Chatbot
**Status:** done
**Branch:** feat/TASK-1602-gym-chat-session-read-surface-and-repository-expansion
**Created:** 2026-03-29
**Completed:** 2026-03-29
**Priority:** P1
**Depends On:** TASK-1601
**Blocks:** TASK-1605, TASK-1606, TASK-1607
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the session history or detail contract needs a product decision about pagination, retention, or member visibility beyond the S16 context
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** prismaLocal

---

## What
Add the member-facing `gym-chat` session history and detail read surface plus the repository helpers needed to support it.

## Why
The S16 contract includes session-history reads, and the grounded message flow should reuse a stable ownership and retrieval seam instead of reaching directly into Prisma from controller code.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] DTOs and response shapes exist for the S16 session history and session detail routes
- [x] Repository helpers support owned session history and message retrieval for the new `GymChat*` contract
- [x] Authenticated member routes exist under `/v1/gym-chat/sessions`
- [x] Response envelopes follow the repo-standard HTTP conventions
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
- `capstone-backend/src/auth`
- `capstone-backend/src/common`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Implementation plan for `TASK-1602`:

1. Carve out the additive S16 member read surface instead of mutating the legacy S11 routes.
   - add a dedicated `GymChatController` under `/v1/gym-chat` while leaving `AiController` and `/v1/ai/*` intact
   - treat the S16 "detail" surface as the contract-listed pair of session list and session message history routes plus archive, not a new standalone `GET /sessions/:id`
   - keep Swagger on the new controller because the AI module already documents its HTTP surface

2. Introduce S16-specific DTOs and response mapping separate from the old `AiChat*` shapes.
   - add `GymChatSessionFilterDTO` extending the existing `PaginationDTO` from `src/user/dto/user-dto.ts`
   - parse optional `is_active` using the same explicit `Transform` boolean pattern already used in `src/notifications/dto/notification.dto.ts`
   - add `GymChatSessionResponseDTO` and `GymChatMessageResponseDTO` that expose S16 fields only: session identifiers, title, `is_active`, timestamps, message role, content, `grounded_sources`, and `out_of_scope`
   - keep legacy `context_type` and `action_triggered` out of the new S16 responses

3. Add repository seams for owned `GymChat*` reads and archival.
   - create `gym-chat-session.repository.ts` for paginated owned-session listing, owned-session lookup for authorization, and archive mutation
   - create `gym-chat-message.repository.ts` for paginated owned-session message history
   - keep Prisma access out of controllers and avoid overloading the legacy `AiChat*` repositories with mixed model responsibilities

4. Add a focused S16 service layer and module wiring.
   - introduce `GymChatService` to orchestrate ownership checks, pagination, DTO mapping, and archive behavior
   - wire the new controller, service, and repositories through `ai.module.ts` without disturbing the existing `AiService` and old action-driven flow
   - reuse existing paginated result conventions so the response interceptor keeps the repo-standard envelope

5. Cover the new member surface with focused tests only.
   - add controller, service, and repository tests for session listing, `is_active` filtering, session ownership failures, message-history reads, and archive success paths
   - extend the existing e2e-style AI coverage for `/v1/gym-chat/sessions`, `/v1/gym-chat/sessions/:id/messages`, and `DELETE /v1/gym-chat/sessions/:id`
   - keep admin knowledge routes, Python chat generation, and grounded reply writes out of scope for this task

Expected files to touch:
- `capstone-backend/src/ai/gym-chat.controller.ts`
- `capstone-backend/src/ai/gym-chat.service.ts`
- `capstone-backend/src/ai/gym-chat-session.repository.ts`
- `capstone-backend/src/ai/gym-chat-message.repository.ts`
- `capstone-backend/src/ai/dto/gym-chat-session.dto.ts`
- `capstone-backend/src/ai/ai.module.ts`
- focused spec files under `capstone-backend/src/ai/`
- `capstone-backend/test/fitness.e2e-spec.ts` or the current e2e file that already owns AI route coverage

Implementation constraints:
- do not replace or rename the legacy `/v1/ai/chat/*` routes, `AiController`, `AiService`, or `AiChat*` repositories in this task
- do not broaden into `POST /v1/gym-chat/messages`, admin knowledge CRUD, or Python and OpenRouter integration
- do not expose secret or legacy action fields in the new S16 responses
- keep the new S16 member read surface additive so `TASK-1603` through `TASK-1605` can build on it cleanly

Verification target for implementation:
- focused `npm.cmd test -- --runInBand` coverage for the new `gym-chat` controller, service, repositories, and affected e2e route tests
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: prismaLocal

---

## TESTER REPORT
Verified the additive S16 `gym-chat` read surface against the current local repo and Prisma state, then closed the task.

Verification outcomes:
- re-inspected the new controller, service, repositories, DTOs, and dedicated e2e harness to confirm the task stayed additive and did not mutate the legacy `/v1/ai/*` flow
- confirmed with Prisma Local that the local schema is still up to date and there is no checked-in migration blocker
- reran the focused `gym-chat` unit, e2e, build, and lint checks as the task-close verification set

Checks run during test:
- Prisma Local `migrate_status`
- `npm.cmd test -- --runInBand src/ai/gym-chat.controller.spec.ts src/ai/gym-chat.service.spec.ts src/ai/gym-chat-session.repository.spec.ts src/ai/gym-chat-message.repository.spec.ts`
- `npm.cmd run test:e2e -- --runInBand test/gym-chat.e2e-spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- Prisma Local status: database schema is up to date
- focused gym-chat unit specs passed (`4` suites, `15` tests)
- dedicated gym-chat e2e route spec passed (`1` suite, `2` tests)
- build passed
- lint passed

Task closeout notes:
- no extra runtime API verification was needed in this phase because `TASK-1602` is not the final HTTP verification slice for S16
- the task stop condition was not hit; the current S16 member session-read contract stayed within the documented route surface and did not need a new product decision

MCPs used: prismaLocal

---

## CODER OUTPUT
Implemented the additive S16 `gym-chat` session-read slice without disturbing the legacy S11 `/v1/ai/*` surface.

Key outcomes:
- added `GymChatSessionFilterDTO`, `GymChatSessionResponseDTO`, and `GymChatMessageResponseDTO` for the S16 member read contract
- added `GymChatSessionRepository` and `GymChatMessageRepository` for owned session listing, message-history reads, and archive mutation
- added `GymChatService` to map `GymChat*` records into response DTOs and normalize grounded source arrays
- added `GymChatController` under `/v1/gym-chat` with JWT-protected session list, session message history, and archive routes plus Swagger metadata
- wired the new controller, service, and repositories into `AiModule` additively so the legacy AI controller and service remain intact
- added focused controller, service, and repository specs plus a dedicated `test/gym-chat.e2e-spec.ts` route harness for query parsing, response envelopes, and archive behavior

Files changed for this slice:
- `capstone-backend/src/ai/dto/gym-chat-session.dto.ts`
- `capstone-backend/src/ai/gym-chat-session.repository.ts`
- `capstone-backend/src/ai/gym-chat-message.repository.ts`
- `capstone-backend/src/ai/gym-chat.service.ts`
- `capstone-backend/src/ai/gym-chat.controller.ts`
- `capstone-backend/src/ai/gym-chat.controller.spec.ts`
- `capstone-backend/src/ai/gym-chat.service.spec.ts`
- `capstone-backend/src/ai/gym-chat-session.repository.spec.ts`
- `capstone-backend/src/ai/gym-chat-message.repository.spec.ts`
- `capstone-backend/src/ai/ai.module.ts`
- `capstone-backend/test/gym-chat.e2e-spec.ts`

Checks run during implementation:
- `npm.cmd test -- --runInBand src/ai/gym-chat.controller.spec.ts src/ai/gym-chat.service.spec.ts src/ai/gym-chat-session.repository.spec.ts src/ai/gym-chat-message.repository.spec.ts`
- `npm.cmd run test:e2e -- --runInBand test/gym-chat.e2e-spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused gym-chat unit specs passed (`4` suites, `15` tests)
- dedicated gym-chat e2e route spec passed (`1` suite, `2` tests)
- build passed
- lint passed

Scope notes:
- no Prisma schema changes were required in this task
- the legacy S11 `AiController`, `AiService`, and `/v1/ai/chat/*` routes were left intact
- `POST /v1/gym-chat/messages` and admin knowledge routes remain reserved for downstream tasks

MCPs used: prismaLocal
