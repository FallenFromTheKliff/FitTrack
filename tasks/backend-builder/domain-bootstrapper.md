# Domain Bootstrapper

Use this file to create and initialize a new domain workspace under `tasks/` without manually editing `tasks/domain-agent-driver.md`.

The loop runner may also invoke this contract automatically when `tasks/domain-agent-driver.md` already points at a registered domain whose workspace or `execution.md` file is still missing.

Tell Codex:

```text
Read tasks/domain-bootstrapper.md and follow it using the current variables in the file.
```

---

## Session Variables

Edit these values before starting the bootstrap chat:

- `DOMAIN_FOLDER:` `tasks/s5-facility-bookings`
- `DOMAIN_CODE:` `S5`
- `DOMAIN_NAME:` `Facility Bookings`
- `DOMAIN_CONTEXT_FILE:` `context/s5-facility-bookings.md`
- `AUTO_MODE:` `off`
- `STOP_ON_FAIL:` `yes`
- `MAX_TASKS_PER_SESSION:` `1`
- `MODULE_HINTS:`
  - `capstone-backend/src/membership`
  - `capstone-backend/src/user`
  - `capstone-backend/prisma`

### Variable Rules

- `DOMAIN_FOLDER` must be a new domain workspace path under `tasks/`
- `DOMAIN_CODE` should match the context naming convention, for example `S5`
- `DOMAIN_NAME` should match the human-readable domain title
- `DOMAIN_CONTEXT_FILE` must point to the domain context markdown
- `AUTO_MODE`, `STOP_ON_FAIL`, and `MAX_TASKS_PER_SESSION` may be overridden, but the recommended bootstrap defaults are:
  - `AUTO_MODE: off`
  - `STOP_ON_FAIL: yes`
  - `MAX_TASKS_PER_SESSION: 1`
- `CURRENT_PHASE` and `CURRENT_TASK_FILE` are not inputs here; the bootstrapper must always reset them to:
  - `CURRENT_PHASE: review`
  - `CURRENT_TASK_FILE: none`

---

## Purpose

This bootstrapper does setup only.

It must:

1. create a new domain workspace using `tasks/s4-subscription-payments/` as the structural reference
2. update `tasks/domain-agent-driver.md` to point to the new domain
3. seed starter docs for the new domain workspace, including MCP-aware workflow defaults
4. seed the expectation that HTTP-facing domains usually end with a separate runtime API verification task
5. stop

It must not:

- create backlog task files
- move anything into `active/`
- run domain review
- run domain planning
- implement application code

Task generation remains the job of the normal `review` and `plan` phases after bootstrap.

The global task template remains `tasks/task-template.md`. Do not duplicate it per domain.

---

## Required Output

Create or reset these paths inside `DOMAIN_FOLDER`:

```text
[DOMAIN_FOLDER]/
|- README.md
|- execution.md
|- decisions.md
|- backlog/
|  `- .gitkeep
|- active/
|  `- .gitkeep
`- done/
   `- .gitkeep
```

Then update `tasks/domain-agent-driver.md` so the session variables at the top point to the new domain.

---

## Bootstrap Rules

### 1. Use S4 As the Template

Use `tasks/s4-subscription-payments/` as the reference for:

- folder structure
- `README.md` shape
- `execution.md` state fields and queue section
- `decisions.md` decision-config section

Do not copy S4 history, completed tasks, queue rows, or domain-specific notes.

The new domain must start clean.

If `DOMAIN_CONTEXT_FILE` is under `context/python/`, treat `context/python/00-python-microservice-contracts.md` as a required shared companion context in addition to `context/00-global-contracts.md`.

### 2. Update the Shared Driver

Rewrite the session variables in `tasks/domain-agent-driver.md` so they become:

