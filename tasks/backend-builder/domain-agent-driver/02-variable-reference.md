# Domain Agent Driver Variable Reference

Use this file when you need the allowed values, safety limits, or rewrite rules for the session variables in `tasks/domain-agent-driver.md`.

## Allowed `CURRENT_PHASE` Values

- `review` -> scan design vs implementation, report only
- `plan` -> produce a task plan or break the domain into tasks
- `implement` -> implement one active task
- `test` -> verify one active task

## Allowed `AUTO_MODE` Values

- `off` -> run only the phase named in `CURRENT_PHASE`
- `task` -> for the current active task, run `review -> plan -> implement -> test`, then stop
- `domain` -> run the current task end-to-end, then promote and continue with the next ready unblocked task
- `sleep` -> finish the current domain end-to-end, including runtime API verification, then either stop for a fresh chat in `ECO_MODE: on` or continue to later domains in `ECO_MODE: off`

## Allowed `ECO_MODE` Values

- `on` -> only meaningful in `AUTO_MODE = sleep`; finish exactly one domain per chat, rewrite the driver to the next domain, then stop for a fresh chat
- `off` -> only meaningful in `AUTO_MODE = sleep`; allow normal cross-domain sleep behavior, subject to the shared caps and handoff settings

## Allowed `TASK_BREAK_MODE` Values

- `off` -> no extra task-boundary break; the loop continues according to normal `AUTO_MODE`, `ECO_MODE`, and stop rules
- `after_task` -> after the current task finishes and queue state is updated, stop before launching the next fresh worker

## `STOP_ON_FAIL` Rules

- `yes` -> stop immediately on failed verification or a blocker
- `no` -> continue only when the failure is clearly non-blocking and explicitly documented
- in `sleep` mode, `STOP_ON_FAIL: yes` still allows bounded self-heal retries up to `MAX_SELF_HEAL_ATTEMPTS_PER_TASK` before the run stops as unrecoverable

## `MAX_TASKS_PER_SESSION` Rules

- use `1` by default for new or risky domains
- raise to `2` or `3` only when the queue is stable and task boundaries are already clean
- for `AUTO_MODE = sleep`, this becomes a global cross-domain safety cap for one run; use a larger value only when you are comfortable with the token budget

## `MAX_DOMAINS_PER_RUN` Rules

- used only when `AUTO_MODE = sleep`
- caps how many domains may be fully completed in one run
- when `ECO_MODE = on`, treat this as effectively `1` even if a larger value is written above
- use `1` by default to keep token usage predictable

## `MAX_SELF_HEAL_ATTEMPTS_PER_TASK` Rules

- used only when `AUTO_MODE = sleep`
- counts automatic recovery attempts after failed verification or runtime API mismatches
- use `2` by default so the agent can fix one real issue and retry once more if needed

## `HARD_STOP_FILE` Rules

- used only when `AUTO_MODE = sleep`
- if this file exists, stop at the next safe boundary instead of promoting the next task or next domain
- the default path is `tasks/SLEEP_MODE_STOP.md`

## `TASK_BREAK_MODE` Rules

- intended for Codex CLI and fresh-worker automation
- used only when `AUTO_MODE = sleep`
- checked only after a task completes, or after a task-level unrecoverable failure boundary
- do not interrupt an active task, test run, build, or runtime verification step just because this is enabled
- when `AUTO_MODE != sleep`, ignore `TASK_BREAK_MODE`

## `ECO_MODE` Rules

- used only when `AUTO_MODE = sleep`
- `on` is the low-drift, lower-context-growth option for one-domain-per-chat execution
- `off` keeps the existing unattended cross-domain sleep behavior
- when `ECO_MODE = on`, it overrides `DOMAIN_HANDOFF_MODE` and forces a stop at the next domain boundary after rewriting the driver to the next domain
- when `AUTO_MODE != sleep`, ignore `ECO_MODE`

## `DOMAIN_HANDOFF_MODE` Rules

- used only when `AUTO_MODE = sleep` and a domain boundary is reached
- `continue_in_same_chat` -> rewrite the variables to the next domain and keep running in the current chat
- `rewrite_and_stop_for_new_chat` -> rewrite the variables to the next domain, then stop and tell the operator to open a fresh chat with the same prompt
- this driver cannot physically create a new top-level chat in the UI; `rewrite_and_stop_for_new_chat` is the closest supported behavior
- `ECO_MODE = on` takes precedence over this setting

## `CAPSTONE_BACKEND_GIT_SYNC` Rules

- allowed values:
  - `off` -> do not run any post-domain git sync
  - `commit_and_push` -> at domain completion, sync only the nested `capstone-backend/` git repo
- this setting is intended for the loop runner, not normal in-agent git work
- when enabled, the wrapper stages and commits dirty changes inside `capstone-backend/`, then pushes the current branch to its current upstream
- this setting never commits or pushes the workspace-root repo; it only targets `capstone-backend/`
- if the nested repo has no upstream branch configured, or the push fails, stop and report the failure
- keep this `off` while testing prompts, dry runs, or queue logic

## `PRISMA_LOCAL_GUARD_MIGRATIONS` Rules

- allowed values:
  - `manual` -> report pending checked-in local Prisma guard migrations and stop at the task boundary
  - `auto_apply_checked_in` -> for local dev DB work, use Prisma Local MCP to inspect status and then run `npx.cmd prisma migrate deploy` to apply only already checked-in pending migrations before runtime verification when that is the only blocker
- use this only for local checked-in migrations that already exist under `capstone-backend/prisma/migrations/`
- do not use `prisma migrate dev` for this auto-apply path; in this repo it can generate an unwanted migration that drops raw-SQL partial indexes which are intentionally kept outside Prisma schema syntax
- if Prisma Local reports schema drift, requests `migrate reset`, or if `migrate deploy` fails for a non-routine reason, stop and report instead of auto-applying
- this is intended for unattended CLI `sleep` mode and runtime-verification preconditions, not for broad schema redesign decisions
- `auto_apply_checked_in` is the recommended default when your local sleep-mode loop should keep moving through checked-in migration guards automatically

## `DOMAIN_FOLDER` Rules

- point this to the domain workspace under `tasks/`
- each domain folder should contain:
  - `README.md`
  - `execution.md`
  - `decisions.md`
  - `backlog/`
  - `active/`
  - `done/`
- keep one domain per folder so chats stay isolated and resumable

## `CURRENT_TASK_FILE` Rules

- use `none` for domain review or domain-level planning
- use a real task path for task work, for example:
  - `tasks/s4-subscription-payments/active/TASK-404-payments-core-manual-flow.md`

## `MODULE_HINTS` Rules

- list the most likely related modules
- if the domain module does not exist yet, include nearby or shared modules that currently contain related behavior
- keep this short and practical
