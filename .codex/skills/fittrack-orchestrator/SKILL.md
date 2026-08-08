---
name: fittrack-orchestrator
description: "Use as the thin top-level router for FitTrack prompts that need feature adding, UI tweaks, integration pages, large implementation planning, multi-skill routing, or user-permitted subagents/parallel workers. Classify intent, select downstream skills such as integration, frontend, backend, quality-assurance, debugger, runtime-guardrails, railway-deployment, browser-runtime-loop, layout-wireframe-gate, and related FitTrack skills, and coordinate bounded local or delegated work without replacing integration."
---

# FitTrack Orchestrator

> Changelog 2026-08-08: bounded Luna/Terra packets, one-turn implementation, one-wait execution, and per-role MCP minimization.

This skill is a thin router for FitTrack work. Use it to decide the right execution shape, choose downstream skills, prepare bounded worker packets when delegation is allowed, integrate results, and close with verification.

Do not replace `$integration`. Route to `$integration` when the task is full-stack, contract-heavy, or needs end-to-end completion auditing.

## Sol-Luna-Terra Operating Model

- Sol 5.6 High is the parent architect, foreman, ownership coordinator, and final communicator. Keep Sol out of routine broad scans, implementation diaries, repeated polling, and line-by-line QA.
- Luna 5.6 Max is the default implementation and focused discovery worker. Prefer `.codex/agents/luna-max-worker.toml`, or use the closest domain worker with model `gpt-5.6-luna` and reasoning effort `max`.
- Terra 5.6 Max is the independent QA and fallback repair worker. Prefer `.codex/agents/terra-max-worker.toml` with model `gpt-5.6-terra` and reasoning effort `max`.
- Luna and Terra run at Standard/default speed. Keep Max reasoning, omit `service_tier` from spawn calls, and never request `priority` or Fast service unless the user explicitly prioritizes speed over token usage.
- The repository grants standing permission for bounded Luna and Terra delegation. Preserve human gates for destructive, production, credential, security, cost, and product-direction decisions.
- Use Obsidian as the durable coordination plane and compact final agent responses as the notification plane.

## Core Workflow

1. Extract intent.
   - Restate the user goal in one sentence.
   - Identify target surfaces, files, runtime/deploy context, risk level, and whether the user explicitly allowed subagents or parallel work.
   - Separate required outcome from optional polish.

2. Classify the task.
   - Use `references/routing-matrix.md` for category-to-skill routing when more than one skill may apply.
   - Prefer the narrowest downstream skill that owns the work.
   - Use `$integration` for cross-surface, full-stack, contract, or completion-gap work.

3. Choose skills.
   - Load only the selected downstream skill bodies before acting.
   - Use companion skills only when they add a distinct responsibility.
   - Keep this skill as coordinator; let the downstream skill own domain-specific procedure.
   - For user-visible changes, select the relevant project design DNA and surface recipe, then activate the Broskie `core.ui-ux-change` recipe instead of relying on prose-only polish guidance.
   - Treat missing, stale, draft, or `needs-review` DNA as a context-lock failure. Never promote generated design guidance to canonical without human approval.

4. Choose execution mode.
   - `luna-single`: default for a known, bounded target. One Luna inspects the named area and implements in the same run.
   - `luna-single-unknown-file`: default when the product surface is bounded but the starting file is unknown. The same Luna performs bounded discovery and implementation in one turn.
   - `luna-discovery`: exceptional. Use only when more than two independent surfaces are involved or bounded searches cannot establish safe ownership.
   - `luna-parallel`: use up to 3 Lunas for independent backend, web, mobile, AI, deployment, or schema slices with non-overlapping write scopes.
   - `terra-qa`: use Terra after implementation for risk-based verification; Terra may repair objective same-scope failures.
   - `serialized`: required for shared files, contracts, route registries, schemas, migrations, generated clients, package metadata, env files, or deployment configuration.
   - `sol-local`: reserve for direct answers, orchestration-only changes, unavailable delegation tools, or tightly coupled critical-path work that cannot be safely packetized.

5. Create compact worker packets when delegation is allowed.
   - Give each worker one skill or one disjoint slice.
   - Include the goal, owned write scope, relevant read-only context, commands to run, forbidden paths, and expected return format.
   - Do not ask workers to broadly rescan the repo. Give narrowed files, search terms, and artifacts.
   - For each implementation, bug-fix, enhancement, or review request, create `Luna Task Distribution/YYYY-MM-DD-request-slug/` through Obsidian MCP.
   - Use Obsidian MCP exclusively for vault list, search, read, write, append, patch, move, and delete operations. Never use shell or raw filesystem tools on the vault.
   - Default to exactly `00-luna-task.md`, `90-terra-qa.md`, and `99-outcome.md`. Add numbered Luna packets only for genuinely parallel write scopes.
   - Cap Luna packets at 250 words and Terra packets at 180 words. Do not repeat acceptance criteria across a separate brief and implementation packet.
   - If a worker cannot access Obsidian MCP, provide the compact packet content directly. Do not fall back to raw vault filesystem access.

