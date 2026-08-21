# Domain Agent Driver Implement And Test Phases

Use this file only when `CURRENT_PHASE = implement` or `CURRENT_PHASE = test`.

## If `CURRENT_PHASE = implement`

Rules:

- `CURRENT_TASK_FILE` must point to one real file in `[DOMAIN_FOLDER]/active/`
- if it is `none`, stop and ask for the active task file

Do this:

1. start with Serena MCP to refresh repo context for the active task before broader scanning
2. if the task is DB-relevant, use Prisma Local MCP early to confirm schema, migration, or invariant context
3. read the active task file
4. implement only that task
5. follow repository, DTO, validator, and architecture conventions already in the repo
6. update or add tests that belong to the task
7. keep unrelated fixes out unless they are direct blockers

Recommended checks after implementation:

- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`

If the task is small, run the relevant subset and say what was run.

## If `CURRENT_PHASE = test`

Rules:

- `CURRENT_TASK_FILE` must point to one real file in `[DOMAIN_FOLDER]/active/`
- if it is `none`, stop and ask for the active task file

Do this:

1. start with Serena MCP to refresh repo context for the active task before broader scanning
2. if the task is DB-relevant, use Prisma Local MCP early to confirm schema, migration, or invariant context
3. read the active task file
4. inspect changed services, repositories, DTOs, validators, and specs
5. add missing tests if the task explicitly includes test completion
6. otherwise verify existing tests and report failures clearly

Recommended commands:

- `npm.cmd run build`
- `npm.cmd test -- --runInBand`
- `npm.cmd run test:e2e -- --runInBand`
- `npm.cmd run lint:check`

For runtime-verification tasks that depend on local Prisma migration state:

- if `PRISMA_LOCAL_GUARD_MIGRATIONS = auto_apply_checked_in` and the only blocker is unapplied checked-in local migrations, use Prisma Local MCP to check status and then run `npx.cmd prisma migrate deploy` before handing off to `tasks/api-verification-driver.md`
- do not use `prisma migrate dev` for this checked-in-only auto-apply path
- if Prisma Local reports drift, reset requirements, or a need for a brand-new migration beyond applying checked-in files, stop and report that blocker instead of forcing the DB state forward

If the current task file says `Needs Runtime API Verification: yes`, stop after the code checks above and run the separate Swagger flow from `tasks/api-verification-driver.md` instead of using Swagger in this phase.

For runtime verification handoff in this repo:

- treat inline `npm.cmd run start` as the primary live-start path when the OpenAPI endpoint is unreachable and auto-start is allowed
- if the primary inline start command still does not make the OpenAPI endpoint reachable, stop that process cleanly, capture logs, and retry once with the fallback local command `npm.cmd run start:dev`
- do not treat detached startup failure as the blocker if inline startup or the fallback inline startup can keep the backend alive for the Swagger pass
- shell commands are explicitly allowed for backend startup, reachability checks, and cleanup during the handoff
- during unattended runs, print short terminal updates for the primary start command, fallback start command, endpoint polling, and backend cleanup
- if sandbox or host-process restrictions block that live-start path, request escalated execution before leaving a runtime environment blocker in the queue
- in `AUTO_MODE = task`, `AUTO_MODE = domain`, or `AUTO_MODE = sleep`, if runtime verification finds a fixable implementation mismatch, route back into the same-domain task flow and retry within `MAX_SELF_HEAL_ATTEMPTS_PER_TASK`
- in `AUTO_MODE = off`, report the runtime findings and stop instead of auto-fixing or auto-retrying

For HTTP-facing domains, prefer making runtime API verification the last queue task after the normal implementation tasks are complete.
In `sleep` mode, run that Swagger pass automatically before the task and the domain are considered complete.
