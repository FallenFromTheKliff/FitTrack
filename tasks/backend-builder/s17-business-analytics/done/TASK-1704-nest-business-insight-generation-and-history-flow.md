# TASK-1704 - Nest Business Insight Generation And History Flow
**Task ID:** TASK-1704
**Domain:** S17 - Business Analytics
**Status:** done
**Branch:** feat/TASK-1704-nest-business-insight-generation-and-history-flow
**Created:** 2026-03-30
**Completed:** 2026-03-30
**Priority:** P1
**Depends On:** TASK-1701, TASK-1702, TASK-1703
**Blocks:** TASK-1705, TASK-1706
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the admin auth model, insight response shape, or history semantics conflict with the S17 context instead of being a straightforward implementation gap
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Wire the admin-facing Nest `business-analytics` HTTP surface, validated Python client method, insight-run persistence, and history/detail reads for the completed S17 contract.

## Why
This is the task that turns the S17 schema, grounding, and Python scaffold into the actual operator-facing feature described by the domain context.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Nest exposes `POST /v1/business-analytics/insights`, `GET /v1/business-analytics/insights`, and `GET /v1/business-analytics/insights/:id` for admins
- [x] DTO validation matches the S17 contract for `focus`, `period`, and optional date windows
- [x] `AiPythonClientService` exposes a validated S17 business-insight request helper and response guard
- [x] Insight runs are persisted to `BusinessInsightRun` with request, response, model, token, and latency metadata
- [x] History and detail reads come from the stored insight payload without re-calling Python
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
- `context/python/s17-business-analytics.md`
- `tasks/s17-business-analytics/README.md`
- `tasks/s17-business-analytics/execution.md`
- `tasks/s17-business-analytics/decisions.md`

