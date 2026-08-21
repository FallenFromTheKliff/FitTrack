# S15 Execution Queue

Use this file to drive sequential work for `S15 - Pose Estimate`.

Sequential execution means:
- finish the active task first
- then pick the next `ready` task with no unmet dependencies
- do not advance strictly by task number if a dependency says otherwise

---

## Execution State

- `AUTO_MODE:` `off`
- `CURRENT_PHASE:` `review`
- `CURRENT_TASK:` `none`
- `NEXT_READY_TASK:` `none`
- `LAST_COMPLETED_TASK:` `TASK-1506`
- `STOP_REASON:` `none`
- `MAX_TASKS_PER_SESSION:` `1`

---

## Selection Rules

1. If a task exists in `active/`, that is the current task.
2. If `active/` is empty, pick the first task below with:
   - `status: ready`
   - all `depends_on` items marked done
3. If no task is ready, stop and report the blocking dependency.
4. If the agent makes a low-risk automatic sequencing decision, record it in `decisions.md`.
5. If `AUTO_MODE = domain` or `AUTO_MODE = sleep`, do not exceed `MAX_TASKS_PER_SESSION` in one chat.
6. If `STOP_REASON` is not `none`, stop and resolve that first.
7. Read the decision config in `decisions.md` before stopping for a routine yes/no question.

---

## Queue

| Task | Title | Status | Depends On | Auto-Eligible | Notes |
| --- | --- | --- | --- | --- | --- |
| `TASK-1501` | S15 Prisma Pose Contract Alignment | `done` | `none` | `yes` | Adds the missing S15 Prisma contract pieces while preserving the existing S7 pose-session linkage into workout logs. |
| `TASK-1502` | Pose Nest HTTP Surface And Repository Expansion | `done` | `TASK-1501` | `yes` | Adds the missing pose DTOs, repositories, Python client methods, and authenticated HTTP routes for finalize, session reads, and profile listing. |
| `TASK-1503` | Python Pose Microservice Scaffold | `done` | `TASK-1502` | `yes` | Scaffolds the FastAPI pose service with `/health`, bootstrap, analyze, and finalize contracts plus Python-side contract tests. |
| `TASK-1504` | S15 Pose Session Lifecycle Integration | `done` | `TASK-1502, TASK-1503` | `no` | Wires the Nest WS and HTTP flows to the Python lifecycle, persists finalize-time fields, emits the missing socket events, and handles learned-profile persistence safely. |
| `TASK-1505` | S15 Coverage Pass | `done` | `TASK-1504` | `yes` | Adds focused Nest and Python coverage for the S15 contract edges once the main lifecycle is wired. |
| `TASK-1506` | S15 Runtime API Verification | `done` | `TASK-1505` | `no` | Runs the separate runtime API verification driver against the final pose HTTP surface and live backend contract. |

---

## Review Summary

- `capstone-backend/src/fitness/pose` already provides a JWT-authenticated `/pose` WebSocket gateway, minimal pose-session persistence, and focused gateway/service/repository unit tests.
- `capstone-backend/prisma/schema.prisma` now includes the S15 `PoseExerciseProfile` model, `PoseProfileKind`, and the extended `PoseSession` classification fields added in `TASK-1501`.
- `capstone-backend/src/fitness/pose` now includes the authenticated REST controller, DTOs, and repository/service helpers added in `TASK-1502` for manual finalize, session reads, and profile listing.
- `capstone-backend/src/ai/ai-python-client.service.ts` now includes the S15 bootstrap and finalize helpers plus payload validation for those contract surfaces.
- `capstone-backend/src/fitness/session` already provides a useful ownership seam through `findPoseSessionByIdOrThrow`, so pose-session member reads and finalize authorization can extend the current S7 linkage instead of inventing a second ownership model.
- `capstone-backend/src/fitness/exercise/exercise.controller.ts` and `capstone-backend/src/fitness/session/session.controller.ts` already show the repo-standard HTTP pattern to reuse here: thin controllers, `JwtAuthGuard` for member reads, `JwtAuthGuard` plus `RolesGuard` for admin listing, Swagger envelope schemas, and DTO-driven params/query validation.
- `ai-microservice/` now contains a greenfield FastAPI scaffold with a project manifest, deterministic in-memory pose-session service, and `pytest` contract coverage for the S15 Python boundary.
- `capstone-backend/src/ai/ai-python-client.service.ts` now exposes bootstrap and finalize helpers, but `capstone-backend/src/fitness/pose/pose.service.ts` still runs the older live analyze path with `frame_b64 + exercise_hint` and disconnect-time local finalization, so `TASK-1503` should satisfy the contract endpoints without taking on the Nest lifecycle rewiring reserved for `TASK-1504`.
- The current WebSocket loop still uses the older analyze-only request shape and disconnect-time local finalization, so `TASK-1502` should limit itself to HTTP surface and client/repository expansion and leave live lifecycle rewiring to `TASK-1504`.

