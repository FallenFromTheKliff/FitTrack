# Domain Agent Driver Review And Plan Phases

Use this file only when `CURRENT_PHASE = review` or `CURRENT_PHASE = plan`.

## Domain Review

Use this first for a new domain.

Expected outcome:

- design-vs-code gap report
- missing modules, endpoints, patterns, or tests
- recommended task slices for the domain

### If `CURRENT_PHASE = review`

Do this:

1. start with Serena MCP to refresh repo context and inspect the relevant symbols, folders, and existing patterns before broad scanning
2. if the domain or task is DB-relevant, use Prisma Local MCP early to confirm schema, migration, and local invariant context
3. scan the relevant code and schema
4. compare implementation against the design
5. report:
   - missing endpoints
   - wrong patterns
   - missing guards
   - missing DTO validation
   - missing repositories, services, or modules
   - missing tests
6. do not fix anything
7. suggest a practical task breakdown for the domain

Output style:

- findings first
- concise but complete
- no code changes
- prefer MCP-backed discovery over broad raw-file scanning when that can answer the same question with less context

## Domain Planning

Use this after review.

Expected outcome:

- backlog task list for the domain
- or a detailed plan for one selected task if you already know the slice
- if the domain adds or changes HTTP endpoints, reserve the final backlog task for runtime API verification through `tasks/api-verification-driver.md`

### If `CURRENT_PHASE = plan`

If `CURRENT_TASK_FILE = none`:

1. start with Serena MCP to refresh repo context and inspect the relevant symbols, folders, and existing patterns before broad scanning
2. if the domain is DB-relevant, use Prisma Local MCP to confirm schema and migration reality before task slicing
3. turn the domain into a practical backlog
4. suggest small-to-medium task slices
5. recommend implementation order
6. prefer tasks that unlock downstream domains
7. if the domain already has `execution.md`, align the plan to that queue instead of inventing a second one

If `CURRENT_TASK_FILE` is set:

1. start with Serena MCP to refresh repo context for the current task
2. if the task is DB-relevant, use Prisma Local MCP before finalizing the plan
3. read that task file
4. produce a concrete implementation plan for that one task
5. keep it decision-complete

Do not write application code in plan mode.
