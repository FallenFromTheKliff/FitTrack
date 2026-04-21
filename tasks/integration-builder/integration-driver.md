# Integration Driver

Use this file as the stable entrypoint and control surface for page-first cross-platform integration.
Edit only the execution controller variables before each session, leave the system-managed state alone during normal use, then tell Codex:

```text
Read tasks/integration-builder/integration-driver.md and run the configured page-first cross-platform integration flow end to end. Start from the selected surface page, audit any required web and mobile companion surfaces, resolve gaps using the integration, backend, and frontend skills, verify through direct API checks plus Swagger and Playwright, keep the local watcher stack healthy, update Notion and the system-managed state, and stop only when the selected surface bundle is complete or a real blocker remains.
```

This file stays intentionally thin so normal runs only load the active page-first contract, the controller values, and the local resume state.

---

## Execution Controller Variables

Edit these values before starting a chat:

- `RUN_MODE:` `integrate_surface_pages`
- `SURFACE_SELECTION_MODE:` `next_incomplete_surface`
- `FOCUS_SURFACE_PAGE_TITLE:` `none`
- `FOCUS_SURFACE_PAGE_ID:` `none`
- `SURFACE_PLATFORM_SCOPE:` `auto`
- `AUTO_FIX_SCOPE:` `blocking_plus_obvious`
- `RUNTIME_MODE:` `attach_manual`
- `NOTION_PARENT_PAGE_TITLE:` `System Gap Analysis`
- `SOFT_BLOCK_RECHECK:` `yes`
- `MAX_SELF_HEAL_ATTEMPTS_PER_SURFACE:` `2`
- `MODULE_HINTS:`
  - `apps/api/src`
  - `apps/ai-microservice`
  - `apps/web`
  - `apps/mobile`
  - `packages/types`
  - `packages/api-client`
  - `packages/query`
  - `packages/validators`

### Legacy Domain Fallback Variables

These are retained only when `RUN_MODE = integrate_domain_journeys_legacy`:

- `EXECUTION_PRESET:` `single_domain`
- `DOMAIN_BATCH:` `none`
- `FOCUS_DOMAIN:` `none`
- `MAX_SELF_HEAL_ATTEMPTS_PER_DOMAIN:` `2`

### Controller Intent

- `RUN_MODE = integrate_surface_pages` is the default day-to-day integration flow.
- `SURFACE_SELECTION_MODE = single_surface` means the run owns exactly one selected surface page plus any required companion surfaces.
- `SURFACE_SELECTION_MODE = next_incomplete_surface` means the run keeps choosing the next actionable surface from `Surface Verification Tracker`, using manifest metadata and current findings, until the configured scope is exhausted.
- `SURFACE_SELECTION_MODE = resume_active` means the run resumes the surface recorded in local state or the surface page `Execution State`.
- `SURFACE_PLATFORM_SCOPE = auto` means the run uses manifest parity metadata to decide whether the selected feature stays single-platform or becomes a cross-surface bundle.
- `AUTO_FIX_SCOPE = blocking_plus_obvious` means the run fixes blockers plus clear local UX or contract gaps such as sorting, filtering, modal, empty-state, loading-state, and field-mapping drift.
- `AUTO_FIX_SCOPE = blocking_plus_obvious` also means obvious page-completion gaps are not optional polish; they must be fixed or explicitly classified before the surface closes.
- `RUNTIME_MODE = attach_manual` means the run assumes the operator-managed watcher stack already owns API, web, and mobile. Managed host scripts are fallback recovery tools only.
- `SOFT_BLOCK_RECHECK = yes` means a blocked or deferred surface should be written to the blocked area, skipped for now, and reconsidered later in the same continuous run when the blocker looks transient or environmental.
- `RUN_MODE = integrate_domain_journeys_legacy` keeps the older domain-first preset flow available, but it is no longer the default.

---

## System-Managed State

Do not manually edit these values during normal execution. They are the worker-managed local resume aid that sits alongside the durable Notion state.

- `STATE_ACTIVE_SURFACE:` `none`
- `STATE_ACTIVE_COMPANION_SURFACES:` `none`
- `STATE_ACTIVE_PHASE:` `done`
- `STATE_ACTIVE_DOMAIN_TASK:` `none`
- `STATE_LAST_COMPLETED_SURFACE:` `none`
- `STATE_STOP_REASON:` `none`

### Legacy Domain Fallback State

These are retained only when `RUN_MODE = integrate_domain_journeys_legacy`:

- `STATE_ACTIVE_DOMAIN:` `none`
- `STATE_NEXT_DOMAIN:` `done`
- `STATE_DOMAIN_PHASE:` `done`
- `STATE_ACTIVE_TASK_PAGE:` `none`
- `STATE_LAST_COMPLETED_DOMAIN:` `none`

### State Meaning

