# Runtime Checklist

Use this checklist before starting, stopping, killing, or declaring a browser verification tool broken.

## State And Ports

- Run `pnpm dev:stack:status` first when the supervised stack may already exist.
- Check `.artifacts/dev-stack-manifest.json` when present; prefer manifest ownership over guesses.
- Check health:
  - API: `http://127.0.0.1:3001/v1/health`
  - Web: `http://127.0.0.1:8080/login`
  - Mobile Expo web: `http://127.0.0.1:8081/login`
  - AI: `http://127.0.0.1:8000/health`
- Check listeners on Windows:
  - `Get-NetTCPConnection -LocalPort 3001,8080,8081,8000 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess`
- Inspect owning commands:
  - `Get-CimInstance Win32_Process | Where-Object { ($_.Name -match 'node|pnpm|cmd|powershell') -and ($_.CommandLine -match 'dev-stack|3001|8080|8081|8000|expo|next|nest|start-dev|apps/mobile') } | Select-Object ProcessId,Name,CommandLine`

## Logs And Artifacts

- Supervisor manifest: `.artifacts/dev-stack-manifest.json`
- Supervisor logs: `.artifacts/dev-stack-supervisor.out.log`, `.artifacts/dev-stack-supervisor.err.log`
- API logs: `.artifacts/api-stack.out.log`, `.artifacts/api-stack.err.log`
- Web logs: `.artifacts/web-stack.out.log`, `.artifacts/web-stack.err.log`
- Mobile web logs: `.artifacts/mobile-stack.out.log`, `.artifacts/mobile-stack.err.log`
- AI logs: `.artifacts/ai-stack.out.log`, `.artifacts/ai-stack.err.log`
- Playwright MCP artifacts: `.artifacts/playwright-mcp`

## Start Rules

- Use `stack-orchestration` for command choice.
- Prefer `pnpm dev:stack` for normal web plus API work.
- Prefer `pnpm dev:stack:ai` only when the AI service is required.
- Prefer `pnpm dev:stack:web` for browser-only web plus API checks.
- Prefer `pnpm dev:mobile` for native Expo QR.
- Prefer `pnpm dev:mobile:web` for browser-driven mobile verification.
- Do not run ad hoc `npm run dev`, `next dev`, `expo start`, `node server.js`, or one-off sidecars unless the repo command or user explicitly calls for it.

## Blank Browser Recovery

- Treat an initial blank Playwright MCP page as normal until direct navigation fails with evidence.
- Navigate to the configured route from `.playwright-fittrack-flow.json`, then snapshot.
- If the snapshot is empty, reload once, wait for navigation, then inspect console and network.
- If the route is protected, navigate to `/login` first and verify the expected redirect or authenticated state.
- Do not conclude "Playwright MCP is broken" without checking route reachability and MCP artifacts.

## Playwright Snapshot Recovery

- Use web base URL `http://127.0.0.1:8080` and mobile Expo web base URL `http://127.0.0.1:8081`.
- Confirm `.playwright-mcp.json` output mode and artifact directory when evidence is needed.
- Capture network and console observations for touched endpoints, not just screenshots.
- If navigation times out, compare the app health URL and the browser network failure before restarting anything.

## Chrome DevTools Recovery

- Use the current tab if available; otherwise navigate the selected target directly to the known URL.
- Check console errors, failed network requests, status codes, and redirects.
- A blank current tab is not proof that Chrome DevTools is broken.
- If DevTools shows no target or cannot connect, report that separately from app runtime health.

## Safe Shutdown

- For supervisor-owned processes, use `pnpm dev:stack:stop`.
- For infra-only Docker work, use the stack-orchestration guidance before `pnpm infra:down`.
- Kill a process only when its command line proves it is the disposable process you own or the user explicitly approves.
- Never stop or reset another worker's runtime just to get a clean slate.

## When To Ask The User

- A port is occupied by an unknown or user-owned process.
- The requested action would kill a long-running watcher, reset data, or stop Docker services.
- The user asked for verification but no route, role, or surface can be inferred safely.
- Starting a new long-lived watcher is required and no existing FitTrack command clearly owns it.
- Browser MCP or DevTools appears unavailable after direct navigation, health checks, and console/network checks.
