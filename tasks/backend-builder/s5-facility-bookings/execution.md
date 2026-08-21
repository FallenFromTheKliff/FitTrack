# S5 Execution Queue

Use this file to drive sequential work for `S5 - Facility Bookings`.

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
- `LAST_COMPLETED_TASK:` `TASK-508`
- `STOP_REASON:` `domain_complete`
- `MAX_TASKS_PER_SESSION:` `2`

---

## Selection Rules

1. If a task exists in `active/`, that is the current task.
2. If `active/` is empty, pick the first queued task with:
   - `status: ready`
   - all `depends_on` items marked done
3. If no task is ready, stop and report the blocking dependency or missing queue state.
4. If the agent makes a low-risk automatic sequencing decision, record it in `decisions.md`.
5. If `AUTO_MODE = domain` or `AUTO_MODE = sleep`, do not exceed `MAX_TASKS_PER_SESSION` in one chat.
6. If `STOP_REASON` is not `none`, stop and resolve that first unless it indicates the domain is already complete and `AUTO_MODE = sleep`.
7. Read the decision config in `decisions.md` before stopping for a routine yes/no question.

---

## Queue

| Task | Title | Status | Depends On | Auto-Eligible | Notes |
| --- | --- | --- | --- | --- | --- |
| `TASK-501` | Bookings Module And Amenity Catalog | `done` | `none` | `yes` | Established `src/bookings/` and the amenity CRUD/read surface. |
| `TASK-502` | Availability And Reservation Core | `done` | `TASK-501` | `yes` | Added slot calculations, overlap checks, and capacity-aware booking repository helpers. |
| `TASK-503` | Booking Creation And PayMongo Confirmation | `done` | `TASK-501, TASK-502` | `no` | Added booking creation, Redis locking, free bookings, and PayMongo downpayment confirmation. |
| `TASK-504` | Booking Reads And Cancellation | `done` | `TASK-503` | `yes` | Added member/admin booking reads, cancellation rules, audit emission, and a booking-cancelled domain event. |
| `TASK-505` | Booking Cash Payments And Balance Collection | `done` | `TASK-503, TASK-504` | `no` | Added booking payment ownership resolution, staff balance collection, and balance-payment completion handling. |
| `TASK-506` | Booking Lifecycle Jobs And Notifications | `done` | `TASK-503, TASK-504, TASK-505` | `yes` | Added lifecycle queue wiring, booking confirmation/cancellation notifications, delayed no-show checks, and automated cleanup/completion jobs. |
| `TASK-507` | S5 E2E And Integration Coverage | `done` | `TASK-501, TASK-502, TASK-503, TASK-504, TASK-505, TASK-506` | `yes` | Final code-level confidence pass for S5 HTTP, event, and queue behavior. |
| `TASK-508` | S5 Runtime API Verification | `done` | `TASK-507` | `no` | Verified the live S5 routes with inline backend auto-start and closed the last queue item. |

---

## Recommended Next Order

Recommended path from the current queue state:

1. S5 is complete; there is no next queued task right now
2. if a new S5 bug or enhancement appears, create a follow-up task from this completed baseline

Notes:
- `TASK-503` and `TASK-505` were marked not auto-eligible because payment-contract edges needed explicit decisions during implementation.
- `TASK-508` remained intentionally separate from the normal code checks so Swagger MCP was only used after build/test/lint passed.
- In `sleep` mode, this completion state should hand off to the next domain instead of pausing here.

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

Decision handling in auto mode:

- if a decision is routine, binary, and low-risk, use the decision config in `decisions.md`
- choose the recommended or safest default path, not blind `yes`
- still log reusable or notable automatic decisions in `decisions.md`
- do not bypass `Auto-Eligible = no`, explicit stop conditions, blockers, failed verification, or high-impact decisions

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
Use `tasks/api-verification-driver.md` only after build, relevant tests, and `npm.cmd run lint:check` pass. In `sleep` mode, this runtime verification step is part of domain completion and should respect the shared hard stop file before it starts.
