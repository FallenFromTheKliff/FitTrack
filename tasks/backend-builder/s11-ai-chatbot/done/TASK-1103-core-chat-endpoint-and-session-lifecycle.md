# TASK-1103 - Core Chat Endpoint And Session Lifecycle
**Task ID:** TASK-1103
**Domain:** S11 - AI Chatbot
**Status:** done
**Branch:** feat/TASK-1103-core-chat-endpoint-and-session-lifecycle
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P1
**Depends On:** TASK-1101, TASK-1102
**Blocks:** TASK-1104, TASK-1105, TASK-1106
**Auto-Eligible:** no
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the upstream Python `/chat` contract is absent, incompatible, or requires a product decision beyond the current S11 context
**Escalation Notes:** stop if the session-expiry behavior cannot be implemented cleanly as lazy archival without broadening into a queue/cron decision
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Implement `POST /v1/ai/chat`, the outbound Python `/chat` client path, and the core S11 session lifecycle behavior without action execution yet.

## Why
This is the main conversational backbone of S11 and should exist as a stable reply-and-persist path before validated side effects are layered on top.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `POST /v1/ai/chat` accepts the documented chat DTO with JWT auth and 10 req/min throttling
- [x] Existing owned sessions are reused safely, and new sessions are created when needed for a context
- [x] Sessions older than 14 days of inactivity are lazily archived and return the documented archived-session failure path
- [x] The backend loads the last 20 messages, calls the Python `/chat` contract, and persists both user and assistant messages
- [x] Untitled sessions are seeded from the first user message as documented
- [x] Chat interaction logs capture payloads, latency, model metadata, and error details on the shared interaction-log path
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
- `context/s11-ai-chatbot.md`
- `tasks/s11-ai-chatbot/README.md`
- `tasks/s11-ai-chatbot/execution.md`
- `tasks/s11-ai-chatbot/decisions.md`

## Module Hints
- `capstone-backend/src/ai`
- `capstone-backend/src/user`
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
The current AI module is ready for the core chat slice to land without more repository work: `TASK-1101` already added owned session/message persistence seams, and `TASK-1102` added the read/archive controller surface. The remaining gap is the write-side chat lifecycle: request DTO, Python `/chat` client contract, session reuse vs create, lazy archival on load, message persistence, title seeding, and shared interaction logging for chat payloads.

Implementation plan:
- add a dedicated `AIChatDTO` plus a typed chat response DTO under `src/ai/dto/` that matches the documented `POST /v1/ai/chat` contract without action execution yet
- extend `AiPythonClientService` with a validated `/chat` client path and explicit response types for `{ content, action, params, model_used?, token_count? }`, treating unavailable or malformed upstream responses with the same 502/503 style used elsewhere in the AI module
- add `AiService.chat(...)` and supporting helpers to:
  - load an owned session by `session_id` when provided
  - lazily archive and fail sessions inactive for more than 14 days
  - reuse the active session for a context or create one when none exists
  - load the last 20 messages, call the Python `/chat` endpoint, persist both user and assistant messages, update `last_activity_at`, and seed `title` from the first user message when absent
  - write shared interaction logs with latency, payloads, model metadata, and error details
- add the `POST /v1/ai/chat` controller route with JWT guard, `@Throttle(10/min)`, Swagger metadata, and focused controller/service/client specs for session reuse, archived-session failure, history forwarding, title seeding, and logging
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the core S11 chat backbone. [ai.controller.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai.controller.ts) now exposes `POST /v1/ai/chat` with JWT auth, 10 req/min throttling, and Swagger metadata. [chat.dto.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/dto/chat.dto.ts) adds the documented request and response DTOs, while [ai-python-client.service.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai-python-client.service.ts) now supports the `/chat` contract with payload validation.

The lifecycle logic lives in [ai.service.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai.service.ts): it reuses or creates sessions, lazily archives stale sessions, loads the last 20 messages, persists user and assistant messages, seeds titles from the first user message, and logs chat payloads plus failures through the shared interaction-log seam. I also extended the AI repositories for recent-message loading and session metadata updates in [ai-chat-message.repository.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai-chat-message.repository.ts) and [ai-chat-session.repository.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai-chat-session.repository.ts).
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification is green for the core chat lifecycle slice.

Commands run:
- `npm.cmd run test -- --runInBand src/ai/ai-python-client.service.spec.ts src/ai/ai-chat-session.repository.spec.ts src/ai/ai-chat-message.repository.spec.ts src/ai/ai.controller.spec.ts src/ai/ai.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused AI tests passed: `5` suites, `40` tests
- build passed
- lint check passed
MCPs used: serena, prismaLocal
