# FitTrack Frontend Agent

## First Pass

Before frontend work:

1. Read `.ai-frontend/config.json`.
2. Read the smallest relevant set of `.ai-frontend` guidance:
   - `AI_CONTEXT.md` for current repo shape and contract ownership
   - `monorepo.md` for routes, packages, and imports
   - `context-recovery.md` after compaction, resume, or unclear active-task history
   - `ui-ux-workflow.md` for UI/UX enhancement, redesign, screenshot, and Notion-read rules
   - `style.md` for visual implementation rules
   - `performance.md` for render and query guardrails
   - `component-rules.md` for component placement
   - `context-protection.md` when touching contexts, shared clients, or global state
3. Classify the target:
   - `apps/mobile/` means Expo member app rules.
   - `apps/web/` means Next admin/staff app rules.
   - `packages/` means shared contract, query, controller, token, type, or validator rules.
4. Treat backend as contract context only. Do not edit `apps/api/` unless the user explicitly authorizes backend work for the current task.
5. Prefer local repo truth over memory. Use Notion only when explicitly requested, and never as a replacement for current source files.

## Safe Goals Mode

- Before running or continuing any `/goals` task, read `.ai-frontend/goals-mode.md` and apply its scoping, tool budget, runtime budget, Docker budget, and cleanup rules.
- Classify `/goals` work as one target area before acting: web-only, mobile-only, shared-package-only, frontend-contract-investigation, or explicitly requested cross-surface.
- After context compaction or resume, read `.ai-frontend/context-recovery.md`, reconstruct the active task from the newest user message, current git status/diff, and touched files, then continue within the established scope.
- Notion is project notes only, not default execution context.
- If the user explicitly asks to read Notion, fetch only the named page or sections, integrate durable rules locally when appropriate, and then stop using Notion for the task.
- Playwright and ChromeDevTools must not both be used in the same goal unless the user explicitly asks.
- Screenshot checks must be bounded: one screenshot per iteration, maximum three iterations, then summarize blockers.
- File-only audits must not open the app, browser, Playwright, Docker, or emulator.

## Role

Frontend-focused TypeScript agent for the FitTrack monorepo. The agent owns web/mobile UI, frontend state, query wiring, client-side controllers, shared frontend contracts, and visual/runtime polish.

| Surface | Framework | Audience | Styling |
|---|---|---|---|
| `apps/mobile` | Expo 55, Expo Router, React Native 0.83, React 19 | Members | Style factories, Reanimated, app-local Fit components |
| `apps/web` | Next.js 16 App Router, React 19 | Admin and staff | Style factories, CSS variables, Tailwind through `cn()`, app-local Fit components |

## Scope Rules

- Frontend work may touch `apps/web/`, `apps/mobile/`, and frontend-owned shared packages in `packages/`.
- Shared packages are allowed when the change belongs to a reusable contract, query option, controller helper, validator, type, token, or pure utility.
- Backend files in `apps/api/` may be read only when contract truth cannot be established from `packages/api-client`, `packages/query`, existing frontend usage, Swagger, or explicitly requested Notion notes. Backend edits require explicit user permission.
- Do not introduce Redux, Zustand, Jotai, MobX, or a new global provider without explicit approval.
- Do not weaken TypeScript strictness, add broad `any`, or add suppression comments.

## Page And Screen Body Rule

- Web `page.tsx` files and mobile Expo Router screen files own the body composition for their route or screen.
- A route or screen may stay thin, but it should not simply return one full-page or full-screen surrogate such as `XxxPageContent`, `XxxDashboard`, `XxxScreenContent`, or `XxxShell` that hides the actual body elsewhere.
- Keep data orchestration, mutations, repeated derived state, and bulky handlers in hooks, controllers, helpers, or shared frontend packages.
- Keep components surgical: Fit primitives, bounded sections, panels, tables, forms, modals, overlay frames, and page-specific pieces are good; components that house an entire page or screen body are not.
- If a page or screen becomes too large, split the body by section or interaction while leaving the route or screen file as the readable assembly point.

## Current Data Contract Rule

Frontend should prefer these layers, in order:

1. `@fittrack/query` query and mutation option helpers
2. `@fittrack/api-client` domain clients and exported DTO/record types
3. `@fittrack/app-core` controllers and transform helpers
4. `@fittrack/types` and `@fittrack/validators`
5. local app adapters, only when the shape is route-specific

Do not create ad hoc `fetch` or one-off axios clients inside pages/components. Web uses `webApiClient` from `apps/web/lib/api-client.ts`. Mobile uses `mobileApiClient` from `apps/mobile/lib/api-client.ts`.

## Mobile Rules

- Use app-local Fit components from `apps/mobile/components/fit/` where they exist.
- Use `makeXxxStyles(colors: ThemeColors)` factories and memoize them with `useMemo`.
- Use Reanimated for native animations. Do not import `Animated` from `react-native`.
- Keep ordinary tab screens mounted. Use focus to pause work, not to tear down whole screens.
- Use `@fittrack/query`, `@fittrack/api-client`, and `@fittrack/app-core` for API-backed state and actions.
- Use AsyncStorage through existing token/theme/session helpers, not new storage key schemes.

## Web Rules

- Files using hooks, browser APIs, or event handlers must start with `"use client"`.
- Public and unauthenticated web routes live under `apps/web/app/(land)/`.
- Authenticated admin, staff, coach, and member web portal routes live under `apps/web/app/(auth)/`.
- Use `webApiClient` from `@/lib/api-client`.
- Use TanStack Query through `@fittrack/query` helpers where available.
- Use app-local Fit components from `apps/web/components/fit/`.
- Use lucide icons directly; import only the icons used.
- Use `framer-motion` for meaningful web entrance/transition work only after layout and data behavior are correct.

## MCP And Tool Use

- Local filesystem search is the default for repo discovery.
- Before opening an MCP, name the exact question it must answer. If local files, `rg`, git diff, or package source can answer it, do not use the MCP.
- Use one heavy MCP lane per phase. Do not combine browser/runtime/design/remote MCPs unless the user explicitly asks or the first tool proves insufficient.
- Stop using an MCP once the named question is answered. Do not keep it in the loop for reassurance, broad browsing, or repeated checks.
- Serena is only for targeted semantic or symbol navigation when local search is insufficient, or when a coding tool requirement explicitly needs its project instructions.
- Exa is for docs fetching, unfamiliar framework/library APIs, version-sensitive behavior, or focused external reference checks that cannot be answered from the repo or lockfiles.
- Notion is allowed only when the user explicitly asks for project notes such as `FITTRACK: Backup Log`; source files remain implementation truth.
- Playwright is for requested runtime verification or visual checks after changes; do not open the app for file-only audits.
- ChromeDevTools is for requested or evidence-backed console, network, hydration, or performance debugging, not ordinary visual review.
- Swagger is for runtime API contract truth only after frontend usage, `@fittrack/query`, and `@fittrack/api-client` are insufficient.
- GitHub is for PRs, issues, workflow runs, or branch coordination.
- Figma is for explicit design capture, approved scaffold work, or design-to-code comparison, not backend or hidden contract truth.
- Prefer the narrowest MCP target available: a named page, node, route, test flow, PR, issue, or endpoint rather than broad workspace exploration.

## Routing Reference

- `apps/mobile/` -> Mobile member app.
- `apps/web/` -> Web admin/staff app.
- `packages/api-client`, `packages/query`, `packages/app-core`, `packages/types`, `packages/validators` -> frontend contract layer.
- `packages/ui` -> tokens, themes, fonts, radii, shared style constants. Do not assume it contains cross-platform component implementations.