- `STATE_ACTIVE_SURFACE` is the exact active surface page title, or `none`.
- `STATE_ACTIVE_COMPANION_SURFACES` is a comma-separated list of companion surface page titles required for the current cross-surface bundle, or `none`.
- `STATE_ACTIVE_PHASE` is the active page-first lifecycle phase:
  - `audit`
  - `resolve`
  - `verify`
  - `sync`
  - `blocked`
  - `done`
- `STATE_ACTIVE_DOMAIN_TASK` is the linked `Task - <domain> - <fix-slug>` page currently owning reusable or cross-domain implementation work, or `none`.
- `STATE_LAST_COMPLETED_SURFACE` is the most recently completed primary surface page title, or `none`.
- `STATE_STOP_REASON` is the current blocker or stop summary, or `none`.

---

## Account-Switch Handoff Contract

If the user says `pack up im changing accounts` or gives a clearly equivalent account-switch instruction, treat that as an explicit durable-handoff request.

- stop advancing scope at the next safe boundary and prioritize context capture over new implementation
- if a safe boundary is not available, capture the handoff immediately rather than risking lost context
- update the local driver state first when the current run has a meaningful active surface, companion-surface bundle, phase, or stop reason
- write a Serena memory before ending the run
- use the naming pattern:
  - `integration/account_switch_handoff_<YYYY-MM-DD>_<short-scope-slug>`
  - use `integration/session_handoff_<YYYY-MM-DD>_<short-scope-slug>` only for normal pauses that are not explicitly account-switch related

### Required Serena Memory Contents

The account-switch handoff memory must be detailed enough that the next chat can resume without trusting chat history, stale browser tabs, or the previous account's MCP auth state.

- active implementation slice and current user request
- exact integration-driver state at handoff:
  - active surface page title
  - companion surface page titles
  - active phase
  - linked task page or domain task page titles and IDs when relevant
  - current stop reason
- relevant Notion context:
  - parent page title
  - selected surface page titles and URLs
  - linked task page titles and URLs
  - any task queue or domain page truth that the next run must rehydrate first
- exact repo changes in progress:
  - files changed in this run
  - whether code edits were made or verification only happened
  - whether changes are committed, uncommitted, or intentionally not yet synced
- verification status with concrete truth:
  - direct API checks completed or still pending
  - Swagger checks completed or still pending
  - Playwright checks completed or still pending
  - specific pass or fail observations, not just `verified`
- audit or resolve context that would be easy to lose:
  - active findings and their classification (`autofix_now`, `blocked_external`, `blocked_hard`, `product_followup`)
  - assumptions made during the run
  - product decisions or scope boundaries that were treated as current truth
- runtime and data state that the next account must not guess:
  - watcher stack health and ports
  - whether the DB was reseeded or reset
  - current seeded credentials or test users if they matter to verification
  - current data state needed for reproduction, including entity IDs when relevant
  - feature flags, env gaps, or external-config dependencies that gate the next step
- account-sensitive continuity notes:
  - which MCP-backed auth context mattered in the current run, especially Notion or browser verification assumptions
  - what the next chat must recheck instead of assuming after account switch
  - any current tool quirk or workaround that was required to keep verification moving
- the exact next action the next run should take first
- a `Best resume prompt` line that tells the next chat to read the Serena memory before broad exploration

### Resume Rule After Account Switch

After an account switch, the next integration run must read the latest relevant Serena account-switch handoff memory before broad repo scanning, before assuming the current Notion auth context, and before trusting stale runtime or browser state.

---

## MCP Startup Contract

Before normal page-first execution, initialize the MCP workflow in this order:

1. Serena MCP
   - activate the FitTrack project first
   - read relevant Serena memories before broad repo exploration
   - use real Serena repo-context tools before broad shell scanning
2. Notion MCP
   - fetch the configured parent page early
   - fetch `Surface Verification Tracker`, the selected surface page, any required companion surface pages, relevant `Domain - <domain>` pages, linked task pages, `Task Queue`, and `External Config Registry`
3. Local MCP parity preflight
   - run `tasks/integration-builder/integration-preflight.cmd -Mode mcp`
4. Prisma MCP
   - when the selected surface or any companion surface is DB-relevant, check Prisma migration or runtime state before relying on symptoms
5. Swagger MCP
   - use it only after code and direct API checks pass and only when the selected surface bundle needs live contract confirmation
6. Playwright MCP
   - use it during the `verify` phase after direct API checks establish the intended flow on the required web and mobile surfaces

Notion and Context7 may be environment-provided or authenticated outside this repo.
Do not hardcode them as required local servers in repo config, but fail fast when a run depends on them and they are unavailable.

---

## Common Runtime Fixes

Apply these checks before treating a local integration failure as an app bug:

