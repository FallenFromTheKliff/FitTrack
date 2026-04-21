# S17 Execution Queue

Use this file to drive sequential work for `S17 - Business Analytics`.

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
- `LAST_COMPLETED_TASK:` `TASK-1706`
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
6. If `STOP_REASON` is not `none`, stop and resolve that first.
7. Read the decision config in `decisions.md` before stopping for a routine yes/no question.

---

## Queue

| Task | Title | Status | Depends On | Auto-Eligible | Notes |
| --- | --- | --- | --- | --- | --- |
| `TASK-1701` | S17 Prisma Business Insight Contract Alignment | `done` | `none` | `yes` | Adds the additive S17 `BusinessInsightRun` persistence contract and enums while preserving the existing S13 analytics and S16 AI surfaces. |
| `TASK-1702` | Business Analytics Grounding Aggregation Expansion | `done` | `TASK-1701` | `yes` | Expands the existing Nest analytics aggregation seam to produce the full S17 grounding payload, including focus-aware windows, peak hours, top plans, and optional inventory rollups. |
| `TASK-1703` | Python Business Insight Microservice Scaffold | `done` | `TASK-1702` | `yes` | Scaffolds the FastAPI `POST /analytics/insights` contract, Pydantic models, and the OpenRouter-facing insight service seam with focused Python coverage. |
| `TASK-1704` | Nest Business Insight Generation And History Flow | `done` | `TASK-1701, TASK-1702, TASK-1703` | `no` | Wires the admin HTTP surface, Nest-to-Python orchestration, insight-run persistence, and history/detail reads for the completed S17 contract. |
| `TASK-1705` | S17 Coverage Pass | `done` | `TASK-1704` | `yes` | Adds focused Nest and Python coverage for validation, persistence, AI-client contract handling, and history retrieval once the main insight flow is wired. |
| `TASK-1706` | S17 Runtime API Verification | `done` | `TASK-1705` | `no` | Reserves the final S17 slice for the separate live runtime API verification pass over the completed `business-analytics` HTTP surface. |

---

## Review Summary

- `capstone-backend/src/analytics` now exposes both the existing S13 KPI routes and the new admin-facing S17 `/v1/business-analytics/insights` surface through dedicated controller, service, and repository seams.
- `capstone-backend/src/analytics/business-insight-run.repository.ts` now persists successful validated `BusinessInsightRun` records and serves history/detail reads from stored payloads with safe requester projection.
- `capstone-backend/src/ai/ai-python-client.service.ts` now includes the validated S17 `/analytics/insights` request helper and response guard aligned with the Python contract.
- focused Nest and Python coverage now exists for S17 DTO validation, controller wiring, service orchestration, repository reads, AI-client validation, nullable stored-payload regressions, and provider-seam behavior, and live runtime verification has now completed successfully in `TASK-1706`
- Prisma Local now confirms the local schema is up to date after the checked-in `20260330110000_s17_business_insight_contract_alignment` migration was applied for the runtime verification pass

---

## Planned Task Breakdown

1. `TASK-1701` - Align Prisma with the S17 `BusinessInsightRun`, `InsightFocus`, and `InsightPeriod` persistence contract while preserving the current analytics and AI modules.
2. `TASK-1702` - Expand the existing Nest analytics aggregation layer so it can build the complete S17 grounding payload without changing the current S13 public KPI endpoints.
3. `TASK-1703` - Scaffold the FastAPI `POST /analytics/insights` boundary, request and response models, and the OpenRouter-ready insight service seam with focused Python contract coverage.
4. `TASK-1704` - Add the admin-facing Nest `business-analytics` HTTP surface, validated Python client method, insight-run persistence, and history/detail reads.
5. `TASK-1705` - Add the focused S17 Nest and Python coverage once the main insight-generation lifecycle is in place.
6. `TASK-1706` - Reserve the final S17 slice for runtime API verification through `tasks/api-verification-driver.md`.

---

## Latest Progress

