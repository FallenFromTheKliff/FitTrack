# S17 Domain Workspace

Use this folder as the operating workspace for `S17 - Business Analytics`.

---

## Domain Info

- `DOMAIN_CODE:` `S17`
- `DOMAIN_NAME:` `Business Analytics`
- `DOMAIN_CONTEXT_FILE:` `context/python/s17-business-analytics.md`
- `CURRENT_STATUS:` `complete`
- `AUTO_MODE_DEFAULT:` `task`
- `CURRENT_ACTIVE_TASK:` `none`

---

## What Lives Here

- `execution.md` -> domain queue, dependency order, and next-task selection once planning begins
- `decisions.md` -> reusable automatic decisions, assumptions, and flagged follow-ups
- `backlog/` -> future S17 tasks not yet being worked
- `active/` -> the one S17 task currently in execution
- `done/` -> completed S17 tasks with their planning and verification history preserved

---

## MCP Defaults

- Serena is the default repo-navigation MCP.
- Prisma MCP is used for DB-backed review, planning, implementation, and verification.
- Prisma Remote MCP is optional for remote Prisma workspace context and should not block local loop work by default.
- Context7 is optional for current framework and package guidance.
- GitHub MCP is optional for GitHub repo, issue, PR, or workflow context that is outside the local workspace.
- Notion MCP is optional when the task explicitly needs Notion workspace context.
- Swagger MCP is reserved for the separate API verification driver after code checks pass and the backend is running.
- Task files should treat `Preferred MCPs` as active routing hints, not report-only metadata.
- `agents/architecture.md` is authoritative by default, and proven reusable patterns may update it explicitly.

---

## Recommended Module Hints

When working on S17, start by checking the most likely related modules:

- `ai-microservice`
- `capstone-backend/src/analytics`
- `capstone-backend/src/ai`
- `capstone-backend/src/membership`
- `capstone-backend/src/bookings`
- `capstone-backend/prisma`

Trim this list per task so each session stays focused.

---

## Operating Rules

1. Read `agents/guardrails.md`, `agents/architecture.md`, `context/00-global-contracts.md`, `context/python/00-python-microservice-contracts.md`, and `context/python/s17-business-analytics.md` before task work.
2. Read `execution.md` before picking a task.
3. Read `decisions.md` before making assumptions that may affect later S17 tasks.
4. Keep exactly one task in `active/` unless the user explicitly wants parallel task execution.
5. Move completed work to `done/` and update `execution.md` so the next chat can continue without re-planning the domain.

---

## Automation Notes

- `task` mode means one active task runs `review -> plan -> implement -> test`, then stops.
- `domain` mode means the active task runs all four phases, then the next ready unblocked task is promoted and run after it.
- `sleep` mode means the shared driver may finish S17 and run the final runtime API verification step when required.
- With `ECO_MODE: on`, sleep mode stops after S17 and rewrites the driver for the next domain so the next chat starts clean.
- With `ECO_MODE: off`, sleep mode may continue into the next domain in the shared registry.
- Use `task` mode when you want to isolate a single risky or unclear S17 task.
- Use `domain` mode only when the queue and dependencies in `execution.md` are accurate and the active tasks are marked auto-eligible.
- Use `sleep` mode when you want the shared driver to handle cross-domain handoff rules and the hard stop file at safe boundaries.
- Use the decision config in `decisions.md` to auto-resolve low-risk yes/no decisions without bypassing safety gates.

---

## Current State

- Domain review is complete.
- Domain planning is complete and the first queue is now seeded.
- `TASK-1701` is complete and has been moved to `done/`.
- `TASK-1702` is complete and has been moved to `done/`.
- `TASK-1703` is complete and has been moved to `done/`.
- `TASK-1704` is complete and has been moved to `done/`.
- `TASK-1705` is complete and has been moved to `done/`.
- `TASK-1706` is complete and has been moved to `done/`.
- S17 is complete and has no remaining active or ready tasks.
- `execution.md` is the source of truth once planning begins.