- The local Prisma schema, migrations, and seed data are development-only and may be changed during refactors or feature additions when the work requires a cleaner contract or data model.
- Do not treat the local database shape as production-frozen; if schema work is the right fix, change it deliberately, reseed safely, and record the change in the active task or Notion evidence.
- Do not store persistent business data or cross-device workflow state in `localStorage` or `sessionStorage` when it can drift from backend truth.
- Browser storage is acceptable only for clearly local UI state such as panel visibility, draft filters, temporary unsaved form input, or other operator-local convenience that does not need cross-device consistency.
- If an existing surface stores business-critical state in browser storage, treat that as a contract bug during the refactor wave and move the source of truth into a backend endpoint backed by Postgres.
- For normal integration work, use `docker-compose.local-infra.yml` only.
- Keep Docker limited to the local infra pair:
  - `fittrack-db-local` on `127.0.0.1:5433`
  - `fittrack-redis-local` on `127.0.0.1:6379`
- Before runtime-sensitive resume or verification, run `tasks/integration-builder/integration-preflight.cmd -Mode runtime`.
- When the operator-managed watcher stack is already healthy, do not create ad hoc sidecar ports or fallback runtimes just because one previous recovery path used them; first stay on the canonical stack ports and confirm the active app still points at those ports.
- Treat watcher crashes after a patch as likely edited-file syntax or import errors before treating them as infrastructure failures, especially on mobile Expo web and Next dev watchers.
- Before any runtime panic, hard stop, or sidecar fallback caused by a watcher crash, inspect the edited-file set first:
  - run `tasks/integration-builder/integration-check-edited-syntax.cmd <touched-files...>` when the run already knows its touched files
  - or run `tasks/integration-builder/integration-check-edited-syntax.cmd` with no args to scan supported changed files from git status
  - then inspect the relevant watcher log tail for the crashed surface before deciding whether the outage is real
- A transient watcher stop after an edit is not by itself a global blocker when the watchdog can restart it; classify it as a patch-validation problem first and only escalate after the syntax check and the watcher log both fail to reveal an obvious fix.
- When runtime preflight fails only because the host surfaces are down, use `tasks/integration-builder/integration-host-start.cmd` only as bounded recovery, then rerun runtime preflight.
- When the managed watcher fallback stack stops reflecting code changes, restart it with `tasks/integration-builder/integration-host-start.cmd -RestartManaged`.
- When you need to clear the managed fallback stack entirely, run `tasks/integration-builder/integration-host-stop.cmd`.
- Keep local testing host-run:
  - stack primary: the operator-managed pnpm watcher stack
  - managed fallback: `tasks/integration-builder/integration-host-start.cmd`
  - API fallback: `cd apps/api; node dist/src/main.js`
  - web: `pnpm.cmd dev:web`
  - mobile Expo web: `pnpm.cmd dev:mobile:web`
  - AI: `pnpm.cmd dev:ai`

---

## Routing Rules

After reading this file, load the shared page-first integration docs in this order:

1. `tasks/integration-builder/integration-driver/03-runtime-core.md`
2. `tasks/integration-builder/integration-driver/04-notion-contract.md`
3. `tasks/integration-builder/integration-driver/13-run-mode-integrate-surface-pages.md`
4. `tasks/integration-builder/integration-driver/08-mcp-policy.md`

Load these references only when needed:

- `tasks/integration-builder/integration-driver/07-playwright-verification.md` when browser verification is expected during the `verify` phase
- `tasks/integration-builder/integration-driver/02-variable-reference.md` when you need allowed values, reset rules, or state meanings
- `tasks/integration-builder/integration-driver/01-operator-guide.md` only when operator guidance or setup examples are needed
- `tasks/integration-builder/integration-driver/12-domain-task-flow.md` when a reusable or cross-domain gap must become a linked domain task page
- `tasks/integration-builder/integration-driver/11-run-mode-integrate-domain-journeys.md` only when `RUN_MODE = integrate_domain_journeys_legacy`

---

## Entry Point Contract

- Keep the controller-variable and system-managed-state bullet syntax stable unless the routing contract is updated too.
- Keep the normal operator prompt aligned to the page-first flow:

```text
Read tasks/integration-builder/integration-driver.md and run the configured page-first cross-platform integration flow end to end. Start from the selected surface page, audit any required web and mobile companion surfaces, resolve gaps using the integration, backend, and frontend skills, verify through direct API checks plus Swagger and Playwright, keep the local watcher stack healthy, update Notion and the system-managed state, and stop only when the selected surface bundle is complete or a real blocker remains.
```

- Use the repo-local `integration` skill as the resolve-phase orchestrator.
- Use the repo-local `backend` skill when backend or contract work is needed.
- Use the repo-local `frontend` skill for both web and mobile UI or shared-client fixes.
- Keep `skill-improver` explicit-only and never run it automatically from the integration flow.
- Codex in the active chat remains the only orchestrator and shared-state owner.
- Codex may spawn as many bounded subagents as useful for exploration, implementation, and verification, but only the main chat agent may choose the active surface bundle, update Notion, update local driver state, decide whether to create a linked domain task, or close the run.
- Treat `Surface Verification Tracker` child pages as the primary execution record for normal integration work.
- Treat linked domain task pages as optional escalations for reusable, cross-domain, structurally large, or blocked work.

