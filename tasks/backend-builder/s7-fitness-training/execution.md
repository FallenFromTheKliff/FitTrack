# S7 Execution Queue

Use this file to drive sequential work for `S7 - Fitness Training`.

Sequential execution means:
- finish the active task first
- then pick the next `ready` task with no unmet dependencies
- do not advance strictly by task number if a dependency says otherwise

---

## Execution State

- `AUTO_MODE:` `domain`
- `CURRENT_PHASE:` `review`
- `CURRENT_TASK:` `none`
- `NEXT_READY_TASK:` `none`
- `LAST_COMPLETED_TASK:` `TASK-708`
- `STOP_REASON:` `domain_complete`
- `MAX_TASKS_PER_SESSION:` `15`

---

## Selection Rules

1. If a task exists in `active/`, that is the current task.
2. If `active/` is empty, pick the first task below with:
   - `status: ready`
   - all `depends_on` items marked done
3. If no task is ready, stop and report the blocking dependency.
4. If the agent makes a low-risk automatic sequencing decision, record it in `decisions.md`.
5. If `AUTO_MODE = domain` or `AUTO_MODE = sleep`, do not exceed `MAX_TASKS_PER_SESSION` in one chat.
6. If `STOP_REASON` is not `none`, stop and resolve that first unless it indicates the domain is already complete and `AUTO_MODE = sleep`.
7. Read the decision config in `decisions.md` before stopping for a routine yes/no question.

---

## Queue

| Task | Title | Status | Depends On | Auto-Eligible | Notes |
| --- | --- | --- | --- | --- | --- |
| `TASK-701` | Fitness Module And Exercise Catalog | `done` | `none` | `yes` | Establishes `src/fitness/`, exercise catalog reads, and admin exercise management. |
| `TASK-702` | Training Plan CRUD And Coach Assignment | `done` | `TASK-701` | `yes` | Delivers plan create/list/detail/delete plus coach-to-member assignment copy flow. |
| `TASK-703` | S7 Training Guard Migration Artifacts | `done` | `TASK-702` | `no` | Adds the documented partial unique SQL guards for active plans and per-session set uniqueness. |
| `TASK-704` | Workout Sessions And Exercise Log Lifecycle | `done` | `TASK-702, TASK-703` | `yes` | Covers session start/log/complete/cancel/history plus stale-session cleanup and workout-completed event emission. |
| `TASK-705` | AI Plan Generation And Interaction Logging | `done` | `TASK-702, TASK-703` | `no` | Adds `/v1/ai/generate-plan`, AI health/generation calls, response logging, and active-plan replacement. |
| `TASK-706` | Pose Gateway And Pose Session Linking | `done` | `TASK-704, TASK-705` | `no` | Adds the WebSocket pose flow and links pose sessions back to logged workout sets. |
| `TASK-707` | S7 E2E And Integration Coverage | `done` | `TASK-701, TASK-702, TASK-703, TASK-704, TASK-705, TASK-706` | `yes` | Broad verification slice before live Swagger inspection. |
| `TASK-708` | S7 Runtime API Verification | `done` | `TASK-707` | `no` | Final live OpenAPI verification slice for the S7 HTTP surface. |

## Review Summary

- Prisma schema and checked-in base migrations already include the S7 tables and enums.
- `src/fitness/` now contains the exercise catalog slice, the training-plan CRUD and coach-assignment surface, and the workout-session lifecycle module.
- `src/ai/` now contains the AI plan-generation slice, and `AppModule` imports it so `/v1/ai/generate-plan` is live in the Nest app.
- `AppModule` imports `FitnessModule`, so the S7 exercise and training-plan routes are live in the Nest app.
- The workout-session HTTP surface and cleanup processor are now live through `FitnessModule`, including the stable `fitness.workout-session.completed` event contract for later S8/S7 consumers.
- The raw SQL guard artifacts for `one_active_plan_per_user` and `exercise_log_set_unique` are now checked in as `20260326110000_s7_training_uniqueness_guards`.
- The checked-in S7 guard migration has been applied locally, so the old `pending_local_guard_migrations` blocker is cleared.
- AI plan generation is now implemented with Python health/generation calls, interaction logging, and transactional active-plan replacement.
- The pose/WebSocket slice is now live through `FitnessModule`, including authenticated `/pose` connections, `pose_sessions` lifecycle persistence, and the dedicated `/pose/analyze` AI client boundary.
- Controller-level S7 e2e coverage now exists for the main exercise, training-plan, workout-session, and AI plan HTTP flows, so the remaining S7 step is the dedicated runtime API verification pass.
- `TASK-708` completed with a live Swagger pass after retrying the local backend startup path in a persistent host process.
- `/v1/fitness/mastery` and `/v1/fitness/leaderboard` are backed by S8 gamification data, so the S7 queue stops at emitting stable workout completion data and core training contracts instead of pulling S8 ranking logic forward.

## Recommended Next Order

S7 is complete.

Next shared-driver step:

1. rewrite the shared driver to `S8`
2. stop because `ECO_MODE: on`
3. start the next chat from the S8 workspace using a fresh worker

---

## Completion Rules

When a task is done:

1. move its file from `active/` to `done/`
2. promote the next ready task from `backlog/` to `active/`
3. update this queue so statuses stay accurate
4. add any reusable assumptions or tradeoffs to `decisions.md`

---

## Auto-Run Rules

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
   - log each bypass in `Non-Eligible Task Log`
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
- `ECO_MODE: off` may continue into the next domain in the shared registry.
- The shared driver may bypass non-eligible task pauses only when the domain decision policy explicitly allows it.
- The shared hard stop file must be honored at safe boundaries.
