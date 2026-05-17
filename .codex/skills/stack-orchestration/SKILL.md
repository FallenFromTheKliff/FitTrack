---
name: stack-orchestration
description: "Use for FitTrack local stack start, stop, status, web-versus-native QR selection, with-or-without AI startup, seed and reset flows, health checks, and known log locations. Use when the task is operating the normal FitTrack development stack, not when the machine itself needs Docker, WSL, network, or OS repair."
---

# FitTrack Stack Orchestration

Use this skill for normal FitTrack stack operations and day-to-day local environment workflows.

## Changelog

- 2026-04-17: added runtime-shape awareness, watcher-aware operator rules, health and log defaults, and stronger start-vs-status decision guidance.
- 2026-05-17: added runtime-guardrails alignment for rogue process prevention and blank Playwright or DevTools recovery.

## First pass

- Use Serena before broad shell scanning.
- Read only what is needed:
  - `references/command-matrix.md`
  - root `package.json`
  - `apps/mobile/package.json`
  - `tasks/integration-builder/dev-stack-supervisor.mjs` when supervisor behavior matters
- Classify the request first:
  - start
  - stop
  - status
  - web versus native QR
  - with AI versus without AI
  - seed or reset
  - health check
  - logs

## Scope boundaries

- Own normal stack command selection, operator guidance, and safe sequencing.
- Own known health checks, expected ports, runtime shapes, watcher behavior, and known log locations.
- Do not own Docker Desktop repair, WSL repair, phone network troubleshooting, OS permissions, or machine-specific infrastructure surgery.

## Runtime shapes

- `api-only`
- `web-plus-api`
- `full-standard`
- `full-ai`
- `native-only`
- `expo-web-only`

## Watcher-aware operator rules

- Treat `pnpm dev:stack` and `pnpm dev:stack:ai` as supervisor-owned flows, not disposable one-off commands.
- Prefer `pnpm dev:stack:status` before issuing another start command when the stack may already be running.
- Prefer `pnpm dev:stack:stop` for supervisor-owned shutdowns instead of ad hoc process killing.
- Treat Expo crash or restart loops as runtime-owned until status, logs, or health prove the stack is actually down.
- Prefer health or manifest truth over terminal assumptions.
- Do not spawn ad hoc `node`, `next`, `expo`, `npm`, or `pnpm` dev servers when the supervised stack may already own the runtime. Use `runtime-guardrails` when process ownership, blank browser state, or Playwright/DevTools availability is unclear.

## MCP routing

- Serena is required for command truth and repo navigation.
- Prisma Local is required when the operator task depends on database state, schema state, seed state, or Prisma Studio truth.
- Browser DevTools, Swagger, and Playwright are not start-up MCPs. Use them only when the request explicitly becomes a verification task after the stack is running.
- A blank Playwright or DevTools page is not proof the stack is down. Navigate directly to the configured FitTrack route before recommending a restart.

## Workflow

1. Identify the desired runtime shape.
2. Check whether a watcher-owned runtime may already be active.
3. Resolve the smallest correct repo-native command set.
4. Preserve the current stack unless the request explicitly asks for stop or reset behavior.
5. Prefer additive seed flows before destructive reset flows.
6. Report the next visible operator step and the expected success signal.

## Runtime defaults

- Prefer `pnpm dev:stack` for normal web-plus-backend local work.
- Prefer `pnpm dev:stack:ai` when the AI microservice must run too.
- Prefer `pnpm dev:mobile` for native Expo QR output.
- Prefer `pnpm dev:mobile:web` only when the user explicitly wants Expo web.
- Prefer `pnpm dev:stack:status` and `pnpm dev:stack:stop` for supervised stack lifecycle checks.

## Output defaults

- Return the exact command or command sequence.
- State whether the answer is for web, native QR, or AI-enabled runtime.
- Include the expected health signal or next confirmation step.
- If a watcher-owned stack may already be running, say so before recommending a duplicate start.
- If the request is actually machine repair instead of stack orchestration, say so and stop at the boundary.
