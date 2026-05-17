---
name: runtime-guardrails
description: "FitTrack runtime guardrails for local stack/server start-stop-status confusion, Playwright MCP or Chrome DevTools blank page confusion, rogue Node processes, API/web/mobile route verification, and browser verification when runtime state is unclear. Use before starting or killing local runtimes, when checking known ports/processes/logs, or when deciding whether a blank MCP page means the browser tool is broken."
---

# FitTrack Runtime Guardrails

Use this skill when runtime state is ambiguous. Its job is to prevent duplicate watchers, rogue Node processes, unnecessary sidecars, and false "browser MCP is broken" conclusions.

## Core Default

Assume the API/dev stack may already be running. Check existing stack state, known ports, process ownership, health URLs, and logs before starting anything.

Do not spawn ad hoc `npm`, `pnpm`, `node`, `next`, `nest`, or `expo` servers unless the owning FitTrack stack command says to do so or the user explicitly asks for that exact runtime.

## Preferred Sources

- Use the `stack-orchestration` skill for lifecycle command selection and normal start/stop/status work.
- Prefer `.codex/skills/stack-orchestration/references/command-matrix.md` for canonical commands, ports, health URLs, and logs.
- Prefer `.playwright-mcp.json` and `.playwright-fittrack-flow.json` for browser verification URLs, artifacts, viewport, and role expectations.
- Prefer existing approved commands such as `pnpm dev:stack:status`, `pnpm dev:stack`, `pnpm dev:stack:ai`, `pnpm dev:stack:web`, `pnpm dev:mobile:web`, and `pnpm dev:stack:stop`.
- Prefer repo health/status scripts and manifest truth over terminal assumptions.

## Runtime Workflow

1. Classify the need: status check, start, stop, route verification, browser recovery, or rogue process cleanup.
2. If lifecycle ownership matters, load `stack-orchestration` and use its command matrix.
3. Check current state before any start command:
   - `pnpm dev:stack:status`
   - `.artifacts/dev-stack-manifest.json`
   - known listening ports: API `3001`, web `8080`, mobile Expo web `8081`, AI `8000`
   - process command lines for Node, pnpm, Next, Nest, and Expo ownership
4. Check health or reachability:
   - API: `http://127.0.0.1:3001/v1/health`
   - Web: `http://127.0.0.1:8080/login`
   - Mobile Expo web: `http://127.0.0.1:8081/login`
   - AI: `http://127.0.0.1:8000/health`
5. If the stack is healthy or partially healthy, reuse it. Start only the missing repo-owned surface if the task requires it.
6. If the user asked to stop a supervised stack, use `pnpm dev:stack:stop`. Avoid manual process killing unless process ownership is known and the stop command cannot apply.

## Browser MCP Guardrails

Playwright MCP may initially look blank, idle, or stuck and still be usable. Do not classify it as broken from an empty first page, blank screenshot, or `about:blank`.

Recover by navigating directly to the configured app route, then snapshot:

- Web: `http://127.0.0.1:8080/login` or the touched web route.
- Mobile Expo web: `http://127.0.0.1:8081/login` or the touched mobile route.
- API docs or JSON when relevant: `http://127.0.0.1:3001/v1/docs` or `http://127.0.0.1:3001/v1/docs-json`.

Use Chrome DevTools similarly: inspect or redirect the current tab, navigate directly to the known URL, then use console and network evidence before declaring the tool or app broken.

## Verification Defaults

- Verify routes against the active local URLs from `.playwright-fittrack-flow.json`.
- Capture browser evidence after direct navigation, not only from the initial blank MCP state.
- For API/web/mobile integration, include health, route reachability, console/network observations, and any Playwright artifacts under `.artifacts/playwright-mcp`.
- If a route is protected, navigate to the configured login route first and verify the expected redirect or auth state.

## Rogue Process Rules

- Treat a port conflict as "ownership unknown" until the process command line is checked.
- If the process belongs to the supervisor manifest, use supervisor status/stop commands.
- If the process was spawned by the current task and is clearly disposable, stop that process directly.
- If the process may belong to the user, another worker, Docker, or an external tool, ask before killing it.
- Do not create sidecar servers just because a port check or browser snapshot failed once.

## Checklist

Read `references/runtime-checklist.md` when you need exact checks for ports, processes, logs, blank browser recovery, Playwright snapshots, DevTools console/network, safe shutdown, or when to ask the user.