- `DOMAIN_FOLDER:` the configured `DOMAIN_FOLDER`
- `DOMAIN_CODE:` the configured `DOMAIN_CODE`
- `DOMAIN_NAME:` the configured `DOMAIN_NAME`
- `DOMAIN_CONTEXT_FILE:` the configured `DOMAIN_CONTEXT_FILE`
- `AUTO_MODE:` the configured `AUTO_MODE`
- `STOP_ON_FAIL:` the configured `STOP_ON_FAIL`
- `MAX_TASKS_PER_SESSION:` the configured `MAX_TASKS_PER_SESSION`
- `CAPSTONE_BACKEND_GIT_SYNC:` `off`
- `PRISMA_LOCAL_GUARD_MIGRATIONS:` `auto_apply_checked_in`
- `CURRENT_PHASE:` `review`
- `CURRENT_TASK_FILE:` `none`
- `MODULE_HINTS:` the configured module hints

Do not change the rest of the driver instructions unless the current driver format has drifted and the new domain would break without matching that format.

Preserve the thin router in `tasks/domain-agent-driver.md` and keep the shared modular docs under `tasks/domain-agent-driver/` intact.

### 3. Seed README.md

Create `README.md` with starter metadata for the new domain.

It must include:

- title: `[DOMAIN_CODE] Domain Workspace`
- domain info block:
  - `DOMAIN_CODE`
  - `DOMAIN_NAME`
  - `DOMAIN_CONTEXT_FILE`
  - `CURRENT_STATUS: in_progress`
  - `AUTO_MODE_DEFAULT: task`
  - `CURRENT_ACTIVE_TASK: none`
- a short explanation of what lives in:
  - `execution.md`
  - `decisions.md`
  - `backlog/`
  - `active/`
  - `done/`
- an MCP defaults section that says:
  - Serena is the default repo-navigation MCP
- Prisma MCP is used for DB-backed review, planning, implementation, and verification
- Prisma Remote MCP is optional for remote Prisma workspace context and should not block local loop work by default
- Context7 is optional for current framework and package guidance
- GitHub MCP is optional for GitHub repo, issue, PR, or workflow context that is outside the local workspace
- Notion MCP is optional when the task explicitly needs Notion workspace context
- Swagger MCP is reserved for the separate API verification driver after code checks pass and the backend is running
- task files should treat `Preferred MCPs` as active routing hints, not report-only metadata
- `agents/architecture.md` is authoritative by default, and proven reusable patterns may update it explicitly
- recommended module hints section using the provided hints
- operating rules that match the S4 workspace style
- for Python microservice domains, operating rules must explicitly require `context/python/00-python-microservice-contracts.md` alongside `context/00-global-contracts.md` and the selected domain file
- a short note that shared sleep mode may either stop after this domain in eco mode or continue to the next domain when eco mode is off
- a current-state section that says:
  - the queue has not been initialized yet
  - review should run next
  - `execution.md` is the source of truth once planning begins

### 4. Seed execution.md

Create `execution.md` with a clean queue state.

It must include:

- title: `[DOMAIN_CODE] Execution Queue`
- an execution-state section with:
  - `AUTO_MODE:` the configured `AUTO_MODE`
  - `CURRENT_PHASE:` `review`
  - `CURRENT_TASK:` `none`
  - `NEXT_READY_TASK:` `none`
  - `LAST_COMPLETED_TASK:` `none`
  - `STOP_REASON:` `none`
  - `MAX_TASKS_PER_SESSION:` the configured limit
- selection rules copied from the S4 style, but phrased generically
- an empty queue section placeholder that clearly says backlog tasks will be generated during review/plan
- completion rules section
- auto-run rules section aligned to the current driver semantics
- a runtime verification note that says Swagger MCP is not part of the normal task queue, that HTTP-facing domains should usually reserve their final task for runtime API verification, and that `tasks/api-verification-driver.md` may start the backend automatically once build, tests, and `npm.cmd run lint:check` pass
- sleep-mode-aware queue notes that say `ECO_MODE: on` stops after one completed domain, `ECO_MODE: off` may continue into the next domain, the shared driver may bypass non-eligible task pauses when the domain decision policy allows it, and it must honor the shared hard stop file at safe boundaries

