# S10 Execution Queue

Use this file to drive sequential work for `S10 - Inventory`.

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
- `LAST_COMPLETED_TASK:` `TASK-1007`
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
| `TASK-1001` | Inventory Module And Retail Product Surface | `done` | `none` | `yes` | Added `src/inventory/` plus the authenticated/admin retail-product read, create, update, and restock surface. |
| `TASK-1002` | Equipment Items And Write-Off Core | `done` | `TASK-1001` | `yes` | Adds equipment list/detail/admin writes plus write-off history and invariant-safe write-off mutations. |
| `TASK-1003` | Cash POS Sales And Sale Reads | `done` | `TASK-1001` | `no` | Cash-sale flow now rejects insufficient stock with `422`, snapshots prices and totals, and keeps stock decrement plus item writes transactional. |
| `TASK-1004` | PayMongo QR Sales And Payment Completion | `done` | `TASK-1001, TASK-1003` | `no` | PayMongo product sales now require `customer_user_id`, create shared `payments` rows, resume checkout via `Idempotency-Key`, and finalize on `payment.completed`. |
| `TASK-1005` | Inventory Alerts And Audit Side Effects | `done` | `TASK-1002, TASK-1003, TASK-1004` | `yes` | Inventory now emits audit events for restocks and write-offs, queues admin alert mail, and deduplicates low-stock alerts with `last_low_stock_alert_at`. |
| `TASK-1006` | S10 Service And E2E Coverage | `done` | `TASK-1002, TASK-1003, TASK-1004, TASK-1005` | `yes` | Added duplicate-completion, lifecycle repository, and full inventory e2e coverage; full build, unit, e2e, and lint verification passed. |
| `TASK-1007` | S10 Runtime API Verification | `done` | `TASK-1006` | `no` | Live Swagger verification passed for the full `/v1/inventory/*` surface, including bearer auth metadata and the required `Idempotency-Key` contract on product sales. |

---

## Review Summary

- The S10 Prisma models for retail products, sale transactions, sale items, equipment items, and equipment write-offs already exist in `schema.prisma` and the checked-in base migration, so S10 does not need brand-new tables before module work begins.
- The Nest app currently has no `src/inventory/` module, no `/v1/inventory/*` controller surface, and no S10 test coverage.
- The repo already has reusable seams for S10 in the shared payment backbone under `src/membership/payment`, queue-backed mail delivery under `src/queue`, audit logging under `src/audit`, file upload infrastructure under `src/files`, and base repository pagination and ownership helpers under `src/common`.
- The S10 context and current schema are not fully aligned on product-sale payment linkage: `SaleTransaction.payment_id` is only a scalar UUID today while the shared payment backbone uses `payments.payable_type` plus `payable_id`.
- The cash-sale flow text is internally ambiguous on insufficient stock because it says both `Throw 422 INSUFFICIENT_STOCK` and that the sale is still allowed by design, so the implementation task should stop if that business rule cannot be resolved from repo context.

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
- `ECO_MODE: off` may continue into the next domain.
- The shared driver may bypass non-eligible task pauses only when the domain decision policy explicitly allows it.
- The shared hard stop file must be honored at safe boundaries.

---

## Recommended Next Order

Recommended path from the current queue state:

1. `TASK-1001`
2. `TASK-1002`
3. `TASK-1003`
4. `TASK-1004`
5. `TASK-1005`
6. `TASK-1006`
7. `TASK-1007`

Notes:
- `TASK-1003` and `TASK-1004` are intentionally marked not auto-eligible because the sale-stock rule and payment-link contract are the most likely S10 decision points.
- `TASK-1007` reserves the final live verification slice for the separate API verification driver.
