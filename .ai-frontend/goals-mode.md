# Safe Goals Mode

Safe Goals Mode keeps Codex `/goals` work bounded for a 16 GB laptop and a large FitTrack monorepo. A goal must stay narrow, prefer static repository truth first, and avoid heavy tool chains unless the user explicitly asks for them.

## Target Area

`/goals` must work on one target area at a time:

- `apps/web`
- `apps/mobile`
- `packages`
- backend contract reading only

Never treat FitTrack as one giant workspace during `/goals`. Do not scan, run, or verify unrelated app surfaces when the task belongs to one target area.

## Task Classification

Before acting, classify the task as exactly one of:

- `web-only`
- `mobile-only`
- `shared-package-only`
- `frontend-contract-investigation`
- `cross-surface`, only when the user explicitly asks for it

If the request is ambiguous, choose the smallest matching classification and keep the work inside that boundary.

## Tool Budget

Default `/goals` tool budget:

- Local filesystem/search: allowed.
- Git diff/status: allowed.
- Context7: allowed only for uncertain or version-sensitive framework/library behavior.
- Swagger: allowed only for API contract truth after frontend shared packages and current usage are insufficient.
- Notion: disabled by default; use only when the user explicitly asks for Notion notes.
- Serena: disabled by default; use only after local search fails or for targeted symbol navigation.
- Playwright: disabled by default; use only when the user explicitly asks for runtime or visual verification.
- ChromeDevTools: disabled by default; use only when the user explicitly asks for console, network, or performance debugging.
- Figma: disabled by default; use only for user-provided or approved design capture and design-to-code comparison.
- GitHub: disabled by default; use only for PR, issue, CI, or branch coordination tasks.

## MCP Precision Checklist

Before using any MCP, confirm:

- the current task has a specific question local files cannot answer efficiently;
- the MCP is the lightest tool that can answer that question;
- the target is narrow, such as one page, route, Figma node, endpoint, issue, PR, or runtime flow;
- another heavy MCP is not already active for the same phase;
- the result will directly change the implementation, verification decision, or user answer.

If those checks fail, stay with local filesystem search, git diff/status, and focused static commands.

## Notion Handling

- Notion must stay asleep unless the user explicitly asks to read or update a Notion page.
- If Notion is explicitly requested, fetch only the named page, database, or sections needed for the task.
- Treat Notion pages as read-only unless the user explicitly asks to write to Notion and the page is writable.
- Durable rules from Notion should be integrated into local `.ai-frontend` files when appropriate so future work does not require Notion reads.
- After the needed Notion read is complete, continue with local files and do not keep Notion in the execution loop.

## Runtime Budget

- Do not start more than one app surface in a single goal.
- Do not start web and mobile together.
- Do not start frontend and backend together unless the user explicitly asks for integration verification.
- Do not run browser automation, ChromeDevTools, Docker, emulator, and semantic indexing in the same goal unless the user explicitly asks and the task truly requires it.
- Do not launch Android Emulator by default.
- Do not run full monorepo builds by default.
- Prefer focused package/app commands over root-wide commands.
- Prefer static checks before runtime verification.
- Take at most one screenshot per verification iteration.
- Stop after 3 failed verification iterations and summarize blockers.
- Do not keep retrying visual checks indefinitely.

## Context Compaction

- Context compaction does not reset or broaden a goal.
- After compaction, recover the active task with `.ai-frontend/context-recovery.md` before editing or verifying further.
- Reconstruct the current goal from the newest user message, current filesystem state, `git status`, scoped `git diff`, and touched files.
- Do not use Notion, Serena, Playwright, ChromeDevTools, Figma, Swagger, GitHub, Docker, emulator access, browser automation, or dev servers just to regain context.

## Docker Budget

- Do not start Docker unless the current task requires backend/dependency containers.
- If Docker is already running, use only the minimum services needed.
- Do not rebuild containers unless the task explicitly requires it.

## Cleanup

After any runtime verification, stop dev servers, browser sessions, watchers, or child processes started for the task.

## Example Safe `/goals` Prompts

Web-only task:

```text
/goals Update only the apps/web inventory table empty state. Treat this as web-only, use local search first, avoid Docker/backend/mobile, and run only focused static checks unless I ask for runtime verification.
```

Mobile-only task:

```text
/goals Fix only the apps/mobile membership renewal screen spacing. Treat this as mobile-only, do not launch Android Emulator or Expo unless I ask, and prefer file inspection plus focused TypeScript checks.
```

Shared-package task:

```text
/goals Update only the shared membership DTO types in packages. Treat this as shared-package-only, do not start any app surface, and verify with targeted package checks rather than a full monorepo build.
```
