# Domain Agent Driver Operator Guide

Use this file for operator workflow reference.
It is not part of the normal task-run context unless the current run explicitly needs it.

## Codex CLI

Use exactly one of the commands below for a given run.
Do not chain them together in one line.

### Option A: Manual One-Shot Codex Run

Use this when you want to launch one Codex session yourself and then decide manually what to do next.

Run once:

```powershell
.\tools\codex.cmd exec --ephemeral --skip-git-repo-check --sandbox workspace-write -m gpt-5.4 -c model_reasoning_effort=high -C . "Read tasks/domain-agent-driver.md and follow it using the current variables in the file."
```

What it does:

- starts one fresh Codex worker
- follows the current driver variables one time
- exits when that Codex session finishes

Use this for:

- manual control
- testing one run
- resuming work step by step
- debugging a task or queue issue

### Option B: Fresh-Per-Task Loop Runner

Use this when you want the wrapper to keep launching fresh Codex workers for you.

Run once:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run-domain-loop.ps1
```

What it does:

- starts the wrapper, not Codex directly
- the wrapper launches `codex exec --ephemeral` internally
- each worker handles one task-sized unit, then exits
- the wrapper reads the driver and queue files and decides whether to launch the next fresh worker
- the terminal prints short live worker updates while the task is running
- the wrapper now sanitizes the Codex launch environment for each preflight and main worker by clearing the inherited VS Code extension session vars and pinning `CODEX_HOME` to `C:\Users\HOUSTON\.codex`
- before each main worker, the wrapper now launches a short required-MCP preflight worker to prove Serena and any required Prisma Local access for that task boundary
- if a preflight or worker dies before any real MCP or shell work starts, the wrapper now retries once through an inline fallback launch instead of treating that as a deterministic Serena or Prisma configuration failure
- if the selected domain workspace is registered but missing, the wrapper now auto-bootstraps it before normal review or planning
- when an MCP is actually invoked, the terminal now prints an explicit status line such as `MCP serena: fetching repo context` or `MCP prismaLocal: applying checked-in local migrations`
- before each worker launch, the wrapper also prints the expected context refresh lines for required MCPs such as `MCP serena: refreshing repo context for this worker`
- after the preflight finishes, the terminal prints `Required MCP preflight complete: ...`
- after the main worker finishes, the terminal prints `Required MCP worker observed: ...`
- generic `codex` MCP resource-listing calls do not count toward Serena or Prisma Local compliance; the loop only counts qualifying real `serena` and `prismaLocal` tool calls
- after each worker exits, the terminal prints a short task summary and token usage
- when a task boundary or bootstrap boundary is reached, the wrapper prints an explicit chat-memory refresh message to confirm the next step will run in a fresh `codex exec --ephemeral` worker
- full raw logs are kept under `tasks/tmp/cli-loop/`

Use this for:

- unattended or semi-attended sleep-mode continuation
- fresh context per task without manually re-running Codex each time
- normal long queue execution with the driver as the source of truth
- a cleaner chat-like operator view than the raw one-shot CLI output

Important:

- do not run the manual one-shot command after starting the loop runner
- do not chain both commands in one line
- if you start the loop runner, let it manage the Codex workers for that run
- if `CAPSTONE_BACKEND_GIT_SYNC = commit_and_push`, the loop runner handles Git sync for the nested `capstone-backend/` repo at domain completion; the Codex worker still should not run ad hoc git commands during normal task work

## Stop Behavior

- `Ctrl+C` = immediate stop
- `tasks/SLEEP_MODE_STOP.md` = safe stop at the next boundary
- `TASK_BREAK_MODE: after_task` = stop after the current task finishes and the queue is updated
- `cls` or `Clear-Host` only clears terminal output; it does not reset Codex context
- when `ClearScreenBetweenRuns` is enabled, the loop runner clears the terminal between fresh workers and again after a domain-boundary stop so the next sleep-mode CLI launch starts from a clean screen
- Codex prints the active model and reasoning effort in the startup banner, and `tokens used` at the end of each run
- a cold fresh worker normally takes about 15 to 60 seconds before real task work begins
- the loop runner filters noisy stack traces out of the terminal by default and keeps them in the per-run stderr log instead

## How To Read Startup Output

- `serena ready` and `prismaLocal ready` mean the local loop is healthy
- `required_expected=[serena, prismaLocal]` means those MCPs are required for the current worker based on the phase and task, not merely that they were observed already
- `Preflight startup summary: ...` is the short startup report for the wrapper-managed required-MCP preflight
- `Required MCP preflight complete on attempt 2 via inline fallback launch: ...` means the first launch looked flaky and the wrapper recovered on the retry without dropping the task boundary
- `Required MCP worker observed: ...` shows which qualifying required MCP calls happened inside the main task worker itself
- `Codex launch: kind=preflight method=start_process ... sanitized_env=yes` or `Codex launch: kind=worker method=inline ... sanitized_env=yes` confirms both the cleaned environment and which launch path the wrapper used
- `prismaRemote failed` usually means remote Prisma auth is missing; local work may still continue
- `github failed` usually means `GITHUB_PAT_TOKEN` is not set or invalid; local work may still continue unless the task explicitly needs GitHub MCP
- `notion failed` usually means Notion login or workspace authorization is missing; local work may still continue unless the task explicitly needs Notion MCP
- the loop runner's live status lines come from Codex JSON events, while the manual one-shot command still shows the native raw Codex output
- `Chat memory refreshed: next task will run in a fresh ephemeral worker.` means the wrapper is about to launch a brand-new `codex exec --ephemeral` process for the next step
- `Chat memory refresh boundary reached: the next CLI run will start from a fresh ephemeral worker.` means the wrapper stopped at a safe boundary and the next launch will start clean
- if the loop stops with `required_mcp_preflight_failed:serena` or `required_mcp_preflight_failed:prismaLocal`, check the printed preflight events-log and preflight stderr-log paths first
- if the loop says the preflight failed before any qualifying MCP tool surface appeared, treat that as a Codex launch-context problem first, not a normal task-level MCP-usage miss
- if the wrapper prints both preflight attempt 1 and attempt 2 log paths, compare those first before assuming Serena or Prisma Local are misconfigured
- if the loop stops with `required_mcp_usage_missing:serena` or `required_mcp_usage_missing:prismaLocal`, check both the printed preflight events-log path and the main worker events-log path to confirm whether a real qualifying MCP tool call was observed

## Chat Hygiene

Use fresh chats to reduce drift:

- always use a new chat when switching to a different domain
- usually use a new chat for each medium or large task
- if a chat gets long or starts to drift, start a new one and point it back to the driver and the task file

Recommended default:

- one domain review chat
- one planning chat
- one implementation chat per medium task
- one testing chat per medium task
- for one domain per chat with automatic next-domain handoff, use `AUTO_MODE: sleep` with `ECO_MODE: on`
- for unattended cross-domain continuation, use `AUTO_MODE: sleep` with `ECO_MODE: off`

Do not batch multiple unrelated domains into one long chat.

## Recommended Domain Strategy

Use one domain at a time.

Good order for this project:

1. `S4` Subscription & Payments
2. `S5` Facility Bookings
3. `S6` Coaching
4. `S7` Fitness Training
5. `S8` Gamification
6. `S9` TDEE & Nutrition
7. `S10` Inventory
8. `S11` AI Chatbot
9. `S12` Notifications
10. `S13` Gym Layout & Analytics
11. `S14` Auditing refinement

Why:

- `S4` unlocks behavior used by attendance, bookings, and payments
- later domains depend on the earlier business flows

## Operator Notes

- keep `tasks/domain-agent-driver.md` generic
- only change the variables at the top for each session
- keep `CAPSTONE_BACKEND_GIT_SYNC: off` during dry runs or prompt testing, and switch it to `commit_and_push` only when you want the wrapper to sync the nested `capstone-backend/` repo at domain completion
- use `tasks/task-template.md` to create real task files inside the chosen domain folder
- prefer many small task files over one giant domain task
- use one domain folder at a time to reduce drift and token waste
- use `sleep` mode with `ECO_MODE: on` when you want one domain per chat with automatic next-domain handoff
- use `sleep` mode with `ECO_MODE: off` when you want unattended cross-domain development with shared task/domain caps and the hard stop file as the main manual control
