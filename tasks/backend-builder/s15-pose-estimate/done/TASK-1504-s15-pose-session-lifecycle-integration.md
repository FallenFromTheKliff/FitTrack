# TASK-1504 - S15 Pose Session Lifecycle Integration
**Task ID:** TASK-1504
**Domain:** S15 - Pose Estimate
**Status:** done
**Branch:** feat/TASK-1504-s15-pose-session-lifecycle-integration
**Created:** 2026-03-29
**Completed:** 2026-03-29
**Priority:** P1
**Depends On:** TASK-1502, TASK-1503
**Blocks:** TASK-1505, TASK-1506
**Auto-Eligible:** no (`no` pauses normal domain mode; `sleep` mode may bypass it only if the domain `decisions.md` explicitly allows that)
**Decision Flags:** add reusable assumptions to `decisions.md`
**Stop If:** stop if the real-time rep-count, feedback, subject-lock, or unknown-exercise finalize behavior needs a product decision instead of straightforward contract alignment
**Escalation Notes:** none
**Touches Prisma:** yes
**Needs External Docs:** no
**Needs Runtime API Verification:** no
**Preferred MCPs:** serena | prismaLocal

---

## What
Wire the Nest WebSocket and HTTP pose flows to the Python bootstrap, analyze, and finalize lifecycle, then persist the finalize-time S15 fields and learned-profile outputs safely.

## Why
The current repo only performs frame analysis and local disconnect finalization; the domain is not complete until Nest and Python cooperate across the full pose session lifecycle defined in the S15 context.

For domains that expose or change HTTP endpoints, prefer making the last domain task a runtime API verification slice that uses `tasks/api-verification-driver.md`.

## Acceptance Criteria
- [x] WebSocket connection bootstraps the Python pose session and stores the returned session lifecycle state
- [x] Frame handling follows the S15 latest-frame-wins rule and emits both `pose.rep-count` and `pose.feedback` as appropriate
- [x] Finalize flows use the Python finalize contract, persist detected exercise and confidence fields, and save learned profiles only after Nest validation
- [x] `pose.session.finalized` is emitted with the expected final summary payload
- [x] The existing S7 workout-session attachment path remains compatible with the richer S15 pose-session data
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
- `capstone-backend/prisma`

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
Implementation plan for `TASK-1504`:

1. Expand the Nest pose connection state so the gateway can manage the real Python lifecycle instead of only local counters.
   - Extend `PoseConnectionState` with the Python bootstrap output needed during the socket session, plus the minimum gateway-local bookkeeping required for latest-frame-wins handling and finalize deduplication.
   - Keep the gateway state ephemeral and socket-owned; persistent fields still belong in Prisma-backed `PoseSession`.

2. Add repository helpers for bootstrap inputs and finalize-time persistence.
   - Add a repository query to load candidate `PoseExerciseProfile` rows for a new pose session, filtered by active profiles and narrowed by `exercise_hint` when that is possible without introducing brittle matching logic.
   - Add a repository finalize helper that can update `PoseSession` with `rep_count_ai`, `confidence_avg`, `detected_exercise_name`, `detected_profile_id`, `classification_confidence`, `subject_lock_confidence`, `analysis_summary`, and `ended_at`.
   - Add a repository write path for learned `PoseExerciseProfile` creation.
   - Persist the pose-session update and optional learned-profile insert transactionally so finalize results do not partially apply.
   - Safe default: create learned profiles with `exercise_id = null` unless a direct safe mapping already exists during the finalize flow.

3. Rewire session bootstrap through the Python service boundary.
   - Update `PoseService.startPoseSession(...)` to create the DB session, load candidate profiles, call `aiClient.bootstrapPoseSession(...)`, and return a richer `PoseConnectionState`.
   - Update the gateway `handleConnection(...)` path to emit the S15 `pose.session.started` payload including `pose_session_id` and `accepted_fps`.
   - Keep JWT socket auth, ownership, and existing session creation semantics unchanged.

4. Rewire live frame analysis to the session-keyed Python contract and S15 event surface.
   - Update `AiPythonClientService.analyzePoseFrame(...)` to send `{ pose_session_id, frame_b64 }` instead of the older `{ frame_b64, exercise_hint }` body, and keep the response validator aligned to the current S15 analyze payload.
   - Update `PoseService.analyzeFrame(...)` to call the session-keyed analyze path, fold rep-count deltas into local state, and accumulate confidence samples for finalize.
   - Implement latest-frame-wins behavior in the gateway by keeping at most one pending frame per connection while an analyze call is in flight instead of queueing unbounded work.
   - Emit `pose.rep-count` when `rep_event` is true and emit `pose.feedback` whenever analyze returns feedback or subject-lock state.

5. Converge all finalize paths on one service-owned Python finalize flow.
   - Route socket disconnect and any new socket `stop` handler through the same finalize helper used by HTTP manual finalize when a session is still open.
   - Call `aiClient.finalizePoseSession(...)`, validate the finalize payload, persist the enriched S15 session fields, and insert any learned profile only after Nest validation.
   - Emit `pose.session.finalized` from the gateway with the contract summary after successful finalize.
   - Ensure repeated finalize attempts are idempotent at the service boundary so manual finalize after disconnect or vice versa does not double-write learned profiles.

