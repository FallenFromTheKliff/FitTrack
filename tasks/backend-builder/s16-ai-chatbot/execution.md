# S16 Execution Queue

Use this file to drive sequential work for `S16 - AI Chatbot`.

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
- `LAST_COMPLETED_TASK:` `TASK-1607`
- `STOP_REASON:` `none`
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
6. If `STOP_REASON` is not `none`, stop and resolve that first.
7. Read the decision config in `decisions.md` before stopping for a routine yes/no question.

---

## Queue

| Task | Title | Status | Depends On | Auto-Eligible | Notes |
| --- | --- | --- | --- | --- | --- |
| `TASK-1601` | S16 Prisma Gym Chat Contract Alignment | `done` | `none` | `yes` | Adds the additive S16 `GymChat*` and knowledge persistence contract while preserving the legacy S11 `AiChat*` tables. |
| `TASK-1602` | Gym Chat Session Read Surface And Repository Expansion | `done` | `TASK-1601` | `yes` | Adds the member-facing session history/detail HTTP surface and repository helpers for the new `gym-chat` contract. |
| `TASK-1603` | Gym Knowledge Admin Surface | `done` | `TASK-1601` | `yes` | Adds the admin CRUD and list endpoints for operating hours, special schedules, promotions, and FAQ knowledge sources. |
| `TASK-1604` | Python Gym Chat Microservice Scaffold | `done` | `TASK-1601` | `yes` | Scaffolds the FastAPI `POST /chat/gym` surface, request and response models, and focused Python contract tests. |
| `TASK-1605` | Grounded Gym Chat Message Flow And Session Lifecycle | `done` | `TASK-1602, TASK-1603, TASK-1604` | `no` | Wires the grounded Nest-to-Python chat flow, source persistence, follow-up suggestions, and lazy session archival behavior. |
| `TASK-1606` | S16 Coverage Pass | `done` | `TASK-1605` | `yes` | Adds the focused Nest and Python coverage for auth, validation, out-of-scope handling, and grounded-source persistence. |
| `TASK-1607` | S16 Runtime API Verification | `done` | `TASK-1606` | `no` | Reserves the final S16 slice for the separate live runtime API verification pass over the completed `gym-chat` HTTP surface. |

---

## Review Summary

- `capstone-backend/prisma/schema.prisma` now includes the additive S16 `GymChat*` and knowledge-table contract while preserving the legacy S11 `AiChatSession`, `AiChatMessage`, and `AiInteractionLog` models.
- `capstone-backend/src/ai/ai.controller.ts` still exposes `/v1/ai/chat*` and `POST /v1/ai/generate-plan`, not the S16 `/v1/gym-chat/*` member routes or the admin knowledge routes.
- `capstone-backend/src/ai/ai-python-client.service.ts` still posts to the legacy `/chat` contract, while `ai-microservice/app/api/routes.py` currently exposes only health and pose routes.
- `capstone-backend/src/ai/ai.service.ts` still centers the legacy cross-domain action flow, so S16 should be added additively instead of mutating the old surface in place.
- `capstone-backend/src/ai/ai-chat-session.repository.ts` and `capstone-backend/src/ai/ai-chat-message.repository.ts` provide reusable session/message ownership seams for the S16 read surface.
- `capstone-backend/src/membership/subscription/subscription.service.ts` already provides a reusable membership-plan listing seam that can feed part of the S16 grounding payload.
- `ai-microservice/tests` currently only covers pose contracts, so S16 still needs dedicated Python-side contract coverage.

---

## Planned Task Breakdown

1. `TASK-1601` - Align Prisma with the S16 `GymChat*` and knowledge persistence contract while keeping the legacy S11 chat models intact.
2. `TASK-1602` - Add the member-facing `gym-chat` session read routes, DTOs, and repository helpers for history and detail views.
3. `TASK-1603` - Add the admin knowledge CRUD and list surface for operating hours, special schedules, promotions, and FAQ entries.
4. `TASK-1604` - Scaffold the FastAPI `POST /chat/gym` boundary with request and response models plus focused Python contract tests.
5. `TASK-1605` - Wire the grounded message flow, Nest-to-Python integration, source logging, follow-up suggestions, and lazy session archival behavior.
6. `TASK-1606` - Add the focused S16 Nest and Python coverage once the main grounded chat lifecycle is in place.
7. `TASK-1607` - Reserve the final S16 slice for runtime API verification through `tasks/api-verification-driver.md`.

---

## Latest Progress