---

## Planned Task Breakdown

1. `TASK-1501` - Align the Prisma contract for S15 by adding the missing pose profile model and extended pose-session fields while preserving the existing S7 pose-session linkage.
2. `TASK-1502` - Expand the Nest pose module with the missing repositories, DTOs, client methods, and HTTP endpoints for pose finalization, session reads, and profile listing.
3. `TASK-1503` - Scaffold the FastAPI microservice and implement the shared S15 Python contracts for `/health`, `/pose/session/bootstrap`, `/pose/analyze`, and `/pose/session/finalize`.
4. `TASK-1504` - Wire the end-to-end Nest-to-Python pose session lifecycle, including latest-frame-wins handling, finalize-time persistence, emitted socket events, and learned-profile handling.
5. `TASK-1505` - Add the focused S15 coverage pass once the main pose lifecycle is in place.
6. `TASK-1506` - Reserve the final S15 slice for runtime API verification of the new pose HTTP surface through `tasks/api-verification-driver.md`.

---

## Latest Progress

- Domain review is complete.
- Prisma Local confirms the local schema is up to date before planning.
- Domain planning is complete and the first S15 queue is now seeded.
- `TASK-1501` task review is complete.
- `TASK-1501` task planning is complete.
- `TASK-1501` testing is complete.
- The checked-in local Prisma migration for `TASK-1501` has been applied and Prisma Local now reports the database schema is up to date.
- `TASK-1501` is complete and has been moved into `done/`.
- `TASK-1502` task review is complete.
- `TASK-1502` task planning is complete.
- `TASK-1502` testing is complete.
- `TASK-1502` is complete and has been moved into `done/`.
- `TASK-1503` task review is complete.
- The shared Python contracts are specific enough to plan the FastAPI scaffold without hitting the task stop condition.
- `TASK-1503` task planning is complete.
- `TASK-1503` implementation is complete.
- Python contract tests passed with `7` tests under `uv run pytest`.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the Python scaffold was added.
- `TASK-1503` testing is complete.
- `TASK-1503` is complete and has been moved into `done/`.
- `TASK-1504` has been promoted to `active/`.
- `TASK-1504` task review is complete.
- Prisma Local confirms the S15 schema additions are applied locally before the lifecycle-integration plan.
- `TASK-1504` task planning is complete.
- `TASK-1504` implementation is complete.
- Focused pose lifecycle tests passed with `31` tests across gateway, service, repository, and AI client suites.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the lifecycle integration changes.
- `TASK-1504` testing is complete.
- `TASK-1504` is complete and has been moved into `done/`.
- `TASK-1505` has been promoted to `active/`.
- `TASK-1505` task review is complete.
- `TASK-1505` task planning is complete.
- `TASK-1505` implementation is complete.
- Python contract tests now pass with `10` tests under `uv run pytest`.
- Focused Nest validation and AI client integration tests passed with `14` tests across the pose controller and AI client suites.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the S15 coverage additions.
- `TASK-1505` testing is complete.
- `TASK-1505` is complete and has been moved into `done/`.
- `TASK-1506` has been promoted to `active/`.
- `TASK-1506` task review is complete.
- `TASK-1506` task planning is complete.
- `tasks/api-verification-driver.md` has been rewritten to the S15 pose scope and the live runtime verification pass has been executed.
- The initial live pass found a finalize-route status mismatch, and that route has now been fixed to return the documented `200`.
- The runtime verification rerun passed for the scoped S15 pose endpoints after the status-code fix.
- `TASK-1506` is complete and has been moved into `done/`.
- The S15 domain queue is complete.

