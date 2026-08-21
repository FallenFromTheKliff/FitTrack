# TASK-1505 - S15 Coverage Pass
**Task ID:** TASK-1505
**Domain:** S15 - Pose Estimate
**Status:** done
**Branch:** feat/TASK-1505-s15-coverage-pass
**Created:** 2026-03-29
**Completed:** 2026-03-29
**Priority:** P2
**Depends On:** TASK-1504
**Blocks:** TASK-1506
**Auto-Eligible:** yes
**Decision Flags:** none
**Stop If:** stop if meaningful coverage gaps require broad contract changes instead of targeted test additions
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Add the focused Nest and Python coverage needed to lock in the S15 pose contracts after the main session lifecycle is wired.

## Why
S15 spans Prisma-backed persistence, Nest HTTP and WebSocket flows, and a separate Python service boundary, so a dedicated coverage pass is safer than assuming the earlier feature tasks leave enough regression protection.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] Nest unit or integration tests cover the key S15 DTO, repository, service, and gateway edge cases introduced by the new contract
- [x] Python contract tests cover the finalized request and response shapes for health, bootstrap, analyze, and finalize
- [x] At least one cross-boundary verification path exists for the finalized pose lifecycle where the repo already supports it cleanly
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
- `context/python/00-python-microservice-contracts.md`
- `context/python/s15-pose-estimate.md`
- `tasks/s15-pose-estimate/README.md`
- `tasks/s15-pose-estimate/execution.md`
- `tasks/s15-pose-estimate/decisions.md`

## Module Hints
- `capstone-backend/src/fitness/pose`
- `capstone-backend/src/ai`
- `capstone-backend/src/fitness/session`
- `ai-microservice`
- `capstone-backend/test`

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
Implementation plan for `TASK-1505`:

1. Add Nest-side validation coverage for the S15 HTTP surface instead of only metadata and delegation checks.
   - Introduce a small pose-focused e2e or integration spec under `capstone-backend/test/` that mounts `PoseController` with the real global `ValidationPipe`, response interceptor, and auth/role guard overrides used elsewhere in repo tests.
   - Cover invalid `ended_reason` on `POST /v1/pose/sessions/:id/finalize` and invalid `profile_kind` or malformed query values on `GET /v1/pose/profiles`.
   - Keep the scope narrow: validate request parsing and controller wiring, not full backend runtime startup.

2. Extend the current Nest unit specs only where they add value beyond the new HTTP validation coverage.
   - Add focused edge-case assertions in the existing pose specs where the current lifecycle behavior still lacks regression protection, such as no-op finalize idempotency with already-ended sessions or gateway feedback emission when no rep event occurs but lock state changes.
   - Do not reopen core lifecycle implementation unless a test reveals a real contract gap.

3. Expand Python contract tests to cover malformed request behavior explicitly.
   - Add FastAPI `TestClient` cases in `ai-microservice/tests/test_pose_api.py` for invalid bootstrap payloads, invalid analyze payloads, and invalid finalize payloads that should fail with FastAPI validation errors.
   - Keep the current success-path and missing-session 404 tests intact; the new work should only add 422-style malformed-request coverage.

4. Add one lightweight cross-boundary verification path between the finalized Nest client and the real FastAPI contract.
   - Prefer a dedicated integration-style Jest spec that starts the real FastAPI pose app on a local ephemeral port for the duration of the test, then exercises the finalized `AiPythonClientService` bootstrap -> analyze -> finalize sequence against it.
   - Keep this client-to-service proof narrowly scoped to the pose lifecycle contract and deterministic payloads.
   - Do not turn this into full Nest app or WebSocket runtime verification; that remains reserved for `TASK-1506`.

5. Verification target for implementation.
   - Run the focused Nest pose/client specs plus any new pose e2e or integration spec.
   - Run the Python contract suite with the added malformed-request coverage.
   - Run `npm.cmd run build` and `npm.cmd run lint:check`.
   - Keep `npm.cmd run test:e2e -- --runInBand` optional unless the new coverage file naturally lives in the e2e suite and remains fast.

