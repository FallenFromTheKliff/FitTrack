# Domain Agent Driver Runtime Core

Follow the shared rules below using the current variables in `tasks/domain-agent-driver.md`.

## Always Read First

If the selected `DOMAIN_FOLDER` or `[DOMAIN_FOLDER]/execution.md` is missing but the domain is listed in `08-domain-registry.md`, bootstrap that domain workspace first using `tasks/domain-bootstrapper.md`, then continue with a fresh worker before normal domain review or planning.

In every normal task run, read:

1. `agents/guardrails.md`
2. `agents/architecture.md`
3. `context/00-global-contracts.md`
4. the file in `DOMAIN_CONTEXT_FILE`
5. `tasks/domain-agent-driver.md`
6. `[DOMAIN_FOLDER]/README.md`
7. `[DOMAIN_FOLDER]/execution.md`
8. `[DOMAIN_FOLDER]/decisions.md`
9. `CURRENT_TASK_FILE`, if it is set to a real file

Also inspect:

- the modules listed in `MODULE_HINTS`
- relevant Prisma models in `capstone-backend/prisma/schema.prisma`

## Architecture Upkeep Rule

- if the task introduces or confirms a real shared repo convention, the agent may also update `agents/architecture.md`
- use this sparingly and only for patterns that future tasks are likely to reuse
- do not update `agents/architecture.md` for one-off domain details
- when `agents/architecture.md` is updated for a reusable rule, log the reusable decision in `[DOMAIN_FOLDER]/decisions.md`

## Quick Mode Meaning

- `AUTO_MODE: off` = manual phase-by-phase control
- `AUTO_MODE: task` = one active task runs all phases, then stop
- `AUTO_MODE: domain` = one task runs all phases, then the next ready task runs after it until a stop condition is hit
- `AUTO_MODE: sleep` = follow the shared cross-domain queue behavior in `07-sleep-mode.md` and `08-domain-registry.md`

## Task Lifecycle

Recommended flow:

1. create future tasks in `[DOMAIN_FOLDER]/backlog/`
2. move exactly one task into `[DOMAIN_FOLDER]/active/`
3. implement and verify it
4. move it to `[DOMAIN_FOLDER]/done/`
5. repeat

## Auto-Flow Rule

- before continuing automatically, check `[DOMAIN_FOLDER]/execution.md` and the current task file for stop conditions or auto-eligibility limits
- start every normal worker by using Serena MCP first to refresh repo context before broad repo scanning
- if the phase or task is DB-relevant, use Prisma Local MCP early to refresh Prisma schema, migration, or local DB context before relying on raw file scans alone
- if `[DOMAIN_FOLDER]/execution.md` reports `STOP_REASON = pending_local_guard_migrations` and `PRISMA_LOCAL_GUARD_MIGRATIONS = auto_apply_checked_in`, resolve that blocker first in any driver mode by using Prisma Local MCP on `capstone-backend`:
  - inspect migration status
  - apply checked-in pending local migrations with `npx.cmd prisma migrate deploy` when that is the only blocker
  - clear the stop reason and continue the same task flow
  - do not use `prisma migrate dev` for this path
  - stop instead of forcing it if Prisma Local reports drift, reset, or a brand-new migration requirement
- for runtime API verification work, inline live startup is the primary path in this repo:
  - if the OpenAPI endpoint is unreachable and auto-start is allowed, run `npm.cmd run start` inline from `capstone-backend`, keep that process alive during Swagger inspection, and only treat detached startup as opportunistic
  - if the primary inline start command still does not make the OpenAPI endpoint reachable, stop that process cleanly, capture startup logs, and retry once with the fallback local command `npm.cmd run start:dev`
  - print explicit terminal updates for the primary start, fallback start, endpoint reachability, and backend cleanup steps so unattended CLI runs remain auditable
  - shell commands are explicitly allowed for backend startup, reachability checks, and cleanup during runtime verification
  - if sandbox or host-process restrictions prevent the backend from staying reachable, request escalated execution before recording a runtime environment blocker
