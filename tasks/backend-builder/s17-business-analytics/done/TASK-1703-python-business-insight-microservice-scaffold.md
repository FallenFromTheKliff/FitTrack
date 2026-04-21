# TASK-1703 - Python Business Insight Microservice Scaffold
**Task ID:** TASK-1703
**Domain:** S17 - Business Analytics
**Status:** done
**Branch:** feat/TASK-1703-python-business-insight-microservice-scaffold
**Created:** 2026-03-30
**Completed:** 2026-03-30
**Priority:** P1
**Depends On:** TASK-1702
**Blocks:** TASK-1704, TASK-1705, TASK-1706
**Auto-Eligible:** yes
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the OpenRouter structured-output boundary or provider policy needs a product decision beyond the S17 contract
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** yes
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | context7

---

## What
Scaffold the FastAPI `POST /analytics/insights` boundary, request and response models, and the OpenRouter-ready Python insight service seam for S17.

## Why
The Nest side cannot complete the S17 flow until the Python service exposes the shared contract for grounded analytics insight generation.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] FastAPI exposes the S17 `POST /analytics/insights` route beside the existing health, gym-chat, and pose routes
- [x] Python request and response models validate the S17 grounding payload and strict structured output shape
- [x] The Python service includes an OpenRouter-ready provider seam for business insights without coupling the route contract to one provider implementation
- [x] Focused Python contract tests cover successful insight generation and malformed-request handling
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
- `ai-microservice/app/api`
- `ai-microservice/app/models`
- `ai-microservice/app/services`
- `ai-microservice/tests`

## Task Size
- [ ] XS (< 30 lines changed)
- [ ] S  (30-80 lines changed)
- [x] M  (80-150 lines changed)
- [ ] L  - split into 2 tasks first unless the user explicitly wants a larger slice

## Verification Commands
- `uv run pytest`
- `npm.cmd run build`
- `npm.cmd run lint:check`

---

## PLANNER OUTPUT
Implementation plan for `TASK-1703`:

1. Add a dedicated S17 Python model module that mirrors the Nest-owned grounding payload and the strict insight response contract.
   - create `ai-microservice/app/models/business_insights.py`
   - follow the existing microservice pattern by defining a local `StrictModel` with `ConfigDict(extra="forbid")`
   - model the nested grounding sections exactly: `window`, `overview`, `revenue`, `attendance`, `membership`, `coaching`, and optional `inventory`
   - add the route input wrapper `{ grounding: ... }` and the response model with `summary`, `highlights`, `risks`, `opportunities`, `anomaly_flags`, `recommended_actions`, `model_used`, and `token_count`
   - keep request and response models separate so the response contract can stay filtered and future-safe, matching FastAPI `response_model` guidance from the official docs

2. Add a dedicated business-insight service module with a provider seam that is OpenRouter-oriented without coupling the route contract to one implementation detail.
   - create `ai-microservice/app/services/business_insights.py`
   - define a small provider protocol or abstract seam such as `BusinessInsightProvider.generate_business_insight(...)`
   - implement a service class such as `BusinessInsightService.generate_insight(...)` that accepts the validated request model and returns the validated response model
   - include an OpenRouter-ready adapter helper in this slice, such as `build_openrouter_insight_request(...)`, and keep runtime configuration local to the service via `os.getenv(...)` plus the defaults from `context/python/00-python-microservice-contracts.md`
   - if implementation needs `httpx` at runtime, promote the existing `httpx` dependency from the dev group into the main dependency list instead of introducing a brand-new library family

3. Wire the new route into the existing FastAPI router without refactoring unrelated microservice boundaries.
   - update `ai-microservice/app/api/routes.py`
   - instantiate a `BusinessInsightService` beside the current gym-chat and pose services
   - add `@router.post("/analytics/insights", response_model=BusinessAnalyticsInsightResponse)`
   - keep the global `RequestValidationError` handler in `app/main.py` unchanged so malformed nested payloads continue to surface through the existing RFC-7807-style `422` shape

4. Keep the scaffold deterministic in tests while preserving the default runtime provider seam for OpenRouter.
   - add `ai-microservice/tests/test_business_insights_api.py`
   - cover one successful `POST /analytics/insights` contract case using `TestClient`
   - monkeypatch the business-insight service or its provider for the success path so tests stay offline and deterministic
   - add malformed-request coverage for at least one nested validation failure and one extra-field failure to prove the new strict models match the current validation/error pattern
   - keep the existing `test_gym_chat_api.py` and `test_pose_api.py` untouched unless a narrow shared import needs updating