Files expected to be touched:
- `capstone-backend/test/...` pose-focused e2e or integration coverage
- `capstone-backend/src/fitness/pose/pose.controller.spec.ts` only if a small unit-level edge adds value
- `capstone-backend/src/fitness/pose/pose.gateway.spec.ts` only if a current lifecycle edge remains uncovered
- `capstone-backend/src/fitness/pose/pose.service.spec.ts` only if a current lifecycle edge remains uncovered
- `capstone-backend/src/ai/ai-python-client.service.spec.ts` or a new client integration spec
- `ai-microservice/tests/test_pose_api.py`

Recommended scope guard:
- test-only changes unless a discovered regression forces a tiny production fix
- no Swagger/runtime driver work here
- no new Prisma schema changes

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S15 coverage pass with one small production validator fix and three focused test additions:

- `capstone-backend/test/pose.integration.spec.ts`
  - adds a narrow PoseController integration suite with the real global `ValidationPipe`, `ResponseInterceptor`, and `HttpExceptionFilter`
  - covers invalid `ended_reason`, invalid `profile_kind`, and member-forbidden admin listing access
- `capstone-backend/src/ai/ai-python-client.integration.spec.ts`
  - adds a cross-boundary Jest integration spec that starts the real FastAPI app, then exercises `bootstrap -> analyze -> finalize` through `AiPythonClientService`
  - hardens Windows cleanup by waiting for the spawned process `close` event and destroying stdio handles
- `ai-microservice/tests/test_pose_api.py`
  - adds malformed-request coverage for invalid bootstrap `profile_kind`, blank analyze `frame_b64`, and blank finalize `pose_session_id`
- `capstone-backend/src/ai/ai-python-client.service.ts`
  - fixes the finalize-payload validator so `learned_profile: null` remains accepted when the real FastAPI contract returns a matched profile without a learned profile payload

Verification completed during implementation:

- `uv run pytest` with workspace-local `UV_CACHE_DIR` and `UV_PYTHON_INSTALL_DIR`
- `npm.cmd test -- --runInBand test/pose.integration.spec.ts src/ai/ai-python-client.integration.spec.ts src/ai/ai-python-client.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed for the S15 coverage pass and the task is ready to close.

What was verified:
- Confirmed the new Nest-side pose integration suite covers request-validation and authorization edges for the finalized HTTP surface.
- Confirmed the Python contract suite now covers malformed bootstrap, analyze, and finalize payloads in addition to the existing happy-path and missing-session cases.
- Confirmed the new cross-boundary `AiPythonClientService` integration spec exercises the real FastAPI bootstrap, analyze, and finalize flow cleanly on Windows after the test cleanup fix.
- Confirmed the small production validator change in `AiPythonClientService` is required because the live FastAPI finalize contract legitimately returns `learned_profile: null` when a matched profile exists.

Checks run:
- `uv run pytest` with workspace-local `UV_CACHE_DIR` and `UV_PYTHON_INSTALL_DIR`: passed (`10` tests)
- `npm.cmd test -- --runInBand test/pose.integration.spec.ts src/ai/ai-python-client.integration.spec.ts src/ai/ai-python-client.service.spec.ts`: passed (`2` suites, `14` tests)
- `npm.cmd run build`: passed
- `npm.cmd run lint:check`: passed
- `prismaLocal migrate_status`: database schema up to date with `12` migrations

Not run:
- `npm.cmd run test:e2e -- --runInBand`

Why not:
- This task intentionally stopped at focused contract and cross-boundary coverage. The reserved live runtime verification step remains `TASK-1506`.

Outcome:
- `TASK-1505` is complete and can be moved to `done/`.
- `TASK-1506` is unblocked and should be promoted to `active/` as the final S15 runtime verification slice.

MCPs used: serena, prismaLocal
