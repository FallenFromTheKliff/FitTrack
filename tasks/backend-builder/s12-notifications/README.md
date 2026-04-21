# S12 Domain Workspace

Use this folder as the operating workspace for `S12 - Notifications`.

---

## Domain Info

- `DOMAIN_CODE:` `S12`
- `DOMAIN_NAME:` `Notifications`
- `DOMAIN_CONTEXT_FILE:` `context/s12-notifications.md`
- `CURRENT_STATUS:` `complete`
- `AUTO_MODE_DEFAULT:` `task`
- `CURRENT_ACTIVE_TASK:` `none`

---

## What Lives Here

- `execution.md` -> domain queue, dependency order, and next-task selection once planning begins
- `decisions.md` -> reusable automatic decisions, assumptions, and flagged follow-ups
- `backlog/` -> future S12 tasks not yet being worked
- `active/` -> the one S12 task currently in execution
- `done/` -> completed S12 tasks with their planning and verification history preserved

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

When working on S12, start by checking the most likely related modules:

- `capstone-backend/src/user`
- `capstone-backend/src/queue`
- `capstone-backend/src/mail`
- `capstone-backend/src/membership`
- `capstone-backend/src/bookings`
- `capstone-backend/src/coaching`
- `capstone-backend/src/fitness`
- `capstone-backend/src/inventory`
- `capstone-backend/src/ai`
- `capstone-backend/prisma`

Trim this list per task so each session stays focused.

---

## Operating Rules

1. Read `agents/guardrails.md`, `agents/architecture.md`, `context/00-global-contracts.md`, and `context/s12-notifications.md` before task work.
2. Read `execution.md` before picking a task.
3. Read `decisions.md` before making assumptions that may affect later S12 tasks.
4. Keep exactly one task in `active/` unless the user explicitly wants parallel task execution.
5. Move completed work to `done/` and update `execution.md` so the next chat can continue without re-planning the domain.

---

## Automation Notes

- `task` mode means one active task runs `review -> plan -> implement -> test`, then stops.
- `domain` mode means the active task runs all four phases, then the next ready unblocked task is promoted and run after it.
- `sleep` mode means the shared driver may finish S12 and run the final runtime API verification step when required.
- With `ECO_MODE: on`, sleep mode stops after S12 and rewrites the driver for the next domain so the next chat starts clean.
- With `ECO_MODE: off`, sleep mode may continue into the next domain in the shared registry.
- Use `task` mode when you want to isolate a single risky or unclear S12 task.
- Use `domain` mode only when the queue and dependencies in `execution.md` are accurate and the active tasks are marked auto-eligible.
- Use `sleep` mode when you want the shared driver to handle cross-domain handoff rules and the hard stop file at safe boundaries.
- Use the decision config in `decisions.md` to auto-resolve low-risk yes/no decisions without bypassing safety gates.

---

## Current State

- Domain review and the first implementation slice are complete.
- `TASK-1201` is done and introduced the dedicated notifications inbox module plus focused build/test/lint coverage.
- `TASK-1202` is done and added the shared dispatch core plus persisted delivery feedback.
- `TASK-1203` is done and moved notification preference ownership into `src/notifications` while expanding the persisted preference matrix.
- `TASK-1204` is done and centralizes the subscription, booking, and coaching lifecycle fan-out behind the S12 dispatcher.
- `TASK-1205` is done and centralizes the remaining gamification, inventory, auth, AI, nutrition-adjacent, and payment-failure notification seams.
- `TASK-1206` is done and adds the final S12 notifications e2e coverage plus stricter boolean DTO validation for the notifications HTTP surface.
- All planned S12 tasks are complete.
- The S12 notifications surface has passed code checks, focused e2e coverage, and live runtime verification.
- `execution.md` is the source of truth once planning begins.
