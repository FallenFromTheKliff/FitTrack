# S11 Execution Queue

Use this file to drive sequential work for `S11 - AI Chatbot`.

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
- `LAST_COMPLETED_TASK:` `TASK-1106`
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
| `TASK-1101` | S11 Session Persistence And Guard Migration | `done` | `none` | `no` | Added the shared AI persistence repositories and checked-in `one_active_ai_session_per_context` guard migration. |
| `TASK-1102` | Chat Session Read And Archive Surface | `done` | `TASK-1101` | `yes` | Added the authenticated session list/detail/messages/archive controller and service surface on top of the AI repositories. |
| `TASK-1103` | Core Chat Endpoint And Session Lifecycle | `done` | `TASK-1101, TASK-1102` | `no` | Added the core `POST /v1/ai/chat` path, Python `/chat` client contract, lazy archival, title seeding, recent-history loading, and shared chat logging. |
| `TASK-1104` | Validated AI Actions And Cross-Domain Execution | `done` | `TASK-1103` | `no` | Executes validated `ADJUST_TDEE`, `GENERATE_PLAN`, and `LOG_NUTRITION` actions through existing nutrition and fitness seams. |
| `TASK-1105` | S11 Service And E2E Coverage | `done` | `TASK-1102, TASK-1103, TASK-1104` | `yes` | Adds targeted unit, controller, and e2e coverage for chat lifecycle and action execution. |
| `TASK-1106` | S11 Runtime API Verification | `done` | `TASK-1105` | `no` | Verifies the live `/v1/ai/*` contract through the separate API verification driver. |

---

## Review Summary

- The Prisma schema and checked-in base migration already include `AiChatSession`, `AiChatMessage`, and `AiInteractionLog`, so S11 does not need brand-new tables before module work begins.
- The current Nest AI module only exposes `POST /v1/ai/generate-plan`; the documented chat/session routes are still missing from the controller surface.
- `AiService` now supports chat orchestration, lazy session archival, and validated action execution, but S11 still needs a dedicated coverage pass that exercises those paths more broadly than the current focused unit specs.
- The Python client already supports `/health`, `/generate-plan`, `/calculate-tdee`, and `/pose/analyze`, but it does not yet expose the `/chat` contract that S11 needs.
- Existing downstream seams already exist for chat-triggered actions: `NutritionService.recalculateTdee()`, `NutritionService.logNutrition()`, `TrainingPlanService.createAiGeneratedPlan()`, and the active exercise-catalog lookup under fitness.
- The schema comments document a raw partial unique index for one active AI session per context, and `TASK-1101` has now checked that guard into Prisma migrations as the first persistence invariant slice.
- Existing focused AI specs, e2e coverage, and the live runtime verification pass are complete for S11.

---

## Recommended Next Order

Recommended path from the current queue state:

1. `TASK-1101`
2. `TASK-1102`
3. `TASK-1103`
4. `TASK-1104`
5. `TASK-1105`
6. `TASK-1106`

Notes:
- `TASK-1101`, `TASK-1103`, and `TASK-1104` are intentionally marked not auto-eligible because they are the most likely S11 decision points around schema guards, upstream AI chat contract shape, and cross-domain action safety.
- `TASK-1106` reserves the final live verification slice for the separate API verification driver.

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
