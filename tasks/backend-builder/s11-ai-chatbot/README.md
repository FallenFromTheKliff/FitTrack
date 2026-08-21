# S11 Domain Workspace

Use this folder as the operating workspace for `S11 - AI Chatbot`.

---

## Domain Info

- `DOMAIN_CODE:` `S11`
- `DOMAIN_NAME:` `AI Chatbot`
- `DOMAIN_CONTEXT_FILE:` `context/s11-ai-chatbot.md`
- `CURRENT_STATUS:` `complete`
- `AUTO_MODE_DEFAULT:` `task`
- `CURRENT_ACTIVE_TASK:` `none`

---

## What Lives Here

- `execution.md` -> domain queue, dependency order, and next-task selection once planning begins
- `decisions.md` -> reusable automatic decisions, assumptions, and flagged follow-ups
- `backlog/` -> future S11 tasks not yet being worked
- `active/` -> the one S11 task currently in execution
- `done/` -> completed S11 tasks with their planning and verification history preserved

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

When working on S11, start by checking the most likely related modules:

- `capstone-backend/src/ai`
- `capstone-backend/src/nutrition`
- `capstone-backend/src/fitness`
- `capstone-backend/src/common`
- `capstone-backend/src/user`
- `capstone-backend/prisma`

Trim this list per task so each session stays focused.

---

## Operating Rules

1. Read `agents/guardrails.md`, `agents/architecture.md`, `context/00-global-contracts.md`, and `context/s11-ai-chatbot.md` before task work.
2. Read `execution.md` before picking a task.
3. Read `decisions.md` before making assumptions that may affect later S11 tasks.
4. Keep exactly one task in `active/` unless the user explicitly wants parallel task execution.
5. Move completed work to `done/` and update `execution.md` so the next chat can continue without re-planning the domain.

---

## Automation Notes

- `task` mode means one active task runs `review -> plan -> implement -> test`, then stops.
- `domain` mode means the active task runs all four phases, then the next ready unblocked task is promoted and run after it.
- `sleep` mode means the shared driver may finish S11 and run the final runtime API verification step when required.
- With `ECO_MODE: on`, shared sleep mode stops after S11 and rewrites the driver for the next domain so the next chat starts clean.
- With `ECO_MODE: off`, shared sleep mode may continue into the next domain in the shared registry.
- Use `task` mode when you want to isolate a single risky or unclear S11 task.
- Use `domain` mode only when the queue and dependencies in `execution.md` are accurate and the active tasks are marked auto-eligible.
- Use `sleep` mode when you want the shared driver to handle cross-domain handoff rules and the hard stop file at safe boundaries.
- Use the decision config in `decisions.md` to auto-resolve low-risk yes/no decisions without bypassing safety gates.

---

## Current State

- Review, initial planning, `TASK-1101`, `TASK-1102`, and `TASK-1103` are complete.
- All planned S11 tasks are complete.
- The S11 AI surface has passed code checks, focused e2e coverage, and live runtime verification.
- `execution.md` is the source of truth once planning begins.