Do not invent starter task rows.

### 5. Seed decisions.md

Create `decisions.md` with:

- title: `[DOMAIN_CODE] Decision Log`
- a decision-config section
- a non-eligible task policy section
- a non-eligible task log section
- the same generic decision-entry format used in S4
- no domain-specific decisions yet

Use these default decision config values:

- `AUTO_ACCEPT_YES_NO_DECISIONS:` `no`
- `AUTO_DECISION_PICK:` `recommended`
- `ASK_ONLY_FOR:` `non-binary or high-impact decisions`

This keeps new domains conservative by default.

Seed the non-eligible task policy with:

- `AUTO_APPROVE_NON_ELIGIBLE_TASKS:` `yes`
- `ACTIVE_IN_MODES:` `sleep`
- `STILL_STOP_FOR:` `explicit Stop If | hard stop file | unrecoverable verification failure`

Behavior notes for the seeded `decisions.md`:

- normal manual, task, and domain modes still respect `Auto-Eligible = no`
- `sleep` mode may bypass `Auto-Eligible = no` only because of the explicit non-eligible policy above
- the non-eligible policy must never override an explicit task `Stop If`, the shared hard stop file, or an unrecoverable failure

### 6. Seed Folder Placeholders

Create:

- `[DOMAIN_FOLDER]/backlog/.gitkeep`
- `[DOMAIN_FOLDER]/active/.gitkeep`
- `[DOMAIN_FOLDER]/done/.gitkeep`

### 7. Stop After Bootstrap

After creating the workspace and updating the driver:

- do not create task files
- do not start review
- do not plan the backlog
- do not move files between `backlog/`, `active/`, and `done/`

Instead, stop and tell the operator to run:

```text
Read tasks/domain-agent-driver.md and follow it using the current variables in the file.
```

---

## Verification Checklist

Before stopping, verify:

- `DOMAIN_FOLDER` exists with `README.md`, `execution.md`, `decisions.md`, `backlog/`, `active/`, and `done/`
- `tasks/domain-agent-driver.md` points to the new domain
- the thin driver entrypoint still routes to the shared modular docs under `tasks/domain-agent-driver/`
- `CAPSTONE_BACKEND_GIT_SYNC` is still present and set to a safe default
- `PRISMA_LOCAL_GUARD_MIGRATIONS` is still present and set to the shared default
- `CURRENT_PHASE` is `review`
- `CURRENT_TASK_FILE` is `none`
- no backlog task files were created
- the seeded execution state is clean and review-ready
- the seeded docs include MCP defaults, the separate runtime API verification note, and the non-eligible task policy sections
- the seeded docs mirror the S4 structure without copying S4 task history
- Python microservice domains explicitly include `context/python/00-python-microservice-contracts.md` in their operating rules

--- 

## Example: S5 Bootstrap

Example values:

- `DOMAIN_FOLDER:` `tasks/s5-facility-bookings`
- `DOMAIN_CODE:` `S5`
- `DOMAIN_NAME:` `Facility Bookings`
- `DOMAIN_CONTEXT_FILE:` `context/s5-facility-bookings.md`
- `AUTO_MODE:` `off`
- `STOP_ON_FAIL:` `yes`
- `MAX_TASKS_PER_SESSION:` `1`
- `MODULE_HINTS:`
  - `capstone-backend/src/membership`
  - `capstone-backend/src/user`
  - `capstone-backend/src/auth`
  - `capstone-backend/prisma`

Expected outcome:

1. `tasks/s5-facility-bookings/` exists with seeded workspace docs
2. `tasks/domain-agent-driver.md` points to S5
3. the next chat can immediately run the normal S5 review flow

---

## Operator Notes

- This file bootstraps the domain workspace only
- Use it when switching to a new domain
- After bootstrap, use `tasks/domain-agent-driver.md` for all normal review, planning, implementation, and testing work
- Keep one domain workspace per business domain so history stays isolated and resumable
