---
name: fittrack-orchestrator
description: "Use as the thin top-level router for FitTrack prompts that need feature adding, UI tweaks, integration pages, large implementation planning, multi-skill routing, or user-permitted subagents/parallel workers. Classify intent, select downstream skills such as integration, frontend, backend, quality-assurance, debugger, runtime-guardrails, railway-deployment, browser-runtime-loop, layout-wireframe-gate, and related FitTrack skills, and coordinate bounded local or delegated work without replacing integration."
---

# FitTrack Orchestrator

This skill is a thin router for FitTrack work. Use it to decide the right execution shape, choose downstream skills, prepare bounded worker packets when delegation is allowed, integrate results, and close with verification.

Do not replace `$integration`. Route to `$integration` when the task is full-stack, contract-heavy, or needs end-to-end completion auditing.

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

4. Choose execution mode.
   - `local-only`: default. The active agent does the work with selected skills.
   - `sidecar`: one delegated specialist for one disjoint slice, using explicit user permission or standing project permission.
   - `parallel-workers`: at most 3 active agents per batch by default, using explicit user permission or standing project permission and non-overlapping write scopes.
   - `async-check`: one worker runs a long but bounded verification, log analysis, or page click-through task and returns what works, what fails, and evidence while the main agent continues non-overlapping work.
   - `serialized`: required when shared files, contracts, route registries, schemas, generated clients, or migration-sensitive code would overlap.

5. Create compact worker packets when delegation is allowed.
   - Give each worker one skill or one disjoint slice.
   - Include the goal, owned write scope, relevant read-only context, commands to run, forbidden paths, and expected return format.
   - Do not ask workers to broadly rescan the repo. Give narrowed files, search terms, and artifacts.

6. Keep shared files owned by the main agent.
   - Main agent owns routing, file ownership map, integration decisions, and shared edits.
   - Treat package metadata, Prisma schema/migrations, generated clients, shared API clients, route registries, layout shells, design tokens, env files, Docker/Railway config, and task trackers as shared unless proven otherwise.
   - Workers may report required shared changes, but the main agent applies them after reviewing collisions.

7. Integrate results.
   - Reconcile worker outputs against repo conventions and current worktree state.
   - Check for duplicate routes, DTOs, types, services, components, and migrations before adding new ones.
   - Prefer small, compatible edits over broad rewrites.

8. Verify.
   - Select verification from the touched surface: typecheck, lint, unit/integration tests, direct API checks, Swagger, Browser/Playwright, runtime health, or deployment log checks.
   - Use `$quality-assurance` for final bug sweeps or when evidence needs to be structured.
   - Report skipped verification honestly with the reason.

## Delegation Policy

Default to local-only for small tasks. Spawn subagents implicitly when the user has given standing permission for this project or thread and the task has a clear parallel or async slice. Ask first only when delegation would touch risky shared files, run long or expensive commands, need credentials, use destructive operations, or change the user-visible product direction.

Treat the user's standing preference as: `request -> subagent appropriate? -> spawn the right bounded worker -> integrate results`. Do not wait for another permission prompt when the work is read-heavy, verification-heavy, or has a disjoint write scope.

Never parallelize overlapping write scopes. If two slices need the same shared file, serialize them and let the main agent edit that file.

Use at most 3 active workers per batch by default. This reflects the practical session limit observed in Codex; close completed workers before launching another batch unless the environment clearly supports more. Use one agent per skill or disjoint slice. Do not create multiple agents to investigate the same broad area.

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

For async verification workers, require this return shape:

```text
Verdict:
Works:
Broken:
Evidence:
Blocked:
Next recommended fix:
```

## Routing Rules

- Use `$debugger` before patching tricky failures, repeated failed fixes, flaky tests, CI/local mismatches, or unclear runtime errors.
- Use `$runtime-guardrails` before starting, stopping, killing, or diagnosing local stack processes, ports, blank local pages, or browser-tool confusion.
- Use `browser-runtime-loop` when available for live local browser interaction loops; otherwise combine the Browser plugin with `$runtime-guardrails` and `$quality-assurance`.
- Use `layout-wireframe-gate` when available for subjective or risky layout direction. Let it choose the cheapest honest approval artifact: no artifact for tiny polish, a layout delta packet for medium changes, screenshot or ASCII direction for high-risk composition, and static HTML only for major route/modal architecture or explicit preview requests.
- Use `$railway-deployment` for Railway build, Dockerfile/Railpack/Nixpacks, healthcheck, production env, or deploy-log failures.
- Use `$frontend` for web/mobile implementation and data wiring inside frontend ownership.
- Use `$backend` for NestJS, Prisma, DTOs, Swagger, auth guards, repositories, queue logic, and backend tests.
- Use `$quality-assurance` after implementation or for review-style verification.
- Add `$security-hardening` when touched surfaces include auth, permissions, payments, sensitive user data, uploads, external integrations, or AI endpoints.
- Use custom agent prefabs from `.codex/agents/` for repeated worker shapes such as browser runtime verification, debugging, Railway deployment, schema contract sync, UI layout, QA, frontend, backend, research, and skill maintenance.

## Goals Compatibility

The official `/goal` flow may name `$fittrack-orchestrator` and downstream skills in its prompt. Follow the goal's active instructions when present, then use this skill to route the work.

Do not claim to start, enable, or programmatically control Goals mode. If the user is not already in an official `/goal` flow, operate normally and say that this skill can coordinate the work but cannot start Goals mode itself.

## Token And Duplication Control

- Narrow context before delegating: pass file lists, focused snippets, endpoint names, route names, component names, failing commands, and logs.
- Ask workers for deltas, evidence, and decisions, not long repo summaries.
- Avoid broad rescans unless the classification step shows the target is unknown.
- Before adding a new artifact, search for an existing route, DTO, type, model, helper, component, migration, or skill that already owns the behavior.
- Keep worker prompts independent and non-overlapping so results can be integrated without duplicate implementations.
