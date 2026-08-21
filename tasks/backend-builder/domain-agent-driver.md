# Domain Agent Driver

Use this file as the stable entrypoint and session-variable source for domain work.
Edit the variables below before each session, then tell Codex:

```text
Read tasks/domain-agent-driver.md and follow it using the current variables in the file.
```

This file is intentionally thin so normal runs only load the docs needed for the current `AUTO_MODE` and `CURRENT_PHASE`.

---

## Session Variables

Edit these values before starting a chat:

- `DOMAIN_FOLDER:` `tasks/s17-business-analytics`
- `DOMAIN_CODE:` `S17`
- `DOMAIN_NAME:` `Business Analytics`
- `DOMAIN_CONTEXT_FILE:` `context/python/s17-business-analytics.md`
- `AUTO_MODE:` `off`
- `ECO_MODE:` `on`
- `STOP_ON_FAIL:` `yes`
- `MAX_TASKS_PER_SESSION:` `1`
- `MAX_DOMAINS_PER_RUN:` `1`
- `MAX_SELF_HEAL_ATTEMPTS_PER_TASK:` `5`
- `HARD_STOP_FILE:` `tasks/SLEEP_MODE_STOP.md`
- `TASK_BREAK_MODE:` `off`
- `DOMAIN_HANDOFF_MODE:` `rewrite_and_stop_for_new_chat`
- `CAPSTONE_BACKEND_GIT_SYNC:` `off`
- `PRISMA_LOCAL_GUARD_MIGRATIONS:` `auto_apply_checked_in`
- `CURRENT_PHASE:` `review`
- `CURRENT_TASK_FILE:` `none`
- `MODULE_HINTS:`
  - `capstone-backend/src/analytics`
  - `capstone-backend/src/ai`
  - `capstone-backend/src/app.module.ts`
  - `capstone-backend/test`
  - `capstone-backend/prisma`
  - `ai-microservice/app`

---

When `DOMAIN_CONTEXT_FILE` points into `context/python/`, also include `context/python/00-python-microservice-contracts.md` and `context/00-global-contracts.md` alongside the domain file.

---

## Routing Rules

After reading this file, load the shared driver docs in this order:

1. `tasks/domain-agent-driver/03-runtime-core.md`
2. `tasks/domain-agent-driver/04-mcp-policy.md`
3. `tasks/domain-agent-driver/02-variable-reference.md` only when you need allowed values, safety limits, or rewrite rules

Then load the phase and mode docs that apply:

- if `CURRENT_PHASE = review` or `CURRENT_PHASE = plan`, read `tasks/domain-agent-driver/05-phase-review-plan.md`
- if `CURRENT_PHASE = implement` or `CURRENT_PHASE = test`, read `tasks/domain-agent-driver/06-phase-implement-test.md`
- if `AUTO_MODE = sleep`, also read:
  - `tasks/domain-agent-driver/07-sleep-mode.md`
  - `tasks/domain-agent-driver/08-domain-registry.md`

Operator-only reference docs:

- `tasks/domain-agent-driver/01-operator-guide.md`
- `tasks/domain-agent-driver/09-examples.md`

Do not load the operator-only docs during normal task execution unless the current run explicitly needs operator guidance or example values.

---

## Entry Point Contract

- Keep the session-variable bullet syntax stable unless the parsing logic in `tools/get-domain-state.ps1` is updated too.
- Keep the normal operator prompt unchanged as a one-line startup:

```text
Read tasks/domain-agent-driver.md and follow it using the current variables in the file.
```

- Use this entrypoint plus the routed docs above as the shared source of truth for domain automation.