6. Keep shared files under serialized ownership.
   - Sol owns routing, the file ownership map, and integration decisions. Assign each shared edit to exactly one Luna or Terra rather than making multiple workers race it.
   - Treat package metadata, Prisma schema/migrations, generated clients, shared API clients, route registries, layout shells, design tokens, env files, Docker/Railway config, and task trackers as shared unless proven otherwise.
   - Workers outside the assigned shared-file owner report required changes instead of editing those files.

7. Integrate results.
   - Sol consumes compact worker deltas, resolves contract or ownership decisions, and assigns any integration edit to one worker.
   - Require the implementation owner or Terra to check for duplicate routes, DTOs, types, services, components, and migrations before adding new ones.
   - Do not make Sol reread full worker conversations or redo completed worker inspection.

8. Verify through Terra.
   - Terra selects verification from the touched surface: typecheck, lint, unit/integration tests, direct API checks, Swagger, Browser/Playwright, runtime health, or deployment log checks.
   - Terra uses `$quality-assurance` for final bug sweeps or when evidence needs to be structured.
   - Terra may fix objective same-scope failures and rerun the failed gate. Escalate architecture, product behavior, security boundaries, production data, destructive operations, or ambiguous ownership to Sol.
   - For UI work, require an impact-based state matrix and hard-gate evidence as defined by `Research/Design/UI-UX-Enforcement/mechanical-enforcement-contract.md` in the Obsidian vault and validated by the Broskie UI enforcement CLI.
   - Report skipped verification honestly with the reason.

## Delegation Policy

Default to one Luna for bounded implementation work. Skip a separate discovery worker when the target is already known. Use Terra proportionally, and always use Terra for auth, permissions, schema/migrations, API contracts, cross-stack integration, payments, sensitive data, production/Railway behavior, difficult bugs, or multi-state user-visible flows.

Treat the user's standing preference as: `request -> Sol classifies -> Obsidian packets -> Luna executes -> Terra verifies/repairs -> Sol reports`. Do not wait for another permission prompt when the work is safe, bounded, and inside repository scope.

Never parallelize overlapping write scopes. If two slices need the same shared file, serialize them and let the main agent edit that file.

Use at most 3 active workers per batch by default. This reflects the practical session limit observed in Codex; close completed workers before launching another batch unless the environment clearly supports more. Use one agent per skill or disjoint slice. Do not create multiple agents to investigate the same broad area.

Give Luna one focused implementation attempt. If Luna returns blocked, fails the required gate, or produces an incomplete implementation, hand the original criteria, owned scope, changed-file list, and concise failure evidence to Terra. Do not ask Luna to loop repeatedly.

Use exactly one actual `wait_agent` call per worker with a sufficiently long timeout. If the orchestration cell yields, resume that same cell instead of issuing another agent-status call. Ask workers for one compact final response unless they encounter a human-gated blocker.

Do not duplicate leaf-skill context in Sol. Sol loads the orchestrator; Luna or Terra loads the assigned backend, frontend, debugger, QA, or other leaf skill in its isolated context unless Sol is doing that domain work directly.

Use `.codex/agents/*.toml` custom agents when available. They are role prefabs, not workflow replacements: skills hold detailed procedures, while custom agents hold worker behavior, ownership rules, and return formats. If a custom agent is unavailable in the current tool surface, use the closest built-in `worker` or `explorer` role and include the prefab name plus relevant `$skill` in the prompt.

Prefer this packet shape:

```text
Worker:
Skill(s):
Goal:
Owned write scope:
Read-only context:
Do not touch:
Required checks:
Return:
```

Prefix Luna implementation packets with:

```text
Read the assigned Obsidian packet and start immediately. Use minimal targeted inspection. Do not broadly scan the repository, restate the plan, or explain your approach before working. Search outside the named scope only when a required dependency cannot be located. Respect owned files. Return only changed files, behavior, checks, failures, blockers, and residual risks.
```

Hard Luna budget: at most 6 focused discovery calls and 12 inspected files before implementation or `BLOCKED`; when exact files are named, inspect only them plus at most 2 direct dependencies. One implementation attempt. Final response at most 200 words.

For async verification workers, require this return shape:

```text
Verdict:
Works:
Broken:
Evidence:
Blocked:
Next recommended fix:
```

Terra must use this verdict set: `PASS`, `REPAIR_REQUIRED`, `HUMAN_DECISION_REQUIRED`, or `BLOCKED`.