- Domain review is complete.
- Prisma Local confirms the local schema is up to date before S17 planning.
- Domain planning is complete and the first S17 queue is now seeded.
- The low-risk sequencing decision to start with the additive Prisma contract has been recorded in `decisions.md`.
- `TASK-1701` has been promoted to `active/`.
- The shared driver now points to the S17 implementation phase for `TASK-1701`.
- `TASK-1701` task implementation is complete.
- Prisma Client generation passed after the additive S17 schema change.
- Focused analytics specs passed with `2` suites and `10` tests.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the Prisma contract alignment.
- `TASK-1701` testing is complete.
- `TASK-1701` is complete and has been moved into `done/`.
- `TASK-1702` has been promoted to `active/`.
- Prisma Local reports one unapplied checked-in migration from `TASK-1701` (`20260330110000_s17_business_insight_contract_alignment`); keep it as a checked-in local guard and use `prisma migrate deploy` later only if a DB-backed verification step is blocked on it.
- The low-risk S17 grounding assumptions for custom buckets and ranking sources have been recorded in `decisions.md`.
- `TASK-1702` task planning is complete.
- `TASK-1702` task implementation is complete.
- Focused analytics specs passed with `2` suites and `16` tests after the new grounding-builder and ranking coverage were added.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the S17 analytics aggregation expansion.
- `TASK-1702` testing is complete.
- `TASK-1702` is complete and has been moved into `done/`.
- `TASK-1703` has been promoted to `active/`.
- The low-risk S17 Python testing and provider-seam assumption has been recorded in `decisions.md`.
- `TASK-1703` task planning is complete.
- `TASK-1703` task implementation is complete.
- Focused Python API specs passed with `18` tests after the new insight route, models, and provider seam were added.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the S17 Python scaffold was added.
- `TASK-1703` testing is complete.
- `TASK-1703` is complete and has been moved into `done/`.
- `TASK-1704` has been promoted to `active/`.
- The low-risk S17 request-snapshot and success-only persistence assumption has been recorded in `decisions.md`.
- `TASK-1704` task planning is complete.
- The shared driver now points to the S17 implementation phase for `TASK-1704`.
- Because `TASK-1704` is `Auto-Eligible: no`, normal domain flow should pause here until implementation is explicitly confirmed.
- `TASK-1704` task implementation is complete.
- Focused Nest specs passed with `5` suites and `33` tests after the new business-insight controller, service, repository, DTO, and AI-client coverage were added.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the S17 Nest business-insight flow was added.
- `TASK-1704` testing is complete.
- `TASK-1704` is complete and has been moved into `done/`.
- `TASK-1705` has been promoted to `active/`.
- The low-risk S17 coverage-slice assumption for provider tests and nullable regressions has been recorded in `decisions.md`.
- `TASK-1705` task planning is complete.
- The shared driver now points to the S17 implementation phase for `TASK-1705`.
- `TASK-1705` task implementation is complete.
- Focused Nest specs passed with `6` suites and `42` tests after the nullable stored-payload and AI-client regression coverage was extended.
- Focused Python business-insight specs passed with `8` tests after offline anomaly-detection and provider contract coverage was added.
- `npm.cmd run build` and `npm.cmd run lint:check` passed after the S17 coverage additions.
- `TASK-1705` testing is complete.
- `TASK-1705` is complete and has been moved into `done/`.
- `TASK-1706` has been promoted to `active/`.
- The shared driver now points to the S17 planning phase for `TASK-1706`.
- Because `TASK-1706` is `Auto-Eligible: no`, normal domain flow should pause here until the runtime verification pass is explicitly confirmed.
- The low-risk S17 runtime-verification assumptions for the local provider stub and checked-in migration baseline have been recorded in `decisions.md`.
- `TASK-1706` task planning is complete.
- The shared driver now points to the S17 implementation phase for `TASK-1706`.
- Because `TASK-1706` is `Auto-Eligible: no`, normal domain flow should pause here until the runtime verification pass is explicitly confirmed.
- `TASK-1706` task implementation is complete.
- The shared API verification driver now points to the S17 `business-analytics` runtime scope, required checks, and module owners.
- The shared driver now points to the S17 test phase for `TASK-1706`.
- Prisma Local confirmed the checked-in `20260330110000_s17_business_insight_contract_alignment` migration as the only pending local guard migration, and the runtime pass applied it with `npx.cmd prisma migrate deploy`.
- Live Swagger verification passed for the S17 admin `business-analytics` surface with:
  - `401` for unauthenticated history access
  - `403` for non-admin access
  - `201` for generate
  - `200` for history
  - `200` for detail
- The live generate, history, and detail responses all preserved the expected persisted S17 contract, including safe requester projection and the generated narrative payload fields.
- Temporary runtime DB fixtures, local stub/backend/microservice processes, and temporary runtime logs were cleaned up after the pass.
- `TASK-1706` testing is complete.
- `TASK-1706` is complete and has been moved into `done/`.
- S17 is complete and there is no next ready task remaining in this domain.

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
