# S8 Execution Queue

Use this file to drive sequential work for `S8 - Gamification`.

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
- `LAST_COMPLETED_TASK:` `TASK-806`
- `STOP_REASON:` `domain_complete`
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
6. If `STOP_REASON` is not `none`, stop and resolve that first unless it indicates the domain is already complete and `AUTO_MODE = sleep`.
7. Read the decision config in `decisions.md` before stopping for a routine yes/no question.

---

## Queue

| Task | Title | Status | Depends On | Auto-Eligible | Notes |
| --- | --- | --- | --- | --- | --- |
| `TASK-801` | Gamification Module And Read API Surface | `done` | `none` | `yes` | Established the S8 module, DTOs, repository/service/controller layering, rank constants, and the `/v1/fitness/mastery` plus `/v1/fitness/leaderboard` reads. |
| `TASK-802` | XP Accrual And Mastery Upsert On Workout Completion | `done` | `TASK-801` | `yes` | Wires the workout-completed event listener, per-muscle-group delta math, mastery upserts, and rank evaluation. |
| `TASK-803` | Rank-Up Event And Notification Delivery | `done` | `TASK-802` | `yes` | Emits rank-up events and uses the existing mail queue plus `rank_up_email` preference for delivery. |
| `TASK-804` | S8 E2E And Integration Coverage | `done` | `TASK-801, TASK-802, TASK-803` | `yes` | Adds route coverage for mastery/leaderboard and integration coverage for the workout-completed gamification listener. |
| `TASK-805` | S8 Runtime API Verification | `done` | `TASK-804` | `no` | Completed the live S8 Swagger pass and documented the remaining nullable-field contract mismatch. |
| `TASK-806` | S8 Runtime Contract Alignment | `done` | `TASK-805` | `yes` | Fixed the nullable Swagger field types on the mastery and leaderboard response DTOs and re-verified the live S8 contract. |

---

## Review Summary

- `muscle_mastery_progress` and `MasteryRank` already exist in Prisma schema and the checked-in base migration, so S8 does not need a new schema-design task before module work.
- The S7 workout completion event contract already exists and is emitted from the workout-session service, which gives S8 a stable trigger for XP accrual without modifying the S7 controller surface first.
- The user domain already exposes `rank_up_email` and the shared mail queue is live, so S8 can reuse those seams instead of inventing a new notification transport.
- `TASK-801` is complete: the live codebase has the S8 module wiring plus the `/v1/fitness/mastery` and `/v1/fitness/leaderboard` read surface.
- `TASK-802` is complete: S8 now listens to `fitness.workout-session.completed`, computes per-muscle-group XP and volume deltas, upserts `muscle_mastery_progress`, and promotes ranks without breaking the workout completion flow when listener errors occur.
- `TASK-803` is complete: S8 now emits a dedicated rank-up event only on real promotions, resolves notification targets through the user domain, and queues rank-up emails without letting notification failures break mastery persistence.
- `TASK-804` is complete: S8 now has route-level e2e coverage for mastery and leaderboard reads, while the full unit, integration-style, and e2e verification stack is green before the live Swagger pass.
- `TASK-805` is complete as a findings pass: the live backend exposes both S8 routes with JWT auth, but the served OpenAPI document currently publishes `last_ranked_at` and `avatar_url` as `object | null` instead of `string | null`.
- `TASK-806` is complete: the nullable S8 response fields now publish as `string | null`, and a fresh live runtime pass confirmed the mastery and leaderboard routes still enforce bearer auth.

---

## Recommended Next Order

Recommended path from the current queue state:

1. S8 is complete; there is no next queued task right now
2. if a new S8 bug or enhancement appears, create a follow-up task from this completed baseline

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
