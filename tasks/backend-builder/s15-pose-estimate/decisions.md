# S15 Decision Log

Use this file to preserve automatic decisions and flagged assumptions for `S15 - Pose Estimate`.

---

## Decision Config

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

Behavior:
- routine yes/no decisions in S15 auto mode do not default to automatic acceptance
- the chosen answer should be the recommended or safest default when auto-resolution is allowed
- this config does not override task safety gates, blockers, failed verification, or explicit task `Stop If` conditions

---

## Non-Eligible Task Policy

- `AUTO_APPROVE_NON_ELIGIBLE_TASKS:` `yes`
- `ACTIVE_IN_MODES:` `sleep`
- `STILL_STOP_FOR:` `explicit Stop If | hard stop file | unrecoverable verification failure`

Behavior:
- in `sleep` mode, tasks marked `Auto-Eligible = no` may continue automatically
- each bypass must be logged in `Non-Eligible Task Log`
- outside `sleep` mode, `Auto-Eligible = no` keeps its normal pause behavior
- this policy does not override an explicit task `Stop If`, the shared hard stop file, or an unrecoverable verification/runtime failure

---

Log only decisions that are:
- reusable in later S15 tasks
- mildly ambiguous but safe enough to proceed on
- important enough that a later chat should not rediscover them
- made during auto mode and worth preserving for the next task

Do not log every tiny implementation detail.

---

## Entry Format

Use this format for future entries:

```text
## YYYY-MM-DD - TASK-[N]
- Decision: ...
- Why: ...
- Impact: low | medium | high
- Review Status: accepted | revisit | user decision needed
- Architecture Follow-up: yes | no
```

---

## Non-Eligible Task Log

Use this format for future entries:

```text
## YYYY-MM-DD - TASK-[N]
- Bypass Reason: ...
- Why Sleep Mode Continued: ...
- Outcome: success | failed | revisited
```

Current entries:

_None yet._

---

## Current Entries

