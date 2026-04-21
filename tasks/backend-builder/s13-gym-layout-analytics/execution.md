# S13 Execution Queue

Use this file to drive sequential work for `S13 - Gym Layout & Analytics`.

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
- `LAST_COMPLETED_TASK:` `TASK-1306`
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
| `TASK-1301` | Gym Layout Module And Equipment CRUD Surface | `done` | `none` | `yes` | Creates the dedicated `src/gym-layout/` module and the initial `/v1/gym-layout/equipment` CRUD surface on top of the existing `GymEquipment` table. |
| `TASK-1302` | Analytics Module Overview And Revenue Surface | `done` | `none` | `yes` | Creates `src/analytics/` and the initial `/v1/analytics/overview` and `/v1/analytics/revenue` contract over existing data. |
| `TASK-1303` | Analytics Attendance Members And Coach Earnings | `done` | `TASK-1302` | `no` | Adds the more nuanced attendance, member, and coach aggregate endpoints after the analytics module root exists. |
| `TASK-1304` | Gym Layout Realtime Gateway And Shared Contract Alignment | `done` | `TASK-1301` | `no` | Isolates the Redis/WebSocket policy conflict and implements the `/gym-layout` realtime status flow only after the CRUD surface exists. |
| `TASK-1305` | S13 Service And Coverage Pass | `done` | `TASK-1301, TASK-1302, TASK-1303, TASK-1304` | `yes` | Adds the focused repository, service, controller, and gateway coverage needed before live verification. |
| `TASK-1306` | S13 Runtime API Verification | `done` | `TASK-1305` | `no` | Runs the separate runtime API verification driver once the S13 HTTP surface is green. |

---

## Review Summary

- The `GymEquipment` Prisma model and checked-in migration already exist, so S13 does not need to begin with schema work.
- No `src/gym-layout/` or `src/analytics/` module exists yet, and there is no current `/v1/gym-layout/*` or `/v1/analytics/*` controller surface.
- The repo already has reusable building blocks for S13, including:
  - `BaseRepository.queryRaw()` explicitly earmarked for S13 analytics
  - shared date-range DTO validation
  - existing attendance, payment, and coaching data sources
  - an existing WebSocket auth/gateway pattern in the AI pose module
- The S13 realtime design conflicts with the current shared Redis/WebSocket contract and therefore needs an isolated, non-auto-eligible slice.

---

## Latest Progress

- Domain review is complete.
- `TASK-1301` through `TASK-1306` are complete.
- `TASK-1306` passed live OpenAPI verification against the running backend, including bearer-auth checks, admin role checks, response-envelope inspection, and a temporary gym-layout create/update/delete cleanup loop.
- S13 is now domain-complete with code checks, focused tests, and runtime verification all green.

---

## Recommended Next Order

Recommended path from the current queue state:

1. `TASK-1301`
2. `TASK-1302`
3. `TASK-1303`
4. `TASK-1304`
5. `TASK-1305`
6. `TASK-1306`

Notes:
- `TASK-1303` is intentionally marked not auto-eligible because the `members` metric can still hide a product-definition choice.
- `TASK-1304` is intentionally marked not auto-eligible because the S13 realtime design currently conflicts with shared Redis/WebSocket contract docs.
- `TASK-1306` reserves the final live verification slice for the separate API verification driver.

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
HTTP-facing domains should usually reserve their final task for runtime API verification, and `tasks/api-verification-driver.md` may start the backend automatically once build, tests, and `npm.cmd run lint:check` pass.

---

## Sleep-Mode Queue Notes

- `ECO_MODE: on` stops after one completed domain.
- `ECO_MODE: off` may continue into the next domain.
- The shared driver may bypass non-eligible task pauses when the domain decision policy allows it.
- It must honor the shared hard stop file at safe boundaries.
