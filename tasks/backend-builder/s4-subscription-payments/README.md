# S4 Domain Workspace

Use this folder as the operating workspace for `S4 - Subscription & Payments`.

---

## Domain Info

- `DOMAIN_CODE:` `S4`
- `DOMAIN_NAME:` `Subscription & Payments`
- `DOMAIN_CONTEXT_FILE:` `context/s4-subscription-payments.md`
- `CURRENT_STATUS:` `complete`
- `AUTO_MODE_DEFAULT:` `domain`
- `CURRENT_ACTIVE_TASK:` `none`

---

## What Lives Here

- `execution.md` -> domain queue, dependency order, and next-task selection
- `decisions.md` -> reusable automatic decisions, assumptions, and flagged follow-ups
- `backlog/` -> future S4 tasks not yet being worked
- `active/` -> the one S4 task currently in execution
- `done/` -> completed S4 tasks with their planning and verification history preserved

---

## Recommended Module Hints

When working on S4, start by checking the most likely related modules:

- `capstone-backend/src/membership`
- `capstone-backend/src/auth`
- `capstone-backend/src/user`
- `capstone-backend/src/common`
- `capstone-backend/src/audit`
- `capstone-backend/src/queue`
- `capstone-backend/prisma`

Trim this list per task so each session stays focused.

---

## Operating Rules

1. Read `agents/guardrails.md`, `agents/architecture.md`, `context/00-global-contracts.md`, and `context/s4-subscription-payments.md` before task work.
2. Read `execution.md` before picking a task.
3. Read `decisions.md` before making assumptions that may affect later S4 tasks.
4. Keep exactly one task in `active/` unless the user explicitly wants parallel task execution.
5. Move completed work to `done/` and update `execution.md` so the next chat can continue without re-planning the domain.

---

## Automation Notes

- `task` mode means one active task runs `review -> plan -> implement -> test`, then stops.
- `domain` mode means the active task runs all four phases, then the next ready unblocked task is promoted and run after it.
- `sleep` mode means the shared driver may finish S4 and run the final runtime API verification step when required.
- with `ECO_MODE: on`, sleep mode stops after S4 and rewrites the driver for the next domain so the next chat starts clean.
- with `ECO_MODE: off`, sleep mode may continue into the next domain in the shared registry.
- Use `domain` mode for the current S4 queue test.
- Use `task` mode when you want to isolate a single risky or unclear S4 task.
- Use `domain` mode only when the queue and dependencies in `execution.md` are accurate and the active tasks are marked auto-eligible.
- Use `sleep` mode with `ECO_MODE: on` when you want one domain per chat and lower context growth.
- Use `sleep` mode with `ECO_MODE: off` when you want the shared driver to continue past S4 automatically and you are relying on the hard stop file plus shared run caps for control.
- Use the decision config in `decisions.md` to auto-resolve low-risk yes/no decisions without bypassing safety gates.

---

## Current State

- `TASK-401` and `TASK-403` are complete and preserved in `done/`.
- `TASK-401`, `TASK-402`, `TASK-403`, `TASK-404`, and `TASK-407` are complete.
- `TASK-405` is complete and preserved in `done/`.
- `TASK-406` is complete and preserved in `done/`.
- `TASK-408` is complete and preserved in `done/`.
- `TASK-409` is complete and preserved in `done/`.
- `TASK-410` is complete and preserved in `done/`.
- The S4 queue is currently complete.
- Remaining queued work lives in `backlog/`.
- `execution.md` is the source of truth for what should happen next.
