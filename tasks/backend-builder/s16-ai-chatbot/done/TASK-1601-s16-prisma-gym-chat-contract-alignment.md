# TASK-1601 - S16 Prisma Gym Chat Contract Alignment
**Task ID:** TASK-1601
**Domain:** S16 - AI Chatbot
**Status:** done
**Branch:** feat/TASK-1601-s16-prisma-gym-chat-contract-alignment
**Created:** 2026-03-29
**Completed:** 2026-03-29
**Priority:** P1
**Depends On:** none
**Blocks:** TASK-1602, TASK-1603, TASK-1604, TASK-1605, TASK-1606, TASK-1607
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the S16 context requires replacing the legacy S11 `AiChat*` tables instead of adding the new `GymChat*` contract alongside them
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** prismaLocal

---

## What
Align the Prisma layer for S16 by adding the new `GymChat*` and gym-knowledge persistence contract required by the grounded chatbot workflow.

## Why
Every downstream S16 slice depends on a stable additive persistence contract for sessions, messages, interaction logs, and the grounded knowledge sources.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Prisma includes the new S16 `GymChatSession`, `GymChatMessage`, and `GymChatInteractionLog` models with the core fields required by the context
- [x] Prisma includes the S16 knowledge tables for operating hours, special schedules, promotions, and FAQ entries
- [x] The S16 grounded-response fields needed downstream, including source persistence and out-of-scope tracking, exist in the new schema
- [x] The legacy S11 `AiChat*` tables remain intact and compatible
- [x] Checked-in Prisma migration files exist for the additive S16 schema changes
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
- `capstone-backend/prisma`
- `capstone-backend/src/ai`
- `capstone-backend/src/membership`

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
Implementation plan for `TASK-1601`:

1. Extend `capstone-backend/prisma/schema.prisma` with the additive S16 persistence contract only.
   - add `GymChatRole` and `GymFaqCategory`
   - add `GymChatSession`, `GymChatMessage`, `GymChatInteractionLog`, `GymOperatingHour`, `GymSpecialSchedule`, `GymPromotion`, and `GymFaqEntry`
   - add the missing reverse relations on `User` for `gym_chat_sessions` and `gym_chat_interaction_logs`
   - keep all new S16 models isolated from the legacy S11 `AiChat*` models instead of expanding `ChatRole`, `InteractionType`, or the old tables in place

2. Keep the schema aligned tightly to the S16 context without inventing extra persistence that belongs in later tasks.
   - store grounded sources on `GymChatMessage.grounded_sources`
   - store `out_of_scope` on both `GymChatMessage` and `GymChatInteractionLog`
   - keep `follow_up_suggestions` inside the logged `response_payload` JSON instead of introducing a separate column that the context did not define
   - reuse the existing `MembershipPlan` model as the future grounding source for membership plans instead of creating a duplicate S16 plan table

3. Add the checked-in Prisma migration manually for the new enums, tables, relations, and indexes.
   - create a new migration folder under `capstone-backend/prisma/migrations/<timestamp>_s16_gym_chat_contract_alignment/`
   - write `migration.sql` by hand for the additive schema changes
   - do not run `prisma migrate dev` in this task flow
   - preserve the legacy S11 tables and existing partial unique indexes exactly as they are

4. Regenerate Prisma client artifacts after the schema edit so TypeScript uses the new generated model surface.
   - run `npx.cmd prisma generate`
   - keep application-code edits out of scope unless Prisma type generation reveals a direct compile-time adjustment that is necessary to preserve the existing S11 AI module

5. Use focused regression checks to prove the additive schema change did not break the legacy AI persistence seams.
   - run the existing AI repository specs for `AiChatSession`, `AiChatMessage`, and `AiInteractionLog`
   - run `npm.cmd run build`
   - run `npm.cmd run lint:check`
   - reserve any broader S16 HTTP, DTO, service, or Python work for downstream tasks