## 2026-03-29 - TASK-1501
- Decision: Sequence S15 as Prisma contract alignment first, then Nest contract surface, then Python scaffold, then lifecycle integration, then coverage, then runtime verification.
- Why: The repo already has a minimal `PoseSession` model plus S7 workout-set linkage, so stabilizing the persistence contract first reduces churn across both the Nest and Python implementations.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1506
- Decision: Treat the final S15 slice as a pure runtime-verification task by rewriting the shared API verification driver session variables from the stale S14 audit scope to the S15 pose scope before any live pass, then verify only `/v1/pose/sessions/{id}`, `/v1/pose/sessions/{id}/finalize`, and `/v1/pose/profiles`.
- Why: The pose controller already exposes the expected Swagger-decorated routes and auth split, while the immediate blocker is that `tasks/api-verification-driver.md` still targets the previous domain rather than the current S15 endpoints.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1501
- Decision: Keep `PoseSession.exercise_log_id` as the existing one-to-one S7 linkage and make the S15 Prisma changes additive by introducing nullable pose-classification fields plus a new `PoseExerciseProfile` model with an `ExerciseCatalog` reverse relation.
- Why: Current workout-log ownership and repository selections already depend on `exercise_log_id` staying intact, while the S15 context explicitly describes the new pose-profile and classification fields as an extension of the existing pose-session shape rather than a replacement for it.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1502
- Decision: Plan the pose HTTP surface around the existing repo controller pattern: member-owned session read and manual finalize routes use `JwtAuthGuard` ownership checks, while profile listing uses `JwtAuthGuard`, `RolesGuard`, and `@Roles(UserRole.admin)`.
- Why: This matches the S15 context contract and the existing patterns already used in the workout-session and exercise modules, so `TASK-1502` can extend the current auth model without inventing a pose-specific permission scheme.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1502
- Decision: Keep `TASK-1502` additive by exposing the new pose HTTP and Python-client surface now, but defer any gateway or finalize-flow rewiring to `TASK-1504`; manual finalize should return the current persisted pose-session summary with nullable S15 classification fields until the Python lifecycle exists.
- Why: The S15 Python session bootstrap and finalize endpoints are not scaffolded until `TASK-1503`, and the real-time lifecycle changes are intentionally reserved for `TASK-1504`, so forcing those integrations into `TASK-1502` would blur the task boundary and create unstable interim behavior.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1503
- Decision: Treat `TASK-1503` as a greenfield FastAPI contract scaffold inside `ai-microservice/` with deterministic in-memory session state, Python-owned request and response models, and Python-side contract tests; keep the task limited to the service boundary and do not absorb the Nest lifecycle rewiring reserved for `TASK-1504`.
- Why: The repo currently has no Python project files or existing FastAPI app to extend, while the shared S15 contracts already define safe request and response shapes for `/health`, `/pose/session/bootstrap`, `/pose/analyze`, and `/pose/session/finalize`.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1503
- Decision: Match the Python scaffold responses to the stricter shared S15 contract and current Nest client validators by returning full bootstrap and finalize payloads plus deterministic analyze metadata, while keeping unknown-exercise handling as a finalize-only internal boundary with no external provider call in this task.
- Why: The current Nest client already validates numeric finalize summaries and specific bootstrap fields, and the S15 / Python shared contracts explicitly forbid real-time LLM usage in the live frame loop.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1503
- Decision: Keep the new Python `/pose/analyze` surface session-keyed and aligned to the shared S15 contract even though the current Nest live analyze call path still uses the older request shape; leave compatibility rewiring to `TASK-1504` instead of weakening the scaffold contract here.
- Why: `TASK-1503` exists to establish the real FastAPI service boundary, while `TASK-1504` is already the reserved integration slice for reconciling the Nest WebSocket lifecycle with that boundary.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1504
- Decision: Converge WebSocket disconnect, any future socket stop handling, and manual finalize around one service-owned Python finalize path that persists the richer S15 fields and learned profiles after Nest validation, while keeping the existing S7 `pose_session_id` to `exercise_log_id` ownership seam additive.
- Why: The current code still splits between live frame analysis and local-only finalize bookkeeping, but the Python scaffold now owns the session summary contract and the workout-log linkage already works safely through the existing pose-session record.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1504
- Decision: Use gateway-local latest-frame-wins handling and treat learned-profile persistence as optional additive data created with `exercise_id = null` unless a direct safe mapping is already available during finalize.
- Why: This keeps the realtime flow bounded without inventing queue infrastructure, and it avoids forcing an ambiguous `ExerciseCatalog` mapping into the lifecycle task while still preserving the learned-profile contract.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1505
- Decision: Keep the S15 coverage pass narrowly focused on three seams only: Nest-side DTO and controller validation edges, Python malformed-request contract coverage, and one clean cross-boundary verification path that exercises the finalized Nest client against the real FastAPI app contract without turning the task into full runtime verification.
- Why: The current repo already has solid unit coverage for the main lifecycle behavior, so the remaining risk is contract drift at validation boundaries and the lack of a lightweight integration proof between the Nest client and the Python service.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1505
- Decision: Use a lightweight client-to-FastAPI integration proof for the cross-boundary check, not a full Nest runtime or WebSocket harness, and keep any new backend request-validation coverage centered on the pose controller with the repo’s standard `ValidationPipe` setup.
- Why: This gives the coverage pass one real contract handshake between Nest and Python while keeping the heavier live runtime verification step reserved for `TASK-1506`.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no

## 2026-03-29 - TASK-1506
- Decision: For non-creation POST routes that are documented as normal success responses, set an explicit `@HttpCode(200)` instead of relying on Nest defaults.
- Why: The live S15 runtime verification caught `POST /v1/pose/sessions/{id}/finalize` returning Nest’s default `201` even though the controller and task contract expected `200`, which would have kept the live API out of sync with Swagger and the domain contract.
- Impact: medium
- Review Status: accepted
- Architecture Follow-up: no