Hard Terra budget: changed files plus at most 4 directly coupled files, one targeted verification gate, one objective same-scope repair cycle, and a final response of at most 180 words.

## Routing Rules

- Use `$debugger` before patching tricky failures, repeated failed fixes, flaky tests, CI/local mismatches, or unclear runtime errors.
- Use `$runtime-guardrails` before starting, stopping, killing, or diagnosing local stack processes, ports, blank local pages, or browser-tool confusion.
- Use `browser-runtime-loop` when available for live local browser interaction loops; otherwise combine the Browser plugin with `$runtime-guardrails` and `$quality-assurance`.
- Route subjective or route-wide UI work through a design plan before mutation; route objective UI closure through the evidence contract. Do not let a visual score override stale actions, overlap, clipping, missing states, broken overlays, or runtime errors.
- Use `layout-wireframe-gate` when available for subjective or risky layout direction. Let it choose the cheapest honest approval artifact: no artifact for tiny polish, a layout delta packet for medium changes, screenshot or ASCII direction for high-risk composition, and static HTML only for major route/modal architecture or explicit preview requests.
- Use `$railway-deployment` for Railway build, Dockerfile/Railpack/Nixpacks, healthcheck, production env, or deploy-log failures.
- Use `$frontend` for web/mobile implementation and data wiring inside frontend ownership.
- Use `$backend` for NestJS, Prisma, DTOs, Swagger, auth guards, repositories, queue logic, and backend tests.
- Use `$quality-assurance` after implementation or for review-style verification.
- Add `$security-hardening` when touched surfaces include auth, permissions, payments, sensitive user data, uploads, external integrations, or AI endpoints.
- Use custom agent prefabs from `.codex/agents/` for repeated worker shapes such as browser runtime verification, debugging, Railway deployment, schema contract sync, UI layout, QA, frontend, backend, research, and skill maintenance.

## MCP Assignment Matrix

- Inspect available MCP capabilities at dispatch time and assign only those required by the packet. A configured but disabled server is unavailable until the user explicitly enables it.
- `obsidian`: required for request folders, task packets, QA records, outcomes, and every other vault operation. Never substitute shell or raw filesystem access.
- `serena`: Luna's first choice for focused symbols, references, routes, and local repository discovery.
- `graphify`: add for architecture, dependency, community, ownership, or cross-module impact questions; do not replace focused Serena discovery with a broad graph dump.
- `context7`: current library and framework documentation. `exa`: external research only when local sources are insufficient.
- `storybook`: component states and UI inventory. `stitch`: approved design-generation workflows. `node_repl`: bounded runtime or data-shape experiments.
- `playwright`: Terra browser-flow QA. `chromeDevtools`: Terra console, network, storage, performance, and low-level browser diagnostics.
- `broskie`: only when an activated Broskie workflow requires its mechanical contracts.
- Optional disabled servers such as Swagger, Sentry, Prisma Local/Remote, Postgres Read Only, Figma, Notion, Memory, and Magic UI remain disabled unless the user enables them for a specific need.
- Never auto-enable a disabled server or access a remote database without explicit human authorization and least privilege.
- Do not route GitHub MCP or Railway MCP. The user performs Git publishing, CI/CD, Railway deployment, and production operations manually.
- Enforce role-level MCP config layers: Luna receives Obsidian read, focused Serena, and bounded Graphify; Terra receives Obsidian read, focused Serena, Playwright, and Chrome DevTools. Route exceptional MCP needs to another specialist rather than widening these roles.

## Goals Compatibility

The official `/goal` flow may name `$fittrack-orchestrator` and downstream skills in its prompt. Follow the goal's active instructions when present, then use this skill to route the work.

Do not claim to start, enable, or programmatically control Goals mode. If the user is not already in an official `/goal` flow, operate normally and say that this skill can coordinate the work but cannot start Goals mode itself.

## Token And Duplication Control

- Narrow context before delegating: pass file lists, focused snippets, endpoint names, route names, component names, failing commands, and logs.
- Ask workers for deltas, evidence, and decisions, not long repo summaries.
- Avoid broad rescans unless the classification step shows the target is unknown.
- Do not send workers the full parent conversation when the Obsidian packet contains the needed context.
- Keep evidence to command, pass/fail, and relevant failure lines; never paste complete logs without a blocker-specific reason.
- Use one final worker response and avoid progress chatter unless a human decision is required.
- Let Terra own independent checking so Sol does not duplicate verification.
- Before adding a new artifact, search for an existing route, DTO, type, model, helper, component, migration, or skill that already owns the behavior.
- Keep worker prompts independent and non-overlapping so results can be integrated without duplicate implementations.
- Spawn prompts contain only the Obsidian packet path and `execute now`; the packet owns all other context.
- Ordinary requests use three Obsidian files and one Luna turn. Do not create separate discovery and implementation turns for a bounded surface.
