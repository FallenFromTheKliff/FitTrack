# Integration Driver MCP Policy

Use MCPs intentionally and use them as much as possible within the active page-first surface flow.
The default bias is MCP-first because it reduces token consumption, keeps context windows smaller, and makes resume state more durable than broad repo or chat-history reloading.

## Shared Policy

- Serena is the default required MCP for repo navigation, symbol lookup, and existing-pattern discovery
- Notion is the required durable-progress MCP for surface execution state, evidence, linked domain tasks, and cross-run continuity
- start every normal integration worker by using Serena before broad repo scanning so the worker refreshes repo context with MCP-backed navigation first
- always prefer the relevant MCP over broad shell scanning, broad file reads, or chat-memory reconstruction whenever the MCP can answer the question cleanly
- use the smallest MCP surface that can answer the current question so the run stays token-efficient and does not overload the context window
- `tasks/integration-builder/integration-preflight.cmd -Mode mcp` is the repo-local config-parity check for Codex chat vs VS Code; it complements real MCP usage but does not replace it
- if the selected surface page or linked task page declares `Preferred MCPs`, `Touches Prisma`, or `Needs Runtime Verification`, treat those fields as active routing rules
- at surface boundaries, rehydrate only the selected surface page, required companion surface pages, linked domain pages, linked task pages, and `External Config Registry` instead of broad-fetching unrelated domains
- `prismaLocal` is the default Prisma MCP for local schema, migration, repository, and local dev DB state work
- when surface audit, resolve, or verify is DB-relevant, use Prisma Local MCP early instead of relying on raw repo scans for schema or migration truth
- Swagger is reserved for runtime-contract confirmation after direct API checks pass
- Playwright is reserved for browser verification after direct API checks pass
- if the user says `pack up im changing accounts`, Serena `write_memory` becomes mandatory before the run ends
- after an account switch, Serena `read_memory` is mandatory before reconstructing context from shell scans or partial chat history

## Automatic MCP Utilization

Normal automation should behave as if MCP usage is mandatory unless the phase rules explicitly forbid or narrow it.

- `serena`: required in every normal surface run for repo navigation and symbol-aware inspection
- `notion`: required in every normal surface run because surface pages are the durable execution record
- `prismaLocal`: required when the selected surface bundle is DB-backed, or when schema, seed data, auth, bookings, profile, or runtime invariants could explain behavior
- `swagger`: use only in `verify` when the active bundle needs live endpoint-contract confirmation after direct API checks pass
- `playwright`: required in browser-verification phases for normal surface testing
- `context7`: optional only when current framework or package behavior is unclear from repo context
- `serena.write_memory`: required for explicit account-switch pack-up requests, with enough detail to survive MCP auth changes and new-chat loss of context

## Phase Dispatch Rules

### `audit`

- Serena: required
- Notion: required
- Prisma Local: required when the selected surface bundle is DB-backed
- Swagger: forbidden
- Playwright: forbidden
- audit must explicitly evaluate `Completion QA`, not only route or contract reachability

### `resolve`

- Serena: required
- Notion: required
- Prisma Local: required when the active work changes schema, repository contracts, query behavior, enums, relations, or DB-backed invariants
- Swagger: forbidden
- Playwright: forbidden
- resolve must fix `autofix_now` completion gaps as part of normal work, not defer them as optional polish

### `verify`

- Serena: required
- Notion: required
- Prisma Local: preferred when verifying DB-backed behavior and required when local migration state gates runtime verification
- Swagger: allowed only after direct API checks pass or when the live contract still needs confirmation
- Playwright: required when the active bundle touches a browser surface
- verify must confirm visible page completion, not just endpoint success

### `sync`

- Serena: preferred only when a final repo-truth check is needed
- Notion: required
- Prisma Local: not required
- Swagger: forbidden
- Playwright: forbidden
- Serena `write_memory`: required when the user is packing up for an account switch

## Skills And Subagents

- Skill routing is mandatory during `resolve`:
  - `integration` orchestrates
  - `backend` owns backend or contract work
  - `frontend` owns web, mobile, or shared-client UI work
- Subagents are encouraged for bounded sidecar exploration, implementation, and verification when they reduce context load.
- Subagents must not update Notion state, driver state, or bundle completion decisions.
- Prefer one subagent per bounded scope:
  - backend routes and DTOs
  - frontend web surface
  - frontend mobile surface
  - shared packages
  - verification evidence

## Fail-Fast Rules

Stop before implementation when:

- Serena is not actually used before broad scanning
- a phase that should be MCP-first falls back to broad shell exploration without a concrete reason
- Notion cannot be fetched for the active surface bundle
- local MCP parity fails in `tasks/integration-builder/integration-preflight.cmd -Mode mcp`
- a DB-relevant surface bundle skips Prisma Local despite local DB state being a plausible explanation
- an older tool-only or session-only blocker is treated as final without a fresh recheck while `SOFT_BLOCK_RECHECK = yes`
- the run tries to close a surface while `autofix_now` completion gaps are still open
- the user explicitly asked to pack up for an account switch and no durable Serena handoff memory was written before ending the run
