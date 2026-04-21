# TASK-1603 - Gym Knowledge Admin Surface
**Task ID:** TASK-1603
**Domain:** S16 - AI Chatbot
**Status:** done
**Branch:** feat/TASK-1603-gym-knowledge-admin-surface
**Created:** 2026-03-29
**Completed:** 2026-03-29
**Priority:** P1
**Depends On:** TASK-1601
**Blocks:** TASK-1605, TASK-1606, TASK-1607
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the S16 context leaves unresolved product rules for overlapping schedules, promotion precedence, or FAQ publication state
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** prismaLocal

---

## What
Add the admin knowledge management surface for the S16 grounded chatbot inputs: operating hours, special schedules, promotions, and FAQ entries.

## Why
The chatbot cannot ground answers reliably until the backend can manage the structured gym knowledge sources that feed the chat payload.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Admin DTOs and CRUD or list routes exist for the S16 knowledge entities
- [x] Admin auth and role enforcement matches repo standards
- [x] The knowledge write paths validate the structured fields required by the chat grounding contract
- [x] Member-facing chat routes remain separate from admin knowledge management routes
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
Implementation plan for `TASK-1603`:

1. Add a dedicated admin knowledge surface under the S16 `gym-chat` route family without mixing it into the member session controller.
   - add a `GymKnowledgeController` under `/v1/gym-chat/knowledge`
   - keep the member session routes in `GymChatController` unchanged so the admin surface stays clearly separate
   - apply `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.admin)`, and `@ApiBearerAuth('access-token')` on every knowledge route to match existing admin controller patterns

2. Introduce S16-specific admin DTOs and response models for the knowledge entities.
   - add `UpsertGymOperatingHoursDTO`, `CreateGymSpecialScheduleDTO`, `CreateGymPromotionDTO`, and `CreateGymFaqEntryDTO`
   - add matching response DTOs for `GymOperatingHour`, `GymSpecialSchedule`, `GymPromotion`, and `GymFaqEntry`
   - validate time, date, enum, boolean, and array fields directly from the S16 contract
   - use an explicit array-validation path for `PUT /v1/gym-chat/knowledge/hours` so each submitted weekly-hours row is validated, not just the outer body

3. Add one bounded repository seam for the admin knowledge entities instead of scattering raw Prisma through the controller.
   - create a `GymKnowledgeRepository` that owns:
     - list operating hours ordered by `day_of_week ASC`
     - replace weekly operating hours through an atomic transaction
     - paginated list and create helpers for special schedules, promotions, and FAQ entries
   - treat `PUT /knowledge/hours` as an authoritative weekly snapshot: upsert provided weekdays, keep those rows active, and mark omitted existing weekdays inactive in the same transaction
   - keep special schedule, promotion, and FAQ persistence limited to the documented list/create surface in this task

4. Add a focused service layer that keeps controller logic thin and response mapping explicit.
   - create `GymKnowledgeService` with list and create or replace methods for each knowledge entity
   - map Prisma records into response DTOs and reuse the repo-standard paginated result envelope
   - do not broaden this slice into grounded chat assembly, Python integration, or public member knowledge reads

5. Keep `TASK-1603` scoped to the exact documented admin endpoints and avoid inventing extra lifecycle rules.
   - implement only:
     - `GET /v1/gym-chat/knowledge/hours`
     - `PUT /v1/gym-chat/knowledge/hours`
     - `GET /v1/gym-chat/knowledge/special-schedules`
     - `POST /v1/gym-chat/knowledge/special-schedules`
     - `GET /v1/gym-chat/knowledge/promotions`
     - `POST /v1/gym-chat/knowledge/promotions`
     - `GET /v1/gym-chat/knowledge/faqs`
     - `POST /v1/gym-chat/knowledge/faqs`
   - do not add PATCH or DELETE routes, overlap blocking, promotion precedence rules, or FAQ publication workflows in this slice

6. Cover the admin knowledge surface with focused tests only.
   - add controller specs for admin guard metadata and delegation
   - add service and repository specs for hours replacement, paginated list ordering, and create flows
   - add a dedicated e2e-style route harness for admin success paths, member `403` rejections, and DTO validation failures
   - reserve broader grounding behavior and runtime API verification for downstream S16 tasks

Expected files to touch:
- `capstone-backend/src/ai/gym-knowledge.controller.ts`
- `capstone-backend/src/ai/gym-knowledge.service.ts`
- `capstone-backend/src/ai/gym-knowledge.repository.ts`
- `capstone-backend/src/ai/dto/gym-knowledge.dto.ts`
- `capstone-backend/src/ai/ai.module.ts`
- focused spec files under `capstone-backend/src/ai/`
- a dedicated admin knowledge e2e file under `capstone-backend/test/`

