# S6 Execution Queue

Use this file to drive sequential work for `S6 - Coaching`.

Sequential execution means:
- finish the active task first
- then pick the next `ready` task with no unmet dependencies
- do not advance strictly by task number if a dependency says otherwise

---

## Execution State

- `AUTO_MODE:` `sleep`
- `CURRENT_PHASE:` `review`
- `CURRENT_TASK:` `none`
- `NEXT_READY_TASK:` `none`
- `LAST_COMPLETED_TASK:` `TASK-610`
- `STOP_REASON:` `domain_complete`
- `MAX_TASKS_PER_SESSION:` `15`

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
| `TASK-601` | Coaching Module And Coach Directory | `done` | `none` | `yes` | Established `src/coaching/` and the coach browse/profile update surface. |
| `TASK-602` | Coaching Uniqueness Migration Guards | `done` | `TASK-601` | `no` | Added raw SQL artifacts for the coaching partial unique indexes already documented in schema comments. |
| `TASK-603` | Availability And Appointment Request Core | `done` | `TASK-601` | `yes` | Replaced weekly availability and created pending coach appointments with conflict checks and revenue math. |
| `TASK-604` | Appointment Reads Response And Cancellation | `done` | `TASK-603` | `yes` | Added member appointment reads, coach accept/reject, free-session confirmation, cancellation ownership checks, and audit logging. |
| `TASK-605` | Coaching Payments And Completion Flow | `done` | `TASK-603, TASK-604` | `no` | Extended shared payment ownership plus the coaching downpayment, balance, payment-consumer, and completion flow. |
| `TASK-606` | Relationships And Reviews | `done` | `TASK-601, TASK-604` | `yes` | Added coach-member relationship endpoints plus post-completion review submission and rating refresh behavior. |
| `TASK-607` | Coaching Lifecycle Jobs And Notifications | `done` | `TASK-604, TASK-605, TASK-606` | `yes` | Added coaching lifecycle queue wiring, appointment notifications, relationship lifecycle emails, delayed no-show checks, and free-session cleanup jobs. |
| `TASK-608` | S6 E2E And Integration Coverage | `done` | `TASK-601, TASK-603, TASK-604, TASK-605, TASK-606, TASK-607` | `yes` | Added controller e2e coverage plus shared payment-event integration coverage; build, test, e2e, and lint are green. |
| `TASK-609` | S6 Runtime API Verification | `done` | `TASK-608` | `no` | Live Swagger inspection completed and confirmed the S6 route surface; follow-up `TASK-610` now tracks the remaining contract-alignment fixes. |
| `TASK-610` | S6 Runtime Contract Alignment | `done` | `TASK-609` | `yes` | Coaching Swagger contract aligned and reverified against a fresh live local OpenAPI instance. |

---

## Recommended Next Order

S6 is complete.

Next shared-driver step:

1. rewrite the shared driver to `S7`
2. stop because `ECO_MODE: on`
3. bootstrap `tasks/s7-fitness-training/` on the next run before normal queue work, because that workspace does not exist yet

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
Use `tasks/api-verification-driver.md` only after build, relevant tests, and `npm.cmd run lint:check` pass. For HTTP-facing domains, the final task should usually reserve runtime API verification as a separate slice. In `sleep` mode, this runtime verification step is part of domain completion and should respect the shared hard stop file before it starts.

## Sleep-Mode Notes

- `ECO_MODE: on` stops after one completed domain and rewrites the shared driver to the next domain.
- `ECO_MODE: off` may continue directly into the next domain in the registry.
- The shared driver may bypass non-eligible task pauses only when the domain decision policy explicitly allows it.
- The shared hard stop file must be honored at safe boundaries before promotion, runtime verification, and domain handoff.