- before promoting the next task, before starting runtime API verification, and before advancing to the next domain in `sleep` mode, check whether `HARD_STOP_FILE` exists
- if `HARD_STOP_FILE` exists, stop at that safe boundary and record `hard_stop_file_detected`
- if `TASK_BREAK_MODE = after_task`, check it only after the current task is fully processed and the queue state has been updated
- treat `Preferred MCPs` as active routing instructions when those MCPs are available for the current phase; do not reduce them to report-only metadata
- use `prismaLocal` instead of ad hoc shell-only DB guessing when the task depends on local Prisma schema, migration, or data-invariant state
- outside `sleep` mode, if a task is marked not auto-eligible, stop after planning and ask for confirmation before implementation
- in `sleep` mode, a task marked not auto-eligible may continue automatically only when `[DOMAIN_FOLDER]/decisions.md` says `AUTO_APPROVE_NON_ELIGIBLE_TASKS: yes` for `sleep`; log each bypass in the domain decision file
- if `[DOMAIN_FOLDER]/decisions.md` enables yes or no auto-accept, resolve low-risk binary decisions by choosing the recommended or safest default
- do not let yes or no auto-accept bypass task safety gates, blockers, failed verification, or high-impact decisions
- if verification or runtime API checks fail in `sleep` mode, attempt bounded recovery up to `MAX_SELF_HEAL_ATTEMPTS_PER_TASK`, then stop as unrecoverable if still not green
- if runtime API verification finds a fixable implementation mismatch in `AUTO_MODE = task`, `AUTO_MODE = domain`, or `AUTO_MODE = sleep`, route back into the same-domain task workflow, fix it, and retry within `MAX_SELF_HEAL_ATTEMPTS_PER_TASK` instead of leaving the domain permanently blocked on the first failure
- if `AUTO_MODE = off`, report runtime API verification findings and stop instead of auto-fixing or auto-retrying
- if `PRISMA_LOCAL_GUARD_MIGRATIONS = auto_apply_checked_in` and a runtime-verification precondition is blocked only by checked-in local Prisma migrations, use Prisma Local MCP to inspect status and then apply those pending local migrations with `npx.cmd prisma migrate deploy` before stopping
- if `CAPSTONE_BACKEND_GIT_SYNC = commit_and_push`, the wrapper may sync the nested `capstone-backend/` repo at a domain boundary; this is wrapper-managed automation, not normal agent git work
- after one task-sized unit completes, the loop runner launches the next step in a fresh `codex exec --ephemeral` worker and prints an explicit chat-memory refresh message for the operator

## Phase Logic

### If `AUTO_MODE = off`

Run only the phase named in `CURRENT_PHASE`.

### If `AUTO_MODE = task`

Treat the current task as a mini pipeline:

1. review
2. plan
3. implement
4. test
5. stop and report results

### If `AUTO_MODE = domain`

Treat the domain as a queue:

1. select the current active task, or the next ready task if `active/` is empty
2. run `review -> plan -> implement -> test`
3. if verification passes, mark that task complete
4. promote the next ready unblocked task
5. read `[DOMAIN_FOLDER]/decisions.md` before stopping for a routine yes or no decision
6. repeat until a stop condition is hit

### If `AUTO_MODE = sleep`

Follow `07-sleep-mode.md` and `08-domain-registry.md` in addition to this core file.

## Stop Conditions

Stop and report instead of continuing automatically when:

- API contract shape needs a product decision
- schema or migration direction needs approval
- auth, role, or security behavior is ambiguous
- payment-provider behavior is unclear
- external packages or providers would need approval
- verification fails and the root cause is not obvious
- the current task file says it is not auto-eligible and the current domain policy does not auto-approve non-eligible tasks for `sleep`
- the current task file explicitly lists a stop condition that was reached
- the current task would broaden into another domain
- `HARD_STOP_FILE` is detected at a safe boundary
- `MAX_DOMAINS_PER_RUN` or `MAX_TASKS_PER_SESSION` is reached in `sleep` mode
- a `sleep`-mode recovery attempt budget is exhausted

Safe low-risk decisions may continue automatically, but log them in `[DOMAIN_FOLDER]/decisions.md` when they are reusable or likely to matter later.

When `[DOMAIN_FOLDER]/decisions.md` enables yes or no auto-accept:

- auto-resolve only routine binary decisions
- choose the recommended or safest default path
- ask the user for non-binary decisions
- stop for high-impact decisions even if the answer could be yes or no
