# MCP Matrix

Use the lightest honest tool set for the touched scope.

## Preferred lanes

- `serena`
  - Preferred for scope scans, duplicate-surface checks, and conflict context once the `FitTrack` project is activated.
  - Fallback: local `rg` and focused repo reads.
- `prismaLocal`
  - Required when Prisma schema, migrations, or DB-backed contract changes are involved.
  - Use `migrate_status` before and after resolving risky merge conflicts.
- `swagger`
  - Use for backend contract inspection and response validation after runtime truth is known.
- `chromeDevtools`
  - Use for browser-visible runtime verification and network request inspection on web flows.
- `notion`
  - Use only when the task needs durable coordination or documentation.
- `sentry`
  - Use only for prod-observed issues or explicit Sentry follow-up.
- `figma`
  - Use only for Figma-owned UI or design-to-code work.

## GitHub MCP and plugin

- GitHub MCP or plugin is conditional.
- If installed later, use it for:
  - PR inspection
  - open-PR file collision checks
  - duplicate-code checks with `search_code`
  - PR creation from `my_branch` to `main`
- If GitHub MCP or plugin is absent:
  - require the developer to check GitHub manually before writes when overlap risk exists
  - use Serena once activated or local `rg` for duplicate-surface detection
  - push to `my_branch`, then remind the developer to open the PR manually

## Phase 0 collision check

- If GitHub MCP or plugin is available:
  - use `list_pull_requests`
  - use `get_file_contents`
  - use `search_code`
- If GitHub MCP or plugin is not available:
  - require a manual GitHub check first
  - then use Serena or local `rg`
  - if collision risk still exists, stop before writing

## Current environment note

- The FitTrack repo already exposes useful MCP families such as `prismaLocal`, `swagger`, `notion`, `chromeDevtools`, `figma`, `sentry`, and `serena`.
- `serena` still needs project activation before the skill can rely on Serena-first routing.
- GitHub MCP or plugin should be treated as an optional future lane until it is actually callable in the session.