Implementation constraints:
- do not mutate the legacy `/v1/ai/*` surface or the new member `GymChatController` routes in this task
- do not invent PATCH, DELETE, deactivation, or precedence endpoints for schedules, promotions, or FAQs
- do not broaden into Python `/chat/gym`, grounded source assembly, or session message persistence
- keep admin knowledge writes fully behind admin-only auth and role checks

Verification target for implementation:
- focused `npm.cmd test -- --runInBand` coverage for the new controller, service, repository, and DTO behavior
- focused `npm.cmd run test:e2e -- --runInBand` coverage for the admin knowledge routes
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: prismaLocal

---

## TESTER REPORT
Verified `TASK-1603` against the current local S16 workspace state and closed the task.

Verification outcomes:
- rechecked the admin knowledge controller, service, repository, DTOs, and dedicated e2e harness to confirm the slice stayed additive and did not disturb the legacy `/v1/ai/*` flow or the member `gym-chat` routes
- confirmed with Prisma Local that the local schema is still up to date and there is no checked-in migration blocker before task close
- reran the focused unit, e2e, build, and lint checks from the test boundary before rotating the queue

Checks run during test:
- Prisma Local `migrate_status`
- `npm.cmd test -- --runInBand src/ai/gym-knowledge.controller.spec.ts src/ai/gym-knowledge.service.spec.ts src/ai/gym-knowledge.repository.spec.ts`
- `npm.cmd run test:e2e -- --runInBand test/gym-knowledge.e2e-spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- Prisma Local status: database schema is up to date
- focused gym-knowledge unit specs passed (`3` suites, `15` tests)
- dedicated gym-knowledge e2e route spec passed (`1` suite, `3` tests)
- build passed
- lint passed

Task closeout notes:
- no runtime API verification was needed in this phase because `TASK-1603` is not the final S16 HTTP verification slice
- the task stop condition was not hit; the admin knowledge surface stayed within the documented `GET`, `PUT`, and `POST` contract and did not require a new product decision

MCPs used: prismaLocal

---

## CODER OUTPUT
Implemented the additive S16 admin knowledge-management surface under `/v1/gym-chat/knowledge` without disturbing the legacy `/v1/ai/*` flow or the finished member `gym-chat` routes.

Key outcomes:
- added `UpsertGymOperatingHoursDTO`, `CreateGymSpecialScheduleDTO`, `CreateGymPromotionDTO`, and `CreateGymFaqEntryDTO` plus matching response DTOs in `capstone-backend/src/ai/dto/gym-knowledge.dto.ts`
- added `GymKnowledgeRepository` for active knowledge reads, authoritative weekly-hours replacement, and create helpers for special schedules, promotions, and FAQ entries
- added `GymKnowledgeService` to enforce duplicate weekday rejection and map Prisma date, time, and keyword JSON fields into the S16 response contract
- added `GymKnowledgeController` under `/v1/gym-chat/knowledge` with admin-only JWT and role enforcement plus Swagger response metadata
- wired the new controller, service, and repository into `AiModule` additively so the legacy S11 controller and the S16 member `GymChatController` remain intact
- added focused controller, service, and repository specs plus a dedicated `test/gym-knowledge.e2e-spec.ts` route harness for admin success paths, member `403` rejection, and array-body validation on `PUT /knowledge/hours`

Files changed for this slice:
- `capstone-backend/src/ai/dto/gym-knowledge.dto.ts`
- `capstone-backend/src/ai/gym-knowledge.repository.ts`
- `capstone-backend/src/ai/gym-knowledge.service.ts`
- `capstone-backend/src/ai/gym-knowledge.controller.ts`
- `capstone-backend/src/ai/gym-knowledge.controller.spec.ts`
- `capstone-backend/src/ai/gym-knowledge.service.spec.ts`
- `capstone-backend/src/ai/gym-knowledge.repository.spec.ts`
- `capstone-backend/src/ai/ai.module.ts`
- `capstone-backend/test/gym-knowledge.e2e-spec.ts`

Checks run during implementation:
- `npm.cmd test -- --runInBand src/ai/gym-knowledge.controller.spec.ts src/ai/gym-knowledge.service.spec.ts src/ai/gym-knowledge.repository.spec.ts`
- `npm.cmd run test:e2e -- --runInBand test/gym-knowledge.e2e-spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused gym-knowledge unit specs passed (`3` suites, `15` tests)
- dedicated gym-knowledge e2e route spec passed (`1` suite, `3` tests)
- build passed
- lint passed

Scope notes:
- no Prisma schema changes were required in this task
- `PUT /v1/gym-chat/knowledge/hours` now acts as the authoritative weekly snapshot and omits patch or delete behavior by design
- schedules, promotions, and FAQs stay limited to the documented list and create surface in this slice

MCPs used: prismaLocal
