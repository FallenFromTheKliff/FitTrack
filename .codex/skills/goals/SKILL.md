---
name: goals
description: "Use when the user starts a request with `/goals` or asks to run a bounded FitTrack frontend goal in Codex. Loads the repo Safe Goals Mode config, keeps scope narrow, and uses Exa only for focused docs or external-reference questions."
---

# FitTrack Goals Mode

Use this skill for Codex requests that begin with `/goals`, mention `/goals`, or ask for a bounded FitTrack frontend goal.

## Startup

1. Read `.ai-frontend/config.json`.
2. Read `.ai-frontend/goals-mode.md`.
3. Load only the smallest additional `.ai-frontend` guide needed for the target:
   - `AI_CONTEXT.md` for current repo shape and contract ownership.
   - `monorepo.md` for routes, packages, imports, and app boundaries.
   - `context-recovery.md` after compaction, resume, or unclear active-task history.
   - `ui-ux-workflow.md` for UI/UX enhancement, redesign, screenshot, and Notion-read rules.
   - `style.md` for visual implementation rules.
   - `performance.md` for render and query guardrails.
   - `component-rules.md` for component placement.
   - `context-protection.md` when touching contexts, shared clients, or global state.

## Scope

Before acting, classify the goal as exactly one target:

- `web-only`
- `mobile-only`
- `shared-package-only`
- `frontend-contract-investigation`
- `cross-surface`, only when explicitly requested

Keep the goal inside that boundary. Backend files are contract context only unless the user explicitly asks for backend changes.

## Tool Rules

- Prefer local files, `rg`, git status/diff, and focused static commands first.
- Use Exa only when a named docs, library API, version-sensitive, or external-reference question cannot be answered from local repo truth.
- Use at most one heavy MCP lane per phase.
- Do not start Docker, dev servers, emulators, browser automation, Playwright, Chrome DevTools, Figma, Notion, Swagger, or GitHub unless the current goal explicitly needs that tool under `.ai-frontend/goals-mode.md`.
- Stop using an MCP once the named question is answered.

## Closeout

Report the target classification, changed files, verification performed, and any skipped runtime checks with the reason.