5. Keep this task scoped to the Python scaffold and stop before Nest orchestration or runtime verification work.
   - do not add Nest controller/client code here; that belongs to `TASK-1704`
   - do not persist anything from Python or reach into PostgreSQL/Prisma
   - do not broaden into the final live API verification slice; that remains `TASK-1706`
   - do not redesign the shared FastAPI exception handler or existing gym-chat/pose routes unless a direct blocker appears

6. Verify with the smallest useful task-sized command set after implementation.
   - `uv run pytest tests/test_business_insights_api.py tests/test_gym_chat_api.py tests/test_pose_api.py`
   - `npm.cmd run build`
   - `npm.cmd run lint:check`

Expected files to touch:
- `ai-microservice/app/api/routes.py`
- `ai-microservice/app/models/business_insights.py`
- `ai-microservice/app/services/business_insights.py`
- `ai-microservice/tests/test_business_insights_api.py`
- `ai-microservice/pyproject.toml` only if the OpenRouter adapter needs `httpx` in runtime dependencies

Implementation constraints:
- keep the S17 route contract aligned to `context/python/s17-business-analytics.md` and the Nest grounding shape already added in `capstone-backend/src/analytics/analytics.types.ts`
- keep explicit `response_model` usage on the FastAPI route, following the official FastAPI guidance that request models drive validation and response models drive validation, documentation, and output filtering
- keep tests offline by monkeypatching the service or provider rather than attempting live OpenRouter traffic in the scaffold slice
- do not turn this task into the Nest caller or insight-history implementation; that remains downstream work

Planning notes:
- Serena was attempted first again but timed out in this session, so planning relied on local file inspection
- Context7 FastAPI docs confirmed the current repo pattern should continue using Pydantic request bodies plus explicit `response_model` output filtering for the new route

MCPs used: context7

---

## CODER OUTPUT
Implemented the S17 Python insight scaffold inside `ai-microservice` without broadening into Nest orchestration, persistence, or runtime API verification work.

Key outcomes:
- added the strict S17 request and response models at `ai-microservice/app/models/business_insights.py`
- added `BusinessInsightService` plus an `OpenRouterBusinessInsightProvider` seam at `ai-microservice/app/services/business_insights.py`
- wired `POST /analytics/insights` into `ai-microservice/app/api/routes.py` with explicit FastAPI `response_model` usage
- added focused route-level contract coverage in `ai-microservice/tests/test_business_insights_api.py`
- promoted `httpx` into runtime dependencies in `ai-microservice/pyproject.toml` because the new provider seam uses it directly

Files changed for this slice:
- `ai-microservice/app/models/business_insights.py`
- `ai-microservice/app/services/business_insights.py`
- `ai-microservice/app/api/routes.py`
- `ai-microservice/tests/test_business_insights_api.py`
- `ai-microservice/pyproject.toml`

Checks run during implementation:
- `uv run pytest tests/test_business_insights_api.py tests/test_gym_chat_api.py tests/test_pose_api.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused Python API specs passed (`18` tests)
- build passed
- lint passed

Task closeout notes:
- the success-path test keeps the route deterministic by monkeypatching the business-insight service, while the default runtime provider remains OpenRouter-oriented
- Serena timed out again in this session, so implementation used local file inspection and Context7-backed library guidance

MCPs used: context7

---

## TESTER REPORT
Verified the S17 Python scaffold against the focused microservice contract tests and the repo-level Nest code checks required by the task.

Verification outcomes:
- the new `/analytics/insights` route accepts the nested S17 grounding payload and returns the expected structured response shape
- strict nested validation rejects invalid focus values and extra nested fields through the existing RFC-7807-style `422` handler
- the new Python files did not break the existing gym-chat or pose API contract tests

Checks run during test:
- `uv run pytest tests/test_business_insights_api.py tests/test_gym_chat_api.py tests/test_pose_api.py`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Results:
- focused Python API specs passed (`18` tests)
- build passed
- lint passed
- the Python test command initially hit a local `uv` cache permission error inside the sandbox, then passed after an escalated rerun

MCPs used: none
