# TASK-1101 - S11 Session Persistence And Guard Migration
**Task ID:** TASK-1101
**Domain:** S11 - AI Chatbot
**Status:** done
**Branch:** feat/TASK-1101-s11-session-persistence-and-guard-migration
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P1
**Depends On:** none
**Blocks:** TASK-1102, TASK-1103, TASK-1104, TASK-1105, TASK-1106
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the Prisma schema direction or the raw guard-migration approach for active chat sessions needs approval beyond the current S11 context
**Escalation Notes:** stop if the session-uniqueness invariant cannot be implemented with the current checked-in migration strategy without broader schema redesign
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add the persistence seams that S11 chat flows depend on and align the documented one-active-session-per-context guard with a checked-in migration artifact.

## Why
The chat tables already exist in Prisma, but the app still lacks session/message repositories and the documented partial unique-session guard that later S11 service code relies on.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] A repository seam exists for AI chat sessions, messages, and generalized interaction-log writes
- [x] Session lookup contracts are ownership-safe and expose `*OrThrow` variants for required reads
- [x] The documented `one_active_ai_session_per_context` invariant exists as a checked-in migration artifact or an equivalent checked-in guard with the same business effect
- [x] S11 schema comments and migration artifacts stay aligned
- [x] Existing plan-generation logging continues to work through the shared interaction-log seam
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
- `capstone-backend/prisma`
- `capstone-backend/src/common`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [x] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
S11 review confirmed that the Prisma schema already has the chat/session tables, but the app layer still lacks repositories for sessions and messages, and the documented raw partial unique index for one active session per user/context does not appear to be checked into migrations yet. This is the right first slice because later controller and chat-service work should not depend on unstable persistence contracts.

Implementation plan:
- add repository seams for AI chat sessions, messages, and shared interaction logging under `src/ai/`
- keep repository contracts ownership-safe and aligned to the repo's `*OrThrow` conventions
- add the checked-in migration artifact for the active-session uniqueness guard if it is still missing
- preserve the existing direct plan-generation log path by moving it onto the generalized interaction-log seam instead of duplicating writes
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Added the persistence foundation that the S11 chat lifecycle depends on. [ai-chat-session.repository.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai-chat-session.repository.ts) now owns session listing, owned `*OrThrow` lookups, active-session-by-context reads, creation, and archive-by-owner behavior. [ai-chat-message.repository.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai-chat-message.repository.ts) adds owned session-message listing plus message writes, and [ai-interaction-log.repository.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai-interaction-log.repository.ts) now exposes a generalized `createInteractionLog()` seam while keeping plan-generation logging routed through it.

I also registered the new repositories in [ai.module.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai.module.ts) and checked in the documented raw uniqueness guard as [migration.sql](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/prisma/migrations/20260327153000_s11_ai_chat_session_guard/migration.sql), preserving the schema comment contract for `one_active_ai_session_per_context`.
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification passed after adding focused AI repository coverage and applying the checked-in guard migration locally.

Commands run:
- `npm.cmd run test -- --runInBand src/ai/ai-interaction-log.repository.spec.ts src/ai/ai-chat-session.repository.spec.ts src/ai/ai-chat-message.repository.spec.ts src/ai/ai.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`
- `npx.cmd prisma migrate deploy`

Results:
- focused AI repository and service tests passed: `4` suites, `13` tests
- build passed
- lint check passed
- the new `20260327153000_s11_ai_chat_session_guard` migration applied successfully and Prisma Local reports the schema is up to date
MCPs used: serena, prismaLocal