Expected files to touch:
- `capstone-backend/prisma/schema.prisma`
- `capstone-backend/prisma/migrations/<new_migration>/migration.sql`
- `capstone-backend/src/ai/ai-chat-session.repository.spec.ts` only if Prisma-generated type expectations need a narrow additive adjustment
- `capstone-backend/src/ai/ai-chat-message.repository.spec.ts` only if Prisma-generated type expectations need a narrow additive adjustment
- `capstone-backend/src/ai/ai-interaction-log.repository.spec.ts` only if Prisma-generated type expectations need a narrow additive adjustment

Implementation constraints:
- do not replace or rename the legacy `AiChat*` models, `ChatRole`, or `InteractionType`
- do not broaden this task into Nest routes, DTOs, repositories for the new S16 entities, or Python service work
- do not invent knowledge-table ownership metadata that the S16 context does not define
- keep this task schema-first and additive so `TASK-1602` through `TASK-1605` can layer on top cleanly

Verification target for implementation:
- `npx.cmd prisma generate`
- `npm.cmd test -- --runInBand src/ai/ai-chat-session.repository.spec.ts src/ai/ai-chat-message.repository.spec.ts src/ai/ai-interaction-log.repository.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: prismaLocal

---

## TESTER REPORT
Verified `TASK-1601` against the aligned local Prisma state and closed the task.

Verification outcomes:
- Prisma Local initially reported one unapplied checked-in migration: `20260329170000_s16_gym_chat_contract_alignment`
- applied that migration locally with `npx.cmd prisma migrate deploy` under the shared `auto_apply_checked_in` guard rule
- confirmed with Prisma Local that the local database schema is now up to date
- rechecked the additive S16 schema surface while preserving the legacy S11 `AiChat*` models and enums

Checks run during test:
- `npx.cmd prisma migrate deploy`
- Prisma Local `migrate_status`
- `npm.cmd test -- --runInBand src/ai/ai-chat-session.repository.spec.ts src/ai/ai-chat-message.repository.spec.ts src/ai/ai-interaction-log.repository.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- checked-in local migration applied successfully
- Prisma Local status: database schema is up to date
- focused legacy AI repository test suites passed (`3` suites, `12` tests)
- build passed
- lint passed

Task closeout notes:
- no extra e2e run was needed for this additive Prisma and repository slice because it did not introduce public HTTP surface changes
- the task stop condition was not hit; the legacy S11 `AiChat*` persistence contract remained intact

MCPs used: prismaLocal

---

## CODER OUTPUT
Implemented the additive S16 Prisma contract slice without broadening into Nest route, DTO, or Python service work.

Key outcomes:
- added `GymChatRole` and `GymFaqCategory` to `prisma/schema.prisma`
- added `GymChatSession`, `GymChatMessage`, and `GymChatInteractionLog`
- added `GymOperatingHour`, `GymSpecialSchedule`, `GymPromotion`, and `GymFaqEntry`
- added the missing reverse relations on `User` for `gym_chat_sessions` and `gym_chat_interaction_logs`
- kept the legacy S11 `AiChat*` models, `ChatRole`, and `InteractionType` intact
- kept `follow_up_suggestions` out of the schema and left it to the logged `response_payload` JSON, matching the narrow S16 contract plan
- added the checked-in migration at `prisma/migrations/20260329170000_s16_gym_chat_contract_alignment/migration.sql`
- regenerated Prisma Client so the local TypeScript build uses the new generated model surface

Files changed for this slice:
- `capstone-backend/prisma/schema.prisma`
- `capstone-backend/prisma/migrations/20260329170000_s16_gym_chat_contract_alignment/migration.sql`

Checks run during implementation:
- `npx.cmd prisma format`
- `npx.cmd prisma generate`
- `npm.cmd test -- --runInBand src/ai/ai-chat-session.repository.spec.ts src/ai/ai-chat-message.repository.spec.ts src/ai/ai-interaction-log.repository.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused legacy AI repository specs passed (`3` suites, `12` tests)
- build passed
- lint passed

MCPs used: prismaLocal
