# S6 Domain Workspace

Use this folder as the operating workspace for `S6 - Coaching`.

---

## Domain Info

- `DOMAIN_CODE:` `S6`
- `DOMAIN_NAME:` `Coaching`
- `DOMAIN_CONTEXT_FILE:` `context/s6-coaching.md`
- `CURRENT_STATUS:` `complete`
- `AUTO_MODE_DEFAULT:` `task`
- `CURRENT_ACTIVE_TASK:` `none`

---

## What Lives Here

- `execution.md` -> domain queue, dependency order, and next-task selection
- `decisions.md` -> reusable automatic decisions, assumptions, and flagged follow-ups
- `backlog/` -> future S6 tasks not yet being worked
- `active/` -> the one S6 task currently in execution
- `done/` -> completed S6 tasks with their planning and verification history preserved

---

## MCP Defaults

- Serena is the default repo-navigation MCP.
- Prisma MCP is used for DB-backed review, planning, implementation, and verification.
- Context7 is optional for current framework and package guidance.
- Swagger MCP is reserved for the separate API verification driver after code checks pass and the backend is running.
- `agents/architecture.md` is authoritative by default, and proven reusable patterns may update it explicitly.

---

## Recommended Module Hints

When working on S6, start by checking the most likely related modules:

- `capstone-backend/src/coaching`
- `capstone-backend/src/membership`
- `capstone-backend/src/user`
- `capstone-backend/prisma`

Trim this list per task so each session stays focused.

---

## Operating Rules

1. Read `agents/guardrails.md`, `agents/architecture.md`, `context/00-global-contracts.md`, and `context/s6-coaching.md` before task work.
2. Read `execution.md` before picking or promoting a task.
3. Read `decisions.md` before making assumptions that may affect later S6 tasks.
4. Keep exactly one task in `active/` unless the user explicitly wants parallel task execution.
5. Move completed work to `done/` and update `execution.md` so the next chat can continue without re-planning the domain.
6. Shared `sleep` mode may run S6 end-to-end and execute the final runtime API verification task.
7. With `ECO_MODE: on`, sleep mode stops after S6 and rewrites the driver for the next domain so the next chat starts clean.
8. With `ECO_MODE: off`, sleep mode may continue to the next domain in the shared registry.

---

## Current State

- The initial S6 queue is now initialized.
- `TASK-601` is complete and preserved in `done/`.
- `TASK-602` is complete and preserved in `done/`.
- `TASK-603` is complete and preserved in `done/`.
- `TASK-604` is complete and preserved in `done/`.
- `TASK-605` is complete and preserved in `done/`.
- `TASK-606` is complete and preserved in `done/`.
- `TASK-607` is complete and preserved in `done/`.
- `TASK-608` is complete and preserved in `done/`.
- `TASK-609` is complete and preserved in `done/`.
- `TASK-610` is complete and preserved in `done/`.
- The S6 queue is complete and ready for shared-driver handoff to `S7`.
- `execution.md` remains the source of truth for the preserved S6 queue history.
