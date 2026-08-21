# TASK-1104 - Validated AI Actions And Cross-Domain Execution
**Task ID:** TASK-1104
**Domain:** S11 - AI Chatbot
**Status:** done
**Branch:** feat/TASK-1104-validated-ai-actions-and-cross-domain-execution
**Created:** 2026-03-27
**Completed:** 2026-03-27
**Priority:** P1
**Depends On:** TASK-1103
**Blocks:** TASK-1105, TASK-1106
**Auto-Eligible:** no
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if chat-triggered TDEE, training-plan, or nutrition actions require a product, auth, or security decision beyond the current S11 context
**Escalation Notes:** stop if action validation cannot be kept bounded to the documented `ADJUST_TDEE`, `GENERATE_PLAN`, `LOG_NUTRITION`, and `NONE` contract
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add the S11 action-validation layer and execute documented AI actions through the existing nutrition and fitness services.

## Why
The chat endpoint is only partially useful without the validated action path, and this slice must reuse the owning-domain services instead of inventing parallel write logic inside `src/ai/`.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] AI action values are validated against the documented action enum before execution
- [x] Invalid or schema-mismatched action payloads are ignored safely and still return the assistant reply
- [x] `ADJUST_TDEE` routes through `NutritionService.recalculateTdee()` with documented param-merging behavior
- [x] `GENERATE_PLAN` routes through the existing AI/training-plan generation seam instead of duplicating plan persistence
- [x] `LOG_NUTRITION` routes through `NutritionService.logNutrition()` with the documented defaults applied
- [x] Action execution results are returned and logged without exposing unrelated secret fields
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
- `capstone-backend/src/nutrition`
- `capstone-backend/src/fitness`
- `capstone-backend/src/user`

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
The current chat path already carries `action` and `params` back from the Python `/chat` contract, but it only persists `action_triggered` and returns the assistant reply. This slice should stay bounded to the documented four-action contract and reuse owning-domain services instead of duplicating nutrition or training-plan write logic inside `src/ai/`.

Implementation plan:
- extend the AI chat response DTO and service response shape to include optional `action_result`, while keeping invalid or ignored actions non-fatal to the chat reply path
- inject `NutritionService` into `AiService` and add a bounded action-validation helper that accepts only `ADJUST_TDEE`, `GENERATE_PLAN`, `LOG_NUTRITION`, and `NONE`
- merge AI params into downstream DTO shapes before execution:
  - map partial TDEE params into `RecalculateTdeeDTO`
  - map nutrition params into `LogNutritionDTO` with documented defaults for macros, quantity, unit, meal name, and date
  - route `GENERATE_PLAN` through the existing `AiService.generatePlan()` seam instead of duplicating plan persistence
- log `action_result` through the shared interaction-log repository for successful action execution, but ignore invalid action enums or schema-mismatched params safely and still return the assistant reply
- add focused AI service/controller specs for invalid actions, invalid params, successful TDEE/nutrition execution, and plan-generation reuse
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S11 action layer on top of the existing chat backbone. [ai.service.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai.service.ts) now validates AI action strings, ignores invalid or schema-mismatched action payloads safely, and executes the three supported side effects through owning-domain services: `ADJUST_TDEE` via `NutritionService.recalculateTdee()`, `GENERATE_PLAN` via the existing `generatePlan()` seam, and `LOG_NUTRITION` via `NutritionService.logNutrition()` with the documented defaults.

I also updated the shared contract and module wiring so the action results are visible end-to-end. [chat.dto.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/dto/chat.dto.ts) now includes `action_result`, [ai.controller.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai.controller.ts) registers the related Swagger models, [ai-python-client.service.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai-python-client.service.ts) now allows unknown upstream action strings through so the service can ignore them safely, and [ai.module.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/ai/ai.module.ts) plus [nutrition.module.ts](/c:/Users/HOUSTON/Desktop/Capstone%20Shenaniggans/CapstoneBackend/capstone-backend/src/nutrition/nutrition.module.ts) use `forwardRef` to keep the Nest graph valid while reusing `NutritionService`.
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification is green for the validated action-execution slice.

Commands run:
- `npm.cmd run test -- --runInBand src/ai/ai-python-client.service.spec.ts src/ai/ai.controller.spec.ts src/ai/ai.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused AI tests passed: `3` suites, `35` tests
- build passed
- lint check passed
MCPs used: serena, prismaLocal
