# S5 Domain Workspace

Use this folder as the operating workspace for `S5 - Facility Bookings`.

---

## Domain Info

- `DOMAIN_CODE:` `S5`
- `DOMAIN_NAME:` `Facility Bookings`
- `DOMAIN_CONTEXT_FILE:` `context/s5-facility-bookings.md`
- `CURRENT_STATUS:` `complete`
- `AUTO_MODE_DEFAULT:` `task`
- `CURRENT_ACTIVE_TASK:` `none`

---

## What Lives Here

- `execution.md` -> domain queue, dependency order, and next-task selection
- `decisions.md` -> reusable automatic decisions, assumptions, and flagged follow-ups
- `backlog/` -> future S5 tasks not yet being worked
- `active/` -> the one S5 task currently in execution
- `done/` -> completed S5 tasks with their planning and verification history preserved

---

## MCP Defaults

- Serena is the default repo-navigation MCP.
- Prisma MCP is used for DB-backed review, planning, implementation, and verification.
- Context7 is optional for current framework and package guidance.
- Swagger MCP is reserved for the separate API verification driver after code checks pass and the backend is running.
- `agents/architecture.md` is authoritative by default, and proven reusable patterns may update it explicitly.

---

## Recommended Module Hints

When working on S5, start by checking the most likely related modules:

- `capstone-backend/src/bookings`
- `capstone-backend/src/membership`
- `capstone-backend/src/user`
- `capstone-backend/prisma`

Trim this list per task so each session stays focused.

---

## Operating Rules

1. Read `agents/guardrails.md`, `agents/architecture.md`, `context/00-global-contracts.md`, and `context/s5-facility-bookings.md` before task work.
2. Read `execution.md` before picking or promoting a task.
3. Read `decisions.md` before making assumptions that may affect later S5 tasks.
4. Keep exactly one task in `active/` unless the user explicitly wants parallel task execution.
5. Move completed work to `done/` and update `execution.md` so the next chat can continue without re-planning the domain.
6. Shared `sleep` mode may run S5 end-to-end and execute the final runtime API verification task.
7. With `ECO_MODE: on`, sleep mode stops after S5 and rewrites the driver for the next domain so the next chat starts clean.
8. With `ECO_MODE: off`, sleep mode may continue to the next domain in the shared registry.

---

## Current State

- The initial S5 queue is now initialized.
- `TASK-501` is complete and preserved in `done/`.
- `TASK-502` is complete and preserved in `done/`.
- `TASK-503` is complete and preserved in `done/`.
- `TASK-504` is complete and preserved in `done/`.
- `TASK-505` is complete and preserved in `done/`.
- `TASK-506` is complete and preserved in `done/`.
- `TASK-507` is complete and preserved in `done/`.
- `TASK-508` is complete and preserved in `done/`.
- The S5 queue is currently complete; new S5 work should start from a fresh follow-up task if needed.
- `execution.md` is the source of truth once planning begins.
