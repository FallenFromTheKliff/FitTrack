# TASK-705 - AI Plan Generation And Interaction Logging
**Task ID:** TASK-705
**Domain:** S7 - Fitness Training
**Status:** done
**Branch:** feat/TASK-705-ai-plan-generation-and-interaction-logging
**Created:** 2026-03-26
**Completed:** 2026-03-26
**Priority:** P1
**Depends On:** TASK-702, TASK-703
**Blocks:** TASK-706, TASK-707, TASK-708
**Auto-Eligible:** no
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** none
**Escalation Notes:** stop if the Python AI health or generate-plan contract is absent, incompatible, or requires a product decision beyond the current context
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Implement the AI-generated training plan flow and persist the interaction log trail for it.

## Why
This slice adds the highest-value automation path in S7 and must reuse the same training plan persistence rules instead of creating a parallel write path.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [ ] `POST /v1/ai/generate-plan` validates the documented request DTO
- [ ] The service loads the caller's required profile context and rejects missing required fields with a documented 422 path
- [ ] The service constrains generation to active exercise catalog entries
- [ ] The backend performs AI health and plan-generation calls through a dedicated service boundary
- [ ] The generated response is logged in `ai_interaction_logs` with `interaction_type = plan_generation`
- [ ] Generated exercise names are resolved back to catalog IDs before persistence
- [ ] Active-plan replacement is transactional and does not leave two active non-template plans behind
- [ ] Build passes (`npm.cmd run build`)
- [ ] Relevant tests pass
- [ ] Lint check passes (`npm.cmd run lint:check`)
- [ ] No avoidable `any` types used
- [ ] No secret fields in responses (password, credential_hash, token_hash)
- [ ] Swagger decorators applied where the module already follows Swagger
- [ ] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/s7-fitness-training.md`
- `tasks/s7-fitness-training/README.md`
- `tasks/s7-fitness-training/execution.md`
- `tasks/s7-fitness-training/decisions.md`

## Module Hints
- `capstone-backend/src/fitness`
- `capstone-backend/src/user`
- `capstone-backend/src/config`
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run lint:check`
- `Read tasks/api-verification-driver.md and follow it.` when `Needs Runtime API Verification: yes` and let that driver auto-start the backend when configured

---

## PLANNER OUTPUT
Review found that `TASK-705` was entirely missing from the Nest app surface: no `/v1/ai/generate-plan` route, no AI module wiring in `AppModule`, no Python AI client boundary, no `AiInteractionLog` usage in `src/`, and no transactional active-plan replacement path in the shared training-plan write flow.

Implementation plan:
- add a dedicated `src/ai/` module with controller, DTO, service, outbound Python client, and AI interaction log repository
- reuse `UserService` profile loading plus the active exercise catalog to build the documented AI request contract and 422 profile gate
- extend the existing training-plan repository/service so AI generation replaces the active non-template plan transactionally instead of creating a parallel write path
- verify with focused AI/training-plan coverage patterns, then run build, lint, and the full Jest suite before closing the task
MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the AI plan-generation slice under `capstone-backend/src/ai/`.

Delivered behavior:
- `POST /v1/ai/generate-plan`

Implementation notes:
- added `GeneratePlanDTO`, JWT-protected AI controller wiring, Swagger metadata, and the documented `@Throttle({ default: { limit: 10, ttl: 60 } })` guard on the generate-plan route
- added a dedicated Python AI client service for `/health` and `/generate-plan`, with 503 handling for unavailable configuration/connectivity and 502 handling for invalid upstream plan payloads
- reused `UserService` profile loading and active exercise-catalog reads to build the AI request context, and return a 422 path when required profile fields are missing
- logged successful plan-generation payloads into `ai_interaction_logs` with `interaction_type = plan_generation`, latency, token count, and model metadata when available
- extended the shared training-plan write path so AI generation resolves catalog exercise names back to exercise IDs and transactionally deactivates any existing active non-template plan before persisting the new `ai_generated` plan
- exposed a narrow active-exercise generation lookup from the exercise slice instead of duplicating catalog access in the AI module
MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed successfully.

Commands:
- `npm.cmd run build`
- `npm.cmd run lint:check`
- `npm.cmd test -- --runInBand`

Results:
- build passed
- lint passed
- full repo suite passed: 62 suites, 333 tests
- runtime API verification not required for this task
MCPs used: serena, prismaLocal
