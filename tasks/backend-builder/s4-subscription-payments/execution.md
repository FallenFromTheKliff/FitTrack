# S4 Execution Queue

Use this file to drive sequential work for `S4 - Subscription & Payments`.

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
- `LAST_COMPLETED_TASK:` `TASK-410`
- `STOP_REASON:` `domain_complete`
- `MAX_TASKS_PER_SESSION:` `2`

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
| --- | --- | --- | --- | --- |
| `TASK-401` | Membership Plans | `done` | `none` | `yes` | Public plan reads and admin plan management |
| `TASK-402` | Subscription Read And Cancel | `done` | `TASK-401` | `yes` | Builds the member-facing subscription lifecycle |
| `TASK-403` | Subscription Uniqueness Migration | `done` | `TASK-401` | `no` | Raw SQL uniqueness guard added as a migration artifact |
| `TASK-404` | Payments Core Manual Flow | `done` | `TASK-401` | `yes` | Shared payment backbone for manual flow and later gateway work |
| `TASK-405` | PayMongo Subscribe Flow | `done` | `TASK-401, TASK-403, TASK-404` | `no` | Subscribe flow now creates PayMongo checkout sessions and reuses `payment.completed` activation |
| `TASK-406` | Payments Webhook | `done` | `TASK-404, TASK-405` | `no` | Public webhook now verifies `Paymongo-Signature`, deduplicates on `gateway_event_id`, and reuses `payment.completed` |
| `TASK-407` | Files Upload | `done` | `TASK-401` | `no` | Shared infra and product decisions still exist around upload/storage contract |
| `TASK-408` | Subscription Jobs And Notifications | `done` | `TASK-402, TASK-404, TASK-405, TASK-406` | `yes` | Lifecycle warnings, expiry processing, and notification side effects are in place |
| `TASK-409` | S4 E2E And Integration Coverage | `done` | `TASK-402, TASK-404, TASK-405, TASK-406, TASK-408` | `yes` | Final confidence pass across completed S4 flows is now in place |
| `TASK-410` | S4 Runtime Contract Alignment | `done` | `TASK-409` | `yes` | Follow-up fix for runtime API verification findings around cancel status and missing Swagger success schemas. |

---

## Recommended Next Order

Recommended path from the current queue state:

No remaining ready tasks.

Notes:
- `TASK-405`, `TASK-406`, `TASK-407`, `TASK-408`, and `TASK-409` are now complete.
- `TASK-410` applied the first runtime-verification follow-up fix, but the live API driver should be rerun after the backend restarts so the updated Swagger doc can be confirmed.
- `TASK-403`, `TASK-405`, and `TASK-406` are marked not auto-eligible because they are more likely to require explicit decisions.
- The S4 queue is fully complete.
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
Use `tasks/api-verification-driver.md` only after build, relevant tests, and `npm.cmd run lint:check` pass. In `sleep` mode, this runtime verification step is part of domain completion and should respect the shared hard stop file before it starts.
