# S9 Execution Queue

Use this file to drive sequential work for `S9 - TDEE & Nutrition`.

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
- `LAST_COMPLETED_TASK:` `TASK-906`
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
| `TASK-901` | S9 Schema Alignment And Nutrition Guard Migrations | `done` | `none` | `no` | Closed the nutrition-unit contract and added the checked-in active-snapshot guard migration artifact. |
| `TASK-902` | Nutrition Module And TDEE Read Surface | `done` | `TASK-901` | `yes` | Added the nutrition module root and the authenticated active/history TDEE reads. |
| `TASK-903` | TDEE Recalculation Via AI Client | `done` | `TASK-901, TASK-902` | `no` | Extended the shared AI seam, added the recalculation endpoint, rotated active snapshots transactionally, and emitted the bounded nutrition event. |
| `TASK-904` | Nutrition Logs And Daily Summary | `done` | `TASK-901, TASK-902` | `yes` | Added nutrition-log CRUD, daily-summary aggregation, optional active-macro linkage, and ownership-safe mutations. |
| `TASK-905` | S9 Service And E2E Coverage | `done` | `TASK-902, TASK-903, TASK-904` | `yes` | Added nutrition controller e2e coverage, validated high-risk S9 contracts, and aligned recalculation to return HTTP 200. |
| `TASK-906` | S9 Runtime API Verification | `done` | `TASK-905` | `no` | Verified the live `/v1/nutrition/*` OpenAPI surface, bearer auth metadata, and unauthorized runtime behavior with no contract mismatches found. |

---

## Review Summary

- The Prisma models for `TdeeProfile`, `MacroTarget`, and `NutritionLog` already exist in `schema.prisma` and the checked-in base migration, so S9 does not need brand-new tables before implementation begins.
- The S9 design and live schema drift on `NutritionLog.unit`: the context defines a `NutritionUnit` enum, while the Prisma model currently stores `unit` as a plain string.
- The S9 partial unique indexes for one active TDEE profile and one active macro target per user are documented in the context and schema comments, but they are not checked into migration SQL yet.
- The Nest app currently has no `src/nutrition/` module, no `/v1/nutrition/*` controller surface, and no S9 test coverage.
- The repo already has reusable seams for S9 in the user aggregate/profile path, the shared base repository transaction and date-range helpers, and the existing Python AI client/config.
- The AI client does not yet expose a TDEE-calculation operation, so S9 should extend that shared seam rather than inventing a second external-integration pattern.
- The context mentions an in-app notification after recalculation, but the repo does not yet have a notification module/service write seam; S9 should emit a domain event and avoid broadening into S12 persistence work during the first slice.
- `TASK-902` is complete: S9 now has a dedicated nutrition module plus the authenticated active and history TDEE read surface.
- `TASK-903` is complete: S9 now has the authenticated TDEE recalculation endpoint, shared AI client support for `/calculate-tdee`, transactional active-snapshot rotation, and a bounded nutrition domain event.
- `TASK-904` is complete: S9 now has nutrition-log CRUD, authenticated daily-summary aggregation, optional active-macro linkage for new logs, and ownership-safe log mutations.
- `TASK-905` is complete: S9 now has controller-level nutrition e2e coverage for the full `/v1/nutrition/*` surface plus explicit HTTP 200 behavior on TDEE recalculation.
- `TASK-906` is complete: live Swagger and runtime verification confirmed the nutrition HTTP surface with no contract mismatches, and the checked-in local S9 migration baseline is now applied.

---

## Recommended Next Order

No remaining S9 tasks. The domain is complete.

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
