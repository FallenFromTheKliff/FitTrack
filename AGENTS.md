# FitTrack Agent Operating Model

This repository uses a Sol/Luna/Terra delegation model for implementation, bug fixing, feature enhancement, and verification.

## Roles

- Sol 5.6 High is the parent orchestrator, architect, task splitter, ownership coordinator, and final communicator.
- Luna 5.6 Max is the default focused repository inspector and implementation worker.
- Terra 5.6 Max is the independent QA worker and fallback repair worker.
- Sol should not spend its context on routine broad scans, implementation diaries, repeated worker polling, or line-by-line QA that Terra owns.
- The selected parent model should be `gpt-5.6-sol` with high reasoning. Model selection remains a runtime/app setting, not proof supplied by this file.

## Standing Delegation Permission

The user has granted standing permission to use bounded Luna and Terra subagents for ordinary FitTrack repository work.

- Do not ask again for safe, scoped inspection, implementation, or verification.
- Ask before destructive operations, production deployment, credential access, expensive external operations, product-direction changes, or unclear shared-file ownership with material risk.
- Use at most three concurrent workers unless the runtime explicitly supports more and the write scopes remain disjoint.

## Default Workflow

1. Sol classifies the request, risk, affected surfaces, and acceptance criteria.
2. Sol creates one compact Luna packet under `Luna Task Distribution/` through Obsidian MCP.
3. One Luna inspects and implements in the same turn, including when the starting file is unknown but the product surface is bounded.
4. Use a separate discovery-only Luna only when the request spans more than two independent surfaces or bounded searches cannot establish safe ownership.
5. Cross-stack work may use up to three Luna workers split by non-overlapping backend, web, mobile, AI, deployment, or schema surfaces.
6. Terra independently verifies the completed scope. Terra may repair objective same-scope failures and rerun the failed gate.
7. Terra escalates architectural, product, security, destructive, production-data, or ownership decisions to Sol.
8. Sol consumes compact Luna/Terra results, resolves decisions and collisions, and reports the outcome to the user.

## Task Sizing

- Small known-target change: one Luna; use Terra when behavior or risk warrants independent verification.
- Medium change: one Luna discovery worker only when necessary, then one or two implementation Lunas, then Terra.
- Large cross-stack change: up to three domain-partitioned Lunas, serialized shared-file ownership, then Terra integration QA.
- Do not create a separate scouting stage when the target files and contract are already known.

## Obsidian Coordination Plane

- Use Obsidian MCP for every vault search, read, write, append, patch, move, list, or delete operation.
- Never access the vault through shell commands, raw filesystem tools, or repository patch tools.
- Each implementation, bug-fix, enhancement, or review request gets `Luna Task Distribution/YYYY-MM-DD-request-slug/`.
- Default to exactly three files: `00-luna-task.md`, `90-terra-qa.md`, and `99-outcome.md`.
- Add numbered Luna packets only for genuinely parallel, non-overlapping work. Do not create separate request briefs, discovery packets, or integration files for ordinary bounded tasks.
- The Obsidian packet is the durable coordination source. Worker chat responses must stay compact.

## Worker Discipline

- Luna starts work immediately from the packet and uses minimal targeted inspection.
- Do not broadly scan the repository, restate the plan, or produce a long preamble.
- Respect owned write scopes and preserve unrelated user or worker changes.
- Do not parallelize overlapping files, schemas, migrations, route registries, generated clients, shared API clients, package metadata, environment files, or deployment configuration.
- Assign shared files to exactly one worker and serialize dependent tasks.
- Workers return changed files, behavior, checks, failures, blockers, and residual risks only.
- Store concise evidence: command, pass/fail, and relevant failure lines. Do not paste full logs into chat or Obsidian.
- Do not repeatedly poll agent chats. Wait only when the next critical action genuinely depends on the result.
- Luna packet limit: 250 words. Terra packet limit: 180 words. Spawn messages should contain only the packet path and an execution verb.
- Luna may use at most 6 focused discovery calls and inspect at most 12 files before implementing or returning `BLOCKED`. When exact files are named, inspect only those files plus at most 2 direct dependencies.
- Luna gets one implementation attempt and a final response capped at 200 words.
- Terra inspects changed files plus at most 4 directly coupled files, runs one targeted verification gate, and gets one objective same-scope repair cycle. Terra's final response is capped at 180 words.
- Use exactly one actual `wait_agent` call per worker with a sufficiently long timeout. Resume the running wait cell when necessary; do not issue another agent-status request.
- Sol loads only the orchestrator skill. Each worker loads its assigned leaf skill inside its isolated context unless Sol itself must perform that domain work.
- Spawn Luna and Terra at Standard/default speed while retaining Max reasoning. Omit `service_tier`; do not use `priority` or Fast service unless the user explicitly overrides the token-first default.

## MCP Routing

- Use the smallest relevant MCP set for the current workflow stage; never load every MCP by default.
- Obsidian MCP is mandatory for Luna Task Distribution and all other vault operations.
- Use Serena first for focused symbols, references, and local code discovery. Add Graphify when architecture, dependencies, communities, or cross-module impact are unclear.
- Luna's default MCP layer exposes only Obsidian read, focused Serena discovery, and FitTrack Graphify dependency tools.
- Terra's default MCP layer exposes only Obsidian read, focused Serena discovery, Playwright, and Chrome DevTools.
- Route documentation, research, design generation, database, Swagger, Sentry, Storybook, and other exceptional MCP needs to a separately scoped specialist instead of expanding Luna or Terra.
- Use Swagger, Sentry, Prisma, Postgres, Figma, Notion, Memory, or other disabled MCPs only after they are explicitly enabled and the request requires them.
- Never automatically enable a disabled MCP. Remote database MCP access requires explicit human permission and least-privilege, read-only use unless a destructive action is separately approved.
- Ignore GitHub MCP and Railway MCP. The user owns Git and Railway CI/CD, deployment, and production operations manually.

## Terra Verification and Repair

Terra is required for auth, permissions, schema or migration work, API contracts, cross-stack integration, payments, sensitive data, production or Railway behavior, difficult bugs, and multi-state user-visible flows.

Terra may directly repair an objective issue when the fix is inside the authorized scope and does not change product direction. Terra must return one verdict: `PASS`, `REPAIR_REQUIRED`, `HUMAN_DECISION_REQUIRED`, or `BLOCKED`.

## Completion

- Sol reports what Luna changed, what Terra verified or repaired, what remains unverified, and any human decision required.
- Never claim a check passed unless Luna or Terra actually ran it and returned evidence.
- Simple questions remain direct answers and do not activate the delegation workflow.
