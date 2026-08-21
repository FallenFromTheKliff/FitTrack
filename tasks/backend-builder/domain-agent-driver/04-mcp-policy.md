# Domain Agent Driver MCP Policy

Use MCPs intentionally.
More MCPs are not automatically better.

## Shared Policy

- Serena is the default required MCP for repo navigation, symbol lookup, and existing-pattern discovery
- the loop runner now enforces required MCP access with a short wrapper-managed preflight before the main worker starts
- start every normal worker by using Serena before broad repo scanning so the worker refreshes repo context with MCP-backed navigation first
- do not use generic `codex` MCP resource-listing calls such as `codex.list_mcp_resources` or `codex.list_mcp_resource_templates` to decide whether Serena or Prisma Local are available; those generic listings do not prove server absence and do not count toward required MCP usage
- `agents/architecture.md` is authoritative for repo-wide coding rules; Serena may surface codebase patterns, but it must not silently override architecture rules
- if the task file declares `Touches Prisma`, `Needs External Docs`, `Needs Runtime API Verification`, or `Preferred MCPs`, treat those fields as active workflow routing rules; otherwise infer usage from the task scope and repo context
- if `Preferred MCPs` lists a server that is available and not forbidden in the current phase, actually use it before finalizing the phase report
- existing task metadata remains the trigger surface; do not invent new task-file fields just for GitHub or Notion MCP usage
- `prismaLocal` is the default Prisma MCP for local schema, migration, repository, and local dev DB state work
- when review, plan, implement, test, or runtime work is DB-relevant, use Prisma Local MCP early instead of relying on raw repo scans for schema or migration truth
- `prismaRemote` is optional and should be used only when the task explicitly needs remote Prisma workspace context; remote Prisma auth failures must not block the local loop by default
- GitHub MCP is optional and should be used only for GitHub repo, issue, PR, workflow, or remote collaboration context that is not already available in the local workspace
- Notion MCP is optional and should be used only when the task or user explicitly needs Notion workspace context
- end every phase report with exactly one line in this format: `MCPs used: serena, prismaLocal` or `MCPs used: none`

## Automatic MCP Utilization

- `serena`: use in every normal domain phase for repo navigation and symbol-aware inspection, and make at least one real Serena repo-context tool call before broad shell scanning
- `prismaLocal`: use when `Touches Prisma = yes`, the task is DB-backed, the task file lists `prismaLocal`, module hints or the current phase indicate schema-aware planning or review, or the run needs local migration or invariant confirmation
- `prismaRemote`: use only when the task or user explicitly needs remote Prisma context outside the local dev DB
- `context7`: use when `Needs External Docs = yes` or current framework or package behavior is unclear from repo context
- `swagger`: use only for runtime API verification tasks or the separate API verification driver
- `github`: use when the task file lists it, or the task or user explicitly needs GitHub repo, PR, issue, or workflow context outside the local workspace
- `notion`: use when the task file lists it, or the task or user explicitly needs Notion workspace context
- if an optional MCP is unavailable or unauthenticated, continue when the task can still be completed locally and record that in the phase report
- the loop runner treats Serena and DB-relevant Prisma Local usage as strict requirements; it first proves access through a wrapper-managed preflight and then accepts qualifying required MCP usage observed in either the preflight or the main worker for that task boundary
- if the first launch dies before any real MCP or shell activity appears, the wrapper may retry once through an inline fallback launch; that retry is a launch-recovery path, not a relaxation of the MCP requirement
- qualifying required MCP usage still must come from real `serena` or `prismaLocal` tool calls; generic codex resource listings never count

## MCP Dispatch Rules

### `review`

- Serena: required
- the wrapper preflight should already have exercised Serena before the main review worker starts
- qualifying Serena usage means a real repo-context tool such as `find_file`, `list_dir`, `search_for_pattern`, `get_symbols_overview`, `find_symbol`, or `find_referencing_symbols`
- `prismaLocal`: required when reviewing DB-backed modules, Prisma models, repositories, query behavior, migration artifacts, data invariants, or schema-aware module hints such as `capstone-backend/prisma`
- `prismaRemote`: optional only for explicit remote Prisma context
- Context7: optional when current NestJS, Prisma, Swagger, or package behavior is unclear from repo context
- GitHub: optional only if the review depends on GitHub-hosted context outside the local workspace
- Notion: optional only if the review depends on explicit Notion workspace context
- Swagger: forbidden

### `plan`

- Serena: required
- the wrapper preflight should already have exercised Serena before the main planning worker starts
- qualifying Serena usage means a real repo-context tool, not a generic MCP availability probe
- `prismaLocal`: required for DB-backed task slices, schema-aware planning, migration sequencing, and Prisma-backed invariant planning
- `prismaRemote`: optional only for explicit remote Prisma context
- Context7: optional for current framework or package guidance
- GitHub: optional only if the plan depends on GitHub-hosted issues, PRs, or workflow context outside the local workspace
- Notion: optional only if the plan depends on explicit Notion workspace context
- Swagger: forbidden

### `implement`

- Serena: required
- the wrapper preflight should already have exercised Serena before the main implementation worker starts
- `prismaLocal`: required if the task changes schema, repository contracts, query behavior, enums, relations, or DB-backed invariants
- `prismaRemote`: optional only for explicit remote Prisma context
- Context7: optional when current package behavior must be confirmed before coding
- GitHub: optional only if implementation depends on GitHub context outside the local workspace
- Notion: optional only if implementation depends on explicit Notion workspace context
- Swagger: forbidden

### `test`

- Serena: required
- the wrapper preflight should already have exercised Serena before the main test worker starts
- `prismaLocal`: preferred when verifying DB-backed behavior or invariants, and required when local migration state gates runtime verification
- `prismaRemote`: optional only for explicit remote Prisma context
- Context7: optional
- GitHub: optional only if verification depends on GitHub-hosted context outside the local workspace
- Notion: optional only if verification depends on explicit Notion workspace context
- Swagger: forbidden in the normal task loop

### `runtime api verification`

- use `tasks/api-verification-driver.md`
- Swagger: required
- Serena: preferred for mapping live endpoints back to code owners
- `prismaLocal`: optional only if the verification needs DB-aware context, except when the shared driver enables automatic checked-in local guard-migration application as a runtime precondition
- `prismaRemote`: optional only for explicit remote Prisma context
- Context7: optional only if current Swagger or framework behavior is unclear
- GitHub and Notion: usually unnecessary; use them only if the verification depends on an external source of truth that is not in the repo
- only run after build, relevant tests, and `npm.cmd run lint:check` pass
- if `tasks/api-verification-driver.md` is configured to auto-start the backend, let that driver handle startup before Swagger checks
- in `sleep` mode, treat successful runtime API verification as part of domain completion, not as a separate optional pause