- Domain review is complete.
- Prisma Local confirms the local schema is up to date before S16 planning.
- Domain planning is complete and the first S16 queue is now seeded.
- `TASK-1601` has been promoted to `active/`.
- `TASK-1601` task review is complete.
- Prisma Local confirms the local schema is up to date before the `TASK-1601` plan.
- `TASK-1601` task planning is complete.
- `TASK-1601` implementation is complete.
- Focused legacy AI repository tests passed with `3` suites and `12` tests after the additive S16 schema change.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the Prisma contract alignment.
- `TASK-1601` testing is complete.
- The checked-in local Prisma migration for `TASK-1601` has been applied and Prisma Local now reports the database schema is up to date.
- `TASK-1601` is complete and has been moved into `done/`.
- `TASK-1602` has been promoted to `active/`.
- `TASK-1602` task review is complete.
- Prisma Local confirms the local schema is up to date before the `TASK-1602` plan.
- `TASK-1602` task planning is complete.
- `TASK-1602` implementation is complete.
- Focused gym-chat unit specs passed with `4` suites and `15` tests.
- The dedicated gym-chat e2e route spec passed with `1` suite and `2` tests.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the additive `gym-chat` read-surface implementation.
- `TASK-1602` testing is complete.
- Prisma Local confirms the local schema is still up to date before closing `TASK-1602`.
- `TASK-1602` is complete and has been moved into `done/`.
- `TASK-1603` has been promoted to `active/`.
- `TASK-1603` task review is complete.
- Prisma Local confirms the local schema is up to date before the `TASK-1603` plan.
- `TASK-1603` task planning is complete.
- `TASK-1603` implementation is complete.
- Focused gym-knowledge unit specs passed with `3` suites and `15` tests.
- The dedicated gym-knowledge e2e route spec passed with `1` suite and `3` tests.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the admin knowledge-surface implementation.
- `TASK-1603` testing is complete.
- Prisma Local confirms the local schema is still up to date before closing `TASK-1603`.
- `TASK-1603` is complete and has been moved into `done/`.
- `TASK-1604` has been promoted to `active/`.
- `TASK-1604` task review is complete.
- Prisma Local confirms the local schema is up to date before the `TASK-1604` plan.
- `TASK-1604` task planning is complete.
- `TASK-1604` implementation is complete.
- Focused Python gym-chat and pose API tests passed with `13` total tests.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the Python gym-chat scaffold implementation.
- `TASK-1604` testing is complete.
- Prisma Local confirms the local schema is still up to date before closing `TASK-1604`.
- `TASK-1604` is complete and has been moved into `done/`.
- `TASK-1605` has been promoted to `active/`.
- `TASK-1605` task review is complete.
- Prisma Local confirms the local schema is still up to date before the `TASK-1605` plan.
- `TASK-1605` task planning is complete.
- `TASK-1605` implementation is complete.
- Focused gym-chat and Python-client unit specs passed with `6` suites and `41` tests.
- The dedicated `gym-chat` e2e route spec passed with `1` suite and `3` tests.
- The real FastAPI `AiPythonClientService` integration spec passed with `1` suite and `2` tests.
- Focused Python gym-chat and pose contract tests passed with `13` total tests.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the grounded message-flow implementation.
- `TASK-1605` testing is complete.
- Prisma Local confirms the local schema is still up to date before closing `TASK-1605`.
- `TASK-1605` is complete and has been moved into `done/`.
- `TASK-1606` has been promoted to `active/`.
- `TASK-1606` task review is complete.
- Prisma Local confirms the local schema is still up to date before the `TASK-1606` plan.
- `TASK-1606` task planning is complete.
- `TASK-1606` implementation is complete.
- Focused gym-chat unit coverage passed with `6` suites and `42` tests.
- The dedicated `gym-chat` e2e route spec passed with `1` suite and `4` tests.
- Focused Python gym-chat and pose contract tests passed with `15` total tests.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the S16 coverage additions.
- `TASK-1606` testing is complete.
- Prisma Local confirms the local schema is still up to date before closing `TASK-1606`.
- `TASK-1606` is complete and has been moved into `done/`.
- `TASK-1607` has been promoted to `active/`.
- `TASK-1607` task review is complete.
- Prisma Local confirms the local schema is still up to date before the `TASK-1607` plan.
- `TASK-1607` task planning is complete.
- `tasks/api-verification-driver.md` has been rewritten to the S16 `gym-chat` scope and the live runtime verification pass has been executed.
- The live S16 runtime pass matched the documented member and admin `gym-chat` contract without requiring an implementation fix.
- Focused S16 e2e coverage, Python contract tests, `npm.cmd run build`, and `npm.cmd run lint:check` all passed after the runtime pass.
- `TASK-1607` is complete and has been moved into `done/`.
- The S16 domain queue is complete.

---

## Recommended Next Order

Recommended path from the current queue state:

1. `TASK-1601`
2. `TASK-1602`
3. `TASK-1603`
4. `TASK-1604`
5. `TASK-1605`
6. `TASK-1606`
7. `TASK-1607`

Notes:
- `TASK-1601` leads because every downstream S16 slice depends on the missing additive persistence contract.
- `TASK-1605` is intentionally marked not auto-eligible because it joins new Nest routes, grounding assembly, Python inference, and session lifecycle behavior.
- `TASK-1607` stays last so runtime verification happens only after the S16 contract, integration, and coverage slices are green.

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
