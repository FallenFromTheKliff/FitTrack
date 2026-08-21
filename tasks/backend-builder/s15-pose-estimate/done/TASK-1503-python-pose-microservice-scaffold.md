# TASK-1503 - Python Pose Microservice Scaffold
**Task ID:** TASK-1503
**Domain:** S15 - Pose Estimate
**Status:** done
**Branch:** feat/TASK-1503-python-pose-microservice-scaffold
**Created:** 2026-03-29
**Completed:** 2026-03-29
**Priority:** P1
**Depends On:** TASK-1502
**Blocks:** TASK-1504, TASK-1505, TASK-1506
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** stop if the shared Python contracts are insufficient to choose safe request or response shapes for the FastAPI implementation
**Escalation Notes:** none
**Touches Prisma:** no
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena

---

## What
Scaffold the FastAPI-based pose microservice and implement the S15 contract routes for health, session bootstrap, frame analysis, and session finalize with deterministic in-memory session handling.

## Why
The Nest side can only integrate meaningfully once the Python service boundary exists and returns the contract-defined payload shapes from a real service scaffold.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] `ai-microservice/` contains a runnable FastAPI app for the S15 pose service boundary
- [x] `GET /health`, `POST /pose/session/bootstrap`, `POST /pose/analyze`, and `POST /pose/session/finalize` exist with request and response models aligned to the shared contracts
- [x] The pose analyze path stays vision-only and does not call OpenRouter during the live frame loop
- [x] The finalize path reserves unknown-exercise fallback as a finalize-time boundary only
- [x] Python-side contract tests exist using `pytest` plus `FastAPI TestClient`
- [x] Build passes (`npm.cmd run build`) when the Nest workspace is still part of the touched set
- [x] Relevant tests pass
- [x] Lint check passes (`npm.cmd run lint:check`) where linting is already configured
- [x] No avoidable `any` types used
- [x] No secret fields in responses (password, credential_hash, token_hash)
- [x] Swagger decorators applied where the module already follows Swagger
- [x] Runtime API verification completed when required

## Context Files to Include
- `agents/guardrails.md`
- `agents/architecture.md`
- `context/00-global-contracts.md`
- `context/python/00-python-microservice-contracts.md`
- `context/python/s15-pose-estimate.md`
- `tasks/s15-pose-estimate/README.md`
- `tasks/s15-pose-estimate/execution.md`
- `tasks/s15-pose-estimate/decisions.md`

## Module Hints
- `ai-microservice`
- `capstone-backend/src/ai`
- `capstone-backend/src/fitness/pose`

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
Implementation plan for `TASK-1503`:

1. Create a minimal Python project scaffold inside `ai-microservice/` using a simple FastAPI layout that is easy to run locally and easy for later S16 and S17 tasks to extend.
   - Add a lightweight dependency manifest for the shared Python stack used in this repo slice: `fastapi`, `uvicorn`, `pydantic`, `pytest`, and the FastAPI test client dependency path.
   - Create source folders for app entrypoint, route wiring, request and response models, service logic, and test coverage.
   - Keep the structure focused on service-boundary code only; do not add Docker, provider adapters, or database wiring in this task.

2. Define Pydantic request and response models that match the shared S15 contracts and the current Nest client validators exactly.
   - `GET /health` returns `{ "status": "ok" }`.
   - `POST /pose/session/bootstrap` accepts `pose_session_id`, `exercise_hint`, `starter_catalog`, and `candidate_profiles`, and returns `status`, `accepted_fps`, and `subject_lock_mode`.
   - `POST /pose/analyze` accepts `pose_session_id` and `frame_b64`, and returns the full pose-analyze payload with numeric fields and optional metadata shaped so the existing Nest validator accepts it.
   - `POST /pose/session/finalize` accepts `pose_session_id` and returns `detected_exercise_name`, `matched_profile_id`, confidence values, `analysis_summary`, and optional `learned_profile` with numeric `dominant_joint_angles`.

3. Implement a deterministic in-memory pose-session service keyed by `pose_session_id`.
   - Bootstrap stores the exercise hint, starter catalog, candidate profiles, and session counters in memory, and returns a stable ready response.
   - Analyze reads the existing in-memory state and derives a deterministic vision-only result from the session data plus incoming frame payload without calling OpenRouter or any external provider.
   - Finalize summarizes the accumulated in-memory state, returns the final contract payload, and clears the session from memory after producing the response.
   - Keep unknown-exercise handling as a finalize-only internal boundary. In this task it stays deterministic and local rather than integrating a real provider.

