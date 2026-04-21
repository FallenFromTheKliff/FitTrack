# S14 Execution Queue

Use this file to drive sequential work for `S14 - Auditing Refinement`.

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
- `LAST_COMPLETED_TASK:` `TASK-1404`
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
| `TASK-1401` | Audit Admin Read Surface | `done` | `none` | `yes` | Adds the first S14 HTTP read contract around the existing audit store with admin-only guards, DTO validation, and safe response mapping. |
| `TASK-1402` | Audit Emitter Completion And Action Alignment | `done` | `TASK-1401` | `no` | Wires the missing `COACH_COMMISSION_CHANGED` audit event and resolves how S14 should handle context-listed actions whose owning business flows do not yet exist. |
| `TASK-1403` | S14 Coverage Pass | `done` | `TASK-1401, TASK-1402` | `yes` | Adds focused audit module and cross-domain emitter coverage once the read surface and emitter alignment work are settled. |
| `TASK-1404` | S14 Runtime API Verification | `done` | `TASK-1403` | `no` | Runs the separate runtime API verification driver against the final `/v1/audit` HTTP surface after checks pass. |

---

## Review Summary

- The `AuditLog` Prisma model and checked-in migration already exist, and Prisma Local reports the local schema is up to date.
- The S14 admin HTTP read surface, DTO validation, safe response mapping, and Swagger contract are now implemented under `src/audit/`.
- The async `audit.log` listener persists append-only records, and the existing high-value emitters now include the admin coach commission update path.
- `PAYMENT_REFUNDED` and `SUBSCRIPTION_SUSPENDED` remain declared in the shared audit action catalog, but no matching owning-domain business flow was found in the current repo, so S14 treats them as explicit deferrals rather than hidden audit-only work.

---

## Latest Progress

- Domain review is complete.
- The first S14 task queue has been seeded from the review findings.
- `TASK-1401` passed task-scoped tests, build, and lint and is now complete.
- `TASK-1402` is complete after implementation, verification, and decision-log alignment.
- `TASK-1403` is complete after the focused audit coverage pass.
- `TASK-1404` passed live runtime API verification and completed the S14 queue.

---

## Recommended Next Order

Recommended path from the current queue state:

1. `TASK-1401`
2. `TASK-1402`
3. `TASK-1403`
4. `TASK-1404`

Notes:
- `TASK-1401` leads with the missing admin read surface because it gives S14 a concrete HTTP contract without forcing cross-domain feature invention.
- `TASK-1402` is intentionally marked not auto-eligible because the unresolved refund and suspension actions can broaden into other domains if handled carelessly.
- `TASK-1404` reserves the final live verification slice for the separate API verification driver.

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
