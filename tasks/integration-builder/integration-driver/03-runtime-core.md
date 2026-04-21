# Integration Driver Runtime Core

Follow the shared rules below using the execution controller variables and system-managed state in `tasks/integration-builder/integration-driver.md`.

## Always Read First

This integration driver is allowed to inspect the full integration surface in this repo.
Do not apply the frontend-only `.ai` restrictions while using this driver.

In every normal page-first run, read or inspect:

1. `tasks/integration-builder/integration-driver.md`
2. `tasks/integration-builder/integration-preflight.cmd`
3. `docker-compose.local-infra.yml`
4. `.playwright-mcp.json`
5. `.playwright-fittrack-flow.json`
6. `tasks/integration-builder/surface-audit/surface-manifest.json`
7. the selected `Surface Verification Tracker` page
8. any required companion surface pages
9. the paths listed in `MODULE_HINTS`
10. `packages/types`
11. `packages/api-client`
12. `packages/query`
13. `packages/validators`
14. `tasks/integration-builder/integration-driver/13-run-mode-integrate-surface-pages.md`

Also inspect the active integration surfaces as needed:

- `apps/api`
- `apps/ai-microservice`
- `apps/web`
- `apps/mobile`

## Current Repo Contract

- `apps/api` is the canonical backend API
- `apps/ai-microservice` is the current AI service dependency
- `apps/web` is the admin and staff platform
- `apps/mobile` is the member and coach platform
- browser-driven mobile verification uses Expo web at the configured Playwright mobile base URL
- `packages/types`, `packages/api-client`, `packages/query`, and `packages/validators` are part of the required integration surface
- normal day-to-day integration work is page-first and cross-platform-aware

## Recommended Local Integration Topology

- Use `docker-compose.local-infra.yml` as the default Docker setup for integration work.
- Keep Docker limited to one Postgres container and one Redis container exposed on host ports:
  - Postgres: `127.0.0.1:5433`
  - Redis: `127.0.0.1:6379`
- Treat the operator-managed watcher stack as the default runtime owner.
- Treat these as the canonical host-run commands:
  - operator-owned stack: existing pnpm watcher flow
  - managed fallback: `tasks/integration-builder/integration-host-start.cmd`
  - API fallback: `cd apps/api; node dist/src/main.js`
  - web: `pnpm.cmd dev:web`
  - mobile Expo web: `pnpm.cmd dev:mobile:web`
  - AI: `pnpm.cmd dev:ai`
- Avoid running `docker-compose.yml` and `docker-compose.local-infra.yml` at the same time during integration work.

## MCP And Runtime Preflight

Before broad exploration or edits, initialize the page-first workflow in this order:

1. activate Serena for repo truth and read relevant Serena memories
2. fetch the Notion parent, `Surface Verification Tracker`, the selected surface page, any required companion surface pages, and only the linked domain or task pages needed for the current scope
3. run `tasks/integration-builder/integration-preflight.cmd -Mode mcp`
4. if the selected surface bundle is DB-relevant, use Prisma MCP before concluding the app is wrong
5. before direct API checks, Swagger, or Playwright work, run `tasks/integration-builder/integration-preflight.cmd -Mode runtime`

Treat MCP recovery and runtime recovery as separate steps:

1. rerun MCP preflight first
2. rerun local-host reachability second
3. when a watcher fell over right after a patch, run `tasks/integration-builder/integration-check-edited-syntax.cmd` against the touched files and inspect the relevant watcher log before assuming infrastructure drift
4. use managed host startup only when manual attachment fails and the syntax-first check does not reveal an obvious edited-file problem
5. resume the active phase only after both are green or the blocker is explicit

## Cross-Platform Rules

- Treat both web and mobile as first-class frontend targets.
- When `SURFACE_PLATFORM_SCOPE = auto`, use manifest fields such as `parityGroup`, `parityRequired`, and `verificationMode` to decide whether the selected feature becomes a surface bundle.
- When the selected surface bundle is cross-surface, audit, resolve, verify, and sync the whole bundle before closing it.
- When a surface is truly platform-specific, keep the run single-platform and record the reason in the surface page `Companion Surface Status`.

