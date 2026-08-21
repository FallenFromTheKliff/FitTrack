# TASK-1705 - S17 Coverage Pass
**Task ID:** TASK-1705
**Domain:** S17 - Business Analytics
**Status:** done
**Branch:** feat/TASK-1705-s17-coverage-pass
**Created:** 2026-03-30
**Completed:** 2026-03-30
**Priority:** P2
**Depends On:** TASK-1704
**Blocks:** TASK-1706
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the missing coverage exposes a larger contract gap that belongs in an earlier implementation task instead of a focused test slice
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** prismaLocal

---

## What
Add the focused Nest and Python coverage for the S17 validation, aggregation, AI-client contract, persistence, and history/detail paths.

## Why
The completed S17 feature needs stable test coverage before a live runtime verification pass can safely close the domain.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Nest unit and controller coverage exists for the S17 DTOs, service orchestration, repository reads, and AI-client validation
- [x] Python tests cover the S17 route, request validation, and insight-response contract
- [x] Focused regression coverage exists for history/detail reads and stored insight payload behavior
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
- `ai-microservice/app`
- `ai-microservice/tests`

## Task Size
- [ ] XS (< 30 lines changed)
- [x] S  (30-80 lines changed)
- [ ] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `npm.cmd test -- --runInBand`
- `uv run pytest`
- `npm.cmd run build`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Implementation plan for `TASK-1705`:

1. Treat this as a focused coverage-hardening slice, not a second implementation task.
   - keep the existing S17 Nest feature code untouched unless a test gap exposes a narrow bug
   - avoid broad e2e expansion or runtime verification here; that still belongs to `TASK-1706`
   - prefer extending the current focused specs over creating a parallel test harness

2. Close the remaining Nest regression gaps around stored insight payload behavior and nullable metadata.
   - extend the S17 Nest specs under `capstone-backend/src/analytics/` instead of creating new business logic files
   - add at least one regression case for history or detail reads when `requester`, `model_used`, `token_count`, or `latency_ms` are null so the safe-response mapping is covered explicitly
   - add any small DTO or repository filter regression needed only if the current spec matrix still misses a meaningful acceptance-criteria edge
   - keep this additive to the current `business-analytics` controller, service, repository, and DTO specs already added in `TASK-1704`

3. Add Python service-level coverage for the S17 provider seam that route tests do not currently exercise.
   - add a focused test module such as `ai-microservice/tests/test_business_insights_service.py`
   - cover `BusinessInsightService.detect_anomalies(...)` with grounded payloads that should and should not emit anomaly flags
   - cover `OpenRouterBusinessInsightProvider.build_openrouter_insight_request(...)` so the strict schema request, anomaly injection, and OpenRouter envelope shape stay locked to the S17 contract
   - cover response parsing for both valid JSON content and invalid provider envelopes or schema mismatches without making live OpenRouter calls
   - keep these tests offline by monkeypatching `httpx.post` or by calling the parsing helpers directly

4. Only extend the existing Python route test if it adds unique contract value beyond the new service tests.
   - keep `ai-microservice/tests/test_business_insights_api.py` as the route-level validation and response-contract layer
   - add a small extra route assertion only if needed to prove anomaly flags or nullable response metadata survive the FastAPI response model unchanged
   - do not rewrite the whole route suite if the current validation coverage already holds

5. Verify with the smallest useful cross-stack command set after the test additions.
   - `npm.cmd test -- --runInBand src/analytics/business-analytics.controller.spec.ts src/analytics/business-analytics-insight.service.spec.ts src/analytics/business-insight-run.repository.spec.ts src/analytics/dto/business-analytics-insight.dto.spec.ts src/analytics/analytics.service.spec.ts src/ai/ai-python-client.service.spec.ts`
   - `uv run pytest tests/test_business_insights_api.py tests/test_business_insights_service.py`
   - `npm.cmd run build`
   - `npm.cmd run lint:check`

Expected files to touch:
- `capstone-backend/src/analytics/business-analytics-insight.service.spec.ts`
- `capstone-backend/src/analytics/business-insight-run.repository.spec.ts`
- `capstone-backend/src/analytics/dto/business-analytics-insight.dto.spec.ts` only if a meaningful DTO gap remains after inspection
- `capstone-backend/src/analytics/analytics.service.spec.ts` only if an S17 aggregation regression gap is still uncovered
- `capstone-backend/src/ai/ai-python-client.service.spec.ts` only if a small negative-path gap remains
- `ai-microservice/tests/test_business_insights_api.py` only if a route-level response-contract gap remains
- `ai-microservice/tests/test_business_insights_service.py`

Planning notes:
- `TASK-1703` already covers the FastAPI route contract and request validation at the API layer, and `TASK-1704` already covers the core Nest controller, DTO, repository, service, and AI-client seams
- the highest-signal uncovered risk now sits in the Python provider and anomaly-detection seam plus a few nullable stored-payload regressions on the Nest side
- Prisma Local still reports the checked-in migration `20260330110000_s17_business_insight_contract_alignment` as unapplied locally, but this test-only slice should not need to apply it unless an unexpected DB-backed check appears

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the focused S17 coverage-hardening slice without widening the feature surface.

- Extended the Nest insight-service history mapping coverage to prove nullable stored requester and insight metadata are handled safely.
- Extended the `BusinessInsightRunRepository` spec to lock in persistence behavior when Python omits optional `model_used` and `token_count` metadata.
- Added focused offline Python service coverage for anomaly detection, OpenRouter request construction, successful provider-response parsing, and invalid-provider-schema rejection.
- Kept the existing S17 route and orchestration code unchanged; this slice only adds the remaining high-signal regression and provider tests called out in the planner output.
- Verification run:
  - `npm.cmd test -- --runInBand src/analytics/business-analytics.controller.spec.ts src/analytics/business-analytics-insight.service.spec.ts src/analytics/business-insight-run.repository.spec.ts src/analytics/dto/business-analytics-insight.dto.spec.ts src/analytics/analytics.service.spec.ts src/ai/ai-python-client.service.spec.ts`
  - `uv run pytest tests/test_business_insights_api.py tests/test_business_insights_service.py`
  - `npm.cmd run build`
  - `npm.cmd run lint:check`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verified the focused S17 coverage-hardening slice against the task acceptance criteria and reran the targeted cross-stack checks for closeout.

- Nest regression coverage now explicitly locks the controller, service, repository, DTO, analytics-service, and AI-client seams for the completed S17 insight flow.
- Python verification now covers both the existing route contract and the offline provider or anomaly seam, including invalid-provider-schema rejection without live OpenRouter calls.
- The task remains additive only: no business-logic surface changed during closeout, no secret user fields were introduced in tested responses, and the module's existing Swagger-decorated HTTP surface remains intact.

Checks run during test:
- `npm.cmd test -- --runInBand src/analytics/business-analytics.controller.spec.ts src/analytics/business-analytics-insight.service.spec.ts src/analytics/business-insight-run.repository.spec.ts src/analytics/dto/business-analytics-insight.dto.spec.ts src/analytics/analytics.service.spec.ts src/ai/ai-python-client.service.spec.ts`
- `uv run pytest tests/test_business_insights_api.py tests/test_business_insights_service.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused Nest specs passed (`42` tests across `6` suites)
- focused Python specs passed (`8` tests)
- build passed
- lint passed
- Prisma Local still reports the checked-in local migration `20260330110000_s17_business_insight_contract_alignment` as unapplied, but it does not block this non-runtime verification slice

MCPs used: serena, prismaLocal
