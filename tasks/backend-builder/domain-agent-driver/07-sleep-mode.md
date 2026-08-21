# Domain Agent Driver Sleep Mode

Use this file only when `AUTO_MODE = sleep`.

## Sleep Mode Lifecycle

Treat the repo as a cross-domain queue:

1. start from the domain identified by the current `DOMAIN_CODE`
2. if the workspace for that domain does not exist yet, bootstrap it using `tasks/domain-bootstrapper.md` and the registry in `08-domain-registry.md`
3. after bootstrap, continue with a fresh ephemeral worker so the next task starts from a clean chat-memory boundary
4. if the domain has no initialized queue yet, run domain review and planning first to create it
   - start those workers with Serena MCP first
   - when the domain is DB-relevant, use Prisma Local MCP early before broad repo scanning
5. select the current active task, or the next ready task if `active/` is empty
6. run `review -> plan -> implement -> test` for each remaining task in dependency order
7. when a task says `Needs Runtime API Verification: yes`, run `tasks/api-verification-driver.md` automatically before considering the task complete
   - if the runtime-verification precondition is blocked only by checked-in local Prisma guard migrations and `PRISMA_LOCAL_GUARD_MIGRATIONS = auto_apply_checked_in`, use Prisma Local MCP to inspect status and then run `npx.cmd prisma migrate deploy` on the local dev DB before starting the Swagger pass
   - do not use `prisma migrate dev` for this checked-in-only auto-apply path
   - if Prisma Local reports drift, reset, or a non-routine migration requirement, stop and report instead of forcing the DB state forward
   - if the OpenAPI endpoint is unreachable and auto-start is allowed, start the backend inline with `npm.cmd run start`, keep it alive for the Swagger pass, and treat detached startup as opportunistic only
   - if the primary inline start command still does not make the OpenAPI endpoint reachable, stop that process cleanly, capture logs, and retry once with the fallback local command `npm.cmd run start:dev`
   - shell commands are explicitly allowed for backend startup, reachability checks, and cleanup during this pass
   - during unattended runs, print short terminal updates for the primary start command, fallback start command, endpoint polling, and backend cleanup
   - if sandbox or host-process restrictions block the inline live-start path, request escalated execution before leaving a runtime-environment stop reason in the queue
   - if runtime verification reveals a fixable implementation mismatch, route back into the same-domain task workflow, fix it, and retry within `MAX_SELF_HEAL_ATTEMPTS_PER_TASK` instead of leaving the domain permanently blocked on the first runtime failure
8. when `Auto-Eligible = no`, consult `[DOMAIN_FOLDER]/decisions.md`
   - if `AUTO_APPROVE_NON_ELIGIBLE_TASKS: yes` for `sleep`, continue and log the bypass
   - otherwise stop and report that the domain policy blocked the task
9. after each completed task-sized unit, launch the next step in a fresh `codex exec --ephemeral` worker and print the explicit chat-memory refresh message
10. if verification fails, attempt automatic recovery up to `MAX_SELF_HEAL_ATTEMPTS_PER_TASK`
11. if `CAPSTONE_BACKEND_GIT_SYNC = commit_and_push`, sync only the nested `capstone-backend/` git repo at the domain boundary:
   - stage and commit dirty changes there
   - push the current branch to its current upstream
12. after the domain queue is fully complete, rewrite the top session variables in `tasks/domain-agent-driver.md` to the next domain in the shared registry
13. if `ECO_MODE = on`, stop after that rewrite and tell the operator to open a fresh chat with:

```text
Read tasks/domain-agent-driver.md and follow it using the current variables in the file.
```

14. if `ECO_MODE = off` and `DOMAIN_HANDOFF_MODE = rewrite_and_stop_for_new_chat`, stop after that rewrite and tell the operator to open a fresh chat with the same prompt
15. if `ECO_MODE = off` and that next domain workspace does not exist yet, run `tasks/domain-bootstrapper.md` once using the rewritten values
16. if `ECO_MODE = off`, continue directly into that next domain's review, planning, and task loop without waiting for a separate manual handoff
17. stop when:
   - `HARD_STOP_FILE` is detected
   - `MAX_DOMAINS_PER_RUN` is reached
   - `MAX_TASKS_PER_SESSION` is reached
   - an explicit task `Stop If` condition is reached
   - a failure remains after the self-heal budget is exhausted
18. if `TASK_BREAK_MODE = after_task`, stop after the current task finishes and queue updates are done

## Sleep Mode Quick Use

To run sleep mode:

1. set `AUTO_MODE: sleep`
2. set `ECO_MODE`
   - use `on` for one domain per chat
   - use `off` for unattended cross-domain continuation
3. set the starting `DOMAIN_CODE`, `DOMAIN_FOLDER`, and `DOMAIN_CONTEXT_FILE`
4. set:
   - `MAX_DOMAINS_PER_RUN`
   - `MAX_TASKS_PER_SESSION`
   - `MAX_SELF_HEAL_ATTEMPTS_PER_TASK`
   - `HARD_STOP_FILE`
   - `CAPSTONE_BACKEND_GIT_SYNC`
   - `PRISMA_LOCAL_GUARD_MIGRATIONS`
5. make sure `HARD_STOP_FILE` does not exist before starting
6. run:

```text
Read tasks/domain-agent-driver.md and follow it using the current variables in the file.
```

When you rerun that same prompt later, `sleep` mode should first inspect the currently selected domain queue.
If the current domain is already complete, has no active task, and has no remaining ready or backlog work, rewrite the top session variables to the next domain from the shared registry before deciding whether to stop or continue.

Recommended safety default:

- use `CAPSTONE_BACKEND_GIT_SYNC: off` while testing queue behavior
- switch to `CAPSTONE_BACKEND_GIT_SYNC: commit_and_push` only when you want automatic nested-repo sync after a full domain completes

## Hard Stop / Force Stop

Use a safe stop file instead of interrupting the agent mid-step:

1. create the file named by `HARD_STOP_FILE`
   - default: `tasks/SLEEP_MODE_STOP.md`
2. the file may be empty or contain any note you want
3. the agent checks for this file:
   - before promoting the next task
   - before starting runtime API verification
   - before advancing to the next domain
4. when the file is detected, the run stops at the next safe boundary and records `hard_stop_file_detected`
5. to resume later, delete the stop file and rerun the driver

This is a safe stop, not an immediate kill in the middle of a single command, test run, or verification call.