## General Rules

- Serena repo truth comes first. Notion is the durable task and evidence store, not the source of code truth.
- Fetch the Notion parent page early so writes fail fast if the workspace is unavailable.
- Read relevant Serena memories before broad repo scans so cross-turn context does not depend on chat history alone.
- Use exact page-title matching when deciding whether to update an existing page or create a duplicate.
- Treat `Surface Verification Tracker` child pages as the primary execution record for normal integration work.
- Treat linked `Task - <domain> - <fix-slug>` pages as optional escalations for reusable, cross-domain, structurally large, or blocked work.
- Keep `Task Queue` as a rollup of real linked domain tasks, not a rollup of every page-local UI correction.
- Preserve the existing layered shape before introducing any new abstraction:
  - backend: Nest module -> controller -> service -> repository -> Prisma or data access
  - shared packages: `types` -> `validators` -> `api-client` -> `query` -> `app-core`
  - web and mobile: routes or screens -> local hooks or controllers -> shared packages
  - AI service: FastAPI routes -> Pydantic models -> service classes
- For backend or shared-code refactors, copy the closest existing repo pattern first and use `agents/architecture.md` only when no clear local pattern exists.
- Prefer editing an existing layer over adding a new wrapper, adapter, manager, or orchestrator.
- New integration-driven TypeScript work must pass `tasks/integration-builder/integration-no-explicit-any.cmd <touched-ts-files...>` before the active surface bundle moves to verification or done.
- For frontend integration work, keep each route file at or below 100 lines, keep route files as thin wrappers, reuse existing shared components first, create new shared components when needed, and keep the result theme-compatible.
- For non-route UI components, target 100 lines and treat 150+ lines or multiple unrelated visual sections as a refactor signal.
- For backend and API refactors, do not allow one controller, service, repository, or DTO file to accumulate mixed responsibilities unchecked.
- Treat `Completion QA` as a real closure gate:
  - a surface is not done only because the endpoint responds and Playwright reaches it
  - every visible primary action, modal path, filter, sort, async state, and role-conditioned branch must be either working, intentionally hidden, or explicitly documented as blocked
  - obvious decision-safe completion gaps are `autofix_now`, not optional polish
- Use these finding buckets consistently:
  - `autofix_now`
  - `blocked_external`
  - `blocked_hard`
  - `product_followup`

## Skills And Subagents

- The repo-local `integration` skill is the required resolve-phase orchestrator.
- The repo-local `backend` skill is required when backend or contract work is needed.
- The repo-local `frontend` skill is required for both web and mobile UI or shared-client work.
- The repo-local `skill-improver` remains explicit-only and is never part of normal integration execution.
- Codex in the active chat is the only orchestrator and shared-state owner.
- Codex may spawn as many bounded subagents as useful for exploration, implementation, and verification, but only the main chat agent may:
  - choose the active surface bundle
  - update Notion pages
  - update local driver state
  - decide whether a linked domain task is required
  - decide when the run is done or blocked
- Give each subagent a disjoint write scope when code changes are involved.
- Serialize overlapping write scopes instead of running them in parallel.

## Stop Conditions

Stop the entire run and report instead of continuing automatically only when:

- Notion is unavailable or the selected surface page cannot be read or created
- required local MCP parity fails in `tasks/integration-builder/integration-preflight.cmd -Mode mcp`
- auth, role, or security behavior is ambiguous
- the selected surface bundle broadens into a product decision or architecture decision
- a required runtime surface remains unreachable after bounded local recovery
- a required watcher surface still fails after the syntax-first touched-file scan, watcher-log inspection, and the allowed bounded recovery path
- verification fails and the root cause is not obvious after the allowed retry budget
- Playwright MCP is unavailable, misconfigured, or cannot reach the required web or mobile verification target during the `verify` phase
- the active surface bundle is hard-blocked and no safe continuation remains

For `SURFACE_SELECTION_MODE = next_incomplete_surface`:

- do not stop the entire run just because one surface bundle becomes blocked or deferred
- instead, write the blocker into the selected surface page, the root tracker blocked area, and any required linked domain task
- then continue to the next actionable surface unless one of the global stop conditions above is true
