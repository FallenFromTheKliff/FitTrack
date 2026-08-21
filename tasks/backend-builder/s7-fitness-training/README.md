# S7 Domain Workspace

Use this folder as the operating workspace for `S7 - Fitness Training`.

---

## Domain Info

- `DOMAIN_CODE:` `S7`
- `DOMAIN_NAME:` `Fitness Training`
- `DOMAIN_CONTEXT_FILE:` `context/s7-fitness-training.md`
- `CURRENT_STATUS:` `complete`
- `AUTO_MODE_DEFAULT:` `task`
- `CURRENT_ACTIVE_TASK:` `none`

---

## What Lives Here

- `execution.md` -> domain queue, dependency order, and next-task selection once planning begins
- `decisions.md` -> reusable automatic decisions, assumptions, and flagged follow-ups
- `backlog/` -> future S7 tasks not yet being worked
- `active/` -> the one S7 task currently in execution
- `done/` -> completed S7 tasks with their planning and verification history preserved

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

When working on S7, start by checking the most likely related modules:

- `capstone-backend/src/fitness`
- `capstone-backend/src/ai`
- `capstone-backend/src/user`
- `capstone-backend/prisma`

Trim this list per task so each session stays focused.

---

## Operating Rules

1. Read `agents/guardrails.md`, `agents/architecture.md`, `context/00-global-contracts.md`, and `context/s7-fitness-training.md` before task work.
2. Read `execution.md` before picking a task.
3. Read `decisions.md` before making assumptions that may affect later S7 tasks.
4. Keep exactly one task in `active/` unless the user explicitly wants parallel task execution.
5. Move completed work to `done/` and update `execution.md` so the next chat can continue without re-planning the domain.

---

## Automation Notes

- `task` mode means one active task runs `review -> plan -> implement -> test`, then stops.
- `domain` mode means the active task runs all four phases, then the next ready unblocked task is promoted and run after it.
- `sleep` mode means the shared driver may finish S7 and run the final runtime API verification step when required.
- With `ECO_MODE: on`, shared sleep mode stops after S7 and rewrites the driver for the next domain so the next chat starts clean.
- With `ECO_MODE: off`, shared sleep mode may continue into the next domain in the shared registry.
- Use `task` mode when you want to isolate a single risky or unclear S7 task.
- Use `domain` mode only when the queue and dependencies in `execution.md` are accurate and the active tasks are marked auto-eligible.
- Use `sleep` mode when you want the shared driver to handle cross-domain handoff rules and the hard stop file at safe boundaries.
- Use the decision config in `decisions.md` to auto-resolve low-risk yes/no decisions without bypassing safety gates.

---

## Current State

- Initial review plus `TASK-701` through `TASK-707` are complete and reflected in `execution.md`.
- The AI plan-generation slice is now implemented and verified, including `/v1/ai/generate-plan`, Python AI health/generation calls, `ai_interaction_logs` writes, and transactional active-plan replacement.
- The pose/WebSocket slice is now implemented and verified, including authenticated `/pose` connections, persisted `pose_sessions`, and the dedicated `/pose/analyze` Python AI client boundary.
- Broad S7 controller-level e2e coverage now exists for the exercise, training-plan, workout-session, and AI generate-plan HTTP flows.
- `TASK-708` is complete and preserved in `done/`.
- The live S7 OpenAPI surface has now been verified through Swagger, including the protected exercise, plan, session, and AI routes.
- The S7 queue is complete and ready for shared-driver handoff to `S8`.