---

## Recommended Next Order

Recommended path from the current queue state:

1. `TASK-1501`
2. `TASK-1502`
3. `TASK-1503`
4. `TASK-1504`
5. `TASK-1505`
6. `TASK-1506`

Notes:
- `TASK-1501` leads because every downstream S15 slice depends on the missing persistence contract, and the current repo already has a live `PoseSession`/workout-log seam that should be extended carefully instead of redesigned.
- `TASK-1504` is intentionally marked not auto-eligible because it joins real-time socket behavior, finalize-time persistence, and optional learned-profile writes across Nest and Python boundaries.
- `TASK-1506` stays last so runtime verification happens only after the contract, integration, and coverage slices are green.

---

## Completion Rules

When a task is done:

1. move its file from `active/` to `done/`
2. promote the next ready task from `backlog/` to `active/`
3. update this queue so statuses stay accurate
4. add any reusable assumptions or tradeoffs to `decisions.md`

---

## Auto-Run Rules

If `AUTO_MODE = off`:

1. run only the phase named in `CURRENT_PHASE`

If `AUTO_MODE = task`:

1. run the current active task through `review -> plan -> implement -> test`
2. stop after verification, even if more tasks are ready

If `AUTO_MODE = domain`:

1. run the current active task through `review -> plan -> implement -> test`
2. if verification passes, move it to `done/`
3. promote the next ready unblocked task only if it is marked `Auto-Eligible = yes`
4. stop when:
   - the next task is not auto-eligible
   - a blocker is found
   - a user decision is required
   - `MAX_TASKS_PER_SESSION` is reached

Decision handling in domain mode:

- if a decision is routine, binary, and low-risk, use the decision config in `decisions.md`
- choose the recommended or safest default path, not blind `yes`
- still log reusable or notable automatic decisions in `decisions.md`
- do not bypass `Auto-Eligible = no`, explicit stop conditions, blockers, failed verification, or high-impact decisions

This keeps the domain queue semi-automatic instead of blindly autonomous.

If `AUTO_MODE = sleep`:

1. if this domain is complete, rewrite the shared driver to the next domain
2. if this domain is complete and `ECO_MODE: on`, stop there so the next domain starts in a fresh chat
3. if this domain is complete and `ECO_MODE: off`, continue according to the shared driver's handoff settings
4. otherwise run the remaining task queue through `review -> plan -> implement -> test`
5. when a task requires runtime API verification, run the separate API verification driver automatically before marking the task complete
6. if a task is marked `Auto-Eligible = no`, consult `decisions.md`
   - continue automatically only when `AUTO_APPROVE_NON_ELIGIBLE_TASKS: yes` for `sleep`
   - log each bypass in the domain decision file
7. check the shared hard stop file before promoting the next task, before runtime API verification, and before the next domain handoff
8. stop when:
   - the hard stop file is detected
   - the shared domain/task cap is reached
   - an explicit task `Stop If` condition is hit
   - a failure remains after the shared self-heal budget is exhausted

---

## Runtime Verification Note

Swagger MCP is not part of the normal task queue.
HTTP-facing domains should usually reserve their final task for runtime API verification, and `tasks/api-verification-driver.md` may start the backend automatically once build, relevant tests, and `npm.cmd run lint:check` pass.

---

## Sleep-Mode Queue Notes

- `ECO_MODE: on` stops after one completed domain.
- `ECO_MODE: off` may continue into the next domain.
- The shared driver may bypass non-eligible task pauses when the domain decision policy allows it.
- It must honor the shared hard stop file at safe boundaries.