## Module Hints
- `capstone-backend/src/analytics`
- `capstone-backend/src/ai`
- `capstone-backend/prisma`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd test -- --runInBand`
- `npm.cmd run build`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Implementation plan for `TASK-1704`:

1. Add the dedicated S17 admin HTTP surface without changing the existing S13 KPI routes.
   - create a separate controller under `capstone-backend/src/analytics` with `@Controller('business-analytics')`
   - expose `POST /insights`, `GET /insights`, and `GET /insights/:id` with `JwtAuthGuard`, `RolesGuard`, `@Roles(UserRole.admin)`, and Swagger envelope or pagination metadata
   - keep `AnalyticsController` unchanged so `/v1/analytics/{overview,revenue,attendance,members,coaches}` remains stable

2. Add DTOs and response models for generation, history, and detail reads.
   - add `GenerateBusinessInsightDTO` with optional `focus`, `period`, `start_date`, and `end_date`
   - add `BusinessInsightFilterDTO` on top of `PaginationDTO` with optional `focus` and `period` filters for history reads
   - add typed response DTOs for a run summary, run detail, and a safe requester snapshot instead of exposing raw Prisma models
   - reuse the existing `IsOnOrAfter` validator and Prisma enums so the request contract matches the S17 context exactly

3. Add a dedicated persistence seam for `BusinessInsightRun`.
   - create `BusinessInsightRunRepository` with `createInsightRun(...)`, paginated `listInsightRuns(...)`, and `findInsightRunByIdOrThrow(...)`
   - include the optional requester relation with only safe `User` and `UserProfile` fields needed for admin history reads
   - persist the exact Python request body as `request_payload` and the validated Python response as `insight_payload`, while storing `focus`, `period`, `start_date`, and `end_date` in the indexed columns for filtering

4. Implement the orchestration in a separate analytics-side service instead of widening `AnalyticsService`.
   - add `BusinessAnalyticsInsightService` that composes `AnalyticsService`, `AiPythonClientService`, and `BusinessInsightRunRepository`
   - call `analyticsService.buildBusinessInsightGroundingPayload(dto)` first and treat the returned `grounding.window` as the canonical normalized request snapshot for persistence
   - call the Python `/analytics/insights` contract, measure latency, and persist `model_used`, `token_count`, and `latency_ms` on successful validated runs
   - serve history and detail entirely from stored `BusinessInsightRun` records without recomputing KPIs or re-calling Python

5. Extend `AiPythonClientService` with the S17 business-insight contract.
   - add request and response types aligned to `ai-microservice/app/models/business_insights.py`
   - add a dedicated `generateBusinessInsight(...)` method that posts to `/analytics/insights`
   - add a response guard for `summary`, the string-array narrative fields, and optional `model_used` plus `token_count`
   - reuse the existing `AI_API_BASE_URL` and request-timeout config seam; do not add new Nest-side provider env vars in this slice because Python already owns the OpenRouter settings

6. Wire the module boundaries additively.
   - update `AnalyticsModule` to import `AiModule` and register the new controller, service, and repository
   - keep the new S17 HTTP surface in `src/analytics`, because analytics already owns KPI assembly and the admin route contract
   - do not change the checked-in Prisma schema or Python route in this task unless a direct contract mismatch is discovered during implementation

7. Keep verification focused on the new orchestration seam, not the full final regression matrix.
   - extend `ai-python-client.service.spec.ts` with S17 request-shape and payload-validation coverage
   - add focused specs for the new S17 repository and service so generation, history, detail, persistence metadata, and requester projection are covered
   - add a light controller spec if needed to cover the admin route wiring and parameter handling without waiting for the later runtime-verification slice
   - leave the broader S17 coverage sweep and live API verification for `TASK-1705` and `TASK-1706`

Expected files to touch:
- `capstone-backend/src/analytics/business-analytics.controller.ts`
- `capstone-backend/src/analytics/business-analytics-insight.service.ts`
- `capstone-backend/src/analytics/business-insight-run.repository.ts`
- `capstone-backend/src/analytics/dto/business-analytics-insight.dto.ts`
- `capstone-backend/src/analytics/analytics.module.ts`
- `capstone-backend/src/ai/ai-python-client.service.ts`
- `capstone-backend/src/ai/ai-python-client.service.spec.ts`
- focused specs under `capstone-backend/src/analytics/`

Implementation constraints:
- treat the grounding payload returned by `AnalyticsService` as the source of truth for normalized `focus`, `period`, and date-window persistence
- persist only successful validated insight generations in `business_insight_runs`; the current schema has no failure column and requires `insight_payload`
- keep the S17 surface additive and separate from the existing S13 analytics routes and the legacy `/v1/ai/*` flow
- do not expose secret or credential-bearing fields in the new history or detail responses

Verification target for implementation:
- focused `npm.cmd test -- --runInBand` coverage for the new controller or service, repository, and AI client path
- `npm.cmd run build`
- `npm.cmd run lint:check`

Non-auto-eligible boundary:
- `TASK-1704` is marked `Auto-Eligible: no`, so normal domain flow should stop at this planning boundary and wait for explicit confirmation before implementation starts.

MCPs used: prismaLocal

---

## CODER OUTPUT
Implemented the additive S17 Nest business-insight flow described in the planner output.

- Added the admin-facing `business-analytics` controller with `POST /insights`, `GET /insights`, and `GET /insights/:id`, guarded for admins and documented with Swagger envelopes.
- Added `GenerateBusinessInsightDTO`, `BusinessInsightFilterDTO`, and typed summary/detail response DTOs with a safe requester snapshot.
- Added `BusinessAnalyticsInsightService` to compose the existing grounding builder, the Python client, and persisted history/detail reads from stored runs.
- Added `BusinessInsightRunRepository` to persist successful validated runs and paginate or fetch them with safe requester projection.
- Extended `AiPythonClientService` with the S17 `/analytics/insights` request helper plus response validation and focused contract coverage.
- Added focused specs for the new controller, service, repository, DTO validation, and the AI client business-insight path.
- Verification run:
  - `npm.cmd test -- --runInBand src/analytics/business-analytics.controller.spec.ts src/analytics/business-analytics-insight.service.spec.ts src/analytics/business-insight-run.repository.spec.ts src/analytics/dto/business-analytics-insight.dto.spec.ts src/ai/ai-python-client.service.spec.ts`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verified the S17 Nest business-insight slice against the focused Nest coverage and repo-level code checks required by the task.

Verification outcomes:
- the admin `business-analytics` generate, history, and detail routes are covered by focused controller, service, repository, DTO, and AI-client specs
- history and detail reads remain stored-payload based and do not re-call Python in the tested orchestration path
- requester projection stays limited to safe user and profile fields, and the new route surface remains additive to the existing S13 analytics endpoints

Checks run during test:
- `npm.cmd test -- --runInBand src/analytics/business-analytics.controller.spec.ts src/analytics/business-analytics-insight.service.spec.ts src/analytics/business-insight-run.repository.spec.ts src/analytics/dto/business-analytics-insight.dto.spec.ts src/ai/ai-python-client.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused Nest specs passed (`33` tests across `5` suites)
- build passed
- lint passed
- Prisma Local still reports the checked-in local migration `20260330110000_s17_business_insight_contract_alignment` as unapplied, but it did not block this non-runtime verification slice

MCPs used: serena, prismaLocal