4. Expose the FastAPI routes and error shape cleanly.
   - Mount the four S15 routes from a single app entrypoint.
   - Return RFC-7807-style error payloads for missing sessions or malformed requests where FastAPI does not already produce an acceptable contract shape.
   - Keep the service public surface internal-only and avoid any JWT, RBAC, Prisma, or Nest response-envelope concerns.

5. Add Python-side contract tests with `pytest` and `FastAPI TestClient`.
   - Cover health success.
   - Cover bootstrap success and the expected ready payload.
   - Cover analyze after bootstrap, including returned optional fields and deterministic rep-count behavior.
   - Cover finalize after bootstrap and analyze, including numeric `analysis_summary` fields and optional learned-profile shape.
   - Cover missing-session error behavior for analyze and finalize so later integration work has a stable failure contract.

6. Verification target for implementation.
   - Run Python contract tests first.
   - Run `npm.cmd run build` to ensure the Nest workspace still builds cleanly beside the new Python scaffold.
   - Run `npm.cmd run lint:check` if the touched set still includes checked Node files or shared repo checks rely on it.
   - Do not pull `TASK-1504` lifecycle rewiring, socket-event changes, or learned-profile persistence into this task.

Files expected to be touched:
- `ai-microservice/requirements.txt` or equivalent lightweight dependency manifest
- `ai-microservice/app/main.py`
- `ai-microservice/app/...` models, routes, and service modules for the pose contract
- `ai-microservice/tests/...` contract tests

MCPs used: serena

---

## CODER OUTPUT
Implemented the FastAPI scaffold inside `ai-microservice/` with a minimal project manifest, app entrypoint, route module, request and response models, RFC-7807-style service errors, and a deterministic in-memory pose-session service for bootstrap, analyze, and finalize flows.

Behavior delivered in this phase:
- `GET /health` returns `{ "status": "ok" }`.
- `POST /pose/session/bootstrap` stores session-scoped in-memory state keyed by `pose_session_id` and returns the ready contract payload.
- `POST /pose/analyze` stays vision-only, derives deterministic rep and feedback metadata from session state plus frame input, and never calls OpenRouter.
- `POST /pose/session/finalize` performs the finalize-only fallback boundary, returns the contract summary payload, conditionally emits a learned profile when no candidate profile matched, and clears the in-memory session.
- Python-side contract coverage exists in `pytest` using `FastAPI TestClient`, including success and missing-session error paths.

Implementation checks run:
- `uv run pytest`
- `npm.cmd run build`
- `npm.cmd run lint:check`

Notes:
- `uv` required workspace-local `UV_CACHE_DIR` and `UV_PYTHON_INSTALL_DIR` overrides in this sandbox to avoid protected user-profile directories.
- The Python scaffold stays aligned to the session-keyed S15 contract. The older Nest live analyze request shape remains intentionally untouched for `TASK-1504`.

MCPs used: serena

---

## TESTER REPORT
Verification completed for the FastAPI scaffold and its contract surface.

What was verified:
- Re-read the Python app entrypoint, route wiring, in-memory pose-session service, and contract tests to confirm the implementation stayed inside `TASK-1503` scope.
- Verified the service returns the expected session-keyed bootstrap, analyze, and finalize payloads plus RFC-7807-style missing-session errors.
- Confirmed the live analyze loop remains deterministic and local, while unknown-exercise handling stays at the finalize boundary only.
- Confirmed the added Python scaffold does not break the Nest workspace build or lint checks.

Checks run:
- `uv run pytest` with workspace-local `UV_CACHE_DIR` and `UV_PYTHON_INSTALL_DIR` overrides: passed (`7` tests)
- `npm.cmd run build`: passed
- `npm.cmd run lint:check`: passed

Not run:
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`

Why not:
- This task changed only the new Python microservice scaffold plus task bookkeeping, and the direct Python contract suite already covered the new behavior. The Nest workspace checks stayed green through build and lint.

Notes:
- The generic Swagger/runtime-verification checklist items are effectively not applicable to this task slice because `TASK-1503` is an internal FastAPI scaffold and `Needs Runtime API Verification` is explicitly `no`.
- The next task remains `TASK-1504`, which is where the Nest WebSocket lifecycle must be rewired to the new Python contract boundary.

MCPs used: serena