6. Keep the existing S7 workout-log seam compatible.
   - Preserve `PoseSession.exercise_log_id` ownership and avoid changing `SessionService` attachment rules unless a direct compatibility fix is required.
   - Ensure manual finalize and disconnect finalize both leave `rep_count_ai` and pose-session ownership in a state that still works with workout-set logging.

7. Extend focused tests for the lifecycle slice.
   - `pose.gateway.spec.ts`: bootstrap on connect, feedback emission, latest-frame-wins behavior, socket stop/disconnect finalize, and finalized-event emission.
   - `pose.service.spec.ts`: bootstrap query + Python bootstrap call, session-keyed analyze call, finalize payload persistence, learned-profile validation, and idempotent/manual finalize behavior.
   - `pose.repository.spec.ts`: candidate-profile query, transactional finalize update, and learned-profile insert behavior.
   - `ai-python-client.service.spec.ts`: analyze request-shape update to `pose_session_id` plus any stricter finalize/bootstrap validation that changes in this slice.

Files expected to be touched:
- `capstone-backend/src/fitness/pose/pose.gateway.ts`
- `capstone-backend/src/fitness/pose/pose.gateway.spec.ts`
- `capstone-backend/src/fitness/pose/pose.service.ts`
- `capstone-backend/src/fitness/pose/pose.service.spec.ts`
- `capstone-backend/src/fitness/pose/pose.repository.ts`
- `capstone-backend/src/fitness/pose/pose.repository.spec.ts`
- `capstone-backend/src/ai/ai-python-client.service.ts`
- `capstone-backend/src/ai/ai-python-client.service.spec.ts`

Verification target for implementation:
- `npm.cmd run build`
- focused `npm.cmd test -- --runInBand ...pose... ...ai-python-client...`
- `npm.cmd run lint:check`

Non-auto-eligible boundary:
- `TASK-1504` is marked `Auto-Eligible: no`, so implementation should not start automatically after this plan. Stop at the planning boundary and wait for explicit confirmation before coding.

MCPs used: serena, prismaLocal

---

## CODER OUTPUT
Implemented the S15 lifecycle integration across Nest realtime flow, the AI client, and pose persistence:

- `capstone-backend/src/fitness/pose/pose.service.ts`
  - bootstraps Python pose sessions with starter catalog plus candidate `PoseExerciseProfile` rows
  - rewires live analyze calls to the session-keyed `/pose/analyze` contract
  - converges socket and HTTP finalize onto the Python finalize path
  - persists finalize-time S15 summary fields and optional learned-profile payloads through one repository call
- `capstone-backend/src/fitness/pose/pose.gateway.ts`
  - emits `pose.session.started` with `accepted_fps`
  - adds gateway-local latest-frame-wins handling
  - emits `pose.feedback` and `pose.session.finalized`
  - adds socket `stop` handling and routes disconnect/stop through the shared finalize flow
- `capstone-backend/src/fitness/pose/pose.repository.ts`
  - adds active bootstrap-profile lookup
  - upgrades finalize persistence to a transaction that can create a learned profile and attach it back to the session
- `capstone-backend/src/ai/ai-python-client.service.ts`
  - updates `/pose/analyze` to send `{ pose_session_id, frame_b64 }`
  - tightens analyze/finalize validation to match integer rep counts and rep deltas
- Focused lifecycle tests were updated in:
  - `capstone-backend/src/fitness/pose/pose.gateway.spec.ts`
  - `capstone-backend/src/fitness/pose/pose.service.spec.ts`
  - `capstone-backend/src/fitness/pose/pose.repository.spec.ts`
  - `capstone-backend/src/ai/ai-python-client.service.spec.ts`

Verification completed during implementation:

- `npm.cmd test -- --runInBand src/fitness/pose/pose.gateway.spec.ts src/fitness/pose/pose.service.spec.ts src/fitness/pose/pose.repository.spec.ts src/ai/ai-python-client.service.spec.ts`
- `npm.cmd run build`
- `npm.cmd run lint:check`

MCPs used: serena, prismaLocal

---

## TESTER REPORT
Verification completed for the S15 lifecycle integration and task handoff readiness.

What was verified:
- Re-checked the lifecycle wiring against the task acceptance criteria: Python bootstrap on connect, session-keyed analyze, gateway latest-frame-wins handling, shared finalize flow, finalized event emission, and additive learned-profile persistence.
- Confirmed the richer finalize persistence remains compatible with the existing S7 `exercise_log_id` ownership seam because the task stayed additive on the `PoseSession` record.
- Confirmed the updated analyze request shape, bootstrap/finalize validators, and focused pose test suites are all aligned to the shared S15 contract.

Checks run:
- `npm.cmd test -- --runInBand src/fitness/pose/pose.gateway.spec.ts src/fitness/pose/pose.service.spec.ts src/fitness/pose/pose.repository.spec.ts src/ai/ai-python-client.service.spec.ts`: passed (`4` suites, `31` tests)
- `npm.cmd run build`: passed
- `npm.cmd run lint:check`: passed
- `prismaLocal migrate_status`: database schema up to date with `12` migrations

Not run:
- `npm.cmd run test:e2e -- --runInBand`

Why not:
- This task’s verification target was the focused lifecycle slice rather than full runtime verification, and the domain already reserves the final live HTTP verification step for `TASK-1506`.

Outcome:
- `TASK-1504` is complete and can be moved to `done/`.
- `TASK-1505` is now unblocked and should be promoted to `active/` for the coverage pass.

MCPs used: serena, prismaLocal
